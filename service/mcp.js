// WhatsApp service for many users: each user links their own WhatsApp (their own QR) and connects their own ChatGPT.
// A superadmin creates and manages accounts and can read (never send from) every account's chats. Every such view is logged
// and shown to the account's owner.
//
//   data/users.db             accounts, ChatGPT sign-ins (each token belongs to one user)
//   data/users/<id>/          one user's workspace: whatsapp.db, WhatsApp login, media, auto-reply settings
//
// Every request is tied to exactly one user before it reaches a workspace:
//   dashboard → /api/*   x-api-key (shared with the dashboard server) + the signed-in user's id and session version
//   ChatGPT   → /mcp     OAuth bearer token, which belongs to the user who signed in
// A superadmin can add ?as=<user id> (dashboard) or account=<name> (ChatGPT read tools) to read another account, read-only.
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { createOAuth } from './oauth.js'
import { createUsers, validatePassword } from './users.js'
import { createWorkspace } from './workspace.js'

// libsignal logs whole session objects (including key material) on routine key rotation — keep that out of the logs
const SIGNAL_NOISE = /^(Closing session|Closing open session|Removing old closed session|Session already closed|Decrypted message with closed session|Migrating session|Failed to decrypt message with any known session|Session error|Opening session|Closing stale open session|Session already open)/
for (const k of ['log', 'info', 'warn', 'error']) {
  const orig = console[k].bind(console)
  console[k] = (...a) => (typeof a[0] === 'string' && SIGNAL_NOISE.test(a[0]) ? undefined : orig(...a))
}

const PORT = Number(process.env.MCP_PORT || 3940)
const HOST = process.env.MCP_HOST || '127.0.0.1'
const DATA_DIR = path.resolve(process.env.DATA_DIR || './data')
fs.mkdirSync(path.join(DATA_DIR, 'users'), { recursive: true, mode: 0o700 })

// Key the dashboard server uses to call /api (never sent to browsers). Also the secret part of the local MCP link.
const TOKEN_FILE = './.mcp-token'
const TOKEN =
  process.env.MCP_TOKEN ||
  (fs.existsSync(TOKEN_FILE) ? fs.readFileSync(TOKEN_FILE, 'utf8').trim() : (() => {
    const t = crypto.randomBytes(18).toString('base64url')
    fs.writeFileSync(TOKEN_FILE, t, { mode: 0o600 })
    return t
  })())
const MCP_PATH = `/mcp/${TOKEN}`
const sameSecret = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a ?? '')).digest()
  const y = crypto.createHash('sha256').update(String(b ?? '')).digest()
  return crypto.timingSafeEqual(x, y)
}

// ---------------------------------------------------------------- accounts
const db = new DatabaseSync(path.join(DATA_DIR, 'users.db'))
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
const users = createUsers(db)
const userDir = (id) => {
  if (!/^[a-f0-9]{18}$/.test(id)) throw new Error('bad user id')
  return path.join(DATA_DIR, 'users', id)
}

// First start: create the superadmin from the old single login, and move the existing WhatsApp data into their workspace.
if (users.count() === 0) {
  let password = process.env.DASHBOARD_PASSWORD
  if (!password) {
    password = crypto.randomBytes(9).toString('base64url')
    const f = path.join(DATA_DIR, 'initial-admin-password.txt')
    fs.writeFileSync(f, `${password}\n`, { mode: 0o600 })
    console.log(`Created the superadmin. Their password is in ${f} (delete the file after signing in).`)
  }
  const admin = await users.create({
    username: process.env.DASHBOARD_USER || 'admin',
    name: process.env.OWNER_NAME || '',
    password,
    role: 'superadmin',
  })
  const dir = userDir(admin.id)
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const moves = [['whatsapp.db', 'whatsapp.db'], ['whatsapp.db-wal', 'whatsapp.db-wal'], ['whatsapp.db-shm', 'whatsapp.db-shm'],
    ['auth-mcp', 'auth'], ['downloads', 'downloads'], ['autoreply.json', 'autoreply.json']]
  for (const [from, to] of moves) if (fs.existsSync(from)) fs.renameSync(from, path.join(dir, to))
  console.log(`Created superadmin "${admin.username}" and moved the existing WhatsApp data into their account.`)
  // keep the existing ChatGPT connection working: its sign-in now belongs to the superadmin
  const legacyDb = path.join(dir, 'whatsapp.db')
  if (fs.existsSync(legacyDb)) {
    db.exec(`ATTACH DATABASE '${legacyDb.replace(/'/g, "''")}' AS legacy`)
    try {
      const has = (t) => db.prepare("SELECT 1 FROM legacy.sqlite_master WHERE type = 'table' AND name = ?").get(t)
      if (has('oauth_clients')) {
        createOAuth({ db, publicUrl: 'http://x', authenticate: () => null, userById: () => null }) // creates the tables
        db.exec('INSERT OR IGNORE INTO oauth_clients SELECT client_id, secret_hash, name, redirect_uris, created FROM legacy.oauth_clients')
        if (has('oauth_tokens')) {
          db.prepare(`INSERT OR IGNORE INTO oauth_tokens (token_hash, kind, client_id, scope, expires, created, user_id)
            SELECT token_hash, kind, client_id, scope, expires, created, ? FROM legacy.oauth_tokens`).run(admin.id)
        }
        db.exec('DROP TABLE IF EXISTS legacy.oauth_tokens; DROP TABLE IF EXISTS legacy.oauth_codes; DROP TABLE IF EXISTS legacy.oauth_clients')
      }
    } finally {
      db.exec('DETACH DATABASE legacy')
    }
  }
}

// Who viewed whose chats. One row per admin, account and channel every 10 minutes.
db.exec(`CREATE TABLE IF NOT EXISTS access_log (id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id TEXT NOT NULL, admin_username TEXT,
  target_id TEXT NOT NULL, via TEXT NOT NULL, ts INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS access_log_target ON access_log(target_id, ts);`)
function logAccess(admin, target, via) {
  if (admin.id === target.id) return
  const now = Math.floor(Date.now() / 1000)
  const recent = db.prepare('SELECT 1 FROM access_log WHERE admin_id = ? AND target_id = ? AND via = ? AND ts > ?').get(admin.id, target.id, via, now - 600)
  if (recent) return
  db.prepare('INSERT INTO access_log (admin_id, admin_username, target_id, via, ts) VALUES (?, ?, ?, ?, ?)').run(admin.id, admin.username, target.id, via, now)
  console.log(`[admin ${admin.username}] viewed ${target.username}'s chats (${via})`)
}
const accessTo = (targetId, limit = 20) =>
  db.prepare('SELECT admin_username AS admin, via, ts FROM access_log WHERE target_id = ? ORDER BY ts DESC LIMIT ?').all(targetId, limit)

const oauth = createOAuth({
  db,
  publicUrl: process.env.PUBLIC_URL || `http://localhost:${PORT}`,
  authenticate: (u, p) => users.authenticate(u, p),
  userById: (id) => users.get(id),
})

// ---------------------------------------------------------------- workspaces (one per active user)
const workspaces = new Map()
function workspaceFor(user) {
  let ws = workspaces.get(user.id)
  if (!ws) {
    ws = createWorkspace({ user: { ...user }, dir: userDir(user.id), oauth })
    workspaces.set(user.id, ws)
  } else Object.assign(ws.user, user) // pick up name changes
  return ws
}
function closeWorkspace(id) {
  workspaces.get(id)?.close()
  workspaces.delete(id)
}
for (const u of users.list()) if (!u.disabled) workspaceFor(u) // linked accounts reconnect now

// ---------------------------------------------------------------- HTTP helpers
const json = (res, code, data) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(data))
}
async function readJson(req, max = 64 * 1024) {
  let raw = ''
  for await (const c of req) {
    raw += c
    if (raw.length > max) throw Object.assign(new Error('Body too large'), { code: 413 })
  }
  return raw ? JSON.parse(raw) : {}
}
const httpError = (code, message) => Object.assign(new Error(message), { code })

// What the admin sees about a user: account details and link status. Never chats, names of contacts or message text.
function adminView(u) {
  const ws = workspaces.get(u.id)
  const s = ws?.summary()
  return {
    id: u.id, username: u.username, name: u.name, role: u.role, disabled: u.disabled,
    created: u.created, lastLogin: u.lastLogin,
    whatsapp: s ? { status: s.status, linked: s.linked, number: s.number, chats: s.chats, messages: s.messages } : null,
    chatgptConnections: oauth.sessionsFor(u.id).length,
    lastViewedByAdmin: accessTo(u.id, 1)[0] || null,
  }
}

// ---------------------------------------------------------------- /api/admin/* (superadmin only)
async function adminApi(req, res, me, parts) {
  const [, resource, id] = parts // ['admin', 'users', id]
  if (resource !== 'users') return json(res, 404, { error: 'not found' })
  const m = req.method

  if (!id && m === 'GET') return json(res, 200, users.list().map(adminView))

  if (!id && m === 'POST') {
    const body = await readJson(req)
    const u = await users.create({ username: body.username, name: body.name, password: body.password, role: body.role === 'superadmin' ? 'superadmin' : 'user' })
    workspaceFor(u) // folder only; WhatsApp starts when they open their dashboard
    console.log(`[admin ${me.username}] created user ${u.username}`)
    return json(res, 201, adminView(u))
  }

  const target = id && users.find(id)
  if (!target) return json(res, 404, { error: 'No such user.' })

  if (m === 'PATCH') {
    const body = await readJson(req)
    const changes = {}
    if (body.name !== undefined) changes.name = body.name
    if (body.password !== undefined) changes.password = body.password
    if (body.role !== undefined) changes.role = body.role === 'superadmin' ? 'superadmin' : 'user'
    if (body.disabled !== undefined) changes.disabled = Boolean(body.disabled)
    if (target.id === me.id && (changes.disabled || changes.role === 'user')) throw httpError(400, "You can't disable your own account or remove your own superadmin role.")
    const losingAdmin = target.role === 'superadmin' && !target.disabled && (changes.disabled || changes.role === 'user')
    if (losingAdmin && users.countActiveSuperadmins() <= 1) throw httpError(400, 'There must always be at least one active superadmin.')
    const u = await users.update(target.id, changes)
    if (changes.password !== undefined || changes.disabled) oauth.revokeForUser(u.id) // sign their ChatGPT out too
    if (u.disabled) closeWorkspace(u.id)
    else workspaceFor(u)
    console.log(`[admin ${me.username}] updated user ${u.username}: ${Object.keys(changes).join(', ')}`)
    return json(res, 200, adminView(u))
  }

  if (m === 'DELETE') {
    if (target.id === me.id) throw httpError(400, "You can't delete your own account.")
    if (target.role === 'superadmin' && !target.disabled && users.countActiveSuperadmins() <= 1) throw httpError(400, 'There must always be at least one active superadmin.')
    const ws = workspaceFor(target)
    await ws.unlink().catch(() => {}) // remove the linked device from their phone
    closeWorkspace(target.id)
    oauth.revokeForUser(target.id)
    users.remove(target.id)
    fs.rmSync(userDir(target.id), { recursive: true, force: true })
    console.log(`[admin ${me.username}] deleted user ${target.username} and all their data`)
    return json(res, 200, { ok: true })
  }

  return json(res, 405, { error: 'method not allowed' })
}

// ---------------------------------------------------------------- /api/* (dashboard server only)
async function api(req, res, url) {
  if (!sameSecret(req.headers['x-api-key'], TOKEN)) return json(res, 401, { error: 'unauthorized' })
  const parts = url.pathname.split('/').slice(2).map(decodeURIComponent)

  // the dashboard checks a username/password here and keeps the result in its signed session cookie
  if (parts[0] === 'auth' && parts[1] === 'login' && req.method === 'POST') {
    const { username = '', password = '' } = await readJson(req)
    const u = await users.authenticate(String(username), String(password))
    return u ? json(res, 200, { user: u }) : json(res, 401, { error: 'Wrong username or password.' })
  }

  // everything else acts as one signed-in user
  const me = users.get(req.headers['x-user-id'])
  if (!me || String(me.sessionVersion) !== String(req.headers['x-session-version'])) {
    return json(res, 401, { error: 'signed_out' })
  }

  if (parts[0] === 'me' && !parts[1] && req.method === 'GET') return json(res, 200, me)
  if (parts[0] === 'me' && parts[1] === 'password' && req.method === 'POST') {
    const { current = '', next = '' } = await readJson(req)
    if (!(await users.checkPassword(me.id, current))) throw httpError(400, 'Your current password is wrong.')
    const err = validatePassword(next)
    if (err) throw httpError(400, err)
    const u = await users.update(me.id, { password: next })
    oauth.revokeForUser(me.id)
    return json(res, 200, { user: u })
  }

  // when a superadmin last read this account (shown to the account owner)
  if (parts[0] === 'me' && parts[1] === 'access' && req.method === 'GET') return json(res, 200, accessTo(me.id))

  if (parts[0] === 'admin') {
    if (me.role !== 'superadmin') return json(res, 403, { error: 'Only a superadmin can manage users.' })
    return adminApi(req, res, me, parts)
  }

  // superadmin reading another account: read-only, logged
  const as = url.searchParams.get('as')
  if (as && as !== me.id) {
    if (me.role !== 'superadmin') return json(res, 403, { error: "Only a superadmin can view other accounts' chats." })
    const target = users.get(as)
    if (!target) return json(res, 404, { error: 'No such account, or it is disabled.' })
    logAccess(me, target, 'dashboard')
    return workspaceFor(target).api(req, res, url, { readOnly: true })
  }

  return workspaceFor(me).api(req, res, url)
}

// For a superadmin's ChatGPT: find another account by username, name or linked WhatsApp number.
function mcpOptions(me) {
  if (me.role !== 'superadmin') return {}
  return {
    route(account) {
      const q = String(account).trim().toLowerCase().replace(/^@/, '')
      const digits = q.replace(/[^\d]/g, '')
      const active = users.list().filter((u) => !u.disabled)
      const matches = active.filter((u) => {
        if (u.username === q || (u.name || '').toLowerCase() === q) return true
        const n = workspaces.get(u.id)?.summary().number
        return digits.length >= 8 && n && (n.endsWith(digits) || digits.endsWith(n))
      })
      if (!matches.length) throw new Error(`No account matches "${account}". Call whatsapp_accounts to see them.`)
      if (matches.length > 1) throw new Error(`"${account}" matches several accounts: ${matches.map((u) => u.username).join(', ')}. Use the username.`)
      const target = matches[0]
      if (target.id !== me.id) logAccess(me, target, 'chatgpt')
      return workspaceFor(target)
    },
    isSelf(account) {
      const q = String(account).trim().toLowerCase().replace(/^@/, '')
      const n = workspaces.get(me.id)?.summary().number
      const digits = q.replace(/[^\d]/g, '')
      return q === me.username || q === (me.name || '').toLowerCase() || (digits.length >= 8 && !!n && (n.endsWith(digits) || digits.endsWith(n)))
    },
    listAccounts() {
      return users.list().filter((u) => !u.disabled).map((u) => {
        const s = workspaceFor(u).summary()
        const wa = s.status === 'connected' ? `WhatsApp +${s.number}` : s.linked ? 'WhatsApp reconnecting' : 'WhatsApp not linked'
        return `- ${u.username}${u.name ? ` (${u.name})` : ''}${u.id === me.id ? ' [you]' : ''}: ${wa}, ${s.chats} chats`
      }).join('\n')
    },
  }
}

// ---------------------------------------------------------------- server
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  if (url.pathname.startsWith('/api/')) {
    try {
      return await api(req, res, url)
    } catch (e) {
      // validation errors from users.js are plain Errors: report them as 400
      const userError = /^(Username|The username|Role|Password|No such user|There must|You can)/.test(e.message || '')
      const code = e.code === 413 ? 413 : Number.isInteger(e.code) && e.code >= 400 && e.code < 500 ? e.code : userError || e instanceof SyntaxError ? 400 : /not found|no such|no chat/i.test(e.message || '') ? 404 : 500
      if (code >= 500) console.error('api error:', e.message)
      return json(res, code, { error: String(e.message || e) })
    }
  }
  // OAuth endpoints used by ChatGPT to connect (/.well-known/*, /oauth/*)
  try {
    if (await oauth.handle(req, res, url)) return
  } catch (e) {
    console.error('oauth error:', e.message)
    if (!res.headersSent) return json(res, 400, { error: 'invalid_request', error_description: String(e.message || e) })
  }
  // /mcp = public connector (OAuth: the token decides whose WhatsApp). /mcp/<secret> = local use, first superadmin.
  let user = null
  if (url.pathname === '/mcp') {
    user = oauth.requireBearer(req, res)
    if (!user) return
  } else if (url.pathname === MCP_PATH) {
    user = users.list().find((u) => u.role === 'superadmin' && !u.disabled) || null
    if (!user) return json(res, 404, { error: 'no superadmin' })
  } else {
    res.writeHead(404).end('not found')
    return
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { allow: 'POST' }).end()
    return
  }
  try {
    let raw = ''
    for await (const chunk of req) {
      raw += chunk
      if (raw.length > 45 * 1024 * 1024) return json(res, 413, { error: 'Request too large (max ~30 MB file).' })
    }
    const server = workspaceFor(user).buildServer(mcpOptions(user))
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    res.on('close', () => { transport.close(); server.close() })
    await server.connect(transport)
    await transport.handleRequest(req, res, raw ? JSON.parse(raw) : undefined)
  } catch (e) {
    console.error('mcp error:', e)
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ error: String(e.message || e) }))
  }
}).listen(PORT, HOST, () => {
  console.log(`WhatsApp service on http://${HOST}:${PORT} — ${users.count()} account(s)`)
  console.log(`MCP connector URL (ChatGPT, Claude, Cursor…): ${oauth.resource()}`)
})

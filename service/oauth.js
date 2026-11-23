// Minimal OAuth 2.1 authorization server for MCP clients such as ChatGPT, Claude and Cursor (MCP authorization spec):
//   - protected resource + authorization server metadata (RFC 9728 / RFC 8414)
//   - dynamic client registration (RFC 7591), so ChatGPT can register itself
//   - authorization code + PKCE (S256) with a username/password login page
//   - short-lived access tokens, rotating refresh tokens; only SHA-256 hashes are stored
//   - every code and token belongs to exactly one user, so a ChatGPT connection only ever reaches that user's WhatsApp
import crypto from 'node:crypto'

const ACCESS_TTL = 60 * 60 // 1 hour
const REFRESH_TTL = 30 * 24 * 60 * 60 // 30 days
const CODE_TTL = 10 * 60
const SCOPES = ['whatsapp', 'offline_access']

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
const rand = (n = 32) => crypto.randomBytes(n).toString('base64url')
const now = () => Math.floor(Date.now() / 1000)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// authenticate(username, password) → user | null.  userById(id) → user | null (null or disabled = token no longer valid)
export function createOAuth({ db, publicUrl, authenticate, userById }) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_clients (client_id TEXT PRIMARY KEY, secret_hash TEXT, name TEXT, redirect_uris TEXT, created INTEGER);
    CREATE TABLE IF NOT EXISTS oauth_codes (code_hash TEXT PRIMARY KEY, client_id TEXT, redirect_uri TEXT, challenge TEXT, scope TEXT, resource TEXT, expires INTEGER, user_id TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS oauth_tokens (token_hash TEXT PRIMARY KEY, kind TEXT, client_id TEXT, scope TEXT, expires INTEGER, created INTEGER, user_id TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS oauth_tokens_user ON oauth_tokens(user_id);
  `)
  const base = () => publicUrl.replace(/\/$/, '')
  const resource = () => `${base()}/mcp`
  const failures = new Map()
  const registrations = new Map() // ip → { n, until }: at most 20 app registrations per address per hour

  const json = (res, code, data, headers = {}) => {
    res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers })
    res.end(JSON.stringify(data))
  }
  const oauthError = (res, code, error, description) => json(res, code, { error, error_description: description })

  async function readBody(req) {
    let raw = ''
    for await (const c of req) {
      raw += c
      if (raw.length > 64 * 1024) throw new Error('body too large')
    }
    const type = req.headers['content-type'] || ''
    if (type.includes('application/json')) return raw ? JSON.parse(raw) : {}
    return Object.fromEntries(new URLSearchParams(raw))
  }

  function issueTokens(client_id, scope, userId) {
    if (!userId) throw new Error('token without a user')
    const access = rand(32)
    const refresh = rand(32)
    const t = now()
    const ins = db.prepare('INSERT INTO oauth_tokens (token_hash, kind, client_id, scope, expires, created, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    ins.run(sha(access), 'access', client_id, scope, t + ACCESS_TTL, t, userId)
    ins.run(sha(refresh), 'refresh', client_id, scope, t + REFRESH_TTL, t, userId)
    db.prepare('DELETE FROM oauth_tokens WHERE expires < ?').run(t)
    return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL, refresh_token: refresh, scope }
  }

  function loginPage({ params, clientName, error }) {
    const hidden = Object.entries(params).map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('')
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect WhatsApp</title><style>
:root{color-scheme:light dark;--bg:#f4f4f1;--panel:#fff;--line:#e6e5e0;--ink:#1b1c1a;--muted:#6f716b;--accent:#0d7a63;--accent-ink:#fff;--danger:#b42318}
@media (prefers-color-scheme:dark){:root{--bg:#0f1110;--panel:#171a18;--line:#262a27;--ink:#e8eae6;--muted:#979b94;--accent:#34b892;--accent-ink:#06231b;--danger:#f0786b}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,sans-serif;padding:16px}
form{width:100%;max-width:360px;background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:24px}
h1{font-size:18px;margin:0}p{color:var(--muted);font-size:13.5px;margin:6px 0 18px}label{display:block;font-size:12.5px;font-weight:600;margin-top:12px}
input[type=text],input[type=password]{width:100%;margin-top:4px;padding:9px 12px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--ink);font-size:14px}
button{margin-top:18px;width:100%;height:40px;border:0;border-radius:8px;background:var(--accent);color:var(--accent-ink);font-weight:600;font-size:14px;cursor:pointer}
.err{color:var(--danger);font-size:13px;margin-top:10px}.fine{font-size:12px;color:var(--muted);margin-top:14px}</style></head><body>
<form method="post" action="/oauth/authorize">
<h1>Connect your WhatsApp</h1>
<p><b>${esc(clientName || 'An app')}</b> wants to read and send messages on your WhatsApp. Sign in with your own dashboard username and password to allow it.</p>
${hidden}
<label>Username<input type="text" name="username" autocomplete="username" required autofocus></label>
<label>Password<input type="password" name="password" autocomplete="current-password" required></label>
${error ? `<div class="err">${esc(error)}</div>` : ''}
<button type="submit">Allow access</button>
<div class="fine">You can disconnect any time from your AI app's connector settings or from the Wavelink dashboard.</div>
</form></body></html>`
  }

  function validateAuthorize(p) {
    if (p.response_type !== 'code') return 'response_type must be code'
    const client = db.prepare('SELECT * FROM oauth_clients WHERE client_id = ?').get(p.client_id || '')
    if (!client) return 'Unknown client. Remove and re-add the connector.'
    if (!JSON.parse(client.redirect_uris).includes(p.redirect_uri)) return 'redirect_uri is not registered for this client'
    if (!p.code_challenge || p.code_challenge_method !== 'S256') return 'PKCE with S256 is required'
    return { client }
  }

  /** Handles OAuth routes. Returns true if it handled the request. */
  async function handle(req, res, url) {
    const p = url.pathname

    if (p.startsWith('/.well-known/oauth-protected-resource')) {
      json(res, 200, { resource: resource(), authorization_servers: [base()], scopes_supported: SCOPES, bearer_methods_supported: ['header'], resource_name: 'Wavelink (WhatsApp)' })
      return true
    }
    if (p.startsWith('/.well-known/oauth-authorization-server') || p.startsWith('/.well-known/openid-configuration')) {
      json(res, 200, {
        issuer: base(),
        authorization_endpoint: `${base()}/oauth/authorize`,
        token_endpoint: `${base()}/oauth/token`,
        registration_endpoint: `${base()}/oauth/register`,
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
        scopes_supported: SCOPES,
      })
      return true
    }

    if (p === '/oauth/register' && req.method === 'POST') {
      const body = await readBody(req).catch(() => null)
      const uris = Array.isArray(body?.redirect_uris) ? body.redirect_uris.map(String) : []
      const okUri = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(x.hostname) } catch { return false } }
      if (!uris.length || !uris.every(okUri)) return oauthError(res, 400, 'invalid_redirect_uri', 'redirect_uris must be https URLs'), true
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim()
      const r = registrations.get(ip)
      const cur = r && r.until > Date.now() ? r : { n: 0, until: Date.now() + 60 * 60_000 }
      if (cur.n >= 20) return oauthError(res, 429, 'invalid_client_metadata', 'Too many registrations from this address. Try again later.'), true
      registrations.set(ip, { n: cur.n + 1, until: cur.until })
      // Registrations nobody ever signed in with are free to drop after an hour, so junk can't fill the table
      // and lock real ChatGPT users out.
      db.prepare(`DELETE FROM oauth_clients WHERE created < ? AND client_id NOT IN (SELECT client_id FROM oauth_tokens)
        AND client_id NOT IN (SELECT client_id FROM oauth_codes)`).run(now() - 3600)
      if (db.prepare('SELECT COUNT(*) n FROM oauth_clients').get().n >= 500) return oauthError(res, 400, 'invalid_client_metadata', 'too many clients'), true
      const method = body.token_endpoint_auth_method || 'none'
      const client_id = rand(16)
      const secret = method === 'none' ? null : rand(32)
      db.prepare('INSERT INTO oauth_clients VALUES (?, ?, ?, ?, ?)').run(client_id, secret && sha(secret), String(body.client_name || 'MCP client').slice(0, 100), JSON.stringify(uris), now())
      json(res, 201, {
        client_id, ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
        client_id_issued_at: now(), redirect_uris: uris, client_name: body.client_name,
        grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: method,
      })
      return true
    }

    if (p === '/oauth/authorize' && req.method === 'GET') {
      const params = Object.fromEntries(url.searchParams)
      const v = validateAuthorize(params)
      res.writeHead(typeof v === 'string' ? 400 : 200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY' })
      res.end(typeof v === 'string' ? `<p style="font-family:system-ui">${esc(v)}</p>` : loginPage({ params, clientName: v.client.name }))
      return true
    }

    if (p === '/oauth/authorize' && req.method === 'POST') {
      const body = await readBody(req)
      const { username = '', password: pw = '', ...params } = body
      const v = validateAuthorize(params)
      if (typeof v === 'string') return oauthError(res, 400, 'invalid_request', v), true
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim()
      const f = failures.get(ip)
      const locked = f && f.until > Date.now() && f.n >= 5
      const account = locked ? null : await authenticate(String(username), String(pw))
      if (!account) {
        if (!locked) {
          const cur = f && f.until > Date.now() ? f : { n: 0, until: Date.now() + 10 * 60_000 }
          failures.set(ip, { n: cur.n + 1, until: cur.until })
        }
        res.writeHead(401, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY' })
        res.end(loginPage({ params, clientName: v.client.name, error: locked ? 'Too many attempts. Try again in a few minutes.' : 'Wrong username or password.' }))
        return true
      }
      failures.delete(ip)
      const code = rand(32)
      const scope = (params.scope || 'whatsapp offline_access').split(' ').filter((s) => SCOPES.includes(s)).join(' ') || 'whatsapp'
      db.prepare('INSERT INTO oauth_codes (code_hash, client_id, redirect_uri, challenge, scope, resource, expires, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(sha(code), params.client_id, params.redirect_uri, params.code_challenge, scope, params.resource || resource(), now() + CODE_TTL, account.id)
      const back = new URL(params.redirect_uri)
      back.searchParams.set('code', code)
      if (params.state) back.searchParams.set('state', params.state)
      res.writeHead(302, { location: back.toString(), 'cache-control': 'no-store' })
      res.end()
      return true
    }

    if (p === '/oauth/token' && req.method === 'POST') {
      const body = await readBody(req).catch(() => ({}))
      // client authentication (secret clients only)
      let clientId = body.client_id
      let secret = body.client_secret
      const basic = req.headers.authorization?.match(/^Basic (.+)$/i)
      if (basic) [clientId, secret] = Buffer.from(basic[1], 'base64').toString().split(':').map(decodeURIComponent)
      const client = db.prepare('SELECT * FROM oauth_clients WHERE client_id = ?').get(clientId || '')
      if (!client) return oauthError(res, 401, 'invalid_client', 'unknown client'), true
      if (client.secret_hash && (!secret || sha(secret) !== client.secret_hash)) return oauthError(res, 401, 'invalid_client', 'bad client secret'), true

      if (body.grant_type === 'authorization_code') {
        const row = db.prepare('SELECT * FROM oauth_codes WHERE code_hash = ?').get(sha(body.code || ''))
        db.prepare('DELETE FROM oauth_codes WHERE code_hash = ? OR expires < ?').run(sha(body.code || ''), now()) // single use
        if (!row || row.expires < now() || row.client_id !== client.client_id) return oauthError(res, 400, 'invalid_grant', 'code is invalid or expired'), true
        if (body.redirect_uri && body.redirect_uri !== row.redirect_uri) return oauthError(res, 400, 'invalid_grant', 'redirect_uri mismatch'), true
        const challenge = crypto.createHash('sha256').update(body.code_verifier || '').digest('base64url')
        if (challenge !== row.challenge) return oauthError(res, 400, 'invalid_grant', 'PKCE verification failed'), true
        if (!userById(row.user_id)) return oauthError(res, 400, 'invalid_grant', 'this account is disabled'), true
        json(res, 200, issueTokens(client.client_id, row.scope, row.user_id))
        return true
      }
      if (body.grant_type === 'refresh_token') {
        const row = db.prepare("SELECT * FROM oauth_tokens WHERE token_hash = ? AND kind = 'refresh'").get(sha(body.refresh_token || ''))
        if (!row || row.expires < now() || row.client_id !== client.client_id) return oauthError(res, 400, 'invalid_grant', 'refresh token is invalid or expired'), true
        db.prepare('DELETE FROM oauth_tokens WHERE token_hash = ?').run(row.token_hash) // rotate
        if (!userById(row.user_id)) return oauthError(res, 400, 'invalid_grant', 'this account is disabled'), true
        json(res, 200, issueTokens(client.client_id, row.scope, row.user_id))
        return true
      }
      return oauthError(res, 400, 'unsupported_grant_type', 'use authorization_code or refresh_token'), true
    }

    return false
  }

  /** Validates "Authorization: Bearer …" for /mcp and returns the token's user. On failure sends 401 and returns null. */
  function requireBearer(req, res) {
    const m = req.headers.authorization?.match(/^Bearer (.+)$/i)
    const row = m && db.prepare("SELECT * FROM oauth_tokens WHERE token_hash = ? AND kind = 'access'").get(sha(m[1]))
    const user = row && row.expires >= now() ? userById(row.user_id) : null
    if (user) return user
    res.writeHead(401, {
      'content-type': 'application/json',
      'www-authenticate': `Bearer realm="whatsapp", resource_metadata="${base()}/.well-known/oauth-protected-resource", error="invalid_token"`,
    })
    res.end(JSON.stringify({ error: 'invalid_token', error_description: 'Sign in to connect WhatsApp' }))
    return null
  }

  /** Disconnect all of one user's ChatGPT sessions (dashboard button, password reset, disable, delete). */
  const revokeForUser = (userId) => {
    db.prepare('DELETE FROM oauth_codes WHERE user_id = ?').run(userId)
    return db.prepare('DELETE FROM oauth_tokens WHERE user_id = ?').run(userId).changes
  }
  const sessionsFor = (userId) => db.prepare(`SELECT c.name, t.created, t.expires FROM oauth_tokens t JOIN oauth_clients c USING (client_id)
    WHERE t.user_id = ? AND t.kind = 'refresh' AND t.expires > ? ORDER BY t.created DESC`).all(userId, now())

  return { handle, requireBearer, revokeForUser, sessionsFor, resource }
}

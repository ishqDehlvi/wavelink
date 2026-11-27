// Notion for the whole organisation: one Notion connection, owned by a superadmin, shared with users page by page.
//
//   notion_connection   the one connection (OAuth or an integration token), tokens encrypted with AES-256-GCM
//   notion_pages        cached tree of every page and database the connection can see (ids without dashes)
//   notion_grants       per user and page: read / edit / create / comment / archive. Sub-pages inherit the nearest
//                       ancestor's row; a row with everything off blocks what would be inherited.
//   notion_log          who did what, from the dashboard or ChatGPT
//
// Notion itself only knows the one connection, so every rule here is enforced by this service, on every request,
// for the dashboard and for MCP alike. A superadmin can do everything; other users only ever see pages they were given.
import crypto from 'node:crypto'
import fs from 'node:fs'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const API = (process.env.NOTION_API_BASE || 'https://api.notion.com').replace(/\/+$/, '')
const VERSION = process.env.NOTION_VERSION || '2026-03-11'
const MIN_GAP_MS = Number(process.env.NOTION_MIN_INTERVAL_MS ?? 350) // Notion allows about 3 requests a second
const CLIENT_ID = process.env.NOTION_CLIENT_ID || ''
const CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET || ''
const REDIRECT_URI = process.env.NOTION_REDIRECT_URI ||
  (process.env.PUBLIC_URL ? `${process.env.PUBLIC_URL.replace(/\/+$/, '')}/api/notion/callback` : 'http://localhost:3100/api/notion/callback')
const SYNC_EVERY_S = 10 * 60

export const PERMS = ['read', 'edit', 'create', 'comment', 'archive']
const COL = { read: 'can_read', edit: 'can_edit', create: 'can_create', comment: 'can_comment', archive: 'can_archive' }
const ALL = Object.fromEntries(PERMS.map((p) => [p, true]))
const NONE = Object.fromEntries(PERMS.map((p) => [p, false]))

const now = () => Math.floor(Date.now() / 1000)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const httpError = (code, message) => Object.assign(new Error(message), { code })
/** Notion ids come with or without dashes; we keep 32 lowercase hex characters. */
export const nid = (s) => String(s || '').replace(/-/g, '').toLowerCase()
const isId = (s) => /^[a-f0-9]{32}$/.test(s)
/** Accepts an id, a dashed id or a Notion URL. */
export function idFrom(ref) {
  const s = String(ref || '').trim()
  if (isId(nid(s))) return nid(s)
  const m = s.replace(/-/g, '').match(/([a-f0-9]{32})(?:[?#].*)?$/i)
  return m ? m[1].toLowerCase() : null
}

// ---------------------------------------------------------------- rich text and blocks
const plain = (rt) => (Array.isArray(rt) ? rt.map((t) => t.plain_text ?? t.text?.content ?? '').join('') : '')
const spans = (rt) =>
  (Array.isArray(rt) ? rt : []).map((t) => {
    const a = t.annotations || {}
    const s = { t: t.plain_text ?? t.text?.content ?? '' }
    if (a.bold) s.b = 1
    if (a.italic) s.i = 1
    if (a.code) s.c = 1
    if (a.strikethrough) s.s = 1
    const href = t.href || t.text?.link?.url
    if (href) s.href = href
    return s
  })
const spansToMd = (ss) =>
  ss.map((s) => {
    let t = s.t
    if (!t) return ''
    if (s.c) t = `\`${t}\``
    if (s.b) t = `**${t}**`
    if (s.i) t = `_${t}_`
    if (s.s) t = `~~${t}~~`
    if (s.href) t = `[${t}](${s.href})`
    return t
  }).join('')

/** Inline markdown → Notion rich text (bold, italic, code, strikethrough, links). Splits long text at 2000 characters. */
export function richText(md) {
  const out = []
  const push = (content, annotations = {}, url) => {
    for (let i = 0; i < content.length; i += 2000) {
      const text = { content: content.slice(i, i + 2000) }
      if (url) text.link = { url }
      out.push({ type: 'text', text, annotations })
    }
  }
  const re = /(\*\*[^*]+\*\*|`[^`]+`|~~[^~]+~~|\[[^\]]+\]\((?:https?:\/\/|mailto:)[^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g
  let last = 0
  for (const m of String(md).matchAll(re)) {
    if (m.index > last) push(md.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) push(tok.slice(2, -2), { bold: true })
    else if (tok.startsWith('`')) push(tok.slice(1, -1), { code: true })
    else if (tok.startsWith('~~')) push(tok.slice(2, -2), { strikethrough: true })
    else if (tok.startsWith('[')) {
      const [, label, url] = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      push(label, {}, url)
    } else push(tok.slice(1, -1), { italic: true })
    last = m.index + tok.length
  }
  if (last < String(md).length) push(String(md).slice(last))
  return out.slice(0, 100)
}

// Notion only accepts its own language names on code blocks; anything else is refused, so map common short names.
const LANGS = new Set(['abap', 'abc', 'agda', 'arduino', 'ascii art', 'assembly', 'bash', 'basic', 'bnf', 'c', 'c#', 'c++', 'clojure',
  'coffeescript', 'coq', 'css', 'dart', 'dhall', 'diff', 'docker', 'ebnf', 'elixir', 'elm', 'erlang', 'f#', 'flow', 'fortran', 'gherkin',
  'glsl', 'go', 'graphql', 'groovy', 'haskell', 'hcl', 'html', 'idris', 'java', 'javascript', 'json', 'julia', 'kotlin', 'latex', 'less',
  'lisp', 'livescript', 'llvm ir', 'lua', 'makefile', 'markdown', 'markup', 'matlab', 'mathematica', 'mermaid', 'nix', 'notion formula',
  'objective-c', 'ocaml', 'pascal', 'perl', 'php', 'plain text', 'powershell', 'prolog', 'protobuf', 'purescript', 'python', 'r', 'racket',
  'reason', 'ruby', 'rust', 'sass', 'scala', 'scheme', 'scss', 'shell', 'smalltalk', 'solidity', 'sql', 'swift', 'toml', 'typescript',
  'vb.net', 'verilog', 'vhdl', 'visual basic', 'webassembly', 'xml', 'yaml'])
const LANG_ALIAS = { js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript', node: 'javascript', ts: 'typescript',
  tsx: 'typescript', py: 'python', python3: 'python', sh: 'shell', zsh: 'shell', console: 'shell', terminal: 'shell', yml: 'yaml',
  md: 'markdown', cpp: 'c++', cxx: 'c++', cs: 'c#', csharp: 'c#', fsharp: 'f#', rb: 'ruby', rs: 'rust', kt: 'kotlin', golang: 'go',
  dockerfile: 'docker', ps1: 'powershell', pwsh: 'powershell', objc: 'objective-c', tex: 'latex', proto: 'protobuf', htm: 'html',
  svg: 'xml', text: 'plain text', txt: 'plain text', plaintext: 'plain text', '': 'plain text' }
export const notionLanguage = (l) => {
  const k = String(l || '').trim().toLowerCase()
  return LANGS.has(k) ? k : LANG_ALIAS[k] || 'plain text'
}

/** Markdown → Notion blocks: headings, paragraphs, bullets, numbers, to-dos, quotes, code fences and dividers. */
export function mdToBlocks(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  const block = (type, text, extra = {}) => blocks.push({ object: 'block', type, [type]: { rich_text: richText(text), ...extra } })
  let para = []
  const flush = () => {
    if (para.length) block('paragraph', para.join('\n'))
    para = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fence = line.match(/^```\s*([\w+#.-]*)\s*$/)
    if (fence) {
      flush()
      const body = []
      while (++i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i])
      const code = body.join('\n')
      blocks.push({ object: 'block', type: 'code', code: { rich_text: code ? richText(code).map((r) => ({ ...r, annotations: {} })) : [], language: notionLanguage(fence[1]) } })
      continue
    }
    let m
    if (!line.trim()) flush()
    else if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { flush(); block(`heading_${m[1].length}`, m[2]) }
    else if ((m = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/))) { flush(); block('to_do', m[2], { checked: m[1] !== ' ' }) }
    else if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) { flush(); block('bulleted_list_item', m[1]) }
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flush(); block('numbered_list_item', m[1]) }
    else if ((m = line.match(/^>\s?(.*)$/))) { flush(); block('quote', m[1]) }
    else if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flush(); blocks.push({ object: 'block', type: 'divider', divider: {} }) }
    else para.push(line)
  }
  flush()
  return blocks
}

/** A Notion block → the small shape the dashboard draws (and MCP turns into markdown). */
function simplify(b) {
  const t = b.type
  const v = b[t] || {}
  const out = { id: nid(b.id), type: t }
  if (v.rich_text) out.text = spans(v.rich_text)
  if (t === 'to_do') out.checked = Boolean(v.checked)
  if (t === 'code') out.language = v.language || ''
  if (t === 'callout') out.icon = v.icon?.emoji || null
  if (t === 'child_page' || t === 'child_database') { out.title = v.title || 'Untitled'; out.pageId = nid(b.id) }
  if (['image', 'video', 'file', 'pdf', 'audio'].includes(t)) {
    out.url = v.external?.url || v.file?.url || null
    out.text = spans(v.caption)
  }
  if (['bookmark', 'embed', 'link_preview'].includes(t)) { out.url = v.url || null; out.text = spans(v.caption) }
  if (t === 'equation') out.text = [{ t: v.expression || '', c: 1 }]
  if (t === 'table_row') out.cells = (v.cells || []).map(spans)
  return out
}

function blocksToMd(blocks, indent = '') {
  const lines = []
  let n = 0
  for (const b of blocks) {
    const txt = spansToMd(b.text || [])
    n = b.type === 'numbered_list_item' ? n + 1 : 0
    switch (b.type) {
      case 'heading_1': lines.push(`${indent}# ${txt}`); break
      case 'heading_2': lines.push(`${indent}## ${txt}`); break
      case 'heading_3': lines.push(`${indent}### ${txt}`); break
      case 'bulleted_list_item': lines.push(`${indent}- ${txt}`); break
      case 'numbered_list_item': lines.push(`${indent}${n}. ${txt}`); break
      case 'to_do': lines.push(`${indent}- [${b.checked ? 'x' : ' '}] ${txt}`); break
      case 'toggle': lines.push(`${indent}- ${txt}`); break
      case 'quote': lines.push(`${indent}> ${txt}`); break
      case 'callout': lines.push(`${indent}> ${b.icon ? `${b.icon} ` : ''}${txt}`); break
      case 'code': lines.push(`${indent}\`\`\`${b.language || ''}\n${(b.text || []).map((s) => s.t).join('')}\n${indent}\`\`\``); break
      case 'divider': lines.push(`${indent}---`); break
      case 'child_page': lines.push(`${indent}[Sub-page: ${b.title}] (id: ${b.pageId})`); break
      case 'child_database': lines.push(`${indent}[Database: ${b.title}] (id: ${b.pageId})`); break
      case 'table_row': lines.push(`${indent}| ${(b.cells || []).map(spansToMd).join(' | ')} |`); break
      case 'image': case 'video': case 'file': case 'pdf': case 'audio': case 'bookmark': case 'embed': case 'link_preview':
        lines.push(`${indent}[${b.type}${txt ? `: ${txt}` : ''}]${b.url ? `(${b.url})` : ''}`); break
      case 'column_list': case 'column': case 'synced_block': case 'table': break
      default: if (txt) lines.push(`${indent}${txt}`)
    }
    if (b.children?.length) {
      const nested = ['column_list', 'column', 'synced_block', 'table'].includes(b.type) ? indent : `${indent}  `
      lines.push(blocksToMd(b.children, nested))
    }
  }
  return lines.join('\n')
}

/** Database cell → short text. */
function cell(p) {
  if (!p) return ''
  switch (p.type) {
    case 'title': case 'rich_text': return plain(p[p.type])
    case 'number': return p.number == null ? '' : String(p.number)
    case 'select': case 'status': return p[p.type]?.name || ''
    case 'multi_select': return (p.multi_select || []).map((o) => o.name).join(', ')
    case 'date': return p.date ? `${p.date.start}${p.date.end ? ` → ${p.date.end}` : ''}` : ''
    case 'checkbox': return p.checkbox ? 'Yes' : 'No'
    case 'url': case 'email': case 'phone_number': return p[p.type] || ''
    case 'people': return (p.people || []).map((u) => u.name || 'someone').join(', ')
    case 'relation': return p.relation?.length ? `${p.relation.length} linked` : ''
    case 'files': return (p.files || []).map((f) => f.name).join(', ')
    case 'formula': { const f = p.formula || {}; return String(f[f.type] ?? '') }
    case 'rollup': { const r = p.rollup || {}; return r.type === 'array' ? `${(r.array || []).length} items` : String(r[r.type] ?? '') }
    case 'created_time': case 'last_edited_time': return (p[p.type] || '').slice(0, 10)
    case 'created_by': case 'last_edited_by': return p[p.type]?.name || ''
    case 'unique_id': return p.unique_id ? `${p.unique_id.prefix ? `${p.unique_id.prefix}-` : ''}${p.unique_id.number}` : ''
    default: return ''
  }
}

/** A plain value for a database property (from the dashboard or ChatGPT) → Notion property value. */
function toProperty(schema, value) {
  const v = value == null ? '' : String(value)
  switch (schema.type) {
    case 'title': return { title: richText(v) }
    case 'rich_text': return { rich_text: richText(v) }
    case 'number': {
      if (v.trim() === '') return { number: null }
      const n = Number(v)
      if (Number.isNaN(n)) throw httpError(400, `"${schema.name}" needs a number.`)
      return { number: n }
    }
    case 'select': return { select: v ? { name: v } : null }
    case 'status': return { status: v ? { name: v } : null }
    case 'multi_select': return { multi_select: v.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({ name })) }
    case 'checkbox': return { checkbox: /^(1|true|yes|y|on|done|x|✓)$/i.test(v.trim()) }
    case 'date': return { date: v ? { start: v } : null }
    case 'url': return { url: v || null }
    case 'email': return { email: v || null }
    case 'phone_number': return { phone_number: v || null }
    default: throw httpError(400, `"${schema.name}" is a ${schema.type.replace(/_/g, ' ')} property, which can only be changed in Notion.`)
  }
}

// ---------------------------------------------------------------- the module
export function createNotion({ db, users, keyFile = './.notion-key' }) {
  db.exec(`CREATE TABLE IF NOT EXISTS notion_connection (id INTEGER PRIMARY KEY CHECK (id = 1), kind TEXT NOT NULL,
      access_enc TEXT NOT NULL, refresh_enc TEXT, workspace_id TEXT, workspace_name TEXT, workspace_icon TEXT, bot_id TEXT,
      connected_by TEXT, connected_at INTEGER NOT NULL, last_sync INTEGER, sync_error TEXT);
    CREATE TABLE IF NOT EXISTS notion_pages (id TEXT PRIMARY KEY, kind TEXT NOT NULL, parent_id TEXT, database_id TEXT,
      title TEXT, icon TEXT, url TEXT, last_edited INTEGER, in_trash INTEGER NOT NULL DEFAULT 0, seen INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS notion_pages_parent ON notion_pages(parent_id);
    CREATE TABLE IF NOT EXISTS notion_grants (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, page_id TEXT NOT NULL,
      can_read INTEGER NOT NULL, can_edit INTEGER NOT NULL, can_create INTEGER NOT NULL, can_comment INTEGER NOT NULL,
      can_archive INTEGER NOT NULL, updated INTEGER NOT NULL, updated_by TEXT, PRIMARY KEY (user_id, page_id));
    CREATE TABLE IF NOT EXISTS notion_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, username TEXT, action TEXT NOT NULL,
      page_id TEXT, title TEXT, via TEXT, ts INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS notion_log_ts ON notion_log(ts);
    CREATE TABLE IF NOT EXISTS notion_oauth_states (state TEXT PRIMARY KEY, user_id TEXT NOT NULL, created INTEGER NOT NULL);`)

  // ------------------------------------------------ token encryption (key from NOTION_SECRET_KEY, else a local key file)
  const keySource = process.env.NOTION_SECRET_KEY || (() => {
    if (fs.existsSync(keyFile)) return fs.readFileSync(keyFile, 'utf8').trim()
    const k = crypto.randomBytes(32).toString('base64url')
    fs.writeFileSync(keyFile, `${k}\n`, { mode: 0o600 })
    return k
  })()
  const KEY = crypto.createHash('sha256').update(`notion-token-key:${keySource}`).digest()
  const seal = (s) => {
    if (!s) return null
    const iv = crypto.randomBytes(12)
    const c = crypto.createCipheriv('aes-256-gcm', KEY, iv)
    const ct = Buffer.concat([c.update(String(s), 'utf8'), c.final()])
    return `v1.${iv.toString('base64url')}.${c.getAuthTag().toString('base64url')}.${ct.toString('base64url')}`
  }
  const unseal = (s) => {
    if (!s) return null
    const [v, iv, tag, ct] = String(s).split('.')
    if (v !== 'v1') throw new Error('Unknown token format')
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64url'))
    d.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8')
  }

  const connection = () => db.prepare('SELECT * FROM notion_connection WHERE id = 1').get() || null

  // ------------------------------------------------ Notion HTTP client (one queue: about 3 requests a second)
  let queue = Promise.resolve()
  let lastAt = 0
  const slot = () => {
    const turn = queue.then(async () => {
      const wait = lastAt + MIN_GAP_MS - Date.now()
      if (wait > 0) await sleep(wait)
      lastAt = Date.now()
    })
    queue = turn.catch(() => {})
    return turn
  }

  function notionError(status, data) {
    const msg = data?.message || ''
    if (status === 404) return httpError(404, "Notion can't find that page, or it isn't shared with the connection.")
    if (status === 401) return httpError(502, 'The Notion connection was removed or expired. A superadmin needs to reconnect Notion.')
    if (status === 403) return httpError(403, `The Notion connection isn't allowed to do that${msg ? `: ${msg}` : ''}. Check its capabilities in Notion.`)
    if (status === 429) return httpError(503, 'Notion is busy (rate limited). Try again in a few seconds.')
    if (status === 400 || status === 409) return httpError(400, `Notion: ${msg || 'invalid request'}`)
    return httpError(502, `Notion error ${status}${msg ? `: ${msg}` : ''}`)
  }

  async function oauthToken(body) {
    if (!CLIENT_ID || !CLIENT_SECRET) throw httpError(400, 'Notion OAuth is not set up on this server (NOTION_CLIENT_ID and NOTION_CLIENT_SECRET).')
    await slot()
    const res = await fetch(`${API}/v1/oauth/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
        'content-type': 'application/json',
        'notion-version': VERSION,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.access_token) throw httpError(400, `Notion sign-in failed${data.error_description || data.error || data.message ? `: ${data.error_description || data.error || data.message}` : ''}.`)
    return data
  }

  let refreshing = null
  async function refreshToken() {
    refreshing ??= (async () => {
      const c = connection()
      const t = await oauthToken({ grant_type: 'refresh_token', refresh_token: unseal(c.refresh_enc) })
      db.prepare('UPDATE notion_connection SET access_enc = ?, refresh_enc = COALESCE(?, refresh_enc) WHERE id = 1').run(seal(t.access_token), seal(t.refresh_token))
    })().finally(() => { refreshing = null })
    return refreshing
  }

  async function call(method, path, body, { token } = {}) {
    for (let attempt = 0; ; attempt++) {
      const c = token ? null : connection()
      if (!token && !c) throw httpError(409, 'Notion is not connected yet. A superadmin can connect it on the Notion page.')
      await slot()
      let res
      try {
        res = await fetch(`${API}/v1${path}`, {
          method,
          headers: { authorization: `Bearer ${token || unseal(c.access_enc)}`, 'notion-version': VERSION, 'content-type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(30_000),
        })
      } catch (e) {
        if (attempt < 2) continue
        throw httpError(502, `Can't reach Notion: ${e.message}`)
      }
      if (res.status === 429 && attempt < 3) {
        await sleep(Math.min(10, Number(res.headers.get('retry-after')) || 1) * 1000)
        continue
      }
      if (res.status === 401 && !token && c.kind === 'oauth' && c.refresh_enc && attempt === 0) {
        await refreshToken().catch(() => {})
        continue
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw notionError(res.status, data)
      return data
    }
  }
  const get = (p) => call('GET', p)
  const post = (p, b) => call('POST', p, b)
  const patch = (p, b) => call('PATCH', p, b)

  // ------------------------------------------------ page cache
  const pageRow = db.prepare('SELECT * FROM notion_pages WHERE id = ?')
  const upsertPage = db.prepare(`INSERT INTO notion_pages (id, kind, parent_id, database_id, title, icon, url, last_edited, in_trash, seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, parent_id = excluded.parent_id,
    database_id = excluded.database_id, title = excluded.title, icon = excluded.icon, url = excluded.url,
    last_edited = excluded.last_edited, in_trash = excluded.in_trash, seen = excluded.seen`)

  const iconOf = (o) => o?.icon?.emoji || null
  const titleOf = (o) => {
    if (o.object === 'page') return plain(Object.values(o.properties || {}).find((p) => p.type === 'title')?.title) || 'Untitled'
    return plain(o.title) || 'Untitled'
  }
  const parentRef = (p) => {
    if (!p) return null
    if (p.type === 'data_source_id') return { id: nid(p.data_source_id) }
    if (p.type === 'page_id') return { id: nid(p.page_id) }
    if (p.type === 'database_id') return { id: nid(p.database_id), database: true }
    if (p.type === 'block_id') return { id: nid(p.block_id), block: true }
    return null // workspace
  }

  const blockParents = new Map() // block id → page id (blocks can hold pages: toggles, columns)
  async function pageOfBlock(blockId, hops = 0) {
    if (blockParents.has(blockId)) return blockParents.get(blockId)
    if (hops > 6) return null
    const b = await get(`/blocks/${blockId}`).catch(() => null)
    const ref = parentRef(b?.parent)
    let out = null
    if (ref?.block) out = await pageOfBlock(ref.id, hops + 1)
    else if (ref) out = ref.id
    blockParents.set(blockId, out)
    return out
  }
  const databaseParents = new Map() // database id → its parent page id
  async function pageOfDatabase(dbId) {
    if (databaseParents.has(dbId)) return databaseParents.get(dbId)
    const d = await get(`/databases/${dbId}`).catch(() => null)
    const ref = parentRef(d?.parent)
    const out = ref?.block ? await pageOfBlock(ref.id) : ref?.id || null
    databaseParents.set(dbId, out)
    return out
  }

  /** Store one Notion page / data source / database object. Returns its id. */
  async function store(o, seen = now()) {
    const id = nid(o.id)
    const kind = o.object === 'page' ? 'page' : 'database'
    const parent = parentRef(o.parent)
    let databaseId = null
    let parentId = parent?.id || null
    if (o.object === 'data_source') {
      databaseId = parent?.database ? parent.id : null
      parentId = databaseId ? await pageOfDatabase(databaseId) : parentId
    } else if (o.object === 'database') {
      databaseId = id
      // a database seen directly: point at its first data source, if any, so its rows nest under it
      if (parent?.block) parentId = await pageOfBlock(parent.id)
    } else if (parent?.block) parentId = await pageOfBlock(parent.id)
    else if (parent?.database) {
      // page whose parent is given as a database: nest it under that database's data source row
      const ds = db.prepare('SELECT id FROM notion_pages WHERE database_id = ? LIMIT 1').get(parent.id)
      parentId = ds?.id || parent.id
    }
    upsertPage.run(id, kind, parentId, databaseId, titleOf(o).slice(0, 300), iconOf(o), o.url || null,
      o.last_edited_time ? Math.floor(Date.parse(o.last_edited_time) / 1000) : null, o.in_trash || o.archived || o.is_archived ? 1 : 0, seen)
    return id
  }

  /** Make sure a page (and its ancestors) are in the cache, fetching from Notion when needed. */
  async function known(id, depth = 0) {
    let row = pageRow.get(id)
    if (row || depth > 10) return row || null
    const o = (await get(`/pages/${id}`).catch(() => null)) || (await get(`/data_sources/${id}`).catch(() => null))
    if (!o) return null
    await store(o)
    row = pageRow.get(nid(o.id))
    if (row?.parent_id && !pageRow.get(row.parent_id)) await known(row.parent_id, depth + 1)
    return row
  }

  let syncing = null
  async function sync() {
    syncing ??= (async () => {
      const started = now()
      try {
        let cursor
        let total = 0
        do {
          const r = await post('/search', { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) })
          // data sources first, so their rows can find them
          const results = [...r.results].sort((a, b) => (a.object === 'page') - (b.object === 'page'))
          for (const o of results) await store(o, started)
          total += r.results.length
          cursor = r.has_more ? r.next_cursor : undefined
        } while (cursor && total < 10_000)
        // pages that pointed at a database id before its data source was stored
        db.exec(`UPDATE notion_pages SET parent_id = (SELECT d.id FROM notion_pages d WHERE d.database_id = notion_pages.parent_id LIMIT 1)
          WHERE parent_id IN (SELECT database_id FROM notion_pages WHERE database_id IS NOT NULL) AND parent_id NOT IN (SELECT id FROM notion_pages)`)
        // no longer shared with the connection. Database rows don't always come back from search (they are loaded
        // when the database is opened), so keep rows whose database is still shared.
        db.prepare(`DELETE FROM notion_pages WHERE seen < ? AND (parent_id IS NULL OR parent_id NOT IN
          (SELECT id FROM notion_pages WHERE kind = 'database' AND seen >= ?))`).run(started, started)
        db.prepare('UPDATE notion_connection SET last_sync = ?, sync_error = NULL WHERE id = 1').run(now())
        return total
      } catch (e) {
        db.prepare('UPDATE notion_connection SET sync_error = ? WHERE id = 1').run(String(e.message).slice(0, 300))
        throw e
      }
    })().finally(() => { syncing = null })
    return syncing
  }
  const syncIfStale = () => {
    const c = connection()
    if (c && !syncing && (!c.last_sync || now() - c.last_sync > SYNC_EVERY_S)) sync().catch((e) => console.log('notion sync failed:', e.message))
  }

  // ------------------------------------------------ permissions
  const grantRow = db.prepare('SELECT * FROM notion_grants WHERE user_id = ? AND page_id = ?')
  const rowPerms = (g) => Object.fromEntries(PERMS.map((p) => [p, Boolean(g[COL[p]])]))
  const allPages = () => db.prepare('SELECT * FROM notion_pages WHERE in_trash = 0 ORDER BY title COLLATE NOCASE').all()

  /** What `user` may do on a page: the nearest explicit row on the page or an ancestor. Superadmins may do everything. */
  function effective(user, pageId) {
    if (user.role === 'superadmin') return { ...ALL, from: null, explicit: false }
    let id = pageId
    for (let hops = 0; id && hops < 60; hops++) {
      const g = grantRow.get(user.id, id)
      if (g) return { ...rowPerms(g), from: id, explicit: id === pageId }
      id = pageRow.get(id)?.parent_id
    }
    return { ...NONE, from: null, explicit: false }
  }
  const hasAnyGrant = (user) => user.role === 'superadmin' || Boolean(db.prepare('SELECT 1 FROM notion_grants WHERE user_id = ? AND can_read = 1').get(user.id))

  function setGrant(userId, pageId, perms, by) {
    if (perms === null) return db.prepare('DELETE FROM notion_grants WHERE user_id = ? AND page_id = ?').run(userId, pageId)
    const p = Object.fromEntries(PERMS.map((k) => [k, Boolean(perms[k])]))
    if (p.edit || p.create || p.comment || p.archive) p.read = true // everything else needs reading
    if (!p.read) for (const k of PERMS) p[k] = false
    db.prepare(`INSERT INTO notion_grants (user_id, page_id, can_read, can_edit, can_create, can_comment, can_archive, updated, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, page_id) DO UPDATE SET can_read = excluded.can_read,
      can_edit = excluded.can_edit, can_create = excluded.can_create, can_comment = excluded.can_comment,
      can_archive = excluded.can_archive, updated = excluded.updated, updated_by = excluded.updated_by`)
      .run(userId, pageId, ...PERMS.map((k) => (p[k] ? 1 : 0)), now(), by)
  }

  async function need(user, ref, perm) {
    const id = idFrom(ref)
    if (!id) throw httpError(400, 'That is not a Notion page id or link.')
    const row = await known(id)
    if (!row) throw httpError(404, "Notion can't find that page, or it isn't shared with the connection.")
    const eff = effective(user, id)
    // a page you can't read looks the same as one that doesn't exist
    if (!eff.read) throw httpError(404, "That page doesn't exist or you don't have access to it.")
    if (!eff[perm]) throw httpError(403, `You don't have ${perm === 'create' ? 'permission to add pages' : `${perm} access`} on "${row.title}". Ask a superadmin.`)
    return { row, perms: eff }
  }

  const log = (user, action, row, via) =>
    db.prepare('INSERT INTO notion_log (user_id, username, action, page_id, title, via, ts) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(user.id, user.username, action, row?.id || null, row?.title || null, via, now())

  // ------------------------------------------------ reading
  const view = (row, user) => {
    const p = effective(user, row.id)
    return { id: row.id, kind: row.kind, title: row.title, icon: row.icon, url: row.url, parentId: row.parent_id, lastEdited: row.last_edited, perms: Object.fromEntries(PERMS.map((k) => [k, p[k]])) }
  }
  /** Every page this user can see. parentId is cleared when the parent itself isn't visible, so it shows at the top. */
  function visible(user) {
    const rows = allPages()
    const vis = rows.filter((r) => effective(user, r.id).read)
    const ids = new Set(vis.map((r) => r.id))
    return vis.map((r) => ({ ...view(r, user), parentId: ids.has(r.parent_id) ? r.parent_id : null }))
  }

  async function children(id, depth = 0, budget = { left: 400 }) {
    const out = []
    let cursor
    do {
      const r = await get(`/blocks/${id}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`)
      for (const b of r.results) {
        if (budget.left-- <= 0) return out
        const s = simplify(b)
        if (b.has_children && depth < 3 && !['child_page', 'child_database'].includes(b.type)) s.children = await children(nid(b.id), depth + 1, budget)
        out.push(s)
      }
      cursor = r.has_more ? r.next_cursor : undefined
    } while (cursor)
    return out
  }

  async function schemaOf(dsId) {
    const ds = await get(`/data_sources/${dsId}`)
    return Object.entries(ds.properties || {}).map(([name, p]) => ({ name, type: p.type, options: (p[p.type]?.options || []).map((o) => o.name) }))
  }

  async function rows(user, dsId, { limit = 50, cursor } = {}) {
    const schema = await schemaOf(dsId)
    const r = await post(`/data_sources/${dsId}/query`, { page_size: Math.min(100, Math.max(1, limit)), ...(cursor ? { start_cursor: cursor } : {}) })
    for (const o of r.results) if (o.object === 'page') await store(o)
    const list = r.results.filter((o) => o.object === 'page' && effective(user, nid(o.id)).read).map((o) => ({
      id: nid(o.id), title: titleOf(o), url: o.url, icon: iconOf(o),
      cells: Object.fromEntries(Object.entries(o.properties || {}).map(([k, p]) => [k, cell(p)])),
    }))
    return { columns: schema, rows: list, nextCursor: r.has_more ? r.next_cursor : null }
  }

  async function comments(id) {
    const r = await get(`/comments?block_id=${id}&page_size=50`).catch(() => ({ results: [] }))
    return r.results.map((c) => ({ id: nid(c.id), text: plain(c.rich_text), created: c.created_time }))
  }

  async function readPage(user, ref, via) {
    const { row, perms } = await need(user, ref, 'read')
    const breadcrumbs = []
    for (let p = pageRow.get(row.parent_id || ''), i = 0; p && i < 20; p = pageRow.get(p.parent_id || ''), i++) {
      if (!effective(user, p.id).read) break
      breadcrumbs.unshift({ id: p.id, title: p.title, icon: p.icon })
    }
    const base = { ...view(row, user), perms: Object.fromEntries(PERMS.map((k) => [k, perms[k]])), breadcrumbs }
    if (row.kind === 'database') return { ...base, database: await rows(user, row.id) }
    const page = await get(`/pages/${row.id}`)
    await store(page)
    const properties = row.parent_id && pageRow.get(row.parent_id)?.kind === 'database'
      ? Object.fromEntries(Object.entries(page.properties || {}).filter(([, p]) => p.type !== 'title').map(([k, p]) => [k, cell(p)]))
      : null
    const [blocks, notes] = await Promise.all([children(row.id), comments(row.id)])
    const kids = visible(user).filter((p) => p.parentId === row.id)
    return { ...base, title: titleOf(page), properties, blocks, comments: notes, children: kids }
  }

  // ------------------------------------------------ writing
  async function createPage(user, parentRefStr, { title, markdown, properties } = {}, via) {
    const { row: parent } = await need(user, parentRefStr, 'create')
    title = String(title || '').trim()
    if (!title) throw httpError(400, 'Give the new page a title.')
    const children = mdToBlocks(markdown).slice(0, 100)
    let body
    if (parent.kind === 'database') {
      const schema = await schemaOf(parent.id)
      const titleProp = schema.find((p) => p.type === 'title')?.name || 'Name'
      const props = { [titleProp]: { title: richText(title) } }
      for (const [k, v] of Object.entries(properties || {})) {
        const s = schema.find((p) => p.name.toLowerCase() === String(k).toLowerCase())
        if (!s) throw httpError(400, `This database has no "${k}" column. Columns: ${schema.map((p) => p.name).join(', ')}.`)
        if (s.type !== 'title') props[s.name] = toProperty(s, v)
      }
      body = { parent: { type: 'data_source_id', data_source_id: parent.id }, properties: props, ...(children.length ? { children } : {}) }
    } else {
      body = { parent: { type: 'page_id', page_id: parent.id }, properties: { title: { title: richText(title) } }, ...(children.length ? { children } : {}) }
    }
    const created = await post('/pages', body)
    const id = await store(created)
    const row = pageRow.get(id)
    log(user, parent.kind === 'database' ? 'added a row' : 'created a page', row, via)
    return view(row, user)
  }

  async function appendMd(id, markdown) {
    const blocks = mdToBlocks(markdown)
    if (!blocks.length) throw httpError(400, 'Nothing to add.')
    for (let i = 0; i < blocks.length; i += 100) await patch(`/blocks/${id}/children`, { children: blocks.slice(i, i + 100) })
    return blocks.length
  }

  async function updatePage(user, ref, { title, appendMarkdown, properties } = {}, via) {
    const { row } = await need(user, ref, 'edit')
    if (row.kind === 'database') throw httpError(400, 'Change database settings in Notion itself. You can add and edit its rows here.')
    const done = []
    const props = {}
    if (title !== undefined || properties) {
      const page = await get(`/pages/${row.id}`)
      const entries = Object.entries(page.properties || {})
      if (title !== undefined) {
        if (!String(title).trim()) throw httpError(400, 'The title can\'t be empty.')
        const key = entries.find(([, p]) => p.type === 'title')?.[0] || 'title'
        props[key] = { title: richText(String(title).trim()) }
        done.push('renamed it')
      }
      for (const [k, v] of Object.entries(properties || {})) {
        const hit = entries.find(([name]) => name.toLowerCase() === String(k).toLowerCase())
        if (!hit) throw httpError(400, `This page has no "${k}" property.`)
        props[hit[0]] = toProperty({ name: hit[0], type: hit[1].type }, v)
      }
      if (properties && Object.keys(properties).length) done.push('updated properties')
    }
    if (Object.keys(props).length) await store(await patch(`/pages/${row.id}`, { properties: props }))
    if (appendMarkdown && String(appendMarkdown).trim()) {
      const n = await appendMd(row.id, appendMarkdown)
      done.push(`added ${n} block${n === 1 ? '' : 's'}`)
    }
    if (!done.length) throw httpError(400, 'Nothing to change.')
    log(user, done.join(', '), pageRow.get(row.id), via)
    return { ...view(pageRow.get(row.id), user), done }
  }

  async function setTrash(user, ref, trash, via) {
    const { row } = await need(user, ref, 'archive')
    if (row.kind === 'database') throw httpError(400, 'Archive databases in Notion itself.')
    await store(await patch(`/pages/${row.id}`, { in_trash: trash }))
    log(user, trash ? 'archived a page' : 'restored a page', pageRow.get(row.id), via)
    return view(pageRow.get(row.id), user)
  }

  async function addComment(user, ref, textIn, via) {
    const { row } = await need(user, ref, 'comment')
    const t = String(textIn || '').trim()
    if (!t) throw httpError(400, 'Write a comment first.')
    if (row.kind === 'database') throw httpError(400, 'Comment on a page or a row, not on a whole database.')
    const who = user.name || user.username
    await post('/comments', { parent: { page_id: row.id }, rich_text: [...richText(t), { type: 'text', text: { content: `\n— ${who}` }, annotations: { italic: true } }] })
      .catch((e) => {
        throw e.code === 403
          ? httpError(403, 'The Notion connection is not allowed to comment. In Notion, turn on "Read comments" and "Insert comments" for the connection, then reconnect Notion here.')
          : e
      })
    log(user, 'commented', row, via)
    return { ok: true }
  }

  // ------------------------------------------------ connecting
  async function connectWithToken(admin, token) {
    token = String(token || '').trim()
    if (!/^(secret_|ntn_)[A-Za-z0-9]{20,}$/.test(token)) throw httpError(400, 'That doesn\'t look like a Notion integration token (they start with ntn_ or secret_).')
    const bot = await call('GET', '/users/me', undefined, { token }).catch((e) => {
      throw e.code === 502 && /removed or expired/.test(e.message) ? httpError(400, 'Notion rejected that token.') : e
    })
    save(admin, { kind: 'token', access: token, workspaceName: bot.bot?.workspace_name || null, workspaceId: bot.bot?.workspace_id || null, botId: nid(bot.id) })
    await sync().catch(() => {})
  }

  function save(admin, c) {
    db.prepare('DELETE FROM notion_connection')
      .run()
    db.prepare(`INSERT INTO notion_connection (id, kind, access_enc, refresh_enc, workspace_id, workspace_name, workspace_icon, bot_id, connected_by, connected_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(c.kind, seal(c.access), seal(c.refresh), c.workspaceId, c.workspaceName, c.workspaceIcon || null, c.botId || null, admin.username, now())
    blockParents.clear()
    databaseParents.clear()
    log(admin, `connected Notion${c.workspaceName ? ` (${c.workspaceName})` : ''}`, null, 'dashboard')
  }

  function oauthStart(admin) {
    if (!CLIENT_ID || !CLIENT_SECRET) throw httpError(400, 'Notion OAuth is not set up on this server. Add NOTION_CLIENT_ID and NOTION_CLIENT_SECRET, or paste an integration token instead.')
    db.prepare('DELETE FROM notion_oauth_states WHERE created < ?').run(now() - 900)
    const state = crypto.randomBytes(18).toString('base64url')
    db.prepare('INSERT INTO notion_oauth_states (state, user_id, created) VALUES (?, ?, ?)').run(state, admin.id, now())
    const u = new URL(`${API}/v1/oauth/authorize`)
    u.search = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: 'code', owner: 'user', state }).toString()
    return u.toString()
  }

  async function oauthFinish(admin, { code, state }) {
    const s = db.prepare('SELECT * FROM notion_oauth_states WHERE state = ?').get(String(state || ''))
    db.prepare('DELETE FROM notion_oauth_states WHERE state = ?').run(String(state || ''))
    if (!s || s.user_id !== admin.id || now() - s.created > 900) throw httpError(400, 'That Notion sign-in link expired. Press Connect Notion again.')
    const t = await oauthToken({ grant_type: 'authorization_code', code: String(code || ''), redirect_uri: REDIRECT_URI })
    save(admin, { kind: 'oauth', access: t.access_token, refresh: t.refresh_token, workspaceId: t.workspace_id, workspaceName: t.workspace_name, workspaceIcon: t.workspace_icon, botId: t.bot_id ? nid(t.bot_id) : null })
    await sync().catch(() => {})
  }

  function disconnect(admin) {
    db.exec('DELETE FROM notion_connection; DELETE FROM notion_pages;')
    log(admin, 'disconnected Notion', null, 'dashboard')
  }

  function status(user) {
    const c = connection()
    const base = { connected: Boolean(c), canManage: user.role === 'superadmin', oauthAvailable: Boolean(CLIENT_ID && CLIENT_SECRET), redirectUri: user.role === 'superadmin' ? REDIRECT_URI : undefined }
    if (!c) return base
    return {
      ...base,
      workspace: { name: c.workspace_name, icon: c.workspace_icon && !/^https?:/.test(c.workspace_icon) ? c.workspace_icon : null },
      kind: c.kind, connectedBy: c.connected_by, connectedAt: c.connected_at, lastSync: c.last_sync, syncing: Boolean(syncing),
      syncError: user.role === 'superadmin' ? c.sync_error : undefined,
      pages: user.role === 'superadmin' ? db.prepare('SELECT COUNT(*) n FROM notion_pages WHERE in_trash = 0').get().n : visible(user).length,
    }
  }

  /** For the sidebar and `me`: is Notion set up, and does this user have anything there. */
  const summary = (user) => ({ connected: Boolean(connection()), access: hasAnyGrant(user) })

  function accessMatrix() {
    const list = users.list().filter((u) => !u.disabled)
    const grants = db.prepare('SELECT * FROM notion_grants').all().map((g) => ({ userId: g.user_id, pageId: g.page_id, ...rowPerms(g), updated: g.updated, updatedBy: g.updated_by }))
    return {
      users: list.map((u) => ({ id: u.id, username: u.username, name: u.name, role: u.role })),
      pages: allPages().map((r) => ({ id: r.id, kind: r.kind, title: r.title, icon: r.icon, parentId: r.parent_id })),
      grants,
    }
  }

  const activity = (user, limit = 50) =>
    (user.role === 'superadmin'
      ? db.prepare('SELECT username, action, page_id AS pageId, title, via, ts FROM notion_log ORDER BY id DESC LIMIT ?').all(limit)
      : db.prepare('SELECT username, action, page_id AS pageId, title, via, ts FROM notion_log WHERE user_id = ? ORDER BY id DESC LIMIT ?').all(user.id, limit))

  // ------------------------------------------------ HTTP API: /api/notion/*  (me = the signed-in user)
  async function api(req, res, url, me, parts, { json, readJson }) {
    const [a, b, c] = parts
    const m = req.method
    const admin = () => { if (me.role !== 'superadmin') throw httpError(403, 'Only a superadmin can do that.') }

    if (a === 'status' && m === 'GET') return json(res, 200, status(me))
    if (a === 'oauth' && b === 'start' && m === 'POST') { admin(); return json(res, 200, { url: oauthStart(me) }) }
    if (a === 'oauth' && b === 'callback' && m === 'POST') { admin(); await oauthFinish(me, await readJson(req)); return json(res, 200, status(me)) }
    if (a === 'token' && m === 'POST') { admin(); await connectWithToken(me, (await readJson(req)).token); return json(res, 200, status(me)) }
    if (a === 'connection' && m === 'DELETE') { admin(); disconnect(me); return json(res, 200, status(me)) }
    if (a === 'sync' && m === 'POST') { admin(); await sync(); return json(res, 200, status(me)) }
    if (a === 'activity' && m === 'GET') return json(res, 200, activity(me))

    if (a === 'access') {
      admin()
      if (m === 'GET') return json(res, 200, accessMatrix())
      if (m === 'PUT') {
        const body = await readJson(req)
        const target = users.get(body.userId)
        if (!target) throw httpError(404, 'No such user.')
        if (target.role === 'superadmin') throw httpError(400, 'Superadmins can always do everything in Notion.')
        const pageId = idFrom(body.pageId)
        if (!pageId || !pageRow.get(pageId)) throw httpError(404, 'No such page.')
        setGrant(target.id, pageId, body.perms === null ? null : body.perms || {}, me.username)
        log(me, `changed ${target.username}'s access`, pageRow.get(pageId), 'dashboard')
        return json(res, 200, accessMatrix())
      }
    }

    if (!connection()) throw httpError(409, 'Notion is not connected yet.')
    if (a === 'pages' && !b && m === 'GET') {
      syncIfStale()
      const q = (url.searchParams.get('q') || '').trim().toLowerCase()
      const list = visible(me)
      return json(res, 200, q ? list.filter((p) => p.title.toLowerCase().includes(q)) : list)
    }
    if (a === 'pages' && b) {
      const id = idFrom(b)
      if (!c && m === 'GET') return json(res, 200, await readPage(me, id, 'dashboard'))
      if (!c && m === 'PATCH') return json(res, 200, await updatePage(me, id, await readJson(req), 'dashboard'))
      if (c === 'children' && m === 'POST') return json(res, 201, await createPage(me, id, await readJson(req), 'dashboard'))
      if (c === 'append' && m === 'POST') return json(res, 200, await updatePage(me, id, { appendMarkdown: (await readJson(req)).markdown }, 'dashboard'))
      if (c === 'archive' && m === 'POST') return json(res, 200, await setTrash(me, id, true, 'dashboard'))
      if (c === 'restore' && m === 'POST') return json(res, 200, await setTrash(me, id, false, 'dashboard'))
      if (c === 'comments' && m === 'POST') return json(res, 201, await addComment(me, id, (await readJson(req)).text, 'dashboard'))
      if (c === 'rows' && m === 'GET') {
        const { row } = await need(me, id, 'read')
        if (row.kind !== 'database') throw httpError(400, 'That is a page, not a database.')
        return json(res, 200, await rows(me, row.id, { cursor: url.searchParams.get('cursor') || undefined }))
      }
    }
    return json(res, 404, { error: 'not found' })
  }

  // ------------------------------------------------ MCP tools
  const instructions = (user) => {
    if (!connection() || !hasAnyGrant(user)) return ''
    return `\n- Notion is connected too${user.role === 'superadmin' ? ' (you are the superadmin: you can see and change every shared page, and give people access with notion_access)' : ', limited to the pages a superadmin shared with you'}. Find pages with notion_search, read them with notion_read_page (databases: notion_query_database), then notion_create_page, notion_update_page, notion_comment or notion_archive_page. Before changing or archiving anything in Notion, tell the user exactly what you will change.`
  }

  /** MCP server for accounts without WhatsApp. Always has one tool, so it answers tools/list even before any access. */
  function bareServer(user) {
    const server = new McpServer({ name: 'workspace', version: '1.0.0' }, {
      instructions: `You are connected to ${user.name || user.username}'s workspace.${instructions(user)}`,
    })
    server.registerTool('account_access', {
      title: 'What this account can use',
      description: 'Shows what this account has access to (Notion pages, WhatsApp). Call it if no other tools are available.',
      inputSchema: {}, annotations: { readOnlyHint: true, openWorldHint: false },
    }, async () => {
      const n = connection() && hasAnyGrant(user) ? `Notion: ${visible(user).length} page(s) shared with you. Use notion_search.` : 'Notion: nothing shared with you yet.'
      return { content: [{ type: 'text', text: `Account ${user.username}. WhatsApp is not turned on for this account. ${n} A superadmin can change this.` }] }
    })
    return server
  }

  function registerTools(server, user) {
    if (!connection() || !hasAnyGrant(user)) return
    const text = (t) => ({ content: [{ type: 'text', text: t }] })
    const safe = (fn) => async (args) => { try { return await fn(args || {}) } catch (e) { return { content: [{ type: 'text', text: `Error: ${e.message || e}` }], isError: true } } }
    const READ = { readOnlyHint: true, openWorldHint: true }
    const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: true }
    const PAGE = z.string().min(1).describe('Notion page or database: its id, its link, or its exact title from notion_search')
    const permStr = (p) => PERMS.filter((k) => p[k]).join(', ') || 'none'
    const resolve = (ref) => {
      const id = idFrom(ref)
      if (id) return id
      const q = String(ref).trim().toLowerCase()
      const hits = visible(user).filter((p) => p.title.toLowerCase() === q)
      if (hits.length === 1) return hits[0].id
      if (hits.length > 1) throw new Error(`Several pages are called "${ref}". Use the id from notion_search.`)
      throw new Error(`No page called "${ref}" that you can see. Use notion_search to find it.`)
    }
    const line = (p) => `- ${p.icon ? `${p.icon} ` : ''}${p.title} (${p.kind}, id: ${p.id}) [${permStr(p.perms)}]`

    server.registerTool('notion_search', {
      title: 'Search Notion pages',
      description: 'Find Notion pages and databases you have access to by title. Leave query empty to list everything you can see. Shows what you can do on each (read, edit, create, comment, archive).',
      inputSchema: { query: z.string().optional().describe('Words in the title') },
      annotations: READ,
    }, safe(async ({ query }) => {
      syncIfStale()
      const q = String(query || '').trim().toLowerCase()
      const list = visible(user).filter((p) => !q || p.title.toLowerCase().includes(q))
      if (!list.length) return text(q ? `No Notion pages you can see match "${query}".` : 'You have no Notion pages yet.')
      return text(`${list.length} Notion page(s):\n${list.slice(0, 200).map(line).join('\n')}`)
    }))

    server.registerTool('notion_read_page', {
      title: 'Read a Notion page',
      description: 'Read a Notion page as markdown, with its properties, sub-pages and comments. For a database, lists its rows.',
      inputSchema: { page: PAGE },
      annotations: READ,
    }, safe(async ({ page }) => {
      const p = await readPage(user, resolve(page), 'chatgpt')
      if (p.database) {
        const cols = p.database.columns.map((c) => c.name)
        const head = `| ${cols.join(' | ')} | id |\n|${cols.map(() => ' --- |').join('')} --- |`
        const body = p.database.rows.map((r) => `| ${cols.map((c) => (r.cells[c] || '').replace(/\|/g, '/')).join(' | ')} | ${r.id} |`).join('\n')
        return text(`# ${p.title} (database, id: ${p.id})\nYou can: ${permStr(p.perms)}\n\n${p.database.rows.length ? `${head}\n${body}` : 'No rows.'}`)
      }
      const props = p.properties && Object.keys(p.properties).length ? `\nProperties:\n${Object.entries(p.properties).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n` : ''
      const kids = p.children.length ? `\n\nSub-pages:\n${p.children.map(line).join('\n')}` : ''
      const notes = p.comments.length ? `\n\nComments:\n${p.comments.map((c) => `- ${c.text.replace(/\n/g, ' ')}`).join('\n')}` : ''
      const crumbs = p.breadcrumbs.length ? `In: ${p.breadcrumbs.map((b) => b.title).join(' › ')}\n` : ''
      return text(`# ${p.title}\n${crumbs}id: ${p.id} · ${p.url || ''}\nYou can: ${permStr(p.perms)}\n${props}\n${blocksToMd(p.blocks) || '(empty page)'}${kids}${notes}`)
    }))

    server.registerTool('notion_query_database', {
      title: 'List rows of a Notion database',
      description: 'List the rows of a Notion database with their columns. Use the row ids with notion_read_page or notion_update_page.',
      inputSchema: { database: PAGE, limit: z.number().int().min(1).max(100).default(50) },
      annotations: READ,
    }, safe(async ({ database, limit = 50 }) => {
      const { row } = await need(user, resolve(database), 'read')
      if (row.kind !== 'database') throw new Error('That is a page, not a database. Use notion_read_page.')
      const r = await rows(user, row.id, { limit })
      const cols = r.columns.map((c) => `${c.name} (${c.type}${c.options.length ? `: ${c.options.slice(0, 12).join('/')}` : ''})`)
      const out = r.rows.map((x) => `- ${x.title} (id: ${x.id}) ${Object.entries(x.cells).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join('; ')}`)
      return text(`${row.title}: ${r.rows.length} row(s)${r.nextCursor ? ' (more exist)' : ''}\nColumns: ${cols.join(', ')}\n${out.join('\n') || 'No rows.'}`)
    }))

    server.registerTool('notion_create_page', {
      title: 'Create a Notion page',
      description: 'Create a sub-page under a page, or a new row in a database. Content is markdown (headings, lists, to-dos, quotes, code). For database rows, pass column values in properties.',
      inputSchema: {
        parent: PAGE,
        title: z.string().min(1),
        content: z.string().optional().describe('Page body as markdown'),
        properties: z.record(z.string(), z.string()).optional().describe('Database rows only: column name → value, e.g. {"Status": "Done", "Due": "2026-12-01"}'),
      },
      annotations: WRITE,
    }, safe(async ({ parent, title, content, properties }) => {
      const p = await createPage(user, resolve(parent), { title, markdown: content, properties }, 'chatgpt')
      return text(`Created "${p.title}" (id: ${p.id})${p.url ? ` · ${p.url}` : ''}`)
    }))

    server.registerTool('notion_update_page', {
      title: 'Edit a Notion page',
      description: 'Rename a page, add markdown content at the end of it, or change a database row\'s properties.',
      inputSchema: {
        page: PAGE,
        title: z.string().optional(),
        append: z.string().optional().describe('Markdown to add at the end of the page'),
        properties: z.record(z.string(), z.string()).optional().describe('Property name → new value'),
      },
      annotations: WRITE,
    }, safe(async ({ page, title, append, properties }) => {
      const p = await updatePage(user, resolve(page), { title, appendMarkdown: append, properties }, 'chatgpt')
      return text(`Updated "${p.title}": ${p.done.join(', ')}.`)
    }))

    server.registerTool('notion_comment', {
      title: 'Comment on a Notion page',
      description: 'Add a comment to a Notion page or database row. Your name is added to the comment.',
      inputSchema: { page: PAGE, text: z.string().min(1) },
      annotations: WRITE,
    }, safe(async ({ page, text: t }) => {
      await addComment(user, resolve(page), t, 'chatgpt')
      return text('Comment added.')
    }))

    server.registerTool('notion_archive_page', {
      title: 'Archive a Notion page',
      description: 'Move a Notion page or database row to Notion\'s trash (it can be restored from Notion for 30 days). Confirm with the user first.',
      inputSchema: { page: PAGE },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    }, safe(async ({ page }) => {
      const p = await setTrash(user, resolve(page), true, 'chatgpt')
      return text(`Archived "${p.title}".`)
    }))

    if (user.role !== 'superadmin') return
    server.registerTool('notion_access', {
      title: 'Who can do what in Notion',
      description: 'Superadmin only. Without set: shows who has access to which pages (optionally for one user or one page). With user, page and set: changes that user\'s access to the page and its sub-pages. set lists any of read, edit, create, comment, archive; an empty list blocks access; "inherit" removes the page\'s own setting so it follows its parent again.',
      inputSchema: {
        user: z.string().optional().describe('Username'),
        page: PAGE.optional(),
        set: z.union([z.array(z.enum(PERMS)), z.literal('inherit')]).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    }, safe(async ({ user: who, page, set }) => {
      const target = who ? users.list().find((u) => u.username === String(who).trim().toLowerCase().replace(/^@/, '') && !u.disabled) : null
      if (who && !target) throw new Error(`No active user "${who}".`)
      const pageId = page ? resolve(page) : null
      if (set !== undefined) {
        if (!target || !pageId) throw new Error('To change access, give both user and page.')
        if (target.role === 'superadmin') throw new Error(`${target.username} is a superadmin and can already do everything.`)
        if (!pageRow.get(pageId)) throw new Error('No such page.')
        setGrant(target.id, pageId, set === 'inherit' ? null : Object.fromEntries(PERMS.map((k) => [k, set.includes(k)])), user.username)
        log(user, `changed ${target.username}'s access`, pageRow.get(pageId), 'chatgpt')
      }
      const people = (target ? [target] : users.list().filter((u) => !u.disabled && u.role !== 'superadmin'))
      const pages = allPages().filter((r) => !pageId || r.id === pageId)
      const out = people.map((u) => {
        const lines = pages.map((r) => ({ r, e: effective(u, r.id) })).filter(({ e }) => e.read)
          .map(({ r, e }) => `  - ${r.title} (id: ${r.id}): ${permStr(e)}${e.explicit ? '' : ' (inherited)'}`)
        return `${u.username}${u.name ? ` (${u.name})` : ''}:\n${lines.join('\n') || '  no access'}`
      })
      return text(`${set !== undefined ? 'Saved. ' : ''}Notion access:\n${out.join('\n')}`)
    }))
  }

  if (connection()) setTimeout(syncIfStale, 2000)
  return { api, status, summary, registerTools, bareServer, instructions, hasAnyGrant, effective, sync }
}

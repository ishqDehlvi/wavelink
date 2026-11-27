// A small stand-in for the Notion API, for tests and for trying the dashboard locally without a real Notion account.
//   node test/fake-notion.mjs [port]          (default 3978)
// Integration token: ntn_fake0000000000000000000000000000
// OAuth: client id "fake-client", secret "fake-secret"; /v1/oauth/authorize approves at once and redirects back.
// Test helpers: POST /_expire (the OAuth access token stops working, so the service must refresh), GET /_writes.
import http from 'node:http'
import crypto from 'node:crypto'

const PORT = Number(process.argv[2] || 3978)
const TOKEN = 'ntn_fake0000000000000000000000000000'
const CLIENT = { id: 'fake-client', secret: 'fake-secret' }
let oauthAccess = 'fake-oauth-access-1'
const refreshTokens = new Set()
const writes = []

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
let nextId = 100
const rt = (content) => [{ type: 'text', text: { content, link: null }, annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' }, plain_text: content, href: null }]
const iso = () => new Date().toISOString()

const pages = new Map()   // id → page object
const blocks = new Map()  // parent id → [block]
const comments = new Map()
const dataSources = new Map()
const databases = new Map()

function addPage(id, parent, title, icon, body = []) {
  pages.set(id, { object: 'page', id, created_time: iso(), last_edited_time: iso(), parent, in_trash: false, icon: icon ? { type: 'emoji', emoji: icon } : null,
    properties: { title: { id: 'title', type: 'title', title: rt(title) } }, url: `https://www.notion.so/${id.replace(/-/g, '')}` })
  blocks.set(id, body.map(([type, text, extra]) => block(type, text, extra)))
  const p = parent.type === 'page_id' ? parent.page_id : null
  if (p) (blocks.get(p) || blocks.set(p, []).get(p)).push({ object: 'block', id, type: 'child_page', has_children: true, child_page: { title }, parent: { type: 'page_id', page_id: p } })
}
function block(type, text, extra = {}) {
  const id = uid(nextId++)
  return { object: 'block', id, type, has_children: false, [type]: { rich_text: rt(text), ...extra } }
}

const WIKI = uid(1), HR = uid(2), LEAVE = uid(3), SALES = uid(4), BOARD = uid(5), DB = uid(6), DS = uid(7), ACME = uid(8), SHARMA = uid(9)
addPage(WIKI, { type: 'workspace', workspace: true }, 'Company Wiki', '📚', [['heading_1', 'Welcome'], ['paragraph', 'Everything about how we work.']])
addPage(HR, { type: 'page_id', page_id: WIKI }, 'HR Policies', '🧑‍💼', [['paragraph', 'Read these before your first day.']])
addPage(LEAVE, { type: 'page_id', page_id: HR }, 'Leave policy', null, [['bulleted_list_item', '24 days paid leave'], ['to_do', 'Apply 2 weeks ahead', { checked: true }]])
addPage(SALES, { type: 'page_id', page_id: WIKI }, 'Sales Playbook', '📈', [['heading_2', 'Pitch'], ['paragraph', 'Lead with the free trial.']])
addPage(BOARD, { type: 'workspace', workspace: true }, 'Board notes (private)', '🔒', [['paragraph', 'BOARD-SECRET: acquisition talks']])

databases.set(DB, { object: 'database', id: DB, parent: { type: 'page_id', page_id: WIKI }, title: rt('Clients'), data_sources: [{ id: DS, name: 'Clients' }] })
dataSources.set(DS, { object: 'data_source', id: DS, parent: { type: 'database_id', database_id: DB }, title: rt('Clients'), created_time: iso(), last_edited_time: iso(),
  properties: { Name: { id: 'title', name: 'Name', type: 'title', title: {} }, Status: { id: 's', name: 'Status', type: 'select', select: { options: [{ name: 'Active' }, { name: 'Lead' }] } }, Amount: { id: 'a', name: 'Amount', type: 'number', number: {} } },
  url: `https://www.notion.so/${DB.replace(/-/g, '')}` })
blocks.get(WIKI).push({ object: 'block', id: DB, type: 'child_database', has_children: false, child_database: { title: 'Clients' } })
function addRow(id, name, status, amount) {
  pages.set(id, { object: 'page', id, created_time: iso(), last_edited_time: iso(), parent: { type: 'data_source_id', data_source_id: DS, database_id: DB }, in_trash: false, icon: null,
    properties: { Name: { id: 'title', type: 'title', title: rt(name) }, Status: { id: 's', type: 'select', select: status ? { name: status } : null }, Amount: { id: 'a', type: 'number', number: amount } },
    url: `https://www.notion.so/${id.replace(/-/g, '')}` })
  blocks.set(id, [])
}
addRow(ACME, 'Acme Traders', 'Active', 48400)
addRow(SHARMA, 'Sharma Textiles', 'Lead', null)

const dashed = (s) => {
  const h = String(s).replace(/-/g, '').toLowerCase()
  return h.length === 32 ? `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}` : s
}
const send = (res, code, data) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)) }
const err = (res, code, c, message) => send(res, code, { object: 'error', status: code, code: c, message })
const body = async (req) => { let s = ''; for await (const c of req) s += c; return s ? JSON.parse(s) : {} }
// what Notion sends back for properties it was given: each value gets its type, rich text gets plain_text
const normProps = (props = {}) => Object.fromEntries(Object.entries(props).map(([k, v]) => {
  const type = v.type || Object.keys(v).find((x) => x !== 'id')
  const val = v[type]
  return [k, { ...v, type, [type]: Array.isArray(val) ? val.map((t) => ({ ...t, plain_text: t.plain_text ?? t.text?.content })) : val }]
}))
const fromInput = (children = []) => children.map((b) => ({ object: 'block', id: uid(nextId++), type: b.type, has_children: false, [b.type]: b[b.type] }))

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  const p = url.pathname
  if (p === '/_expire' && req.method === 'POST') { oauthAccess = `fake-oauth-access-${Date.now()}`; return send(res, 200, { ok: true }) }
  if (p === '/_writes') return send(res, 200, writes)

  if (p === '/v1/oauth/authorize') {
    const back = new URL(url.searchParams.get('redirect_uri'))
    back.searchParams.set('code', 'fake-code')
    back.searchParams.set('state', url.searchParams.get('state') || '')
    res.writeHead(302, { location: back.toString() }).end()
    return
  }
  if (p === '/v1/oauth/token' && req.method === 'POST') {
    const basic = Buffer.from(String(req.headers.authorization || '').replace(/^Basic /, ''), 'base64').toString()
    if (basic !== `${CLIENT.id}:${CLIENT.secret}`) return send(res, 401, { error: 'invalid_client' })
    const b = await body(req)
    if (b.grant_type === 'authorization_code' && b.code !== 'fake-code') return send(res, 400, { error: 'invalid_grant' })
    if (b.grant_type === 'refresh_token' && !refreshTokens.has(b.refresh_token)) return send(res, 400, { error: 'invalid_grant' })
    const refresh = crypto.randomBytes(8).toString('hex')
    refreshTokens.add(refresh)
    return send(res, 200, { access_token: oauthAccess, refresh_token: refresh, bot_id: uid(99), workspace_id: uid(98), workspace_name: 'Fake Co', workspace_icon: '🧪', owner: { type: 'user' }, duplicated_template_id: null })
  }

  const auth = String(req.headers.authorization || '').replace(/^Bearer /, '')
  if (auth !== TOKEN && auth !== oauthAccess) return err(res, 401, 'unauthorized', 'API token is invalid.')
  if (!req.headers['notion-version']) return err(res, 400, 'missing_version', 'Notion-Version header failed validation.')
  const m = req.method
  let r
  if (m !== 'GET') writes.push(`${m} ${p}`)

  if (p === '/v1/users/me') return send(res, 200, { object: 'user', id: uid(99), type: 'bot', name: 'Wavelink', bot: { workspace_name: 'Fake Co', workspace_id: uid(98) } })
  if (p === '/v1/search' && m === 'POST') {
    const all = [...dataSources.values(), ...[...pages.values()].filter((x) => !x.in_trash)]
    return send(res, 200, { object: 'list', results: all, has_more: false, next_cursor: null })
  }
  if (p === '/v1/pages' && m === 'POST') {
    const b = await body(req)
    const id = uid(nextId++)
    const parent = b.parent.page_id ? { type: 'page_id', page_id: dashed(b.parent.page_id) } : { type: 'data_source_id', data_source_id: dashed(b.parent.data_source_id), database_id: DB }
    if (parent.page_id && !pages.has(parent.page_id)) return err(res, 404, 'object_not_found', 'Could not find page')
    pages.set(id, { object: 'page', id, created_time: iso(), last_edited_time: iso(), parent, in_trash: false, icon: null, properties: normProps(b.properties), url: `https://www.notion.so/${id.replace(/-/g, '')}` })
    blocks.set(id, fromInput(b.children))
    if (parent.page_id) blocks.get(parent.page_id).push({ object: 'block', id, type: 'child_page', has_children: true, child_page: { title: b.properties.title.title.map((t) => t.text.content).join('') } })
    return send(res, 200, pages.get(id))
  }
  if ((r = p.match(/^\/v1\/pages\/([\w-]+)$/))) {
    const pg = pages.get(dashed(r[1]))
    if (!pg) return err(res, 404, 'object_not_found', 'Could not find page')
    if (m === 'GET') return send(res, 200, pg)
    if (m === 'PATCH') {
      const b = await body(req)
      if (b.properties) Object.assign(pg.properties, normProps(Object.fromEntries(Object.entries(b.properties).map(([k, v]) => [k, { type: pg.properties[k]?.type, ...v }]))))
      if (b.in_trash !== undefined) pg.in_trash = b.in_trash
      pg.last_edited_time = iso()
      return send(res, 200, pg)
    }
  }
  if ((r = p.match(/^\/v1\/blocks\/([\w-]+)\/children$/))) {
    const id = dashed(r[1])
    if (!blocks.has(id)) return err(res, 404, 'object_not_found', 'Could not find block')
    if (m === 'GET') return send(res, 200, { object: 'list', results: blocks.get(id), has_more: false, next_cursor: null })
    if (m === 'PATCH') {
      const b = await body(req)
      const badLang = (b.children || []).find((x) => x.type === 'code' && !['javascript', 'python', 'plain text', 'shell', 'typescript'].includes(x.code.language))
      if (badLang) return err(res, 400, 'validation_error', `body failed validation: body.children[0].code.language should be one of Notion's languages, instead was \`"${badLang.code.language}"\`.`)
      const added = fromInput(b.children).map((x) => ({ ...x, [x.type]: { ...x[x.type], rich_text: (x[x.type].rich_text || []).map((t) => ({ ...t, plain_text: t.text.content })) } }))
      blocks.get(id).push(...added)
      return send(res, 200, { object: 'list', results: added })
    }
  }
  if ((r = p.match(/^\/v1\/blocks\/([\w-]+)$/)) && m === 'GET') {
    const pg = pages.get(dashed(r[1]))
    if (pg) return send(res, 200, { object: 'block', id: pg.id, type: 'child_page', parent: pg.parent })
    return err(res, 404, 'object_not_found', 'Could not find block')
  }
  if ((r = p.match(/^\/v1\/data_sources\/([\w-]+)$/)) && m === 'GET') {
    const ds = dataSources.get(dashed(r[1]))
    return ds ? send(res, 200, ds) : err(res, 404, 'object_not_found', 'Could not find data source')
  }
  if ((r = p.match(/^\/v1\/data_sources\/([\w-]+)\/query$/)) && m === 'POST') {
    const id = dashed(r[1])
    if (!dataSources.has(id)) return err(res, 404, 'object_not_found', 'Could not find data source')
    return send(res, 200, { object: 'list', results: [...pages.values()].filter((x) => x.parent.data_source_id === id && !x.in_trash), has_more: false, next_cursor: null })
  }
  if ((r = p.match(/^\/v1\/databases\/([\w-]+)$/)) && m === 'GET') {
    const d = databases.get(dashed(r[1]))
    return d ? send(res, 200, d) : err(res, 404, 'object_not_found', 'Could not find database')
  }
  if (p === '/v1/comments') {
    if (m === 'GET') return send(res, 200, { object: 'list', results: comments.get(dashed(url.searchParams.get('block_id'))) || [], has_more: false })
    if (m === 'POST') {
      const b = await body(req)
      const id = dashed(b.parent.page_id)
      const c = { object: 'comment', id: uid(nextId++), created_time: iso(), rich_text: b.rich_text.map((t) => ({ ...t, plain_text: t.text.content })) }
      ;(comments.get(id) || comments.set(id, []).get(id)).push(c)
      return send(res, 200, c)
    }
  }
  return err(res, 404, 'invalid_request_url', `No fake for ${m} ${p}`)
}).listen(PORT, '127.0.0.1', () => console.log(`Fake Notion on http://127.0.0.1:${PORT}`))

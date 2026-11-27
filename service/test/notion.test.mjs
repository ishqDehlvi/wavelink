// Notion tests: connecting, the encrypted token, page-by-page access with inheritance, Notion-only users, MCP tools,
// OAuth with token refresh. Runs against test/fake-notion.mjs.
// usage: node notion.test.mjs <base url> <api key> <data dir> <admin user> <admin pass> <fake notion url>
import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'
import path from 'node:path'

const [BASE, KEY, DATA, ADMIN_U, ADMIN_P, FAKE] = process.argv.slice(2)
let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && extra ? `  → ${extra}` : ''}`) }
async function api(p, { method = 'GET', body, as } = {}) {
  const h = { 'x-api-key': KEY, 'content-type': 'application/json' }
  if (as) { h['x-user-id'] = as.id; h['x-session-version'] = String(as.sessionVersion) }
  const r = await fetch(`${BASE}/api/${p}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  let data; try { data = JSON.parse(text) } catch { data = text }
  return { status: r.status, data, text }
}
const login = async (u, p) => (await api('auth/login', { method: 'POST', body: { username: u, password: p } })).data?.user
const id = (n) => `00000000000040008000${String(n).padStart(12, '0')}`
const WIKI = id(1), HR = id(2), LEAVE = id(3), SALES = id(4), BOARD = id(5), DS = id(7), ACME = id(8)
const FAKE_TOKEN = 'ntn_fake0000000000000000000000000000'

const admin = await login(ADMIN_U, ADMIN_P)
await api('admin/users', { method: 'POST', as: admin, body: { username: 'carol', name: 'Carol', password: 'carol-pass-123' } })
await api('admin/users', { method: 'POST', as: admin, body: { username: 'erin', password: 'erin-pass-123', whatsapp: false } })
const carol = await login('carol', 'carol-pass-123')
const erin = await login('erin', 'erin-pass-123')
ok(admin && carol && erin, 'admin, carol and erin (Notion only) sign in')

// ---------------------------------------------------------------- connecting
ok((await api('notion/status', { as: carol })).data.connected === false, 'Notion starts disconnected')
ok((await api('notion/token', { method: 'POST', as: carol, body: { token: FAKE_TOKEN } })).status === 403, 'a normal user cannot connect Notion')
ok((await api('notion/token', { method: 'POST', as: admin, body: { token: 'not-a-token' } })).status === 400, 'a malformed token is refused')
ok((await api('notion/token', { method: 'POST', as: admin, body: { token: 'ntn_wrong00000000000000000000000000' } })).status === 400, 'a token Notion rejects is refused')
const con = await api('notion/token', { method: 'POST', as: admin, body: { token: FAKE_TOKEN } })
ok(con.status === 200 && con.data.connected && con.data.workspace?.name === 'Fake Co', 'superadmin connects Notion with an integration token', con.text.slice(0, 160))
ok(con.data.pages === 8, 'sync finds 7 pages and 1 database', String(con.data.pages))

const udb = new DatabaseSync(path.join(DATA, 'users.db'), { readOnly: true })
const stored = udb.prepare('SELECT access_enc FROM notion_connection').get()
ok(stored && !stored.access_enc.includes(FAKE_TOKEN) && stored.access_enc.startsWith('v1.'), 'the Notion token is stored encrypted')
udb.close()

// ---------------------------------------------------------------- access
const pagesOf = async (u) => (await api('notion/pages', { as: u })).data
const has = (list, pid) => Array.isArray(list) && list.some((p) => p.id === pid)
ok((await pagesOf(admin)).length === 8, 'superadmin sees every shared page')
ok((await pagesOf(carol)).length === 0, 'carol sees nothing before she is given access')
ok((await api(`notion/pages/${WIKI}`, { as: carol })).status === 404, "carol can't open a page she wasn't given (looks like it doesn't exist)")

const setAccess = (u, pageId, perms) => api('notion/access', { method: 'PUT', as: admin, body: { userId: u.id, pageId, perms } })
ok((await api('notion/access', { method: 'PUT', as: carol, body: { userId: carol.id, pageId: WIKI, perms: { read: true } } })).status === 403, 'carol cannot give herself access')
ok((await setAccess(admin, WIKI, { read: true })).status === 400, 'superadmins need no grants')
await setAccess(carol, WIKI, { read: true })
let cp = await pagesOf(carol)
ok(has(cp, WIKI) && has(cp, HR) && has(cp, LEAVE) && has(cp, SALES) && has(cp, DS) && has(cp, ACME), 'read on Company Wiki covers its sub-pages, the database and its rows')
ok(!has(cp, BOARD), 'pages outside the shared tree stay hidden')
ok(cp.find((p) => p.id === WIKI)?.parentId === null && cp.find((p) => p.id === HR)?.parentId === WIKI, 'the tree keeps its shape')
const page = await api(`notion/pages/${LEAVE}`, { as: carol })
ok(page.status === 200 && page.text.includes('24 days paid leave') && page.data.breadcrumbs.map((b) => b.title).join('>') === 'Company Wiki>HR Policies', 'carol reads Leave policy with its breadcrumbs', page.text.slice(0, 200))
ok((await api(`notion/pages/${BOARD}`, { as: carol })).status === 404, 'carol still cannot read the private board notes')

await setAccess(carol, HR, { read: false })
cp = await pagesOf(carol)
ok(!has(cp, HR) && !has(cp, LEAVE) && has(cp, SALES), 'blocking HR Policies hides it and its sub-pages, and nothing else')

// writes need their own ticks
const before = (await (await fetch(`${FAKE}/_writes`)).json()).length
ok((await api(`notion/pages/${SALES}/append`, { method: 'POST', as: carol, body: { markdown: 'Hi' } })).status === 403, 'read-only: carol cannot edit')
ok((await api(`notion/pages/${SALES}/children`, { method: 'POST', as: carol, body: { title: 'X' } })).status === 403, 'read-only: carol cannot add pages')
ok((await api(`notion/pages/${SALES}/comments`, { method: 'POST', as: carol, body: { text: 'X' } })).status === 403, 'read-only: carol cannot comment')
ok((await api(`notion/pages/${SALES}/archive`, { method: 'POST', as: carol })).status === 403, 'read-only: carol cannot archive')
ok((await (await fetch(`${FAKE}/_writes`)).json()).length === before, 'nothing refused ever reached Notion')

await setAccess(carol, SALES, { edit: true, comment: true })
const app = await api(`notion/pages/${SALES}/append`, { method: 'POST', as: carol, body: { markdown: '## Objections\n- Too expensive → show the ROI sheet\n- [ ] Call back Friday' } })
ok(app.status === 200, 'with Edit, carol adds content to Sales Playbook', app.text.slice(0, 160))
ok((await api(`notion/pages/${SALES}`, { as: carol })).text.includes('Objections'), 'the added content is in Notion')
const code = await api(`notion/pages/${SALES}/append`, { method: 'POST', as: carol, body: { markdown: '```js\nconsole.log(1)\n```\n```weirdlang\nx\n```' } })
ok(code.status === 200, 'code blocks: short names like js become Notion\'s names, unknown ones plain text', code.text.slice(0, 200))
ok(Boolean((await pagesOf(carol)).find((p) => p.id === SALES)?.perms.read), 'ticking Edit also ticks Read')
const cm = await api(`notion/pages/${SALES}/comments`, { method: 'POST', as: carol, body: { text: 'Updated the objections' } })
ok(cm.status === 201 && (await api(`notion/pages/${SALES}`, { as: carol })).text.includes('Carol'), 'carol comments and her name is on it')
ok((await api(`notion/pages/${SALES}/children`, { method: 'POST', as: carol, body: { title: 'X' } })).status === 403, 'Edit does not include creating sub-pages')

ok((await api(`notion/pages/${DS}/children`, { method: 'POST', as: carol, body: { title: 'Gupta Steel' } })).status === 403, 'carol cannot add a row without Create')
await setAccess(carol, DS, { read: true, create: true })
const row = await api(`notion/pages/${DS}/children`, { method: 'POST', as: carol, body: { title: 'Gupta Steel', properties: { status: 'Lead', Amount: '1200' } } })
ok(row.status === 201 && row.data.title === 'Gupta Steel', 'with Create, carol adds a database row with column values', row.text.slice(0, 160))
const rows = await api(`notion/pages/${DS}`, { as: carol })
ok(rows.data.database?.rows.some((r) => r.title === 'Gupta Steel' && r.cells.Status === 'Lead' && r.cells.Amount === '1200'), 'the new row shows in the database with its values')
ok((await api(`notion/pages/${DS}/children`, { method: 'POST', as: carol, body: { title: 'Bad', properties: { Nope: '1' } } })).status === 400, 'an unknown column is refused with a clear error')

const arch = await api(`notion/pages/${LEAVE}/archive`, { method: 'POST', as: admin })
ok(arch.status === 200 && !has(await pagesOf(admin), LEAVE), 'superadmin archives a page and it disappears')
ok((await api(`notion/pages/${LEAVE}/restore`, { method: 'POST', as: admin })).status === 200 && has(await pagesOf(admin), LEAVE), 'and can restore it')

// ---------------------------------------------------------------- Notion-only users
ok((await api('me', { as: erin })).data.whatsapp === false, 'erin is a Notion-only account')
ok((await api('status', { as: erin })).status === 403, 'erin has no WhatsApp')
ok((await pagesOf(erin)).length === 0, 'erin sees no Notion pages yet')
const users = (await api('admin/users', { as: admin })).data
ok(users.find((u) => u.username === 'erin')?.whatsappEnabled === false && users.find((u) => u.username === 'carol')?.notion === true, 'the Users list shows WhatsApp and Notion access')

// ---------------------------------------------------------------- MCP
const b64 = (b) => Buffer.from(b).toString('base64url')
async function chatgptToken(username, password) {
  const reg = await (await fetch(`${BASE}/oauth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'ChatGPT test', redirect_uris: ['https://chatgpt.com/cb'] }) })).json()
  const verifier = b64(crypto.randomBytes(32))
  const challenge = b64(crypto.createHash('sha256').update(verifier).digest())
  const form = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: 'https://chatgpt.com/cb', code_challenge: challenge, code_challenge_method: 'S256', state: 's', scope: 'whatsapp offline_access', username, password })
  const r = await fetch(`${BASE}/oauth/authorize`, { method: 'POST', body: form, redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': `10.1.0.${Math.floor(Math.random() * 200)}` } })
  if (r.status !== 302) return null
  const code = new URL(r.headers.get('location')).searchParams.get('code')
  return (await (await fetch(`${BASE}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: reg.client_id, redirect_uri: 'https://chatgpt.com/cb', code_verifier: verifier }) })).json()).access_token
}
let rpc = 1
async function mcp(target, method, params = {}) {
  const url = target.startsWith('/') ? `${BASE}${target}` : `${BASE}/mcp`
  const h = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }
  if (!target.startsWith('/')) h.authorization = `Bearer ${target}`
  const r = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify({ jsonrpc: '2.0', id: rpc++, method, params }) })
  const out = await r.json().catch(() => null)
  if (!out?.result) console.log('MCP response:', r.status, JSON.stringify(out).slice(0, 300))
  return out?.result
}
const toolNames = async (t) => (await mcp(t, 'tools/list')).tools.map((x) => x.name)
const call = async (t, name, args = {}) => (await mcp(t, 'tools/call', { name, arguments: args })).content[0].text

const ct = await chatgptToken('carol', 'carol-pass-123')
const et = await chatgptToken('erin', 'erin-pass-123')
let names = await toolNames(ct)
ok(names.includes('whatsapp_status') && names.includes('notion_search') && !names.includes('notion_access'), "carol's ChatGPT has WhatsApp and Notion tools, not notion_access")
names = await toolNames(et)
ok(!names.some((n) => n.startsWith('whatsapp_')) && !names.some((n) => n.startsWith('notion_')), "erin's ChatGPT has no WhatsApp tools and, without access, no Notion tools")
const found = await call(ct, 'notion_search', {})
ok(found.includes('Sales Playbook') && !found.includes('Board notes') && !found.includes('HR Policies'), 'notion_search lists only what carol can see', found.slice(0, 300))
ok((await call(ct, 'notion_read_page', { page: 'Sales Playbook' })).includes('Objections'), 'notion_read_page finds a page by its title')
ok(/doesn't exist or you don't have access/.test(await call(ct, 'notion_read_page', { page: BOARD })), 'notion_read_page refuses the private page')
ok(/don't have edit access/.test(await call(ct, 'notion_update_page', { page: `https://www.notion.so/Company-Wiki-${WIKI}`, append: 'x' })), 'notion_update_page refuses without Edit (page given as a Notion link)')
ok(/Created "Patel Bros"/.test(await call(ct, 'notion_create_page', { parent: DS, title: 'Patel Bros', properties: { Status: 'Active' } })), 'notion_create_page adds a database row')
ok((await call(ct, 'notion_query_database', { database: 'Clients' })).includes('Patel Bros'), 'notion_query_database lists rows')

await setAccess(erin, SALES, { read: true })
names = await toolNames(et)
ok(names.includes('notion_read_page') && !names.some((n) => n.startsWith('whatsapp_')), 'once given a page, erin gets the Notion tools only')
ok((await call(et, 'notion_read_page', { page: SALES })).includes('Pitch'), 'erin reads the page she was given')

const local = `/mcp/${KEY}` // the first superadmin
ok((await toolNames(local)).includes('notion_access'), 'the superadmin has notion_access')
const acc = await call(local, 'notion_access', { user: 'carol', page: HR, set: 'inherit' })
ok(acc.startsWith('Saved') && has(await pagesOf(carol), HR), 'notion_access "inherit" gives carol HR Policies back from the parent')
ok(/is a superadmin/.test(await call(local, 'notion_access', { user: ADMIN_U, page: HR, set: ['read'] })), 'notion_access refuses to change a superadmin')

const log = (await api('notion/activity', { as: admin })).data
ok(log.some((l) => l.username === 'carol' && l.via === 'chatgpt' && l.action === 'added a row') && log.some((l) => l.username === 'carol' && l.via === 'dashboard'), 'activity records who changed what, from where')
ok((await api('notion/activity', { as: carol })).data.every((l) => l.username === 'carol'), 'users see only their own activity')

// ---------------------------------------------------------------- OAuth, token refresh, disconnect
const start = await api('notion/oauth/start', { method: 'POST', as: admin })
const authUrl = new URL(start.data.url)
ok(start.status === 200 && authUrl.searchParams.get('client_id') === 'fake-client' && authUrl.searchParams.get('owner') === 'user', 'Connect Notion builds the OAuth link')
ok((await api('notion/oauth/callback', { method: 'POST', as: admin, body: { code: 'fake-code', state: 'forged' } })).status === 400, 'a forged OAuth state is refused')
const cb = await api('notion/oauth/callback', { method: 'POST', as: admin, body: { code: 'fake-code', state: authUrl.searchParams.get('state') } })
ok(cb.status === 200 && cb.data.kind === 'oauth', 'OAuth sign-in replaces the token connection', cb.text.slice(0, 160))
await fetch(`${FAKE}/_expire`, { method: 'POST' })
ok((await api(`notion/pages/${SALES}`, { as: carol })).status === 200, 'an expired OAuth access token is refreshed without anyone noticing')
ok(has(await pagesOf(carol), SALES), "access settings survive reconnecting (same pages)")

ok((await api('notion/connection', { method: 'DELETE', as: carol })).status === 403, 'a normal user cannot disconnect Notion')
const off = await api('notion/connection', { method: 'DELETE', as: admin })
ok(off.status === 200 && off.data.connected === false, 'superadmin disconnects Notion')
ok(!(await toolNames(ct)).some((n) => n.startsWith('notion_')), 'after disconnecting, ChatGPT has no Notion tools')

console.log(`\nnotion: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

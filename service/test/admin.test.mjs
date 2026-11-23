// Superadmin read-only access tests (run after leaktest.mjs on the same server: uses bob, and creates dave).
// usage: node admintest.mjs <base url> <api key> <data dir> <admin user> <admin pass>
import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'
import path from 'node:path'

const [BASE, KEY, DATA, ADMIN_U, ADMIN_P] = process.argv.slice(2)
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

const admin = await login(ADMIN_U, ADMIN_P)
const bob = await login('bob', 'bob-new-pass-456')
await api('admin/users', { method: 'POST', as: admin, body: { username: 'dave', password: 'dave-pass-123' } })
const dave = await login('dave', 'dave-pass-123')
ok(admin && bob && dave, 'admin, bob and dave sign in')
const now = Math.floor(Date.now() / 1000)
const d = new DatabaseSync(path.join(DATA, 'users', dave.id, 'whatsapp.db'))
d.prepare('INSERT INTO chats (jid, alt_jid, name, is_group, last_ts) VALUES (?,?,?,?,?)').run('919000000004@s.whatsapp.net', null, 'Dave client', 0, now)
d.prepare('INSERT INTO messages (chat_jid, id, from_jid, from_name, from_me, ts, text, media_type, raw) VALUES (?,?,?,?,?,?,?,?,?)')
  .run('919000000004@s.whatsapp.net', 'DMSG1', '919000000004@s.whatsapp.net', 'Client', 0, now, 'DAVE-SECRET order 40 boxes', null, JSON.stringify({ key: { remoteJid: '919000000004@s.whatsapp.net', id: 'DMSG1' }, message: { conversation: 'x' } }))
d.close()
const B_JID = encodeURIComponent('919000000002@s.whatsapp.net')

// ---------------------------------------------------------------- dashboard: admin reads, read-only
const asBob = (p) => `${p}${p.includes('?') ? '&' : '?'}as=${bob.id}`
const chats = await api(asBob('chats'), { as: admin })
ok(chats.status === 200 && chats.data.length === 1 && chats.data[0].jid === '919000000002@s.whatsapp.net', 'admin views bob\'s chat list', chats.text.slice(0, 120))
const msgs = await api(asBob(`chats/${B_JID}/messages`), { as: admin })
ok(msgs.status === 200 && msgs.text.includes('BOB-SECRET'), 'admin reads bob\'s messages and voice-note transcript')
const st = await api(asBob('status'), { as: admin })
ok(st.status === 200 && st.data.qr === null, 'admin viewing bob never gets bob\'s QR code')
ok((await api(asBob('overview'), { as: admin })).status === 200 && (await api(asBob('memory'), { as: admin })).status === 200, 'admin can open bob\'s overview and AI notes')
const sum = await api(asBob(`chats/${B_JID}/summary`), { method: 'POST', as: admin })
ok(sum.status !== 403, 'admin may ask the AI to summarise a chat of bob\'s', `${sum.status}`)
const rd = await api(asBob(`media/${B_JID}/BMSG1V/read`), { method: 'POST', as: admin })
ok(rd.status === 200 && rd.text.includes('BOB-SECRET-VOICE'), 'admin may read bob\'s attachment with AI', `${rd.status} ${rd.text.slice(0, 100)}`)
for (const [m, p, body] of [
  ['POST', `chats/${B_JID}/send`, { text: 'hi from admin' }],
  ['POST', `chats/${B_JID}/file`, { base64: 'aGk=', filename: 'a.txt' }],
  ['POST', `chats/${B_JID}/draft`, {}],
  ['PUT', `chats/${B_JID}/autoreply`, { mode: 'on' }],
  ['PUT', 'autoreply', { mode: 'all' }],
  ['POST', 'memory', { text: 'admin note' }],
  ['DELETE', 'memory/1', undefined],
  ['POST', 'connector/revoke', {}],
  ['POST', 'whatsapp/unlink', { clearChats: true }],
]) {
  const r = await api(asBob(p), { method: m, as: admin, body })
  ok(r.status === 403, `admin viewing bob is refused: ${m} /${p.split('/')[0]}${p.includes('/send') ? '/send' : p.includes('/file') ? '/file' : p.includes('/draft') ? '/draft' : p.includes('autoreply') && p.startsWith('chats') ? '/autoreply' : ''}`, `${r.status} ${r.text.slice(0, 80)}`)
}
const bobMsgs = await api(`chats/${B_JID}/messages`, { as: bob })
ok(!bobMsgs.text.includes('hi from admin'), 'nothing was sent from bob\'s account')
ok((await api('autoreply', { as: bob })).data.mode === 'off', 'bob\'s auto-reply settings are unchanged')

// ---------------------------------------------------------------- users still can't view each other
ok((await api(`chats?as=${dave.id}`, { as: bob })).status === 403, 'bob (user) cannot view dave with ?as=')
ok((await api(`chats/${encodeURIComponent('919000000004@s.whatsapp.net')}/messages?as=${dave.id}`, { as: bob })).status === 403, 'bob cannot read dave\'s messages with ?as=')
ok((await api(`chats?as=ffffffffffffffffff`, { as: admin })).status === 404, 'admin ?as= an unknown account → 404')

// ---------------------------------------------------------------- access log is visible to the owner
const log = await api('me/access', { as: bob })
ok(log.status === 200 && log.data.some((e) => e.admin === ADMIN_U && e.via === 'dashboard'), 'bob sees that the admin viewed his chats', log.text)
ok((await api('me/access', { as: dave })).data.length === 0, 'dave (not viewed yet) sees no entries')
const list = await api('admin/users', { as: admin })
ok(list.data.find((u) => u.id === bob.id)?.lastViewedByAdmin?.admin === ADMIN_U, 'the Users list shows when bob was last viewed')
ok(!list.text.includes('BOB-SECRET') && !list.text.includes('DAVE-SECRET'), 'the Users list itself still has no chat content')

// ---------------------------------------------------------------- ChatGPT
const b64 = (b) => Buffer.from(b).toString('base64url')
async function token(username, password) {
  const reg = await (await fetch(`${BASE}/oauth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'ChatGPT test', redirect_uris: ['https://chatgpt.com/cb'] }) })).json()
  const verifier = b64(crypto.randomBytes(32))
  const form = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: 'https://chatgpt.com/cb', code_challenge: b64(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256', scope: 'whatsapp offline_access', username, password })
  const r = await fetch(`${BASE}/oauth/authorize`, { method: 'POST', body: form, redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': `10.1.0.${Math.floor(Math.random() * 200)}` } })
  const code = new URL(r.headers.get('location')).searchParams.get('code')
  return (await (await fetch(`${BASE}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: reg.client_id, redirect_uri: 'https://chatgpt.com/cb', code_verifier: verifier }) })).json()).access_token
}
let n = 1
const rpc = async (tok, method, params) => {
  const r = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: n++, method, params }) })
  return { status: r.status, text: await r.text() }
}
const tool = (tok, name, args = {}) => rpc(tok, 'tools/call', { name, arguments: args })
const at = await token(ADMIN_U, ADMIN_P)
const bt = await token('bob', 'bob-new-pass-456')
const tools = JSON.parse((await rpc(at, 'tools/list', {})).text).result.tools
const byName = Object.fromEntries(tools.map((t) => [t.name, t]))
ok(Boolean(byName.whatsapp_accounts), 'admin\'s ChatGPT has whatsapp_accounts')
ok(Boolean(byName.whatsapp_search_messages.inputSchema.properties.account), 'admin\'s read tools take an account')
const bobTools = JSON.parse((await rpc(bt, 'tools/list', {})).text).result.tools
ok(!bobTools.some((t) => t.name === 'whatsapp_accounts' || t.inputSchema.properties?.account), 'bob\'s ChatGPT has no accounts tool and no account field')
const accts = await tool(at, 'whatsapp_accounts')
ok(accts.text.includes('bob') && accts.text.includes('dave'), 'whatsapp_accounts lists bob and dave', accts.text.slice(0, 200))
const ds = await tool(at, 'whatsapp_search_messages', { query: 'SECRET', account: 'dave' })
ok(ds.text.includes('DAVE-SECRET') && !ds.text.includes('BOB-SECRET') && ds.text.includes('read-only'), 'admin\'s ChatGPT searches dave\'s chats when asked', ds.text.slice(0, 200))
const own = await tool(at, 'whatsapp_search_messages', { query: 'SECRET' })
ok(!own.text.includes('DAVE-SECRET') && !own.text.includes('BOB-SECRET'), 'without account, admin\'s ChatGPT uses only the admin\'s own WhatsApp')
const sendAs = await tool(at, 'whatsapp_send_message', { to: '919000000004', text: 'hello', account: 'dave' })
ok(/only read other accounts/.test(sendAs.text), 'admin\'s ChatGPT cannot send from dave\'s account', sendAs.text.slice(0, 200))
const memAs = await tool(at, 'whatsapp_remember', { note: 'Admin note for bob', account: 'bob' })
ok(/only read other accounts/.test(memAs.text), 'admin\'s ChatGPT cannot change bob\'s AI notes', memAs.text.slice(0, 300))
ok(/No account matches/.test((await tool(at, 'whatsapp_status', { account: 'nobody-here' })).text), 'unknown account gives a clear error')
const bobTry = await tool(bt, 'whatsapp_search_messages', { query: 'SECRET', account: 'dave' })
ok(!bobTry.text.includes('DAVE-SECRET'), 'bob\'s ChatGPT passing account:"dave" still sees only bob\'s chats', bobTry.text.slice(0, 160))
const daveLog = await api('me/access', { as: dave })
ok(daveLog.data.some((e) => e.via === 'chatgpt'), 'dave sees that the admin read his chats through ChatGPT')

// disabled accounts can't be viewed
await api(`admin/users/${dave.id}`, { method: 'PATCH', as: admin, body: { disabled: true } })
ok((await api(`chats?as=${dave.id}`, { as: admin })).status === 404, 'a disabled account cannot be viewed')
ok(/No account matches/.test((await tool(at, 'whatsapp_status', { account: 'dave' })).text), 'a disabled account cannot be read through ChatGPT')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

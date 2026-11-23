// Cross-user isolation tests against a local test server (WA_NO_CONNECT=1, synthetic data only).
// usage: node leaktest.mjs <base url> <api key> <data dir> <admin user> <admin pass>
import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const [BASE, KEY, DATA, ADMIN_U, ADMIN_P] = process.argv.slice(2)
let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && extra ? `  → ${extra}` : ''}`) }

async function api(p, { method = 'GET', body, as, key = KEY, headers = {} } = {}) {
  const h = { 'x-api-key': key, 'content-type': 'application/json', ...headers }
  if (as) { h['x-user-id'] = as.id; h['x-session-version'] = String(as.sessionVersion) }
  const r = await fetch(`${BASE}/api/${p}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await r.text()
  let data; try { data = JSON.parse(text) } catch { data = text }
  return { status: r.status, data, text }
}
const login = async (u, p) => (await api('auth/login', { method: 'POST', body: { username: u, password: p } }))

// ---------------------------------------------------------------- setup
const admin = (await login(ADMIN_U, ADMIN_P)).data.user
ok(admin?.role === 'superadmin', 'superadmin signs in with the migrated login')
const mk = async (username) => (await api('admin/users', { method: 'POST', as: admin, body: { username, name: username.toUpperCase(), password: `${username}-pass-123` } }))
const ra = await mk('alice'), rb = await mk('bob')
ok(ra.status === 201 && rb.status === 201, 'admin creates alice and bob', `${ra.status} ${rb.status} ${ra.text}`)
const alice = (await login('alice', 'alice-pass-123')).data.user
let bob = (await login('bob', 'bob-pass-123')).data.user
ok(alice && bob && alice.id !== bob.id, 'alice and bob can sign in')
ok((await mk('alice')).status === 400, 'duplicate username is refused')

// seed each workspace with its own secret messages (the service created the DB when the user was created)
const now = Math.floor(Date.now() / 1000)
function seed(user, secret, jid, msgId) {
  const d = new DatabaseSync(path.join(DATA, 'users', user.id, 'whatsapp.db'))
  d.prepare('INSERT INTO chats (jid, alt_jid, name, is_group, last_ts) VALUES (?,?,?,?,?)').run(jid, null, `Contact of ${user.username}`, 0, now)
  d.prepare('INSERT INTO messages (chat_jid, id, from_jid, from_name, from_me, ts, text, media_type, raw) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(jid, msgId, jid, 'Someone', 0, now, `${secret} please pay`, null, JSON.stringify({ key: { remoteJid: jid, id: msgId }, message: { conversation: secret } }))
  d.prepare('INSERT INTO messages (chat_jid, id, from_jid, from_name, from_me, ts, text, media_type, raw) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(jid, msgId + 'V', jid, 'Someone', 0, now, '', 'voice_note', JSON.stringify({ key: { remoteJid: jid, id: msgId + 'V' }, message: { audioMessage: { ptt: true } } }))
  d.prepare('INSERT INTO attachments (chat_jid, id, kind, mime, text, error, updated_ts) VALUES (?,?,?,?,?,?,?)')
    .run(jid, msgId + 'V', 'voice_note', 'audio/ogg', `Transcript: ${secret}-VOICE`, null, now)
  d.close()
}
const A_JID = '919000000001@s.whatsapp.net', B_JID = '919000000002@s.whatsapp.net'
seed(alice, 'ALICE-SECRET', A_JID, 'AMSG1')
seed(bob, 'BOB-SECRET', B_JID, 'BMSG1')
const ADMIN_SECRET = 'SECRET-ADMIN-INVOICE'
const secrets = ['ALICE-SECRET', ADMIN_SECRET]

// ---------------------------------------------------------------- dashboard API as bob
const leaks = (r) => secrets.some((s) => r.text.includes(s)) || r.text.includes(A_JID) || r.text.includes('911111111111')
const chats = await api('chats', { as: bob })
ok(chats.status === 200 && chats.data.length === 1 && chats.data[0].jid === B_JID && !leaks(chats), 'bob\'s chat list has only his own chat', chats.text.slice(0, 200))
// asking for someone else's chat by number only echoes the number back: what matters is that no messages or names come back
for (const j of [A_JID, '911111111111@s.whatsapp.net']) {
  const r = await api(`chats/${encodeURIComponent(j)}/messages`, { as: bob })
  ok(r.status === 200 && r.data.messages.length === 0 && !secrets.some((x) => r.text.includes(x)) && !r.text.includes('Contact of') && !r.text.includes('Alice'),
    `bob asking for ${j.split('@')[0]}'s messages gets no messages and no name`, r.text.slice(0, 160))
}
for (const p of ['overview', 'digest?generate=0', 'autoreplies', 'memory', 'autoreply', 'status', 'connector']) {
  const r = await api(p, { as: bob })
  ok(!leaks(r), `bob GET /${p.split('?')[0]} shows nothing of alice/admin`, `${r.status} ${r.text.slice(0, 160)}`)
}
const media = await api(`media/${encodeURIComponent(A_JID)}/AMSG1V`, { as: bob })
ok(media.status >= 400 && !leaks(media), 'bob cannot download alice\'s attachment', `${media.status} ${media.text.slice(0, 120)}`)
const read = await api(`media/${encodeURIComponent(A_JID)}/AMSG1V/read`, { method: 'POST', as: bob })
ok(read.status >= 400 && !leaks(read), 'bob cannot read alice\'s voice-note transcript', `${read.status} ${read.text.slice(0, 120)}`)
const send = await api(`chats/${encodeURIComponent(A_JID)}/send`, { method: 'POST', as: bob, body: { text: 'hi', replyTo: 'AMSG1' } })
ok(send.status >= 400 && !leaks(send), 'bob cannot quote-reply to alice\'s message', `${send.status} ${send.text.slice(0, 120)}`)
// memory stays per user
await api('memory', { method: 'POST', as: alice, body: { text: 'ALICE-SECRET memory note' } })
const bm = await api('memory', { as: bob })
ok(!bm.text.includes('ALICE-SECRET'), 'alice\'s AI memory notes are invisible to bob')
await api('autoreply', { method: 'PUT', as: alice, body: { mode: 'all', instructions: 'ALICE-SECRET instructions' } })
const bar = await api('autoreply', { as: bob })
ok(bar.data.mode === 'off' && !bar.text.includes('ALICE-SECRET'), 'alice\'s auto-reply settings don\'t affect bob')

// ---------------------------------------------------------------- roles and sessions
for (const [m, p] of [['GET', 'admin/users'], ['POST', 'admin/users'], ['PATCH', `admin/users/${alice.id}`], ['DELETE', `admin/users/${alice.id}`]]) {
  const r = await api(p, { method: m, as: bob, body: m === 'GET' || m === 'DELETE' ? undefined : { username: 'x', password: 'x', disabled: true } })
  ok(r.status === 403, `bob (user) gets 403 on ${m} /${p.split('/').slice(0, 2).join('/')}`, `${r.status}`)
}
const list = await api('admin/users', { as: admin })
ok(list.status === 200 && list.data.length === 3, 'admin lists 3 users')
ok(!list.text.includes('ALICE-SECRET') && !list.text.includes('BOB-SECRET') && !list.text.includes(ADMIN_SECRET) && !list.text.includes('919000000001'),
  'admin user list has no chat content, contacts or chat numbers')
ok(!list.text.includes('pw_hash') && !list.text.includes('scrypt'), 'admin user list has no password hashes')
ok((await api('chats', { as: { ...bob, sessionVersion: bob.sessionVersion + 1 } })).status === 401, 'wrong session version is refused')
ok((await api('chats', { as: { id: 'ffffffffffffffffff', sessionVersion: 1 } })).status === 401, 'unknown user id is refused')
ok((await api('chats', {})).status === 401, 'no user is refused')
ok((await api('chats', { as: bob, key: 'wrong' })).status === 401, 'wrong API key is refused')
ok((await api('chats', { as: { id: '../../etc', sessionVersion: 1 } })).status === 401, 'path-like user id is refused')
ok((await api(`admin/users/${admin.id}`, { method: 'DELETE', as: admin })).status === 400, 'admin cannot delete themselves')
ok((await api(`admin/users/${admin.id}`, { method: 'PATCH', as: admin, body: { disabled: true } })).status === 400, 'admin cannot disable themselves')
ok((await api('admin/users', { method: 'POST', as: admin, body: { username: 'x', password: 'short' } })).status === 400, 'bad username / short password refused')

// ---------------------------------------------------------------- ChatGPT (OAuth + MCP) as bob
const b64 = (b) => Buffer.from(b).toString('base64url')
async function chatgptToken(username, password) {
  const reg = await (await fetch(`${BASE}/oauth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'ChatGPT test', redirect_uris: ['https://chatgpt.com/cb'] }) })).json()
  const verifier = b64(crypto.randomBytes(32))
  const challenge = b64(crypto.createHash('sha256').update(verifier).digest())
  const form = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: 'https://chatgpt.com/cb', code_challenge: challenge, code_challenge_method: 'S256', state: 's', scope: 'whatsapp offline_access', username, password })
  const r = await fetch(`${BASE}/oauth/authorize`, { method: 'POST', body: form, redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 200)}` } })
  if (r.status !== 302) return null
  const code = new URL(r.headers.get('location')).searchParams.get('code')
  const t = await (await fetch(`${BASE}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: reg.client_id, redirect_uri: 'https://chatgpt.com/cb', code_verifier: verifier }) })).json()
  return t
}
let id = 1
async function tool(token, name, args = {}) {
  const r = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: id++, method: 'tools/call', params: { name, arguments: args } }) })
  return { status: r.status, text: await r.text() }
}
ok((await chatgptToken('bob', 'wrong-password')) === null, 'ChatGPT sign-in with a wrong password fails')
const bt = await chatgptToken('bob', 'bob-pass-123')
ok(Boolean(bt?.access_token), 'bob connects ChatGPT with his own login')
const st = await tool(bt.access_token, 'whatsapp_status')
ok(st.status === 200 && /messages stored: 2/.test(st.text), 'bob\'s ChatGPT sees bob\'s workspace (2 messages)', st.text.slice(0, 200))
for (const [name, args] of [
  ['whatsapp_search_messages', { query: 'SECRET' }],
  ['whatsapp_search_messages', { query: 'VOICE' }],
  ['whatsapp_list_chats', {}],
  ['whatsapp_read_attachment', { chat: A_JID, message_id: 'AMSG1V' }],
  ['whatsapp_search_contacts', { query: '9190000000' }],
  ['whatsapp_memories', {}],
  ['whatsapp_waiting', {}],
  ['whatsapp_brief', { hours: 24 }],
]) {
  const r = await tool(bt.access_token, name, args)
  ok(r.status === 200 && !leaks(r), `bob's ChatGPT ${name}(${JSON.stringify(args).slice(0, 40)}) shows nothing of alice/admin`, r.text.slice(0, 200))
}
for (const chat of [A_JID, '911111111111', 'Alice', 'Contact of alice']) {
  const r = await tool(bt.access_token, 'whatsapp_read_messages', { chat })
  ok(r.status === 200 && !secrets.some((x) => r.text.includes(x)) && !r.text.includes('Chat: ') && !/Alice \(admin/.test(r.text),
    `bob's ChatGPT read_messages("${chat}") returns no messages or names`, r.text.slice(0, 200))
}
const bs = await tool(bt.access_token, 'whatsapp_search_messages', { query: 'BOB-SECRET-VOICE' })
ok(bs.text.includes('BOB-SECRET'), 'bob\'s ChatGPT does find bob\'s own voice-note transcript')
const at = await chatgptToken('alice', 'alice-pass-123')
const as = await tool(at.access_token, 'whatsapp_search_messages', { query: 'SECRET' })
ok(as.text.includes('ALICE-SECRET') && !as.text.includes('BOB-SECRET') && !as.text.includes(ADMIN_SECRET), 'alice\'s ChatGPT sees only alice\'s messages')
const legacy = await tool('legacy-access-token', 'whatsapp_search_messages', { query: 'SECRET' })
ok(legacy.text.includes(ADMIN_SECRET) && !legacy.text.includes('ALICE-SECRET') && !legacy.text.includes('BOB-SECRET'), 'the migrated ChatGPT token still works and sees only the superadmin\'s chats', legacy.text.slice(0, 200))
ok((await tool('not-a-token', 'whatsapp_status')).status === 401, 'made-up ChatGPT token is refused')

// ---------------------------------------------------------------- reset / disable / delete cut access straight away
await api(`admin/users/${bob.id}`, { method: 'PATCH', as: admin, body: { password: 'bob-new-pass-456' } })
ok((await api('chats', { as: bob })).status === 401, 'after a password reset, bob\'s old dashboard session is signed out')
ok((await tool(bt.access_token, 'whatsapp_status')).status === 401, 'after a password reset, bob\'s ChatGPT token stops working')
ok((await login('bob', 'bob-pass-123')).status === 401 && (await login('bob', 'bob-new-pass-456')).status === 200, 'bob signs in only with the new password')
await api(`admin/users/${alice.id}`, { method: 'PATCH', as: admin, body: { disabled: true } })
ok((await login('alice', 'alice-pass-123')).status === 401, 'disabled alice cannot sign in')
ok((await tool(at.access_token, 'whatsapp_status')).status === 401, 'disabled alice\'s ChatGPT token stops working')
ok((await chatgptToken('alice', 'alice-pass-123')) === null, 'disabled alice cannot connect ChatGPT again')
const del = await api(`admin/users/${alice.id}`, { method: 'DELETE', as: admin })
ok(del.status === 200 && !fs.existsSync(path.join(DATA, 'users', alice.id)), 'deleting alice erases her workspace folder')
ok((await api('admin/users', { as: admin })).data.length === 2, 'alice is gone from the user list')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

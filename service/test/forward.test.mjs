// Message forwarding tests (run after the other suites on the same server; uses bob and the superadmin).
// usage: node forward.test.mjs <base url> <api key> <data dir> <admin user> <admin pass>
import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'
import path from 'node:path'
import { generateForwardMessageContent, BufferJSON, proto } from '@whiskeysockets/baileys'

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
const bob = await login('bob', 'bob-new-pass-456')
const admin = await login(ADMIN_U, ADMIN_P)

// seed: a normal text, a photo (with media keys), a view-once photo and a message that arrived as a forward
const JID = '919000000002@s.whatsapp.net'
const enc = encodeURIComponent(JID)
const db = new DatabaseSync(path.join(DATA, 'users', bob.id, 'whatsapp.db'))
const now = Math.floor(Date.now() / 1000)
const img = { url: 'https://mmg.whatsapp.net/x', mimetype: 'image/jpeg', mediaKey: Buffer.from('k'.repeat(32)), fileSha256: Buffer.from('s'.repeat(32)), fileEncSha256: Buffer.from('e'.repeat(32)), fileLength: 1234, directPath: '/v/x', caption: 'invoice photo' }
const seeds = [
  ['FWDTEXT1', { conversation: 'Payment of 5000 done' }, 'Payment of 5000 done', null],
  ['FWDIMG1', { imageMessage: img }, 'invoice photo', 'image'],
  ['FWDONCE1', { viewOnceMessageV2: { message: { imageMessage: img } } }, '', 'image'],
  ['FWDIN1', { extendedTextMessage: { text: 'Meeting moved to 5pm', contextInfo: { isForwarded: true, forwardingScore: 1 } } }, 'Meeting moved to 5pm', null],
]
for (const [id, message, text, media] of seeds) {
  db.prepare('INSERT OR REPLACE INTO messages (chat_jid, id, from_jid, from_name, from_me, ts, text, media_type, raw) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(JID, id, JID, 'Someone', 0, now, text, media, JSON.stringify({ key: { remoteJid: JID, id, fromMe: false }, message, messageTimestamp: now }, BufferJSON.replacer))
}
db.close()

// ---------------------------------------------------------------- WhatsApp builds a proper forward from what we store
const raw = (id) => {
  const d = new DatabaseSync(path.join(DATA, 'users', bob.id, 'whatsapp.db'), { readOnly: true })
  const r = JSON.parse(d.prepare('SELECT raw FROM messages WHERE id = ?').get(id).raw, BufferJSON.reviver)
  d.close()
  return r
}
const fText = generateForwardMessageContent(raw('FWDTEXT1'))
ok(fText.extendedTextMessage?.text === 'Payment of 5000 done' && fText.extendedTextMessage?.contextInfo?.isForwarded === true, 'a stored text message becomes a WhatsApp forward with the Forwarded flag')
const fImg = generateForwardMessageContent(raw('FWDIMG1'))
ok(fImg.imageMessage?.mediaKey?.length === 32 && fImg.imageMessage?.directPath === '/v/x' && fImg.imageMessage?.contextInfo?.isForwarded === true,
  'a stored photo forwards with its media keys (no re-upload) and the Forwarded flag')
const wire = proto.Message.decode(proto.Message.encode(proto.Message.fromObject(fImg)).finish())
ok(wire.imageMessage?.mediaKey?.length === 32 && wire.imageMessage?.contextInfo?.isForwarded === true, 'the forwarded photo encodes to a valid WhatsApp message and back')

// ---------------------------------------------------------------- dashboard endpoint rules
const fwd = (body, as = bob) => api(`chats/${enc}/forward`, { method: 'POST', as, body })
const six = ['1', '2', '3', '4', '5', '6'].map((n) => `91900000001${n}@s.whatsapp.net`)
ok((await fwd({ messageId: 'FWDTEXT1', to: six })).text.includes('at most 5'), 'forwarding to more than 5 chats is refused')
ok((await fwd({ messageId: 'FWDTEXT1', to: [] })).status === 400, 'forwarding to nobody is refused')
ok(/Not a WhatsApp chat/.test((await fwd({ messageId: 'FWDTEXT1', to: ['../../etc/passwd'] })).text), 'a made-up recipient is refused')
ok(/view-once/.test((await fwd({ messageId: 'FWDONCE1', to: [six[0]] })).text), 'view-once messages cannot be forwarded (same as WhatsApp)')
ok(/not found/.test((await fwd({ messageId: 'NOPE', to: [six[0]] })).text), 'an unknown message is refused')
const notLinked = await fwd({ messageId: 'FWDTEXT1', to: [six[0]] })
ok(notLinked.status === 400 && /not connected/.test(notLinked.text), 'with WhatsApp unlinked it reports that clearly (reached the send step)', notLinked.text.slice(0, 120))
const asAdmin = await api(`chats/${enc}/forward?as=${bob.id}`, { method: 'POST', as: admin, body: { messageId: 'FWDTEXT1', to: [six[0]] } })
ok(asAdmin.status === 403, 'the superadmin viewing bob cannot forward from bob\'s WhatsApp', `${asAdmin.status}`)

// ---------------------------------------------------------------- forwarded label
const list = await api(`chats/${enc}/messages`, { as: bob })
const byId = Object.fromEntries(list.data.messages.map((m) => [m.id, m]))
ok(byId.FWDIN1?.forwarded === true && byId.FWDTEXT1?.forwarded === false, 'the dashboard marks messages that arrived as forwards')

// ---------------------------------------------------------------- ChatGPT tool
const b64 = (b) => Buffer.from(b).toString('base64url')
async function token(username, password, ip) {
  const reg = await (await fetch(`${BASE}/oauth/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ client_name: 'ChatGPT test', redirect_uris: ['https://chatgpt.com/cb'] }) })).json()
  const verifier = b64(crypto.randomBytes(32))
  const form = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: 'https://chatgpt.com/cb', code_challenge: b64(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256', scope: 'whatsapp offline_access', username, password })
  const r = await fetch(`${BASE}/oauth/authorize`, { method: 'POST', body: form, redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': ip } })
  const code = new URL(r.headers.get('location')).searchParams.get('code')
  return (await (await fetch(`${BASE}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: reg.client_id, redirect_uri: 'https://chatgpt.com/cb', code_verifier: verifier }) })).json()).access_token
}
let n = 1
const rpc = async (tok, method, params) => (await fetch(`${BASE}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: n++, method, params }) })).json()
const bt = await token('bob', 'bob-new-pass-456', '10.6.6.1')
const at = await token(ADMIN_U, ADMIN_P, '10.6.6.2')
const tools = (await rpc(bt, 'tools/list', {})).result.tools
const t = tools.find((x) => x.name === 'whatsapp_forward_message')
ok(Boolean(t) && t.annotations?.readOnlyHint === false, 'ChatGPT has whatsapp_forward_message, marked as a sending action (asks before running)')
ok(t?.inputSchema?.properties?.to?.maxItems === 5, 'the ChatGPT tool also caps recipients at 5')
const read = (await rpc(bt, 'tools/call', { name: 'whatsapp_read_messages', arguments: { chat: JID } })).result.content[0].text
ok(/Meeting moved to 5pm/.test(read) && /\[forwarded\]: Meeting moved/.test(read), 'ChatGPT sees which messages were forwarded', read.slice(-300))
const viaTool = (await rpc(bt, 'tools/call', { name: 'whatsapp_forward_message', arguments: { chat: JID, message_id: 'FWDTEXT1', to: ['919000000011'] } })).result.content[0].text
ok(/not connected/.test(viaTool), 'ChatGPT forwarding reaches the send step (WhatsApp not linked in tests)', viaTool.slice(0, 160))
const adminAs = (await rpc(at, 'tools/call', { name: 'whatsapp_forward_message', arguments: { chat: JID, message_id: 'FWDTEXT1', to: ['919000000011'], account: 'bob' } })).result.content[0].text
ok(/only read other accounts/.test(adminAs), 'the superadmin\'s ChatGPT cannot forward from bob\'s account', adminAs.slice(0, 160))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

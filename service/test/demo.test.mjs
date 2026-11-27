// Demo mode tests: a server started with DEMO_MODE=1 shows made-up chats, works through ChatGPT's tools and the
// dashboard, and never needs (or opens) a WhatsApp connection.
// usage: node demo.test.mjs <base url> <api key> <data dir> <admin user> <admin pass>
import crypto from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'

const [BASE, KEY, DATA, ADMIN_U, ADMIN_P] = process.argv.slice(2)
let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && extra ? `  → ${extra}` : ''}`) }
async function api(p, { method = 'GET', body, as, raw = false } = {}) {
  const h = { 'x-api-key': KEY, 'content-type': 'application/json' }
  if (as) { h['x-user-id'] = as.id; h['x-session-version'] = String(as.sessionVersion) }
  const r = await fetch(`${BASE}/api/${p}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
  if (raw) return { status: r.status, type: r.headers.get('content-type'), buf: Buffer.from(await r.arrayBuffer()) }
  const text = await r.text()
  let data; try { data = JSON.parse(text) } catch { data = text }
  return { status: r.status, data, text }
}
const admin = (await api('auth/login', { method: 'POST', body: { username: ADMIN_U, password: ADMIN_P } })).data?.user
ok(Boolean(admin), 'the demo admin can sign in')

// ---------------------------------------------------------------- looks linked, with made-up chats only
const st = (await api('status', { as: admin })).data
ok(st.status === 'connected' && st.qr === null && st.number === '15550100000', 'the demo account shows as connected with a made-up number and no QR code', JSON.stringify(st))
const chats = (await api('chats', { as: admin })).data
const names = chats.map((c) => c.name)
ok(['Priya Sharma', 'Sam', 'Sales team', 'Ravi Kumar', 'Accounts'].every((n) => names.includes(n)), 'the sample chats are there', names.join(', '))
ok(chats.every((c) => c.isGroup || /^1555010\d{4}$/.test(c.number || '')), 'every 1:1 chat uses a number from the fictional +1 555 0100 range')

// ---------------------------------------------------------------- ChatGPT's tools
const b64 = (b) => Buffer.from(b).toString('base64url')
async function token() {
  const reg = await (await fetch(`${BASE}/oauth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'ChatGPT test', redirect_uris: ['https://chatgpt.com/cb'] }) })).json()
  const verifier = b64(crypto.randomBytes(32))
  const challenge = b64(crypto.createHash('sha256').update(verifier).digest())
  const form = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: 'https://chatgpt.com/cb', code_challenge: challenge, code_challenge_method: 'S256', state: 's', scope: 'whatsapp offline_access', username: ADMIN_U, password: ADMIN_P })
  const r = await fetch(`${BASE}/oauth/authorize`, { method: 'POST', body: form, redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' } })
  const code = new URL(r.headers.get('location')).searchParams.get('code')
  return (await (await fetch(`${BASE}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: reg.client_id, redirect_uri: 'https://chatgpt.com/cb', code_verifier: verifier }) })).json()).access_token
}
const t = await token()
let rid = 1
async function tool(name, args = {}) {
  const r = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: rid++, method: 'tools/call', params: { name, arguments: args } }) })
  return await r.text()
}
const brief = await tool('whatsapp_brief', { hours: 24 })
ok(/Priya Sharma \[high, NEEDS REPLY\]/.test(brief) && /INV-2041/.test(brief), 'whatsapp_brief puts Priya and the overdue invoice first', brief.slice(0, 300))
ok(/Sales team \(group\) \[normal\]/.test(brief), 'the busy Sales group is in the brief but not marked as needing a reply')
const sam = await tool('whatsapp_read_messages', { chat: 'Sam' })
ok(/\[voice_note\]/.test(sam) && /transcript: Transcript: Bhai, 5 baje/.test(sam) && /Park Street office/.test(sam), "Sam's voice note comes with its transcript and English translation", sam.slice(0, 400))
const inv = await tool('whatsapp_read_attachment', { chat: 'Priya Sharma', message_id: '3EB0DE4000000002' })
ok(/INR 48,400/.test(inv) && /INV-2041/.test(inv), "Priya's invoice photo can be read without an AI key", inv.slice(0, 200))
const draft = await tool('whatsapp_draft_reply', { chat: 'Priya Sharma', guidance: "I'll pay tomorrow morning" })
ok(/Write the draft for Priya Sharma[^"]*yourself/.test(draft) && /Can you confirm by tonight/.test(draft) && /pay tomorrow morning/.test(draft) && !/Error/.test(draft),
  'without an AI key, whatsapp_draft_reply gives the AI app the conversation to write the draft itself', draft.slice(0, 200))
const mem = await tool('whatsapp_memories')
ok(/Sharma Interiors/.test(mem), 'the demo comes with a few saved notes')

// ---------------------------------------------------------------- sending only touches the demo chats
const sent = await tool('whatsapp_send_message', { to: 'Priya Sharma', text: "Hi Priya, the invoice will be paid tomorrow morning. I'll send the confirmation once it goes through." })
ok(/^.*Sent to Priya Sharma/.test(sent.replace(/\\n/g, ' ')), 'whatsapp_send_message "sends" in demo mode', sent.slice(0, 200))
const priyaJid = chats.find((c) => c.name === 'Priya Sharma').jid
const thread = (await api(`chats/${encodeURIComponent(priyaJid)}/messages`, { as: admin })).data.messages
ok(thread.at(-1).fromMe && /paid tomorrow morning/.test(thread.at(-1).text), 'the sent message appears at the end of the chat on the dashboard')

const fw = await api(`chats/${encodeURIComponent(priyaJid)}/forward`, { method: 'POST', as: admin, body: { messageIds: ['3EB0DE4000000002'], to: [chats.find((c) => c.name === 'Accounts').jid] } })
ok(fw.status === 200 && fw.data.results?.[0]?.ok, 'forwarding the invoice photo to the Accounts group works', fw.text.slice(0, 200))
const accJid = chats.find((c) => c.name === 'Accounts').jid
const acc = (await api(`chats/${encodeURIComponent(accJid)}/messages`, { as: admin })).data.messages.at(-1)
ok(acc.fromMe && acc.forwarded && acc.media === 'image', 'the forward shows as a forwarded photo in Accounts')
const pic = await api(`media/${encodeURIComponent(accJid)}/${acc.id}`, { as: admin, raw: true })
ok(pic.status === 200 && pic.type === 'image/jpeg' && pic.buf[0] === 0xff && pic.buf[1] === 0xd8, 'the forwarded photo opens on the dashboard', `${pic.status} ${pic.type}`)
const voice = await api(`media/${encodeURIComponent(chats.find((c) => c.name === 'Sam').jid)}/3EB0DE4000000008`, { as: admin, raw: true })
ok(voice.status === 200 && voice.type === 'audio/ogg' && voice.buf.subarray(0, 4).toString() === 'OggS', "Sam's voice note plays on the dashboard", `${voice.status} ${voice.type}`)

const file = await api(`chats/${encodeURIComponent(priyaJid)}/file`, { method: 'POST', as: admin, body: { base64: Buffer.from('%PDF-1.4 demo').toString('base64'), filename: 'receipt.pdf' } })
ok(file.status === 200 && file.data.id, 'sending a file works in demo mode')

const grp = await tool('whatsapp_create_group', { name: 'Showroom launch', participants: ['Neha Kapoor', 'Kabir'] })
ok(/Created group \\"Showroom launch\\"/.test(grp), 'creating a group works in demo mode', grp.slice(0, 160))

// ---------------------------------------------------------------- reset
await api('whatsapp/unlink', { method: 'POST', as: admin, body: { clearChats: true } })
const after = (await api(`chats/${encodeURIComponent(priyaJid)}/messages`, { as: admin })).data.messages
ok(!after.some((m) => /paid tomorrow morning/.test(m.text || '')) && after.length === 5, '"Unlink" in demo mode puts the sample chats back as they were', String(after.length))
ok((await api('status', { as: admin })).data.status === 'connected', 'and the demo account stays connected')

// nothing in the demo database points at a real WhatsApp number
const db = new DatabaseSync(path.join(DATA, 'users', admin.id, 'whatsapp.db'), { readOnly: true })
const real = db.prepare("SELECT COUNT(*) n FROM chats WHERE jid LIKE '%@s.whatsapp.net' AND jid NOT LIKE '1555010%'").get().n
db.close()
ok(real === 0, 'no chat in the demo uses a real-looking phone number')

console.log(`\ndemo: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

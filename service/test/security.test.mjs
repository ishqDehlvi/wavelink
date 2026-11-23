// Security fix tests (run after leaktest + admintest on the same fresh server; uses bob).
// usage: node sectest.mjs <base url> <api key> <data dir> <path to netsafe.js>
import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const [BASE, KEY, DATA, NETSAFE] = process.argv.slice(2)
const { isPublicIp, fetchPublic } = await import(NETSAFE)
let pass = 0, fail = 0
const ok = (cond, name, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && extra ? `  → ${extra}` : ''}`) }

// ---------------------------------------------------------------- 1+2: internal addresses are blocked
for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.5.4', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::ffff:127.0.0.1', 'fe80::1', 'fd00::1'])
  ok(!isPublicIp(ip), `${ip} counts as private`)
for (const ip of ['8.8.8.8', '13.232.18.155', '2606:4700::1111']) ok(isPublicIp(ip), `${ip} counts as public`)
const blocked = async (url) => { try { await fetchPublic(url); return 'allowed' } catch (e) { return e.message } }
for (const url of ['http://127.0.0.1:3940/api/status', 'http://localhost:2019/config/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]:3100/',
  'http://127.1/', 'http://0x7f000001/', 'http://localtest.me/', 'file:///etc/passwd', 'ftp://example.com/x']) {
  const r = await blocked(url)
  ok(r !== 'allowed' && /private|internal|Only http|not allowed/.test(r), `download of ${url} is refused`, r)
}
const pub = await blocked('https://example.com/')
ok(pub === 'allowed', 'a normal public link still downloads', pub)
const redir = await blocked('https://httpbin.org/redirect-to?url=http%3A%2F%2F169.254.169.254%2Flatest%2Fmeta-data%2F')
ok(redir !== 'allowed' && !/HTTP 5\d\d/.test(redir), 'a public link that redirects to the metadata service is refused', redir)

// ---------------------------------------------------------------- 1: ChatGPT can't send files from the server's disk
async function api(p, { method = 'GET', body, as } = {}) {
  const h = { 'x-api-key': KEY, 'content-type': 'application/json' }
  if (as) { h['x-user-id'] = as.id; h['x-session-version'] = String(as.sessionVersion) }
  const r = await fetch(`${BASE}/api/${p}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
  return r
}
const bob = (await (await api('auth/login', { method: 'POST', body: { username: 'bob', password: 'bob-new-pass-456' } })).json()).user
const b64 = (b) => Buffer.from(b).toString('base64url')
async function token(username, password, ip) {
  const reg = await (await fetch(`${BASE}/oauth/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ client_name: 'ChatGPT test', redirect_uris: ['https://chatgpt.com/cb'] }) })).json()
  const verifier = b64(crypto.randomBytes(32))
  const form = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: 'https://chatgpt.com/cb', code_challenge: b64(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256', scope: 'whatsapp offline_access', username, password })
  const r = await fetch(`${BASE}/oauth/authorize`, { method: 'POST', body: form, redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': ip } })
  const code = new URL(r.headers.get('location')).searchParams.get('code')
  return (await (await fetch(`${BASE}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: reg.client_id, redirect_uri: 'https://chatgpt.com/cb', code_verifier: verifier }) })).json()).access_token
}
const bt = await token('bob', 'bob-new-pass-456', '10.9.9.1')
let n = 1
const tool = async (name, args) => (await (await fetch(`${BASE}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${bt}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: n++, method: 'tools/call', params: { name, arguments: args } }) })).text())
const tools = await (await fetch(`${BASE}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${bt}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: n++, method: 'tools/list', params: {} }) })).json()
const sendFile = tools.result.tools.find((t) => t.name === 'whatsapp_send_file')
ok(!sendFile.inputSchema.properties.path, 'whatsapp_send_file no longer has a server file path option')
const viaPath = await tool('whatsapp_send_file', { to: '919000000002', path: path.join(DATA, 'users.db') })
ok(/exactly one of url or base64/.test(viaPath) && !viaPath.includes('Sent '), 'passing a server path anyway is refused, nothing sent', viaPath.slice(0, 200))
const viaMeta = await tool('whatsapp_send_file', { to: '919000000002', url: 'http://169.254.169.254/latest/meta-data/' })
ok(/private or internal/.test(viaMeta), 'ChatGPT cannot make the server fetch the metadata service', viaMeta.slice(0, 200))
const viaLocal = await tool('whatsapp_send_file', { to: '919000000002', url: 'http://127.0.0.1:3940/api/status' })
ok(/private or internal/.test(viaLocal), 'ChatGPT cannot make the server fetch its own internal API', viaLocal.slice(0, 200))

// ---------------------------------------------------------------- 3: attachments can't act as web pages on the dashboard
const db = new DatabaseSync(path.join(DATA, 'users', bob.id, 'whatsapp.db'))
const JID = '919000000002@s.whatsapp.net'
const cache = path.join(DATA, 'users', bob.id, 'downloads', 'cache')
fs.mkdirSync(cache, { recursive: true })
const evil = [
  ['EVILHTML1', 'documentMessage', 'text/html', 'invoice.html', '<script>fetch("/api/wa/chats")</script>'],
  ['EVILSVG1', 'imageMessage', 'image/svg+xml', null, '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
  ['GOODJPG1', 'imageMessage', 'image/jpeg', null, 'jpegbytes'],
  ['GOODPDF1', 'documentMessage', 'application/pdf', 'quote.pdf', '%PDF-1.4'],
]
for (const [id, k, mime, fileName, body] of evil) {
  const raw = { key: { remoteJid: JID, id }, message: { [k]: { mimetype: mime, ...(fileName ? { fileName } : {}) } } }
  db.prepare('INSERT OR REPLACE INTO messages (chat_jid, id, from_jid, from_name, from_me, ts, text, media_type, raw) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(JID, id, JID, 'Stranger', 0, Math.floor(Date.now() / 1000), fileName || '', k.replace('Message', ''), JSON.stringify(raw))
  fs.writeFileSync(path.join(cache, id), body)
}
db.close()
const media = async (id) => api(`media/${encodeURIComponent(JID)}/${id}`, { as: bob })
const h1 = await media('EVILHTML1')
ok(h1.status === 200 && h1.headers.get('content-type') === 'application/octet-stream' && /^attachment/.test(h1.headers.get('content-disposition')) && /sandbox/.test(h1.headers.get('content-security-policy')) && h1.headers.get('x-content-type-options') === 'nosniff',
  'an HTML file from a stranger downloads instead of opening, sandboxed', JSON.stringify(Object.fromEntries(h1.headers)))
const h2 = await media('EVILSVG1')
ok(h2.headers.get('content-type') === 'application/octet-stream' && /^attachment/.test(h2.headers.get('content-disposition')) && /sandbox/.test(h2.headers.get('content-security-policy')),
  'an SVG "photo" with a script downloads instead of opening, sandboxed')
const h3 = await media('GOODJPG1')
ok(h3.headers.get('content-type') === 'image/jpeg' && /^inline/.test(h3.headers.get('content-disposition')) && /sandbox/.test(h3.headers.get('content-security-policy')), 'a normal photo still shows inline (sandboxed)')
const h4 = await media('GOODPDF1')
ok(h4.headers.get('content-type') === 'application/pdf' && /^inline/.test(h4.headers.get('content-disposition')) && h4.headers.get('x-content-type-options') === 'nosniff', 'a PDF still opens inline in the browser viewer')

// ---------------------------------------------------------------- 4: registration flooding
let last
for (let i = 0; i < 21; i++) {
  last = await fetch(`${BASE}/oauth/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.7.7.7' }, body: JSON.stringify({ client_name: 'flood', redirect_uris: ['https://chatgpt.com/cb'] }) })
}
ok(last.status === 429, 'the 21st app registration from one address within an hour is refused', `${last.status}`)
const other = await fetch(`${BASE}/oauth/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.8.8.8' }, body: JSON.stringify({ client_name: 'real ChatGPT', redirect_uris: ['https://chatgpt.com/cb'] }) })
ok(other.status === 201, 'a different address (a real user) can still register')

// ---------------------------------------------------------------- 6: oversized ChatGPT requests
const big = await fetch(`${BASE}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${bt}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: 'x'.repeat(46 * 1024 * 1024) }).catch((e) => ({ status: 'closed:' + e.message }))
ok(big.status === 413 || String(big.status).startsWith('closed'), 'a 46 MB ChatGPT request is refused', `${big.status}`)
const still = await tool('whatsapp_status', {})
ok(/status:/.test(still), 'the service keeps working afterwards')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

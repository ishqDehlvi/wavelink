// Typed message → English tests (run after the other suites; uses bob and the superadmin; no AI key on the test server).
// usage: node translate.test.mjs <base url> <api key> <data dir> <admin user> <admin pass>

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

// only typed messages are converted: there is no per-chat translation endpoint
const JID = encodeURIComponent('919000000002@s.whatsapp.net')
ok((await api(`chats/${JID}/translate`, { method: 'POST', as: bob, body: { ids: ['x'] } })).status === 404, 'there is no per-chat translation endpoint')

// typed message → English (composer button)
const typed = await api('translate', { method: 'POST', as: bob, body: { text: 'kal milte hain' } })
ok(typed.status === 503 && /GEMINI_API_KEY/.test(typed.text), 'converting a typed message without an AI key reports that clearly', typed.text.slice(0, 120))
ok((await api('translate', { method: 'POST', as: bob, body: { text: '' } })).status === 400, 'an empty typed message is refused')
ok((await api('translate', { method: 'POST', as: bob, body: { text: 'x'.repeat(5001) } })).status === 400, 'a typed message over 5000 characters is refused')
ok((await api(`translate?as=${bob.id}`, { method: 'POST', as: admin, body: { text: 'kal milte hain' } })).status === 403, 'the superadmin viewing an account cannot use its composer')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)

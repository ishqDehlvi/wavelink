// Dashboard / ChatGPT accounts. Passwords are stored as scrypt hashes.
// session_version goes up on password reset or disable, which signs that user out everywhere.
import crypto from 'node:crypto'

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
const now = () => Math.floor(Date.now() / 1000)

export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/
export const ROLES = ['superadmin', 'user']

function scrypt(password, salt) {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password.normalize('NFKC'), salt, 64, SCRYPT, (e, key) => (e ? reject(e) : resolve(key))))
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  return `scrypt$${salt.toString('base64')}$${(await scrypt(password, salt)).toString('base64')}`
}

async function verifyPassword(password, stored) {
  const [kind, salt, hash] = String(stored).split('$')
  if (kind !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64')
  const got = await scrypt(password, Buffer.from(salt, 'base64'))
  return got.length === expected.length && crypto.timingSafeEqual(got, expected)
}

const DUMMY_HASH = await hashPassword(crypto.randomBytes(16).toString('hex'))

const publicUser = (r) => r && {
  id: r.id,
  username: r.username,
  name: r.name || null,
  role: r.role,
  disabled: Boolean(r.disabled),
  sessionVersion: r.session_version,
  created: r.created,
  lastLogin: r.last_login || null,
  whatsapp: r.whatsapp !== 0, // off for people who only use Notion
}

export function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters.'
  if (pw.length > 200) return 'Password is too long.'
  return null
}

export function createUsers(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    name TEXT,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'user')),
    pw_hash TEXT NOT NULL,
    disabled INTEGER NOT NULL DEFAULT 0,
    session_version INTEGER NOT NULL DEFAULT 1,
    created INTEGER NOT NULL,
    last_login INTEGER)`)

  // added later: may this account link WhatsApp (off = Notion only)
  if (!db.prepare('PRAGMA table_info(users)').all().some((c) => c.name === 'whatsapp')) {
    db.exec('ALTER TABLE users ADD COLUMN whatsapp INTEGER NOT NULL DEFAULT 1')
  }

  const byId = db.prepare('SELECT * FROM users WHERE id = ?')
  const byName = db.prepare('SELECT * FROM users WHERE username = ?')

  return {
    count: () => db.prepare('SELECT COUNT(*) n FROM users').get().n,
    countActiveSuperadmins: () => db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'superadmin' AND disabled = 0").get().n,

    /** Active (not disabled) user, or null. */
    get: (id) => {
      const r = id ? byId.get(String(id)) : null
      return r && !r.disabled ? publicUser(r) : null
    },
    /** Any user, including disabled ones (admin views). */
    find: (id) => publicUser(byId.get(String(id))) || null,
    list: () => db.prepare('SELECT * FROM users ORDER BY role DESC, created').all().map(publicUser),

    async authenticate(username, password) {
      const r = byName.get(String(username).trim().toLowerCase())
      // always run one hash so response time doesn't reveal whether the username exists
      const ok = await verifyPassword(String(password), r?.pw_hash || DUMMY_HASH)
      if (!r || !ok || r.disabled) return null
      db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(now(), r.id)
      return publicUser(byId.get(r.id))
    },

    async checkPassword(id, password) {
      const r = byId.get(String(id))
      return Boolean(r) && verifyPassword(String(password), r.pw_hash)
    },

    async create({ username, name, password, role = 'user', whatsapp = true }) {
      username = String(username || '').trim().toLowerCase()
      if (!USERNAME_RE.test(username)) throw new Error('Username must be 3–32 characters: letters, numbers, dots, dashes or underscores.')
      if (byName.get(username)) throw new Error(`The username "${username}" is already taken.`)
      if (!ROLES.includes(role)) throw new Error('Role must be superadmin or user.')
      const pwErr = validatePassword(password)
      if (pwErr) throw new Error(pwErr)
      const id = crypto.randomBytes(9).toString('hex')
      db.prepare('INSERT INTO users (id, username, name, role, pw_hash, created, whatsapp) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, username, String(name || '').trim().slice(0, 60) || null, role, await hashPassword(password), now(), whatsapp ? 1 : 0)
      return publicUser(byId.get(id))
    },

    /** Change name / password / role / disabled / WhatsApp access. Password changes and disabling sign the user out everywhere. */
    async update(id, { name, password, role, disabled, whatsapp }) {
      const r = byId.get(String(id))
      if (!r) throw new Error('No such user.')
      let bump = false
      if (name !== undefined) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(String(name || '').trim().slice(0, 60) || null, r.id)
      if (password !== undefined) {
        const pwErr = validatePassword(password)
        if (pwErr) throw new Error(pwErr)
        db.prepare('UPDATE users SET pw_hash = ? WHERE id = ?').run(await hashPassword(password), r.id)
        bump = true
      }
      if (role !== undefined) {
        if (!ROLES.includes(role)) throw new Error('Role must be superadmin or user.')
        if (role !== r.role) bump = true
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, r.id)
      }
      if (disabled !== undefined) {
        if (Boolean(disabled) !== Boolean(r.disabled)) bump = true
        db.prepare('UPDATE users SET disabled = ? WHERE id = ?').run(disabled ? 1 : 0, r.id)
      }
      if (whatsapp !== undefined) db.prepare('UPDATE users SET whatsapp = ? WHERE id = ?').run(whatsapp ? 1 : 0, r.id)
      if (bump) db.prepare('UPDATE users SET session_version = session_version + 1 WHERE id = ?').run(r.id)
      return publicUser(byId.get(r.id))
    },

    remove: (id) => db.prepare('DELETE FROM users WHERE id = ?').run(String(id)).changes > 0,
  }
}

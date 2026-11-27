// One user's WhatsApp workspace: their own database, WhatsApp link, media, auto-reply settings, AI memory and MCP tools.
// Everything a user can see or do goes through their workspace, and a workspace only ever opens files in its own folder,
// so one user's chats can never show up for another user.
import makeWASocket, {
  BufferJSON,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  isJidGroup,
  jidNormalizedUser,
} from '@whiskeysockets/baileys'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import QRCode from 'qrcode'
import pino from 'pino'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { GoogleGenAI } from '@google/genai'
import { createAttachments } from './attachments.js'
import { fetchPublic } from './netsafe.js'
import { DEMO_BRIEF, DEMO_OWNER, createDemoSocket, seedDemo } from './demo/demo.js'

const logger = pino({ level: 'silent' })
const gemini = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash'
const NO_CONNECT = process.env.WA_NO_CONNECT === '1' // tests: never open a WhatsApp connection
const DEMO = process.env.DEMO_MODE === '1' // made-up chats, no WhatsApp connection, nothing is really sent (see demo/demo.js)

const tsOf = (t) => (t == null ? 0 : typeof t === 'object' ? (t.toNumber?.() ?? t.low ?? 0) : Number(t))
const numberOf = (jid) => (jid || '').split('@')[0].split(':')[0]
const fmtTime = (ts) => new Date(ts * 1000).toLocaleString(process.env.LOCALE || 'en-US', { dateStyle: 'medium', timeStyle: 'short' })

function unwrap(m) {
  for (let i = 0; i < 5 && m; i++) {
    const inner =
      m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message ||
      m.documentWithCaptionMessage?.message || m.editedMessage?.message
    if (!inner) break
    m = inner
  }
  return m
}

function describe(m) {
  m = unwrap(m)
  if (!m) return null
  const kinds = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage', 'locationMessage', 'contactMessage']
  const kind = kinds.find((k) => m[k])
  const media = kind?.replace('Message', '') || null
  let text = m.conversation || m.extendedTextMessage?.text || m[kind]?.caption || ''
  if (kind === 'documentMessage' && m.documentMessage.fileName) text = `${m.documentMessage.fileName}${text ? ' — ' + text : ''}`
  if (kind === 'audioMessage' && m.audioMessage.ptt) return { text, media: 'voice_note' }
  if (kind === 'locationMessage') text = `${m.locationMessage.degreesLatitude},${m.locationMessage.degreesLongitude} ${m.locationMessage.name || ''}`.trim()
  if (kind === 'contactMessage') text = m.contactMessage.displayName || ''
  if (!text && !media) return null // reactions, protocol messages, etc.
  return { text, media }
}

export function createWorkspace({ user, dir, oauth }) {
    // ---------------------------------------------------------------- storage
  const AUTH_DIR = path.join(dir, 'auth')
  const DOWNLOAD_DIR = path.join(dir, 'downloads')
  const log = (...a) => console.log(`[${user.username}]`, ...a)
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(path.join(dir, 'whatsapp.db'))
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS chats (jid TEXT PRIMARY KEY, alt_jid TEXT, name TEXT, is_group INTEGER, last_ts INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS contacts (jid TEXT PRIMARY KEY, alt_jid TEXT, name TEXT, notify TEXT);
    CREATE TABLE IF NOT EXISTS messages (
      chat_jid TEXT, id TEXT, from_jid TEXT, from_name TEXT, from_me INTEGER, ts INTEGER,
      text TEXT, media_type TEXT, raw TEXT, PRIMARY KEY (chat_jid, id));
    CREATE INDEX IF NOT EXISTS msg_chat_ts ON messages(chat_jid, ts);
    CREATE INDEX IF NOT EXISTS chat_alt ON chats(alt_jid);
    CREATE TABLE IF NOT EXISTS autoreplies (id TEXT PRIMARY KEY, chat_jid TEXT, ts INTEGER);
    CREATE TABLE IF NOT EXISTS memories (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, created INTEGER);
    CREATE TABLE IF NOT EXISTS summaries (chat_jid TEXT PRIMARY KEY, last_msg_id TEXT, since_ts INTEGER, summary TEXT,
      needs_reply INTEGER, priority TEXT, updated_ts INTEGER);
  `)
  // Things the owner asked the AI to remember ("Rahul is my accountant"). Used by ChatGPT, drafts and auto-replies.
  const memoryList = () => db.prepare('SELECT id, text, created FROM memories ORDER BY id').all()
  const memoryBlock = () => {
    const m = memoryList()
    return m.length ? m.map((r) => `- ${r.text}`).join('\n') : ''
  }

  const q = {
    upsertChat: db.prepare(`INSERT INTO chats (jid, alt_jid, name, is_group, last_ts) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(jid) DO UPDATE SET alt_jid = COALESCE(excluded.alt_jid, alt_jid), name = COALESCE(excluded.name, name),
      last_ts = MAX(last_ts, excluded.last_ts)`),
    upsertContact: db.prepare(`INSERT INTO contacts (jid, alt_jid, name, notify) VALUES (?, ?, ?, ?)
      ON CONFLICT(jid) DO UPDATE SET alt_jid = COALESCE(excluded.alt_jid, alt_jid), name = COALESCE(excluded.name, name),
      notify = COALESCE(excluded.notify, notify)`),
    upsertMsg: db.prepare(`INSERT OR REPLACE INTO messages (chat_jid, id, from_jid, from_name, from_me, ts, text, media_type, raw)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  }
  let me = null
  const ownerName = () => user.name || me?.name || null
  function storeMsg(msg) {
    const chat = msg.key?.remoteJid
    if (!chat || chat === 'status@broadcast' || chat.endsWith('@newsletter') || !msg.message) return
    const d = describe(msg.message)
    if (!d) return
    const group = !!isJidGroup(chat)
    const fromMe = !!msg.key.fromMe
    const from = fromMe ? me?.id : group ? msg.key.participantAlt || msg.key.participant : msg.key.remoteJidAlt || chat
    const ts = tsOf(msg.messageTimestamp)
    q.upsertMsg.run(chat, msg.key.id, from || null, fromMe ? 'Me' : msg.pushName || null, fromMe ? 1 : 0, ts, d.text, d.media,
      JSON.stringify({ key: msg.key, message: msg.message, messageTimestamp: msg.messageTimestamp }, BufferJSON.replacer))
    const alt = group ? null : msg.key.remoteJidAlt || null
    q.upsertChat.run(chat, alt, null, group ? 1 : 0, ts)
    if (!fromMe && msg.pushName && from) q.upsertContact.run(from, null, null, msg.pushName)
  }

  function storeChat(c) {
    if (!c?.id || c.id === 'status@broadcast') return
    q.upsertChat.run(c.id, c.pnJid || null, c.name || c.subject || null, isJidGroup(c.id) ? 1 : 0, tsOf(c.conversationTimestamp))
  }
  function storeContact(c) {
    if (!c?.id) return
    q.upsertContact.run(c.id, c.lid || c.phoneNumber || null, c.name || null, c.notify || c.verifiedName || null)
  }

  // Name for a jid, looking at chats + contacts under both the jid and its alternate (LID ↔ phone number).
  function nameOf(jid) {
    const row = db.prepare(`
      SELECT COALESCE(
        (SELECT name FROM chats WHERE (jid = ?1 OR alt_jid = ?1) AND name IS NOT NULL LIMIT 1),
        (SELECT COALESCE(name, notify) FROM contacts WHERE (jid = ?1 OR alt_jid = ?1) AND COALESCE(name, notify) IS NOT NULL LIMIT 1),
        (SELECT COALESCE(c.name, c.notify) FROM chats ch JOIN contacts c ON c.jid = ch.alt_jid OR c.alt_jid = ch.alt_jid
           WHERE ch.jid = ?1 AND COALESCE(c.name, c.notify) IS NOT NULL LIMIT 1)
      ) AS n`).get(jid)
    return row?.n || null
  }
  const label = (jid) => {
    const n = nameOf(jid)
    const num = isJidGroup(jid) ? 'group' : jid.endsWith('@lid') ? null : '+' + numberOf(jid)
    return [n, num].filter(Boolean).join(' · ') || jid
  }

  // All jids that refer to the same chat (a 1:1 chat can be stored under its LID and its phone number).
  function chatKeys(jid) {
    const keys = new Set([jid])
    for (const r of db.prepare('SELECT jid, alt_jid FROM chats WHERE jid = ? OR alt_jid = ?').all(jid, jid)) {
      keys.add(r.jid)
      if (r.alt_jid) keys.add(r.alt_jid)
    }
    return [...keys]
  }

  // "Priya", "+91 98765 43210", "919876543210", or a raw jid → jid
  function resolveChat(input) {
    const s = String(input).trim()
    if (s.includes('@')) return s
    const digits = s.replace(/[\s+\-()]/g, '')
    if (/^\d{8,15}$/.test(digits)) {
      const pn = `${digits}@s.whatsapp.net`
      const known = db.prepare('SELECT jid FROM chats WHERE alt_jid = ? ORDER BY last_ts DESC LIMIT 1').get(pn)
      return known?.jid || pn
    }
    const like = `%${s.toLowerCase()}%`
    const rows = db.prepare(`
      SELECT jid, name FROM (
        SELECT jid, name, last_ts FROM chats WHERE lower(name) LIKE ?1
        UNION SELECT ch.jid, COALESCE(c.name, c.notify), ch.last_ts FROM contacts c
          JOIN chats ch ON ch.jid = c.jid OR ch.alt_jid = c.jid OR ch.jid = c.alt_jid
          WHERE lower(COALESCE(c.name, c.notify, '')) LIKE ?1
        UNION SELECT jid, COALESCE(name, notify), 0 FROM contacts WHERE lower(COALESCE(name, notify, '')) LIKE ?1
      ) GROUP BY jid ORDER BY MAX(last_ts) DESC LIMIT 10`).all(like)
    if (!rows.length) throw new Error(`No chat or contact matches "${s}". Use a phone number with country code (e.g. 919876543210) or call whatsapp_list_chats.`)
    const exact = rows.filter((r) => r.name?.toLowerCase() === s.toLowerCase())
    if (exact.length === 1 || rows.length === 1) return (exact[0] || rows[0]).jid
    throw new Error(`"${s}" matches several chats — pass one of these jids instead:\n` + rows.map((r) => `- ${r.name} → ${r.jid}`).join('\n'))
  }

  const isForwarded = (r) => Boolean(r.fwd ?? r.raw?.includes('"isForwarded":true'))

  function fmtMsg(r, max = 4000) {
    const who = r.from_me ? 'Me' : r.from_name || (r.from_jid ? label(r.from_jid) : 'Unknown')
    const media = (r.media_type ? ` [${r.media_type}]` : '') + (isForwarded(r) ? ' [forwarded]' : '')
    let body = r.text || ''
    if (body.length > max) body = body.slice(0, max) + `… [${body.length - max} more chars]`
    let line = `[${fmtTime(r.ts)}] ${who}${media}: ${body}  (id: ${r.id})`
    if (r.media_type && READABLE.has(r.media_type)) {
      const t = attText(r.id)
      if (t) {
        const shown = (t.length > max ? t.slice(0, max) + '… [more: use whatsapp_read_attachment]' : t).replace(/\n/g, '\n      ')
        line += `\n    ↳ ${r.media_type === 'voice_note' || r.media_type === 'audio' ? 'transcript' : 'contents'}: ${shown}`
      } else line += '  (not opened yet: use whatsapp_read_attachment to read it)'
    }
    return line
  }

  // Fill in phone numbers for chats WhatsApp only gave us as hidden LIDs, so numbers resolve to the right chat.
  let lidTimer
  function backfillLids() {
    clearTimeout(lidTimer)
    lidTimer = setTimeout(async () => {
      const lids = db.prepare("SELECT jid FROM chats WHERE jid LIKE '%@lid' AND alt_jid IS NULL").all().map((r) => r.jid)
      if (!lids.length || !sock?.signalRepository?.lidMapping) return
      let n = 0
      for (let i = 0; i < lids.length; i += 100) {
        const pairs = await sock.signalRepository.lidMapping.getPNsForLIDs(lids.slice(i, i + 100)).catch(() => null)
        for (const { lid, pn } of pairs || []) {
          if (!pn) continue
          db.prepare('UPDATE chats SET alt_jid = ? WHERE jid = ?').run(jidNormalizedUser(pn), jidNormalizedUser(lid))
          n++
        }
      }
      if (n) log(`mapped ${n} hidden IDs to phone numbers`)
    }, 1500)
  }

  function loadRaw(chatJid, id) {
    const keys = chatKeys(chatJid)
    const row = db.prepare(`SELECT raw FROM messages WHERE id = ? AND chat_jid IN (${keys.map(() => '?').join(',')})`).get(id, ...keys)
      || db.prepare('SELECT raw FROM messages WHERE id = ?').get(id)
    if (!row) throw new Error(`Message ${id} not found. Use whatsapp_read_messages to get valid message ids.`)
    return JSON.parse(row.raw, BufferJSON.reviver)
  }

  // Download a message's attachment (cached on disk). Old media links expire, so ask the phone to re-upload once.
  const MEDIA_KINDS = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage']
  async function fetchMedia(chatJid, id) {
    const msg = loadRaw(chatJid, id)
    const mm = unwrap(msg.message)
    const k = MEDIA_KINDS.find((x) => mm?.[x])
    if (!k) throw new Error('That message has no attachment.')
    const kind = k === 'audioMessage' && mm[k].ptt ? 'voice_note' : k.replace('Message', '')
    const mime = (mm[k].mimetype || 'application/octet-stream').split(';')[0]
    const cacheDir = path.join(DOWNLOAD_DIR, 'cache')
    fs.mkdirSync(cacheDir, { recursive: true })
    const file = path.join(cacheDir, id.replace(/[^\w-]/g, '_'))
    let buf
    if (fs.existsSync(file)) buf = fs.readFileSync(file)
    else {
      const opts = { logger, reuploadRequest: requireSock().updateMediaMessage }
      try {
        buf = await downloadMediaMessage(msg, 'buffer', {}, opts)
      } catch {
        try {
          buf = await downloadMediaMessage(await requireSock().updateMediaMessage(msg), 'buffer', {}, opts)
        } catch {
          const e = new Error('This attachment is no longer available on WhatsApp servers (too old).')
          e.status = 410
          throw e
        }
      }
      fs.writeFileSync(file, buf)
    }
    return { kind, k, mime, buf, fileName: mm[k].fileName || null }
  }

  // ---------------------------------------------------------------- whatsapp
  // Linked accounts stay connected. Unlinked accounts only run a connection (and make QR codes) while their owner
  // has the dashboard open, so idle sign-ups don't use memory on the server.
  let sock = null
  let qrDataUrl = null
  let status = 'idle'
  let running = false
  let lastSeen = 0
  const IDLE_MS = 3 * 60_000

  const isLinked = () => {
    try { return Boolean(JSON.parse(fs.readFileSync(path.join(AUTH_DIR, 'creds.json'), 'utf8')).me) } catch { return false }
  }

  function start() {
    if (running || NO_CONNECT || DEMO) return
    running = true
    status = 'starting'
    connect().catch((e) => {
      log('could not start WhatsApp:', e.message)
      running = false
      status = 'error'
    })
  }

  function stop(nextStatus = 'idle') {
    running = false
    const s = sock
    sock = null
    qrDataUrl = null
    status = nextStatus
    try { s?.end(undefined) } catch {}
  }

  // Called whenever the owner looks at their dashboard: starts the connection so a QR code can be shown.
  function touch() {
    lastSeen = Date.now()
    if (!running && status !== 'connected') start()
  }
  const idleTimer = setInterval(() => {
    if (running && status !== 'connected' && !isLinked() && Date.now() - lastSeen > IDLE_MS) {
      log('no one is looking at the QR code, pausing until the dashboard is opened again')
      stop('idle')
    }
  }, 30_000)
  idleTimer.unref()

  async function connect() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
    const { version } = await fetchLatestBaileysVersion()
    if (!running) return
    const s = makeWASocket({
      version,
      auth: state,
      logger,
      browser: ['Wavelink', 'Chrome', '1.0'],
      syncFullHistory: true,
      markOnlineOnConnect: false, // don't stop the phone from getting notifications
    })
    sock = s
    s.ev.on('creds.update', saveCreds)

    s.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (sock !== s) return // an old connection that was replaced or stopped
      if (qr) {
        qrDataUrl = await QRCode.toDataURL(qr, { width: 360, margin: 2 })
        status = 'waiting_for_scan'
      }
      if (connection === 'open') {
        me = s.user
        status = 'connected'
        qrDataUrl = null
        log(`✅ WhatsApp connected as +${numberOf(me.id)}`)
        try {
          const groups = await s.groupFetchAllParticipating()
          for (const g of Object.values(groups)) q.upsertChat.run(g.id, null, g.subject, 1, 0)
        } catch {}
        backfillLids()
        migrateAutoReplyLists()
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode
        if (code === DisconnectReason.loggedOut) {
          // unlinked from the phone (or the dashboard): forget the session so the next visit shows a fresh QR
          log('logged out of WhatsApp')
          me = null
          fs.rmSync(AUTH_DIR, { recursive: true, force: true })
          stop('logged_out')
          return
        }
        if (!running) return
        if (!isLinked() && code === DisconnectReason.timedOut) {
          stop('qr_expired') // QR codes ran out; starts again when the owner opens the dashboard
          return
        }
        status = 'reconnecting'
        log('connection closed:', code ?? '', lastDisconnect?.error?.message ?? '')
        setTimeout(() => { if (running && sock === s) connect().catch((e) => log('reconnect failed:', e.message)) }, 2000)
      }
    })

    const ev = s.ev
    ev.on('messaging-history.set', ({ chats = [], contacts = [], messages = [] }) => {
      chats.forEach(storeChat)
      contacts.forEach(storeContact)
      messages.forEach(storeMsg)
      log(`history sync: +${chats.length} chats, +${messages.length} messages`)
      backfillLids()
    })
    ev.on('lid-mapping.update', ({ lid, pn }) => {
      if (lid && pn) db.prepare('UPDATE chats SET alt_jid = ? WHERE jid = ? AND alt_jid IS NULL').run(jidNormalizedUser(pn), jidNormalizedUser(lid))
    })
    ev.on('messages.upsert', ({ messages, type }) => {
      messages.forEach(storeMsg)
      if (type !== 'notify') return
      // transcribe new voice notes right away so briefs, search and ChatGPT can use what was said
      for (const msg of messages) {
        const d = msg.message && describe(msg.message)
        const chat = msg.key?.remoteJid
        if (gemini && chat && chat !== 'status@broadcast' && !msg.key.fromMe && (d?.media === 'voice_note' || d?.media === 'audio')) attachments.enqueue(chat, msg.key.id)
      }
      messages.forEach(maybeAutoReply)
    })
    ev.on('chats.upsert', (c) => c.forEach(storeChat))
    ev.on('chats.update', (c) => c.forEach((x) => x.name && storeChat(x)))
    ev.on('contacts.upsert', (c) => c.forEach(storeContact))
    ev.on('contacts.update', (c) => c.forEach(storeContact))
    ev.on('groups.update', (g) => g.forEach((x) => x.subject && q.upsertChat.run(x.id, null, x.subject, 1, 0)))
  }

  function requireSock() {
    if (status !== 'connected') throw new Error(`WhatsApp is not connected (status: ${status}). Open the dashboard, sign in and scan the QR code to link WhatsApp.`)
    return sock
  }

  async function sendAndStore(jid, content, opts) {
    const sent = await requireSock().sendMessage(jid, content, opts)
    if (sent) storeMsg(sent)
    return sent
  }

  // Forward stored messages (up to 30) to up to 5 chats as real WhatsApp forwards ("Forwarded" label; photos, voice notes
  // and files go along without re-uploading). Messages go out in their original order. Like WhatsApp itself,
  // view-once messages can't be forwarded.
  const FORWARD_MAX = 5
  const FORWARD_MAX_MESSAGES = 30
  const JID_RE = /^[\w.-]+@(s\.whatsapp\.net|g\.us|lid)$/
  const pause = (ms) => new Promise((r) => setTimeout(r, ms))
  async function forwardMessages(fromChat, messageIds, targets) {
    const to = [...new Set(targets.map(String))]
    const ids = [...new Set(messageIds.map(String))]
    if (!to.length) throw new Error('Pick at least one chat to forward to.')
    if (to.length > FORWARD_MAX) throw new Error(`WhatsApp allows forwarding to at most ${FORWARD_MAX} chats at once.`)
    if (!ids.length) throw new Error('Pick at least one message to forward.')
    if (ids.length > FORWARD_MAX_MESSAGES) throw new Error(`You can forward at most ${FORWARD_MAX_MESSAGES} messages at once.`)
    const bad = to.find((j) => !JID_RE.test(j))
    if (bad) throw new Error(`Not a WhatsApp chat: ${bad}`)
    // check every message before sending anything, then send oldest first
    const msgs = ids.map((id) => {
      const msg = loadRaw(fromChat, id)
      const m = msg?.message
      if (!m || m.viewOnceMessage || m.viewOnceMessageV2 || m.viewOnceMessageV2Extension) throw new Error(`Message ${id} can't be forwarded (view-once or empty).`)
      if (!describe(m)) throw new Error(`Message ${id} is a kind of message that can't be forwarded.`)
      return { id, msg, ts: tsOf(msg.messageTimestamp) }
    }).sort((a, b) => a.ts - b.ts)
    requireSock()
    const results = []
    for (const jid of to) {
      let sent = 0
      let error = null
      for (const { msg } of msgs) {
        try {
          await sendAndStore(jid, { forward: msg })
          sent++
          if (msgs.length > 1) await pause(350) // a gentle pace, like a person forwarding
        } catch (e) {
          error = e.message
          break // keep the order intact: don't skip ahead in this chat
        }
      }
      results.push({ to: jid, name: nameOf(jid) || label(jid), ok: sent === msgs.length, sent, total: msgs.length, ...(error ? { error } : {}) })
    }
    log(`↪ forwarded ${msgs.length} message(s) to ${results.filter((r) => r.ok).length}/${to.length} chat(s)`)
    return results
  }

  // ---------------------------------------------------------------- auto-reply (Gemini replies as you)
  // Settings live in autoreply.json and are re-read on every message, so edits apply without a restart.
  //   mode: "off" | "allowlist" (only `allow`) | "all" (every 1:1 chat except `exclude`). Groups are never auto-replied.
  //   allow / exclude: phone numbers (with country code), jids, or exact contact names.
  const AR_FILE = path.join(dir, 'autoreply.json')
  const AR_DEFAULTS = { mode: 'off', allow: [], exclude: [], pauseMinutes: 10, waitSeconds: 8 }
  const arSettings = () => {
    try { return { ...AR_DEFAULTS, ...JSON.parse(fs.readFileSync(AR_FILE, 'utf8')) } } catch { return { ...AR_DEFAULTS } }
  }
  const saveAr = (s) => fs.writeFileSync(AR_FILE, JSON.stringify(s, null, 2))

  const attachments = createAttachments({ db, gemini, model: GEMINI_MODEL, fetchMedia })
  const attText = (id) => attachments.cached(id)?.text || null
  // summaries made before attachments were readable missed voice notes; rebuild them once
  if (db.prepare('PRAGMA user_version').get().user_version < 2) {
    db.exec('DELETE FROM summaries; PRAGMA user_version = 2')
  }
  const READABLE = new Set(['voice_note', 'audio', 'image', 'video', 'document', 'sticker'])

  function matchesList(list, chatJid) {
    const keys = chatKeys(chatJid)
    const nums = keys.map(numberOf)
    const name = (nameOf(chatJid) || '').toLowerCase()
    return list.some((e) => {
      const s = String(e).trim()
      const d = s.replace(/[\s+\-()]/g, '')
      return keys.includes(s) || (/^\d{8,15}$/.test(d) && nums.includes(d)) || (name && s.toLowerCase() === name)
    })
  }

  // Per-chat switch from the dashboard ("on" / "off") wins over the global mode.
  function chatOverride(chat, s = arSettings()) {
    for (const k of chatKeys(chat)) if (s.chats?.[k]) return s.chats[k]
    return null
  }
  // off = master switch, nothing is sent. allowlist = only chats switched on. all = every 1:1 chat except ones switched off.
  function autoReplyEnabledFor(chat, s = arSettings()) {
    if (!gemini || isJidGroup(chat) || s.mode === 'off') return false
    const o = chatOverride(chat, s)
    if (s.mode === 'allowlist') return o === 'on' || matchesList(s.allow, chat)
    if (s.mode === 'all') return o !== 'off' && !matchesList(s.exclude, chat)
    return false
  }

  // Older settings listed numbers in allow/exclude; turn those into per-chat switches the dashboard can show.
  function migrateAutoReplyLists() {
    const s = arSettings()
    let changed = false
    for (const [list, mode] of [['allow', 'on'], ['exclude', 'off']]) {
      s[list] = (s[list] || []).filter((entry) => {
        try {
          const jid = resolveChat(entry)
          s.chats = { ...(s.chats || {}), [jid]: mode }
          changed = true
          return false
        } catch { return true } // keep entries we can't resolve yet
      })
    }
    if (changed) saveAr(s)
  }

  const arTimers = new Map()
  function maybeAutoReply(msg) {
    const chat = msg.key?.remoteJid
    if (!chat || msg.key.fromMe || isJidGroup(chat) || !chat.match(/@(s\.whatsapp\.net|lid)$/)) return
    if (tsOf(msg.messageTimestamp) < Date.now() / 1000 - 120) return // old backlog after a reconnect
    if (!describe(msg.message)) return
    const s = arSettings()
    if (!autoReplyEnabledFor(chat, s)) return
    // people send bursts ("bhai" / "ek kaam tha" / ...) — wait for them to finish, then answer once
    clearTimeout(arTimers.get(chat))
    arTimers.set(chat, setTimeout(() => autoReply(chat, s).catch((e) => log('auto-reply error:', e.message)), s.waitSeconds * 1000))
  }

  async function autoReply(chat, s) {
    arTimers.delete(chat)
    const keys = chatKeys(chat)
    const inKeys = `chat_jid IN (${keys.map(() => '?').join(',')})`
    const now = Date.now() / 1000
    // you're active in this chat yourself → stay out of it
    const lastMine = db.prepare(`SELECT MAX(ts) t FROM messages WHERE ${inKeys} AND from_me = 1`).get(...keys).t || 0
    const lastTheirs = db.prepare(`SELECT MAX(ts) t FROM messages WHERE ${inKeys} AND from_me = 0`).get(...keys).t || 0
    if (lastMine >= lastTheirs) return // already answered (by you or by a previous auto-reply)
    const myLastManual = db.prepare(`SELECT MAX(ts) t FROM messages WHERE ${inKeys} AND from_me = 1 AND id NOT IN (SELECT id FROM autoreplies)`).get(...keys).t || 0
    if (myLastManual > now - s.pauseMinutes * 60) {
      log(`⏸  skipped ${label(chat)} — you replied there in the last ${s.pauseMinutes} min`)
      return
    }

    const reply = await generateReply(chat, lastMine)
    if (!reply) return
    // they may have replied by hand while Gemini was thinking
    const mineNow = db.prepare(`SELECT MAX(ts) t FROM messages WHERE ${inKeys} AND from_me = 1`).get(...keys).t || 0
    if (mineNow > lastMine) return
    const sent = await sendAndStore(chat, { text: reply })
    if (sent?.key?.id) db.prepare('INSERT OR IGNORE INTO autoreplies (id, chat_jid, ts) VALUES (?, ?, ?)').run(sent.key.id, chat, Math.floor(Date.now() / 1000))
    log(`🤖 auto-replied to ${label(chat)}: ${reply.slice(0, 100)}`)
  }

  // Writes a reply as the owner from the last 25 messages. Media sent after `mediaSince` is attached so Gemini can hear/see it.
  async function generateReply(chat, mediaSince = 0, guidance = '') {
    if (!gemini) throw new Error('GEMINI_API_KEY is not set')
    const keys = chatKeys(chat)
    const inKeys = `chat_jid IN (${keys.map(() => '?').join(',')})`
    const rows = db.prepare(`SELECT * FROM messages WHERE ${inKeys} ORDER BY ts DESC LIMIT 25`).all(...keys).reverse()
    const lastMine = mediaSince
    const contents = []
    for (const r of rows) {
      const role = r.from_me ? 'model' : 'user'
      const known = r.media_type ? attText(r.id) : null
      const parts = [{ text: `${r.media_type ? `[${r.media_type}] ` : ''}${r.text || ''}${known ? `\n(${r.media_type} contents: ${known.slice(0, 3000)})` : ''}`.trim() || '(empty)' }]
      // attach voice notes / images from the unanswered part of the conversation so Gemini can hear/see them
      if (!known && !r.from_me && r.ts > lastMine && ['voice_note', 'audio', 'image'].includes(r.media_type)) {
        try {
          const raw = JSON.parse(r.raw, BufferJSON.reviver)
          const m = unwrap(raw.message)
          const k = m.audioMessage ? 'audioMessage' : 'imageMessage'
          const buf = await downloadMediaMessage(raw, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage })
          parts.push({ inlineData: { mimeType: (m[k].mimetype || 'audio/ogg').split(';')[0], data: buf.toString('base64') } })
        } catch {}
      }
      const prev = contents.at(-1)
      if (prev?.role === role) prev.parts.push(...parts)
      else contents.push({ role, parts })
    }
    if (contents[0]?.role === 'model') contents.unshift({ role: 'user', parts: [{ text: '(earlier conversation)' }] })
    // Gemini needs the last turn to be theirs; if I spoke last, ask for a natural follow-up instead
    if (contents.at(-1)?.role === 'model') contents.push({ role: 'user', parts: [{ text: '(No new message from them yet. Write a short, natural follow-up from me.)' }] })
    if (guidance?.trim()) contents.at(-1).parts.push({ text: `(Note from me, not from them — what my reply should say: ${guidance.trim()})` })

    const owner = ownerName() || 'the owner of this WhatsApp'
    const systemInstruction = `You are replying on WhatsApp on behalf of ${owner}, in first person, as if you were them.
  The contact is: ${nameOf(chat) || 'unknown'}.
  Match ${owner}'s own style from their earlier messages in this chat (the "model" turns): same language mix (Hindi / Hinglish / English), same tone, short WhatsApp-length replies, no markdown.
  Hard rules:
  - Never invent facts, prices, quotes, dates, meeting times, promises, addresses, money matters or personal details. If the message needs any of that, say you'll check and get back soon (e.g. "Main check karke batata hoon").
  - Don't agree to anything on ${owner}'s behalf beyond simple pleasantries.
  - If someone directly and sincerely asks whether this is a bot/AI, be honest that it's an auto-reply assistant and ${owner} will reply personally.
  - Reply only with the message text to send.${arSettings().instructions?.trim() ? `\n\nInstructions from ${owner} (follow these, but the hard rules above still win):\n${arSettings().instructions.trim()}` : ''}${memoryBlock() ? `\n\nThings ${owner} asked you to remember:\n${memoryBlock()}` : ''}`

    const res = await gemini.models.generateContent({ model: GEMINI_MODEL, contents, config: { systemInstruction } })
    return res.text?.trim() || ''
  }

  // ---------------------------------------------------------------- AI summaries (cached per chat until a new message arrives)
  const summarizing = new Map()
  async function summarizeChat(chat, sinceTs) {
    const keys = chatKeys(chat)
    const inKeys = `chat_jid IN (${keys.map(() => '?').join(',')})`
    const last = db.prepare(`SELECT id FROM messages WHERE ${inKeys} ORDER BY ts DESC LIMIT 1`).get(...keys)
    if (!last) return null
    const cached = db.prepare('SELECT * FROM summaries WHERE chat_jid = ?').get(chat)
    if (cached?.last_msg_id === last.id && cached.since_ts <= sinceTs) return cached
    if (summarizing.has(chat)) return summarizing.get(chat)
    const job = (async () => {
      const rows = db.prepare(`SELECT * FROM messages WHERE ${inKeys} AND ts >= ? ORDER BY ts DESC LIMIT 60`).all(...keys, sinceTs).reverse()
      const context = db.prepare(`SELECT * FROM messages WHERE ${inKeys} AND ts < ? ORDER BY ts DESC LIMIT 6`).all(...keys, sinceTs).reverse()
      // make sure recent voice notes are transcribed so the summary covers what was said (max 5 per chat)
      const unheard = rows.filter((r) => !r.from_me && (r.media_type === 'voice_note' || r.media_type === 'audio') && !attText(r.id)).slice(-5)
      await Promise.all(unheard.map((r) => attachments.read(r.chat_jid, r.id).catch(() => null)))
      const fmt = (r) => {
        const t = r.media_type ? attText(r.id) : null
        return `${r.from_me ? 'Me' : r.from_name || 'Them'}: ${r.media_type ? `[${r.media_type}] ` : ''}${(r.text || '').slice(0, 500)}${t ? ` (${r.media_type} contents: ${t.slice(0, 800).replace(/\n/g, ' ')})` : ''}`
      }
      const owner = ownerName() || 'the owner'
      const prompt = `You summarise a WhatsApp ${isJidGroup(chat) ? 'group' : 'chat'} with "${nameOf(chat) || 'unknown'}" for ${owner} ("Me").
  Earlier context:\n${context.map(fmt).join('\n') || '(none)'}\n\nNew messages:\n${rows.map(fmt).join('\n')}

  Return JSON: summary = 1–2 short sentences in English on what they said/want (concrete: amounts, dates, asks), needs_reply = true if ${owner} still owes a reply or action, priority = "high" (money, deadlines, clients, urgent asks), "normal" or "low" (greetings, forwards, memes).`
      const res = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: { summary: { type: 'string' }, needs_reply: { type: 'boolean' }, priority: { type: 'string', enum: ['high', 'normal', 'low'] } },
            required: ['summary', 'needs_reply', 'priority'],
          },
        },
      })
      const j = JSON.parse(res.text)
      const row = { chat_jid: chat, last_msg_id: last.id, since_ts: sinceTs, summary: j.summary, needs_reply: j.needs_reply ? 1 : 0, priority: j.priority, updated_ts: Math.floor(Date.now() / 1000) }
      db.prepare(`INSERT OR REPLACE INTO summaries (chat_jid, last_msg_id, since_ts, summary, needs_reply, priority, updated_ts)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(...Object.values(row))
      return row
    })().finally(() => summarizing.delete(chat))
    summarizing.set(chat, job)
    return job
  }

  // One short briefing across all chats, built from the per-chat summaries. Cached until those summaries change.
  const briefCache = new Map()
  async function dailyBrief(sinceTs, hours) {
    if (!gemini) return DEMO ? { text: DEMO_BRIEF, items: digestCount(sinceTs), generatedAt: Date.now() / 1000 } : { text: null, items: 0 }
    const items = (await digest(sinceTs)).filter((i) => i.summary && !i.summary.startsWith('(summary failed'))
    if (!items.length) return { text: 'No new messages in this period.', items: 0, generatedAt: Date.now() / 1000 }
    const sig = `${hours}|` + items.map((i) => `${i.jid}:${i.lastTs}`).join(',')
    if (briefCache.get(hours)?.sig === sig) return briefCache.get(hours).value
    const owner = ownerName() || 'the owner'
    const lines = items.map((i) => `- ${i.name}${i.isGroup ? ' (group)' : ''} [${i.priority || 'normal'}${i.needsReply ? ', needs reply' : ''}]: ${i.summary}`).join('\n')
    const res = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: `Here are summaries of ${owner}'s WhatsApp chats from the last ${hours} hours:\n${lines}\n\nWrite ${owner} a briefing in 2–3 short sentences, addressed to them as "you": lead with what needs their attention (who is waiting, money, deadlines, clients), then a quick note on the rest. Plain text, no lists, no markdown, use names.` }] }],
    })
    const value = { text: res.text?.trim() || null, items: items.length, generatedAt: Date.now() / 1000 }
    briefCache.set(hours, { sig, value })
    return value
  }

  const digestCount = (sinceTs) => db.prepare('SELECT COUNT(DISTINCT chat_jid) n FROM messages WHERE from_me = 0 AND ts >= ?').get(sinceTs).n

  // Chats with incoming messages since `sinceTs`, newest first, with cached or fresh summaries.
  async function digest(sinceTs, { limit = 25, generate = true } = {}) {
    const chats = db.prepare(`
      SELECT COALESCE(c.jid, m.chat_jid) jid, MAX(m.ts) last_ts, COUNT(*) n
      FROM messages m LEFT JOIN chats c ON c.alt_jid = m.chat_jid
      WHERE m.from_me = 0 AND m.ts >= ? GROUP BY 1 ORDER BY last_ts DESC LIMIT ?`).all(sinceTs, limit)
    const out = []
    // 4 at a time to stay friendly with API rate limits
    for (let i = 0; i < chats.length; i += 4) {
      const batch = await Promise.all(chats.slice(i, i + 4).map(async (c) => {
        let s = null
        if (generate && gemini) s = await summarizeChat(c.jid, sinceTs).catch((e) => ({ summary: `(summary failed: ${e.message.slice(0, 80)})` }))
        else s = db.prepare('SELECT * FROM summaries WHERE chat_jid = ?').get(c.jid)
        return { jid: c.jid, name: nameOf(c.jid) || label(c.jid), isGroup: !!isJidGroup(c.jid), lastTs: c.last_ts, incoming: c.n,
          summary: s?.summary || null, needsReply: !!s?.needs_reply, priority: s?.priority || null }
      }))
      out.push(...batch)
    }
    const rank = { high: 0, normal: 1, low: 2 }
    return out.sort((a, b) => (b.needsReply - a.needsReply) || ((rank[a.priority] ?? 1) - (rank[b.priority] ?? 1)) || b.lastTs - a.lastTs)
  }

  const EXT_MIME = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    mp4: 'video/mp4', mov: 'video/quicktime', mp3: 'audio/mpeg', ogg: 'audio/ogg', m4a: 'audio/mp4', wav: 'audio/wav',
    pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', json: 'application/json', zip: 'application/zip',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  }
  const MIME_EXT = Object.fromEntries(Object.entries(EXT_MIME).map(([e, m]) => [m, e]))
  // attachment types that are safe to show inside the browser (no scripts possible); SVG and HTML are deliberately not here
  const INLINE_SAFE = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/3gpp', 'video/webm', 'video/quicktime',
    'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/webm', 'audio/amr', 'application/pdf'])

  // ---------------------------------------------------------------- MCP tools
  const text = (t) => ({ content: [{ type: 'text', text: t }] })
  const fail = (e) => ({ content: [{ type: 'text', text: `Error: ${e.message || e}` }], isError: true })
  const safe = (fn) => async (args) => { try { return await fn(args) } catch (e) { return fail(e) } }
  const READ = { readOnlyHint: true, openWorldHint: true }
  const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: true }

  function serverInstructions(opts = {}) {
    const owner = ownerName() || 'the user'
    const mem = memoryBlock()
    return `You are connected to ${owner}'s personal WhatsApp${me ? ` (+${numberOf(me.id)})` : ''}.
  - For "what did I miss", "catch me up" or "summarise my WhatsApp", call whatsapp_brief. For "who is waiting on me", call whatsapp_waiting.
  - To answer about a person, find the chat with whatsapp_list_chats or whatsapp_search_contacts, then whatsapp_read_messages.
  - Messages marked [voice_note], [audio], [image], [video], [document] or [sticker] have attachments. If a transcript/contents line is shown, use it; otherwise call whatsapp_read_attachment to hear, see or read it. Never say you can't open attachments.
  - Before sending, replying or forwarding (whatsapp_forward_message), show ${owner} the exact text or message and the recipients. whatsapp_draft_reply writes a reply in their own style without sending it.
  ${opts.route ? `- ${owner} is the organisation's superadmin and can also read the other WhatsApp accounts. Call whatsapp_accounts to see them, then pass account to the read tools (whatsapp_brief, whatsapp_waiting, whatsapp_list_chats, whatsapp_read_messages, whatsapp_search_messages, whatsapp_read_attachment, whatsapp_status). Without account, tools use ${owner}'s own WhatsApp. Other accounts are read-only: never offer to send from them.\n` : ''}- When ${owner} tells you a lasting fact or preference (who someone is, how to reply to certain people), save it with whatsapp_remember. ChatGPT's own memory may not be available in this connector, so this is how you remember across chats.
  ${mem ? `\nWhat ${owner} asked you to remember:\n${mem}` : ''}`
  }

  // opts.route(account) → another account's workspace (superadmin only). Read-only tools then take an optional
  // `account` and run in that workspace; tools that send or change things never do.
  function buildServer(opts = {}) {
    const server = new McpServer({ name: 'wavelink', version: '1.0.0' }, { instructions: serverInstructions(opts) })
    const handlers = {}
    const ACCOUNT = z.string().optional().describe('Another account in your organisation (username, name or WhatsApp number from whatsapp_accounts). Leave empty for your own WhatsApp.')
    const reg = (name, def, fn) => {
      handlers[name] = fn
      if (!opts.route) return server.registerTool(name, def, fn)
      if (def.annotations?.readOnlyHint !== true) {
        // sending / changing tools: accept `account` only to refuse it, so a request to send from another account never
        // quietly goes out from the superadmin's own number
        return server.registerTool(name, { ...def, inputSchema: { ...def.inputSchema, account: z.string().optional().describe('Only your own WhatsApp can send. Leave empty.') } },
          async (args = {}, extra) => {
            const { account, ...rest } = args
            if (account?.trim() && !opts.isSelf(account)) return fail(new Error("You can only read other accounts. Sending and changes work only from your own WhatsApp."))
            return fn(rest, extra)
          })
      }
      server.registerTool(name, { ...def, inputSchema: { ...def.inputSchema, account: ACCOUNT } }, async (args = {}, extra) => {
        const { account, ...rest } = args
        if (!account?.trim()) return fn(rest, extra)
        try {
          const target = opts.route(account)
          const out = await target.callTool(name, rest)
          const who = target.user.name ? `${target.user.name} (@${target.user.username})` : `@${target.user.username}`
          if (out?.content?.[0]?.type === 'text') out.content[0].text = `[Account: ${who}, read-only]\n${out.content[0].text}`
          return out
        } catch (e) {
          return fail(e)
        }
      })
    }
    server._handlers = handlers

    reg('whatsapp_brief', {
      title: 'Brief me on WhatsApp',
      description: 'Catch up on WhatsApp: an AI briefing of the last N hours plus a one-line summary per chat with new messages, marked by priority and whether a reply is owed. Use for "what did I miss", "summarise my WhatsApp", "anything important today?".',
      inputSchema: { hours: z.number().int().min(1).max(168).default(24).describe('How far back to look') },
      annotations: READ,
    }, safe(async ({ hours = 24 }) => {
      const since = Math.floor(Date.now() / 1000) - hours * 3600
      const [b, items] = await Promise.all([dailyBrief(since, hours), digest(since)])
      if (!items.length) return text(`No new WhatsApp messages in the last ${hours} hours.`)
      const line = (i) => `- ${i.name}${i.isGroup ? ' (group)' : ''} [${i.priority || 'normal'}${i.needsReply ? ', NEEDS REPLY' : ''}] ${i.summary || `${i.incoming} new messages`}  (jid: ${i.jid})`
      return text(`Brief (last ${hours}h): ${b.text || ''}\n\nPer chat:\n${items.map(line).join('\n')}`)
    }))

    reg('whatsapp_waiting', {
      title: 'Who is waiting on my reply',
      description: 'List people (not groups) whose last message has not been answered yet, newest first, with how many messages are waiting and the last one.',
      inputSchema: { days: z.number().int().min(1).max(30).default(7) },
      annotations: READ,
    }, safe(async ({ days = 7 }) => {
      const since = Math.floor(Date.now() / 1000) - days * 86400
      const rows = listChats({ limit: 2000 }).filter((c) => !c.isGroup && c.pending > 0 && !c.last.fromMe && c.lastTs >= since)
      if (!rows.length) return text(`Nobody is waiting on a reply from the last ${days} days.`)
      return text(rows.slice(0, 40).map((c) => `- ${c.name || '+' + c.number} — ${c.pending} waiting, last ${fmtTime(c.lastTs)}: "${c.last.text || c.last.media || ''}"  (jid: ${c.jid})`).join('\n'))
    }))

    reg('whatsapp_draft_reply', {
      title: 'Draft a reply (does not send)',
      description: 'Write a reply to a chat in the owner\'s own style (language mix, tone) based on the recent conversation, their instructions and saved memories. Nothing is sent: show the draft, then use whatsapp_send_message or whatsapp_reply if they approve.',
      inputSchema: { chat: z.string().describe('Name, phone number or jid'), guidance: z.string().optional().describe('What the reply should say, e.g. "say yes but after 5pm"') },
      annotations: READ,
    }, safe(async ({ chat, guidance }) => {
      const jid = resolveChat(chat)
      let draft = null
      if (gemini) draft = await generateReply(jid, Number.MAX_SAFE_INTEGER, guidance).catch((e) => { log('draft failed, handing the conversation to the AI app:', e.message); return null })
      if (draft) return text(`Draft for ${label(jid)} (not sent):\n\n${draft}`)
      // No drafting AI on this server (or it failed): give the AI app what it needs to write the draft itself.
      const keys = chatKeys(jid)
      const rows = db.prepare(`SELECT * FROM messages WHERE chat_jid IN (${keys.map(() => '?').join(',')}) ORDER BY ts DESC LIMIT 15`).all(...keys).reverse()
      const owner = ownerName() || 'the owner'
      const mem = memoryBlock()
      return text(`Write the draft for ${label(jid)} yourself from the conversation below, as ${owner}, in first person.
Match ${owner}'s own style from their earlier messages (language mix, tone, length), keep it WhatsApp-short, no markdown, and don't invent facts, amounts or dates.${guidance?.trim() ? `\nWhat the reply should say: ${guidance.trim()}` : ''}${mem ? `\n\nWhat ${owner} asked to remember:\n${mem}` : ''}

Recent messages:
${rows.map((r) => fmtMsg(r, 800)).join('\n') || '(none)'}

Show the draft and say it has not been sent. Send only after ${owner} approves.`)
    }))

    reg('whatsapp_remember', {
      title: 'Remember something',
      description: 'Save a lasting fact or preference so it is used in future WhatsApp requests, drafts and auto-replies (e.g. "Rahul is my accountant", "reply to clients in formal English"). Use this instead of relying on chat memory.',
      inputSchema: { note: z.string().min(3).max(500) },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    }, safe(async ({ note }) => {
      if (db.prepare('SELECT COUNT(*) n FROM memories').get().n >= 200) throw new Error('Memory is full (200 notes). Remove some first.')
      const r = db.prepare('INSERT INTO memories (text, created) VALUES (?, ?)').run(note.trim(), Math.floor(Date.now() / 1000))
      return text(`Saved (#${r.lastInsertRowid}): ${note.trim()}`)
    }))

    reg('whatsapp_memories', {
      title: 'What do you remember?',
      description: 'List the saved notes and preferences, with their ids.',
      inputSchema: {}, annotations: { readOnlyHint: true, openWorldHint: false },
    }, safe(async () => {
      const m = memoryList()
      return text(m.length ? m.map((r) => `#${r.id}: ${r.text}`).join('\n') : 'Nothing saved yet.')
    }))

    reg('whatsapp_forget', {
      title: 'Forget a saved note',
      description: 'Delete a saved note by its id (from whatsapp_memories).',
      inputSchema: { id: z.number().int() },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    }, safe(async ({ id }) => {
      const r = db.prepare('DELETE FROM memories WHERE id = ?').run(id)
      return text(r.changes ? `Forgot note #${id}.` : `No note #${id}.`)
    }))

    reg('whatsapp_status', {
      title: 'WhatsApp connection status',
      description: 'Check whether WhatsApp is connected, which number it is linked to, and how many chats/messages are stored.',
      inputSchema: {}, annotations: READ,
    }, safe(async () => {
      const c = db.prepare('SELECT COUNT(*) n FROM chats').get().n
      const m = db.prepare('SELECT COUNT(*) n FROM messages').get().n
      return text(`status: ${status}\nnumber: ${me ? '+' + numberOf(me.id) : '-'}\nchats: ${c}\nmessages stored: ${m}`)
    }))

    reg('whatsapp_list_chats', {
      title: 'List WhatsApp chats',
      description: 'List recent WhatsApp chats (people and groups), newest first, with the last message. Optionally filter by name or number.',
      inputSchema: {
        query: z.string().optional().describe('Filter by contact/group name or phone number'),
        limit: z.number().int().min(1).max(100).default(20),
      },
      annotations: READ,
    }, safe(async ({ query, limit = 20 }) => {
      let rows = db.prepare('SELECT jid, is_group, last_ts FROM chats ORDER BY last_ts DESC LIMIT 2000').all()
      if (query) {
        const ql = query.toLowerCase().replace(/[\s+]/g, '')
        rows = rows.filter((r) => label(r.jid).toLowerCase().replace(/[\s+]/g, '').includes(ql) || r.jid.includes(ql))
      }
      rows = rows.slice(0, limit)
      if (!rows.length) return text('No chats found.')
      return text(rows.map((r) => {
        const keys = chatKeys(r.jid)
        const last = db.prepare(`SELECT * FROM messages WHERE chat_jid IN (${keys.map(() => '?').join(',')}) ORDER BY ts DESC LIMIT 1`).get(...keys)
        const preview = last ? `${last.from_me ? 'Me: ' : ''}${last.media_type ? `[${last.media_type}] ` : ''}${(last.text || '').slice(0, 80)}` : ''
        return `• ${label(r.jid)}  — jid: ${r.jid}${r.last_ts ? `  — ${fmtTime(r.last_ts)}` : ''}\n  ${preview}`
      }).join('\n'))
    }))

    reg('whatsapp_read_messages', {
      title: 'Read WhatsApp messages',
      description: 'Read messages from one chat, oldest to newest. "chat" can be a contact/group name, a phone number with country code, or a jid. Each message shows its id (needed for replying). Voice notes, photos and files show their transcript/contents when already read; otherwise use whatsapp_read_attachment.',
      inputSchema: {
        chat: z.string().describe('Name, phone number (e.g. 919876543210) or jid'),
        limit: z.number().int().min(1).max(200).default(30),
        before: z.string().optional().describe('Only messages before this ISO date/time, for paging back'),
      },
      annotations: READ,
    }, safe(async ({ chat, limit = 30, before }) => {
      const jid = resolveChat(chat)
      const keys = chatKeys(jid)
      const beforeTs = before ? Math.floor(new Date(before).getTime() / 1000) : 2 ** 31
      const rows = db.prepare(`SELECT * FROM messages WHERE chat_jid IN (${keys.map(() => '?').join(',')}) AND ts < ? ORDER BY ts DESC LIMIT ?`)
        .all(...keys, beforeTs, limit).reverse()
      if (!rows.length) return text(`No stored messages with ${label(jid)} (jid ${jid}). Only messages synced since linking are available.`)
      return text(`Chat: ${label(jid)} (jid: ${jid})\n\n` + rows.map((r) => fmtMsg(r)).join('\n'))
    }))

    reg('whatsapp_search_messages', {
      title: 'Search WhatsApp messages',
      description: 'Full-text search across stored WhatsApp messages (optionally inside one chat).',
      inputSchema: {
        query: z.string(),
        chat: z.string().optional().describe('Limit to this chat (name, number or jid)'),
        limit: z.number().int().min(1).max(100).default(20),
      },
      annotations: READ,
    }, safe(async ({ query, chat, limit = 20 }) => {
      // also matches what was said in voice notes and what is written in photos/documents
      let sql = 'SELECT * FROM messages WHERE (lower(text) LIKE ? OR id IN (SELECT id FROM attachments WHERE lower(text) LIKE ?))'
      const params = [`%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`]
      if (chat) {
        const keys = chatKeys(resolveChat(chat))
        sql += ` AND chat_jid IN (${keys.map(() => '?').join(',')})`
        params.push(...keys)
      }
      const rows = db.prepare(sql + ' ORDER BY ts DESC LIMIT ?').all(...params, limit)
      if (!rows.length) return text('No matching messages.')
      return text(rows.map((r) => `${label(r.chat_jid)} (jid ${r.chat_jid})\n  ${fmtMsg(r, 300)}`).join('\n'))
    }))

    reg('whatsapp_search_contacts', {
      title: 'Search WhatsApp contacts',
      description: 'Find contacts and groups by name or phone number. Returns jids usable in other tools.',
      inputSchema: { query: z.string() },
      annotations: READ,
    }, safe(async ({ query }) => {
      const like = `%${query.toLowerCase().replace(/[\s+]/g, '')}%`
      const rows = db.prepare(`
        SELECT jid FROM contacts WHERE lower(COALESCE(name,'') || COALESCE(notify,'')) LIKE ?1 OR jid LIKE ?1 OR alt_jid LIKE ?1
        UNION SELECT jid FROM chats WHERE lower(COALESCE(name,'')) LIKE ?1 OR jid LIKE ?1 OR alt_jid LIKE ?1 LIMIT 30`).all(like)
      if (!rows.length) return text('No contacts found. You can still message any number directly with its country code.')
      return text(rows.map((r) => `• ${label(r.jid)} — jid: ${r.jid}`).join('\n'))
    }))

    reg('whatsapp_send_message', {
      title: 'Send a WhatsApp message',
      description: 'Send a new text message to a person or group. "to" can be a contact/group name, a phone number with country code (works for numbers not in contacts), or a jid. WhatsApp formatting: *bold*, _italic_, ~strike~.',
      inputSchema: { to: z.string(), text: z.string().min(1) },
      annotations: WRITE,
    }, safe(async ({ to, text: body }) => {
      const jid = resolveChat(to)
      const sent = await sendAndStore(jid, { text: body })
      return text(`Sent to ${label(jid)} (message id: ${sent?.key?.id}).`)
    }))

    reg('whatsapp_reply', {
      title: 'Reply to a WhatsApp message',
      description: 'Reply to a specific message (shows as a quoted reply in WhatsApp). Get message ids from whatsapp_read_messages.',
      inputSchema: { chat: z.string(), message_id: z.string(), text: z.string().min(1) },
      annotations: WRITE,
    }, safe(async ({ chat, message_id, text: body }) => {
      const jid = resolveChat(chat)
      const quoted = loadRaw(jid, message_id)
      const sent = await sendAndStore(quoted.key.remoteJid || jid, { text: body }, { quoted })
      return text(`Replied in ${label(jid)} (message id: ${sent?.key?.id}).`)
    }))

    reg('whatsapp_send_file', {
      title: 'Send a file / photo / video on WhatsApp',
      description: 'Attach and send a file. Provide exactly one source: a public web link (url) or the file as base64 data. Files on the server cannot be sent. Images and videos are sent as media, everything else as a document. Optional caption and reply_to message id. Max 30 MB.',
      inputSchema: {
        to: z.string(),
        url: z.string().url().optional().describe('A public http(s) link to the file'),
        base64: z.string().max(42_000_000).optional(),
        filename: z.string().optional().describe('File name shown to the recipient (needed for base64 documents)'),
        mimetype: z.string().optional(),
        caption: z.string().optional(),
        as_document: z.boolean().optional().describe('Send images/videos as a file instead of media'),
        reply_to_message_id: z.string().optional(),
      },
      annotations: WRITE,
    }, safe(async ({ to, url, base64, filename, mimetype, caption, as_document, reply_to_message_id }) => {
      // Never read files from the server's disk here: they include other users' chats and the server's secrets.
      if ([url, base64].filter(Boolean).length !== 1) throw new Error('Provide exactly one of url or base64.')
      const jid = resolveChat(to)
      let buf, mime = mimetype
      if (url) {
        const r = await fetchPublic(url) // public internet only: blocks this server, the cloud metadata service and private networks
        buf = r.buf
        mime ||= r.type?.split(';')[0]
        filename ||= decodeURIComponent(new URL(r.url).pathname.split('/').pop() || '') || undefined
      } else {
        buf = Buffer.from(base64.replace(/^data:[^,]+,/, ''), 'base64')
      }
      const ext = filename?.split('.').pop()?.toLowerCase()
      mime ||= EXT_MIME[ext] || 'application/octet-stream'
      filename ||= `file.${MIME_EXT[mime] || 'bin'}`
      let content
      if (!as_document && mime.startsWith('image/') && mime !== 'image/svg+xml') content = { image: buf, caption, mimetype: mime }
      else if (!as_document && mime.startsWith('video/')) content = { video: buf, caption, mimetype: mime }
      else if (!as_document && mime.startsWith('audio/')) content = { audio: buf, mimetype: mime }
      else content = { document: buf, mimetype: mime, fileName: filename, caption }
      const opts = reply_to_message_id ? { quoted: loadRaw(jid, reply_to_message_id) } : undefined
      const sent = await sendAndStore(jid, content, opts)
      return text(`Sent ${filename} (${mime}, ${(buf.length / 1024).toFixed(0)} KB) to ${label(jid)} (message id: ${sent?.key?.id}).`)
    }))

    reg('whatsapp_forward_message', {
      title: 'Forward a WhatsApp message',
      description: 'Forward one or more existing messages (text, photos, videos, voice notes, documents) from one chat to up to 5 people or groups, as real WhatsApp forwards with the "Forwarded" label, in their original order. Get message ids from whatsapp_read_messages or whatsapp_search_messages. Confirm the messages and the recipients with the user first.',
      inputSchema: {
        chat: z.string().describe('The chat the messages are in (name, number or jid)'),
        message_ids: z.array(z.string()).min(1).max(30).optional().describe('One or more message ids from that chat (up to 30)'),
        message_id: z.string().optional().describe('A single message id (use message_ids for several)'),
        to: z.array(z.string()).min(1).max(5).describe('Recipients: names, phone numbers with country code, or jids'),
      },
      annotations: WRITE,
    }, safe(async ({ chat, message_ids, message_id, to }) => {
      const ids = message_ids?.length ? message_ids : message_id ? [message_id] : []
      if (!ids.length) throw new Error('Give message_ids (or message_id).')
      const from = resolveChat(chat)
      const results = await forwardMessages(from, ids, to.map(resolveChat))
      const what = (r) => (r.total === 1 ? '1 message' : `${r.total} messages`)
      return text(results.map((r) => (r.ok ? `Forwarded ${what(r)} to ${r.name}` : `${r.name}: forwarded ${r.sent} of ${r.total}, then failed: ${r.error}`)).join('\n'))
    }))

    reg('whatsapp_read_attachment', {
      title: 'Read a WhatsApp attachment',
      description: 'Open the attachment in a message and get its contents as text: voice notes and audio are transcribed (with an English translation), photos and screenshots are described with all visible text (amounts, dates, names), videos are described with their speech, and PDF, Word (.docx), Excel (.xlsx) and text files are extracted. Use this whenever a message shows [voice_note], [audio], [image], [video], [document] or [sticker] and you need what is in it.',
      inputSchema: {
        chat: z.string().describe('Name, phone number or jid of the chat'),
        message_id: z.string().describe('The message id from whatsapp_read_messages'),
      },
      annotations: READ,
    }, safe(async ({ chat, message_id }) => {
      const jid = resolveChat(chat)
      const r = await attachments.read(jid, message_id)
      const row = db.prepare('SELECT from_me, from_name, from_jid, ts, text FROM messages WHERE id = ?').get(message_id)
      const who = row ? (row.from_me ? 'Me' : row.from_name || label(row.from_jid || jid)) : label(jid)
      const head = `${(r.kind || 'attachment').replace('_', ' ')} from ${who}${row ? `, ${fmtTime(row.ts)}` : ''}${row?.text ? ` — caption/file: ${row.text}` : ''}`
      return text(`${head}\n\n${r.text}`)
    }))

    reg('whatsapp_auto_reply', {
      title: 'Auto-reply settings',
      description: 'View or change WhatsApp auto-reply (AI replies as the owner in 1:1 chats; never in groups). mode: off | allowlist (only "allow" contacts) | all (everyone except "exclude"). Call with no arguments to just view.',
      inputSchema: {
        mode: z.enum(['off', 'allowlist', 'all']).optional(),
        allow: z.array(z.string()).optional().describe('Replaces the allow list (numbers with country code or contact names)'),
        exclude: z.array(z.string()).optional().describe('Replaces the exclude list'),
        pauseMinutes: z.number().int().min(0).max(1440).optional().describe('Stay quiet in a chat for this long after the owner replies by hand'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    }, safe(async (args) => {
      const s = arSettings()
      for (const k of ['mode', 'allow', 'exclude', 'pauseMinutes']) if (args[k] !== undefined) s[k] = args[k]
      if (Object.values(args).some((v) => v !== undefined)) saveAr(s)
      return text(JSON.stringify(s, null, 2) + (gemini ? '' : '\n\n(GEMINI_API_KEY is not set — auto-reply cannot run)'))
    }))

    reg('whatsapp_create_group', {
      title: 'Create a WhatsApp group',
      description: 'Create a new WhatsApp group with the given participants (phone numbers with country code or contact names).',
      inputSchema: { name: z.string().min(1), participants: z.array(z.string()).min(1) },
      annotations: WRITE,
    }, safe(async ({ name, participants }) => {
      const jids = participants.map(resolveChat)
      const g = await requireSock().groupCreate(name, jids)
      q.upsertChat.run(g.id, null, name, 1, Math.floor(Date.now() / 1000))
      return text(`Created group "${name}" (jid: ${g.id}) with ${jids.length} participant(s).`)
    }))

    if (opts.route) {
      server.registerTool('whatsapp_accounts', {
        title: 'Accounts in your organisation',
        description: 'List every WhatsApp account in your organisation (you are the superadmin). Pass one as `account` to the read tools (brief, waiting, list chats, read messages, search, read attachment, status) to read that account. You can read other accounts but not send from them.',
        inputSchema: {}, annotations: { readOnlyHint: true, openWorldHint: false },
      }, safe(async () => text(opts.listAccounts())))
    }
    return server
  }

  // Run one of this workspace's tools directly (used when a superadmin's ChatGPT reads this account).
  async function callTool(name, args) {
    const fn = buildServer()._handlers[name]
    if (!fn) throw new Error(`Unknown tool ${name}`)
    return fn(args)
  }
  // ---------------------------------------------------------------- REST API for the dashboard (x-api-key: <token>)
  function mediaContent(buf, mime, filename, caption, asDocument) {
    if (!asDocument && mime.startsWith('image/') && mime !== 'image/svg+xml') return { image: buf, caption, mimetype: mime }
    if (!asDocument && mime.startsWith('video/')) return { video: buf, caption, mimetype: mime }
    if (!asDocument && mime.startsWith('audio/')) return { audio: buf, mimetype: mime }
    return { document: buf, mimetype: mime, fileName: filename, caption }
  }

  // "@235316996755599" (a hidden WhatsApp ID in group mentions) → "@Jane Doe"
  const mentionCache = new Map()
  function prettyText(t) {
    if (!t || !t.includes('@')) return t
    return t.replace(/@(\d{6,})/g, (m, d) => {
      if (!mentionCache.has(d)) mentionCache.set(d, nameOf(`${d}@lid`) || nameOf(`${d}@s.whatsapp.net`))
      const n = mentionCache.get(d)
      return n ? `@${n}` : m
    })
  }

  function listChats({ q: query, limit = 200 } = {}) {
    const canon = new Map()
    const chats = new Map()
    for (const c of db.prepare('SELECT jid, alt_jid, is_group FROM chats').all()) {
      if (c.alt_jid) canon.set(c.alt_jid, c.jid)
      chats.set(c.jid, c)
    }
    const stats = new Map() // canonical jid → { last, lastMine, msgs: [[ts, fromMe]] }
    const since = Math.floor(Date.now() / 1000) - 60 * 86400
    const rows = db.prepare('SELECT chat_jid, id, from_me, from_name, ts, text, media_type FROM messages WHERE ts >= ? ORDER BY ts').all(since)
    for (const r of rows) {
      const jid = canon.get(r.chat_jid) || r.chat_jid
      const s = stats.get(jid) || { last: null, lastMine: 0, incoming: [] }
      s.last = r
      if (r.from_me) s.lastMine = r.ts
      else s.incoming.push(r.ts)
      stats.set(jid, s)
    }
    const autoIds = new Set(db.prepare('SELECT id FROM autoreplies').all().map((r) => r.id))
    const summaries = new Map(db.prepare('SELECT * FROM summaries').all().map((r) => [r.chat_jid, r]))
    const ar = arSettings()
    let out = [...stats.entries()].map(([jid, s]) => {
      const sum = summaries.get(jid)
      return {
        jid,
        name: nameOf(jid),
        number: isJidGroup(jid) ? null : (jid.endsWith('@lid') ? chats.get(jid)?.alt_jid : jid)?.split('@')[0] || null,
        isGroup: !!isJidGroup(jid),
        lastTs: s.last.ts,
        last: { id: s.last.id, text: prettyText((s.last.text || '').slice(0, 140)), fromMe: !!s.last.from_me, media: s.last.media_type, auto: autoIds.has(s.last.id) },
        pending: s.incoming.filter((t) => t > s.lastMine).length,
        autoReply: chatOverride(jid, ar) || 'default',
        autoReplyActive: autoReplyEnabledFor(jid, ar),
        summary: sum && sum.last_msg_id === s.last.id ? { text: sum.summary, needsReply: !!sum.needs_reply, priority: sum.priority } : null,
      }
    })
    if (query) {
      const ql = query.toLowerCase()
      out = out.filter((c) => (c.name || '').toLowerCase().includes(ql) || (c.number || '').includes(ql.replace(/\D/g, '') || '§'))
    }
    return out.sort((a, b) => b.lastTs - a.lastTs).slice(0, limit)
  }

  const json = (res, code, data) => {
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(data))
  }

  async function readJson(req, max = 30 * 1024 * 1024) {
    let size = 0
    const chunks = []
    for await (const c of req) {
      size += c.length
      if (size > max) throw Object.assign(new Error('Body too large'), { code: 413 })
      chunks.push(c)
    }
    const raw = Buffer.concat(chunks).toString('utf8')
    return raw ? JSON.parse(raw) : {}
  }

  // Things a superadmin may do while viewing someone else's account: look, and have the AI read or summarise.
  // Never send, reply, change settings, edit memory, unlink or disconnect.
  const VIEW_POSTS = new Set(['media/read', 'chats/summary'])

  async function api(req, res, url, { readOnly = false } = {}) {
    const parts = url.pathname.split('/').slice(2).map(decodeURIComponent) // ['chats', jid, 'messages']
    const [resource, id, action, sub] = parts
    const m = req.method
    if (readOnly && m !== 'GET') {
      const key = resource === 'media' ? `media/${sub}` : `${resource}/${action}`
      if (m !== 'POST' || !VIEW_POSTS.has(key)) {
        return json(res, 403, { error: "Read-only: you can view this account's chats but not send messages or change its settings." })
      }
    }
    const now = Math.floor(Date.now() / 1000)

    if (resource === 'status' && m === 'GET') {
      if (!readOnly) touch() // an admin looking must not start this account's WhatsApp or see its QR code
      return json(res, 200, {
        status, qr: status === 'connected' || readOnly ? null : qrDataUrl,
        number: me ? numberOf(me.id) : null, name: ownerName() || null,
        chats: db.prepare('SELECT COUNT(*) n FROM chats').get().n,
        messages: db.prepare('SELECT COUNT(*) n FROM messages').get().n,
        ai: gemini ? GEMINI_MODEL : null,
      })
    }

    // Convert a message the owner typed into natural English before they send it (nothing is sent here)
    if (resource === 'translate' && !id && m === 'POST') {
      const { text: typed = '' } = await readJson(req)
      const src = String(typed).trim()
      if (!src) return json(res, 400, { error: 'Type a message first.' })
      if (src.length > 5000) return json(res, 400, { error: 'That message is too long to convert (max 5000 characters).' })
      if (!gemini) return json(res, 503, { error: "Translation needs the AI key (GEMINI_API_KEY), which isn't set on this server." })
      const r = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [{ text: `Convert this WhatsApp message, written by me, into natural English that I can send as it is.
- It may be in any language, a mix of languages, or a language written in English letters; if it's already English, only fix obvious spelling and grammar.
- Keep my tone and length, and keep names, numbers, amounts, dates, links and emoji exactly.
- Reply with only the English message, no quotes or explanation.

Message:
${src}` }] }],
      })
      const english = (r.text || '').trim()
      if (!english) return json(res, 502, { error: "The AI didn't return a translation. Try again." })
      return json(res, 200, { english })
    }

    // Search every contact and group (not just recent chats), e.g. to pick who to forward to
    if (resource === 'contacts' && !id && m === 'GET') {
      const q = (url.searchParams.get('q') || '').trim().toLowerCase()
      if (q.length < 2) return json(res, 200, [])
      const like = `%${q.replace(/[\s+]/g, '')}%`
      const nameLike = `%${q}%`
      const rows = db.prepare(`
        SELECT jid FROM chats WHERE lower(COALESCE(name, '')) LIKE ?2 OR jid LIKE ?1 OR alt_jid LIKE ?1
        UNION SELECT jid FROM contacts WHERE lower(COALESCE(name, '') || ' ' || COALESCE(notify, '')) LIKE ?2 OR jid LIKE ?1 OR alt_jid LIKE ?1
        LIMIT 40`).all(like, nameLike)
      const seen = new Set()
      const out = []
      for (const { jid } of rows) {
        // prefer the chat a contact is stored under, so the forward lands in the existing conversation
        const chat = db.prepare('SELECT jid FROM chats WHERE jid = ? OR alt_jid = ? ORDER BY last_ts DESC LIMIT 1').get(jid, jid)?.jid || jid
        if (seen.has(chat) || !/@(s\.whatsapp\.net|g\.us|lid)$/.test(chat)) continue
        seen.add(chat)
        const group = !!isJidGroup(chat)
        const alt = db.prepare('SELECT alt_jid FROM chats WHERE jid = ?').get(chat)?.alt_jid
        out.push({ jid: chat, name: nameOf(chat), number: group ? null : (chat.endsWith('@lid') ? alt : chat)?.split('@')[0] || null, isGroup: group })
      }
      return json(res, 200, out.slice(0, 25))
    }

    if (resource === 'chats' && !id && m === 'GET') {
      return json(res, 200, listChats({ q: url.searchParams.get('q') || '', limit: Number(url.searchParams.get('limit') || 200) }))
    }

    if (resource === 'chats' && id) {
      const jid = id
      const keys = chatKeys(jid)
      const inKeys = `chat_jid IN (${keys.map(() => '?').join(',')})`

      if (action === 'messages' && m === 'GET') {
        const limit = Math.min(Number(url.searchParams.get('limit') || 60), 300)
        const before = Number(url.searchParams.get('before') || 2 ** 31)
        const autoIds = new Set(db.prepare('SELECT id FROM autoreplies WHERE chat_jid IN (' + keys.map(() => '?').join(',') + ')').all(...keys).map((r) => r.id))
        const rows = db.prepare(`SELECT id, chat_jid, from_me, from_name, from_jid, ts, text, media_type, instr(raw, '"isForwarded":true') > 0 AS fwd FROM messages WHERE ${inKeys} AND ts < ? ORDER BY ts DESC LIMIT ?`)
          .all(...keys, before, limit).reverse()
        return json(res, 200, {
          jid, name: nameOf(jid) || label(jid), isGroup: !!isJidGroup(jid),
          autoReply: chatOverride(jid) || 'default', autoReplyActive: autoReplyEnabledFor(jid),
          messages: rows.map((r) => ({
            id: r.id, chat: r.chat_jid, fromMe: !!r.from_me, ts: r.ts, text: prettyText(r.text), media: r.media_type, auto: autoIds.has(r.id), forwarded: !!r.fwd,
            attachment: r.media_type ? attText(r.id) : null,
            from: r.from_me ? 'Me' : r.from_name || (r.from_jid ? nameOf(r.from_jid) || '+' + numberOf(r.from_jid) : null),
          })),
        })
      }

      if (action === 'send' && m === 'POST') {
        const { text: body, replyTo } = await readJson(req)
        if (!body?.trim()) return json(res, 400, { error: 'text is required' })
        const opts = replyTo ? { quoted: loadRaw(jid, replyTo) } : undefined
        const sent = await sendAndStore(opts?.quoted?.key?.remoteJid || jid, { text: body }, opts)
        return json(res, 200, { id: sent?.key?.id })
      }

      if (action === 'forward' && m === 'POST') {
        const { messageId, messageIds, to } = await readJson(req)
        const ids = Array.isArray(messageIds) ? messageIds : messageId ? [messageId] : []
        if (!ids.length || !Array.isArray(to)) return json(res, 400, { error: 'messageIds and a list of chats (to) are required' })
        try {
          return json(res, 200, { results: await forwardMessages(jid, ids, to) })
        } catch (e) {
          return json(res, 400, { error: e.message })
        }
      }

      if (action === 'file' && m === 'POST') {
        const { base64, filename = 'file', mimetype, caption, replyTo, asDocument } = await readJson(req)
        if (!base64) return json(res, 400, { error: 'base64 is required' })
        const buf = Buffer.from(base64.replace(/^data:[^,]+,/, ''), 'base64')
        const mime = mimetype || EXT_MIME[filename.split('.').pop()?.toLowerCase()] || 'application/octet-stream'
        const opts = replyTo ? { quoted: loadRaw(jid, replyTo) } : undefined
        const sent = await sendAndStore(jid, mediaContent(buf, mime, filename, caption, asDocument), opts)
        return json(res, 200, { id: sent?.key?.id })
      }

      if (action === 'draft' && m === 'POST') {
        const lastMine = db.prepare(`SELECT MAX(ts) t FROM messages WHERE ${inKeys} AND from_me = 1`).get(...keys).t || 0
        return json(res, 200, { text: await generateReply(jid, lastMine) })
      }

      if (action === 'summary' && m === 'POST') {
        const s = await summarizeChat(jid, now - 7 * 86400)
        return json(res, 200, s ? { text: s.summary, needsReply: !!s.needs_reply, priority: s.priority } : null)
      }

      if (action === 'autoreply' && m === 'PUT') {
        const { mode } = await readJson(req)
        if (!['on', 'off', 'default'].includes(mode)) return json(res, 400, { error: 'mode must be on, off or default' })
        const s = arSettings()
        s.chats = { ...(s.chats || {}) }
        for (const k of keys) delete s.chats[k]
        if (mode !== 'default') s.chats[jid] = mode
        saveAr(s)
        return json(res, 200, { autoReply: mode, autoReplyActive: autoReplyEnabledFor(jid, s) })
      }
    }

    if (resource === 'media' && id && action && m === 'GET') {
      let f
      try {
        f = await fetchMedia(id, action)
      } catch (e) {
        return json(res, e.status || 404, { error: e.message })
      }
      // The sender chooses the file type, so never let a file act as a web page on the dashboard's address:
      // only plain photos, videos, audio and PDFs open in the browser, everything else downloads, and the
      // response is sandboxed so nothing in it can run scripts or reach the dashboard.
      const safeInline = INLINE_SAFE.has(f.mime)
      const name = (f.fileName || `${f.kind || 'file'}.${MIME_EXT[f.mime] || 'bin'}`).replace(/[\r\n"]/g, '_')
      const headers = {
        'content-type': safeInline ? f.mime : 'application/octet-stream',
        'cache-control': 'private, max-age=86400',
        'x-content-type-options': 'nosniff',
        'content-disposition': `${safeInline ? 'inline' : 'attachment'}; filename*=UTF-8\'\'${encodeURIComponent(name)}`,
      }
      if (f.mime !== 'application/pdf') headers['content-security-policy'] = "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'"
      res.writeHead(200, headers)
      return res.end(f.buf)
    }

    // Read an attachment with AI: transcript / description / extracted text
    if (resource === 'media' && id && action && sub === 'read' && m === 'POST') {
      try {
        const r = await attachments.read(id, action, { force: url.searchParams.get('force') === '1' })
        return json(res, 200, { text: r.text })
      } catch (e) {
        return json(res, e.status || 422, { error: e.message })
      }
    }

    if (resource === 'overview' && m === 'GET') {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      const start = Math.floor(d.getTime() / 1000)
      const canon = new Map(db.prepare('SELECT jid, alt_jid FROM chats WHERE alt_jid IS NOT NULL').all().map((r) => [r.alt_jid, r.jid]))
      const today = db.prepare('SELECT chat_jid, from_me, ts FROM messages WHERE ts >= ?').all(start)
      const hourly = Array(24).fill(0)
      const perChat = new Map()
      let incoming = 0, sent = 0, groupIncoming = 0
      for (const r of today) {
        if (r.from_me) { sent++; continue }
        const jid = canon.get(r.chat_jid) || r.chat_jid
        if (isJidGroup(jid)) groupIncoming++
        else incoming++
        hourly[new Date(r.ts * 1000).getHours()]++
        perChat.set(jid, (perChat.get(jid) || 0) + 1)
      }
      const chats = listChats({ limit: 1000 })
      const weekAgo = now - 7 * 86400
      const waiting = chats.filter((c) => !c.isGroup && c.pending > 0 && !c.last.fromMe && c.lastTs >= weekAgo)
      return json(res, 200, {
        today: {
          incoming, groupIncoming, sent,
          autoReplies: db.prepare('SELECT COUNT(*) n FROM autoreplies WHERE ts >= ?').get(start).n,
          activeChats: perChat.size,
        },
        waitingCount: waiting.length,
        waiting: waiting.slice(0, 12).map((c) => ({ jid: c.jid, name: c.name || (c.number ? '+' + c.number : c.jid), pending: c.pending, lastTs: c.lastTs, last: c.last.text, media: c.last.media })),
        hourly,
        busiest: [...perChat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
          .map(([jid, n]) => ({ jid, name: nameOf(jid) || label(jid), isGroup: !!isJidGroup(jid), count: n })),
        autoReply: { mode: arSettings().mode },
      })
    }

    if (resource === 'brief' && m === 'GET') {
      const hours = Math.min(Number(url.searchParams.get('hours') || 24), 24 * 14)
      return json(res, 200, await dailyBrief(now - hours * 3600, hours))
    }

    if (resource === 'digest' && m === 'GET') {
      const hours = Math.min(Number(url.searchParams.get('hours') || 24), 24 * 14)
      return json(res, 200, await digest(now - hours * 3600, { generate: url.searchParams.get('generate') !== '0' }))
    }

    if (resource === 'autoreply') {
      const withLists = (s) => {
        const entries = Object.entries(s.chats || {})
        const item = ([jid]) => ({ jid, name: nameOf(jid) || label(jid) })
        return {
          ...s, ai: !!gemini,
          onList: entries.filter(([, v]) => v === 'on').map(item),
          offList: entries.filter(([, v]) => v === 'off').map(item),
        }
      }
      if (m === 'GET') return json(res, 200, withLists(arSettings()))
      if (m === 'PUT') {
        const body = await readJson(req)
        const s = arSettings()
        if (body.mode && ['off', 'allowlist', 'all'].includes(body.mode)) s.mode = body.mode
        if (Array.isArray(body.allow)) s.allow = body.allow
        if (Array.isArray(body.exclude)) s.exclude = body.exclude
        if (Number.isFinite(body.pauseMinutes)) s.pauseMinutes = Math.max(0, Math.min(1440, body.pauseMinutes))
        if (typeof body.instructions === 'string') s.instructions = body.instructions.slice(0, 2000)
        saveAr(s)
        return json(res, 200, withLists(s))
      }
    }

    if (resource === 'memory') {
      if (m === 'GET') return json(res, 200, memoryList())
      if (m === 'POST') {
        const { text: note } = await readJson(req)
        if (!note?.trim() || note.length > 500) return json(res, 400, { error: 'note must be 1–500 characters' })
        db.prepare('INSERT INTO memories (text, created) VALUES (?, ?)').run(note.trim(), now)
        return json(res, 200, memoryList())
      }
      if (m === 'DELETE' && id) {
        db.prepare('DELETE FROM memories WHERE id = ?').run(Number(id))
        return json(res, 200, memoryList())
      }
    }

    if (resource === 'connector') {
      if (m === 'GET') return json(res, 200, { url: oauth.resource(), signIn: true, sessions: oauth.sessionsFor(user.id) })
      if (m === 'POST' && id === 'revoke') return json(res, 200, { revoked: oauth.revokeForUser(user.id) })
    }

    if (resource === 'autoreplies' && m === 'GET') {
      const limit = Math.min(Number(url.searchParams.get('limit') || 20), 100)
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      const rows = db.prepare(`SELECT a.id, a.chat_jid, a.ts, m.text FROM autoreplies a LEFT JOIN messages m ON m.id = a.id
        ORDER BY a.ts DESC LIMIT ?`).all(limit)
      return json(res, 200, {
        today: db.prepare('SELECT COUNT(*) n FROM autoreplies WHERE ts >= ?').get(Math.floor(d.getTime() / 1000)).n,
        total: db.prepare('SELECT COUNT(*) n FROM autoreplies').get().n,
        items: rows.map((r) => {
          const keys = chatKeys(r.chat_jid)
          // the messages this reply was answering: their messages since my previous message
          const theirs = db.prepare(`SELECT text, media_type, ts, from_me FROM messages WHERE chat_jid IN (${keys.map(() => '?').join(',')})
            AND ts <= ? AND id != ? ORDER BY ts DESC LIMIT 8`).all(...keys, r.ts, r.id)
          const incoming = []
          for (const t of theirs) {
            if (t.from_me) break
            incoming.unshift(t.media_type && !t.text ? `[${t.media_type}]` : prettyText(t.text))
          }
          return { id: r.id, jid: r.chat_jid, name: nameOf(r.chat_jid) || label(r.chat_jid), ts: r.ts, reply: r.text, incoming: incoming.slice(-3) }
        }),
      })
    }

    // Unlink this WhatsApp (logs the linked device out) and optionally clear the stored chats, e.g. before linking another number.
    if (resource === 'whatsapp' && id === 'unlink' && m === 'POST') {
      const { clearChats = false } = await readJson(req)
      await unlink({ clearChats: Boolean(clearChats) })
      return json(res, 200, { ok: true })
    }

    return json(res, 404, { error: 'not found' })
  }

  async function unlink({ clearChats = false } = {}) {
    if (DEMO) {
      // nothing to unlink: put the sample chats back instead
      seedDemo({ db, cacheDir: path.join(DOWNLOAD_DIR, 'cache') })
      briefCache.clear()
      log('demo mode: sample chats reloaded')
      return
    }
    const s = sock
    if (s && status === 'connected') await s.logout().catch(() => {})
    stop('idle')
    me = null
    fs.rmSync(AUTH_DIR, { recursive: true, force: true })
    if (clearChats) {
      db.exec('DELETE FROM messages; DELETE FROM chats; DELETE FROM contacts; DELETE FROM summaries; DELETE FROM autoreplies; DELETE FROM attachments')
      fs.rmSync(DOWNLOAD_DIR, { recursive: true, force: true })
      const ar = arSettings()
      ar.chats = {}
      ar.allow = []
      ar.exclude = []
      saveAr(ar)
      briefCache.clear()
    }
    log(clearChats ? 'unlinked WhatsApp and cleared chats' : 'unlinked WhatsApp')
  }

  // Shut down for good (user deleted). The caller removes the folder.
  function close() {
    clearInterval(idleTimer)
    stop('idle')
    try { db.close() } catch {}
  }

  const summary = () => ({
    status,
    linked: status === 'connected' || isLinked(),
    number: me ? numberOf(me.id) : null,
    chats: db.prepare('SELECT COUNT(*) n FROM chats').get().n,
    messages: db.prepare('SELECT COUNT(*) n FROM messages').get().n,
  })

  if (DEMO) {
    seedDemo({ db, cacheDir: path.join(DOWNLOAD_DIR, 'cache') })
    sock = createDemoSocket({ cacheDir: path.join(DOWNLOAD_DIR, 'cache'), BufferJSON })
    me = { id: DEMO_OWNER.jid, name: DEMO_OWNER.name }
    status = 'connected'
    log('demo mode: sample chats loaded; nothing is sent to WhatsApp')
  } else if (isLinked()) start()
  return { user, api, buildServer, callTool, summary, unlink, close, isLinked }
}

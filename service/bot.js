// WhatsApp <-> ChatGPT bot. Scan the QR once, then anyone (or an allowlist) can chat with GPT on that number.
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  isJidGroup,
  jidNormalizedUser,
} from '@whiskeysockets/baileys'
import OpenAI, { toFile } from 'openai'
import { GoogleGenAI } from '@google/genai'
import qrcode from 'qrcode-terminal'
import QRCode from 'qrcode'
import pino from 'pino'
import fs from 'node:fs'
import http from 'node:http'

// ---- QR page: open http://localhost:3939 to scan (terminal QR breaks in narrow windows) ----
const QR_PORT = Number(process.env.QR_PORT || 3939)
let qrDataUrl = null
let linkedAs = null
http
  .createServer((_, res) => {
    const body = linkedAs
      ? `<h1>✅ Linked</h1><p>Bot is live on +${linkedAs}. You can close this tab.</p>`
      : qrDataUrl
        ? `<h1>Scan with WhatsApp</h1><p>Settings → Linked devices → Link a device</p><img src="${qrDataUrl}" width="360" height="360"><p class="s">Refreshes automatically — WhatsApp rotates the code every ~20s.</p>`
        : `<h1>Waiting for QR…</h1>`
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(`<!doctype html><meta http-equiv="refresh" content="3"><title>WhatsApp bot login</title>
<style>body{font-family:system-ui;background:#fff;color:#111;display:grid;place-items:center;min-height:90vh;text-align:center;margin:0 16px}img{border:12px solid #fff;max-width:100%;height:auto}.s{color:#666;font-size:13px}</style>${body}`)
  })
  .listen(QR_PORT, () => console.log(`QR page: http://localhost:${QR_PORT}`))

const {
  GEMINI_API_KEY,
  GEMINI_MODEL = 'gemini-3.8-flash',
  OPENAI_API_KEY,
  OPENAI_MODEL = 'gpt-5-mini',
  TRANSCRIBE_MODEL = 'whisper-1',
  SYSTEM_PROMPT = 'You are a helpful assistant chatting on WhatsApp. Reply in the language the user writes in (Hindi, Hinglish, English...). Keep answers short. Use WhatsApp formatting only: *bold*, _italic_, - lists. No markdown headings or tables.',
  ALLOWED_NUMBERS = '', // comma-separated, e.g. 919876543210,918888888888 — empty = everyone
  GROUP_TRIGGER = '@gpt', // in groups, only reply when mentioned or message starts with this
  HISTORY_TURNS = '20',
} = process.env

if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
  console.error('Missing GEMINI_API_KEY or OPENAI_API_KEY (put one in .env)')
  process.exit(1)
}

// ---- AI provider: Gemini if its key is set, otherwise OpenAI. Both expose the same two functions. ----
// history: [{ role: 'user'|'assistant', content: string }], image: { mime, base64 } | undefined
const ai = GEMINI_API_KEY ? geminiProvider() : openaiProvider()

function geminiProvider() {
  const g = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  return {
    name: `Gemini (${GEMINI_MODEL})`,
    async chat(history, text, image) {
      const parts = [{ text: text || 'What is in this image?' }]
      if (image) parts.push({ inlineData: { mimeType: image.mime, data: image.base64 } })
      const res = await g.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          ...history.map((h) => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
          { role: 'user', parts },
        ],
        config: { systemInstruction: SYSTEM_PROMPT },
      })
      return res.text
    },
    async transcribe(buf, mime) {
      const res = await g.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: 'user', parts: [
          { text: 'Transcribe this voice note exactly as spoken, in its original language. Output only the transcript.' },
          { inlineData: { mimeType: (mime || 'audio/ogg').split(';')[0], data: buf.toString('base64') } },
        ] }],
      })
      return res.text
    },
  }
}

function openaiProvider() {
  const o = new OpenAI({ apiKey: OPENAI_API_KEY })
  return {
    name: `OpenAI (${OPENAI_MODEL})`,
    async chat(history, text, image) {
      const content = image
        ? [{ type: 'text', text: text || 'What is in this image?' }, { type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.base64}` } }]
        : text
      const res = await o.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history, { role: 'user', content }],
      })
      return res.choices[0]?.message?.content
    },
    async transcribe(buf) {
      const tr = await o.audio.transcriptions.create({ file: await toFile(buf, 'voice.ogg'), model: TRANSCRIBE_MODEL })
      return tr.text
    },
  }
}
const logger = pino({ level: 'silent' })
const allowed = new Set(ALLOWED_NUMBERS.split(',').map((s) => s.replace(/\D/g, '')).filter(Boolean))

// ---- per-chat memory, persisted so restarts don't wipe context ----
const MEMORY_FILE = './memory.json'
const memory = fs.existsSync(MEMORY_FILE) ? JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8')) : {}
let saveTimer
const saveMemory = () => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory)), 500)
}
const remember = (chat, role, content) => {
  const h = (memory[chat] ??= [])
  h.push({ role, content })
  memory[chat] = h.slice(-Number(HISTORY_TURNS) * 2)
  saveMemory()
}

const numberOf = (jid) => (jid || '').split('@')[0].split(':')[0]

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth')
  const { version } = await fetchLatestBaileysVersion()
  const sock = makeWASocket({ version, auth: state, logger, browser: ['Wavelink bot', 'Chrome', '1.0'] })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      QRCode.toDataURL(qr, { width: 360, margin: 2 }).then((u) => (qrDataUrl = u))
      console.log(`\nNew QR — open http://localhost:${QR_PORT} to scan (or scan below if your window is wide enough):\n`)
      qrcode.generate(qr, { small: true })
    }
    if (connection === 'open') linkedAs = numberOf(sock.user?.id)
    if (connection === 'open') console.log(`✅ Connected as ${numberOf(sock.user?.id)} — bot is live, using ${ai.name}`)
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      if (code === DisconnectReason.loggedOut) {
        console.log('Logged out. Delete the ./auth folder and restart to scan again.')
        process.exit(0)
      }
      console.log('Connection closed, reconnecting…', code ?? '')
      setTimeout(start, 2000)
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) handle(sock, msg).catch((e) => console.error('handler error:', e.message))
  })
}

async function handle(sock, msg) {
  const chat = msg.key.remoteJid
  if (!msg.message || msg.key.fromMe || !chat || chat === 'status@broadcast' || chat.endsWith('@newsletter')) return

  const group = isJidGroup(chat)
  const senderJid = group ? msg.key.participantAlt || msg.key.participant : msg.key.remoteJidAlt || chat
  if (allowed.size && !allowed.has(numberOf(senderJid))) return

  const m = msg.message.ephemeralMessage?.message || msg.message
  let text = m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || ''
  let image

  // In groups only respond when tagged / triggered
  if (group) {
    const me = [sock.user?.id, sock.user?.lid].filter(Boolean).map(jidNormalizedUser)
    const mentioned = (m.extendedTextMessage?.contextInfo?.mentionedJid || []).some((j) => me.includes(jidNormalizedUser(j)))
    const triggered = text.toLowerCase().startsWith(GROUP_TRIGGER.toLowerCase())
    if (!mentioned && !triggered) return
    if (triggered) text = text.slice(GROUP_TRIGGER.length).trim()
  }

  if (text.trim().toLowerCase() === '/reset') {
    delete memory[chat]
    saveMemory()
    return sock.sendMessage(chat, { text: '🧹 Memory cleared.' }, { quoted: msg })
  }

  await sock.readMessages([msg.key])
  await sock.sendPresenceUpdate('composing', chat)

  // Voice notes → transcribe
  if (m.audioMessage) {
    const buf = await downloadMediaMessage(msg, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage })
    text = (await ai.transcribe(buf, m.audioMessage.mimetype))?.trim() || ''
  }

  // Images → vision
  if (m.imageMessage) {
    const buf = await downloadMediaMessage(msg, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage })
    image = { mime: m.imageMessage.mimetype || 'image/jpeg', base64: buf.toString('base64') }
  }

  if (!text && !image) return

  const reply = (await ai.chat(memory[chat] || [], text, image))?.trim() || '…'

  // store images as text in memory so the history file stays small
  remember(chat, 'user', image ? `[sent an image] ${text}` : text)
  remember(chat, 'assistant', reply)

  await sock.sendPresenceUpdate('paused', chat)
  await sock.sendMessage(chat, { text: reply }, { quoted: msg })
  console.log(`💬 ${numberOf(senderJid)}: ${text.slice(0, 60)}  →  ${reply.slice(0, 60)}`)
}

start()

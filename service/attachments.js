// Turns WhatsApp attachments into text so ChatGPT (and summaries, drafts, auto-replies) can use them:
// voice notes/audio → transcript (+ English), photos → description + all visible text, videos → what happens + speech,
// PDFs → summary + text, Word/Excel/text files → extracted text. Results are cached, so each file is read once.
import mammoth from 'mammoth'
import ExcelJS from 'exceljs'

const INLINE_MAX = 14 * 1024 * 1024 // bigger files go through the Gemini Files API (inline requests cap at ~20 MB)
const MAX_TEXT = 60_000 // characters kept per attachment

const PROMPTS = {
  voice_note: `This is a WhatsApp voice note. Transcribe it word for word.
- Keep the language as spoken. Write Hindi/Hinglish in Roman script the way people type on WhatsApp; keep English as English.
- If it is not entirely English, add a line "English:" with a faithful translation after the transcript.
- If there is no speech, say what you hear in one line.
Reply with only:
Transcript: <transcript>
English: <translation, only if needed>`,
  image: `This is a photo sent on WhatsApp. Reply in plain text:
1. One or two sentences on what it shows.
2. "Text in image:" followed by all readable text, copied exactly (names, amounts, dates, numbers). Skip this if there is none.
3. If it is a bill, receipt, invoice, ticket, payment screenshot or document, list the key details (who, amount, date, reference).`,
  video: `This is a video sent on WhatsApp. In plain text: describe what happens in 2–4 sentences, then "Speech:" with a transcript of anything said (Hindi/Hinglish in Roman script, with an English translation if needed), and "Text on screen:" with any readable text. Omit sections that are empty.`,
  pdf: `This is a document sent on WhatsApp. In plain text: first "Summary:" in 2–3 sentences (what it is, who it is from/to, key amounts, dates and asks), then "Content:" with the document's text (tables as simple rows). If it is very long, keep the most important parts and say what was left out.`,
}

const TEXT_MIMES = /^(text\/|application\/(json|xml|csv|x-csv|rtf))/
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const GEMINI_DOCS = new Set(['application/pdf'])

export function createAttachments({ db, gemini, model, fetchMedia, log = console.log }) {
  db.exec(`CREATE TABLE IF NOT EXISTS attachments (
    chat_jid TEXT, id TEXT, kind TEXT, mime TEXT, text TEXT, error TEXT, updated_ts INTEGER,
    PRIMARY KEY (chat_jid, id))`)
  const getStmt = db.prepare('SELECT * FROM attachments WHERE id = ? ORDER BY text IS NULL LIMIT 1')
  const putStmt = db.prepare('INSERT OR REPLACE INTO attachments (chat_jid, id, kind, mime, text, error, updated_ts) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const inflight = new Map()

  const cached = (id) => getStmt.get(id) || null

  async function askGemini(prompt, buf, mime) {
    if (!gemini) throw new Error('GEMINI_API_KEY is not set, so attachments cannot be read.')
    let part, uploaded
    if (buf.length <= INLINE_MAX) part = { inlineData: { mimeType: mime, data: buf.toString('base64') } }
    else {
      uploaded = await gemini.files.upload({ file: new Blob([buf], { type: mime }), config: { mimeType: mime } })
      // videos and large audio need a moment to process before they can be used
      for (let i = 0; uploaded.state === 'PROCESSING' && i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        uploaded = await gemini.files.get({ name: uploaded.name })
      }
      if (uploaded.state === 'FAILED') throw new Error('Gemini could not process this file.')
      part = { fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType || mime } }
    }
    try {
      const res = await gemini.models.generateContent({ model, contents: [{ role: 'user', parts: [part, { text: prompt }] }] })
      return res.text?.trim() || ''
    } finally {
      if (uploaded) gemini.files.delete({ name: uploaded.name }).catch(() => {})
    }
  }

  async function extract({ kind, mime, buf, fileName }) {
    const ext = (fileName || '').split('.').pop()?.toLowerCase()
    if (kind === 'voice_note' || kind === 'audio') return askGemini(PROMPTS.voice_note, buf, mime.startsWith('audio/') ? mime : 'audio/ogg')
    if (kind === 'image' || kind === 'sticker') return askGemini(PROMPTS.image, buf, mime === 'image/webp' || mime.startsWith('image/') ? mime : 'image/jpeg')
    if (kind === 'video') return askGemini(PROMPTS.video, buf, mime.startsWith('video/') ? mime : 'video/mp4')
    // documents
    if (GEMINI_DOCS.has(mime) || ext === 'pdf') return askGemini(PROMPTS.pdf, buf, 'application/pdf')
    if (mime.startsWith('image/')) return askGemini(PROMPTS.image, buf, mime)
    if (mime.startsWith('audio/')) return askGemini(PROMPTS.voice_note, buf, mime)
    if (mime.startsWith('video/')) return askGemini(PROMPTS.video, buf, mime)
    if (mime === DOCX || ext === 'docx') return (await mammoth.extractRawText({ buffer: buf })).value.trim()
    if (mime === XLSX || ext === 'xlsx') {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(buf)
      const out = []
      wb.eachSheet((ws) => {
        out.push(`Sheet: ${ws.name}`)
        ws.eachRow({ includeEmpty: false }, (row) => {
          const cells = (row.values || []).slice(1).map((v) => {
            if (v == null) return ''
            if (typeof v === 'object') return v.result ?? v.text ?? v.richText?.map((r) => r.text).join('') ?? (v instanceof Date ? v.toISOString().slice(0, 10) : JSON.stringify(v))
            return String(v)
          })
          out.push(cells.join(' | '))
        })
      })
      return out.join('\n')
    }
    if (TEXT_MIMES.test(mime) || ['txt', 'csv', 'json', 'md', 'xml', 'html', 'log', 'vcf'].includes(ext)) return buf.toString('utf8')
    throw new Error(`Can't read this file type yet (${fileName || mime}). Supported: voice notes, audio, photos, videos, PDF, Word (.docx), Excel (.xlsx) and text files.`)
  }

  // Read one attachment (cached). `force` re-reads even if a result exists.
  async function read(chatJid, id, { force = false } = {}) {
    const hit = cached(id)
    if (hit?.text && !force) return hit
    if (inflight.has(id)) return inflight.get(id)
    const job = (async () => {
      const now = Math.floor(Date.now() / 1000)
      let media
      try {
        media = await fetchMedia(chatJid, id)
      } catch (e) {
        putStmt.run(chatJid, id, null, null, null, e.message, now)
        throw e
      }
      try {
        let text = (await extract(media)).trim()
        if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT) + `\n… [cut: ${text.length - MAX_TEXT} more characters]`
        if (!text) text = '(nothing readable in this attachment)'
        putStmt.run(chatJid, id, media.kind, media.mime, text, null, now)
        log(`📎 read ${media.kind} ${id} (${(media.buf.length / 1024).toFixed(0)} KB)`)
        return cached(id)
      } catch (e) {
        putStmt.run(chatJid, id, media.kind, media.mime, null, e.message, now)
        throw e
      }
    })().finally(() => inflight.delete(id))
    inflight.set(id, job)
    return job
  }

  // Background queue for new voice notes, one at a time so we stay inside rate limits.
  const queue = []
  let running = false
  function enqueue(chatJid, id) {
    if (cached(id)?.text || queue.some((j) => j.id === id)) return
    queue.push({ chatJid, id })
    if (!running) drain()
  }
  async function drain() {
    running = true
    while (queue.length) {
      const { chatJid, id } = queue.shift()
      await read(chatJid, id).catch((e) => log(`📎 could not read ${id}: ${e.message}`))
    }
    running = false
  }

  return { read, cached, enqueue }
}

// Demo mode (DEMO_MODE=1): every account gets the same made-up WhatsApp for screenshots, recordings and trying
// Wavelink without a phone. No WhatsApp connection is opened and nothing is ever sent: "sending" only adds the
// message to the demo chats. The sample chats are reloaded with fresh times every time the server starts.
//
// Every name, business and number here is invented. Numbers use the +1 555 0100 range, which is reserved for fiction.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets')
const pn = (n) => `1555010${n}@s.whatsapp.net`

export const DEMO_OWNER = { jid: pn('0000'), name: 'Rohan Mehta' }

const P = {
  priya: { jid: pn('0011'), name: 'Priya Sharma' },
  sam: { jid: pn('0012'), name: 'Sam' },
  ravi: { jid: pn('0013'), name: 'Ravi Kumar' },
  neha: { jid: pn('0014'), name: 'Neha Kapoor' },
  mom: { jid: pn('0015'), name: 'Mom' },
  arjun: { jid: pn('0016'), name: 'Arjun (CA)' },
  kabir: { jid: pn('0017'), name: 'Kabir' },
  ananya: { jid: pn('0018'), name: 'Ananya' },
  vikram: { jid: pn('0019'), name: 'Vikram' },
}
const G = {
  sales: { jid: '120363000000000001@g.us', name: 'Sales team' },
  accounts: { jid: '120363000000000002@g.us', name: 'Accounts' },
}

const FILES = {
  invoice: { file: 'priya-invoice.jpg', kind: 'imageMessage', mime: 'image/jpeg' },
  voice: { file: 'sam-voice-note.ogg', kind: 'audioMessage', mime: 'audio/ogg; codecs=opus', ptt: true, seconds: 8 },
  rates: { file: 'ravi-rates-december.pdf', kind: 'documentMessage', mime: 'application/pdf', fileName: 'Ravi Textiles - December rates.pdf' },
}

// What Wavelink would have extracted from each attachment, so the demo works the same with or without a Gemini key.
const READ = {
  invoice: `A printed invoice from Sharma Interiors to Mehta Traders, photographed on a desk.
Text in image: SHARMA INTERIORS · Interior design & fit-out · Kolkata. Bill to: Mehta Traders, Attn: Rohan Mehta. Invoice INV-2041. Date: 4 Nov. Due: 18 Nov. Showroom display shelving × 6: 31,200. Lighting fit-out × 1: 9,800. Site visits & design × 2: 3,000. GST 10%: 4,400. Total due: INR 48,400. Bank transfer to Sharma Interiors, ref INV-2041.
Key details: from Sharma Interiors to Mehta Traders, INR 48,400, due 18 Nov, reference INV-2041.`,
  voice: `Transcript: Bhai, 5 baje wali meeting thodi late kar sakte hain? Saade paanch? Aur venue bhi change ho gaya hai, ab Park Street office mein hai.
English: Can we push the 5 o'clock meeting a little? Half past five? And the venue has changed too, it's now at the Park Street office.`,
  rates: `Summary: Ravi Textiles' fabric rate list for December, sent to Mehta Traders. Cotton fabrics are up 4% from November, linen blend is unchanged and rayon print is up 2%. Rates hold for orders confirmed by 15 December.
Content:
Fabric | Width | Rate per metre (INR) | Change from Nov
Cotton poplin 40s | 58" | 96 | +4%
Cotton twill | 58" | 142 | +4%
Linen blend | 56" | 265 | no change
Rayon print | 44" | 88 | +2%
Minimum order 500 metres per fabric. Delivery in 7–10 days from confirmation. Payment: 50% advance, balance on delivery.`,
}

// [chat, who ('me' or a person key), hours ago, text, attachment?]
const H = 3600
const THREADS = [
  // a client chasing an invoice: needs a reply
  [P.priya, 'priya', 52, 'Hi Rohan, sharing the invoice for the showroom work.'],
  [P.priya, 'priya', 51.9, 'INV-2041', 'invoice'],
  [P.priya, 'me', 50, 'Thanks Priya, will process it this week.'],
  [P.priya, 'priya', 7, 'Hi Rohan, any update on INV-2041? It was due on the 18th.'],
  [P.priya, 'priya', 3.2, 'Can you confirm by tonight?'],
  // a friend moving a meeting, by voice note
  [P.sam, 'me', 26, 'Sam, 5pm tomorrow at your office works?'],
  [P.sam, 'sam', 25.8, 'Done 👍'],
  [P.sam, 'sam', 1.4, '', 'voice'],
  // a busy group that doesn't need the owner
  [G.sales, 'kabir', 6.1, 'Morning all. October closed at 38L against a 42L target.'],
  [G.sales, 'ananya', 6, 'Retail was strong. Wholesale slowed down after Diwali.'],
  [G.sales, 'vikram', 5.9, 'For Q4 I think 46L is doable if the new showroom opens on time.'],
  [G.sales, 'kabir', 5.7, 'Agreed, 46L for Q4. Ananya can you split it by region?'],
  [G.sales, 'ananya', 5.5, 'Yes, will share by tomorrow.'],
  [G.sales, 'vikram', 4.9, 'Who is making the review deck?'],
  [G.sales, 'kabir', 4.8, "I'll do the deck. Due Friday."],
  [G.sales, 'ananya', 4.6, '👍'],
  [G.sales, 'vikram', 2.1, 'Showroom electrician confirmed for Monday.'],
  // a supplier with a rate list
  [P.ravi, 'ravi', 4.2, 'Namaste Rohan ji, December rate list attached.'],
  [P.ravi, 'ravi', 4.19, 'December rates', 'rates'],
  [P.ravi, 'ravi', 4.1, 'Cotton is up 4% this month. Please confirm the order by the 15th to lock these rates.'],
  // accounts
  [G.accounts, 'arjun', 74, 'GST filing for November is due on the 20th. Please send all purchase bills by Monday.'],
  [G.accounts, 'me', 73, 'Noted, will send.'],
  [G.accounts, 'arjun', 9, 'Reminder: still waiting for 3 purchase bills from Ravi Textiles.'],
  // a designer
  [P.neha, 'neha', 28, 'Brochure draft v2 is almost ready.'],
  [P.neha, 'neha', 2.6, 'Sent the brochure on email. Page 2 has the new showroom photos, let me know what you think 🙂'],
  // family
  [P.mom, 'mom', 0.8, 'Beta khana kha liya? Shaam ko aate waqt doodh le aana.'],
]

const SUMMARIES = {
  [P.priya.jid]: ['Priya has asked twice about invoice INV-2041 for INR 48,400, which was due on the 18th, and wants confirmation of payment by tonight.', 1, 'high'],
  [P.sam.jid]: ['Sam sent a voice note asking to move the 5 pm meeting to 5:30, and says the venue is now the Park Street office.', 1, 'high'],
  [G.sales.jid]: ['The team agreed a Q4 target of 46L after October closed at 38L against 42L; Kabir is making the review deck, due Friday, and Ananya will split the target by region. Nothing is waiting on you.', 0, 'normal'],
  [P.ravi.jid]: ["Ravi sent December fabric rates: cotton up 4%, linen unchanged, rayon up 2%. Orders must be confirmed by the 15th to lock the rates.", 1, 'normal'],
  [G.accounts.jid]: ['Arjun is still waiting for 3 purchase bills from Ravi Textiles for the November GST filing due on the 20th.', 1, 'high'],
  [P.neha.jid]: ['Neha emailed the brochure draft; page 2 has the new showroom photos and she wants your feedback.', 1, 'normal'],
  [P.mom.jid]: ['Mom asked if you have eaten and wants you to bring milk on the way home.', 1, 'low'],
}

const MEMORIES = [
  'Priya Sharma (Sharma Interiors) is a client. Keep replies to her formal and polite.',
  'Ravi Kumar runs Ravi Textiles, our cotton supplier.',
  'Arjun is our CA and handles GST filings.',
]

export const DEMO_BRIEF = 'Priya is waiting on you about invoice INV-2041 (INR 48,400, overdue) and wants confirmation by tonight, and Sam wants to move the 5 pm meeting to 5:30 at the Park Street office. Arjun still needs 3 purchase bills from Ravi Textiles for GST; the Sales team agreed a 46L Q4 target and needs nothing from you.'

const msgId = (i) => `3EB0DE40${String(i).padStart(8, '0')}`

/** Replace this account's chats with the demo chats, timed relative to now. */
export function seedDemo({ db, cacheDir }) {
  const now = Math.floor(Date.now() / 1000)
  db.exec('DELETE FROM messages; DELETE FROM chats; DELETE FROM contacts; DELETE FROM summaries; DELETE FROM autoreplies; DELETE FROM attachments; DELETE FROM memories')
  fs.rmSync(cacheDir, { recursive: true, force: true })
  fs.mkdirSync(cacheDir, { recursive: true })

  const contact = db.prepare('INSERT OR REPLACE INTO contacts (jid, alt_jid, name, notify) VALUES (?, NULL, ?, ?)')
  for (const p of Object.values(P)) contact.run(p.jid, p.name, p.name.split(' ')[0])
  const chat = db.prepare('INSERT OR REPLACE INTO chats (jid, alt_jid, name, is_group, last_ts) VALUES (?, NULL, ?, ?, ?)')
  const msg = db.prepare(`INSERT OR REPLACE INTO messages (chat_jid, id, from_jid, from_name, from_me, ts, text, media_type, raw)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  const att = db.prepare('INSERT OR REPLACE INTO attachments (chat_jid, id, kind, mime, text, error, updated_ts) VALUES (?, ?, ?, ?, ?, NULL, ?)')
  const lastId = new Map()
  const lastTs = new Map()

  THREADS.forEach(([c, who, hoursAgo, text, file], i) => {
    const id = msgId(i + 1)
    const ts = now - Math.round(hoursAgo * H)
    const group = c.jid.endsWith('@g.us')
    const fromMe = who === 'me'
    const person = fromMe ? null : P[who]
    let message
    let media = null
    if (file) {
      const f = FILES[file]
      message = { [f.kind]: { mimetype: f.mime, ...(text ? { caption: text } : {}), ...(f.fileName ? { fileName: f.fileName } : {}), ...(f.ptt ? { ptt: true, seconds: f.seconds } : {}) } }
      media = f.ptt ? 'voice_note' : f.kind.replace('Message', '')
      fs.copyFileSync(path.join(ASSETS, f.file), path.join(cacheDir, id))
      att.run(c.jid, id, media, f.mime.split(';')[0], READ[file], now)
    } else message = { conversation: text }
    const shown = file === 'rates' ? `${FILES.rates.fileName} — ${text}` : text
    const key = { remoteJid: c.jid, fromMe, id, ...(group && person ? { participant: person.jid } : {}) }
    const raw = JSON.stringify({ key, message, messageTimestamp: ts, ...(person ? { pushName: person.name.split(' ')[0] } : {}) })
    msg.run(c.jid, id, fromMe ? DEMO_OWNER.jid : person.jid, fromMe ? 'Me' : person.name, fromMe ? 1 : 0, ts, shown, media, raw)
    lastId.set(c.jid, id)
    lastTs.set(c.jid, ts)
  })

  for (const c of [...Object.values(P), ...Object.values(G)]) {
    if (lastTs.has(c.jid)) chat.run(c.jid, c.name, c.jid.endsWith('@g.us') ? 1 : 0, lastTs.get(c.jid))
  }
  const sum = db.prepare(`INSERT OR REPLACE INTO summaries (chat_jid, last_msg_id, since_ts, summary, needs_reply, priority, updated_ts)
    VALUES (?, ?, 0, ?, ?, ?, ?)`)
  for (const [jid, [s, reply, prio]] of Object.entries(SUMMARIES)) sum.run(jid, lastId.get(jid), s, reply, prio, now)
  const mem = db.prepare('INSERT INTO memories (text, created) VALUES (?, ?)')
  for (const m of MEMORIES) mem.run(m, now)
}

/**
 * Stands in for the WhatsApp connection. sendMessage builds the message WhatsApp would have returned, keeps any
 * attached file in the media cache so the dashboard can open it, and sends nothing anywhere.
 */
export function createDemoSocket({ cacheDir, BufferJSON }) {
  const newId = () => '3EB0' + crypto.randomBytes(8).toString('hex').toUpperCase()
  const keep = (id, buf) => {
    if (!Buffer.isBuffer(buf)) return
    fs.mkdirSync(cacheDir, { recursive: true })
    fs.writeFileSync(path.join(cacheDir, id), buf)
  }
  const FORWARDED = { isForwarded: true, forwardingScore: 1 }
  return {
    user: { id: DEMO_OWNER.jid, name: DEMO_OWNER.name },
    async sendMessage(jid, content, opts = {}) {
      const id = newId()
      const q = opts.quoted
      const ctx = q ? { stanzaId: q.key.id, participant: q.key.participant || q.key.remoteJid, quotedMessage: q.message } : null
      let message
      if (content.forward) {
        message = JSON.parse(JSON.stringify(content.forward.message, BufferJSON.replacer), BufferJSON.reviver)
        if (message.conversation != null) message = { extendedTextMessage: { text: message.conversation, contextInfo: FORWARDED } }
        else {
          const k = Object.keys(message).find((x) => x.endsWith('Message'))
          if (k) message[k].contextInfo = { ...(message[k].contextInfo || {}), ...FORWARDED }
        }
        const from = path.join(cacheDir, String(content.forward.key?.id || '').replace(/[^\w-]/g, '_'))
        if (fs.existsSync(from)) fs.copyFileSync(from, path.join(cacheDir, id))
      } else if (content.text != null) {
        message = ctx ? { extendedTextMessage: { text: content.text, contextInfo: ctx } } : { conversation: content.text }
      } else {
        const k = ['image', 'video', 'audio', 'document', 'sticker'].find((x) => content[x])
        if (!k) throw new Error('Demo mode can send text, files and forwards.')
        keep(id, content[k])
        message = { [`${k}Message`]: {
          mimetype: content.mimetype || 'application/octet-stream',
          ...(content.caption ? { caption: content.caption } : {}),
          ...(content.fileName ? { fileName: content.fileName } : {}),
          ...(content.ptt ? { ptt: true } : {}),
          ...(ctx ? { contextInfo: ctx } : {}),
        } }
      }
      return { key: { remoteJid: jid, fromMe: true, id }, message, messageTimestamp: Math.floor(Date.now() / 1000), status: 2 }
    },
    async groupCreate(subject) {
      return { id: `120363${Date.now()}@g.us`, subject }
    },
    async updateMediaMessage() {
      throw new Error('This demo attachment is missing.')
    },
    async logout() {},
    end() {},
  }
}

export type Tool = { name: string; purpose: string; kind: "read" | "write" };
export type ToolGroup = { title: string; tools: Tool[] };

/** Source: docs/mcp-tools.md. Read tools carry readOnlyHint, write tools destructiveHint:false. */
export const toolGroups: ToolGroup[] = [
  {
    title: "Catching up",
    tools: [
      { name: "whatsapp_brief", purpose: "AI briefing of the period plus one line per chat with new messages, marked by priority and whether a reply is owed.", kind: "read" },
      { name: "whatsapp_waiting", purpose: "People (not groups) whose last message has not been answered, newest first.", kind: "read" },
      { name: "whatsapp_status", purpose: "Connected or not, the linked number, chats and messages stored, whether AI is configured.", kind: "read" },
    ],
  },
  {
    title: "Reading",
    tools: [
      { name: "whatsapp_list_chats", purpose: "Recent chats with their last message.", kind: "read" },
      { name: "whatsapp_read_messages", purpose: "Messages oldest to newest with ids; attachments show their transcript when already read.", kind: "read" },
      { name: "whatsapp_search_messages", purpose: "Full-text search across stored messages, optionally within one chat.", kind: "read" },
      { name: "whatsapp_search_contacts", purpose: "Contacts and groups matching a name or number, with jids.", kind: "read" },
      { name: "whatsapp_read_attachment", purpose: "Voice notes transcribed, photos described with all visible text, videos summarised, PDFs and Office files extracted. Cached per file.", kind: "read" },
    ],
  },
  {
    title: "Writing",
    tools: [
      { name: "whatsapp_draft_reply", purpose: "Writes a reply in the owner's own style from the conversation and saved memories. Nothing is sent.", kind: "write" },
      { name: "whatsapp_send_message", purpose: "New text message to a person or group. WhatsApp formatting works.", kind: "write" },
      { name: "whatsapp_reply", purpose: "Quoted reply to a specific message.", kind: "write" },
      { name: "whatsapp_forward_message", purpose: "Forwards up to 30 messages, media included, to up to 5 chats as real WhatsApp forwards in their original order. View-once messages are refused.", kind: "write" },
      { name: "whatsapp_send_file", purpose: "Sends media or a document from a public link or uploaded data, with SSRF protection and a 30 MB cap.", kind: "write" },
      { name: "whatsapp_create_group", purpose: "Creates a group with the given numbers or contact names.", kind: "write" },
    ],
  },
  {
    title: "Memory",
    tools: [
      { name: "whatsapp_remember", purpose: "Saves a lasting fact or preference, used by future requests, drafts and auto-replies.", kind: "write" },
      { name: "whatsapp_memories", purpose: "Lists saved notes with ids.", kind: "read" },
      { name: "whatsapp_forget", purpose: "Deletes a note.", kind: "write" },
    ],
  },
  {
    title: "Automation",
    tools: [
      { name: "whatsapp_auto_reply", purpose: "View or change AI auto-reply for 1:1 chats: off, allowlist or all, with excludes and a pause. Groups are never auto-replied.", kind: "write" },
    ],
  },
  {
    title: "Organisations",
    tools: [
      { name: "whatsapp_accounts", purpose: "Superadmin only. Lists every account in the organisation with its link status.", kind: "read" },
    ],
  },
];

export const toolCount = toolGroups.reduce((n, g) => n + g.tools.length, 0);

/** Source: README "Link your phone once" line. */
export const prompts = [
  "What did I miss on WhatsApp today?",
  "Who is waiting on my reply?",
  "What did Priya say about the invoice?",
  "Open Sam's voice note and tell me what it says",
  "Draft a reply to Alex saying I'll join at 5",
  "Reply to Priya: payment done ✅",
  "Send this PDF to the Sales group",
  "Remember that Priya is my accountant, keep it formal with her",
];

/** Source: docs/deploy/README.md "Pick one" table. */
export const platforms = [
  { name: "Docker Compose", where: "Any VPS or home server", cost: "~$4–6/month", effort: "10 minutes, one command", href: "/docs/deploy/docker" },
  { name: "AWS Lightsail", where: "Fixed-price VM, static IP", cost: "$12/month for 2 GB", effort: "15 minutes, one script", href: "/docs/deploy/lightsail" },
  { name: "Ubuntu VPS", where: "systemd + Caddy, no Docker", cost: "~$4–6/month", effort: "15 minutes, one script", href: "/docs/deploy/vps" },
  { name: "Railway", where: "Two services, one volume", cost: "pay as you go, ~$5–10/month", effort: "10 minutes in the UI", href: "/docs/deploy/railway" },
  { name: "Fly.io", where: "Two apps, one volume", cost: "pay as you go, ~$5/month", effort: "15 minutes with flyctl", href: "/docs/deploy/fly" },
  { name: "Render", where: "Blueprint, paid plan for a disk", cost: "paid plan required", effort: "10 minutes with a Blueprint", href: "/docs/deploy/render" },
];

/** Source: docs/dashboard.md. */
export const dashboardPages = [
  { name: "Overview", text: "An AI brief of the period, stat cards, summary cards grouped into Needs your reply, Groups and Everything else, an incoming-by-hour chart, your MCP connector URL and the editable list of what the AI remembers." },
  { name: "Inbox", text: "Every chat, newest first, with a badge for messages waiting on you. Photos, voice notes, videos and documents load inline. Reply, forward several messages at once to any contact or group, send files, turn what you typed into English, or ask for an AI draft in your style. Nothing is sent until you press Send." },
  { name: "Auto-reply", text: "Global Off / Selected / Everyone, plus a Default / On / Off switch per chat. Groups are never auto-replied, and it stays quiet after you reply by hand." },
  { name: "Summaries", text: "One or two lines per chat with new messages over 6h, 24h, 3d or 7d, ranked by needs-reply and priority. Cached until a chat gets a new message." },
  { name: "Account", text: "Your linked number, chats stored, change password, unlink WhatsApp, and the log of any superadmin views of your account." },
  { name: "Users", text: "Superadmin only: create accounts, reset passwords, disable, delete. Shows link status and connection count, never chats." },
];

/** Source: docs/security.md. */
export const guarantees = [
  { title: "Per-user isolation", text: "Every request is bound to one user before it reaches any data. Each account has its own SQLite database, WhatsApp login and media folder." },
  { title: "scrypt passwords", text: "N=16384, r=8, p=1, 64-byte keys, random salt. Never stored or logged in clear text." },
  { title: "PKCE-only OAuth, hashed tokens", text: "PKCE with S256 is mandatory. One-hour access tokens, rotating 30-day refresh tokens, only SHA-256 hashes stored. Password change revokes every token." },
  { title: "SSRF-safe link fetching", text: "Every redirect hop is checked against private, loopback, link-local and metadata ranges, the connection is pinned to the checked address, 30 MB and 20 s caps." },
  { title: "Sandboxed media", text: "HTML and SVG from strangers download instead of rendering; images and PDFs render inline under a sandboxed content policy." },
  { title: "No server file access", text: "The AI can only act through the tools. There is no run-a-command or read-a-server-file tool, and files on the server can never be sent." },
  { title: "Tested on every change", text: "The suite in service/test runs the service with fake data and checks these boundaries on every change." },
];

export const notProtected = [
  { title: "Data at rest is not encrypted.", text: "DATA_DIR holds WhatsApp login keys and every synced message in clear SQLite files. Protect the disk yourself." },
  { title: "Gemini sees your messages.", text: "Transcripts, summaries, drafts and auto-replies send text and media to Google's API under your key. Leave the key empty if that is not acceptable; sync and send keep working." },
  { title: "Unofficial client.", text: "Wavelink uses the WhatsApp Web protocol via Baileys, not the Business API. Accounts that behave like spam can be banned. Use it on your own number, at human pace." },
  { title: "Prompt injection is limited, not eliminated.", text: "Messages people send you become context for the AI. A convincing message can still make an assistant draft something misleading. Read before you send." },
];

export const faq = [
  { q: "Is this official?", a: "No. Wavelink is an independent open-source project, not affiliated with WhatsApp, Meta, OpenAI, Anthropic or Google. It speaks the WhatsApp Web protocol through the Baileys library, the same way WhatsApp Web links a browser." },
  { q: "Will my number get banned?", a: "WhatsApp's terms do not allow automated or bulk messaging, and accounts that behave like spam can be banned. Wavelink is built for one person reading and replying to their own conversations at human pace, with the AI showing the exact text and recipient before anything is sent. Use it that way." },
  { q: "Which AI apps work?", a: "ChatGPT (custom MCP connector with OAuth), Claude on claude.ai and Claude Desktop (custom connector), Claude Code, Cursor, Windsurf, Zed, VS Code, Continue, Goose, and anything built on the official MCP SDKs. Any client that can talk to a remote MCP server over Streamable HTTP." },
  { q: "Does it need the WhatsApp Business API?", a: "No. There is no Business API approval, no templates and no per-message pricing. You link your phone as a device, like WhatsApp Web. The trade-off is that the client is unofficial." },
  { q: "Where is my data?", a: "On your server, under DATA_DIR: an accounts database plus one folder per user with the WhatsApp login keys, a SQLite file with chats and messages, and downloaded media. Nothing passes through a third party except the AI you choose to connect. Data at rest is not encrypted; back up and protect the disk." },
  { q: "What does Gemini see?", a: "Transcripts, image and PDF reading, summaries, drafts and auto-replies send message text and media to Google's Gemini API under your own key. Leave GEMINI_API_KEY empty and those features switch off while sync and sending keep working." },
  { q: "Can several people use one install?", a: "Yes, from the first start. Each account links its own phone, has its own database and files, and signs in to its own AI apps. A superadmin can read other accounts but never send, and every view is logged and shown to the owner." },
  { q: "Is it free?", a: "Wavelink is MIT licensed and free to run. You pay for the server you host it on (from about $4 a month) and for Gemini API usage under your key." },
];

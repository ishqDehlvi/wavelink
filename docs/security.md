# Security model

Wavelink handles private conversations and can send messages as you. This page lists what protects that, and what does not.

## Isolation between accounts

- Every request is bound to exactly one user before it reaches any data: dashboard calls carry the user id and session version (checked against the database on each call), MCP calls carry an OAuth token that belongs to one user.
- Each account has its own SQLite database, WhatsApp login and media folder.
- A superadmin may read other accounts, never write, and every read is logged and visible to the account owner. Write tools refuse any `account` argument, so a prompt injection in someone's chat cannot make the superadmin's AI send from another number.
- The test suite in `service/test/` runs the service with fake data and checks these boundaries on every change (`npm test`).

## Authentication

- Passwords are hashed with scrypt (N=16384, r=8, p=1, 64-byte keys, random salt).
- Dashboard sessions are HMAC-SHA256-signed cookies (`HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS) that name a user and a session version. Password change, reset and disable bump the version, which signs the user out everywhere immediately.
- OAuth follows the MCP authorization spec: PKCE with S256 is mandatory, access tokens live one hour, refresh tokens rotate and live 30 days, only hashes are stored. Password change, disable and delete revoke every token.
- Sign-in attempts are rate limited per address, and dynamic client registration is capped at 20 per address per hour.

## What the AI can and cannot make the server do

- It can only act through the tools. There is no "run a command" or "read a server file" tool.
- `whatsapp_send_file` accepts public links or data the client uploads. A link is resolved, every hop of the redirect chain is checked against private, loopback, link-local and metadata address ranges, and the connection is pinned to the checked address so DNS cannot switch it. Size is capped at 30 MB and time at 20 seconds (`netsafe.js`).
- Media served to the dashboard is sandboxed: HTML and SVG from strangers download instead of rendering, images and PDFs render inline under a sandboxed content policy.
- MCP request bodies are capped (about 45 MB, enough for a 30 MB attachment).

## Notion

- One Notion connection serves the organisation; its token is stored encrypted (AES-256-GCM) with a key from `NOTION_SECRET_KEY` or `DATA_DIR/.notion-key`.
- Access is checked by Wavelink on every request, page by page, before anything is sent to Notion; the dashboard and MCP tools share the same check. A page someone can't read answers as if it doesn't exist.
- Every Notion change made through Wavelink is logged with the person and the channel.

## Transport

- The service listens on loopback by default. Only a reverse proxy should expose `/mcp`, `/oauth/*` and `/.well-known/*`, over HTTPS.
- The dashboard sets `X-Frame-Options: DENY`, a CSP with `frame-ancestors 'none'`, `form-action 'self'`, `nosniff` and a strict referrer policy.
- Signal protocol noise that could include key material is filtered out of the service logs.

## What is not protected

- **Data at rest is not encrypted.** `DATA_DIR` holds WhatsApp login keys and every synced message in clear SQLite files. Protect the disk (full-disk encryption, restricted volume access, backups you control).
- **The `MCP_TOKEN` link is a password.** `http://host:3940/mcp/<token>` acts as the superadmin without OAuth. Keep the service on loopback or a private network.
- **Gemini sees your messages.** Transcripts, summaries, drafts and auto-replies send message text and media to Google's API under your key. Leave `GEMINI_API_KEY` empty if that is not acceptable; the sync and send features keep working.
- **The AI app sees what you ask for.** Tool results flow into ChatGPT or Claude under those providers' terms.
- **Unofficial client.** Wavelink uses the WhatsApp Web protocol via Baileys, not the official Business API. WhatsApp's terms do not allow automated or bulk messaging, and accounts that behave like spam can be banned. Use it on your own number, for your own conversations, at human pace.
- **Prompt injection.** Messages people send you become context for the AI. Wavelink limits the blast radius (no server access, show-before-send instructions, read-only cross-account access), but a convincing message can still make an assistant draft something misleading. Read before you send.

## Reporting a vulnerability

See [SECURITY.md](../SECURITY.md). Please do not open public issues for security problems.

<p align="center">
  <h1 align="center">Wavelink</h1>
  <p align="center"><b>Your WhatsApp and Notion, inside ChatGPT and Claude.</b><br>
  Open-source, self-hosted <b>WhatsApp MCP server</b> + dashboard: catch up on chats, transcribe voice notes, draft replies and send messages from ChatGPT, Claude, Claude Code, Cursor, VS Code, Windsurf or Zed. Your team's <b>Notion</b> comes along too, shared page by page.</p>
  <p align="center"><a href="https://wavelink.inzemam.tech">Website</a> · <a href="https://wavelink.inzemam.tech/docs">Docs</a> · <a href="https://wavelink.inzemam.tech/blog">Blog</a> · <a href="https://news.ycombinator.com/item?id=50645583">Show HN discussion</a></p>
</p>

<p align="center">
  <a href="https://github.com/ishqDehlvi/wavelink/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/ishqDehlvi/wavelink/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-16c47f.svg"></a>
  <img alt="Node 24" src="https://img.shields.io/badge/node-%3E%3D24-333.svg">
  <img alt="MCP" src="https://img.shields.io/badge/protocol-MCP-6b4fff.svg">
  <a href="https://news.ycombinator.com/item?id=50645583"><img alt="Show HN" src="https://img.shields.io/badge/Show%20HN-discuss-ff6600.svg?logo=ycombinator&logoColor=white"></a>
  <a href="https://github.com/ishqDehlvi/wavelink/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/ishqDehlvi/wavelink?style=social"></a>
</p>

---

Link your phone once, like WhatsApp Web. Then ask ChatGPT, Claude, Cursor or any MCP client:

> "What did I miss on WhatsApp today?" · "Who is waiting on my reply?" · "What did Priya say about the invoice?" · "Open Sam's voice note and tell me what it says" · "Draft a reply to Alex saying I'll join at 5" · "Reply to Priya: payment done ✅" · "Forward Priya's invoice to Sam" · "Send this PDF to the Sales group" · "Remember that Priya is my accountant, keep it formal with her"

The AI shows the exact text and recipient before anything is sent. You run the whole thing on your own server; messages never pass through a third party except the AI you choose to connect.

**In short:** Wavelink connects WhatsApp to ChatGPT and Claude through the Model Context Protocol (MCP). It is a free, MIT-licensed alternative to hosted "WhatsApp + AI" services and to the WhatsApp Business API for one person's own chats: no Business API approval, no per-message pricing, Hindi and Hinglish voice notes transcribed to English, and every reply approved by you.

## What you get

- **19 WhatsApp MCP tools**, plus 8 for Notion, over Streamable HTTP with OAuth 2.1: brief, waiting-on-me, read, search, attachments, draft, send, reply, forward, files, groups, memory, auto-reply; search, read, create, edit, comment and archive Notion pages. Works with ChatGPT custom connectors, Claude (claude.ai, Desktop, Claude Code), Cursor and the official SDKs.
- **Attachments become text.** Voice notes are transcribed (with an English translation), photos and screenshots are described with every visible amount, date and name, videos are summarised with their speech, PDFs and Office files are extracted. Once per file, then cached.
- **Notion for the whole team.** A superadmin connects Notion once and ticks, per person and per page, who may read, edit, add pages, comment or archive. The same rules apply in the dashboard and in every AI app: "add a row to Clients", "what does the leave policy say?". Some people can be Notion only, without WhatsApp.
- **A dashboard** with a home page for the day, an AI brief, an inbox that flags who needs a reply, chat summaries, AI drafts in your own style, an English button that turns what you typed into English before you send, WhatsApp-style multi-message forwarding to any contact or group, file sending and per-chat auto-reply switches, and your Notion pages next to your chats.
- **Multi-user from day one.** Each person links their own phone and connects their own AI app. A superadmin manages accounts and can read, never send, with every view logged and shown to the owner.
- **Security that is tested, not promised.** Per-user isolation, scrypt passwords, PKCE-only OAuth with hashed tokens, SSRF-safe link fetching, sandboxed media, no server file access for the AI, and a test suite that checks all of it on every change.
- **Deploy in ten minutes** with Docker Compose and automatic HTTPS, or one script on any Ubuntu VPS or AWS Lightsail, or the guides for Railway, Fly.io and Render.

## Quick start

```bash
git clone https://github.com/ishqDehlvi/wavelink.git && cd wavelink
cp .env.example .env     # set MCP_TOKEN, AUTH_SECRET and GEMINI_API_KEY
docker compose up -d
```

Open `http://localhost:3100`, sign in as `admin` (the generated password is at `/data/initial-admin-password.txt` inside the `service` container), and scan the QR code with WhatsApp → Linked devices.

To let ChatGPT or Claude reach it from the internet, give it a domain ([Docker guide](docs/deploy/docker.md)) or, on a laptop, tunnel port 3940 and set `PUBLIC_URL`. Full steps, including the no-Docker path: [Quick start](docs/quickstart.md).

No phone handy, or recording a demo? `cd service && npm run demo` starts Wavelink with made-up chats that never touch WhatsApp: [Demo mode](docs/demo-mode.md).

To add your team's Notion, create a Notion OAuth connection, set `NOTION_CLIENT_ID` and `NOTION_CLIENT_SECRET`, and press **Connect Notion** as the superadmin: [Notion](docs/notion.md).

## Connect your AI app

| App | How |
|---|---|
| ChatGPT | Plugins → Add → Add custom MCP server → URL `https://<your-domain>/mcp` → OAuth. [Guide](docs/connect/chatgpt.md) |
| Claude (claude.ai, Desktop) | Settings → Connectors → Add custom connector → same URL. [Guide](docs/connect/claude.md) |
| Claude Code | `claude mcp add --transport http wavelink https://<your-domain>/mcp` |
| Cursor and others | `{"mcpServers":{"wavelink":{"url":"https://<your-domain>/mcp"}}}`. [Guide](docs/connect/other-clients.md) |
| Same machine, no OAuth | `http://127.0.0.1:3940/mcp/<MCP_TOKEN>` acts as the superadmin |

Each person signs in with their own Wavelink username and password on an OAuth page the server hosts, so an AI app only ever reaches that person's WhatsApp.

## How it works

```
phone ──WhatsApp multi-device──► service (Node 24)  ──/api──► dashboard (Next.js) ──► browser
                                  │  Baileys socket · SQLite per user · Gemini
                                  │  OAuth 2.1 · MCP tools
                                  └──/mcp──► ChatGPT · Claude · Cursor · your agents
```

One Node process owns the WhatsApp connections, the data and both interfaces. The dashboard is a separate Next.js app that never holds secrets in the browser. A reverse proxy (Caddy configs included) exposes `/mcp`, `/oauth/*` and `/.well-known/*` to the internet and everything else to the dashboard. Details: [Architecture](docs/architecture.md).

## Deploy

| Where | Guide |
|---|---|
| Docker Compose on any server, HTTPS included | [docs/deploy/docker.md](docs/deploy/docker.md) |
| AWS Lightsail | [docs/deploy/lightsail.md](docs/deploy/lightsail.md) |
| Any Ubuntu VPS (Hetzner, DigitalOcean, EC2), systemd + Caddy | [docs/deploy/vps.md](docs/deploy/vps.md) |
| Railway | [docs/deploy/railway.md](docs/deploy/railway.md) |
| Fly.io | [docs/deploy/fly.md](docs/deploy/fly.md) |
| Render | [docs/deploy/render.md](docs/deploy/render.md) |

Requirements for any platform: one always-on process, a persistent disk, a public HTTPS address. [Choosing a platform](docs/deploy/README.md).

## MCP tools

`whatsapp_brief` · `whatsapp_waiting` · `whatsapp_status` · `whatsapp_list_chats` · `whatsapp_read_messages` · `whatsapp_search_messages` · `whatsapp_search_contacts` · `whatsapp_read_attachment` · `whatsapp_draft_reply` · `whatsapp_send_message` · `whatsapp_reply` · `whatsapp_forward_message` · `whatsapp_send_file` · `whatsapp_create_group` · `whatsapp_remember` · `whatsapp_memories` · `whatsapp_forget` · `whatsapp_auto_reply` · `whatsapp_accounts`

With Notion: `notion_search` · `notion_read_page` · `notion_query_database` · `notion_create_page` · `notion_update_page` · `notion_comment` · `notion_archive_page` · `notion_access`

Parameters and behaviour: [MCP tools reference](docs/mcp-tools.md).

## Repository layout

```
service/     Node service: WhatsApp, SQLite, Gemini, OAuth, MCP, REST   (npm start · npm test)
dashboard/   Next.js dashboard                                          (npm run dev)
website/     Marketing and docs site, wavelink's public page           (npm run dev)
docs/        Documentation, rendered by the website
deploy/      Caddy, VPS script, Fly and Render configs
```

## Documentation

[Quick start](docs/quickstart.md) · [Configuration](docs/configuration.md) · [Dashboard](docs/dashboard.md) · [Notion](docs/notion.md) · [Accounts](docs/accounts.md) · [Security model](docs/security.md) · [Troubleshooting](docs/troubleshooting.md) · [All docs](docs/README.md)

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the dev loop and `cd service && npm test` before you push. Security problems go through [SECURITY.md](SECURITY.md), not public issues.

## Disclaimer

Wavelink is an independent open-source project. It is not affiliated with, endorsed by or supported by WhatsApp LLC, Meta Platforms, OpenAI, Anthropic or Google. It uses the WhatsApp Web protocol through the Baileys library, which is not an official API; automated or bulk messaging is against WhatsApp's terms and can get a number banned. Use it on your own number, for your own conversations. The names WhatsApp, ChatGPT, Claude and Gemini are trademarks of their respective owners.

## Author

Built by [Inzemam](https://www.inzemam.tech/) ([@ishqDehlvi](https://github.com/ishqDehlvi)). More of my work is at [inzemam.tech](https://www.inzemam.tech/).

## License

[MIT](LICENSE)

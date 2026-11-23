# Quick start

Two ways to run Wavelink on your own machine. Both end with a dashboard on `http://localhost:3100` and an MCP endpoint that ChatGPT, Claude or Cursor can connect to.

You need:

- A phone with WhatsApp (Wavelink links as a "linked device", like WhatsApp Web).
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey). Optional, but without it there are no transcripts, summaries, drafts or auto-replies.
- Docker, or Node.js 24 or newer.

## Option A: Docker Compose

```bash
git clone https://github.com/ishqDehlvi/wavelink.git
cd wavelink
cp .env.example .env
```

Open `.env` and set three values:

```bash
MCP_TOKEN=$(openssl rand -base64 24)      # paste the output
AUTH_SECRET=$(openssl rand -base64 32)    # paste the output
GEMINI_API_KEY=...
```

Then:

```bash
docker compose up -d
docker compose logs service | grep -i password
```

The second command prints where the generated admin password went. Read it:

```bash
docker compose exec service cat /data/initial-admin-password.txt
```

Open `http://localhost:3100`, sign in as `admin`, and scan the QR code with WhatsApp (Settings → Linked devices → Link a device). Your chats start syncing within a minute.

## Option B: Node.js, no Docker

Terminal 1, the service:

```bash
git clone https://github.com/ishqDehlvi/wavelink.git
cd wavelink/service
npm ci
cp .env.example .env        # add GEMINI_API_KEY, leave the rest
npm start
```

On first start it creates the superadmin (`admin`) and prints the path of the generated password. It also writes a shared secret to `service/.mcp-token`.

Terminal 2, the dashboard:

```bash
cd wavelink/dashboard
npm ci
cp .env.example .env.local
```

Fill `.env.local`: `WA_API_TOKEN` is the contents of `service/.mcp-token`, `AUTH_SECRET` is any random string of 16+ characters. Then:

```bash
npm run dev
```

Open `http://127.0.0.1:3100`, sign in and scan the QR code.

## Connect your AI app

ChatGPT and Claude connect over the internet, so they need a public HTTPS address for the service. On a laptop the quickest way is a tunnel to port 3940:

```bash
cloudflared tunnel --url http://localhost:3940
```

Copy the `https://….trycloudflare.com` address it prints, set it as `PUBLIC_URL` (in `.env` or `service/.env`) and restart the service. The connector URL is then `PUBLIC_URL` + `/mcp`, and the dashboard's Overview page shows it with copy-paste steps.

Then follow [Connect ChatGPT](connect/chatgpt.md) or [Connect Claude](connect/claude.md).

Tools that run on the same machine, such as Claude Code or Cursor, do not need a tunnel. They can use the local link `http://127.0.0.1:3940/mcp/<MCP_TOKEN>`, which needs no OAuth and acts as the superadmin. See [other clients](connect/other-clients.md).

## Next

- Running it for real, on a server with a domain: [choose a platform](deploy/README.md).
- Giving teammates their own WhatsApp link and login: [accounts](accounts.md).
- What the AI can do once connected: [MCP tools](mcp-tools.md).

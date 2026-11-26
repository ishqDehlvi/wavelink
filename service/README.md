# Wavelink service

The Node 24 process that owns the WhatsApp connections, the per-account SQLite databases, the Gemini calls, the OAuth 2.1 authorization server, the REST API used by the dashboard and the MCP server used by ChatGPT, Claude and other clients.

```bash
npm ci
cp .env.example .env     # at least GEMINI_API_KEY; see ../docs/configuration.md
npm start                # http://127.0.0.1:3940
npm test                 # security and isolation suites on a throwaway instance
npm run bot              # unrelated standalone bot mode (a number that answers with an LLM)
```

| File | Role |
|---|---|
| `mcp.js` | Entry point: accounts, HTTP routing, `/api/*`, `/mcp`, `/mcp/<token>`, OAuth endpoints |
| `workspace.js` | One account: Baileys socket, SQLite, summaries, auto-reply, the 19 MCP tools, the REST resources |
| `oauth.js` | OAuth 2.1 authorization server (metadata, DCR, PKCE, hashed tokens) |
| `users.js` | Accounts, scrypt passwords, roles, session versions |
| `attachments.js` | Voice, image, video, PDF and Office files → text, cached |
| `netsafe.js` | SSRF-safe downloads for "send this link" |
| `bot.js` | Standalone bot mode |
| `test/` | `run.sh` plus three suites |

Endpoints: `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, `/oauth/register`, `/oauth/authorize`, `/oauth/token`, `/mcp` (bearer), `/mcp/<MCP_TOKEN>` (local, superadmin), `/api/*` (dashboard, `x-api-key`).

Documentation lives in [`../docs`](../docs/README.md).

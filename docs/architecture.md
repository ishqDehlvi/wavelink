# Architecture

```
  phone ──WhatsApp multi-device──┐
                                 ▼
   ┌───────────────────────────────────────────────────────────┐
   │  service  (Node 24, service/mcp.js)             :3940     │
   │                                                           │
   │   users.js      accounts, scrypt passwords, roles         │
   │   oauth.js      OAuth 2.1 AS: metadata, DCR, PKCE, tokens │
   │   workspace.js  one per account:                          │
   │                   Baileys socket  ·  SQLite store          │
   │                   Gemini: transcripts, summaries, drafts   │
   │                   auto-reply  ·  19 MCP tools  ·  REST     │
   │   attachments.js media → text, cached                     │
   │   netsafe.js     SSRF-safe downloads for "send this link"  │
   └───────┬───────────────────────┬───────────────────────────┘
           │ /api/*  x-api-key +   │ /mcp (OAuth bearer)
           │ user id (server only) │ /mcp/<token> (local, superadmin)
           ▼                       ▼
   ┌──────────────────┐     ChatGPT · Claude · Cursor · your agents
   │ dashboard        │
   │ Next.js  :3100   │◄──── browser (signed cookie)
   └──────────────────┘
```

## Pieces

**Service** (`service/`). One Node process. It owns the WhatsApp connections, the databases, the AI calls and both external interfaces: the REST API the dashboard calls, and the MCP server AI apps call. It listens on loopback by default; a reverse proxy exposes `/mcp`, `/oauth/*` and `/.well-known/*` to the internet.

**Workspace** (`workspace.js`). Everything that belongs to one account, created lazily per user: a Baileys socket (WhatsApp Web protocol, multi-device), a SQLite database (`node:sqlite`, WAL mode) with chats, contacts, messages, summaries and memories, the auto-reply loop, the summary cache, and the `McpServer` with its tools. Workspaces are closed when an account is disabled or deleted.

**OAuth** (`oauth.js`). A small authorization server implementing what the MCP authorization spec requires: protected-resource and authorization-server metadata, dynamic client registration, authorization code with PKCE (S256), one-hour access tokens and rotating 30-day refresh tokens. Only SHA-256 hashes of codes and tokens are stored, and every token belongs to exactly one user.

**Dashboard** (`dashboard/`). Next.js 16 with React 19 and Tailwind 4. Server routes sign users in against the service and keep an HMAC-signed cookie. All data calls go through `/api/wa/*` on the dashboard server, which forwards them to the service with the shared token plus the user's id and session version. The browser never holds the token.

**Bot** (`service/bot.js`). A separate, older program: a WhatsApp number that answers with Gemini or OpenAI. It shares nothing with the service except the repository.

## Request paths

*Dashboard read.* Browser → `GET /api/wa/chats` (cookie) → dashboard verifies the cookie → `GET service/api/chats` with `x-api-key`, `x-user-id`, `x-session-version` → service checks the token, that the user exists, is enabled and the session version matches → workspace query → JSON back.

*AI app call.* ChatGPT → `POST PUBLIC_URL/mcp` with a bearer token → service hashes the token, finds its user, refuses if expired, disabled or revoked → builds an MCP server for that user's workspace → runs the tool → JSON-RPC response. Every request is stateless on the transport (no SSE session to keep), which keeps proxies and serverless clients simple.

*Superadmin reading another account.* Same as above with `?as=<id>` (dashboard) or `account:` (MCP). The service switches the workspace, marks the call read-only, and writes an access-log row.

*Incoming message.* Baileys emits it → stored in SQLite → if it has media that the AI can read, a transcript or description is produced and cached → if auto-reply is on for that chat, a reply is generated after `waitSeconds` and sent → the chat's summary is marked stale.

## Storage

See [configuration](configuration.md#where-data-lives). Each account's data is a folder you can back up or delete on its own.

## Why these choices

- *Baileys* talks the real WhatsApp Web protocol, so no Business API approval, templates or per-message pricing. The trade-off is that it is unofficial; see [security](security.md).
- *SQLite via `node:sqlite`* keeps the service to one process with zero external dependencies. Node 24 is required for it.
- *One MCP server per request* costs almost nothing and guarantees a tool call can never observe another user's state.
- *Gemini* handles audio, image, video and PDF input natively, which is what WhatsApp attachments need.

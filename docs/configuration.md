# Configuration

Wavelink is configured with environment variables. The service reads `service/.env` (via Node's `--env-file-if-exists`), the dashboard reads `dashboard/.env.local`, and Docker Compose reads the root `.env`.

## Service

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | empty | Gemini key. Powers transcripts, image/PDF reading, summaries, drafts and auto-replies. Without it WhatsApp still syncs and sends. |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Gemini model used for everything above. |
| `MCP_HOST` | `127.0.0.1` | Interface to listen on. Keep loopback behind a reverse proxy. Docker image sets `0.0.0.0`; use `::` where private networking is IPv6 only (Railway). |
| `MCP_PORT` | `3940` | Port for the API, OAuth and MCP endpoints. |
| `PUBLIC_URL` | `http://localhost:3940` | The HTTPS address AI apps use to reach the service. Appears in OAuth metadata, so it must match what clients see. Read once at startup. |
| `MCP_TOKEN` | generated | Shared secret between the service and the dashboard, and the secret part of the local MCP link. If unset, one is generated into `service/.mcp-token` on first start. Set it explicitly in Docker. |
| `DATA_DIR` | `./data` | Root of all private data: `users.db` plus `users/<id>/` per account. Docker image sets `/data`. |
| `DASHBOARD_USER` | `admin` | Username of the superadmin created on first start. Ignored afterwards. |
| `DASHBOARD_PASSWORD` | generated | Password of that superadmin. If empty, one is generated into `DATA_DIR/initial-admin-password.txt`. Delete the file after signing in. |
| `OWNER_NAME` | empty | Display name of the superadmin, used by the AI ("You are connected to Jane's WhatsApp"). |
| `LOCALE` | `en-US` | Locale for timestamps shown to the AI (`en-GB`, `de-DE`, `en-IN`…). |
| `TZ` | system | Time zone for those timestamps. Set it on servers, which usually run in UTC. |
| `WA_NO_CONNECT` | unset | `1` disables the WhatsApp connection. Used by the test suite. |

## Dashboard

| Variable | Default | Purpose |
|---|---|---|
| `WA_API_URL` | `http://127.0.0.1:3940` | Where the service is. `http://service:3940` under Docker Compose. |
| `WA_API_TOKEN` | empty | Must equal the service's `MCP_TOKEN`. Never sent to browsers. |
| `AUTH_SECRET` | required | 16+ random characters. Signs the login cookie. Changing it signs everyone out. |

## Standalone bot mode

`npm run bot` in `service/` starts a different, simpler program: a WhatsApp number that replies to incoming messages with an LLM, with per-chat memory. It is independent of the dashboard and MCP server and keeps its own login in `service/auth`.

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` or `OPENAI_API_KEY` | one required | Gemini is used if its key is set, otherwise OpenAI. |
| `OPENAI_MODEL` | `gpt-5-mini` | OpenAI chat model. |
| `TRANSCRIBE_MODEL` | `whisper-1` | OpenAI transcription model for voice notes. |
| `SYSTEM_PROMPT` | built in | Personality and rules for the bot. |
| `ALLOWED_NUMBERS` | everyone | Comma-separated numbers with country code that may talk to the bot. |
| `GROUP_TRIGGER` | `@gpt` | In groups the bot answers only when mentioned or when a message starts with this. |
| `HISTORY_TURNS` | `20` | Conversation turns kept per chat. |
| `QR_PORT` | `3939` | Port of the page that shows the login QR code. |

## Where data lives

```
DATA_DIR/
  users.db                      accounts, OAuth clients and tokens (hashed), admin access log
  initial-admin-password.txt    only until you delete it
  users/<id>/
    auth/                       WhatsApp login (Signal keys). Treat like a password.
    whatsapp.db                 chats, messages, contacts, summaries, memories, attachment cache
    downloads/                  media that was opened or sent
    autoreply.json              auto-reply settings for this account
```

Back up `DATA_DIR` as a whole. Deleting `users/<id>/auth` forces that account to scan the QR code again.

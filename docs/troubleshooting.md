# Troubleshooting

## Linking

**No QR code appears.** The service is not running, or the dashboard cannot reach it (`WA_API_URL`, `WA_API_TOKEN`). Check `docker compose logs service` or `journalctl -u wavelink`. The dashboard shows "WhatsApp service is not running" when the token or URL is wrong.

**The QR code expires before I scan.** It refreshes automatically; keep the page open and scan the latest one.

**WhatsApp says the device was logged out.** Delete the account's `auth` folder under `DATA_DIR/users/<id>/` (or use Account → Unlink WhatsApp) and scan again.

**Messages from before linking are missing.** WhatsApp sends recent history on first link, not everything. Older messages appear only if WhatsApp includes them in the initial sync.

## Connecting AI apps

**The AI app cannot find the server.** In a browser open `https://<domain>/.well-known/oauth-protected-resource`. JSON means the service is reachable. HTML or a login page means the proxy routes that path to the dashboard. The provided Caddyfiles route `/mcp`, `/mcp/*`, `/oauth/*` and `/.well-known/*` to the service.

**The sign-in page URL is `http://localhost:3940/...`.** `PUBLIC_URL` is not set, or the service was not restarted after setting it.

**"Unknown client. Remove and re-add the connector."** Unused OAuth registrations are cleaned up. Delete the connector in the AI app and add it again.

**ChatGPT connects but refuses to send messages.** OpenAI limits write actions on some plans. Reading, briefs and drafts still work; send from the dashboard.

**Claude Code shows the server as needing authentication.** Run `/mcp`, choose the server and finish the browser sign-in. For a same-machine install, use the `/mcp/<MCP_TOKEN>` link, which needs no sign-in.

## AI features

**Summaries, transcripts or drafts say AI is not configured.** `GEMINI_API_KEY` is empty for the service. The dashboard's status pill shows which model is active.

**Gemini errors mentioning quota or model.** Try a different `GEMINI_MODEL`, and check the key's quota in Google AI Studio.

**Times are off by hours.** Set `TZ` (and `LOCALE`) on the service. Servers default to UTC.

## Running

**`node:sqlite` is not found.** Node 24 or newer is required. `node -v` to check; the Docker images already use 24.

**The dashboard build runs out of memory on a small server.** The VPS script adds 2 GB of swap and sets `NODE_OPTIONS=--max-old-space-size=1536`. Do the same, or build the Docker image elsewhere and pull it.

**Two instances of the service started.** Only one process may hold a WhatsApp session. Platforms that autoscale or run zero-downtime deploys can briefly run two; set replicas to one and disable overlap (see the platform guides).

## Getting help

Open a discussion on GitHub with the service log (numbers and names removed) and the platform you run on. For security problems use the private advisory form instead.

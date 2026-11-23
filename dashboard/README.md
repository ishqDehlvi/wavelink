# Wavelink dashboard

Next.js 16 app: sign in, scan the QR code, read and answer chats with AI help, manage auto-reply and accounts.

```bash
npm ci
cp .env.example .env.local   # WA_API_URL, WA_API_TOKEN (= service MCP_TOKEN), AUTH_SECRET
npm run dev                  # http://127.0.0.1:3100
npm run lint
npx next build && npx next start -H 127.0.0.1 -p 3100
```

The service must be running (`cd ../service && npm start`). The browser only talks to this app's `/api/*` routes; the service token stays on the server. Both listen on loopback by default; put them behind HTTPS before exposing them.

Pages and features are described in [`../docs/dashboard.md`](../docs/dashboard.md).

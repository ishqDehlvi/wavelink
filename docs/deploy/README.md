# Deploying Wavelink

## What any deployment needs

1. **One always-on process for the service.** It holds the WhatsApp socket and SQLite files. No serverless, no autoscaling, no two replicas.
2. **A persistent disk** mounted where `DATA_DIR` points. Losing it means relinking every phone and losing synced history.
3. **A public HTTPS address** for the service's `/mcp`, `/oauth/*` and `/.well-known/*` paths, set as `PUBLIC_URL`. The dashboard can share the same domain (recommended) or have its own.
4. **Node 24** or the provided Docker images.
5. About **1 GB of RAM** at runtime for a handful of accounts; the dashboard build wants 1.5 GB or swap.

## Pick one

| Platform | Cost to start | Setup effort | Guide |
|---|---|---|---|
| Docker Compose on any VPS (Hetzner, DigitalOcean, EC2, home server) | ~$4–6/month | 10 minutes, one command | [docker.md](docker.md) |
| AWS Lightsail | $12/month for 2 GB | 15 minutes, one script | [lightsail.md](lightsail.md) |
| Ubuntu VPS without Docker (systemd + Caddy) | ~$4–6/month | 15 minutes, one script | [vps.md](vps.md) |
| Railway | pay as you go, ~$5–10/month | 10 minutes in the UI | [railway.md](railway.md) |
| Fly.io | pay as you go, ~$5/month | 15 minutes with `flyctl` | [fly.md](fly.md) |
| Render | paid plan required for a disk | 10 minutes with a Blueprint | [render.md](render.md) |

Not suitable: Vercel, Netlify, Cloudflare Workers, AWS Lambda and similar for the **service**. They have no long-lived process or local disk. The **dashboard** could run there, but keeping it next to the service is simpler and avoids exposing the service API.

## Reverse proxy rules

Whatever fronts your install must send these paths to the service (port 3940) and everything else to the dashboard (port 3100):

```
/mcp        /mcp/*        /oauth/*        /.well-known/*
```

Both provided Caddyfiles (`deploy/caddy/Caddyfile` for Compose, the one written by `deploy/vps/setup.sh`) already do this. For nginx:

```nginx
location ~ ^/(mcp|oauth/|\.well-known/) { proxy_pass http://127.0.0.1:3940; }
location / { proxy_pass http://127.0.0.1:3100; }
```

## After deploying

1. Open the dashboard, sign in as the superadmin, delete `initial-admin-password.txt` if one was generated, and change the password.
2. Scan the QR code.
3. Confirm `https://<domain>/.well-known/oauth-protected-resource` returns JSON.
4. Connect [ChatGPT](../connect/chatgpt.md) or [Claude](../connect/claude.md).
5. Set up a backup of the data directory or volume.

## Updating

Pull the new version and rebuild: `docker compose pull && docker compose up -d --build`, or re-run `deploy/vps/setup.sh <domain>`. Data is never touched by updates; schema migrations run automatically on start.

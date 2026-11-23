# Docker Compose on any server

Works on any Linux box with Docker: Hetzner, DigitalOcean, Linode, Vultr, EC2, a Raspberry Pi or a home server. One `docker compose` command brings up the service, the dashboard and Caddy with automatic HTTPS.

## 1. Server and DNS

- A server with 1 GB RAM or more, ports 80 and 443 open.
- Docker Engine with the Compose plugin ([install guide](https://docs.docker.com/engine/install/)).
- A DNS `A` record, for example `wa.example.com → your server IP`. Caddy needs it to obtain a certificate.

## 2. Configure

```bash
git clone https://github.com/ishqDehlvi/wavelink.git
cd wavelink
cp .env.example .env
```

Edit `.env`:

```bash
MCP_TOKEN=<openssl rand -base64 24>
AUTH_SECRET=<openssl rand -base64 32>
GEMINI_API_KEY=<your key>
PUBLIC_URL=https://wa.example.com
DOMAIN=wa.example.com
DASHBOARD_USER=admin
DASHBOARD_PASSWORD=<choose one, or leave empty to have one generated>
TZ=Europe/Berlin
```

## 3. Start

```bash
docker compose --profile https up -d --build
docker compose logs -f service
```

Caddy fetches the certificate on first request. Open `https://wa.example.com`, sign in, scan the QR code. If you left the password empty:

```bash
docker compose exec service cat /data/initial-admin-password.txt
docker compose exec service rm /data/initial-admin-password.txt   # after signing in
```

The connector URL for AI apps is `https://wa.example.com/mcp`.

## What runs

| Container | Image | Listens | Exposed |
|---|---|---|---|
| `service` | built from `service/` | 3940 | 127.0.0.1:3940 on the host, and to Caddy |
| `dashboard` | built from `dashboard/` | 3100 | 127.0.0.1:3100 on the host, and to Caddy |
| `caddy` | `caddy:2` | 80, 443 | public |

Data lives in the `wavelink-data` volume (mounted at `/data` in the service). Caddy's certificates live in `caddy-data`.

## Without a domain (local or LAN)

Leave `DOMAIN` empty and run `docker compose up -d` without the profile. The dashboard is on `http://localhost:3100`. For AI apps, tunnel port 3940 (`cloudflared tunnel --url http://localhost:3940`) and set `PUBLIC_URL` to the tunnel address, then `docker compose up -d` again.

## Operations

```bash
docker compose logs -f service            # WhatsApp connection, AI, MCP
docker compose logs -f dashboard
docker compose restart service
docker compose pull && docker compose --profile https up -d --build   # update
docker run --rm -v wavelink_wavelink-data:/data -v "$PWD":/backup alpine tar czf /backup/wavelink-data.tgz -C /data .   # backup
```

## Using prebuilt images

Instead of `build:`, point the two services at images you publish from CI (`ghcr.io/<you>/wavelink-service`, `.../wavelink-dashboard`). Everything else stays the same.

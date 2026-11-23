# Any Ubuntu VPS, without Docker

For Hetzner, DigitalOcean, Linode, Vultr, OVH, EC2 or your own Ubuntu 22.04/24.04 machine. The `deploy/vps/setup.sh` script installs Node 24 and Caddy, builds the dashboard, writes two systemd units and an HTTPS site, and can be re-run for updates.

## Prerequisites

- Ubuntu 22.04 or 24.04, 1 GB RAM or more (the script adds 2 GB swap), ports 80 and 443 open in the provider's firewall.
- A DNS `A` record pointing your domain at the server.
- A user with `sudo` (the script runs the services as that user, not root).

## Install

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/ishqDehlvi/wavelink.git ~/wavelink
cp ~/wavelink/deploy/vps/wavelink.env.example ~/wavelink/deploy/vps/wavelink.env
nano ~/wavelink/deploy/vps/wavelink.env
bash ~/wavelink/deploy/vps/setup.sh wa.example.com
```

`wavelink.env` needs `MCP_TOKEN` and `AUTH_SECRET` (random strings), and should have `GEMINI_API_KEY` and `TZ`.

## What the script sets up

| Unit | Runs | Listens |
|---|---|---|
| `wavelink.service` | `node mcp.js` in `~/wavelink/service` | 127.0.0.1:3940 |
| `wavelink-dashboard.service` | `next start` in `~/wavelink/dashboard` | 127.0.0.1:3100 |
| `caddy` | HTTPS for your domain | 80, 443 |

Caddy routes `/mcp`, `/mcp/*`, `/oauth/*` and `/.well-known/*` to the service and everything else to the dashboard. The Caddyfile is at `/etc/caddy/Caddyfile` if you want to add more sites.

## Operations

```bash
journalctl -u wavelink -f
sudo systemctl status wavelink wavelink-dashboard caddy
sudo systemctl restart wavelink
cd ~/wavelink && git pull && bash deploy/vps/setup.sh wa.example.com    # update
tar czf wavelink-backup.tgz -C ~/wavelink/service data                  # backup
```

## Hardening suggestions

- Leave `ufw` or the provider firewall allowing only 22, 80 and 443.
- Keep automatic security updates on (`unattended-upgrades` is installed by default on Ubuntu).
- Put the server's disk on an encrypted volume if your provider offers it; `service/data` holds WhatsApp keys and messages in clear.

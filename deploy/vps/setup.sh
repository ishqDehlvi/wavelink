#!/usr/bin/env bash
# Wavelink on a fresh Ubuntu 22.04/24.04 server (AWS Lightsail, EC2, Hetzner, DigitalOcean, any VPS).
# Installs Node 24 and Caddy, builds the dashboard, creates two systemd services and an HTTPS site.
#
#   Usage, as a sudo-capable user, after cloning the repo to ~/wavelink:
#     cp ~/wavelink/deploy/vps/wavelink.env.example ~/wavelink/deploy/vps/wavelink.env   # then edit it
#     bash ~/wavelink/deploy/vps/setup.sh wa.example.com
#
#   Re-run it after `git pull` to rebuild and restart. Your data in service/data is never touched.
set -euo pipefail

DOMAIN="${1:-}"
[ -n "$DOMAIN" ] || { echo "usage: bash deploy/vps/setup.sh <domain>"; exit 1; }
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="$ROOT/deploy/vps/wavelink.env"
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE. Copy wavelink.env.example to wavelink.env and fill it in."; exit 1; }
RUN_USER="$(id -un)"

echo "==> swap (the dashboard build needs ~1.5 GB of memory)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile >/dev/null && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> Node.js 24 and Caddy"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - >/dev/null
  sudo apt-get install -y nodejs >/dev/null
fi
if ! command -v caddy >/dev/null; then
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg >/dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update >/dev/null && sudo apt-get install -y caddy >/dev/null
fi
node -v

echo "==> environment files"
set -a; . "$ENV_FILE"; set +a
: "${MCP_TOKEN:?MCP_TOKEN missing in wavelink.env}"
: "${AUTH_SECRET:?AUTH_SECRET missing in wavelink.env}"
cat > "$ROOT/service/.env" <<EOF
GEMINI_API_KEY=${GEMINI_API_KEY:-}
GEMINI_MODEL=${GEMINI_MODEL:-gemini-3.8-flash}
MCP_TOKEN=$MCP_TOKEN
PUBLIC_URL=https://$DOMAIN
DASHBOARD_USER=${DASHBOARD_USER:-admin}
DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD:-}
OWNER_NAME=${OWNER_NAME:-}
LOCALE=${LOCALE:-en-US}
TZ=${TZ:-UTC}
EOF
cat > "$ROOT/dashboard/.env.local" <<EOF
WA_API_URL=http://127.0.0.1:3940
WA_API_TOKEN=$MCP_TOKEN
AUTH_SECRET=$AUTH_SECRET
EOF
chmod 600 "$ROOT/service/.env" "$ROOT/dashboard/.env.local"

echo "==> install and build"
cd "$ROOT/service" && npm ci --omit=dev --no-audit --no-fund >/dev/null
cd "$ROOT/dashboard" && npm ci --no-audit --no-fund >/dev/null && NODE_OPTIONS=--max-old-space-size=1536 npx next build 2>&1 | tail -5

echo "==> systemd services"
sudo tee /etc/systemd/system/wavelink.service >/dev/null <<EOF
[Unit]
Description=Wavelink service (WhatsApp connection, database, AI, MCP)
After=network-online.target
[Service]
User=$RUN_USER
WorkingDirectory=$ROOT/service
ExecStart=$(command -v node) --env-file-if-exists=.env --no-warnings=ExperimentalWarning mcp.js
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF
sudo tee /etc/systemd/system/wavelink-dashboard.service >/dev/null <<EOF
[Unit]
Description=Wavelink dashboard (Next.js)
After=wavelink.service
[Service]
User=$RUN_USER
WorkingDirectory=$ROOT/dashboard
Environment=NODE_ENV=production
ExecStart=$(command -v npx) next start -H 127.0.0.1 -p 3100
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF

echo "==> Caddy (HTTPS) for $DOMAIN"
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$DOMAIN {
	encode gzip
	@service path /mcp /mcp/* /oauth/* /.well-known/*
	reverse_proxy @service 127.0.0.1:3940
	reverse_proxy 127.0.0.1:3100
}
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now wavelink wavelink-dashboard >/dev/null 2>&1
sudo systemctl restart wavelink wavelink-dashboard caddy
sleep 4
systemctl is-active wavelink wavelink-dashboard caddy
echo "==> done: https://$DOMAIN  (connector URL: https://$DOMAIN/mcp)"
if [ -z "${DASHBOARD_PASSWORD:-}" ] && [ -f "$ROOT/service/data/initial-admin-password.txt" ]; then
  echo "==> first-start admin password is in $ROOT/service/data/initial-admin-password.txt (delete it after signing in)"
fi

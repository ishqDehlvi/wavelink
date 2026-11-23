# AWS Lightsail

A fixed-price VM with a static IP, enough for a team's worth of accounts. The steps below use the `deploy/vps/setup.sh` script (Node 24, Caddy, systemd). Prefer Docker? Create the same instance and follow [docker.md](docker.md) instead.

## 1. Create the instance

1. Lightsail console → **Create instance**. Pick the region closest to your users.
2. Platform **Linux/Unix**, blueprint **OS only → Ubuntu 24.04 LTS**.
3. Plan: **2 GB RAM** ($12/month at the time of writing). 1 GB works for the service alone but the dashboard build needs swap, which the script adds.
4. Name it `wavelink` and create it.

## 2. Static IP, firewall, DNS

1. **Networking → Create static IP**, attach it to the instance. (A static IP is free only while attached; delete it if you delete the instance.)
2. On the instance's **Networking** tab, add firewall rules for **HTTPS (443)**. HTTP (80) and SSH (22) are open by default; keep 80, Caddy uses it for certificate challenges.
3. At your DNS provider, create an `A` record such as `wa.example.com → <static IP>`.

## 3. Install

Connect with the browser SSH button or your own key, then:

```bash
sudo apt-get update && sudo apt-get install -y git
git clone https://github.com/ishqDehlvi/wavelink.git ~/wavelink
cp ~/wavelink/deploy/vps/wavelink.env.example ~/wavelink/deploy/vps/wavelink.env
nano ~/wavelink/deploy/vps/wavelink.env     # MCP_TOKEN, AUTH_SECRET, GEMINI_API_KEY, TZ
bash ~/wavelink/deploy/vps/setup.sh wa.example.com
```

The script prints `done: https://wa.example.com` and the connector URL. If you left `DASHBOARD_PASSWORD` empty, it tells you where the generated password is.

## 4. First sign-in

Open `https://wa.example.com`, sign in, change the password, scan the QR code. Then connect [ChatGPT](../connect/chatgpt.md) or [Claude](../connect/claude.md) with `https://wa.example.com/mcp`.

## Day two

```bash
journalctl -u wavelink -f                 # service log
journalctl -u wavelink-dashboard -f
sudo systemctl restart wavelink
cd ~/wavelink && git pull && bash deploy/vps/setup.sh wa.example.com   # update
```

Data is in `~/wavelink/service/data`. Lightsail **snapshots** (manual or automatic, on the instance page) are the easiest backup; a `tar` of that folder to S3 works too.

## Cost control

Billing is hourly. To stop paying, delete **both** the instance and the static IP; a detached static IP is charged.

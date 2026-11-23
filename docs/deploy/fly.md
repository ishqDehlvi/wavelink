# Fly.io

Two Fly apps: the service with a volume, and the dashboard. Both configs are in `deploy/fly/`.

## 1. Service

```bash
cd service
fly launch --no-deploy --copy-config --config ../deploy/fly/service.fly.toml --name wavelink-service
fly volumes create wavelink_data --size 3 --region <region>
fly secrets set MCP_TOKEN=$(openssl rand -base64 24) GEMINI_API_KEY=<key> DASHBOARD_PASSWORD=<pw>
fly secrets set PUBLIC_URL=https://wavelink-service.fly.dev
fly deploy
```

The config keeps exactly one machine running (`auto_stop_machines = false`, `min_machines_running = 1`) and mounts the volume at `/data`. Your connector URL is `https://wavelink-service.fly.dev/mcp`.

## 2. Dashboard

```bash
cd ../dashboard
fly launch --no-deploy --copy-config --config ../deploy/fly/dashboard.fly.toml --name wavelink-dashboard
fly secrets set WA_API_URL=http://wavelink-service.flycast:3940 WA_API_TOKEN=<same MCP_TOKEN> AUTH_SECRET=$(openssl rand -base64 32)
fly deploy
```

`wavelink-service.flycast` is Fly's private address for the service app, so the service API is never public. For it to work, allocate a private IPv6 on the service app once: `fly ips allocate-v6 --private -a wavelink-service`.

## Notes

- Pick the same region for both apps and the volume.
- The service listens on `0.0.0.0:3940` inside the machine; Fly's internal port in the config matches.
- Volumes are single-host. Take snapshots (`fly volumes snapshots list`) or back up `/data` with `fly ssh sftp`.
- First-start admin password: `fly ssh console -a wavelink-service -C "cat /data/initial-admin-password.txt"`.

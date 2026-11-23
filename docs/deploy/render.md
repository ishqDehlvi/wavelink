# Render

A Render Blueprint (`deploy/render.yaml`) creates both web services from your fork. The service needs a persistent disk, which Render offers on paid instance types only.

## Deploy

1. Fork the repository.
2. Render dashboard → **New → Blueprint**, pick the fork. Render reads `deploy/render.yaml`.
3. It asks for the secret values: `MCP_TOKEN` (random), `AUTH_SECRET` (random, 16+), `GEMINI_API_KEY`, `DASHBOARD_PASSWORD`.
4. After the first deploy, open the service's page, copy its `onrender.com` URL into the `PUBLIC_URL` variable and save (Render redeploys).

The connector URL is `https://<service>.onrender.com/mcp`. The dashboard is on its own `onrender.com` URL.

## How the pieces connect

- The dashboard reaches the service over Render's private network using the service's **internal address** (`http://wavelink-service:3940` by default; check the service page if your account uses suffixed hostnames) and never exposes the service's API publicly.
- The disk is mounted at `/data`. Services with a disk run as a single instance, which is what Wavelink needs.
- Health checks hit `/.well-known/oauth-protected-resource`.

## Notes

- Free instance types spin down when idle and have no disk; the service must be on a paid type.
- First-start admin password: open the service's **Shell** tab and `cat /data/initial-admin-password.txt`.
- Back up the disk with Render's disk snapshots.

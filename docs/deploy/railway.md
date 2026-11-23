# Railway

Two Railway services from the same repository, one volume, private networking between them. Railway builds from the Dockerfiles.

## 1. Service

1. **New Project → Deploy from GitHub repo**, pick your fork of Wavelink.
2. In the new service's **Settings**: set **Root Directory** to `service`. Railway detects `service/Dockerfile`.
3. **Variables**:

   | Variable | Value |
   |---|---|
   | `MCP_TOKEN` | random string |
   | `GEMINI_API_KEY` | your key |
   | `MCP_HOST` | `::` (Railway's private network is IPv6; this listens on both) |
   | `PUBLIC_URL` | fill in after step 5 |
   | `DASHBOARD_USER`, `DASHBOARD_PASSWORD`, `TZ` | as you like |

4. **Volumes → Add volume**, mount path `/data`.
5. **Settings → Networking → Generate domain** (or add your own). Copy it into `PUBLIC_URL` as `https://<domain>` and redeploy.
6. Settings → **Deploy**: set replicas to 1 and, if offered, turn off overlapping deploys so two instances never hold the WhatsApp session at once.

Your connector URL is `https://<service domain>/mcp`.

## 2. Dashboard

1. In the same project, **New → GitHub repo**, same repository, **Root Directory** `dashboard`.
2. **Variables**:

   | Variable | Value |
   |---|---|
   | `WA_API_URL` | `http://${{service.RAILWAY_PRIVATE_DOMAIN}}:3940` (use the service's name in the reference) |
   | `WA_API_TOKEN` | same as `MCP_TOKEN` |
   | `AUTH_SECRET` | random string, 16+ characters |

3. **Generate domain**. That is where people sign in and scan the QR code.

## Notes

- The dashboard talks to the service only over the private network; the service's public domain is needed just for the AI apps' OAuth and MCP calls. If you prefer a single domain, put the dashboard behind your own proxy that forwards the connector paths to the service.
- Logs: the service's **Deployments → View logs** shows the WhatsApp connection state and the generated admin password path on first start. Read the file with Railway's shell: `cat /data/initial-admin-password.txt`.
- Volumes are backed up with Railway's volume backups; enable them.

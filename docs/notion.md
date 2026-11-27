# Notion

Wavelink can also bring your team's Notion pages into the dashboard and into ChatGPT, Claude and other MCP apps. There is one Notion connection for the whole organisation, made by a superadmin, and the superadmin decides page by page who may do what.

## What people can do

| Permission | Allows |
|---|---|
| **Read** | See the page, its content, a database's rows and the comments |
| **Edit** | Rename the page, change a row's properties, add content at the end |
| **Create** | Add sub-pages, or rows to a database |
| **Comment** | Leave comments (the person's name is added to each one) |
| **Archive** | Move a page or row to Notion's trash (restorable from Notion for 30 days) |

Every permission except Read also needs Read, and ticking one ticks Read for you.

**Sub-pages inherit.** A tick on a page covers everything under it, unless a sub-page has its own setting. Unticking Read on a sub-page blocks it (and everything under it) for that person, even if the parent is shared. **Reset** on a page removes its own setting so it follows its parent again.

Superadmins can always do everything. The same rules apply on the dashboard and through MCP: a person's AI app can only reach the pages, and do the things, the dashboard would let them.

## Connect Notion

You need a Notion *connection* (Notion calls integrations "connections"). Two ways:

### Sign in with Notion (recommended)

1. In Notion, open **Developer tools → Developer connections → New connection**.
2. **Auth type:** OAuth. **Installable in:** Any workspace, so the people you set Wavelink up for can connect their own workspace. Notion doesn't let you change this later.
3. **Redirect URIs:** `https://<your PUBLIC_URL>/api/notion/callback`, for example `https://wa.example.com/api/notion/callback`. Notion refuses IP addresses here; for local testing use a tunnel (see below).
4. **Capabilities:** Read content, Update content, Insert content, Read comments, Insert comments. User information *without* email addresses is enough.
5. Copy the **Client ID** and **Client Secret** into the service's settings:

   ```
   NOTION_CLIENT_ID=...
   NOTION_CLIENT_SECRET=...
   ```

   The redirect defaults to `PUBLIC_URL` + `/api/notion/callback`. Set `NOTION_REDIRECT_URI` only if the dashboard lives on another address.
6. Restart the service. As a superadmin, open **Notion → Pages → Connect Notion**, sign in to Notion, pick the pages to share and allow access.

### Paste an integration token

Create an internal connection instead (Auth type: API token), copy its token (`ntn_…`), and share pages with it in Notion (••• → **Connections** → add it). Then paste the token on **Notion → Pages** in the dashboard. No service settings are needed for this route.

### After connecting

Pages sync right away and again every 10 minutes (or press **Sync now**). Open **Notion → Access**, pick a person and tick what they get. People with nothing shared see "Nothing has been shared with you yet".

If you change the connection's capabilities in Notion later, press **More → Disconnect Notion** and connect again: Notion only applies new capabilities on a fresh sign-in. Access settings are kept across reconnects.

## Notion-only accounts

Some people only need Notion. When creating an account, untick **WhatsApp**, or later use **Users → More → Turn WhatsApp off**. They never see a QR code, the dashboard shows them only Notion, and their AI app gets only the Notion tools. Turning WhatsApp back on keeps any earlier link and chats.

## MCP tools

| Tool | What it does |
|---|---|
| `notion_search` | Find pages and databases you can see, by title; shows what you can do on each. |
| `notion_read_page` | A page as markdown with properties, sub-pages and comments; for a database, its rows. |
| `notion_query_database` | A database's rows and columns. |
| `notion_create_page` | A sub-page (markdown content) or a database row (column values). |
| `notion_update_page` | Rename, add markdown at the end, or change a row's properties. |
| `notion_comment` | Comment on a page or row. |
| `notion_archive_page` | Move a page or row to Notion's trash. |
| `notion_access` | Superadmin only: see or change who can do what, per person and page. |

Pages can be named by id, by Notion link or by exact title. People without any Notion access get none of these tools.

## Activity

Every change made through Wavelink is logged with who did it and whether it came from the dashboard or an AI app. The superadmin sees everyone's on **Notion → Access**; others see their own.

## Security

- The Notion token is stored encrypted (AES-256-GCM) in `users.db`. The key comes from `NOTION_SECRET_KEY`, or is generated into `DATA_DIR/.notion-key` on first start. Losing the key only means connecting Notion again.
- Notion sees one connection; it cannot tell team members apart. Wavelink checks every request against the access settings before calling Notion, and a page someone can't read looks to them as if it doesn't exist.
- Requests are paced to Notion's limit of about three a second, with retries when Notion asks to slow down.

## Try it without a Notion account

The test suite ships a small stand-in for the Notion API:

```bash
cd service
node test/fake-notion.mjs 3976 &
NOTION_API_BASE=http://127.0.0.1:3976 NOTION_CLIENT_ID=fake-client NOTION_CLIENT_SECRET=fake-secret npm run mcp
```

Connect with the token `ntn_fake0000000000000000000000000000`, or press Connect Notion (the fake approves at once). It has a small wiki, a private page and a Clients database.

To test real OAuth on your laptop, put an HTTPS tunnel in front of the dashboard (for example `cloudflared tunnel --url http://127.0.0.1:3100`), add `https://<tunnel>/api/notion/callback` to the connection's redirect URIs, set `NOTION_REDIRECT_URI` to the same value, and open the dashboard through the tunnel address.

## Troubleshooting

- **"The Notion connection is not allowed to comment"**: turn on Read comments and Insert comments for the connection, then disconnect and connect again.
- **"That Notion sign-in link expired"**: the sign-in took longer than 15 minutes, or was started by another account. Press Connect Notion again.
- **A page is missing**: it isn't shared with the connection. Share it in Notion (or pick it in Notion's page picker), then press Sync now.

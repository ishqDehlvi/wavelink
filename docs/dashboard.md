# Dashboard

The dashboard is a Next.js app that signs you in, shows your WhatsApp with AI help, and manages accounts. It never talks to WhatsApp directly: every request goes to the service's `/api/*` with the shared token and your user id, and the service enforces who may see what.

## Pages

Navigation is a sidebar: **Home**, then *WhatsApp* (Overview, Inbox) and *Notion* (Pages, Access), then Users and your account. Every page has **Back**, which returns to the page you came from in this tab (or one level up when opened directly), and a breadcrumb.

**Home** (`/`). A greeting, a summary row (waiting on you, messages today, Notion pages, team), today's AI brief, the people waiting on a reply next to your recently edited Notion pages, and, for a superadmin, the team with each person's WhatsApp and Notion status. Every row opens what it names.

**WhatsApp → Overview** (`/whatsapp`). An AI brief of the period, stat cards (waiting on you, messages today, active chats, auto-replies sent), summary cards grouped into *Needs your reply*, *Groups* and *Everything else*, an incoming-by-hour chart and the busiest chats. Every card opens its chat. Below that: the MCP connector card with your connector URL and connection status, and *What the AI remembers*, the editable list of saved notes.

**Inbox** (`/inbox`). Every chat, newest first, with a badge for messages waiting on you. Filters: All, Needs reply, People, Groups. The chat view loads photos, voice notes, videos and documents inline, lets you reply (hover a message → Reply), forward messages, send files (the text box becomes the caption) and ask for an **AI draft** written in your style. Next to Send, **English** turns whatever you typed, in any language, into natural English in place so you can check it first; **Undo** brings back your original. This needs `GEMINI_API_KEY`. Nothing is sent until you press Send. Messages that arrived or were sent as forwards are marked "↪ Forwarded".

**Forwarding.** Hover a message → Forward to enter selection mode, as in WhatsApp: tap more messages to add or remove them (up to 30), a bar at the bottom shows "N selected", and Esc cancels. Then pick up to 5 recipients from your recent chats, or search *Other contacts and groups* by name or number to reach anyone in your contacts. Messages go out as real WhatsApp forwards in their original order, with media attached and no re-upload. Every message is checked before anything is sent, so a view-once message in the selection stops the whole forward.

**Auto-reply.** Global Off / Selected / Everyone, plus a Default / On / Off switch for each chat. Groups are never auto-replied. After you reply by hand in a chat, auto-reply stays quiet there for `pauseMinutes` (default 10). A new incoming message waits `waitSeconds` (default 8) so a burst of short messages gets one answer.

**Summaries.** One or two lines per chat with new messages (6h / 24h / 3d / 7d), ranked by "needs reply" and priority. Summaries are cached and only regenerated when a chat gets a new message, so repeated views are free.

**Account** (`/account`). Your linked number, chats stored, change password, unlink WhatsApp (optionally clearing stored chats), and the log of any superadmin views of your account.

**Users** (`/admin`, superadmin only). Create accounts (with or without WhatsApp), reset passwords, turn WhatsApp off or on, disable, delete; open a person's **Notion access**. Shows each account's link status and connection count, never its chats. Rarely used actions sit under **More**.

**Notion → Pages** (`/notion`). The Notion pages shared with you as a tree, with search. Open a page to read it; depending on your access, rename it, add content (markdown), add a sub-page or database row, comment or archive it. Superadmins connect Notion here. See [Notion](notion.md).

**Notion → Access** (`/notion/access`, superadmin only). Pick a person and tick Read, Edit, Create, Comment or Archive per page; sub-pages inherit. Below it, recent Notion activity from the dashboard and AI apps.

## QR linking

Until an account is linked, the dashboard shows a QR code that refreshes as WhatsApp rotates it. Scan it with the phone that owns the number (Settings → Linked devices → Link a device). The link survives restarts; it ends when you unlink in the dashboard, remove the device on the phone, or delete the account's `auth` folder.

## Running it

```bash
cd dashboard
cp .env.example .env.local   # WA_API_URL, WA_API_TOKEN, AUTH_SECRET
npm ci
npm run dev                  # http://127.0.0.1:3100
```

In production use `npx next build && npx next start -H 127.0.0.1 -p 3100`, or the Docker image, behind a reverse proxy that terminates HTTPS. Response headers deny framing and set a strict CSP for forms.

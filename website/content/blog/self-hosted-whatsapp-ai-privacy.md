---
title: A privacy checklist for a self-hosted WhatsApp AI assistant
description: Giving an AI access to your WhatsApp is a big decision. Here's what Wavelink protects, what it deliberately does not, and the checklist we'd follow before connecting a business number.
date: 2026-11-26
tags: Security, Privacy, Self-hosting
---

Your WhatsApp holds your clients, your suppliers, your family, your payments. Connecting it to an AI should make you ask hard questions. This post answers them for Wavelink, including the uncomfortable ones, and ends with a checklist you can follow.

## Why self-hosted matters

Wavelink runs on a server you control. Your messages, media and WhatsApp login keys are stored there, not in someone else's SaaS database. The only outside services that see message content are the ones you choose: the AI app you connect (ChatGPT or Claude) and, for transcription and summaries, Google's Gemini API under your own key.

That's a real difference from hosted "WhatsApp + AI" services, where your chats live on the provider's servers by design.

## What Wavelink protects

These are enforced in code and checked by an automated test suite on every change:

- **Per-user isolation.** Each account has its own database, WhatsApp login and media folder. Every request is tied to one user before it touches any data, so one person's AI app can never read another person's chats.
- **Passwords are hashed** with scrypt and never stored or logged in plain text.
- **AI sign-ins use OAuth with PKCE.** Access tokens last an hour, refresh tokens rotate, and only hashes are stored. Changing a password revokes every token at once.
- **Nothing is sent without you.** The AI shows the exact message and recipient before sending, replying or forwarding.
- **The AI can't touch the server.** There is no tool to run commands or read server files, and files on the server can never be sent.
- **Links are fetched safely.** When the AI sends a file from a link, every redirect is checked so it can't reach your server's private network or cloud metadata.
- **Attachments can't attack the dashboard.** Files from strangers that could contain scripts download instead of opening; images and PDFs open in a sandbox.
- **Admin access is read-only and visible.** A superadmin can read other accounts but never send from them, and every view is logged and shown to the account's owner.

## What it does not protect

Being upfront about these matters more than any feature list:

- **Data at rest is not encrypted.** The data folder holds WhatsApp login keys and every synced message in plain SQLite files. Protect the disk: restrict SSH, keep backups encrypted, and don't share the server.
- **Gemini sees your messages** when you use transcription, attachment reading, summaries, drafts or auto-replies. Leave `GEMINI_API_KEY` empty if that's not acceptable; syncing and sending keep working.
- **It's an unofficial client.** Wavelink uses the WhatsApp Web protocol, not the Business API. Numbers that behave like spam can be banned. Use it for your own conversations, at human pace.
- **Prompt injection is limited, not eliminated.** Messages people send you become context for the AI. A cleverly written message could make an assistant draft something misleading. That's why you read before you send.

## The checklist

Before connecting a business number, we'd go through this:

1. **Put it on its own server** with HTTPS, not on a shared machine. The [deploy guides](/docs/deploy) cover Docker, Lightsail and any Ubuntu VPS.
2. **Lock down SSH:** key-only login, and allow it only from your own IP in the firewall.
3. **Create one login per person.** Don't share the admin account; each person links their own phone and connects their own AI app.
4. **Decide about Gemini** for your business. Set the key only if sending message content to Google's API is acceptable.
5. **Back up the data folder**, encrypted, somewhere other than the server itself.
6. **Read before approving.** Treat the AI's draft like an assistant's: check the recipient and the words.
7. **Know how to cut it off.** "Disconnect AI apps" on the dashboard, or a password change, revokes every AI connection at once. Unlinking from WhatsApp → Linked devices on the phone stops syncing.
8. **Keep it updated.** Security fixes land in the open-source repo; pull them regularly.

The full technical detail, with what is tested, is in the [security model](/docs/security). If you'd rather not run the server yourself, you can have it set up for you; it's the same open-source software, on a server you own.

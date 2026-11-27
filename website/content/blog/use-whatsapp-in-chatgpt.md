---
title: How to use WhatsApp inside ChatGPT, step by step
description: Connect your own WhatsApp to ChatGPT so you can ask what you missed, who is waiting on you and what a voice note said, and have it draft and send replies that you approve first.
date: 2026-11-26
tags: ChatGPT, WhatsApp, Guide
featured: true
---

If most of your work happens on WhatsApp, you already know the problem: dozens of chats, groups that never stop, voice notes you have no time to play, and invoices sent as blurry photos. ChatGPT is good at reading, summarising and writing. It just can't see your WhatsApp.

Wavelink fixes that. It links your WhatsApp the same way WhatsApp Web does, and gives ChatGPT a connector so it can read your chats, hear your voice notes, read your attachments, and draft or send replies. You approve every message before it goes out.

This guide walks through the whole setup and what you can do once it's running.

## What you need

- **A Wavelink server.** Wavelink is open source and runs on your own server, so your chats are not stored by a third party. You can [host it yourself](/docs/quickstart) in about ten minutes with Docker, or have it set up for you.
- **ChatGPT Plus, Pro, Team, Business or Enterprise**, used on chatgpt.com in a browser. Custom connectors are added from the web; once added, they work in the mobile apps too.
- **Your phone with WhatsApp**, to scan a QR code once.

## Step 1: Link your WhatsApp

Open the Wavelink dashboard and sign in. You'll see a QR code. On your phone, open **WhatsApp → Settings → Linked devices → Link a device** and scan it.

That's it: your chats start syncing within a minute. Your phone stays your phone, and Wavelink becomes one more linked device, like WhatsApp Web on a laptop.

## Step 2: Add the connector in ChatGPT

Your connector URL is your Wavelink address followed by `/mcp`, for example `https://wa.example.com/mcp`. The dashboard's Overview page shows it with a Copy button.

1. On chatgpt.com, open **Plugins → Add → Add custom MCP server**. If you don't see it, turn on **Developer mode** under **Settings → Apps & Connectors → Advanced**.
2. Name it `WhatsApp` and paste the connector URL.
3. Choose **OAuth** as the authentication. Leave the client ID and secret empty.
4. Confirm and create it.
5. A page titled "Connect your WhatsApp" opens. Sign in with your Wavelink username and password and click **Allow access**.

Each person signs in with their own login, so ChatGPT only ever reaches that person's WhatsApp. The full details are in the [ChatGPT connection guide](/docs/connect/chatgpt).

## Step 3: Ask

Start a new chat, pick the WhatsApp connector, and ask in plain language. In English, Hindi or Hinglish, it doesn't matter:

- "What did I miss on WhatsApp today?"
- "Who is waiting on my reply?"
- "What did Priya say about the invoice?"
- "Open Sam's voice note and tell me what it says."
- "Draft a reply to Alex saying I'll join at 5."
- "Forward the last three messages from the supplier to the Accounts group."
- "Remember that Priya is my accountant, keep it formal with her."

For a catch-up, ChatGPT uses Wavelink's brief tool: one short summary of the period plus one line per chat, marked by priority and whether you owe a reply. For a question about a person, it finds the chat and reads the messages. Voice notes, photos and documents are read automatically when they matter to the answer.

## Nothing is sent without you

This is the part people ask about first. Before ChatGPT sends, replies or forwards anything, it shows you the exact message and who it's going to, and waits. Drafting never sends. That rule travels with every session, so it applies whichever chat you start.

If you'd rather send things yourself, use the drafts as a starting point and send from the dashboard, which also has an **English** button that turns what you typed in Hinglish into clean English before you send.

## Things worth knowing

- **Memory.** ChatGPT's own memory may be switched off in connector chats. When you say "remember…", Wavelink saves the note on your server and gives it to the AI in every conversation.
- **Sending on Plus.** OpenAI documents full write access for Business and Enterprise plans. If ChatGPT on Plus refuses to send, reading, summaries and drafts still work, and you can send from the dashboard.
- **It's an unofficial client.** Wavelink uses the WhatsApp Web protocol, not the Business API. Use it on your own number, at human pace; accounts that behave like spam can be banned.
- **Disconnecting.** Remove the connector in ChatGPT, or click "Disconnect AI apps" in the dashboard. Changing your password disconnects every AI app at once.

## Next steps

- [Quick start](/docs/quickstart): get your own Wavelink running.
- [Connect Claude](/docs/connect/claude): the same WhatsApp, inside Claude.
- [Security model](/docs/security): what is protected and what isn't.

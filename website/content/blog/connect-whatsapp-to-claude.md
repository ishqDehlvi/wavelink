---
title: Connect WhatsApp to Claude with MCP (claude.ai, Desktop and Claude Code)
description: Wavelink is a remote MCP server, so your WhatsApp works in every Claude app that supports custom connectors. Here's how to add it to claude.ai, Claude Desktop and Claude Code.
date: 2026-11-26
tags: Claude, MCP, Guide
---

Claude is a strong reader and writer, and since it speaks the Model Context Protocol (MCP), it can use tools that live on your own server. Wavelink is one of those: a remote MCP server that gives Claude access to your WhatsApp, with sign-in so each person only reaches their own chats.

This guide covers the three places you'll most likely use it.

## Before you start

- A running Wavelink server reachable over HTTPS. If you don't have one, the [quick start](/docs/quickstart) gets you there with Docker.
- Your connector URL: your Wavelink address plus `/mcp`, for example `https://wa.example.com/mcp`. It's on the dashboard's Overview page.
- A paid Claude plan; custom connectors are not available on the free plan.

## claude.ai and Claude Desktop

1. In claude.ai, open **Settings → Connectors → Add custom connector**.
2. Name it `WhatsApp` and paste your connector URL. Leave the advanced OAuth fields empty.
3. Click **Connect**. Wavelink's "Connect your WhatsApp" page opens: sign in with your Wavelink username and password and allow access.
4. Start a new conversation, enable the connector from the tools menu, and ask: "What did I miss on WhatsApp today?"

Connectors you add on claude.ai show up in Claude Desktop too, so there's nothing else to set up there.

## Claude Code

Claude Code can use the same connector from your terminal:

```bash
claude mcp add --transport http wavelink https://wa.example.com/mcp
```

Then run `/mcp` inside Claude Code and choose **wavelink** to finish signing in in your browser.

If Claude Code runs on the same machine as Wavelink, you can skip the sign-in and use the local link instead. It acts as the superadmin account, so keep it private:

```bash
claude mcp add --transport http wavelink "http://127.0.0.1:3940/mcp/$(cat service/.mcp-token)"
```

## What Claude can do with it

Claude gets 19 tools. In practice you never name them; you just ask:

- **Catch up:** "Brief me on the last 24 hours." "Who is waiting on my reply?"
- **Find things:** "What did the supplier quote for the December order?" "Find the message with the bank details."
- **Read attachments:** "What's the total on the invoice photo Ravi sent?" "Summarise the PDF in the Accounts group."
- **Write and send:** "Draft a reply to Neha in my usual tone." "Forward those two messages to Sales." Claude shows the exact message and recipients and waits for your go-ahead.
- **Remember:** "Remember that Sharma ji prefers voice notes."

Every session starts with instructions from Wavelink: whose WhatsApp this is, how attachments work, and the rule to show you the message before sending. Your saved notes are included too, so Claude knows them in every conversation.

The full list is in the [MCP tools reference](/docs/mcp-tools).

## Using it as a team

Wavelink is multi-user from the first start. Each person gets their own login, links their own phone, and connects their own Claude. A superadmin can read other accounts when the business needs it, but can never send from them, and every view is logged and shown to the account's owner. More in [accounts](/docs/accounts).

## Disconnecting

Remove the connector in Claude's settings, or click "Disconnect AI apps" on the dashboard. Changing your Wavelink password revokes every token immediately.

Using ChatGPT as well? See [how to use WhatsApp inside ChatGPT](/blog/use-whatsapp-in-chatgpt). Both can be connected to the same WhatsApp at once.

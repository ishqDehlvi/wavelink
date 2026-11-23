# Connect ChatGPT

ChatGPT talks to Wavelink as a custom MCP connector with OAuth. Each person signs in with their own Wavelink username and password, so ChatGPT only ever reaches that person's WhatsApp.

## Requirements

- A Wavelink install reachable over HTTPS, with `PUBLIC_URL` set to that address. Your connector URL is `PUBLIC_URL` + `/mcp` (the dashboard's Overview page shows it with a Copy button).
- ChatGPT Plus, Pro, Team, Business or Enterprise, used on **chatgpt.com in a browser**. Custom connectors cannot be added from the mobile apps, but once added they work there too.

## Add the connector

OpenAI moves these menus around. As of late 2026:

1. On chatgpt.com, open **Plugins → Add → Add custom MCP server**. If that entry is missing, turn on **Developer mode** under **Settings → Apps & Connectors → Advanced** and try again.
2. Name: `WhatsApp` (or anything you like). URL: your connector URL, for example `https://wa.example.com/mcp`.
3. Authentication: **OAuth**. Leave client ID and secret empty. Wavelink supports dynamic client registration, so ChatGPT registers itself.
4. Confirm the trust prompt and create it.
5. A Wavelink page titled "Connect your WhatsApp" opens. Sign in with your dashboard username and password and click **Allow access**.

## Use it

Start a new chat, type `@` and pick the connector (or choose it from the tools menu), then ask in plain language:

- "What did I miss on WhatsApp today?"
- "Who is waiting on my reply?"
- "What did Priya say about the invoice?"
- "Open the voice note Sam sent and tell me what it says."
- "Draft a reply to Alex saying I'll join at 5."
- "Reply to Priya: payment done ✅"
- "Send this PDF to the Sales group."
- "Remember that Priya is my accountant, keep it formal with her."

ChatGPT shows the exact text and recipient before anything is sent. That behaviour comes from the server instructions Wavelink sends with every session.

## Good to know

- **Memory.** ChatGPT's own memory may be off inside connector chats. Say "remember …" and Wavelink stores the note on your server instead. You can see and edit these notes on the dashboard under "What the AI remembers".
- **Sending on consumer plans.** OpenAI documents full write access for Business and Enterprise. If ChatGPT on Plus refuses to send, reading, summaries and drafts still work, and you can send from the dashboard.
- **Disconnect.** Remove the connector in ChatGPT, or click "Disconnect AI apps" on the dashboard Overview. Changing your password also disconnects every AI app.
- **Several people.** Everyone gets their own Wavelink login and links their own phone. See [accounts](../accounts.md).

## Troubleshooting

- *"Unknown client. Remove and re-add the connector."* Wavelink cleans up unused registrations. Delete the connector in ChatGPT and add it again.
- *ChatGPT says it cannot reach the server.* Check that `https://<your-domain>/.well-known/oauth-protected-resource` returns JSON in a browser. If it does not, the reverse proxy is not routing `/mcp`, `/oauth/*` and `/.well-known/*` to the service (see [deploy](../deploy/README.md)).
- *The sign-in page says the password is wrong after five tries.* Wait a few minutes; sign-in attempts are rate limited per address.

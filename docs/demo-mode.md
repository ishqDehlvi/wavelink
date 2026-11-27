# Demo mode

Demo mode runs Wavelink with a made-up WhatsApp instead of yours. Use it to try Wavelink without a phone, or to take screenshots and record videos without showing anyone's real chats.

- **No WhatsApp connection is opened.** The account shows as connected, with no QR code.
- **Nothing is really sent.** Sending, replying, forwarding, sending files and creating groups all work, but the message is only added to the demo chats.
- **Everything is invented.** The names, businesses and messages are fictional, and every phone number is in the +1 555 0100 range, which is reserved for fiction.
- **Fresh on every start.** The sample chats are reloaded each time the service starts, with times relative to now, so "what did I miss today" always has an answer.

## What's in it

You are Rohan Mehta, who runs a small trading business. The demo has:

| Chat | What's happening |
|---|---|
| Priya Sharma | A client chasing invoice INV-2041 (INR 48,400, overdue), with a photo of the invoice |
| Sam | A voice note in Hinglish moving a meeting to 5:30 at a new venue, with its transcript and English translation |
| Sales team (group) | A busy group agreeing a Q4 target; nothing is waiting on you |
| Ravi Kumar | A supplier's December rate list as a PDF |
| Accounts (group) | The CA waiting for purchase bills before a GST deadline |
| Neha Kapoor | A designer asking for feedback on a brochure |
| Mom | A personal message in Hinglish |

It also has three saved notes, so `whatsapp_memories` and the AI's instructions show how memory works. Transcripts, the invoice's text, the PDF's contents and the per-chat summaries are included, so the demo works without a Gemini key. With `GEMINI_API_KEY` set, AI drafts, the English button and fresh summaries work as usual.

## Run it locally

```bash
cd service
npm install
npm run demo
```

`npm run demo` turns on demo mode and keeps its data in `service/data-demo`, apart from any real data. To choose the login and port, put them in `service/.env.demo` (it's ignored by git):

```bash
DASHBOARD_USER=rohan
DASHBOARD_PASSWORD=pick-a-long-password
OWNER_NAME="Rohan Mehta"
MCP_PORT=3950
```

Then start the dashboard against it, with the same `MCP_TOKEN` (written to `service/.mcp-token` on first start if you didn't set one):

```bash
cd dashboard
WA_API_URL=http://127.0.0.1:3950 WA_API_TOKEN="$(cat ../service/.mcp-token)" AUTH_SECRET="$(openssl rand -hex 32)" npm run dev
```

With Docker, add `DEMO_MODE=1` to the service's environment and use a separate data volume.

## Connect ChatGPT or Claude to the demo

ChatGPT and Claude need a public HTTPS address, so put a temporary tunnel in front of the demo service, for example [Cloudflare's quick tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/):

```bash
cloudflared tunnel --url http://127.0.0.1:3950
```

1. Copy the `https://….trycloudflare.com` address it prints.
2. Add `PUBLIC_URL=https://….trycloudflare.com` to `service/.env.demo` and restart `npm run demo`.
3. Add `https://….trycloudflare.com/mcp` as a connector in ChatGPT or Claude, the same way as for a real server ([ChatGPT](connect/chatgpt.md), [Claude](connect/claude.md)), and sign in with the demo login.

The demo is reachable by anyone with the tunnel address while it runs. It only holds made-up chats and can't send anything, but use a long password and stop the tunnel when you're done.

## Recording tips

- Use a fresh ChatGPT account or a temporary chat, so your own chat history, name and memory don't appear.
- Good prompts to show: "What did I miss on WhatsApp today?", "What did Sam's voice note say?", "What's the total on Priya's invoice?", "Draft a reply to Priya saying I'll pay tomorrow", then approve the send and show it arrive in the dashboard.
- To start over, restart the service, or click **Unlink WhatsApp** on the dashboard's Account page: in demo mode it puts the sample chats back instead of unlinking.

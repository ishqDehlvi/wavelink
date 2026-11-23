# Connect Claude

Wavelink is a standard remote MCP server (Streamable HTTP with OAuth 2.1), so it works with every Claude surface that supports custom connectors.

## claude.ai and Claude Desktop

1. In claude.ai open **Settings → Connectors → Add custom connector**.
2. Name it `WhatsApp` and paste your connector URL, `PUBLIC_URL` + `/mcp` (for example `https://wa.example.com/mcp`). Leave the advanced OAuth fields empty.
3. Click **Connect**. Wavelink's "Connect your WhatsApp" page opens; sign in with your dashboard username and password and allow access.
4. In a new conversation, enable the connector from the tools menu and ask: "What did I miss on WhatsApp today?"

Connectors added on claude.ai are available in Claude Desktop as well. Custom connectors require a paid Claude plan.

## Claude Code

Remote, with OAuth:

```bash
claude mcp add --transport http wavelink https://wa.example.com/mcp
```

Then run `/mcp` inside Claude Code and pick **wavelink** to complete the sign-in in your browser.

Same machine, no tunnel and no OAuth: Wavelink also serves the MCP endpoint at `/mcp/<MCP_TOKEN>`, which acts as the superadmin account. The token is in `service/.mcp-token` (or your `MCP_TOKEN` variable).

```bash
claude mcp add --transport http wavelink "http://127.0.0.1:3940/mcp/$(cat service/.mcp-token)"
```

Keep that link private: anyone who has it can read and send from the superadmin's WhatsApp.

## What Claude sees

Every session starts with instructions from Wavelink: whose WhatsApp this is, which tools to use for "catch me up" and "who is waiting on me", how attachments work, and the rule to show the exact text and recipient before sending. Saved memories ("Priya is my accountant") are included too, so Claude knows them in every conversation without relying on its own memory.

The full tool list is in [MCP tools](../mcp-tools.md).

## Disconnect

Remove the connector in Claude's settings, or click "Disconnect AI apps" on the dashboard Overview. Changing your password revokes every token immediately.

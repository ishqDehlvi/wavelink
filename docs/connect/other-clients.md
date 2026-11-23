# Cursor and other MCP clients

Anything that can talk to a remote MCP server over Streamable HTTP can use Wavelink. Two endpoints exist:

| Endpoint | Auth | Acts as | Use for |
|---|---|---|---|
| `PUBLIC_URL/mcp` | OAuth 2.1 (sign-in page) | the user who signed in | ChatGPT, Claude, Cursor, anything on another machine |
| `http://127.0.0.1:3940/mcp/<MCP_TOKEN>` | the token in the URL | the first superadmin | tools on the same machine, scripts, quick tests |

## Cursor

Settings → **MCP** → **Add new MCP server**, or add this to `.cursor/mcp.json` in a project (or `~/.cursor/mcp.json` globally):

```json
{
  "mcpServers": {
    "wavelink": { "url": "https://wa.example.com/mcp" }
  }
}
```

Cursor opens the Wavelink sign-in page in your browser the first time it connects. On the same machine you can use the token link instead and skip OAuth.

## Windsurf, Zed, VS Code, Continue, Goose

Each has a JSON or TOML entry for remote MCP servers that takes a URL. Use `https://wa.example.com/mcp` and complete the OAuth sign-in when prompted. If a client does not support OAuth, use the token link on the same machine, or put a reverse proxy with its own authentication in front of the token link.

## Scripts and your own agents

With the official SDKs:

```js
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const token = process.env.MCP_TOKEN
const client = new Client({ name: 'my-agent', version: '1.0.0' })
await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:3940/mcp/${token}`)))
console.log(await client.callTool({ name: 'whatsapp_waiting', arguments: { days: 3 } }))
```

The service answers with JSON responses (no SSE stream to keep open), one request per call, so it works well behind serverless functions and cron jobs as a client.

## Checking an install

```bash
curl https://wa.example.com/.well-known/oauth-protected-resource
curl https://wa.example.com/.well-known/oauth-authorization-server
```

Both should return JSON that names your `PUBLIC_URL`. If they return the dashboard's HTML or a login redirect, the reverse proxy is sending these paths to the dashboard instead of the service.

# Contributing to Wavelink

Thanks for helping. This page is the whole process.

## Development loop

```bash
git clone https://github.com/ishqDehlvi/wavelink.git && cd wavelink

# service
cd service && npm ci && cp .env.example .env && npm start      # http://127.0.0.1:3940

# dashboard, second terminal
cd dashboard && npm ci && cp .env.example .env.local && npm run dev   # http://127.0.0.1:3100

# website, third terminal (optional)
cd website && npm ci && npm run dev                            # http://localhost:3000
```

The service is plain ES modules on Node 24, no build step. The dashboard is Next.js 16 with Tailwind 4. The website is Next.js and renders `docs/*.md`.

## Tests

```bash
cd service && npm test
```

This starts a throwaway copy of the service on port 3977 with fake accounts and messages (no WhatsApp connection, no AI key) and runs three suites: account isolation, superadmin read-only rules, and the security checks (SSRF, sandboxed media, request limits, registration rate limits). They must pass before a pull request is merged; CI runs them too, along with the dashboard and website builds and both Docker images.

If you change a security boundary, add a test in `service/test/` that would have failed before your change.

## Pull requests

- One change per PR, with a sentence on why.
- Keep the style of the surrounding code; the repo favours small files with a comment block at the top explaining what the module is for.
- Update `docs/` when behaviour, configuration or deployment changes. The website picks docs up automatically.
- Never commit phone numbers, names from real chats, tokens or `auth/` folders. The `.gitignore` covers the usual paths, but check your diff.

## Good first contributions

- Deployment guides for platforms not covered yet, tested end to end.
- Translations of the AI prompts' language hints (`service/attachments.js`, `service/workspace.js`) for languages other than English and Hindi.
- Dashboard polish: keyboard navigation in the inbox, mobile layout of the chat view.
- More MCP tools that are read-only and clearly useful (reactions, polls, starred messages).

## Scope

Wavelink is for people managing their own WhatsApp with their own AI. Pull requests that add bulk sending, scraping of groups you are not part of, or anything designed to evade WhatsApp's rate limits will be closed.

## Code of conduct

Be kind and assume good faith. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

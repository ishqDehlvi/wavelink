# Security policy

Wavelink stores private conversations and can send messages on a person's behalf, so security reports are taken seriously and handled quickly.

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private reporting: [Report a vulnerability](https://github.com/ishqDehlvi/wavelink/security/advisories/new).

Include what you found, how to reproduce it, and which version or commit you tested. You will get an acknowledgement within 72 hours and a fix or a plan within 14 days for anything that lets one account reach another account's data, lets an AI app reach the server beyond its tools, or bypasses authentication.

## In scope

- Cross-account data access (dashboard or MCP)
- Authentication and OAuth flaws (token forgery, PKCE bypass, session fixation)
- Server-side request forgery, file access or code execution through tool inputs
- Stored or reflected injection in the dashboard
- Secrets leaking into logs or responses

## Out of scope

- Issues that require the attacker to already hold `MCP_TOKEN`, a user's password or the server's disk
- WhatsApp account bans or rate limiting by WhatsApp
- Vulnerabilities in third-party services (Gemini, OpenAI, WhatsApp) themselves
- Deployments that expose the service port directly to the internet against the documentation

## Supported versions

The latest release on `main`. Fixes are not backported.

The security model is described in [docs/security.md](docs/security.md).

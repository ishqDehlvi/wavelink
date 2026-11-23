# Wavelink website

The public site for [Wavelink](https://github.com/ishqDehlvi/wavelink): a landing page at `/` and the documentation at `/docs`, rendered from the markdown in `../docs` at build time.

Next.js (App Router, TypeScript), Tailwind CSS v4, no UI kits, no animation libraries. Fonts: Bricolage Grotesque for display, Inter for UI, the system mono stack for code.

## Run it

```bash
cd website
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run lint       # eslint
npm run build      # static build; every docs page is prerendered
npm run start      # serve the build
```

## How the docs are sourced

`src/lib/docs.ts` looks for the docs folder at `../docs` (the monorepo layout) and falls back to `./docs` (a copy next to the site). Every `*.md` under it becomes a route:

| File | Route |
|---|---|
| `docs/README.md` | `/docs` |
| `docs/quickstart.md` | `/docs/quickstart` |
| `docs/deploy/README.md` | `/docs/deploy` |
| `docs/deploy/docker.md` | `/docs/deploy/docker` |

Rendering happens in `generateStaticParams` + the page component with `remark-parse`, `remark-gfm`, `remark-rehype`, `rehype-slug`, `rehype-autolink-headings`, `rehype-pretty-code` (shiki) and `rehype-stringify`. Nothing is parsed in the browser.

Relative links inside the markdown are rewritten: `connect/chatgpt.md` → `/docs/connect/chatgpt`, `../accounts.md` → `/docs/accounts`, a folder's `README.md` → that folder's index route, and anything outside `docs/` (`../SECURITY.md`, `../CONTRIBUTING.md`, `../LICENSE`) → the file on GitHub. Anchors are preserved.

The sidebar order and group names live in `src/lib/docs-nav.ts`. A new markdown file gets a route automatically; add it there to show it in the sidebar and in previous/next links.

`/tools` redirects to `/docs/mcp-tools` and `/deploy` to `/docs/deploy` (see `next.config.ts`).

Set `NEXT_PUBLIC_SITE_URL` to the public origin (for example `https://wavelink.dev`) so canonical URLs, the sitemap and Open Graph tags carry the right host.

## Deploy on Vercel

1. Import the repository and set **Root Directory** to `website`.
2. Keep **Include source files outside of the Root Directory in the Build Step** enabled (Settings → General → Root Directory). The build reads `../docs`, so it needs the parent folder.
3. Add `NEXT_PUBLIC_SITE_URL` as an environment variable.
4. Framework preset: Next.js. No other settings.

## Deploy on any Node host

```bash
cd website
npm ci
NEXT_PUBLIC_SITE_URL=https://your-domain npm run build
npm run start -- -p 3000
```

The output is static HTML plus a small Node server; put it behind any reverse proxy.

## Deploy as a Docker image

`next.config.ts` sets `output: "standalone"`. Build from the **repository root** so `docs/` is in the build context:

```bash
docker build -f website/Dockerfile -t wavelink-website .
docker run -p 3000:3000 wavelink-website
```

The image is built in two stages: the first installs dependencies and runs `next build` with `docs/` copied next to the site (the `./docs` fallback), the second copies only the standalone output and static assets.

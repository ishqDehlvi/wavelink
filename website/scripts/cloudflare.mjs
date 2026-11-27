// After `STATIC_EXPORT=1 next build`: shape out/ for Cloudflare Pages.
// - Markdown copies move from out/md/… to sit next to their pages (/docs/quickstart.md, /index.md).
// - _redirects, _headers and _routes.json replace what next.config.ts and src/proxy.ts do on a Node server.
// functions/_middleware.js answers `Accept: text/markdown` and adds the Link header to HTML pages.
import fs from "node:fs";
import path from "node:path";

const out = path.resolve("out");
const md = path.join(out, "md");
if (!fs.existsSync(md)) throw new Error("out/md is missing: run `STATIC_EXPORT=1 next build` first");

let moved = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const from = path.join(dir, e.name);
    if (e.isDirectory()) walk(from);
    else {
      const to = path.join(out, path.relative(md, from));
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.renameSync(from, to);
      moved++;
    }
  }
})(md);
fs.rmSync(md, { recursive: true });

fs.writeFileSync(
  path.join(out, "_redirects"),
  ["/tools /docs/mcp-tools 302", "/deploy /docs/deploy 302", "/md/* /:splat.md 301", ""].join("\n"),
);

fs.writeFileSync(
  path.join(out, "_headers"),
  `/opengraph-image
  Content-Type: image/png
  Cache-Control: public, max-age=86400

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`,
);

// Only page URLs run the function; assets are served straight from the edge.
fs.writeFileSync(
  path.join(out, "_routes.json"),
  JSON.stringify({ version: 1, include: ["/", "/index.md", "/docs", "/docs.md", "/docs/*", "/blog", "/blog.md", "/blog/*"], exclude: ["/blog/rss.xml"] }, null, 2),
);

console.log(`Cloudflare Pages output ready: ${moved} Markdown copies, _redirects, _headers, _routes.json`);

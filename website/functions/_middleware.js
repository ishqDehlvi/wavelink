// Cloudflare Pages Function: the static-hosting twin of src/proxy.ts ("Markdown for Agents").
// - /docs/quickstart.md is a static file; this adds the Markdown headers to it.
// - A page request with `Accept: text/markdown` gets that same file instead of the HTML.
// - HTML pages get a Link header pointing at their Markdown copy.
// Runs only for page URLs (see _routes.json written by scripts/cloudflare.mjs).

const DEFAULT_SITE = "https://wavelink.inzemam.tech";

function q(accept, types) {
  let best = -1;
  for (const part of accept.split(",")) {
    const [type, ...params] = part.trim().toLowerCase().split(";");
    if (!types.includes(type.trim())) continue;
    const qp = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    const v = qp ? Number(qp.slice(2)) : 1;
    if (!Number.isNaN(v)) best = Math.max(best, v);
  }
  return best;
}

function wantsMarkdown(accept) {
  if (!accept) return false;
  const md = q(accept, ["text/markdown", "text/x-markdown"]);
  return md > 0 && md >= q(accept, ["text/html", "application/xhtml+xml"]);
}

const mdPathFor = (pathname) => (pathname === "/" ? "/index.md" : `${pathname.replace(/\/$/, "")}.md`);

async function markdown(context, mdPath) {
  const url = new URL(mdPath, context.request.url);
  const res = await context.env.ASSETS.fetch(new Request(url, { headers: { accept: "*/*" } }));
  if (!res.ok) return null;
  const body = await res.text();
  // A missing file can come back as the HTML 404 page; only real Markdown counts.
  if (/^\s*<!DOCTYPE html/i.test(body)) return null;
  const site = (context.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE).replace(/\/$/, "");
  const page = mdPath === "/index.md" ? "/" : mdPath.slice(0, -3);
  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      vary: "Accept",
      link: `<${site}${page}>; rel="canonical"`,
      "x-robots-tag": "noindex",
      "x-markdown-tokens": String(Math.ceil(body.length / 4)),
      "cache-control": "public, max-age=300",
    },
  });
}

export async function onRequest(context) {
  const { pathname } = new URL(context.request.url);

  if (pathname.endsWith(".md")) return (await markdown(context, pathname)) ?? context.next();

  if (wantsMarkdown(context.request.headers.get("accept"))) {
    const res = await markdown(context, mdPathFor(pathname));
    if (res) return res;
  }

  const res = await context.next();
  if (!(res.headers.get("content-type") || "").includes("text/html")) return res;
  const out = new Response(res.body, res);
  out.headers.set("Link", `<${mdPathFor(pathname)}>; rel="alternate"; type="text/markdown"`);
  out.headers.append("Vary", "Accept");
  return out;
}

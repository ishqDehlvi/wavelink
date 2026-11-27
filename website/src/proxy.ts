import { NextResponse, type NextRequest } from "next/server";

/**
 * Markdown for Agents: one URL, two readers.
 * - Browsers get the HTML page as usual.
 * - AI agents that send `Accept: text/markdown` (or open the page URL with `.md` added) get a clean Markdown copy,
 *   served by src/app/md/[[...path]]/route.ts.
 * Markdown responses carry `Vary: Accept`, so a cache never hands them to a browser. (Next.js sets its own Vary on
 * HTML pages; the worst a cache can then do is give an agent the HTML.) HTML pages get a `Link` header pointing at
 * the Markdown copy.
 */

/** q-value of the first matching media range in an Accept header, or -1 when absent. */
function q(accept: string, types: string[]): number {
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

/** Browsers never list text/markdown, so Markdown wins whenever it is asked for at least as strongly as HTML. */
export function wantsMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const md = q(accept, ["text/markdown", "text/x-markdown"]);
  return md > 0 && md >= q(accept, ["text/html", "application/xhtml+xml"]);
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/blog/rss.xml") return NextResponse.next();

  if (pathname.endsWith(".md")) {
    const page = pathname.slice(0, -3);
    return NextResponse.rewrite(new URL(`/md${page === "/index" ? "" : page}`, req.url));
  }

  if (wantsMarkdown(req.headers.get("accept"))) {
    return NextResponse.rewrite(new URL(`/md${pathname === "/" ? "" : pathname}`, req.url));
  }

  const res = NextResponse.next();
  const mdPath = pathname === "/" ? "/index.md" : `${pathname.replace(/\/$/, "")}.md`;
  res.headers.set("Link", `<${mdPath}>; rel="alternate"; type="text/markdown"`);
  return res;
}

export const config = {
  matcher: ["/", "/index.md", "/docs", "/docs.md", "/docs/:path*", "/blog", "/blog.md", "/blog/:path*"],
};

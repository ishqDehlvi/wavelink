import { markdownFor, agentPaths } from "@/lib/agent-md";
import { site } from "@/lib/site";

// Internal target of src/proxy.ts: /md/docs/quickstart is the Markdown copy of /docs/quickstart.
// In the static build (STATIC_EXPORT=1) the files are written as /md/docs/quickstart.md and /md/index.md, then moved
// next to the HTML pages by scripts/cloudflare.mjs; there a Pages Function does what proxy.ts does.
export const dynamic = "force-static";
export const dynamicParams = false;

const staticExport = process.env.STATIC_EXPORT === "1";

export function generateStaticParams() {
  return agentPaths().map((p) => {
    if (staticExport) return { path: (p === "/" ? "/index" : p).slice(1).split("/").map((s, i, a) => (i === a.length - 1 ? `${s}.md` : s)) };
    return { path: p === "/" ? [] : p.slice(1).split("/") };
  });
}

export async function GET(_req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const joined = `/${path.join("/")}`.replace(/\.md$/, "");
  const pagePath = joined === "/index" ? "/" : joined;
  const md = markdownFor(pagePath);
  if (md === null) return new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(md, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      vary: "Accept",
      // The HTML page is the one to index; this is the same content for agents.
      link: `<${new URL(pagePath, site.url)}>; rel="canonical"`,
      "x-robots-tag": "noindex",
      "x-markdown-tokens": String(Math.ceil(md.length / 4)),
    },
  });
}

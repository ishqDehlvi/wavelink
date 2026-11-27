import { markdownFor, agentPaths } from "@/lib/agent-md";
import { site } from "@/lib/site";

// Internal target of src/proxy.ts: /md/docs/quickstart is the Markdown copy of /docs/quickstart.
export const dynamicParams = false;

export function generateStaticParams() {
  return agentPaths().map((p) => ({ path: p === "/" ? [] : p.slice(1).split("/") }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const pagePath = `/${path.join("/")}`;
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

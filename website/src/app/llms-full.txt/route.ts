import fs from "node:fs";
import path from "node:path";
import { site } from "@/lib/site";
import { docsDir, listDocFiles } from "@/lib/docs";

// Every docs page as one plain-text file, for AI assistants that want the full detail (llmstxt.org convention).
export const dynamic = "force-static";

export function GET() {
  const root = docsDir();
  const parts = listDocFiles().map((f) => {
    const md = fs.readFileSync(path.join(/*turbopackIgnore: true*/ root, f), "utf8");
    const slug = f.replace(/\.md$/, "").replace(/(^|\/)README$/, "");
    return `<!-- ${site.url}/docs${slug ? `/${slug}` : ""} -->\n\n${md.trim()}\n`;
  });
  const body = `# ${site.name} documentation (full text)\n\n> ${site.description}\n> Source: ${site.github}\n\n${parts.join("\n---\n\n")}`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

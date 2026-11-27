import { site } from "@/lib/site";
import { docsNav } from "@/lib/docs-nav";
import { allPosts } from "@/lib/blog";
import { faq } from "@/content/landing";
import { mdUrl } from "@/lib/agent-md";

// llms.txt (llmstxt.org): a plain-text map of the site for AI assistants and answer engines.
export const dynamic = "force-static";

export function GET() {
  const u = (p: string) => `${site.url}${p}`;
  const docs = docsNav
    .map((g) => `### ${g.title}\n` + g.items.map((i) => `- [${i.title}](${mdUrl(i.slug ? `/docs/${i.slug}` : "/docs")})`).join("\n"))
    .join("\n\n");
  const posts = allPosts().map((p) => `- [${p.title}](${mdUrl(`/blog/${p.slug}`)}): ${p.description}`).join("\n");
  const qa = faq.map((f) => `**${f.q}** ${f.a}`).join("\n\n");
  const body = `# ${site.name}

> ${site.tagline} ${site.description}

${site.name} is a free, open-source (MIT) Model Context Protocol (MCP) server plus a web dashboard. It links your own WhatsApp the way WhatsApp Web does, then lets ChatGPT, Claude, Claude Code, Cursor, VS Code, Windsurf, Zed or any MCP client read your chats, transcribe voice notes (Hindi and Hinglish to English), read photos and PDFs, brief you on what you missed, and draft or send replies that you approve first. It runs on your own server, so your chats are not stored by a third party.

Key facts:
- Source code: ${site.github} (MIT licence)
- Install: Docker or Node.js 24; one connector URL (https://your-domain/mcp) with OAuth sign-in per person
- Notion (optional): one connection for the team; a superadmin sets read/edit/create/comment/archive per person and per page, applied on the dashboard and in every AI app (8 notion_* tools)
- Works with: ChatGPT custom connectors, Claude (claude.ai, Desktop, Claude Code), Cursor, VS Code, Windsurf, Zed, any Streamable HTTP MCP client
- Not affiliated with WhatsApp, Meta, OpenAI, Anthropic or Google; uses the unofficial WhatsApp Web protocol (Baileys)
- Made by ${site.author.name} (${site.author.url}); launch discussion on Hacker News: ${site.hackerNews}

Every page on this site has a Markdown copy: add \`.md\` to its URL (the home page is ${u("/index.md")}), or request the normal URL with \`Accept: text/markdown\`.

## Docs

${docs}

## Blog

${posts}

## FAQ

${qa}

## Optional

- [Full documentation as plain text](${u("/llms-full.txt")})
- [Blog RSS](${u("/blog/rss.xml")})
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

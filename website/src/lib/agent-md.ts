import fs from "node:fs";
import path from "node:path";
import { site } from "./site";
import { docsDir, rewriteHref, slugToFile, allDocSlugs } from "./docs";
import { docsNav } from "./docs-nav";
import { allPosts, getPostSource } from "./blog";
import { faq, toolGroups, prompts, platforms, guarantees, notProtected } from "@/content/landing";

/**
 * Markdown copies of the public pages, for AI agents ("Markdown for Agents").
 * The same URL serves HTML to browsers and Markdown to clients that send `Accept: text/markdown`;
 * appending `.md` to any page URL works too (see src/proxy.ts).
 */

const abs = (p: string) => new URL(p, site.url).toString();

/** "/docs/quickstart" -> "https://…/docs/quickstart.md", "/" -> "https://…/index.md". Anchors are kept. */
export function mdUrl(pagePath: string): string {
  const [p, hash] = pagePath.split("#");
  const clean = p === "/" || p === "" ? "/index" : p.replace(/\/$/, "");
  return abs(`${clean}.md${hash ? `#${hash}` : ""}`);
}

/** Every page that has a Markdown copy, as its HTML path. */
export function agentPaths(): string[] {
  return [
    "/",
    "/blog",
    ...allPosts().map((p) => `/blog/${p.slug}`),
    ...allDocSlugs().map((s) => (s ? `/docs/${s}` : "/docs")),
  ];
}

function frontMatter(fields: Record<string, string | undefined>): string {
  const lines = Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return `---\n${lines.join("\n")}\n---\n\n`;
}

const footer = () =>
  `\n\n---\n\n${site.name} is open source (MIT): ${site.github}. Made by ${site.author.name} (${site.author.url}).\nSite map for agents: ${abs("/llms.txt")}. Full docs in one file: ${abs("/llms-full.txt")}.\n`;

/** Relative links inside a docs file -> absolute links to the Markdown copies of the target pages. */
function absolutiseLinks(md: string, file: string): string {
  return md.replace(/\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g, (_m, href: string, title: string) => {
    const out = rewriteHref(href, file);
    const target = out.startsWith("/docs") ? mdUrl(out) : out.startsWith("/") ? abs(out) : out;
    return `](${target}${title})`;
  });
}

function homeMd(): string {
  const tools = toolGroups
    .map((g) => `### ${g.title}\n\n` + g.tools.map((t) => `- \`${t.name}\` (${t.kind}): ${t.purpose}`).join("\n"))
    .join("\n\n");
  const hosts = platforms.map((p) => `| ${p.name} | ${p.where} | ${p.cost} | ${p.effort} | ${abs(p.href)} |`).join("\n");
  return (
    frontMatter({ title: `${site.name}: ${site.tagline}`, description: site.description, url: abs("/") }) +
    `# ${site.tagline}

Ask the AI you already use what you missed, who's waiting on you, or what that voice note said. It drafts and sends replies too, and shows you every message before it goes.

${site.name} is a free, open-source (MIT) Model Context Protocol (MCP) server plus a web dashboard. It links your own WhatsApp the way WhatsApp Web does and lets ChatGPT, Claude, Claude Code, Cursor, VS Code, Windsurf, Zed or any MCP client read your chats, transcribe voice notes (Hindi and Hinglish to English), read photos of bills and PDFs, brief you on what you missed, and draft or send replies you approve first. It runs on your own server, so your chats are not stored by a third party.

- Source code: ${site.github}
- Docs: ${mdUrl("/docs")}
- Quick start: ${mdUrl("/docs/quickstart")}
- Done-for-you setup: ${site.setup}
- Hacker News launch thread: ${site.hackerNews}

## Things you can ask

${prompts.map((p) => `- "${p}"`).join("\n")}

## Up and running in three steps

1. **Scan once.** Open the dashboard and scan the QR code from WhatsApp > Linked devices, the same way you'd use WhatsApp Web. Your chats start syncing in a minute.
2. **Connect your AI app.** Add one connector URL (\`https://your-domain/mcp\`) in ChatGPT or Claude and sign in with your own ${site.name} login. Each person only ever reaches their own WhatsApp.
3. **Just ask.** "What did I miss?", "Who's waiting on me?", "Send this PDF to Accounts." The AI reads, drafts and sends, and always shows you first.

## Two ways to get it

- **Set it up for me:** ${site.author.name} sets it up for your business: your server and domain, every WhatsApp linked, ChatGPT or Claude connected, and a login for each person on your team. ${site.setup}
- **Host it yourself:** free and MIT licensed. Three commands with Docker Compose bring up the service, the dashboard and HTTPS. ${mdUrl("/docs/quickstart")}

| Platform | Where | Cost | Effort | Guide |
| --- | --- | --- | --- | --- |
${hosts}

## Security

${guarantees.map((g) => `- **${g.title}.** ${g.text}`).join("\n")}

What it does not protect:

${notProtected.map((g) => `- **${g.title}** ${g.text}`).join("\n")}

## MCP tools

Reading tools are marked read-only; anything that sends asks you first.

${tools}

## FAQ

${faq.map((f) => `### ${f.q}\n\n${f.a}`).join("\n\n")}

## Disclaimer

${site.disclaimer}` +
    footer()
  );
}

function blogIndexMd(): string {
  const posts = allPosts()
    .map((p) => `- [${p.title}](${mdUrl(`/blog/${p.slug}`)}) (${p.date}): ${p.description}`)
    .join("\n");
  return (
    frontMatter({ title: `Blog · ${site.name}`, url: abs("/blog") }) +
    `# ${site.name} blog\n\nGuides on using WhatsApp with ChatGPT and Claude: setup, voice-note transcription, self-hosting and staying safe.\n\n${posts}\n\nRSS: ${abs("/blog/rss.xml")}` +
    footer()
  );
}

function postMd(slug: string): string | null {
  const p = getPostSource(slug);
  if (!p) return null;
  const body = p.body.trim().replace(/\]\((\/[^)\s]*)\)/g, (_m, href: string) => `](${href.startsWith("/docs") || href.startsWith("/blog") ? mdUrl(href) : abs(href)})`);
  return (
    frontMatter({
      title: p.title,
      description: p.description,
      author: p.author,
      date: p.date,
      updated: p.updated,
      url: abs(`/blog/${p.slug}`),
    }) +
    `# ${p.title}\n\n${body}` +
    footer()
  );
}

function docMd(slug: string): string | null {
  const file = slugToFile(slug);
  if (!file) return null;
  const raw = fs.readFileSync(path.join(/*turbopackIgnore: true*/ docsDir(), file), "utf8").trim();
  const title = raw.match(/^#\s+(.+)$/m)?.[1].trim() ?? slug;
  const pagePath = slug ? `/docs/${slug}` : "/docs";
  let md = absolutiseLinks(raw, file);
  if (!slug) {
    const nav = docsNav
      .map((g) => `### ${g.title}\n\n` + g.items.map((i) => `- [${i.title}](${mdUrl(i.slug ? `/docs/${i.slug}` : "/docs")})`).join("\n"))
      .join("\n\n");
    md += `\n\n## All docs pages\n\n${nav}`;
  }
  return frontMatter({ title, url: abs(pagePath), source: `${site.blobBase}docs/${file}` }) + md + footer();
}

/** Markdown for an HTML path ("/", "/docs/quickstart", "/blog/x"), or null when there is no such page. */
export function markdownFor(pagePath: string): string | null {
  const p = pagePath.replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/index") return homeMd();
  if (p === "/blog") return blogIndexMd();
  if (p.startsWith("/blog/")) return postMd(p.slice("/blog/".length));
  if (p === "/docs") return docMd("");
  if (p.startsWith("/docs/")) {
    const slug = p.slice("/docs/".length);
    if (slug.split("/").some((s) => s === ".." || s === "")) return null;
    return docMd(slug);
  }
  return null;
}

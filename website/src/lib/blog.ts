import fs from "node:fs";
import path from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import { rehypeCollectHeadings, rehypeWrapBlocks, type Heading } from "./docs";

/** Blog posts live as markdown in website/content/blog/<slug>.md with a small front matter block. */
export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  updated?: string;
  author: string;
  tags: string[];
  readingMinutes: number;
  featured: boolean;
};
export type Post = PostMeta & { html: string; headings: Heading[] };

function blogDir(): string {
  return path.join(process.cwd(), "content", "blog");
}

/** Minimal front matter: `key: value` lines between --- fences; tags as a comma list. */
function parse(raw: string): { data: Record<string, string>; body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) data[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, "$1");
  }
  return { data, body: m[2] };
}

function metaFrom(slug: string, data: Record<string, string>, body: string): PostMeta {
  const words = body.split(/\s+/).filter(Boolean).length;
  for (const k of ["title", "description", "date"]) {
    if (!data[k]) throw new Error(`Blog post ${slug}.md is missing "${k}" in its front matter`);
  }
  return {
    slug,
    title: data.title,
    description: data.description,
    date: data.date,
    updated: data.updated || undefined,
    author: data.author || "Inzemamul Haq",
    tags: (data.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
    readingMinutes: Math.max(1, Math.round(words / 220)),
    featured: data.featured === "true",
  };
}

export function allPosts(): PostMeta[] {
  const dir = blogDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(/*turbopackIgnore: true*/ dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const slug = f.replace(/\.md$/, "");
      const { data, body } = parse(fs.readFileSync(path.join(/*turbopackIgnore: true*/ dir, f), "utf8"));
      return metaFrom(slug, data, body);
    })
    // newest first; the featured post leads; ties by title so the order never shuffles
    .sort((a, b) => Number(b.featured) - Number(a.featured) || (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)));
}

export async function getPost(slug: string): Promise<Post | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const file = path.join(/*turbopackIgnore: true*/ blogDir(), `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const { data, body } = parse(fs.readFileSync(file, "utf8"));
  const headings: Heading[] = [];
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: "wrap", properties: { className: ["anchor"] } })
    .use(rehypeCollectHeadings, { out: headings })
    .use(rehypePrettyCode, { theme: "github-dark-default", keepBackground: false, defaultLang: "text" })
    .use(rehypeWrapBlocks)
    .use(rehypeStringify)
    .process(body);
  return { ...metaFrom(slug, data, body), html: String(result), headings };
}

/** A post's front matter plus its raw markdown body, for the Markdown copy served to AI agents. */
export function getPostSource(slug: string): (PostMeta & { body: string }) | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const file = path.join(/*turbopackIgnore: true*/ blogDir(), `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  const { data, body } = parse(fs.readFileSync(file, "utf8"));
  return { ...metaFrom(slug, data, body), body };
}

export function formatDate(d: string): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

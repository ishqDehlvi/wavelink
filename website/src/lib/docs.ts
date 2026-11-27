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
import { visit } from "unist-util-visit";
import type { Root as MdastRoot, Link as MdastLink } from "mdast";
import type { Root as HastRoot, Element as HastElement } from "hast";
import { site } from "./site";
import { docsNav, flatNav, type NavItem } from "./docs-nav";

/** `../docs` when the site lives in the monorepo, `./docs` when the docs are copied next to it. */
export function docsDir(): string {
  const candidates = [path.join(process.cwd(), "..", "docs"), path.join(process.cwd(), "docs")];
  for (const c of candidates) {
    if (fs.existsSync(path.join(/*turbopackIgnore: true*/ c, "README.md"))) return c;
  }
  throw new Error(`Wavelink docs folder not found. Looked in: ${candidates.join(", ")}`);
}

/** Every markdown file under docs/, as a docs-relative path with forward slashes ("deploy/docker.md"). */
export function listDocFiles(): string[] {
  const root = docsDir();
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(/*turbopackIgnore: true*/ dir, { withFileTypes: true })) {
      const full = path.join(/*turbopackIgnore: true*/ dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(path.relative(root, full).split(path.sep).join("/"));
      }
    }
  };
  walk(root);
  return out.sort();
}

/** "deploy/README.md" -> "deploy", "connect/chatgpt.md" -> "connect/chatgpt", "README.md" -> "". */
export function fileToSlug(file: string): string {
  let s = file.replace(/\.md$/, "");
  if (s === "README") return "";
  if (s.endsWith("/README")) s = s.slice(0, -"/README".length);
  return s;
}

/** Inverse of fileToSlug, checked against disk. */
export function slugToFile(slug: string): string | null {
  const root = docsDir();
  const candidates = slug === "" ? ["README.md"] : [`${slug}.md`, `${slug}/README.md`];
  for (const c of candidates) {
    const full = path.join(/*turbopackIgnore: true*/ root, c);
    if (full.startsWith(root) && fs.existsSync(full)) return c;
  }
  return null;
}

export function allDocSlugs(): string[] {
  return listDocFiles().map(fileToSlug);
}

export function allDocRoutes(): string[] {
  return allDocSlugs()
    .filter((s) => s !== "")
    .map((s) => `/docs/${s}`);
}

export type Heading = { id: string; text: string; depth: number };

export type Doc = {
  slug: string;
  file: string;
  title: string;
  description: string;
  html: string;
  headings: Heading[];
  editUrl: string;
  prev: NavItem | null;
  next: NavItem | null;
  group: string | null;
};

/* ---------- link rewriting (remark stage) ---------- */

export function rewriteHref(href: string, fromFile: string): string {
  if (/^(https?:|mailto:|#|\/)/i.test(href)) return href;
  const [target, hash] = href.split("#");
  const anchor = hash ? `#${hash}` : "";
  if (!target) return href;
  const fromDir = path.posix.dirname(fromFile); // "." or "connect"
  const resolved = path.posix.normalize(path.posix.join(fromDir === "." ? "" : fromDir, target));
  if (resolved.startsWith("..")) {
    // Outside docs/: point at the file in the repository.
    const repoPath = path.posix.normalize(path.posix.join("docs", resolved));
    return `${site.blobBase}${repoPath}${anchor}`;
  }
  if (resolved.endsWith(".md")) {
    const slug = fileToSlug(resolved);
    return slug ? `/docs/${slug}${anchor}` : `/docs${anchor}`;
  }
  // Non-markdown relative asset: serve from GitHub.
  return `${site.blobBase}docs/${resolved}${anchor}`;
}

function remarkRewriteLinks(options: { file: string }) {
  return (tree: MdastRoot) => {
    visit(tree, "link", (node: MdastLink) => {
      node.url = rewriteHref(node.url, options.file);
    });
  };
}

/* ---------- hast helpers (after rehype) ---------- */

function textOf(node: HastElement): string {
  let s = "";
  visit(node, "text", (t: { value: string }) => {
    s += t.value;
  });
  return s;
}

export function rehypeCollectHeadings(options: { out: Heading[] }) {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: HastElement) => {
      if (/^h[23]$/.test(node.tagName) && typeof node.properties?.id === "string") {
        options.out.push({
          id: node.properties.id,
          text: textOf(node),
          depth: Number(node.tagName[1]),
        });
      }
    });
  };
}

/** Wrap tables for horizontal scrolling and give every code block a header bar with language + copy button. */
export function rehypeWrapBlocks() {
  return (tree: HastRoot) => {
    visit(tree, "element", (node: HastElement, index, parent) => {
      if (!parent || index === undefined) return;
      if (node.tagName === "table") {
        const wrapper: HastElement = {
          type: "element",
          tagName: "div",
          properties: { className: ["table-wrap"] },
          children: [node],
        };
        parent.children[index] = wrapper;
        return;
      }
      if (node.tagName === "figure" && "data-rehype-pretty-code-figure" in (node.properties ?? {})) {
        const pre = node.children.find(
          (c): c is HastElement => c.type === "element" && c.tagName === "pre",
        );
        const lang = (pre?.properties?.["data-language"] as string | undefined) || "text";
        const label = lang === "plaintext" || lang === "txt" ? "text" : lang;
        const bar: HastElement = {
          type: "element",
          tagName: "div",
          properties: { className: ["codeblock-bar"] },
          children: [
            { type: "element", tagName: "span", properties: {}, children: [{ type: "text", value: label }] },
            {
              type: "element",
              tagName: "button",
              properties: { type: "button", className: ["copy-btn"], ariaLabel: "Copy to clipboard" },
              children: [{ type: "text", value: "Copy" }],
            },
          ],
        };
        node.tagName = "div";
        node.properties = { className: ["codeblock"] };
        node.children = [bar, ...node.children.filter((c) => c.type === "element" && c.tagName === "pre")];
      }
    });
  };
}

/* ---------- rendering ---------- */

function firstParagraph(md: string): string {
  const lines = md.split("\n");
  let i = 0;
  while (i < lines.length && (lines[i].trim() === "" || lines[i].startsWith("#"))) i++;
  const para: string[] = [];
  while (i < lines.length && lines[i].trim() !== "" && !/^[`|>\-*]/.test(lines[i])) {
    para.push(lines[i]);
    i++;
  }
  return para
    .join(" ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_]/g, "")
    .trim()
    .slice(0, 200);
}

export async function renderDoc(slug: string): Promise<Doc | null> {
  const file = slugToFile(slug);
  if (!file) return null;
  const md = fs.readFileSync(path.join(/*turbopackIgnore: true*/ docsDir(), file), "utf8");
  const headings: Heading[] = [];

  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRewriteLinks, { file })
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: "wrap",
      properties: { className: ["anchor"] },
    })
    .use(rehypeCollectHeadings, { out: headings })
    .use(rehypePrettyCode, {
      theme: "github-dark-default",
      keepBackground: false,
      defaultLang: "text",
    })
    .use(rehypeWrapBlocks)
    .use(rehypeStringify)
    .process(md);

  const titleMatch = md.match(/^#\s+(.+)$/m);
  const navIndex = flatNav.findIndex((n) => n.slug === slug);
  const group = docsNav.find((g) => g.items.some((i) => i.slug === slug))?.title ?? null;

  return {
    slug,
    file,
    title: titleMatch ? titleMatch[1].trim() : flatNav[navIndex]?.title ?? slug,
    description: firstParagraph(md),
    html: String(result),
    headings,
    editUrl: `${site.editBase}${file}`,
    prev: navIndex > 0 ? flatNav[navIndex - 1] : null,
    next: navIndex >= 0 && navIndex < flatNav.length - 1 ? flatNav[navIndex + 1] : null,
    group,
  };
}

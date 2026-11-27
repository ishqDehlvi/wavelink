import type { Metadata } from "next";
import { renderDoc } from "@/lib/docs";
import { DocArticle } from "@/components/DocArticle";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Quick start, configuration, connecting ChatGPT, Claude and Cursor, MCP tools, deployment guides, architecture and the security model.",
  alternates: { canonical: "/docs", types: { "text/markdown": "/docs.md" } },
};

export default async function DocsIndexPage() {
  const doc = await renderDoc("");
  if (!doc) throw new Error("docs/README.md is missing");
  return <DocArticle doc={doc} />;
}

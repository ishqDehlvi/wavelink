import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allDocSlugs, renderDoc } from "@/lib/docs";
import { DocArticle } from "@/components/DocArticle";

export const dynamicParams = false;

export function generateStaticParams() {
  return allDocSlugs()
    .filter((s) => s !== "")
    .map((s) => ({ slug: s.split("/") }));
}

export async function generateMetadata({ params }: PageProps<"/docs/[...slug]">): Promise<Metadata> {
  const { slug } = await params;
  const doc = await renderDoc(slug.join("/"));
  if (!doc) return {};
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: `/docs/${doc.slug}` },
    openGraph: { title: doc.title, description: doc.description, url: `/docs/${doc.slug}` },
  };
}

export default async function DocPage({ params }: PageProps<"/docs/[...slug]">) {
  const { slug } = await params;
  const doc = await renderDoc(slug.join("/"));
  if (!doc) notFound();
  return <DocArticle doc={doc} />;
}

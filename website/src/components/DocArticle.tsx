import Link from "next/link";
import type { Doc } from "@/lib/docs";
import { DocsSidebar } from "./DocsSidebar";
import { ArrowIcon } from "./Icons";
import { abs, ids, ldHtml } from "@/lib/seo";

/** TechArticle + BreadcrumbList for a docs page, linked to the site graph from the root layout. */
function docLd(doc: Doc) {
  const path = doc.slug ? `/docs/${doc.slug}` : "/docs";
  const crumbs = [
    { name: "Home", url: abs("/") },
    { name: "Docs", url: abs("/docs") },
    ...(doc.slug ? [{ name: doc.title, url: abs(path) }] : []),
  ];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        "@id": abs(`${path}#article`),
        headline: doc.title,
        description: doc.description,
        url: abs(path),
        articleSection: doc.group ?? "Documentation",
        inLanguage: "en",
        isPartOf: { "@id": ids.website },
        about: { "@id": ids.app },
        author: { "@id": ids.author },
        publisher: { "@id": ids.org },
        mainEntityOfPage: abs(path),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.url })),
      },
    ],
  };
}

export function DocArticle({ doc }: { doc: Doc }) {
  const toc = doc.headings.filter((h) => h.depth === 2);
  return (
    <div className="container-x grid gap-8 py-8 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_200px] lg:py-12">
      <DocsSidebar current={doc.slug} />

      <article className="min-w-0 max-w-[760px]">
        <script type="application/ld+json" dangerouslySetInnerHTML={ldHtml(docLd(doc))} />
        {doc.group ? <p className="eyebrow mb-3">{doc.group}</p> : null}
        <div className="prose" dangerouslySetInnerHTML={{ __html: doc.html }} />

        <div className="mt-12 border-t border-line pt-5 text-[13px] text-muted">
          <a href={doc.editUrl} target="_blank" rel="noreferrer" className="hover:text-ink">
            Edit this page on GitHub
          </a>
        </div>

        <nav aria-label="Pagination" className="mt-6 grid gap-3 sm:grid-cols-2">
          {doc.prev ? (
            <Link
              href={doc.prev.slug ? `/docs/${doc.prev.slug}` : "/docs"}
              className="group rounded-lg border border-line p-4 no-underline hover:border-ink"
            >
              <span className="block text-[12px] text-muted">Previous</span>
              <span className="mt-1 flex items-center gap-2 font-medium text-ink">
                <ArrowIcon className="h-4 w-4 rotate-180 text-accent-ink" />
                {doc.prev.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {doc.next ? (
            <Link
              href={doc.next.slug ? `/docs/${doc.next.slug}` : "/docs"}
              className="group rounded-lg border border-line p-4 text-right no-underline hover:border-ink"
            >
              <span className="block text-[12px] text-muted">Next</span>
              <span className="mt-1 flex items-center justify-end gap-2 font-medium text-ink">
                {doc.next.title}
                <ArrowIcon className="h-4 w-4 text-accent-ink" />
              </span>
            </Link>
          ) : null}
        </nav>
      </article>

      {toc.length > 0 ? (
        <aside className="hidden xl:block">
          <div className="toc sticky top-[72px]">
            <p className="eyebrow mb-3">On this page</p>
            <ul>
              {toc.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`}>{h.text}</a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

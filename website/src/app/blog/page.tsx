import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ArrowIcon } from "@/components/Icons";
import { allPosts, formatDate } from "@/lib/blog";
import { abs, ids, ldHtml } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog",
  description: "Guides on using WhatsApp with ChatGPT and Claude: setup, voice-note transcription, self-hosting and staying safe.",
  alternates: { canonical: "/blog", types: { "application/rss+xml": `${site.url}/blog/rss.xml`, "text/markdown": "/blog.md" } },
  openGraph: { title: `Blog · ${site.name}`, description: "Guides on using WhatsApp with ChatGPT and Claude.", url: "/blog", type: "website" },
};

export default function BlogIndex() {
  const posts = allPosts();
  const [lead, ...rest] = posts;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ldHtml({
          "@context": "https://schema.org",
          "@type": "Blog",
          "@id": abs("/blog#blog"),
          name: `${site.name} blog`,
          description: "Guides on using WhatsApp with ChatGPT and Claude: setup, voice-note transcription, self-hosting and staying safe.",
          url: abs("/blog"),
          inLanguage: "en",
          publisher: { "@id": ids.org },
          blogPost: posts.map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            description: p.description,
            url: abs(`/blog/${p.slug}`),
            datePublished: p.date,
            dateModified: p.updated ?? p.date,
            author: { "@id": ids.author },
          })),
        })}
      />
      <Header />
      <main className="container-x pb-24 pt-16 md:pt-20">
        <h1 className="font-display text-balance text-[44px] font-bold leading-[1] text-ink md:text-[64px]">The Wavelink blog</h1>
        <p className="mt-4 max-w-[60ch] text-[18px] leading-relaxed text-muted">
          Practical guides on running your WhatsApp through ChatGPT and Claude: setting it up, transcribing voice notes, hosting it yourself and keeping it safe.{" "}
          <a href="/blog/rss.xml" className="text-accent-ink underline decoration-accent/40 underline-offset-4 hover:decoration-accent-ink">RSS</a>
        </p>

        {lead ? (
          <Link href={`/blog/${lead.slug}`} className="tile tile-lift nudge mt-12 block p-7 no-underline sm:p-10">
            <p className="text-[13.5px] text-muted">
              <time dateTime={lead.date}>{formatDate(lead.date)}</time> · {lead.readingMinutes} min read
            </p>
            <h2 className="font-display mt-3 max-w-[24ch] text-balance text-[30px] font-bold leading-[1.08] text-ink md:text-[40px]">{lead.title}</h2>
            <p className="mt-4 max-w-[64ch] text-[17px] leading-relaxed text-muted">{lead.description}</p>
            <span className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-semibold text-accent-ink">
              Read the guide <ArrowIcon className="h-4 w-4" />
            </span>
          </Link>
        ) : null}

        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {rest.map((p) => (
            <li key={p.slug}>
              <Link href={`/blog/${p.slug}`} className="tile tile-lift flex h-full flex-col p-6 no-underline sm:p-7">
                <p className="text-[13px] text-muted">
                  <time dateTime={p.date}>{formatDate(p.date)}</time> · {p.readingMinutes} min read
                </p>
                <h2 className="mt-2.5 text-balance text-[21px] font-semibold leading-snug text-ink">{p.title}</h2>
                <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{p.description}</p>
                {p.tags.length ? (
                  <p className="mt-auto flex flex-wrap gap-1.5 pt-5">
                    {p.tags.map((t) => (
                      <span key={t} className="rounded-full bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-2">{t}</span>
                    ))}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  );
}

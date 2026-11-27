import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ArrowIcon } from "@/components/Icons";
import { allPosts, formatDate, getPost } from "@/lib/blog";
import { site } from "@/lib/site";
import { abs, ids } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return allPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    keywords: post.tags,
    authors: [{ name: post.author, url: site.author.url }],
    alternates: { canonical: `/blog/${post.slug}`, types: { "text/markdown": `/blog/${post.slug}.md` } },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      authors: [site.author.url],
      tags: post.tags,
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description },
  };
}

/** JSON for a <script> tag, with "<" escaped so content can never close the tag. */
const ld = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });

export default async function BlogPost({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  const more = allPosts().filter((p) => p.slug !== post.slug).slice(0, 2);
  const url = `${site.url}/blog/${post.slug}`;

  return (
    <>
      <Header />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={ld({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "BlogPosting",
              headline: post.title,
              description: post.description,
              datePublished: post.date,
              dateModified: post.updated ?? post.date,
              image: [abs("/opengraph-image")],
              author: { "@type": "Person", "@id": ids.author, name: post.author, url: site.author.url },
              publisher: { "@id": ids.org },
              about: { "@id": ids.app },
              inLanguage: "en",
              mainEntityOfPage: url,
              url,
              keywords: post.tags.join(", "),
              isPartOf: { "@type": "Blog", "@id": abs("/blog#blog"), name: `${site.name} blog`, url: abs("/blog") },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: site.name, item: site.url },
                { "@type": "ListItem", position: 2, name: "Blog", item: `${site.url}/blog` },
                { "@type": "ListItem", position: 3, name: post.title, item: url },
              ],
            },
          ],
        })}
      />
      <main className="container-x pb-24 pt-12 md:pt-16">
        <article className="mx-auto max-w-[720px]">
          <nav aria-label="Breadcrumb" className="text-[14px] text-muted">
            <Link href="/blog" className="text-muted no-underline hover:text-ink">Blog</Link>
          </nav>
          <h1 className="font-display mt-4 text-balance text-[38px] font-bold leading-[1.04] text-ink md:text-[52px]">{post.title}</h1>
          <p className="mt-5 text-[18px] leading-relaxed text-muted">{post.description}</p>
          <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line pb-6 text-[14px] text-muted">
            <span>
              By{" "}
              <a href={site.author.url} target="_blank" rel="noreferrer" className="font-medium text-ink no-underline hover:underline">
                {post.author}
              </a>
            </span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span aria-hidden="true">·</span>
            <span>{post.readingMinutes} min read</span>
          </p>

          <div className="prose mt-8" dangerouslySetInnerHTML={{ __html: post.html }} />

          <aside className="mt-14 rounded-[20px] border border-accent/25 bg-accent-soft p-7 sm:p-8">
            <p className="font-display text-[24px] font-bold leading-tight text-accent-deep">Want this for your business?</p>
            <p className="mt-2 text-[15.5px] leading-relaxed text-accent-deep/80">
              Wavelink is free and open source. Host it yourself in about ten minutes, or have it set up for you.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={site.setup} target="_blank" rel="noreferrer" className="btn">Set it up for me</a>
              <Link href="/docs/quickstart" className="btn btn-ghost nudge">
                Host it yourself <ArrowIcon className="h-4 w-4" />
              </Link>
            </div>
          </aside>
        </article>

        {more.length ? (
          <section className="mx-auto mt-16 max-w-[720px]" aria-label="More from the blog">
            <h2 className="text-[17px] font-semibold text-ink">Keep reading</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {more.map((p) => (
                <li key={p.slug}>
                  <Link href={`/blog/${p.slug}`} className="tile tile-lift block h-full p-5 no-underline">
                    <p className="text-[12.5px] text-muted">{formatDate(p.date)}</p>
                    <p className="mt-2 text-[16px] font-semibold leading-snug text-ink">{p.title}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
      <Footer />
    </>
  );
}

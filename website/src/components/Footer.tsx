import Link from "next/link";
import { Wordmark } from "./Wordmark";
import { site } from "@/lib/site";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "How it works", href: "/#how" },
      { label: "Security", href: "/#security" },
      { label: "Questions", href: "/#faq" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Self-host",
    links: [
      { label: "Quick start", href: "/docs/quickstart" },
      { label: "Deploy guides", href: "/docs/deploy" },
      { label: "MCP tools", href: "/docs/mcp-tools" },
      { label: "Security model", href: "/docs/security" },
    ],
  },
  {
    title: "Open source",
    links: [
      { label: "GitHub", href: site.github, external: true },
      { label: "Hacker News", href: site.hackerNews, external: true },
      { label: "MIT license", href: `${site.blobBase}LICENSE`, external: true },
      { label: "Contributing", href: `${site.blobBase}CONTRIBUTING.md`, external: true },
      { label: "Security policy", href: `${site.blobBase}SECURITY.md`, external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-field">
      <div className="container-x pb-10 pt-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-xs text-[14.5px] text-ink-2">{site.tagline}</p>
            <p className="mt-1.5 text-[13.5px] text-muted">Open source, MIT licensed, runs on your own server.</p>
          </div>
          {columns.map((c) => (
            <div key={c.title} className="text-[14px]">
              <p className="eyebrow mb-3">{c.title}</p>
              <ul className="space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    {"external" in l && l.external ? (
                      <a className="text-ink-2 no-underline transition-colors hover:text-ink" href={l.href} target="_blank" rel="noreferrer">
                        {l.label}
                      </a>
                    ) : (
                      <Link className="text-ink-2 no-underline transition-colors hover:text-ink" href={l.href}>
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-[13.5px] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-2">
            Made by{" "}
            <a href={site.author.url} target="_blank" rel="noreferrer" className="font-semibold text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink">
              {site.author.name}
            </a>{" "}
            <span className="text-muted">
              (
              <a href={site.author.url} target="_blank" rel="noreferrer" className="text-muted no-underline hover:text-ink">
                {site.author.short}
              </a>
              )
            </span>
          </p>
          <p className="text-muted">© {new Date().getFullYear()} Wavelink contributors</p>
        </div>
        <p className="mt-5 max-w-4xl text-[12.5px] leading-relaxed text-muted">{site.disclaimer}</p>
      </div>
    </footer>
  );
}

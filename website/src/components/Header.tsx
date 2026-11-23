import Link from "next/link";
import { Wordmark } from "./Wordmark";
import { GitHubIcon, StarIcon } from "./Icons";
import { site } from "@/lib/site";

const nav = [
  { href: "/docs", label: "Docs" },
  { href: "/tools", label: "Tools" },
  { href: "/deploy", label: "Deploy" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/80 backdrop-blur-md">
      <div className="container-x flex h-14 items-center justify-between gap-4">
        <Wordmark />
        <nav aria-label="Main" className="flex items-center gap-0 text-[13px] font-medium sm:gap-2 sm:text-[14px]">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-2 py-1.5 text-ink-2 no-underline hover:bg-surface hover:text-ink sm:px-2.5"
            >
              {n.label}
            </Link>
          ))}
          <a
            href={site.github}
            className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong px-2 text-ink no-underline hover:border-ink sm:px-2.5"
            target="_blank"
            rel="noreferrer"
          >
            <GitHubIcon className="h-4 w-4" />
            <span className="hidden sm:inline">GitHub</span>
            <StarIcon className="h-3.5 w-3.5 text-accent-ink" />
          </a>
        </nav>
      </div>
    </header>
  );
}

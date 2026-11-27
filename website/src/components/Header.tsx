"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "./Wordmark";
import { GitHubIcon } from "./Icons";
import { site } from "@/lib/site";

const nav = [
  { href: "/#features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/#security", label: "Security" },
  { href: "/docs", label: "Docs" },
  { href: "/blog", label: "Blog" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={`sticky top-0 z-40 border-b bg-paper/85 backdrop-blur-md backdrop-saturate-150 transition-[border-color,box-shadow] duration-300 ${scrolled ? "header-scrolled border-transparent" : "border-transparent"}`}
    >
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Wordmark />
        <nav aria-label="Main" className="hidden items-center gap-1 text-[14px] font-medium md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-ink-2 no-underline transition-colors hover:bg-surface hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href={site.github}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-line-strong text-ink no-underline transition-colors hover:border-ink"
            target="_blank"
            rel="noreferrer"
            aria-label="Wavelink on GitHub"
          >
            <GitHubIcon className="h-[18px] w-[18px]" />
          </a>
          <a href={site.setup} target="_blank" rel="noreferrer" className="btn btn-sm">
            Set it up for me
          </a>
        </div>
      </div>
    </header>
  );
}

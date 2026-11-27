"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { SYMBOL } from "@/lib/brand";
import { recordVisit } from "@/lib/nav";
import { type Overview, useMe, usePoll, wa } from "@/lib/wa";
import { logout } from "./AppHeader";

const I = {
  home: <path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z" />,
  overview: <path d="M4 13h6V4H4zm10 7h6v-9h-6zM4 20h6v-4H4zm10-11h6V4h-6z" />,
  inbox: <path d="M4 5h16v10h-4.5l-1.5 2.5h-4L8.5 15H4zM4 15v4h16v-4" />,
  pages: <path d="M7 3.5h7l4 4V20.5H7zM14 3.5v4h4M10 12h5M10 15.5h5" />,
  access: <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zm-3 9l2 2 4-4" />,
  users: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5M16 4.5a3.3 3.3 0 0 1 0 6.3M18 14.5c2 .6 3.3 2.6 3.5 5.5" />,
  logout: <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />,
};
export const Icon = ({ d, className = "size-[18px]" }: { d: ReactNode; className?: string }) => (
  <svg viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

export function Mark({ className = "h-5" }: { className?: string }) {
  return (
    <svg viewBox={SYMBOL.viewBox} className={className} aria-hidden>
      <path d={SYMBOL.d} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

type Item = { href: string; label: string; icon: ReactNode; match: (p: string) => boolean; count?: number };

/** Left sidebar on desktop, a scrolling row of links on phones. Home first, then WhatsApp and Notion side by side. */
export default function Sidebar() {
  const path = usePathname();
  const me = useMe();
  const admin = me?.role === "superadmin";
  const whatsapp = me ? me.whatsapp : true;
  // Notion-only accounts always see Notion, even before anything is shared with them
  const notion = me ? admin || me.notion.access || !me.whatsapp : false;
  // who's waiting, for the Inbox count (quietly empty while WhatsApp isn't linked)
  const waiting = usePoll(() => (me?.whatsapp ? wa<Overview>("overview").then((o) => o.waitingCount) : Promise.resolve(0)), me?.whatsapp ? 60000 : 600000);

  const groups: { label: string; items: Item[] }[] = [
    { label: "", items: [{ href: "/", label: "Home", icon: I.home, match: (p) => p === "/" }] },
  ];
  if (whatsapp)
    groups.push({
      label: "WhatsApp",
      items: [
        { href: "/whatsapp", label: "Overview", icon: I.overview, match: (p) => p.startsWith("/whatsapp") },
        { href: "/inbox", label: "Inbox", icon: I.inbox, match: (p) => p.startsWith("/inbox"), count: waiting.data || undefined },
      ],
    });
  if (notion)
    groups.push({
      label: "Notion",
      items: [
        { href: "/notion", label: "Pages", icon: I.pages, match: (p) => p === "/notion" },
        ...(admin ? [{ href: "/notion/access", label: "Access", icon: I.access, match: (p: string) => p.startsWith("/notion/access") }] : []),
      ],
    });
  if (admin) groups.push({ label: "Team", items: [{ href: "/admin", label: "Users", icon: I.users, match: (p) => p.startsWith("/admin") }] });

  const link = (it: Item, compact = false) => {
    const on = it.match(path);
    return (
      <Link
        key={it.href}
        href={it.href}
        aria-current={on ? "page" : undefined}
        className={
          compact
            ? `flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium ${on ? "bg-panel text-ink shadow-[0_1px_2px_rgb(13_19_16/0.08)]" : "text-muted"}`
            : `group flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[14px] transition-colors duration-150 ${
                on ? "bg-panel font-medium text-ink shadow-[0_1px_2px_rgb(13_19_16/0.06),0_0_0_1px_var(--line)]" : "text-ink-2 hover:bg-sunken-2/70 hover:text-ink"
              }`
        }
      >
        <span className={on ? "text-accent" : "text-faint group-hover:text-ink-2"}>
          <Icon d={it.icon} className={compact ? "size-4" : "size-[18px]"} />
        </span>
        <span className="truncate">{it.label}</span>
        {it.count ? (
          <span className={`ml-auto rounded-full px-1.5 text-[11.5px] font-semibold tabular-nums ${on ? "bg-accent text-accent-ink" : "bg-accent-soft text-accent-deep"}`}>{it.count}</span>
        ) : null}
      </Link>
    );
  };

  const person = me?.name || me?.username || "";
  return (
    <>
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-line bg-bg md:flex">
        <Link href="/" className="flex h-16 shrink-0 items-center gap-2.5 px-5 text-accent">
          <Mark className="h-[18px]" />
          <span className="font-display text-[19px] font-bold text-ink">Wavelink</span>
        </Link>
        <nav className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 pt-2 pb-4" aria-label="Main">
          {groups.map((g) => (
            <div key={g.label || "home"}>
              {g.label && <div className="mb-1.5 px-2.5 text-[12px] font-medium text-faint">{g.label}</div>}
              <div className="space-y-0.5">{g.items.map((it) => link(it))}</div>
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <div className={`flex items-center gap-2.5 rounded-[12px] p-1.5 ${path.startsWith("/account") ? "bg-panel shadow-[0_0_0_1px_var(--line)]" : ""}`}>
            <Link href="/account" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg" title="Your account">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-[13px] font-semibold text-panel">
                {(person[0] || "·").toUpperCase()}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[13.5px] font-medium text-ink">{person || "…"}</span>
                <span className="block truncate text-[12px] text-faint">{admin ? "Superadmin" : me ? `@${me.username}` : ""}</span>
              </span>
            </Link>
            <button onClick={logout} className="grid size-8 shrink-0 place-items-center rounded-lg text-faint hover:bg-sunken-2 hover:text-ink" aria-label="Log out" title="Log out">
              <Icon d={I.logout} className="size-[17px]" />
            </button>
          </div>
        </div>
      </aside>
      <nav className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-bg px-2 py-1.5 md:hidden" aria-label="Main">
        <span className="px-1.5 text-accent">
          <Mark className="h-4" />
        </span>
        {groups.flatMap((g) => g.items).map((it) => link(it, true))}
        {link({ href: "/account", label: "Account", icon: I.users, match: (p) => p.startsWith("/account") }, true)}
      </nav>
    </>
  );
}

/** Sidebar + page. The sign-in page has no sidebar. Also records each visit so Back knows the way. */
export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  useEffect(() => {
    recordVisit(window.location.pathname + window.location.search);
  }, [path]);
  if (path.startsWith("/login")) return <>{children}</>;
  return (
    <div className="flex h-full flex-col bg-bg md:flex-row">
      <Sidebar />
      <div className="relative min-h-0 min-w-0 flex-1">{children}</div>
    </div>
  );
}

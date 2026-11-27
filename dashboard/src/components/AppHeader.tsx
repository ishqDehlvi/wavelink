"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useSyncExternalStore } from "react";
import { type Status, useMe, usePoll, wa } from "@/lib/wa";
import { getViewAs, stopViewing } from "@/lib/view";
import { canGoBack } from "@/lib/nav";
import QrGate from "./QrGate";

type Tab = "home" | "overview" | "inbox" | "admin" | "account" | "notion" | "notion-access";
type Crumb = { label: string; href?: string };

// Where each page sits. The last crumb is the page itself; Back falls back to the one before it.
const TRAIL: Record<Tab, Crumb[]> = {
  home: [{ label: "Home" }],
  overview: [{ label: "Home", href: "/" }, { label: "WhatsApp" }],
  inbox: [{ label: "Home", href: "/" }, { label: "WhatsApp", href: "/whatsapp" }, { label: "Inbox" }],
  notion: [{ label: "Home", href: "/" }, { label: "Notion" }],
  "notion-access": [{ label: "Home", href: "/" }, { label: "Notion", href: "/notion" }, { label: "Access" }],
  admin: [{ label: "Home", href: "/" }, { label: "Users" }],
  account: [{ label: "Home", href: "/" }, { label: "Account" }],
};
const ROUTE: Record<Tab, string> = {
  home: "/",
  overview: "/whatsapp",
  inbox: "/inbox",
  notion: "/notion",
  "notion-access": "/notion/access",
  admin: "/admin",
  account: "/account",
};
const WHATSAPP_PAGES: Tab[] = ["overview", "inbox"];
const noSubscribe = () => () => {};

export const logout = async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.replace("/login");
};

/** Back: to the page you came from in this tab; opened directly, up one level. */
export function BackButton({ fallback }: { fallback: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => (canGoBack() ? router.back() : router.push(fallback))}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-panel pr-2.5 pl-2 text-[13px] font-medium text-ink-2 shadow-[0_1px_2px_rgb(13_19_16/0.04)] transition-colors duration-150 hover:border-line-strong hover:text-ink"
      aria-label="Back"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 5l-7 7 7 7" />
      </svg>
      <span className="hidden sm:inline">Back</span>
    </button>
  );
}

/**
 * Top bar of every page: Back, where you are, and (on WhatsApp pages) the connection.
 * `gate`: cover the page with the QR code while this user's WhatsApp isn't linked (WhatsApp pages only).
 * `trail`: extra crumbs after the page's own (e.g. the open Notion page).
 */
export default function AppHeader({
  active,
  gate = true,
  trail = [],
  children,
}: {
  active: Tab;
  gate?: boolean;
  trail?: Crumb[];
  children?: ReactNode;
}) {
  // Anything but the WhatsApp pages is about your own account, so it ends "viewing another account".
  // (Declared before the polls so it runs before their first request.)
  const whatsappPage = WHATSAPP_PAGES.includes(active);
  const router = useRouter();
  const cookieViewing = useSyncExternalStore(noSubscribe, () => Boolean(getViewAs()), () => false);
  const viewing = cookieViewing && whatsappPage;
  useEffect(() => {
    if (!whatsappPage) stopViewing();
    document.documentElement.toggleAttribute("data-viewing", viewing);
  }, [whatsappPage, viewing]);
  const me = useMe();
  const watch = whatsappPage && me?.whatsapp !== false;
  const status = usePoll(() => (watch ? wa<Status>("status") : Promise.resolve(null)), watch ? 3000 : 60000);
  // a Notion-only account opening a WhatsApp page goes to Notion instead
  useEffect(() => {
    if (me && !me.whatsapp && whatsappPage) router.replace("/notion");
  }, [me, whatsappPage, router]);
  const exitView = () => {
    stopViewing();
    window.location.replace("/admin");
  };
  const s = status.data;
  const connected = s?.status === "connected";

  // with extra crumbs (an open Notion page), the page's own crumb becomes a link back to its list
  const own = TRAIL[active].map((c, i, all) => (trail.length && i === all.length - 1 ? { ...c, href: ROUTE[active] } : c));
  const crumbs = [...own, ...trail];
  // the page you'd go "up" to: the last crumb with a link
  const parent = [...crumbs].reverse().find((c) => c.href)?.href ?? "/";

  return (
    <>
      <header className={`h-16 shrink-0 items-center gap-3 border-b border-line bg-bg px-4 sm:px-6 ${active === "home" ? "hidden md:flex" : "flex"}`}>
        {active !== "home" && <BackButton fallback={parent} />}
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex min-w-0 items-center gap-1.5 text-[13.5px]">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <li key={`${c.label}-${i}`} className={`flex min-w-0 items-center gap-1.5 ${!last && i < crumbs.length - 2 ? "hidden sm:flex" : ""}`}>
                  {c.href && !last ? (
                    <Link href={c.href} className="truncate text-muted hover:text-ink">
                      {c.label}
                    </Link>
                  ) : (
                    <span className={`truncate ${last ? "font-semibold text-ink" : "text-muted"}`} aria-current={last ? "page" : undefined}>
                      {c.label}
                    </span>
                  )}
                  {!last && (
                    <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-line-strong" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2.5 text-[13px] text-muted">
          {watch &&
            (status.error ? (
              <span className="flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-danger">
                <span className="size-1.5 rounded-full bg-danger" /> Service offline
              </span>
            ) : s ? (
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${connected ? "bg-accent-soft text-accent-deep" : "bg-warn-soft text-warn"}`}>
                <span className={`size-1.5 rounded-full ${connected ? "bg-accent-bright" : "bg-warn"}`} />
                <span className="hidden max-w-[16rem] truncate sm:inline">{connected ? `${s.name ?? "Connected"} · +${s.number}` : "WhatsApp not linked"}</span>
              </span>
            ) : null)}
          {children}
        </div>
      </header>
      {viewing && me?.role === "superadmin" && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-warn-soft px-4 py-2 text-[13px] text-warn sm:px-6">
          <span className="min-w-0 flex-1">
            Viewing <b className="font-semibold">{s?.name || "another account"}</b>
            {s?.number ? ` · +${s.number}` : ""}
            {s && !connected ? " (WhatsApp not connected right now, showing stored chats)" : ""} · read-only. You can&apos;t send messages or change settings here, and the owner can see
            that you viewed it.
          </span>
          <button onClick={exitView} className="rounded-lg border border-warn/40 px-2.5 py-1 text-[12.5px] font-medium hover:bg-warn/10">
            Exit
          </button>
        </div>
      )}
      {watch && status.error && status.error !== "Please log in" && (
        <div className="border-b border-line bg-warn-soft px-4 py-2 text-[13px] text-warn sm:px-6">{status.error}</div>
      )}
      {gate && watch && s && !connected && !status.error && !viewing && <QrGate status={s} me={me} />}
    </>
  );
}

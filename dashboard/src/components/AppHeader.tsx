"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useSyncExternalStore } from "react";
import { type Status, useMe, usePoll, wa } from "@/lib/wa";
import { getViewAs, stopViewing } from "@/lib/view";
import QrGate from "./QrGate";

type Tab = "overview" | "inbox" | "admin" | "account";
const noSubscribe = () => () => {};

export const logout = async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.replace("/login");
};

/** `gate`: cover the page with the QR code while this user's WhatsApp isn't linked (off for admin and account pages). */
export default function AppHeader({ active, gate = true, children }: { active: Tab; gate?: boolean; children?: ReactNode }) {
  // Users and Account pages are always about your own account, so they end "viewing another account".
  // (Declared before the polls so it runs before their first request.)
  const ownPage = active === "admin" || active === "account";
  const cookieViewing = useSyncExternalStore(noSubscribe, () => Boolean(getViewAs()), () => false);
  const viewing = cookieViewing && !ownPage;
  useEffect(() => {
    if (ownPage) stopViewing();
    document.documentElement.toggleAttribute("data-viewing", viewing);
  }, [ownPage, viewing]);
  const status = usePoll(() => wa<Status>("status"), 3000);
  const me = useMe();
  const exitView = () => {
    stopViewing();
    window.location.replace("/admin");
  };
  const s = status.data;
  const connected = s?.status === "connected";
  const tabs: { href: string; key: Tab; label: string }[] = [
    { href: "/", key: "overview", label: "Overview" },
    { href: "/inbox", key: "inbox", label: "Inbox" },
    ...(me?.role === "superadmin" ? [{ href: "/admin", key: "admin" as const, label: "Users" }] : []),
  ];

  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-3 sm:px-4">
        <nav className="flex rounded-lg bg-sunken p-0.5">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={t.href}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${
                active === t.key ? "bg-panel text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-3 text-[13px] text-muted">
          {status.error ? (
            <span className="flex items-center gap-1.5 text-danger">
              <span className="size-2 rounded-full bg-danger" /> Service offline
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${connected ? "bg-accent" : "bg-warn"}`} />
              <span className="hidden sm:inline">
                {connected ? `${s?.name ?? "Connected"} · +${s?.number}` : s ? "WhatsApp not linked" : "…"}
              </span>
            </span>
          )}
          {s?.ai && <span className="hidden rounded-md border border-line px-2 py-0.5 font-mono text-[11px] lg:inline">{s.ai}</span>}
          {children}
          <Link
            href="/account"
            className={`max-w-[9rem] truncate rounded-md px-2 py-1 text-[13px] hover:bg-sunken hover:text-ink ${active === "account" ? "text-ink" : ""}`}
            title="Your account"
          >
            {me ? me.username : "Account"}
          </Link>
          <button onClick={logout} className="hidden rounded-md px-2 py-1 text-[13px] text-muted hover:bg-sunken hover:text-ink sm:block">
            Log out
          </button>
        </div>
      </header>
      {viewing && me?.role === "superadmin" && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-warn-soft px-4 py-2 text-[13px] text-warn">
          <span className="min-w-0 flex-1">
            Viewing <b className="font-semibold">{s?.name || "another account"}</b>
            {s?.number ? ` · +${s.number}` : ""}
            {s && !connected ? " (WhatsApp not connected right now, showing stored chats)" : ""} · read-only. You can&apos;t send messages or change settings here, and the owner can see
            that you viewed it.
          </span>
          <button onClick={exitView} className="rounded-md border border-warn/40 px-2.5 py-1 text-[12.5px] font-medium hover:bg-warn/10">
            Exit
          </button>
        </div>
      )}
      {status.error && status.error !== "Please log in" && (
        <div className="border-b border-line bg-warn-soft px-4 py-2 text-[13px] text-warn">{status.error}</div>
      )}
      {gate && s && !connected && !status.error && !viewing && <QrGate status={s} me={me} />}
    </>
  );
}

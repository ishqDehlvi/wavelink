"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import {
  type AdminUser,
  type Brief,
  type Overview,
  type Status,
  ago,
  chatHref,
  initials,
  mediaLabel,
  useMe,
  usePoll,
  wa,
} from "@/lib/wa";
import type { NotionPage, NotionStatus } from "@/lib/notion";
import AppHeader from "./AppHeader";
import { Icon } from "./Sidebar";

function greeting(now: Date) {
  const h = now.getHours();
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

// The clock is read in the browser only (Cache Components forbids reading it during prerender).
function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);
  return now;
}

const Bar = ({ className = "" }: { className?: string }) => <span className={`block animate-pulse rounded bg-sunken-2 ${className}`} />;

function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel flex min-w-0 flex-col ${className}`}>
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        <div className="ml-auto text-[13px]">{action}</div>
      </div>
      {children}
    </section>
  );
}

const More = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="font-medium text-accent hover:underline">
    {children}
  </Link>
);

/** Home: today at a glance, for WhatsApp and Notion together. Every row is a way in. */
export default function Home() {
  const now = useNow();
  const me = useMe();
  const admin = me?.role === "superadmin";
  const wantsWa = me?.whatsapp === true;
  const status = usePoll(() => (wantsWa ? wa<Status>("status") : Promise.resolve(null)), wantsWa ? 15000 : 600000);
  const linked = status.data?.status === "connected";
  const overview = usePoll(() => (linked ? wa<Overview>("overview") : Promise.resolve(null)), linked ? 30000 : 600000);
  const notionStatus = usePoll(() => (me ? wa<NotionStatus>("notion/status") : Promise.resolve(null)), me ? 60000 : 600000);
  const notionOn = Boolean(notionStatus.data?.connected);
  const pages = usePoll(() => (notionOn ? wa<NotionPage[]>("notion/pages") : Promise.resolve(null)), notionOn ? 60000 : 600000);
  const team = usePoll(() => (admin ? wa<AdminUser[]>("admin/users") : Promise.resolve(null)), admin ? 60000 : 600000);

  const o = overview.data;
  const first = (status.data?.name || me?.name || me?.username || "").split(" ")[0];
  const showNotion = Boolean(me && (admin || me.notion.access || !me.whatsapp));
  const recent = [...(pages.data ?? [])].sort((a, b) => (b.lastEdited ?? 0) - (a.lastEdited ?? 0)).slice(0, 6);
  const people = (team.data ?? []).filter((u) => !u.disabled);

  const strip: { label: string; value: ReactNode; href: string; icon: ReactNode }[] = [];
  if (wantsWa && linked) {
    strip.push({
      label: "Waiting on you",
      value: o ? o.waitingCount : <Bar className="h-5 w-6" />,
      href: "/inbox?filter=pending",
      icon: <path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />,
    });
    strip.push({
      label: "Messages today",
      value: o ? o.today.incoming + o.today.groupIncoming : <Bar className="h-5 w-8" />,
      href: "/whatsapp",
      icon: <path d="M4 5h16v11H8l-4 4z" />,
    });
  }
  if (showNotion)
    strip.push({
      label: "Notion pages",
      value: notionOn ? (pages.data ? pages.data.length : <Bar className="h-5 w-6" />) : "—",
      href: "/notion",
      icon: <path d="M7 3.5h7l4 4V20.5H7zM14 3.5v4h4" />,
    });
  if (admin)
    strip.push({
      label: "Team",
      value: team.data ? people.length : <Bar className="h-5 w-6" />,
      href: "/admin",
      icon: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5M16 4.5a3.3 3.3 0 0 1 0 6.3M18 14.5c2 .6 3.3 2.6 3.5 5.5" />,
    });

  return (
    <div className="flex h-full flex-col">
      <AppHeader active="home" gate={false}>
        {wantsWa && linked && status.data && (
          <Link href="/whatsapp" className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${linked ? "bg-accent-soft text-accent-deep" : "bg-warn-soft text-warn"}`}>
            <span className={`size-1.5 rounded-full ${linked ? "bg-accent-bright" : "bg-warn"}`} />
            <span className="hidden sm:inline">{linked ? `WhatsApp · +${status.data.number}` : "WhatsApp not linked"}</span>
          </Link>
        )}
        {notionOn && (
          <Link href="/notion" className="hidden items-center gap-1.5 rounded-full bg-panel px-2.5 py-1 text-ink-2 ring-1 ring-line sm:flex">
            <span className="size-1.5 rounded-full bg-accent-bright" />
            Notion · {notionStatus.data?.workspace?.name || "connected"}
          </Link>
        )}
      </AppHeader>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1080px] px-4 pt-8 pb-14 sm:px-8 sm:pt-10">
          <h1 className="font-display min-h-10 text-[34px] leading-tight font-bold text-ink">
            {now ? greeting(now) : "Hello"}
            {first ? `, ${first}` : ""}
          </h1>
          <p className="mt-1 min-h-5 text-[14.5px] text-muted">
            {now?.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
          </p>

          {strip.length > 0 && (
            <nav aria-label="At a glance" className={`panel mt-7 grid overflow-hidden ${strip.length >= 4 ? "lg:grid-cols-4" : strip.length === 3 ? "lg:grid-cols-3" : strip.length === 2 ? "lg:grid-cols-2" : ""}`}>
              {strip.map((x, i) => (
                <Link
                  key={x.label}
                  href={x.href}
                  className={`group flex items-center gap-3 px-5 py-3 transition-colors duration-150 hover:bg-sunken lg:py-4 ${i > 0 ? "border-t border-line lg:border-t-0 lg:border-l" : ""}`}
                >
                  <span className="hidden size-9 shrink-0 place-items-center rounded-[10px] bg-sunken text-ink-2 group-hover:bg-panel lg:grid">
                    <Icon d={x.icon} className="size-[18px]" />
                  </span>
                  <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3 lg:block">
                    <span className="block text-[13.5px] text-muted lg:text-[12.5px]">{x.label}</span>
                    <span className="font-display block text-[20px] leading-tight font-bold tabular-nums lg:text-[24px]">{x.value}</span>
                  </span>
                </Link>
              ))}
            </nav>
          )}

          {wantsWa && linked && <BriefPanel />}

          {wantsWa && status.data && !linked && (
            <div className="panel mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
              <span className="hidden size-9 shrink-0 place-items-center rounded-[10px] bg-warn-soft text-warn sm:grid">
                <Icon d={<path d="M4 5h16v11H8l-4 4z" />} className="size-[18px]" />
              </span>
              <p className="min-w-[15rem] flex-1 text-[14px] text-ink-2">
                <span className="font-medium text-ink">Your WhatsApp isn&apos;t linked yet.</span> Scan one QR code (like WhatsApp Web) and the people waiting on you show up here.
              </p>
              <Link href="/whatsapp" className="inline-flex h-9 shrink-0 items-center rounded-[10px] bg-accent px-4 text-[13.5px] font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-deep">
                Link WhatsApp
              </Link>
            </div>
          )}

          <div className={`mt-5 grid items-start gap-5 ${wantsWa && linked && showNotion ? "lg:grid-cols-12" : ""}`}>
            {wantsWa && linked && (
              <Panel
                title="Waiting on you"
                className={showNotion ? "lg:col-span-7" : ""}
                action={linked && o?.waiting.length ? <More href="/inbox?filter=pending">Open inbox</More> : null}
              >
                {!status.data && !status.error ? (
                  <RowsSkeleton />
                ) : !o ? (
                  <RowsSkeleton />
                ) : o.waiting.length === 0 ? (
                  <p className="px-5 pb-6 text-[14px] text-muted">You&apos;re all caught up. Nobody is waiting on a reply.</p>
                ) : (
                  <ul className="px-2 pb-2">
                    {o.waiting.slice(0, 6).map((w) => (
                      <li key={w.jid}>
                        <Link href={chatHref(w.jid)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-sunken">
                          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-[12.5px] font-semibold text-accent-deep">{initials(w.name)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline gap-2">
                              <span className="truncate text-[14px] font-medium">{w.name}</span>
                              <span className="ml-auto shrink-0 text-[12px] text-faint">{ago(w.lastTs)}</span>
                            </span>
                            <span className="mt-0.5 flex items-center gap-2">
                              <span className="truncate text-[13px] text-muted">{w.last || mediaLabel[w.media ?? ""] || "…"}</span>
                              {w.pending > 1 && <span className="ml-auto shrink-0 rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-ink tabular-nums">{w.pending}</span>}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}

            {showNotion && (
              <Panel title="Your Notion" className={wantsWa && linked ? "lg:col-span-5" : ""} action={notionOn && recent.length ? <More href="/notion">All pages</More> : null}>
                {!notionStatus.data ? (
                  <RowsSkeleton />
                ) : !notionOn ? (
                  <div className="px-5 pb-6">
                    <p className="text-[14px] text-muted">
                      {admin ? "Connect Notion once for the whole team, then choose who can see each page." : "Notion isn't connected yet. A superadmin connects it for everyone."}
                    </p>
                    {admin && (
                      <Link href="/notion" className="mt-4 inline-flex h-9 items-center rounded-[10px] bg-accent px-4 text-[13.5px] font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-deep">
                        Connect Notion
                      </Link>
                    )}
                  </div>
                ) : !pages.data ? (
                  <RowsSkeleton />
                ) : recent.length === 0 ? (
                  <p className="px-5 pb-6 text-[14px] text-muted">{admin ? "No pages are shared with the connection yet." : "Nothing has been shared with you yet. Ask a superadmin."}</p>
                ) : (
                  <ul className="px-2 pb-2">
                    {recent.map((p) => (
                      <li key={p.id}>
                        <Link href={`/notion?page=${p.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-sunken">
                          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-sunken text-[16px] text-ink-2">
                            {p.icon ?? <Icon d={p.kind === "database" ? <path d="M4 5h16v14H4zM4 10h16M4 14.5h16M10 10v9" /> : <path d="M7 3.5h7l4 4V20.5H7zM14 3.5v4h4" />} className="size-[17px]" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium">{p.title}</span>
                            <span className="block truncate text-[12.5px] text-faint">
                              {p.kind === "database" ? "Database" : "Page"}
                              {p.lastEdited ? ` · edited ${ago(p.lastEdited)}` : ""}
                              {!admin ? ` · ${p.perms.edit ? "you can edit" : "read only"}` : ""}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}
          </div>

          {admin && (
            <Panel title="Team" className="mt-5" action={<More href="/admin">Manage users</More>}>
              {!team.data ? (
                <RowsSkeleton />
              ) : (
                <ul className="grid gap-x-2 px-2 pb-2 sm:grid-cols-2">
                  {people.map((u) => {
                    const w = u.whatsapp;
                    const wa = !u.whatsappEnabled ? "Notion only" : w?.status === "connected" ? `WhatsApp +${w.number}` : w?.linked ? "Reconnecting" : "WhatsApp not linked";
                    return (
                      <li key={u.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-[12.5px] font-semibold text-panel">{(u.name || u.username)[0].toUpperCase()}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium">
                            {u.name || u.username}
                            {u.id === me?.id && <span className="font-normal text-faint"> (you)</span>}
                          </span>
                          <span className="flex items-center gap-1.5 truncate text-[12.5px] text-faint">
                            <span className={`size-1.5 shrink-0 rounded-full ${w?.status === "connected" ? "bg-accent-bright" : u.whatsappEnabled ? "bg-line-strong" : "bg-transparent"}`} />
                            {wa}
                            {u.role === "superadmin" ? " · superadmin" : u.notion ? " · Notion" : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-[12px] text-faint">{u.lastLogin ? ago(u.lastLogin) : "never"}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </main>
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="space-y-4 px-5 pb-6 pt-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Bar className="size-9 rounded-full" />
          <span className="flex-1 space-y-2">
            <Bar className="h-3 w-1/3" />
            <Bar className="h-3 w-2/3" />
          </span>
        </div>
      ))}
    </div>
  );
}

function BriefPanel() {
  const brief = usePoll(() => wa<Brief>("brief?hours=24"), 120000);
  const b = brief.data;
  return (
    <section className="panel mt-5 px-6 py-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span className="size-2 rounded-full bg-accent-bright" />
          Today&apos;s brief
        </h2>
        {b?.generatedAt && (
          <span className="text-[12.5px] text-faint">
            from {b.items} chats · {ago(b.generatedAt)}
          </span>
        )}
        <span className="ml-auto text-[13px]">
          <More href="/whatsapp">WhatsApp overview</More>
        </span>
      </div>
      {b?.text ? (
        <p key={b.generatedAt} className="arrive mt-3 max-w-[72ch] text-[15.5px] leading-relaxed text-ink-2">
          {b.text}
        </p>
      ) : brief.error ? (
        <p className="mt-3 text-[13.5px] text-muted">The brief isn&apos;t available right now ({brief.error}).</p>
      ) : (
        <div className="mt-4 space-y-2.5">
          <Bar className="h-3.5 w-11/12" />
          <Bar className="h-3.5 w-3/4" />
          <p className="pt-1 text-[12.5px] text-faint">Reading your chats… the first brief takes about 20 seconds.</p>
        </div>
      )}
    </section>
  );
}

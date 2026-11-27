"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  type Brief,
  type DigestItem,
  type Overview as OverviewData,
  ago,
  chatHref,
  mediaLabel,
  usePoll,
  wa,
} from "@/lib/wa";
import AppHeader from "./AppHeader";
import AutoReplyCard from "./AutoReplyCard";
import ConnectorCard from "./ConnectorCard";

const RANGES = [
  { h: 6, label: "6h" },
  { h: 24, label: "24h" },
  { h: 72, label: "3 days" },
  { h: 168, label: "7 days" },
];

const MODE_LABEL = { off: "Auto-reply is off", allowlist: "On for selected chats", all: "On for everyone" } as const;

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

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-sunken ${className}`} />;
}

/** One cell of the summary row: label, number, one line of context; a link when there's somewhere to go. */
function Stat({ label, value, sub, href, i }: { label: string; value?: number; sub?: string; href?: string; i: number }) {
  const cls = `block px-5 py-4 ${i > 0 ? "border-line lg:border-l" : ""} ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t lg:border-t-0" : ""} ${href ? "transition-colors duration-150 hover:bg-sunken" : ""}`;
  const body = (
    <>
      <span className="block text-[12.5px] text-muted">{label}</span>
      <span className="mt-0.5 block text-[22px] leading-tight font-semibold tabular-nums">
        {value ?? <span className="inline-block h-5 w-8 animate-pulse rounded bg-sunken-2 align-middle" />}
      </span>
      <span className="mt-1 block truncate text-[12px] text-faint">{sub ?? " "}</span>
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const PRIORITY_STYLE: Record<string, string> = {
  high: "bg-warn-soft text-warn",
  normal: "bg-sunken text-muted",
  low: "bg-sunken text-faint",
};

function SummaryCard({ item }: { item: DigestItem }) {
  return (
    <Link
      href={chatHref(item.jid)}
      className="panel group flex h-full flex-col p-4 transition-colors duration-150 hover:border-line-strong"
    >
      <div className="flex items-center gap-2">
        <span className="truncate text-[14px] font-semibold">{item.name}</span>
        {item.priority && (
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium capitalize ${PRIORITY_STYLE[item.priority]}`}>
            {item.priority}
          </span>
        )}
        <span className="ml-auto shrink-0 text-[11.5px] text-faint">{ago(item.lastTs)}</span>
      </div>
      <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-muted">
        {item.summary ?? `${item.incoming} new message${item.incoming === 1 ? "" : "s"}`}
      </p>
      <div className="mt-3 flex items-center text-[12px]">
        <span className="text-faint">
          {item.incoming} message{item.incoming === 1 ? "" : "s"}
        </span>
        <span className="ml-auto font-medium text-accent">Open chat</span>
      </div>
    </Link>
  );
}

function Section({ title, count, children, action }: { title: string; count?: number; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
        {count !== undefined && <span className="text-[13px] text-faint">{count}</span>}
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}

function ActivityChart({ hourly }: { hourly: number[] }) {
  const max = Math.max(1, ...hourly);
  const now = new Date().getHours();
  return (
    <div>
      <div className="flex h-32 items-end gap-[3px]">
        {hourly.map((n, h) => (
          <div key={h} className="group relative flex h-full flex-1 items-end" title={`${h}:00 — ${n} message${n === 1 ? "" : "s"}`}>
            <div
              className={`w-full rounded-t-[3px] ${h === now ? "bg-accent" : h > now ? "bg-line/50" : n ? "bg-accent/45" : "bg-line"}`}
              style={{ height: `${n ? Math.max(6, (n / max) * 100) : 3}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-faint">
        {["12a", "6a", "12p", "6p", "12a"].map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
    </div>
  );
}

export default function Overview() {
  const [hours, setHours] = useState(24);
  const now = useNow();
  const overview = usePoll(() => wa<OverviewData>("overview"), 15000);
  const o = overview.data;

  return (
    <div className="flex h-full flex-col">
      <AppHeader active="overview" />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1080px] space-y-8 px-4 pt-8 pb-14 sm:px-8 sm:pt-10">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <h1 className="font-display text-[30px] leading-tight font-bold">WhatsApp</h1>
              <p className="mt-1 min-h-5 text-[14px] text-muted">
                {now?.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
                {o ? ` · ${MODE_LABEL[o.autoReply.mode]}` : ""}
              </p>
            </div>
            <div className="ml-auto flex rounded-[10px] border border-line bg-panel p-1 shadow-[0_1px_2px_rgb(13_19_16/0.04)]" role="group" aria-label="Period">
              {RANGES.map((r) => (
                <button
                  key={r.h}
                  onClick={() => setHours(r.h)}
                  aria-pressed={hours === r.h}
                  className={`rounded-md px-3 py-1 text-[13px] transition-colors duration-150 ${hours === r.h ? "bg-ink font-medium text-panel" : "text-muted hover:text-ink"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* key: refetch brief + summaries when the range changes */}
          <BriefCard key={`brief-${hours}`} hours={hours} />

          <div className="panel grid grid-cols-2 overflow-hidden lg:grid-cols-4">
            <Stat i={0} label="Waiting on you" value={o?.waitingCount} sub="people, last 7 days" href="/inbox?filter=pending" />
            <Stat
              i={1}
              label="Messages today"
              value={o?.today.incoming}
              sub={o ? `+${o.today.groupIncoming} in groups · you sent ${o.today.sent}` : undefined}
            />
            <Stat i={2} label="Active chats today" value={o?.today.activeChats} sub="people and groups" />
            <Stat i={3} label="Auto-replies today" value={o?.today.autoReplies} sub={o ? MODE_LABEL[o.autoReply.mode] : undefined} href="#autoreply" />
          </div>

          <AutoReplyCard />

          <ConnectorCard />

          <Summaries key={`sum-${hours}`} hours={hours} waitingFallback={o?.waiting} />

          <div className="grid gap-3 lg:grid-cols-5">
            <div className="panel p-4 lg:col-span-3">
              <div className="mb-4 flex items-baseline">
                <h2 className="text-[14px] font-semibold">Incoming today, by hour</h2>
                <span className="ml-auto text-[12px] text-faint">{o ? `${o.today.incoming + o.today.groupIncoming} total` : ""}</span>
              </div>
              {o ? <ActivityChart hourly={o.hourly} /> : <Skeleton className="h-36" />}
            </div>
            <div className="panel p-4 lg:col-span-2">
              <h2 className="mb-3 text-[14px] font-semibold">Busiest today</h2>
              {!o && <Skeleton className="h-36" />}
              {o?.busiest.length === 0 && <p className="text-[13px] text-muted">Quiet day so far.</p>}
              <ul className="space-y-1">
                {o?.busiest.map((b) => {
                  const max = o.busiest[0]?.count || 1;
                  return (
                    <li key={b.jid}>
                      <Link href={chatHref(b.jid)} className="relative block overflow-hidden rounded-lg px-2.5 py-1.5 hover:bg-sunken">
                        <span className="absolute inset-y-0 left-0 bg-accent-soft" style={{ width: `${(b.count / max) * 100}%` }} />
                        <span className="relative flex items-center gap-2 text-[13px]">
                          <span className="truncate">{b.name}</span>
                          {b.isGroup && <span className="text-[11px] text-faint">group</span>}
                          <span className="ml-auto tabular-nums text-muted">{b.count}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function BriefCard({ hours }: { hours: number }) {
  const brief = usePoll(() => wa<Brief>(`brief?hours=${hours}`), 120000);
  const b = brief.data;
  return (
    <div className="panel px-6 py-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <span className="size-2 rounded-full bg-accent-bright" />
          Brief
        </h2>
        {b?.generatedAt && <span className="text-[12.5px] text-faint">from {b.items} chats · {ago(b.generatedAt)}</span>}
      </div>
      {b?.text ? (
        <p className="mt-3 max-w-[72ch] text-[15.5px] leading-relaxed text-ink-2">{b.text}</p>
      ) : brief.error ? (
        <p className="mt-2 text-[13.5px] text-danger">{brief.error}</p>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="h-4 w-11/12 animate-pulse rounded bg-sunken-2" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-sunken-2" />
          <p className="pt-1 text-[12px] text-muted">Reading your chats… the first brief takes about 20 seconds.</p>
        </div>
      )}
    </div>
  );
}

function Summaries({ hours, waitingFallback }: { hours: number; waitingFallback?: OverviewData["waiting"] }) {
  const digest = usePoll(() => wa<DigestItem[]>(`digest?hours=${hours}`), 60000);
  const items = digest.data;
  const needs = items?.filter((i) => i.needsReply && !i.isGroup) ?? [];
  const groups = items?.filter((i) => i.isGroup) ?? [];
  const rest = items?.filter((i) => !i.needsReply && !i.isGroup) ?? [];
  const grid = "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";

  if (digest.error) return <p className="text-[13px] text-danger">{digest.error}</p>;

  return (
    <>
      <Section
        title="Needs your reply"
        count={items ? needs.length : undefined}
        action={
          <Link href="/inbox?filter=pending" className="text-[12.5px] text-accent hover:underline">
            Open inbox
          </Link>
        }
      >
        {!items ? (
          // summaries are still generating: show who's waiting straight away
          waitingFallback?.length ? (
            <div className={grid}>
              {waitingFallback.slice(0, 6).map((w) => (
                <Link key={w.jid} href={chatHref(w.jid)} className="panel p-4 transition-colors duration-150 hover:border-line-strong">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-semibold">{w.name}</span>
                    <span className="ml-auto text-[11.5px] text-faint">{ago(w.lastTs)}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[13.5px] text-muted">{w.last || mediaLabel[w.media ?? ""] || "…"}</p>
                  <p className="mt-3 text-[11.5px] text-faint">Writing summary…</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className={grid}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-36" />
              ))}
            </div>
          )
        ) : needs.length ? (
          <div className={grid}>
            {needs.map((i) => (
              <SummaryCard key={i.jid} item={i} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-[14px] text-muted">
            You&apos;re all caught up. Nobody is waiting on a reply in this period.
          </p>
        )}
      </Section>

      {groups.length > 0 && (
        <Section title="Groups" count={groups.length}>
          <div className={grid}>
            {groups.map((i) => (
              <SummaryCard key={i.jid} item={i} />
            ))}
          </div>
        </Section>
      )}

      {rest.length > 0 && (
        <Section title="Everything else" count={rest.length}>
          <div className={grid}>
            {rest.map((i) => (
              <SummaryCard key={i.jid} item={i} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

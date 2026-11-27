"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useState } from "react";
import { ago, usePoll, wa } from "@/lib/wa";
import {
  type AccessMatrix,
  type Activity,
  type NotionStatus,
  type Perm,
  type Perms,
  PERMS,
  PERM_HELP,
  PERM_LABEL,
  effectiveFor,
  treeOf,
} from "@/lib/notion";
import AppHeader from "./AppHeader";

type Page = AccessMatrix["pages"][number];

/** Superadmin: who can do what on which Notion page. One user at a time, the whole page tree as a checklist. */
export default function NotionAccess() {
  const router = useRouter();
  const params = useSearchParams();
  const status = usePoll(() => wa<NotionStatus>("notion/status"), 60000);
  const matrix = usePoll(() => wa<AccessMatrix>("notion/access"), 60000);
  const activity = usePoll(() => wa<Activity[]>("notion/activity"), 30000);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const m = matrix.data;
  const people = (m?.users ?? []).filter((u) => u.role !== "superadmin");
  const admins = (m?.users ?? []).filter((u) => u.role === "superadmin");
  const userId = params.get("user") && people.some((u) => u.id === params.get("user")) ? params.get("user")! : people[0]?.id;
  const user = people.find((u) => u.id === userId);
  // (the React compiler memoizes these)
  const kids = treeOf(m?.pages ?? []);
  const titles = new Map((m?.pages ?? []).map((p) => [p.id, p.title]));
  const counts = new Map<string, number>();
  if (m) for (const u of people) counts.set(u.id, m.pages.filter((p) => effectiveFor(u.id, p.id, m).perms.read).length);

  const save = async (pageId: string, perms: Perms | null) => {
    if (!user) return;
    setSaving(pageId);
    setError(null);
    try {
      matrix.setData(await wa<AccessMatrix>("notion/access", { method: "PUT", body: { userId: user.id, pageId, perms } }));
      activity.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  };

  const tick = (page: Page, k: Perm, current: Perms) => {
    const next = { ...current, [k]: !current[k] };
    if (k !== "read" && next[k]) next.read = true; // anything else needs reading
    if (k === "read" && !next.read) for (const p of PERMS) next[p] = false;
    save(page.id, next);
  };

  const query = q.trim().toLowerCase();
  const matches = (p: Page): boolean => !query || p.title.toLowerCase().includes(query) || (kids.get(p.id) ?? []).some(matches);

  const rows = (list: Page[], depth: number): ReactNode[] =>
    list.filter(matches).flatMap((p) => {
      if (!m || !user) return [];
      const eff = effectiveFor(user.id, p.id, m);
      const blocked = eff.explicit && !eff.perms.read;
      const state = eff.explicit
        ? blocked
          ? "Blocked here"
          : "Set here"
        : eff.from
          ? `${eff.perms.read ? "From" : "Blocked by"} ${titles.get(eff.from) ?? "a parent page"}`
          : "No access";
      return [
        <tr key={p.id} className={`border-b border-line last:border-0 ${saving === p.id ? "opacity-60" : ""}`}>
          <td className="max-w-0 py-1.5 pr-3" style={{ paddingLeft: 12 + depth * 18 }}>
            <div className="flex min-w-0 items-center gap-1.5">
              {p.icon ? (
                <span className="w-5 shrink-0 text-center">{p.icon}</span>
              ) : (
                <svg viewBox="0 0 24 24" className="size-[15px] w-5 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                  {p.kind === "database" ? <path d="M4 5h16v14H4zM4 10h16M4 14.5h16M10 10v9" /> : <path d="M7 3.5h7l4 4V20.5H7zM14 3.5v4h4" />}
                </svg>
              )}
              <span className={`truncate ${eff.perms.read ? "text-ink" : "text-muted"}`}>{p.title}</span>
            </div>
          </td>
          {PERMS.map((k) => (
            <td key={k} className="w-[72px] px-1 text-center">
              <input
                type="checkbox"
                checked={eff.perms[k]}
                onChange={() => tick(p, k, eff.perms)}
                disabled={saving !== null}
                aria-label={`${PERM_LABEL[k]}: ${p.title}`}
                className={`size-4 cursor-pointer accent-[var(--accent)] ${eff.explicit ? "" : "opacity-45"}`}
              />
            </td>
          ))}
          <td className="w-44 whitespace-nowrap px-3 text-[12px]">
            <span className={eff.explicit ? (blocked ? "text-danger" : "font-medium text-ink") : eff.from && !eff.perms.read ? "text-danger/70" : "text-faint"}>{state}</span>
            {eff.explicit && (
              <button onClick={() => save(p.id, null)} disabled={saving !== null} className="ml-2 text-accent hover:underline" title="Remove this page's own setting so it follows its parent again">
                Reset
              </button>
            )}
          </td>
        </tr>,
        ...rows(kids.get(p.id) ?? [], depth + 1),
      ];
    });

  const notConnected = status.data && !status.data.connected;

  return (
    <div className="flex h-full flex-col">
      <AppHeader active="notion-access" gate={false} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="shrink-0 border-b border-line bg-bg md:w-[248px] md:border-r md:border-b-0">
          <div className="px-5 pt-5 pb-2 text-[13px] font-semibold text-ink">People</div>
          <ul className="flex gap-1 overflow-x-auto px-2 pb-3 md:block md:space-y-0.5 md:overflow-visible">
            {people.map((u) => (
              <li key={u.id} className="shrink-0">
                <button
                  onClick={() => router.replace(`/notion/access?user=${u.id}`)}
                  className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[14px] transition-colors duration-150 ${u.id === userId ? "bg-panel font-medium text-ink shadow-[0_1px_2px_rgb(13_19_16/0.06),0_0_0_1px_var(--line)]" : "text-ink-2 hover:bg-sunken-2/70 hover:text-ink"}`}
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sunken text-[11px] font-semibold text-ink ring-1 ring-line">
                    {(u.name || u.username)[0].toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{u.name || u.username}</span>
                  <span className="text-[11.5px] text-faint">{counts.get(u.id) ?? 0}</span>
                </button>
              </li>
            ))}
            {m && people.length === 0 && (
              <li className="px-2.5 py-2 text-[13px] text-muted">
                No users yet. <Link href="/admin" className="text-accent underline">Add one</Link>.
              </li>
            )}
          </ul>
          {admins.length > 0 && (
            <p className="hidden px-4 pb-4 text-[12px] leading-relaxed text-faint md:block">
              {admins.map((a) => a.name || a.username).join(", ")} {admins.length === 1 ? "is a superadmin" : "are superadmins"} and can always do everything.
            </p>
          )}
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1080px] space-y-6 px-4 pt-8 pb-14 sm:px-8 sm:pt-10">
            {notConnected && (
              <div className="rounded-xl border border-line bg-warn-soft px-4 py-3 text-[13px] text-warn">
                Notion isn&apos;t connected. <Link href="/notion" className="underline">Connect it</Link> to share pages.
              </div>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-[30px] leading-tight font-bold">{user ? `What ${user.name || user.username} can do` : "Notion access"}</h1>
                <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-muted">
                  A tick on a page also covers its sub-pages, unless a sub-page has its own setting. Faded ticks are inherited. Unticking Read on a sub-page blocks it.
                  These rules apply on the dashboard and in your AI apps alike.
                </p>
              </div>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter pages" className="h-9 w-48 rounded-lg border border-line bg-panel px-3 text-[13px] outline-none focus:border-accent" />
            </div>
            {error && <p className="text-[13px] text-danger">{error}</p>}
            {matrix.error && <p className="text-[13px] text-danger">{matrix.error}</p>}

            {user && m && (
              <div className="overflow-x-auto panel">
                <table className="w-full min-w-[720px] table-fixed text-[13.5px]">
                  <thead>
                    <tr className="border-b border-line text-[12px] text-muted">
                      <th className="px-3 py-2.5 text-left font-medium">Page</th>
                      {PERMS.map((k) => (
                        <th key={k} className="w-[72px] px-1 py-2.5 font-medium" title={PERM_HELP[k]}>
                          {PERM_LABEL[k]}
                        </th>
                      ))}
                      <th className="w-44 px-3 py-2.5 text-left font-medium">Setting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.pages.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-muted">
                          No pages shared with the connection yet.
                        </td>
                      </tr>
                    )}
                    {rows(kids.get(null) ?? [], 0)}
                  </tbody>
                </table>
              </div>
            )}

            <section>
              <h2 className="text-[16px] font-semibold tracking-tight">Recent Notion activity</h2>
              <ul className="mt-2 divide-y divide-line overflow-hidden panel">
                {(activity.data ?? []).length === 0 && <li className="px-4 py-3 text-[13px] text-muted">Nothing yet.</li>}
                {(activity.data ?? []).slice(0, 15).map((a, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2 px-4 py-2.5 text-[13px]">
                    <span className="font-medium">{a.username}</span>
                    <span className="text-muted">{a.action}</span>
                    {a.title && <span className="truncate">&ldquo;{a.title}&rdquo;</span>}
                    <span className="ml-auto text-[12px] text-faint">
                      {a.via === "chatgpt" ? "from an AI app" : "on the dashboard"} · {ago(a.ts)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

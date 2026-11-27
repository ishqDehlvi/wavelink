"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ago, useMe, usePoll, wa } from "@/lib/wa";
import {
  type Block,
  type NotionPage,
  type NotionStatus,
  type PageDetail,
  type Perm,
  PERMS,
  PERM_LABEL,
  type Span,
  treeOf,
} from "@/lib/notion";
import AppHeader from "./AppHeader";

const input =
  "w-full rounded-lg border border-line bg-sunken px-3 py-2 text-[14px] outline-none placeholder:text-faint focus:border-accent";
const btn = "h-8 rounded-lg border border-line px-2.5 text-[12.5px] font-medium hover:bg-sunken disabled:opacity-50";
const primary = "h-8 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-ink disabled:opacity-60";

const PageIcon = ({ p, className = "" }: { p: { icon: string | null; kind: string }; className?: string }) =>
  p.icon ? (
    <span className={`w-5 shrink-0 text-center ${className}`}>{p.icon}</span>
  ) : (
    <svg viewBox="0 0 24 24" className={`size-[15px] shrink-0 text-faint ${className}`} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      {p.kind === "database" ? <path d="M4 5h16v14H4zM4 10h16M4 14.5h16M10 10v9" /> : <path d="M7 3.5h7l4 4V20.5H7zM14 3.5v4h4" />}
    </svg>
  );

export default function NotionPages() {
  const me = useMe();
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("page");
  const status = usePoll(() => wa<NotionStatus>("notion/status"), 30000);
  const connected = status.data?.connected;
  const pages = usePoll(() => (connected ? wa<NotionPage[]>("notion/pages") : Promise.resolve(null)), connected ? 20000 : 600000);
  // back from Notion's sign-in page: show the result once, then tidy the address
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(() => {
    const err = params.get("notion_error");
    if (params.get("connected")) return { ok: true, text: "Notion is connected. Your pages are syncing." };
    return err ? { ok: false, text: err } : null;
  });
  useEffect(() => {
    if (params.get("connected") || params.get("notion_error")) router.replace("/notion");
  }, [params, router]);

  const open = useCallback((id: string | null) => router.push(id ? `/notion?page=${id}` : "/notion"), [router]);
  const refreshAll = () => {
    status.refresh();
    pages.refresh();
  };

  const s = status.data;
  const selectedTitle = selected ? pages.data?.find((p) => p.id === selected)?.title : undefined;
  return (
    <div className="flex h-full flex-col">
      <AppHeader active="notion" gate={false} trail={selectedTitle ? [{ label: selectedTitle }] : []}>
        {s?.connected && (
          <span className="hidden items-center gap-1.5 sm:flex">
            <span className="size-2 rounded-full bg-accent" />
            {s.workspace?.icon ? `${s.workspace.icon} ` : ""}
            {s.workspace?.name || "Notion"}
          </span>
        )}
      </AppHeader>
      {notice && (
        <div className={`flex items-center gap-3 border-b border-line px-4 py-2 text-[13px] ${notice.ok ? "bg-accent-soft text-accent" : "bg-warn-soft text-warn"}`}>
          <span className="flex-1">{notice.text}</span>
          <button onClick={() => setNotice(null)} className="text-[12.5px] underline">
            Dismiss
          </button>
        </div>
      )}
      {!s && !status.error && <p className="p-6 text-[13px] text-muted">Loading…</p>}
      {status.error && <p className="p-6 text-[13px] text-danger">{status.error}</p>}
      {s && !s.connected && <NotConnected status={s} onDone={refreshAll} />}
      {s?.connected && (
        <div className="flex min-h-0 flex-1">
          <PageTree
            status={s}
            pages={pages.data}
            error={pages.error}
            selected={selected}
            onOpen={open}
            onChanged={refreshAll}
            hidden={Boolean(selected)}
          />
          <main className={`min-w-0 flex-1 overflow-y-auto ${selected ? "" : "hidden md:block"}`}>
            {selected ? (
              <PageView key={selected} id={selected} onOpen={open} onChanged={pages.refresh} />
            ) : (
              <Welcome count={pages.data?.length} admin={me?.role === "superadmin"} />
            )}
          </main>
        </div>
      )}
    </div>
  );
}

function Welcome({ count, admin }: { count?: number; admin: boolean }) {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-panel text-ink-2 shadow-[var(--shadow-panel)] ring-1 ring-line"><svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7 3.5h7l4 4V20.5H7zM14 3.5v4h4M10 12h5M10 15.5h5" /></svg></div>
        <h2 className="font-display mt-5 text-[22px] font-bold">{count === 0 ? "No pages yet" : "Pick a page"}</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
          {count === 0
            ? admin
              ? "Share pages with the connection in Notion (••• → Connections), then press Sync."
              : "A superadmin hasn't shared any Notion pages with you yet."
            : "Choose a page on the left to read it. What you can do on each page depends on the access a superadmin gave you."}
        </p>
        {admin && count !== 0 && (
          <Link href="/notion/access" className="mt-4 inline-flex h-8 items-center rounded-lg border border-line px-3 text-[12.5px] font-medium hover:bg-sunken">
            Manage who can see what
          </Link>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- connecting
function NotConnected({ status, onDone }: { status: NotionStatus; onDone: () => void }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!status.canManage)
    return (
      <div className="grid flex-1 place-items-center p-8 text-center">
        <div className="max-w-sm">
          <h2 className="text-[17px] font-semibold">Notion isn&apos;t connected yet</h2>
          <p className="mt-1.5 text-[13.5px] text-muted">A superadmin connects Notion for everyone. Once they share pages with you, they show up here.</p>
        </div>
      </div>
    );

  const oauth = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await wa<{ url: string }>("notion/oauth/start", { method: "POST" });
      window.location.assign(url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await wa("notion/token", { method: "POST", body: { token } });
      setToken("");
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-[30px] leading-tight font-bold">Connect Notion</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
          One connection for the whole organisation. You choose which Notion pages it can reach, then decide page by page who on your team can read, edit, add,
          comment or archive, here and from ChatGPT, Claude or any MCP app.
        </p>
        <div className="mt-6 panel p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink text-[15px] font-bold text-panel">N</div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[14.5px] font-semibold">Sign in with Notion</h3>
              <p className="mt-0.5 text-[13px] text-muted">Opens Notion, where you pick the pages to share. You can change the pages later.</p>
              <button onClick={oauth} disabled={busy || !status.oauthAvailable} className={`${primary} mt-3`}>
                Connect Notion
              </button>
              {!status.oauthAvailable && (
                <p className="mt-2 text-[12.5px] text-muted">
                  Not set up on this server yet: create a Notion integration with OAuth, add the redirect URL <code className="font-mono text-[12px]">{status.redirectUri}</code>, and
                  set <code className="font-mono text-[12px]">NOTION_CLIENT_ID</code> and <code className="font-mono text-[12px]">NOTION_CLIENT_SECRET</code>. Or paste a token below.
                </p>
              )}
            </div>
          </div>
        </div>
        <form onSubmit={save} className="mt-3 panel p-5">
          <h3 className="text-[14.5px] font-semibold">Or paste an integration token</h3>
          <p className="mt-0.5 text-[13px] text-muted">
            From notion.so/profile/integrations → your internal integration → Configuration. Then share pages with it in Notion: ••• → Connections → add it.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ntn_…"
              autoComplete="off"
              spellCheck={false}
              className={`${input} font-mono text-[13px]`}
            />
            <button disabled={busy || !token.trim()} className={`${primary} h-auto shrink-0 px-4`}>
              {busy ? "Checking…" : "Save"}
            </button>
          </div>
          <p className="mt-2 text-[12px] text-faint">The token is checked with Notion, then stored encrypted. It&apos;s never shown again.</p>
        </form>
        {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------- tree
function PageTree({
  status,
  pages,
  error,
  selected,
  onOpen,
  onChanged,
  hidden,
}: {
  status: NotionStatus;
  pages: NotionPage[] | null;
  error: string | null;
  selected: string | null;
  onOpen: (id: string) => void;
  onChanged: () => void;
  hidden: boolean;
}) {
  const [q, setQ] = useState("");
  // pages the person opened or closed by hand; otherwise top level and the way to the selected page are open
  const [expanded, setExpanded] = useState<Map<string, boolean>>(new Map());
  const [busy, setBusy] = useState(false);
  const kids = useMemo(() => treeOf(pages ?? []), [pages]);
  const query = q.trim().toLowerCase();
  const hits = query ? (pages ?? []).filter((p) => p.title.toLowerCase().includes(query)) : null;

  // keep the selected page's ancestors open
  const parentOf = useMemo(() => new Map((pages ?? []).map((p) => [p.id, p.parentId])), [pages]);
  const openPath = useMemo(() => {
    const s = new Set<string>();
    for (let id = selected ? parentOf.get(selected) : null, i = 0; id && i < 50; id = parentOf.get(id), i++) s.add(id);
    return s;
  }, [selected, parentOf]);

  const isOpen = (id: string, depth: number) => expanded.get(id) ?? (depth === 0 || openPath.has(id));
  const toggle = (id: string, depth: number) => setExpanded((m) => new Map(m).set(id, !isOpen(id, depth)));

  const sync = async () => {
    setBusy(true);
    try {
      await wa("notion/sync", { method: "POST" });
      onChanged();
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async () => {
    if (!window.confirm("Disconnect Notion? Nobody can open Notion pages here or from their AI apps until it's connected again. Who-can-see-what settings are kept.")) return;
    try {
      await wa("notion/connection", { method: "DELETE" });
      onChanged();
    } catch (e) {
      window.alert((e as Error).message);
    }
  };

  const row = (p: NotionPage, depth: number): ReactNode => {
    const children = kids.get(p.id) ?? [];
    const open = isOpen(p.id, depth);
    const on = p.id === selected;
    return (
      <li key={p.id}>
        <div
          className={`group flex items-center gap-1 rounded-md pr-2 text-[13.5px] ${on ? "bg-sunken font-medium text-ink" : "text-ink/85 hover:bg-sunken/70"}`}
          style={{ paddingLeft: depth * 14 + 4 }}
        >
          <button
            onClick={() => toggle(p.id, depth)}
            className={`grid size-5 shrink-0 place-items-center rounded text-faint hover:text-ink ${children.length ? "" : "invisible"}`}
            aria-label={open ? `Collapse ${p.title}` : `Expand ${p.title}`}
            aria-expanded={open}
          >
            <svg viewBox="0 0 24 24" className={`size-3 transition-transform ${open ? "rotate-90" : ""}`} fill="currentColor" aria-hidden>
              <path d="M9 6l7 6-7 6z" />
            </svg>
          </button>
          <button onClick={() => onOpen(p.id)} className="flex min-w-0 flex-1 items-center gap-1.5 py-[5px] text-left">
            <PageIcon p={p} />
            <span className="truncate">{p.title}</span>
          </button>
        </div>
        {open && children.length > 0 && <ul>{children.map((c) => row(c, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <aside className={`w-full shrink-0 flex-col border-r border-line bg-panel md:flex md:w-[280px] ${hidden ? "hidden" : "flex"}`}>
      <div className="border-b border-line p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages" className={`${input} py-1.5 text-[13px]`} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!pages && !error && <p className="p-2 text-[13px] text-muted">Loading pages…</p>}
        {error && <p className="p-2 text-[13px] text-danger">{error}</p>}
        {pages?.length === 0 && (
          <p className="p-2 text-[13px] leading-relaxed text-muted">
            {status.canManage ? "No pages are shared with the connection yet. Share some in Notion, then press Sync now." : "Nothing has been shared with you yet. Ask a superadmin to give you access to a page."}
          </p>
        )}
        {hits ? (
          <ul>
            {hits.length === 0 && <li className="p-2 text-[13px] text-muted">Nothing matches.</li>}
            {hits.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => onOpen(p.id)}
                  className={`flex w-full items-center gap-1.5 rounded-md px-2 py-[5px] text-left text-[13.5px] ${p.id === selected ? "bg-sunken font-medium" : "hover:bg-sunken/70"}`}
                >
                  <PageIcon p={p} />
                  <span className="truncate">{p.title}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul>{(kids.get(null) ?? []).map((p) => row(p, 0))}</ul>
        )}
      </div>
      {status.canManage && (
        <div className="space-y-2 border-t border-line p-3 text-[12px] text-muted">
          <div>
            {status.pages ?? 0} shared · {status.syncing || busy ? "syncing…" : status.lastSync ? `synced ${ago(status.lastSync)}` : "not synced yet"}
            {status.kind === "token" ? " · integration token" : " · signed in with Notion"}
          </div>
          {status.syncError && <div className="text-danger">Last sync failed: {status.syncError}</div>}
          <div className="flex gap-1.5">
            <button onClick={sync} disabled={busy} className={btn}>
              Sync now
            </button>
            <Link href="/notion/access" className={`${btn} inline-flex items-center`}>
              Access
            </Link>
            <details className="group relative ml-auto">
              <summary className={`${btn} flex cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden`} aria-label="More">
                More
              </summary>
              <div className="absolute right-0 bottom-full z-20 mb-1.5 w-44 rounded-xl border border-line bg-panel p-1 shadow-[var(--shadow-pop)]">
                <button onClick={disconnect} className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-danger hover:bg-danger-soft">
                  Disconnect Notion
                </button>
              </div>
            </details>
          </div>
        </div>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------- page
function Rich({ spans }: { spans?: Span[] }) {
  if (!spans?.length) return null;
  return (
    <>
      {spans.map((s, i) => {
        let el: ReactNode = s.t;
        if (s.c) el = <code className="rounded bg-sunken px-1 py-px font-mono text-[0.88em]">{el}</code>;
        if (s.b) el = <strong className="font-semibold">{el}</strong>;
        if (s.i) el = <em>{el}</em>;
        if (s.s) el = <s>{el}</s>;
        if (s.href && /^(https?:|mailto:)/.test(s.href))
          el = (
            <a href={s.href} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
              {el}
            </a>
          );
        return <span key={i}>{el}</span>;
      })}
    </>
  );
}

function Blocks({ blocks, onOpen }: { blocks: Block[]; onOpen: (id: string) => void }) {
  // numbered lists count up until something else interrupts them
  const nums: number[] = [];
  for (let i = 0, c = 0; i < blocks.length; i++) nums.push((c = blocks[i].type === "numbered_list_item" ? c + 1 : 0));
  return (
    <>
      {blocks.map((b, idx) => {
        const n = nums[idx];
        const kids = b.children?.length ? <Blocks blocks={b.children} onOpen={onOpen} /> : null;
        const nested = kids ? <div className="ml-6">{kids}</div> : null;
        switch (b.type) {
          case "heading_1":
            return <h2 key={b.id} className="mt-6 text-[22px] font-semibold tracking-tight"><Rich spans={b.text} /></h2>;
          case "heading_2":
            return <h3 key={b.id} className="mt-5 text-[18px] font-semibold"><Rich spans={b.text} /></h3>;
          case "heading_3":
            return <h4 key={b.id} className="mt-4 text-[15.5px] font-semibold"><Rich spans={b.text} /></h4>;
          case "bulleted_list_item":
          case "numbered_list_item":
            return (
              <div key={b.id}>
                <div className="flex gap-2 py-0.5">
                  <span className="w-5 shrink-0 text-right text-muted">{b.type === "numbered_list_item" ? `${n}.` : "•"}</span>
                  <div className="min-w-0"><Rich spans={b.text} /></div>
                </div>
                {nested}
              </div>
            );
          case "to_do":
            return (
              <div key={b.id}>
                <label className="flex items-start gap-2 py-0.5">
                  <input type="checkbox" checked={b.checked} readOnly className="mt-1 accent-[var(--accent)]" />
                  <span className={b.checked ? "text-muted line-through" : ""}><Rich spans={b.text} /></span>
                </label>
                {nested}
              </div>
            );
          case "toggle":
            return (
              <details key={b.id} className="py-0.5">
                <summary className="cursor-pointer"><Rich spans={b.text} /></summary>
                {nested}
              </details>
            );
          case "quote":
            return <blockquote key={b.id} className="my-2 border-l-[3px] border-ink/70 pl-3"><Rich spans={b.text} />{nested}</blockquote>;
          case "callout":
            return (
              <div key={b.id} className="my-2 flex gap-2.5 rounded-xl bg-sunken p-3">
                {b.icon && <span>{b.icon}</span>}
                <div className="min-w-0"><Rich spans={b.text} />{nested}</div>
              </div>
            );
          case "code":
            return (
              <pre key={b.id} className="my-2 overflow-x-auto rounded-xl bg-sunken p-3 font-mono text-[12.5px] leading-relaxed">
                {(b.text ?? []).map((s) => s.t).join("")}
              </pre>
            );
          case "divider":
            return <hr key={b.id} className="my-4 border-line" />;
          case "child_page":
          case "child_database":
            return (
              <button key={b.id} onClick={() => b.pageId && onOpen(b.pageId)} className="my-0.5 flex items-center gap-1.5 rounded-md py-1 text-left font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
                <PageIcon p={{ icon: null, kind: b.type === "child_database" ? "database" : "page" }} />
                {b.title}
              </button>
            );
          case "image":
            return b.url && /^https:/.test(b.url) ? (
              <figure key={b.id} className="my-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- Notion-hosted image with a short-lived signed URL */}
                <img src={b.url} alt={(b.text ?? []).map((s) => s.t).join("") || ""} className="max-h-[420px] rounded-xl border border-line" />
                {b.text?.length ? <figcaption className="mt-1 text-[12.5px] text-muted"><Rich spans={b.text} /></figcaption> : null}
              </figure>
            ) : null;
          case "bookmark":
          case "embed":
          case "link_preview":
          case "video":
          case "file":
          case "pdf":
          case "audio":
            return b.url ? (
              <a key={b.id} href={b.url} target="_blank" rel="noreferrer" className="my-1 block truncate rounded-lg border border-line px-3 py-2 text-[13px] text-accent hover:bg-sunken">
                {b.text?.length ? (b.text ?? []).map((s) => s.t).join("") : b.url}
              </a>
            ) : null;
          case "table":
            return (
              <div key={b.id} className="my-3 overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <tbody>
                    {(b.children ?? []).map((r) => (
                      <tr key={r.id}>
                        {(r.cells ?? []).map((c, i) => (
                          <td key={i} className="border border-line px-2.5 py-1.5 align-top"><Rich spans={c} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "column_list":
            return (
              <div key={b.id} className="my-2 grid gap-4 sm:grid-flow-col sm:auto-cols-fr">
                {(b.children ?? []).map((c) => (
                  <div key={c.id} className="min-w-0"><Blocks blocks={c.children ?? []} onOpen={onOpen} /></div>
                ))}
              </div>
            );
          case "equation":
            return <div key={b.id} className="my-2 font-mono text-[13px]"><Rich spans={b.text} /></div>;
          case "paragraph":
            return (
              <div key={b.id}>
                <p className="min-h-[1.2em] whitespace-pre-wrap py-0.5"><Rich spans={b.text} /></p>
                {nested}
              </div>
            );
          default:
            return b.text?.length ? <p key={b.id} className="py-0.5"><Rich spans={b.text} /></p> : kids;
        }
      })}
    </>
  );
}

function PermChips({ perms }: { perms: PageDetail["perms"] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {PERMS.map((k: Perm) => (
        <span
          key={k}
          className={`rounded-md px-1.5 py-px text-[11px] font-medium ${perms[k] ? "bg-accent-soft text-accent" : "bg-sunken text-faint line-through"}`}
          title={perms[k] ? `You can ${PERM_LABEL[k].toLowerCase()}` : `You can't ${PERM_LABEL[k].toLowerCase()}`}
        >
          {PERM_LABEL[k]}
        </span>
      ))}
    </div>
  );
}

function PageView({ id, onOpen, onChanged }: { id: string; onOpen: (id: string | null) => void; onChanged: () => void }) {
  const q = usePoll(() => wa<PageDetail>(`notion/pages/${id}`), 120000);
  const page = q.data;
  const error = q.error;
  const load = q.refresh;
  const [mode, setMode] = useState<"none" | "append" | "child" | "rename">("none");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ title: "", markdown: "", props: {} as Record<string, string> });
  const [comment, setComment] = useState("");
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null);

  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setBusy(true);
    try {
      await fn();
      setMode("none");
      setDraft({ title: "", markdown: "", props: {} });
      after?.();
      await load();
      onChanged();
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error)
    return (
      <div className="p-6">
        <p className="text-[13.5px] text-danger">{error}</p>
      </div>
    );
  if (!page) return <p className="p-6 text-[13px] text-muted">Opening…</p>;

  const isDb = page.kind === "database";
  const p = page.perms;
  const writable = (page.database?.columns ?? []).filter((c) => ["rich_text", "number", "select", "status", "multi_select", "checkbox", "date", "url", "email", "phone_number"].includes(c.type));

  return (
    <article className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
      {undo && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2 text-[13px]">
          <span className="flex-1">Archived &ldquo;{undo.title}&rdquo;.</span>
          <button
            onClick={() => run(() => wa(`notion/pages/${undo.id}/restore`, { method: "POST" }), () => setUndo(null))}
            className="font-medium text-accent"
          >
            Undo
          </button>
        </div>
      )}
      {page.breadcrumbs.length > 0 && (
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-[12.5px] text-muted" aria-label="Breadcrumb">
          {page.breadcrumbs.map((b) => (
            <span key={b.id} className="flex items-center gap-1">
              <button onClick={() => onOpen(b.id)} className="hover:text-ink hover:underline">
                {b.icon ? `${b.icon} ` : ""}
                {b.title}
              </button>
              <span className="text-faint">/</span>
            </span>
          ))}
        </nav>
      )}
      <header className="flex flex-wrap items-start gap-3">
        <h1 className="font-display min-w-0 flex-1 text-[32px] leading-tight font-bold">
          {page.icon && <span className="mr-2">{page.icon}</span>}
          {page.title}
        </h1>
      </header>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {PERMS.some((k) => !p[k]) && <PermChips perms={p} />}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {page.url && (
            <a href={page.url} target="_blank" rel="noreferrer" className={`${btn} inline-flex items-center`}>
              Open in Notion
            </a>
          )}
          {p.edit && !isDb && (
            <>
              <button onClick={() => { setMode(mode === "rename" ? "none" : "rename"); setDraft({ ...draft, title: page.title }); }} className={btn}>Rename</button>
              <button onClick={() => setMode(mode === "append" ? "none" : "append")} className={btn}>Add content</button>
            </>
          )}
          {p.create && <button onClick={() => setMode(mode === "child" ? "none" : "child")} className={btn}>{isDb ? "New row" : "New sub-page"}</button>}
          {p.archive && !isDb && (
            <button
              onClick={() =>
                window.confirm(`Archive "${page.title}"? It moves to Notion's trash, where it can be restored for 30 days.`) &&
                run(() => wa(`notion/pages/${id}/archive`, { method: "POST" }), () => {
                  setUndo({ id, title: page.title });
                })
              }
              className={`${btn} text-danger`}
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {mode === "rename" && (
        <form onSubmit={(e) => { e.preventDefault(); run(() => wa(`notion/pages/${id}`, { method: "PATCH", body: { title: draft.title } })); }} className="mt-4 flex gap-2">
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={input} autoFocus />
          <button disabled={busy || !draft.title.trim()} className={`${primary} h-auto px-4`}>Save</button>
        </form>
      )}
      {mode === "append" && (
        <form onSubmit={(e) => { e.preventDefault(); run(() => wa(`notion/pages/${id}/append`, { method: "POST", body: { markdown: draft.markdown } })); }} className="mt-4 panel p-4">
          <label className="text-[12.5px] font-medium">Add to the end of the page</label>
          <textarea
            value={draft.markdown}
            onChange={(e) => setDraft({ ...draft, markdown: e.target.value })}
            rows={6}
            autoFocus
            placeholder={"## Heading\n- a bullet\n- [ ] a to-do\n**bold**, _italic_, `code`, [link](https://…)"}
            className={`${input} mt-1.5 font-mono text-[13px]`}
          />
          <div className="mt-2 flex items-center gap-2">
            <button disabled={busy || !draft.markdown.trim()} className={primary}>{busy ? "Adding…" : "Add"}</button>
            <span className="text-[12px] text-faint">Markdown works: headings, lists, to-dos, quotes, code.</span>
          </div>
        </form>
      )}
      {mode === "child" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const props = Object.fromEntries(Object.entries(draft.props).filter(([, v]) => v.trim()));
            run(() => wa(`notion/pages/${id}/children`, { method: "POST", body: { title: draft.title, markdown: draft.markdown, properties: props } }));
          }}
          className="mt-4 space-y-3 panel p-4"
        >
          <label className="block text-[12.5px] font-medium">
            {isDb ? "Name" : "Title"}
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={`${input} mt-1`} autoFocus required />
          </label>
          {isDb &&
            writable.map((c) => (
              <label key={c.name} className="block text-[12.5px] font-medium">
                {c.name} <span className="font-normal text-faint">({c.type.replace(/_/g, " ")})</span>
                {c.options.length > 0 && (c.type === "select" || c.type === "status") ? (
                  <select value={draft.props[c.name] ?? ""} onChange={(e) => setDraft({ ...draft, props: { ...draft.props, [c.name]: e.target.value } })} className={`${input} mt-1`}>
                    <option value="">—</option>
                    {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : c.type === "checkbox" ? (
                  <input type="checkbox" checked={draft.props[c.name] === "yes"} onChange={(e) => setDraft({ ...draft, props: { ...draft.props, [c.name]: e.target.checked ? "yes" : "" } })} className="ml-2 accent-[var(--accent)]" />
                ) : (
                  <input
                    type={c.type === "number" ? "number" : c.type === "date" ? "date" : "text"}
                    value={draft.props[c.name] ?? ""}
                    onChange={(e) => setDraft({ ...draft, props: { ...draft.props, [c.name]: e.target.value } })}
                    placeholder={c.type === "multi_select" ? "comma, separated" : ""}
                    className={`${input} mt-1`}
                  />
                )}
              </label>
            ))}
          {!isDb && (
            <label className="block text-[12.5px] font-medium">
              Content <span className="font-normal text-faint">(optional, markdown)</span>
              <textarea value={draft.markdown} onChange={(e) => setDraft({ ...draft, markdown: e.target.value })} rows={4} className={`${input} mt-1 font-mono text-[13px]`} />
            </label>
          )}
          <button disabled={busy || !draft.title.trim()} className={primary}>{busy ? "Creating…" : isDb ? "Add row" : "Create page"}</button>
        </form>
      )}

      {page.properties && Object.keys(page.properties).length > 0 && (
        <dl className="mt-5 grid grid-cols-[minmax(0,9rem)_1fr] gap-x-4 gap-y-1.5 rounded-xl border border-line bg-panel p-4 text-[13px]">
          {Object.entries(page.properties).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="truncate text-muted">{k}</dt>
              <dd className="min-w-0 break-words">{v || <span className="text-faint">Empty</span>}</dd>
            </div>
          ))}
        </dl>
      )}

      {isDb ? (
        <div className="mt-5 overflow-x-auto rounded-xl border border-line bg-panel">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                {(page.database?.columns ?? []).slice(0, 6).map((c) => (
                  <th key={c.name} className="whitespace-nowrap px-3 py-2 font-medium">{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(page.database?.rows ?? []).length === 0 && (
                <tr><td className="px-3 py-4 text-muted" colSpan={6}>No rows you can see.</td></tr>
              )}
              {(page.database?.rows ?? []).map((r) => (
                <tr key={r.id} onClick={() => onOpen(r.id)} className="cursor-pointer border-b border-line last:border-0 hover:bg-sunken">
                  {(page.database?.columns ?? []).slice(0, 6).map((c) => (
                    <td key={c.name} className={`max-w-[16rem] truncate px-3 py-2 ${c.type === "title" ? "font-medium" : ""}`}>
                      {c.type === "title" ? r.title : r.cells[c.name]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6 text-[15px] leading-relaxed">
          {page.blocks?.length ? <Blocks blocks={page.blocks} onOpen={onOpen} /> : <p className="text-muted">This page is empty.</p>}
        </div>
      )}

      {!isDb && (page.children?.length ?? 0) > 0 && !page.blocks?.some((b) => b.type === "child_page") && (
        <section className="mt-8">
          <h2 className="text-[15px] font-semibold tracking-tight">Sub-pages</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {page.children!.map((c) => (
              <li key={c.id}>
                <button onClick={() => onOpen(c.id)} className="flex w-full items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2.5 text-left text-[13.5px] hover:bg-sunken">
                  <PageIcon p={c} />
                  <span className="truncate">{c.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isDb && (
        <section className="mt-10 border-t border-line pt-5">
          <h2 className="text-[15px] font-semibold tracking-tight">Comments</h2>
          <ul className="mt-2 space-y-2">
            {(page.comments ?? []).length === 0 && <li className="text-[13px] text-muted">No comments yet.</li>}
            {(page.comments ?? []).map((c) => (
              <li key={c.id} className="rounded-xl bg-sunken px-3 py-2 text-[13.5px]">
                <p className="whitespace-pre-wrap">{c.text}</p>
                <p className="mt-1 text-[11.5px] text-faint">{new Date(c.created).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
              </li>
            ))}
          </ul>
          {p.comment && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(() => wa(`notion/pages/${id}/comments`, { method: "POST", body: { text: comment } }), () => setComment(""));
              }}
              className="mt-3 flex gap-2"
            >
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment" className={input} />
              <button disabled={busy || !comment.trim()} className={`${primary} h-auto px-4`}>Post</button>
            </form>
          )}
        </section>
      )}
    </article>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type Chat, type Msg, displayName, enc, initials, mediaLabel, wa } from "@/lib/wa";

const MAX = 5; // WhatsApp's own limit per forward

type Contact = { jid: string; name: string | null; number: string | null; isGroup: boolean };

type Result = { to: string; name: string; ok: boolean; sent: number; total: number; error?: string };

const previewOf = (m: Msg) => (m.media ? `${mediaLabel[m.media] ?? "Attachment"}${m.text ? `: ${m.text}` : ""}` : m.text) || "Message";

/** Forward one or more messages (in chat order) to up to 5 chats. */
export default function ForwardDialog({ msgs, fromJid, onClose }: { msgs: Msg[]; fromJid: string; onClose: (forwarded: boolean) => void }) {
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Result[] | null>(null);
  // everyone else (contacts and groups without recent messages), found by searching
  const [others, setOthers] = useState<Contact[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    wa<Chat[]>("chats?limit=400")
      .then(setChats)
      .catch((e) => setError((e as Error).message));
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let alive = true;
    const timer = setTimeout(() => {
      wa<Contact[]>(`contacts?q=${enc(q)}`)
        .then((r) => alive && setOthers(r))
        .catch(() => {});
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return (chats ?? []).filter(
      (c) => !q || (c.name ?? "").toLowerCase().includes(q) || (digits.length > 2 && (c.number ?? "").includes(digits)),
    );
  }, [chats, query]);
  const extra = useMemo(() => {
    if (query.trim().length < 2) return [];
    const known = new Set((chats ?? []).map((c) => c.jid));
    return others.filter((c) => !known.has(c.jid));
  }, [others, chats, query]);
  const [pickedInfo, setPickedInfo] = useState<Map<string, Contact>>(new Map());
  const byJid = useMemo(() => {
    const m = new Map<string, Contact>(pickedInfo);
    for (const c of chats ?? []) m.set(c.jid, c);
    return m;
  }, [chats, pickedInfo]);

  const toggle = (jid: string, info?: Contact) => {
    if (info) setPickedInfo((m) => new Map(m).set(jid, info));
    setPicked((p) => (p.includes(jid) ? p.filter((x) => x !== jid) : p.length >= MAX ? p : [...p, jid]));
  };
  const row = (c: Contact, onPick: () => void) => {
    const on = picked.includes(c.jid);
    const full = !on && picked.length >= MAX;
    return (
      <li key={c.jid}>
        <button
          onClick={onPick}
          disabled={full}
          className={`flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-sunken disabled:opacity-40 ${on ? "bg-accent-soft/60" : ""}`}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken text-[12px] font-semibold text-muted">
            {initials(displayName(c))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px]">{displayName(c)}</span>
            <span className="block truncate text-[12px] text-faint">{c.isGroup ? "Group" : c.number ? `+${c.number}` : ""}</span>
          </span>
          <span
            className={`grid size-5 shrink-0 place-items-center rounded-full border text-[11px] ${on ? "border-accent bg-accent text-accent-ink" : "border-line"}`}
            aria-hidden
          >
            {on ? "✓" : ""}
          </span>
        </button>
      </li>
    );
  };

  const forward = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await wa<{ results: Result[] }>(`chats/${enc(fromJid)}/forward`, { method: "POST", body: { messageIds: msgs.map((m) => m.id), to: picked } });
      setResults(r.results);
      if (r.results.every((x) => x.ok)) setTimeout(() => onClose(true), 1200);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const many = msgs.length > 1;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose(false)}
      role="dialog"
      aria-modal="true"
      aria-label={many ? `Forward ${msgs.length} messages` : "Forward message"}
    >
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
        <div className="border-b border-line p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-semibold">{many ? `Forward ${msgs.length} messages` : "Forward message"}</h2>
            <button onClick={() => onClose(false)} className="text-[18px] text-muted hover:text-ink" aria-label="Close">
              ×
            </button>
          </div>
          <div className="mt-2 max-h-24 space-y-0.5 overflow-y-auto rounded-lg bg-sunken px-3 py-2 text-[13px] text-muted">
            {msgs.map((m) => (
              <p key={m.id} className="truncate">
                {many && <span className="mr-1 text-faint">•</span>}
                {previewOf(m)}
              </p>
            ))}
          </div>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any contact, group or number"
            className="mt-3 w-full rounded-lg border border-line bg-sunken px-3 py-2 text-[14px] outline-none placeholder:text-faint focus:border-accent"
          />
          {picked.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {picked.map((j) => (
                <button
                  key={j}
                  onClick={() => toggle(j)}
                  className="flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[12.5px] text-accent"
                  aria-label={`Remove ${byJid.get(j) ? displayName(byJid.get(j)!) : j}`}
                >
                  {byJid.get(j) ? displayName(byJid.get(j)!) : j} <span aria-hidden>×</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto py-1">
          {!chats && !error && <li className="px-4 py-3 text-[13px] text-muted">Loading chats…</li>}
          {chats && visible.length === 0 && extra.length === 0 && <li className="px-4 py-3 text-[13px] text-muted">No chats match.</li>}
          {visible.map((c) => row(c, () => toggle(c.jid)))}
          {extra.length > 0 && <li className="px-4 pb-1 pt-3 text-[11.5px] font-medium uppercase tracking-wide text-faint">Other contacts and groups</li>}
          {extra.map((c) => row(c, () => toggle(c.jid, c)))}
        </ul>

        <div className="border-t border-line p-4">
          {results && (
            <ul className="mb-2 space-y-0.5 text-[12.5px]">
              {results.map((r) => (
                <li key={r.to} className={r.ok ? "text-accent" : "text-danger"}>
                  {r.ok ? `Forwarded ${r.total === 1 ? "" : `${r.total} messages `}to ${r.name}` : `${r.name}: ${r.sent} of ${r.total} forwarded, then: ${r.error}`}
                </li>
              ))}
            </ul>
          )}
          {error && <p className="mb-2 text-[12.5px] text-danger">{error}</p>}
          <div className="flex items-center gap-3">
            <span className="text-[12.5px] text-muted">
              {picked.length}/{MAX} selected
            </span>
            <button
              onClick={forward}
              disabled={busy || picked.length === 0 || Boolean(results?.every((r) => r.ok))}
              className="ml-auto h-9 rounded-lg bg-accent px-4 text-[13px] font-medium text-accent-ink disabled:opacity-50"
            >
              {busy ? "Forwarding…" : picked.length > 1 ? `Forward to ${picked.length} chats` : "Forward"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

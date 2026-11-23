"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type AutoReplyLog, type AutoSettings, type Chat, ago, chatHref, displayName, enc, usePoll, wa } from "@/lib/wa";

const MODES: { key: AutoSettings["mode"]; label: string }[] = [
  { key: "off", label: "Off" },
  { key: "allowlist", label: "Selected chats" },
  { key: "all", label: "Everyone" },
];

function statusLine(s: AutoSettings) {
  const on = s.onList?.length ?? 0;
  const off = s.offList?.length ?? 0;
  if (!s.ai) return "No AI key is set, so auto-reply can't run.";
  if (s.mode === "off") return "Off. Nothing is sent automatically.";
  if (s.mode === "allowlist") return on ? `On for ${on} selected chat${on === 1 ? "" : "s"}.` : "On, but no chats are selected yet. Add some below.";
  return `On for every 1:1 chat${off ? `, except ${off}` : ""}. Never in groups.`;
}

function ContactPicker({ placeholder, onPick, exclude }: { placeholder: string; onPick: (jid: string) => void; exclude: string[] }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Chat[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(async () => {
      try {
        const chats = await wa<Chat[]>(`chats?limit=8&q=${enc(q.trim())}`);
        setResults(chats.filter((c) => !c.isGroup && !exclude.includes(c.jid)));
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, exclude]);

  const show = q.trim().length >= 2 && results.length > 0;
  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-sunken px-3 py-1.5 text-[13px] outline-none placeholder:text-faint focus:border-accent"
      />
      {show && (
        <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-line bg-panel shadow-lg">
          {results.map((c) => (
            <li key={c.jid}>
              <button
                onClick={() => {
                  onPick(c.jid);
                  setQ("");
                  setResults([]);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-sunken"
              >
                <span className="truncate">{displayName(c)}</span>
                {c.number && c.name && <span className="ml-auto shrink-0 text-[11.5px] text-faint">+{c.number}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChatChips({ items, onRemove, empty }: { items: { jid: string; name: string }[]; onRemove: (jid: string) => void; empty: string }) {
  if (!items.length) return <p className="py-1 text-[12.5px] text-faint">{empty}</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <li key={i.jid} className="flex items-center gap-1 rounded-full border border-line bg-sunken py-0.5 pr-1 pl-2.5 text-[12.5px]">
          <Link href={chatHref(i.jid)} className="max-w-40 truncate hover:text-accent">
            {i.name}
          </Link>
          <button onClick={() => onRemove(i.jid)} className="grid size-5 place-items-center rounded-full text-muted hover:bg-line hover:text-ink" aria-label={`Remove ${i.name}`}>
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function AutoReplyCard() {
  const settings = usePoll(() => wa<AutoSettings>("autoreply"), 20000);
  const log = usePoll(() => wa<AutoReplyLog>("autoreplies?limit=12"), 10000);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = settings.data;
  const draft = instructions ?? s?.instructions ?? "";
  const dirty = s && draft !== (s.instructions ?? "");

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = (patch: Partial<AutoSettings>) => act(async () => settings.setData(await wa<AutoSettings>("autoreply", { method: "PUT", body: patch })));

  const setMode = (mode: AutoSettings["mode"]) => {
    if (mode === "all" && !window.confirm("Auto-reply to EVERY one-to-one chat as you?\n\nThe AI will answer anyone who messages you (groups excluded), following your instructions and the safety rules.")) return;
    save({ mode });
  };

  const setChat = (jid: string, mode: "on" | "off" | "default") =>
    act(async () => {
      await wa(`chats/${enc(jid)}/autoreply`, { method: "PUT", body: { mode } });
      await settings.refresh();
    });

  const saveInstructions = () =>
    act(async () => {
      settings.setData(await wa<AutoSettings>("autoreply", { method: "PUT", body: { instructions: draft } }));
      setInstructions(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });

  const listed = [...(s?.onList ?? []), ...(s?.offList ?? [])].map((i) => i.jid);

  return (
    <section id="autoreply" data-write="lock" className="rounded-2xl border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4 sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${s && s.mode !== "off" && s.ai ? "bg-accent" : "bg-faint"}`} />
            <h2 className="text-[15px] font-semibold tracking-tight">Auto-reply</h2>
          </div>
          <p className="mt-0.5 text-[13px] text-muted">{s ? statusLine(s) : "Loading…"}</p>
        </div>
        <div className="ml-auto flex rounded-lg border border-line bg-sunken p-0.5">
          {MODES.map((m) => (
            <button
              key={m.key}
              disabled={!s || busy}
              onClick={() => setMode(m.key)}
              className={`rounded-md px-3 py-1.5 text-[13px] font-medium disabled:opacity-60 ${
                s?.mode === m.key ? (m.key === "off" ? "bg-ink text-panel" : "bg-accent text-accent-ink") : "text-muted hover:text-ink"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="border-b border-line bg-warn-soft px-5 py-2 text-[12.5px] text-warn">{error}</div>}

      <div className="grid divide-y divide-line lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        <div className="p-4 sm:p-5">
          <h3 className="text-[13px] font-semibold">Instructions for the AI</h3>
          <p className="mt-0.5 text-[12px] text-faint">Used for auto-replies and AI drafts.</p>
          <textarea
            value={draft}
            onChange={(e) => setInstructions(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder={"e.g. I'm travelling till Monday, I'll reply properly then.\nFor work queries, ask them to email me.\nKeep it friendly, Hinglish is fine."}
            className="mt-2.5 w-full resize-y rounded-lg border border-line bg-sunken px-3 py-2 text-[13px] leading-relaxed outline-none placeholder:text-faint focus:border-accent"
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={saveInstructions}
              disabled={!dirty || busy}
              className="rounded-lg bg-ink px-3 py-1.5 text-[12.5px] font-medium text-panel disabled:opacity-30"
            >
              Save
            </button>
            {saved && <span className="text-[12px] text-accent">Saved</span>}
            {s && (
              <label className="ml-auto flex items-center gap-1.5 text-[12px] text-muted">
                Quiet for
                <input
                  key={s.pauseMinutes}
                  type="number"
                  min={0}
                  max={1440}
                  defaultValue={s.pauseMinutes}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v !== s.pauseMinutes) save({ pauseMinutes: v });
                  }}
                  className="w-12 rounded border border-line bg-sunken px-1.5 py-0.5 text-[12px] text-ink outline-none focus:border-accent"
                />
                min after you reply
              </label>
            )}
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
            Always on: it never quotes prices, dates or commitments, says it&apos;ll check and get back, and admits it&apos;s an assistant if asked.
          </p>
        </div>

        <div className="space-y-5 p-4 sm:p-5">
          <div className={s?.mode === "all" ? "opacity-50" : ""}>
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="text-[13px] font-semibold">Reply to these</h3>
              <span className="text-[11.5px] text-faint">used in Selected chats mode</span>
            </div>
            <ChatChips items={s?.onList ?? []} onRemove={(jid) => setChat(jid, "default")} empty="No chats selected." />
            <div className="mt-2">
              <ContactPicker placeholder="Add a contact…" exclude={listed} onPick={(jid) => setChat(jid, "on")} />
            </div>
          </div>
          <div className={s?.mode === "allowlist" ? "opacity-50" : ""}>
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="text-[13px] font-semibold">Never reply to</h3>
              <span className="text-[11.5px] text-faint">used in Everyone mode</span>
            </div>
            <ChatChips items={s?.offList ?? []} onRemove={(jid) => setChat(jid, "default")} empty="Nobody excluded." />
            <div className="mt-2">
              <ContactPicker placeholder="Exclude a contact (e.g. clients)…" exclude={listed} onPick={(jid) => setChat(jid, "off")} />
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col p-4 sm:p-5">
          <div className="mb-2 flex items-baseline gap-2">
            <h3 className="text-[13px] font-semibold">What it sent</h3>
            {log.data && (
              <span className="text-[11.5px] text-faint">
                {log.data.today} today · {log.data.total} total
              </span>
            )}
          </div>
          {!log.data && <div className="h-24 animate-pulse rounded-xl bg-sunken" />}
          {log.data?.items.length === 0 && <p className="py-1 text-[12.5px] text-faint">Nothing sent yet.</p>}
          <ul className="-mx-1 max-h-80 space-y-1 overflow-y-auto">
            {log.data?.items.map((i) => (
              <li key={i.id}>
                <Link href={chatHref(i.jid)} className="block rounded-lg px-2 py-2 hover:bg-sunken">
                  <div className="flex items-baseline gap-2 text-[12.5px]">
                    <span className="truncate font-medium">{i.name}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-faint">{ago(i.ts)}</span>
                  </div>
                  {i.incoming.length > 0 && <p className="mt-0.5 truncate text-[12px] text-faint">They: {i.incoming.join(" · ")}</p>}
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted">
                    <span className="font-medium text-accent">Auto:</span> {i.reply ?? "…"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

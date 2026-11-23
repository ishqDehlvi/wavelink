"use client";

import { type Chat, displayName, initials, mediaLabel, timeLabel } from "@/lib/wa";
import type { Filter } from "./Dashboard";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Needs reply" },
  { key: "people", label: "People" },
  { key: "groups", label: "Groups" },
];

export default function ChatList(props: {
  chats: Chat[];
  loading: boolean;
  selected: string | null;
  onSelect: (jid: string) => void;
  filter: Filter;
  setFilter: (f: Filter) => void;
  query: string;
  setQuery: (q: string) => void;
}) {
  const { chats, loading, selected, onSelect, filter, setFilter, query, setQuery } = props;

  return (
    <>
      <div className="space-y-2.5 border-b border-line p-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or number"
          className="w-full rounded-lg border border-line bg-sunken px-3 py-2 text-[14px] outline-none placeholder:text-faint focus:border-accent"
        />
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-2.5 py-1 text-[12.5px] ${
                filter === f.key ? "bg-ink text-panel" : "text-muted hover:bg-sunken hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {loading &&
          Array.from({ length: 8 }).map((_, i) => (
            <li key={i} className="flex gap-3 px-3 py-3">
              <div className="size-10 rounded-full bg-sunken" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 w-1/2 rounded bg-sunken" />
                <div className="h-3 w-3/4 rounded bg-sunken" />
              </div>
            </li>
          ))}
        {!loading && chats.length === 0 && <li className="p-6 text-center text-[13px] text-muted">No chats match.</li>}
        {chats.map((c) => {
          const name = displayName(c);
          const waiting = c.pending > 0 && !c.last.fromMe;
          const preview = c.last.media && !c.last.text ? mediaLabel[c.last.media] ?? c.last.media : c.last.text;
          return (
            <li key={c.jid}>
              <button
                onClick={() => onSelect(c.jid)}
                className={`flex w-full gap-3 px-3 py-2.5 text-left ${selected === c.jid ? "bg-accent-soft" : "hover:bg-sunken"}`}
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-medium ${
                    c.isGroup ? "rounded-xl bg-line text-muted" : "bg-sunken text-muted ring-1 ring-line"
                  }`}
                >
                  {initials(name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={`truncate text-[14px] ${waiting ? "font-semibold" : "font-medium"}`}>{name}</span>
                    <span className={`ml-auto shrink-0 text-[11.5px] ${waiting ? "text-accent" : "text-faint"}`}>
                      {timeLabel(c.lastTs)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="truncate text-[13px] text-muted">
                      {c.last.fromMe && <span className="text-faint">{c.last.auto ? "Auto: " : "You: "}</span>}
                      {preview || " "}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-1.5">
                      {c.autoReplyActive && (
                        <span title="Auto-reply on" className="rounded border border-accent/40 px-1 text-[10px] font-medium uppercase tracking-wide text-accent">
                          auto
                        </span>
                      )}
                      {waiting && (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-ink">
                          {c.pending}
                        </span>
                      )}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

"use client";

import { useState } from "react";
import { type AutoSettings, type DigestItem, ago, usePoll, wa } from "@/lib/wa";
import { CloseIcon } from "./icons";

const RANGES = [
  { h: 6, label: "6h" },
  { h: 24, label: "24h" },
  { h: 72, label: "3d" },
  { h: 168, label: "7d" },
];

const MODES: { key: AutoSettings["mode"]; label: string; hint: string }[] = [
  { key: "off", label: "Off", hint: "Nothing is sent automatically." },
  { key: "allowlist", label: "Selected", hint: "Only chats you switched on. Manage the list on the Overview page." },
  { key: "all", label: "Everyone", hint: "Every 1:1 chat except ones you switched off. Never groups." },
];

function AutoReplySettings() {
  const settings = usePoll(() => wa<AutoSettings>("autoreply"), 15000);
  const [saving, setSaving] = useState(false);
  const s = settings.data;

  const save = async (patch: Partial<AutoSettings>) => {
    setSaving(true);
    try {
      settings.setData(await wa<AutoSettings>("autoreply", { method: "PUT", body: patch }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-write="hide" className="border-b border-line p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold">Auto-reply</h2>
        {s && !s.ai && <span className="text-[11.5px] text-danger">No AI key set</span>}
      </div>
      <div className="mt-2 grid grid-cols-3 rounded-lg border border-line p-0.5">
        {MODES.map((m) => (
          <button
            key={m.key}
            disabled={!s || saving}
            onClick={() => save({ mode: m.key })}
            className={`rounded-md py-1.5 text-[12.5px] ${
              s?.mode === m.key ? (m.key === "all" ? "bg-accent text-accent-ink" : "bg-ink text-panel") : "text-muted hover:text-ink"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-muted">{MODES.find((m) => m.key === s?.mode)?.hint ?? "…"}</p>
      {s && (
        <label className="mt-2 flex items-center gap-2 text-[12px] text-muted">
          Stay quiet for
          <input
            type="number"
            min={0}
            max={1440}
            defaultValue={s.pauseMinutes}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v !== s.pauseMinutes) save({ pauseMinutes: v });
            }}
            className="w-14 rounded border border-line bg-sunken px-1.5 py-0.5 text-[12px] text-ink outline-none focus:border-accent"
          />
          min after you reply yourself
        </label>
      )}
    </div>
  );
}

const PRIORITY_STYLE: Record<string, string> = {
  high: "bg-warn-soft text-warn",
  normal: "bg-sunken text-muted",
  low: "text-faint",
};

export default function DigestPanel({ onOpen, onClose }: { onOpen: (jid: string) => void; onClose: () => void }) {
  const [hours, setHours] = useState(24);
  return (
    <>
      <AutoReplySettings />
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <h2 className="text-[13px] font-semibold">Summaries</h2>
        <div className="ml-auto flex rounded-md border border-line p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.h}
              onClick={() => setHours(r.h)}
              className={`rounded px-2 py-0.5 text-[12px] ${hours === r.h ? "bg-ink text-panel" : "text-muted hover:text-ink"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="rounded-md px-1.5 text-muted hover:text-ink xl:hidden" aria-label="Close">
          <CloseIcon className="size-4" />
        </button>
      </div>
      {/* key resets the poller when the range changes */}
      <DigestList key={hours} hours={hours} onOpen={onOpen} />
    </>
  );
}

function DigestList({ hours, onOpen }: { hours: number; onOpen: (jid: string) => void }) {
  const digest = usePoll(() => wa<DigestItem[]>(`digest?hours=${hours}`), 60000);
  const items = digest.data;
  const waiting = items?.filter((i) => i.needsReply && !i.isGroup).length ?? 0;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
      {!items && !digest.error && (
        <div className="space-y-3 pt-1">
          <p className="text-[12.5px] text-muted">Reading your chats and writing summaries… the first run takes ~20s.</p>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-sunken" />
          ))}
        </div>
      )}
      {digest.error && <p className="text-[12.5px] text-danger">{digest.error}</p>}
      {items && (
        <p className="mb-3 text-[12.5px] text-muted">
          {items.length === 0
            ? "No incoming messages in this period."
            : `${items.length} chat${items.length === 1 ? "" : "s"} with new messages${waiting ? ` · ${waiting} waiting on you` : ""}`}
        </p>
      )}
      <ul className="space-y-2">
        {items?.map((i) => (
          <li key={i.jid}>
            <button
              onClick={() => onOpen(i.jid)}
              className="w-full rounded-xl border border-line bg-panel p-3 text-left hover:border-accent"
            >
              <div className="flex items-center gap-2">
                {i.needsReply && <span className="size-1.5 shrink-0 rounded-full bg-accent" title="Needs your reply" />}
                <span className="truncate text-[13.5px] font-medium">{i.name}</span>
                {i.isGroup && <span className="text-[11px] text-faint">group</span>}
                <span className="ml-auto shrink-0 text-[11.5px] text-faint">{ago(i.lastTs)}</span>
              </div>
              <p className="mt-1 text-[13px] leading-snug text-muted">{i.summary ?? `${i.incoming} new message${i.incoming === 1 ? "" : "s"}`}</p>
              <div className="mt-2 flex items-center gap-2 text-[11px]">
                {i.priority && i.priority !== "low" && (
                  <span className={`rounded px-1.5 py-0.5 font-medium capitalize ${PRIORITY_STYLE[i.priority]}`}>{i.priority}</span>
                )}
                {i.needsReply && <span className="font-medium text-accent">Needs reply</span>}
                {i.summary && <span className="ml-auto text-faint">{i.incoming} msg</span>}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

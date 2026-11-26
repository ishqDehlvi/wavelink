"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  type AutoMode,
  type Msg,
  type Priority,
  type Thread,
  dayLabel,
  enc,
  mediaLabel,
  mediaUrl,
  usePoll,
  wa,
} from "@/lib/wa";
import ForwardDialog from "./ForwardDialog";

const URL_RE = /(https?:\/\/[^\s]+)/g;
function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_RE).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noreferrer" className="break-all text-accent underline underline-offset-2">
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function Media({ m }: { m: Msg }) {
  const src = mediaUrl(m);
  if (m.media === "image" || m.media === "sticker")
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" loading="lazy" className={`${m.media === "sticker" ? "w-28" : "max-h-72 w-full object-cover"} mb-1 rounded-lg`} />;
  if (m.media === "voice_note" || m.media === "audio") return <audio controls preload="none" src={src} className="mb-1 h-9 w-64 max-w-full" />;
  if (m.media === "video") return <video controls preload="none" src={src} className="mb-1 max-h-72 w-full rounded-lg" />;
  if (m.media === "document")
    return (
      <a href={src} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-2 rounded-lg border border-line bg-sunken px-3 py-2 text-[13px] hover:border-accent">
        <span className="rounded bg-line px-1.5 py-0.5 font-mono text-[10px] uppercase">file</span>
        <span className="truncate">{m.text?.split(" — ")[0] || "Document"}</span>
      </a>
    );
  return <span className="mb-1 block text-[12px] italic text-muted">[{mediaLabel[m.media ?? ""] ?? m.media}]</span>;
}

const READABLE = new Set(["voice_note", "audio", "image", "video", "document", "sticker"]);
const isAudio = (media: string | null) => media === "voice_note" || media === "audio";

/** AI transcript of a voice note, or what's in a photo/file. Read on demand if not done yet. */
function AttachmentText({ m }: { m: Msg }) {
  const [text, setText] = useState<string | null>(m.attachment);
  const [open, setOpen] = useState(isAudio(m.media));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = text ?? m.attachment;
  if (!m.media || !READABLE.has(m.media)) return null;

  const read = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await wa<{ text: string }>(`media/${enc(m.chat)}/${enc(m.id)}/read`, { method: "POST" });
      setText(r.text);
      setOpen(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!shown)
    return (
      <div className="mb-1">
        <button onClick={read} disabled={busy} className="text-[12px] font-medium text-accent hover:underline disabled:opacity-50">
          {busy ? (isAudio(m.media) ? "Transcribing…" : "Reading…") : isAudio(m.media) ? "Transcribe" : "Read with AI"}
        </button>
        {error && <p className="mt-0.5 text-[11.5px] text-danger">{error}</p>}
      </div>
    );

  return (
    <div className="mb-1 rounded-lg bg-sunken/70 px-2.5 py-1.5 text-[12.5px] leading-snug text-muted">
      <button onClick={() => setOpen(!open)} className="text-[11px] font-medium uppercase tracking-wide text-faint hover:text-muted">
        {isAudio(m.media) ? "Transcript" : "AI read"} {open ? "▾" : "▸"}
      </button>
      {open && <div className="mt-0.5 max-h-64 overflow-y-auto whitespace-pre-wrap break-words">{shown}</div>}
    </div>
  );
}

const AUTO_OPTIONS: { key: AutoMode; label: string }[] = [
  { key: "default", label: "Default" },
  { key: "on", label: "On" },
  { key: "off", label: "Off" },
];

export default function ChatView({ jid, onBack, onChanged }: { jid: string; onBack: () => void; onChanged: () => void }) {
  const thread = usePoll(() => wa<Thread>(`chats/${enc(jid)}/messages?limit=120`), 3000);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  // forwarding: pick messages (like WhatsApp's select mode), then choose chats
  const [selecting, setSelecting] = useState<string[] | null>(null);
  const [forwarding, setForwarding] = useState<Msg[] | null>(null);
  const SELECT_MAX = 30;
  const toggleSelect = (id: string) =>
    setSelecting((s) => (s === null ? s : s.includes(id) ? s.filter((x) => x !== id) : s.length >= SELECT_MAX ? s : [...s, id]));
  useEffect(() => {
    if (selecting === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !forwarding && setSelecting(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting, forwarding]);
  const [busy, setBusy] = useState<null | "send" | "draft" | "file" | "summary" | "english">(null);
  const [beforeEnglish, setBeforeEnglish] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ text: string; needsReply: boolean; priority: Priority } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const t = thread.data;
  const lastId = t?.messages.at(-1)?.id;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const send = () =>
    run("send", async () => {
      if (!text.trim()) return;
      await wa(`chats/${enc(jid)}/send`, { method: "POST", body: { text, replyTo: replyTo?.id } });
      setText("");
      setBeforeEnglish(null);
      setReplyTo(null);
      stickToBottom.current = true;
      await thread.refresh();
      onChanged();
    });

  const draft = () =>
    run("draft", async () => {
      const r = await wa<{ text: string }>(`chats/${enc(jid)}/draft`, { method: "POST" });
      setText(r.text);
      inputRef.current?.focus();
    });

  // Convert what I typed into English, in place, so I can check it before sending
  const toEnglish = () =>
    run("english", async () => {
      if (!text.trim()) return;
      const original = text;
      const r = await wa<{ english: string }>("translate", { method: "POST", body: { text } });
      setText(r.english);
      setBeforeEnglish(original);
      inputRef.current?.focus();
    });

  const summarize = () =>
    run("summary", async () => {
      setSummary(await wa(`chats/${enc(jid)}/summary`, { method: "POST" }));
    });

  const sendFile = (file: File) =>
    run("file", async () => {
      if (file.size > 25 * 1024 * 1024) throw new Error("File is larger than 25 MB");
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      await wa(`chats/${enc(jid)}/file`, {
        method: "POST",
        body: { base64, filename: file.name, mimetype: file.type || undefined, caption: text || undefined, replyTo: replyTo?.id },
      });
      setText("");
      setReplyTo(null);
      stickToBottom.current = true;
      await thread.refresh();
      onChanged();
    });

  const setAuto = (mode: AutoMode) =>
    run("send", async () => {
      const r = await wa<{ autoReply: AutoMode; autoReplyActive: boolean }>(`chats/${enc(jid)}/autoreply`, { method: "PUT", body: { mode } });
      thread.setData((prev) => (prev ? { ...prev, ...r } : prev));
      onChanged();
    });

  let lastDay = "";

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-panel px-4 py-2.5">
        <button onClick={onBack} className="-ml-1 rounded-md px-1.5 py-1 text-[13px] text-muted hover:bg-sunken md:hidden" aria-label="Back">
          ←
        </button>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold">{t?.name ?? "…"}</div>
          <div className="text-[12px] text-muted">
            {t?.isGroup ? "Group" : jid.endsWith("@lid") ? "Contact" : `+${jid.split("@")[0]}`}
            {t && !t.isGroup && (t.autoReplyActive ? " · auto-reply on" : " · auto-reply off")}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={summarize}
            disabled={busy !== null}
            className="rounded-md border border-line px-2.5 py-1 text-[12.5px] hover:bg-sunken disabled:opacity-50"
          >
            {busy === "summary" ? "Summarising…" : "Summarise"}
          </button>
          {t && !t.isGroup && (
            <div data-write="lock" className="flex rounded-md border border-line p-0.5" title="Auto-reply for this chat. Default follows the global setting.">
              <span className="px-1.5 py-0.5 text-[11px] text-faint">Auto</span>
              {AUTO_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => setAuto(o.key)}
                  disabled={busy !== null}
                  className={`rounded px-2 py-0.5 text-[12px] ${t.autoReply === o.key ? "bg-ink text-panel" : "text-muted hover:text-ink"}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {summary && (
        <div className="flex shrink-0 items-start gap-3 border-b border-line bg-accent-soft px-4 py-2.5 text-[13px]">
          <div className="min-w-0 flex-1">
            <span className="mr-2 font-medium text-accent">Summary</span>
            {summary.text}
          </div>
          <button onClick={() => setSummary(null)} className="text-muted hover:text-ink" aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6"
      >
        {!t && !thread.error && <p className="text-center text-[13px] text-muted">Loading messages…</p>}
        {thread.error && <p className="text-center text-[13px] text-danger">{thread.error}</p>}
        {t?.messages.length === 0 && <p className="text-center text-[13px] text-muted">No messages stored for this chat yet.</p>}
        <div className="mx-auto flex max-w-3xl flex-col gap-1">
          {t?.messages.map((m) => {
            const day = dayLabel(m.ts);
            const showDay = day !== lastDay;
            lastDay = day;
            const body = m.media === "document" ? m.text?.split(" — ").slice(1).join(" — ") : m.text;
            return (
              <Fragment key={m.chat + m.id}>
                {showDay && (
                  <div className="my-3 text-center text-[11.5px] font-medium uppercase tracking-wide text-faint">{day}</div>
                )}
                <div
                  className={`group flex items-center gap-2 ${m.fromMe ? "justify-end" : "justify-start"} ${
                    selecting !== null ? "-mx-2 cursor-pointer rounded-lg px-2 py-0.5 hover:bg-sunken" : ""
                  } ${selecting?.includes(m.id) ? "bg-accent-soft/50" : ""}`}
                  onClick={selecting !== null ? () => toggleSelect(m.id) : undefined}
                  role={selecting !== null ? "checkbox" : undefined}
                  aria-checked={selecting !== null ? selecting.includes(m.id) : undefined}
                >
                  {selecting !== null && (
                    <span
                      className={`order-first grid size-5 shrink-0 place-items-center rounded-full border text-[11px] ${
                        selecting.includes(m.id) ? "border-accent bg-accent text-accent-ink" : "border-line bg-panel"
                      } ${m.fromMe ? "mr-auto" : ""}`}
                      aria-hidden
                    >
                      {selecting.includes(m.id) ? "✓" : ""}
                    </span>
                  )}
                  <div
                    className={`relative max-w-[85%] rounded-2xl px-3 py-2 text-[14px] leading-snug shadow-[0_1px_0_var(--line)] sm:max-w-[70%] ${
                      m.fromMe ? "rounded-br-md bg-mine" : "rounded-bl-md bg-theirs"
                    } ${replyTo?.id === m.id || selecting?.includes(m.id) ? "ring-2 ring-accent" : ""}`}
                  >
                    {t.isGroup && !m.fromMe && m.from && <div className="mb-0.5 text-[12px] font-medium text-accent">{m.from}</div>}
                    {m.forwarded && <div className="mb-0.5 text-[11.5px] italic text-faint">↪ Forwarded</div>}
                    {m.media && <Media m={m} />}
                    {m.media && <AttachmentText key={m.attachment ? "y" : "n"} m={m} />}
                    {body && (
                      <div className="whitespace-pre-wrap break-words">
                        <Linkified text={body} />
                      </div>
                    )}
                    <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[10.5px] text-faint">
                      {m.auto && <span className="font-medium uppercase tracking-wide text-accent">auto</span>}
                      {new Date(m.ts * 1000).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </div>
                    <div
                      data-write="hide"
                      className={`absolute top-1 hidden flex-col gap-1 ${selecting === null ? "group-hover:flex" : ""} ${m.fromMe ? "-left-[4.5rem] items-end" : "-right-[4.5rem] items-start"}`}
                    >
                      <button
                        onClick={() => {
                          setReplyTo(m);
                          inputRef.current?.focus();
                        }}
                        className="rounded-md border border-line bg-panel px-1.5 py-0.5 text-[11px] text-muted shadow-sm hover:text-ink"
                      >
                        Reply
                      </button>
                      <button
                        onClick={() => {
                          setReplyTo(null);
                          setSelecting([m.id]);
                        }}
                        title="Forward this and pick more messages if you like"
                        className="rounded-md border border-line bg-panel px-1.5 py-0.5 text-[11px] text-muted shadow-sm hover:text-ink"
                      >
                        Forward
                      </button>
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>

      <div data-viewonly className="shrink-0 border-t border-line bg-panel px-4 py-3 text-center text-[12.5px] text-muted">
        Read-only: you&apos;re viewing another account, so you can&apos;t reply here.
      </div>
      {selecting !== null && (
        <div data-write="hide" className="flex shrink-0 items-center gap-3 border-t border-line bg-panel px-4 py-3">
          <button onClick={() => setSelecting(null)} className="text-[18px] text-muted hover:text-ink" aria-label="Cancel selection">
            ×
          </button>
          <span className="text-[13.5px] font-medium">
            {selecting.length} selected
            {selecting.length >= SELECT_MAX && <span className="ml-2 font-normal text-muted">(max {SELECT_MAX})</span>}
          </span>
          <span className="hidden text-[12.5px] text-muted sm:inline">Tap messages to add or remove them</span>
          <button
            onClick={() => setForwarding((t?.messages ?? []).filter((m) => selecting.includes(m.id)))}
            disabled={selecting.length === 0}
            className="ml-auto h-9 rounded-lg bg-accent px-4 text-[13px] font-medium text-accent-ink disabled:opacity-40"
          >
            Forward{selecting.length > 1 ? ` ${selecting.length}` : ""}
          </button>
        </div>
      )}
      <div data-write="hide" className={`shrink-0 border-t border-line bg-panel px-3 py-3 sm:px-4 ${selecting !== null ? "hidden" : ""}`}>
        {error && <div className="mb-2 text-[12.5px] text-danger">{error}</div>}
        {beforeEnglish !== null && (
          <div className="mb-2 flex items-center gap-2 text-[12.5px] text-muted">
            <span className="font-medium text-accent">Converted to English.</span>
            <span>Check it, then press Send.</span>
            <button
              onClick={() => {
                setText(beforeEnglish);
                setBeforeEnglish(null);
                inputRef.current?.focus();
              }}
              className="ml-auto text-accent hover:underline"
            >
              Undo
            </button>
          </div>
        )}
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-accent bg-sunken px-3 py-1.5 text-[12.5px]">
            <span className="shrink-0 font-medium text-accent">Replying to {replyTo.fromMe ? "yourself" : replyTo.from ?? t?.name}</span>
            <span className="truncate text-muted">{replyTo.text || mediaLabel[replyTo.media ?? ""]}</span>
            <button onClick={() => setReplyTo(null)} className="ml-auto text-muted hover:text-ink" aria-label="Cancel reply">
              ×
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <input
            ref={fileInput}
            type="file"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) sendFile(f);
            }}
          />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={busy !== null}
            title="Attach a file (the text box becomes its caption)"
            className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-[18px] text-muted hover:bg-sunken disabled:opacity-50"
          >
            {busy === "file" ? "…" : "+"}
          </button>
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setBeforeEnglish(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={Math.min(6, Math.max(1, text.split("\n").length))}
            placeholder="Type a message — Enter to send, Shift+Enter for a new line"
            className="min-h-10 flex-1 resize-none rounded-lg border border-line bg-sunken px-3 py-2 text-[14px] outline-none placeholder:text-faint focus:border-accent"
          />
          <button
            onClick={toEnglish}
            disabled={busy !== null || !text.trim()}
            title="Convert what you typed, in any language, into English. Nothing is sent until you press Send."
            className="h-10 shrink-0 rounded-lg border border-line px-3 text-[13px] hover:bg-sunken disabled:opacity-40"
          >
            {busy === "english" ? "Converting…" : "English"}
          </button>
          <button
            onClick={draft}
            disabled={busy !== null}
            title="Let AI write a reply in your style. Nothing is sent until you press Send."
            className="h-10 shrink-0 rounded-lg border border-line px-3 text-[13px] hover:bg-sunken disabled:opacity-50"
          >
            {busy === "draft" ? "Writing…" : "AI draft"}
          </button>
          <button
            onClick={send}
            disabled={busy !== null || !text.trim()}
            className="h-10 shrink-0 rounded-lg bg-accent px-4 text-[13px] font-medium text-accent-ink disabled:opacity-40"
          >
            {busy === "send" ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
      {forwarding && (
        <ForwardDialog
          msgs={forwarding}
          fromJid={jid}
          onClose={(done) => {
            setForwarding(null);
            if (done) {
              setSelecting(null);
              onChanged();
            }
          }}
        />
      )}
    </>
  );
}

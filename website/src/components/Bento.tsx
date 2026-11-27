"use client";

/** Feature tiles: each one shows a small, working piece of the product (example content you can click). */
import { useEffect, useRef, useState } from "react";
import { FileIcon, ForwardIcon, LanguageIcon, MicIcon, NoteIcon, ShieldIcon, UsersIcon } from "./Icons";

function Tile({
  title,
  text,
  icon,
  className = "",
  children,
}: {
  title: string;
  text: string;
  icon: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article className={`tile tile-lift flex flex-col overflow-hidden ${className}`}>
      <div className="p-6 pb-0 sm:p-7 sm:pb-0">
        <h3 className="flex items-center gap-2.5 text-[17px] font-semibold text-ink">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent-soft text-accent-ink">{icon}</span>
          {title}
        </h3>
        <p className="mt-2 max-w-[46ch] text-[15px] leading-relaxed text-muted">{text}</p>
      </div>
      <div className="mt-6 flex flex-1 items-end px-6 pb-6 sm:px-7 sm:pb-7" role="group" aria-label={`${title}: interactive example`}>
        <div className="w-full">{children}</div>
      </div>
    </article>
  );
}

/* deterministic waveform heights, so server and client render the same bars */
const bars = [6, 12, 9, 16, 22, 14, 8, 18, 26, 20, 12, 7, 15, 24, 18, 10, 6, 14, 20, 16, 9, 12, 22, 17, 11, 7, 13, 19, 10, 6];

const DURATION = 41; // seconds in the example note

function VoiceNote() {
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setT((x) => {
        if (x >= DURATION) {
          setPlaying(false);
          return 0;
        }
        return x + 1;
      });
    }, 120); // plays the 41 s example in ~5 s
    return () => window.clearInterval(id);
  }, [playing]);
  const played = Math.round((t / DURATION) * bars.length);
  const shown = playing || t > 0 ? t : DURATION;
  return (
    <div className="space-y-3">
      <div className="flex max-w-[340px] items-center gap-3 rounded-[18px] rounded-bl-md border border-line bg-field px-3.5 py-2.5">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause example voice note" : "Play example voice note"}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-paper transition-transform duration-150 hover:scale-105 active:scale-95"
        >
          {playing ? (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="ml-0.5 h-3.5 w-3.5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
        <span className="flex h-7 flex-1 items-center gap-[3px]" aria-hidden="true">
          {bars.map((h, i) => (
            <span
              key={i}
              className={`w-[3px] rounded-full transition-colors duration-150 ${(playing || t > 0 ? i < played : i < 11) ? "bg-accent-ink" : "bg-line-strong"}`}
              style={{ height: `${h}px` }}
            />
          ))}
        </span>
        <span className="tabular w-8 text-right text-[12px] text-muted">0:{String(shown).padStart(2, "0")}</span>
      </div>
      <div className="rounded-2xl border border-line bg-paper p-4 text-[14px] shadow-[0_1px_2px_rgba(13,19,16,0.05)]">
        <p className="text-[12px] font-semibold text-muted">Transcript</p>
        <p className="mt-1 text-ink">&ldquo;Bhai kal subah 10 baje aa jana, invoice ready rakhna, Sharma ji bhi aayenge.&rdquo;</p>
        <p className="mt-3 text-[12px] font-semibold text-accent-ink">English</p>
        <p className="mt-1 text-ink-2">&ldquo;Come by tomorrow at 10 am, keep the invoice ready, Mr Sharma is coming too.&rdquo;</p>
      </div>
    </div>
  );
}

function Receipt() {
  const rows: [string, string][] = [
    ["From", "Priya Traders"],
    ["Invoice", "INV-2041"],
    ["Amount", "₹48,500"],
    ["Due", "Friday, 29 Nov"],
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-field px-3.5 py-3">
        <span className="inline-flex h-10 w-9 items-center justify-center rounded-md bg-[#e5484d] text-[10px] font-bold text-white">PDF</span>
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-medium text-ink">invoice-november.pdf</span>
          <span className="block text-[12px] text-muted">2 pages · 184 KB</span>
        </span>
      </div>
      <dl className="tabular grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-2xl border border-line bg-paper p-4 text-[13.5px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const forwardMsgs = ["Rate list for December attached", "Prices valid till 15th", "Call me before ordering", "Delivery in 3 days from order"];

function ForwardPick() {
  const [picked, setPicked] = useState<number[]>([0, 1, 3]);
  const [sent, setSent] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const toggle = (i: number) => {
    setSent(false);
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i].sort()));
  };
  const forward = () => {
    if (!picked.length) return;
    setSent(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSent(false), 2200);
  };
  return (
    <div className="rounded-2xl border border-line bg-paper p-3">
      <ul className="space-y-1.5">
        {forwardMsgs.map((t, i) => {
          const on = picked.includes(i);
          return (
            <li key={t}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(i)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13.5px] transition-colors duration-150 ${on ? "bg-accent-soft text-ink" : "text-muted hover:bg-field"}`}
              >
                <span className={`inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-all duration-150 ${on ? "scale-100 border-accent-ink bg-accent-ink text-white" : "border-line-strong"}`}>
                  {on ? <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5 9-10" /></svg> : null}
                </span>
                <span className="truncate">{t}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line px-1.5 pt-3">
        <span className="text-[12.5px] text-muted" aria-live="polite">
          {sent ? `Forwarded to Sales Team, Accounts` : "To Sales Team, Accounts"}
        </span>
        <button
          type="button"
          onClick={forward}
          disabled={!picked.length}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition-all duration-200 active:scale-95 disabled:opacity-40 ${sent ? "bg-accent-ink text-white" : "bg-ink text-paper hover:bg-[#1d2621]"}`}
        >
          {sent ? (
            <>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5 9-10" /></svg>
              Forwarded
            </>
          ) : (
            `Forward ${picked.length}`
          )}
        </button>
      </div>
    </div>
  );
}

const typed = "haan payment kal tak kar dunga, tension mat lo 🙏";
const english = "Yes, I'll make the payment by tomorrow, don't worry 🙏";

function EnglishButton() {
  const [on, setOn] = useState(true);
  return (
    <div className="space-y-2.5">
      <div
        className={`rounded-2xl border px-4 py-3 text-[14px] transition-all duration-300 ${on ? "border-line bg-field text-muted line-through decoration-line-strong" : "border-accent/40 bg-paper text-ink"}`}
      >
        {typed}
      </div>
      <div
        className={`rounded-2xl border px-4 py-3 text-[14px] transition-all duration-300 ${on ? "border-accent/40 bg-paper text-ink shadow-[0_6px_20px_-12px_rgba(10,122,76,0.45)]" : "border-dashed border-line-strong bg-paper text-muted"}`}
        aria-live="polite"
      >
        {on ? english : "Press English to convert it"}
      </div>
      <div className="flex items-center justify-end gap-2">
        {on ? <span className="mr-auto text-[12px] font-medium text-accent-ink">Converted. Check it, then send.</span> : null}
        <button
          type="button"
          onClick={() => setOn((v) => !v)}
          aria-pressed={on}
          className="inline-flex h-8 items-center rounded-lg border border-accent-ink bg-accent-soft px-3 text-[12.5px] font-semibold text-accent-ink transition-transform duration-150 hover:bg-[#d3f0e0] active:scale-95"
        >
          {on ? "Undo" : "English"}
        </button>
        <span className="inline-flex h-8 items-center rounded-lg bg-ink px-3 text-[12.5px] font-semibold text-paper">Send</span>
      </div>
    </div>
  );
}

function Confirm() {
  const [state, setState] = useState<"ready" | "sending" | "sent">("ready");
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const send = () => {
    if (state !== "ready") return;
    setState("sending");
    timers.current.push(window.setTimeout(() => setState("sent"), 650));
    timers.current.push(window.setTimeout(() => setState("ready"), 2900));
  };
  return (
    <div className="rounded-2xl border border-line bg-paper p-4 text-[14px]">
      <p className="text-[12px] font-semibold text-muted" aria-live="polite">
        {state === "sent" ? "Sent to Accounts group ✓" : state === "sending" ? "Sending…" : "Ready to send"}
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted">To</dt>
        <dd className="font-medium text-ink">Accounts group</dd>
        <dt className="text-muted">Message</dt>
        <dd className="text-ink">Payment for INV-2041 done, screenshot attached.</dd>
      </dl>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={send}
          className={`inline-flex h-8 min-w-[64px] items-center justify-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition-all duration-200 active:scale-95 ${state === "sent" ? "bg-accent-ink text-white" : "bg-ink text-paper hover:bg-[#1d2621]"}`}
        >
          {state === "sent" ? (
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" aria-label="Sent"><path d="M5 12l5 5 9-10" /></svg>
          ) : state === "sending" ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-paper/40 border-t-paper" aria-label="Sending" />
          ) : (
            "Send"
          )}
        </button>
        <span className="inline-flex h-8 items-center rounded-lg border border-line-strong px-3 text-[12.5px] font-semibold text-ink">Edit</span>
        <span className="inline-flex h-8 items-center rounded-lg px-2 text-[12.5px] font-medium text-muted">Cancel</span>
      </div>
    </div>
  );
}

function Team() {
  const people: [string, string, string, string][] = [
    ["AK", "Arjun", "Owner · superadmin", "Linked"],
    ["NC", "Neha", "Sales", "Linked"],
    ["RS", "Ravi", "Accounts", "Linked"],
  ];
  return (
    <div className="space-y-2.5">
      <ul className="divide-y divide-line rounded-2xl border border-line bg-paper">
        {people.map(([ini, name, role, st]) => (
          <li key={name} className="flex items-center gap-3 px-4 py-2.5 text-[13.5px]">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-[11.5px] font-semibold text-ink-2">{ini}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-ink">{name}</span>
              <span className="block text-[12px] text-muted">{role}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-accent-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {st}
            </span>
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-2 px-1 text-[12.5px] text-muted">
        <ShieldIcon className="h-4 w-4 text-accent-ink" />
        Arjun viewed Ravi&rsquo;s chats (read-only) · shown to Ravi
      </p>
    </div>
  );
}

function Memory() {
  return (
    <ul className="space-y-2 text-[13.5px]">
      {["Priya is our accountant, keep it formal", "Sharma ji prefers voice notes", "Never promise delivery dates"].map((t) => (
        <li key={t} className="flex items-start gap-2.5 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-ink">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          {t}
        </li>
      ))}
    </ul>
  );
}

export function Bento() {
  return (
    <div className="grid gap-4 md:grid-cols-6">
      <Tile className="md:col-span-4" icon={<MicIcon className="h-[18px] w-[18px]" />} title="Hear every voice note" text="Voice notes are transcribed as they arrive, with an English line when they're in Hindi, Hinglish or anything else. The AI reads them like text.">
        <VoiceNote />
      </Tile>
      <Tile className="md:col-span-2" icon={<FileIcon className="h-[18px] w-[18px]" />} title="Reads bills and PDFs" text="Photos, screenshots, PDFs, Word and Excel files become text: amounts, dates and names included.">
        <Receipt />
      </Tile>
      <Tile className="md:col-span-2" icon={<ForwardIcon className="h-[18px] w-[18px]" />} title="Forward in one go" text="Pick several messages and send them to up to five chats, as real WhatsApp forwards, photos and files included.">
        <ForwardPick />
      </Tile>
      <Tile className="md:col-span-2" icon={<LanguageIcon className="h-[18px] w-[18px]" />} title="Type in Hinglish, send in English" text="Write the way you talk, press English, check it, send. Your tone, names and numbers stay exactly as typed.">
        <EnglishButton />
      </Tile>
      <Tile className="md:col-span-2" icon={<ShieldIcon className="h-[18px] w-[18px]" />} title="Nothing goes out without you" text="Before anything is sent, you see the exact message and who it's going to. Drafting never sends.">
        <Confirm />
      </Tile>
      <Tile className="md:col-span-4" icon={<UsersIcon className="h-[18px] w-[18px]" />} title="Your whole team, each on their own number" text="Everyone links their own WhatsApp and connects their own ChatGPT. The owner can read any account but never send from it, and every view is shown to that person.">
        <Team />
      </Tile>
      <Tile className="md:col-span-2" icon={<NoteIcon className="h-[18px] w-[18px]" />} title="Remembers how you work" text="Tell it once who people are and how to talk to them; drafts and replies follow.">
        <Memory />
      </Tile>
    </div>
  );
}

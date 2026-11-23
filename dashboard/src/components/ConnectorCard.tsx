"use client";

import { useState } from "react";
import { ago, usePoll, wa } from "@/lib/wa";

type Memory = { id: number; text: string; created: number };
type Connector = { url: string; signIn: boolean; sessions: { name: string; created: number; expires: number }[] };

export default function ConnectorCard() {
  const connector = usePoll(() => wa<Connector>("connector"), 30000);
  const memory = usePoll(() => wa<Memory[]>("memory"), 20000);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const c = connector.data;

  const add = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      memory.setData(await wa<Memory[]>("memory", { method: "POST", body: { text: note } }));
      setNote("");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: number) => memory.setData(await wa<Memory[]>(`memory/${id}`, { method: "DELETE" }));
  const revoke = async () => {
    if (!window.confirm("Disconnect all AI apps? They will need to sign in again.")) return;
    await wa("connector/revoke", { method: "POST" });
    connector.refresh();
  };

  return (
    <section className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${c?.sessions.length ? "bg-accent" : "bg-faint"}`} />
          <h2 className="text-[15px] font-semibold tracking-tight">MCP connector</h2>
          <span className="ml-auto text-[12px] text-faint">
            {c ? (c.sessions.length ? `Connected · ${ago(c.sessions[0].created)}` : "Not connected yet") : ""}
          </span>
        </div>
        <p className="mt-1 text-[13px] text-muted">Use WhatsApp from ChatGPT, Claude or any MCP client: catch up, search, draft, reply and send files.</p>
        <div className="mt-3 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-sunken px-3 py-2 font-mono text-[12.5px]">{c?.url ?? "…"}</code>
          <button
            disabled={!c}
            onClick={async () => {
              await navigator.clipboard.writeText(c!.url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="h-9 shrink-0 rounded-lg bg-ink px-3 text-[12.5px] font-medium text-panel disabled:opacity-40"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-[12.5px] leading-relaxed text-muted">
          <li>ChatGPT (web): Plugins → Add → Add custom MCP server (turn on Developer mode in Settings if it is missing). Claude: Settings → Connectors → Add custom connector.</li>
          <li>Paste this URL. Choose OAuth where asked and leave client ID and secret empty.</li>
          <li>Sign in with your own username and password (the ones you use for this dashboard). The AI app then only sees your WhatsApp.</li>
          <li>In a new chat, pick the connector and ask: “What did I miss on WhatsApp today?”</li>
        </ol>
        {c && c.sessions.length > 0 && (
          <button data-write="hide" onClick={revoke} className="mt-3 text-[12.5px] text-danger hover:underline">
            Disconnect AI apps
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
        <h2 className="text-[15px] font-semibold tracking-tight">What the AI remembers</h2>
        <p className="mt-1 text-[13px] text-muted">
          Used by your AI app, AI drafts and auto-replies. The AI app can add to it too (“remember that Rahul is my accountant”).
        </p>
        <form
          data-write="hide"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="e.g. Rahul is my accountant — keep it formal with him"
            className="min-w-0 flex-1 rounded-lg border border-line bg-sunken px-3 py-2 text-[13px] outline-none placeholder:text-faint focus:border-accent"
          />
          <button disabled={busy || !note.trim()} className="h-9 shrink-0 rounded-lg bg-ink px-3 text-[12.5px] font-medium text-panel disabled:opacity-30">
            Add
          </button>
        </form>
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">
          {memory.data?.length === 0 && <li className="text-[12.5px] text-faint">Nothing saved yet.</li>}
          {memory.data?.map((m) => (
            <li key={m.id} className="group flex items-start gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-sunken">
              <span className="flex-1">{m.text}</span>
              <button data-write="hide" onClick={() => remove(m.id)} className="text-muted opacity-0 group-hover:opacity-100 hover:text-danger" aria-label="Forget">
                ×
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

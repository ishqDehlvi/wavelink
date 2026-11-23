"use client";

import { useState } from "react";
import { type AdminAccess, type Status, ago, useMe, usePoll, wa } from "@/lib/wa";
import AppHeader, { logout } from "./AppHeader";

const input =
  "mt-1 w-full rounded-lg border border-line bg-sunken px-3 py-2 text-[14px] font-normal outline-none focus:border-accent";

export default function Account() {
  const me = useMe();
  const status = usePoll(() => wa<Status>("status"), 5000);
  const access = usePoll(() => wa<AdminAccess[]>("me/access"), 60000);
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [clearChats, setClearChats] = useState(false);
  const s = status.data;
  const connected = s?.status === "connected";

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (pw.next !== pw.again) return setPwMsg({ ok: false, text: "The new passwords don't match." });
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current: pw.current, next: pw.next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not change the password.");
      setPw({ current: "", next: "", again: "" });
      setPwMsg({ ok: true, text: "Password changed. Other devices and ChatGPT were signed out; reconnect ChatGPT with the new password." });
    } catch (err) {
      setPwMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    const msg = clearChats
      ? "Unlink WhatsApp and delete all chats stored here? You can link again (even another number) with a new QR code."
      : "Unlink WhatsApp? It's removed from Linked devices on your phone. Your stored chats stay here.";
    if (!window.confirm(msg)) return;
    try {
      await wa("whatsapp/unlink", { method: "POST", body: { clearChats } });
      status.refresh();
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <AppHeader active="account" gate={false} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight">Your account</h1>
            <p className="mt-1 text-[13.5px] text-muted">
              {me ? (
                <>
                  Signed in as <b className="font-medium text-ink">{me.username}</b>
                  {me.name ? ` (${me.name})` : ""} · {me.role === "superadmin" ? "Superadmin" : "User"}
                </>
              ) : (
                "…"
              )}
            </p>
          </div>

          <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
            <h2 className="text-[15px] font-semibold tracking-tight">WhatsApp</h2>
            <p className="mt-1 text-[13px] text-muted">
              {connected
                ? `Linked to +${s?.number}${s?.name ? ` (${s.name})` : ""}. ${s?.chats.toLocaleString(undefined)} chats stored.`
                : "Not linked. Open Overview or Inbox to scan the QR code."}
            </p>
            {connected && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-[13px] text-muted">
                  <input type="checkbox" checked={clearChats} onChange={(e) => setClearChats(e.target.checked)} className="accent-[var(--danger)]" />
                  Also delete the chats stored here
                </label>
                <button onClick={unlink} className="h-9 rounded-lg border border-line px-3 text-[13px] text-danger hover:bg-sunken">
                  Unlink WhatsApp
                </button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
            <h2 className="text-[15px] font-semibold tracking-tight">Admin access</h2>
            <p className="mt-1 text-[13px] text-muted">
              Your organisation&apos;s superadmin can read the chats on this account (never send from it). Every time they do, it shows up here.
            </p>
            <ul className="mt-3 space-y-1 text-[13px]">
              {access.data?.length === 0 && <li className="text-faint">Nobody has viewed your chats.</li>}
              {access.data?.map((a, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    <b className="font-medium">{a.admin}</b> viewed your chats {a.via === "chatgpt" ? "through ChatGPT" : "on the dashboard"}
                  </span>
                  <span className="shrink-0 text-muted">{ago(a.ts)}</span>
                </li>
              ))}
            </ul>
          </section>

          <form onSubmit={changePassword} className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
            <h2 className="text-[15px] font-semibold tracking-tight">Change password</h2>
            <p className="mt-1 text-[13px] text-muted">Used for this dashboard and for connecting ChatGPT.</p>
            <label className="mt-3 block text-[12.5px] font-medium">
              Current password
              <input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required className={input} />
            </label>
            <label className="mt-3 block text-[12.5px] font-medium">
              New password
              <input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" minLength={8} required className={input} />
            </label>
            <label className="mt-3 block text-[12.5px] font-medium">
              New password again
              <input type="password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} autoComplete="new-password" minLength={8} required className={input} />
            </label>
            {pwMsg && <p className={`mt-3 text-[12.5px] ${pwMsg.ok ? "text-accent" : "text-danger"}`}>{pwMsg.text}</p>}
            <button disabled={busy} className="mt-4 h-9 rounded-lg bg-accent px-4 text-[13px] font-medium text-accent-ink disabled:opacity-60">
              {busy ? "Saving…" : "Change password"}
            </button>
          </form>

          <button onClick={logout} className="h-9 rounded-lg border border-line px-3 text-[13px] text-ink hover:bg-sunken sm:hidden">
            Log out
          </button>
        </div>
      </main>
    </div>
  );
}

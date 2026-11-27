"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type AdminUser, ago, useMe, usePoll, wa } from "@/lib/wa";
import { generatePassword } from "@/lib/password";
import { startViewing } from "@/lib/view";
import AppHeader from "./AppHeader";

type Shared = { username: string; password: string; what: "created" | "reset" };

const MENU_ITEM = "block w-full rounded-lg px-3 py-2 text-left text-[13px] hover:bg-sunken";

const plural = (n: number, word: string) => `${n.toLocaleString(undefined)} ${word}${n === 1 ? "" : "s"}`;

const input =
  "mt-1 w-full rounded-lg border border-line bg-sunken px-3 py-2 text-[14px] font-normal outline-none placeholder:text-faint focus:border-accent";

function WhatsAppBadge({ u }: { u: AdminUser }) {
  if (u.disabled) return <span className="rounded-md bg-sunken px-2 py-0.5 text-[12px] text-muted">Disabled</span>;
  if (!u.whatsappEnabled) return <span className="rounded-md bg-sunken px-2 py-0.5 text-[12px] text-muted">Notion only</span>;
  const w = u.whatsapp;
  if (w?.status === "connected")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-0.5 text-[12px] text-accent">
        <span className="size-1.5 rounded-full bg-accent" /> Linked{w.number ? ` · +${w.number}` : ""}
      </span>
    );
  if (w?.linked)
    return <span className="rounded-md bg-warn-soft px-2 py-0.5 text-[12px] text-warn">Reconnecting</span>;
  return <span className="rounded-md bg-sunken px-2 py-0.5 text-[12px] text-muted">Not linked yet</span>;
}

export default function AdminUsers() {
  const me = useMe();
  const router = useRouter();
  const users = usePoll(() => wa<AdminUser[]>("admin/users"), 5000);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", name: "", password: "", role: "user" as "user" | "superadmin", whatsapp: true });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState<Shared | null>(null);
  const [copied, setCopied] = useState(false);

  // a click anywhere else closes an open "More" menu
  useEffect(() => {
    const close = (e: MouseEvent) => {
      for (const d of document.querySelectorAll<HTMLDetailsElement>("details.user-menu[open]")) if (!d.contains(e.target as Node)) d.open = false;
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await wa("admin/users", { method: "POST", body: form });
      setShared({ username: form.username.trim().toLowerCase(), password: form.password, what: "created" });
      setForm({ username: "", name: "", password: "", role: "user", whatsapp: true });
      setOpen(false);
      users.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const act = async (u: AdminUser, change: Record<string, unknown>, done?: () => void) => {
    try {
      await wa(`admin/users/${u.id}`, { method: "PATCH", body: change });
      done?.();
      users.refresh();
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  const resetPassword = (u: AdminUser) => {
    if (!window.confirm(`Reset ${u.username}'s password? They'll be signed out of the dashboard and ChatGPT.`)) return;
    const password = generatePassword();
    act(u, { password }, () => setShared({ username: u.username, password, what: "reset" }));
  };

  const toggleDisabled = (u: AdminUser) => {
    const msg = u.disabled
      ? `Enable ${u.username}? They can sign in again and their WhatsApp reconnects.`
      : `Disable ${u.username}? They're signed out everywhere and their WhatsApp stops syncing. Their chats are kept.`;
    if (window.confirm(msg)) act(u, { disabled: !u.disabled });
  };

  const toggleWhatsApp = (u: AdminUser) => {
    const msg = u.whatsappEnabled
      ? `Turn WhatsApp off for ${u.username}? Their WhatsApp stops syncing and they only see Notion. Their chats and link are kept, so turning it back on reconnects.`
      : `Turn WhatsApp on for ${u.username}? They'll be asked to scan a QR code the next time they open the dashboard.`;
    if (window.confirm(msg)) act(u, { whatsapp: !u.whatsappEnabled });
  };

  const remove = async (u: AdminUser) => {
    const typed = window.prompt(
      `Delete ${u.username} for good? Their WhatsApp is unlinked and all their stored chats, files and settings are erased. This can't be undone.\n\nType the username to confirm:`,
    );
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== u.username) return window.alert("The username didn't match, so nothing was deleted.");
    try {
      await wa(`admin/users/${u.id}`, { method: "DELETE" });
      users.refresh();
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  const list = users.data ?? [];
  const linked = list.filter((u) => u.whatsapp?.status === "connected").length;

  return (
    <div className="flex h-full flex-col">
      <AppHeader active="admin" gate={false} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1080px] space-y-6 px-4 pt-8 pb-14 sm:px-8 sm:pt-10">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[30px] leading-tight font-bold">Users</h1>
              <p className="mt-1 text-[13.5px] text-muted">
                {list.length} {list.length === 1 ? "account" : "accounts"} · {linked} WhatsApp linked. View chats is read-only, and each view is shown to that
                account&apos;s owner.
              </p>
            </div>
            <button
              onClick={() => {
                setOpen((v) => !v);
                setError(null);
                if (!form.password) setForm((f) => ({ ...f, password: generatePassword() }));
              }}
              className="h-9 rounded-lg bg-accent px-3.5 text-[13px] font-medium text-accent-ink"
            >
              {open ? "Cancel" : "Add user"}
            </button>
          </div>

          {shared && (
            <div className="rounded-2xl border border-accent/40 bg-accent-soft p-4 sm:p-5">
              <p className="text-[14px] font-medium">
                {shared.what === "created" ? `Account created for ${shared.username}.` : `New password for ${shared.username}.`} Share these sign-in
                details with them:
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="rounded-lg border border-line bg-panel px-3 py-2 font-mono text-[13px]">
                  {shared.username} / {shared.password}
                </code>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      `Dashboard: ${window.location.origin}\nUsername: ${shared.username}\nPassword: ${shared.password}`,
                    );
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="h-9 rounded-lg bg-accent px-3 text-[12.5px] font-medium text-accent-ink hover:bg-accent-deep"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
                <button onClick={() => setShared(null)} className="h-9 px-2 text-[12.5px] text-muted hover:text-ink">
                  Done
                </button>
              </div>
              <p className="mt-2 text-[12.5px] text-muted">The password isn&apos;t shown again. They can change it under their account.</p>
            </div>
          )}

          {open && (
            <form onSubmit={create} className="grid gap-x-4 panel p-4 sm:grid-cols-2 sm:p-5">
              <label className="block text-[12.5px] font-medium">
                Username
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="e.g. rahul"
                  autoComplete="off"
                  required
                  className={input}
                />
              </label>
              <label className="mt-3 block text-[12.5px] font-medium sm:mt-0">
                Name
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Used when the AI writes as them"
                  className={input}
                />
              </label>
              <label className="mt-3 block text-[12.5px] font-medium">
                Password
                <span className="flex gap-2">
                  <input
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    minLength={8}
                    required
                    autoComplete="new-password"
                    className={`${input} font-mono`}
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, password: generatePassword() })}
                    className="mt-1 shrink-0 rounded-lg border border-line px-3 text-[12.5px] text-ink hover:bg-sunken"
                  >
                    New
                  </button>
                </span>
              </label>
              <label className="mt-3 block text-[12.5px] font-medium">
                Role
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as "user" | "superadmin" })}
                  className={input}
                >
                  <option value="user">User: their own WhatsApp, and the Notion pages you share</option>
                  <option value="superadmin">Superadmin: can also manage users and all of Notion</option>
                </select>
              </label>
              <label className="mt-3 flex items-center gap-2 text-[13px] sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.checked })}
                  className="size-4 accent-[var(--accent)]"
                />
                WhatsApp: they link their own WhatsApp
                <span className="text-muted">(untick for someone who only uses Notion)</span>
              </label>
              {error && <p className="mt-3 text-[12.5px] text-danger sm:col-span-2">{error}</p>}
              <div className="mt-4 sm:col-span-2">
                <button disabled={busy} className="h-9 rounded-lg bg-accent px-4 text-[13px] font-medium text-accent-ink disabled:opacity-60">
                  {busy ? "Creating…" : "Create account"}
                </button>
              </div>
            </form>
          )}

          {users.error && <p className="text-[13px] text-danger">{users.error}</p>}

          <ul className="panel divide-y divide-line">
            {!users.data && !users.error && <li className="p-5 text-[13px] text-muted">Loading…</li>}
            {list.map((u) => {
              const self = u.id === me?.id;
              return (
                <li key={u.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5 ${u.disabled ? "opacity-60" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14.5px] font-medium">{u.name || u.username}</span>
                      {u.name && <span className="text-[13px] text-muted">@{u.username}</span>}
                      {u.role === "superadmin" && (
                        <span className="rounded-md border border-line px-1.5 py-px text-[11px] font-medium text-muted">Superadmin</span>
                      )}
                      {self && <span className="text-[12px] text-faint">(you)</span>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
                      <WhatsAppBadge u={u} />
                      {u.whatsapp && u.whatsapp.messages > 0 && (
                        <span>
                          {plural(u.whatsapp.chats, "chat")} · {plural(u.whatsapp.messages, "message")}
                        </span>
                      )}
                      <span>{u.chatgptConnections ? `ChatGPT connected` : "ChatGPT not connected"}</span>
                      <span>{u.role === "superadmin" ? "All of Notion" : u.notion ? "Has Notion pages" : "No Notion pages"}</span>
                      <span>{u.lastLogin ? `Last sign-in ${ago(u.lastLogin)}` : "Never signed in"}</span>
                      {u.lastViewedByAdmin && <span>Viewed by {u.lastViewedByAdmin.admin} {ago(u.lastViewedByAdmin.ts)}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    {!self && !u.disabled && (u.whatsapp?.linked || (u.whatsapp?.messages ?? 0) > 0) && (
                      <button
                        onClick={() => {
                          startViewing(u.id);
                          router.push("/inbox");
                        }}
                        className="h-8 rounded-lg border border-line px-2.5 text-[12.5px] font-medium text-accent hover:bg-sunken"
                      >
                        View chats
                      </button>
                    )}
                    {u.role !== "superadmin" && !u.disabled && (
                      <Link href={`/notion/access?user=${u.id}`} className="inline-flex h-8 items-center rounded-lg border border-line px-2.5 text-[12.5px] hover:bg-sunken">
                        Notion access
                      </Link>
                    )}
                    <details className="user-menu group relative">
                      <summary className="flex h-8 cursor-pointer list-none items-center gap-1 rounded-lg border border-line px-2.5 text-[12.5px] hover:bg-sunken [&::-webkit-details-marker]:hidden">
                        More
                        <svg viewBox="0 0 24 24" className="size-3.5 transition-transform duration-150 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </summary>
                      <div
                        className="absolute right-0 z-20 mt-1.5 w-48 rounded-xl border border-line bg-panel p-1 shadow-[var(--shadow-pop)]"
                        onClick={(e) => e.currentTarget.closest("details")?.removeAttribute("open")}
                      >
                        {!self && !u.disabled && (
                          <button onClick={() => toggleWhatsApp(u)} className={MENU_ITEM}>
                            {u.whatsappEnabled ? "Turn WhatsApp off" : "Turn WhatsApp on"}
                          </button>
                        )}
                        <button onClick={() => resetPassword(u)} className={MENU_ITEM}>
                          Reset password
                        </button>
                        {!self && (
                          <>
                            <button onClick={() => toggleDisabled(u)} className={MENU_ITEM}>
                              {u.disabled ? "Enable account" : "Disable account"}
                            </button>
                            <div className="my-1 h-px bg-line" />
                            <button onClick={() => remove(u)} className={`${MENU_ITEM} text-danger hover:bg-danger-soft`}>
                              Delete account
                            </button>
                          </>
                        )}
                      </div>
                    </details>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </div>
  );
}

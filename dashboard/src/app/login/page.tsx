"use client";

import { useState } from "react";
import { Mark } from "@/components/Sidebar";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Login failed");
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="grid h-full place-items-center overflow-y-auto bg-bg p-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex items-center justify-center gap-2.5 text-accent">
          <Mark className="h-[20px]" />
          <span className="font-display text-[21px] font-bold text-ink">Wavelink</span>
        </div>
      <form onSubmit={submit} className="panel p-7 shadow-[var(--shadow-pop)]">
        <h1 className="font-display text-[24px] font-bold">Sign in</h1>
        <p className="mt-1 text-[14px] text-muted">Your WhatsApp and Notion, in one place.</p>
        <label className="mt-6 block text-[13px] font-medium">
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            className="mt-1.5 h-10 w-full rounded-[10px] border border-line bg-sunken px-3 text-[14px] font-normal outline-none transition-colors duration-150 focus:border-accent focus:bg-panel"
          />
        </label>
        <label className="mt-4 block text-[13px] font-medium">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="mt-1.5 h-10 w-full rounded-[10px] border border-line bg-sunken px-3 text-[14px] font-normal outline-none transition-colors duration-150 focus:border-accent focus:bg-panel"
          />
        </label>
        {error && <p className="mt-3 text-[12.5px] text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-6 h-11 w-full rounded-[10px] bg-accent text-[14.5px] font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-deep disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      </div>
    </main>
  );
}

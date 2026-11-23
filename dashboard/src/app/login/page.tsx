"use client";

import { useState } from "react";

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
    <main className="grid h-full place-items-center bg-bg p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-xl">
        <h1 className="text-[18px] font-semibold tracking-tight">Wavelink</h1>
        <p className="mt-1 text-[13px] text-muted">Sign in to continue.</p>
        <label className="mt-5 block text-[12.5px] font-medium">
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            className="mt-1 w-full rounded-lg border border-line bg-sunken px-3 py-2 text-[14px] font-normal outline-none focus:border-accent"
          />
        </label>
        <label className="mt-3 block text-[12.5px] font-medium">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-lg border border-line bg-sunken px-3 py-2 text-[14px] font-normal outline-none focus:border-accent"
          />
        </label>
        {error && <p className="mt-3 text-[12.5px] text-danger">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 h-10 w-full rounded-lg bg-accent text-[14px] font-medium text-accent-ink disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

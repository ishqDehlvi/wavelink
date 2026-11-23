import type { NextRequest } from "next/server";
import { type User, createSession, service, sessionCookie } from "@/lib/session";

// Simple per-IP throttle: 5 failed attempts per 10 minutes.
const failures = new Map<string, { n: number; until: number }>();
const WINDOW = 10 * 60_000;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const f = failures.get(ip);
  if (f && f.until > Date.now() && f.n >= 5) {
    return Response.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  const { username = "", password = "" } = await req.json().catch(() => ({}));
  let user: User | null = null;
  try {
    const res = await service("auth/login", { method: "POST", body: JSON.stringify({ username: String(username), password: String(password) }) });
    if (res.ok) user = ((await res.json()) as { user: User }).user;
    else if (res.status !== 401) return Response.json({ error: "Sign-in is unavailable right now." }, { status: 502 });
  } catch {
    return Response.json({ error: "The WhatsApp service is not running." }, { status: 502 });
  }
  if (!user) {
    const cur = f && f.until > Date.now() ? f : { n: 0, until: Date.now() + WINDOW };
    failures.set(ip, { n: cur.n + 1, until: cur.until });
    return Response.json({ error: "Wrong username or password." }, { status: 401 });
  }

  failures.delete(ip);
  const secure = req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";
  const res = Response.json({ ok: true, role: user.role });
  res.headers.append("set-cookie", sessionCookie(await createSession(user), secure));
  res.headers.append("set-cookie", "wa_view_as=; Path=/; SameSite=Lax; Max-Age=0");
  return res;
}

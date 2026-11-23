import type { NextRequest } from "next/server";
import { SESSION_COOKIE, type User, createSession, readSession, service, sessionCookie } from "@/lib/session";

// Change your own password. Signs out every other session and ChatGPT; this browser gets a fresh cookie.
export async function POST(req: NextRequest) {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return Response.json({ error: "Please log in" }, { status: 401 });
  const res = await service("me/password", { method: "POST", body: await req.text(), session }).catch(() => null);
  if (!res) return Response.json({ error: "The WhatsApp service is not running." }, { status: 502 });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return Response.json({ error: data.error || "Could not change the password." }, { status: res.status });
  const secure = req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";
  const out = Response.json({ ok: true });
  out.headers.append("set-cookie", sessionCookie(await createSession((data as { user: User }).user), secure));
  return out;
}

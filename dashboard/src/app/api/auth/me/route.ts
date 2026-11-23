import type { NextRequest } from "next/server";
import { SESSION_COOKIE, clearCookie, readSession, service } from "@/lib/session";

// The signed-in user, fresh from the WhatsApp service (so a new name or role shows up straight away).
export async function GET(req: NextRequest) {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return Response.json({ user: null }, { status: 401 });
  const res = await service("me", { session }).catch(() => null);
  if (!res) return Response.json({ error: "The WhatsApp service is not running." }, { status: 502 });
  if (res.status === 401) {
    const out = Response.json({ user: null }, { status: 401 });
    out.headers.append("set-cookie", clearCookie);
    return out;
  }
  return Response.json({ user: await res.json() });
}

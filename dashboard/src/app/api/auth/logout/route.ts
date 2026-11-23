import { clearCookie } from "@/lib/session";

export async function POST() {
  const res = Response.json({ ok: true });
  res.headers.append("set-cookie", clearCookie);
  res.headers.append("set-cookie", "wa_view_as=; Path=/; SameSite=Lax; Max-Age=0");
  return res;
}

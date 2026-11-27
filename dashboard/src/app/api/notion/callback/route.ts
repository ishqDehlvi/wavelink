import type { NextRequest } from "next/server";
import { SESSION_COOKIE, readSession, service } from "@/lib/session";

// Notion sends the superadmin back here after they pick pages. The service checks the state (made for this
// superadmin, under 15 minutes old), swaps the code for tokens and saves them encrypted.
export async function GET(req: NextRequest) {
  // relative redirects keep the browser on the host it used (behind a proxy, req.url may name another one)
  const go = (location: string) => new Response(null, { status: 303, headers: { location } });
  const back = (q: Record<string, string>) => go(`/notion?${new URLSearchParams(q)}`);
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return go("/login?next=/notion");
  const p = req.nextUrl.searchParams;
  if (p.get("error")) return back({ notion_error: p.get("error") === "access_denied" ? "You cancelled the Notion sign-in." : `Notion said: ${p.get("error")}` });
  const res = await service("notion/oauth/callback", {
    method: "POST",
    session,
    body: JSON.stringify({ code: p.get("code") ?? "", state: p.get("state") ?? "" }),
  }).catch(() => null);
  if (!res) return back({ notion_error: "The service is not running." });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return back({ notion_error: data.error || `Could not connect Notion (${res.status}).` });
  }
  return back({ connected: "1" });
}

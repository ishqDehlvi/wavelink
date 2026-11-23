import type { NextRequest } from "next/server";
import { SESSION_COOKIE, clearCookie, readSession, service } from "@/lib/session";
import { VIEW_COOKIE } from "@/lib/view";

// Server-side proxy to the WhatsApp service. The API key never reaches the browser, and every call is made
// as the signed-in user, so the service only ever opens that user's own WhatsApp workspace.
async function proxy(req: NextRequest, ctx: RouteContext<"/api/wa/[...path]">) {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return Response.json({ error: "Please log in" }, { status: 401 });
  const { path } = await ctx.params;
  const body = req.method !== "GET" && req.method !== "HEAD" ? await req.text() : null;
  // superadmin reading another account (read-only; the service enforces both the role and read-only)
  const search = new URLSearchParams(req.nextUrl.search);
  const viewAs = req.cookies.get(VIEW_COOKIE)?.value;
  if (session.r === "superadmin" && viewAs && /^[a-f0-9]{18}$/.test(viewAs) && viewAs !== session.uid) search.set("as", viewAs);
  const qs = search.toString();

  try {
    const upstream = await service(`${path.map(encodeURIComponent).join("/")}${qs ? `?${qs}` : ""}`, { method: req.method, body, session });
    const headers: Record<string, string> = {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      "cache-control": upstream.headers.get("cache-control") ?? "no-store",
    };
    for (const h of ["content-disposition", "content-security-policy", "x-content-type-options"]) {
      const v = upstream.headers.get(h);
      if (v) headers[h] = v;
    }
    const res = new Response(upstream.body, { status: upstream.status, headers });
    // account disabled, deleted or password reset → end this session
    if (upstream.status === 401) res.headers.append("set-cookie", clearCookie);
    return res;
  } catch {
    return Response.json({ error: "WhatsApp service is not running. Start it with `npm start` in service/." }, { status: 502 });
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/session";

// Everything except the login page, the auth endpoints and static assets needs a valid session.
// The admin and Notion access pages also need the superadmin role (the WhatsApp service checks it again on every admin call).
export async function proxy(request: NextRequest) {
  const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;
  if (session) {
    if ((pathname.startsWith("/admin") || pathname.startsWith("/notion/access")) && session.r !== "superadmin") {
      return NextResponse.redirect(new URL(pathname.startsWith("/notion") ? "/notion" : "/", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Please log in" }, { status: 401 });
  const login = new URL("/login", request.url);
  const next = pathname + request.nextUrl.search;
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};

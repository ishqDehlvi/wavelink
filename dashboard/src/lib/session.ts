// Signed session cookie (HMAC-SHA256 via Web Crypto, so it works in proxy and route handlers alike).
// It names one user. The WhatsApp service checks on every request that the user still exists, is enabled
// and that the session version matches, so a password reset or disable signs them out at once.

export const SESSION_COOKIE = "wa_session";
export const SESSION_DAYS = 7;

export type Role = "superadmin" | "user";
export type Session = { uid: string; u: string; r: Role; sv: number };
export type User = { id: string; username: string; name: string | null; role: Role; sessionVersion: number };

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("base64url");

async function key() {
  const secret = process.env.AUTH_SECRET || "";
  if (secret.length < 16) throw new Error("AUTH_SECRET must be set (at least 16 characters).");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSession(user: User) {
  const data: Session & { exp: number } = {
    uid: user.id,
    u: user.username,
    r: user.role,
    sv: user.sessionVersion,
    exp: Date.now() + SESSION_DAYS * 86400_000,
  };
  const payload = b64url(enc.encode(JSON.stringify(data)));
  const sig = await crypto.subtle.sign("HMAC", await key(), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

export async function readSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), Buffer.from(sig, "base64url"), enc.encode(payload));
    if (!ok) return null;
    const d = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof d.exp !== "number" || d.exp <= Date.now() || typeof d.uid !== "string") return null;
    return { uid: d.uid, u: String(d.u), r: d.r === "superadmin" ? "superadmin" : "user", sv: Number(d.sv) };
  } catch {
    return null;
  }
}

export function sessionCookie(value: string, secure: boolean) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? "; Secure" : ""}`;
}
export const clearCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

// ---------------------------------------------------------------- calls to the WhatsApp service (server side only)
const BASE = process.env.WA_API_URL ?? "http://127.0.0.1:3940";
const TOKEN = process.env.WA_API_TOKEN ?? "";

/** Call the WhatsApp service. With a session, the call acts as that user and nobody else. */
export function service(path: string, init: { method?: string; body?: BodyInit | null; session?: Session | null } = {}) {
  const headers: Record<string, string> = { "x-api-key": TOKEN, "content-type": "application/json" };
  if (init.session) {
    headers["x-user-id"] = init.session.uid;
    headers["x-session-version"] = String(init.session.sv);
  }
  return fetch(`${BASE}/api/${path}`, { method: init.method ?? "GET", headers, body: init.body, cache: "no-store" });
}

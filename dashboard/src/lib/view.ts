// Superadmin "view another account" mode. The cookie only names which account to read; the dashboard server passes it on
// for superadmins only, and the WhatsApp service checks the role again and allows reading, never sending.
export const VIEW_COOKIE = "wa_view_as";

export function getViewAs(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)wa_view_as=([a-f0-9]{18})(?:;|$)/);
  return m ? m[1] : null;
}

export function startViewing(userId: string) {
  document.cookie = `${VIEW_COOKIE}=${userId}; Path=/; SameSite=Lax; Max-Age=${4 * 3600}`;
}

export function stopViewing() {
  document.cookie = `${VIEW_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
}

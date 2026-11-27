"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutoMode = "on" | "off" | "default";
export type Priority = "high" | "normal" | "low";

export type Chat = {
  jid: string;
  name: string | null;
  number: string | null;
  isGroup: boolean;
  lastTs: number;
  last: { id: string; text: string; fromMe: boolean; media: string | null; auto: boolean };
  pending: number;
  autoReply: AutoMode;
  autoReplyActive: boolean;
  summary: { text: string; needsReply: boolean; priority: Priority } | null;
};

export type Msg = {
  id: string;
  chat: string;
  fromMe: boolean;
  ts: number;
  text: string | null;
  media: string | null;
  auto: boolean;
  from: string | null;
  /** AI transcript / description / extracted text of the attachment, once read */
  attachment: string | null;
  /** arrived (or was sent) as a WhatsApp forward */
  forwarded?: boolean;
};

export type Thread = {
  jid: string;
  name: string;
  isGroup: boolean;
  autoReply: AutoMode;
  autoReplyActive: boolean;
  messages: Msg[];
};

export type DigestItem = {
  jid: string;
  name: string;
  isGroup: boolean;
  lastTs: number;
  incoming: number;
  summary: string | null;
  needsReply: boolean;
  priority: Priority | null;
};

export type Status = {
  /** connected | waiting_for_scan | starting | reconnecting | qr_expired | logged_out | idle | error */
  status: string;
  qr: string | null;
  number: string | null;
  name: string | null;
  chats: number;
  messages: number;
  ai: string | null;
};

export type Overview = {
  today: { incoming: number; groupIncoming: number; sent: number; autoReplies: number; activeChats: number };
  waitingCount: number;
  waiting: { jid: string; name: string; pending: number; lastTs: number; last: string; media: string | null }[];
  hourly: number[];
  busiest: { jid: string; name: string; isGroup: boolean; count: number }[];
  autoReply: { mode: "off" | "allowlist" | "all" };
};

export type Brief = { text: string | null; items: number; generatedAt?: number };

export const chatHref = (jid: string) => `/inbox?chat=${encodeURIComponent(jid)}`;

export type AutoSettings = {
  mode: "off" | "allowlist" | "all";
  allow: string[];
  exclude: string[];
  pauseMinutes: number;
  instructions?: string;
  ai: boolean;
  onList?: { jid: string; name: string }[];
  offList?: { jid: string; name: string }[];
};

export type AutoReplyLog = {
  today: number;
  total: number;
  items: { id: string; jid: string; name: string; ts: number; reply: string | null; incoming: string[] }[];
};

export const enc = encodeURIComponent;

export type Me = {
  id: string;
  username: string;
  name: string | null;
  role: "superadmin" | "user";
  /** false for Notion-only accounts */
  whatsapp: boolean;
  notion: { connected: boolean; access: boolean };
};

export type AdminUser = {
  id: string;
  username: string;
  name: string | null;
  role: "superadmin" | "user";
  disabled: boolean;
  created: number;
  lastLogin: number | null;
  whatsapp: { status: string; linked: boolean; number: string | null; chats: number; messages: number } | null;
  whatsappEnabled: boolean;
  /** has any Notion page (superadmins always) */
  notion: boolean;
  chatgptConnections: number;
  lastViewedByAdmin: AdminAccess | null;
};

export type AdminAccess = { admin: string; via: "dashboard" | "chatgpt"; ts: number };

const toLogin = () => {
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }
};

// one request shared by the sidebar, the header and the page (kept for a few seconds)
let mePromise: Promise<Me | null> | null = null;
let meAt = 0;
function loadMe(): Promise<Me | null> {
  if (!mePromise || Date.now() - meAt > 5000) {
    meAt = Date.now();
    mePromise = fetch("/api/auth/me", { cache: "no-store" }).then(async (r) => {
      if (r.status === 401) {
        toLogin();
        return null;
      }
      const d = await r.json();
      return (d.user as Me) ?? null;
    });
    mePromise.catch(() => {
      mePromise = null;
    });
  }
  return mePromise;
}

/** The signed-in user (null while loading). */
export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let alive = true;
    loadMe()
      .then((u) => {
        if (alive && u) setMe(u);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return me;
}

export async function wa<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api/wa/${path}`, {
    method: init?.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    toLogin(); // signed out, password reset or account disabled
    throw new Error("Please log in");
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

export const mediaUrl = (m: Pick<Msg, "chat" | "id">) => `/api/wa/media/${enc(m.chat)}/${enc(m.id)}`;

/** Fetch now, then every `ms`. Waits for each request to finish before scheduling the next. */
export function usePoll<T>(fn: () => Promise<T>, ms: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const refresh = useCallback(async () => {
    try {
      setData(await fnRef.current());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      await refresh();
      if (alive) timer = setTimeout(tick, ms);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [ms, refresh]);

  return { data, error, refresh, setData };
}

export function timeLabel(ts: number) {
  const d = new Date(ts * 1000);
  const now = new Date();
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days === 0) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function dayLabel(ts: number) {
  const d = new Date(ts * 1000);
  const days = Math.floor((new Date(new Date().toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

export function ago(ts: number) {
  const s = Math.max(0, Date.now() / 1000 - ts);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const displayName = (c: { name: string | null; number?: string | null; jid: string }) =>
  c.name || (c.number ? `+${c.number}` : c.jid.split("@")[0]);

export const initials = (name: string) =>
  name
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "#";

export const mediaLabel: Record<string, string> = {
  image: "Photo",
  video: "Video",
  voice_note: "Voice note",
  audio: "Audio",
  document: "Document",
  sticker: "Sticker",
  location: "Location",
  contact: "Contact",
};

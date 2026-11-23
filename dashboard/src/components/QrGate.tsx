"use client";

import Link from "next/link";
import type { Me, Status } from "@/lib/wa";
import { logout } from "./AppHeader";

const WAITING: Record<string, string> = {
  starting: "Getting a QR code…",
  idle: "Getting a QR code…",
  qr_expired: "Getting a fresh QR code…",
  logged_out: "WhatsApp was unlinked from your phone. Getting a new QR code…",
  reconnecting: "Reconnecting to WhatsApp…",
  error: "Couldn't reach WhatsApp. Trying again…",
};

export default function QrGate({ status, me }: { status: Status; me: Me | null }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-bg/95 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 text-center shadow-xl">
        <h1 className="text-[17px] font-semibold">Link your WhatsApp</h1>
        {status.qr ? (
          <>
            <p className="mt-1 text-[13px] text-muted">On your phone: Settings → Linked devices → Link a device</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={status.qr} alt="WhatsApp QR code" className="mx-auto mt-4 aspect-square w-full max-w-[300px] rounded-lg bg-white p-2" />
            <p className="mt-3 text-[12px] text-faint">The code refreshes on its own every ~20 seconds.</p>
          </>
        ) : (
          <p className="mt-3 text-[13px] text-muted">{WAITING[status.status] ?? `${status.status.replace(/_/g, " ")}…`}</p>
        )}
        <p className="mt-4 text-[12px] text-faint">
          {me?.role === "superadmin"
            ? "Other users can't see your chats."
            : "Other users can't see your chats. Your organisation's admin can view them (read-only), and you can see when they did under Account."}
        </p>
        <div className="mt-4 flex items-center justify-center gap-4 border-t border-line pt-4 text-[13px]">
          {me && <span className="text-muted">Signed in as {me.username}</span>}
          {me?.role === "superadmin" && (
            <Link href="/admin" className="text-accent hover:underline">
              Manage users
            </Link>
          )}
          <button onClick={logout} className="text-muted hover:text-ink">
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

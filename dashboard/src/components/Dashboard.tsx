"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { type Chat, usePoll, wa } from "@/lib/wa";
import AppHeader from "./AppHeader";
import ChatList from "./ChatList";
import ChatView from "./ChatView";
import DigestPanel from "./DigestPanel";

export type Filter = "all" | "pending" | "people" | "groups";

export default function Dashboard() {
  const params = useSearchParams();
  const chats = usePoll(() => wa<Chat[]>("chats?limit=400"), 4000);
  const [selected, setSelected] = useState<string | null>(params.get("chat"));
  const [filter, setFilter] = useState<Filter>(params.get("filter") === "pending" ? "pending" : "all");
  const [query, setQuery] = useState("");
  const [digestOpen, setDigestOpen] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return (chats.data ?? []).filter((c) => {
      if (filter === "pending" && !(c.pending > 0 && !c.last.fromMe)) return false;
      if (filter === "people" && c.isGroup) return false;
      if (filter === "groups" && !c.isGroup) return false;
      if (!q) return true;
      return (c.name ?? "").toLowerCase().includes(q) || (digits.length > 2 && (c.number ?? "").includes(digits));
    });
  }, [chats.data, filter, query]);

  const open = (jid: string) => {
    setSelected(jid);
    setDigestOpen(false);
    window.history.replaceState(null, "", `/inbox?chat=${encodeURIComponent(jid)}`);
  };
  const close = () => {
    setSelected(null);
    window.history.replaceState(null, "", "/inbox");
  };

  return (
    <div className="flex h-full flex-col">
      <AppHeader active="inbox">
        <button
          onClick={() => setDigestOpen((v) => !v)}
          className="rounded-md border border-line px-2.5 py-1 text-[13px] text-ink hover:bg-sunken xl:hidden"
        >
          Summaries
        </button>
      </AppHeader>

      <main className="relative flex min-h-0 flex-1">
        <aside
          className={`${selected ? "hidden md:flex" : "flex"} w-full flex-col border-r border-line bg-panel md:w-[340px] md:shrink-0`}
        >
          <ChatList
            chats={visible}
            loading={!chats.data && !chats.error}
            selected={selected}
            onSelect={open}
            filter={filter}
            setFilter={setFilter}
            query={query}
            setQuery={setQuery}
          />
        </aside>

        <section className={`${selected ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
          {selected ? (
            <ChatView key={selected} jid={selected} onBack={close} onChanged={chats.refresh} />
          ) : (
            <div className="m-auto max-w-sm px-6 text-center">
              <p className="text-[15px] font-medium">Pick a chat</p>
              <p className="mt-1 text-[13px] text-muted">Or start from the summaries. They flag who is still waiting on a reply.</p>
            </div>
          )}
        </section>

        <aside
          className={`${digestOpen ? "absolute inset-y-0 right-0 z-20 flex w-full max-w-[400px] shadow-2xl" : "hidden"} flex-col border-l border-line bg-panel xl:static xl:flex xl:w-[380px] xl:shrink-0 xl:shadow-none`}
        >
          <DigestPanel onOpen={open} onClose={() => setDigestOpen(false)} />
        </aside>
      </main>
    </div>
  );
}

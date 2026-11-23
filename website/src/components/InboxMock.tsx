/** CSS-built mock of the dashboard inbox: chat list with "needs reply" badges and a chat view with an AI draft. */

const chats = [
  { name: "Priya", last: "Can you confirm by tonight?", time: "14:10", needs: 2, active: true },
  { name: "Sales group", last: "Sam: I can present on Friday", time: "13:52", group: true },
  { name: "Sam", last: "Voice note · 0:41", time: "12:30", needs: 1 },
  { name: "Mum", last: "Photo", time: "yesterday" },
  { name: "Landlord", last: "Thanks, received.", time: "Mon" },
];

export function InboxMock() {
  return (
    <div
      className="overflow-hidden rounded-xl border border-line bg-paper text-[12.5px]"
      role="img"
      aria-label="Dashboard inbox mock: a chat list with needs-reply badges beside a conversation with Priya, where an AI draft is ready to edit or send."
    >
      <div className="grid sm:grid-cols-[180px_1fr]">
        {/* chat list */}
        <div className="min-w-0 border-b border-line sm:border-r sm:border-b-0">
          <div className="flex items-center gap-1 border-b border-line px-3 py-2 font-mono text-[10.5px] text-muted">
            <span className="rounded bg-ink px-1.5 py-0.5 text-paper">All</span>
            <span className="px-1.5 py-0.5">Needs reply</span>
            <span className="px-1.5 py-0.5">People</span>
            <span className="hidden px-1.5 py-0.5 sm:inline">Groups</span>
          </div>
          <ul className="flex overflow-x-auto sm:block">
            {chats.map((c) => (
              <li
                key={c.name}
                className={`min-w-[140px] flex-1 shrink-0 border-r border-line px-3 py-2.5 last:border-r-0 sm:border-r-0 sm:border-b ${c.active ? "bg-surface" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-ink">
                    {c.group ? <span className="mr-1 text-muted">#</span> : null}
                    {c.name}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-muted">{c.time}</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-muted">{c.last}</span>
                  {c.needs ? (
                    <span className="shrink-0 rounded-full bg-accent px-1.5 font-mono text-[10px] font-semibold text-[#101311]">
                      {c.needs}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* chat view */}
        <div className="flex min-h-[300px] min-w-0 flex-col">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <div>
              <span className="font-medium text-ink">Priya</span>
              <span className="ml-2 font-mono text-[10.5px] text-muted">+91 ••• 4410</span>
            </div>
            <span className="chip" style={{ padding: "3px 6px" }}>auto-reply: off</span>
          </div>
          <div className="flex-1 space-y-2 px-3 py-3">
            <div className="max-w-[80%] rounded-lg rounded-tl-sm bg-surface px-2.5 py-1.5">
              Hi! Did the invoice from last week go through?
              <span className="ml-2 font-mono text-[10px] text-muted">11:02</span>
            </div>
            <div className="max-w-[80%] rounded-lg rounded-tl-sm bg-surface px-2.5 py-1.5">
              Can you confirm by tonight?
              <span className="ml-2 font-mono text-[10px] text-muted">14:10</span>
            </div>
            <div className="ml-auto max-w-[80%] rounded-lg rounded-tr-sm border border-dashed border-accent bg-accent-soft px-2.5 py-1.5">
              <span className="mb-0.5 block font-mono text-[10px] text-accent-ink">AI draft · your style</span>
              Sorry for the delay Priya, paying it tomorrow morning and will send the confirmation.
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-line px-3 py-2">
            <span className="flex-1 truncate rounded-md border border-line px-2.5 py-1.5 text-muted">Write a message or add a caption…</span>
            <span className="rounded-md border border-line-strong px-2 py-1.5 font-medium text-ink">AI draft</span>
            <span className="rounded-md bg-ink px-2.5 py-1.5 font-medium text-paper">Send</span>
          </div>
        </div>
      </div>
    </div>
  );
}

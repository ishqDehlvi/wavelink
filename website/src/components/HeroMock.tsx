/** A static AI-chat panel: the product as a ChatGPT or Claude user sees it. Markup only, one CSS cursor. */

function ToolChip({ name, args }: { name: string; args: string }) {
  return (
    <span className="chip chip-read">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden="true">
        <path d="M14 5l-4 14M6 9l-3 3 3 3M18 9l3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {name}
      <span className="text-muted">·</span>
      <span className="text-muted">{args}</span>
    </span>
  );
}

function User({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-surface-2 px-3.5 py-2 text-[13.5px] text-ink">{children}</p>
    </div>
  );
}

export function HeroMock() {
  return (
    <div
      className="w-full overflow-hidden rounded-xl border border-line bg-paper text-[13.5px] leading-[1.5]"
      role="img"
      aria-label="Example conversation: the user asks an AI assistant what they missed on WhatsApp today; the assistant calls whatsapp_brief and returns a briefing, then drafts a reply to Priya and asks for confirmation before sending."
    >
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2.5">
        <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink-2">
          <span className="inline-block h-2 w-2 rounded-full bg-accent" />
          Assistant
          <span className="text-muted">·</span>
          <span className="font-mono text-[11.5px] text-muted">wavelink connected</span>
        </div>
        <span className="font-mono text-[11px] text-muted">today 18:42</span>
      </div>

      <div className="space-y-4 px-4 py-4">
        <User>What did I miss on WhatsApp today?</User>

        <div className="space-y-2.5">
          <ToolChip name="whatsapp_brief" args="hours: 24" />
          <p className="text-ink-2">Three things need you. Everything else can wait.</p>
          <ol className="space-y-2">
            <li className="flex gap-2.5">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-[10.5px] text-ink">1</span>
              <p>
                <strong className="font-semibold text-ink">Priya</strong>{" "}
                <span className="chip ml-1 align-middle" style={{ padding: "2px 6px" }}>needs reply</span>
                <br />
                Asked twice when the invoice will be paid. Last message 14:10: &ldquo;Can you confirm by tonight?&rdquo;
              </p>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-[10.5px] text-ink">2</span>
              <p>
                <strong className="font-semibold text-ink">Sales group</strong> · 23 messages
                <br />
                Q4 targets agreed, deck due Friday. Sam volunteered to present; nobody is waiting on you.
              </p>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-[10.5px] text-ink">3</span>
              <p>
                <strong className="font-semibold text-ink">Sam</strong> · voice note, 0:41{" "}
                <span className="chip ml-1 align-middle" style={{ padding: "2px 6px" }}>transcribed</span>
                <br />
                &ldquo;Running late for the 5pm, can we push to half past? Also the venue moved to the Park Street office.&rdquo;
              </p>
            </li>
          </ol>
        </div>

        <User>Draft a reply to Priya saying I&rsquo;ll pay tomorrow</User>

        <div className="space-y-2.5">
          <ToolChip name="whatsapp_draft_reply" args="chat: Priya" />
          <div className="rounded-lg border border-line bg-surface px-3.5 py-3">
            <p className="mb-1 font-mono text-[11px] text-muted">To: Priya</p>
            <p className="text-ink">Hi Priya, sorry for the delay. The invoice will be paid tomorrow morning, I&rsquo;ll send you the confirmation once it goes through.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ink-2">Send this to Priya?</span>
            <span className="inline-flex h-7 items-center rounded-md bg-ink px-2.5 text-[12.5px] font-medium text-paper">Send</span>
            <span className="inline-flex h-7 items-center rounded-md border border-line-strong px-2.5 text-[12.5px] font-medium text-ink">Edit</span>
            <span className="cursor" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}

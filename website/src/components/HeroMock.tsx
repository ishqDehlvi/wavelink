/**
 * The product as a ChatGPT or Claude user sees it: an AI chat window with Wavelink connected.
 * Example content only. The answer arrives line by line (the page's one authored motion), then the cursor waits.
 */

function ToolChip({ name, args }: { name: string; args: string }) {
  return (
    <span className="chip chip-read">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden="true">
        <path d="M14 5l-4 14M6 9l-3 3 3 3M18 9l3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {name}
      <span className="opacity-60">· {args}</span>
    </span>
  );
}

function User({ children, i }: { children: React.ReactNode; i: number }) {
  return (
    <div className="arrive flex justify-end" style={{ "--i": i } as React.CSSProperties}>
      <p className="max-w-[80%] rounded-[18px] rounded-br-md bg-surface-2 px-4 py-2.5 text-ink">{children}</p>
    </div>
  );
}

function Item({ n, name, tag, children, i }: { n: number; name: string; tag?: string; children: React.ReactNode; i: number }) {
  return (
    <li className="arrive flex gap-3" style={{ "--i": i } as React.CSSProperties}>
      <span className="tabular mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-[12px] font-semibold text-ink-2">{n}</span>
      <p className="text-ink-2">
        <strong className="font-semibold text-ink">{name}</strong>
        {tag ? <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 align-[1px] text-[11.5px] font-semibold text-accent-ink">{tag}</span> : null}
        <br />
        {children}
      </p>
    </li>
  );
}

const sidebar = ["What did I miss today?", "Invoice follow-ups", "Supplier rates, March", "Team schedule"];

export function HeroMock() {
  return (
    <div
      className="frame overflow-hidden text-left text-[14.5px] leading-[1.55]"
      role="img"
      aria-label="Example: in an AI chat app, the user asks what they missed on WhatsApp today. The assistant uses Wavelink's whatsapp_brief tool and answers with three items: Priya needs a reply about an invoice, the Sales group agreed Q4 targets, and Sam's voice note is transcribed. Then it drafts a reply to Priya and asks before sending."
    >
      <div className="flex items-center gap-2 border-b border-line bg-field px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="mx-auto flex items-center gap-2 rounded-lg bg-paper px-3 py-1 text-[12.5px] text-muted shadow-[0_1px_2px_rgba(13,19,16,0.06)]">
          <span className="h-2 w-2 rounded-full bg-accent" />
          Wavelink connected
        </span>
        <span className="w-[52px]" aria-hidden="true" />
      </div>

      <div className="grid md:grid-cols-[210px_1fr]">
        <aside className="hidden border-r border-line bg-field/60 p-3 md:block" aria-hidden="true">
          <p className="px-2 pb-2 pt-1 text-[12px] font-semibold text-muted">Today</p>
          {sidebar.map((s, i) => (
            <p key={s} className={`truncate rounded-lg px-2 py-2 text-[13px] ${i === 0 ? "bg-paper font-medium text-ink shadow-[0_1px_2px_rgba(13,19,16,0.06)]" : "text-ink-2"}`}>
              {s}
            </p>
          ))}
        </aside>

        <div className="space-y-5 px-5 py-6 sm:px-8">
          <User i={0}>What did I miss on WhatsApp today?</User>

          <div className="space-y-3">
            <div className="arrive" style={{ "--i": 1 } as React.CSSProperties}>
              <ToolChip name="whatsapp_brief" args="last 24h" />
            </div>
            <p className="arrive text-ink" style={{ "--i": 1.5 } as React.CSSProperties}>
              Three things need you. Everything else can wait.
            </p>
            <ol className="space-y-3">
              <Item n={1} name="Priya" tag="needs reply" i={2}>
                Asked twice when the invoice will be paid. Last message 14:10: &ldquo;Can you confirm by tonight?&rdquo;
              </Item>
              <Item n={2} name="Sales group" i={2.6}>
                23 messages. Q4 targets agreed, deck due Friday. Nobody is waiting on you.
              </Item>
              <Item n={3} name="Sam" tag="voice note, transcribed" i={3.2}>
                &ldquo;Running late for the 5pm, can we push to half past? The venue moved to the Park Street office.&rdquo;
              </Item>
            </ol>
          </div>

          <User i={4}>Draft a reply to Priya: I&rsquo;ll pay tomorrow</User>

          <div className="arrive space-y-3" style={{ "--i": 5 } as React.CSSProperties}>
            <div className="rounded-2xl border border-line bg-field px-4 py-3.5">
              <p className="mb-1 text-[12px] font-semibold text-muted">To Priya, on WhatsApp</p>
              <p className="text-ink">Hi Priya, sorry for the delay. The invoice will be paid tomorrow morning; I&rsquo;ll send the confirmation once it goes through.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-ink-2">Send this to Priya?</span>
              <span className="inline-flex h-8 items-center rounded-lg bg-ink px-3 text-[13px] font-semibold text-paper">Send</span>
              <span className="inline-flex h-8 items-center rounded-lg border border-line-strong bg-paper px-3 text-[13px] font-semibold text-ink">Edit</span>
              <span className="cursor" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

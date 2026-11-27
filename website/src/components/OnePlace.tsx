import { CheckIcon } from "./Icons";

/**
 * "WhatsApp and Notion in one place": one request that answers on WhatsApp and updates Notion, and the per-page
 * access that decides who may do it. Example content only (made-up names), drawn in the site's own frame and chips.
 */

const points = [
  "Read, search and update Notion pages and databases from ChatGPT or Claude",
  "Read, edit, create, comment, archive: ticked per person, per page",
  "People who only need Notion never see a QR code",
];

function Source({ kind }: { kind: "whatsapp" | "notion" }) {
  return kind === "whatsapp" ? (
    <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 text-[12px] font-semibold text-accent-ink">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 5h16v11H8l-4 4z" />
      </svg>
      WhatsApp
    </span>
  ) : (
    <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 text-[12px] font-semibold text-ink">
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 3.5h7l4 4V20.5H7zM14 3.5v4h4M10 12h5M10 15.5h5" />
      </svg>
      Notion
    </span>
  );
}

const access = [
  { who: "Carol", role: "Sales", perms: ["Read", "Edit", "Create"] },
  { who: "Sam", role: "Accounts", perms: ["Read", "Comment"] },
  { who: "Erin", role: "Notion only", perms: ["Read"] },
];

export function OnePlace() {
  return (
    <div className="mt-14 grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
      <ul className="space-y-4 lg:pt-4">
        {points.map((p) => (
          <li key={p} className="flex gap-3 text-[16px] leading-relaxed text-ink-2">
            <CheckIcon className="mt-1 h-[18px] w-[18px] shrink-0 text-accent-ink" />
            {p}
          </li>
        ))}
      </ul>

      <div className="space-y-4" aria-hidden="true">
        <div className="frame p-5 sm:p-6">
          <p className="ml-auto max-w-[88%] rounded-[18px] rounded-br-md bg-ink px-4 py-3 text-[14.5px] leading-snug text-paper sm:max-w-[78%]">
            Priya says the November invoice is paid. Mark Acme Traders as Paid in Clients and thank her.
          </p>
          <div className="mt-4 rounded-[18px] rounded-bl-md border border-line bg-field p-4 sm:p-5">
            <p className="text-[14.5px] leading-relaxed text-ink">Done. Here&rsquo;s what I did, both after you said OK:</p>
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-paper">
              <li className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-3">
                <Source kind="whatsapp" />
                <span className="col-span-3 row-start-2 min-w-0 text-[14px] text-ink-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                  Replied to <b className="font-semibold text-ink">Priya</b>: &ldquo;Received, thank you Priya!&rdquo;
                </span>
                <span className="chip chip-read col-start-3 row-start-1">sent</span>
              </li>
              <li className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-3">
                <Source kind="notion" />
                <span className="col-span-3 row-start-2 min-w-0 text-[14px] text-ink-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                  Clients › <b className="font-semibold text-ink">Acme Traders</b> · Status{" "}
                  <s className="text-muted">Unpaid</s> → <b className="font-semibold text-accent-ink">Paid</b>
                </span>
                <span className="chip chip-write col-start-3 row-start-1">updated</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="tile p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[15px] font-semibold text-ink">Who can touch &ldquo;Clients&rdquo;</p>
            <p className="text-[13px] text-muted">Set by the superadmin, page by page</p>
          </div>
          <ul className="mt-4 space-y-2.5">
            {access.map((a) => (
              <li key={a.who} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-semibold text-paper">{a.who[0]}</span>
                <span className="w-[8.5rem] shrink-0 text-[14px]">
                  <span className="font-semibold text-ink">{a.who}</span> <span className="text-muted">· {a.role}</span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {a.perms.map((p) => (
                    <span key={p} className={`chip ${p === "Read" ? "chip-read" : "chip-write"}`}>
                      {p.toLowerCase()}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

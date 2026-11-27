/**
 * "Up and running in three steps": each step shows its real moment, in the same paper-and-sticker world as the film.
 * Decorative visuals are aria-hidden; the step titles and text carry the meaning. Ambient loops stop under reduced motion.
 */

function ScanVisual() {
  return (
    <div className="step-stage" aria-hidden="true">
      <div className="step-phone">
        <div className="step-phone-screen">
          <div className="step-qr">
            {/* A real code: scan it with your phone camera to open the site. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
            <img src="/qr/site.svg" alt="" width={116} height={116} />
            <span className="step-scanline" />
          </div>
          <p className="step-phone-cap">Scan with your camera</p>
        </div>
      </div>
      <span className="step-chip step-chip-linked">
        <span className="step-dot" /> Linked
      </span>
    </div>
  );
}

function ConnectVisual() {
  return (
    <div className="step-stage" aria-hidden="true">
      <div className="step-connect">
        <div className="step-url">
          <span className="font-mono">https://wa.yourco.com/mcp</span>
          <span className="step-copy">Copy</span>
        </div>
        <svg className="step-wires" viewBox="0 0 240 60" preserveAspectRatio="none">
          <path d="M60 4 C60 34 120 26 120 56" />
          <path d="M180 4 C180 34 120 26 120 56" />
        </svg>
        <div className="step-apps">
          {/* eslint-disable @next/next/no-img-element -- tiny static SVG marks */}
          <span className="step-app"><img src="/logos/chatgpt.svg" alt="" width={22} height={22} />ChatGPT</span>
          <span className="step-app"><img src="/logos/claude.svg" alt="" width={22} height={22} />Claude</span>
          {/* eslint-enable @next/next/no-img-element */}
        </div>
        <span className="step-chip step-chip-on">
          <span className="step-toggle"><i /></span> Connected
        </span>
      </div>
    </div>
  );
}

function AskVisual() {
  return (
    <div className="step-stage" aria-hidden="true">
      <div className="step-chat">
        <p className="step-q">What did I miss today?</p>
        <div className="step-a">
          <p className="step-a-row"><span className="step-flag" /> <b>Priya</b> · ₹48,400 overdue</p>
          <p className="step-a-row"><span className="step-flag step-flag-2" /> <b>Sam</b> · voice note: 5:30, new venue</p>
          <p className="step-a-row step-a-muted"><span className="step-flag step-flag-3" /> Sales team · can wait</p>
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative sticker */}
      <img className="step-sticker" src="/stickers/voice.webp" alt="" width={92} />
    </div>
  );
}

const STEPS = [
  {
    title: "Scan once",
    text: "Open the dashboard and scan the QR code from WhatsApp → Linked devices, the same way you'd use WhatsApp Web. Your chats start syncing in a minute.",
    Visual: ScanVisual,
  },
  {
    title: "Connect your AI app",
    text: "Add one connector URL in ChatGPT or Claude and sign in with your own Wavelink login. Each person only ever reaches their own WhatsApp, and the Notion pages shared with them.",
    Visual: ConnectVisual,
  },
  {
    title: "Just ask",
    text: "“What did I miss?”, “Who's waiting on me?”, “Add this order to Clients.” The AI reads, drafts, sends and updates Notion, and always shows you first.",
    Visual: AskVisual,
  },
];

export function Steps() {
  return (
    <ol className="steps mt-14 grid gap-5 md:grid-cols-3">
      {STEPS.map(({ title, text, Visual }, i) => (
        <li key={title} className="step tile flex flex-col overflow-hidden">
          <Visual />
          <div className="flex flex-1 flex-col p-6 pt-5 sm:p-7 sm:pt-6">
            <span className="step-num font-display" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-1 text-[21px] font-semibold tracking-tight text-ink">
              <span className="sr-only">Step {i + 1}: </span>
              {title}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

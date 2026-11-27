import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HeroVideo } from "@/components/HeroVideo";
import { HeroStickers } from "@/components/HeroStickers";
import { Steps } from "@/components/Steps";
import { InboxMock } from "@/components/InboxMock";
import { Bento } from "@/components/Bento";
import { CodeBlock } from "@/components/CodeBlock";
import { PromptChips } from "@/components/PromptChips";
import { OnePlace } from "@/components/OnePlace";
import {
  ArrowIcon,
  CheckIcon,
  GitHubIcon,
  HandshakeIcon,
  MinusIcon,
  ServerIcon,
} from "@/components/Icons";
import { site } from "@/lib/site";
import { abs, ids, ldHtml } from "@/lib/seo";
import { faq, guarantees, notProtected, platforms, prompts, toolCount, toolGroups } from "@/content/landing";

// Official marks: OpenAI, Claude, Claude Code, Cursor, Windsurf from LobeHub Icons (MIT), Zed from Simple Icons (CC0),
// VS Code from Microsoft's icon pack (code.visualstudio.com/brand). Shown unaltered, in their own colours.
const worksWith = [
  { name: "ChatGPT", logo: "chatgpt" },
  { name: "Claude", logo: "claude" },
  { name: "Claude Code", logo: "claude-code" },
  { name: "Cursor", logo: "cursor" },
  { name: "VS Code", logo: "vscode" },
  { name: "Windsurf", logo: "windsurf" },
  { name: "Zed", logo: "zed" },
];

function Heading({ title, lede, center = false }: { title: React.ReactNode; lede?: React.ReactNode; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <h2 className="font-display text-balance text-[34px] font-bold leading-[1.04] text-ink md:text-[48px]">{title}</h2>
      {lede ? <p className={`mt-4 text-pretty text-[17px] leading-relaxed text-muted md:text-[18px] ${center ? "mx-auto" : ""} max-w-[60ch]`}>{lede}</p> : null}
    </div>
  );
}

// Structured data for the home page: the app, its source code, the hero film and the FAQ, linked by @id
// to the Organization / Person / WebSite graph that the root layout puts on every page.
const homeLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": ids.app,
      name: site.name,
      alternateName: ["Wavelink WhatsApp MCP server", "WhatsApp MCP plugin"],
      description: site.description,
      url: abs("/"),
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "AI assistant integration (Model Context Protocol server)",
      operatingSystem: "Linux, macOS, Windows (Docker)",
      softwareRequirements: "Node.js 24 or Docker; a WhatsApp account on your phone",
      license: "https://opensource.org/licenses/MIT",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock" },
      featureList: [
        "Use WhatsApp and Notion inside ChatGPT, Claude, Claude Code, Cursor, VS Code, Windsurf and Zed over MCP",
        "Team Notion access set per person and per page: read, edit, create, comment, archive",
        "Daily brief: who is waiting on you, what is overdue, what can wait",
        "Voice note transcription with English translation (Hindi and Hinglish supported)",
        "Reads photos, PDFs, Word and Excel attachments",
        "Drafts replies in your style; nothing is sent without your approval",
        "Forward many messages at once",
        "Web dashboard with inbox, summaries and auto-replies you control",
        "Multi-user accounts with OAuth sign-in for each person's own WhatsApp",
        "Self-hosted: your chats stay on your server",
      ],
      screenshot: abs("/video/wavelink-ad-poster.jpg"),
      image: abs(site.logo),
      video: { "@id": ids.film },
      installUrl: abs("/docs/quickstart"),
      downloadUrl: site.github,
      softwareHelp: { "@type": "CreativeWork", url: abs("/docs") },
      keywords: site.keywords.join(", "),
      author: { "@id": ids.author },
      publisher: { "@id": ids.org },
      sameAs: [site.github, site.hackerNews],
    },
    {
      "@type": "SoftwareSourceCode",
      "@id": ids.source,
      name: "wavelink",
      description: "Source code for Wavelink, the open-source WhatsApp MCP server and dashboard.",
      codeRepository: site.github,
      programmingLanguage: ["JavaScript", "TypeScript"],
      runtimePlatform: "Node.js",
      license: "https://opensource.org/licenses/MIT",
      targetProduct: { "@id": ids.app },
      author: { "@id": ids.author },
    },
    {
      "@type": "VideoObject",
      "@id": ids.film,
      name: "Wavelink in 25 seconds",
      description:
        "47 unread WhatsApp chats, one question to the AI, a brief of what matters, a Hinglish voice note turned into English, and a reply sent only after you approve it.",
      thumbnailUrl: [abs("/video/wavelink-ad-poster.jpg")],
      uploadDate: "2026-11-26T12:00:00+05:30",
      duration: "PT25S",
      contentUrl: abs("/video/wavelink-ad.mp4"),
      embedUrl: abs("/"),
      inLanguage: "en",
      publisher: { "@id": ids.org },
    },
    {
      "@type": "WebPage",
      "@id": abs("/#webpage"),
      url: abs("/"),
      name: `${site.name} · ${site.tagline}`,
      description: site.description,
      isPartOf: { "@id": ids.website },
      about: { "@id": ids.app },
      primaryImageOfPage: abs("/video/wavelink-ad-poster.jpg"),
      video: { "@id": ids.film },
      inLanguage: "en",
    },
    {
      "@type": "FAQPage",
      "@id": abs("/#faq"),
      isPartOf: { "@id": abs("/#webpage") },
      mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ],
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={ldHtml(homeLd)} />
      <Header />
      <main id="top">
        {/* ---------- hero ---------- */}
        <section className="hero-field relative overflow-hidden">
          <div className="container-x relative pb-6 pt-16 text-center md:pt-24">
            <HeroStickers />
            <a
              href="#one-place"
              className="nudge inline-flex items-center gap-2 rounded-full border border-line bg-paper py-1 pl-1 pr-3 text-[13px] text-ink-2 no-underline shadow-[0_1px_2px_rgba(13,19,16,0.05)] transition-colors hover:border-line-strong"
            >
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[12px] font-semibold text-accent-ink">New</span>
              Notion, shared page by page
              <ArrowIcon className="h-3.5 w-3.5" />
            </a>
            <h1 className="font-display mx-auto mt-7 max-w-[17ch] text-balance text-[44px] font-bold leading-[0.98] text-ink sm:text-[62px] md:text-[76px]">
              Your WhatsApp and Notion, inside ChatGPT and Claude.
            </h1>
            <p className="mx-auto mt-6 max-w-[58ch] text-pretty text-[18px] leading-relaxed text-muted md:text-[20px]">
              Ask the AI you already use what you missed, who&rsquo;s waiting on you, or what that voice note said, then have it update the Notion page it belongs in. It drafts, sends and edits for you, and shows you everything first.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href={site.setup} target="_blank" rel="noreferrer" className="btn w-full sm:w-auto">
                <HandshakeIcon className="h-[18px] w-[18px]" />
                Set it up for me
              </a>
              <a href="#get-started" className="btn btn-ghost w-full sm:w-auto">
                <ServerIcon className="h-[18px] w-[18px]" />
                Host it yourself
              </a>
            </div>
            <p className="mt-4 text-[13.5px] text-muted">Free and open source · runs on your own server · your chats and pages stay yours</p>
          </div>

          <div className="container-x relative pb-4">
            <div className="mx-auto max-w-[1040px]">
              <HeroVideo />
            </div>
          </div>
        </section>

        {/* ---------- works with ---------- */}
        <section aria-label="Works with" className="container-x py-12">
          <p className="text-center text-[14px] text-muted">Works with the AI apps you already use</p>
          <ul className="mx-auto mt-6 flex max-w-5xl flex-wrap items-center justify-center logo-strip">
            {worksWith.map((w) => (
              <li key={w.name} className="logo-item flex cursor-default items-center" title={w.name}>
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG marks */}
                <img src={`/logos/${w.logo}.svg`} alt={w.name} width={40} height={40} className="h-10 w-10" />
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- whatsapp + notion ---------- */}
        <section id="one-place" className="scroll-mt-20 border-t border-line">
          <div className="container-x py-24 md:py-28">
            <Heading
              title="WhatsApp and Notion, finally in one place."
              lede="The customer is on WhatsApp. The order sheet is in Notion. Ask once and the AI reads both, replies on one and updates the other, and you decide, page by page, what each person on your team can touch."
            />
            <OnePlace />
          </div>
        </section>

        {/* ---------- features ---------- */}
        <section id="features" className="scroll-mt-20 border-t border-line bg-field">
          <div className="container-x py-24 md:py-28">
            <Heading
              title="Everything in your WhatsApp, finally readable by AI."
              lede="Messages, voice notes, photos of bills, PDFs and spreadsheets all become something ChatGPT and Claude can understand, search and act on."
            />
            <div className="mt-12">
              <Bento />
            </div>
          </div>
        </section>

        {/* ---------- ask ---------- */}
        <section className="container-x py-24 md:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
            <Heading
              title="Ask like you'd ask an assistant."
              lede="No commands to learn. Type the question in ChatGPT or Claude, in English or Hinglish, and Wavelink gives it the right chats, files and Notion pages."
            />
            <PromptChips prompts={prompts} />
          </div>
        </section>

        {/* ---------- how it works ---------- */}
        <section id="how" className="scroll-mt-20 border-t border-line">
          <div className="container-x py-24 md:py-28">
            <Heading center title="Up and running in three steps." lede="Link your phone, connect your AI app, start asking. Notion is one click for the superadmin. That's the whole setup." />
            <Steps />
          </div>
        </section>

        {/* ---------- dashboard ---------- */}
        <section id="dashboard" className="scroll-mt-20 border-t border-line bg-field">
          <div className="container-x py-24 md:py-28">
            <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
              <Heading
                title="A dashboard for when you'd rather click."
                lede="Everything also works in the browser: a home for your day, an inbox that flags who needs a reply, your Notion pages next to your chats, AI drafts in your own style and auto-replies you control."
              />
              <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {["Inbox with “needs reply” flags", "Daily AI brief and summaries", "Notion pages next to your chats", "Who can see which page, ticked per person", "Forward many messages at once", "English button for what you type", "Auto-reply you switch per chat", "A login for each person"].map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-[15px] text-ink-2">
                    <CheckIcon className="h-[18px] w-[18px] shrink-0 text-accent-ink" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="frame mx-auto mt-12 max-w-[1040px] overflow-hidden">
              <InboxMock />
            </div>
          </div>
        </section>

        {/* ---------- two paths ---------- */}
        <section id="get-started" className="scroll-mt-20">
          <div className="container-x py-24 md:py-28">
            <Heading center title="Two ways to get Wavelink." lede="Have it set up for you, or run it yourself. It's the same open-source product either way." />
            <div className="mt-14 grid gap-4 lg:grid-cols-2">
              <article className="tile flex min-w-0 flex-col bg-ink p-7 text-paper sm:p-9" style={{ background: "var(--ink)", borderColor: "var(--ink)" }}>
                <HandshakeIcon className="h-7 w-7 text-accent" />
                <h3 className="font-display mt-5 text-[30px] font-bold leading-tight">Set it up for me</h3>
                <p className="mt-3 max-w-[48ch] text-[16px] leading-relaxed text-[#c9d0cb]">
                  {site.author.name}, who builds Wavelink, sets it up for your business: your server and domain, every WhatsApp linked, ChatGPT or Claude connected, and a login for each person on your team.
                </p>
                <ul className="mt-6 space-y-2.5 text-[15px] text-[#e4e8e2]">
                  {["No server or code knowledge needed", "Your data stays on a server you own", "Help linking each number and connecting AI apps"].map((t) => (
                    <li key={t} className="flex gap-2.5">
                      <CheckIcon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-accent" />
                      {t}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-9">
                  <a href={site.setup} target="_blank" rel="noreferrer" className="btn btn-green nudge">
                    Talk to {site.author.name.split(" ")[0]}
                    <ArrowIcon className="h-4 w-4" />
                  </a>
                </div>
              </article>

              <article className="tile flex min-w-0 flex-col p-7 sm:p-9">
                <ServerIcon className="h-7 w-7 text-accent-ink" />
                <h3 className="font-display mt-5 text-[30px] font-bold leading-tight text-ink">Host it yourself</h3>
                <p className="mt-3 max-w-[48ch] text-[16px] leading-relaxed text-muted">
                  Free and MIT licensed. Three commands with Docker Compose bring up the service, the dashboard and HTTPS.
                </p>
                <CodeBlock
                  className="mt-6"
                  lang="bash"
                  lines={[
                    { prompt: true, text: "git clone https://github.com/ishqDehlvi/wavelink.git && cd wavelink" },
                    { prompt: true, text: "cp .env.example .env", comment: "set MCP_TOKEN, AUTH_SECRET, GEMINI_API_KEY" },
                    { prompt: true, text: "docker compose up -d" },
                  ]}
                />
                <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-[14px] sm:grid-cols-3">
                  {platforms.map((p) => (
                    <li key={p.name}>
                      <Link href={p.href} className="text-ink-2 underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-ink">
                        {p.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex flex-wrap gap-3 pt-9">
                  <Link href="/docs/quickstart" className="btn nudge">
                    Read the quick start
                    <ArrowIcon className="h-4 w-4" />
                  </Link>
                  <a href={site.github} target="_blank" rel="noreferrer" className="btn btn-ghost">
                    <GitHubIcon className="h-[18px] w-[18px]" />
                    GitHub
                  </a>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ---------- security ---------- */}
        <section id="security" className="scroll-mt-20 border-t border-line bg-field">
          <div className="container-x py-24 md:py-28">
            <Heading
              title="Built so your chats stay yours."
              lede="Wavelink runs on your server. These protections are checked by an automated test suite on every change, and we're upfront about what it doesn't do."
            />
            <div className="mt-12 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
              <div className="tile p-6 sm:p-8">
                <h3 className="text-[17px] font-semibold text-ink">What&rsquo;s protected</h3>
                <ul className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  {guarantees.slice(0, 6).map((g) => (
                    <li key={g.title} className="flex gap-3">
                      <CheckIcon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-accent-ink" />
                      <div>
                        <p className="text-[15px] font-semibold text-ink">{g.title}</p>
                        <p className="mt-1 text-[14px] leading-relaxed text-muted">{g.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[20px] border border-line bg-paper/60 p-6 sm:p-8">
                <h3 className="text-[17px] font-semibold text-ink">What it doesn&rsquo;t do</h3>
                <ul className="mt-5 space-y-5">
                  {notProtected.map((g) => (
                    <li key={g.title} className="flex gap-3">
                      <MinusIcon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-warn" />
                      <div>
                        <p className="text-[15px] font-semibold text-ink">{g.title}</p>
                        <p className="mt-1 text-[14px] leading-relaxed text-muted">{g.text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link href="/docs/security" className="nudge mt-6 inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent-ink no-underline hover:underline">
                  Read the security model <ArrowIcon className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- tools ---------- */}
        <section id="tools" className="scroll-mt-20">
          <div className="container-x py-24 md:py-28">
            <Heading
              title={<>{toolCount} tools behind one connector URL.</>}
              lede="For the curious: this is what ChatGPT and Claude can call. Reading tools are marked read-only; anything that sends asks you first."
            />
            <div className="mt-12 grid gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
              {toolGroups.map((g) => (
                <div key={g.title}>
                  <h3 className="text-[15px] font-semibold text-ink">{g.title}</h3>
                  <ul className="mt-3 divide-y divide-line border-y border-line">
                    {g.tools.map((t) => (
                      <li key={t.name} className="py-3">
                        <div className="flex items-center justify-between gap-3">
                          <code className="truncate font-mono text-[13px] text-ink">{t.name}</code>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${t.kind === "read" ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-ink-2"}`}>
                            {t.kind === "read" ? "reads" : "acts"}
                          </span>
                        </div>
                        <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{t.purpose}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- faq ---------- */}
        <section id="faq" className="scroll-mt-20 border-t border-line bg-field">
          <div className="container-x grid gap-12 py-24 md:py-28 lg:grid-cols-[0.8fr_1.2fr]">
            <Heading title="Questions people ask first." lede="Anything else, open an issue on GitHub or ask for a setup call." />
            <div className="divide-y divide-line rounded-[20px] border border-line bg-paper">
              {faq.map((f) => (
                <details key={f.q} className="group px-6 py-5">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 text-[16px] font-semibold text-ink">
                    {f.q}
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-transform duration-200 group-open:rotate-45">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                  </summary>
                  <p className="mt-3 max-w-[68ch] text-[15px] leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- close ---------- */}
        <section className="container-x py-24 md:py-28">
          <div className="relative overflow-hidden rounded-[28px] border border-accent/25 bg-accent-soft px-6 py-16 text-center sm:px-12 md:py-20">
            <h2 className="font-display mx-auto max-w-[18ch] text-balance text-[36px] font-bold leading-[1.02] text-accent-deep md:text-[56px]">
              Let the AI you already use handle your WhatsApp and Notion.
            </h2>
            <p className="mx-auto mt-5 max-w-[52ch] text-[17px] leading-relaxed text-accent-deep/80">
              You stay in charge of every message and every page. Pick the path that suits you.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href={site.setup} target="_blank" rel="noreferrer" className="btn w-full sm:w-auto">
                <HandshakeIcon className="h-[18px] w-[18px]" />
                Set it up for me
              </a>
              <a href="#get-started" className="btn btn-ghost w-full sm:w-auto">
                <ServerIcon className="h-[18px] w-[18px]" />
                Host it yourself
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

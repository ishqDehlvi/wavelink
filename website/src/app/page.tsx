import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { WaveRule } from "@/components/WaveRule";
import { HeroMock } from "@/components/HeroMock";
import { InboxMock } from "@/components/InboxMock";
import { CodeBlock } from "@/components/CodeBlock";
import { ArrowIcon, CheckIcon, GitHubIcon, MinusIcon } from "@/components/Icons";
import { site } from "@/lib/site";
import {
  dashboardPages,
  faq,
  guarantees,
  notProtected,
  platforms,
  prompts,
  toolCount,
  toolGroups,
} from "@/content/landing";

function Section({
  id,
  eyebrow,
  title,
  lede,
  children,
  rule = true,
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  children: React.ReactNode;
  rule?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      {rule ? (
        <div className="container-x">
          <WaveRule id={`wave-${id}`} />
        </div>
      ) : null}
      <div className="container-x py-16 md:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="font-display mt-3 text-[32px] font-bold leading-[1.05] md:text-[44px]">{title}</h2>
          {lede ? <p className="mt-4 text-[17px] leading-relaxed text-muted">{lede}</p> : null}
        </div>
        <div className="mt-10 md:mt-14">{children}</div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* ---------- Hero ---------- */}
        <section className="container-x grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div className="max-w-xl">
            <p className="eyebrow">Open source · self-hosted · MCP server</p>
            <h1 className="font-display mt-4 text-[44px] font-bold leading-[0.98] sm:text-[56px] md:text-[68px]">
              Your WhatsApp,
              <br />
              inside ChatGPT
              <br />
              and Claude.
            </h1>
            <p className="mt-6 text-[17px] leading-relaxed text-muted md:text-[18px]">
              Link your phone once, like WhatsApp Web. Then catch up on chats, hear voice notes, draft replies and
              send messages from any AI app, with the exact text and recipient shown before anything goes out.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/docs/quickstart" className="btn">
                Get started
                <ArrowIcon className="h-4 w-4" />
              </Link>
              <a href={site.github} className="btn btn-ghost" target="_blank" rel="noreferrer">
                <GitHubIcon className="h-4 w-4" />
                View on GitHub
              </a>
            </div>
            <p className="mt-6 font-mono text-[12px] text-muted">
              MIT · Node 24 · runs on your own server · messages never pass through a third party except the AI you connect
            </p>
          </div>
          <div className="min-w-0">
            <HeroMock />
          </div>
        </section>

        {/* ---------- Works with ---------- */}
        <div className="border-y border-line bg-surface">
          <div className="container-x flex flex-wrap items-center gap-x-8 gap-y-3 py-5 text-[14px]">
            <span className="eyebrow">Works with</span>
            {["ChatGPT", "Claude", "Claude Code", "Cursor", "any MCP client"].map((n) => (
              <span key={n} className="font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">
                {n}
              </span>
            ))}
          </div>
        </div>

        {/* ---------- Quick start ---------- */}
        <Section
          id="quickstart"
          eyebrow="Quick start"
          title={
            <>
              <span className="numeral mr-3 align-baseline text-accent-ink">3</span>commands to a linked phone.
            </>
          }
          lede="Docker Compose brings up the service, the dashboard and automatic HTTPS. Ten minutes, start to QR code."
          rule={false}
        >
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
            <CodeBlock
              lang="bash"
              lines={[
                { prompt: true, text: "git clone https://github.com/ishqDehlvi/wavelink.git && cd wavelink" },
                { prompt: true, text: "cp .env.example .env", comment: "set MCP_TOKEN, AUTH_SECRET and GEMINI_API_KEY" },
                { prompt: true, text: "docker compose up -d" },
              ]}
            />
            <ol className="space-y-6">
              {[
                ["Clone and configure", "Copy .env.example and set three values: MCP_TOKEN, AUTH_SECRET and your Gemini API key from Google AI Studio."],
                ["Start it", "docker compose up -d starts the service, the dashboard and Caddy. The generated admin password is at /data/initial-admin-password.txt inside the service container."],
                ["Scan the QR code", "Open localhost:3100, sign in as admin, and scan with WhatsApp → Linked devices. Chats start syncing within a minute."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="font-display mt-0.5 text-[28px] font-bold leading-none text-accent-ink">{i + 1}</span>
                  <div>
                    <p className="font-semibold text-ink">{t}</p>
                    <p className="mt-1 text-[15px] text-muted">{d}</p>
                  </div>
                </li>
              ))}
              <li className="pl-10 text-[14px] text-muted">
                No Docker?{" "}
                <Link href="/docs/quickstart" className="text-accent-ink underline">
                  Run it with Node 24 instead
                </Link>
                .
              </li>
            </ol>
          </div>
        </Section>

        {/* ---------- Ask anything ---------- */}
        <Section
          id="ask"
          eyebrow="Ask anything"
          title="Plain language in. Exact text and recipient out."
          lede="Every session starts with instructions from Wavelink: whose WhatsApp it is, how attachments work, and the rule to show the message before sending. So it behaves the same in every client."
        >
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {prompts.map((p) => (
              <li key={p} className="rounded-lg border border-line p-4 text-[15px] leading-snug text-ink">
                <span className="mr-1.5 font-mono text-accent-ink">&gt;</span>
                {p}
              </li>
            ))}
          </ul>
        </Section>

        {/* ---------- Tools ---------- */}
        <Section
          id="tools"
          eyebrow="MCP tools"
          title={
            <>
              <span className="numeral mr-3 align-baseline text-accent-ink">{toolCount}</span>tools, one connector URL.
            </>
          }
          lede="Streamable HTTP with OAuth 2.1. Read tools carry readOnlyHint; write tools never run without the model showing you what it is about to send."
        >
          <div className="mb-6 flex flex-wrap gap-4 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="chip chip-read">read</span> read-only</span>
            <span className="inline-flex items-center gap-1.5"><span className="chip chip-write">write</span> sends, saves or changes settings</span>
          </div>
          <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
            {toolGroups.map((g) => (
              <div key={g.title}>
                <h3 className="font-display mb-3 border-b border-line pb-2 text-[18px] font-semibold">{g.title}</h3>
                <ul className="space-y-3">
                  {g.tools.map((t) => (
                    <li key={t.name} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                      <code className="font-mono text-[13px] text-ink">{t.name}</code>
                      <span className={`chip justify-self-start ${t.kind === "read" ? "chip-read" : "chip-write"}`}>
                        {t.kind}
                      </span>
                      <p className="col-span-2 text-[14px] leading-snug text-muted">{t.purpose}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-8 text-[14px] text-muted">
            Parameters and return values:{" "}
            <Link href="/docs/mcp-tools" className="text-accent-ink underline">
              MCP tools reference
            </Link>
            .
          </p>
        </Section>

        {/* ---------- Dashboard ---------- */}
        <Section
          id="dashboard"
          eyebrow="Dashboard"
          title="An inbox that knows who is waiting on you."
          lede="A Next.js dashboard that never holds secrets in the browser. Every request goes through the service, which enforces who may see what."
        >
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
            <ul className="space-y-5">
              {dashboardPages.map((p) => (
                <li key={p.name} className="grid grid-cols-[96px_1fr] gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
                  <span className="font-display text-[16px] font-semibold text-ink">{p.name}</span>
                  <p className="text-[14.5px] leading-relaxed text-muted">{p.text}</p>
                </li>
              ))}
            </ul>
            <div className="min-w-0 lg:sticky lg:top-20">
              <InboxMock />
              <p className="mt-2 font-mono text-[11.5px] text-muted">Illustration of the inbox, built in HTML. Names are fictional.</p>
            </div>
          </div>
        </Section>

        {/* ---------- Security ---------- */}
        <Section
          id="security"
          eyebrow="Security"
          title="Tested, not promised. And honest about the rest."
          lede="Wavelink handles private conversations and can send messages as you. This is what protects that, and what does not."
        >
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
            <ul className="space-y-4">
              {guarantees.map((g) => (
                <li key={g.title} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="font-semibold text-ink">{g.title}</p>
                    <p className="mt-0.5 text-[14.5px] leading-relaxed text-muted">{g.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <aside className="h-fit rounded-xl border border-line bg-surface p-6">
              <p className="eyebrow" style={{ color: "var(--warn)" }}>What is not protected</p>
              <ul className="mt-4 space-y-4">
                {notProtected.map((n) => (
                  <li key={n.title} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-warn-soft text-warn">
                      <MinusIcon className="h-3.5 w-3.5" />
                    </span>
                    <p className="text-[14.5px] leading-relaxed text-muted">
                      <strong className="font-semibold text-ink">{n.title}</strong> {n.text}
                    </p>
                  </li>
                ))}
              </ul>
              <Link href="/docs/security" className="mt-5 inline-flex items-center gap-1.5 text-[14px] text-accent-ink underline">
                Full security model
                <ArrowIcon className="h-3.5 w-3.5" />
              </Link>
            </aside>
          </div>
        </Section>

        {/* ---------- Deploy ---------- */}
        <Section
          id="deploy"
          eyebrow="Deploy"
          title={
            <>
              <span className="numeral mr-3 align-baseline text-accent-ink">1</span>always-on process. Pick where it runs.
            </>
          }
          lede="Any platform works if it gives you one long-lived process, a persistent disk and a public HTTPS address. Serverless and autoscaling do not."
        >
          <ul className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {platforms.map((p) => (
              <li key={p.name} className="bg-paper p-5">
                <Link href={p.href} className="group block no-underline">
                  <p className="font-display flex items-center justify-between text-[18px] font-semibold text-ink">
                    {p.name}
                    <ArrowIcon className="h-4 w-4 text-muted group-hover:text-accent-ink" />
                  </p>
                  <p className="mt-1 text-[13.5px] text-muted">{p.where}</p>
                  <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                    <dt className="font-mono text-muted">cost</dt>
                    <dd className="text-ink">{p.cost}</dd>
                    <dt className="font-mono text-muted">effort</dt>
                    <dd className="text-ink">{p.effort}</dd>
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[14px] text-muted">
            Requirements for any platform: one always-on process, a persistent disk, a public HTTPS address.{" "}
            <Link href="/docs/deploy" className="text-accent-ink underline">
              Choosing a platform
            </Link>
            .
          </p>
        </Section>

        {/* ---------- Multi-user ---------- */}
        <Section
          id="accounts"
          eyebrow="Accounts"
          title="Multi-user from the first start."
          lede="A team, a family, a small company: one install, one phone per person, one AI connection per person."
        >
          <div className="grid gap-6 md:grid-cols-3">
            {[
              ["Own phone, own data", "Each account links its own phone, has its own SQLite database and media folder, and connects its own ChatGPT or Claude with its own login."],
              ["Superadmin reads, never sends", "The superadmin can open any account's chats and have the AI summarise them, but cannot send, reply, change auto-reply or edit memories for anyone else. The API refuses, not just the UI."],
              ["Every view is logged", "Each superadmin view of another account is written to a log the owner sees on their Account page. There is no silent reading."],
            ].map(([t, d]) => (
              <div key={t} className="border-t-2 border-ink pt-4">
                <p className="font-display text-[18px] font-semibold">{t}</p>
                <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[14px] text-muted">
            Roles, lifecycle and limits:{" "}
            <Link href="/docs/accounts" className="text-accent-ink underline">
              Accounts and the superadmin
            </Link>
            .
          </p>
        </Section>

        {/* ---------- FAQ ---------- */}
        <Section id="faq" eyebrow="FAQ" title="Questions people ask first.">
          <dl className="grid gap-x-12 gap-y-8 md:grid-cols-2">
            {faq.map((f) => (
              <div key={f.q} className="border-t border-line pt-4">
                <dt className="font-display text-[18px] font-semibold text-ink">{f.q}</dt>
                <dd className="mt-2 text-[14.5px] leading-relaxed text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </Section>

        {/* ---------- CTA ---------- */}
        <section className="border-t border-line bg-ink text-paper dark:bg-surface">
          <div className="container-x flex flex-col gap-8 py-16 md:flex-row md:items-end md:justify-between md:py-24">
            <div className="max-w-xl">
              <p className="eyebrow" style={{ color: "var(--accent)" }}>Get started</p>
              <h2 className="font-display mt-3 text-[36px] font-bold leading-[1.02] md:text-[52px]">
                Ten minutes to your first
                <br />
                &ldquo;what did I miss?&rdquo;
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/docs/quickstart" className="btn" style={{ background: "var(--accent)", borderColor: "var(--accent)", color: "#101311" }}>
                Read the quick start
                <ArrowIcon className="h-4 w-4" />
              </Link>
              <a
                href={site.github}
                className="btn btn-ghost"
                style={{ color: "var(--paper)", borderColor: "rgba(251,251,248,0.3)" }}
                target="_blank"
                rel="noreferrer"
              >
                <GitHubIcon className="h-4 w-4" />
                Star on GitHub
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

import Link from "next/link";
import { Wordmark } from "./Wordmark";
import { WaveRule } from "./WaveRule";
import { site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="container-x py-12">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-sm text-[14px] text-muted">{site.tagline}</p>
            <p className="mt-2 text-[13px] text-muted">MIT licensed. Self-hosted. Open source.</p>
            <p className="mt-4 text-[13px] text-muted">
              Built by{" "}
              <a className="text-ink-2 underline decoration-line underline-offset-4 hover:text-ink" href={site.author.url} target="_blank" rel="noreferrer">{site.author.name}</a>
              {" "}·{" "}
              <a className="text-ink-2 hover:text-ink" href={site.author.github} target="_blank" rel="noreferrer">@ishqDehlvi</a>
            </p>
          </div>
          <div className="text-[14px]">
            <p className="eyebrow mb-3">Project</p>
            <ul className="space-y-2">
              <li><a className="text-ink-2 hover:text-ink" href={site.github} target="_blank" rel="noreferrer">GitHub repository</a></li>
              <li><Link className="text-ink-2 hover:text-ink" href="/docs">Documentation</Link></li>
              <li><Link className="text-ink-2 hover:text-ink" href="/docs/mcp-tools">MCP tools reference</Link></li>
              <li><Link className="text-ink-2 hover:text-ink" href="/docs/deploy">Deploy guides</Link></li>
            </ul>
          </div>
          <div className="text-[14px]">
            <p className="eyebrow mb-3">Trust</p>
            <ul className="space-y-2">
              <li><Link className="text-ink-2 hover:text-ink" href="/docs/security">Security model</Link></li>
              <li><a className="text-ink-2 hover:text-ink" href={`${site.blobBase}SECURITY.md`} target="_blank" rel="noreferrer">Security policy</a></li>
              <li><a className="text-ink-2 hover:text-ink" href={`${site.blobBase}LICENSE`} target="_blank" rel="noreferrer">MIT license</a></li>
              <li><a className="text-ink-2 hover:text-ink" href={`${site.blobBase}CONTRIBUTING.md`} target="_blank" rel="noreferrer">Contributing</a></li>
            </ul>
          </div>
        </div>
        <WaveRule id="wave-footer" className="my-10" />
        <p className="max-w-3xl text-[12.5px] leading-relaxed text-muted">{site.disclaimer}</p>
      </div>
    </footer>
  );
}

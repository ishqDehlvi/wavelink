import Link from "next/link";
import { docsNav } from "@/lib/docs-nav";

export function DocsNavList({ current }: { current: string }) {
  return (
    <nav aria-label="Documentation" className="docs-nav">
      <Link href="/docs" aria-current={current === "" ? "page" : undefined} className="mb-4 font-medium">
        Overview
      </Link>
      {docsNav.map((group) => (
        <div key={group.title} className="mb-6">
          <p className="eyebrow mb-2">{group.title}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.slug}>
                <Link href={`/docs/${item.slug}`} aria-current={current === item.slug ? "page" : undefined}>
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocsSidebar({ current }: { current: string }) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:block">
        <div className="sticky top-[72px] max-h-[calc(100vh-88px)] overflow-y-auto pr-4 pb-8">
          <DocsNavList current={current} />
        </div>
      </aside>
      {/* Phone: a native disclosure, no JS */}
      <details className="mobile-nav mb-6 rounded-lg border border-line bg-surface lg:hidden">
        <summary className="flex items-center justify-between px-4 py-3 text-[14px] font-medium">
          <span>Documentation menu</span>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </summary>
        <div className="border-t border-line px-4 pt-4 pb-2">
          <DocsNavList current={current} />
        </div>
      </details>
    </>
  );
}

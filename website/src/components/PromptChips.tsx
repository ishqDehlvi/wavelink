"use client";

import { useEffect, useRef, useState } from "react";

/** Example prompts; click one to copy it and paste it into ChatGPT or Claude. */
export function PromptChips({ prompts }: { prompts: string[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = async (p: string) => {
    try {
      await navigator.clipboard.writeText(p);
    } catch {
      /* clipboard blocked: the feedback still shows which prompt was picked */
    }
    setCopied(p);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 1600);
  };
  return (
    <div>
      <ul className="flex flex-wrap gap-2.5">
        {prompts.map((p, i) => {
          const on = copied === p;
          return (
            <li key={p}>
              <button
                type="button"
                onClick={() => copy(p)}
                className={`rounded-full border px-4 py-2.5 text-left text-[15px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-10px_rgba(13,19,16,0.3)] active:translate-y-0 ${
                  on
                    ? "border-accent-ink bg-accent-ink text-white"
                    : i % 4 === 0
                      ? "border-accent/40 bg-accent-soft text-accent-deep"
                      : "border-line bg-paper text-ink-2 hover:border-line-strong"
                }`}
              >
                {on ? "Copied, paste it in ChatGPT" : p}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[13.5px] text-muted" aria-live="polite">
        {copied ? "Copied to your clipboard." : "Click any of these to copy it."}
      </p>
    </div>
  );
}

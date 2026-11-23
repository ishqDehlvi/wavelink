"use client";

import { useEffect } from "react";

/**
 * One document-level listener that powers every `.copy-btn` in server-rendered
 * code blocks, so the markdown pipeline can stay fully static.
 */
export function CopyListener() {
  useEffect(() => {
    const onClick = async (e: MouseEvent) => {
      const btn = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>(".copy-btn");
      if (!btn) return;
      const block = btn.closest(".codeblock");
      const pre = block?.querySelector("pre");
      if (!pre) return;
      try {
        await navigator.clipboard.writeText(pre.textContent ?? "");
        btn.dataset.copied = "true";
        btn.textContent = "Copied";
        setTimeout(() => {
          btn.dataset.copied = "false";
          btn.textContent = "Copy";
        }, 1500);
      } catch {
        btn.textContent = "Select";
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}

import Link from "next/link";
import { BRAND_GREEN, LOCKUP } from "@/lib/brand";

/** The horizontal Wave-W lockup (outlined Bricolage Grotesque Bold), linking home. */
export function Wordmark({ className = "", height = 19 }: { className?: string; height?: number }) {
  const [, , w, h] = LOCKUP.viewBox.split(" ").map(Number);
  return (
    <Link href="/" className={`inline-flex items-center text-ink no-underline ${className}`} aria-label="Wavelink home">
      <svg width={(height * w) / h} height={height} viewBox={LOCKUP.viewBox} aria-hidden="true">
        <path transform={LOCKUP.symbolTransform} d={LOCKUP.symbol} fill={BRAND_GREEN} />
        <path transform={LOCKUP.wordTransform} d={LOCKUP.word} fill="currentColor" />
      </svg>
    </Link>
  );
}

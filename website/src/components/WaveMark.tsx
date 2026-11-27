import { BRAND_GREEN, SYMBOL, SYMBOL_SMALL } from "@/lib/brand";

/** The Wave-W symbol. `size` is its height in px; below 24px the heavier small cut is used. */
export function WaveMark({ size = 22, className = "" }: { size?: number; className?: string }) {
  const g = size < 24 ? SYMBOL_SMALL : SYMBOL;
  const [, , w, h] = g.viewBox.split(" ").map(Number);
  return (
    <svg width={(size * w) / h} height={size} viewBox={g.viewBox} aria-hidden="true" className={className}>
      <path d={g.d} fill={BRAND_GREEN} />
    </svg>
  );
}

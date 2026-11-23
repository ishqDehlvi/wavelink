import Link from "next/link";
import { WaveMark } from "./WaveMark";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 font-display text-[19px] font-bold tracking-[-0.04em] text-ink no-underline ${className}`}
      aria-label="Wavelink home"
    >
      <WaveMark size={22} />
      <span>Wavelink</span>
    </Link>
  );
}

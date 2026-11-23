/** Thin repeating waveform rule, the site's one recurring motif. */
export function WaveRule({
  id = "wave",
  className = "",
  height = 10,
}: {
  id?: string;
  className?: string;
  height?: number;
}) {
  return (
    <svg
      className={`block w-full ${className}`}
      height={height}
      aria-hidden="true"
      style={{ color: "var(--line-strong)" }}
    >
      <defs>
        <pattern id={id} width="40" height={height} patternUnits="userSpaceOnUse">
          <path
            d={`M0 ${height / 2} C10 0 10 0 20 ${height / 2} S30 ${height} 40 ${height / 2}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height={height} fill={`url(#${id})`} />
    </svg>
  );
}

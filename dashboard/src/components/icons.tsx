// The small drawn icons used inside controls (same 1.7 stroke family as the sidebar icons).
const base = (cls = "size-4") => ({
  viewBox: "0 0 24 24",
  className: `${cls} shrink-0`,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const CloseIcon = ({ className }: { className?: string }) => (
  <svg {...base(className)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const CheckIcon = ({ className }: { className?: string }) => (
  <svg {...base(className)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const ChevronIcon = ({ open, className }: { open?: boolean; className?: string }) => (
  <svg {...base(className)} className={`${className ?? "size-3.5"} shrink-0 transition-transform duration-150 ${open ? "rotate-90" : ""}`}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
export const BackIcon = ({ className }: { className?: string }) => (
  <svg {...base(className)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const ForwardIcon = ({ className }: { className?: string }) => (
  <svg {...base(className)}>
    <path d="M14 6l6 6-6 6M20 12H9a5 5 0 0 0-5 5v1" />
  </svg>
);
export const PlusIcon = ({ className }: { className?: string }) => (
  <svg {...base(className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

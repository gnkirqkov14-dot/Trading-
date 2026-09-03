function HouseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M3 11.5L12 4l9 7.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 10v9a1 1 0 0 0 1 1h3v-5h6v5h3a1 1 0 0 0 1-1v-9"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  wordmarkClassName = "inline",
}: {
  className?: string;
  /** Tailwind visibility classes for the wordmark, e.g. "hidden sm:inline" to collapse to icon-only on small screens. */
  wordmarkClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600">
        <HouseIcon className="h-5 w-5" />
      </span>
      <span
        className={`text-lg font-bold leading-none whitespace-nowrap text-slate-900 ${wordmarkClassName}`}
      >
        Имоти{" "}
        <span className="font-medium text-slate-500">без посредници</span>
      </span>
    </span>
  );
}

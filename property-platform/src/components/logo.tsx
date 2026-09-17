// Знакът е пресъздаден като SVG (а не вмъкнат като PNG), за да е остър
// на всякакъв размер и да се преизползва и във favicon-а
// (src/app/icon.svg) и в OG снимката (src/app/opengraph-image.tsx).
// Цветовете са същите като в @theme в globals.css — тук са изписани
// буквално, защото SVG-то се ползва и извън Tailwind (satori при OG
// снимката не разбира CSS променливи).
const NAVY = "#1A5180";
const MINT = "#2BB98C";

/** Покрив с комин над карфица с точка — знакът от логото на imotpoint.com. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 82 92" fill="none" aria-hidden className={className}>
      <path
        d="M6 41 41 6l35 35"
        stroke={NAVY}
        strokeWidth="8.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Коминът е с полегат долен ръб, за да се слее с наклона на
          покрива вместо да стърчи под него. */}
      <path
        d="M54.5 12.5C54.5 11.67 55.17 11 56 11h9c.83 0 1.5.67 1.5 1.5V35L54.5 23Z"
        fill={NAVY}
      />
      <path
        d="M41 29c13.25 0 24 10.75 24 24 0 13.5-13.5 22-24 35-10.5-13-24-21.5-24-35 0-13.25 10.75-24 24-24Z"
        fill={NAVY}
      />
      <circle cx="41" cy="53" r="13.5" fill="#fff" />
      <circle cx="41" cy="53" r="8.5" fill={MINT} />
    </svg>
  );
}

export function Logo({
  className,
  wordmarkClassName = "inline",
}: {
  className?: string;
  /** Допълнителни Tailwind класове за надписа (напр. за скриване в тесен контекст). */
  wordmarkClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <BrandMark className="h-8 w-auto shrink-0 sm:h-9" />
      <span
        className={`whitespace-nowrap text-lg font-bold leading-none text-brand-600 sm:text-xl ${wordmarkClassName}`}
      >
        imotpoint<span className="text-accent-500">.com</span>
      </span>
    </span>
  );
}

import Link from "next/link";

const SECTIONS = [
  { key: "tenders", href: "/", label: "Обществени поръчки", hint: "държавата и общините купуват" },
  { key: "grants", href: "/grants", label: "Европейски програми", hint: "безвъзмездни пари за фирмата" },
] as const;

/**
 * Избор в самото начало: поръчки или програми. Две обикновени връзки —
 * екранният четец казва „текуща страница“ на избраната (aria-current).
 */
export function SectionSwitch({ current }: { current: (typeof SECTIONS)[number]["key"] }) {
  return (
    <nav aria-label="Какво търсите" className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
      {SECTIONS.map((s) => {
        const active = s.key === current;
        return (
          <Link
            key={s.key}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-xl px-3 py-3 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${
              active ? "bg-white shadow-sm" : "hover:bg-white/60"
            }`}
          >
            <span className={`block font-semibold ${active ? "text-brand-700" : "text-slate-700"}`}>{s.label}</span>
            <span className="block text-xs text-slate-500">{s.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}

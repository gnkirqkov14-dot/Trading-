import Link from "next/link";

/**
 * Трите неща, заради които изобщо някой отваря такъв сайт: да купи, да
 * наеме или да пусне обява. Едри цели, точно под търсачката — вместо
 * човек да ги търси из менюто.
 *
 * Третата плочка е тъмна нарочно: публикуването е единственото, което
 * пълни сайта, и е единственото, което не се случва само̀.
 */
const TILES = [
  {
    href: "/listings?type=sale",
    title: "Имоти за продажба",
    note: "Апартаменти, къщи, парцели",
    icon: (
      <>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.5V20h13V9.5" />
      </>
    ),
  },
  {
    href: "/listings?type=rent",
    title: "Имоти под наем",
    note: "Дългосрочно, от собственик",
    icon: (
      <>
        <path d="M4 21V9l8-6 8 6v12" />
        <path d="M9 21v-7h6v7" />
      </>
    ),
  },
  {
    href: "/dashboard/listings/new",
    title: "Публикувай обява",
    note: "Безплатно, за няколко минути",
    dark: true,
    icon: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
  },
];

export function GoalTiles() {
  return (
    <section className="border-y border-slate-200 bg-slate-50 py-9 sm:py-14">
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.17em] text-brand-600">
          Накъде
        </p>
        <h2 className="mt-2 font-display text-[1.45rem] font-semibold leading-tight text-slate-900 sm:text-3xl">
          Какво търсиш?
        </h2>

        <div className="mt-5 grid gap-2.5 sm:mt-8 sm:gap-4 lg:grid-cols-3">
          {TILES.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className={`flex items-center gap-3.5 rounded-[1.15rem] border p-4 transition sm:p-5 ${
                tile.dark
                  ? "border-slate-900 bg-slate-900 hover:bg-slate-800"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span
                className={`flex h-[2.6rem] w-[2.6rem] shrink-0 items-center justify-center rounded-[0.85rem] ${
                  tile.dark ? "bg-white/12" : "bg-slate-100"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={tile.dark ? "#2bb98c" : "#1a5180"}
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden
                >
                  {tile.icon}
                </svg>
              </span>
              <span className="min-w-0">
                <b
                  className={`block font-semibold ${
                    tile.dark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {tile.title}
                </b>
                <span
                  className={`mt-0.5 block text-[0.82rem] ${
                    tile.dark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {tile.note}
                </span>
              </span>
              <span
                aria-hidden
                className={`ml-auto text-lg ${
                  tile.dark ? "text-slate-500" : "text-slate-300"
                }`}
              >
                ›
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";

/**
 * Стена за нелогнат посетител на отворена обява. Няма „Не сега“: остава само
 * регистрация, вход или връщане към обявите.
 *
 * Рендира се от сървъра, затова не се изключва със спиране на JavaScript.
 * Текстът отдолу остава в HTML-а за Google и е орязаната версия за гости.
 */
export function ZadalzhitelnaRegistraciya({ sled }: { sled: string }) {
  const kam = `redirectTo=${encodeURIComponent(sled)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stena-zaglavie"
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 p-4 backdrop-blur-md"
    >
      <style>{"body{overflow:hidden}"}</style>
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-[0_24px_60px_-20px_rgba(15,36,56,0.45)]">
        <h2
          id="stena-zaglavie"
          className="font-display text-2xl font-semibold text-slate-900"
        >
          Регистрирай се, за да видиш имота
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Регистрацията е безплатна и отнема минута. Виждаш всички снимки,
          описанието, мястото на картата и телефона за връзка.
        </p>
        <Link
          href={`/register?${kam}`}
          className="mt-5 block rounded-full bg-slate-900 px-5 py-3 font-bold text-white transition hover:bg-slate-700"
        >
          Регистрирай се
        </Link>
        <Link
          href={`/login?${kam}`}
          className="mt-2 block rounded-full border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Вече имам профил
        </Link>
        <Link
          href="/listings"
          className="mt-3 inline-block text-sm text-slate-500 underline-offset-2 hover:underline"
        >
          Назад към обявите
        </Link>
      </div>
    </div>
  );
}

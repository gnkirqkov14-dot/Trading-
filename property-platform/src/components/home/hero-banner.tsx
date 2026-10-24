import Link from "next/link";
import { HeroSearch, type PopularCity } from "@/components/home/hero-search";

/**
 * Началото на страницата: една голяма снимка, обещанието на сайта и
 * бутон към обявите.
 *
 * Замени скрол сцената с въртящите се кадри. Повечето посетители идват
 * от Facebook на телефон и оставаха на началната страница, без да
 * стигнат до обявите — затова бутонът „Разгледай обявите“ е най-видимото
 * нещо след заглавието, а броят обяви показва, че сайтът е жив.
 *
 * Снимката е местна (`public/hero/`), смалена до 1920px и 900px за
 * телефон: оригиналът беше PNG от 10 MB на чужд CDN, а оптимизацията на
 * Vercel е изключена (виж `next.config.ts`).
 */
export function HeroBanner({
  popular,
  broiObqvi,
}: {
  popular: PopularCity[];
  broiObqvi: number;
}) {
  return (
    <section
      // Плаващият помощник изчаква този атрибут да излезе от екрана,
      // преди да покаже копчето си. Виж `components/assistant/ai-assistant.tsx`.
      data-hero-scene=""
      className="relative isolate overflow-hidden"
    >
      <picture>
        <source media="(max-width: 767px)" srcSet="/hero/glavna-tel.jpg" />
        <img
          src="/hero/glavna.jpg"
          alt="Град от птичи поглед — жилищни блокове, нови сгради и планина зад тях"
          fetchPriority="high"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_60%]"
        />
      </picture>
      {/* Тъмен воал, за да се чете белият текст върху всяка част на снимката. */}
      <span
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(9,24,38,0.62)_0%,rgba(9,24,38,0.5)_45%,rgba(9,24,38,0.72)_100%)]"
      />

      <div className="mx-auto flex min-h-[78vh] max-w-4xl flex-col items-center justify-center px-4 py-16 text-center sm:min-h-[82vh] sm:py-24">
        <h1 className="font-display text-[2.1rem] font-semibold leading-[1.08] tracking-tight text-white sm:text-[3.6rem]">
          Сайт само за собственици.
          <br />
          <span className="text-accent-400">
            Без брокери, 0% комисиона.
          </span>
        </h1>

        <p className="mt-6 text-lg font-semibold text-white/90 sm:text-xl">
          <span className="font-extrabold text-white">
            {/* „1 361“ — българският локал не разделя четирицифрени числа. */}
            {String(broiObqvi).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0")}
          </span>{" "}
          {broiObqvi === 1 ? "обява" : "обяви"} в сайта в момента
        </p>

        <Link
          href="/listings"
          className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-accent-500 px-9 py-5 text-lg font-extrabold text-[#04231a] shadow-[0_18px_40px_-12px_rgba(43,185,140,0.7)] transition hover:bg-accent-400 sm:text-xl"
        >
          Разгледай обявите
          <span aria-hidden>→</span>
        </Link>

        <div className="mt-10 w-full max-w-xl text-left">
          <HeroSearch popular={popular} variant="solid" />
        </div>
      </div>
    </section>
  );
}

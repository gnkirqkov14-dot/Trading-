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
      {/* Тъмен воал отляво, където е текстът; градът вдясно остава ясен.
          На телефон текстът е в цялата ширина — воалът е по-плътен. */}
      <span
        aria-hidden
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(6,20,32,0.82)_0%,rgba(6,20,32,0.7)_55%,rgba(6,20,32,0.85)_100%)] md:bg-[linear-gradient(90deg,rgba(6,20,32,0.92)_0%,rgba(6,20,32,0.75)_45%,rgba(6,20,32,0.15)_80%)]"
      />

      <div className="mx-auto flex min-h-[78vh] max-w-6xl items-center px-4 py-14 sm:min-h-[82vh] sm:py-20 md:px-8">
        <div className="w-full max-w-2xl text-white">
          <span className="inline-block rounded-full bg-accent-500 px-3.5 py-1.5 text-[0.8rem] font-extrabold tracking-wide text-[#04231a] sm:text-[0.9rem]">
            0% КОМИСИОНА
          </span>

          {/* Inter, а не декоративният шрифт: върху снимка се четеше трудно. */}
          <h1 className="mt-4 font-sans text-[2.4rem] font-black leading-[1.05] tracking-[-0.02em] sm:text-[3.75rem]">
            Сайт само за собственици.
            <br />
            <span className="text-[#5fe0b5]">Без брокери.</span>
          </h1>

          <p className="mt-4 text-lg font-medium text-[#d8e4ec] sm:text-[1.3rem]">
            <b className="font-extrabold text-white">
              {/* „1 361“ — българският локал не разделя четирицифрени числа. */}
              {String(broiObqvi).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0")}{" "}
              {broiObqvi === 1 ? "обява" : "обяви"}
            </b>{" "}
            директно от собственика — в момента
          </p>

          <Link
            href="/listings"
            className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-accent-500 px-8 py-[1.1rem] text-lg font-extrabold text-[#04231a] shadow-[0_18px_40px_-12px_rgba(43,185,140,0.7)] transition hover:bg-accent-400 sm:text-xl"
          >
            Разгледай обявите
            <span aria-hidden>→</span>
          </Link>

          <div className="mt-8 max-w-xl">
            <HeroSearch popular={popular} variant="solid" />
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HeroSearch, type PopularCity } from "@/components/home/hero-search";
import { HeroMark3D } from "@/components/home/hero-mark-3d";
import { STORY_FRAMES } from "@/components/home/story-frames";

/**
 * Началната сцена: едно и също място, снимано отвисоко, през времето.
 * Докато посетителят скролва, петте кадъра се преливат един в друг и
 * бавно се приближават — движението е като видео, но видео няма.
 *
 * ⚠️ Нарочно НЕ е видео файл и НЕ е поредица от кадри:
 * - Safari на iPhone не превърта видео по скрол надеждно — заеква или
 *   замръзва, а оттам идва голяма част от трафика;
 * - пет снимки тежат около мегабайт, а видеото — десет.
 *
 * Над пейзажа обикаля 3D знакът от логото — по елипса, вързана за
 * скрола, така че прелита над града, докато той се застроява.
 *
 * Снимките минават през `next/image`, затова могат да са тежки PNG-та:
 * Vercel ги сервира преоразмерени и в webp/avif според браузъра, и
 * кешира резултата на ръба.
 *
 * Самите кадри (адреси и текстове) стоят в `story-frames.ts` — четат се
 * и от сървърни компоненти, а този файл е клиентски. ⚠️ Не ги връщай
 * тук: докато бяха в този модул, сървърът получаваше модулен посредник
 * вместо масива и началната страница връщаше 500.
 *
 * ⚠️ Сцената върви и на телефон. Веднъж беше скрита там (търсачката в
 * нея избледняваше, докато iOS превърта страницата, за да отвори
 * клавиатурата), но собственикът поиска движението обратно — виж
 * бележката в CLAUDE.md.
 */

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function StoryScroll({ popular }: { popular: PopularCity[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [wide, setWide] = useState(false);
  const [calm, setCalm] = useState(false);

  // Орбитата на знака и приближаването на снимките се задават с inline
  // style, а той бие Tailwind класа — затова и двете се питат тук, в JS.
  useEffect(() => {
    const queries = {
      wide: window.matchMedia("(min-width: 1024px)"),
      calm: window.matchMedia("(prefers-reduced-motion: reduce)"),
    };
    const sync = () => {
      setWide(queries.wide.matches);
      setCalm(queries.calm.matches);
    };
    sync();
    queries.wide.addEventListener("change", sync);
    queries.calm.addEventListener("change", sync);
    return () => {
      queries.wide.removeEventListener("change", sync);
      queries.calm.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    // Изчислява се спрямо самата секция, а не спрямо scrollY на цялата
    // страница — така секцията работи и ако някой ден не е най-отгоре.
    const update = () => {
      const track = trackRef.current;
      if (!track) return;
      const travel = track.offsetHeight - window.innerHeight;
      if (travel <= 0) return;
      setProgress(clamp01(-track.getBoundingClientRect().top / travel));
    };

    // Скролът се вдига десетки пъти в секунда; смятаме веднъж на кадър.
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        update();
      });
    };

    const frame = requestAnimationFrame(update);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Позиция по веригата от кадри: 0 = първият, 4 = последният.
  const cursor = progress * (STORY_FRAMES.length - 1);

  return (
    <section
      ref={trackRef}
      // Плаващият помощник изчаква този атрибут да излезе от екрана,
      // преди да покаже копчето си — иначе на телефон ляга точно върху
      // бутона "Търси". Виж `components/assistant/ai-assistant.tsx`.
      data-hero-scene=""
      className="relative"
      style={{ height: `${STORY_FRAMES.length * 100}vh` }}
    >
      {/* Слоят със снимките стои закачен за екрана; текстът се плъзга
          отгоре му. `sticky` вместо `fixed`, за да не изскача извън
          секцията, когато страницата продължи надолу. */}
      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="absolute inset-0 bg-[#e9eef3]">
          {STORY_FRAMES.map((frame, index) => {
            const distance = Math.abs(cursor - index);
            const visible = clamp01(1 - distance);
            return (
              <Image
                key={frame.src}
                src={frame.src}
                alt={frame.alt}
                fill
                priority={index === 0}
                sizes="100vw"
                quality={78}
                className="object-cover"
                style={{
                  opacity: visible,
                  // Бавно приближаване, докато кадърът е на екран —
                  // това е разликата между слайдшоу и движеща се картина.
                  transform: calm
                    ? undefined
                    : `scale(${(1.11 - 0.07 * visible).toFixed(4)})`,
                  // Скролът идва на пресекулки (пръст, колелце, инерция).
                  // Преходът глади тези стъпки: браузърът сам
                  // интерполира между две измервания и движението се
                  // чете като видео, а не като прещракване между кадри.
                  // Затова и `ease-out` — всяка стъпка тръгва бързо и
                  // омеква, вместо да спира рязко.
                  transition: calm
                    ? undefined
                    : "opacity 320ms ease-out, transform 520ms ease-out",
                }}
              />
            );
          })}
        </div>

        {/* Воал за четимост на текста: вляво на широк екран, съвсем леко
            отдолу на телефон.

            ⚠️ Първата мобилна версия беше почти плътно бяло от 58%
            надолу и изяждаше точно долната част на кадъра — а при тези
            въздушни снимки градът е точно там. Сега воалът е слаб и
            стига чак в самото дъно; текстът се държи с бял ореол
            (`.story-halo` по-долу), а не със заливане на снимката. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(252,250,246,0.4)_0%,rgba(252,250,246,0)_22%,rgba(252,250,246,0)_58%,rgba(252,250,246,0.34)_80%,rgba(252,250,246,0.62)_100%)] lg:bg-[radial-gradient(72%_92%_at_10%_50%,rgba(252,250,246,0.97)_0%,rgba(252,250,246,0.86)_36%,rgba(252,250,246,0)_70%),linear-gradient(180deg,rgba(252,250,246,0.5)_0%,rgba(252,250,246,0)_24%)]"
        />

        {/* Зърно — окото чете лек шум като фотография, не като рендер. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.045] [background-image:url(&quot;data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/></filter><rect width='180' height='180' filter='url(%23n)'/></svg>&quot;)]"
        />

        {/* Знакът от логото обикаля над пейзажа по елипса, вързана за
            скрола: тръгва малък и далече горе, излиза най-едър отпред
            към средата, после се отдалечава. Самият знак се върти и
            плава сам (виж `hero-mark-3d.tsx`) — тук се мести само
            мястото му. `compact` го държи на олекотено качество; на
            тези размери разликата не се вижда, а платката работи
            наполовина. Стои НАД снимките, но ПОД текста, за да не го
            закрива, и не лови кликове. */}
        {(() => {
          // Започва отгоре на елипсата (най-далече) и обикаля веднъж
          // за целия скрол.
          const angle = progress * Math.PI * 2 - Math.PI / 2;
          const orbit = wide
            ? { x: 71, y: 45, rx: 15, ry: 25, size: "9.5rem" }
            // На тесен екран обиколката е по-широка, иначе знакът само
            // потрепва на едно място и не се чете като движение.
            : { x: 50, y: 26, rx: 29, ry: 14, size: "6.5rem" };
          // По-едър, когато е в предната част на елипсата — това дава
          // усещането, че наистина обикаля, а не се плъзга настрани.
          const depth = 1 + 0.24 * Math.sin(angle);
          return (
            <div
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                left: `${(orbit.x + orbit.rx * Math.cos(angle)).toFixed(2)}%`,
                top: `${(orbit.y + orbit.ry * Math.sin(angle)).toFixed(2)}%`,
                width: orbit.size,
                height: orbit.size,
                transform: `translate(-50%, -50%) scale(${depth.toFixed(3)})`,
                // Малко по-дълъг преход от този на снимките: знакът
                // изостава една идея след скрола и точно това го прави
                // да изглежда, че плува над сцената, а не че е залепен
                // за пръста.
                transition: calm
                  ? undefined
                  : "left 620ms ease-out, top 620ms ease-out, transform 620ms ease-out",
                willChange: calm ? undefined : "left, top, transform",
              }}
            >
              <HeroMark3D compact className="h-full w-full" />
            </div>
          );
        })()}

        <div className="absolute inset-0 flex items-end pb-[9vh] lg:items-center lg:pb-0">
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="relative lg:max-w-xl">
              {STORY_FRAMES.map((frame, index) => {
                const visible = clamp01(1 - Math.abs(cursor - index) / 0.7);
                const eased = visible * visible * (3 - 2 * visible);
                return (
                  <div
                    key={frame.src}
                    // Всички карти лежат една върху друга; вижда се тази,
                    // чийто кадър е на екран. Първата държи височината.
                    className={
                      index === 0
                        ? "relative"
                        : "pointer-events-none absolute inset-x-0 top-0"
                    }
                    style={{
                      opacity: eased,
                      transform: `translateY(${(1 - eased) * 18}px)`,
                      transition: calm
                        ? undefined
                        : "opacity 300ms ease-out, transform 420ms ease-out",
                      pointerEvents: eased > 0.6 ? "auto" : "none",
                    }}
                    aria-hidden={eased < 0.5}
                  >
                    <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-brand-600 [text-shadow:0_1px_16px_rgba(252,250,246,0.95),0_1px_3px_rgba(252,250,246,0.9)] lg:[text-shadow:none]">
                      {frame.eyebrow}
                    </p>
                    <h2 className="mt-4 font-display text-[2.4rem] font-semibold leading-[0.95] tracking-tight text-slate-900 sm:text-[3.4rem] lg:text-[4rem] [text-shadow:0_1px_16px_rgba(252,250,246,0.95),0_1px_3px_rgba(252,250,246,0.9)] lg:[text-shadow:none]">
                      {frame.title[0]}
                      <br />
                      <em className="not-italic text-accent-600">
                        {frame.title[1]}
                      </em>
                    </h2>
                    {frame.lead && (
                      <p className="mt-5 max-w-md text-[1rem] leading-relaxed text-slate-700 sm:text-[1.08rem] lg:text-slate-600 [text-shadow:0_1px_16px_rgba(252,250,246,0.95),0_1px_3px_rgba(252,250,246,0.9)] lg:[text-shadow:none]">
                        {frame.lead}
                      </p>
                    )}
                    {index === 0 && (
                      <div className="mt-8 max-w-xl">
                        <HeroSearch popular={popular} />
                      </div>
                    )}
                    {index === STORY_FRAMES.length - 1 && (
                      <Link
                        href="/register"
                        className="mt-8 inline-block rounded-2xl bg-slate-900 px-8 py-4 font-bold text-white shadow-[0_26px_50px_-22px_rgba(15,36,56,0.9)] transition hover:bg-slate-700"
                      >
                        Публикувай обява
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

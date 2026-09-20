"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HeroSearch, type PopularCity } from "@/components/home/hero-search";
import { HeroMark3D } from "@/components/home/hero-mark-3d";
import { STORY_FRAMES } from "@/components/home/story-frames";

/**
 * Началната сцена **за широк екран**: едно и също място, снимано
 * отвисоко, през времето. Докато посетителят скролва, петте кадъра се
 * преливат един в друг и бавно се приближават — движението е като видео,
 * но видео няма.
 *
 * ⚠️ **От `lg` надолу секцията е скрита.** На телефон тя заемаше петте
 * първи екрана: търсачката избледняваше, докато човек пише в нея
 * (iOS сам превърта страницата, за да отвори клавиатурата), а обявите и
 * „Публикувай“ оставаха на шести екран. Там сега стоят `phone-hero.tsx`
 * (един екран, търсачката не мърда) и `story-strip.tsx` (същата история
 * в три кадъра, по-надолу). Ако някой ден сцената тръгне и на телефон,
 * трябва да се върнат и мобилният воал, и ореолът около текста — виж
 * git историята на този файл.
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
 * и от сървърни компоненти, а този файл е клиентски.
 */

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function StoryScroll({ popular }: { popular: PopularCity[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [wide, setWide] = useState(false);
  const [calm, setCalm] = useState(false);

  // Приближаването на снимките се задава с inline style, а той бие
  // Tailwind класа — затова „по-малко движение“ се пита тук, в JS.
  // `wide` пази знака от това да вдигне WebGL контекст на телефон, където
  // цялата секция е `display:none` и никой няма да го види.
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
      // На телефон секцията е скрита и височината ѝ е 0 — оттук нататък
      // не се смята нищо.
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
      // преди да покаже копчето си. Същият атрибут носи и
      // `phone-hero.tsx`; помощникът взема първия, който реално се
      // вижда. Виж `components/assistant/ai-assistant.tsx`.
      data-hero-scene=""
      className="relative hidden lg:block"
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
                // Под `lg` секцията е скрита, но браузърът пак тегли
                // предварително заредената първа снимка. `1px` там го
                // праща към най-малкия вариант от srcset-а.
                sizes="(min-width: 1024px) 100vw, 1px"
                quality={78}
                className="object-cover"
                style={{
                  opacity: visible,
                  // Бавно приближаване, докато кадърът е на екран —
                  // това е разликата между слайдшоу и движеща се картина.
                  transform: calm
                    ? undefined
                    : `scale(${(1.11 - 0.07 * visible).toFixed(4)})`,
                  // Скролът идва на пресекулки (колелце, инерция). Без
                  // преход картината прещраква между две измервания;
                  // с него браузърът интерполира сам и движението се
                  // чете като видео. ⚠️ Без `will-change` — пет цели
                  // екрана в отделни слоеве ядат повече, отколкото
                  // печелят, а браузърът и без това вдига слой, докато
                  // преходът тече.
                  transition: calm
                    ? undefined
                    : "opacity 320ms ease-out, transform 520ms ease-out",
                }}
              />
            );
          })}
        </div>

        {/* Воал за четимост: светло вляво, където стои текстът, и чиста
            снимка вдясно. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(72%_92%_at_10%_50%,rgba(252,250,246,0.97)_0%,rgba(252,250,246,0.86)_36%,rgba(252,250,246,0)_70%),linear-gradient(180deg,rgba(252,250,246,0.5)_0%,rgba(252,250,246,0)_24%)]"
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
        {wide &&
          (() => {
            // Започва отгоре на елипсата (най-далече) и обикаля веднъж
            // за целия скрол.
            const angle = progress * Math.PI * 2 - Math.PI / 2;
            const orbit = { x: 71, y: 45, rx: 15, ry: 25 };
            // По-едър, когато е в предната част на елипсата — това дава
            // усещането, че наистина обикаля, а не се плъзга настрани.
            const depth = 1 + 0.24 * Math.sin(angle);
            return (
              <div
                aria-hidden
                className="pointer-events-none absolute h-[9.5rem] w-[9.5rem]"
                style={{
                  left: `${(orbit.x + orbit.rx * Math.cos(angle)).toFixed(2)}%`,
                  top: `${(orbit.y + orbit.ry * Math.sin(angle)).toFixed(2)}%`,
                  transform: `translate(-50%, -50%) scale(${depth.toFixed(3)})`,
                  // По-дълъг преход от този на снимките: знакът
                  // изостава една идея след скрола и точно това го
                  // прави да изглежда, че плува над сцената.
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

        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-6xl px-8">
            <div className="relative max-w-xl">
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
                    <p className="text-[0.7rem] font-bold uppercase tracking-[0.18em] text-brand-600">
                      {frame.eyebrow}
                    </p>
                    <h2 className="mt-4 font-display text-[4rem] font-semibold leading-[0.95] tracking-tight text-slate-900">
                      {frame.title[0]}
                      <br />
                      <em className="not-italic text-accent-600">
                        {frame.title[1]}
                      </em>
                    </h2>
                    {frame.lead && (
                      <p className="mt-5 max-w-md text-[1.08rem] leading-relaxed text-slate-600">
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

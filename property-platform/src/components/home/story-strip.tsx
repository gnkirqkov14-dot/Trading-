import Image from "next/image";
import { STORY_FRAMES } from "@/components/home/story-frames";

/**
 * Историята „едно място през времето“ — свита до три кадъра, които се
 * плъзгат настрани, и преместена по-надолу в страницата.
 *
 * На широк екран същата история е скрол сцена
 * (`story-scroll.tsx`); на телефон сцената заемаше петте първи екрана и
 * бутна търсенето, обявите и „Публикувай“ далеч надолу. Тук идеята
 * остава, но струва един екран и не е на пътя на никого.
 *
 * ⚠️ Това са илюстрации, не снимки на истинско място — не се подписват
 * с име на град.
 */
const STRIP = [
  { frame: 0, badge: "Преди", caption: "Празна долина. Никой не живее тук." },
  { frame: 1, badge: "После", caption: "Някой построява първия дом." },
  { frame: 4, badge: "Днес", caption: "Град. И всеки покрив има собственик." },
];

export function StoryStrip() {
  return (
    <section className="border-y border-slate-200 bg-slate-50 py-9 lg:hidden">
      <div className="px-4">
        <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.17em] text-brand-600">
          Идеята
        </p>
        <h2 className="mt-2 font-display text-[1.45rem] font-semibold leading-tight text-slate-900">
          Всяко място започва празно
        </h2>
      </div>

      <div
        // `scroll-pl-4` върви заедно с `px-4`: без него snap-ът
        // подравнява първия кадър до ръба на екрана и левият отстъп
        // изчезва — лентата изглежда изместена спрямо заглавието.
        className="mt-4 flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {STRIP.map((item) => {
          const frame = STORY_FRAMES[item.frame];
          return (
            <figure key={item.frame} className="w-[78%] shrink-0 snap-start">
              <div className="relative h-[10.5rem] overflow-hidden rounded-[1.1rem] bg-[#cfd9de]">
                <Image
                  src={frame.src}
                  alt={frame.alt}
                  fill
                  // Лентата е скрита от `lg` нагоре — там `1px` праща
                  // браузъра към най-малкия вариант вместо към кадър,
                  // който никой няма да види.
                  sizes="(min-width: 1024px) 1px, 78vw"
                  quality={65}
                  className="object-cover"
                />
                <figcaption className="absolute bottom-2.5 left-3 text-sm font-bold text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.55)]">
                  {item.badge}
                </figcaption>
              </div>
              <p className="mt-2 text-[0.84rem] leading-snug text-slate-500">
                {item.caption}
              </p>
            </figure>
          );
        })}
      </div>
    </section>
  );
}

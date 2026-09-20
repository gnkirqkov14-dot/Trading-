import Image from "next/image";
import { HeroSearch, type PopularCity } from "@/components/home/hero-search";
import type { StoryFrame } from "@/components/home/story-frames";

/**
 * Началото на страницата **на телефон**: един екран, в който търсачката
 * е на видно място и не мърда.
 *
 * ⚠️ Защо изобщо съществува отделно от скрол сцената
 * (`story-scroll.tsx`): сцената е висока пет екрана и текстът в нея
 * избледнява според скрола. На iPhone фокусирането на полето за търсене
 * само̀ превърта страницата, за да отвори клавиатурата — сцената тръгва
 * напред и картата с търсачката започва да чезне точно докато човекът
 * пише в нея. На снимка от собственика се виждаха два припокрити,
 * полупрозрачни текста. Затова на телефон търсачката стои в обикновена
 * секция извън всякаква анимация.
 *
 * Сцената остава за широките екрани, където клавиатура няма и скролът е
 * с мишка.
 */
export function PhoneHero({
  popular,
  photo,
}: {
  popular: PopularCity[];
  /** Кадърът за фон. `null` — остава само градиентът (виж page.tsx). */
  photo: StoryFrame | null;
}) {
  return (
    <section
      // Плаващият помощник изчаква този атрибут да излезе от екрана,
      // преди да покаже копчето си — иначе ляга върху „Търси имот“.
      // Същият атрибут носи и скрол сцената; помощникът взема първия,
      // който реално се вижда. Виж `components/assistant/ai-assistant.tsx`.
      data-hero-scene=""
      className="relative lg:hidden"
    >
      {/* Снимката е горе и се стапя в бялото — картата с търсачката
          стъпва върху нея, но текстът никога не лежи върху детайли. */}
      <div className="relative h-[34vh] min-h-[13.5rem] overflow-hidden sm:h-[38vh] bg-[linear-gradient(170deg,#cfd9de_0%,#c4d0cd_38%,#a9b68f_100%)]">
        {photo && (
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            priority
            // На широк екран секцията е `display:none`, но браузърът пак
            // тегли снимката. `1px` там го праща към най-малкия вариант
            // от srcset-а — няколко килобайта вместо цял кадър.
            sizes="(min-width: 1024px) 1px, 100vw"
            quality={70}
            className="object-cover object-[50%_65%]"
          />
        )}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-3/5 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.72)_55%,#ffffff_100%)]"
        />
      </div>

      <div className="relative mx-auto -mt-8 max-w-2xl px-4 pb-9 sm:pb-12">
        <h1 className="font-display text-[2.05rem] font-semibold leading-[1.06] tracking-tight text-slate-900 sm:text-[2.7rem]">
          Имоти директно
          <br />
          от <em className="not-italic text-accent-600">собственика</em>
        </h1>
        <p className="mt-2.5 text-[0.95rem] leading-relaxed text-slate-500">
          Без агенции. Телефонът в обявата е на човека, който продава.
        </p>

        <div className="mt-5">
          <HeroSearch popular={popular} variant="solid" />
        </div>

        <p className="mt-5 flex items-center justify-center gap-5 text-center text-[0.78rem] font-semibold text-slate-500">
          <span>
            <b className="font-extrabold text-accent-600">0 €</b> комисионна
          </span>
          <span>
            <b className="font-extrabold text-accent-600">5267</b> населени
            места
          </span>
        </p>
      </div>
    </section>
  );
}

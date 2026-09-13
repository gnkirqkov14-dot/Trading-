import type { Metadata } from "next";
import Link from "next/link";
import {
  DEFAULT_LISTING_LIMIT,
  MAX_LISTING_PHOTOS,
  SUPPORT_EMAIL,
} from "@/lib/listing-labels";

export const metadata: Metadata = {
  title: "За нас",
  description:
    "Имоти без посредници е безплатна платформа за обяви директно от собственици — без агенции и без комисионни. Научи как работи, за кого е и какви са правилата.",
  alternates: { canonical: "/about" },
};

const sellerSteps = [
  {
    title: "Регистрирай се безплатно",
    text: "Само имейл и телефон за връзка. Отнема под минута и не се иска карта.",
  },
  {
    title: "Качи обявата си",
    text: `Снимки (до ${MAX_LISTING_PHOTOS} броя), цена, квадратура, адрес и описание. Можеш да добавиш и линк към видео обиколка.`,
  },
  {
    title: "Говори директно с купувача",
    text: "Обаждат ти се или ти пишат през сайта. Ти решаваш на кого да отговориш — без посредник, който да филтрира.",
  },
];

const buyerSteps = [
  {
    title: "Търси по област и град",
    text: "Избираш област от картата или директно филтрираш по град, квартал, цена, квадратура, етаж и още.",
  },
  {
    title: "Регистрирай се, за да видиш всичко",
    text: "Пълният адрес, телефонът на собственика и всички снимки се виждат след безплатна регистрация.",
  },
  {
    title: "Свържи се със собственика",
    text: "Обаждаш се директно или пишеш през сайта. Без такса за оглед, без комисионна при сделка.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-emerald-600/20">
            За платформата
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Имоти директно от собственик, без посредници
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            imotspot.com е българска платформа за обяви на имоти, в която
            публикуват само собственици — хора, които реално продават или
            отдават своя имот. Без агенции по средата, без комисионна при
            сделка и без такси за публикуване.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-3xl px-4 py-14">
        <section>
          <h2 className="text-2xl font-semibold text-slate-900">
            Защо изобщо направихме такъв сайт
          </h2>
          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              В България стандартната агентска комисионна е между 2% и 3% от
              цената на имота — при апартамент за 150 000 евро това са между
              3 000 и 4 500 евро, които често се плащат и от двете страни.
              За много хора това е разликата между това да успеят да купят и
              да се откажат.
            </p>
            <p>
              Проблемът не е само в парите. В повечето големи сайтове за имоти
              една и съща обява се появява по 5-6 пъти от различни агенции, с
              различна цена, а истинският собственик е скрит зад брокер, който
              не знае подробностите за имота. Купувачите губят часове в
              обаждания до посредници, а продавачите чакат някой друг да реши
              кога да им покаже офертата.
            </p>
            <p>
              Идеята тук е обратната: обявата е на собственика, телефонът е на
              собственика и разговорът е директен. Ти решаваш на кого да
              отговориш и кога да покажеш имота.
            </p>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold text-slate-900">
            Как работи, ако продаваш или отдаваш
          </h2>
          <ol className="mt-6 space-y-4">
            {sellerSteps.map((step, index) => (
              <li
                key={step.title}
                className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-1 text-slate-600">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold text-slate-900">
            Как работи, ако търсиш имот
          </h2>
          <ol className="mt-6 space-y-4">
            {buyerSteps.map((step, index) => (
              <li
                key={step.title}
                className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-1 text-slate-600">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold text-slate-900">
            Колко струва
          </h2>
          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Публикуването на обява е безплатно. Разглеждането на обявите
              също. Единственото условие, за да видиш пълния адрес, телефона
              на собственика и да пишеш съобщение, е безплатна регистрация —
              тя пази сайта от автоматично извличане на телефони и от
              анонимни, несериозни запитвания.
            </p>
            <p>
              Няма абонамент, няма комисионна при сделка и няма скрити такси
              при огледи или договаряне. Каквото се уговорите със собственика,
              остава между вас.
            </p>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold text-slate-900">
            Как пазим сайта чист от агенции
          </h2>
          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              Платформата има смисъл само ако обявите наистина са от
              собственици. Затова работим по няколко линии едновременно:
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="font-medium text-slate-900">
                  Лимит на брой обяви.
                </strong>{" "}
                Един профил може да качи до {DEFAULT_LISTING_LIMIT} обяви.
                Ако имаш основателна причина за повече (например строител,
                който продава апартаменти в собствена сграда), пишеш ни и
                разглеждаме случая индивидуално.
              </li>
              <li>
                <strong className="font-medium text-slate-900">
                  Един телефон на профил.
                </strong>{" "}
                Телефонът идва от профила ти и е един и същ за всичките ти
                обяви — така агенция не може да се крие зад различни номера.
              </li>
              <li>
                <strong className="font-medium text-slate-900">
                  Бутон за докладване.
                </strong>{" "}
                Ако попаднеш на обява, която очевидно е от посредник, я
                докладваш с един клик и ние я проверяваме.
              </li>
              <li>
                <strong className="font-medium text-slate-900">
                  Блокиране при повторение.
                </strong>{" "}
                Потвърдените агенции се блокират с телефон и имейл и не могат
                да си направят нов профил със същите данни.
              </li>
            </ul>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold text-slate-900">
            За кого е подходящ сайтът
          </h2>
          <div className="mt-4 space-y-4 text-slate-600">
            <p>
              За собственици на апартаменти, къщи, парцели, офиси и магазини в
              цяла България — както за продажба, така и за отдаване под наем.
              Покриваме всички 28 области, с градовете и по-големите села във
              всяка от тях.
            </p>
            <p>
              Строителни фирми, които продават директно от собствен проект,
              също са добре дошли — това не е посредничество. Пиши ни, за да
              ти отключим по-висок лимит за обяви.
            </p>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-semibold text-slate-900">Контакт</h2>
          <p className="mt-4 text-slate-600">
            Въпрос, проблем с обява или сигнал за агенция — пиши на{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="font-medium text-emerald-700 underline hover:text-emerald-800"
            >
              {SUPPORT_EMAIL}
            </a>
            . Отговаряме на всяко съобщение.
          </p>
        </section>

        <div className="mt-14 flex flex-wrap gap-3 border-t border-slate-200 pt-10">
          <Link
            href="/register"
            className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-700"
          >
            Публикувай обява безплатно
          </Link>
          <Link
            href="/listings"
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Разгледай обявите
          </Link>
        </div>
      </div>
    </div>
  );
}

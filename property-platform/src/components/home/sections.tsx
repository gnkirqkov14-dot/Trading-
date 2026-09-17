import Link from "next/link";

/**
 * Извита граница между две секции вместо права линия. Рисува се като SVG
 * със `preserveAspectRatio="none"`, за да се разтегля по цялата ширина на
 * всеки екран. `-mb-0.5` покрива хоризонталната резка от закръгляне на
 * пиксели между вълната и следващата секция.
 */
export function Wave({
  fill,
  flip = false,
}: {
  /** Цветът на секцията ПОД вълната (или НАД нея, когато flip е true). */
  fill: string;
  flip?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 1440 110"
      preserveAspectRatio="none"
      fill={fill}
      aria-hidden
      className={`block w-full ${flip ? "-mt-0.5 -scale-y-100" : "-mb-0.5"}`}
    >
      <path
        d={
          flip
            ? "M0 58c260 52 480-42 760-30s440 78 680 26v66H0z"
            : "M0 52C240 8 420 96 720 72s480-96 720-40v78H0z"
        }
      />
    </svg>
  );
}

const STATS = [
  {
    value: "5267",
    label: "населени места",
    icon: (
      <>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5.5 9.5V20h13V9.5" />
      </>
    ),
  },
  {
    value: "0 %",
    label: "комисионна",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10M9 10h5.5a1.8 1.8 0 0 1 0 3.6H9" />
      </>
    ),
  },
  {
    value: "28",
    label: "области в България",
    icon: (
      <>
        <path d="M3 20V9l9-6 9 6v11" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
  },
  {
    value: "3",
    label: "бариери срещу агенции",
    icon: (
      <>
        <path d="M12 3 4 6.5v5.2c0 5 3.4 8.4 8 9.3 4.6-.9 8-4.3 8-9.3V6.5z" />
        <path d="m9 12 2.2 2.2L15.5 10" />
      </>
    ),
  },
];

export function StatBand() {
  return (
    <section className="bg-gradient-to-b from-[#17344d] to-[#0f2438] pb-14 pt-2 text-white sm:pb-[4.4rem]">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-6 px-4 sm:gap-6 lg:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="flex items-center gap-4">
            <span className="flex h-[3.4rem] w-[3.4rem] shrink-0 items-center justify-center rounded-full border border-[#cbb995]/50 bg-[#cbb995]/10">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#cbb995"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-[1.375rem] w-[1.375rem]"
                aria-hidden
              >
                {stat.icon}
              </svg>
            </span>
            <span>
              <b className="block font-display text-2xl font-semibold leading-none sm:text-[1.7rem]">
                {stat.value}
              </b>
              <span className="mt-1.5 block text-[0.72rem] font-bold uppercase leading-snug tracking-[0.09em] text-slate-400">
                {stat.label}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Намери имота",
    text: "Пишеш първите букви на града или селото и избираш. Филтрираш по цена, квадратура, етаж.",
  },
  {
    n: "02",
    title: "Регистрирай се",
    text: "Безплатно, за минута. Отключва пълния адрес, всички снимки и телефона на собственика.",
  },
  {
    n: "03",
    title: "Обади се",
    text: "Директно на човека, който продава. Без брокер по средата, без такса за оглед.",
  },
];

// Трите карти са в обща 3D сцена и стоят на стълбица — крайните са леко
// завъртени навън, средната излиза най-напред. На телефон стълбицата и
// перспективата отпадат: една под друга, без наклон.
const STEP_TRANSFORMS = [
  "lg:[transform:rotateY(7deg)_translateZ(6px)]",
  "lg:[transform:translateY(30px)_translateZ(52px)]",
  "lg:[transform:rotateY(-7deg)_translateY(60px)_translateZ(6px)]",
];

export function HowItWorks() {
  return (
    <section className="bg-[#faf7f1] pb-20 pt-3 sm:pb-[6.5rem]">
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#a08a5c]">
          Как работи
        </p>
        <h2 className="mt-3.5 font-display text-3xl font-semibold leading-tight text-slate-900 sm:text-[2.875rem]">
          Три стъпки и говориш
          <br />
          директно със собственика
        </h2>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-500 sm:text-[1.0625rem]">
          Без брокер по средата, без такса за оглед и без чакане някой друг да
          реши кога да ти покаже имота.
        </p>

        <div className="mt-9 grid gap-4 sm:mt-14 sm:gap-6 lg:grid-cols-3 lg:[perspective:1300px]">
          {STEPS.map((step, index) => (
            <div
              key={step.n}
              className={`rounded-3xl border border-[#ece4d6] bg-white p-7 pb-8 shadow-[0_30px_56px_-36px_rgba(15,36,56,0.5)] lg:[transform-style:preserve-3d] ${STEP_TRANSFORMS[index]}`}
            >
              <p className="text-[0.94rem] font-extrabold tracking-[0.12em] text-[#a08a5c]">
                {step.n}
              </p>
              <h3 className="mt-3.5 font-display text-[1.375rem] font-semibold text-slate-900">
                {step.title}
              </h3>
              <p className="mt-3 text-[0.9rem] leading-relaxed text-slate-500">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const AGENCY_COSTS = [
  "3% комисионна = 4 500 €",
  "Една обява, пет агенции, пет цени",
  "Брокер, който не знае имота",
  "Чакаш го да реши кога да ти покаже",
];

const OUR_BENEFITS = [
  "Нула комисионна",
  "Една обява, един собственик, една цена",
  "Говориш с човека, който живее там",
  "Уговаряте оглед директно",
];

export function CostComparison() {
  return (
    <section className="bg-white bg-[radial-gradient(760px_480px_at_84%_18%,rgba(43,185,140,0.13),transparent_62%)] py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#a08a5c]">
          Сметката
        </p>
        <h2 className="mt-3.5 font-display text-3xl font-semibold leading-tight text-slate-900 sm:text-[2.875rem]">
          Апартамент за 150 000 €
        </h2>

        <div className="mt-8 grid items-center gap-4 sm:mt-12 sm:gap-6 lg:grid-cols-[1fr_1.12fr] lg:[perspective:1400px]">
          <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-6 text-slate-400 sm:p-8 lg:[transform:rotateY(8deg)_translateZ(-30px)] lg:[transform-style:preserve-3d]">
            <h3 className="font-display text-2xl font-semibold text-slate-500">
              През агенция
            </h3>
            <ul className="mt-5">
              {AGENCY_COSTS.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 border-t border-slate-200 py-3 text-[0.97rem] font-semibold first:border-t-0"
                >
                  <span className="flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-extrabold text-slate-400">
                    ✕
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[1.6rem] bg-gradient-to-br from-[#17344d] to-[#0f2438] p-6 text-white shadow-[0_64px_100px_-52px_rgba(15,36,56,0.95)] sm:p-8 lg:[transform:rotateY(-5deg)_translateZ(64px)] lg:[transform-style:preserve-3d]">
            <h3 className="font-display text-2xl font-semibold">
              През imotpoint.com
            </h3>
            <ul className="mt-5">
              {OUR_BENEFITS.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 border-t border-white/15 py-3 text-[0.97rem] font-semibold first:border-t-0"
                >
                  <span className="flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full bg-accent-500 text-xs font-extrabold text-[#04231a]">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 font-display text-3xl font-semibold text-accent-400 sm:text-4xl">
              Спестяваш 4 500 €
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HomeCta() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#1c5988] to-[#12405f] py-16 text-white sm:py-24">
      <span
        aria-hidden
        className="absolute -bottom-[20rem] -right-[12rem] h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(circle,rgba(43,185,140,0.4),transparent_62%)]"
      />
      <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-stretch justify-between gap-8 px-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-display text-3xl font-semibold leading-tight sm:text-[3.25rem]">
            Имотът е твой.
            <br />
            Обявата — също.
          </h2>
          <p className="mt-4 text-base font-medium text-[#b6d0e4] sm:text-[1.0625rem]">
            Публикуването е безплатно. Винаги. Без абонамент и без скрити такси.
          </p>
        </div>
        <Link
          href="/register"
          className="shrink-0 whitespace-nowrap rounded-2xl bg-gradient-to-br from-accent-400 to-accent-500 px-9 py-5 text-center text-[1.05rem] font-bold text-[#04231a] shadow-[0_22px_44px_-16px_rgba(43,185,140,0.9)] transition hover:brightness-105"
        >
          Публикувай обява →
        </Link>
      </div>
    </section>
  );
}

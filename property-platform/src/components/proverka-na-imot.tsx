"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  DOKUMENTI,
  IZMAMI,
  KADE_DA_PROVERISH,
  OGLED,
  REGISTAR_ADVOKATI,
  REGISTAR_NOTARIUSI,
  VID_ETIKET,
  kartaZaTarsene,
  pismoDoYurist,
  type Grupa,
  type Vid,
} from "@/lib/proverka-na-imot";

/**
 * Интерактивната част на „Проверка на имот“: списък с документи с отметки,
 * търсене на юрист по град и готово писмо до него.
 *
 * Отметките се пазят само в браузъра на човека (localStorage). Нищо не се
 * праща към сървъра и никакви документи не минават през сайта.
 */

const KLUCH = "imotpoint-proverka-v1";

const SABITIE = "imotpoint-proverka";
/** Пази отметките, когато хранилището на браузъра е недостъпно. */
let rezerva = "{}";

function procheti(): string {
  try {
    return window.localStorage.getItem(KLUCH) ?? rezerva;
  } catch {
    // Частен прозорец или изключено хранилище — работим без запомняне.
    return rezerva;
  }
}

function zapishi(otmetnati: Record<string, boolean>) {
  rezerva = JSON.stringify(otmetnati);
  try {
    window.localStorage.setItem(KLUCH, rezerva);
  } catch {
    // Вж. по-горе.
  }
  window.dispatchEvent(new Event(SABITIE));
}

function abonirai(obnovi: () => void) {
  window.addEventListener(SABITIE, obnovi);
  window.addEventListener("storage", obnovi);
  return () => {
    window.removeEventListener(SABITIE, obnovi);
    window.removeEventListener("storage", obnovi);
  };
}

function razchet(zapis: string): Record<string, boolean> {
  try {
    const danni: unknown = JSON.parse(zapis);
    return danni && typeof danni === "object"
      ? (danni as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

const TON: Record<Grupa["ton"], { etiket: string; ramka: string }> = {
  zadalzhitelno: {
    etiket: "bg-accent-100 text-accent-800",
    ramka: "border-accent-200",
  },
  vazhno: {
    etiket: "bg-slate-100 text-slate-700",
    ramka: "border-slate-200",
  },
  dobre: {
    etiket: "bg-slate-100 text-slate-700",
    ramka: "border-slate-200",
  },
};

export function ProverkaNaImot({
  nachalenVid,
  nachalenGrad,
  gradove,
}: {
  nachalenVid: Vid;
  nachalenGrad: string;
  gradove: string[];
}) {
  const [vid, setVid] = useState<Vid>(nachalenVid);
  const [grad, setGrad] = useState(nachalenGrad);
  // На сървъра и при първото показване е празно, после идва запазеното.
  const zapis = useSyncExternalStore(abonirai, procheti, () => "{}");
  const otmetnati = useMemo(() => razchet(zapis), [zapis]);
  const [kopirano, setKopirano] = useState(false);

  const grupi = DOKUMENTI[vid];
  const vsichki = useMemo(() => grupi.flatMap((g) => g.tochki), [grupi]);
  const gotovi = vsichki.filter((t) => otmetnati[t.id]);
  const zadalzhitelni = grupi[0].tochki;
  const lipsvashti = zadalzhitelni.filter((t) => !otmetnati[t.id]).length;

  const pismo = pismoDoYurist(
    vid,
    grad,
    gotovi.map((t) => t.ime),
  );

  async function kopirai() {
    try {
      await navigator.clipboard.writeText(pismo);
      setKopirano(true);
      setTimeout(() => setKopirano(false), 2500);
    } catch {
      // Ако браузърът не дава достъп, текстът си стои в полето за ръчно копиране.
    }
  }

  function izchisti() {
    const novi = { ...otmetnati };
    for (const t of vsichki) delete novi[t.id];
    zapishi(novi);
  }

  return (
    <div>
      {/* Купувам / Наемам */}
      <div
        role="tablist"
        aria-label="Какво правиш"
        className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5 print:hidden"
      >
        {(Object.keys(VID_ETIKET) as Vid[]).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={vid === v}
            onClick={() => setVid(v)}
            className={`rounded-xl px-4 py-3 text-base font-semibold transition ${
              vid === v
                ? "bg-white text-slate-900 shadow"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {VID_ETIKET[v]}
          </button>
        ))}
      </div>

      {/* Стъпка 1: документи */}
      <section className="mt-10">
        <Zaglavie nomer={1} tekst="Поискай основните документи" />
        <p className="mt-2 text-slate-600">
          Не са много и повечето ги дава{" "}
          {vid === "pokupka" ? "продавачът" : "наемодателят"}. Отмятай каквото
          вече имаш. Запомня се на това устройство.
        </p>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="font-medium text-slate-900">
              {gotovi.length} от {vsichki.length} готови
            </p>
            <p
              className={
                lipsvashti === 0
                  ? "font-medium text-accent-700"
                  : "text-slate-600"
              }
            >
              {lipsvashti === 0
                ? "✓ Основните са налице"
                : `Остават ${lipsvashti} основни`}
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-accent-500 transition-all"
              style={{
                width: `${Math.round((gotovi.length / vsichki.length) * 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-5">
          {grupi.map((g) => (
            <div
              key={g.id}
              className={`rounded-2xl border bg-white p-4 sm:p-5 ${TON[g.ton].ramka}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${TON[g.ton].etiket}`}
                >
                  {g.zaglavie}
                </span>
                <span className="text-sm text-slate-600">{g.podzaglavie}</span>
              </div>
              <ul className="mt-3 flex flex-col divide-y divide-slate-100">
                {g.tochki.map((t) => (
                  <li key={t.id}>
                    <label className="flex cursor-pointer gap-3 py-3">
                      <input
                        type="checkbox"
                        checked={!!otmetnati[t.id]}
                        onChange={(e) =>
                          zapishi({ ...otmetnati, [t.id]: e.target.checked })
                        }
                        className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 accent-[#2bb98c]"
                      />
                      <span className="min-w-0">
                        <span
                          className={`block font-medium ${
                            otmetnati[t.id]
                              ? "text-slate-400 line-through"
                              : "text-slate-900"
                          }`}
                        >
                          {t.ime}
                        </span>
                        <span className="mt-0.5 block text-sm text-slate-600">
                          {t.zashto}
                        </span>
                        {t.otkade && (
                          <span className="mt-1 block text-sm text-slate-500">
                            <span className="font-medium">Откъде:</span>{" "}
                            {t.otkade}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Разпечатай списъка
          </button>
          {gotovi.length > 0 && (
            <button
              type="button"
              onClick={izchisti}
              className="rounded-lg px-4 py-2 text-sm text-slate-500 underline underline-offset-2 hover:text-slate-900"
            >
              Изчисти отметките
            </button>
          )}
        </div>
      </section>

      {/* Стъпка 2: сам в регистрите */}
      <section className="mt-12">
        <Zaglavie nomer={2} tekst="Провери сам онлайн" />
        <p className="mt-2 text-slate-600">
          Това са държавните сайтове. Става за няколко минути от телефона
          или компютъра. Ако нещо не ти е ясно, юристът прави същата справка
          вместо теб.
        </p>
        <ul className="mt-4 grid gap-3 lg:grid-cols-3">
          {KADE_DA_PROVERISH.map((r) => (
            <li
              key={r.url}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4"
            >
              <h3 className="font-semibold text-slate-900">{r.ime}</h3>
              <p className="mt-1 text-sm text-slate-600">{r.opisanie}</p>
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                Как се ползва
              </p>
              <ol className="mt-2 flex flex-col gap-2 text-sm text-slate-700">
                {r.stapki.map((s, i) => (
                  <li key={s} className="flex gap-2">
                    <span
                      aria-hidden="true"
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-100 text-xs font-semibold text-accent-800"
                    >
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center justify-center rounded-lg border border-brand-300 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 lg:mt-auto"
              >
                Отвори сайта ↗
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Стъпка 3: оглед */}
      <section className="mt-12">
        <Zaglavie nomer={3} tekst="Огледай спокойно" />
        <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {OGLED[vid].map((t) => (
            <li key={t} className="flex gap-2 text-slate-700">
              <span aria-hidden="true" className="text-accent-600">
                ✓
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
          <h3 className="font-semibold text-amber-900">
            Не бързай, ако забележиш нещо от тези
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm text-amber-900">
            {IZMAMI[vid].map((t) => (
              <li key={t} className="flex gap-2">
                <span aria-hidden="true">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Стъпка 4: юрист */}
      <section className="mt-12 print:hidden">
        <Zaglavie nomer={4} tekst="Покажи документите на юрист близо до теб" />
        <p className="mt-2 text-slate-600">
          {vid === "pokupka"
            ? "Това е истинската проверка и я прави юрист: адвокат или нотариус. Пращаш му документите и той ти казва дали всичко е наред."
            : "При наем обикновено стига адвокат да хвърли поглед на договора, преди да го подпишеш."}{" "}
          Избери си сам юрист по оценките и отзивите. Ние не препоръчваме
          конкретни кантори и не взимаме комисиона.
        </p>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <label
            htmlFor="grad-yurist"
            className="block text-sm font-medium text-slate-900"
          >
            В кой град или квартал търсиш?
          </label>
          <input
            id="grad-yurist"
            type="text"
            value={grad}
            onChange={(e) => setGrad(e.target.value)}
            list="gradove-yurist"
            placeholder="напр. Пловдив, Кършияка"
            maxLength={60}
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <datalist id="gradove-yurist">
            {gradove.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <a
              href={kartaZaTarsene("адвокат недвижими имоти", grad)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-slate-900 px-4 py-3 text-center font-medium text-white hover:bg-slate-700"
            >
              Покажи адвокати на картата ↗
            </a>
            <a
              href={kartaZaTarsene("нотариус", grad)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-center font-medium text-slate-900 hover:bg-slate-50"
            >
              Покажи нотариуси на картата ↗
            </a>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Отваря Google Maps с оценки, отзиви и работно време. Преди да
            платиш, провери дали човекът е вписан в{" "}
            <a
              href={REGISTAR_ADVOKATI}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-slate-900"
            >
              регистъра на адвокатите
            </a>{" "}
            или в{" "}
            <a
              href={REGISTAR_NOTARIUSI}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-slate-900"
            >
              регистъра на нотариусите
            </a>
            .
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="font-semibold text-slate-900">
            Готово писмо до юриста
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            В него влизат документите, които си отметнал горе. Копирай го и го
            прати от своя имейл заедно със снимки на документите. Документи
            през нашия сайт не се качват.
          </p>
          <textarea
            readOnly
            value={pismo}
            rows={12}
            className="mt-3 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-sm text-slate-800"
          />
          <button
            type="button"
            onClick={kopirai}
            className="mt-3 rounded-lg bg-accent-500 px-5 py-2.5 font-semibold text-white hover:bg-accent-600"
          >
            {kopirano ? "✓ Копирано" : "Копирай писмото"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Zaglavie({ nomer, tekst }: { nomer: number; tekst: string }) {
  return (
    <h2 className="flex items-center gap-3 text-xl font-semibold text-slate-900 sm:text-2xl">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-base text-white print:hidden">
        {nomer}
      </span>
      {tekst}
    </h2>
  );
}

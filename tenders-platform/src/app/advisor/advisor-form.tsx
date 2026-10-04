"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { AdvisorMatch } from "@/lib/advisor";
import { divisionName } from "@/lib/eop/cpv";
import { REGION_OPTIONS, regionName } from "@/lib/eop/regions";
import { deadlineLabel, formatDate, formatEur } from "@/lib/format";
import { askAdvisor, type AdvisorState } from "./actions";

const MAX_CHARS = 1500;

const EXAMPLES = [
  "Строителна фирма от Пловдив. Правим ремонти на училища, детски градини и общински сгради — покриви, фасади, саниране. Имаме 15 души и собствена техника.",
  "Почистваме офиси и обществени сгради в София. Работим с 30 служители, имаме опит с болници.",
  "Доставяме компютри, принтери и офис техника и ги поддържаме. Работим в цялата страна.",
  "Малка печатница във Варна — брошури, плакати, книги, табели.",
];

const STEPS = [
  "Чета описанието на фирмата…",
  "Търся в отворените поръчки…",
  "Сравнявам поръчките с дейността ви…",
  "Подреждам най-подходящите…",
];

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-brand-500 focus:outline-none sm:text-sm";

export function AdvisorForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState<AdvisorState, FormData>(askAdvisor, null);
  const [text, setText] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  // След отговор скролваме до резултата. Текстът остава в полето, защото
  // е контролиран (React 19 нулира само неконтролираните полета).
  useEffect(() => {
    if (state) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state]);

  return (
    <div className="space-y-8">
      <form action={action} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {!enabled ? (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Съветникът се включва скоро. Дотогава можете да{" "}
            <Link href="/" className="underline">
              търсите поръчки ръчно
            </Link>
            .
          </p>
        ) : null}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Какво работи фирмата ви?</span>
          <textarea
            name="description"
            required
            rows={5}
            maxLength={MAX_CHARS}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={field}
            placeholder="Например: правим ремонти на сгради в Пловдив и областта, имаме 15 души и собствена техника…"
          />
          <span className="mt-1 block text-right text-xs text-slate-400">
            {text.length}/{MAX_CHARS}
          </span>
        </label>

        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500">Или започнете от пример:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setText(ex)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-left text-xs text-slate-700 hover:border-brand-500 hover:text-brand-700"
              >
                {ex.split(/[.—]/)[0]}
              </button>
            ))}
          </div>
        </div>

        <label className="block sm:max-w-xs">
          <span className="mb-1 block text-sm font-medium text-slate-700">Къде работите? (по избор)</span>
          <select name="region" defaultValue={state?.region ?? ""} key={state?.region ?? ""} className={field}>
            <option value="">Цялата страна</option>
            {REGION_OPTIONS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.name}
              </option>
            ))}
          </select>
        </label>

        {/* Капан за ботове — скрит от хората. */}
        <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

        <div className="flex flex-wrap items-center gap-3">
          <button
            disabled={pending || !enabled}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? "Съветникът мисли…" : "Намери поръчки за мен"}
          </button>
          <span className="text-xs text-slate-500">Отнема до минута. До 5 въпроса на ден.</span>
        </div>
        {pending ? <Progress /> : null}
      </form>

      <div ref={resultRef} className="scroll-mt-4">
        {state && !state.ok ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.message}</p>
        ) : null}
        {state?.ok && !pending ? <Result state={state} /> : null}
      </div>

      <HowToApply />
    </div>
  );
}

function Progress() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 9000);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="flex items-center gap-2 text-sm text-slate-600" aria-live="polite">
      <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-brand-500" />
      {STEPS[step]}
    </p>
  );
}

function Result({ state }: { state: Extract<AdvisorState, { ok: true }> }) {
  const r = state.result;
  if (r.kind === "question") {
    return (
      <section className="space-y-2 rounded-2xl border border-brand-100 bg-brand-50 p-5">
        <h2 className="font-semibold text-slate-900">Още един въпрос</h2>
        {r.summary ? <p className="text-sm text-slate-700">{r.summary}</p> : null}
        <p className="text-slate-900">{r.question}</p>
        <p className="text-sm text-slate-600">Допишете отговора в описанието отгоре и натиснете бутона пак.</p>
      </section>
    );
  }

  const alertQs = new URLSearchParams();
  if (r.alert.category) alertQs.set("category", r.alert.category);
  if (r.alert.region) alertQs.set("region", r.alert.region);

  return (
    <section className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-brand-100 bg-brand-50 p-5">
        <h2 className="font-semibold text-slate-900">Как разбрахме фирмата ви</h2>
        <p className="text-slate-700">{r.summary}</p>
        {r.fitAreas.length ? (
          <div className="space-y-2 pt-1">
            <h3 className="text-sm font-semibold text-slate-900">В какви поръчки можете да участвате</h3>
            <ul className="space-y-1.5 text-sm text-slate-700">
              {r.fitAreas.map((a) => (
                <li key={a.title}>
                  <strong className="text-slate-900">{a.title}.</strong> {a.why}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">
          {r.matches.length
            ? `Отворени поръчки за вас: ${r.matches.length}`
            : "В момента няма отворени поръчки точно за вас"}
        </h2>
        {r.searched ? (
          <p className="text-sm text-slate-500">
            Прегледахме {r.searched} отворени поръчки, които приличат на дейността ви, и избрахме тези, в
            които има смисъл да кандидатствате.
          </p>
        ) : null}
        {r.note ? <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{r.note}</p> : null}
        {r.matches.map((m) => (
          <MatchCard key={m.tender.id} match={m} />
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-700">
          Нови поръчки излизат всеки ден. Получавайте подходящите за вас на имейла си.
        </p>
        <Link
          href={`/alerts${alertQs.size ? `?${alertQs}` : ""}`}
          className="whitespace-nowrap rounded-lg bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-700"
        >
          Пращай ми такива поръчки
        </Link>
      </div>
    </section>
  );
}

const toneClass = {
  urgent: "bg-amber-100 text-amber-800",
  ok: "bg-emerald-100 text-emerald-800",
  muted: "bg-slate-100 text-slate-600",
};

function MatchCard({ match }: { match: AdvisorMatch }) {
  const t = match.tender;
  const deadline = deadlineLabel(t.deadline_at);
  return (
    <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded-full px-2 py-0.5 font-semibold ${
            match.fit === "high" ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"
          }`}
        >
          {match.fit === "high" ? "Много подходяща" : "Частично подходяща"}
        </span>
        <span className={`rounded-full px-2 py-0.5 font-medium ${toneClass[deadline.tone]}`}>{deadline.text}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{divisionName(t.cpv_division)}</span>
        {t.eu_funded ? (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">Европейски средства</span>
        ) : null}
      </div>
      <h3 className="font-semibold leading-snug text-slate-900">
        <Link href={`/tenders/${t.id}`} className="hover:text-brand-600">
          {t.title}
        </Link>
      </h3>
      {t.lot_title ? (
        <p className="text-sm text-slate-600">
          Позиция {t.lot_number}: {t.lot_title}
        </p>
      ) : null}
      <p className="text-sm text-slate-800">
        <span className="font-medium">Защо е за вас: </span>
        {match.why}
      </p>
      {match.check.length ? (
        <div className="text-sm text-slate-700">
          <p className="font-medium">Проверете в документацията:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {match.check.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="sr-only">Възложител</dt>
          <dd className="truncate">{t.buyer_name}</dd>
        </div>
        <div>
          <dt className="sr-only">Област</dt>
          <dd>{regionName(t.region_code)}</dd>
        </div>
        <div className="sm:text-right">
          <dt className="sr-only">Прогнозна стойност</dt>
          <dd className="font-semibold text-slate-900">{formatEur(t.value_eur)}</dd>
        </div>
      </dl>
      <p className="text-xs text-slate-500">
        Срок за оферти: {formatDate(t.deadline_at)} ·{" "}
        <Link href={`/tenders/${t.id}`} className="text-brand-600 hover:underline">
          Подробности →
        </Link>
      </p>
    </article>
  );
}

function HowToApply() {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Как се кандидатства за обществена поръчка</h2>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
        <li>
          Регистрирайте фирмата в{" "}
          <a href="https://app.eop.bg" className="underline" rel="noopener" target="_blank">
            ЦАИС ЕОП
          </a>{" "}
          — държавната система, през която се подават всички оферти. Всичко е електронно.
        </li>
        <li>Трябва ви квалифициран електронен подпис (КЕП) на представляващия фирмата.</li>
        <li>
          Отворете поръчката и изтеглете документацията. Там са точните изисквания: опит, техника,
          персонал, сертификати, гаранции.
        </li>
        <li>
          Попълнете ЕЕДОП — декларацията, че фирмата отговаря на изискванията. Попълва се в самата
          система.
        </li>
        <li>Подайте офертата преди срока. След него системата не приема.</li>
      </ol>
      <p className="text-sm text-slate-600">
        Ако не покривате всички изисквания сами, можете да участвате в обединение с друга фирма или
        като подизпълнител.
      </p>
      <p className="text-xs text-slate-500">
        Съветникът работи с изкуствен интелект и може да сбърка. Преди да кандидатствате, винаги
        четете условията на официалната страница на поръчката.
      </p>
    </section>
  );
}

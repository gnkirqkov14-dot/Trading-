"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { AdvisorAnswer, AdvisorQuestion } from "@/lib/advisor/types";
import { REGION_OPTIONS } from "@/lib/eop/regions";
import {
  adoptProfile,
  forgetProfile,
  refineAdvisor,
  rerunAdvisor,
  startAdvisor,
  submitSurvey,
  type AdvisorState,
} from "./actions";
import { field } from "./styles";

const MAX_CHARS = 1500;

const EXAMPLES = [
  "Представители сме за България на фасадни панели. Доставяме и монтираме фасадни системи за жилищни и обществени сгради, имаме склад в София и 12 служители.",
  "Строителна фирма от Пловдив. Правим ремонти на училища, детски градини и общински сгради — покриви, фасади, саниране. Имаме 15 души и собствена техника.",
  "Почистваме офиси и обществени сгради в София. Работим с 30 служители, имаме опит с болници.",
  "Доставяме компютри, принтери и офис техника и ги поддържаме. Работим в цялата страна.",
];

const STEPS = [
  "Чета описанието на фирмата…",
  "Търся в отворените поръчки…",
  "Преглеждам европейските програми…",
  "Сравнявам с дейността ви…",
  "Подреждам най-подходящите…",
];


function Progress() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 9000);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="flex items-center gap-2 text-sm text-slate-600" aria-live="polite">
      <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-brand-500" />
      {STEPS[step]} Обикновено до минута.
    </p>
  );
}

function ErrorBox({ state }: { state: AdvisorState }) {
  return state ? (
    <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.message}</p>
  ) : null;
}

/** Първото описание на фирмата. */
export function StartForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState<AdvisorState, FormData>(startAdvisor, null);
  const [text, setText] = useState("");
  return (
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
          placeholder="Например: представители сме на фасадни панели, доставяме и монтираме, имаме склад в София…"
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
        <select name="region" defaultValue="" className={field}>
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
          {pending ? "Подготвям въпросите…" : "Продължи към анкетата"}
        </button>
        <span className="text-xs text-slate-500">След това — кратка анкета от 8–12 въпроса. Профилът се запазва.</span>
      </div>
      {pending ? <Progress /> : null}
      <ErrorBox state={state} />
    </form>
  );
}

/**
 * Анкетата: 8–12 въпроса наведнъж, с готови отговори (един или няколко)
 * и свободно поле. При редакция по-късно отговорите са попълнени.
 */
export function SurveyForm({
  questions,
  answers,
  done,
  enabled,
}: {
  questions: AdvisorQuestion[];
  answers: AdvisorAnswer[];
  done: boolean;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState<AdvisorState, FormData>(submitSurvey, null);
  const previous = new Map(answers.map((a) => [a.question, a.answer.split(", ")]));
  const extra = answers.find((a) => a.question === "Допълнително от фирмата")?.answer ?? "";
  return (
    <form action={action} className="space-y-6">
      <ol className="space-y-6">
        {questions.map((q, i) => {
          const prev = previous.get(q.text) ?? [];
          const other = prev.filter((p) => !q.options.includes(p)).join(", ");
          return (
            <li key={q.id}>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-900">
                  <span className="mr-1 text-slate-400">{i + 1}.</span>
                  {q.text}
                  {q.multi ? <span className="ml-1 text-xs font-normal text-slate-500">(може няколко)</span> : null}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {q.options.map((o) => (
                    <label
                      key={o}
                      className="cursor-pointer rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-600 has-[:checked]:text-white"
                    >
                      <input
                        type={q.multi ? "checkbox" : "radio"}
                        name={q.id}
                        value={o}
                        defaultChecked={prev.includes(o)}
                        className="sr-only"
                      />
                      {o}
                    </label>
                  ))}
                </div>
                <input
                  name={`${q.id}_other`}
                  defaultValue={other}
                  maxLength={200}
                  className={`${field} sm:max-w-sm`}
                  placeholder="или напишете друго…"
                />
              </fieldset>
            </li>
          );
        })}
      </ol>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-900">Нещо друго, което да знам? (по избор)</span>
        <input
          name="extra"
          defaultValue={extra}
          maxLength={300}
          className={field}
          placeholder="напр. имаме ISO 9001; търсим партньор за проектиране"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={pending || !enabled}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Подбирам за вас…" : done ? "Обнови с новите отговори" : "Покажи поръчките и програмите за мен"}
        </button>
        <span className="text-xs text-slate-500">
          {done ? "Брои се като едно питане." : "Може да пропуснете въпрос. Не се брои като ново питане."}
        </span>
      </div>
      {pending ? <Progress /> : null}
      <ErrorBox state={state} />
    </form>
  );
}

/** Промяна на описанието — нов профил и подбор. */
export function DescriptionForm({ description, enabled }: { description: string; enabled: boolean }) {
  const [state, action, pending] = useActionState<AdvisorState, FormData>(refineAdvisor, null);
  const [text, setText] = useState(description);
  return (
    <form action={action} className="space-y-3">
      <textarea
        name="description"
        rows={4}
        maxLength={MAX_CHARS}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={field}
      />
      <button
        disabled={pending || !enabled || text.trim() === description.trim()}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {pending ? "Подбирам наново…" : "Запази и подбери наново"}
      </button>
      {pending ? <Progress /> : null}
      <ErrorBox state={state} />
    </form>
  );
}

/** Нов съвет по сегашните филтри (без нов профил). */
export function RerunButton({ enabled, label }: { enabled: boolean; label: string }) {
  const [state, action, pending] = useActionState<AdvisorState, FormData>(rerunAdvisor, null);
  return (
    <form action={action} className="space-y-2">
      <button
        disabled={pending || !enabled}
        className="rounded-lg border border-brand-600 bg-white px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50"
      >
        {pending ? "Съветникът мисли…" : label}
      </button>
      {pending ? <Progress /> : null}
      <ErrorBox state={state} />
    </form>
  );
}

export function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input readOnly value={url} className={`${field} font-mono text-xs`} onFocus={(e) => e.target.select()} />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Без достъп до клипборда човек копира от полето.
          }
        }}
        className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand-500"
      >
        {copied ? "Копирано ✓" : "Копирай връзката"}
      </button>
    </div>
  );
}

export function ForgetButton() {
  return (
    <form
      action={forgetProfile}
      onSubmit={(e) => {
        if (!confirm("Да забравя ли профила на този компютър? Връзката по-горе ще продължи да работи.")) {
          e.preventDefault();
        }
      }}
    >
      <button className="text-sm text-slate-500 underline hover:text-red-700">Нова фирма / забрави профила</button>
    </form>
  );
}

/** Отворен по запазена връзка — запомня профила и на този компютър. */
export function AdoptProfile({ token }: { token: string }) {
  useEffect(() => {
    adoptProfile(token).catch(() => {});
  }, [token]);
  return null;
}

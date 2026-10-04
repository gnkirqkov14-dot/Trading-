"use client";

import { useActionState, useEffect, useState } from "react";
import type { AdvisorState } from "@/app/advisor/quota";
import { makeTenderGuide } from "./actions";
import { makeGrantHelp } from "./grant-actions";

const STEPS = [
  "Изтеглям обявлението от ЦАИС ЕОП…",
  "Чета условията и изискванията…",
  "Сравнявам ги с вашата фирма…",
  "Проверявам всеки цитат срещу обявлението…",
  "Подреждам стъпките за ЕЕДОП…",
];

const GRANT_STEPS = [
  "Изтеглям документите на процедурата от ИСУН…",
  "Чета условията за кандидатстване…",
  "Чета указанията за формуляра и критериите за оценка…",
  "Проверявам всеки цитат срещу документите…",
  "Сравнявам с вашата фирма…",
];

function Progress({ steps = STEPS, takes = "една до три минути" }: { steps?: string[]; takes?: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 25000);
    return () => clearInterval(id);
  }, [steps.length]);
  return (
    <p className="flex items-center gap-2 text-sm text-slate-600" aria-live="polite">
      <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-brand-500" aria-hidden="true" />
      {steps[step]} Отнема {takes} — не затваряйте страницата.
    </p>
  );
}

/** Бутонът, който пуска разбора на обявлението (едно питане от дневния лимит). */
export function GuideButton({ tenderId, enabled, label }: { tenderId: number; enabled: boolean; label: string }) {
  const [state, action, pending] = useActionState<AdvisorState, FormData>(makeTenderGuide, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="tender_id" value={tenderId} />
      <button
        type="submit"
        disabled={!enabled || pending}
        className="rounded-lg bg-brand-600 px-5 py-3 text-base font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
      >
        {pending ? "Подготвям помощта…" : label}
      </button>
      {pending ? <Progress /> : null}
      {state ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/** Бутон за помощника по европейска програма: разбор на условията или само оценка за фирмата. */
export function GrantButton({
  guid,
  mode,
  redo = false,
  enabled,
  label,
}: {
  guid: string;
  mode: "guide" | "fit";
  redo?: boolean;
  enabled: boolean;
  label: string;
}) {
  const [state, action, pending] = useActionState<AdvisorState, FormData>(makeGrantHelp, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="guid" value={guid} />
      <input type="hidden" name="mode" value={mode} />
      {redo ? <input type="hidden" name="redo" value="1" /> : null}
      <button
        type="submit"
        disabled={!enabled || pending}
        className="rounded-lg bg-brand-600 px-5 py-3 text-base font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
      >
        {pending ? "Подготвям помощта…" : label}
      </button>
      {pending ? <Progress steps={mode === "fit" ? ["Сравнявам условията с вашата фирма…"] : GRANT_STEPS} takes={mode === "fit" ? "до една минута" : "от две до четири минути"} /> : null}
      {state ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

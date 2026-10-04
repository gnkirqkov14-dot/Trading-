"use client";

import { useActionState, useEffect, useState } from "react";
import type { AdvisorState } from "@/app/advisor/quota";
import { makeTenderGuide } from "./actions";

const STEPS = [
  "Изтеглям обявлението от ЦАИС ЕОП…",
  "Чета условията и изискванията…",
  "Сравнявам ги с вашата фирма…",
  "Проверявам всеки цитат срещу обявлението…",
  "Подреждам стъпките за ЕЕДОП…",
];

function Progress() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 20000);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="flex items-center gap-2 text-sm text-slate-600" aria-live="polite">
      <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-brand-500" aria-hidden="true" />
      {STEPS[step]} Отнема една до три минути — не затваряйте страницата.
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

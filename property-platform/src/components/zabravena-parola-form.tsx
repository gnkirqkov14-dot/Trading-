"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { zabravenaParola } from "@/lib/actions/auth";
import { Turnstile } from "@/components/turnstile";
import { TURNSTILE_SITE_KEY } from "@/lib/turnstile";

export function ZabravenaParolaForm() {
  const [state, action, pending] = useActionState(zabravenaParola, undefined);
  const [zheton, setZheton] = useState("");
  const chakaProverka = Boolean(TURNSTILE_SITE_KEY) && !zheton;

  if (state?.prateno) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          Ако има профил с този имейл, пратихме писмо с линк за нова парола.
          Провери и папка „Спам“. Линкът важи 1 час и се отваря в същия
          браузър.
        </p>
        <Link
          href="/login"
          className="text-center text-sm font-medium text-slate-900 underline"
        >
          Към входа
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          Имейл
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Turnstile onToken={setZheton} resetKey={state} />

      <button
        type="submit"
        disabled={pending || chakaProverka}
        className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? "Изпращане…" : "Прати ми линк"}
      </button>

      <Link
        href="/login"
        className="text-center text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900"
      >
        Назад към входа
      </Link>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { novaParola } from "@/lib/actions/auth";

const POLE =
  "rounded-lg border px-3 py-2 outline-none focus:border-slate-900";

export function NovaParolaForm() {
  const [state, action, pending] = useActionState(novaParola, undefined);
  const ramka = (pole: string) =>
    state?.pole === pole ? "border-red-500" : "border-slate-300";

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="password"
          className="text-sm font-medium text-slate-700"
        >
          Нова парола
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={`${POLE} ${ramka("password")}`}
        />
        <p className="text-xs text-slate-500">Поне 8 символа.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="povtori" className="text-sm font-medium text-slate-700">
          Повтори паролата
        </label>
        <input
          id="povtori"
          name="povtori"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className={`${POLE} ${ramka("povtori")}`}
        />
      </div>

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
      >
        {pending ? "Записване…" : "Запази паролата"}
      </button>
    </form>
  );
}

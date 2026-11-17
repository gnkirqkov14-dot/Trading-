"use client";

import { useActionState, useEffect, useRef } from "react";
import { adminPishiNaPotrebitel, type PishiState } from "@/lib/actions/admin";

/** „Пиши като администратор“ в профила на потребител в админ панела. */
export function AdminPishiForma({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState<PishiState, FormData>(
    adminPishiNaPotrebitel.bind(null, userId),
    null,
  );
  const forma = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && !state.greshka) forma.current?.reset();
  }, [state]);

  return (
    <form ref={forma} action={action} className="mt-4 flex flex-col gap-3">
      <textarea
        name="content"
        required
        maxLength={2000}
        rows={4}
        placeholder="Пример: Хубаво е да качиш снимки на обявата — с тях я гледат много повече хора."
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
        >
          {pending ? "Изпращане…" : "Изпрати от IMOT POINT"}
        </button>
        {state && (
          <p
            className={`text-sm ${state.greshka ? "text-red-700" : "text-emerald-700"}`}
          >
            {state.poruka}
          </p>
        )}
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { adminPratiPismaZaDostap } from "@/lib/actions/admin";

/** Бутонът в админ панела за писмото „профилът ти е активен“. */
export function PismaZaDostapButon({ chakashti }: { chakashti: number }) {
  const [state, action, pending] = useActionState(
    adminPratiPismaZaDostap,
    undefined,
  );

  return (
    <form
      action={action}
      className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4"
    >
      <p className="text-sm font-semibold text-slate-900">
        {chakashti} души са с потвърден на ръка имейл и още не знаят, че имат
        достъп
      </p>
      <p className="mt-1 text-sm text-slate-600">
        Бутонът им праща писмо от IMOT POINT, че профилът им е активен и могат
        да влязат. До 40 писма на натискане, никой не получава две.
      </p>
      <button
        type="submit"
        disabled={pending || chakashti === 0}
        className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        {pending ? "Изпращам…" : "Прати писмо за достъп"}
      </button>
      {state && (
        <p
          className={`mt-2 text-sm ${state.greshka ? "text-red-700" : "text-emerald-700"}`}
        >
          {state.poruka}
        </p>
      )}
    </form>
  );
}

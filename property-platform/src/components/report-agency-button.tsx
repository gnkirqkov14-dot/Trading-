"use client";

import { useState, useTransition } from "react";
import { reportListingAsAgency } from "@/lib/actions/listings";

export function ReportAgencyButton({ listingId }: { listingId: string }) {
  const [isPending, startTransition] = useTransition();
  const [reported, setReported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleReport() {
    if (!confirm("Да докладвам ли тази обява като публикувана от агенция?"))
      return;
    setError(null);
    startTransition(async () => {
      try {
        await reportListingAsAgency(listingId);
        setReported(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Грешка.");
      }
    });
  }

  if (reported) {
    return <p className="text-xs text-slate-400">Докладвана. Благодарим!</p>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleReport}
        disabled={isPending}
        className="text-xs text-slate-400 underline hover:text-slate-600 disabled:opacity-50"
      >
        🚩 Докладвай като агенция
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/lib/actions/profile";

export function ProfileForm({
  initialName,
  initialPhone,
}: {
  initialName: string;
  initialPhone: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const inputClass =
    "rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900";
  const labelClass = "text-sm font-medium text-slate-700";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSubmitting(true);

    try {
      await updateProfile({ name, phone });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Възникна грешка.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className={labelClass}>Име</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          required
          minLength={2}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelClass}>Телефон (по избор)</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="08xx xxx xxx"
          className={inputClass}
        />
        <p className="text-xs text-slate-400">
          Ще се предлага автоматично при публикуване на нова обява — можеш
          да го промениш за всяка обява поотделно.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Промените са запазени.
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
      >
        {submitting ? "Запазване…" : "Запази промените"}
      </button>
    </form>
  );
}

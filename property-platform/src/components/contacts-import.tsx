"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseContacts, type ParsedContact } from "@/lib/parse-contacts";

/**
 * Внасяне на телефони — залепени или от файл.
 *
 * Пращат се на партиди, а не наведнъж: 5000 реда в една заявка опира до
 * ограниченията за размер и ако нещо се скъса, не се знае докъде е
 * стигнало. По партиди лентата се движи и прекъсването е безвредно —
 * внесеното си остава внесено.
 */

const BATCH_SIZE = 500;

export function ContactsImport({ groups }: { groups: string[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [raw, setRaw] = useState("");
  const [groupName, setGroupName] = useState("");
  const [source, setSource] = useState("");
  const [consentNote, setConsentNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preview = raw.trim() ? parseContacts(raw) : null;

  async function handleFile(file: File) {
    setRaw(await file.text());
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleImport() {
    const parsed = parseContacts(raw);
    if (parsed.contacts.length === 0) {
      setError("Не намерих нито един телефон в този текст.");
      return;
    }
    if (!consentNote.trim()) {
      setError(
        "Опиши откъде е съгласието. Трябва да можеш да го докажеш, ако някой попита.",
      );
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    const supabase = createClient();
    let imported = 0;
    let already = 0;
    let rejected = 0;

    try {
      for (let i = 0; i < parsed.contacts.length; i += BATCH_SIZE) {
        const batch: ParsedContact[] = parsed.contacts.slice(i, i + BATCH_SIZE);
        const { data, error: rpcError } = await supabase.rpc("import_contacts", {
          rows_in: batch,
          group_name: groupName.trim() || null,
          source_in: source.trim() || null,
          consent_note_in: consentNote.trim(),
        });
        if (rpcError) throw new Error(rpcError.message);

        const row = data?.[0];
        imported += row?.imported ?? 0;
        already += row?.already_there ?? 0;
        rejected += row?.rejected ?? 0;
        setProgress({ done: Math.min(i + BATCH_SIZE, parsed.contacts.length), total: parsed.contacts.length });
      }

      setResult(
        `Внесени ${imported} нови · ${already} вече ги имаше · ${rejected} негодни номера` +
          (parsed.skipped ? ` · ${parsed.skipped} реда без телефон` : ""),
      );
      setRaw("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Нещо се обърка.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Внеси телефони</h2>
      <p className="mt-1 text-sm text-slate-500">
        Залепи ги или качи файл. Всеки ред е по един човек — „име, телефон&rdquo;,
        „телефон; име&rdquo; или само номер. Редът няма значение.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <textarea
          rows={6}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={"Иван Петров, 0888 123 456\n0899 765 432\n+359877111222, Мария"}
          className={`${inputClass} font-mono text-sm`}
        />

        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
            className="text-sm"
          />
        </div>

        {preview && (
          <p className="text-sm text-slate-600">
            Разчетох <strong>{preview.contacts.length}</strong> телефона
            {preview.skipped > 0 && ` · ${preview.skipped} реда без телефон`}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Сложи ги в група</span>
            <input
              list="contact-groups"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="напр. Продавачи Пловдив"
              className={inputClass}
            />
            <datalist id="contact-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Откъде са</span>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="напр. форма на сайта"
              className={inputClass}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            Как е дадено съгласието <span className="text-red-600">*</span>
          </span>
          <input
            value={consentNote}
            onChange={(e) => setConsentNote(e.target.value)}
            placeholder="напр. отметка при попълване на запитване, март 2026"
            className={inputClass}
          />
          <span className="text-xs text-slate-500">
            Записва се за всеки контакт. Трябва да можеш да го докажеш, ако
            някой се оплаче.
          </span>
        </label>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {result && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {result}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleImport}
            disabled={busy || !preview?.contacts.length}
            className="rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {busy ? "Внасям…" : "Внеси"}
          </button>
          {progress && (
            <span className="text-sm text-slate-500">
              {progress.done} от {progress.total}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

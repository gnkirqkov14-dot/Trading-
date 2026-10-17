"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  previewImotListing,
  importImotListing,
  findImotListings,
  importImotAutomatically,
  refreshDescriptions,
  type ImportPreview,
  type FoundListing,
} from "@/lib/actions/import-listing";
import { CONSTRUCTION_STAGE_LABELS } from "@/lib/listing-labels";

/**
 * Списъкът НЕ се чете от сървъра по адрес на търсенето.
 *
 * Филтърът „Строителни фирми“ живее в сесията на потребителя в imot.bg, не
 * в адреса: сървърът няма тази сесия и получава всички обяви, включително
 * на агенции. Проверено по трудния начин — първото внасяне качи 38 агенции.
 *
 * Затова адресите се залепят от браузъра, където филтърът работи.
 */

type Neighborhood = { id: string; name: string };

// Етикетите идват от общия списък, за да не се разминат с това, което
// купувачът вижда в обявата.
const STAGES = Object.entries(CONSTRUCTION_STAGE_LABELS);

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900";

/**
 * Внасяне на фирмена обява: слагаш адреса, виждаш какво е разчетено,
 * поправяш каквото трябва и чак тогава качваш.
 *
 * Преглед и качване са нарочно разделени. Разрешението на фирмата и
 * верността на данните са решение на човек, не на машина — затова между
 * четенето и записа стои този екран.
 */
export function ImportListingForm({
  cityId,
  neighborhoods,
}: {
  cityId: string;
  neighborhoods: Neighborhood[];
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Полета, които човекът може да поправи преди качване.
  const [developerName, setDeveloperName] = useState("");
  const [developerPhone, setDeveloperPhone] = useState("");
  const [permissionNote, setPermissionNote] = useState("");
  const [projectName, setProjectName] = useState("");
  const [address, setAddress] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [stage, setStage] = useState<string>("");

  // --- партидно внасяне ---
  const [urlList, setUrlList] = useState("");
  const [found, setFound] = useState<FoundListing[] | null>(null);
  const [batchNote, setBatchNote] = useState("");
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    ok: number;
    skipped: string[];
  } | null>(null);

  async function handleFind() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const urls = urlList
        .split(/\s+/)
        .map((u) => u.trim())
        .filter((u) => /^https:\/\/(www\.)?imot\.bg\/obiava-/i.test(u));
      if (urls.length === 0) {
        setError("Не намерих нито един адрес на обява от imot.bg.");
        return;
      }
      setFound(await findImotListings(urls));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не се прочете.");
    } finally {
      setBusy(false);
    }
  }

  async function handleBatch() {
    if (!found) return;
    if (!batchNote.trim()) {
      setError("Опиши откъде е разрешението на фирмите.");
      return;
    }
    const queue = found.filter((f) => !f.alreadyImported);
    setBusy(true);
    setError(null);
    setDone(null);

    const skipped: string[] = [];
    let ok = 0;
    // Една по една, нарочно: 40 обяви по 17 снимки са стотици файла и
    // наведнъж imot.bg ще ни спре.
    for (const [index, item] of queue.entries()) {
      setProgress({ done: index, total: queue.length, ok, skipped });
      try {
        const result = await importImotAutomatically(
          item.url,
          batchNote.trim(),
        );
        if ("skipped" in result) {
          skipped.push(`${item.url.split("/").pop()?.slice(0, 40)} — ${result.skipped}`);
        } else {
          ok += 1;
        }
      } catch (caught) {
        skipped.push(
          `${item.url.split("/").pop()?.slice(0, 40)} — ${
            caught instanceof Error ? caught.message : "грешка"
          }`,
        );
      }
    }

    setProgress({ done: queue.length, total: queue.length, ok, skipped });
    setDone(`Качени ${ok} от ${queue.length}.`);
    setBusy(false);
    setFound(null);
    router.refresh();
  }

  /** Взима описанията наново за всичко вече качено. Рядко, ръчно. */
  async function handleRefreshDescriptions() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const result = await refreshDescriptions();
      setDone(
        `Препрочетени от източника: ${result.obnoveni} обновени` +
          (result.propadnali.length
            ? `, ${result.propadnali.length} пропаднали.`
            : "."),
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Грешка.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePreview() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const data = await previewImotListing(url);
      setPreview(data);
      setDeveloperName(data.company ?? "");
      setDeveloperPhone(data.phones[0] ?? "");
      setProjectName(data.projectName ?? "");
      setStage(data.stage ?? "");
      setAddress(
        [data.neighborhood && `кв. ${data.neighborhood}`, data.projectName]
          .filter(Boolean)
          .join(", ") || "гр. Пловдив",
      );
      const match = neighborhoods.find(
        (n) => data.neighborhood && n.name.toLowerCase() === data.neighborhood.toLowerCase(),
      );
      setNeighborhoodId(match?.id ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не се разчете.");
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const result = await importImotListing({
        sourceUrl: preview.sourceUrl,
        propertyType: preview.propertyType ?? "apartment",
        developerName,
        developerPhone,
        permissionNote,
        projectName: projectName || null,
        stage: (stage || null) as never,
        completionYear: preview.commissioned ? null : preview.commissionYear,
        yearBuilt: preview.commissioned ? preview.commissionYear : null,
        title: preview.title?.split("::")[0]?.trim() || "Апартамент в Пловдив",
        description: preview.description,
        address,
        cityId,
        neighborhoodId: neighborhoodId || null,
        price: preview.priceEur ?? 0,
        areaSqm: preview.areaSqm ?? 0,
        rooms: preview.rooms,
        floor: preview.floor,
        photos: preview.photos,
      });
      setDone(`Качена с ${result.photos} снимки.`);
      setPreview(null);
      setUrl("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Нещо се обърка.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-slate-900 bg-slate-900 p-5 text-white">
        <h2 className="text-lg font-semibold">Внеси всички наведнъж</h2>
        <p className="mt-1 text-sm text-slate-300">
          Отвори търсенето в imot.bg с твоя филтър за строителни фирми,
          копирай адресите на обявите и ги залепи тук — по един на ред.
          Качвам ги една по една, със снимките.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Списъкът се залепя, а не се чете от адрес на търсене: филтърът ти
          живее в сесията на imot.bg и сървърът не го вижда.
        </p>

        <textarea
          rows={5}
          value={urlList}
          onChange={(e) => setUrlList(e.target.value)}
          placeholder={"https://www.imot.bg/obiava-...\nhttps://www.imot.bg/obiava-..."}
          className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-white outline-none focus:border-white"
        />

        <input
          value={batchNote}
          onChange={(e) => setBatchNote(e.target.value)}
          placeholder="Откъде е разрешението на фирмите"
          className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-white"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleFind}
            disabled={busy}
            className="rounded-lg bg-white px-5 py-2.5 font-medium text-slate-900 transition hover:bg-slate-200 disabled:opacity-60"
          >
            {busy && !progress ? "Чета…" : "Намери обявите"}
          </button>

          {/* Рядко и ръчно: взима описанията наново за всичко качено,
              когато четенето им се е поправило. Снимките не се пипат. */}
          <button
            type="button"
            onClick={handleRefreshDescriptions}
            disabled={busy}
            className="rounded-lg border border-white/40 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-white disabled:opacity-60"
            title="Взима описанията и адресите наново от imot.bg за всички вече качени обяви"
          >
            Опресни от източника
          </button>

          {found && (
            <button
              type="button"
              onClick={handleBatch}
              disabled={busy}
              className="rounded-lg border border-white px-5 py-2.5 font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
            >
              Внеси {found.filter((f) => !f.alreadyImported).length} нови
            </button>
          )}
        </div>

        {found && !progress && (
          <p className="mt-3 text-sm text-slate-300">
            Намерих {found.length} обяви ·{" "}
            {found.filter((f) => f.alreadyImported).length} вече са качени
          </p>
        )}

        {progress && (
          <div className="mt-3 text-sm text-slate-300">
            <p>
              {progress.done} от {progress.total} · качени {progress.ok}
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
              <div
                className="h-full bg-white transition-all"
                style={{
                  width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
            {progress.skipped.length > 0 && (
              <ul className="mt-3 list-inside list-disc text-xs text-slate-400">
                {progress.skipped.slice(0, 8).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Или една по една</h2>
        <p className="mt-1 text-sm text-slate-500">
          Само обяви на строителни фирми. Агенциите нямат работа тук.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.imot.bg/obiava-..."
            className={`${inputClass} font-mono text-sm`}
          />
          <button
            type="button"
            onClick={handlePreview}
            disabled={busy || !url.trim()}
            className="shrink-0 rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {busy ? "Чета…" : "Прочети"}
          </button>
        </div>
      </section>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {done && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {done}
        </p>
      )}

      {preview && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          {preview.alreadyImported && (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Тази обява вече е качена веднъж.
            </p>
          )}

          <h2 className="text-lg font-semibold">Това разчетох</h2>

          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ["Цена", preview.priceEur ? `${preview.priceEur} €` : "—"],
              ["Квадратура", preview.areaSqm ? `${preview.areaSqm} кв.м` : "—"],
              ["Стаи", preview.rooms ?? "—"],
              [
                "Етаж",
                preview.floor === 0 ? "партер" : (preview.floor ?? "—"),
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs uppercase text-slate-500">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>

          {preview.photos.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-slate-500">
                {preview.photos.length} снимки
              </p>
              <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {preview.photos.slice(0, 12).map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={src}
                    src={src}
                    alt=""
                    className="aspect-square w-full rounded object-cover"
                  />
                ))}
              </div>
            </div>
          )}

          {preview.description && (
            <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">
              {preview.description}
            </p>
          )}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Строителна фирма</span>
              <input
                value={developerName}
                onChange={(e) => setDeveloperName(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Телефон на фирмата</span>
              <input
                value={developerPhone}
                onChange={(e) => setDeveloperPhone(e.target.value)}
                className={inputClass}
              />
              {preview.phones.length > 1 && (
                <span className="text-xs text-slate-500">
                  В обявата има и: {preview.phones.slice(1).join(", ")}
                </span>
              )}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Комплекс / проект</span>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="ако има"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Етап</span>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className={inputClass}
              >
                <option value="">Не е посочен</option>
                {STAGES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Квартал</span>
              <select
                value={neighborhoodId}
                onChange={(e) => setNeighborhoodId(e.target.value)}
                className={inputClass}
              >
                <option value="">Не е посочен</option>
                {neighborhoods.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Адрес</span>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className="mt-4 flex flex-col gap-1 text-sm">
            <span className="font-medium">
              Откъде е разрешението на фирмата{" "}
              <span className="text-red-600">*</span>
            </span>
            <input
              value={permissionNote}
              onChange={(e) => setPermissionNote(e.target.value)}
              placeholder="напр. разговор с управителя, 15 октомври 2026"
              className={inputClass}
            />
            <span className="text-xs text-slate-500">
              Записва се при фирмата. Трябва да можеш да го докажеш.
            </span>
          </label>

          <button
            type="button"
            onClick={handleImport}
            disabled={busy || !preview.priceEur || !preview.areaSqm}
            className="mt-5 rounded-lg bg-slate-900 px-6 py-3 font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
          >
            {busy ? "Качвам…" : "Качи обявата"}
          </button>
        </section>
      )}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { prepareBulkListing, previewBulkImport, finishBulkListing } from "@/lib/actions/bulk-import";
import { bulkIdentity, parseBulkDescription, type BulkDraft, type BulkPreview } from "@/lib/bulk-import";
import { createClient } from "@/lib/supabase/client";
import { preparePhoto } from "@/lib/prepare-photo";

type Row = { folder: string; draft?: BulkDraft; photos: File[]; state: BulkPreview["state"] | "uploading" | "done"; message: string; selected: boolean; listingId?: string };

async function readFolder(files: File[]): Promise<Row[]> {
  if (files.length > 6500 || files.reduce((sum, f) => sum + f.size, 0) > 600 * 1024 * 1024) throw new Error("Папката е прекалено голяма. Избери до 200 имота и 600 MB.");
  const descriptions = files.filter(f => /(?:^|\/)Описание\.txt$/i.test(f.webkitRelativePath || f.name)).sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, "bg", { numeric: true }));
  if (!descriptions.length || descriptions.length > 200) throw new Error("Нужни са между 1 и 200 папки с Описание.txt.");
  const identities = new Set<string>();
  const texts = await Promise.all(descriptions.map(f => f.size <= 64_000 ? f.text() : Promise.resolve("")));
  return descriptions.map((file, index) => {
    const path = file.webkitRelativePath || file.name;
    const directory = path.slice(0, path.lastIndexOf("/") + 1);
    const folder = directory.replace(/\/$/, "") || file.name;
    try {
      if (file.size > 64_000) throw new Error("Описание.txt е прекалено дълъг.");
      const draft = parseBulkDescription(folder, texts[index]);
      const photos = files.filter(f => {
        const p = f.webkitRelativePath || f.name;
        return p.startsWith(directory) && !p.slice(directory.length).includes("/") && /\.(jpe?g|png|webp)$/i.test(p);
      }).sort((a, b) => a.name.localeCompare(b.name, "bg", { numeric: true }));
      if (!photos.length || photos.length > 30) throw new Error("Нужни са между 1 и 30 снимки в папката.");
      if (photos.some(f => f.size > 15 * 1024 * 1024)) throw new Error("Има снимка над 15 MB.");
      const identity = bulkIdentity(draft);
      if (identities.has(identity)) throw new Error("Повторена обява в тази папка.");
      identities.add(identity);
      return { folder, draft, photos, state: "ready", message: "Проверка…", selected: false };
    } catch (error) {
      return { folder, photos: [], state: "error", message: error instanceof Error ? error.message : "Невалидна обява.", selected: false };
    }
  });
}

async function readArchive(file: File): Promise<Row[]> {
  if (file.size > 80 * 1024 * 1024) throw new Error("ZIP файлът е над 80 MB. Раздели го на по-малки архиви.");
  const { unzipSync, strFromU8 } = await import("fflate");
  let total = 0;
  let entries = 0;
  let tooLarge = false;
  const data = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter(entry) {
    entries++;
    total += entry.originalSize;
    if (entries > 6500 || total > 250 * 1024 * 1024 || entry.originalSize > 15 * 1024 * 1024) tooLarge = true;
    return !tooLarge && !entry.name.split("/").includes("..") && !entry.name.startsWith("__MACOSX/") && /(?:Описание\.txt|\.(?:jpe?g|png|webp))$/i.test(entry.name);
  } });
  if (tooLarge) throw new Error("Архивът е прекалено голям след разархивиране. Раздели го на по-малки части.");
  const descriptions = Object.keys(data).filter(name => /(?:^|\/)Описание\.txt$/i.test(name)).sort((a, b) => a.localeCompare(b, "bg", { numeric: true }));
  if (!descriptions.length) throw new Error("Не намерих Описание.txt. Постави по един такъв файл във всяка папка с имот.");
  if (descriptions.length > 200) throw new Error("Внасяй до 200 имота с един архив.");
  const identities = new Set<string>();
  return descriptions.map(name => {
    const directory = name.slice(0, name.lastIndexOf("/") + 1);
    const folder = directory.replace(/\/$/, "") || file.name;
    const photos = Object.keys(data).filter(path => path.startsWith(directory) && !path.slice(directory.length).includes("/") && /\.(jpe?g|png|webp)$/i.test(path)).sort((a, b) => a.localeCompare(b, "bg", { numeric: true })).map(path => new File([new Uint8Array(data[path])], path.split("/").at(-1)!, { type: /\.png$/i.test(path) ? "image/png" : /\.webp$/i.test(path) ? "image/webp" : "image/jpeg" }));
    try {
      if (data[name].length > 64_000) throw new Error("Описание.txt е прекалено дълъг.");
      const draft = parseBulkDescription(folder, strFromU8(data[name]));
      if (!photos.length || photos.length > 30) throw new Error("Нужни са между 1 и 30 снимки в папката.");
      const identity = bulkIdentity(draft);
      if (identities.has(identity)) throw new Error("Повторена обява в този архив.");
      identities.add(identity);
      return { folder, draft, photos, state: "ready", message: "Проверка…", selected: false };
    } catch (error) {
      return { folder, photos: [], state: "error", message: error instanceof Error ? error.message : "Невалидна обява.", selected: false };
    }
  });
}

export function BulkImport() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const running = useRef(false);
  const update = (folder: string, patch: Partial<Row>) => setRows(prev => prev.map(r => r.folder === folder ? { ...r, ...patch } : r));

  async function load(file?: File | File[]) {
    if (!file || running.current) return;
    running.current = true; setBusy(true); setError(""); setRows([]); setProgress("Прочитане на архива…");
    try {
      const parsed = Array.isArray(file) ? await readFolder(file) : await readArchive(file);
      const valid = parsed.filter(r => r.draft);
      for (let from = 0; from < valid.length; from += 20) {
        setProgress(`Проверка за дублиране: ${Math.min(from + 20, valid.length)} от ${valid.length}`);
        const results = await previewBulkImport(valid.slice(from, from + 20).map(r => r.draft!));
        for (const result of results) Object.assign(parsed.find(r => r.folder === result.folder)!, result);
      }
      let selected = 0;
      for (const row of parsed) row.selected = (row.state === "ready" || row.state === "resume") && selected++ < 10;
      setRows(parsed); setProgress("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Архивът не може да се прочете."); setProgress("");
    } finally { setBusy(false); running.current = false; }
  }

  async function publish() {
    if (running.current) return;
    const selected = rows.filter(r => r.selected && r.draft && (r.state === "ready" || r.state === "resume" || r.state === "error"));
    if (!selected.length) return;
    running.current = true; setBusy(true); setError("");
    const db = createClient();
    try {
      for (let index = 0; index < selected.length; index++) {
        const row = selected[index];
        update(row.folder, { state: "uploading", message: "Подготовка…" });
        try {
          const { id, ownerId } = await prepareBulkListing(row.draft!);
          let done = 0;
          const names: string[] = new Array(row.photos.length);
          for (let from = 0; from < row.photos.length; from += 3) {
            const results = await Promise.allSettled(row.photos.slice(from, from + 3).map(async (file, offset) => {
              const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
              const name = `bulk-${from + offset}-${digest}.jpg`;
              names[from + offset] = name;
              const photo = await preparePhoto(file);
              const { error } = await db.storage.from("listing-photos").upload(`${ownerId}/${id}/${name}`, photo, { upsert: false, contentType: photo.type, cacheControl: "3600" });
              // Immutable names preserve already-published files even if two tabs import together.
              if (error && error.message !== "The resource already exists" && !("statusCode" in error && String(error.statusCode) === "409")) throw new Error(error.message);
              done++; update(row.folder, { message: `Качени ${done}/${row.photos.length} снимки` });
            }));
            const failed = results.find(r => r.status === "rejected");
            if (failed?.status === "rejected") throw failed.reason;
          }
          await finishBulkListing(id, names);
          update(row.folder, { state: "done", message: "Публикувана", listingId: id, selected: false });
        } catch (error) {
          update(row.folder, { state: "error", message: error instanceof Error ? error.message : "Внасянето не успя. Опитай отново." });
        }
        setProgress(`Обработени ${index + 1} от ${selected.length} избрани обяви`);
      }
    } finally { setBusy(false); running.current = false; }
  }

  const selected = rows.filter(r => r.selected).length;
  const published = rows.filter(r => r.state === "done").length;
  return (
    <section className="mt-8">
      <div className="grid gap-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 sm:grid-cols-2">
        <label className="block">
          <span className="block font-semibold text-slate-900">Избери папка с имотите</span>
          <span className="mt-1 block text-sm text-slate-600">До 200 имота и 600 MB. Снимките се качват постепенно.</span>
          <input type="file" aria-label="Папка с имоти" multiple {...{ webkitdirectory: "", directory: "" }} disabled={busy} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; if (files.length) void load(files); }} className="mt-4 block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:font-semibold file:text-white disabled:opacity-50" />
        </label>
        <label className="block">
          <span className="block font-semibold text-slate-900">Или избери ZIP</span>
          <span className="mt-1 block text-sm text-slate-600">До 80 MB. Запази отделната папка на всеки имот в архива.</span>
          <input type="file" aria-label="ZIP с имоти" accept=".zip,application/zip" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; void load(file); }} className="mt-4 block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:font-semibold file:text-white disabled:opacity-50" />
        </label>
      </div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
      <p role="status" aria-live="polite" className="my-4 text-sm text-slate-600">{progress || (rows.length ? `${rows.length} обяви · ${selected} избрани · ${published} публикувани` : "Първо ще видиш данните. Изборът на папка или архив сам по себе си не публикува обяви.")}</p>
      {rows.length > 0 && <>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy} onClick={() => setRows(prev => { let n = 0; return prev.map(r => ({ ...r, selected: !!r.draft && (r.state === "ready" || r.state === "resume") && n++ < 10 })); })} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">Избери първите 10</button>
          <button type="button" disabled={busy} onClick={() => setRows(prev => prev.map(r => ({ ...r, selected: !!r.draft && (r.state === "ready" || r.state === "resume") })))} className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-50">Избери всички готови</button>
          <button type="button" disabled={busy || !selected} onClick={() => void publish()} className="rounded-lg bg-emerald-700 px-5 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{busy ? "Внасяне…" : `Внеси избраните (${selected})`}</button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Избор</th><th className="p-3">Имот</th><th className="p-3">Цена</th><th className="p-3">Площ</th><th className="p-3">Снимки</th><th className="p-3">Състояние</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={row.folder}>
              <td className="p-3"><input type="checkbox" aria-label={`Избери ${row.folder}`} checked={row.selected} disabled={busy || !row.draft || row.state === "done" || row.state === "duplicate"} onChange={e => update(row.folder, { selected: e.target.checked })} className="size-4 accent-emerald-700" /></td>
              <td className="max-w-sm p-3"><div className="font-medium text-slate-900">{row.draft?.title ?? row.folder}</div><div className="mt-1 text-xs text-slate-500">{row.folder}</div></td>
              <td className="whitespace-nowrap p-3">{row.draft ? `${row.draft.price.toLocaleString("bg-BG")} €${row.draft.type === "rent" ? "/мес." : ""}` : "—"}</td>
              <td className="p-3">{row.draft ? `${row.draft.area} м²` : "—"}</td><td className="p-3">{row.photos.length}</td>
              <td className={`max-w-xs p-3 ${row.state === "error" ? "text-red-700" : row.state === "done" ? "text-emerald-700" : "text-slate-600"}`}>{row.message}{row.listingId && <a href={`/listings/${row.listingId}`} target="_blank" rel="noreferrer" className="mt-1 block font-medium underline underline-offset-2">Виж обявата</a>}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="mt-4 text-sm text-slate-500">Остави страницата отворена до края. При прекъсване избери същата папка или ZIP отново — готовите обяви се пропускат, а незавършените могат да се довършат.</p>
      </>}
    </section>
  );
}

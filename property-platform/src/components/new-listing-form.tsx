"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createListing } from "@/lib/actions/listings";
import {
  DEAL_TYPE_LABELS,
  HEATING_OPTIONS,
  MAX_LISTING_PHOTOS,
  MIN_LISTING_PHOTOS_HINT,
  PROPERTY_TYPE_LABELS,
} from "@/lib/listing-labels";
import {
  SettlementSearch,
  type Settlement,
} from "@/components/settlement-search";
import type {
  ListingDealType,
  PropertyType,
} from "@/lib/types/database";
import type { ListingDraft } from "@/lib/listing-draft";
import { shrinkPhoto } from "@/lib/shrink-image";

type Neighborhood = { id: string; city_id: string; name: string };

export function NewListingForm({
  userId,
  neighborhoods,
  profilePhone,
  draft = null,
  initialPhotos = [],
  draftsLeft = null,
}: {
  userId: string;
  neighborhoods: Neighborhood[];
  profilePhone: string;
  /**
   * Черновата от въпросника (`ai-listing-wizard.tsx`). Формата е същата —
   * само полетата идват попълнени и човекът ги поправя, вместо да ги
   * пише от нулата.
   */
  draft?: ListingDraft | null;
  initialPhotos?: File[];
  /** Колко пъти още профилът може да ползва помощника; null = не знаем. */
  draftsLeft?: number | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<ListingDealType>(draft?.type ?? "rent");
  const [propertyType, setPropertyType] = useState<PropertyType>(
    draft?.propertyType ?? "apartment",
  );
  const [settlement, setSettlement] = useState<Settlement | null>(
    draft?.settlement ?? null,
  );
  const [neighborhoodId, setNeighborhoodId] = useState(
    draft?.neighborhoodId ?? "",
  );
  const cityId = settlement?.id ?? "";
  const [price, setPrice] = useState(draft?.price ?? "");
  const [areaSqm, setAreaSqm] = useState(draft?.areaSqm ?? "");
  const [rooms, setRooms] = useState(draft?.rooms ?? "");
  const [floor, setFloor] = useState(draft?.floor ?? "");
  const [yearBuilt, setYearBuilt] = useState(draft?.yearBuilt ?? "");
  const [heating, setHeating] = useState(draft?.heating ?? "");
  const [hasParking, setHasParking] = useState(draft?.hasParking ?? false);
  const [hasElevator, setHasElevator] = useState(draft?.hasElevator ?? false);
  const [hasTerrace, setHasTerrace] = useState(draft?.hasTerrace ?? false);
  const [isFurnished, setIsFurnished] = useState(draft?.isFurnished ?? false);
  const [title, setTitle] = useState(draft?.title ?? "");
  const [description, setDescription] = useState(draft?.description ?? "");
  const [address, setAddress] = useState(draft?.address ?? "");
  const [videoUrl, setVideoUrl] = useState("");
  const [photos, setPhotos] = useState<File[]>(initialPhotos);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const filteredNeighborhoods = useMemo(
    () => neighborhoods.filter((n) => n.city_id === cityId),
    [neighborhoods, cityId],
  );

  const previews = useMemo(
    () => photos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photos],
  );

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList) return;
    const newFiles = Array.from(fileList);
    setPhotos((prev) => [...prev, ...newFiles].slice(0, MAX_LISTING_PHOTOS));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const priceNum = Number(price);
    const areaNum = Number(areaSqm);
    if (!title.trim()) {
      setError("Въведете заглавие на обявата.");
      return;
    }
    if (!address.trim()) {
      setError("Въведете адрес на имота.");
      return;
    }
    if (!profilePhone.trim()) {
      setError("Добави телефон в профила си, преди да публикуваш обява.");
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setError("Въведете валидна цена.");
      return;
    }
    if (!Number.isFinite(areaNum) || areaNum <= 0) {
      setError("Въведете валидна квадратура.");
      return;
    }

    setSubmitting(true);
    setUploadProgress({ done: 0, total: photos.length });

    try {
      const supabase = createClient();
      const listingId = crypto.randomUUID();
      const photoUrls: string[] = [];

      for (let i = 0; i < photos.length; i++) {
        const file = photos[i];
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${userId}/${listingId}/${i}-${safeName}`;

        // Кадърът от телефона е 3–4 MB; качва се бавно и после всеки
        // посетител го тегли цял. Смаляваме го, преди да тръгне.
        const { error: uploadError } = await supabase.storage
          .from("listing-photos")
          .upload(path, await shrinkPhoto(file), { upsert: true });

        if (uploadError) {
          throw new Error(`Грешка при качване на снимка: ${uploadError.message}`);
        }

        const { data } = supabase.storage
          .from("listing-photos")
          .getPublicUrl(path);
        photoUrls.push(data.publicUrl);
        setUploadProgress({ done: i + 1, total: photos.length });
      }

      await createListing({
        id: listingId,
        type,
        propertyType,
        cityId: cityId || null,
        neighborhoodId: neighborhoodId || null,
        price: priceNum,
        areaSqm: areaNum,
        rooms: rooms ? Number(rooms) : null,
        floor: floor ? Number(floor) : null,
        yearBuilt: yearBuilt ? Number(yearBuilt) : null,
        heating: heating || null,
        hasParking,
        hasElevator,
        hasTerrace,
        isFurnished,
        title,
        description: description || null,
        address,
        photoUrls,
        videoUrl: videoUrl.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Възникна грешка.");
      setSubmitting(false);
      setUploadProgress(null);
      return;
    }

    router.refresh();
  }

  const inputClass =
    "rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900";
  const labelClass = "text-sm font-medium text-slate-700";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {draft && (
        // Черновата е предложение, не готова обява — казваме го ясно и
        // изброяваме какво помощникът не е успял да разбере, за да знае
        // човекът къде точно да погледне.
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p className="font-medium">
            Попълних каквото разбрах. Провери и поправи, преди да публикуваш.
          </p>
          {draftsLeft !== null && (
            <p className="mt-1 text-emerald-800">
              {draftsLeft > 0
                ? `Остават ти още ${draftsLeft} попълвания с помощника. Ръчното качване е без ограничение.`
                : "Това беше последното ти попълване с помощника. Обяви се качват и ръчно, без ограничение."}
            </p>
          )}
          {draft.notes.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-emerald-800">
              {draft.notes.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Тип сделка</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ListingDealType)}
            className={inputClass}
          >
            {Object.entries(DEAL_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Тип имот</label>
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value as PropertyType)}
            className={inputClass}
          >
            {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Населено място</label>
          <SettlementSearch
            selected={settlement}
            placeholder="Започни да пишеш (напр. Вар...)"
            onSelect={(next) => {
              setSettlement(next);
              setNeighborhoodId("");
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>Квартал</label>
          <select
            value={neighborhoodId}
            onChange={(e) => setNeighborhoodId(e.target.value)}
            disabled={!cityId}
            className={inputClass}
          >
            <option value="">Изберете квартал</option>
            {filteredNeighborhoods.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className={labelClass}>Адрес</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Напр. ул. Иван Вазов 15"
            className={inputClass}
            required
          />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Цена (€)</label>
          <input
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Кв.м</label>
          <input
            type="number"
            min="0"
            value={areaSqm}
            onChange={(e) => setAreaSqm(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Стаи</label>
          <input
            type="number"
            min="0"
            value={rooms}
            onChange={(e) => setRooms(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Етаж</label>
          <input
            type="number"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Година на строеж</label>
          <input
            type="number"
            min="1800"
            max="2100"
            value={yearBuilt}
            onChange={(e) => setYearBuilt(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1 sm:col-span-2">
          <label className={labelClass}>Отопление</label>
          <select
            value={heating}
            onChange={(e) => setHeating(e.target.value)}
            className={inputClass}
          >
            <option value="">Не е посочено</option>
            {HEATING_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="flex flex-wrap gap-4">
        {[
          { label: "Паркинг", value: hasParking, set: setHasParking },
          { label: "Асансьор", value: hasElevator, set: setHasElevator },
          { label: "Тераса", value: hasTerrace, set: setHasTerrace },
          { label: "Обзаведен", value: isFurnished, set: setIsFurnished },
        ].map(({ label, value, set }) => (
          <label
            key={label}
            className="flex items-center gap-2 text-sm text-slate-700"
          >
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => set(e.target.checked)}
              className="h-4 w-4"
            />
            {label}
          </label>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Заглавие</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Напр. Тристаен апартамент до метро"
            className={inputClass}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Телефон за връзка</label>
          {profilePhone ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
              {profilePhone}{" "}
              <Link
                href="/dashboard/profile"
                className="text-sm font-medium text-slate-500 underline hover:text-slate-700"
              >
                Промени в профила
              </Link>
            </p>
          ) : (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
              Нямаш добавен телефон.{" "}
              <Link
                href="/dashboard/profile"
                className="font-medium underline"
              >
                Добави го в профила си
              </Link>
              , преди да публикуваш.
            </p>
          )}
          <p className="text-xs text-slate-400">
            Един телефон за всичките ти обяви — не се задава поотделно.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>Линк към видео (по избор)</label>
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://youtube.com/..."
            className={inputClass}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <label className={labelClass}>
          Снимки ({photos.length}/{MAX_LISTING_PHOTOS}, незадължително)
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFilesSelected(e.target.files)}
          className="text-sm"
        />
        <p className="text-xs text-slate-400">
          Препоръчваме поне {MIN_LISTING_PHOTOS_HINT} снимки — обявите със
          снимки получават повече интерес.
        </p>
        {previews.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {previews.map((p, i) => (
              <div key={i} className="group relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt=""
                  className="h-full w-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !profilePhone.trim()}
        className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
      >
        {submitting
          ? uploadProgress
            ? `Качване на снимки (${uploadProgress.done}/${uploadProgress.total})…`
            : "Публикуване…"
          : "Публикувай обявата"}
      </button>
    </form>
  );
}

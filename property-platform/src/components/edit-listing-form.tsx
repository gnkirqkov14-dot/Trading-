"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateListing } from "@/lib/actions/listings";
import {
  DEAL_TYPE_LABELS,
  HEATING_OPTIONS,
  MAX_LISTING_PHOTOS,
  MIN_LISTING_PHOTOS,
  PROPERTY_TYPE_LABELS,
} from "@/lib/listing-labels";
import type {
  ListingDealType,
  PropertyType,
} from "@/lib/types/database";

type City = { id: string; name: string; region: string };
type Neighborhood = { id: string; city_id: string; name: string };

export function EditListingForm({
  listingId,
  userId,
  cities,
  neighborhoods,
  initial,
}: {
  listingId: string;
  userId: string;
  cities: City[];
  neighborhoods: Neighborhood[];
  initial: {
    type: ListingDealType;
    propertyType: PropertyType;
    cityId: string | null;
    neighborhoodId: string | null;
    price: number;
    areaSqm: number;
    rooms: number | null;
    floor: number | null;
    yearBuilt: number | null;
    heating: string | null;
    hasParking: boolean;
    hasElevator: boolean;
    hasTerrace: boolean;
    isFurnished: boolean;
    title: string;
    description: string | null;
    videoUrl: string | null;
    photoUrls: string[];
  };
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<ListingDealType>(initial.type);
  const [propertyType, setPropertyType] = useState<PropertyType>(
    initial.propertyType,
  );
  const [cityId, setCityId] = useState(initial.cityId ?? "");
  const [neighborhoodId, setNeighborhoodId] = useState(
    initial.neighborhoodId ?? "",
  );
  const [price, setPrice] = useState(String(initial.price));
  const [areaSqm, setAreaSqm] = useState(String(initial.areaSqm));
  const [rooms, setRooms] = useState(initial.rooms ? String(initial.rooms) : "");
  const [floor, setFloor] = useState(
    initial.floor !== null ? String(initial.floor) : "",
  );
  const [yearBuilt, setYearBuilt] = useState(
    initial.yearBuilt ? String(initial.yearBuilt) : "",
  );
  const [heating, setHeating] = useState(initial.heating ?? "");
  const [hasParking, setHasParking] = useState(initial.hasParking);
  const [hasElevator, setHasElevator] = useState(initial.hasElevator);
  const [hasTerrace, setHasTerrace] = useState(initial.hasTerrace);
  const [isFurnished, setIsFurnished] = useState(initial.isFurnished);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl ?? "");

  const [keptPhotoUrls, setKeptPhotoUrls] = useState<string[]>(
    initial.photoUrls,
  );
  const [newPhotos, setNewPhotos] = useState<File[]>([]);

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

  const newPreviews = useMemo(
    () => newPhotos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [newPhotos],
  );

  const totalPhotoCount = keptPhotoUrls.length + newPhotos.length;

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList) return;
    const newFiles = Array.from(fileList);
    setNewPhotos((prev) =>
      [...prev, ...newFiles].slice(
        0,
        Math.max(0, MAX_LISTING_PHOTOS - keptPhotoUrls.length),
      ),
    );
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeKeptPhoto(url: string) {
    setKeptPhotoUrls((prev) => prev.filter((u) => u !== url));
  }

  function removeNewPhoto(index: number) {
    setNewPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (totalPhotoCount < MIN_LISTING_PHOTOS) {
      setError(`Качете поне ${MIN_LISTING_PHOTOS} снимки.`);
      return;
    }
    const priceNum = Number(price);
    const areaNum = Number(areaSqm);
    if (!title.trim()) {
      setError("Въведете заглавие на обявата.");
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
    setUploadProgress({ done: 0, total: newPhotos.length });

    try {
      const supabase = createClient();
      const newPhotoUrls: string[] = [];

      for (let i = 0; i < newPhotos.length; i++) {
        const file = newPhotos[i];
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${userId}/${listingId}/${Date.now()}-${i}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("listing-photos")
          .upload(path, file, { upsert: true });

        if (uploadError) {
          throw new Error(`Грешка при качване на снимка: ${uploadError.message}`);
        }

        const { data } = supabase.storage
          .from("listing-photos")
          .getPublicUrl(path);
        newPhotoUrls.push(data.publicUrl);
        setUploadProgress({ done: i + 1, total: newPhotos.length });
      }

      await updateListing({
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
        videoUrl: videoUrl.trim() || null,
        keepPhotoUrls: keptPhotoUrls,
        newPhotoUrls,
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
          <label className={labelClass}>Град</label>
          <select
            value={cityId}
            onChange={(e) => {
              setCityId(e.target.value);
              setNeighborhoodId("");
            }}
            className={inputClass}
          >
            <option value="">Изберете град</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
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
          Снимки ({totalPhotoCount}/{MAX_LISTING_PHOTOS}, минимум{" "}
          {MIN_LISTING_PHOTOS})
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFilesSelected(e.target.files)}
          className="text-sm"
        />
        {(keptPhotoUrls.length > 0 || newPreviews.length > 0) && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {keptPhotoUrls.map((url) => (
              <div key={url} className="group relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="h-full w-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeKeptPhoto(url)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ))}
            {newPreviews.map((p, i) => (
              <div key={p.url} className="group relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt=""
                  className="h-full w-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeNewPhoto(i)}
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
        disabled={submitting}
        className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
      >
        {submitting
          ? uploadProgress && uploadProgress.total > 0
            ? `Качване на снимки (${uploadProgress.done}/${uploadProgress.total})…`
            : "Запазване…"
          : "Запази промените"}
      </button>
    </form>
  );
}

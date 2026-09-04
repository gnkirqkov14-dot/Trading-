"use client";

import { useMemo, useRef, useState } from "react";
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
import type {
  ListingDealType,
  PropertyType,
} from "@/lib/types/database";

type City = { id: string; name: string; region: string };
type Neighborhood = { id: string; city_id: string; name: string };

export function NewListingForm({
  userId,
  cities,
  neighborhoods,
  initialPhone = "",
}: {
  userId: string;
  cities: City[];
  neighborhoods: Neighborhood[];
  initialPhone?: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<ListingDealType>("rent");
  const [propertyType, setPropertyType] = useState<PropertyType>("apartment");
  const [cityId, setCityId] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [price, setPrice] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [rooms, setRooms] = useState("");
  const [floor, setFloor] = useState("");
  const [yearBuilt, setYearBuilt] = useState("");
  const [heating, setHeating] = useState("");
  const [hasParking, setHasParking] = useState(false);
  const [hasElevator, setHasElevator] = useState(false);
  const [hasTerrace, setHasTerrace] = useState(false);
  const [isFurnished, setIsFurnished] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState(initialPhone);
  const [videoUrl, setVideoUrl] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);

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
    if (!phone.trim()) {
      setError("Въведете телефон за връзка.");
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

        const { error: uploadError } = await supabase.storage
          .from("listing-photos")
          .upload(path, file, { upsert: true });

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
        phone,
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
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08xx xxx xxx"
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
        disabled={submitting}
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

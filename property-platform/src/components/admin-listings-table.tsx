"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  adminBanAgencyListing,
  adminDeleteListing,
  adminSetListingLimit,
  adminSetListingStatus,
} from "@/lib/actions/admin";
import {
  DEAL_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
  STATUS_LABELS,
  formatPrice,
} from "@/lib/listing-labels";
import type {
  ListingDealType,
  ListingStatus,
  PropertyType,
} from "@/lib/types/database";

const FIELD_LABELS: Record<string, string> = {
  type: "Сделка",
  property_type: "Тип имот",
  city_id: "Град",
  neighborhood_id: "Квартал",
  lat: "Ширина (lat)",
  lng: "Дължина (lng)",
  price: "Цена",
  area_sqm: "Кв.м",
  rooms: "Стаи",
  floor: "Етаж",
  year_built: "Година на строеж",
  heating: "Отопление",
  has_parking: "Паркинг",
  has_elevator: "Асансьор",
  has_terrace: "Тераса",
  is_furnished: "Обзавеждане",
  title: "Заглавие",
  description: "Описание",
  address: "Адрес",
  phone: "Телефон",
  status: "Статус",
};

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "price") return formatPrice(Number(value));
  if (field === "status")
    return STATUS_LABELS[value as ListingStatus] ?? String(value);
  if (field === "type")
    return DEAL_TYPE_LABELS[value as ListingDealType] ?? String(value);
  if (field === "property_type")
    return PROPERTY_TYPE_LABELS[value as PropertyType] ?? String(value);
  if (typeof value === "boolean") return value ? "Да" : "Не";
  return String(value);
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("bg-BG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export type AdminEditLogEntry = {
  id: string;
  changedAt: string;
  changedByOwner: boolean;
  changedFields: Record<string, { old: unknown; new: unknown }>;
};

export type AdminListing = {
  id: string;
  userId: string;
  title: string;
  status: ListingStatus;
  price: number;
  phone: string;
  email: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  profiles: { name: string | null } | null;
  reportCount: number;
  ownerListingCount: number;
  ownerListingLimit: number;
  editLog: AdminEditLogEntry[];
};

export function AdminListingsTable({
  listings,
  phoneCounts,
  suspectedAgencyThreshold,
}: {
  listings: AdminListing[];
  phoneCounts: Record<string, number>;
  suspectedAgencyThreshold: number;
}) {
  if (listings.length === 0) {
    return <p className="text-slate-500">Няма обяви.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-slate-200 rounded-2xl border border-slate-200">
      {listings.map((listing) => (
        <AdminListingRow
          key={listing.id}
          listing={listing}
          phoneCount={phoneCounts[listing.phone] ?? 1}
          suspectedAgency={
            (phoneCounts[listing.phone] ?? 1) >= suspectedAgencyThreshold
          }
        />
      ))}
    </ul>
  );
}

function AdminListingRow({
  listing,
  phoneCount,
  suspectedAgency,
}: {
  listing: AdminListing;
  phoneCount: number;
  suspectedAgency: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(listing.status);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [banned, setBanned] = useState(false);
  const [ownerListingLimit, setOwnerListingLimit] = useState(
    listing.ownerListingLimit,
  );

  function toggle() {
    const next: ListingStatus = status === "inactive" ? "active" : "inactive";
    setError(null);
    startTransition(async () => {
      try {
        await adminSetListingStatus(listing.id, next);
        setStatus(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Грешка.");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Да изтрия ли обявата "${listing.title}"?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await adminDeleteListing(listing.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Грешка.");
      }
    });
  }

  function handleBan() {
    if (
      !confirm(
        `Да блокирам ли телефона и имейла на собственика на "${listing.title}"? ` +
          "Няма да могат да публикуват нови обяви или да се регистрират отново, " +
          "и всичките им текущи обяви ще бъдат деактивирани. Това е трудно обратимо.",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      try {
        await adminBanAgencyListing(listing.id);
        setBanned(true);
        setStatus("inactive");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Грешка.");
      }
    });
  }

  function handleChangeLimit() {
    const input = prompt(
      `Нов лимит обяви за ${listing.profiles?.name ?? "този потребител"} ` +
        `(текущ: ${ownerListingLimit}, има ${listing.ownerListingCount} обяви в момента):`,
      String(ownerListingLimit),
    );
    if (input === null) return;
    const newLimit = Number(input);
    if (!Number.isInteger(newLimit) || newLimit < 0) {
      setError("Невалиден лимит — въведи цяло число, 0 или повече.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await adminSetListingLimit(listing.userId, newLimit);
        setOwnerListingLimit(newLimit);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Грешка.");
      }
    });
  }

  const wasEdited = listing.updatedAt !== listing.createdAt;

  return (
    <li
      className={`flex flex-col gap-2 p-4 ${suspectedAgency ? "bg-amber-50" : ""}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/listings/${listing.id}`}
              className="font-medium text-slate-900 hover:underline"
            >
              {listing.title}
            </Link>
            {suspectedAgency && (
              <span className="inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900">
                ⚠ Телефон в {phoneCount} обяви
              </span>
            )}
            {listing.reportCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                🚩 {listing.reportCount}{" "}
                {listing.reportCount === 1 ? "доклад" : "доклада"}
              </span>
            )}
            {banned && (
              <span className="inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-white">
                Блокирана
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {listing.profiles?.name ?? "Непознат собственик"} ·{" "}
            {listing.phone} · {listing.email ?? "няма имейл"} ·{" "}
            {formatPrice(listing.price)} · {STATUS_LABELS[status]}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Качена: {formatDateTime(listing.createdAt)}
            {wasEdited && <> · Редактирана: {formatDateTime(listing.updatedAt)}</>}
            {" · "}
            {listing.viewCount} {listing.viewCount === 1 ? "гледане" : "гледания"}
            {" · "}
            <span
              className={
                listing.ownerListingCount >= ownerListingLimit
                  ? "font-medium text-amber-600"
                  : undefined
              }
            >
              {listing.ownerListingCount}/{ownerListingLimit} обяви на
              собственика
            </span>{" "}
            <button
              type="button"
              onClick={handleChangeLimit}
              disabled={isPending}
              className="underline hover:text-slate-700"
            >
              (промени лимита)
            </button>
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggle}
            disabled={isPending}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {status === "inactive" ? "Активирай" : "Деактивирай"}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Изтрий
          </button>
          <button
            type="button"
            onClick={handleBan}
            disabled={isPending || banned}
            className="rounded-lg border border-red-600 bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {banned ? "Блокирана" : "Блокирай агенция"}
          </button>
        </div>
      </div>

      {listing.editLog.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
          >
            {showHistory ? "Скрий" : "Покажи"} история на редакциите (
            {listing.editLog.length})
          </button>
          {showHistory && (
            <ul className="mt-2 flex flex-col gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              {listing.editLog.map((entry) => (
                <li key={entry.id}>
                  <span className="font-medium text-slate-800">
                    {formatDateTime(entry.changedAt)}
                  </span>{" "}
                  — {entry.changedByOwner ? "от собственика" : "от admin"}:{" "}
                  {Object.entries(entry.changedFields)
                    .map(([field, { old: oldVal, new: newVal }]) => {
                      const label = FIELD_LABELS[field] ?? field;
                      return `${label}: ${formatFieldValue(field, oldVal)} → ${formatFieldValue(field, newVal)}`;
                    })
                    .join("; ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  confirmListingActive,
  deleteListing,
  setListingStatus,
} from "@/lib/actions/listings";
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

export type MyListing = {
  id: string;
  title: string;
  type: ListingDealType;
  property_type: PropertyType;
  price: number;
  status: ListingStatus;
  last_confirmed_at: string;
};

const CONFIRM_WINDOW_DAYS = 7;

function daysSince(dateString: string) {
  const ms = Date.now() - new Date(dateString).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function MyListings({ listings }: { listings: MyListing[] }) {
  if (listings.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
        Нямаш публикувани обяви още.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-slate-200 rounded-2xl border border-slate-200">
      {listings.map((listing) => (
        <MyListingRow key={listing.id} listing={listing} />
      ))}
    </ul>
  );
}

function MyListingRow({ listing }: { listing: MyListing }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(listing.status);
  const [lastConfirmedAt, setLastConfirmedAt] = useState(
    listing.last_confirmed_at,
  );
  const [error, setError] = useState<string | null>(null);

  const daysLeft = CONFIRM_WINDOW_DAYS - daysSince(lastConfirmedAt);

  function toggleStatus() {
    const next = status === "active" ? "inactive" : "active";
    setError(null);
    startTransition(async () => {
      try {
        await setListingStatus(listing.id, next);
        setStatus(next);
        setLastConfirmedAt(new Date().toISOString());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Грешка.");
      }
    });
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await confirmListingActive(listing.id);
        setStatus("active");
        setLastConfirmedAt(new Date().toISOString());
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
        await deleteListing(listing.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Грешка.");
      }
    });
  }

  return (
    <li className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <Link
          href={`/listings/${listing.id}`}
          className="font-medium text-slate-900 hover:underline"
        >
          {listing.title}
        </Link>
        <p className="text-sm text-slate-500">
          {PROPERTY_TYPE_LABELS[listing.property_type]} ·{" "}
          {DEAL_TYPE_LABELS[listing.type]} ·{" "}
          {formatPrice(listing.price)} ·{" "}
          <span
            className={
              status === "active" ? "text-emerald-600" : "text-amber-600"
            }
          >
            {STATUS_LABELS[status]}
          </span>
        </p>
        {status === "active" && (
          <p className="text-xs text-slate-400">
            {daysLeft > 0
              ? `Потвърди до ${daysLeft} ${daysLeft === 1 ? "ден" : "дни"}, за да не изтече.`
              : "Изтича скоро — потвърди, че е още активна."}
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {(status === "active" || status === "expired") && (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="rounded-lg border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            Обявата е още активна
          </button>
        )}
        <button
          type="button"
          onClick={toggleStatus}
          disabled={isPending}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {status === "active" ? "Деактивирай" : "Активирай"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Изтрий
        </button>
      </div>
    </li>
  );
}

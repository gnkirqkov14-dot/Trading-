"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteListing, setListingStatus } from "@/lib/actions/listings";
import {
  DEAL_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
  STATUS_LABELS,
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
};

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
  const [error, setError] = useState<string | null>(null);

  function toggleStatus() {
    const next = status === "active" ? "inactive" : "active";
    setError(null);
    startTransition(async () => {
      try {
        await setListingStatus(listing.id, next);
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
          {listing.price.toLocaleString("bg-BG")} лв. ·{" "}
          <span
            className={
              status === "active" ? "text-emerald-600" : "text-amber-600"
            }
          >
            {STATUS_LABELS[status]}
          </span>
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={toggleStatus}
          disabled={isPending || status === "expired"}
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

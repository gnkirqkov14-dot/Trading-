"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { adminDeleteListing, adminSetListingStatus } from "@/lib/actions/admin";
import { STATUS_LABELS } from "@/lib/listing-labels";
import type { ListingStatus } from "@/lib/types/database";

export type AdminListing = {
  id: string;
  title: string;
  status: ListingStatus;
  price: number;
  profiles: { name: string | null } | null;
};

export function AdminListingsTable({
  listings,
}: {
  listings: AdminListing[];
}) {
  if (listings.length === 0) {
    return <p className="text-slate-500">Няма обяви.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-slate-200 rounded-2xl border border-slate-200">
      {listings.map((listing) => (
        <AdminListingRow key={listing.id} listing={listing} />
      ))}
    </ul>
  );
}

function AdminListingRow({ listing }: { listing: AdminListing }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(listing.status);
  const [error, setError] = useState<string | null>(null);

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
          {listing.profiles?.name ?? "Непознат собственик"} ·{" "}
          {listing.price.toLocaleString("bg-BG")} лв. · {STATUS_LABELS[status]}
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
      </div>
    </li>
  );
}

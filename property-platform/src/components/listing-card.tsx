import Link from "next/link";
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

export type ListingCardData = {
  id: string;
  type: ListingDealType;
  property_type: PropertyType;
  price: number;
  area_sqm: number;
  rooms: number | null;
  status: ListingStatus;
  title: string;
  cities: { name: string } | null;
  neighborhoods: { name: string } | null;
  listing_photos: { url: string; position: number }[];
};

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const coverPhoto = [...listing.listing_photos].sort(
    (a, b) => a.position - b.position,
  )[0];

  const location = [listing.neighborhoods?.name, listing.cities?.name]
    .filter(Boolean)
    .join(", ");

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:shadow-md"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {coverPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverPhoto.url}
            alt={listing.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            Няма снимка
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-bold text-slate-900">
            {listing.price.toLocaleString("bg-BG")} лв.
            {listing.type === "rent" && (
              <span className="text-sm font-normal text-slate-500">
                /мес.
              </span>
            )}
          </span>
          {listing.status !== "active" && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {STATUS_LABELS[listing.status]}
            </span>
          )}
        </div>

        <p className="truncate font-medium text-slate-900">{listing.title}</p>

        <p className="text-sm text-slate-500">
          {PROPERTY_TYPE_LABELS[listing.property_type]} ·{" "}
          {DEAL_TYPE_LABELS[listing.type]}
        </p>

        <p className="text-sm text-slate-500">
          {listing.area_sqm} м²
          {listing.rooms ? ` · ${listing.rooms} стаи` : ""}
          {location ? ` · ${location}` : ""}
        </p>
      </div>
    </Link>
  );
}

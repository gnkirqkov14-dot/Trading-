import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

type ListingDetail = {
  id: string;
  user_id: string;
  type: ListingDealType;
  property_type: PropertyType;
  price: number;
  area_sqm: number;
  rooms: number | null;
  floor: number | null;
  year_built: number | null;
  heating: string | null;
  has_parking: boolean;
  has_elevator: boolean;
  has_terrace: boolean;
  is_furnished: boolean;
  title: string;
  description: string | null;
  status: ListingStatus;
  cities: { name: string } | null;
  neighborhoods: { name: string } | null;
  listing_photos: { url: string; position: number }[];
  listing_videos: { url: string }[];
  profiles: { name: string | null } | null;
};

async function getListing(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(
      "*, cities(name), neighborhoods(name), listing_photos(url, position), listing_videos(url), profiles(name)",
    )
    .eq("id", id)
    .maybeSingle();

  return data as unknown as ListingDetail | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) return { title: "Обява" };

  const location = [listing.neighborhoods?.name, listing.cities?.name]
    .filter(Boolean)
    .join(", ");
  const description = `${listing.price.toLocaleString("bg-BG")} лв. · ${listing.area_sqm} м²${location ? ` · ${location}` : ""}`;
  const coverPhoto = [...listing.listing_photos].sort(
    (a, b) => a.position - b.position,
  )[0];

  return {
    title: listing.title,
    description,
    openGraph: {
      title: listing.title,
      description,
      images: coverPhoto ? [coverPhoto.url] : undefined,
    },
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListing(id);

  if (!listing) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const photos = [...listing.listing_photos].sort(
    (a, b) => a.position - b.position,
  );
  const location = [listing.neighborhoods?.name, listing.cities?.name]
    .filter(Boolean)
    .join(", ");
  const video = listing.listing_videos[0];

  const facts: [string, string][] = [
    ["Тип имот", PROPERTY_TYPE_LABELS[listing.property_type]],
    ["Сделка", DEAL_TYPE_LABELS[listing.type]],
    ["Кв.м", `${listing.area_sqm} м²`],
  ];
  if (listing.rooms) facts.push(["Стаи", String(listing.rooms)]);
  if (listing.floor !== null) facts.push(["Етаж", String(listing.floor)]);
  if (listing.year_built)
    facts.push(["Година на строеж", String(listing.year_built)]);
  if (listing.heating) facts.push(["Отопление", listing.heating]);
  facts.push(["Паркинг", listing.has_parking ? "Да" : "Не"]);
  facts.push(["Асансьор", listing.has_elevator ? "Да" : "Не"]);
  facts.push(["Тераса", listing.has_terrace ? "Да" : "Не"]);
  facts.push(["Обзавеждане", listing.is_furnished ? "Обзаведен" : "Необзаведен"]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      {listing.status !== "active" && (
        <p className="mb-4 inline-block rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
          {STATUS_LABELS[listing.status]}
        </p>
      )}

      <h1 className="text-2xl font-semibold text-slate-900">
        {listing.title}
      </h1>
      {location && <p className="mt-1 text-slate-500">{location}</p>}

      <p className="mt-4 text-3xl font-bold text-slate-900">
        {listing.price.toLocaleString("bg-BG")} лв.
        {listing.type === "rent" && (
          <span className="text-lg font-normal text-slate-500">/мес.</span>
        )}
      </p>

      {photos.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.url}
              src={photo.url}
              alt={listing.title}
              className="aspect-square w-full rounded-lg object-cover"
            />
          ))}
        </div>
      )}

      {video && (
        <div className="mt-6">
          <a
            href={video.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-slate-900 underline"
          >
            Гледай видео
          </a>
        </div>
      )}

      <dl className="mt-8 grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 p-6 sm:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-wide text-slate-400">
              {label}
            </dt>
            <dd className="font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      {listing.description && (
        <div className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">Описание</h2>
          <p className="whitespace-pre-wrap text-slate-700">
            {listing.description}
          </p>
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-slate-200 p-6 text-center">
        {!user ? (
          <p className="text-slate-500">
            <Link href="/login" className="font-medium text-slate-900 underline">
              Влез
            </Link>{" "}
            за да пишеш на {listing.profiles?.name ?? "собственика"}.
          </p>
        ) : user.id === listing.user_id ? (
          <p className="text-slate-500">Това е твоя обява.</p>
        ) : (
          <Link
            href={`/dashboard/messages/${listing.id}/${listing.user_id}`}
            className="inline-block rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white hover:bg-slate-700"
          >
            Пиши на {listing.profiles?.name ?? "собственика"}
          </Link>
        )}
      </div>
    </div>
  );
}

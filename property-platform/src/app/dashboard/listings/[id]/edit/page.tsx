import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthedUser } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { EditListingForm } from "@/components/edit-listing-form";
import type {
  ListingDealType,
  PropertyType,
} from "@/lib/types/database";

type EditableListing = {
  id: string;
  user_id: string;
  type: ListingDealType;
  property_type: PropertyType;
  city_id: string | null;
  neighborhood_id: string | null;
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
  address: string;
  phone: string;
  listing_photos: { url: string; position: number }[];
  listing_videos: { url: string }[];
};

export const metadata: Metadata = { title: "Редакция на обява" };

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getAuthedUser();
  const supabase = await createClient();

  const [{ data: listingData }, { data: cities }, { data: neighborhoods }] =
    await Promise.all([
      supabase
        .from("listings")
        .select(
          "*, listing_photos(url, position), listing_videos(url)",
        )
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("cities").select("id, name, region").order("name"),
      supabase.from("neighborhoods").select("id, city_id, name").order("name"),
    ]);

  const listing = listingData as unknown as EditableListing | null;

  if (!listing) {
    notFound();
  }

  const photoUrls = [...listing.listing_photos]
    .sort((a, b) => a.position - b.position)
    .map((p) => p.url);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Редакция на обява</h1>
      <EditListingForm
        listingId={listing.id}
        userId={user.id}
        cities={cities ?? []}
        neighborhoods={neighborhoods ?? []}
        initial={{
          type: listing.type,
          propertyType: listing.property_type,
          cityId: listing.city_id,
          neighborhoodId: listing.neighborhood_id,
          price: listing.price,
          areaSqm: listing.area_sqm,
          rooms: listing.rooms,
          floor: listing.floor,
          yearBuilt: listing.year_built,
          heating: listing.heating,
          hasParking: listing.has_parking,
          hasElevator: listing.has_elevator,
          hasTerrace: listing.has_terrace,
          isFurnished: listing.is_furnished,
          title: listing.title,
          description: listing.description,
          address: listing.address,
          phone: listing.phone,
          videoUrl: listing.listing_videos[0]?.url ?? null,
          photoUrls,
        }}
      />
    </div>
  );
}

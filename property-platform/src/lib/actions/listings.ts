"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/dal";
import { MAX_LISTING_PHOTOS } from "@/lib/listing-labels";
import type {
  ListingDealType,
  PropertyType,
} from "@/lib/types/database";

export type CreateListingInput = {
  id: string;
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
  address: string;
  phone: string;
  photoUrls: string[];
  videoUrl: string | null;
};

export async function createListing(input: CreateListingInput) {
  const user = await getAuthedUser();

  if (!input.title.trim()) {
    throw new Error("Заглавието е задължително.");
  }
  if (!input.address.trim()) {
    throw new Error("Адресът е задължителен.");
  }
  if (!input.phone.trim()) {
    throw new Error("Телефонът за връзка е задължителен.");
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    throw new Error("Въведете валидна цена.");
  }
  if (!Number.isFinite(input.areaSqm) || input.areaSqm <= 0) {
    throw new Error("Въведете валидна квадратура.");
  }
  if (input.photoUrls.length > MAX_LISTING_PHOTOS) {
    throw new Error(`Обявата може да съдържа най-много ${MAX_LISTING_PHOTOS} снимки.`);
  }

  const supabase = await createClient();

  const { error: listingError } = await supabase.from("listings").insert({
    id: input.id,
    user_id: user.id,
    type: input.type,
    property_type: input.propertyType,
    city_id: input.cityId,
    neighborhood_id: input.neighborhoodId,
    price: input.price,
    area_sqm: input.areaSqm,
    rooms: input.rooms,
    floor: input.floor,
    year_built: input.yearBuilt,
    heating: input.heating,
    has_parking: input.hasParking,
    has_elevator: input.hasElevator,
    has_terrace: input.hasTerrace,
    is_furnished: input.isFurnished,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    address: input.address.trim(),
    phone: input.phone.trim(),
  });

  if (listingError) {
    throw new Error(`Грешка при запис на обявата: ${listingError.message}`);
  }

  const { error: photosError } = await supabase.from("listing_photos").insert(
    input.photoUrls.map((url, position) => ({
      listing_id: input.id,
      url,
      position,
    })),
  );

  if (photosError) {
    throw new Error(`Грешка при запис на снимките: ${photosError.message}`);
  }

  if (input.videoUrl) {
    await supabase
      .from("listing_videos")
      .insert({ listing_id: input.id, url: input.videoUrl });
  }

  revalidatePath("/listings");
  revalidatePath("/dashboard");
  redirect(`/listings/${input.id}`);
}

export type UpdateListingInput = {
  id: string;
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
  address: string;
  phone: string;
  videoUrl: string | null;
  keepPhotoUrls: string[];
  newPhotoUrls: string[];
};

function storagePathFromUrl(url: string) {
  const marker = "/listing-photos/";
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

export async function updateListing(input: UpdateListingInput) {
  const user = await getAuthedUser();

  if (!input.title.trim()) {
    throw new Error("Заглавието е задължително.");
  }
  if (!input.address.trim()) {
    throw new Error("Адресът е задължителен.");
  }
  if (!input.phone.trim()) {
    throw new Error("Телефонът за връзка е задължителен.");
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    throw new Error("Въведете валидна цена.");
  }
  if (!Number.isFinite(input.areaSqm) || input.areaSqm <= 0) {
    throw new Error("Въведете валидна квадратура.");
  }
  const totalPhotos = input.keepPhotoUrls.length + input.newPhotoUrls.length;
  if (totalPhotos > MAX_LISTING_PHOTOS) {
    throw new Error(`Обявата може да съдържа най-много ${MAX_LISTING_PHOTOS} снимки.`);
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("listings")
    .select("id")
    .eq("id", input.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    throw new Error("Обявата не е намерена.");
  }

  const { error: listingError } = await supabase
    .from("listings")
    .update({
      type: input.type,
      property_type: input.propertyType,
      city_id: input.cityId,
      neighborhood_id: input.neighborhoodId,
      price: input.price,
      area_sqm: input.areaSqm,
      rooms: input.rooms,
      floor: input.floor,
      year_built: input.yearBuilt,
      heating: input.heating,
      has_parking: input.hasParking,
      has_elevator: input.hasElevator,
      has_terrace: input.hasTerrace,
      is_furnished: input.isFurnished,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      address: input.address.trim(),
      phone: input.phone.trim(),
    })
    .eq("id", input.id)
    .eq("user_id", user.id);

  if (listingError) {
    throw new Error(`Грешка при запис на обявата: ${listingError.message}`);
  }

  const { data: currentPhotos } = await supabase
    .from("listing_photos")
    .select("id, url")
    .eq("listing_id", input.id);

  const photosToRemove = (currentPhotos ?? []).filter(
    (p) => !input.keepPhotoUrls.includes(p.url),
  );

  if (photosToRemove.length) {
    const paths = photosToRemove
      .map((p) => storagePathFromUrl(p.url))
      .filter((p): p is string => Boolean(p));

    if (paths.length) {
      await supabase.storage.from("listing-photos").remove(paths);
    }
    await supabase
      .from("listing_photos")
      .delete()
      .in(
        "id",
        photosToRemove.map((p) => p.id),
      );
  }

  await Promise.all(
    input.keepPhotoUrls.map((url, position) =>
      supabase
        .from("listing_photos")
        .update({ position })
        .eq("listing_id", input.id)
        .eq("url", url),
    ),
  );

  if (input.newPhotoUrls.length) {
    const startPosition = input.keepPhotoUrls.length;
    const { error: photosError } = await supabase
      .from("listing_photos")
      .insert(
        input.newPhotoUrls.map((url, i) => ({
          listing_id: input.id,
          url,
          position: startPosition + i,
        })),
      );

    if (photosError) {
      throw new Error(`Грешка при запис на снимките: ${photosError.message}`);
    }
  }

  await supabase.from("listing_videos").delete().eq("listing_id", input.id);
  if (input.videoUrl) {
    await supabase
      .from("listing_videos")
      .insert({ listing_id: input.id, url: input.videoUrl });
  }

  revalidatePath("/listings");
  revalidatePath(`/listings/${input.id}`);
  revalidatePath("/dashboard");
  redirect(`/listings/${input.id}`);
}

export async function setListingStatus(
  listingId: string,
  status: "active" | "inactive",
) {
  const user = await getAuthedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("listings")
    .update({ status, last_confirmed_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`Грешка при промяна на статуса: ${error.message}`);
  }

  revalidatePath("/listings");
  revalidatePath("/dashboard");
}

export async function confirmListingActive(listingId: string) {
  const user = await getAuthedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("listings")
    .update({ status: "active", last_confirmed_at: new Date().toISOString() })
    .eq("id", listingId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`Грешка при потвърждаване: ${error.message}`);
  }

  revalidatePath("/listings");
  revalidatePath("/dashboard");
}

export async function deleteListing(listingId: string) {
  const user = await getAuthedUser();
  const supabase = await createClient();

  const { data: photos } = await supabase
    .from("listing_photos")
    .select("url")
    .eq("listing_id", listingId);

  if (photos?.length) {
    const paths = photos
      .map((p) => storagePathFromUrl(p.url))
      .filter((p): p is string => Boolean(p));

    if (paths.length) {
      await supabase.storage.from("listing-photos").remove(paths);
    }
  }

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`Грешка при изтриване: ${error.message}`);
  }

  revalidatePath("/listings");
  revalidatePath("/dashboard");
}

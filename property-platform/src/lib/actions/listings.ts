"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { blokiranKontakt } from "@/lib/phone";
import { getAuthedUser } from "@/lib/supabase/dal";
import { cleanListingDescription } from "@/lib/listing-description";
import { mahniKontaktiOtSnimki } from "@/lib/mahni-tel-ot-snimki";
import { eSnimkaNaPotrebitel, eVideoLink } from "@/lib/snimka-url";
import {
  DEFAULT_LISTING_LIMIT,
  MAX_LISTING_PHOTOS,
  SUPPORT_EMAIL,
} from "@/lib/listing-labels";
import type {
  ListingDealType,
  PropertyType,
} from "@/lib/types/database";

// Един телефон на потребител, не различен за всяка обява — вижте
// 0022_single_profile_phone.sql. Обявите вече не приемат телефон от
// клиента, само от профила на собственика.
async function getProfileContactInfo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, listing_limit")
    .eq("id", userId)
    .single();

  const phone = profile?.phone?.trim();
  if (!phone) {
    throw new Error(
      "Добави телефон в профила си, преди да публикуваш обява (Моят профил → Телефон).",
    );
  }
  return {
    phone,
    listingLimit: profile?.listing_limit ?? DEFAULT_LISTING_LIMIT,
  };
}

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
  /** Съгласие обявата да се пуска безплатно в социалните мрежи. */
  socialniMrezhi: boolean;
  title: string;
  description: string | null;
  address: string;
  photoUrls: string[];
  videoUrl: string | null;
  /** Само за админ: обявата е на собственик, който е дал съгласие. */
  sobstvenik?: { ime: string; telefon: string; data: string };
};

export async function createListing(input: CreateListingInput) {
  const user = await getAuthedUser();

  if (!cleanListingDescription(input.title)) {
    throw new Error("Заглавието е задължително.");
  }
  if (!input.address.trim()) {
    throw new Error("Адресът е задължителен.");
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

  proveriAdresi(user.id, input.photoUrls, input.videoUrl);

  const supabase = await createClient();
  const profileInfo = input.sobstvenik
    ? null
    : await getProfileContactInfo(supabase, user.id);
  const { sobstvenik } = input;

  if (sobstvenik) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      throw new Error("Само администратор може да качва от името на собственик.");
    }
    if (!sobstvenik.ime.trim() || !sobstvenik.telefon.trim() || !sobstvenik.data) {
      throw new Error("Името, телефонът и датата на съгласието са задължителни.");
    }
  }

  const phone = sobstvenik ? sobstvenik.telefon.trim() : profileInfo!.phone;
  const listingLimit = profileInfo?.listingLimit ?? DEFAULT_LISTING_LIMIT;

  const { blokiran: isBanned, error: banError } = await blokiranKontakt(
    supabase,
    phone,
    user.email ?? null,
  );
  // Ако проверката не мине, спираме: по-добре „опитай пак“, отколкото
  // блокиран човек да публикува заради временна грешка в базата.
  if (banError) {
    throw new Error("Проверката не успя. Опитай пак след малко.");
  }
  if (isBanned) {
    throw new Error(
      "Този телефон или имейл е блокиран за публикуване на обяви.",
    );
  }

  const { count: listingCount, error: countError } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) {
    throw new Error("Проверката не успя. Опитай пак след малко.");
  }

  if (!sobstvenik && (listingCount ?? 0) >= listingLimit) {
    throw new Error(
      `Достигна лимита от ${listingLimit} обяви за един акаунт. Ако имаш ` +
        `нужда от повече (напр. строителна фирма с няколко имота), пиши ни ` +
        `на ${SUPPORT_EMAIL} и ще вдигнем лимита ти.`,
    );
  }

  const { error: listingError } = await supabase.from("listings").insert({
    id: input.id,
    user_id: user.id,
    // Обява от името на собственик се ражда скрита до преглед на снимките.
    ...(sobstvenik ? { status: "inactive" as const } : {}),
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
    socialni_mrezhi: input.socialniMrezhi,
    title: cleanListingDescription(input.title).replace(/[<>]/g, ""),
    description: cleanListingDescription(input.description) || null,
    address: input.address.trim(),
    phone,
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
  // Телефон върху снимка: махаме го, след като отговорът е тръгнал.
  after(() => mahniKontaktiOtSnimki(supabase, input.id, input.photoUrls));

  if (input.videoUrl) {
    await supabase
      .from("listing_videos")
      .insert({ listing_id: input.id, url: input.videoUrl });
  }

  if (sobstvenik) {
    const { error: saglasieError } = await supabase
      .from("obyava_saglasie")
      .insert({
        listing_id: input.id,
        ime: sobstvenik.ime.trim(),
        telefon: sobstvenik.telefon.trim(),
        data: sobstvenik.data,
        dobaveno_ot: user.id,
      });
    if (saglasieError) {
      throw new Error(`Грешка при запис на съгласието: ${saglasieError.message}`);
    }
    revalidatePath("/admin");
    redirect(`/admin/ot-sobstvenik?dobavena=${input.id}`);
  }

  revalidatePath("/listings");
  revalidatePath("/dashboard");
  // `?published=1` казва на детайлната страница да отчете `Lead` към
  // Meta Pixel. Флагът се вижда само при това пренасочване; каноничният
  // адрес в metadata-та остава чистият.
  redirect(`/listings/${input.id}?published=1`);
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
  /** Съгласие обявата да се пуска безплатно в социалните мрежи. */
  socialniMrezhi: boolean;
  title: string;
  description: string | null;
  address: string;
  videoUrl: string | null;
  keepPhotoUrls: string[];
  newPhotoUrls: string[];
};

/** Спира адреси, които не са от нашето хранилище и папката на потребителя. */
function proveriAdresi(
  userId: string,
  snimki: string[],
  video: string | null,
) {
  if (!Array.isArray(snimki) || snimki.some((u) => !eSnimkaNaPotrebitel(u, userId))) {
    throw new Error("Невалидна снимка. Качи снимките отново от формата.");
  }
  if (video && !eVideoLink(video)) {
    throw new Error("Линкът към видеото трябва да започва с https://");
  }
}

function storagePathFromUrl(url: string) {
  const marker = "/listing-photos/";
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length);
}

export async function updateListing(input: UpdateListingInput) {
  const user = await getAuthedUser();

  if (!cleanListingDescription(input.title)) {
    throw new Error("Заглавието е задължително.");
  }
  if (!input.address.trim()) {
    throw new Error("Адресът е задължителен.");
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

  proveriAdresi(user.id, input.newPhotoUrls, input.videoUrl);

  const supabase = await createClient();
  const { phone } = await getProfileContactInfo(supabase, user.id);

  const { blokiran: isBanned, error: banError } = await blokiranKontakt(
    supabase,
    phone,
    user.email ?? null,
  );
  // Ако проверката не мине, спираме: по-добре „опитай пак“, отколкото
  // блокиран човек да публикува заради временна грешка в базата.
  if (banError) {
    throw new Error("Проверката не успя. Опитай пак след малко.");
  }
  if (isBanned) {
    throw new Error(
      "Този телефон или имейл е блокиран за публикуване на обяви.",
    );
  }

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
      socialni_mrezhi: input.socialniMrezhi,
      title: cleanListingDescription(input.title).replace(/[<>]/g, ""),
      description: cleanListingDescription(input.description) || null,
      address: input.address.trim(),
      phone,
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
    after(() => mahniKontaktiOtSnimki(supabase, input.id, input.newPhotoUrls));
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
    .update({
      status,
      last_confirmed_at: new Date().toISOString(),
      reminder_count: 0,
    })
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
    .update({
      status: "active",
      last_confirmed_at: new Date().toISOString(),
      reminder_count: 0,
    })
    .eq("id", listingId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(`Грешка при потвърждаване: ${error.message}`);
  }

  revalidatePath("/listings");
  revalidatePath("/dashboard");
}

export async function reportListingAsAgency(listingId: string) {
  const user = await getAuthedUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("listing_reports")
    .insert({ listing_id: listingId, reported_by: user.id });

  // 23505 = unique violation — вече е докладвана от този потребител,
  // не е грешка от гледна точка на UI-то (бутонът просто остава "докладвано").
  if (error && error.code !== "23505") {
    throw new Error(`Грешка при докладване: ${error.message}`);
  }

  revalidatePath(`/listings/${listingId}`);
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

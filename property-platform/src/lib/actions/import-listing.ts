"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/dal";
import { fetchImotListing, guessStage, type ImotListing } from "@/lib/imot-bg";

/**
 * Внасяне на фирмена обява от imot.bg.
 *
 * Две отделни стъпки нарочно: `previewImotListing` само чете и показва, а
 * `importImotListing` записва. Между тях стои човек, който решава дали
 * фирмата е дала разрешение и дали данните са верни — това не е нещо, което
 * машина бива да решава сама.
 *
 * Снимките минават през нашето хранилище, а не се сочат към imot.bg:
 * чуждите адреси умират, щом обявата там бъде свалена, и дотогава ядат
 * чужд трафик.
 */

export type ImportPreview = ImotListing & {
  stage: ReturnType<typeof guessStage>;
  /** Името на комплекса, ако imot.bg го е сложил в адреса на обявата. */
  projectName: string | null;
  alreadyImported: boolean;
};

/** „…-trakiya-trakiya-siti-park“ → „Тракия Сити Парк“ не се познава от адреса,
 *  но самите думи стигат, за да се потърси после в сайта на строителя. */
function projectFromUrl(url: string, neighborhood: string | null) {
  const slug = url.split("/").pop() ?? "";
  const parts = slug.replace(/^obiava-[^-]+-/, "").split("-");
  const cut = parts.indexOf("plovdiv");
  if (cut === -1) return null;
  const tail = parts.slice(cut + 1);
  // Първата дума след града е кварталът; каквото остане след него е
  // името на комплекса, ако изобщо има такова.
  const hood = neighborhood?.toLowerCase().split(" ")[0] ?? "";
  const rest = tail.filter((w) => w && !hood.startsWith(w.slice(0, 4)));
  return rest.length ? rest.join(" ") : null;
}

export async function previewImotListing(url: string): Promise<ImportPreview> {
  await requireAdmin();
  const supabase = await createClient();

  const data = await fetchImotListing(url.trim());

  const { data: existing } = await supabase
    .from("listings")
    .select("id")
    .eq("source_url", data.sourceUrl)
    .maybeSingle();

  return {
    ...data,
    stage: guessStage(data.constructionNote, data.description),
    projectName: projectFromUrl(data.sourceUrl, data.neighborhood),
    alreadyImported: Boolean(existing),
  };
}

export type ImportInput = {
  sourceUrl: string;
  developerName: string;
  developerPhone: string;
  permissionNote: string;
  projectName: string | null;
  stage: "planned" | "building" | "act14" | "act15" | "act16" | null;
  /** Обещаният срок при имот в строеж. */
  completionYear: number | null;
  /** Годината, в която сградата е построена — само за готов имот. */
  yearBuilt: number | null;
  title: string;
  description: string | null;
  address: string;
  cityId: string;
  neighborhoodId: string | null;
  price: number;
  areaSqm: number;
  rooms: number | null;
  floor: number | null;
  photos: string[];
};

export async function importImotListing(input: ImportInput) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  if (!input.developerName.trim() || !input.developerPhone.trim()) {
    throw new Error("Фирмата и телефонът ѝ са задължителни.");
  }
  if (!input.permissionNote.trim()) {
    throw new Error(
      "Опиши откъде е разрешението на фирмата. Трябва да можеш да го докажеш.",
    );
  }

  // Фирмата се завежда веднъж; следващите ѝ обяви я намират по име.
  const { data: developer, error: developerError } = await supabase
    .from("developers")
    .upsert(
      {
        name: input.developerName.trim(),
        phone: input.developerPhone.trim(),
        permission_at: new Date().toISOString(),
        permission_note: input.permissionNote.trim(),
      },
      { onConflict: "name" },
    )
    .select("id")
    .single();

  if (developerError || !developer) {
    throw new Error(`Грешка при записа на фирмата: ${developerError?.message}`);
  }

  const listingId = crypto.randomUUID();

  // Снимките се теглят от imot.bg и се качват в нашето хранилище от името
  // на администратора — политиката иска първата папка да е неговият id.
  const photoUrls: string[] = [];
  for (const [index, source] of input.photos.slice(0, 30).entries()) {
    const response = await fetch(source, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://www.imot.bg/" },
    });
    if (!response.ok) continue;

    const path = `${admin.id}/${listingId}/${index}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("listing-photos")
      .upload(path, await response.arrayBuffer(), {
        contentType: response.headers.get("content-type") ?? "image/jpeg",
        upsert: true,
      });
    if (uploadError) continue;

    photoUrls.push(
      supabase.storage.from("listing-photos").getPublicUrl(path).data.publicUrl,
    );
  }

  if (photoUrls.length === 0) {
    throw new Error("Нито една снимка не се свали. Обявата не е качена.");
  }

  const { error: listingError } = await supabase.from("listings").insert({
    id: listingId,
    user_id: admin.id,
    type: "sale",
    property_type: "apartment",
    city_id: input.cityId,
    neighborhood_id: input.neighborhoodId,
    price: input.price,
    area_sqm: input.areaSqm,
    rooms: input.rooms,
    floor: input.floor,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    address: input.address.trim(),
    // Телефонът е НА ФИРМАТА, не на профила, който я качва.
    phone: input.developerPhone.trim(),
    developer_id: developer.id,
    project_name: input.projectName?.trim() || null,
    construction_stage: input.stage,
    completion_year: input.completionYear,
    year_built: input.yearBuilt,
    source_url: input.sourceUrl,
    source_checked_at: new Date().toISOString(),
  });

  if (listingError) {
    throw new Error(`Грешка при записа на обявата: ${listingError.message}`);
  }

  const { error: photosError } = await supabase.from("listing_photos").insert(
    photoUrls.map((url, position) => ({ listing_id: listingId, url, position })),
  );
  if (photosError) {
    throw new Error(`Грешка при записа на снимките: ${photosError.message}`);
  }

  revalidatePath("/listings");
  revalidatePath("/admin/import");
  return { listingId, photos: photoUrls.length };
}

export type FoundListing = {
  url: string;
  alreadyImported: boolean;
};

/**
 * Казва кои от подадените обяви още ги няма при нас.
 *
 * Приема готов списък адреси, а не адрес на търсене: филтърът „Строителни
 * фирми“ живее в сесията на потребителя в imot.bg и сървърът не го вижда —
 * поискана оттук, същата страница връща и обявите на агенциите.
 */
export async function findImotListings(
  urls: string[],
): Promise<FoundListing[]> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("listings")
    .select("source_url")
    .not("source_url", "is", null);

  const known = new Set((existing ?? []).map((row) => row.source_url));
  return urls.map((url) => ({ url, alreadyImported: known.has(url) }));
}

/**
 * Внася една обява без ръчно попълване: всичко се взима от самата обява.
 *
 * Използва се от партидното внасяне. Онова, което човек не може да провери
 * за 40 обяви наведнъж, тук се решава по правило: липсва ли цена или
 * квадратура, обявата се пропуска, вместо да влезе наполовина.
 */
export async function importImotAutomatically(
  url: string,
  permissionNote: string,
  cityId: string,
) {
  await requireAdmin();
  const supabase = await createClient();

  const data = await fetchImotListing(url);

  // Предпазителят: каквото и да е дошло в списъка, агенция не влиза.
  // Цялата платформа обещава „без посредници“ — една агенционна обява
  // струва повече доверие, отколкото десет обяви носят.
  if (data.sellerKind === "agency" || data.sellerKind === "private") {
    return { skipped: `не е строител (${data.sellerKind === "agency" ? "агенция" : "частно лице"})` as const };
  }
  if (data.sellerKind === "unknown") {
    return { skipped: "не се разбра кой подава обявата" as const };
  }
  if (!data.priceEur || !data.areaSqm) {
    return { skipped: "няма цена или квадратура" as const };
  }
  if (!data.company || data.phones.length === 0) {
    return { skipped: "няма фирма или телефон" as const };
  }
  if (data.photos.length === 0) {
    return { skipped: "няма снимки" as const };
  }

  // Кварталът от обявата се сверява със списъка в базата; не се познае ли,
  // обявата пак влиза, само че без квартал — по-добре от грешен квартал.
  let neighborhoodId: string | null = null;
  if (data.neighborhood) {
    const { data: hood } = await supabase
      .from("neighborhoods")
      .select("id")
      .eq("city_id", cityId)
      .ilike("name", data.neighborhood.trim())
      .maybeSingle();
    neighborhoodId = hood?.id ?? null;
  }

  const result = await importImotListing({
    sourceUrl: data.sourceUrl,
    developerName: data.company,
    developerPhone: data.phones[0],
    permissionNote,
    projectName: null,
    stage: guessStage(data.constructionNote, data.description),
    // Една и съща година значи различно нещо според наклонението:
    // „въведен 2026 г.“ е факт, „ще бъде въведен 2027 г.“ е обещание.
    completionYear: data.commissioned ? null : data.commissionYear,
    yearBuilt: data.commissioned ? data.commissionYear : null,
    title: data.title?.split("::")[0]?.trim() || "Апартамент в Пловдив",
    description: data.description,
    address: data.neighborhood ? `кв. ${data.neighborhood}` : "гр. Пловдив",
    cityId,
    neighborhoodId,
    price: data.priceEur,
    areaSqm: data.areaSqm,
    rooms: data.rooms,
    floor: data.floor,
    photos: data.photos,
  });

  return { imported: result, company: data.company };
}

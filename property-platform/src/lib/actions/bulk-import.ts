"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { blokiranKontakt } from "@/lib/phone";
import { cleanListingDescription } from "@/lib/listing-description";
import { bulkIdentity, normalizePlace, sourceIdFromUrl, validateBulkDraft, type BulkDraft, type BulkPreview } from "@/lib/bulk-import";

function stableId(value: string) {
  const h = createHash("sha256").update(value).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function resolveDraft(draft: BulkDraft) {
  validateBulkDraft(draft);
  const db = await createClient();
  const { data: cities, error } = await db.from("cities").select("id").eq("name", draft.city).eq("is_village", false).limit(2);
  if (error) throw new Error("Не успях да проверя населеното място.");
  if (cities?.length !== 1) throw new Error(`Градът „${draft.city}“ не е намерен еднозначно.`);
  const cityId = cities[0].id;
  const { data: hoods, error: hoodError } = await db.from("neighborhoods").select("id,name").eq("city_id", cityId);
  if (hoodError) throw new Error("Не успях да проверя квартала.");
  const alias = draft.city === "Пловдив" && normalizePlace(draft.neighborhood) === "индустриална зона север" ? "Северна индустриална зона" : draft.neighborhood;
  const hood = (hoods ?? []).find(h => normalizePlace(h.name) === normalizePlace(alias));
  if (draft.neighborhood && !hood) throw new Error(`Кварталът „${draft.neighborhood}“ не е намерен. Поправи го в Описание.txt.`);
  return { cityId, neighborhoodId: hood?.id ?? null };
}

async function findExisting(draft: BulkDraft, owner: string) {
  const db = await createClient();
  if (draft.sourceId) {
    const { data, error } = await db.from("listings").select("id,user_id,status,source_url,price,area_sqm,type,property_type,city_id,neighborhood_id").like("source_url", `%obiava-${draft.sourceId}%`).limit(20);
    if (error) throw new Error("Не успях да проверя за дублирани обяви.");
    const exact = data?.find(row => sourceIdFromUrl(row.source_url) === draft.sourceId);
    if (exact) return exact;
  }
  const { data, error } = await db.from("listings").select("id,user_id,status,source_url,price,area_sqm,type,property_type,city_id,neighborhood_id").eq("id", stableId(`${owner}:${bulkIdentity(draft)}`)).maybeSingle();
  if (error) throw new Error("Не успях да проверя за повторен импорт.");
  return data;
}

export async function previewBulkImport(drafts: BulkDraft[]): Promise<BulkPreview[]> {
  const admin = await requireAdmin();
  if (!Array.isArray(drafts) || drafts.length > 20) throw new Error("Проверявай до 20 обяви наведнъж.");
  return Promise.all(drafts.map(async draft => {
    try {
      await resolveDraft(draft);
      const row = await findExisting(draft, admin.id);
      if (row) {
        const resumable = row.user_id === admin.id && row.status === "inactive";
        return { folder: draft.folder, state: resumable ? "resume" : "duplicate", listingId: row.id, message: resumable ? "Подготвена обява — продължи със снимките" : "Вече е внесена" };
      }
      return { folder: draft.folder, state: "ready", message: "Готова за внасяне" };
    } catch (error) {
      return { folder: draft?.folder ?? "", state: "error", message: error instanceof Error ? error.message : "Грешка при проверката." };
    }
  }));
}

export async function prepareBulkListing(draft: BulkDraft) {
  const admin = await requireAdmin();
  const { cityId, neighborhoodId } = await resolveDraft(draft);
  const db = await createClient();
  const { blokiran: banned, error: banError } = await blokiranKontakt(db, draft.phone, null);
  if (banError) throw new Error("Проверката на телефона не успя.");
  if (banned) throw new Error("Телефонът е блокиран за публикуване.");
  const existing = await findExisting(draft, admin.id);
  const id = existing?.id ?? stableId(`${admin.id}:${bulkIdentity(draft)}`);
  if (existing && (existing.user_id !== admin.id || existing.status !== "inactive")) throw new Error("Обявата вече е внесена. Няма да бъде променена.");
  if (existing) {
    const { data: contacts, error: contactError } = await db.rpc("admin_telefoni_obyavi", { p_ids: [id] });
    if (contactError) throw new Error("Не успях да проверя телефона на подготвената обява.");
    const phone = (contacts as { id: string; phone: string }[] | null)?.[0]?.phone;
    if (Number(existing.price) !== draft.price || Number(existing.area_sqm) !== draft.area || existing.type !== draft.type || existing.property_type !== draft.propertyType || existing.city_id !== cityId || existing.neighborhood_id !== neighborhoodId || phone !== draft.phone) {
      throw new Error("Подготвената обява има различни данни. Прегледай я отделно преди публикуване.");
    }
  }
  // Keep manually uploaded photos intact; only our own deterministic files can resume.
  const { data: photos, error: photosError } = await db.from("listing_photos").select("url").eq("listing_id", id);
  if (photosError) throw new Error("Проверката на снимките не успя.");
  const prefix = db.storage.from("listing-photos").getPublicUrl(`${admin.id}/${id}/bulk-`).data.publicUrl;
  if (photos?.some(p => !p.url.startsWith(prefix))) throw new Error("Обявата има ръчно качени снимки. Прегледай я отделно.");
  if (!existing) {
    const { error } = await db.from("listings").insert({
      id, user_id: admin.id, type: draft.type, property_type: draft.propertyType,
      city_id: cityId, neighborhood_id: neighborhoodId, price: draft.price, area_sqm: draft.area,
      rooms: draft.rooms, floor: draft.floor, title: draft.title, description: cleanListingDescription(draft.description) || null,
      address: draft.address, phone: draft.phone, status: "inactive",
      is_furnished: draft.furnished, has_elevator: draft.elevator, has_parking: draft.parking,
      has_terrace: draft.terrace, heating: draft.heating,
      source_url: draft.sourceId ? `https://www.imot.bg/obiava-${draft.sourceId}` : null,
      source_checked_at: draft.sourceId ? new Date().toISOString() : null,
    });
    if (error) throw new Error(error.code === "23505" ? "Обявата вече се внася от друг прозорец. Провери архива отново." : `Обявата не е записана: ${error.message}`);
  }
  return { id, ownerId: admin.id };
}

export async function finishBulkListing(id: string, names: string[]) {
  const admin = await requireAdmin();
  if (!/^[a-f0-9-]{36}$/i.test(id) || !Array.isArray(names) || names.length < 1 || names.length > 30 || names.some((n, i) => typeof n !== "string" || !new RegExp(`^bulk-${i}-[a-f0-9]{32}\\.jpg$`).test(n))) throw new Error("Невалидни снимки.");
  const db = await createClient();
  const folder = `${admin.id}/${id}`;
  const urls = names.map(name => db.storage.from("listing-photos").getPublicUrl(`${folder}/${name}`).data.publicUrl);
  const { error } = await db.rpc("complete_bulk_listing", { p_id: id, p_urls: urls });
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/listings");
  revalidatePath(`/listings/${id}`);
  revalidatePath("/admin");
  return { id };
}

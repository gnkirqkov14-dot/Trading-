"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/dal";
import type { ListingStatus } from "@/lib/types/database";

export async function adminSetListingStatus(
  listingId: string,
  status: ListingStatus,
) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("listings")
    .update({ status })
    .eq("id", listingId);

  if (error) {
    throw new Error(`Грешка: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/listings");
}

export async function adminDeleteListing(listingId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: photos } = await supabase
    .from("listing_photos")
    .select("url")
    .eq("listing_id", listingId);

  if (photos?.length) {
    const paths = photos
      .map((p) => {
        const marker = "/listing-photos/";
        const idx = p.url.indexOf(marker);
        return idx === -1 ? null : p.url.slice(idx + marker.length);
      })
      .filter((p): p is string => Boolean(p));

    if (paths.length) {
      await supabase.storage.from("listing-photos").remove(paths);
    }
  }

  const { error } = await supabase.from("listings").delete().eq("id", listingId);

  if (error) {
    throw new Error(`Грешка: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/listings");
}

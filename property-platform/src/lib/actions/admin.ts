"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/dal";
import type { ListingStatus } from "@/lib/types/database";
import { sendPismaZaDostap } from "@/lib/email";

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

export async function adminBanAgencyListing(listingId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_ban_agency", {
    p_listing_id: listingId,
  });

  if (error) {
    throw new Error(`Грешка: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/listings");
}

export async function adminSetListingLimit(userId: string, newLimit: number) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_set_listing_limit", {
    target_user_id: userId,
    new_limit: newLimit,
  });

  if (error) {
    throw new Error(`Грешка: ${error.message}`);
  }

  revalidatePath("/admin");
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

// Колко писма на едно натискане. Безплатният план на Resend е 100 на ден
// общо за сайта, затова не ги пращаме всичките наведнъж.
const PISMA_NA_NATISKANE = 40;

export type PismaZaDostapState = { poruka: string; greshka?: boolean } | undefined;

/** Праща „профилът ти е активен“ на потвърдените на ръка. */
export async function adminPratiPismaZaDostap(): Promise<PismaZaDostapState> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: hora, error } = await supabase.rpc(
    "admin_pisma_za_dostap_chakashti",
    { p_limit: PISMA_NA_NATISKANE },
  );
  if (error) return { poruka: `Грешка: ${error.message}`, greshka: true };
  if (!hora?.length) return { poruka: "Няма чакащи писма." };

  try {
    await sendPismaZaDostap(hora);
  } catch (err) {
    return {
      poruka: `Не се изпратиха: ${err instanceof Error ? err.message : err}`,
      greshka: true,
    };
  }

  const { error: otbelezhi } = await supabase.rpc(
    "admin_pisma_za_dostap_otbelezhi",
    { p_ids: hora.map((h) => h.user_id) },
  );
  revalidatePath("/admin/users");
  if (otbelezhi) {
    return {
      poruka: `Изпратени са ${hora.length}, но не се отбелязаха: ${otbelezhi.message}. Не натискай пак.`,
      greshka: true,
    };
  }
  return { poruka: `Изпратени са ${hora.length} писма.` };
}

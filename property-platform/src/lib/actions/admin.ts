"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/dal";
import type { ListingStatus } from "@/lib/types/database";
import { sendPismaZaDostap, sendSaobshtenieOtAdmina } from "@/lib/email";
import { zapomniIp } from "@/lib/ip";

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
  const admin = await requireAdmin();
  const supabase = await createClient();
  // Адресът на админа се записва, за да не бъде спрян заедно с агенцията.
  await zapomniIp(supabase, admin.id);

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

export type PishiState = { poruka: string; greshka?: boolean } | null;

/**
 * Админът пише на един потребител. Съобщението се записва в профила му
 * и му се праща имейл от името на сайта. Ако имейлът не тръгне,
 * съобщението в сайта остава.
 */
export async function adminPishiNaPotrebitel(
  userId: string,
  _prev: PishiState,
  formData: FormData,
): Promise<PishiState> {
  const admin = await requireAdmin();
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return { poruka: "Напиши съобщение.", greshka: true };
  if (content.length > 2000) {
    return { poruka: "Най-много 2000 знака.", greshka: true };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_saobshteniya")
    .insert({ user_id: userId, content, ot: admin.id });
  if (error) return { poruka: `Грешка: ${error.message}`, greshka: true };
  revalidatePath(`/admin/users/${userId}`);

  const [{ data: emails }, { data: profil }] = await Promise.all([
    supabase.rpc("admin_get_profile_emails", { profile_ids: [userId] }),
    supabase.from("profiles").select("name").eq("id", userId).maybeSingle(),
  ]);
  const email = emails?.[0]?.email;
  if (!email) {
    return {
      poruka: "Записано е в профила му, но няма имейл, на който да го пратим.",
      greshka: true,
    };
  }
  try {
    await sendSaobshtenieOtAdmina({
      email,
      name: profil?.name ?? null,
      content,
    });
  } catch (err) {
    return {
      poruka: `Записано е в профила му, но имейлът не тръгна: ${err instanceof Error ? err.message : err}`,
      greshka: true,
    };
  }
  return { poruka: "Изпратено: в профила му и на имейла." };
}

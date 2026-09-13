import type { Metadata } from "next";
import { getAuthedUser, getProfile } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_LISTING_LIMIT, SUPPORT_EMAIL } from "@/lib/listing-labels";
import { NewListingForm } from "@/components/new-listing-form";

export const metadata: Metadata = { title: "Нова обява" };

export default async function NewListingPage() {
  const user = await getAuthedUser();
  const supabase = await createClient();

  // Населените места вече са 5267 — не се теглят наготово, а се търсят
  // динамично в SettlementSearch. Кварталите са само за 4-те големи града
  // (31 реда), затова остават както са.
  const [{ data: neighborhoods }, profile, { count }] =
    await Promise.all([
      supabase.from("neighborhoods").select("id, city_id, name").order("name"),
      getProfile(),
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

  const listingLimit = profile?.listing_limit ?? DEFAULT_LISTING_LIMIT;
  const listingCount = count ?? 0;
  const atLimit = listingCount >= listingLimit;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Нова обява</h1>
      {atLimit ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          Достигна лимита от {listingLimit} обяви за един акаунт (в момента
          имаш {listingCount}). Ако имаш нужда от повече (напр. строителна
          фирма с няколко имота), пиши ни на {SUPPORT_EMAIL} и ще вдигнем
          лимита ти.
        </p>
      ) : (
        <NewListingForm
          userId={user.id}
          neighborhoods={neighborhoods ?? []}
          profilePhone={profile?.phone ?? ""}
        />
      )}
    </div>
  );
}

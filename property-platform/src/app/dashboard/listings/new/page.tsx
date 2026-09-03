import type { Metadata } from "next";
import Link from "next/link";
import { getAuthedUser } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { NewListingForm } from "@/components/new-listing-form";
import { PLAN_ACTIVE_LISTING_LIMITS, PLAN_LABELS } from "@/lib/listing-labels";

export const metadata: Metadata = { title: "Нова обява" };

export default async function NewListingPage() {
  const user = await getAuthedUser();
  const supabase = await createClient();

  const [{ data: cities }, { data: neighborhoods }, { data: profile }, { count }] =
    await Promise.all([
      supabase.from("cities").select("id, name, region").order("name"),
      supabase.from("neighborhoods").select("id, city_id, name").order("name"),
      supabase
        .from("profiles")
        .select("subscription_plan")
        .eq("id", user.id)
        .single(),
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "active"),
    ]);

  const plan = profile?.subscription_plan ?? "basic";
  const limit = PLAN_ACTIVE_LISTING_LIMITS[plan];
  const activeCount = count ?? 0;

  if (activeCount >= limit) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-4 text-2xl font-semibold">Нова обява</h1>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <p>
            Достигна лимита от {limit} активни обяви за план{" "}
            {PLAN_LABELS[plan]}.
          </p>
          <Link
            href="/pricing"
            className="mt-3 inline-block font-medium underline"
          >
            Разгледай плановете
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Нова обява</h1>
      <NewListingForm
        userId={user.id}
        cities={cities ?? []}
        neighborhoods={neighborhoods ?? []}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { getAuthedUser } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { NewListingForm } from "@/components/new-listing-form";

export const metadata: Metadata = { title: "Нова обява" };

export default async function NewListingPage() {
  const user = await getAuthedUser();
  const supabase = await createClient();

  const [{ data: cities }, { data: neighborhoods }] = await Promise.all([
    supabase.from("cities").select("id, name, region").order("name"),
    supabase
      .from("neighborhoods")
      .select("id, city_id, name")
      .order("name"),
  ]);

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

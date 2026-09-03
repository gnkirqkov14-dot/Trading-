import type { Metadata } from "next";
import Link from "next/link";
import { getAuthedUser, getProfile } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { MyListings, type MyListing } from "@/components/my-listings";

export const metadata: Metadata = { title: "Моят профил" };

export default async function DashboardPage() {
  const user = await getAuthedUser();
  const profile = await getProfile();
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, type, property_type, price, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Здравей, {profile?.name || user.email}
          </h1>
          <p className="mt-2 text-slate-500">
            План:{" "}
            <span className="font-medium text-slate-900">
              {profile?.subscription_plan ?? "basic"}
            </span>
          </p>
        </div>
        <Link
          href="/dashboard/listings/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Публикувай обява
        </Link>
      </div>

      <h2 className="mb-4 mt-10 text-lg font-semibold">Моите обяви</h2>
      <MyListings listings={(listings ?? []) as MyListing[]} />
    </div>
  );
}

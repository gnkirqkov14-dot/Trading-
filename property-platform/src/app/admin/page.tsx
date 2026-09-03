import type { Metadata } from "next";
import { requireAdmin } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import {
  AdminListingsTable,
  type AdminListing,
} from "@/components/admin-listings-table";

export const metadata: Metadata = { title: "Админ панел" };

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, status, price, profiles(name)")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Админ панел — обяви</h1>
      <AdminListingsTable listings={(listings ?? []) as unknown as AdminListing[]} />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { NewListingForm } from "@/components/new-listing-form";

export const metadata: Metadata = { title: "Обява от собственик" };

export default async function ObyavaOtSobstvenikPage({
  searchParams,
}: {
  searchParams: Promise<{ dobavena?: string }>;
}) {
  const admin = await requireAdmin();
  const { dobavena } = await searchParams;
  const supabase = await createClient();
  const { data: neighborhoods } = await supabase
    .from("neighborhoods")
    .select("id, city_id, name")
    .order("name");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Обява от собственик</h1>
        <Link
          href="/admin"
          className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-900"
        >
          Обяви
        </Link>
      </div>

      {dobavena && (
        <p className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
          Обявата е записана като скрита.{" "}
          <Link href={`/listings/${dobavena}`} className="font-medium underline">
            Прегледай я
          </Link>{" "}
          и я пусни от{" "}
          <Link href="/admin" className="font-medium underline">
            админ панела
          </Link>
          .
        </p>
      )}

      <NewListingForm
        key={dobavena ?? "nova"}
        userId={admin.id}
        neighborhoods={neighborhoods ?? []}
        profilePhone=""
        otSobstvenik
      />
    </div>
  );
}

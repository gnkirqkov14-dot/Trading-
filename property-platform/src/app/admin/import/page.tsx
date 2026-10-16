import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { ImportListingForm } from "@/components/import-listing-form";

export const metadata: Metadata = { title: "Админ панел — внасяне на обяви" };

export default async function AdminImportPage() {
  await requireAdmin();
  const supabase = await createClient();

  // Засега само Пловдив — там са фирмите, с които се работи.
  const { data: city } = await supabase
    .from("cities")
    .select("id")
    .eq("name", "Пловдив")
    .eq("is_village", false)
    .limit(1)
    .single();

  const { data: neighborhoods } = city
    ? await supabase
        .from("neighborhoods")
        .select("id, name")
        .eq("city_id", city.id)
        .order("name")
    : { data: [] };

  // Името на фирмата се взима с отделна заявка, а не със join: типовете на
  // базата тук са ръчно писани и не описват връзките между таблиците.
  const [{ data: imported }, { data: developerRows }] = await Promise.all([
    supabase
      .from("listings")
      .select("id, title, price, developer_id, created_at")
      .not("developer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("developers").select("id, name"),
  ]);

  const developerNames = new Map(
    (developerRows ?? []).map((row) => [row.id, row.name]),
  );

  if (!city) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          Пловдив не е намерен в списъка с населени места.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Внасяне на фирмени обяви</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/admin" className="text-slate-500 underline underline-offset-2 hover:text-slate-900">
            Обяви
          </Link>
          <Link href="/admin/users" className="text-slate-500 underline underline-offset-2 hover:text-slate-900">
            Потребители
          </Link>
          <Link href="/admin/contacts" className="text-slate-500 underline underline-offset-2 hover:text-slate-900">
            Контакти
          </Link>
        </div>
      </div>

      <ImportListingForm
        cityId={city.id}
        neighborhoods={neighborhoods ?? []}
      />

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Качени досега</h2>
        {!imported || imported.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Още няма фирмени обяви.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {imported.map((row) => (
              <li key={row.id} className="flex flex-wrap gap-x-3 py-2">
                <Link
                  href={`/listings/${row.id}`}
                  className="font-medium underline underline-offset-2"
                >
                  {row.title}
                </Link>
                <span className="text-slate-500">
                  {row.developer_id
                    ? developerNames.get(row.developer_id)
                    : null}
                </span>
                <span className="text-slate-500">{row.price} €</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

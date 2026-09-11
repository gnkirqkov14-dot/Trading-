import type { Metadata } from "next";
import { requireAdmin } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import {
  AdminListingsTable,
  type AdminListing,
} from "@/components/admin-listings-table";

export const metadata: Metadata = { title: "Админ панел" };

// Обяви, публикувани от една и съща агенция под "лична" обява, обикновено
// споделят телефонния номер за връзка (агенцията рядко сменя номер на
// всяка обява) — прост, евтин сигнал, докато не въведем нещо по-силно
// (SMS верификация и т.н., виж CLAUDE.md).
const SUSPECTED_AGENCY_THRESHOLD = 3;

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, status, price, phone, profiles(name)")
    .order("created_at", { ascending: false });

  const rows = (listings ?? []) as unknown as AdminListing[];

  const phoneCounts = new Map<string, number>();
  for (const row of rows) {
    phoneCounts.set(row.phone, (phoneCounts.get(row.phone) ?? 0) + 1);
  }

  // Заподозрените (споделен телефон с 3+ обяви) най-отгоре, за да не се
  // налага да скролваш през целия списък, за да ги забележиш.
  const sorted = [...rows].sort((a, b) => {
    const countA = phoneCounts.get(a.phone) ?? 1;
    const countB = phoneCounts.get(b.phone) ?? 1;
    if (countA !== countB) return countB - countA;
    return a.phone.localeCompare(b.phone);
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Админ панел — обяви</h1>
      <p className="mb-6 text-sm text-slate-500">
        Обяви със споделен телефон между {SUSPECTED_AGENCY_THRESHOLD}+ обяви
        са маркирани и подредени най-отгоре — вероятни агенции, не лични
        продавачи.
      </p>
      <AdminListingsTable
        listings={sorted}
        phoneCounts={Object.fromEntries(phoneCounts)}
        suspectedAgencyThreshold={SUSPECTED_AGENCY_THRESHOLD}
      />
    </div>
  );
}

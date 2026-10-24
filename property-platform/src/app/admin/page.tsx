import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_LISTING_LIMIT } from "@/lib/listing-labels";
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

type RawListingRow = {
  id: string;
  title: string;
  status: AdminListing["status"];
  price: number;
  phone: string;
  user_id: string;
  view_count: number;
  created_at: string;
  updated_at: string;
  profiles: { name: string | null; listing_limit: number | null } | null;
};

type EditLogRow = {
  id: string;
  listing_id: string;
  changed_by: string | null;
  changed_fields: Record<string, { old: unknown; new: unknown }>;
  changed_at: string;
};

// Кои обяви да се показват. Внесените от imot.bg са хиляди и затрупваха
// малкото, които хората пускат сами — а точно тях трябва да следиш.
const IZVORI = {
  potrebiteli: "От потребители",
  vneseni: "Внесени (последните 300)",
} as const;
type Izvor = keyof typeof IZVORI;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ izvor?: string }>;
}) {
  await requireAdmin();
  const supabase = await createClient();
  const { izvor: izvorParam } = await searchParams;
  const izvor: Izvor = izvorParam === "vneseni" ? "vneseni" : "potrebiteli";

  let zayavka = supabase
    .from("listings")
    .select(
      "id, title, status, price, phone, user_id, view_count, created_at, updated_at, profiles(name, listing_limit)",
    )
    .order("created_at", { ascending: false });
  // Внесената обява помни откъде е дошла; ръчно пуснатата няма източник.
  zayavka =
    izvor === "vneseni"
      ? zayavka.not("source_url", "is", null).limit(300)
      : zayavka.is("source_url", null);
  const { data: listings } = await zayavka;

  const rows = (listings ?? []) as unknown as RawListingRow[];

  const uniqueUserIds = [...new Set(rows.map((row) => row.user_id))];
  const { data: emailRows } = uniqueUserIds.length
    ? await supabase.rpc("admin_get_profile_emails", {
        profile_ids: uniqueUserIds,
      })
    : { data: [] as { id: string; email: string | null }[] };
  const emailByUserId = new Map(
    (emailRows ?? []).map((row) => [row.id, row.email]),
  );

  const listingIds = rows.map((row) => row.id);
  const { data: editLogRows } = listingIds.length
    ? await supabase
        .from("listing_edit_log")
        .select("id, listing_id, changed_by, changed_fields, changed_at")
        .in("listing_id", listingIds)
        .order("changed_at", { ascending: false })
    : { data: [] as EditLogRow[] };

  const editLogByListing = new Map<string, EditLogRow[]>();
  for (const log of (editLogRows ?? []) as unknown as EditLogRow[]) {
    const list = editLogByListing.get(log.listing_id) ?? [];
    list.push(log);
    editLogByListing.set(log.listing_id, list);
  }

  const { data: reportRows } = listingIds.length
    ? await supabase
        .from("listing_reports")
        .select("listing_id")
        .in("listing_id", listingIds)
    : { data: [] as { listing_id: string }[] };
  const reportCounts = new Map<string, number>();
  for (const report of reportRows ?? []) {
    reportCounts.set(
      report.listing_id,
      (reportCounts.get(report.listing_id) ?? 0) + 1,
    );
  }

  const ownerListingCounts = new Map<string, number>();
  for (const row of rows) {
    ownerListingCounts.set(
      row.user_id,
      (ownerListingCounts.get(row.user_id) ?? 0) + 1,
    );
  }

  const rowsWithExtras: AdminListing[] = rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    status: row.status,
    price: row.price,
    phone: row.phone,
    email: emailByUserId.get(row.user_id) ?? null,
    viewCount: row.view_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    profiles: row.profiles,
    reportCount: reportCounts.get(row.id) ?? 0,
    ownerListingCount: ownerListingCounts.get(row.user_id) ?? 1,
    ownerListingLimit: row.profiles?.listing_limit ?? DEFAULT_LISTING_LIMIT,
    editLog: (editLogByListing.get(row.id) ?? []).map((log) => ({
      id: log.id,
      changedAt: log.changed_at,
      changedByOwner: log.changed_by === row.user_id,
      changedFields: log.changed_fields,
    })),
  }));

  const phoneCounts = new Map<string, number>();
  for (const row of rowsWithExtras) {
    phoneCounts.set(row.phone, (phoneCounts.get(row.phone) ?? 0) + 1);
  }

  // Заподозрените (споделен телефон с 3+ обяви) най-отгоре, за да не се
  // налага да скролваш през целия списък, за да ги забележиш.
  const sorted = [...rowsWithExtras].sort((a, b) => {
    const countA = phoneCounts.get(a.phone) ?? 1;
    const countB = phoneCounts.get(b.phone) ?? 1;
    if (countA !== countB) return countB - countA;
    if (a.reportCount !== b.reportCount) return b.reportCount - a.reportCount;
    return a.phone.localeCompare(b.phone);
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Админ панел — обяви</h1>
        <div className="flex gap-4 text-sm">
          <Link
            href="/admin/users"
            className="text-slate-500 underline underline-offset-2 hover:text-slate-900"
          >
            Потребители
          </Link>
          <Link
            href="/admin/statistika"
            className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
          >
            Статистика
          </Link>
          <Link
            href="/admin/contacts"
            className="text-slate-500 underline underline-offset-2 hover:text-slate-900"
          >
            Контакти
          </Link>
        </div>
      </div>
      <div className="mb-4 flex gap-2 text-sm">
        {(Object.keys(IZVORI) as Izvor[]).map((k) => (
          <Link
            key={k}
            href={k === "potrebiteli" ? "/admin" : `/admin?izvor=${k}`}
            className={
              k === izvor
                ? "rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-white"
                : "rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-100"
            }
          >
            {IZVORI[k]}
          </Link>
        ))}
      </div>
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

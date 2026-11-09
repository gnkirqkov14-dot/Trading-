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
  potrebiteli: "От клиенти",
  vneseni: "Внесени (последните 300)",
} as const;
type Izvor = keyof typeof IZVORI;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const supabase = await createClient();
  const params = await searchParams;
  const izvor: Izvor = params.izvor === "vneseni" ? "vneseni" : "potrebiteli";
  const f = prochetiFiltri(params);

  let zayavka = supabase
    .from("listings")
    .select(
      "id, title, status, price, user_id, view_count, created_at, updated_at, profiles(name, listing_limit)",
    )
    .order(f.red === "cena_vazh" || f.red === "cena_nizh" ? "price" : "created_at", {
      ascending: f.red === "cena_vazh" || f.red === "stari",
    });
  if (f.od) zayavka = zayavka.gte("created_at", polunoshtVSofia(f.od));
  if (f.do) zayavka = zayavka.lt("created_at", polunoshtVSofia(f.do, 1));
  if (f.cenaOd !== null) zayavka = zayavka.gte("price", f.cenaOd);
  if (f.cenaDo !== null) zayavka = zayavka.lte("price", f.cenaDo);
  if (f.grad) zayavka = zayavka.eq("city_id", f.grad);
  if (f.status) zayavka = zayavka.eq("status", f.status);
  // Внесената обява помни откъде е дошла; ръчно пуснатата няма източник.
  // Обявите от админ профила (внос или пуснати от теб) не са от клиенти,
  // затова отиват при внесените, не при „От потребители“.
  const { data: adminRows } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_admin", true);
  const adminIds = (adminRows ?? []).map((r) => r.id).join(",");
  // Градовете в падащото меню: само тези, в които има обяви от раздела.
  let gradoveZayavka = supabase
    .from("listings")
    .select("city_id, cities(name)")
    .limit(5000);
  gradoveZayavka =
    izvor === "vneseni"
      ? gradoveZayavka.or(
          adminIds
            ? `source_url.not.is.null,user_id.in.(${adminIds})`
            : "source_url.not.is.null",
        )
      : adminIds
        ? gradoveZayavka.is("source_url", null).not("user_id", "in", `(${adminIds})`)
        : gradoveZayavka.is("source_url", null);
  const { data: gradoveRows } = await gradoveZayavka;
  const gradove = [
    ...new Map(
      ((gradoveRows ?? []) as unknown as { city_id: string; cities: { name: string } | null }[])
        .filter((r) => r.cities)
        .map((r) => [r.city_id, r.cities!.name]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "bg"));

  // Бройки за обявите на клиентите: колко са и има ли нови днес.
  const { nachaloDnes, predi7 } = vremena();
  const klientski = () => {
    let q = supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .is("source_url", null);
    if (adminIds) q = q.not("user_id", "in", `(${adminIds})`);
    return q;
  };
  const [vsichki, aktivni, dnes, sedmica, regDnes] = await Promise.all([
    klientski(),
    klientski().eq("status", "active"),
    klientski().gte("created_at", nachaloDnes),
    klientski().gte("created_at", predi7),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_admin", false)
      .gte("created_at", nachaloDnes),
  ]);
  const broyki = [
    { ime: "Нови днес", stoynost: dnes.count ?? 0, akcent: true },
    { ime: "Последните 7 дни", stoynost: sedmica.count ?? 0 },
    { ime: "Активни", stoynost: aktivni.count ?? 0 },
    { ime: "Общо от клиенти", stoynost: vsichki.count ?? 0 },
    { ime: "Нови регистрации днес", stoynost: regDnes.count ?? 0 },
  ];

  zayavka =
    izvor === "vneseni"
      ? zayavka
          .or(
            adminIds
              ? `source_url.not.is.null,user_id.in.(${adminIds})`
              : "source_url.not.is.null",
          )
          .limit(300)
      : adminIds
        ? zayavka.is("source_url", null).not("user_id", "in", `(${adminIds})`)
        : zayavka.is("source_url", null);
  const { data: bezTelefoni } = await zayavka;
  const { data: telefoni } = await supabase.rpc("admin_telefoni_obyavi", {
    p_ids: (bezTelefoni ?? []).map((row) => row.id),
  });
  const telefonNa = new Map(
    ((telefoni ?? []) as { id: string; phone: string }[]).map((row) => [
      row.id,
      row.phone,
    ]),
  );
  const listings = (bezTelefoni ?? []).map((row) => ({
    ...row,
    phone: telefonNa.get(row.id) ?? "",
  }));

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
  const sorted = f.red !== "agencii" ? rowsWithExtras : [...rowsWithExtras].sort((a, b) => {
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
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/admin/bulk-import" className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-900">
            Пакетно внасяне
          </Link>
          <Link
            href="/admin/dublikati"
            className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
          >
            Дубликати
          </Link>
          <Link
            href="/admin/socialni-mrezhi"
            className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-900"
          >
            За соц. мрежи
          </Link>
          <Link
            href="/admin/ot-sobstvenik"
            className="text-slate-500 underline underline-offset-2 hover:text-slate-900"
          >
            Обява от собственик
          </Link>
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
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {broyki.map((b) => (
          <div
            key={b.ime}
            className={`rounded-xl border p-3 ${
              b.akcent && b.stoynost > 0
                ? "border-emerald-500 bg-emerald-50"
                : "border-slate-200 bg-white"
            }`}
          >
            <p className="text-2xl font-semibold text-slate-900">
              {b.stoynost}
            </p>
            <p className="text-xs text-slate-500">{b.ime}</p>
          </div>
        ))}
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
      <form
        method="get"
        action="/admin"
        className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm sm:grid-cols-4"
      >
        {izvor === "vneseni" && <input type="hidden" name="izvor" value="vneseni" />}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Качена от</span>
          <input type="date" name="od" defaultValue={f.od} className={POLE} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Качена до</span>
          <input type="date" name="do" defaultValue={f.do} className={POLE} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Цена от €</span>
          <input type="number" name="cena_od" min={0} inputMode="numeric" defaultValue={f.cenaOd ?? ""} className={POLE} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Цена до €</span>
          <input type="number" name="cena_do" min={0} inputMode="numeric" defaultValue={f.cenaDo ?? ""} className={POLE} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Град</span>
          <select name="grad" defaultValue={f.grad} className={POLE}>
            <option value="">Всички</option>
            {gradove.map(([id, ime]) => (
              <option key={id} value={id}>{ime}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Статус</span>
          <select name="status" defaultValue={f.status} className={POLE}>
            <option value="">Всички</option>
            {Object.entries(STATUSI).map(([k, ime]) => (
              <option key={k} value={k}>{ime}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Подреди</span>
          <select name="red" defaultValue={f.red} className={POLE}>
            {Object.entries(REDOVE).map(([k, ime]) => (
              <option key={k} value={k}>{ime}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="flex-1 rounded-lg bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-700">
            Филтрирай
          </button>
          <Link
            href={izvor === "vneseni" ? "/admin?izvor=vneseni" : "/admin"}
            className="rounded-lg border border-slate-300 px-3 py-2 text-slate-600 hover:bg-white"
          >
            Изчисти
          </Link>
        </div>
      </form>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">
          Намерени: {sorted.length}
        </p>
        {/* Един бутон: най-новите отгоре; натиснат пак — най-старите. */}
        <Link
          href={`/admin?${new URLSearchParams({
            ...Object.fromEntries(
              Object.entries(params).filter(
                (e): e is [string, string] => !!e[1] && e[0] !== "red",
              ),
            ),
            red: f.red === "novi" ? "stari" : "novi",
          }).toString()}`}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            f.red === "novi" || f.red === "stari"
              ? "bg-slate-900 text-white"
              : "border border-slate-300 text-slate-700 hover:bg-slate-100"
          }`}
        >
          Подреди по дата{" "}
          {f.red === "novi" ? "↓ най-новите" : f.red === "stari" ? "↑ най-старите" : ""}
        </Link>
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

/** Началото на днешния ден и моментът преди 7 дни. */
function vremena() {
  const sega = new Date();
  return {
    nachaloDnes: nachaloNaDenya(sega),
    predi7: new Date(sega.getTime() - 7 * 24 * 3600 * 1000).toISOString(),
  };
}

/** Полунощ днес по българско време, като ISO низ. */
function nachaloNaDenya(sega: Date): string {
  const den = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
  }).format(sega); // ГГГГ-ММ-ДД
  const chas = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Sofia",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(sega),
  );
  const utcChas = sega.getUTCHours();
  const otmestvane = (((chas - utcChas) % 24) + 24) % 24; // 2 или 3
  return new Date(
    Date.parse(`${den}T00:00:00Z`) - otmestvane * 3600 * 1000,
  ).toISOString();
}

const POLE =
  "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-900";

const STATUSI = {
  active: "Активна",
  inactive: "Неактивна",
  expired: "Изтекла",
  archived: "Архивирана",
} as const;

const REDOVE = {
  agencii: "Вероятни агенции отгоре",
  novi: "Най-новите отгоре",
  stari: "Най-старите отгоре",
  cena_nizh: "Най-скъпите отгоре",
  cena_vazh: "Най-евтините отгоре",
} as const;

/** Филтрите от адреса; невалидното се пренебрегва. */
function prochetiFiltri(p: Record<string, string | undefined>) {
  const den = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
  const chislo = (v?: string) => {
    const n = Number(v);
    return v && Number.isFinite(n) && n >= 0 ? n : null;
  };
  return {
    od: den(p.od),
    do: den(p.do),
    cenaOd: chislo(p.cena_od),
    cenaDo: chislo(p.cena_do),
    grad: p.grad && /^[0-9a-f-]{36}$/i.test(p.grad) ? p.grad : "",
    status: (p.status && p.status in STATUSI ? p.status : "") as keyof typeof STATUSI | "",
    red: (p.red && p.red in REDOVE ? p.red : "agencii") as keyof typeof REDOVE,
  };
}

/** Полунощ по българско време на дадения ден (+ dni), като ISO низ. */
function polunoshtVSofia(den: string, dni = 0): string {
  const obed = new Date(Date.parse(`${den}T12:00:00Z`) + dni * 86_400_000);
  const chas = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Sofia",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(obed),
  );
  const otmestvane = chas - 12; // 2 или 3
  const denIso = obed.toISOString().slice(0, 10);
  return new Date(
    Date.parse(`${denIso}T00:00:00Z`) - otmestvane * 3_600_000,
  ).toISOString();
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Админ панел — профил" };

function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleString("bg-BG", {
    timeZone: "Europe/Sofia",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS: Record<string, string> = {
  active: "активна",
  pending: "чака",
  sold: "продадена",
  rented: "отдадена",
  archived: "архив",
};

/**
 * Профилът на един регистриран: данните му, докъде е стигнал и обявите,
 * които е пуснал сам. Внесените от imot.bg стоят на админа и са хиляди —
 * затова тук се броят, но не се изреждат.
 */
export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: profile },
    { data: stateRows },
    { data: listings },
    { count: vneseni },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, name, email, phone, created_at, subscription_plan, subscription_expires_at, is_admin, listing_limit",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.rpc("admin_user_states"),
    supabase
      .from("listings")
      .select(
        "id, title, status, price, type, view_count, created_at, updated_at",
      )
      .eq("user_id", id)
      .is("source_url", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", id)
      .not("source_url", "is", null),
  ]);

  if (!profile) notFound();
  const state = (stateRows ?? []).find((row) => row.user_id === id);
  const obqvi = listings ?? [];

  const poleta: [string, React.ReactNode][] = [
    [
      "Имейл",
      profile.email ? (
        <a
          href={`mailto:${profile.email}`}
          className="underline underline-offset-2"
        >
          {profile.email}
        </a>
      ) : (
        "—"
      ),
    ],
    [
      "Телефон",
      profile.phone ? (
        <a
          href={`tel:${profile.phone}`}
          className="underline underline-offset-2"
        >
          {profile.phone}
        </a>
      ) : (
        "—"
      ),
    ],
    ["Регистриран", formatDateTime(profile.created_at)],
    ["Потвърдил имейла", formatDateTime(state?.email_confirmed_at) ?? "не"],
    [
      "Последно влизане",
      formatDateTime(state?.last_sign_in_at) ?? "не е влизал",
    ],
    ["План", profile.subscription_plan ?? "—"],
    ["Лимит обяви", String(profile.listing_limit ?? "—")],
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link
        href="/admin/users"
        className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-900"
      >
        ← Всички потребители
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">
        {profile.name?.trim() || "(без име)"}
        {profile.is_admin && (
          <span className="ml-2 rounded bg-slate-900 px-1.5 py-0.5 align-middle text-xs text-white">
            админ
          </span>
        )}
      </h1>

      <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 rounded-xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2">
        {poleta.map(([k, v]) => (
          <div
            key={k}
            className="flex justify-between gap-4 border-b border-slate-100 pb-2 sm:block sm:border-0 sm:pb-0"
          >
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-medium text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 text-lg font-semibold">
        Пуснати обяви ({obqvi.length})
      </h2>
      {(vneseni ?? 0) > 0 && (
        <p className="mt-1 text-sm text-slate-500">
          Плюс {vneseni} внесени от imot.bg — те не се изреждат тук.
        </p>
      )}

      {obqvi.length === 0 ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-600">
          Още не е пуснал обява.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Обява</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3 text-right font-medium">Цена</th>
                <th className="px-4 py-3 text-right font-medium">Прегледи</th>
                <th className="px-4 py-3 font-medium">Пусната</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {obqvi.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/listings/${o.id}`}
                      className="underline underline-offset-2"
                    >
                      {o.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {STATUS[o.status] ?? o.status}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {o.price != null
                      ? `${Number(o.price).toLocaleString("bg-BG")} €`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">{o.view_count ?? 0}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatDateTime(o.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

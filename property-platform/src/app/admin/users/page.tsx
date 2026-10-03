import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Админ панел — потребители" };

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  subscription_plan: string | null;
  is_admin: boolean;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("bg-BG", {
    timeZone: "Europe/Sofia",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminUsersPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: profiles }, { data: listingOwners }, { data: statsRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, name, email, phone, created_at, subscription_plan, is_admin",
        )
        .order("created_at", { ascending: false }),
      supabase.from("listings").select("user_id"),
      // Сметката по часовник е в базата: денят е софийски, а сървърът е
      // другаде — пък и четенето на времето в компонент е нечисто.
      supabase.rpc("admin_signup_stats"),
    ]);

  const rows = (profiles ?? []) as ProfileRow[];

  // Броят обяви на човек се смята тук, вместо с отделна заявка за всеки
  // ред — потребителите са малко, а така базата се пита веднъж.
  const listingCounts = new Map<string, number>();
  for (const row of listingOwners ?? []) {
    const id = (row as { user_id: string }).user_id;
    listingCounts.set(id, (listingCounts.get(id) ?? 0) + 1);
  }

  const counts = statsRows?.[0];
  const stats = [
    { label: "Общо", value: counts?.total ?? rows.length },
    { label: "Днес", value: counts?.today ?? 0 },
    { label: "Тази седмица", value: counts?.this_week ?? 0 },
    {
      label: "С обява",
      value: rows.filter((row) => listingCounts.get(row.id)).length,
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Админ панел — потребители</h1>
        <Link
          href="/admin"
          className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-900"
        >
          Към обявите
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {stat.label}
            </p>
            <p className="text-2xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <p className="mb-4 text-sm text-slate-500">
        Най-новите са най-отгоре. За всяка нова регистрация получаваш и
        писмо.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-600">
          Още няма регистрирани потребители.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Име</th>
                <th className="px-4 py-3 font-medium">Имейл</th>
                <th className="px-4 py-3 font-medium">Телефон</th>
                <th className="px-4 py-3 font-medium">Регистриран</th>
                <th className="px-4 py-3 text-right font-medium">Обяви</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="align-top">
                  <td className="px-4 py-3">
                    {row.name?.trim() || (
                      <span className="text-slate-400">(без име)</span>
                    )}
                    {row.is_admin && (
                      <span className="ml-2 rounded bg-slate-900 px-1.5 py-0.5 text-xs text-white">
                        админ
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.email ? (
                      <a
                        href={`mailto:${row.email}`}
                        className="text-slate-700 underline underline-offset-2"
                      >
                        {row.email}
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.phone || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatDateTime(row.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {listingCounts.get(row.id) ?? 0}
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

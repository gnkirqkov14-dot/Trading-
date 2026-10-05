import type { Metadata } from "next";
import Link from "next/link";
import { KindBadge, KindPrefix } from "@/components/kind-label";
import { SectionSwitch } from "@/components/section-switch";
import { formatDate, numParam, strParam } from "@/lib/format";
import { grantKindLabel, grantMoney, grantStatus } from "@/lib/grants/display";
import type { GrantCall } from "@/lib/grants/types";
import { getStore } from "@/lib/store";

export const metadata: Metadata = {
  title: "Европейски програми и безвъзмездна помощ за фирми",
  description:
    "Отворените и предстоящите процедури по европейски и национални програми в ИСУН и годишните планове на програмите — с търсене и филтри.",
  alternates: { canonical: "/grants" },
};

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const STATUSES = {
  open: "Отворени сега",
  soon: "Предстоящи (на обсъждане и по план)",
  all: "Всички",
} as const;
const PCTS = [50, 70, 80, 100] as const;

const toneClass = {
  urgent: "bg-amber-100 text-amber-800",
  ok: "bg-emerald-100 text-emerald-800",
  muted: "bg-slate-100 text-slate-600",
};

/**
 * Филтрите са върху вече запазените процедури (около стотина) — без AI.
 * Сумите и процентите са прочетени от обявите при вноса; където ги няма,
 * процедурата не минава филтър по сума или процент.
 */
function readFilters(params: SearchParams) {
  const status = strParam(params.status);
  const sort = strParam(params.sort);
  const pct = numParam(params.pct);
  return {
    q: strParam(params.q)?.slice(0, 120),
    status: status && status in STATUSES ? (status as keyof typeof STATUSES) : "open",
    everyone: strParam(params.who) === "all",
    programme: strParam(params.programme),
    minGrant: numParam(params.min),
    pct: pct !== undefined && (PCTS as readonly number[]).includes(pct) ? pct : undefined,
    sort: sort === "money" ? ("money" as const) : ("deadline" as const),
  };
}

type Filters = ReturnType<typeof readFilters>;

function applyFilters(all: GrantCall[], f: Filters) {
  const words = (f.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const rows = all.filter((g) => {
    if (f.status === "open" && g.kind !== "open") return false;
    if (f.status === "soon" && g.kind === "open") return false;
    // Непрочетените още (for_business = null) остават — може да са за фирми.
    if (!f.everyone && g.for_business === false) return false;
    if (f.programme && g.programme !== f.programme) return false;
    if (f.minGrant !== undefined && !((g.grant_max_eur ?? g.grant_min_eur ?? -1) >= f.minGrant)) return false;
    if (f.pct !== undefined && !((g.max_aid_pct ?? -1) >= f.pct)) return false;
    if (words.length) {
      const hay = [g.title, g.code, g.programme, g.summary, g.applicants, g.activities]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  const when = (g: GrantCall) => Date.parse(g.deadline_at ?? g.opens_at ?? "") || Infinity;
  return rows.sort((a, b) =>
    f.sort === "money"
      ? (b.grant_max_eur ?? b.grant_min_eur ?? -1) - (a.grant_max_eur ?? a.grant_min_eur ?? -1)
      : when(a) - when(b),
  );
}

function GrantListCard({ grant: g }: { grant: GrantCall }) {
  const status = grantStatus(g);
  const money = grantMoney(g);
  const helper = g.kind === "open" && g.id.startsWith("isun:");
  return (
    <article className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <KindBadge text={grantKindLabel(g)} tone="grant" />
        <span className={`rounded-full px-2 py-0.5 font-medium ${toneClass[status.tone]}`}>{status.text}</span>
        {g.for_business === false ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">Не е за фирми сами</span>
        ) : null}
      </div>
      <h2 className="text-base font-semibold leading-snug text-slate-900">
        <KindPrefix text={grantKindLabel(g)} />
        {g.title}
      </h2>
      <p className="text-xs text-slate-500">
        {g.programme}
        {g.code ? ` · ${g.code}` : ""}
      </p>
      {money ? <p className="text-sm font-semibold text-slate-900">{money}</p> : null}
      {g.summary ? <p className="text-sm text-slate-700">{g.summary}</p> : null}
      {g.applicants ? <p className="text-sm text-slate-600">Кой може да кандидатства: {g.applicants}</p> : null}
      {g.kind === "open" && g.deadline_at ? (
        <p className="text-xs text-slate-500">Краен срок: {formatDate(g.deadline_at)}</p>
      ) : null}
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {helper ? (
          <Link href={`/apply/grant/${g.id.slice(5)}`} className="font-semibold text-brand-700 hover:underline">
            Помощ за кандидатстване →
          </Link>
        ) : null}
        {g.url ? (
          <a href={g.url} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">
            {g.kind === "planned" ? "Планът на програмата" : "Официалната страница"} (отваря се в нов прозорец)
          </a>
        ) : null}
      </p>
    </article>
  );
}

export default async function GrantsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const f = readFilters(await searchParams);
  const all = await getStore().listGrants(false).catch(() => [] as GrantCall[]);
  const rows = applyFilters(all, f);
  const programmes = [...new Set(all.map((g) => g.programme).filter((p): p is string => Boolean(p)))].sort((a, b) =>
    a.localeCompare(b, "bg"),
  );
  const field =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";
  const label = "mb-1 block text-xs font-medium text-slate-600";

  return (
    <div className="space-y-6">
      <SectionSwitch current="grants" />

      <section className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Европейски програми за фирми</h1>
        <p className="max-w-2xl text-slate-600">
          Отворените процедури от ИСУН, тези на обсъждане и планираните по годишните планове на програмите. За
          отворените има помощ за кандидатстване по официалните документи.
        </p>
      </section>

      <form method="get" action="/grants" aria-label="Търсене на програми" className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-6">
        <label className="col-span-2 sm:col-span-6">
          <span className={label}>Какво търсите</span>
          <input
            name="q"
            defaultValue={f.q ?? ""}
            placeholder="напр. енергийна ефективност, машини, дигитализация, обучение"
            className={field}
          />
        </label>
        <label className="col-span-2 sm:col-span-3">
          <span className={label}>Кога</span>
          <select name="status" defaultValue={f.status} className={field}>
            {Object.entries(STATUSES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 sm:col-span-3">
          <span className={label}>Кой кандидатства</span>
          <select name="who" defaultValue={f.everyone ? "all" : ""} className={field}>
            <option value="">Фирми</option>
            <option value="all">Всички (и общини, училища, организации)</option>
          </select>
        </label>
        <label className="col-span-2 sm:col-span-6">
          <span className={label}>Програма</span>
          <select name="programme" defaultValue={f.programme ?? ""} className={field}>
            <option value="">Всички програми</option>
            {programmes.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 sm:col-span-2">
          <span className={label}>Помощ на проект поне, €</span>
          <input name="min" inputMode="numeric" defaultValue={f.minGrant ?? ""} className={field} />
        </label>
        <label className="col-span-2 sm:col-span-2">
          <span className={label}>Безвъзмездна част</span>
          <select name="pct" defaultValue={f.pct ?? ""} className={field}>
            <option value="">Без значение</option>
            {PCTS.map((p) => (
              <option key={p} value={p}>
                {p === 100 ? "100%" : `Поне ${p}%`}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 sm:col-span-2">
          <span className={label}>Подреди по</span>
          <select name="sort" defaultValue={f.sort} className={field}>
            <option value="deadline">Най-близък срок</option>
            <option value="money">Най-голяма помощ</option>
          </select>
        </label>
        <div className="col-span-2 flex flex-wrap items-center justify-end gap-4 sm:col-span-6">
          <Link href="/grants" className="text-sm text-brand-700 underline">
            Изчисти филтрите
          </Link>
          <button className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Търси
          </button>
        </div>
      </form>

      <p className="text-sm text-slate-600">
        <strong className="text-slate-900">{rows.length}</strong>{" "}
        {rows.length === 1 ? "процедура" : "процедури"} по тези условия.{" "}
        {f.minGrant !== undefined || f.pct !== undefined
          ? "Където сумата или процентът не са известни, процедурата не се показва."
          : ""}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          Няма процедури по тези условия. Опитайте с по-малко филтри.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((g) => (
            <GrantListCard key={g.id} grant={g} />
          ))}
        </div>
      )}

      <p className="text-sm text-slate-500">
        Искате да знаете кои са за вашата фирма?{" "}
        <Link href="/advisor" className="font-medium text-brand-700 underline">
          Опишете я в съветника
        </Link>
        . Сумите и условията са прочетени от обявите; преди да кандидатствате, проверете ги на официалната страница.
      </p>
    </div>
  );
}

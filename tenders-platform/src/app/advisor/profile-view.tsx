import Link from "next/link";
import type { GrantPick, SavedProfile, TenderPick } from "@/lib/advisor/types";
import { CPV_DIVISIONS, CPV_OPTIONS, divisionName } from "@/lib/eop/cpv";
import { REGION_OPTIONS, regionName } from "@/lib/eop/regions";
import type { Tender } from "@/lib/eop/types";
import { deadlineLabel, formatDate, formatEur } from "@/lib/format";
import type { GrantCall } from "@/lib/grants/types";
import type { MatchedTender } from "@/lib/store/types";
import { saveFilters } from "./actions";
import { DescriptionForm, ForgetButton, RerunButton, ShareLink, SurveyForm } from "./advisor-form";
import { field } from "./styles";

type TenderLike = MatchedTender | Tender;

const toneClass = {
  urgent: "bg-amber-100 text-amber-800",
  ok: "bg-emerald-100 text-emerald-800",
  muted: "bg-slate-100 text-slate-600",
};

const monthFmt = new Intl.DateTimeFormat("bg-BG", { timeZone: "Europe/Sofia", month: "long", year: "numeric" });

function FitBadge({ fit }: { fit: "high" | "medium" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-semibold ${
        fit === "high" ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"
      }`}
    >
      {fit === "high" ? "Много подходяща" : "Частично подходяща"}
    </span>
  );
}

function TenderCard({ tender: t, pick, isNew }: { tender: TenderLike; pick?: TenderPick; isNew?: boolean }) {
  const deadline = deadlineLabel(t.deadline_at);
  return (
    <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {pick ? <FitBadge fit={pick.fit} /> : null}
        {isNew ? <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-800">Нова</span> : null}
        <span className={`rounded-full px-2 py-0.5 font-medium ${toneClass[deadline.tone]}`}>{deadline.text}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{divisionName(t.cpv_division)}</span>
        {t.eu_funded ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">Европейски средства</span> : null}
      </div>
      <h3 className="font-semibold leading-snug text-slate-900">
        <Link href={`/tenders/${t.id}`} className="hover:text-brand-600">
          {t.title}
        </Link>
      </h3>
      {t.lot_title ? (
        <p className="text-sm text-slate-600">
          Позиция {t.lot_number}: {t.lot_title}
        </p>
      ) : null}
      {pick ? (
        <>
          <p className="text-sm text-slate-800">
            <span className="font-medium">Защо е за вас: </span>
            {pick.why}
          </p>
          {pick.check.length ? (
            <div className="text-sm text-slate-700">
              <p className="font-medium">Проверете в документацията:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {pick.check.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="sr-only">Възложител</dt>
          <dd className="truncate">{t.buyer_name}</dd>
        </div>
        <div>
          <dt className="sr-only">Област</dt>
          <dd>{regionName(t.region_code)}</dd>
        </div>
        <div className="sm:text-right">
          <dt className="sr-only">Прогнозна стойност</dt>
          <dd className="font-semibold text-slate-900">{formatEur(t.value_eur)}</dd>
        </div>
      </dl>
      <p className="text-xs text-slate-500">
        Срок за оферти: {formatDate(t.deadline_at)} ·{" "}
        <Link href={`/tenders/${t.id}`} className="text-brand-600 hover:underline">
          Подробности →
        </Link>{" "}
        ·{" "}
        <Link href={`/apply/tender/${t.id}`} className="text-brand-600 hover:underline">
          Помощ за ЕЕДОП и офертата →
        </Link>
      </p>
    </article>
  );
}

function grantStatus(g: GrantCall) {
  if (g.kind === "open") {
    const d = deadlineLabel(g.deadline_at);
    return { text: g.deadline_at ? `Отворена · ${d.text.toLowerCase()}` : "Отворена", tone: d.tone };
  }
  if (g.kind === "discussion") return { text: "Предстои скоро (на обсъждане)", tone: "ok" as const };
  return {
    text: g.opens_at ? `Предстои: ${monthFmt.format(new Date(g.opens_at))} (по план)` : "Предстои (по план)",
    tone: "muted" as const,
  };
}

function grantMoney(g: GrantCall) {
  const parts: string[] = [];
  if (g.grant_min_eur && g.grant_max_eur) parts.push(`${formatEur(g.grant_min_eur)} – ${formatEur(g.grant_max_eur)} на проект`);
  else if (g.grant_max_eur) parts.push(`до ${formatEur(g.grant_max_eur)} на проект`);
  else if (g.grant_min_eur) parts.push(`от ${formatEur(g.grant_min_eur)} на проект`);
  if (g.max_aid_pct) parts.push(`до ${g.max_aid_pct}% безвъзмездно`);
  if (g.budget_eur) parts.push(`общ бюджет ${formatEur(g.budget_eur)}`);
  return parts.join(" · ");
}

function GrantCard({ grant: g, pick }: { grant: GrantCall; pick: GrantPick }) {
  const status = grantStatus(g);
  const money = grantMoney(g);
  return (
    <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <FitBadge fit={pick.fit} />
        <span className={`rounded-full px-2 py-0.5 font-medium ${toneClass[status.tone]}`}>{status.text}</span>
      </div>
      <h3 className="font-semibold leading-snug text-slate-900">
        {g.url ? (
          <a href={g.url} target="_blank" rel="noopener" className="hover:text-brand-600">
            {g.title}
          </a>
        ) : (
          g.title
        )}
      </h3>
      <p className="text-xs text-slate-500">
        {g.programme}
        {g.code ? ` · ${g.code}` : ""}
      </p>
      {money ? <p className="text-sm font-semibold text-slate-900">{money}</p> : null}
      <p className="text-sm text-slate-800">
        <span className="font-medium">Какво може да ви даде: </span>
        {pick.why}
      </p>
      {pick.prepare.length ? (
        <div className="text-sm text-slate-700">
          <p className="font-medium">Какво да подготвите отсега:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {pick.prepare.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {g.applicants ? <p className="text-xs text-slate-500">Кой може да кандидатства: {g.applicants}</p> : null}
      {g.url ? (
        <a href={g.url} target="_blank" rel="noopener" className="inline-block text-xs text-brand-600 hover:underline">
          {g.kind === "planned" ? "Плана на програмата →" : "Официалната страница →"}
        </a>
      ) : null}
    </article>
  );
}

function Chip({ name, value, label }: { name: string; value: string; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm text-brand-800 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500 has-[:not(:checked)]:border-slate-200 has-[:not(:checked)]:bg-white has-[:not(:checked)]:text-slate-400 has-[:not(:checked)]:line-through">
      <input type="checkbox" name={name} value={value} defaultChecked className="sr-only" />
      {label}
      <span aria-hidden="true" className="text-xs">
        ✕
      </span>
    </label>
  );
}

function prefixLabel(p: string) {
  const division = CPV_DIVISIONS[p.slice(0, 2)];
  return p.length > 2 ? `${division ?? "CPV"} · ${p}` : (division ?? p);
}

function FiltersForm({ profile }: { profile: SavedProfile }) {
  const f = profile.filters;
  return (
    <form action={saveFilters} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-900">Какво търсите</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="want_tenders" defaultChecked={f.tenders} /> Обществени поръчки (да продавам)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="want_grants" defaultChecked={f.grants} /> Европейски пари (за развитие)
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-900">Браншове</legend>
        <p className="text-xs text-slate-500">
          Отметнатите браншове се търсят. Махнете отметката, за да изключите бранш; нов добавяте отдолу.
        </p>
        <div className="flex flex-wrap gap-2">
          {f.cpvPrefixes.map((p) => (
            <Chip key={p} name="cpv" value={p} label={prefixLabel(p)} />
          ))}
        </div>
        <select name="add_division" defaultValue="" className={`${field} sm:max-w-sm`}>
          <option value="">+ Добави бранш…</option>
          {CPV_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.name}
            </option>
          ))}
        </select>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-900">Ключови думи</legend>
        <p className="text-xs text-slate-500">
          Отметнатите думи се търсят. Махнете отметката, за да изключите дума; нови добавяте отдолу.
        </p>
        <div className="flex flex-wrap gap-2">
          {f.keywords.map((k) => (
            <Chip key={k} name="kw" value={k} label={k} />
          ))}
        </div>
        <input name="add_keywords" className={`${field} sm:max-w-sm`} placeholder="+ добавете думи, разделени със запетая" />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-slate-900">Области</legend>
        <details className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <summary className="cursor-pointer text-slate-700">
            {f.regions.length ? f.regions.map((r) => regionName(r)).join(", ") : "Цялата страна"} — промени
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-4">
            {REGION_OPTIONS.map((o) => (
              <label key={o.code} className="flex items-center gap-2">
                <input type="checkbox" name="region" value={o.code} defaultChecked={f.regions.includes(o.code)} />
                {o.name}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Без отметки = цялата страна. Областта само подрежда поръчките по-напред, не крие останалите.
          </p>
        </details>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2 sm:max-w-md">
        <legend className="mb-2 text-sm font-semibold text-slate-900">Размер на поръчката, €</legend>
        <input name="min" inputMode="numeric" defaultValue={f.minValue ?? ""} className={field} placeholder="от" />
        <input name="max" inputMode="numeric" defaultValue={f.maxValue ?? ""} className={field} placeholder="до" />
      </fieldset>

      <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
        Приложи филтрите
      </button>
      <p className="text-xs text-slate-500">Филтрите са безплатни и не се броят към питанията.</p>
    </form>
  );
}

export function ProfileView({
  profile,
  enabled,
  shareUrl,
  pickedTenders,
  moreTenders,
  pickedGrants,
  grantsTotal,
}: {
  profile: SavedProfile;
  enabled: boolean;
  shareUrl: string;
  pickedTenders: { pick: TenderPick; tender: TenderLike }[];
  moreTenders: MatchedTender[];
  pickedGrants: { pick: GrantPick; grant: GrantCall }[];
  grantsTotal: number;
}) {
  const p = profile.profile;
  const r = profile.results;
  const lastRun = profile.last_run_at ? Date.parse(profile.last_run_at) : 0;
  const alertQs = new URLSearchParams();
  const firstDivision = profile.filters.cpvPrefixes[0]?.slice(0, 2);
  if (firstDivision && firstDivision in CPV_DIVISIONS) alertQs.set("category", firstDivision);
  if (profile.filters.regions.length === 1) alertQs.set("region", profile.filters.regions[0]);

  if (p.surveyDone === false) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Съветник · анкета</p>
          <h1 className="text-2xl font-bold text-slate-900">Няколко въпроса за фирмата ви</h1>
          {p.summary ? <p className="text-slate-700">{p.summary}</p> : null}
          <p className="text-sm text-slate-600">
            {p.questions.length} въпроса, около 2 минути. Колкото повече отговорите, толкова по-точно
            ще подберем поръчките и европейските програми за вас. Отговорите се запазват и можете да
            ги промените по-късно.
          </p>
        </header>
        <section className="rounded-2xl border border-brand-100 bg-brand-50 p-5">
          <SurveyForm questions={p.questions} answers={profile.answers} done={false} enabled={enabled} />
        </section>
        <ForgetButton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Съветник · вашата фирма</p>
        <p className="text-lg text-slate-900">{p.summary || profile.description}</p>
        {profile.last_run_at ? (
          <p className="text-xs text-slate-500">Последен съвет: {formatDate(profile.last_run_at)}</p>
        ) : null}
        <details className="rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-brand-700">Промени описанието на фирмата</summary>
          <div className="mt-3">
            <DescriptionForm description={profile.description} enabled={enabled} />
          </div>
        </details>
        {profile.answers.length ? (
          <ul className="flex flex-wrap gap-2 text-xs text-slate-600">
            {profile.answers.map((a) => (
              <li key={a.question} className="rounded-full bg-slate-100 px-3 py-1">
                {a.question.replace(/\?$/, "")}: <strong className="text-slate-800">{a.answer}</strong>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      {p.questions.length ? (
        <details className="rounded-2xl border border-slate-200 bg-white p-5">
          <summary className="cursor-pointer font-semibold text-slate-900">
            Вашите отговори от анкетата <span className="font-normal text-slate-500">— промени</span>
          </summary>
          <div className="mt-4">
            <SurveyForm questions={p.questions} answers={profile.answers} done enabled={enabled} />
          </div>
        </details>
      ) : null}

      {p.fitAreas.length || p.growthAreas.length ? (
        <section className="grid gap-4 sm:grid-cols-2">
          {p.fitAreas.length ? (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">В какви поръчки можете да продавате</h2>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {p.fitAreas.map((a) => (
                  <li key={a.title}>
                    <strong className="text-slate-900">{a.title}.</strong> {a.why}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {p.growthAreas.length ? (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">За какво можете да търсите европейски пари</h2>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {p.growthAreas.map((a) => (
                  <li key={a.title}>
                    <strong className="text-slate-900">{a.title}.</strong> {a.why}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <details className="rounded-2xl border border-slate-200 bg-white p-5">
        <summary className="cursor-pointer font-semibold text-slate-900">
          Филтри{" "}
          <span className="font-normal text-slate-500">
            · {profile.filters.keywords.slice(0, 4).join(", ")}
            {profile.filters.keywords.length > 4 ? "…" : ""} ·{" "}
            {profile.filters.regions.length ? profile.filters.regions.map((r) => regionName(r)).join(", ") : "цялата страна"} —
            промени
          </span>
        </summary>
        <div className="mt-4">
          <FiltersForm profile={profile} />
        </div>
      </details>

      <div id="results" className="scroll-mt-4 space-y-8">
        {profile.filters.tenders ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Обществени поръчки за вас</h2>
            {r.tendersNote ? <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{r.tendersNote}</p> : null}
            {pickedTenders.map(({ pick, tender }) => (
              <TenderCard key={tender.id} tender={tender} pick={pick} />
            ))}
            {!pickedTenders.length && !moreTenders.length && !r.tendersNote ? (
              <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
                В момента няма отворени поръчки по тези филтри. Разширете ги или се абонирайте за известия.
              </p>
            ) : null}
            <Link href={`/alerts${alertQs.size ? `?${alertQs}` : ""}`} className="inline-block text-sm font-medium text-brand-600 hover:underline">
              Пращай ми новите поръчки по имейл →
            </Link>
          </section>
        ) : null}

        {profile.filters.grants ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Европейски и национални пари за развитие</h2>
            <p className="text-sm text-slate-600">
              Безвъзмездна помощ за вашата фирма — отворени процедури и такива, които предстоят по плана
              на програмите. Прегледахме {grantsTotal} процедури, по които фирми могат да кандидатстват.
            </p>
            {r.grantsNote ? <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{r.grantsNote}</p> : null}
            {pickedGrants.map(({ pick, grant }) => (
              <GrantCard key={grant.id} grant={grant} pick={pick} />
            ))}
            {!pickedGrants.length && !r.grantsNote ? (
              <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
                Още няма подбрани програми за вас. Натиснете „Обнови съвета“ отдолу.
              </p>
            ) : null}
          </section>
        ) : null}

        {profile.filters.tenders && moreTenders.length ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">
              Още отворени поръчки по вашите филтри
            </h2>
            <p className="text-sm text-slate-500">Без обяснение от съветника — подредени по прилика с дейността ви.</p>
            {moreTenders.map((t) => (
              <TenderCard
                key={t.id}
                tender={t}
                isNew={Boolean(lastRun && t.published_at && Date.parse(t.published_at) > lastRun)}
              />
            ))}
          </section>
        ) : null}

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-700">Променихте филтрите? Съветникът може да подбере и обясни наново.</p>
          <RerunButton enabled={enabled} label="Обнови съвета" />
        </div>
      </div>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Профилът ви е запазен</h2>
        <p className="text-sm text-slate-600">
          На този компютър съветникът ще ви помни. За друг компютър или телефон запазете тази връзка —
          тя отваря профила ви. Не я споделяйте публично.
        </p>
        <ShareLink url={shareUrl} />
        <ForgetButton />
      </section>

      <HowToApply />
    </div>
  );
}

function HowToApply() {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Как се кандидатства</h2>
      <p className="text-sm font-medium text-slate-800">За обществена поръчка</p>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
        <li>
          Регистрирайте фирмата в{" "}
          <a href="https://app.eop.bg" className="underline" rel="noopener" target="_blank">
            ЦАИС ЕОП
          </a>{" "}
          — там се подават всички оферти, електронно.
        </li>
        <li>Трябва ви квалифициран електронен подпис (КЕП) на представляващия.</li>
        <li>Изтеглете документацията на поръчката — там са точните изисквания.</li>
        <li>Попълнете ЕЕДОП в системата и подайте офертата преди срока.</li>
      </ol>
      <p className="text-sm font-medium text-slate-800">За европейска програма</p>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
        <li>
          Проектите се подават в{" "}
          <a href="https://eumis2020.government.bg" className="underline" rel="noopener" target="_blank">
            ИСУН
          </a>{" "}
          с КЕП — регистрирайте се предварително.
        </li>
        <li>Прочетете „Условия за кандидатстване“ на процедурата — там е кой може, за какво и колко.</li>
        <li>
          Подгответе оферти от доставчици, финансови отчети и собственото участие. Повечето фирми ползват
          консултант за самото писане на проекта.
        </li>
      </ol>
      <p className="text-xs text-slate-500">
        Съветникът работи с изкуствен интелект и може да сбърка. Плановете на програмите (ИГРП) са
        ориентировъчни — датите се местят. Преди да кандидатствате, четете официалните документи.
      </p>
    </section>
  );
}

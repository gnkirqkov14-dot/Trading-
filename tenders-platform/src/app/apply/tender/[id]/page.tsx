import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { advisorEnabled } from "@/lib/advisor";
import { buildEspdBlocks } from "@/lib/apply/espd";
import { guideKey, noticeHash } from "@/lib/apply/tender";
import { COMPANY_FIELDS, COMPANY_SIZES, type CompanyData } from "@/lib/apply/types";
import { fetchNotice } from "@/lib/eop/notice";
import { formatDateTime } from "@/lib/format";
import { officialUrl } from "@/lib/site";
import { getStore } from "@/lib/store";
import { field } from "@/app/advisor/styles";
import { saveCompanyData } from "../../actions";
import { GuideButton } from "../../apply-forms";
import { GuideView } from "../../guide-view";

export const metadata: Metadata = {
  title: "Помощ за ЕЕДОП и офертата",
  robots: { index: false },
};

// Разборът на обявлението е една голяма заявка към AI: 1–3 минути.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const TOKEN_RE = /^[0-9a-f]{48}$/;

function isPast(iso: string | null) {
  return Boolean(iso && Date.parse(iso) < Date.now());
}

const AUTOCOMPLETE: Partial<Record<keyof CompanyData, string>> = {
  name: "organization",
  address: "street-address",
  website: "url",
  email: "email",
  phone: "tel",
  contact: "name",
  repName: "name",
  repRole: "organization-title",
};

export default async function ApplyTenderPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const store = getStore();
  const tender = await store.getTender(id);
  if (!tender) notFound();

  const raw = (await cookies()).get("advisor_profile")?.value ?? null;
  const token = raw && TOKEN_RE.test(raw) ? raw : null;
  const saved = token ? await store.getProfile(token).catch(() => null) : null;
  const company: Partial<CompanyData> = saved?.company ?? {};
  const hasCompany = Boolean(company.name || company.eik);
  const cached = await store.getGuide(guideKey(id, saved ? token : null)).catch(() => null);
  const expired = isPast(tender.deadline_at);

  // Обявлението може да е изменено след разбора — проверяваме бързо.
  let changed = false;
  if (cached) {
    const now = await fetchNotice(cached.guide.noticeTenderId, 8000).catch(() => null);
    changed = Boolean(now && noticeHash(now) !== cached.source_hash);
  }

  const lot = tender.lot_number ? `обособена позиция ${tender.lot_number}${tender.lot_title ? ` — ${tender.lot_title}` : ""}` : null;
  const blocks = cached ? buildEspdBlocks(cached.guide, company, lot) : [];
  const toc = blocks.filter((b): b is Extract<typeof b, { kind: "h2" }> => b.kind === "h2" && Boolean(b.id));

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link href={`/tenders/${id}`} className="text-sm text-brand-600 hover:underline">
        ← Към поръчката
      </Link>

      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Помощ за кандидатстване</p>
        <h1 className="text-2xl font-bold leading-tight text-slate-900">ЕЕДОП и оферта за поръчка № {id}</h1>
        <p className="text-slate-700">{tender.title}</p>
        {lot ? <p className="text-slate-700">Обособена позиция {tender.lot_number}: {tender.lot_title}</p> : null}
        <p className="text-sm text-slate-600">
          {tender.buyer_name}. Срок за оферти: {formatDateTime(tender.deadline_at)}
        </p>
      </header>

      {expired ? (
        <p className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-800">
          Срокът за оферти по тази поръчка е изтекъл.
        </p>
      ) : null}

      {cached ? (
        <nav aria-label="Съдържание" className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold text-slate-900">Съдържание</h2>
          <ul className="mt-2 space-y-1 text-brand-700">
            <li>
              <a href="#danni" className="hover:underline">
                Данни на фирмата за документите
              </a>
            </li>
            {toc.map((h) => (
              <li key={h.id}>
                <a href={`#${h.id}`} className="hover:underline">
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3">
            <a
              href={`/apply/tender/${id}/word`}
              className="inline-block rounded-lg border border-brand-600 px-4 py-2 font-semibold text-brand-700 hover:bg-brand-50"
            >
              Изтегли всичко като Word файл
            </a>
          </p>
        </nav>
      ) : null}

      <section aria-labelledby="danni" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 id="danni" tabIndex={-1} className="scroll-mt-4 text-xl font-bold text-slate-900">
          Данни на фирмата за документите
        </h2>
        {saved ? (
          <details open={!hasCompany} className="space-y-3">
            <summary className="cursor-pointer font-medium text-brand-700">
              {hasCompany ? `Въведени: ${company.name || company.eik}. Промяна на данните` : "Попълнете данните на фирмата"}
            </summary>
            <p className="mt-2 text-sm text-slate-600">
              С тях ще ви покажем готов текст за преписване в ЕЕДОП, част II. Пазят се в профила ви и не се
              показват на никого. ЕГН и дата на раждане не питаме.
            </p>
            <form action={saveCompanyData} className="mt-3 space-y-4">
              <input type="hidden" name="tender_id" value={id} />
              {COMPANY_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <label htmlFor={`c-${f.key}`} className="block font-medium text-slate-900">
                    {f.label}
                  </label>
                  <input
                    id={`c-${f.key}`}
                    name={f.key}
                    defaultValue={company[f.key] ?? ""}
                    maxLength={300}
                    autoComplete={AUTOCOMPLETE[f.key] ?? "off"}
                    aria-describedby={f.hint ? `c-${f.key}-hint` : undefined}
                    className={field}
                  />
                  {f.hint ? (
                    <p id={`c-${f.key}-hint`} className="text-sm text-slate-500">
                      {f.hint}
                    </p>
                  ) : null}
                </div>
              ))}
              <fieldset className="space-y-2">
                <legend className="font-medium text-slate-900">Размер на предприятието</legend>
                <p id="c-size-hint" className="text-sm text-slate-500">
                  Микро — до 9 души; малко — до 49; средно — до 249 (и съответният оборот).
                </p>
                <div className="flex flex-wrap gap-2">
                  {COMPANY_SIZES.map((s) => (
                    <label
                      key={s}
                      className="cursor-pointer rounded-full border border-slate-300 px-3 py-1.5 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500"
                    >
                      <input
                        type="radio"
                        name="size"
                        value={s}
                        defaultChecked={company.size === s}
                        aria-describedby="c-size-hint"
                        className="sr-only"
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                Запази данните
              </button>
            </form>
          </details>
        ) : (
          <p className="text-slate-700">
            За да попълним данните на фирмата и да сравним изискванията с нея, първо{" "}
            <Link href="/advisor" className="font-medium text-brand-700 underline">
              опишете фирмата в съветника
            </Link>
            . Помощта по-долу работи и без това, но без сравнение с вашата фирма.
          </p>
        )}
      </section>

      {cached ? (
        <>
          {changed ? (
            <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-900">
              Обявлението в ЦАИС ЕОП е променено след като направихме тази помощ. Направете я наново, за да
              отрази промените.
            </p>
          ) : null}
          <GuideView blocks={blocks} />
          {!expired ? (
            <section aria-labelledby="nanovo" className="space-y-2 border-t border-slate-200 pt-4">
              <h2 id="nanovo" className="text-lg font-semibold text-slate-900">
                Направи помощта наново
              </h2>
              <p className="text-sm text-slate-600">
                Ако обявлението е изменено или сте променили отговорите си в съветника. Брои се като едно питане от
                дневния лимит.
              </p>
              <GuideButton tenderId={id} enabled={advisorEnabled} label="Направи помощта наново" />
            </section>
          ) : null}
        </>
      ) : expired ? null : (
        <section aria-labelledby="kakvo" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 id="kakvo" className="text-xl font-bold text-slate-900">
            Какво ще получите
          </h2>
          <ul className="list-disc space-y-1 pl-6 text-slate-800">
            <li>Изискванията от официалното обявление на прост език — всяко с точния текст от обявлението под него.</li>
            <li>ЕЕДОП част по част: какво пишете във всяко поле, с вашите данни, където ги имаме.</li>
            <li>Дали фирмата ви покрива критериите за подбор, според отговорите ви в съветника.</li>
            <li>Какво съдържа офертата, гаранциите и как се подава в ЦАИС ЕОП.</li>
            <li>Всичко това и като Word файл, удобен за екранен четец.</li>
          </ul>
          <p className="text-sm text-slate-600">
            Четем само официалното обявление от ЦАИС ЕОП. Документацията (образци и спецификации) иска вход в системата
            и трябва да я прочетете сами. Брои се като едно питане от дневния лимит.
          </p>
          <GuideButton tenderId={id} enabled={advisorEnabled} label="Направи помощта за тази поръчка" />
          {!advisorEnabled ? <p className="text-sm text-slate-600">Помощникът се включва скоро.</p> : null}
        </section>
      )}

      <p className="text-sm text-slate-500">
        Официалната страница на поръчката:{" "}
        <a href={officialUrl(id)} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">
          app.eop.bg (отваря се в нов прозорец)
        </a>
        .
      </p>
    </article>
  );
}

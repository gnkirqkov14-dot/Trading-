import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { advisorEnabled } from "@/lib/advisor";
import { grantFitKey, grantGuideKey } from "@/lib/apply/grant";
import { buildGrantBlocks } from "@/lib/apply/grant-blocks";
import type { CompanyData, GrantFit, GrantGuide } from "@/lib/apply/types";
import { formatDateTime } from "@/lib/format";
import { docsHash, grantInfo } from "@/lib/grants/docs";
import { getStore } from "@/lib/store";
import { GrantButton } from "../../apply-forms";
import { CompanyForm } from "../../company-form";
import { GuideView } from "../../guide-view";

export const metadata: Metadata = {
  title: "Помощ за кандидатстване по европейска програма",
  robots: { index: false },
};

// Документите са дълги: изтегляне + две заявки към AI, 2–4 минути.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const TOKEN_RE = /^[0-9a-f]{48}$/;

function isPast(iso: string | null) {
  return Boolean(iso && Date.parse(iso) < Date.now());
}

/** Бърза проверка дали в ИСУН има нови документи след разбора (до 8 s). */
async function docsChanged(guide: GrantGuide) {
  const info = await Promise.race([
    grantInfo({ url: guide.url, code: guide.code, title: guide.title }).catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), 8000)),
  ]);
  return Boolean(info && info.documents.length && docsHash(info) !== guide.docsHash);
}

export default async function ApplyGrantPage({ params }: { params: Promise<{ guid: string }> }) {
  const guid = (await params).guid;
  if (!/^[0-9a-f-]{36}$/i.test(guid)) notFound();
  const id = `isun:${guid}`;
  const store = getStore();
  const grant = (await store.listGrants(false)).find((g) => g.id === id);
  if (!grant) notFound();

  const raw = (await cookies()).get("advisor_profile")?.value ?? null;
  const token = raw && TOKEN_RE.test(raw) ? raw : null;
  const saved = token ? await store.getProfile(token).catch(() => null) : null;
  const company: Partial<CompanyData> = saved?.company ?? {};
  const guide = (await store.getGuide<GrantGuide>(grantGuideKey(id)).catch(() => null))?.guide ?? null;
  const fitRow = saved && token ? await store.getGuide<GrantFit>(grantFitKey(id, token)).catch(() => null) : null;
  // Оценка по стар разбор не се показва — трябва да се направи наново.
  const fit = fitRow && guide && fitRow.guide.guideCreatedAt === guide.createdAt ? fitRow.guide : null;
  const expired = isPast(grant.deadline_at);
  const open = grant.kind === "open" && Boolean(grant.url);
  const changed = guide ? await docsChanged(guide) : false;

  const blocks = guide ? buildGrantBlocks(guide, fit, company, Boolean(saved)) : [];
  const toc = blocks.filter((b): b is Extract<typeof b, { kind: "h2" }> => b.kind === "h2" && Boolean(b.id));

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link href="/advisor#results" className="text-sm text-brand-600 hover:underline">
        ← Към съветника
      </Link>

      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Помощ за кандидатстване</p>
        <h1 className="text-2xl font-bold leading-tight text-slate-900">{grant.title}</h1>
        <p className="text-slate-700">
          {[grant.code, grant.programme].filter(Boolean).join(" · ")}
        </p>
        {grant.deadline_at ? (
          <p className="text-sm text-slate-600">Краен срок за подаване: {formatDateTime(grant.deadline_at)}</p>
        ) : null}
      </header>

      {!open ? (
        <p className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-800">
          Процедурата още не е отворена. Помощта за кандидатстване ще може да се направи, когато в ИСУН бъдат
          публикувани условията за кандидатстване.
        </p>
      ) : expired ? (
        <p className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-slate-800">
          Срокът за кандидатстване по тази процедура е изтекъл.
        </p>
      ) : null}

      {guide ? (
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
              href={`/apply/grant/${guid}/word`}
              className="inline-block rounded-lg border border-brand-600 px-4 py-2 font-semibold text-brand-700 hover:bg-brand-50"
            >
              Изтегли всичко като Word файл
            </a>
          </p>
        </nav>
      ) : null}

      <CompanyForm
        company={company}
        hasProfile={Boolean(saved)}
        returnTo={`/apply/grant/${guid}`}
        purpose="формуляра в ИСУН, раздел „Данни за кандидата“"
      />

      {guide ? (
        <>
          {changed ? (
            <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-red-900">
              В ИСУН има нови или променени документи по тази процедура след като направихме помощта. Направете я
              наново, за да ги отрази.
            </p>
          ) : null}
          {saved && !fit && open && !expired ? (
            <section aria-labelledby="proverka" className="space-y-2 rounded-2xl border border-brand-200 bg-brand-50 p-4">
              <h2 id="proverka" className="text-lg font-semibold text-slate-900">
                Дали е за вашата фирма?
              </h2>
              <p className="text-sm text-slate-700">
                Сравняваме условията с отговорите ви в съветника. Брои се като едно питане от дневния лимит.
              </p>
              <GrantButton guid={guid} mode="fit" enabled={advisorEnabled} label="Провери дали е за моята фирма" />
            </section>
          ) : null}
          <GuideView blocks={blocks} />
          {open && !expired ? (
            <section aria-labelledby="nanovo" className="space-y-2 border-t border-slate-200 pt-4">
              <h2 id="nanovo" className="text-lg font-semibold text-slate-900">
                Направи помощта наново
              </h2>
              <p className="text-sm text-slate-600">
                Ако в ИСУН има нови документи или сте променили отговорите си. Брои се като едно питане от дневния
                лимит.
              </p>
              <GrantButton guid={guid} mode="guide" redo enabled={advisorEnabled} label="Направи помощта наново" />
            </section>
          ) : null}
        </>
      ) : open && !expired ? (
        <section aria-labelledby="kakvo" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 id="kakvo" className="text-xl font-bold text-slate-900">
            Какво ще получите
          </h2>
          <ul className="list-disc space-y-1 pl-6 text-slate-800">
            <li>Условията на процедурата на прост език — всяко с точния текст от официалните документи под него.</li>
            <li>Кой може да кандидатства, колко пари дават, за какви дейности и разходи.</li>
            <li>Как се оценява проектът и как да вземете повече точки.</li>
            <li>Формулярът в ИСУН раздел по раздел, документите и как се подписва и подава.</li>
            <li>Дали процедурата е за вашата фирма — ако сте я описали в съветника.</li>
            <li>Всичко това и като Word файл.</li>
          </ul>
          <p className="text-sm text-slate-600">
            Четем официалните документи на процедурата от ИСУН: условията за кандидатстване, указанията за
            формуляра и критериите за оценка. Брои се като едно питане от дневния лимит.
          </p>
          <GrantButton guid={guid} mode="guide" enabled={advisorEnabled} label="Направи помощта за тази процедура" />
          {!advisorEnabled ? <p className="text-sm text-slate-600">Помощникът се включва скоро.</p> : null}
        </section>
      ) : null}

      {grant.url ? (
        <p className="text-sm text-slate-500">
          Официалната страница на процедурата:{" "}
          <a href={grant.url} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">
            ИСУН (отваря се в нов прозорец)
          </a>
          .
        </p>
      ) : null}
    </article>
  );
}

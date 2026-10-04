"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { withQuota, type AdvisorState } from "@/app/advisor/quota";
import { currentToken } from "@/app/advisor/actions";
import { AiError } from "@/lib/ai";
import { buildTenderGuide, guideKey, noticeForTender } from "@/lib/apply/tender";
import { COMPANY_FIELDS, COMPANY_SIZES, type CompanyData } from "@/lib/apply/types";
import { getStore } from "@/lib/store";

function tenderPath(id: number) {
  return `/apply/tender/${id}`;
}

function readId(form: FormData) {
  const id = Number(form.get("tender_id"));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Данните на фирмата за документите — без AI, безплатно. */
export async function saveCompanyData(form: FormData) {
  const id = readId(form);
  const token = await currentToken();
  const saved = token ? await getStore().getProfile(token) : null;
  if (!id) redirect("/advisor");
  if (!token || !saved) redirect(tenderPath(id));

  const company: Partial<CompanyData> = {};
  for (const f of COMPANY_FIELDS) {
    company[f.key] = String(form.get(f.key) ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);
  }
  const size = String(form.get("size") ?? "");
  company.size = (COMPANY_SIZES as readonly string[]).includes(size) ? (size as CompanyData["size"]) : "";
  await getStore().saveCompany(token, company);
  revalidatePath(tenderPath(id));
  redirect(`${tenderPath(id)}#danni`);
}

/** Разбор на обявлението с AI — брои се като едно питане към съветника. */
export async function makeTenderGuide(_prev: AdvisorState, form: FormData): Promise<AdvisorState> {
  const id = readId(form);
  if (!id) return { message: "Няма такава поръчка." };
  const store = getStore();
  const tender = await store.getTender(id);
  if (!tender) return { message: "Няма такава поръчка." };
  if (tender.deadline_at && Date.parse(tender.deadline_at) < Date.now()) {
    return { message: "Срокът за оферти по тази поръчка е изтекъл." };
  }
  const token = await currentToken();
  const saved = token ? await store.getProfile(token) : null;

  // Логовете на Vercel не винаги са под ръка: ходът на последния разбор
  // на поръчката се пази до разборите (ключ run:…), без лични данни. Ако
  // остане „started“, функцията е спряна по време (maxDuration).
  const started = Date.now();
  const trace = (status: string, detail = "") =>
    store
      .saveGuide(`run:tender:${id}`, "", { status, detail: detail.slice(0, 500), ms: Date.now() - started, at: new Date().toISOString() } as never)
      .catch(() => {});
  const state = await withQuota(async () => {
    await trace("started");
    try {
      const found = await noticeForTender(tender).catch((error) => {
        console.error("Обявлението не се изтегли:", error);
        throw new AiError("Не успяхме да изтеглим обявлението от ЦАИС ЕОП. Опитайте пак след малко.");
      });
      const { notice, noticeTenderId } = found;
      const guide = await buildTenderGuide({
        tender,
        notice,
        noticeTenderId,
        company: saved?.company ?? null,
        description: saved?.description ?? null,
        answers: saved?.answers ?? [],
      });
      guide.ms = Date.now() - started;
      await store.saveGuide(guideKey(id, saved ? token : null), guide.noticeHash, guide);
      await trace("ok");
    } catch (error) {
      await trace("error", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
      throw error;
    }
  });
  if (state) return state;
  revalidatePath(tenderPath(id));
  redirect(`${tenderPath(id)}#nakratko`);
}

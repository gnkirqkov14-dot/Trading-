"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentToken } from "@/app/advisor/actions";
import { withQuota, type AdvisorState } from "@/app/advisor/quota";
import { AiError } from "@/lib/ai";
import { buildGrantFit, buildGrantGuide, grantFitKey, grantGuideKey } from "@/lib/apply/grant";
import type { GrantGuide } from "@/lib/apply/types";
import { fetchGrantDocs } from "@/lib/grants/docs";
import { getStore } from "@/lib/store";

/** Пътят на страницата: id-то на гранта е „isun:<guid>“ — в адреса е само guid. */
function grantPath(guid: string) {
  return `/apply/grant/${guid}`;
}

/**
 * Помощ за европейска програма. `mode`:
 *  - „guide“ — разбор на условията (ако го няма или е поискан наново) и,
 *    ако има профил, оценка за фирмата;
 *  - „fit“ — само оценката за фирмата по вече готовия разбор.
 * Брои се като едно питане.
 */
export async function makeGrantHelp(_prev: AdvisorState, form: FormData): Promise<AdvisorState> {
  const guid = String(form.get("guid") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(guid)) return { message: "Няма такава процедура." };
  const id = `isun:${guid}`;
  const mode = form.get("mode") === "fit" ? "fit" : "guide";
  const redo = form.get("redo") === "1";
  const store = getStore();
  const grant = (await store.listGrants(false)).find((g) => g.id === id);
  if (!grant || grant.kind !== "open" || !grant.url) {
    return { message: "Помощникът работи само за отворени процедури в ИСУН." };
  }
  if (grant.deadline_at && Date.parse(grant.deadline_at) < Date.now()) {
    return { message: "Срокът за кандидатстване по тази процедура е изтекъл." };
  }
  const token = await currentToken();
  const saved = token ? await store.getProfile(token) : null;

  const started = Date.now();
  const trace = (status: string, detail = "") =>
    store
      .saveGuide(`run:grant:${guid}`, "", {
        status,
        detail: detail.slice(0, 500),
        ms: Date.now() - started,
        at: new Date().toISOString(),
      })
      .catch(() => {});

  const state = await withQuota(async () => {
    await trace("started");
    try {
      let guide = (await store.getGuide<GrantGuide>(grantGuideKey(id)))?.guide ?? null;
      if (!guide || redo) {
        const docs = await fetchGrantDocs(grant).catch((error) => {
          console.error("Документите на процедурата не се изтеглиха:", error);
          throw new AiError("Не успяхме да изтеглим или прочетем документите на процедурата от ИСУН. Опитайте пак след малко.");
        });
        await trace("docs", docs.docs.map((d) => `${d.label}:${d.text.length}`).join(" "));
        guide = await buildGrantGuide(grant, docs);
        guide.ms = Date.now() - started;
        await store.saveGuide(grantGuideKey(id), guide.docsHash, guide);
        await trace("guide");
      }
      // Оценката за фирмата — ако има профил и остава време (лимитът е 300 s).
      if (saved && guide && Date.now() - started < 200_000) {
        const fit = await buildGrantFit(guide, {
          description: saved.description,
          answers: saved.answers,
          size: saved.company?.size,
        });
        await store.saveGuide(grantFitKey(id, token!), guide.docsHash, fit);
      }
      await trace("ok");
    } catch (error) {
      await trace("error", error instanceof Error ? `${error.name}: ${error.message}` : String(error));
      throw error;
    }
  });
  if (state) return state;
  revalidatePath(grantPath(guid));
  redirect(`${grantPath(guid)}#${mode === "fit" ? "za-vas" : "nakratko"}`);
}

"use server";

import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { headers } from "next/headers";
import { ADVISOR_LIMITS, AdvisorError, advisorEnabled, runAdvisor, type AdvisorResult } from "@/lib/advisor";
import { REGIONS } from "@/lib/eop/regions";
import { getStore } from "@/lib/store";

export type AdvisorState =
  | null
  | { ok: false; message: string; description: string; region: string }
  | { ok: true; result: AdvisorResult; description: string; region: string };

/** Броим по хеш на IP адреса, не по самия адрес — за 5 въпроса на ден хешът стига. */
async function visitorId() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const salt = process.env.ADVISOR_IP_SALT || process.env.CRON_SECRET || "local";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function askAdvisor(_prev: AdvisorState, form: FormData): Promise<AdvisorState> {
  const description = String(form.get("description") ?? "").trim();
  const regionRaw = String(form.get("region") ?? "").trim().toUpperCase();
  const region = regionRaw in REGIONS ? regionRaw : "";
  const fail = (message: string): AdvisorState => ({ ok: false, message, description, region });

  // Капан за ботове: истински човек не вижда това поле.
  if (String(form.get("website") ?? "") !== "") return fail("Опитайте пак.");
  if (!advisorEnabled) return fail("Съветникът се включва скоро.");
  if (description.length < ADVISOR_LIMITS.minDescriptionChars) {
    return fail("Опишете фирмата малко по-подробно: какво правите, за кого и къде.");
  }
  if (description.length > ADVISOR_LIMITS.maxDescriptionChars) {
    return fail(`Описанието е твърде дълго. Съкратете го до ${ADVISOR_LIMITS.maxDescriptionChars} знака.`);
  }

  const store = getStore();
  const visitor = await visitorId();
  let left: number;
  try {
    left = await store.consumeAdvisorQuota(visitor, ADVISOR_LIMITS.perVisitorPerDay, ADVISOR_LIMITS.perDay);
  } catch (error) {
    // Без брояч не пускаме заявка към модела: по-добре съветникът да
    // мълчи, отколкото сметката да е отворена.
    console.error("Лимитът на съветника не се провери:", error);
    return fail("Съветникът временно не работи. Опитайте след малко.");
  }
  if (left === -1) {
    return fail(`Днес сте задали ${ADVISOR_LIMITS.perVisitorPerDay} въпроса — толкова е дневният лимит. Опитайте утре.`);
  }
  if (left === -2) {
    return fail("Съветникът е много натоварен днес. Опитайте утре или търсете ръчно в списъка с поръчки.");
  }

  try {
    const result = await runAdvisor(description, region || undefined);
    return { ok: true, result, description, region };
  } catch (error) {
    await store.refundAdvisorQuota(visitor).catch(() => {});
    if (error instanceof AdvisorError) return fail(error.message);
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
      return fail("Съветникът е претоварен в момента. Опитайте пак след минута.");
    }
    console.error("Съветникът гръмна:", error);
    return fail("Нещо се обърка. Опитайте пак след малко.");
  }
}

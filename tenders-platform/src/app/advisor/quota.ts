import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { headers } from "next/headers";
import { ADVISOR_LIMITS, AdvisorError, advisorEnabled } from "@/lib/advisor";
import { getStore } from "@/lib/store";

/**
 * Лимитът на питанията към AI — общ за съветника и за помощника за
 * кандидатстване. Не е "use server" файл: `withQuota` приема функция и не
 * бива да може да се вика от браузъра.
 */

export type AdvisorState = { message: string } | null;

/** Броим по хеш на IP адреса, не по самия адрес — за 5 въпроса на ден хешът стига. */
async function visitorId() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const salt = process.env.ADVISOR_IP_SALT || process.env.CRON_SECRET || "local";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/**
 * Обща рамка за всичко, което вика AI: лимит, връщане на въпроса при
 * грешка, приятелски съобщения. Връща съобщение при неуспех; при успех
 * `run` сам записва и пренасочва.
 */
export async function withQuota(run: () => Promise<void>, free = false): Promise<AdvisorState> {
  if (!advisorEnabled) return { message: "Съветникът се включва скоро." };
  const store = getStore();
  const visitor = await visitorId();
  let left: number;
  try {
    // Анкетата е продължение на същото питане — не се брои отделно.
    left = free ? 1 : await store.consumeAdvisorQuota(visitor, ADVISOR_LIMITS.perVisitorPerDay, ADVISOR_LIMITS.perDay);
  } catch (error) {
    // Без брояч не пускаме заявка към модела: по-добре съветникът да
    // мълчи, отколкото сметката да е отворена.
    console.error("Лимитът на съветника не се провери:", error);
    return { message: "Съветникът временно не работи. Опитайте след малко." };
  }
  if (left === -1) {
    return {
      message: `Днес сте питали съветника ${ADVISOR_LIMITS.perVisitorPerDay} пъти — толкова е дневният лимит. Филтрите работят и без него; утре може да питате пак.`,
    };
  }
  if (left === -2) {
    return { message: "Съветникът е много натоварен днес. Опитайте утре; филтрите работят и сега." };
  }
  try {
    await run();
    return null;
  } catch (error) {
    if (!free) await store.refundAdvisorQuota(visitor).catch(() => {});
    if (error instanceof AdvisorError) return { message: error.message };
    if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
      return { message: "Съветникът е претоварен в момента. Опитайте пак след минута." };
    }
    console.error("Съветникът гръмна:", error);
    return { message: "Нещо се обърка. Опитайте пак след малко." };
  }
}


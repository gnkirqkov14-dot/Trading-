"use server";

import { createHash, randomBytes } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADVISOR_LIMITS, AdvisorError, advisorEnabled, buildSurvey, runAdvisor } from "@/lib/advisor";
import { EMPTY_RESULTS, normalizeQuestions, type AdvisorAnswer, type AdvisorFilters } from "@/lib/advisor/types";
import { CPV_DIVISIONS } from "@/lib/eop/cpv";
import { REGIONS } from "@/lib/eop/regions";
import { numParam } from "@/lib/format";
import { getStore } from "@/lib/store";

export type AdvisorState = { message: string } | null;

const COOKIE = "advisor_profile";
const YEAR = 60 * 60 * 24 * 365;

/** Броим по хеш на IP адреса, не по самия адрес — за 5 въпроса на ден хешът стига. */
async function visitorId() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const salt = process.env.ADVISOR_IP_SALT || process.env.CRON_SECRET || "local";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

async function rememberToken(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: YEAR,
    path: "/",
  });
}

export async function currentToken() {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

/**
 * Обща рамка за всичко, което вика AI: лимит, връщане на въпроса при
 * грешка, приятелски съобщения. Връща съобщение при неуспех; при успех
 * `run` сам записва и пренасочва.
 */
async function withQuota(run: () => Promise<void>, free = false): Promise<AdvisorState> {
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

function readDescription(form: FormData) {
  return String(form.get("description") ?? "").trim();
}

function descriptionProblem(description: string) {
  if (description.length < ADVISOR_LIMITS.minDescriptionChars) {
    return "Опишете фирмата малко по-подробно: какво правите, за кого и къде.";
  }
  if (description.length > ADVISOR_LIMITS.maxDescriptionChars) {
    return `Описанието е твърде дълго. Съкратете го до ${ADVISOR_LIMITS.maxDescriptionChars} знака.`;
  }
  return null;
}

/** Първо питане: описание → анкета (8–12 въпроса). Подборът е след анкетата. */
export async function startAdvisor(_prev: AdvisorState, form: FormData): Promise<AdvisorState> {
  if (String(form.get("website") ?? "") !== "") return { message: "Опитайте пак." };
  const description = readDescription(form);
  const problem = descriptionProblem(description);
  if (problem) return { message: problem };
  const regionRaw = String(form.get("region") ?? "").trim().toUpperCase();
  const region = regionRaw in REGIONS ? regionRaw : undefined;

  const token = randomBytes(24).toString("hex");
  const state = await withQuota(async () => {
    const survey = await buildSurvey(description, region);
    await getStore().saveProfile(
      token,
      {
        description,
        answers: [],
        profile: { ...survey.profile, questions: survey.questions, surveyDone: false },
        filters: { tenders: true, grants: true, ...survey.filters },
        results: EMPTY_RESULTS,
      },
      false,
    );
    await rememberToken(token);
  });
  if (state) return state;
  revalidatePath("/advisor");
  redirect("/advisor");
}

/**
 * Попълнената анкета → профил, филтри и подбор. Първият път е част от
 * същото питане (не се брои); после промяна на отговорите се брои.
 */
export async function submitSurvey(_prev: AdvisorState, form: FormData): Promise<AdvisorState> {
  const token = await currentToken();
  const saved = token ? await getStore().getProfile(token) : null;
  if (!token || !saved) return { message: "Профилът не е намерен. Опишете фирмата отначало." };

  const answers: AdvisorAnswer[] = [];
  for (const q of normalizeQuestions(saved.profile.questions)) {
    const picked = form
      .getAll(q.id)
      .map((v) => String(v).trim())
      .filter((v) => q.options.includes(v));
    const other = String(form.get(`${q.id}_other`) ?? "").trim().slice(0, 200);
    const answer = [...picked, ...(other ? [other] : [])].join(", ");
    if (answer) answers.push({ question: q.text, answer });
  }
  const extra = String(form.get("extra") ?? "").trim().slice(0, 300);
  if (extra) answers.push({ question: "Допълнително от фирмата", answer: extra });

  const free = !saved.profile.surveyDone;
  // Безплатно е само веднъж: отбелязваме анкетата като попълнена преди
  // заявката, за да не може едно питане да се пусне многократно наведнъж.
  if (free) await getStore().saveProfile(token, { profile: { ...saved.profile, surveyDone: true } }, false);
  const state = await withQuota(async () => {
    const run = await runAdvisor({
      description: saved.description,
      answers,
      regionHint: saved.filters.regions.length === 1 ? saved.filters.regions[0] : undefined,
      previous: { profile: saved.profile, filters: saved.filters },
      reprofile: true,
    });
    await getStore().saveProfile(
      token,
      { answers, profile: run.profile, filters: run.filters, results: run.results },
      true,
    );
  }, free);
  if (state) {
    if (free) await getStore().saveProfile(token, { profile: saved.profile }, false).catch(() => {});
    return state;
  }
  revalidatePath("/advisor");
  redirect("/advisor#results");
}

/** Ново описание на фирмата → нов профил и подбор (отговорите от анкетата остават). */
export async function refineAdvisor(_prev: AdvisorState, form: FormData): Promise<AdvisorState> {
  const token = await currentToken();
  const saved = token ? await getStore().getProfile(token) : null;
  if (!token || !saved) return { message: "Профилът не е намерен. Опишете фирмата отначало." };
  const description = readDescription(form);
  const problem = descriptionProblem(description);
  if (problem) return { message: problem };

  const state = await withQuota(async () => {
    const run = await runAdvisor({
      description,
      answers: saved.answers,
      previous: { profile: saved.profile, filters: saved.filters },
      reprofile: true,
    });
    await getStore().saveProfile(
      token,
      { description, profile: run.profile, filters: run.filters, results: run.results },
      true,
    );
  });
  if (state) return state;
  revalidatePath("/advisor");
  redirect("/advisor");
}

/** Нов съвет по сегашните (ръчно променени) филтри, без нов профил. */
export async function rerunAdvisor(): Promise<AdvisorState> {
  const token = await currentToken();
  const saved = token ? await getStore().getProfile(token) : null;
  if (!token || !saved) return { message: "Профилът не е намерен. Опишете фирмата отначало." };
  const state = await withQuota(async () => {
    const run = await runAdvisor({
      description: saved.description,
      answers: saved.answers,
      previous: { profile: saved.profile, filters: saved.filters },
      reprofile: false,
    });
    await getStore().saveProfile(token, { results: run.results }, true);
  });
  if (state) return state;
  revalidatePath("/advisor");
  redirect("/advisor");
}

/** Филтрите се пазят без AI — безплатно, колкото пъти иска човек. */
export async function saveFilters(form: FormData) {
  const token = await currentToken();
  const saved = token ? await getStore().getProfile(token) : null;
  if (!token || !saved) redirect("/advisor");

  const list = (name: string) => form.getAll(name).map((v) => String(v).trim()).filter(Boolean);
  const prefixes = [
    ...list("cpv").filter((p) => /^\d{2,8}$/.test(p)),
    ...list("add_division").filter((d) => d in CPV_DIVISIONS),
  ];
  const keywords = [
    ...list("kw"),
    ...String(form.get("add_keywords") ?? "")
      .split(/[,;\n]/)
      .map((w) => w.trim().toLowerCase()),
  ].filter((w) => w.length >= 3 && w.length <= 40);
  const filters: AdvisorFilters = {
    tenders: form.get("want_tenders") === "on",
    grants: form.get("want_grants") === "on",
    cpvPrefixes: [...new Set(prefixes)].slice(0, 20),
    keywords: [...new Set(keywords)].slice(0, 25),
    regions: [...new Set(list("region").filter((r) => r in REGIONS))],
    minValue: numParam(String(form.get("min") ?? "")),
    maxValue: numParam(String(form.get("max") ?? "")),
  };
  if (!filters.tenders && !filters.grants) filters.tenders = filters.grants = true;
  await getStore().saveProfile(token, { filters }, false);
  // Без това пренасочването към същата страница (#results) само скролва и
  // показва старите филтри.
  revalidatePath("/advisor");
  redirect("/advisor#results");
}

/** Отваряне по запазена връзка (?p=…) на друг компютър — запомня профила. */
export async function adoptProfile(token: string) {
  if (!/^[0-9a-f]{48}$/.test(token)) return;
  if (await getStore().getProfile(token)) await rememberToken(token);
}

export async function forgetProfile() {
  (await cookies()).delete(COOKIE);
  revalidatePath("/advisor");
  redirect("/advisor");
}

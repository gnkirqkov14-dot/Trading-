import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { getStore } from "@/lib/store";

/**
 * Една обща заявка към Claude със structured output — ползват я
 * съветникът (lib/advisor) и четенето на грантовете (lib/grants/enrich).
 * Ключът е `ANTHROPIC_API_KEY` (Sensitive във Vercel).
 */

export const AI_MODEL = "claude-opus-5-5";
export const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

export class AiError extends Error {}

let client: Anthropic | null = null;
function anthropic() {
  if (!client) client = new Anthropic();
  return client;
}

export type AiContent = string | Anthropic.Beta.BetaContentBlockParam[];

/**
 * $ за милион токена (вход, изход; мисленето се брои в изхода). Сверено
 * 05.10.2026 с цените на Anthropic. При резервен модел (fallback) цената е
 * неговата; непознат модел се смята по по-скъпата тарифа, за да не
 * подценим разхода.
 */
const PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};
const FALLBACK_PRICE = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 };

type Usage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export function aiCostUsd(model: string, u: Usage) {
  const p = PRICES[model] ?? FALLBACK_PRICE;
  return (
    ((u.input_tokens ?? 0) * p.input +
      (u.output_tokens ?? 0) * p.output +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead +
      (u.cache_creation_input_tokens ?? 0) * p.cacheWrite) /
    1_000_000
  );
}

/**
 * Всяка заявка се записва (вид, модел, токени, цена) в tenders.ai_usage —
 * оттам се смята колко струва всяка услуга и абонаментът. Без лични данни.
 * Грешка в записа не спира отговора.
 */
async function logUsage(label: string, model: string, usage: Usage, ms: number, ok: boolean) {
  await getStore()
    .logAiUsage({
      label,
      model,
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      cache_write_tokens: usage.cache_creation_input_tokens ?? 0,
      cost_usd: Number(aiCostUsd(model, usage).toFixed(5)),
      ms,
      ok,
    })
    .catch((error) => console.error("Разходът на AI не се записа:", error));
}

export async function askStructured<T extends z.ZodType>(opts: {
  /** Вид на заявката за отчета на разходите: „advisor.profile“, „apply.tender“… */
  label: string;
  schema: T;
  system: string;
  content: AiContent;
  effort: "low" | "medium" | "high";
  maxTokens: number;
}): Promise<z.infer<T>> {
  const params = {
    model: AI_MODEL,
    max_tokens: opts.maxTokens,
    // Ако класификаторите на модела откажат безобиден текст, заявката сама
    // минава през резервен модел.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default" as const,
    system: opts.system,
    output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
    messages: [{ role: "user" as const, content: opts.content }],
  };
  // Над 16 000 токена SDK-то иска поток (иначе заявката може да надхвърли
  // 10 минути); резултатът е същият.
  const started = Date.now();
  const response =
    opts.maxTokens > 16000
      ? await anthropic().beta.messages.stream(params).finalMessage()
      : await anthropic().beta.messages.parse(params);
  // Отказ и недовършен отговор също се плащат — записват се с ok = false.
  const ok = response.stop_reason !== "refusal" && response.stop_reason !== "max_tokens" && Boolean(response.parsed_output);
  await logUsage(opts.label, response.model, response.usage, Date.now() - started, ok);
  if (response.stop_reason === "refusal") {
    throw new AiError("Съветникът не можа да обработи този текст. Опитайте с други думи.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new AiError("Съветникът не успя да довърши отговора. Опитайте пак.");
  }
  return response.parsed_output as z.infer<T>;
}

export function pdfBlock(bytes: Buffer): Anthropic.Beta.BetaContentBlockParam {
  return {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: bytes.toString("base64") },
  };
}

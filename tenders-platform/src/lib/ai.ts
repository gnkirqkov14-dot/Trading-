import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

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

export async function askStructured<T extends z.ZodType>(opts: {
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
  const response =
    opts.maxTokens > 16000
      ? await anthropic().beta.messages.stream(params).finalMessage()
      : await anthropic().beta.messages.parse(params);
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

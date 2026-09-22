// Приемна точка за WhatsApp Cloud API.
//
// GET  — Meta проверява адреса веднъж, при закачането на webhook-а.
// POST — всяко входящо съобщение пристига тук, подписано от Meta.
//
// Фаза 0: съобщението се записва в лога и получава отговор, за да се
// види, че кръгът се затваря. Записът в база идва във фаза 1.

import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const GRAPH_VERSION = process.env.GRAPH_API_VERSION || "v21.0";

const SYSTEM_PROMPT = `Ти си асистентът на малък български бизнес и отговаряш
на клиенти в WhatsApp. Пиши на български, кратко (2-3 изречения), учтиво и
по същество, както би отговорил собственикът.

Не измисляй цени, срокове, наличности или уговорки — ако нещо не ти е
известно, кажи че ще провериш и ще се върнеш с отговор.`;

export default async function handler(request) {
  if (request.method === "GET") return verifyWebhook(request);
  if (request.method === "POST") return receiveWebhook(request);
  return new Response("Method Not Allowed", { status: 405 });
}

// Meta вика веднъж с ?hub.challenge=... и чака същото число обратно.
function verifyWebhook(request) {
  const params = new URL(request.url).searchParams;
  const matches =
    params.get("hub.mode") === "subscribe" &&
    Boolean(VERIFY_TOKEN) &&
    params.get("hub.verify_token") === VERIFY_TOKEN;

  if (!matches) return new Response("Forbidden", { status: 403 });

  return new Response(params.get("hub.challenge") ?? "", {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
}

async function receiveWebhook(request) {
  const raw = await request.text();

  // Адресът е публичен — без валиден подпис не се обработва нищо.
  if (!signatureIsValid(request.headers.get("x-hub-signature-256"), raw)) {
    return new Response("Bad signature", { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return accepted();
  }

  for (const incoming of extractMessages(payload)) {
    try {
      await handleMessage(incoming);
    } catch (error) {
      console.error("[whatsapp] грешка при обработка:", error);
    }
  }

  // Винаги 200 — при друг код Meta повтаря доставката до 7 дни.
  return accepted();
}

function signatureIsValid(header, raw) {
  if (!APP_SECRET || !header?.startsWith("sha256=")) return false;

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", APP_SECRET).update(raw, "utf8").digest("hex");

  const received = Buffer.from(header);
  const computed = Buffer.from(expected);
  return (
    received.length === computed.length &&
    crypto.timingSafeEqual(received, computed)
  );
}

// Meta праща и потвърждения за доставка в същия формат — взимаме само съобщенията.
function* extractMessages(payload) {
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const contacts = value?.contacts ?? [];

      for (const message of value?.messages ?? []) {
        yield {
          message,
          phoneNumberId: value?.metadata?.phone_number_id,
          name:
            contacts.find((contact) => contact?.wa_id === message?.from)
              ?.profile?.name ?? null,
        };
      }
    }
  }
}

async function handleMessage({ message, phoneNumberId, name }) {
  const text = message?.text?.body;

  console.log(
    "[whatsapp] входящо:",
    JSON.stringify({
      id: message?.id,
      from: message?.from,
      name,
      type: message?.type,
      text,
    }),
  );

  if (message?.type !== "text" || !text) {
    await sendText(
      phoneNumberId,
      message?.from,
      "Засега разбирам само текст — напиши ми с думи какво търсиш.",
    );
    return;
  }

  await sendText(phoneNumberId, message.from, await draftReply(text, name));
}

async function draftReply(text, name) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return `Получих съобщението ти${name ? ", " + name : ""}. Връзката работи — AI-ят още не е включен.`;
  }

  const response = await new Anthropic().messages.create({
    model: "claude-opus-5",
    max_tokens: 1024,
    output_config: { effort: "low" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: text }],
  });

  if (response.stop_reason === "refusal") {
    return "Това не мога да го поема аз — ще го погледне човек и ще ти пишем.";
  }

  const reply = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  return reply || "Получих съобщението ти — ще ти отговорим скоро.";
}

async function sendText(phoneNumberId, to, body) {
  if (!ACCESS_TOKEN || !phoneNumberId || !to) {
    console.error("[whatsapp] липсва token, phone_number_id или получател");
    return;
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${ACCESS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    },
  );

  if (!response.ok) {
    console.error(
      "[whatsapp] Graph API отказа:",
      response.status,
      await response.text(),
    );
  }
}

const accepted = () => new Response("OK", { status: 200 });

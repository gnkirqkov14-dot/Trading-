// Проверява приемната точка локално, без Meta и без интернет.
// Пуска се с: npm test

process.env.WHATSAPP_VERIFY_TOKEN = "тестова-дума";
process.env.WHATSAPP_APP_SECRET = "тестова-тайна";
process.env.WHATSAPP_ACCESS_TOKEN = "тестов-токен";
delete process.env.ANTHROPIC_API_KEY; // без истински повиквания към Claude

const { default: handler } = await import("../api/whatsapp.js");
const crypto = await import("node:crypto");

let failures = 0;

function check(name, condition) {
  console.log(`${condition ? "✅" : "❌"} ${name}`);
  if (!condition) failures += 1;
}

const sign = (body) =>
  "sha256=" +
  crypto
    .createHmac("sha256", process.env.WHATSAPP_APP_SECRET)
    .update(body, "utf8")
    .digest("hex");

// 1. Проверката на адреса от Meta
const challenge = await handler(
  new Request(
    "https://example.com/api/whatsapp?hub.mode=subscribe" +
      "&hub.verify_token=тестова-дума&hub.challenge=1234567890",
  ),
);
check(
  "Meta получава обратно своето число при вярна дума",
  challenge.status === 200 && (await challenge.text()) === "1234567890",
);

const wrongToken = await handler(
  new Request(
    "https://example.com/api/whatsapp?hub.mode=subscribe" +
      "&hub.verify_token=грешна&hub.challenge=1234567890",
  ),
);
check("Грешна дума се отказва", wrongToken.status === 403);

// 2. Входящо съобщение
const payload = JSON.stringify({
  entry: [
    {
      changes: [
        {
          value: {
            metadata: { phone_number_id: "111222333" },
            contacts: [{ wa_id: "359888123456", profile: { name: "Мария" } }],
            messages: [
              {
                id: "wamid.TEST",
                from: "359888123456",
                type: "text",
                text: { body: "Свободен ли е двустайният?" },
              },
            ],
          },
        },
      ],
    },
  ],
});

const unsigned = await handler(
  new Request("https://example.com/api/whatsapp", {
    method: "POST",
    body: payload,
  }),
);
check("Заявка без подпис се отказва", unsigned.status === 401);

const tampered = await handler(
  new Request("https://example.com/api/whatsapp", {
    method: "POST",
    headers: { "x-hub-signature-256": sign(payload + "промяна") },
    body: payload,
  }),
);
check("Подправено съдържание се отказва", tampered.status === 401);

// Подменяме fetch, за да хванем какво би тръгнало към Meta.
const sent = [];
globalThis.fetch = async (url, options) => {
  sent.push({ url, body: JSON.parse(options.body) });
  return new Response("{}", { status: 200 });
};

const signed = await handler(
  new Request("https://example.com/api/whatsapp", {
    method: "POST",
    headers: { "x-hub-signature-256": sign(payload) },
    body: payload,
  }),
);

check("Подписана заявка се приема", signed.status === 200);
check("Тръгва точно един отговор", sent.length === 1);
check(
  "Отговорът е адресиран до подателя",
  sent[0]?.body?.to === "359888123456" && sent[0]?.body?.type === "text",
);
check(
  "Отговорът се праща през номера, който Meta посочи",
  String(sent[0]?.url).includes("/111222333/messages"),
);
check("Името на клиента е разпознато", sent[0]?.body?.text?.body?.includes("Мария"));

console.log(
  failures === 0
    ? "\nВсичко мина. Приемната точка работи."
    : `\n${failures} проверки паднаха.`,
);
process.exit(failures === 0 ? 0 : 1);

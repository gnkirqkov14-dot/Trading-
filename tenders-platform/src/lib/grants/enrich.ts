import { z } from "zod";
import { askStructured, pdfBlock, type AiContent } from "@/lib/ai";
import type { GrantCall } from "./types";

/**
 * AI чете документите на процедурите и вади това, което го няма в HTML-а:
 * кой може да кандидатства, колко пари, за какво, какво да се подготви.
 * Плаща се веднъж на процедура (резултатът се пази в базата), не при
 * всеки въпрос към съветника.
 */

const BGN_PER_EUR = 1.95583;

export const APPLICANT_TYPES = [
  "микро, малки и средни предприятия",
  "големи предприятия",
  "стартиращи предприятия",
  "социални предприятия",
  "земеделски стопани",
  "рибари и аквакултури",
  "общини",
  "държавни институции",
  "НПО",
  "училища и университети",
  "научни организации",
  "физически лица",
  "други",
] as const;

const Money = z.object({
  amount: z.number().nullable(),
  currency: z.enum(["EUR", "BGN"]).nullable(),
});

const Fields = {
  summary: z.string(),
  applicants: z.string(),
  applicant_types: z.array(z.enum(APPLICANT_TYPES)),
  for_business: z.boolean(),
  budget: Money,
  grant_min: Money,
  grant_max: Money,
  max_aid_pct: z.number().nullable(),
  activities: z.string(),
  costs: z.string(),
  prepare: z.string(),
};

const CallSchema = z.object(Fields);

const PlanSchema = z.object({
  calls: z.array(
    z.object({
      title: z.string(),
      ...Fields,
      opens_year: z.number().nullable(),
      opens_month: z.number().nullable(),
      deadline_year: z.number().nullable(),
      deadline_month: z.number().nullable(),
    }),
  ),
});

const FIELD_RULES = `Полета:
- summary: 1–2 изречения на български на прост език: за какво дава пари процедурата.
- applicants: кой може да кандидатства, както е написано в документа, накратко (едно изречение).
- applicant_types: категориите от списъка, които отговарят на допустимите кандидати.
- for_business: true, ако търговско дружество или едноличен търговец (фирма) може да кандидатства самостоятелно като кандидат. Само партньор или подизпълнител не се брои. Общини, училища, институции, научни организации — false.
- budget: общият бюджет на процедурата; grant_min / grant_max: минимален и максимален размер на помощта за един проект. Сумата и валутата точно както са в документа (EUR или BGN). Ако липсва — null.
- max_aid_pct: максимален процент безвъзмездна помощ (интензитет), ако е посочен; иначе null.
- activities: какви дейности се финансират, накратко (до 2 изречения).
- costs: какви разходи са допустими, накратко (например машини, оборудване, софтуер, строителство, обучения). Ако не е посочено — празен низ.
- prepare: 2–4 конкретни неща, които една фирма да подготви отсега, ако иска да кандидатства, съобразени с тази процедура (например оферти от доставчици, финансови отчети за последните години, КЕП, собствено съфинансиране от X %, проектна идея, регистрация в ИСУН). Без измислени изисквания — само такива, които следват от документа или са задължителни за всяка процедура по ИСУН. Пиши като кратък списък, разделен с „; “.
Не измисляй числа. Ако нещо го няма в документа, остави null или празен низ.`;

const CALL_SYSTEM = `Ти си консултант по европейски програми в България. Получаваш страницата и обявата на процедура за безвъзмездна финансова помощ от ИСУН. Извлечи данните за нея.

${FIELD_RULES}`;

const PLAN_SYSTEM = `Ти си консултант по европейски програми в България. Получаваш индикативна годишна работна програма (ИГРП) на програма — таблица с процедурите, които програмата планира да обяви през годината. Извлечи всяка процедура от таблицата като отделен елемент.

Допълнително за всяка процедура:
- title: наименованието на процедурата, както е в таблицата.
- opens_year / opens_month: планираната година и месец (1–12) на обявяване; deadline_year / deadline_month: крайният срок. Ако е посочено тримесечие, вземи първия му месец. Ако липсва — null.
- Процедури, предназначени само за конкретна институция (например техническа помощ за управляващия орган), също ги включи, с for_business = false.

${FIELD_RULES}`;

function toEur(m: { amount: number | null; currency: "EUR" | "BGN" | null }) {
  if (m.amount === null || !Number.isFinite(m.amount) || m.amount <= 0) return null;
  return Math.round(m.currency === "BGN" ? m.amount / BGN_PER_EUR : m.amount);
}

function fieldsToRow(f: z.infer<typeof CallSchema>) {
  return {
    summary: f.summary || null,
    applicants: f.applicants || null,
    applicant_types: [...new Set(f.applicant_types)],
    for_business: f.for_business,
    budget_eur: toEur(f.budget),
    grant_min_eur: toEur(f.grant_min),
    grant_max_eur: toEur(f.grant_max),
    max_aid_pct:
      f.max_aid_pct !== null && f.max_aid_pct > 0 && f.max_aid_pct <= 100 ? f.max_aid_pct : null,
    activities: f.activities || null,
    costs: f.costs || null,
    prepare: f.prepare || null,
  };
}

export async function enrichCall(input: {
  code: string | null;
  title: string;
  programme: string | null;
  aim: string | null;
  pageText: string;
  pdf: Buffer | null;
}): Promise<Partial<GrantCall>> {
  const header = [
    `Процедура: ${input.code ?? ""} ${input.title}`,
    input.programme ? `Програма: ${input.programme}` : null,
    input.aim ? `Цел: ${input.aim}` : null,
    "",
    "Текст от обявата и страницата в ИСУН:",
    input.pageText.slice(0, 18000),
  ]
    .filter((l) => l !== null)
    .join("\n");
  const content: AiContent = input.pdf
    ? [pdfBlock(input.pdf), { type: "text", text: `${header}\n\nПрикачен е PDF-ът с обявата на процедурата.` }]
    : header;
  const f = await askStructured({ label: "cron.grant_call", schema: CallSchema, system: CALL_SYSTEM, content, effort: "low", maxTokens: 6000 });
  return fieldsToRow(f);
}

export async function extractPlan(input: { programme: string; year: number; pdf: Buffer }) {
  const { calls } = await askStructured({
    label: "cron.grant_plan",
    schema: PlanSchema,
    system: PLAN_SYSTEM,
    content: [
      pdfBlock(input.pdf),
      { type: "text", text: `ИГРП на ${input.programme} за ${input.year} г. Извлечи всички процедури от таблицата.` },
    ],
    effort: "low",
    maxTokens: 16000,
  });
  return calls.map((c) => {
    const month = (y: number | null, m: number | null) =>
      y && m && m >= 1 && m <= 12 ? `${y}-${String(m).padStart(2, "0")}-01` : null;
    return {
      title: c.title.replace(/\s+/g, " ").trim(),
      opens_at: month(c.opens_year, c.opens_month),
      deadline_month: month(c.deadline_year, c.deadline_month),
      ...fieldsToRow(c),
    };
  });
}

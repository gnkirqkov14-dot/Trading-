/**
 * Помощник за кандидатстване — типове, които ползват и страницата, и
 * Word файлът. Без SDK на Anthropic (влизат и в клиентски компоненти).
 */

/** Данни на фирмата за ЕЕДОП, част II.А и II.Б. ЕГН и дата на раждане не се пазят. */
export type CompanyData = {
  name: string;
  eik: string;
  vat: string;
  address: string;
  website: string;
  email: string;
  phone: string;
  contact: string;
  size: "" | "микро" | "малко" | "средно" | "голямо";
  repName: string;
  repRole: string;
};

export const COMPANY_FIELDS: { key: Exclude<keyof CompanyData, "size">; label: string; hint?: string }[] = [
  { key: "name", label: "Наименование на фирмата", hint: "Както е в Търговския регистър, напр. „Фасади БГ“ ЕООД" },
  { key: "eik", label: "ЕИК", hint: "9 или 13 цифри" },
  { key: "vat", label: "Номер по ДДС", hint: "Напр. BG123456789. Оставете празно, ако не сте регистрирани по ДДС" },
  { key: "address", label: "Седалище и адрес на управление" },
  { key: "website", label: "Интернет адрес", hint: "Ако нямате, оставете празно" },
  { key: "email", label: "Имейл за връзка" },
  { key: "phone", label: "Телефон за връзка" },
  { key: "contact", label: "Лице за контакт" },
  { key: "repName", label: "Представляващ — име и фамилия", hint: "Управителят или друг законен представител" },
  { key: "repRole", label: "Длъжност на представляващия", hint: "Напр. управител" },
];

export const COMPANY_SIZES = ["микро", "малко", "средно", "голямо"] as const;

export const EMPTY_COMPANY: CompanyData = {
  name: "",
  eik: "",
  vat: "",
  address: "",
  website: "",
  email: "",
  phone: "",
  contact: "",
  size: "",
  repName: "",
  repRole: "",
};

/** Откъс от обявлението; `verified` — кодът го е намерил дословно в текста. */
export type Quote = { text: string; verified: boolean };

export type CompanyFit = "покривате" | "проверете" | "не покривате" | "няма данни";

export type SelectionItem = {
  part: "IV.А" | "IV.Б" | "IV.В" | "IV.Г";
  title: string;
  requirement: string;
  declare: string;
  evidence: string;
  quote: Quote;
  fit: CompanyFit;
  fitWhy: string;
  /** Числа от текста на модела, които ги няма в обявлението. */
  badNumbers?: string[];
};

/** Разборът на обявлението (AI + проверка на цитатите). Пази се в tenders.apply_guides. */
export type TenderGuide = {
  version: 1;
  tenderId: number;
  /** id-то, на което е намерено обявлението (при обособени позиции е друго). */
  noticeTenderId: number;
  title: string;
  buyer: string;
  deadline: string | null;
  officialUrl: string;
  createdAt: string;
  /** Хеш на текста на обявлението, по който е правен разборът. */
  noticeHash: string;
  procedure: { type: string; quote: Quote };
  espdRequired: { answer: "да" | "не" | "не е ясно"; quote: Quote | null };
  lots: { number: string; title: string }[];
  deadlines: { what: string; when: string; quote: Quote; badNumbers?: string[] }[];
  exclusion: { ground: string; part: "III.А" | "III.Б" | "III.В" | "III.Г" | "друго"; quote: Quote }[];
  art55: { answer: "прилагат се" | "не се прилагат" | "не е ясно"; quote: Quote | null };
  generalSelectionOnly: boolean;
  selection: SelectionItem[];
  guarantees: { kind: string; amount: string; quote: Quote; badNumbers?: string[] }[];
  award: { summary: string; quote: Quote; badNumbers?: string[] } | null;
  offerContents: { item: string; quote: Quote | null }[];
  watchOut: { text: string; quote: Quote; badNumbers?: string[] }[];
  overall: string;
  /** Колко цитата не са намерени дословно или имат непознати числа (за предупреждение най-горе). */
  unverified: number;
  /** Обявлението е било по-дълго от прочетеното. */
  truncated?: boolean;
  /** Колко милисекунди отне разборът. */
  ms?: number;
  /** Профилът е ползван за сравнение („покривате ли изискването“). */
  personal: boolean;
};

/** Общият формат на ръководството — от него се рисуват и страницата, и Word файлът. */
export type GuideBlock =
  | { kind: "h2"; text: string; id?: string }
  | { kind: "h3"; text: string }
  | { kind: "h4"; text: string }
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: string[] }
  | { kind: "field"; label: string; value: string }
  | { kind: "quote"; quote: Quote; source?: string }
  | { kind: "warn"; text: string };

/** Откъс от документите на процедура: в кой документ е („УК“, „ЕФ“, „КР“). */
export type DocQuote = Quote & { doc: string };

export type GrantItem = { text: string; quote: DocQuote | null; badNumbers?: string[] };

/** Разборът на условията на процедура в ИСУН. Общ за всички фирми (не зависи от профила). */
export type GrantGuide = {
  version: 1;
  grantId: string;
  code: string | null;
  title: string;
  programme: string | null;
  url: string;
  deadline: string | null;
  createdAt: string;
  docsHash: string;
  /** Кои документи са прочетени: етикет → име на файла. */
  docs: { label: string; name: string; chars: number; truncated: boolean }[];
  files: string[];
  amendments: string[];
  /** „конкурентна“ или „директно предоставяне“ (само за посочени бенефициенти). */
  procedureKind: string;
  summary: string;
  whoCanApply: GrantItem[];
  cannotApply: GrantItem[];
  money: (GrantItem & { what: string })[];
  aidRegime: GrantItem | null;
  activities: GrantItem[];
  costsOk: GrantItem[];
  costsNot: GrantItem[];
  duration: GrantItem | null;
  deadlines: (GrantItem & { what: string })[];
  criteria: (GrantItem & { points: string; tip: string })[];
  formSections: (GrantItem & { section: string; tips: string[] })[];
  documents: (GrantItem & { name: string; signs: string })[];
  submission: GrantItem[];
  watchOut: GrantItem[];
  unverified: number;
  ms?: number;
};

/** Оценка доколко процедурата е за конкретната фирма — отделно, по профила. */
export type GrantFit = {
  createdAt: string;
  guideCreatedAt: string;
  verdict: "подходяща" | "може би" | "не е подходяща";
  why: string;
  checks: { requirement: string; fit: CompanyFit; why: string }[];
  prepare: string[];
  clarify: string[];
};

const money = new Intl.NumberFormat("bg-BG", { maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("bg-BG", {
  timeZone: "Europe/Sofia",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("bg-BG", {
  timeZone: "Europe/Sofia",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatEur(value: number | null | undefined) {
  if (value === null || value === undefined) return "Не е посочена";
  return `${money.format(value)} €`;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return dateFmt.format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${dateFmt.format(d)}, ${timeFmt.format(d)} ч.`;
}

/** „остават 12 дни“ / „последен ден“ / „изтекъл“. */
export function deadlineLabel(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return { text: "Без срок", tone: "muted" as const };
  const ms = Date.parse(iso) - now;
  if (ms < 0) return { text: "Срокът е изтекъл", tone: "muted" as const };
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return { text: "Последен ден", tone: "urgent" as const };
  if (days === 1) return { text: "Остава 1 ден", tone: "urgent" as const };
  return { text: `Остават ${days} дни`, tone: days <= 5 ? ("urgent" as const) : ("ok" as const) };
}

/** Параметри от URL-а → числа или undefined. */
export function numParam(v: string | string[] | undefined) {
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function strParam(v: string | string[] | undefined) {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

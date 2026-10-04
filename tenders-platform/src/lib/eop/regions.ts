/**
 * Областите на България по NUTS 3 — така ЦАИС ЕОП пише мястото на
 * изпълнение (`executionPlaceNuts`) и адреса на възложителя.
 * "BG" без цифри значи „цялата страна“.
 */
export const REGIONS: Record<string, string> = {
  BG311: "Видин",
  BG312: "Монтана",
  BG313: "Враца",
  BG314: "Плевен",
  BG315: "Ловеч",
  BG321: "Велико Търново",
  BG322: "Габрово",
  BG323: "Русе",
  BG324: "Разград",
  BG325: "Силистра",
  BG331: "Варна",
  BG332: "Добрич",
  BG333: "Шумен",
  BG334: "Търговище",
  BG341: "Бургас",
  BG342: "Сливен",
  BG343: "Ямбол",
  BG344: "Стара Загора",
  BG411: "София (столица)",
  BG412: "София (област)",
  BG413: "Благоевград",
  BG414: "Перник",
  BG415: "Кюстендил",
  BG421: "Пловдив",
  BG422: "Хасково",
  BG423: "Пазарджик",
  BG424: "Смолян",
  BG425: "Кърджали",
};

/** Подредени по име — за падащите менюта. */
export const REGION_OPTIONS = Object.entries(REGIONS)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name, "bg"));

export function regionName(code: string | null | undefined): string {
  if (!code) return "Не е посочено";
  if (code === "BG") return "Цялата страна";
  return REGIONS[code] ?? code;
}

/** Само валидни кодове на области; всичко друго (BG, BG4, празно) → null. */
export function normalizeRegion(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  return c in REGIONS ? c : null;
}

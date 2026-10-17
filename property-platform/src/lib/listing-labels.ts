import type {
  ConstructionStage,
  ListingDealType,
  ListingStatus,
  PropertyType,
} from "@/lib/types/database";

export const DEAL_TYPE_LABELS: Record<ListingDealType, string> = {
  rent: "Под наем",
  sale: "Продажба",
};

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: "Апартамент",
  house: "Къща",
  plot: "Парцел",
  office: "Офис",
  shop: "Магазин",
};

export const STATUS_LABELS: Record<ListingStatus, string> = {
  active: "Активна",
  inactive: "Неактивна",
  expired: "Неактуална",
  archived: "Архивирана",
};

// Етапите на новото строителство, както ги знае купувачът. „Акт 16“
// се пояснява, защото точно той значи „можеш да се нанесеш“.
export const CONSTRUCTION_STAGE_LABELS: Record<ConstructionStage, string> = {
  planned: "Предстоящ",
  building: "В строеж",
  act14: "Акт 14",
  act15: "Акт 15",
  act16: "Акт 16 — готов",
};

/**
 * Етапът, както да го прочете купувачът — заедно със срока, когато го има.
 *
 * Самият етап отговаря само наполовина: „в строеж“ не казва дали чакаш
 * една година или пет. imot.bg дава срока („Ще бъде въведен в експлоатация
 * 2029 г.“) и той е по-важният от двата за човек, който избира.
 */
export function constructionLabel(
  stage: ConstructionStage | null,
  completionYear: number | null,
) {
  if (!stage) return completionYear ? `Готов ${completionYear}` : null;
  const base = CONSTRUCTION_STAGE_LABELS[stage];
  if (stage === "act16" || !completionYear) return base;
  return `${base} · готов ${completionYear}`;
}

export const HEATING_OPTIONS = [
  "ТЕЦ",
  "Климатик",
  "Локално отопление (газ)",
  "Термопомпа",
  "Без отопление",
];

// Снимките не са задължителни — това е само препоръка, показвана в UI-то.
export const MIN_LISTING_PHOTOS_HINT = 5;
export const MAX_LISTING_PHOTOS = 30;

// Съвпада с default-а на profiles.listing_limit в базата (0023_listing_limit.sql) —
// само fallback, ако полето по някаква причина липсва в отговора.
export const DEFAULT_LISTING_LIMIT = 3;

// Показван при достигнат лимит на обяви (виж createListing).
export const SUPPORT_EMAIL = "imotpoint@gmail.com";

export function formatPrice(price: number) {
  return `${price.toLocaleString("bg-BG")} €`;
}

import type {
  ListingDealType,
  ListingStatus,
  PropertyType,
  SubscriptionPlan,
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
};

export const HEATING_OPTIONS = [
  "ТЕЦ",
  "Климатик",
  "Локално отопление (газ)",
  "Термопомпа",
  "Без отопление",
];

export const MIN_LISTING_PHOTOS = 5;
export const MAX_LISTING_PHOTOS = 30;

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  basic: "Free",
  pro: "Pro",
  unlimited: "Unlimited",
};

// Примерни (непотвърдени) цени в евро — България премина към еврото.
export const PLAN_PRICES_EUR: Record<SubscriptionPlan, number> = {
  basic: 0,
  pro: 10,
  unlimited: 20,
};

// Публикуването на обяви е безплатно и неограничено за всички. Абонаментът
// (Pro/Unlimited) отключва пълния достъп при ТЪРСЕНЕ на обяви — всички
// снимки, описание, точен квартал и възможност за писане на собственика.
// "basic" (Free) вижда само ограничена версия на чужди обяви.
export function hasFullSearchAccess(plan: SubscriptionPlan) {
  return plan !== "basic";
}

export function formatPrice(price: number) {
  return `${price.toLocaleString("bg-BG")} €`;
}

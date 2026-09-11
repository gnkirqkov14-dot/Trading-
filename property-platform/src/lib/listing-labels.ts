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
  archived: "Архивирана",
};

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

// ВРЕМЕННО ЗА СТАРТА: пълен достъп за всички, без абонамент — собственикът
// поиска да скрием плащанията в началото на маркетинга. Инфраструктурата
// (subscription_plan, /pricing, RLS) остава непокътната за занапред — само
// тази проверка е сменена, за да върнем платения достъп занапред, смени
// обратно на `return plan !== "basic";`.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function hasFullSearchAccess(plan: SubscriptionPlan) {
  return true;
}

export function formatPrice(price: number) {
  return `${price.toLocaleString("bg-BG")} €`;
}

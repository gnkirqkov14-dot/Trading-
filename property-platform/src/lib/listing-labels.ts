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
  basic: "Basic",
  pro: "Pro",
  unlimited: "Unlimited",
};

export const PLAN_ACTIVE_LISTING_LIMITS: Record<SubscriptionPlan, number> = {
  basic: 3,
  pro: 15,
  unlimited: Infinity,
};

export const PLAN_PRICES_BGN: Record<SubscriptionPlan, number> = {
  basic: 0,
  pro: 19,
  unlimited: 39,
};

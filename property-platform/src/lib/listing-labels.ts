import type {
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
export const SUPPORT_EMAIL = "imotspot.help@gmail.com";

export function formatPrice(price: number) {
  return `${price.toLocaleString("bg-BG")} €`;
}

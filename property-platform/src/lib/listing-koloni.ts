/**
 * Колоните на обява без контактите. Телефон, адрес, описание и координати не
 * се четат с `select`, а през `obyava_kontakti`, която брои отворените обяви.
 */
export const KOLONI_BEZ_KONTAKTI =
  "id, user_id, created_at, updated_at, type, property_type, price, area_sqm, rooms, floor, year_built, heating, has_parking, has_elevator, has_terrace, is_furnished, title, status, project_name, construction_stage, completion_year, city_id, neighborhood_id, developer_id";

export type KontaktiNaObyava = {
  description: string | null;
  address: string;
  /** Само за собственика; за другите идва през `obyava_telefon`. */
  phone: string | null;
  lat: number | null;
  lng: number | null;
};

export type OtgovorKontakti = KontaktiNaObyava | { limit: true } | null;

export function imaKontakti(
  otgovor: OtgovorKontakti,
): otgovor is KontaktiNaObyava {
  return otgovor !== null && !("limit" in otgovor);
}

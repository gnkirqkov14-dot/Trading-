/** Една поръчка (или обособена позиция) така, както я пазим в базата. */
export type Tender = {
  /** tenderId от ЦАИС ЕОП — уникален и за всяка обособена позиция. */
  id: number;
  notice_id: number | null;
  procurement_number: string | null;
  title: string;
  lot_number: string | null;
  lot_title: string | null;
  description: string | null;
  notice_type: string | null;
  procedure_type: string | null;
  contract_type: string | null;
  cpv_code: string | null;
  cpv_label: string | null;
  cpv_division: string | null;
  buyer_name: string;
  buyer_eik: string | null;
  buyer_type: string | null;
  buyer_activity: string | null;
  buyer_locality: string | null;
  region_code: string | null;
  value_eur: number | null;
  deadline_at: string | null;
  published_at: string | null;
  eu_funded: boolean;
  eu_program: string | null;
  is_cancelled: boolean;
  source_date: string;
};

export type TenderFilters = {
  q?: string;
  region?: string;
  category?: string;
  minValue?: number;
  maxValue?: number;
  /** По подразбиране само поръчки, по които още може да се кандидатства. */
  openOnly?: boolean;
  /** Само записи, вкарани или обновени след този момент (за известията). */
  updatedSince?: string;
  sort?: "deadline" | "newest" | "value";
  /** Вид поръчка, както е в данните: Доставки / Услуги / Строителство. */
  kind?: ContractKind;
  /** Част от името на възложителя („община варна“). */
  buyer?: string;
  buyerType?: BuyerType;
  euOnly?: boolean;
  /** Само събиране на оферти с обява (по-малка стойност, чл. 20, ал. 3 ЗОП). */
  smallOnly?: boolean;
  /** Поне толкова дни до срока за оферти — време за подготовка. */
  minDays?: number;
  /** Публикувани през последните толкова дни. */
  newDays?: number;
  limit?: number;
  offset?: number;
};

export const CONTRACT_KINDS = ["Доставки", "Услуги", "Строителство"] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];

/** Групи възложители по `buyer_type` от данните (виж 0006_search_filters.sql). */
export const BUYER_TYPES = {
  municipal: "Общини",
  state: "Министерства, агенции и други държавни органи",
  company: "Държавни и общински дружества",
  public: "Публичноправни организации (напр. училища, университети, болници)",
} as const;
export type BuyerType = keyof typeof BUYER_TYPES;

export type SearchResult = { rows: Tender[]; total: number };

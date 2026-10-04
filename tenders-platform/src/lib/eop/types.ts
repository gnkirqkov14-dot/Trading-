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
  limit?: number;
  offset?: number;
};

export type SearchResult = { rows: Tender[]; total: number };

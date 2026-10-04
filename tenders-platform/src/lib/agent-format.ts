import { divisionName } from "@/lib/eop/cpv";
import { regionName } from "@/lib/eop/regions";
import type { Tender } from "@/lib/eop/types";
import { SITE_URL, officialUrl } from "@/lib/site";

/**
 * Какво получава ботът за една поръчка: изчистени полета с английски
 * имена, сума в евро, срок в UTC и два линка — нашата страница (води
 * трафик към сайта) и официалната в ЦАИС ЕОП. Лични данни няма: само
 * юридически лица и техните публични реквизити.
 */
export function toAgentTender(t: Tender, withDescription = false) {
  return {
    id: t.id,
    url: `${SITE_URL}/tenders/${t.id}`,
    official_url: officialUrl(t.id),
    procurement_number: t.procurement_number,
    title: t.title,
    lot: t.lot_number ? { number: t.lot_number, title: t.lot_title } : null,
    buyer: { name: t.buyer_name, eik: t.buyer_eik, type: t.buyer_type, locality: t.buyer_locality },
    region: t.region_code ? { nuts3: t.region_code, name: regionName(t.region_code) } : null,
    category: t.cpv_division ? { cpv_division: t.cpv_division, name_bg: divisionName(t.cpv_division) } : null,
    cpv: t.cpv_code ? { code: t.cpv_code, label_bg: t.cpv_label } : null,
    contract_type_bg: t.contract_type,
    procedure_bg: t.procedure_type ?? t.notice_type,
    estimated_value_eur: t.value_eur,
    deadline_utc: t.deadline_at,
    published_utc: t.published_at,
    eu_funded: t.eu_funded,
    eu_program: t.eu_program,
    cancelled: t.is_cancelled,
    ...(withDescription ? { description_bg: t.description } : {}),
  };
}

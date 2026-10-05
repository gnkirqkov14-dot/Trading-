import { CPV_DIVISIONS } from "@/lib/eop/cpv";
import { REGIONS } from "@/lib/eop/regions";
import { BUYER_TYPES, CONTRACT_KINDS, type BuyerType, type ContractKind, type TenderFilters } from "@/lib/eop/types";
import { numParam, strParam } from "@/lib/format";

type Params = Record<string, string | string[] | undefined>;

/** Стойностите в падащите менюта — други не се приемат. */
export const MIN_DAYS = [7, 14, 30] as const;
export const NEW_DAYS = [1, 3, 7] as const;

function dayParam(v: Params[string], allowed: readonly number[]) {
  const n = numParam(v);
  return n !== undefined && allowed.includes(n) ? n : undefined;
}

/**
 * Едни и същи филтри за страницата, за известията и за ботовете.
 * Непознати стойности (грешен код на област) се изхвърлят, вместо да
 * връщат празен резултат без обяснение.
 */
export function filtersFromParams(params: Params): TenderFilters {
  const region = strParam(params.region)?.toUpperCase();
  const category = strParam(params.category);
  const sort = strParam(params.sort);
  const kind = strParam(params.kind);
  const buyerType = strParam(params.btype);
  return {
    q: strParam(params.q)?.slice(0, 120),
    region: region && region in REGIONS ? region : undefined,
    category: category && category in CPV_DIVISIONS ? category : undefined,
    minValue: numParam(params.min),
    maxValue: numParam(params.max),
    openOnly: strParam(params.all) !== "1",
    sort: sort === "newest" || sort === "value" ? sort : "deadline",
    kind: kind && (CONTRACT_KINDS as readonly string[]).includes(kind) ? (kind as ContractKind) : undefined,
    buyer: strParam(params.buyer)?.slice(0, 120),
    buyerType: buyerType && buyerType in BUYER_TYPES ? (buyerType as BuyerType) : undefined,
    euOnly: strParam(params.eu) === "1" || undefined,
    smallOnly: strParam(params.small) === "1" || undefined,
    minDays: dayParam(params.days, MIN_DAYS),
    newDays: dayParam(params.new, NEW_DAYS),
  };
}

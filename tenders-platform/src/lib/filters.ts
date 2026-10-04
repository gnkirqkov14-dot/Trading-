import { CPV_DIVISIONS } from "@/lib/eop/cpv";
import { REGIONS } from "@/lib/eop/regions";
import type { TenderFilters } from "@/lib/eop/types";
import { numParam, strParam } from "@/lib/format";

type Params = Record<string, string | string[] | undefined>;

/**
 * Едни и същи филтри за страницата, за известията и за ботовете.
 * Непознати стойности (грешен код на област) се изхвърлят, вместо да
 * връщат празен резултат без обяснение.
 */
export function filtersFromParams(params: Params): TenderFilters {
  const region = strParam(params.region)?.toUpperCase();
  const category = strParam(params.category);
  const sort = strParam(params.sort);
  return {
    q: strParam(params.q)?.slice(0, 120),
    region: region && region in REGIONS ? region : undefined,
    category: category && category in CPV_DIVISIONS ? category : undefined,
    minValue: numParam(params.min),
    maxValue: numParam(params.max),
    openOnly: strParam(params.all) !== "1",
    sort: sort === "newest" || sort === "value" ? sort : "deadline",
  };
}

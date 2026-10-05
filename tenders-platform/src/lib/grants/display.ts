import { deadlineLabel, formatEur } from "@/lib/format";
import type { GrantCall } from "./types";

const monthFmt = new Intl.DateTimeFormat("bg-BG", { timeZone: "Europe/Sofia", month: "long", year: "numeric" });

/** „Отворена · остават 12 дни“ / „Предстои скоро“ / „Предстои: март 2027 г.“ */
export function grantStatus(g: GrantCall) {
  if (g.kind === "open") {
    const d = deadlineLabel(g.deadline_at);
    return { text: g.deadline_at ? `Отворена · ${d.text.toLowerCase()}` : "Отворена", tone: d.tone };
  }
  if (g.kind === "discussion") return { text: "Предстои скоро (на обсъждане)", tone: "ok" as const };
  return {
    text: g.opens_at ? `Предстои: ${monthFmt.format(new Date(g.opens_at))} (по план)` : "Предстои (по план)",
    tone: "muted" as const,
  };
}

export function grantMoney(g: GrantCall) {
  const parts: string[] = [];
  if (g.grant_min_eur && g.grant_max_eur) parts.push(`${formatEur(g.grant_min_eur)} – ${formatEur(g.grant_max_eur)} на проект`);
  else if (g.grant_max_eur) parts.push(`до ${formatEur(g.grant_max_eur)} на проект`);
  else if (g.grant_min_eur) parts.push(`от ${formatEur(g.grant_min_eur)} на проект`);
  if (g.max_aid_pct) parts.push(`до ${g.max_aid_pct}% безвъзмездно`);
  if (g.budget_eur) parts.push(`общ бюджет ${formatEur(g.budget_eur)}`);
  return parts.join(" · ");
}

/**
 * Какво е — казва се на всяка картичка и в заглавието (за екранен четец).
 * Националните (ФНИ, „Стартъп виза“, министерства) идват от отделния
 * списък на ИСУН; всичко останало е по европейски програми.
 */
export function grantKindLabel(g: Pick<GrantCall, "source">) {
  return g.source === "isun_nims" ? "Национална програма" : "Европейска програма";
}

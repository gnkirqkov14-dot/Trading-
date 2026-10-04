import type { Metadata } from "next";
import { cookies } from "next/headers";
import { advisorEnabled, businessGrants } from "@/lib/advisor";
import { EMPTY_RESULTS, type SavedProfile, type TenderPick } from "@/lib/advisor/types";
import type { Tender } from "@/lib/eop/types";
import type { GrantCall } from "@/lib/grants/types";
import { SITE_URL } from "@/lib/site";
import { getStore } from "@/lib/store";
import type { MatchedTender } from "@/lib/store/types";
import { AdoptProfile, StartForm } from "./advisor-form";
import { ProfileView } from "./profile-view";

export const metadata: Metadata = {
  title: "Съветник: поръчки и европейски пари за вашата фирма",
  description:
    "Опишете с думи какво работи фирмата ви — съветникът намира обществените поръчки, в които можете да участвате, и европейските програми, от които можете да получите пари за развитие.",
  alternates: { canonical: "/advisor" },
};

// Съветникът прави до три заявки към AI модела; обикновено 30–60 секунди.
export const maxDuration = 120;
// Профилът е в бисквитка, а „включен ли е“ зависи от ключа — не се запича при build.
export const dynamic = "force-dynamic";

const TOKEN_RE = /^[0-9a-f]{48}$/;

/** Избраните от AI поръчки, на които срокът още не е изтекъл. */
function stillOpen(picks: TenderPick[], byId: Map<number, MatchedTender | Tender>) {
  const now = Date.now();
  return picks
    .map((pick) => ({ pick, tender: byId.get(pick.id) }))
    .filter((x): x is { pick: TenderPick; tender: MatchedTender | Tender } =>
      Boolean(x.tender?.deadline_at && Date.parse(x.tender.deadline_at) > now),
    );
}

export default async function AdvisorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const fromLink = typeof sp.p === "string" && TOKEN_RE.test(sp.p) ? sp.p : null;
  const fromCookie = (await cookies()).get("advisor_profile")?.value ?? null;
  const token = fromLink ?? (fromCookie && TOKEN_RE.test(fromCookie) ? fromCookie : null);

  const store = getStore();
  const saved = token ? await store.getProfile(token).catch(() => null) : null;

  if (!saved) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Съветник</p>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Разкажете за фирмата си. Ние ще ви кажем къде да участвате и откъде да вземете пари.
          </h1>
          <p className="text-slate-600">
            Както при консултант по проекти: опишете с ваши думи какво правите, за кого и къде.
            Съветникът преглежда всички отворени обществени поръчки и европейските програми —
            отворените и тези, които предстоят — и избира подходящите за вас, с обяснение какво да
            подготвите. Профилът ви се запазва, за да не пишете всичко отначало следващия път.
          </p>
        </header>
        <StartForm enabled={advisorEnabled} />
      </div>
    );
  }

  const profile: SavedProfile = { ...saved, results: { ...EMPTY_RESULTS, ...saved.results } };
  const f = profile.filters;

  // Каквото е избрал AI + каквото дават филтрите сега (без AI, безплатно).
  const [matches, grants] = await Promise.all([
    f.tenders ? store.matchTenders(f, 40).catch(() => [] as MatchedTender[]) : Promise.resolve([] as MatchedTender[]),
    businessGrants().catch(() => [] as GrantCall[]),
  ]);
  const byId = new Map<number, MatchedTender | Tender>(matches.map((t) => [t.id, t]));
  const missing = profile.results.tenders.filter((p) => !byId.has(p.id)).map((p) => p.id);
  for (const t of await Promise.all(missing.map((id) => store.getTender(id).catch(() => null)))) {
    if (t) byId.set(t.id, t);
  }
  const pickedTenders = stillOpen(profile.results.tenders, byId);
  const pickedIds = new Set(pickedTenders.map((x) => x.tender.id));
  const moreTenders = matches.filter((t) => !pickedIds.has(t.id)).slice(0, 10);

  const grantById = new Map(grants.map((g) => [g.id, g]));
  const pickedGrants = profile.results.grants
    .map((p) => ({ pick: p, grant: grantById.get(p.id) }))
    .filter((x): x is { pick: (typeof x)["pick"]; grant: GrantCall } => Boolean(x.grant));

  return (
    <>
      {fromLink && fromLink !== fromCookie ? <AdoptProfile token={fromLink} /> : null}
      <ProfileView
        profile={profile}
        enabled={advisorEnabled}
        shareUrl={`${SITE_URL}/advisor?p=${profile.token}`}
        pickedTenders={pickedTenders}
        moreTenders={moreTenders}
        pickedGrants={pickedGrants}
        grantsTotal={grants.length}
      />
    </>
  );
}

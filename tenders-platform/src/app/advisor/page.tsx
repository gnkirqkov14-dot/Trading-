import type { Metadata } from "next";
import { advisorEnabled } from "@/lib/advisor";
import { AdvisorForm } from "./advisor-form";

export const metadata: Metadata = {
  title: "Съветник: в кои поръчки може да участва фирмата ви",
  description:
    "Опишете с думи какво работи фирмата ви, а съветникът ще намери отворените обществени поръчки, в които има смисъл да кандидатствате, и ще обясни защо.",
  alternates: { canonical: "/advisor" },
};

// Съветникът прави две заявки към AI модела; обикновено 20–60 секунди.
export const maxDuration = 120;
// Иначе страницата се рендира при build и „включен ли е“ се запича.
export const dynamic = "force-dynamic";

export default function AdvisorPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Съветник</p>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Разкажете за фирмата си. Ние ще ви кажем къде да участвате.
        </h1>
        <p className="text-slate-600">
          Както при консултант: опишете с ваши думи какво правите, за кого и къде. Съветникът
          преглежда всички отворени обществени поръчки и избира тези, които са за вас, с
          обяснение защо и какво да проверите преди да кандидатствате.
        </p>
      </header>
      <AdvisorForm enabled={advisorEnabled} />
    </div>
  );
}

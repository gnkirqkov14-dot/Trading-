import type { Metadata } from "next";
import Link from "next/link";
import { ProverkaNaImot } from "@/components/proverka-na-imot";
import { SEO_CITIES } from "@/lib/seo-cities";
import type { Vid } from "@/lib/proverka-na-imot";

export const metadata: Metadata = {
  title: "Проверка на имот: документи преди покупка или наем",
  description:
    "Безплатен списък с документите, които да поискаш преди покупка или наем на имот, наредени по важност. Какво да провериш сам, какво да гледаш на огледа и как да намериш юрист близо до теб.",
  alternates: { canonical: "/proverka-na-imot" },
};

export default async function ProverkaNaImotPage({
  searchParams,
}: {
  searchParams: Promise<{ vid?: string; grad?: string }>;
}) {
  const { vid, grad } = await searchParams;
  const nachalenVid: Vid = vid === "naem" ? "naem" : "pokupka";
  const nachalenGrad = typeof grad === "string" ? grad.slice(0, 60) : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm font-bold uppercase tracking-wide text-accent-700 print:hidden">
        Безплатно · без регистрация
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">
        Проверка на имот
      </h1>
      <p className="mt-3 text-lg text-slate-600">
        Когато купуваш или наемаш без агенция, проверката е в твоите ръце. Тук
        е всичко по ред: кои документи да поискаш, какво да видиш сам и кога
        да потърсиш юрист.
      </p>

      <div className="mt-8">
        <ProverkaNaImot
          nachalenVid={nachalenVid}
          nachalenGrad={nachalenGrad}
          gradove={SEO_CITIES.map((c) => c.name)}
        />
      </div>

      <p className="mt-12 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
        Информацията е обща и не е правен съвет. Всеки имот е различен —
        преди да платиш капаро или да подпишеш, покажи документите на адвокат
        или нотариус. IMOT POINT не участва в сделките и не проверява
        документите на обявите.
      </p>

      <p className="mt-6 text-center print:hidden">
        <Link
          href="/listings"
          className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-900"
        >
          Към обявите
        </Link>
      </p>
    </div>
  );
}

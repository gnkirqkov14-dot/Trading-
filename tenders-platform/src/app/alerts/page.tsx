import type { Metadata } from "next";
import { emailEnabled } from "@/lib/email";
import { strParam } from "@/lib/format";
import { SubscribeForm } from "./subscribe-form";

export const metadata: Metadata = {
  title: "Известия по имейл",
  description: "Всяка сутрин новите обществени поръчки за вашия бранш и област на имейла ви.",
  alternates: { canonical: "/alerts" },
};

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Новите поръчки идват при вас</h1>
        <p className="text-slate-600">
          Изберете бранш, област и бюджет. Всяка сутрин, когато има нови поръчки по тези условия,
          ще получите едно писмо с тях. Без реклами и без спам.
        </p>
      </header>
      <SubscribeForm
        enabled={emailEnabled}
        defaults={{
          q: strParam(p.q),
          region: strParam(p.region),
          category: strParam(p.category),
          min: strParam(p.min),
        }}
      />
    </div>
  );
}

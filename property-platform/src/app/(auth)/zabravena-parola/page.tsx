import type { Metadata } from "next";
import { ZabravenaParolaForm } from "@/components/zabravena-parola-form";

export const metadata: Metadata = {
  title: "Забравена парола",
  robots: { index: false },
};

export default async function ZabravenaParolaPage({
  searchParams,
}: {
  searchParams: Promise<{ greshka?: string }>;
}) {
  const { greshka } = await searchParams;
  return (
    <>
      <h1 className="mb-2 text-center text-xl font-semibold">
        Забравена парола
      </h1>
      <p className="mb-6 text-center text-sm text-slate-600">
        Напиши имейла си и ще ти пратим линк, с който да си избереш нова
        парола.
      </p>
      {greshka && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Линкът не е валиден или е изтекъл. Отвори го в същия браузър, от
          който си го поискал, или поискай нов оттук.
        </p>
      )}
      <ZabravenaParolaForm />
    </>
  );
}

import Link from "next/link";
import { field } from "@/app/advisor/styles";
import { COMPANY_FIELDS, COMPANY_SIZES, type CompanyData } from "@/lib/apply/types";
import { saveCompanyData } from "./actions";

const AUTOCOMPLETE: Partial<Record<keyof CompanyData, string>> = {
  name: "organization",
  address: "street-address",
  website: "url",
  email: "email",
  phone: "tel",
  contact: "name",
  repName: "name",
  repRole: "organization-title",
};

/** Данните на фирмата за документите — общи за помощта по поръчки и по програми. */
export function CompanyForm({
  company,
  hasProfile,
  returnTo,
  purpose,
}: {
  company: Partial<CompanyData>;
  hasProfile: boolean;
  returnTo: string;
  purpose: string;
}) {
  const hasCompany = Boolean(company.name || company.eik);
  return (
    <section aria-labelledby="danni" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 id="danni" tabIndex={-1} className="scroll-mt-4 text-xl font-bold text-slate-900">
        Данни на фирмата за документите
      </h2>
      {hasProfile ? (
        <details open={!hasCompany} className="space-y-3">
          <summary className="cursor-pointer font-medium text-brand-700">
            {hasCompany ? `Въведени: ${company.name || company.eik}. Промяна на данните` : "Попълнете данните на фирмата"}
          </summary>
          <p className="mt-2 text-sm text-slate-600">
            С тях ще ви покажем готов текст за преписване в {purpose}. Пазят се в профила ви и не се
            показват на никого. ЕГН и дата на раждане не питаме.
          </p>
          <form action={saveCompanyData} className="mt-3 space-y-4">
            <input type="hidden" name="return_to" value={returnTo} />
            {COMPANY_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <label htmlFor={`c-${f.key}`} className="block font-medium text-slate-900">
                  {f.label}
                </label>
                <input
                  id={`c-${f.key}`}
                  name={f.key}
                  defaultValue={company[f.key] ?? ""}
                  maxLength={300}
                  autoComplete={AUTOCOMPLETE[f.key] ?? "off"}
                  aria-describedby={f.hint ? `c-${f.key}-hint` : undefined}
                  className={field}
                />
                {f.hint ? (
                  <p id={`c-${f.key}-hint`} className="text-sm text-slate-500">
                    {f.hint}
                  </p>
                ) : null}
              </div>
            ))}
            <fieldset className="space-y-2">
              <legend className="font-medium text-slate-900">Размер на предприятието</legend>
              <p id="c-size-hint" className="text-sm text-slate-500">
                Микро — до 9 души; малко — до 49; средно — до 249 (и съответният оборот).
              </p>
              <div className="flex flex-wrap gap-2">
                {COMPANY_SIZES.map((s) => (
                  <label
                    key={s}
                    className="cursor-pointer rounded-full border border-slate-300 px-3 py-1.5 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500"
                  >
                    <input
                      type="radio"
                      name="size"
                      value={s}
                      defaultChecked={company.size === s}
                      aria-describedby="c-size-hint"
                      className="sr-only"
                    />
                    {s}
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Запази данните
            </button>
          </form>
        </details>
      ) : (
        <p className="text-slate-700">
          За да попълним данните на фирмата и да сравним изискванията с нея, първо{" "}
          <Link href="/advisor" className="font-medium text-brand-700 underline">
            опишете фирмата в съветника
          </Link>
          . Помощта по-долу работи и без това, но без сравнение с вашата фирма.
        </p>
      )}
    </section>
  );
}

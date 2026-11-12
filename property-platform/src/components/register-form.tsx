"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signUp, type AuthFormState } from "@/lib/actions/auth";
import { OAuthButtons } from "@/components/oauth-buttons";
import { Turnstile } from "@/components/turnstile";
import { TURNSTILE_SITE_KEY } from "@/lib/turnstile";

const POLE = "rounded-lg border px-3 py-2 outline-none";
const POLE_OK = `${POLE} border-slate-300 focus:border-slate-900`;
const POLE_GRESHKA = `${POLE} border-red-500 bg-red-50 focus:border-red-600`;

/** Текстът под празно или грешно попълнено поле. */
function suobshtenie(pole: HTMLInputElement) {
  if (pole.validity.valueMissing) return "Това поле е задължително.";
  if (pole.validity.typeMismatch) return "Въведете валиден имейл.";
  if (pole.validity.tooShort) return "Поне 8 символа.";
  return pole.validationMessage;
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(signUp, undefined);
  // „Не съм робот“: без жетон бутонът чака (само ако проверката е включена).
  const [zheton, setZheton] = useState("");
  const chakaProverka = Boolean(TURNSTILE_SITE_KEY) && !zheton;
  // Грешките по полета: от проверката в браузъра и от сървъра.
  const [greshkiBrauzar, setGreshkiBrauzar] = useState<Record<string, string>>(
    {},
  );
  // Грешката от сървъра изчезва, щом човекът поправи полето.
  const [popravena, setPopravena] = useState<AuthFormState>();
  const greshki =
    state?.pole && popravena !== state
      ? { ...greshkiBrauzar, [state.pole]: state.error }
      : greshkiBrauzar;
  const parvoNevalidno = useRef(true);
  const formaRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.pole) return;
    const pole = formaRef.current?.elements.namedItem(state.pole);
    if (pole instanceof HTMLInputElement) {
      pole.scrollIntoView({ behavior: "smooth", block: "center" });
      pole.focus({ preventScroll: true });
    }
  }, [state]);

  // Вместо балончето на браузъра: полето светва в червено и страницата
  // се връща до първото празно поле.
  function naNevalidno(e: React.FormEvent<HTMLFormElement>) {
    const pole = e.target;
    if (!(pole instanceof HTMLInputElement)) return;
    e.preventDefault();
    setGreshkiBrauzar((g) => ({ ...g, [pole.name]: suobshtenie(pole) }));
    if (parvoNevalidno.current) {
      parvoNevalidno.current = false;
      pole.scrollIntoView({ behavior: "smooth", block: "center" });
      pole.focus({ preventScroll: true });
      setTimeout(() => {
        parvoNevalidno.current = true;
      });
    }
  }

  function naVavezhdane(e: React.FormEvent<HTMLFormElement>) {
    const pole = e.target;
    if (!(pole instanceof HTMLInputElement) || !greshki[pole.name]) return;
    if (pole.name === state?.pole) setPopravena(state);
    setGreshkiBrauzar((g) => {
      const ostanali = { ...g };
      delete ostanali[pole.name];
      return ostanali;
    });
  }

  const klas = (ime: string) => (greshki[ime] ? POLE_GRESHKA : POLE_OK);
  const greshka = (ime: string) =>
    greshki[ime] ? (
      <p id={`${ime}-greshka`} className="text-xs font-medium text-red-600">
        {greshki[ime]}
      </p>
    ) : null;
  const searchParams = useSearchParams();
  // Само от стената на обявата: иначе новият потребител отива на таблото.
  const redirectTo = searchParams.get("redirectTo") ?? "";
  const kam = redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : "";

  return (
    <div className="flex flex-col gap-4">
      <OAuthButtons redirectTo={redirectTo || undefined} />

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        или
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form
        ref={formaRef}
        action={action}
        onInvalidCapture={naNevalidno}
        onInput={naVavezhdane}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium text-slate-700">
            Име
          </label>
          <input
            id="name"
            name="name"
            placeholder="Иван Иванов"
            required
            aria-invalid={!!greshki.name}
            aria-describedby={greshki.name ? "name-greshka" : undefined}
            className={klas("name")}
          />
          {greshka("name")}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium text-slate-700">
            Имейл
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            aria-invalid={!!greshki.email}
            aria-describedby={greshki.email ? "email-greshka" : undefined}
            className={klas("email")}
          />
          {greshka("email")}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="phone" className="text-sm font-medium text-slate-700">
            Телефон
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="08xx xxx xxx"
            required
            aria-invalid={!!greshki.phone}
            aria-describedby={greshki.phone ? "phone-greshka" : undefined}
            className={klas("phone")}
          />
          {greshka("phone")}
          <p className="text-xs text-slate-500">
            Чужд номер? Напиши го с кода на държавата, например +49 170 1234567.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="password"
            className="text-sm font-medium text-slate-700"
          >
            Парола
          </label>
          <input
            id="password"
            name="password"
            type="password"
            minLength={8}
            required
            aria-invalid={!!greshki.password}
            aria-describedby={greshki.password ? "password-greshka" : undefined}
            className={klas("password")}
          />
          {greshka("password")}
          <p className="text-xs text-slate-500">Поне 8 символа.</p>
        </div>

        {state?.error && !state.pole && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <Turnstile onToken={setZheton} resetKey={state} />

        <button
          type="submit"
          disabled={pending || chakaProverka}
          className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
        >
          {pending ? "Регистрация…" : "Регистрирай се"}
        </button>

        <p className="text-center text-sm text-slate-500">
          Вече имате акаунт?{" "}
          <Link
            href={`/login${kam}`}
            className="font-medium text-slate-900 underline"
          >
            Вход
          </Link>
        </p>
      </form>
    </div>
  );
}

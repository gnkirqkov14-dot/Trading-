"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/actions/auth";
import { OAuthButtons } from "@/components/oauth-buttons";

export function RegisterForm() {
  const [state, action, pending] = useActionState(signUp, undefined);

  return (
    <div className="flex flex-col gap-4">
      <OAuthButtons />

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        или
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-sm font-medium text-slate-700">
            Име
          </label>
          <input
            id="name"
            name="name"
            placeholder="Иван Иванов"
            required
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
          />
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
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
          />
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
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
          />
          <p className="text-xs text-slate-500">Поне 8 символа.</p>
        </div>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
        >
          {pending ? "Регистрация…" : "Регистрирай се"}
        </button>

        <p className="text-center text-sm text-slate-500">
          Вече имате акаунт?{" "}
          <Link href="/login" className="font-medium text-slate-900 underline">
            Вход
          </Link>
        </p>
      </form>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/actions/auth";
import { OAuthButtons } from "@/components/oauth-buttons";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined);
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";
  const oauthFailed = searchParams.get("error") === "oauth_failed";

  return (
    <div className="flex flex-col gap-4">
      <OAuthButtons redirectTo={redirectTo} />

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        или
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {oauthFailed && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          Възникна грешка при вход с външен акаунт. Опитай отново.
        </p>
      )}

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />

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
            required
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900"
          />
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
          {pending ? "Влизане…" : "Вход"}
        </button>

        <p className="text-center text-sm text-slate-500">
          Нямате акаунт?{" "}
          <Link
            href="/register"
            className="font-medium text-slate-900 underline"
          >
            Регистрирайте се
          </Link>
        </p>
      </form>
    </div>
  );
}

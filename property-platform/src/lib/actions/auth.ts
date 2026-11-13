"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { gradPoIp } from "@/lib/grad-po-ip";
import {
  checkPhone,
  NOVA_PAROLA_PAT,
  PHONE_TAKEN_MESSAGE,
  safeNext,
} from "@/lib/phone";
import { TURNSTILE_GRESHKA, TURNSTILE_POLE } from "@/lib/turnstile";

// `pole` е полето, което формата оцветява в червено и показва.
export type AuthFormState = { error: string; pole?: string } | undefined;

/**
 * Жетонът от „не съм робот“. Проверява го Supabase (Attack Protection);
 * докато проверката там не е включена, просто се подминава.
 */
function zheton(formData: FormData) {
  const z = formData.get(TURNSTILE_POLE);
  return typeof z === "string" && z ? z : undefined;
}

function getRedirectTarget(formData: FormData) {
  const redirectTo = formData.get("redirectTo");
  return safeNext(typeof redirectTo === "string" ? redirectTo : null);
}

async function getSiteOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name || name.length < 2) {
    return { error: "Името трябва да е поне 2 символа.", pole: "name" };
  }
  if (!email) {
    return { error: "Въведете валиден имейл.", pole: "email" };
  }
  if (!phone) {
    return { error: "Телефонът е задължителен.", pole: "phone" };
  }
  if (password.length < 8) {
    return { error: "Паролата трябва да е поне 8 символа.", pole: "password" };
  }

  const supabase = await createClient();

  const phoneError = await checkPhone(supabase, phone);
  if (phoneError) {
    return { error: phoneError, pole: "phone" };
  }

  const { data: isBanned } = await supabase.rpc("is_contact_banned", {
    p_phone: null,
    p_email: email,
  });
  if (isBanned) {
    return { error: "Този имейл е блокиран за регистрация.", pole: "email" };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, phone, grad_ip: await gradPoIp() },
      captchaToken: zheton(formData),
    },
  });

  if (error?.code === "captcha_failed") {
    return { error: TURNSTILE_GRESHKA };
  }
  if (error) {
    // Тригерът в базата е последната проверка: двама с един номер в
    // една и съща секунда стигат дотук и получават обща грешка на Supabase.
    return {
      error: error.message.includes("Database error")
        ? PHONE_TAKEN_MESSAGE
        : error.message,
      pole: error.message.includes("Database error") ? "phone" : undefined,
    };
  }

  revalidatePath("/", "layout");
  // `?registered=1` казва на таблото (или на обявата, ако човекът идва от
  // стената) да отчете `CompleteRegistration` към Meta Pixel.
  // ⚠️ Регистрацията през Google минава по друг път
  // (`auth/callback`) и оттам не се различава нов потребител от
  // връщащ се — тези регистрации не се броят. Виж CLAUDE.md.
  redirect(
    `${safeNext(String(formData.get("redirectTo") ?? ""))}?registered=1`,
  );
}

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Въведете имейл и парола." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken: zheton(formData) },
  });

  if (error?.code === "captcha_failed") {
    return { error: TURNSTILE_GRESHKA };
  }
  if (error) {
    return { error: "Грешен имейл или парола." };
  }

  revalidatePath("/", "layout");
  redirect(getRedirectTarget(formData));
}

export type ZabravenaParolaState =
  | { error?: string; prateno?: boolean }
  | undefined;

/**
 * „Забравена парола“: праща писмо с линк за нова парола. Отговорът е един
 * и същ, има ли такъв профил или не, за да не издава кой е регистриран.
 */
export async function zabravenaParola(
  _prevState: ZabravenaParolaState,
  formData: FormData,
): Promise<ZabravenaParolaState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email || !email.includes("@")) {
    return { error: "Въведи имейла, с който си се регистрирал." };
  }

  const supabase = await createClient();
  const origin = await getSiteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(NOVA_PAROLA_PAT)}`,
    captchaToken: zheton(formData),
  });

  if (error?.code === "captcha_failed") {
    return { error: TURNSTILE_GRESHKA };
  }
  if (
    error?.code === "over_email_send_rate_limit" ||
    error?.status === 429
  ) {
    return {
      error: "Току-що пратихме писмо. Изчакай минута и опитай отново.",
    };
  }
  if (error) {
    console.error("zabravenaParola", error.code, error.message);
  }
  return { prateno: true };
}

/** Записва новата парола; стига се дотук само през линка от писмото. */
export async function novaParola(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const povtori = String(formData.get("povtori") ?? "");

  if (password.length < 8) {
    return { error: "Паролата трябва да е поне 8 символа.", pole: "password" };
  }
  if (password !== povtori) {
    return { error: "Двете пароли не съвпадат.", pole: "povtori" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/zabravena-parola?greshka=1");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error?.code === "same_password") {
    return {
      error: "Това е старата ти парола. Избери различна.",
      pole: "password",
    };
  }
  if (error) {
    return { error: "Паролата не се запази. Опитай отново." };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function signInWithOAuth(
  provider: "google" | "facebook",
  redirectTo: string,
) {
  const supabase = await createClient();
  const origin = await getSiteOrigin();
  const safeRedirect = safeNext(redirectTo);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeRedirect)}`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth_failed");
  }

  redirect(data.url);
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { gradPoIp } from "@/lib/grad-po-ip";
import { checkPhone, PHONE_TAKEN_MESSAGE, safeNext } from "@/lib/phone";

// `pole` е полето, което формата оцветява в червено и показва.
export type AuthFormState = { error: string; pole?: string } | undefined;

function getRedirectTarget(formData: FormData) {
  const redirectTo = formData.get("redirectTo");
  return typeof redirectTo === "string" && redirectTo.startsWith("/")
    ? redirectTo
    : "/dashboard";
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
    options: { data: { name, phone, grad_ip: await gradPoIp() } },
  });

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
  });

  if (error) {
    return { error: "Грешен имейл или парола." };
  }

  revalidatePath("/", "layout");
  redirect(getRedirectTarget(formData));
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
  const safeRedirect = redirectTo.startsWith("/") ? redirectTo : "/dashboard";

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

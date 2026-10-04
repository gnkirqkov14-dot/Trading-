"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { emailEnabled, sendConfirmationEmail } from "@/lib/email";
import { filtersFromParams } from "@/lib/filters";
import { getStore } from "@/lib/store";

export type SubscribeState = { ok: boolean; message: string } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function subscribe(_prev: SubscribeState, form: FormData): Promise<SubscribeState> {
  if (!emailEnabled) {
    return { ok: false, message: "Известията по имейл още не са включени. Опитайте пак след няколко дни." };
  }
  // Капан за ботове: истински човек не вижда това поле и не го попълва.
  if (String(form.get("website") ?? "") !== "") return { ok: true, message: "Готово." };

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return { ok: false, message: "Моля, въведете валиден имейл." };
  }
  if (form.get("consent") !== "on") {
    return { ok: false, message: "Нужно е съгласие, за да ви пишем." };
  }

  const filters = filtersFromParams({
    q: String(form.get("q") ?? ""),
    region: String(form.get("region") ?? ""),
    category: String(form.get("category") ?? ""),
    min: String(form.get("min") ?? ""),
  });

  const token = randomBytes(24).toString("hex");
  await getStore().createSubscription({
    email,
    q: filters.q ?? null,
    region_code: filters.region ?? null,
    cpv_division: filters.category ?? null,
    min_value: filters.minValue ?? null,
    token,
  });
  try {
    await sendConfirmationEmail(email, token);
  } catch (error) {
    console.error("Писмото за потвърждение не тръгна:", error);
    return { ok: false, message: "Не успяхме да изпратим писмото. Опитайте пак след малко." };
  }

  return {
    ok: true,
    message: "Пратихме ви писмо. Натиснете връзката в него, за да започнат известията.",
  };
}

export async function confirm(form: FormData) {
  const token = String(form.get("token") ?? "");
  const store = getStore();
  const sub = token ? await store.findSubscriptionByToken(token) : null;
  if (sub && sub.status === "pending") await store.setSubscriptionStatus(token, "active");
  redirect(`/alerts/confirm?token=${encodeURIComponent(token)}&done=1`);
}

export async function unsubscribe(form: FormData) {
  const token = String(form.get("token") ?? "");
  const store = getStore();
  const sub = token ? await store.findSubscriptionByToken(token) : null;
  if (sub) await store.setSubscriptionStatus(token, "unsubscribed");
  redirect(`/alerts/unsubscribe?token=${encodeURIComponent(token)}&done=1`);
}

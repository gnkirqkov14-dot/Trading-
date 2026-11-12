"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/dal";
import { checkPhone, PHONE_TAKEN_MESSAGE } from "@/lib/phone";

// Връща грешката като стойност: в production Next.js скрива текста на
// хвърлените грешки и потребителят не би разбрал защо номерът е отказан.
export async function updateProfile(input: {
  name: string;
  phone: string;
}): Promise<{ error: string } | undefined> {
  const user = await getAuthedUser();

  const name = input.name.trim();
  if (name.length < 2) {
    return { error: "Името трябва да е поне 2 символа." };
  }
  const phone = input.phone.trim();
  if (!phone) {
    return { error: "Телефонът е задължителен." };
  }

  const supabase = await createClient();

  const phoneError = await checkPhone(supabase, phone);
  if (phoneError) {
    return { error: phoneError };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ name, phone })
    .eq("id", user.id);

  if (error) {
    return {
      error:
        error.code === "23505"
          ? PHONE_TAKEN_MESSAGE
          : `Грешка при запис: ${error.message}`,
    };
  }

  revalidatePath("/", "layout");
}

/** Всички файлове в папката на потребителя: `<id>/<обява>/<снимка>`. */
async function snimkiNaPotrebitelya(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const kofa = supabase.storage.from("listing-photos");
  const { data: papki } = await kofa.list(userId, { limit: 1000 });
  const patishta: string[] = [];
  for (const papka of papki ?? []) {
    const { data: faylove } = await kofa.list(`${userId}/${papka.name}`, {
      limit: 1000,
    });
    for (const f of faylove ?? []) {
      patishta.push(`${userId}/${papka.name}/${f.name}`);
    }
  }
  return patishta;
}

/**
 * Изтрива профила на влезлия потребител заедно с обявите, снимките и
 * съобщенията му. Не може да се върне.
 *
 * Редът е важен: първо базата (ако тя откаже, нищо не е пипнато), после
 * файловете на снимките. Ако махането на файловете се провали, те остават
 * невидими сираци в хранилището, но обявите вече ги няма.
 */
export async function deleteAccount(): Promise<{ error: string } | undefined> {
  const user = await getAuthedUser();
  const supabase = await createClient();

  const snimki = await snimkiNaPotrebitelya(supabase, user.id);

  const { error } = await supabase.rpc("iztriy_profila_mi");
  if (error) {
    console.error("deleteAccount", user.id, error.message);
    return {
      error: error.message.includes("Администраторски")
        ? "Администраторски профил не се трие оттук."
        : "Не успяхме да изтрием профила. Опитай пак или ни пиши.",
    };
  }

  try {
    for (let i = 0; i < snimki.length; i += 100) {
      await supabase.storage
        .from("listing-photos")
        .remove(snimki.slice(i, i + 100));
    }
  } catch (err) {
    console.error("deleteAccount снимки", user.id, err);
  }

  // Потребителят вече го няма, затова изходът може да върне грешка;
  // бисквитките на входа се чистят и на ръка.
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {}
  const kutiya = await cookies();
  for (const b of kutiya.getAll()) {
    if (b.name.startsWith("sb-")) kutiya.delete(b.name);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

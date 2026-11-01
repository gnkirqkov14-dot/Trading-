"use server";

import { revalidatePath } from "next/cache";
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

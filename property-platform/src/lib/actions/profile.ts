"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/dal";

export async function updateProfile(input: { name: string; phone: string }) {
  const user = await getAuthedUser();

  const name = input.name.trim();
  if (name.length < 2) {
    throw new Error("Името трябва да е поне 2 символа.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ name, phone: input.phone.trim() || null })
    .eq("id", user.id);

  if (error) {
    throw new Error(`Грешка при запис: ${error.message}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
}

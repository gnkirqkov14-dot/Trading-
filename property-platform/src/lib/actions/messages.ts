"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/dal";

export async function sendMessage(input: {
  toUserId: string;
  listingId: string;
  content: string;
}) {
  const user = await getAuthedUser();
  const content = input.content.trim();

  if (!content) {
    throw new Error("Съобщението не може да е празно.");
  }
  if (input.toUserId === user.id) {
    throw new Error("Не можеш да пишеш сам на себе си.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({
    from_user_id: user.id,
    to_user_id: input.toUserId,
    listing_id: input.listingId,
    content,
  });

  if (error) {
    throw new Error(`Грешка при изпращане: ${error.message}`);
  }

  revalidatePath(`/dashboard/messages/${input.listingId}/${input.toUserId}`);
  revalidatePath("/dashboard/messages");
}

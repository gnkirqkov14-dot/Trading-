"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/dal";

// Регистрацията вече е единственото условие за писане (не абонамент) —
// getAuthedUser() по-горе вече го гарантира; RLS policy-то в базата
// (0018_free_launch_messages.sql) го налага независимо на ниво данни.
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
  if (content.length > 2000) {
    throw new Error("Съобщението е твърде дълго. Най-много 2000 знака.");
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
    // Правилата (получател, дължина, брой) се пазят от тригер в базата;
    // неговите съобщения са на български и се показват направо.
    throw new Error(
      /[а-я]/i.test(error.message)
        ? error.message
        : "Съобщението не беше изпратено. Опитай пак.",
    );
  }

  revalidatePath(`/dashboard/messages/${input.listingId}/${input.toUserId}`);
  revalidatePath("/dashboard/messages");
}

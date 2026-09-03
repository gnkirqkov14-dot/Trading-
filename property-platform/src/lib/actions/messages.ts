"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/supabase/dal";
import { hasFullSearchAccess } from "@/lib/listing-labels";

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

  const [{ data: profile }, { data: listing }] = await Promise.all([
    supabase
      .from("profiles")
      .select("subscription_plan")
      .eq("id", user.id)
      .single(),
    supabase
      .from("listings")
      .select("user_id")
      .eq("id", input.listingId)
      .maybeSingle(),
  ]);

  const isOwner = listing?.user_id === user.id;
  const canMessage =
    isOwner || hasFullSearchAccess(profile?.subscription_plan ?? "basic");

  if (!canMessage) {
    throw new Error(
      "Само с абонамент можеш да пишеш на собствениците. Разгледай плановете на /pricing.",
    );
  }

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

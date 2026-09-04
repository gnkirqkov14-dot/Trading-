import type { Metadata } from "next";
import { getProfile } from "@/lib/supabase/dal";
import { ProfileForm } from "@/components/profile-form";

export const metadata: Metadata = { title: "Настройки на профила" };

export default async function ProfilePage() {
  const profile = await getProfile();

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Настройки на профила</h1>
      <ProfileForm
        initialName={profile?.name ?? ""}
        initialPhone={profile?.phone ?? ""}
      />
    </div>
  );
}

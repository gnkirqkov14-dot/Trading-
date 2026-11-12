import type { Metadata } from "next";
import { getProfile } from "@/lib/supabase/dal";
import { ProfileForm } from "@/components/profile-form";
import { IztriyProfila } from "@/components/iztriy-profila";
import { safeNext } from "@/lib/phone";

export const metadata: Metadata = { title: "Настройки на профила" };

export default async function ProfilePage({
  searchParams,
}: {
  // `?telefon=1` слагат proxy-то и auth/callback, когато профилът няма номер.
  searchParams: Promise<{ telefon?: string; next?: string }>;
}) {
  const { telefon, next } = await searchParams;
  const profile = await getProfile();
  const needsPhone = telefon === "1" && !profile?.phone;

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">Настройки на профила</h1>
      {needsPhone && (
        <p className="mb-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Остана една стъпка: добави телефона си, за да продължиш.
        </p>
      )}
      <ProfileForm
        initialName={profile?.name ?? ""}
        initialPhone={profile?.phone ?? ""}
        next={needsPhone ? safeNext(next) : undefined}
      />
      {!needsPhone && !profile?.is_admin && <IztriyProfila />}
    </div>
  );
}

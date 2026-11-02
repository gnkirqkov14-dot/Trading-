import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = { title: "Регистрация" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-6 text-center text-xl font-semibold">Регистрация</h1>
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </>
  );
}

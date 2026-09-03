import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Вход" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-6 text-center text-xl font-semibold">Вход</h1>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </>
  );
}

import type { Metadata } from "next";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = { title: "Регистрация" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-6 text-center text-xl font-semibold">Регистрация</h1>
      <RegisterForm />
    </>
  );
}

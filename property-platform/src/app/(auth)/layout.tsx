import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link href="/" className="mb-6 block text-center text-lg font-bold">
          Имоти без посредници
        </Link>
        {children}
      </div>
    </div>
  );
}

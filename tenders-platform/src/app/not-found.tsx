import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Няма такава страница</h1>
      <p className="text-slate-600">Поръчката може да е стара или адресът да е сгрешен.</p>
      <Link href="/" className="font-medium text-brand-600 hover:underline">
        Към всички поръчки
      </Link>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="aspect-[4/3] w-full animate-pulse bg-slate-100" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-5 w-1/2 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="h-8 w-32 animate-pulse rounded bg-slate-100" />
        <div className="h-10 w-44 animate-pulse rounded-lg bg-slate-100" />
      </div>

      <div className="mb-8 h-24 w-full animate-pulse rounded-2xl bg-slate-100" />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

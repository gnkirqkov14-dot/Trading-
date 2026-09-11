function HouseShape({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2.5 22 11v10H2V11z" fill="currentColor" />
    </svg>
  );
}

// Декоративен фон на hero секцията — размазани силуети на къщи в
// брандовите цветове (същата форма като лого иконата), само за визия,
// не носи информация (aria-hidden).
export function HeroBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <HouseShape className="absolute -left-12 -top-12 h-56 w-56 rotate-[-12deg] text-emerald-400 opacity-40 blur-xl" />
      <HouseShape className="absolute -right-16 top-0 h-72 w-72 rotate-[10deg] text-emerald-500 opacity-30 blur-2xl" />
      <HouseShape className="absolute -bottom-16 left-[12%] h-64 w-64 rotate-[6deg] text-slate-400 opacity-30 blur-xl" />
      <HouseShape className="absolute -bottom-10 right-[8%] h-48 w-48 rotate-[-8deg] text-emerald-400 opacity-35 blur-xl" />
    </div>
  );
}

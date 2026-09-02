export default function StatCard({ label, value, sub, tone = "neutral" }) {
  const toneClass =
    tone === "positive" ? "text-accent" : tone === "negative" ? "text-danger" : "text-slate-100";
  return (
    <div className="bg-panel border border-border rounded-xl p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </div>
  );
}

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString("bg-BG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function PortfolioChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-muted text-sm">
        Все още няма история на портфейла — стартирайте анализ от таблото.
      </div>
    );
  }
  const chartData = data.map((d) => ({ ...d, label: formatTime(d.timestamp) }));
  return (
    <ResponsiveContainer width="100%" height={288}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#242e3d" />
        <XAxis dataKey="label" stroke="#8a97a8" fontSize={11} tickLine={false} />
        <YAxis
          stroke="#8a97a8"
          fontSize={11}
          tickLine={false}
          domain={["auto", "auto"]}
          tickFormatter={(v) => `$${Math.round(v).toLocaleString()}`}
        />
        <Tooltip
          contentStyle={{ background: "#121822", border: "1px solid #242e3d", borderRadius: 8 }}
          labelStyle={{ color: "#8a97a8" }}
          formatter={(value) => [`$${Number(value).toLocaleString()}`, "Стойност"]}
        />
        <Line type="monotone" dataKey="total_value" stroke="#3ddc97" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

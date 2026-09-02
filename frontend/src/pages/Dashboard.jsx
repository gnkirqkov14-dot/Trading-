import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import StatCard from "../components/StatCard.jsx";
import PortfolioChart from "../components/PortfolioChart.jsx";
import PositionsTable from "../components/PositionsTable.jsx";

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, h] = await Promise.all([api.getPortfolio(), api.getPortfolioHistory()]);
      setPortfolio(p);
      setHistory(h);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const runAnalysis = async () => {
    setRunning(true);
    setError(null);
    try {
      await api.runAnalysis();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <p className="text-muted text-sm">Зареждане…</p>;

  if (error && !portfolio) {
    return (
      <div className="bg-panel border border-border rounded-xl p-6 text-sm text-danger">
        Неуспешна връзка с бекенда ({error}). Уверете се, че API сървърът работи на адреса, зададен в
        VITE_API_BASE.
      </div>
    );
  }

  const positive = portfolio.total_pnl >= 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Табло на портфейла</h2>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={running}
          className="bg-accent text-bg text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {running ? "Анализира…" : "Пусни анализ сега"}
        </button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Обща стойност" value={`$${portfolio.total_value.toLocaleString()}`} />
        <StatCard label="Свободни средства" value={`$${portfolio.cash.toLocaleString()}`} />
        <StatCard
          label="P&L"
          value={`${positive ? "+" : ""}$${portfolio.total_pnl.toLocaleString()}`}
          sub={`${positive ? "+" : ""}${portfolio.total_pnl_pct}%`}
          tone={positive ? "positive" : "negative"}
        />
        <StatCard label="Начален капитал" value={`$${portfolio.starting_capital.toLocaleString()}`} />
      </div>

      <div className="bg-panel border border-border rounded-xl p-4">
        <h3 className="text-sm font-medium mb-2">Стойност на портфейла във времето</h3>
        <PortfolioChart data={history} />
      </div>

      <div className="bg-panel border border-border rounded-xl p-4">
        <h3 className="text-sm font-medium mb-3">Отворени позиции</h3>
        <PositionsTable positions={portfolio.positions} />
      </div>
    </div>
  );
}

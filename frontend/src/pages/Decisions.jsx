import { useEffect, useState } from "react";
import { api } from "../api.js";
import DecisionCard from "../components/DecisionCard.jsx";

export default function Decisions() {
  const [decisions, setDecisions] = useState([]);
  const [symbol, setSymbol] = useState("");
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getWatchlist().then(setWatchlist).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .getDecisions(50, symbol || undefined)
      .then(setDecisions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [symbol]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Дневник на решенията</h2>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="bg-panel border border-border rounded-lg text-sm px-3 py-2"
        >
          <option value="">Всички активи</option>
          {watchlist.map((a) => (
            <option key={a.symbol} value={a.symbol}>
              {a.symbol}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
      {loading && <p className="text-sm text-muted">Зареждане…</p>}
      {!loading && decisions.length === 0 && (
        <p className="text-sm text-muted">
          Все още няма решения. Пуснете анализ от таблото, за да видите първите записи.
        </p>
      )}

      <div className="space-y-3">
        {decisions.map((d) => (
          <DecisionCard key={d.id} decision={d} />
        ))}
      </div>
    </div>
  );
}

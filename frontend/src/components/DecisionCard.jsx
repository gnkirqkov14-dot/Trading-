import { useState } from "react";

const ACTION_STYLES = {
  buy: "bg-accent/15 text-accent",
  sell: "bg-danger/15 text-danger",
  hold: "bg-panel2 text-muted",
};

const ACTION_LABELS = { buy: "КУПУВА", sell: "ПРОДАВА", hold: "ИЗЧАКВА" };

export default function DecisionCard({ decision }) {
  const [expanded, setExpanded] = useState(false);
  const tech = decision.signals_used?.technical;
  const scores = decision.signals_used?.scores;

  return (
    <div className="bg-panel border border-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold px-2 py-1 rounded-md ${ACTION_STYLES[decision.action]}`}>
            {ACTION_LABELS[decision.action] || decision.action}
          </span>
          <div>
            <p className="font-medium">
              {decision.symbol}{" "}
              <span className="text-muted text-xs uppercase">{decision.asset_type}</span>
            </p>
            <p className="text-xs text-muted">{new Date(decision.timestamp).toLocaleString("bg-BG")}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Увереност</p>
          <p className="font-semibold">{Math.round(decision.confidence * 100)}%</p>
        </div>
      </div>

      <p className="text-sm text-slate-200 mt-3">{decision.reasoning}</p>

      {decision.execution_note && (
        <p className="text-xs text-muted mt-2 italic">{decision.execution_note}</p>
      )}

      {decision.requires_approval && (
        <p className="text-xs text-amber-400 mt-2">
          ⏳ Над прага за автономност — очаква ръчно одобрение (approval mode).
        </p>
      )}

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="text-xs text-accent mt-3 hover:underline"
      >
        {expanded ? "Скрий сигналите" : "Покажи използваните сигнали"}
      </button>

      {expanded && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-muted mb-1 font-medium">Новини (сентимент {scores?.news_sentiment ?? "—"})</p>
            <ul className="space-y-1">
              {(decision.signals_used?.news || []).map((n, i) => (
                <li key={i} className="text-slate-300">
                  {n.headline}{" "}
                  <span className={n.sentiment >= 0 ? "text-accent" : "text-danger"}>
                    ({n.sentiment >= 0 ? "+" : ""}
                    {n.sentiment})
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-muted mb-1 font-medium">
              Изказвания (тон {scores?.statement_tone ?? "—"})
            </p>
            <ul className="space-y-1">
              {(decision.signals_used?.statements || []).map((s, i) => (
                <li key={i} className="text-slate-300">
                  <span className="text-slate-400">{s.speaker}:</span> {s.statement}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-muted mb-1 font-medium">
              Технически (резултат {scores?.technical_score ?? "—"})
            </p>
            {tech ? (
              <ul className="space-y-1 text-slate-300">
                <li>Цена: ${tech.last_price}</li>
                <li>SMA20 / SMA50: {tech.sma20} / {tech.sma50}</li>
                <li>RSI14: {tech.rsi14}</li>
                <li>Тренд: {tech.trend}</li>
                <li>
                  Support / Resistance: {tech.support} / {tech.resistance}
                </li>
                {tech.source === "synthetic_fallback" && (
                  <li className="text-amber-400">⚠ синтетични данни (пазарен API недостъпен)</li>
                )}
              </ul>
            ) : (
              <p className="text-slate-400">—</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

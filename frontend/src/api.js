const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

async function request(path, options) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

export const api = {
  getPortfolio: () => request("/portfolio"),
  getPortfolioHistory: (limit = 200) => request(`/portfolio/history?limit=${limit}`),
  getDecisions: (limit = 50, symbol) =>
    request(`/decisions?limit=${limit}${symbol ? `&symbol=${symbol}` : ""}`),
  getDecision: (id) => request(`/decisions/${id}`),
  runAnalysis: () => request("/analyze/run", { method: "POST" }),
  getWatchlist: () => request("/market/watchlist"),
  getMarket: (symbol) => request(`/market/${symbol}`),
  getRiskSettings: () => request("/settings/risk"),
  updateRiskSettings: (payload) =>
    request("/settings/risk", { method: "PUT", body: JSON.stringify(payload) }),
};

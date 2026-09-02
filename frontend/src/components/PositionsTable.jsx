function fmt(n) {
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default function PositionsTable({ positions }) {
  if (!positions || positions.length === 0) {
    return <p className="text-sm text-muted">Няма отворени позиции в момента.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted border-b border-border">
            <th className="py-2 pr-4 font-medium">Актив</th>
            <th className="py-2 pr-4 font-medium">Количество</th>
            <th className="py-2 pr-4 font-medium">Средна цена</th>
            <th className="py-2 pr-4 font-medium">Текуща цена</th>
            <th className="py-2 pr-4 font-medium">Стойност</th>
            <th className="py-2 pr-4 font-medium">P&amp;L</th>
            <th className="py-2 pr-4 font-medium">SL / TP</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const positive = p.unrealized_pnl >= 0;
            return (
              <tr key={p.symbol} className="border-b border-border/60">
                <td className="py-2 pr-4">
                  <span className="font-medium">{p.symbol}</span>
                  <span className="text-muted ml-1 text-xs uppercase">{p.asset_type}</span>
                </td>
                <td className="py-2 pr-4">{fmt(p.quantity)}</td>
                <td className="py-2 pr-4">${fmt(p.avg_entry_price)}</td>
                <td className="py-2 pr-4">${fmt(p.current_price)}</td>
                <td className="py-2 pr-4">${fmt(p.market_value)}</td>
                <td className={`py-2 pr-4 ${positive ? "text-accent" : "text-danger"}`}>
                  {positive ? "+" : ""}
                  {fmt(p.unrealized_pnl)} ({positive ? "+" : ""}
                  {fmt(p.unrealized_pnl_pct)}%)
                </td>
                <td className="py-2 pr-4 text-muted text-xs">
                  -{Math.round(p.stop_loss_pct * 100)}% / +{Math.round(p.take_profit_pct * 100)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

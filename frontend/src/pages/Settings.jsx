import { useEffect, useState } from "react";
import { api } from "../api.js";

function Slider({ label, value, onChange, min, max, step, suffix = "%" }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm text-slate-300">{label}</label>
        <span className="text-sm font-medium">
          {Math.round(value * 1000) / 10}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent"
      />
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getRiskSettings().then(setSettings).catch((e) => setError(e.message));
  }, []);

  const update = (field) => (value) => {
    setSettings((s) => ({ ...s, [field]: value }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateRiskSettings({
        max_position_pct: settings.max_position_pct,
        default_stop_loss_pct: settings.default_stop_loss_pct,
        default_take_profit_pct: settings.default_take_profit_pct,
        autonomous_mode: settings.autonomous_mode,
        approval_threshold_pct: settings.approval_threshold_pct,
      });
      setSettings(updated);
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <p className="text-sm text-muted">Зареждане…</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-lg font-semibold">Настройки за риск</h2>

      <div className="bg-panel border border-border rounded-xl p-5 space-y-5">
        <Slider
          label="Максимален размер на позиция (% от портфейла)"
          value={settings.max_position_pct}
          onChange={update("max_position_pct")}
          min={0.01}
          max={0.5}
          step={0.01}
        />
        <Slider
          label="Стоп-лос по подразбиране"
          value={settings.default_stop_loss_pct}
          onChange={update("default_stop_loss_pct")}
          min={0.01}
          max={0.3}
          step={0.01}
        />
        <Slider
          label="Тейк-профит по подразбиране"
          value={settings.default_take_profit_pct}
          onChange={update("default_take_profit_pct")}
          min={0.02}
          max={0.6}
          step={0.01}
        />
      </div>

      <div className="bg-panel border border-border rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-medium">Режим на автономност</h3>
          <p className="text-xs text-muted mt-1">
            В демо режим агентът е <span className="text-accent">напълно автономен</span> — сам отваря и
            затваря позиции с виртуални средства. По-долу е превключвателят за бъдещ „approval mode“:
            когато е изключен, сделки над зададения праг ще чакат ръчно одобрение, вместо да се изпълняват
            автоматично. Логиката вече съществува в бекенда (виж <code>requires_approval</code> в дневника
            на решенията) — тук само превключвате режима.
          </p>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.autonomous_mode}
            onChange={(e) => update("autonomous_mode")(e.target.checked)}
            className="w-4 h-4 accent-accent"
          />
          <span className="text-sm">
            {settings.autonomous_mode ? "Пълна автономност (демо режим)" : "Изисква одобрение над прага"}
          </span>
        </label>

        {!settings.autonomous_mode && (
          <Slider
            label="Праг за ръчно одобрение (% от портфейла)"
            value={settings.approval_threshold_pct}
            onChange={update("approval_threshold_pct")}
            min={0.01}
            max={0.5}
            step={0.01}
          />
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-accent text-bg text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Запазва…" : "Запази настройките"}
        </button>
        {saved && <span className="text-xs text-accent">Запазено ✓</span>}
      </div>
    </div>
  );
}

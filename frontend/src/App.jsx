import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Decisions from "./pages/Decisions.jsx";
import Settings from "./pages/Settings.jsx";

const navItemClass = ({ isActive }) =>
  `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive ? "bg-accent/15 text-accent" : "text-muted hover:text-slate-100 hover:bg-panel2"
  }`;

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-panel/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center text-accent font-bold">
              AI
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">Autonomous Trader</h1>
              <p className="text-xs text-muted leading-tight">Paper trading demo — крипто + ETF</p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navItemClass}>
              Табло
            </NavLink>
            <NavLink to="/decisions" className={navItemClass}>
              Дневник на решенията
            </NavLink>
            <NavLink to="/settings" className={navItemClass}>
              Настройки
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/decisions" element={<Decisions />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      <footer className="border-t border-border py-4">
        <p className="max-w-6xl mx-auto px-4 text-xs text-muted">
          Демо режим — виртуален капитал, без връзка към реални средства. Не е финансов съвет.
        </p>
      </footer>
    </div>
  );
}

export default App;

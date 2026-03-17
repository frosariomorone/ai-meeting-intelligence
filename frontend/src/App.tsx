import { Route, Routes, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import MeetingDetailPage from './pages/MeetingDetail';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
              MM
            </span>
            <div>
              <div className="font-semibold text-lg">MeetMind AI</div>
              <div className="text-xs text-slate-400">
                Meeting Intelligence for Remote Teams
              </div>
            </div>
          </div>
          <nav className="flex gap-4 text-sm">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `px-3 py-1 rounded-full ${
                  isActive ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              Dashboard
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/meetings/:id" element={<MeetingDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}


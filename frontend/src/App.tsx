import { useEffect, useState } from 'react';
import { Route, Routes, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import MeetingDetailPage from './pages/MeetingDetail';
import Login from './pages/Login';

type Theme = 'light' | 'dark';

export default function App() {
  const [authed, setAuthed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !!window.localStorage.getItem('meetmind-token');
  });
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = window.localStorage.getItem('meetmind-theme');
    return stored === 'light' || stored === 'dark' ? stored : 'dark';
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('meetmind-theme', theme);
  }, [theme]);

  if (!authed) {
    return <Login onLoggedIn={() => setAuthed(true)} />;
  }

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors ${
        theme === 'dark'
          ? 'bg-slate-950 text-slate-50'
          : 'bg-slate-50 text-slate-900'
      }`}
    >
      <header className="border-b border-slate-800/60 bg-slate-950/80 dark:bg-slate-950/80 bg-opacity-90 backdrop-blur">
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
          <div className="flex items-center gap-4 text-sm">
            <nav className="flex gap-2">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `px-3 py-1 rounded-full ${
                    isActive
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`
                }
              >
                Dashboard
              </NavLink>
            </nav>
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800"
            >
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-full bg-amber-300"
              />
              <span>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
            </button>
          </div>
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


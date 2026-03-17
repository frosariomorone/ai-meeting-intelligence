import { FormEvent, useState } from 'react';

interface LoginProps {
  onLoggedIn: () => void;
}

export default function Login({ onLoggedIn }: LoginProps) {
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError('Token is required.');
      return;
    }
    window.localStorage.setItem('meetmind-token', tokenInput.trim());
    setError(null);
    onLoggedIn();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/80 px-6 py-8 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold">
            MM
          </span>
          <div>
            <h1 className="text-lg font-semibold">MeetMind AI</h1>
            <p className="text-xs text-slate-400">Secure dashboard access</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              Access token
            </label>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="w-full rounded-md bg-slate-950 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              autoComplete="off"
            />
            <p className="text-[11px] text-slate-500">
              Use the token configured in your backend <span className="font-mono">.env</span>{' '}
              as <span className="font-mono">DASHBOARD_TOKEN</span>.
            </p>
          </div>
          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-900 rounded-md px-2 py-1">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
          >
            Enter dashboard
          </button>
        </form>
      </div>
    </div>
  );
}


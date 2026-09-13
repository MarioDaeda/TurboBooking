'use client';
import { createContext, useContext, useEffect, useState } from 'react';

const StaffSessionContext = createContext<{ logout: () => Promise<void> } | null>(null);
export const useStaffSession = () => useContext(StaffSessionContext);

export function StaffGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch('/api/v1/auth/session', { cache: 'no-store' }).then(r => setReady(r.ok))
      .catch(() => setError('Impossibile verificare la sessione.')).finally(() => setChecking(false));
  }, []);
  const logout = async () => {
    await fetch('/api/v1/auth/session', { method: 'DELETE' }); setReady(false);
  };
  if (checking) return <p className="p-8">Verifica accesso…</p>;
  // Su mobile il pulsante flottante coprirebbe l'agenda: "Esci" è disponibile nel menu principale.
  if (ready) return <StaffSessionContext.Provider value={{ logout }}>
    <button className="fixed bottom-2 right-2 z-50 hidden md:block rounded bg-white px-3 py-2 shadow" onClick={logout}>Esci</button>{children}
  </StaffSessionContext.Provider>;
  return <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-4"><form className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 sm:p-8 shadow" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError('');
    const form = new FormData(e.currentTarget);
    try {
      const response = await fetch('/api/v1/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Accesso non riuscito.');
      setReady(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Accesso non riuscito.'); }
    finally { setBusy(false); }
  }}><h1 className="text-xl font-semibold">Accedi a TurboBooking</h1>
    <label className="block">Email<input className="mt-1 w-full rounded border p-2" name="email" type="email" autoComplete="username" required /></label>
    <label className="block">Password<input className="mt-1 w-full rounded border p-2" name="password" type="password" autoComplete="current-password" required /></label>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <button className="w-full rounded bg-slate-900 p-2 text-white" disabled={busy}>{busy ? 'Accesso…' : 'Accedi'}</button>
  </form></main>;
}

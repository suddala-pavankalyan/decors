'use client';
import { useEffect, useState } from 'react';
import { fetchEstimate, type Delivery } from '@/lib/account';
import { feeText, isPincode, window as dateWindow } from '@/lib/delivery';

const KEY = 'decors.pincode';

/** "Check delivery" box for product pages: enter a pincode to see the dates and the shipping cost. */
export default function DeliveryCheck() {
  const [pin, setPin] = useState('');
  const [result, setResult] = useState<Delivery | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function check(p: string) {
    setBusy(true); setError('');
    try {
      setResult(await fetchEstimate(p));
      try { localStorage.setItem(KEY, p); } catch {}
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : 'Could not check that pincode');
    } finally {
      setBusy(false);
    }
  }

  // Remember the last pincode on this device.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved && isPincode(saved)) { setPin(saved); check(saved); }
    } catch {}
  }, []);

  return (
    <section aria-label="Check delivery" className="mt-6 rounded-2xl border border-slate-200 bg-white/70 p-4">
      <h2 className="text-sm font-semibold">Check delivery</h2>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (isPincode(pin)) check(pin); else setError('Enter a 6-digit pincode'); }}>
        <input value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} inputMode="numeric" placeholder="Pincode" aria-label="Pincode"
          className="w-36 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-fuchsia-400" />
        <button type="submit" disabled={busy} className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold hover:border-fuchsia-400 disabled:opacity-60">
          {busy ? 'Checking…' : 'Check'}
        </button>
      </form>
      <div aria-live="polite" className="mt-2 text-sm">
        {error && <p role="alert" className="text-rose-600">{error}</p>}
        {result && result.serviceable && result.from && result.to && (
          <p className="text-slate-700">Delivery to <strong>{result.pincode}</strong> by <strong>{dateWindow(result.from, result.to)}</strong>. <span className="text-slate-500">{feeText(result)}.</span></p>
        )}
        {result && !result.serviceable && <p className="text-rose-600">Sorry, we can’t deliver to {result.pincode} yet.</p>}
      </div>
    </section>
  );
}

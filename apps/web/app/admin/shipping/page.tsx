'use client';
import { useEffect, useState } from 'react';
import AdminGate from '@/components/admin/AdminGate';
import AdminTabs from '@/components/admin/AdminTabs';
import { getShipping, saveShipping } from '@/lib/adminShipping';

const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200';

function ShippingForm() {
  const [form, setForm] = useState<{ fee: string; free: string; origin: string; days: string; blocked: string } | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getShipping().then((s) => setForm({
      fee: String(s.baseFeePaise / 100), free: s.freeAbovePaise ? String(s.freeAbovePaise / 100) : '', origin: s.originPincode,
      days: String(s.handlingDays), blocked: s.blockedPrefixes.join(', '),
    })).catch((e) => setError(e.message));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true); setError(''); setOk('');
    try {
      await saveShipping({
        baseFeePaise: Math.round(Number(form.fee) * 100),
        freeAbovePaise: form.free.trim() === '' ? null : Math.round(Number(form.free) * 100),
        originPincode: form.origin.trim(),
        handlingDays: Math.round(Number(form.days)),
        blockedPrefixes: form.blocked.split(',').map((x) => x.trim()).filter(Boolean),
      });
      setOk('Shipping rules saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }
  const set = (k: 'fee' | 'free' | 'origin' | 'days' | 'blocked') => (e: React.ChangeEvent<HTMLInputElement>) => form && setForm({ ...form, [k]: e.target.value });

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16">
      <h1 className="text-3xl font-bold">Shipping</h1>
      <p className="text-sm text-slate-500">These rules apply to every order and to the delivery check on product pages.</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
      {ok && <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>}
      {!form && !error && <p className="mt-6">Loading…</p>}
      {form && (
        <form onSubmit={submit} aria-label="Shipping rules" className="mt-5 space-y-4 rounded-3xl bg-white p-5 shadow">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Shipping fee (₹)<input className={field} type="number" min={0} step="any" value={form.fee} onChange={set('fee')} required /></label>
            <label className="text-sm font-medium">Free shipping above (₹, blank = never)<input className={field} type="number" min={1} step="any" value={form.free} onChange={set('free')} /></label>
            <label className="text-sm font-medium">Our pincode (where parcels leave from)<input className={field} inputMode="numeric" maxLength={6} value={form.origin} onChange={set('origin')} required /></label>
            <label className="text-sm font-medium">Days to pack and hand over<input className={field} type="number" min={0} max={30} value={form.days} onChange={set('days')} required /></label>
          </div>
          <label className="block text-sm font-medium">Areas we don’t deliver to (pincode prefixes, comma separated)
            <input className={field} value={form.blocked} onChange={set('blocked')} placeholder="e.g. 19, 79" />
          </label>
          <p className="text-xs text-slate-500">Delivery time depends on distance from our pincode: same area 1–2 days, same region 2–4 days, elsewhere 4–7 days, plus packing time.</p>
          <button type="submit" disabled={busy} className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Save rules'}</button>
        </form>
      )}
    </main>
  );
}

export default function AdminShippingPage() {
  return <AdminGate><AdminTabs active="shipping" /><ShippingForm /></AdminGate>;
}

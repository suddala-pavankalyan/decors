'use client';
import { useEffect, useState } from 'react';
import AdminGate from '@/components/admin/AdminGate';
import AdminTabs from '@/components/admin/AdminTabs';
import { createCoupon, deleteCoupon, listCoupons, toInput, updateCoupon, type Coupon, type CouponState } from '@/lib/adminCoupons';
import { fromPaise } from '@/lib/money';

const TONE: Record<CouponState, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700', INACTIVE: 'bg-slate-100 text-slate-600', EXPIRED: 'bg-rose-50 text-rose-700',
  SCHEDULED: 'bg-sky-50 text-sky-700', EXHAUSTED: 'bg-amber-50 text-amber-700',
};
const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200';

interface Form {
  code: string; description: string; type: 'PERCENT' | 'FLAT'; value: string; maxDiscount: string; minOrder: string;
  startsAt: string; expiresAt: string; usageLimit: string; perUserLimit: string;
}
const EMPTY: Form = { code: '', description: '', type: 'PERCENT', value: '10', maxDiscount: '', minOrder: '', startsAt: '', expiresAt: '', usageLimit: '', perUserLimit: '1' };

const int = (s: string) => (s.trim() === '' ? null : Math.round(Number(s)));
const paise = (s: string) => (s.trim() === '' ? null : Math.round(Number(s) * 100));
const iso = (s: string) => (s ? new Date(s).toISOString() : null);

function describe(c: Coupon) {
  const off = c.type === 'PERCENT' ? `${c.value}% off${c.maxDiscountPaise ? ` (up to ${fromPaise(c.maxDiscountPaise)})` : ''}` : `${fromPaise(c.value)} off`;
  return [off, c.minOrderPaise ? `min ${fromPaise(c.minOrderPaise)}` : null, c.perUserLimit ? `${c.perUserLimit} per customer` : 'unlimited per customer',
    c.usageLimit ? `${c.redemptions}/${c.usageLimit} used` : `${c.redemptions} used`].filter(Boolean).join(' · ');
}

function Coupons() {
  const [items, setItems] = useState<Coupon[] | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  const reload = () => listCoupons().then(setItems).catch((e) => setError(e.message));
  useEffect(() => { reload(); }, []);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await fn(); await reload(); setConfirming(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setBusy(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const percent = form.type === 'PERCENT';
    await run(async () => {
      await createCoupon({
        code: form.code, description: form.description || undefined, type: form.type,
        value: percent ? Math.round(Number(form.value)) : Math.round(Number(form.value) * 100),
        maxDiscountPaise: percent ? paise(form.maxDiscount) : null, minOrderPaise: paise(form.minOrder) ?? 0,
        startsAt: iso(form.startsAt), expiresAt: iso(form.expiresAt), usageLimit: int(form.usageLimit), perUserLimit: int(form.perUserLimit),
      });
      setForm(null);
    });
  }

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => form && setForm({ ...form, [k]: e.target.value });

  return (
    <main className="mx-auto max-w-4xl px-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Coupons</h1>
          <p className="text-sm text-slate-500">{items ? `${items.length} coupon${items.length === 1 ? '' : 's'}` : 'Loading…'}</p>
        </div>
        {!form && <button type="button" onClick={() => setForm(EMPTY)} className="rounded-full bg-spectrum px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/25 transition hover:scale-105">New coupon</button>}
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

      {form && (
        <form onSubmit={submit} aria-label="New coupon" className="mt-5 space-y-4 rounded-3xl bg-white p-5 shadow">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Code<input className={`${field} uppercase`} value={form.code} onChange={set('code')} required maxLength={20} placeholder="WELCOME10" /></label>
            <label className="text-sm font-medium">Description (optional)<input className={field} value={form.description} onChange={set('description')} maxLength={120} /></label>
            <label className="text-sm font-medium">Type
              <select className={field} value={form.type} onChange={set('type')}><option value="PERCENT">Percentage off</option><option value="FLAT">Flat amount off</option></select>
            </label>
            <label className="text-sm font-medium">{form.type === 'PERCENT' ? 'Percent off' : 'Amount off (₹)'}
              <input className={field} type="number" min={1} max={form.type === 'PERCENT' ? 100 : undefined} step={form.type === 'PERCENT' ? 1 : 'any'} value={form.value} onChange={set('value')} required />
            </label>
            {form.type === 'PERCENT' && (
              <label className="text-sm font-medium">Maximum discount (₹, optional)<input className={field} type="number" min={1} step="any" value={form.maxDiscount} onChange={set('maxDiscount')} /></label>
            )}
            <label className="text-sm font-medium">Minimum order (₹, optional)<input className={field} type="number" min={0} step="any" value={form.minOrder} onChange={set('minOrder')} /></label>
            <label className="text-sm font-medium">Starts (optional)<input className={field} type="datetime-local" value={form.startsAt} onChange={set('startsAt')} /></label>
            <label className="text-sm font-medium">Expires (optional)<input className={field} type="datetime-local" value={form.expiresAt} onChange={set('expiresAt')} /></label>
            <label className="text-sm font-medium">Total uses (blank = unlimited)<input className={field} type="number" min={1} value={form.usageLimit} onChange={set('usageLimit')} /></label>
            <label className="text-sm font-medium">Uses per customer (blank = unlimited)<input className={field} type="number" min={1} value={form.perUserLimit} onChange={set('perUserLimit')} /></label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Create coupon'}</button>
            <button type="button" onClick={() => setForm(null)} className="rounded-full border border-slate-300 px-6 py-2.5 text-sm">Cancel</button>
          </div>
        </form>
      )}

      <ul className="mt-5 space-y-3">
        {items?.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow">
            <div className="min-w-0 flex-1 basis-60">
              <p className="font-mono text-base font-bold">{c.code} <span className={`ml-2 rounded-full px-2 py-0.5 font-sans text-xs font-semibold ${TONE[c.state]}`}>{c.state.toLowerCase()}</span></p>
              <p className="text-sm text-slate-600">{describe(c)}</p>
              {c.description && <p className="text-xs text-slate-500">{c.description}</p>}
              {(c.startsAt || c.expiresAt) && <p className="text-xs text-slate-500">{c.startsAt ? `From ${new Date(c.startsAt).toLocaleDateString('en-IN')}` : ''} {c.expiresAt ? `until ${new Date(c.expiresAt).toLocaleDateString('en-IN')}` : ''}</p>}
            </div>
            <button type="button" disabled={busy} onClick={() => run(() => updateCoupon(c.id, { ...toInput(c), active: !c.active }))}
              className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium hover:border-fuchsia-300">{c.active ? 'Switch off' : 'Switch on'}</button>
            {confirming === c.id ? (
              <span className="inline-flex items-center gap-2 text-sm">
                <button type="button" disabled={busy} onClick={() => run(() => deleteCoupon(c.id))} className="rounded-full bg-rose-600 px-3 py-1.5 font-semibold text-white">Yes, delete</button>
                <button type="button" onClick={() => setConfirming(null)} className="rounded-full border border-slate-200 px-3 py-1.5">No</button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirming(c.id)} aria-label={`Delete ${c.code}`} className="rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-rose-600 hover:border-rose-300">Delete</button>
            )}
          </li>
        ))}
      </ul>
      {items && items.length === 0 && <p className="mt-10 text-center text-slate-500">No coupons yet.</p>}
    </main>
  );
}

export default function AdminCouponsPage() {
  return <AdminGate><AdminTabs active="coupons" /><Coupons /></AdminGate>;
}

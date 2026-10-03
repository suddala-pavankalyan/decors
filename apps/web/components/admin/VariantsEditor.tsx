'use client';
import { useState } from 'react';
import { setVariants, type AdminProduct, type AdminVariant } from '@/lib/admin';

const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200';

interface Row { id?: string; label: string; price: string; stock: string; active: boolean }
const toRows = (vs: AdminVariant[]): Row[] => vs.map((v) => ({ id: v.id, label: v.label, price: String(v.price), stock: String(v.stock), active: v.active }));

/** Sizes, paper types, tin volumes...: each option has its own price and stock. */
export default function VariantsEditor({ product, onChange }: { product: AdminProduct; onChange: (p: AdminProduct) => void }) {
  const [kind, setKind] = useState(product.variantLabel ?? 'Size');
  const [rows, setRows] = useState<Row[]>(toRows(product.variants));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const dirty = JSON.stringify(rows) !== JSON.stringify(toRows(product.variants)) || kind !== (product.variantLabel ?? 'Size');

  const set = (i: number, patch: Partial<Row>) => { setRows(rows.map((r, n) => (n === i ? { ...r, ...patch } : r))); setOk(''); };

  async function save(list: Row[]) {
    setBusy(true); setError(''); setOk('');
    try {
      const saved = await setVariants(product.id, kind.trim(), list.map((r) => ({
        id: r.id, label: r.label.trim(), price: Math.round(Number(r.price)), stock: Math.round(Number(r.stock)), active: r.active,
      })));
      onChange(saved);
      setRows(toRows(saved.variants));
      setKind(saved.variantLabel ?? 'Size');
      setOk(list.length === 0 ? 'Options turned off.' : 'Options saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the options');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Options" className="mt-8 rounded-3xl bg-white/80 p-6 shadow-xl">
      <h2 className="text-xl font-bold">Options</h2>
      <p className="text-sm text-slate-600">For products that come in sizes, paper types or tin volumes. Each option has its own price and stock; the product shows the lowest price.</p>
      {rows.length > 0 && (
        <label className="mt-4 block max-w-xs text-sm font-medium">Kind of option
          <input className={field} value={kind} onChange={(e) => { setKind(e.target.value); setOk(''); }} maxLength={30} placeholder="Size, Volume, Paper…" />
        </label>
      )}
      <ul className="mt-4 space-y-3">
        {rows.map((r, i) => (
          <li key={r.id ?? `new-${i}`} className="grid items-end gap-3 rounded-2xl border border-slate-100 p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto_auto]">
            <label className="text-xs font-medium">Name<input aria-label={`Option ${i + 1} name`} className={field} value={r.label} onChange={(e) => set(i, { label: e.target.value })} maxLength={40} /></label>
            <label className="text-xs font-medium">Price (₹)<input aria-label={`Option ${i + 1} price`} className={field} type="number" min={1} value={r.price} onChange={(e) => set(i, { price: e.target.value })} /></label>
            <label className="text-xs font-medium">Stock<input aria-label={`Option ${i + 1} stock`} className={field} type="number" min={0} value={r.stock} onChange={(e) => set(i, { stock: e.target.value })} /></label>
            <label className="flex items-center gap-1.5 pb-2 text-xs"><input type="checkbox" checked={r.active} onChange={(e) => set(i, { active: e.target.checked })} />On sale</label>
            <button type="button" aria-label={`Remove option ${i + 1}`} onClick={() => { setRows(rows.filter((_, n) => n !== i)); setOk(''); }} className="pb-2 text-xs font-medium text-rose-600 hover:underline">Remove</button>
          </li>
        ))}
      </ul>
      {rows.length < 12 && (
        <button type="button" onClick={() => { setRows([...rows, { label: '', price: rows.at(-1)?.price ?? '', stock: '0', active: true }]); setOk(''); }}
          className="mt-3 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold hover:border-fuchsia-400">Add an option</button>
      )}
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
      {ok && <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy || !dirty} onClick={() => save(rows)} className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
          {busy ? 'Saving…' : 'Save options'}
        </button>
        {product.variantLabel && (
          <button type="button" disabled={busy} onClick={() => save([])} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm text-rose-700 hover:border-rose-300">Turn options off</button>
        )}
      </div>
    </section>
  );
}

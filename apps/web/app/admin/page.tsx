'use client';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AdminGate from '@/components/admin/AdminGate';
import Icon from '@/components/Icon';
import { deleteProduct, listProducts, type AdminProduct } from '@/lib/admin';
import { rupees } from '@/lib/money';

function ProductsTable() {
  const [items, setItems] = useState<AdminProduct[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listProducts().then((r) => setItems(r.items)).catch((e) => setError(e.message));
  }, []);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (items ?? []).filter((p) => !q || `${p.name} ${p.category}`.toLowerCase().includes(q));
  }, [items, filter]);

  async function remove(id: string) {
    setBusy(id);
    setError('');
    try {
      await deleteProduct(id);
      setItems((x) => x?.filter((p) => p.id !== id) ?? null);
      setConfirming(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the product');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Products</h1>
          <p className="text-sm text-slate-500">{items ? `${items.length} in the catalog` : 'Loading…'}</p>
        </div>
        <Link href="/admin/products/new"
          className="inline-flex items-center gap-2 rounded-full bg-spectrum px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/25 transition hover:scale-105">
          <Icon name="plus" size={18} />New product
        </Link>
      </div>

      <input
        type="search" aria-label="Filter products" placeholder="Filter by name or category…" value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mt-5 w-full max-w-sm rounded-full border border-slate-200 bg-white px-5 py-2 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200"
      />
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

      <ul className="mt-5 space-y-3">
        {shown.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-3 shadow">
            <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl" style={{ background: p.colorHex }}>
              {p.images[0] && <Image src={p.images[0].url} alt="" fill sizes="80px" className="object-cover" />}
            </div>
            <div className="min-w-0 flex-1 basis-48">
              <p className="truncate font-semibold">{p.name}</p>
              <p className="text-sm capitalize text-slate-500">
                {p.category.replace('-', ' ')} · {p.images.length} photo{p.images.length === 1 ? '' : 's'}
              </p>
            </div>
            <p className="w-24 text-right font-bold">{rupees(p.price)}</p>
            <div className="flex items-center gap-2">
              <Link href={`/admin/products/${p.id}`} aria-label={`Edit ${p.name}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-1.5 text-sm font-medium hover:border-fuchsia-300">
                <Icon name="edit" size={16} />Edit
              </Link>
              {confirming === p.id ? (
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className="text-slate-600">Delete?</span>
                  <button type="button" disabled={busy === p.id} onClick={() => remove(p.id)}
                    className="rounded-full bg-rose-600 px-3 py-1.5 font-semibold text-white disabled:opacity-60">
                    {busy === p.id ? 'Deleting…' : 'Yes'}
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} className="rounded-full border border-slate-200 px-3 py-1.5">No</button>
                </span>
              ) : (
                <button type="button" aria-label={`Delete ${p.name}`} onClick={() => setConfirming(p.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-1.5 text-sm font-medium text-rose-600 hover:border-rose-300">
                  <Icon name="trash" size={16} />Delete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {items && shown.length === 0 && <p className="mt-10 text-center text-slate-500">No products match.</p>}
    </main>
  );
}

export default function AdminPage() {
  return <AdminGate><ProductsTable /></AdminGate>;
}

'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AdminGate from '@/components/admin/AdminGate';
import AdminTabs from '@/components/admin/AdminTabs';
import Icon from '@/components/Icon';
import { deleteProduct, listProducts, type AdminProduct } from '@/lib/admin';
import { rupees } from '@/lib/money';

function ProductsTable() {
  const [items, setItems] = useState<AdminProduct[] | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [stockFilter, setStockFilter] = useState<'' | 'low' | 'out'>('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Searching happens in the database; each keystroke cancels the previous request.
  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(() => {
      listProducts({ q: filter, stock: stockFilter, signal: ctl.signal })
        .then((r) => { setItems(r.items); setTotal(r.total); setHasMore(r.hasMore); setError(''); })
        .catch((e) => { if (!ctl.signal.aborted) setError(e.message); });
    }, items === null ? 0 : 250);
    return () => { clearTimeout(t); ctl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, stockFilter]);

  async function loadMore() {
    if (!items) return;
    setLoadingMore(true);
    try {
      const r = await listProducts({ q: filter, stock: stockFilter, offset: items.length });
      setItems((prev) => {
        const seen = new Set((prev ?? []).map((p) => p.id));
        return [...(prev ?? []), ...r.items.filter((p) => !seen.has(p.id))];
      });
      setTotal(r.total);
      setHasMore(r.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load more products');
    } finally {
      setLoadingMore(false);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    setError('');
    try {
      await deleteProduct(id);
      setItems((x) => x?.filter((p) => p.id !== id) ?? null);
      setTotal((n) => Math.max(n - 1, 0));
      setConfirming(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the product');
    } finally {
      setBusy(null);
    }
  }

  const shown = items ?? [];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-sm text-slate-500">{items ? `${total} ${filter.trim() ? 'match' : 'in the catalog'}` : 'Loading…'}</p>
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
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Stock filter">
        {([['', 'All'], ['low', 'Low stock (5 or fewer)'], ['out', 'Sold out']] as const).map(([v, label]) => (
          <button key={v || 'all'} type="button" aria-pressed={stockFilter === v} onClick={() => setStockFilter(v)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${stockFilter === v ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-800' : 'border-slate-200 bg-white hover:border-fuchsia-300'}`}>
            {label}
          </button>
        ))}
      </div>
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
                {p.category.replace('-', ' ')} · {p.images.length} photo{p.images.length === 1 ? '' : 's'}{p.variantLabel ? ` · ${p.variants.length} ${p.variantLabel.toLowerCase()} option${p.variants.length === 1 ? '' : 's'}` : ''}
                {' · '}
                <span className={p.stock === 0 ? 'font-semibold text-rose-600' : p.stock <= 5 ? 'font-semibold text-amber-700' : ''}>
                  {p.stock === 0 ? 'Sold out' : `${p.stock} in stock`}
                </span>
              </p>
            </div>
            <p className="w-24 text-right font-bold tabular-nums">{rupees(p.price)}</p>
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
      {hasMore && (
        <div className="mt-6 text-center">
          <button type="button" onClick={loadMore} disabled={loadingMore}
            className="rounded-full border border-slate-300 bg-white px-8 py-2.5 text-sm font-semibold transition hover:border-fuchsia-400 hover:text-fuchsia-700 disabled:opacity-60">
            {loadingMore ? 'Loading…' : `Show more (${Math.max(total - shown.length, 0)} left)`}
          </button>
        </div>
      )}
    </main>
  );
}

export default function AdminPage() {
  return <AdminGate><AdminTabs active="products" /><ProductsTable /></AdminGate>;
}

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminGate from '@/components/admin/AdminGate';
import AdminTabs from '@/components/admin/AdminTabs';
import { listOrders, type AdminOrderRow } from '@/lib/adminOrders';
import { fromPaise } from '@/lib/money';
import { STATUS_LABEL, STATUS_TONE, STEPS, dateTime } from '@/lib/orderStatus';
import type { OrderStatus } from '@/lib/account';

function OrdersTable() {
  const [status, setStatus] = useState<'' | OrderStatus>('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<AdminOrderRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(() => {
      listOrders({ status, q, signal: ctl.signal })
        .then((r) => { setItems(r.items); setTotal(r.total); setHasMore(r.hasMore); setCounts(r.counts); setError(''); })
        .catch((e) => { if (!ctl.signal.aborted) setError(e.message); });
    }, items === null ? 0 : 250);
    return () => { clearTimeout(t); ctl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, q]);

  async function loadMore() {
    if (!items) return;
    setLoadingMore(true);
    try {
      const r = await listOrders({ status, q, offset: items.length });
      setItems((prev) => {
        const seen = new Set((prev ?? []).map((o) => o.id));
        return [...(prev ?? []), ...r.items.filter((o) => !seen.has(o.id))];
      });
      setHasMore(r.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load more orders');
    } finally {
      setLoadingMore(false);
    }
  }

  const chip = (value: '' | OrderStatus, label: string, n?: number) => (
    <button key={value || 'all'} type="button" onClick={() => setStatus(value)} aria-pressed={status === value}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${status === value ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-800' : 'border-slate-200 bg-white hover:border-fuchsia-300'}`}>
      {label}{n !== undefined ? <span className="ml-1.5 tabular-nums text-slate-500">{n}</span> : null}
    </button>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      <h1 className="text-3xl font-bold">Orders</h1>
      <p className="text-sm text-slate-500">{items ? `${total} ${status || q.trim() ? 'match' : 'in total'}` : 'Loading…'}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {chip('', 'All', Object.values(counts).reduce((a, b) => a + b, 0))}
        {[...STEPS, 'CANCELLED' as const].map((s) => chip(s, STATUS_LABEL[s], counts[s] ?? 0))}
      </div>
      <input type="search" aria-label="Search orders" placeholder="Search by order id, customer, email or tracking number…" value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mt-4 w-full max-w-md rounded-full border border-slate-200 bg-white px-5 py-2 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200" />
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

      <ul className="mt-5 space-y-3">
        {items?.map((o) => (
          <li key={o.id}>
            <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 shadow transition hover:shadow-md">
              <div className="min-w-0 flex-1 basis-56">
                <p className="truncate font-semibold">{o.customerName} <span className="font-normal text-slate-500">· {o.customerEmail}</span></p>
                <p className="text-sm text-slate-500">
                  {dateTime(o.createdAt)} · {o.itemCount} item{o.itemCount === 1 ? '' : 's'} · {o.shipCity}
                </p>
                <p className="mt-0.5 font-mono text-xs text-slate-400">{o.id}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
              <p className="w-24 text-right font-bold tabular-nums">{fromPaise(o.amount)}</p>
            </Link>
          </li>
        ))}
      </ul>
      {items && items.length === 0 && <p className="mt-10 text-center text-slate-500">No orders match.</p>}
      {hasMore && (
        <div className="mt-6 text-center">
          <button type="button" onClick={loadMore} disabled={loadingMore}
            className="rounded-full border border-slate-300 bg-white px-8 py-2.5 text-sm font-semibold transition hover:border-fuchsia-400 disabled:opacity-60">
            {loadingMore ? 'Loading…' : `Show more (${Math.max(total - items!.length, 0)} left)`}
          </button>
        </div>
      )}
    </main>
  );
}

export default function AdminOrdersPage() {
  return <AdminGate><AdminTabs active="orders" /><OrdersTable /></AdminGate>;
}

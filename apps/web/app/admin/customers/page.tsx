'use client';
import { useEffect, useState } from 'react';
import AdminGate from '@/components/admin/AdminGate';
import AdminTabs from '@/components/admin/AdminTabs';
import { fetchCustomers, type Customer } from '@/lib/adminDashboard';
import { fromPaise } from '@/lib/money';

const date = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function Customers() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Customer[] | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [more, setMore] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetchCustomers({ q, signal: ctl.signal }).then((r) => { setItems(r.items); setTotal(r.total); setHasMore(r.hasMore); setError(''); })
        .catch((e) => { if (!ctl.signal.aborted) setError(e.message); });
    }, items === null ? 0 : 250);
    return () => { clearTimeout(t); ctl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function loadMore() {
    if (!items) return;
    setMore(true);
    try {
      const r = await fetchCustomers({ q, offset: items.length });
      setItems((prev) => { const seen = new Set((prev ?? []).map((c) => c.id)); return [...(prev ?? []), ...r.items.filter((c) => !seen.has(c.id))]; });
      setHasMore(r.hasMore);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load more'); } finally { setMore(false); }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      <h1 className="text-3xl font-bold">Customers</h1>
      <p className="text-sm text-slate-500">{items ? `${total} ${q.trim() ? 'match' : 'in total'}. Newest first.` : 'Loading…'}</p>
      <input type="search" aria-label="Search customers" placeholder="Search by name or email…" value={q} onChange={(e) => setQ(e.target.value)}
        className="mt-4 w-full max-w-sm rounded-full border border-slate-200 bg-white px-5 py-2 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200" />
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
      {items && (
        <div className="mt-5 overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr><th className="px-4 py-3 font-medium">Customer</th><th className="px-4 py-3 font-medium">Joined</th><th className="px-4 py-3 text-right font-medium">Orders</th><th className="px-4 py-3 text-right font-medium">Spent</th><th className="px-4 py-3 font-medium">Last order</th></tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-slate-100" data-testid="customer-row">
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.name}{c.role === 'ADMIN' && <span className="ml-2 rounded-full bg-fuchsia-50 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-700">Admin</span>}</p>
                    <p className="text-xs text-slate-500">{c.email}{!c.emailVerified && <span className="ml-2 text-amber-700">email not confirmed</span>}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{date(c.createdAt)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.orders}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{fromPaise(c.spentPaise)}</td>
                  <td className="px-4 py-3 text-slate-600">{c.lastOrderAt ? date(c.lastOrderAt) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <p className="p-8 text-center text-slate-500">No customers match.</p>}
        </div>
      )}
      {hasMore && (
        <div className="mt-6 text-center">
          <button type="button" onClick={loadMore} disabled={more} className="rounded-full border border-slate-300 bg-white px-8 py-2.5 text-sm font-semibold hover:border-fuchsia-400 disabled:opacity-60">
            {more ? 'Loading…' : `Show more (${Math.max(total - (items?.length ?? 0), 0)} left)`}
          </button>
        </div>
      )}
    </main>
  );
}

export default function AdminCustomersPage() {
  return <AdminGate><AdminTabs active="customers" /><Customers /></AdminGate>;
}

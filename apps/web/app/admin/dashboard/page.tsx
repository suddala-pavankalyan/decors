'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminGate from '@/components/admin/AdminGate';
import AdminTabs from '@/components/admin/AdminTabs';
import BarChart from '@/components/admin/BarChart';
import { change, fetchDashboard, type Dashboard, type Kpi } from '@/lib/adminDashboard';
import { fromPaise } from '@/lib/money';
import { STATUS_LABEL, STATUS_TONE, dateTime } from '@/lib/orderStatus';

const RANGES = [7, 30, 90] as const;
const rupeesShort = (paise: number) => {
  const r = paise / 100;
  return r >= 100000 ? `₹${(r / 100000).toFixed(r >= 1000000 ? 0 : 1)}L` : r >= 1000 ? `₹${(r / 1000).toFixed(r >= 10000 ? 0 : 1)}k` : `₹${Math.round(r)}`;
};
const dayLabel = (iso: string, long = false) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', long ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' });

function Delta({ k, days }: { k: Kpi; days: number }) {
  const c = change(k);
  if (c.dir === 'same') return <p className="mt-1 text-xs text-slate-500">No change vs previous {days} days</p>;
  return (
    <p className="mt-1 text-xs text-slate-500">
      <span className="font-semibold text-slate-700">{c.dir === 'up' ? '▲' : '▼'} {c.pct === null ? 'New' : `${c.pct}%`}</span> vs previous {days} days
    </p>
  );
}

function Tile({ label, value, k, days, note }: { label: string; value: string; k?: Kpi; days: number; note?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums" data-testid={`kpi-${label}`}>{value}</p>
      {k ? <Delta k={k} days={days} /> : note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
    </div>
  );
}

function Board() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [metric, setMetric] = useState<'revenue' | 'orders'>('revenue');

  useEffect(() => {
    const ctl = new AbortController();
    setError('');
    fetchDashboard(days, ctl.signal).then(setD).catch((e) => { if (!ctl.signal.aborted) setError(e.message); });
    return () => ctl.abort();
  }, [days]);

  if (error) return <main className="mx-auto max-w-6xl px-4"><p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p></main>;
  if (!d) return <main className="p-10 text-center">Loading…</main>;

  const aov = d.orders.value ? Math.round(d.revenue.value / d.orders.value) : 0;
  const aovPrev = d.orders.previous ? Math.round(d.revenue.previous / d.orders.previous) : 0;
  const topMax = Math.max(...d.topProducts.map((t) => t.salesPaise), 1);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-500">{dayLabel(d.from)} to {dayLabel(d.to)}. Sales are paid orders that were not cancelled, by the day they were paid.</p>
        </div>
        <div role="group" aria-label="Time range" className="flex gap-2">
          {RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={days === r} onClick={() => setDays(r)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${days === r ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-800' : 'border-slate-200 bg-white hover:border-fuchsia-300'}`}>
              Last {r} days
            </button>
          ))}
        </div>
      </div>

      <section aria-label="To do" className="mt-5 grid gap-3 sm:grid-cols-3">
        <Link href="/admin/orders" className="rounded-2xl bg-fuchsia-50 p-4 transition hover:shadow-md">
          <p className="text-2xl font-bold tabular-nums" data-testid="todo-ship">{d.toShip}</p>
          <p className="text-sm text-fuchsia-900">order{d.toShip === 1 ? '' : 's'} to pack and ship</p>
        </Link>
        <Link href="/admin" className="rounded-2xl bg-amber-50 p-4 transition hover:shadow-md">
          <p className="text-2xl font-bold tabular-nums" data-testid="todo-stock">{d.lowStock.length}</p>
          <p className="text-sm text-amber-900">product{d.lowStock.length === 1 ? '' : 's'} low on stock</p>
        </Link>
        <Link href="/admin/orders" className="rounded-2xl bg-slate-100 p-4 transition hover:shadow-md">
          <p className="text-2xl font-bold tabular-nums" data-testid="todo-unpaid">{d.awaitingPayment}</p>
          <p className="text-sm text-slate-700">order{d.awaitingPayment === 1 ? '' : 's'} awaiting payment</p>
        </Link>
      </section>

      <section aria-label="Key figures" className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Sales" value={fromPaise(d.revenue.value)} k={d.revenue} days={days} />
        <Tile label="Orders" value={String(d.orders.value)} k={d.orders} days={days} />
        <Tile label="Average order" value={fromPaise(aov)} k={{ value: aov, previous: aovPrev }} days={days} />
        <Tile label="New customers" value={String(d.newCustomers.value)} k={d.newCustomers} days={days} />
      </section>
      {d.refunded.value > 0 && <p className="mt-2 text-xs text-slate-500">{fromPaise(d.refunded.value)} was refunded in this period (not included in sales).</p>}

      <section aria-label="Sales over time" className="mt-6 rounded-2xl bg-white p-5 shadow">
        <div role="group" aria-label="Chart measure" className="mb-3 flex gap-2">
          {(['revenue', 'orders'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={metric === m} onClick={() => setMetric(m)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${metric === m ? 'bg-slate-900 text-white' : 'border border-slate-200 text-slate-600'}`}>
              {m === 'revenue' ? 'Sales' : 'Orders'}
            </button>
          ))}
        </div>
        <BarChart
          title={metric === 'revenue' ? 'Sales per day' : 'Orders per day'}
          axis={(v) => (metric === 'revenue' ? rupeesShort(v) : String(Math.round(v * 10) / 10))}
          bars={d.daily.map((x) => ({
            label: dayLabel(x.date, true), short: dayLabel(x.date), value: metric === 'revenue' ? x.revenuePaise : x.orders,
            display: metric === 'revenue' ? fromPaise(x.revenuePaise) : String(x.orders),
            detail: `${fromPaise(x.revenuePaise)} from ${x.orders} order${x.orders === 1 ? '' : 's'}`,
          }))}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section aria-label="Top products" className="rounded-2xl bg-white p-5 shadow">
          <h2 className="font-semibold">Top products</h2>
          <p className="text-xs text-slate-500">By item sales (before discounts and shipping).</p>
          {d.topProducts.length === 0 ? <p className="mt-4 text-sm text-slate-500">No sales in this period.</p> : (
            <ul className="mt-3 space-y-3">
              {d.topProducts.map((t) => (
                <li key={t.productId ?? t.name} data-testid="top-product">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{t.name}</span>
                    <span className="shrink-0 tabular-nums text-slate-600">{fromPaise(t.salesPaise)} · {t.units} sold</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${Math.max(2, (t.salesPaise / topMax) * 100)}%`, background: '#c026d3' }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Low stock" className="rounded-2xl bg-white p-5 shadow">
          <h2 className="font-semibold">Low stock</h2>
          <p className="text-xs text-slate-500">Five or fewer left.</p>
          {d.lowStock.length === 0 ? <p className="mt-4 text-sm text-slate-500">Everything is well stocked.</p> : (
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {d.lowStock.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/admin/products/${p.id}`} className="truncate font-medium hover:underline">{p.name}</Link>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.stock === 0 ? 'bg-slate-900 text-white' : 'bg-amber-100 text-amber-800'}`}>{p.stock === 0 ? 'Sold out' : `${p.stock} left`}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-label="Recent orders" className="mt-6 rounded-2xl bg-white p-5 shadow">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Recent orders</h2><Link href="/admin/orders" className="text-xs font-medium text-fuchsia-700 hover:underline">All orders</Link></div>
        {d.recent.length === 0 ? <p className="mt-4 text-sm text-slate-500">No orders yet.</p> : (
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {d.recent.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 py-2 hover:bg-slate-50">
                  <span className="min-w-0"><span className="font-medium">{o.customerName}</span> <span className="text-slate-500">· {dateTime(o.createdAt)}</span></span>
                  <span className="flex items-center gap-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span><span className="w-20 text-right font-semibold tabular-nums">{fromPaise(o.amountPaise)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

export default function AdminDashboardPage() {
  return <AdminGate><AdminTabs active="dashboard" /><Board /></AdminGate>;
}

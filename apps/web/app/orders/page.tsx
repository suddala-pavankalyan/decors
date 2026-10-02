'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchOrders, type Order } from '@/lib/account';
import { useAuth } from '@/lib/auth';
import { fromPaise } from '@/lib/money';

export default function OrdersPage() {
  const { user, ready } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) fetchOrders().then(setOrders).catch((e) => setError(e.message));
  }, [user]);

  if (!ready) return <main className="p-10 text-center">Loading…</main>;
  if (!user) return <main className="p-10 text-center"><Link href="/login" className="text-fuchsia-600 hover:underline">Log in</Link> to see your orders.</main>;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16">
      <h1 className="font-display text-3xl font-bold">Your orders</h1>
      {error && <p role="alert" className="mt-4 text-rose-600">{error}</p>}
      {orders && orders.length === 0 && <p className="mt-8 text-center text-slate-500">No orders yet.</p>}
      <ul className="mt-6 space-y-3">
        {orders?.map((o) => (
          <li key={o.id}>
            <Link href={`/orders/${o.id}`} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow hover:shadow-md">
              <div>
                <p className="font-semibold">{o.items.map((i) => i.name).join(', ').slice(0, 60)}</p>
                <p className="text-sm text-slate-500">{new Date(o.createdAt).toLocaleDateString('en-IN')} · {o.items.length} item{o.items.length > 1 ? 's' : ''}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{fromPaise(o.amount)}</p>
                <span className={`text-xs font-semibold ${o.status === 'PAID' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {o.status === 'PAID' ? 'Paid' : 'Awaiting payment'}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

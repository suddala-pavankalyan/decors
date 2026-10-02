'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { fetchOrder, type Order } from '@/lib/account';
import { useAuth } from '@/lib/auth';
import { fromPaise } from '@/lib/money';
import Icon from '@/components/Icon';

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { user, ready } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const load = () =>
      fetchOrder(id)
        .then((o) => {
          setOrder(o);
          // The webhook may confirm a moment after the page opens; poll briefly while pending.
          if (o.status === 'PENDING' && ++tries < 6) timer = setTimeout(load, 3000);
        })
        .catch((e) => setError(e.message));
    load();
    return () => clearTimeout(timer);
  }, [id, user]);

  if (!ready) return <main className="p-10 text-center">Loading…</main>;
  if (!user) return <main className="p-10 text-center"><Link href="/login" className="text-fuchsia-600 hover:underline">Log in</Link> to see this order.</main>;
  if (error) return <main className="p-10 text-center text-rose-600">{error}</main>;
  if (!order) return <main className="p-10 text-center">Loading…</main>;

  const paid = order.status === 'PAID';
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16">
      <div className={`rounded-3xl p-6 text-center ${paid ? 'bg-emerald-50' : 'bg-amber-50'}`}>
        <Icon name={paid ? 'sparkle' : 'clock'} size={44} className={`mx-auto ${paid ? 'text-emerald-600' : 'text-amber-600'}`} />
        <h1 className="mt-2 text-2xl font-bold">{paid ? 'Thank you! Your order is confirmed' : 'Waiting for payment confirmation'}</h1>
        <p className="mt-1 text-sm text-slate-600">Order {order.id}{order.razorpayPaymentId ? ` · Payment ${order.razorpayPaymentId}` : ''}</p>
      </div>
      <ul className="mt-6 space-y-2 rounded-2xl bg-white p-4 shadow">
        {order.items.map((i) => (
          <li key={i.id} className="flex justify-between text-sm">
            <span>{i.name} × {i.qty}</span><span className="tabular-nums">{fromPaise(i.unitPricePaise * i.qty)}</span>
          </li>
        ))}
        <li className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span className="tabular-nums">{fromPaise(order.amount)}</span></li>
      </ul>
      <section className="mt-4 rounded-2xl bg-white p-4 text-sm shadow">
        <h2 className="font-semibold">Delivering to</h2>
        <p className="mt-1">{order.shipName} · {order.shipPhone}</p>
        <p>{order.shipLine1}{order.shipLine2 ? `, ${order.shipLine2}` : ''}</p>
        <p>{order.shipCity}, {order.shipState} {order.shipPincode}</p>
      </section>
      <Link href="/shop" className="mt-6 inline-block text-fuchsia-600 hover:underline">Continue shopping</Link>
    </main>
  );
}

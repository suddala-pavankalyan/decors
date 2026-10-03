'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminGate from '@/components/admin/AdminGate';
import AdminTabs from '@/components/admin/AdminTabs';
import Icon from '@/components/Icon';
import OrderTimeline from '@/components/OrderTimeline';
import { advanceOrder, getOrder, type AdminOrder } from '@/lib/adminOrders';
import { fromPaise } from '@/lib/money';
import { STATUS_LABEL, STATUS_TONE } from '@/lib/orderStatus';

const ACTION: Record<string, string> = { PACKED: 'Mark as packed', SHIPPED: 'Mark as shipped', DELIVERED: 'Mark as delivered' };

function Detail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');

  useEffect(() => { getOrder(id).then(setOrder).catch((e) => setError(e.message)); }, [id]);

  async function advance() {
    if (!order?.nextStatus) return;
    setBusy(true);
    setError('');
    try {
      setOrder(await advanceOrder(order.id, order.nextStatus, order.nextStatus === 'SHIPPED' ? { carrier, trackingNumber: tracking } : undefined));
      setCarrier('');
      setTracking('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the order');
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm text-fuchsia-600 hover:underline">
      <Icon name="back" size={16} />All orders
    </Link>
  );
  if (!order) {
    return <main className="mx-auto max-w-3xl px-4">{back}{error ? <p role="alert" className="mt-6 text-rose-600">{error}</p> : <p className="mt-6">Loading…</p>}</main>;
  }
  const shipping = order.nextStatus === 'SHIPPED';
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16">
      {back}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Order <span className="font-mono text-lg text-slate-500">{order.id}</span></h1>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_TONE[order.status]}`}>{STATUS_LABEL[order.status]}</span>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

      <section className="mt-5 rounded-2xl bg-white p-4 shadow">
        <h2 className="mb-4 font-semibold">Progress</h2>
        <OrderTimeline status={order.status} events={order.events} />
        {order.nextStatus ? (
          <div className="mt-5 border-t pt-4">
            {shipping && (
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">Carrier
                  <input value={carrier} onChange={(e) => setCarrier(e.target.value)} maxLength={60} placeholder="e.g. Delhivery"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200" />
                </label>
                <label className="text-sm">Tracking number
                  <input value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={80}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200" />
                </label>
              </div>
            )}
            <button type="button" onClick={advance} disabled={busy}
              className="rounded-full bg-spectrum px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/25 transition hover:scale-105 disabled:opacity-60">
              {busy ? 'Saving…' : ACTION[order.nextStatus]}
            </button>
            {order.nextStatus !== 'PACKED' && <p className="mt-2 text-xs text-slate-500">The customer gets an email.</p>}
          </div>
        ) : (
          <p className="mt-4 border-t pt-3 text-sm text-slate-500">{order.status === 'PENDING' ? 'Waiting for the customer to pay.' : 'This order is complete.'}</p>
        )}
        {(order.carrier || order.trackingNumber) && (
          <p className="mt-3 text-sm text-slate-600">{order.carrier} {order.trackingNumber && <span className="font-mono">· {order.trackingNumber}</span>}</p>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-white p-4 text-sm shadow">
        <h2 className="font-semibold">Customer</h2>
        <p className="mt-1">{order.customer?.name} · {order.customer?.email}</p>
        <h2 className="mt-4 font-semibold">Delivering to</h2>
        <p className="mt-1">{order.shipName} · {order.shipPhone}</p>
        <p>{order.shipLine1}{order.shipLine2 ? `, ${order.shipLine2}` : ''}</p>
        <p>{order.shipCity}, {order.shipState} {order.shipPincode}</p>
      </section>

      <ul className="mt-4 space-y-2 rounded-2xl bg-white p-4 shadow">
        {order.items.map((i) => (
          <li key={i.id} className="flex justify-between text-sm">
            <span>{i.name} × {i.qty}</span><span className="tabular-nums">{fromPaise(i.unitPricePaise * i.qty)}</span>
          </li>
        ))}
        <li className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span className="tabular-nums">{fromPaise(order.amount)}</span></li>
      </ul>
    </main>
  );
}

export default function AdminOrderPage() {
  return <AdminGate><AdminTabs active="orders" /><Detail /></AdminGate>;
}

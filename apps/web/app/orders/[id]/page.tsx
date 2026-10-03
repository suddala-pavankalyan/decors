'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { cancelOrder, fetchOrder, type Order } from '@/lib/account';
import { useAuth } from '@/lib/auth';
import { fromPaise } from '@/lib/money';
import Icon from '@/components/Icon';
import InvoiceButton from '@/components/InvoiceButton';
import OrderTimeline from '@/components/OrderTimeline';
import { REFUND_LABEL, STATUS_LABEL, canCancel } from '@/lib/orderStatus';
import { window as dateWindow } from '@/lib/delivery';

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { user, ready } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');

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

  async function cancel() {
    setBusy(true);
    setCancelError('');
    try {
      setOrder(await cancelOrder(id, reason));
      setConfirming(false);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : 'Could not cancel the order');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main className="p-10 text-center">Loading…</main>;
  if (!user) return <main className="p-10 text-center"><Link href="/login" className="text-fuchsia-600 hover:underline">Log in</Link> to see this order.</main>;
  if (error) return <main className="p-10 text-center text-rose-600">{error}</main>;
  if (!order) return <main className="p-10 text-center">Loading…</main>;

  const cancelled = order.status === 'CANCELLED';
  const paid = order.status !== 'PENDING' && !cancelled;
  const headline = {
    PENDING: 'Waiting for payment confirmation',
    PAID: 'Thank you! Your order is confirmed',
    PACKED: 'Your order is packed',
    SHIPPED: 'Your order is on its way',
    DELIVERED: 'Your order was delivered',
    CANCELLED: 'This order was cancelled',
  }[order.status];
  return (
    <main className="mx-auto max-w-2xl px-4 pb-16">
      <div className={`rounded-3xl p-6 text-center ${cancelled ? 'bg-rose-50' : paid ? 'bg-emerald-50' : 'bg-amber-50'}`}>
        <Icon name={cancelled ? 'close' : paid ? 'sparkle' : 'clock'} size={44} className={`mx-auto ${cancelled ? 'text-rose-600' : paid ? 'text-emerald-600' : 'text-amber-600'}`} />
        <h1 className="mt-2 text-2xl font-bold">{headline}</h1>
        <p className="mt-1 text-sm text-slate-600">Order {order.id}{order.razorpayPaymentId ? ` · Payment ${order.razorpayPaymentId}` : ''}</p>
      </div>
      <section className="mt-6 rounded-2xl bg-white p-4 shadow">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Order progress</h2>
          <span className="text-xs font-semibold text-slate-500">{STATUS_LABEL[order.status]}</span>
        </div>
        <OrderTimeline status={order.status} events={order.events} />
        {order.carrier || order.trackingNumber ? (
          <p className="mt-4 rounded-xl bg-fuchsia-50 px-3 py-2 text-sm text-fuchsia-900">
            {order.carrier ? <>Shipped with <strong>{order.carrier}</strong></> : 'Shipment'}
            {order.trackingNumber ? <> · Tracking number <strong className="tabular-nums">{order.trackingNumber}</strong></> : null}
          </p>
        ) : null}
        {cancelled && order.refundStatus && (
          <p role="status" className={`mt-4 rounded-xl px-3 py-2 text-sm ${order.refundStatus === 'PROCESSED' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
            {REFUND_LABEL[order.refundStatus]}
            {order.refundStatus === 'PROCESSED' ? ': it usually shows in your account within 5-7 working days.' : '.'}
          </p>
        )}
        {cancelled && !order.refundStatus && <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">You were not charged for this order.</p>}
        {canCancel(order.status) && (
          <div className="mt-5 border-t pt-4">
            {confirming ? (
              <div>
                <label className="block text-sm font-medium">Why are you cancelling? <span className="font-normal text-slate-500">(optional)</span>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200" />
                </label>
                {order.status !== 'PENDING' && <p className="mt-2 text-xs text-slate-500">You will be refunded {fromPaise(order.amount)} to your original payment method.</p>}
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={cancel} disabled={busy} className="rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    {busy ? 'Cancelling…' : 'Yes, cancel order'}
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className="rounded-full border border-slate-200 px-5 py-2 text-sm">Keep order</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="text-sm font-medium text-rose-600 hover:underline">Cancel this order</button>
            )}
            {cancelError && <p role="alert" className="mt-2 text-sm text-rose-600">{cancelError}</p>}
          </div>
        )}
      </section>
      <ul className="mt-4 space-y-2 rounded-2xl bg-white p-4 shadow">
        {order.items.map((i) => (
          <li key={i.id} className="flex justify-between text-sm">
            <span>{i.name} × {i.qty}</span><span className="tabular-nums">{fromPaise(i.unitPricePaise * i.qty)}</span>
          </li>
        ))}
        {(order.discountPaise > 0 || order.shippingPaise > 0) && (
          <li className="flex justify-between border-t pt-2 text-sm text-slate-600"><span>Subtotal</span><span className="tabular-nums">{fromPaise(order.subtotalPaise)}</span></li>
        )}
        {order.discountPaise > 0 && (
          <li className="flex justify-between text-sm text-emerald-700"><span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span><span className="tabular-nums">−{fromPaise(order.discountPaise)}</span></li>
        )}
        {order.couponCode && order.discountPaise === 0 && order.shippingPaise === 0 && (
          <li className="flex justify-between text-sm text-emerald-700"><span>{order.couponCode}</span><span>Free shipping</span></li>
        )}
        {(order.discountPaise > 0 || order.shippingPaise > 0 || order.couponCode) && (
          <li className="flex justify-between text-sm text-slate-600"><span>Shipping</span><span className="tabular-nums">{order.shippingPaise === 0 ? 'Free' : fromPaise(order.shippingPaise)}</span></li>
        )}
        <li className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span className="tabular-nums">{fromPaise(order.amount)}</span></li>
      </ul>
      <section className="mt-4 rounded-2xl bg-white p-4 text-sm shadow">
        <h2 className="font-semibold">Delivering to</h2>
        <p className="mt-1">{order.shipName} · {order.shipPhone}</p>
        <p>{order.shipLine1}{order.shipLine2 ? `, ${order.shipLine2}` : ''}</p>
        <p>{order.shipCity}, {order.shipState} {order.shipPincode}</p>
        {order.estimatedFrom && order.estimatedTo && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
          <p className="mt-2 rounded-xl bg-fuchsia-50 px-3 py-2 text-fuchsia-900">Estimated delivery <strong>{dateWindow(order.estimatedFrom, order.estimatedTo)}</strong></p>
        )}
      </section>
      {(order.status === 'SHIPPED' || order.status === 'DELIVERED') && (
        <div className="mt-4"><InvoiceButton path={`/orders/${order.id}/invoice.pdf`} /></div>
      )}
      <Link href="/shop" className="mt-6 inline-block text-fuchsia-600 hover:underline">Continue shopping</Link>
    </main>
  );
}

'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startCheckout, verifyPayment, type Address } from '@/lib/account';
import { useAuth } from '@/lib/auth';
import { rupees } from '@/lib/money';
import { loadRazorpay } from '@/lib/razorpay';
import { useHydrated, useStore } from '@/lib/store';

const EMPTY: Address = { name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };
const input = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 outline-none focus:border-fuchsia-400';

export default function CheckoutPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { user, ready } = useAuth();
  const cart = useStore((s) => s.cart);
  const resync = useStore((s) => s.resync);
  const [addr, setAddr] = useState<Address>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [paidOrder, setPaidOrder] = useState<string | null>(null);

  if (!hydrated || !ready) return <main className="p-10 text-center">Loading…</main>;
  if (!user) {
    return (
      <main className="mx-auto max-w-md p-10 text-center">
        <p>Please log in to check out. Your cart will come with you.</p>
        <Link href="/login" className="mt-4 inline-block rounded-full bg-fuchsia-500 px-6 py-2 font-semibold text-white">Log in</Link>
      </main>
    );
  }
  if (cart.length === 0 && !paidOrder) {
    return (
      <main className="p-10 text-center text-slate-500">
        <p>Your cart is empty.</p>
        <Link href="/shop" className="mt-3 inline-block text-fuchsia-600 hover:underline">Browse products</Link>
      </main>
    );
  }

  const subtotal = cart.reduce((n, l) => n + l.price * l.qty, 0);
  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => setAddr({ ...addr, [k]: e.target.value });

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const session = await startCheckout(addr);
      await loadRazorpay();
      const Razorpay = window.Razorpay!;
      const rzp = new Razorpay({
        key: session.keyId,
        amount: session.amount,
        currency: session.currency,
        order_id: session.razorpayOrderId,
        name: 'Decors',
        description: `Order of ${cart.length} item${cart.length > 1 ? 's' : ''}`,
        prefill: { name: addr.name || user!.name, email: user!.email, contact: addr.phone },
        theme: { color: '#d946ef' },
        handler: async (result) => {
          try {
            await verifyPayment(session.orderId, result);
            await resync();
            router.push(`/orders/${session.orderId}`);
          } catch {
            // Money may have moved but we couldn't confirm; the webhook will still mark it paid.
            setPaidOrder(session.orderId);
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on('payment.failed', (r) => {
        setError(r.error.description || 'The payment failed. You have not been charged; please try again.');
        setBusy(false);
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  }

  if (paidOrder) {
    return (
      <main className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-2xl font-bold">We’re confirming your payment</h1>
        <p className="mt-3 text-slate-600">
          We couldn’t confirm it right away. If you were charged, your order will show as paid in a moment.
        </p>
        <Link href={`/orders/${paidOrder}`} className="mt-4 inline-block text-fuchsia-600 hover:underline">View your order</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 pb-16 md:grid-cols-[1fr_320px]">
      <form onSubmit={pay} className="space-y-4 rounded-3xl bg-white/80 p-6 shadow-xl">
        <h1 className="text-3xl font-bold">Delivery details</h1>
        <label className="block text-sm font-medium">Full name
          <input className={input} value={addr.name} onChange={set('name')} required maxLength={80} autoComplete="name" />
        </label>
        <label className="block text-sm font-medium">Mobile number
          <input className={input} value={addr.phone} onChange={set('phone')} required inputMode="numeric"
            pattern="[6-9][0-9]{9}" title="10-digit Indian mobile number" autoComplete="tel-national" />
        </label>
        <label className="block text-sm font-medium">Address line 1
          <input className={input} value={addr.line1} onChange={set('line1')} required maxLength={120} autoComplete="address-line1" />
        </label>
        <label className="block text-sm font-medium">Address line 2 (optional)
          <input className={input} value={addr.line2} onChange={set('line2')} maxLength={120} autoComplete="address-line2" />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium">City
            <input className={input} value={addr.city} onChange={set('city')} required maxLength={60} autoComplete="address-level2" />
          </label>
          <label className="block text-sm font-medium">State
            <input className={input} value={addr.state} onChange={set('state')} required maxLength={60} autoComplete="address-level1" />
          </label>
          <label className="block text-sm font-medium">Pincode
            <input className={input} value={addr.pincode} onChange={set('pincode')} required inputMode="numeric"
              pattern="[1-9][0-9]{5}" title="6-digit pincode" autoComplete="postal-code" />
          </label>
        </div>
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={busy}
          className="w-full rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-500 py-3 font-semibold text-white disabled:opacity-60">
          {busy ? 'Opening payment…' : `Pay ${rupees(subtotal)}`}
        </button>
        <p className="text-center text-xs text-slate-500">Payments are processed securely by Razorpay.</p>
      </form>

      <aside className="h-fit rounded-3xl bg-white/80 p-6 shadow-xl">
        <h2 className="font-semibold">Order summary</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {cart.map((l) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span className="truncate">{l.name} × {l.qty}</span>
              <span className="tabular-nums">{rupees(l.price * l.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t pt-3 font-bold">
          <span>Total</span><span className="tabular-nums">{rupees(subtotal)}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">The final amount is confirmed by our server at payment time.</p>
      </aside>
    </main>
  );
}

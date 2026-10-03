'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ResendVerification from '@/components/ResendVerification';
import AddressFields, { EMPTY_ADDRESS } from '@/components/AddressFields';
import { fetchAddresses, previewCheckout, startCheckout, verifyPayment, type Address, type CheckoutPreview, type SavedAddress } from '@/lib/account';
import { feeText, isPincode, window as dateWindow } from '@/lib/delivery';
import { useAuth } from '@/lib/auth';
import { fromPaise, rupees } from '@/lib/money';
import { loadRazorpay } from '@/lib/razorpay';
import { useHydrated, useStore } from '@/lib/store';

const sameAddress = (a: Address, b: Address) =>
  (['name', 'phone', 'line1', 'line2', 'city', 'state', 'pincode'] as const).every((k) => a[k].trim() === b[k].trim());
const oneLine = (a: Address) => [a.line1, a.line2, `${a.city}, ${a.state} ${a.pincode}`].filter(Boolean).join(', ');

export default function CheckoutPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { user, ready } = useAuth();
  const cart = useStore((s) => s.cart);
  const resync = useStore((s) => s.resync);
  const [addr, setAddr] = useState<Address>(EMPTY_ADDRESS);
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [picked, setPicked] = useState<string | null>(null); // id of the chosen saved address, null = typing a new one
  const [remember, setRemember] = useState(true);
  const [code, setCode] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [couponError, setCouponError] = useState('');
  const [applying, setApplying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [paidOrder, setPaidOrder] = useState<string | null>(null);

  // Offer the address book, starting with the default address already filled in.
  useEffect(() => {
    if (!user) return;
    fetchAddresses().then((list) => {
      setSaved(list);
      const d = list.find((a) => a.isDefault) ?? list[0];
      if (d) { setPicked(d.id); setAddr(d); }
    }).catch(() => {});
  }, [user]);

  // What the server would charge now: items, discount, shipping and delivery dates for the pincode typed so far.
  useEffect(() => {
    if (!user || cart.length === 0) return;
    let live = true;
    const t = setTimeout(() => {
      previewCheckout(isPincode(addr.pincode) ? addr.pincode : undefined, appliedCode ?? undefined)
        .then((p) => { if (live) setPreview(p); })
        .catch((e) => { if (live && appliedCode) { setAppliedCode(null); setCouponError(e.message); } });
    }, 250);
    return () => { live = false; clearTimeout(t); };
  }, [user, addr.pincode, appliedCode, cart.length]);

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
  async function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!code.trim()) return;
    setApplying(true);
    setCouponError('');
    try {
      const p = await previewCheckout(isPincode(addr.pincode) ? addr.pincode : undefined, code);
      setPreview(p);
      setAppliedCode(p.couponCode);
    } catch (err) {
      setAppliedCode(null);
      setCouponError(err instanceof Error ? err.message : 'Could not apply the coupon');
    } finally {
      setApplying(false);
    }
  }
  const totalText = preview ? fromPaise(preview.totalPaise) : rupees(subtotal);
  const undeliverable = preview?.delivery?.serviceable === false;

  const isNew = !saved.some((a) => sameAddress(a, addr));
  const choose = (a: SavedAddress | null) => { setPicked(a?.id ?? null); setAddr(a ?? EMPTY_ADDRESS); };
  const edit = (next: Address) => { setAddr(next); if (picked && !sameAddress(saved.find((a) => a.id === picked)!, next)) setPicked(null); };

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const session = await startCheckout(addr, remember && isNew, appliedCode ?? undefined);
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
        {!user.emailVerified && (
          <div role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong className="font-semibold">Confirm your email to pay.</strong> We sent a link to {user.email}; open it, then come back to this page.{' '}
            <ResendVerification />
          </div>
        )}
        {saved.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Deliver to</legend>
            {saved.map((a) => (
              <label key={a.id} className={`flex cursor-pointer gap-3 rounded-2xl border p-3 text-sm ${picked === a.id ? 'border-fuchsia-400 bg-fuchsia-50/50' : 'border-slate-200 bg-white'}`}>
                <input type="radio" name="saved-address" checked={picked === a.id} onChange={() => choose(a)} className="mt-1" />
                <span>
                  <span className="font-semibold">{a.name}</span> <span className="text-slate-500">· {a.phone}</span>
                  {a.isDefault && <span className="ml-2 rounded-full bg-fuchsia-50 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-700">Default</span>}
                  <span className="block text-slate-600">{oneLine(a)}</span>
                </span>
              </label>
            ))}
            <label className={`flex cursor-pointer gap-3 rounded-2xl border p-3 text-sm ${picked === null && !saved.some((a) => sameAddress(a, addr)) ? 'border-fuchsia-400 bg-fuchsia-50/50' : 'border-slate-200 bg-white'}`}>
              <input type="radio" name="saved-address" checked={picked === null} onChange={() => {}} onClick={() => choose(null)} className="mt-1" />
              <span className="font-semibold">Use a different address</span>
            </label>
          </fieldset>
        )}
        <AddressFields value={addr} onChange={edit} />
        {isNew && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Save this address for next time
          </label>
        )}
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
        <button type="submit" disabled={busy || !user.emailVerified || undeliverable}
          className="w-full rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-500 py-3 font-semibold text-white disabled:opacity-60">
          {busy ? 'Opening payment…' : `Pay ${totalText}`}
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
        <div className="mt-4 border-t pt-3">
          {appliedCode ? (
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <span><strong>{appliedCode}</strong> applied</span>
              <button type="button" onClick={() => { setAppliedCode(null); setCode(''); }} className="text-xs underline">Remove</button>
            </div>
          ) : (
            <form onSubmit={applyCoupon} className="flex gap-2" aria-label="Coupon">
              <input value={code} onChange={(e) => { setCode(e.target.value); setCouponError(''); }} placeholder="Coupon code" aria-label="Coupon code" maxLength={40}
                className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm uppercase outline-none focus:border-fuchsia-400" />
              <button type="submit" disabled={applying || !code.trim()} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">
                {applying ? '…' : 'Apply'}
              </button>
            </form>
          )}
          {couponError && <p role="alert" className="mt-2 text-xs text-rose-600">{couponError}</p>}
        </div>
        <div className="mt-3 space-y-1 text-sm">
          {preview && (
            <>
              <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="tabular-nums">{fromPaise(preview.subtotalPaise)}</span></div>
              {preview.discountPaise > 0 && <div className="flex justify-between text-emerald-700"><span>Discount</span><span className="tabular-nums">−{fromPaise(preview.discountPaise)}</span></div>}
              <div className="flex justify-between text-slate-600"><span>Shipping</span><span className="tabular-nums">{preview.shippingPaise === 0 ? 'Free' : fromPaise(preview.shippingPaise)}</span></div>
            </>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span className="tabular-nums">{totalText}</span></div>
        </div>
        {preview?.delivery?.serviceable && preview.delivery.from && preview.delivery.to && (
          <p className="mt-3 rounded-xl bg-fuchsia-50 px-3 py-2 text-xs text-fuchsia-900">Estimated delivery <strong>{dateWindow(preview.delivery.from, preview.delivery.to)}</strong></p>
        )}
        {undeliverable && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">Sorry, we can’t deliver to this pincode yet.</p>}
        {preview && preview.shippingPaise > 0 && preview.delivery === null && <p className="mt-2 text-xs text-slate-500">{feeText({ feePaise: preview.shippingPaise, freeAbovePaise: null })}. Enter your pincode for delivery dates.</p>}
        <p className="mt-2 text-xs text-slate-500">The final amount is confirmed by our server at payment time.</p>
      </aside>
    </main>
  );
}

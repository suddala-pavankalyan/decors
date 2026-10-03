'use client';
import { createContext, useContext, useMemo, useState } from 'react';
import type { ProductDetail, Variant } from '@/lib/api';
import { fromPaise } from '@/lib/money';
import { rupees } from '@/lib/money';
import { lineKey, maxFor, useStore } from '@/lib/store';
import { stockLabel } from '@/lib/stock';

interface Purchase {
  product: ProductDetail;
  variant: Variant | null;
  choose: (id: string) => void;
  /** Price in rupees of what is chosen now. */
  price: number;
  /** Units available of what is chosen now (capped at 20). */
  stock: number;
}

const Ctx = createContext<Purchase | null>(null);
export const usePurchase = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('usePurchase must be used inside PurchaseProvider');
  return c;
};

/** Holds which option of the product is chosen, so the price, stock, button and personalise form all agree. */
export default function PurchaseProvider({ product, children }: { product: ProductDetail; children: React.ReactNode }) {
  const first = product.variants.find((v) => v.stock > 0) ?? product.variants[0] ?? null;
  const [id, setId] = useState<string | null>(first?.id ?? null);
  const value = useMemo<Purchase>(() => {
    const variant = product.variants.find((v) => v.id === id) ?? null;
    return { product, variant, choose: setId, price: variant?.price ?? product.price, stock: variant ? variant.stock : product.stock };
  }, [product, id]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Price (and stock note) of the chosen option; "From" the lowest price is shown only until an option exists. */
export function PriceBlock() {
  const { price, stock, product } = usePurchase();
  const label = stockLabel(stock);
  return (
    <>
      <p className="mt-4 text-3xl font-bold tabular-nums" data-testid="price">
        {product.variantLabel && product.variants.length === 0 ? 'From ' : ''}{rupees(price)}
      </p>
      {label && (
        <p className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold ${stock === 0 ? 'bg-slate-900 text-white' : 'bg-amber-100 text-amber-800'}`}>{label}</p>
      )}
    </>
  );
}

/** "Size: A5 / A4" pills with their prices. Options that are sold out stay visible but cannot be picked. */
export function VariantPicker() {
  const { product, variant, choose } = usePurchase();
  if (!product.variantLabel || product.variants.length === 0) return null;
  return (
    <fieldset className="mt-5">
      <legend className="text-sm font-semibold">{product.variantLabel}</legend>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={product.variantLabel}>
        {product.variants.map((v) => {
          const on = v.id === variant?.id;
          return (
            <button key={v.id} type="button" role="radio" aria-checked={on} disabled={v.stock === 0} onClick={() => choose(v.id)}
              className={`rounded-xl border px-4 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? 'border-fuchsia-500 bg-fuchsia-50 ring-2 ring-fuchsia-200' : 'border-slate-200 bg-white hover:border-fuchsia-300'}`}>
              <span className="block font-semibold">{v.label}</span>
              <span className="block text-xs text-slate-600">{v.stock === 0 ? 'Sold out' : fromPaise(v.price * 100)}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The main button: add to cart, or "Personalise this card" for cards that take the customer's own words. */
export function BuyButton() {
  const { product: p, variant, stock } = usePurchase();
  const add = useStore((s) => s.addToCart);
  const key = lineKey({ id: p.id, variantId: variant?.id });
  const inCart = useStore((s) => s.cart.find((l) => lineKey(l) === key)?.qty ?? 0);
  const [added, setAdded] = useState(false);
  const cls = 'rounded-full px-8 py-3 font-semibold text-white shadow-lg';
  if (stock === 0) return <button type="button" disabled className={`${cls} cursor-not-allowed !bg-slate-300`}>Sold out</button>;
  if (p.personalizable) return <a href="#personalise" className={cls} style={{ background: p.color }}>Personalise this card</a>;
  if (inCart >= maxFor({ stock })) return <button type="button" disabled className={`${cls} cursor-not-allowed !bg-slate-300 !text-slate-600`}>All in cart</button>;
  return (
    <button type="button" className={cls} style={{ background: p.color }}
      onClick={() => { add(p, 1, null, variant); setAdded(true); setTimeout(() => setAdded(false), 1200); }}>
      {added ? 'Added' : 'Add to cart'}
    </button>
  );
}


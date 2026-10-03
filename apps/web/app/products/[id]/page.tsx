import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import WishButton from '@/components/WishButton';
import Gallery from '@/components/Gallery';
import ProductCard from '@/components/ProductCard';
import { fetchProduct } from '@/lib/api';
import Icon from '@/components/Icon';
import Reviews from '@/components/Reviews';
import Stars from '@/components/Stars';
import DeliveryCheck from '@/components/DeliveryCheck';
import PersonalizeSection from '@/components/PersonalizeSection';
import PurchaseProvider, { BuyButton, PriceBlock, VariantPicker } from '@/components/PurchaseProvider';

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await fetchProduct(params.id);
  return p ? { title: `${p.name} — Decors`, description: p.description } : { title: 'Not found — Decors' };
}

export default async function ProductPage({ params }: Props) {
  const p = await fetchProduct(params.id);
  if (!p) notFound();

  return (
    <PurchaseProvider product={p}>
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/shop" className="text-sm text-fuchsia-600 hover:underline"><Icon name="back" size={16} className="mr-1 inline-block align-[-3px]" />All products</Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-2">
        <Gallery images={p.images} accent={p.color} />

        <section>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold capitalize shadow">
            {p.category.replace('-', ' ')}
          </span>
          <h1 className="mt-3 text-4xl font-extrabold">{p.name}</h1>
          <p className="mt-2">
            {p.reviewCount > 0
              ? <a href="#reviews" className="hover:underline"><Stars rating={p.rating} count={p.reviewCount} size={18} /></a>
              : <a href="#reviews" className="text-sm text-slate-500 hover:underline">No reviews yet</a>}
          </p>
          <PriceBlock />
          <p className="mt-4 text-slate-600">{p.description}</p>
          <VariantPicker />

          <div className="mt-6 flex items-center gap-2 text-sm">
            <span className="h-6 w-6 rounded-full border-2 border-white shadow" style={{ background: p.color }} />
            {p.colorName}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {p.tags.map((t) => (
              <span key={t} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm capitalize">{t}</span>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-3">
            <BuyButton />
            <WishButton p={p} className="border border-slate-200" />
          </div>
          <DeliveryCheck />
        </section>
      </div>

      {p.personalizable && <PersonalizeSection />}

      <Reviews productId={p.id} productName={p.name} />

      {p.related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-4 text-2xl font-semibold">You may also like</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {p.related.map((r) => <ProductCard key={r.id} p={r} />)}
          </div>
        </section>
      )}
    </main>
    </PurchaseProvider>
  );
}

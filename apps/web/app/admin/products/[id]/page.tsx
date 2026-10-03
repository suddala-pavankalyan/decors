'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AdminGate from '@/components/admin/AdminGate';
import ImageManager from '@/components/admin/ImageManager';
import VariantsEditor from '@/components/admin/VariantsEditor';
import ProductForm from '@/components/admin/ProductForm';
import Icon from '@/components/Icon';
import { createProduct, getProduct, updateProduct, type AdminProduct } from '@/lib/admin';

function Editor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';
  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) return;
    getProduct(id).then(setProduct).catch((e) => setError(e.message));
  }, [id, isNew]);

  const back = (
    <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-fuchsia-600 hover:underline">
      <Icon name="back" size={16} />All products
    </Link>
  );

  if (error) return <main className="mx-auto max-w-3xl px-4">{back}<p role="alert" className="mt-6 text-rose-600">{error}</p></main>;
  if (!isNew && !product) return <main className="p-10 text-center">Loading…</main>;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 pb-16">
      {back}
      <h1 className="text-3xl font-bold">{isNew ? 'New product' : 'Edit product'}</h1>

      <ProductForm
        key={product ? `${product.price}-${product.stock}-${product.variantLabel}` : 'new'}
        initial={product ?? undefined}
        submitLabel={isNew ? 'Create product' : 'Save changes'}
        onSubmit={async (input) => {
          if (isNew) {
            const created = await createProduct(input);
            router.replace(`/admin/products/${created.id}`);
          } else {
            const updated = await updateProduct(id, input);
            setProduct((p) => (p ? { ...updated, images: p.images } : updated));
          }
        }}
      />

      {isNew ? (
        <p className="rounded-2xl bg-white/70 p-4 text-sm text-slate-600">You can add photos right after the product is created.</p>
      ) : (
        product && (
          <>
            <VariantsEditor product={product} onChange={setProduct} />
            {product.images.length === 0 && <p className="text-sm text-amber-700">No photos yet. Add at least one so shoppers can see this product.</p>}
            <ImageManager productId={product.id} images={product.images} onChange={setProduct} />
          </>
        )
      )}
    </main>
  );
}

export default function AdminProductPage() {
  return <AdminGate><Editor /></AdminGate>;
}

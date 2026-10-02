import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { rupees } from '@/lib/money';
import type { Product } from '@/lib/api';

/** A piece "on display": matted frame, with a small museum-style caption underneath. */
export default function ExhibitCard({ p, index }: { p: Product; index: number }) {
  return (
    <Link href={`/products/${p.id}`} className="group block rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400">
      <div className="rounded-3xl border border-slate-200/70 bg-white p-3 shadow-lg shadow-slate-900/5 transition duration-300 group-hover:-translate-y-1.5 group-hover:shadow-xl group-hover:shadow-fuchsia-900/10">
        <div className="relative aspect-square overflow-hidden rounded-2xl" style={{ background: `linear-gradient(160deg, ${p.color}, ${p.color}99)` }}>
          {p.image && (
            <Image src={p.image.url} alt={p.image.alt} fill sizes="(min-width:1024px) 22vw, (min-width:640px) 40vw, 90vw"
              className="object-cover transition duration-500 group-hover:scale-105" />
          )}
        </div>
        <div className="px-1 pb-1 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            No. {String(index + 1).padStart(2, '0')} · {p.category.replace('-', ' ')}
          </p>
          <h3 className="mt-0.5 font-display text-lg font-semibold leading-snug">{p.name}</h3>
          <div className="mt-1 flex items-center justify-between">
            <span className="font-bold">{rupees(p.price)}</span>
            <span className="inline-flex items-center gap-1 text-sm text-amber-600">
              <Icon name="star" size={14} filled />{p.rating}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

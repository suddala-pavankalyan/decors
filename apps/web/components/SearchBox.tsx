'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { fetchProducts, type Facets, type Filters, type Product } from '@/lib/api';
import { clearFilters, hasActiveFilters, toggle } from '@/lib/filters';
import { rupees } from '@/lib/money';
import Icon from './Icon';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm capitalize transition-colors ${
        active ? 'border-transparent bg-spectrum text-white shadow' : 'border-slate-200 bg-white hover:border-fuchsia-300'
      }`}
    >
      {children}
    </button>
  );
}

/** Search input with a panel of live product matches and one-tap filters. */
export default function SearchBox({
  facets, filters, onChange,
}: { facets: Facets; filters: Filters; onChange: (f: Filters) => void }) {
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<Product[] | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const q = filters.q.trim();

  // Close on outside click (pointerdown works for mouse, touch and Safari, which doesn't focus buttons on click).
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  // Product suggestions ignore the sidebar filters so you can jump straight to any item.
  useEffect(() => {
    if (q.length < 2) { setMatches(null); return; }
    let stale = false;
    const t = setTimeout(() => {
      fetchProducts({ q, categories: [], colors: [], tags: [], maxPrice: facets.maxPrice, sort: 'rating' })
        .then((r) => { if (!stale) setMatches(r.items.slice(0, 5)); })
        .catch(() => { if (!stale) setMatches(null); });
    }, 200);
    return () => { stale = true; clearTimeout(t); };
  }, [q, facets.maxPrice]);

  const popularTags = facets.tags.slice(0, 8);

  return (
    <div
      ref={root}
      className="min-w-0 flex-1 sm:relative"
      onKeyDown={(e) => {
        // First Escape closes the panel (and stops the browser from also wiping the typed text);
        // once it's closed, Escape falls through to the browser's normal clear-search behaviour.
        if (e.key === 'Escape' && open) { e.preventDefault(); setOpen(false); input.current?.focus(); }
      }}
      onBlur={(e) => { if (e.relatedTarget && !root.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
    >
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
          <Icon name="search" size={20} />
        </span>
        <input
          ref={input}
          type="search"
          aria-label="Search products"
          placeholder="Search cards, decor, paints…"
          value={filters.q}
          onFocus={() => setOpen(true)}
          onChange={(e) => { onChange({ ...filters, q: e.target.value }); setOpen(true); }}
          className="w-full min-w-0 appearance-none rounded-full border border-slate-200 bg-white py-2.5 pl-12 pr-11 text-sm shadow-sm outline-none transition focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200 [&::-webkit-search-cancel-button]:hidden"
        />
        {filters.q && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => { onChange({ ...filters, q: '' }); input.current?.focus(); }}
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            role="region"
            aria-label="Search suggestions and quick filters"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 right-0 z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-3xl border border-slate-100 bg-white p-4 shadow-xl shadow-fuchsia-900/10"
          >
            {q.length >= 2 && (
              <section aria-label="Matching products" className="mb-4">
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Matching products</h4>
                {matches === null ? (
                  <p className="px-1 py-2 text-sm text-slate-400">Searching…</p>
                ) : matches.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-slate-500">No products match “{q}”.</p>
                ) : (
                  <ul>
                    {matches.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/products/${p.id}`}
                          className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-fuchsia-50 focus-visible:bg-fuchsia-50 focus-visible:outline-none"
                        >
                          <span className="h-9 w-9 shrink-0 rounded-lg" style={{ background: p.color }} aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{p.name}</span>
                            <span className="block text-xs capitalize text-slate-500">{p.category.replace('-', ' ')}</span>
                          </span>
                          <span className="text-sm font-semibold">{rupees(p.price)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <section aria-label="Quick filters" className="space-y-4">
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Browse by category</h4>
                <div className="flex flex-wrap gap-2">
                  {facets.categories.map((c) => (
                    <Chip key={c} active={filters.categories.includes(c)}
                      onClick={() => onChange({ ...filters, categories: toggle(filters.categories, c) })}>
                      {c.replace('-', ' ')}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Occasion &amp; style</h4>
                <div className="flex flex-wrap gap-2">
                  {popularTags.map((t) => (
                    <Chip key={t} active={filters.tags.includes(t)}
                      onClick={() => onChange({ ...filters, tags: toggle(filters.tags, t) })}>
                      {t}
                    </Chip>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Colour</h4>
                <div className="flex flex-wrap gap-2">
                  {facets.colors.map((c) => {
                    const on = filters.colors.includes(c.name);
                    return (
                      <button
                        key={c.name}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onChange({ ...filters, colors: toggle(filters.colors, c.name) })}
                        className={`flex items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 text-sm transition-colors ${
                          on ? 'border-slate-800 bg-slate-50' : 'border-slate-200 bg-white hover:border-fuchsia-300'
                        }`}
                      >
                        <span className="h-5 w-5 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} aria-hidden />
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
              <button
                type="button"
                disabled={!hasActiveFilters(filters)}
                onClick={() => onChange(clearFilters(filters))}
                className="font-medium text-fuchsia-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
              >
                Clear all
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-slate-900 px-4 py-1.5 font-semibold text-white">
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

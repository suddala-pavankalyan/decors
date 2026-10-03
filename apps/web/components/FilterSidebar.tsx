'use client';
import { motion } from 'framer-motion';
import type { Facets, Filters } from '@/lib/api';
import { toggle } from '@/lib/filters';
import { rupees } from '@/lib/money';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm capitalize transition-colors ${
        active ? 'border-fuchsia-500 bg-fuchsia-500 text-white' : 'border-slate-200 bg-white hover:border-fuchsia-300'
      }`}
    >
      {children}
    </motion.button>
  );
}

export default function FilterSidebar({
  facets, filters, onChange,
}: { facets: Facets; filters: Filters; onChange: (f: Filters) => void }) {
  return (
    <aside className="space-y-6 rounded-3xl bg-white/70 p-5 shadow backdrop-blur">
      <section>
        <h4 className="mb-2 font-semibold">Category</h4>
        <div className="flex flex-wrap gap-2">
          {facets.categories.map((c) => (
            <Chip key={c} active={filters.categories.includes(c)}
              onClick={() => onChange({ ...filters, categories: toggle(filters.categories, c) })}>
              {c.replace('-', ' ')}
            </Chip>
          ))}
        </div>
      </section>
      <section>
        <h4 className="mb-2 font-semibold">Colour</h4>
        <div className="flex flex-wrap gap-2">
          {facets.colors.map((c) => (
            <motion.button
              key={c.name} title={c.name} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.85 }}
              onClick={() => onChange({ ...filters, colors: toggle(filters.colors, c.name) })}
              className={`h-8 w-8 rounded-full border-2 ${
                filters.colors.includes(c.name) ? 'border-slate-800 ring-2 ring-white' : 'border-white'
              }`}
              style={{ background: c.hex }}
            />
          ))}
        </div>
      </section>
      <section>
        <h4 className="mb-2 font-semibold">Occasion / Style</h4>
        <div className="flex flex-wrap gap-2">
          {facets.tags.map((t) => (
            <Chip key={t} active={filters.tags.includes(t)}
              onClick={() => onChange({ ...filters, tags: toggle(filters.tags, t) })}>
              {t}
            </Chip>
          ))}
        </div>
      </section>
      <section>
        <h4 className="mb-2 font-semibold">Rating</h4>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Minimum rating">
          {[[0, 'Any'], [4, '4★ & up'], [3, '3★ & up']].map(([v, label]) => (
            <button key={v} type="button" aria-pressed={filters.minRating === v} onClick={() => onChange({ ...filters, minRating: v as number })}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${filters.minRating === v ? 'border-fuchsia-500 bg-fuchsia-500 text-white' : 'border-slate-200 bg-white hover:border-fuchsia-300'}`}>
              {label}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={filters.inStock} onChange={(e) => onChange({ ...filters, inStock: e.target.checked })} className="h-4 w-4 accent-fuchsia-500" />
          In stock only
        </label>
      </section>
      <section>
        <h4 className="mb-2 font-semibold">Max price: {rupees(filters.maxPrice)}</h4>
        <input type="range" min={10} max={facets.maxPrice} value={filters.maxPrice}
          onChange={(e) => onChange({ ...filters, maxPrice: Number(e.target.value) })}
          className="w-full accent-fuchsia-500" />
      </section>
    </aside>
  );
}

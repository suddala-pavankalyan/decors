'use client';
import { useEffect, useState } from 'react';
import Dropdown from '@/components/Dropdown';
import Icon from '@/components/Icon';
import type { AdminProduct, ProductInput } from '@/lib/admin';
import { fetchFacets, type Facets } from '@/lib/api';

const CATEGORIES = [
  { value: 'wedding-cards', label: 'Wedding cards' },
  { value: 'gift-cards', label: 'Gift cards' },
  { value: 'wall-decor', label: 'Wall decor' },
  { value: 'paints', label: 'Paints' },
];

const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200';

export default function ProductForm({
  initial, submitLabel, onSubmit,
}: { initial?: AdminProduct; submitLabel: string; onSubmit: (p: ProductInput) => Promise<void> }) {
  const [facets, setFacets] = useState<Facets | null>(null);
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'wedding-cards');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [stock, setStock] = useState(initial ? String(initial.stock) : '10');
  const [personalizable, setPersonalizable] = useState(initial?.personalizable ?? false);
  const [rating, setRating] = useState(initial ? String(initial.rating) : '0');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [colorName, setColorName] = useState(initial?.colorName ?? '');
  const [colorHex, setColorHex] = useState(initial?.colorHex ?? '#d946ef');
  const [customColor, setCustomColor] = useState(false);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const hasOptions = !!initial?.variantLabel;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { fetchFacets().then(setFacets).catch(() => {}); }, []);

  // Editing a product whose colour isn't among the shared swatches shows it as a custom colour.
  useEffect(() => {
    if (facets && initial && !facets.colors.some((c) => c.name === initial.colorName)) setCustomColor(true);
  }, [facets, initial]);

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 10) setTags([...tags, t]);
    setTagInput('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);
    if (!colorName.trim()) { setError('Choose a colour or name a new one.'); return; }
    const pending = tagInput.trim().toLowerCase();
    const allTags = pending && !tags.includes(pending) ? [...tags, pending] : tags;
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(), category, price: Number(price), stock: Math.round(Number(stock)), personalizable, rating: Number(rating),
        description: description.trim(), colorName: colorName.trim(), colorHex, tags: allTags,
      });
      setTags(allTags);
      setTagInput('');
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the product');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-3xl bg-white/80 p-6 shadow-xl">
      <label className="block text-sm font-medium">Name
        <input className={field} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
      </label>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="text-sm font-medium">Category
          <Dropdown ariaLabel="Category" placeholder="Category" value={category} onChange={setCategory} options={CATEGORIES}
            className="mt-1 [&>button]:py-2.5" />
        </div>
        <label className="block text-sm font-medium">{hasOptions ? 'Price from (₹)' : 'Price (₹)'}
          <input className={field} type="number" inputMode="numeric" min={1} max={1000000} step={1} required disabled={hasOptions}
            value={price} onChange={(e) => setPrice(e.target.value)} />
          {hasOptions && <span className="mt-1 block text-xs font-normal text-slate-500">The lowest option price. Set prices on the options below.</span>}
        </label>
        <label className="block text-sm font-medium">In stock (units)
          <input className={field} type="number" inputMode="numeric" min={0} max={1000000} step={1} required disabled={hasOptions}
            value={stock} onChange={(e) => setStock(e.target.value)} />
          {hasOptions && <span className="mt-1 block text-xs font-normal text-slate-500">Total of all options.</span>}
        </label>
        <label className="block text-sm font-medium">Rating (0–5)
          <input className={field} type="number" min={0} max={5} step={0.1} required
            value={rating} onChange={(e) => setRating(e.target.value)} />
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={personalizable} onChange={(e) => setPersonalizable(e.target.checked)} />
        <span><span className="font-medium">Customers can personalise this card</span>
          <span className="block text-slate-500">They type two names, the event date and venue, and see a preview before buying. You see the details on the order.</span></span>
      </label>

      <label className="block text-sm font-medium">Description
        <textarea className={`${field} min-h-28 resize-y`} value={description} onChange={(e) => setDescription(e.target.value)}
          required maxLength={2000} />
      </label>

      <fieldset>
        <legend className="text-sm font-medium">Colour</legend>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {facets?.colors.map((c) => {
            const on = !customColor && colorName === c.name;
            return (
              <button key={c.name} type="button" aria-pressed={on}
                onClick={() => { setCustomColor(false); setColorName(c.name); setColorHex(c.hex); }}
                className={`flex items-center gap-2 rounded-full border py-1 pl-1.5 pr-3 text-sm transition-colors ${
                  on ? 'border-slate-800 bg-slate-50' : 'border-slate-200 bg-white hover:border-fuchsia-300'
                }`}>
                <span className="h-5 w-5 rounded-full ring-1 ring-black/10" style={{ background: c.hex }} aria-hidden />{c.name}
              </button>
            );
          })}
          <button type="button" aria-pressed={customColor} onClick={() => { setCustomColor(true); if (!customColor) setColorName(''); }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
              customColor ? 'border-slate-800 bg-slate-50' : 'border-dashed border-slate-300 bg-white hover:border-fuchsia-300'
            }`}>
            <Icon name="plus" size={14} />New colour
          </button>
        </div>
        {customColor && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block text-sm font-medium">Colour name
              <input className={`${field} w-48`} value={colorName} onChange={(e) => setColorName(e.target.value)} maxLength={40} />
            </label>
            <label className="block text-sm font-medium">Pick a shade
              <input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)}
                className="mt-1 block h-11 w-16 cursor-pointer rounded-xl border border-slate-200 bg-white p-1" />
            </label>
            <span className="pb-3 text-sm text-slate-500">{colorHex.toUpperCase()}</span>
          </div>
        )}
      </fieldset>

      <div>
        <label htmlFor="tag-input" className="block text-sm font-medium">Occasion &amp; style tags <span className="font-normal text-slate-500">(up to 10)</span></label>
        <div className="mt-1 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 focus-within:border-fuchsia-400 focus-within:ring-2 focus-within:ring-fuchsia-200">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-fuchsia-50 py-1 pl-3 pr-1.5 text-sm capitalize text-fuchsia-800">
              {t}
              <button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}
                className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-fuchsia-100"><Icon name="close" size={12} /></button>
            </span>
          ))}
          <input id="tag-input" list="tag-options" value={tagInput} disabled={tags.length >= 10}
            placeholder={tags.length >= 10 ? 'Limit reached' : 'Type a tag, press Enter'}
            onChange={(e) => setTagInput(e.target.value.replace(',', ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); }
              else if (e.key === 'Backspace' && !tagInput && tags.length) setTags(tags.slice(0, -1));
            }}
            onBlur={() => addTag(tagInput)}
            maxLength={30}
            className="min-w-32 flex-1 bg-transparent px-2 py-1 text-sm outline-none" />
          <datalist id="tag-options">{facets?.tags.filter((t) => !tags.includes(t)).map((t) => <option key={t} value={t} />)}</datalist>
        </div>
      </div>

      <div aria-live="polite">
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
        {saved && !error && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Saved.</p>}
      </div>

      <button type="submit" disabled={busy}
        className="rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-500 px-8 py-3 font-semibold text-white disabled:opacity-60">
        {busy ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}

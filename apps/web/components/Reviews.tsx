'use client';
import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Stars from '@/components/Stars';
import { useAuth } from '@/lib/auth';
import {
  addPhoto, deleteReview, fetchMine, fetchReviews, removePhoto, saveReview, type Mine, type Review, type ReviewPage, type Sort,
} from '@/lib/reviews';

const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200';
const when = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Your rating" className="mt-1 flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} onClick={() => onChange(n)}
          className={`text-3xl leading-none transition ${n <= value ? 'text-amber-500' : 'text-slate-300 hover:text-amber-300'}`}>★</button>
      ))}
    </div>
  );
}

function Photos({ photos, onRemove }: { photos: Review['photos']; onRemove?: (id: number) => void }) {
  if (photos.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {photos.map((p) => (
        <li key={p.id} className="relative h-20 w-20 overflow-hidden rounded-xl bg-slate-100">
          <Image src={p.url} alt="Customer photo" fill sizes="80px" className="object-cover" />
          {onRemove && <button type="button" aria-label="Remove photo" onClick={() => onRemove(p.id)} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-white/90 text-xs font-bold text-rose-600">×</button>}
        </li>
      ))}
    </ul>
  );
}

function ReviewCard({ r, mine = false }: { r: Review; mine?: boolean }) {
  return (
    <li className="rounded-2xl bg-white p-4 shadow" data-testid="review">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Stars rating={r.rating} showNumber={false} size={16} />
        <p className="text-xs text-slate-500">{when(r.createdAt)}</p>
      </div>
      {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
      <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{r.body}</p>
      <Photos photos={r.photos} />
      <p className="mt-3 text-xs text-slate-500">
        {mine ? 'You' : r.authorName}
        {r.verifiedBuyer && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">Verified buyer</span>}
      </p>
      {r.reply && (
        <div className="mt-3 rounded-xl bg-fuchsia-50 px-3 py-2 text-sm text-fuchsia-950">
          <p className="text-xs font-semibold">Reply from Decors{r.repliedAt ? ` · ${when(r.repliedAt)}` : ''}</p>
          <p className="mt-0.5">{r.reply}</p>
        </div>
      )}
    </li>
  );
}

/** Reviews of a product: the summary, the list, and (for people who received it) a form to write theirs. */
export default function Reviews({ productId, productName }: { productId: string; productName: string }) {
  const { user, ready } = useAuth();
  const [page, setPage] = useState<ReviewPage | null>(null);
  const [items, setItems] = useState<Review[]>([]);
  const [sort, setSort] = useState<Sort>('newest');
  const [mine, setMine] = useState<Mine | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [more, setMore] = useState(false);

  const load = useCallback(() => {
    fetchReviews(productId, sort).then((p) => { setPage(p); setItems(p.items); setError(''); }).catch((e) => setError(e.message));
  }, [productId, sort]);
  useEffect(load, [load]);
  useEffect(() => {
    if (!ready) return;
    if (!user) { setMine(null); return; }
    fetchMine(productId).then(setMine).catch(() => setMine(null));
  }, [productId, user, ready]);

  async function loadMore() {
    setMore(true);
    try { const p = await fetchReviews(productId, sort, items.length); setItems((prev) => [...prev, ...p.items.filter((x) => !prev.some((y) => y.id === x.id))]); setPage(p); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load more'); } finally { setMore(false); }
  }

  function startEdit() {
    setRating(mine?.review?.rating ?? 0); setTitle(mine?.review?.title ?? ''); setBody(mine?.review?.body ?? ''); setFormError(''); setEditing(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) { setFormError('Choose a star rating.'); return; }
    setBusy(true); setFormError('');
    try { setMine(await saveReview(productId, { rating, title: title.trim(), body: body.trim() })); setEditing(false); load(); }
    catch (err) { setFormError(err instanceof Error ? err.message : 'Could not post your review'); }
    finally { setBusy(false); }
  }

  async function act(fn: () => Promise<Mine | void>) {
    setBusy(true); setFormError('');
    try { const m = await fn(); if (m) setMine(m); else setMine(await fetchMine(productId)); load(); }
    catch (err) { setFormError(err instanceof Error ? err.message : 'Something went wrong'); }
    finally { setBusy(false); }
  }

  const s = page?.summary;
  const my = mine?.review ?? null;

  return (
    <section id="reviews" aria-labelledby="reviews-h" className="mt-14 scroll-mt-6">
      <h2 id="reviews-h" className="text-2xl font-bold">Customer reviews</h2>
      {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

      <div className="mt-4 grid gap-6 md:grid-cols-[260px_1fr]">
        <div>
          {s && s.count > 0 ? (
            <div className="rounded-2xl bg-white p-4 shadow">
              <p className="text-4xl font-extrabold tabular-nums" data-testid="avg">{s.average.toFixed(1)}</p>
              <Stars rating={s.average} count={s.count} showNumber={false} size={18} />
              <ul className="mt-3 space-y-1.5" aria-label="Ratings breakdown">
                {[5, 4, 3, 2, 1].map((n) => {
                  const c = s.histogram[String(n)] ?? 0;
                  return (
                    <li key={n} className="flex items-center gap-2 text-xs">
                      <span className="w-12 shrink-0 whitespace-nowrap tabular-nums text-slate-600">{n} star</span>
                      <span className="h-2 flex-1 rounded-full bg-slate-100"><span className="block h-2 rounded-full bg-amber-500" style={{ width: `${(c / s.count) * 100}%` }} /></span>
                      <span className="w-6 shrink-0 text-right tabular-nums text-slate-500">{c}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow">No reviews yet. Be the first once you have received this {productName ? '' : 'product'}.</p>
          )}

          <div className="mt-4 rounded-2xl bg-white p-4 text-sm shadow">
            {!ready ? null : !user ? (
              <p><Link href="/login" className="font-semibold text-fuchsia-700 hover:underline">Log in</Link> to review a product you have bought.</p>
            ) : mine === null ? null : my ? (
              <div>
                <p className="font-semibold">Your review{mine.status === 'HIDDEN' ? ' (hidden by the shop)' : ''}</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <button type="button" onClick={startEdit} className="font-semibold text-fuchsia-700 hover:underline">Edit</button>
                  <button type="button" disabled={busy} onClick={() => { if (window.confirm('Delete your review?')) act(async () => { await deleteReview(productId); }); }} className="font-semibold text-rose-600 hover:underline">Delete</button>
                </div>
              </div>
            ) : mine.canReview ? (
              !editing && <button type="button" onClick={startEdit} className="rounded-full bg-spectrum px-5 py-2 font-semibold text-white">Write a review</button>
            ) : (
              <p className="text-slate-600">{mine.reason}</p>
            )}
          </div>
        </div>

        <div>
          {editing && (
            <form onSubmit={submit} aria-label="Write a review" className="mb-5 space-y-3 rounded-2xl bg-white p-4 shadow">
              <div className="text-sm font-medium">Your rating<StarInput value={rating} onChange={setRating} /></div>
              <label className="block text-sm font-medium">Headline <span className="font-normal text-slate-500">(optional)</span>
                <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
              </label>
              <label className="block text-sm font-medium">Your review
                <textarea className={`${field} resize-y`} rows={4} value={body} onChange={(e) => setBody(e.target.value)} minLength={10} maxLength={2000} required placeholder="What did you like or dislike? How was the quality?" />
              </label>
              <p className="text-xs text-slate-500">You can add up to 3 photos once your review is posted.</p>
              {formError && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{formError}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Posting…' : my ? 'Save changes' : 'Post review'}</button>
                <button type="button" onClick={() => setEditing(false)} className="rounded-full border border-slate-300 px-6 py-2.5 text-sm">Cancel</button>
              </div>
            </form>
          )}

          {my && !editing && (
            <div className="mb-5">
              <ul><ReviewCard r={my} mine /></ul>
              <div className="mt-2 rounded-2xl bg-white p-4 shadow">
                <Photos photos={my.photos} onRemove={(id) => act(() => removePhoto(productId, id))} />
                {my.photos.length < 3 && (
                  <label className="mt-2 inline-block cursor-pointer rounded-full border border-slate-300 px-4 py-1.5 text-sm font-semibold hover:border-fuchsia-400">
                    {busy ? 'Uploading…' : 'Add a photo'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Add a photo to your review" disabled={busy}
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) act(() => addPhoto(productId, f)); }} />
                  </label>
                )}
                {formError && <p role="alert" className="mt-2 text-sm text-rose-600">{formError}</p>}
                <p className="mt-2 text-xs text-slate-500">JPEG, PNG or WebP, up to 5 MB each, at most 3 photos.</p>
              </div>
            </div>
          )}

          {page && page.total > 0 && (
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-slate-600">{page.total} review{page.total === 1 ? '' : 's'}</p>
              <label className="text-sm">Sort by{' '}
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm">
                  <option value="newest">Newest</option><option value="highest">Highest rated</option><option value="lowest">Lowest rated</option>
                </select>
              </label>
            </div>
          )}
          <ul className="space-y-3">{items.filter((r) => r.id !== my?.id).map((r) => <ReviewCard key={r.id} r={r} />)}</ul>
          {page?.hasMore && (
            <div className="mt-4 text-center">
              <button type="button" onClick={loadMore} disabled={more} className="rounded-full border border-slate-300 bg-white px-8 py-2.5 text-sm font-semibold hover:border-fuchsia-400 disabled:opacity-60">{more ? 'Loading…' : 'Show more reviews'}</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

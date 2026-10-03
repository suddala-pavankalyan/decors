'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminGate from '@/components/admin/AdminGate';
import AdminTabs from '@/components/admin/AdminTabs';
import Stars from '@/components/Stars';
import { deleteReview, listReviews, updateReview, type AdminReview, type AdminReviewPage, type ReviewStatus } from '@/lib/adminReviews';

const field = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200';

function Row({ r, onChange, onRemove, onError }: { r: AdminReview; onChange: (r: AdminReview) => void; onRemove: () => void; onError: (m: string) => void }) {
  const [reply, setReply] = useState(r.reply ?? '');
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true); onError('');
    try { await fn(); } catch (e) { onError((e as Error).message); } finally { setBusy(false); }
  }
  const toggle = () => run(async () => onChange(await updateReview(r.id, { status: r.status === 'HIDDEN' ? 'PUBLISHED' : 'HIDDEN' })));
  const saveReply = () => run(async () => { onChange(await updateReview(r.id, { reply: reply.trim() || null })); setEditing(false); });

  return (
    <li className={`rounded-2xl bg-white p-4 shadow ${r.status === 'HIDDEN' ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Stars rating={r.rating} size={16} />
          {r.title && <p className="font-semibold">{r.title}</p>}
          <p className="text-xs text-slate-500">
            {r.userName} ({r.userEmail}) on <Link href={`/products/${r.productId}#reviews`} className="text-fuchsia-600 hover:underline">{r.productName}</Link> · {new Date(r.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.status === 'HIDDEN' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
          {r.status === 'HIDDEN' ? 'Hidden' : 'Published'}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm">{r.body}</p>
      {r.photos.length > 0 && (
        <div className="mt-2 flex gap-2">
          {r.photos.map((p) => <a key={p.id} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt="Customer photo" className="h-16 w-16 rounded-lg object-cover" /></a>)}
        </div>
      )}
      {r.reply && !editing && <p className="mt-3 rounded-xl bg-fuchsia-50 p-3 text-sm"><span className="font-semibold">Your reply: </span>{r.reply}</p>}
      {editing && (
        <div className="mt-3">
          <label className="block text-sm font-medium">Reply to this review
            <textarea className={`${field} mt-1 w-full`} rows={3} maxLength={1000} value={reply} onChange={(e) => setReply(e.target.value)} />
          </label>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy} onClick={saveReply} className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Save reply</button>
            <button type="button" onClick={() => { setEditing(false); setReply(r.reply ?? ''); }} className="rounded-full px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" disabled={busy} onClick={toggle} className="rounded-full border border-slate-200 px-3 py-1 font-semibold hover:bg-slate-50 disabled:opacity-50">
          {r.status === 'HIDDEN' ? 'Show' : 'Hide'}
        </button>
        {!editing && <button type="button" onClick={() => setEditing(true)} className="rounded-full border border-slate-200 px-3 py-1 font-semibold hover:bg-slate-50">{r.reply ? 'Edit reply' : 'Reply'}</button>}
        {confirming ? (
          <span className="flex items-center gap-2">
            <span className="text-slate-600">Delete this review for good?</span>
            <button type="button" disabled={busy} onClick={() => run(async () => { await deleteReview(r.id); onRemove(); })} className="rounded-full bg-rose-600 px-3 py-1 font-semibold text-white disabled:opacity-50">Yes, delete</button>
            <button type="button" onClick={() => setConfirming(false)} className="text-slate-600 hover:underline">Keep</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="rounded-full px-3 py-1 font-semibold text-rose-600 hover:bg-rose-50">Delete</button>
        )}
      </div>
    </li>
  );
}

function Reviews() {
  const [status, setStatus] = useState<ReviewStatus | ''>('');
  const [rating, setRating] = useState(0);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState<AdminReviewPage | null>(null);
  const [items, setItems] = useState<AdminReview[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { const t = setTimeout(() => setQuery(q), 300); return () => clearTimeout(t); }, [q]);

  const load = useCallback(async (offset: number) => {
    setLoading(true); setError('');
    try {
      const p = await listReviews({ status, rating, q: query, offset });
      setPage(p);
      setItems((cur) => (offset === 0 ? p.items : [...cur, ...p.items]));
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [status, rating, query]);
  useEffect(() => { load(0); }, [load]);

  const tab = (value: ReviewStatus | '', label: string, n?: number) => (
    <button type="button" aria-pressed={status === value} onClick={() => setStatus(value)}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold ${status === value ? 'bg-fuchsia-600 text-white' : 'bg-white text-slate-600 shadow hover:bg-slate-50'}`}>
      {label}{n !== undefined ? ` (${n})` : ''}
    </button>
  );

  return (
    <main className="mx-auto max-w-4xl px-4 pb-16">
      <AdminTabs active="reviews" />
      <h1 className="text-3xl font-bold">Reviews</h1>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {tab('', 'All', page ? page.counts.PUBLISHED + page.counts.HIDDEN : undefined)}
        {tab('PUBLISHED', 'Published', page?.counts.PUBLISHED)}
        {tab('HIDDEN', 'Hidden', page?.counts.HIDDEN)}
        <select aria-label="Filter by stars" className={field} value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          <option value={0}>Any rating</option>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
        </select>
        <input aria-label="Search reviews" type="search" placeholder="Search text, product or customer" className={`${field} min-w-[16rem] flex-1`} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p role="alert" className="mt-4 text-rose-600">{error}</p>}
      {page && items.length === 0 && !loading && <p className="mt-8 text-center text-slate-500">No reviews match.</p>}
      <ul className="mt-4 space-y-3">
        {items.map((r) => (
          <Row key={r.id} r={r} onError={setError}
            onChange={(n) => { setItems((cur) => cur.map((x) => (x.id === n.id ? n : x))); load(0); }}
            onRemove={() => { setItems((cur) => cur.filter((x) => x.id !== r.id)); load(0); }} />
        ))}
      </ul>
      {page?.hasMore && (
        <div className="mt-4 text-center">
          <button type="button" disabled={loading} onClick={() => load(items.length)} className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold shadow hover:bg-slate-50 disabled:opacity-50">Show more</button>
        </div>
      )}
    </main>
  );
}

export default function AdminReviewsPage() {
  return <AdminGate><Reviews /></AdminGate>;
}

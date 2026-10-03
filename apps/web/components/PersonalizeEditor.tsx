'use client';
import { useState } from 'react';
import CardPreview from '@/components/CardPreview';
import { EMPTY_DETAILS, problem, todayIso, type Personalization } from '@/lib/personalize';

const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200';

/** Form with a live preview. `onSubmit` receives details that passed the basic checks. */
export default function PersonalizeEditor({
  initial, accent, productName, submitLabel, onSubmit, onCancel, busy = false,
}: {
  initial?: Personalization | null; accent: string; productName: string; submitLabel: string;
  onSubmit: (d: Personalization) => void | Promise<void>; onCancel?: () => void; busy?: boolean;
}) {
  const [d, setD] = useState<Personalization>({ ...EMPTY_DETAILS, ...initial, note: initial?.note ?? '' });
  const [error, setError] = useState('');
  const set = (k: keyof Personalization) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setD({ ...d, [k]: e.target.value }); setError(''); };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = problem(d);
    if (p) { setError(p); return; }
    onSubmit({ ...d, partnerOne: d.partnerOne.trim(), partnerTwo: d.partnerTwo.trim(), venue: d.venue.trim(), note: d.note?.trim() || null });
  }

  return (
    <form onSubmit={submit} aria-label="Personalise your card" className="grid gap-6 md:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">First name
            <input className={field} value={d.partnerOne} onChange={set('partnerOne')} maxLength={40} required autoComplete="off" />
          </label>
          <label className="block text-sm font-medium">Second name
            <input className={field} value={d.partnerTwo} onChange={set('partnerTwo')} maxLength={40} required autoComplete="off" />
          </label>
        </div>
        <label className="block text-sm font-medium">Event date
          <input className={field} type="date" min={todayIso()} value={d.eventDate} onChange={set('eventDate')} required />
        </label>
        <label className="block text-sm font-medium">Venue
          <input className={field} value={d.venue} onChange={set('venue')} maxLength={120} required placeholder="Hall or hotel, city" autoComplete="off" />
        </label>
        <label className="block text-sm font-medium">A line for your guests <span className="font-normal text-slate-500">(optional)</span>
          <textarea className={`${field} resize-y`} rows={2} value={d.note ?? ''} onChange={set('note')} maxLength={200} />
        </label>
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy} className="rounded-full bg-spectrum px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/25 disabled:opacity-60">
            {busy ? 'Saving…' : submitLabel}
          </button>
          {onCancel && <button type="button" onClick={onCancel} className="rounded-full border border-slate-300 px-6 py-2.5 text-sm">Cancel</button>}
        </div>
        <p className="text-xs text-slate-500">Check the spelling carefully: we print exactly what you type here.</p>
      </div>
      <CardPreview details={d} accent={accent} name={productName} />
    </form>
  );
}

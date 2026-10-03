import type { Delivery } from '@/lib/account';
import { fromPaise } from '@/lib/money';

const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

/** "Tue 7 Oct – Thu 9 Oct" (or one date when both are the same day). */
export const window = (from: string, to: string) => (from === to ? day(from) : `${day(from)} – ${day(to)}`);

export const feeText = (d: Pick<Delivery, 'feePaise' | 'freeAbovePaise'>) =>
  d.feePaise === 0 ? 'Free shipping' : `Shipping ${fromPaise(d.feePaise)}${d.freeAbovePaise ? `, free above ${fromPaise(d.freeAbovePaise)}` : ''}`;

export const isPincode = (p: string) => /^[1-9][0-9]{5}$/.test(p);

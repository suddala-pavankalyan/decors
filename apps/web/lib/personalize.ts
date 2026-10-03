/** What a customer puts on a personalised card. Dates are ISO (2026-12-05). */
export interface Personalization {
  partnerOne: string; partnerTwo: string; eventDate: string; venue: string; note: string | null;
}

export const EMPTY_DETAILS: Personalization = { partnerOne: '', partnerTwo: '', eventDate: '', venue: '', note: '' };

export const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Today in the customer's browser, as yyyy-mm-dd, for the date picker's minimum. */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** First problem with the details, or null. The server checks again; this just saves a round trip. */
export function problem(d: Personalization): string | null {
  if (!d.partnerOne.trim() || !d.partnerTwo.trim()) return 'Enter both names.';
  if (!d.eventDate) return 'Choose the event date.';
  if (d.eventDate < todayIso()) return 'The event date cannot be in the past.';
  if (!d.venue.trim()) return 'Enter the venue.';
  return null;
}

export const summary = (d: Personalization) => `${d.partnerOne} & ${d.partnerTwo} · ${longDate(d.eventDate)} · ${d.venue}`;

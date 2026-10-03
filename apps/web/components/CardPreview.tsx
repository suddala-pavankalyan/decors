import type { Personalization } from '@/lib/personalize';
import { longDate } from '@/lib/personalize';

/**
 * A picture of the card with the customer's words on it, so they can see it before they buy.
 * It uses the product's colour for the frame and tint; the printed card follows the same layout.
 */
export default function CardPreview({ details, accent, name }: { details: Partial<Personalization>; accent: string; name?: string }) {
  const one = details.partnerOne?.trim();
  const two = details.partnerTwo?.trim();
  const ph = 'text-slate-400';
  return (
    <figure aria-label={name ? `Preview of ${name}` : 'Card preview'} className="mx-auto w-full max-w-xs">
      <div className="relative aspect-[5/7] rounded-sm p-3 shadow-xl" style={{ background: `linear-gradient(160deg, ${accent}33, #fffdf8 55%)`, border: `1px solid ${accent}` }}>
        <div className="flex h-full flex-col items-center justify-center rounded-sm px-4 text-center font-serif text-slate-800" style={{ border: `2px double ${accent}` }}>
          <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: accent }}>Together with their families</p>
          <p className={`mt-5 text-3xl italic leading-tight ${one ? '' : ph}`} data-testid="preview-one">{one || 'First name'}</p>
          <p className="my-1 text-lg" style={{ color: accent }}>&amp;</p>
          <p className={`text-3xl italic leading-tight ${two ? '' : ph}`} data-testid="preview-two">{two || 'Second name'}</p>
          <p className="mt-5 text-[11px] uppercase tracking-[0.2em] text-slate-500">invite you to celebrate their wedding</p>
          <p className={`mt-3 text-sm ${details.eventDate ? '' : ph}`} data-testid="preview-date">{details.eventDate ? longDate(details.eventDate) : 'Event date'}</p>
          <p className={`mt-1 text-sm ${details.venue?.trim() ? '' : ph}`} data-testid="preview-venue">{details.venue?.trim() || 'Venue'}</p>
          {details.note?.trim() && <p className="mt-4 text-xs italic text-slate-600" data-testid="preview-note">{details.note.trim()}</p>}
        </div>
      </div>
      <figcaption className="mt-2 text-center text-xs text-slate-500">Preview: the printed card follows this layout.</figcaption>
    </figure>
  );
}

import Icon from '@/components/Icon';

/** Five stars filled to the rating (to the nearest half), with the number and review count as text for everyone. */
export default function Stars({ rating, count, size = 16, showNumber = true, className = '' }: {
  rating: number; count?: number; size?: number; showNumber?: boolean; className?: string;
}) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.25 && rating - full < 0.75;
  const rounded = rating - full >= 0.75 ? full + 1 : full;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span aria-hidden className="inline-flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Icon name="star" size={size} filled className="absolute inset-0 text-slate-200" />
            {(i <= rounded && !(half && i === full + 1)) && <Icon name="star" size={size} filled className="absolute inset-0 text-amber-500" />}
            {half && i === full + 1 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: size / 2 }}><Icon name="star" size={size} filled className="text-amber-500" /></span>
            )}
          </span>
        ))}
      </span>
      <span className="text-sm text-slate-700">
        {showNumber && <span className="font-semibold tabular-nums">{rating.toFixed(1)}</span>}
        {count !== undefined && <span className="text-slate-500"> ({count})</span>}
      </span>
      <span className="sr-only">{`Rated ${rating.toFixed(1)} out of 5${count !== undefined ? ` from ${count} review${count === 1 ? '' : 's'}` : ''}`}</span>
    </span>
  );
}

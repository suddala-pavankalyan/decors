'use client';
import { useState } from 'react';

export interface Bar { label: string; short: string; value: number; display: string; detail: string }

const W = 720, H = 240, PAD = { l: 8, r: 8, t: 22, b: 26 };
const COLOR = '#c026d3';

/** "Nice" top for the scale: 1, 2, 2.5 or 5 times a power of ten. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}

/**
 * One series of daily bars. Thin bars with rounded tops, quiet grid, the highest bar labelled directly, a tooltip on hover
 * or keyboard focus, and a table view for anyone who prefers numbers (or cannot see the chart).
 */
export default function BarChart({ bars, title, axis }: { bars: Bar[]; title: string; axis: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = niceMax(Math.max(...bars.map((b) => b.value), 0));
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const step = iw / Math.max(bars.length, 1);
  const bw = Math.min(28, Math.max(3, step - 6));
  const x = (i: number) => PAD.l + i * step + (step - bw) / 2;
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const peak = bars.reduce((best, b, i) => (b.value > bars[best].value ? i : best), 0);
  const labelEvery = bars.length <= 10 ? 1 : bars.length <= 31 ? 5 : 15;
  const total = bars.reduce((n, b) => n + b.value, 0);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <button type="button" onClick={() => setTable((t) => !t)} aria-pressed={table} className="text-xs font-medium text-fuchsia-700 hover:underline">
          {table ? 'Show chart' : 'Show as table'}
        </button>
      </div>
      {table ? (
        <div className="max-h-64 overflow-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-3 py-2 font-medium">Day</th><th className="px-3 py-2 text-right font-medium">Value</th></tr></thead>
            <tbody>{bars.map((b) => <tr key={b.label} className="border-t border-slate-100"><td className="px-3 py-1.5">{b.label}</td><td className="px-3 py-1.5 text-right tabular-nums">{b.display}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${bars.length} days, highest ${bars[peak]?.display ?? 'none'} on ${bars[peak]?.label ?? ''}.`} className="h-auto w-full">
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} stroke="#e2e8f0" strokeWidth={1} strokeDasharray={f === 0 ? undefined : '3 4'} />
                {f > 0 && <text x={PAD.l} y={y(max * f) - 4} fontSize={10} fill="#64748b">{axis(max * f)}</text>}
              </g>
            ))}
            {bars.map((b, i) => {
              const h = Math.max(b.value > 0 ? 2 : 0, ih - (y(b.value) - PAD.t));
              const r = Math.min(4, bw / 2, h);
              const top = PAD.t + ih - h;
              return (
                <g key={b.label}>
                  {b.value > 0 && (
                    <path d={`M${x(i)},${PAD.t + ih} V${top + r} Q${x(i)},${top} ${x(i) + r},${top} H${x(i) + bw - r} Q${x(i) + bw},${top} ${x(i) + bw},${top + r} V${PAD.t + ih} Z`}
                      fill={COLOR} opacity={hover === null || hover === i ? 1 : 0.45} />
                  )}
                  {(i % labelEvery === 0 || i === bars.length - 1) && (
                    <text x={x(i) + bw / 2} y={H - 8} fontSize={10} fill="#64748b" textAnchor={i === 0 ? 'start' : i === bars.length - 1 ? 'end' : 'middle'}>{b.short}</text>
                  )}
                  <rect x={PAD.l + i * step} y={PAD.t} width={step} height={ih + 4} fill="transparent" tabIndex={0} role="presentation" aria-hidden
                    onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} data-testid="bar-hit" />
                </g>
              );
            })}
            {bars[peak] && bars[peak].value > 0 && hover === null && (
              <text x={Math.min(Math.max(x(peak) + bw / 2, 40), W - 40)} y={y(bars[peak].value) - 6} fontSize={11} fontWeight={600} fill="#1e293b" textAnchor="middle">{bars[peak].display}</text>
            )}
          </svg>
          {hover !== null && (
            <div role="status" className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
              style={{ left: `${Math.min(88, Math.max(12, ((PAD.l + hover * step + step / 2) / W) * 100))}%`, top: 0 }}>
              <p className="font-semibold">{bars[hover].label}</p>
              <p className="tabular-nums">{bars[hover].detail}</p>
            </div>
          )}
        </div>
      )}
      <p className="mt-1 text-xs text-slate-500">Total {axis(total)} over {bars.length} days.</p>
    </div>
  );
}

import type { OrderEvent, OrderStatus } from '@/lib/account';
import { STEPS, STEP_LABEL, dateTime } from '@/lib/orderStatus';

/** Vertical timeline: finished steps are filled and show when and what happened; later steps are greyed out. */
export default function OrderTimeline({ status, events }: { status: OrderStatus; events: OrderEvent[] }) {
  const current = STEPS.indexOf(status);
  const byStatus = new Map(events.map((e) => [e.status, e]));
  return (
    <ol aria-label="Order progress" className="relative space-y-5">
      {STEPS.map((step, i) => {
        const done = i <= current;
        const ev = byStatus.get(step);
        return (
          <li key={step} className="relative flex gap-3" aria-current={i === current ? 'step' : undefined}>
            {i < STEPS.length - 1 && (
              <span aria-hidden className={`absolute left-[11px] top-6 h-[calc(100%+4px)] w-0.5 ${i < current ? 'bg-spectrum' : 'bg-slate-200'}`} />
            )}
            <span aria-hidden className={`relative mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? 'bg-spectrum text-white' : 'bg-slate-100 text-slate-400'}`}>
              {done ? '✓' : i + 1}
            </span>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${done ? 'text-slate-900' : 'text-slate-400'}`}>{STEP_LABEL[step]}</p>
              {ev && (
                <p className="text-xs text-slate-500">
                  {dateTime(ev.createdAt)}{ev.note && ev.note !== STEP_LABEL[step] ? ` · ${ev.note}` : ''}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

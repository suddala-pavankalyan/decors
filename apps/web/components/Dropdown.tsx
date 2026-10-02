'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from './Icon';

export interface Option { value: string; label: string }

/**
 * Styled replacement for a native <select>, following the ARIA "select-only combobox" pattern:
 * focus stays on the button; arrow keys move the highlighted option; Enter/Space picks it.
 */
export default function Dropdown({
  value, options, onChange, ariaLabel, placeholder, className = '',
}: {
  value: string; options: Option[]; onChange: (v: string) => void;
  ariaLabel: string; placeholder: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const selectedIdx = Math.max(0, options.findIndex((o) => o.value === value));
  const label = value ? options[selectedIdx].label : placeholder;

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const show = () => { setActive(selectedIdx); setOpen(true); };
  const pick = (i: number) => { onChange(options[i].value); setOpen(false); };

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); open ? setActive((a) => Math.min(options.length - 1, a + 1)) : show(); break;
      case 'ArrowUp': e.preventDefault(); open ? setActive((a) => Math.max(0, a - 1)) : show(); break;
      case 'Home': if (open) { e.preventDefault(); setActive(0); } break;
      case 'End': if (open) { e.preventDefault(); setActive(options.length - 1); } break;
      case 'Enter':
      case ' ': e.preventDefault(); open ? pick(active) : show(); break;
      case 'Escape': if (open) { e.preventDefault(); setOpen(false); } break;
      case 'Tab': setOpen(false); break;
    }
  }

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className="flex h-full w-full items-center justify-between gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-left text-sm font-medium shadow-sm outline-none transition hover:border-fuchsia-300 focus-visible:border-fuchsia-400 focus-visible:ring-2 focus-visible:ring-fuchsia-200"
      >
        <span className={`truncate ${value ? 'text-slate-800' : 'text-slate-500'}`}>{label}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="shrink-0 text-slate-500">
          <Icon name="chevron" size={18} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={`${id}-list`}
            role="listbox"
            aria-label={ariaLabel}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 z-50 mt-2 w-max min-w-full origin-top rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl shadow-fuchsia-900/10"
          >
            {options.map((o, i) => (
              <li
                key={o.value || 'default'}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={i === selectedIdx}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => pick(i)}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center justify-between gap-6 rounded-xl px-3 py-2 text-sm ${
                  i === active ? 'bg-fuchsia-50 text-fuchsia-700' : 'text-slate-700'
                } ${i === selectedIdx ? 'font-semibold' : ''}`}
              >
                <span className="whitespace-nowrap">{o.label}</span>
                {i === selectedIdx && <Icon name="check" size={16} />}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth, type User } from '@/lib/auth';
import Icon, { type IconName } from './Icon';

export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-spectrum font-bold text-white shadow-md shadow-fuchsia-500/25"
    >
      {initials(name)}
    </span>
  );
}

const itemClass =
  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 outline-none transition hover:bg-fuchsia-50 hover:text-fuchsia-700 focus-visible:bg-fuchsia-50 focus-visible:text-fuchsia-700';

export default function UserMenu({ user }: { user: User }) {
  const router = useRouter();
  const logout = useAuth((s) => s.logout);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const firstName = user.name.split(' ')[0];

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  function close(returnFocus = false) {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }

  function onMenuKey(e: React.KeyboardEvent) {
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); list[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); list[list.length - 1]?.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') setOpen(false);
  }

  const link = (href: string, icon: IconName, label: string) => (
    <Link href={href} role="menuitem" tabIndex={-1} onClick={() => close()} className={itemClass}>
      <Icon name={icon} size={18} />{label}
    </Link>
  );

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}
        className="flex items-center gap-2 rounded-full p-0.5 pr-2 outline-none transition hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-fuchsia-300 md:pr-3"
      >
        <Avatar name={user.name} />
        <span className="hidden max-w-24 truncate text-sm font-medium text-slate-700 md:inline">{firstName}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="hidden text-slate-500 md:inline"><Icon name="chevron" size={16} /></motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menu}
            role="menu"
            aria-label="Account"
            onKeyDown={onMenuKey}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl shadow-fuchsia-900/10"
          >
            <div className="flex items-center gap-3 px-3 py-3">
              <Avatar name={user.name} size={40} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
                {user.role === 'ADMIN' && (
                  <span className="mt-1 inline-block rounded-full bg-fuchsia-50 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-700">Admin</span>
                )}
              </div>
            </div>
            <div className="my-1 border-t border-slate-100" role="separator" />
            {link('/profile', 'user', 'Your profile')}
            {link('/orders', 'box', 'Your orders')}
            {user.role === 'ADMIN' && link('/admin', 'dashboard', 'Admin')}
            <div className="my-1 border-t border-slate-100" role="separator" />
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={async () => { close(); await logout(); router.push('/'); }}
              className={`${itemClass} text-rose-600 hover:bg-rose-50 hover:text-rose-700 focus-visible:bg-rose-50 focus-visible:text-rose-700`}
            >
              <Icon name="logout" size={18} />Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

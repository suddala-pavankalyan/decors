'use client';
import { useState } from 'react';
import Link from 'next/link';
import Icon, { type IconName } from '@/components/Icon';
import { Avatar } from '@/components/UserMenu';
import { useAuth } from '@/lib/auth';
import { useHydrated, useStore } from '@/lib/store';

const field = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200 disabled:bg-slate-50 disabled:text-slate-500';

function Card({ title, icon, children }: { title: string; icon: IconName; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white/80 p-6 shadow-xl">
      <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold"><Icon name={icon} size={22} />{title}</h2>
      {children}
    </section>
  );
}

function Notice({ error, ok }: { error: string; ok: string }) {
  return (
    <div aria-live="polite">
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
      {ok && !error && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{ok}</p>}
    </div>
  );
}

function NameForm() {
  const { user, updateName } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const unchanged = name.trim() === user?.name;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setOk(''); setBusy(true);
    try {
      await updateName(name.trim());
      setOk('Your name has been updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your name');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium">Full name
        <input className={field} value={name} onChange={(e) => { setName(e.target.value); setOk(''); }} required maxLength={80} autoComplete="name" />
      </label>
      <label className="block text-sm font-medium">Email
        <input className={field} value={user?.email ?? ''} disabled readOnly />
        <span className="mt-1 block text-xs font-normal text-slate-500">Your email is your login, so it can’t be changed here.</span>
      </label>
      <Notice error={error} ok={ok} />
      <button type="submit" disabled={busy || unchanged || !name.trim()}
        className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
        {busy ? 'Saving…' : 'Save name'}
      </button>
    </form>
  );
}

function PasswordForm() {
  const changePassword = useAuth((s) => s.changePassword);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setOk('');
    if (next !== confirm) { setError('The new passwords don’t match.'); return; }
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent(''); setNext(''); setConfirm('');
      setOk('Password updated. You’ve been signed out of your other devices.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium">Current password
        <input className={field} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required maxLength={72} autoComplete="current-password" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">New password
          <input className={field} type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} maxLength={72} autoComplete="new-password" />
          <span className="mt-1 block text-xs font-normal text-slate-500">At least 8 characters.</span>
        </label>
        <label className="block text-sm font-medium">Confirm new password
          <input className={field} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required maxLength={72} autoComplete="new-password" />
        </label>
      </div>
      <Notice error={error} ok={ok} />
      <button type="submit" disabled={busy}
        className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
}

export default function ProfilePage() {
  const { user, ready } = useAuth();
  const hydrated = useHydrated();
  const cartCount = useStore((s) => s.cart.reduce((n, l) => n + l.qty, 0));
  const wishCount = useStore((s) => s.wishlist.length);

  if (!ready) return <main className="p-10 text-center">Loading…</main>;
  if (!user) {
    return (
      <main className="mx-auto max-w-md p-10 text-center">
        <p>Please log in to see your profile.</p>
        <Link href="/login" className="mt-4 inline-block rounded-full bg-spectrum px-6 py-2 font-semibold text-white">Log in</Link>
      </main>
    );
  }

  const since = new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const tiles: { href: string; icon: IconName; label: string; note?: string }[] = [
    { href: '/orders', icon: 'box', label: 'Orders' },
    { href: '/wishlist', icon: 'heart', label: 'Wishlist', note: hydrated ? `${wishCount} saved` : undefined },
    { href: '/cart', icon: 'bag', label: 'Cart', note: hydrated ? `${cartCount} item${cartCount === 1 ? '' : 's'}` : undefined },
    ...(user.role === 'ADMIN' ? [{ href: '/admin', icon: 'dashboard' as IconName, label: 'Admin' }] : []),
  ];

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 pb-16">
      <section className="rounded-3xl border border-orange-100 bg-white p-6 shadow-xl shadow-fuchsia-900/5 sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar name={user.name} size={72} />
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl font-bold">{user.name}</h1>
            <p className="truncate text-slate-500">{user.email}</p>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-fuchsia-50 px-2.5 py-1 font-semibold text-fuchsia-700">{user.role === 'ADMIN' ? 'Admin' : 'Member'}</span>
              <span className="text-slate-500">Member since {since}</span>
            </p>
          </div>
        </div>
      </section>

      <nav aria-label="Shortcuts" className={`grid grid-cols-2 gap-3 ${tiles.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        {tiles.map((t) => (
          <Link key={t.href} href={t.href}
            className="flex flex-col items-start gap-1 rounded-2xl bg-white p-4 shadow transition hover:-translate-y-0.5 hover:shadow-md">
            <Icon name={t.icon} size={24} />
            <span className="font-semibold">{t.label}</span>
            {t.note && <span className="text-xs text-slate-500">{t.note}</span>}
          </Link>
        ))}
      </nav>

      <Card title="Personal details" icon="user"><NameForm /></Card>
      <Card title="Password" icon="lock"><PasswordForm /></Card>
    </main>
  );
}

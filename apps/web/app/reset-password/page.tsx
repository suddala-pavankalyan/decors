'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthCard, BackToLogin, ErrorNote, inputClass, primaryButton } from '@/components/AuthCard';
import Icon from '@/components/Icon';
import { useAuth } from '@/lib/auth';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const resetPassword = useAuth((s) => s.resetPassword);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('The two passwords don’t match.'); return; }
    setBusy(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthCard title="Reset link needed">
        <p className="text-sm text-slate-600">This page needs the link from your reset email. You can ask for a new one.</p>
        <Link href="/forgot-password" className={`${primaryButton} block text-center`}>Request a reset link</Link>
        <BackToLogin />
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated">
        <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
          <Icon name="check" size={20} className="mt-0.5 shrink-0" />
          <p>Your password has been changed and you’ve been signed out everywhere. Log in with your new password.</p>
        </div>
        <Link href="/login" className={`${primaryButton} block text-center`}>Log in</Link>
      </AuthCard>
    );
  }

  const expired = /invalid or has expired/i.test(error);
  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">New password
          <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} maxLength={72} autoComplete="new-password" autoFocus />
          <span className="mt-1 block text-xs font-normal text-slate-500">At least 8 characters.</span>
        </label>
        <label className="block text-sm font-medium">Confirm new password
          <input className={inputClass} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required maxLength={72} autoComplete="new-password" />
        </label>
        {error && <ErrorNote>{error}{expired && <> <Link href="/forgot-password" className="font-semibold underline">Request a new link</Link>.</>}</ErrorNote>}
        <button type="submit" disabled={busy} className={primaryButton}>{busy ? 'Saving…' : 'Update password'}</button>
      </form>
      <BackToLogin />
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<p className="p-10 text-center">Loading…</p>}><ResetForm /></Suspense>;
}

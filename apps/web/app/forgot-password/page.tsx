'use client';
import { useState } from 'react';
import Link from 'next/link';
import { AuthCard, BackToLogin, ErrorNote, inputClass, primaryButton } from '@/components/AuthCard';
import Icon from '@/components/Icon';
import { useAuth } from '@/lib/auth';

export default function ForgotPasswordPage() {
  const forgotPassword = useAuth((s) => s.forgotPassword);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      setSentTo(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <AuthCard title="Check your email">
        <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
          <Icon name="check" size={20} className="mt-0.5 shrink-0" />
          <p>
            If there’s an account for <strong className="break-all">{sentTo}</strong>, we’ve sent a link to choose a new password.
            It works for 1 hour.
          </p>
        </div>
        <p className="text-sm text-slate-500">
          Nothing arrived? Check your spam folder, make sure you typed the address you signed up with, or{' '}
          <button type="button" onClick={() => setSentTo(null)} className="text-fuchsia-600 hover:underline">try again</button>.
        </p>
        <BackToLogin />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Forgot your password?">
      <p className="text-sm text-slate-500">Enter the email you signed up with and we’ll send you a link to choose a new password.</p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">Email
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" autoFocus />
        </label>
        {error && <ErrorNote>{error}</ErrorNote>}
        <button type="submit" disabled={busy} className={primaryButton}>{busy ? 'Sending…' : 'Send reset link'}</button>
      </form>
      <BackToLogin />
    </AuthCard>
  );
}

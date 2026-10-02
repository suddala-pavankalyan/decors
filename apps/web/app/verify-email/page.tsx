'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthCard, ErrorNote, primaryButton } from '@/components/AuthCard';
import Icon from '@/components/Icon';
import { useAuth } from '@/lib/auth';

function Verify() {
  const token = useSearchParams().get('token') ?? '';
  const verifyEmail = useAuth((s) => s.verifyEmail);
  const user = useAuth((s) => s.user);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Confirming takes a click (not just opening the page), so email security scanners that
  // "visit" links in messages can't use up the one-time link.
  async function confirm() {
    setError('');
    setBusy(true);
    try {
      await verifyEmail(token);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthCard title="Confirmation link needed">
        <p className="text-sm text-slate-600">This page needs the link from your confirmation email. If you can’t find it, you can request a new one from your profile.</p>
        <Link href={user ? '/profile' : '/login'} className={`${primaryButton} block text-center`}>{user ? 'Go to my profile' : 'Log in'}</Link>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Email confirmed">
        <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800" role="status">
          <Icon name="check" size={20} className="mt-0.5 shrink-0" />
          <p>Thanks! Your email address is confirmed and you can place orders.</p>
        </div>
        <Link href="/shop" className={`${primaryButton} block text-center`}>Start shopping</Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Confirm your email">
      <p className="text-sm text-slate-600">One last step: press the button to confirm this email address for your Decors account.</p>
      {error && (
        <ErrorNote>
          {error}{' '}
          <Link href={user ? '/profile' : '/login'} className="font-semibold underline">{user ? 'Go to my profile' : 'Log in'}</Link> to ask for a new link.
        </ErrorNote>
      )}
      <button type="button" onClick={confirm} disabled={busy} className={primaryButton}>{busy ? 'Confirming…' : 'Confirm my email'}</button>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={<p className="p-10 text-center">Loading…</p>}><Verify /></Suspense>;
}

'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';

/** "Resend email" button with its own feedback, used wherever we ask someone to confirm their address. */
export default function ResendVerification({ className = '' }: { className?: string }) {
  const resend = useAuth((s) => s.resendVerification);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'already'>('idle');
  const [error, setError] = useState('');

  async function click() {
    setError('');
    setState('sending');
    try {
      setState((await resend()) ? 'sent' : 'already');
    } catch (e) {
      setState('idle');
      setError(e instanceof Error ? e.message : 'Could not send the email');
    }
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      <button type="button" onClick={click} disabled={state === 'sending' || state === 'sent'}
        className="font-semibold underline decoration-dotted underline-offset-2 hover:decoration-solid disabled:no-underline disabled:opacity-60">
        {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Email sent' : 'Resend email'}
      </button>
      <span aria-live="polite" className="text-xs">
        {state === 'sent' && 'Check your inbox (and spam folder).'}
        {state === 'already' && 'Your email is already confirmed. Refresh the page.'}
        {error && <span role="alert" className="text-rose-700">{error}</span>}
      </span>
    </span>
  );
}

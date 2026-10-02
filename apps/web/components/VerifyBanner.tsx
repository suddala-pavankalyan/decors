'use client';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import ResendVerification from './ResendVerification';

/** A slim reminder under the header for signed-in people who haven't confirmed their email yet. */
export default function VerifyBanner() {
  const { user, ready } = useAuth();
  const pathname = usePathname();
  if (!ready || !user || user.emailVerified || pathname.startsWith('/verify-email')) return null;
  return (
    <div role="region" aria-label="Confirm your email" className="border-y border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1">
        <p>
          <strong className="font-semibold">Please confirm your email.</strong>{' '}
          We sent a link to <span className="break-all font-medium">{user.email}</span>. You’ll need it to place orders.
        </p>
        <ResendVerification />
      </div>
    </div>
  );
}

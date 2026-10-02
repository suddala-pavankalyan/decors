'use client';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

/** Client-side convenience only: every admin API call is re-checked on the server. */
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <main className="p-10 text-center">Loading…</main>;
  if (!user) {
    return (
      <main className="p-10 text-center">
        <p>Please log in to continue.</p>
        <Link href="/login" className="mt-3 inline-block text-fuchsia-600 hover:underline">Log in</Link>
      </main>
    );
  }
  if (user.role !== 'ADMIN') {
    return (
      <main className="mx-auto max-w-md p-10 text-center">
        <h1 className="font-display text-2xl font-bold">Admins only</h1>
        <p className="mt-2 text-slate-600">Your account doesn’t have access to this area.</p>
        <Link href="/" className="mt-4 inline-block text-fuchsia-600 hover:underline">Back to the shop</Link>
      </main>
    );
  }
  return <>{children}</>;
}

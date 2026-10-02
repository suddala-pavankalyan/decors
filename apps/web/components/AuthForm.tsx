'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const { login, register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isLogin) await login(email, password);
      else await register(name, email, password);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const input = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 outline-none focus:border-fuchsia-400';

  return (
    <motion.main initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-md px-4 py-10">
      <form onSubmit={submit} className="space-y-4 rounded-3xl bg-white/80 p-8 shadow-xl backdrop-blur">
        <h1 className="text-3xl font-bold">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        {!isLogin && (
          <label className="block text-sm font-medium">Name
            <input className={`${input} mt-1`} value={name} onChange={(e) => setName(e.target.value)}
              required maxLength={80} autoComplete="name" />
          </label>
        )}
        <label className="block text-sm font-medium">Email
          <input className={`${input} mt-1`} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required autoComplete="email" />
        </label>
        <label className="block text-sm font-medium">Password
          <input className={`${input} mt-1`} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required minLength={isLogin ? undefined : 8} maxLength={72}
            autoComplete={isLogin ? 'current-password' : 'new-password'} />
          {!isLogin && <span className="mt-1 block text-xs text-slate-500">At least 8 characters.</span>}
        </label>
        {isLogin && (
          <p className="-mt-2 text-right text-sm">
            <Link href="/forgot-password" className="text-fuchsia-600 hover:underline">Forgot password?</Link>
          </p>
        )}
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
        <motion.button whileTap={{ scale: 0.97 }} disabled={busy} type="submit"
          className="w-full rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-500 py-2.5 font-semibold text-white disabled:opacity-60">
          {busy ? 'Please wait…' : isLogin ? 'Log in' : 'Sign up'}
        </motion.button>
        <p className="text-center text-sm text-slate-500">
          {isLogin ? 'New here? ' : 'Already have an account? '}
          <Link href={isLogin ? '/register' : '/login'} className="text-fuchsia-600 hover:underline">
            {isLogin ? 'Create an account' : 'Log in'}
          </Link>
        </p>
      </form>
    </motion.main>
  );
}

import Link from 'next/link';

/** Shared frame for the small account pages (forgot / reset / verify). */
export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="space-y-4 rounded-3xl bg-white/80 p-8 shadow-xl backdrop-blur">
        <h1 className="text-3xl font-bold">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export const inputClass = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200';
export const primaryButton = 'w-full rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-500 py-2.5 font-semibold text-white disabled:opacity-60';

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">{children}</p>;
}

export function BackToLogin() {
  return (
    <p className="text-center text-sm text-slate-500">
      <Link href="/login" className="text-fuchsia-600 hover:underline">Back to log in</Link>
    </p>
  );
}

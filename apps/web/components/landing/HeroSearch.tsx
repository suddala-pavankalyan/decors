'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';

/** The landing page's search. Pressing Enter (or Search) opens the shop with the results. */
export default function HeroSearch({ suggestions }: { suggestions: string[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = q.trim();
    router.push(text ? `/shop?q=${encodeURIComponent(text)}` : '/shop');
  }

  return (
    <div>
      <form onSubmit={submit} role="search" className="flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1.5 shadow-lg shadow-fuchsia-900/5 focus-within:border-fuchsia-400 focus-within:ring-2 focus-within:ring-fuchsia-200">
        <span className="pl-3 text-slate-400"><Icon name="search" size={22} /></span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search the collection"
          placeholder="Search the collection…"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-base outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        <button type="submit" className="rounded-full bg-spectrum px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/25 transition hover:scale-[1.03]">
          Search
        </button>
      </form>
      {suggestions.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          Popular:
          {suggestions.map((s) => (
            <Link key={s} href={`/shop?q=${encodeURIComponent(s)}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 capitalize text-slate-700 transition hover:border-fuchsia-300 hover:text-fuchsia-700">
              {s}
            </Link>
          ))}
        </p>
      )}
    </div>
  );
}

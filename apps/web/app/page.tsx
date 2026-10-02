import Catalog from '@/components/Catalog';

export default function Home() {
  return (
    <main>
      <header className="relative overflow-hidden px-4 py-16 text-center">
        <div className="absolute -left-10 top-0 h-48 w-48 animate-float rounded-full bg-fuchsia-300/50 blur-2xl" />
        <div className="absolute -right-10 top-10 h-56 w-56 animate-float rounded-full bg-amber-300/50 blur-2xl [animation-delay:2s]" />
        <h1 className="relative font-display text-5xl font-bold sm:text-6xl">
          <span className="bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-500 bg-clip-text text-transparent">
            Decors
          </span>
        </h1>
        <p className="relative mt-3 text-lg text-slate-600">
          Wedding cards · Gift cards · Wall decor · Paints — in every colour.
        </p>
      </header>
      <Catalog />
    </main>
  );
}

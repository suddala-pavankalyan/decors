import Link from 'next/link';

const CHIPS = [
  { label: 'Wedding Cards', from: '#feda75', to: '#fa7e1e', tilt: '-rotate-[14deg] -translate-x-6 translate-y-4' },
  { label: 'Gift Cards', from: '#fa7e1e', to: '#d62976', tilt: '-rotate-[5deg] -translate-x-1' },
  { label: 'Wall Decor', from: '#d62976', to: '#962fbf', tilt: 'rotate-[5deg] translate-x-1' },
  { label: 'Paints', from: '#962fbf', to: '#4f5bd5', tilt: 'rotate-[14deg] translate-x-6 translate-y-4' },
];

export default function Hero() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-8">
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-ink-800 px-6 py-14 text-white shadow-2xl shadow-fuchsia-900/20 sm:px-12 lg:py-20">
        {/* Spectrum glow: four soft colour fields drifting behind the content */}
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="motion-safe-anim absolute -left-24 -top-24 h-96 w-96 animate-drift rounded-full bg-[#d62976]/60 blur-3xl" />
          <div className="motion-safe-anim absolute -right-16 -top-20 h-96 w-96 animate-drift rounded-full bg-[#4f5bd5]/60 blur-3xl [animation-delay:-4s]" />
          <div className="motion-safe-anim absolute -bottom-32 right-1/4 h-96 w-96 animate-drift rounded-full bg-[#fa7e1e]/45 blur-3xl [animation-delay:-8s]" />
          <div className="motion-safe-anim absolute -bottom-28 -left-10 h-80 w-80 animate-drift rounded-full bg-[#962fbf]/55 blur-3xl [animation-delay:-11s]" />
          {/* Fine grid, fading out toward the edges, for the "cloud console" feel */}
          <div
            className="absolute inset-0 opacity-[0.12] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.7) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.7) 1px,transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-medium tracking-wide backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-spectrum" />
              Cards · Gifts · Decor · Paints
            </span>

            <h1 className="mt-6 font-display text-4xl font-bold leading-[1.1] sm:text-5xl xl:text-6xl">
              Make every celebration
              <span className="text-spectrum block pb-1">beautifully colourful</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Wedding invitations, gift cards, wall decor and paints, all in one place. Filter by
              colour, occasion and style to find exactly the look you have in mind.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="#catalog"
                className="rounded-full bg-spectrum px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-900/40 transition hover:scale-[1.03] hover:shadow-fuchsia-700/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Shop the collection
              </Link>
              <Link
                href="/register"
                className="rounded-full border border-white/25 bg-white/5 px-7 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Create an account
              </Link>
            </div>
          </div>

          {/* Paint-chip fan: one chip per category, in spectrum order */}
          <div aria-hidden className="relative mx-auto hidden h-72 w-full max-w-md items-center justify-center lg:flex">
            <div className="flex items-end">
              {CHIPS.map((c) => (
                <div
                  key={c.label}
                  className={`-mx-3 h-56 w-32 shrink-0 rounded-3xl p-3 shadow-2xl shadow-black/40 ring-1 ring-white/30 transition-transform duration-500 hover:-translate-y-3 ${c.tilt}`}
                  style={{ backgroundImage: `linear-gradient(160deg, ${c.from}, ${c.to})` }}
                >
                  <div className="h-24 rounded-2xl bg-white/25 backdrop-blur-sm" />
                  <p className="mt-16 text-sm font-semibold leading-tight drop-shadow">{c.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

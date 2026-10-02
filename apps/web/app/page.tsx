import Link from 'next/link';
import Icon from '@/components/Icon';
import ExhibitCard from '@/components/landing/ExhibitCard';
import HeroSearch from '@/components/landing/HeroSearch';
import Reveal from '@/components/landing/Reveal';
import { fetchOverview, type Overview } from '@/lib/api';

// Always show the current catalog (products change in the admin area).
export const dynamic = 'force-dynamic';

const HALLS = [
  { slug: 'wedding-cards', name: 'Wedding Cards', blurb: 'Invitations that set the tone for the big day.', bg: '#fbbf24', fg: '#451a03' },
  { slug: 'gift-cards', name: 'Gift Cards', blurb: 'Thoughtful gifts for every occasion.', bg: '#fb7185', fg: '#4c0519' },
  { slug: 'wall-decor', name: 'Wall Decor', blurb: 'Statement pieces for every wall.', bg: '#c026d3', fg: '#ffffff' },
  { slug: 'paints', name: 'Paints', blurb: 'Colour for every room.', bg: '#4f46e5', fg: '#ffffff' },
];

const FALLBACK_SUGGESTIONS = ['wedding', 'housewarming', 'boho', 'modern'];

function SectionTitle({ kicker, title, note }: { kicker: string; title: string; note?: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-600">{kicker}</p>
      <h2 className="mt-1 text-3xl font-bold sm:text-4xl">{title}</h2>
      {note && <p className="mt-2 text-slate-500">{note}</p>}
    </div>
  );
}

export default async function Home() {
  // One request, computed in the database. The landing page still works (without live data) if the API is down.
  let overview: Overview | null = null;
  try {
    overview = await fetchOverview();
  } catch {
    /* fall through with empty data */
  }

  const hallData = (slug: string) => overview?.halls.find((h) => h.category === slug);
  const featured = overview?.featured ?? [];
  const suggestions = overview?.popularTags.length ? overview.popularTags : FALLBACK_SUGGESTIONS;
  const colors = overview?.colors ?? [];
  const tags = overview?.tags ?? [];

  return (
    <main className="pb-20">
      {/* ── Entrance ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4">
        <div className="grid grid-cols-1 items-center gap-10 rounded-[2rem] border border-orange-100 bg-white px-6 py-12 shadow-xl shadow-fuchsia-900/5 sm:px-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:py-16">
          <div>
            <span className="inline-block rounded-full bg-fuchsia-50 px-3.5 py-1.5 text-xs font-semibold text-fuchsia-700">
              The Decors exhibition · Cards · Gifts · Decor · Paints
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] sm:text-5xl xl:text-6xl">
              Step into a world of <span className="text-spectrum">colour</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-500">
              Wander through our halls of wedding cards, gift cards, wall decor and paints, or search for exactly what you have in mind.
            </p>
            <div className="mt-7 max-w-xl"><HeroSearch suggestions={suggestions} /></div>
          </div>

          {/* The four halls as a fan of colour chips */}
          <div className="hidden h-72 items-center justify-center lg:flex" aria-label="The four halls">
            <div className="flex items-end">
              {HALLS.map((h, i) => (
                <Link key={h.slug} href={`/shop?categories=${h.slug}`} aria-label={h.name}
                  className="-mx-1 flex h-52 w-32 shrink-0 flex-col justify-end rounded-3xl p-3 text-sm font-bold shadow-xl shadow-slate-900/15 transition-transform duration-300 hover:-translate-y-3"
                  style={{
                    background: h.bg, color: h.fg,
                    transform: `rotate(${[-12, -4, 4, 12][i]}deg) translateY(${i === 0 || i === 3 ? 14 : 0}px)`,
                  }}>
                  <span className="mb-auto h-24 rounded-2xl bg-white/35" />
                  {h.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── The halls ────────────────────────────────────────────── */}
      <section className="mx-auto mt-20 max-w-7xl px-4" aria-labelledby="halls">
        <Reveal>
          <div id="halls"><SectionTitle kicker="The halls" title="Four halls, one world of colour" note="Pick a hall to walk in, or keep scrolling to see what is on show." /></div>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {HALLS.map((h, i) => {
            const hall = hallData(h.slug);
            const swatches = hall?.colors ?? [];
            return (
              <Reveal key={h.slug} delay={i * 0.08}>
                <Link href={`/shop?categories=${h.slug}`}
                  className="group flex h-full min-h-64 flex-col rounded-3xl p-6 shadow-lg shadow-slate-900/10 transition duration-300 hover:-translate-y-1.5 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-500"
                  style={{ background: h.bg, color: h.fg }}>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">Hall {String(i + 1).padStart(2, '0')}</span>
                  <h3 className="mt-2 text-2xl font-bold">{h.name}</h3>
                  <p className="mt-1 text-sm opacity-90">{h.blurb}</p>
                  <div className="mt-auto pt-6">
                    {swatches.length > 0 && (
                      <div className="mb-3 flex -space-x-1.5" aria-hidden>
                        {swatches.map((c) => <span key={c} className="h-6 w-6 rounded-full ring-2 ring-white/80" style={{ background: c }} />)}
                      </div>
                    )}
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                      {hall ? `${hall.count} piece${hall.count === 1 ? '' : 's'} · ` : ''}Enter the hall
                      <Icon name="back" size={16} className="rotate-180 transition group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── Now showing ──────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="mx-auto mt-24 max-w-7xl px-4" aria-labelledby="showing">
          <Reveal>
            <div id="showing"><SectionTitle kicker="Now showing" title="Visitors’ favourites" note="Our highest-rated pieces, hung together for a closer look." /></div>
          </Reveal>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((p, i) => (
              <Reveal key={p.id} delay={(i % 3) * 0.08}><ExhibitCard p={p} index={i} /></Reveal>
            ))}
          </div>
          <Reveal className="mt-10 text-center">
            <Link href="/shop" className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold transition hover:border-fuchsia-400 hover:text-fuchsia-700">
              See the whole collection<Icon name="back" size={16} className="rotate-180" />
            </Link>
          </Reveal>
        </section>
      )}

      {/* ── Colour wall ──────────────────────────────────────────── */}
      {colors.length > 0 && (
        <section className="mx-auto mt-24 max-w-7xl px-4" aria-labelledby="colours">
          <Reveal>
            <div id="colours"><SectionTitle kicker="The colour wall" title="Start from a colour" note="Choose a shade and see everything that comes in it." /></div>
          </Reveal>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
            {colors.map((c, i) => (
              <Reveal key={c.name} delay={(i % 8) * 0.04}>
                <Link href={`/shop?colors=${encodeURIComponent(c.name)}`}
                  className="group relative block h-36 overflow-hidden rounded-2xl shadow-md shadow-slate-900/10 outline-none transition duration-300 hover:-translate-y-1.5 hover:rotate-1 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-fuchsia-500 focus-visible:ring-offset-2"
                  style={{ background: c.hex }}>
                  <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-800">{c.name}</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* ── Occasions ────────────────────────────────────────────── */}
      {tags.length > 0 && (
        <section className="mx-auto mt-24 max-w-7xl px-4" aria-labelledby="occasions">
          <Reveal>
            <div id="occasions"><SectionTitle kicker="By occasion & style" title="What are you celebrating?" /></div>
            <div className="flex flex-wrap gap-3">
              {tags.map((t) => (
                <Link key={t} href={`/shop?tags=${encodeURIComponent(t)}`}
                  className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium capitalize shadow-sm transition hover:-translate-y-0.5 hover:border-fuchsia-300 hover:text-fuchsia-700 hover:shadow-md">
                  {t}
                </Link>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      {/* ── Exit ─────────────────────────────────────────────────── */}
      <section className="mx-auto mt-24 max-w-7xl px-4">
        <Reveal>
          <div className="rounded-[2rem] border border-orange-100 bg-white px-6 py-12 text-center shadow-xl shadow-fuchsia-900/5">
            <h2 className="text-3xl font-bold sm:text-4xl">Found something you love?</h2>
            <p className="mx-auto mt-2 max-w-lg text-slate-500">Browse the full collection and narrow it down by colour, price, occasion and style.</p>
            <Link href="/shop" className="mt-6 inline-block rounded-full bg-spectrum px-8 py-3 font-semibold text-white shadow-md shadow-fuchsia-500/25 transition hover:scale-105">
              Browse the collection
            </Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}

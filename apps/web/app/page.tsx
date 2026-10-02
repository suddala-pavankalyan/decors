import Catalog from '@/components/Catalog';
import Hero from '@/components/Hero';

export default function Home() {
  return (
    <main>
      <Hero />
      <div id="catalog" className="scroll-mt-4">
        <Catalog />
      </div>
    </main>
  );
}

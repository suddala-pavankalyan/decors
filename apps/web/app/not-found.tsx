import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="p-16 text-center">
      <h1 className="font-display text-3xl font-bold">We couldn’t find that page</h1>
      <Link href="/shop" className="mt-4 inline-block text-fuchsia-600 hover:underline">Back to the collection</Link>
    </main>
  );
}

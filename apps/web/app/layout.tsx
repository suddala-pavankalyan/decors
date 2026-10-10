import './globals.css';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import Header from '@/components/Header';
import VerifyBanner from '@/components/VerifyBanner';

// One typeface for the whole site: Figtree, a clean geometric sans in the spirit of Google's product pages.
// The rupee sign lives in the Latin Extended file, so that is a second font; the browser picks per character.
// If either fails to load, the visitor's own system UI font steps in.
const figtree = localFont({
  src: './fonts/Figtree-Latin.woff2',
  weight: '300 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-figtree',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
  adjustFontFallback: 'Arial',
});
const figtreeExt = localFont({
  src: './fonts/Figtree-LatinExt.woff2',
  weight: '300 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-figtree-ext',
  preload: false,
});

export const metadata: Metadata = {
  title: 'Decors — Cards, Gifts, Wall Decor & Paints',
  description: 'Wedding cards, gift cards, wall decor and paints in every colour.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${figtreeExt.variable}`}>
      <body className="font-sans antialiased">
        <Header />
        <VerifyBanner />
        {children}
      </body>
    </html>
  );
}

import './globals.css';
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import Header from '@/components/Header';
import VerifyBanner from '@/components/VerifyBanner';

// One typeface for the whole site: Inter. If it ever fails to load, the visitor's own system UI font
// (Segoe UI on Windows, San Francisco on Apple devices, Roboto on Android) steps in, then plain sans-serif.
// Next.js also generates a size-matched fallback so the page does not jump when Inter arrives.
const inter = localFont({
  src: './fonts/Inter-Variable.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-inter',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
  adjustFontFallback: 'Arial',
});

export const metadata: Metadata = {
  title: 'Decors — Cards, Gifts, Wall Decor & Paints',
  description: 'Wedding cards, gift cards, wall decor and paints in every colour.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <Header />
        <VerifyBanner />
        {children}
      </body>
    </html>
  );
}

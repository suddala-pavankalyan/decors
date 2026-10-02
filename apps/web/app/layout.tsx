import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Decors — Cards, Gifts, Wall Decor & Paints',
  description: 'Wedding cards, gift cards, wall decor and paints in every colour.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

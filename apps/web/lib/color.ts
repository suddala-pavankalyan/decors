/** Relative luminance (0 dark … 1 light) of a #rrggbb colour. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Mixes `hex` towards black (amount < 0) or white (amount > 0); amount is -1 … 1. */
export function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const to = amount < 0 ? 0 : 255;
  const k = Math.abs(amount);
  const out = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16);
    return Math.round(c + (to - c) * k).toString(16).padStart(2, '0');
  });
  return `#${out.join('')}`;
}

/** Ink colour that stays readable on `hex`. */
export const inkOn = (hex: string) => (luminance(hex) > 0.45 ? '#3b2a1a' : '#fffaf0');

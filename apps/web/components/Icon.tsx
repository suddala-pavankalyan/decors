import type { SVGProps } from 'react';

/**
 * Decors icon set.
 *
 * Signature look: a rounded outline with a soft brand-tinted shape sitting slightly off-register
 * behind it (like a misaligned print). The outline uses currentColor, so icons follow text colour;
 * the tint defaults to Decors fuchsia and can be overridden with `tint`.
 *
 * - `shape`: closed path used for the offset tint (and for the fill when `filled`)
 * - `lines`: extra strokes drawn on top
 */
interface Def { shape?: string; lines?: string[] }

const ICONS = {
  heart: {
    shape: 'M12 19.6s-7.3-4.4-7.3-9.9A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.3 2.5c0 5.5-7.3 9.9-7.3 9.9z',
  },
  bag: {
    shape: 'M5.2 8.4h13.6l-.9 10.6a1.6 1.6 0 0 1-1.6 1.5H7.7a1.6 1.6 0 0 1-1.6-1.5z',
    lines: ['M9 8.4V7.2a3 3 0 0 1 6 0v1.2'],
  },
  star: {
    shape: 'M12 3.9l2.4 5 5.5.8-4 3.9.9 5.5L12 16.4l-4.8 2.6.9-5.5-4-3.9 5.5-.8z',
  },
  check: { lines: ['M5.5 12.8l4.2 4.2L18.5 7.8'] },
  clock: {
    shape: 'M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z',
    lines: ['M12 8v4.2l2.8 1.8'],
  },
  sparkle: {
    shape: 'M11 3.6c.6 4.3 2 5.7 6.3 6.3-4.3.6-5.7 2-6.3 6.3-.6-4.3-2-5.7-6.3-6.3 4.3-.6 5.7-2 6.3-6.3z',
    lines: ['M18 15.2c.2 1.6.8 2.2 2.4 2.4-1.6.2-2.2.8-2.4 2.4-.2-1.6-.8-2.2-2.4-2.4 1.6-.2 2.2-.8 2.4-2.4z'],
  },
  user: {
    shape: 'M12 4.4a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4z',
    lines: ['M4.8 19.8c.7-3.6 3.5-5.4 7.2-5.4s6.5 1.8 7.2 5.4'],
  },
  box: {
    shape: 'M12 3.7l7.6 3.8v9L12 20.3l-7.6-3.8v-9z',
    lines: ['M4.4 7.5L12 11.3l7.6-3.8', 'M12 11.3v9'],
  },
  back: { lines: ['M19 12H5.5', 'M11.2 6.2L5.5 12l5.7 5.8'] },
  plus: { lines: ['M12 5.8v12.4', 'M5.8 12h12.4'] },
  minus: { lines: ['M5.8 12h12.4'] },
  chevron: { lines: ['M6.5 9.5l5.5 5.5 5.5-5.5'] },
  search: {
    shape: 'M10.8 4.6a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4z',
    lines: ['M15.4 15.6L19.8 20'],
  },
  close: { lines: ['M6.8 6.8l10.4 10.4', 'M17.2 6.8L6.8 17.2'] },
} satisfies Record<string, Def>;

export type IconName = keyof typeof ICONS;

interface Props extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** Colour of the off-register tint layer */
  tint?: string;
  /** Solid version (e.g. a saved heart, a rating star) */
  filled?: boolean;
  /** Accessible name; leave out when the icon sits next to a text label */
  label?: string;
}

export default function Icon({ name, size = 20, filled = false, tint = '#e879f9', label, className, ...rest }: Props) {
  const def: Def = ICONS[name];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      {def.shape && !filled && (
        <path d={def.shape} fill={tint} opacity={0.5} transform="translate(1.6 1.6)" />
      )}
      {def.shape && (
        <path
          d={def.shape}
          fill={filled ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {def.lines?.map((d) => (
        <path
          key={d}
          d={d}
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

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
  dashboard: {
    shape: 'M4.5 4.5h6v6h-6z',
    lines: ['M13.5 4.5h6v6h-6z', 'M4.5 13.5h6v6h-6z', 'M13.5 13.5h6v6h-6z'],
  },
  trash: { lines: ['M5 7h14', 'M10 7V5h4v2', 'M7 7l.8 12h8.4L17 7', 'M10.5 11v5', 'M13.5 11v5'] },
  edit: {
    shape: 'M5 19l.9-3.9L15.8 5.2a1.9 1.9 0 0 1 2.7 0l.3.3a1.9 1.9 0 0 1 0 2.7L8.9 18.1z',
    lines: ['M13.8 7.2l3 3'],
  },
  logout: { lines: ['M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10', 'M14 8l4 4-4 4', 'M18 12H9.5'] },
  lock: {
    shape: 'M6 11h12v8.5H6z',
    lines: ['M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11'],
  },
  upload: {
    lines: ['M12 15.5V5', 'M7.5 9.2L12 4.7l4.5 4.5', 'M5 15v3.2a1.3 1.3 0 0 0 1.3 1.3h11.4a1.3 1.3 0 0 0 1.3-1.3V15'],
  },
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

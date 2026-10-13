import { useId, type SVGProps } from 'react';

/** 24×24 stroke icons. Dots use zero-length segments drawn with a wider stroke. */
const PATHS = {
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  reload: 'M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7',
  reset: 'M4 11a8 8 0 1 1 2.34 5.66M4 4v7h7',
  rotate: 'M20 10V7a2 2 0 0 0-2-2h-6M15 2l-3 3 3 3M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M4 10V7a2 2 0 0 1 2-2h1',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  window: 'M3 5h18v14H3zM3 9h18',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  fit: 'M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4',
  wrap: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4z',
  row: 'M3 5h5v14H3zM10 5h5v14h-5zM17 5h4v14h-4',
  sun: 'M12 4V2M12 22v-2M4.93 4.93 3.52 3.52M20.48 20.48l-1.41-1.41M4 12H2M22 12h-2M4.93 19.07l-1.41 1.41M20.48 3.52l-1.41 1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  system: 'M3 5h18v11H3zM8 20h8M12 16v4',
  shield: 'M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z',
  shieldCheck: 'M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6zM9 12l2 2 4-4',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  globe:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  pencil: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  tablet: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  laptop: 'M5 5h14v10H5zM2 19h20',
  desktop: 'M3 4h18v12H3zM8 20h8M12 16v4',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  camera:
    'M4 8a2 2 0 0 1 2-2h1.5l1.5-2h6l1.5 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM15.5 12.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01',
  eye: 'M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  eyeOff:
    'M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.6 3.5M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 19 12 19c1.8 0 3.3-.6 4.6-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2',
  ruler: 'M3 15.5 15.5 3l5.5 5.5L8.5 21zM7 11.5l2 2M10 8.5l2 2M13 5.5l2 2',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  save: 'M6 4h12v16l-6-4-6 4zM12 8v5M9.5 10.5h5',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
} as const;

/** Icons made of dots need a wider stroke to read as dots. */
const DOT_ICONS = new Set<IconName>(['more', 'grip']);

export type IconName = keyof typeof PATHS;

type Props = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

export function Icon({ name, size = 16, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={DOT_ICONS.has(name) ? 3.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/**
 * Product mark, matching the extension icon: a "B" made of a narrow block over a
 * wide one, and an amber breakpoint tag pointing where the narrow layout ends.
 */
export function Logo({ size = 24 }: { size?: number }) {
  const gradientId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="128" y2="128">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#4338CA" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="28" fill={`url(#${gradientId})`} />
      <path
        d="M24 28h28a16 16 0 0 1 0 32H24zM24 60h38a20 20 0 0 1 0 40H24z"
        fill="none"
        stroke="#fff"
        strokeWidth="11"
        strokeLinejoin="round"
      />
      <path d="M107 30H89l-11 14 11 14h18z" fill="#FBBF24" stroke="#FBBF24" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}

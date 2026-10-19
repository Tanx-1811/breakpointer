import { useId, type SVGProps } from 'react';

/** 24×24 stroke icons. Dots use zero-length segments drawn with a wider stroke. */
const PATHS = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  reload: 'M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7',
  reset: 'M4 11a8 8 0 1 1 2.34 5.66M4 4v7h7',
  rotate: 'M20 10V7a2 2 0 0 0-2-2h-6M15 2l-3 3 3 3M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M4 10V7a2 2 0 0 1 2-2h1',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  window: 'M3 5h18v14H3zM3 9h18',
  chevronLeft: 'M15 6l-6 6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp: 'M6 15l6-6 6 6',
  arrowLeft: 'M19 12H5M11 18l-6-6 6-6',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  fit: 'M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4',
  maximize: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
  minimize: 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7',
  wrap: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4z',
  row: 'M3 5h5v14H3zM10 5h5v14h-5zM17 5h4v14h-4',
  sun: 'M12 4V2M12 22v-2M4.93 4.93 3.52 3.52M20.48 20.48l-1.41-1.41M4 12H2M22 12h-2M4.93 19.07l-1.41 1.41M20.48 3.52l-1.41 1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  system: 'M3 5h18v11H3zM8 20h8M12 16v4',
  contrast: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  shield: 'M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z',
  shieldCheck: 'M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6zM9 12l2 2 4-4',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  globe:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  pencil: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  foldable: 'M5 4h6v16H5zM13 4h6v16h-6zM11 8h2M11 16h2',
  tablet: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  laptop: 'M5 5h14v10H5zM2 19h20',
  desktop: 'M3 4h18v12H3zM8 20h8M12 16v4',
  camera:
    'M4 8a2 2 0 0 1 2-2h1.5l1.5-2h6l1.5 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM15.5 12.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z',
  image: 'M4 5h16v14H4zM4 16l4.5-4.5 3.5 3.5 2.5-2.5L20 18M15.5 9.5h.01',
  gallery: 'M8 4h12v12H8zM4 8v12h12M8 13l3-3 3 3 2-2 4 4',
  clipboard: 'M9 3.5h6v3H9zM9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3',
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
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  columns: 'M4 4h4v16H4zM10 4h4v16h-4zM16 4h4v16h-4z',
  tools: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
  report: 'M6 3h9l5 5v13H6zM15 3v5h5M9 13h7M9 17h7',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  outline: 'M4 4h4M12 4h4M20 4v4M20 12v4M20 20h-4M12 20H8M4 20v-4M4 12V8',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  command: 'M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3z',
  inspect: 'M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M4 15v4a1 1 0 0 0 1 1h4M12 12l8 3.2-3.4 1.4L15.2 20z',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10',
  sort: 'M4 6h5M4 12h10M4 18h16',
  swap: 'M7 16V4M3 8l4-4 4 4M17 8v12M21 16l-4 4-4-4',
  panel: 'M3 5h18v14H3zM15 5v14',
  tag: 'M3 7.5A1.5 1.5 0 0 1 4.5 6H15l5 6-5 6H4.5A1.5 1.5 0 0 1 3 16.5z',
  resize: 'M21 15l-6 6M21 9L9 21',
  measure: 'M4 12h16M4 8v8M20 8v8M7 12l2.5-2.5M7 12l2.5 2.5M17 12l-2.5-2.5M17 12l-2.5 2.5',
  eyedropper: 'M14.5 6.5l3-3a2.1 2.1 0 0 1 3 3l-3 3M13 5l6 6M16 8l-9.5 9.5L4 20l2.5-2.5',
  beaker: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3M7.4 15h9.2',
  split: 'M3 5h18v14H3zM12 5v14M6 9h3M15 9h3',
  overlay: 'M4 4h11v11H4zM9 9h11v11H9z',
  pip: 'M3 5h18v14H3zM12 11h7v6h-7z',
  pause: 'M9 5v14M15 5v14',
  text: 'M5 7V5h14v2M12 5v14M9 19h6',
  palette: 'M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3.5 3H16a2 2 0 0 0-1.5 3.3c.6.7.2 2.7-2.5 2.7z',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  /** A list of pages (Check pages). */
  pages: 'M9 6h11M9 12h11M9 18h11M4.5 5.5v1M4.5 11.5v1M4.5 17.5v1',
  /** A laptop and a phone (Showcase image). */
  devices: 'M3.5 5h11v8.5h-11zM1.5 17h15M18 8.5h4v11h-4z',
  /** A message (Send feedback). */
  message: 'M4 5h16v11H9l-5 4z',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z',
} as const;

/** Icons made of dots need a wider stroke to read as dots. */
const DOT_ICONS = new Set<IconName>(['more', 'grip']);

/** Icons that mix lines with dots: the dots get a second, wider stroke. */
const DOTS: Partial<Record<IconName, string>> = {
  palette: 'M7.5 11.5h.01M10 7.5h.01M15 7.5h.01',
};

/** Solid shapes drawn on top of the stroke (e.g. the dark half of "contrast"). */
const FILLS: Partial<Record<IconName, string>> = {
  contrast: 'M12 3a9 9 0 0 1 0 18z',
};

export type IconName = keyof typeof PATHS;

type Props = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

export function Icon({ name, size = 16, ...rest }: Props) {
  const fill = FILLS[name];
  const dots = DOTS[name];
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
      {dots && <path d={dots} strokeWidth={3} />}
      {fill && <path d={fill} fill="currentColor" stroke="none" />}
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

// Shared building blocks for every Breakpointer brand image.
// Everything here is plain strings (SVG / HTML / CSS) so the templates stay
// self-contained: no network, no external files, only fonts installed with macOS.

export const PALETTE = {
  // Mark gradient
  indigo500: '#6366F1',
  indigo700: '#4338CA',
  // UI accent
  accent: '#4F46E5',
  accentDark: '#8B93FF',
  // Brand night (promo backgrounds)
  night: '#100E2E',
  indigo950: '#1E1B4B',
  indigo900: '#312E81',
  indigo300: '#A5B4FC',
  indigo200: '#C7D2FE',
  indigo100: '#E0E7FF',
  // Breakpoint amber: only for the breakpoint marker (mark, size pills, guides).
  breakpoint: '#FBBF24',
  // Neutrals (match src/styles/global.css)
  ink: '#171A1F',
  muted: '#59626F',
  subtle: '#687180',
  border: '#E1E4E9',
  canvas: '#ECEEF2',
  bg: '#F4F5F7',
  white: '#FFFFFF',
  darkBg: '#0F1114',
  darkSurface: '#171A1F',
  darkText: '#E7E9EC',
};

export const FONTS = {
  // Wordmark and display headlines. Avenir Next ships with macOS.
  display: "'Avenir Next', Avenir, 'Segoe UI', system-ui, sans-serif",
  // Body copy: the platform UI font, same as the extension UI.
  text: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
};

export const NAME = 'Breakpointer';
export const DESCRIPTOR = 'Responsive Viewport Tester';

/** Primary tagline (the name's promise) and the secondary line (how it delivers it). */
export const TAGLINE = {
  en: 'Find where your layout breaks.',
  vi: 'Tìm chỗ bố cục bị vỡ, ở mọi kích thước.',
};
export const SECONDARY = {
  en: 'See every screen size at once.',
  vi: 'Xem mọi kích thước màn hình cùng lúc.',
};

/** Marketing copy per language. Keep claims honest: viewport sizes, not device emulation. */
export const COPY = {
  en: {
    tagline: TAGLINE.en,
    taglineTwoLines: 'Find where your<br>layout breaks.',
    // For the 440 px tile, where space is tight.
    taglineShort: TAGLINE.en,
    secondary: SECONDARY.en,
    // Same idea with a phrase-aware line break, for two-line layouts.
    pitchTwoLines: 'See every screen size at once —<br>side by side, right in Chrome.',
    chips: ['Side-by-side previews', 'Custom sizes', 'Saved groups'],
  },
  vi: {
    tagline: TAGLINE.vi,
    taglineTwoLines: 'Tìm chỗ bố cục bị vỡ,<br>ở mọi kích thước.',
    taglineShort: 'Tìm chỗ bố cục bị vỡ.',
    secondary: SECONDARY.vi,
    pitchTwoLines: 'Xem mọi kích thước màn hình cùng lúc —<br>đặt cạnh nhau, ngay trong Chrome.',
    chips: ['Xem song song', 'Kích thước tùy chỉnh', 'Lưu nhóm viewport'],
  },
};

export const SHORT_DESCRIPTION =
  'Preview websites at multiple viewport sizes and check responsive layouts directly in Chrome.';

/* ------------------------------------------------------------------ */
/* Mark                                                                */
/* ------------------------------------------------------------------ */

// Geometry of the mark on a 128 × 128 grid (identical to assets/icon.svg).
// A "B" built from two width blocks — a narrow layout over a wide one — and an
// amber breakpoint tag pointing at the spot where the narrow layout ends.
const B_BLOCKS = 'M24 28h28a16 16 0 0 1 0 32H24zM24 60h38a20 20 0 0 1 0 40H24z';
const B_STROKE = 11;
const TAG = 'M107 30H89l-11 14 11 14h18z';

function markShapes(gradientId) {
  return `<rect width="128" height="128" rx="28" fill="url(#${gradientId})"/>
  <path d="${B_BLOCKS}" fill="none" stroke="#FFFFFF" stroke-width="${B_STROKE}" stroke-linejoin="round"/>
  <path d="${TAG}" fill="${PALETTE.breakpoint}" stroke="${PALETTE.breakpoint}" stroke-width="4" stroke-linejoin="round"/>`;
}

function markGradient(id) {
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="128" y2="128">
      <stop offset="0" stop-color="${PALETTE.indigo500}"/>
      <stop offset="1" stop-color="${PALETTE.indigo700}"/>
    </linearGradient>`;
}

/** Full-colour mark. `id` keeps gradient ids unique when several marks share a document. */
export function markSvg({ id = 'bp-mark', title = NAME } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${title}">
  <title>${title}</title>
  <defs>
    ${markGradient(id)}
  </defs>
  ${markShapes(id)}
</svg>
`;
}

/**
 * Single-colour mark: the tile is solid `color` and the B and the tag are cut
 * out (transparent), so it works on photos and coloured backgrounds.
 */
export function markMonoSvg({ color, id = 'bp-mark-mono', title = NAME }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${title}">
  <title>${title}</title>
  <defs>
    <mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="128" height="128">
      <rect width="128" height="128" rx="28" fill="#FFFFFF"/>
      <path d="${B_BLOCKS}" fill="none" stroke="#000000" stroke-width="${B_STROKE}" stroke-linejoin="round"/>
      <path d="${TAG}" fill="#000000" stroke="#000000" stroke-width="4" stroke-linejoin="round"/>
    </mask>
  </defs>
  <rect width="128" height="128" rx="28" fill="${color}" mask="url(#${id})"/>
</svg>
`;
}

/* ------------------------------------------------------------------ */
/* Lockup (mark + wordmark)                                            */
/* ------------------------------------------------------------------ */

// Proportions on a 128-unit mark: wordmark size 0.625 × mark, gap 0.27 × mark.
export const LOCKUP = { markSize: 128, gap: 35, fontSize: 80, baseline: 92, letterSpacing: -0.6 };

// "Break" takes the text colour, "pointer" the accent.
export const LOCKUP_COLORS = {
  light: { first: PALETTE.ink, second: PALETTE.accent },
  dark: { first: PALETTE.white, second: PALETTE.accentDark },
  // Used on the deep-indigo promo backgrounds, where the UI accent lacks contrast.
  indigo: { first: PALETTE.white, second: PALETTE.indigo300 },
};

/**
 * Source SVG for a horizontal lockup, using live text. scripts/brand/render.mjs
 * converts the text to outlines so the published SVGs need no fonts.
 */
export function lockupSourceSvg({ variant, width = 1000 }) {
  const colors = LOCKUP_COLORS[variant];
  const { markSize, gap, fontSize, baseline, letterSpacing } = LOCKUP;
  const id = `bp-lockup-${variant}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${markSize}" viewBox="0 0 ${width} ${markSize}">
  <defs>
    ${markGradient(id)}
  </defs>
  ${markShapes(id)}
  <text x="${markSize + gap}" y="${baseline}" font-family="Avenir Next" font-weight="600" font-size="${fontSize}" letter-spacing="${letterSpacing}" fill="${colors.first}">Break<tspan fill="${colors.second}">pointer</tspan></text>
</svg>
`;
}

/** Inline an SVG string as an <img> source without id collisions. */
export function svgDataUri(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/* ------------------------------------------------------------------ */
/* Responsive sample page inside generic device frames                 */
/* ------------------------------------------------------------------ */

/**
 * One sample web page, laid out with container queries so the exact same
 * markup becomes a 3-column desktop page, a 2-column tablet page and a stacked
 * phone page, depending only on the width it is given. That is the product's
 * promise: the page sees a real viewport width; the frame just scales it.
 */
const SITE_MARKUP = `
<div class="site">
  <header class="nav">
    <span class="nav-logo"></span><span class="nav-brand"></span>
    <span class="nav-links"><i></i><i></i><i></i><i></i></span>
    <span class="nav-cta"></span>
    <span class="nav-burger"><i></i><i></i><i></i></span>
  </header>
  <section class="hero">
    <div class="copy">
      <span class="kicker"></span>
      <span class="h1"></span><span class="h1 short"></span>
      <span class="para"></span><span class="para short"></span>
      <span class="btns"><b></b><b class="ghost"></b></span>
    </div>
    <div class="art"><span class="orb a"></span><span class="orb b"></span><span class="panel"></span></div>
  </section>
  <section class="cards">
    ${[1, 2, 3, 4]
      .map(
        (n) =>
          `<article class="card"><div class="thumb t${n}"></div><span class="ct"></span><span class="cp"></span><span class="cp short"></span></article>`,
      )
      .join('')}
  </section>
</div>`;

export const SITE_CSS = `
.screen { position: absolute; left: 0; top: 0; transform-origin: 0 0; container-type: inline-size; background: #fff; overflow: hidden; }
.site { width: 100%; height: 100%; font-family: ${FONTS.text}; }
.site i, .site b, .site span { display: block; }

.nav { display: flex; align-items: center; gap: 14px; height: 76px; padding: 0 64px; border-bottom: 2px solid #EEF0F4; }
.nav-logo { width: 30px; height: 30px; border-radius: 9px; background: linear-gradient(135deg, ${PALETTE.indigo500}, ${PALETTE.indigo700}); flex: none; }
.nav-brand { width: 112px; height: 14px; border-radius: 7px; background: #1F2430; }
.nav-links { display: flex !important; gap: 30px; margin-left: auto; }
.nav-links i { width: 64px; height: 11px; border-radius: 6px; background: #C9CED6; }
.nav-cta { width: 124px; height: 40px; border-radius: 11px; background: ${PALETTE.accent}; margin-left: 18px; }
.nav-burger { display: none !important; margin-left: auto; }
.nav-burger i { width: 30px; height: 4px; border-radius: 2px; background: #1F2430; margin: 6px 0; }

.hero { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 56px; align-items: center; padding: 60px 64px 44px; }
.copy { display: flex; flex-direction: column; gap: 16px; }
.kicker { width: 132px; height: 24px; border-radius: 12px; background: #EEF0FF; }
.h1 { height: 42px; width: 94%; border-radius: 11px; background: #171A1F; }
.h1.short { width: 66%; }
.para { height: 13px; width: 90%; border-radius: 7px; background: #D5D9E0; }
.para.short { width: 72%; }
.btns { display: flex !important; gap: 14px; margin-top: 10px; }
.btns b { width: 156px; height: 48px; border-radius: 12px; background: ${PALETTE.accent}; }
.btns b.ghost { background: #fff; box-shadow: inset 0 0 0 2px #C9CED6; }

.art { position: relative; aspect-ratio: 16 / 10; border-radius: 22px; overflow: hidden;
  background: linear-gradient(135deg, #818CF8 0%, #6366F1 38%, #4338CA 72%, #312E81 100%); }
.orb { position: absolute; border-radius: 50%; }
.orb.a { width: 46%; aspect-ratio: 1; right: -8%; top: -14%; background: radial-gradient(circle at 35% 35%, #C7D2FE, #818CF8 60%, transparent 61%); opacity: .9; }
.orb.b { width: 30%; aspect-ratio: 1; left: 10%; bottom: -10%; background: radial-gradient(circle at 40% 40%, #FDE68A, #F59E0B 62%, transparent 63%); }
.panel { position: absolute; left: 12%; top: 18%; width: 42%; height: 40%; border-radius: 14px; background: rgba(255,255,255,.88); box-shadow: 0 18px 30px rgba(17, 12, 60, .28); }

.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; padding: 6px 64px 64px; }
.card { display: flex; flex-direction: column; gap: 12px; padding: 14px; border: 2px solid #EEF0F4; border-radius: 18px; }
.thumb { aspect-ratio: 16 / 10; border-radius: 12px; }
.t1 { background: linear-gradient(135deg, #BAE6FD, #38BDF8); }
.t2 { background: linear-gradient(135deg, #DDD6FE, #8B5CF6); }
.t3 { background: linear-gradient(135deg, #FDE68A, #F59E0B); }
.t4 { background: linear-gradient(135deg, #A7F3D0, #10B981); }
.ct { height: 15px; width: 72%; border-radius: 8px; background: #1F2430; }
.cp { height: 11px; width: 92%; border-radius: 6px; background: #D5D9E0; }
.cp.short { width: 64%; }

/* Tablet widths */
@container (max-width: 1023px) {
  .nav { padding: 0 40px; height: 72px; }
  .nav-links i:nth-child(n + 3) { display: none; }
  .hero { grid-template-columns: 1fr 1fr; gap: 32px; padding: 44px 40px 36px; }
  .h1 { height: 36px; }
  .btns b { width: 132px; height: 44px; }
  .cards { grid-template-columns: repeat(2, 1fr); gap: 24px; padding: 4px 40px 40px; }
}

/* Phone widths */
@container (max-width: 599px) {
  .nav { padding: 0 20px; height: 60px; }
  .nav-links, .nav-cta { display: none !important; }
  .nav-burger { display: block !important; }
  .nav-brand { width: 96px; }
  .hero { grid-template-columns: 1fr; gap: 22px; padding: 26px 20px 20px; }
  .copy { gap: 13px; }
  .h1 { height: 30px; width: 100%; }
  .h1.short { width: 74%; }
  .btns { display: grid !important; grid-template-columns: 1fr 1fr; gap: 10px; }
  .btns b { width: auto; height: 44px; }
  .art { border-radius: 18px; }
  .cards { grid-template-columns: 1fr; gap: 18px; padding: 4px 20px 20px; }
}
`;

export const DEVICE_CSS = `
.device { position: absolute; }
.dim { position: absolute; left: 50%; transform: translateX(-50%); z-index: 3; white-space: nowrap;
  font: 600 13px/1 ${FONTS.mono}; letter-spacing: .02em; color: ${PALETTE.indigo100};
  padding: 6px 10px; border-radius: 999px; background: rgba(19, 16, 54, .86);
  box-shadow: inset 0 0 0 1px rgba(165, 180, 252, .32), 0 6px 16px -6px rgba(4, 3, 24, .6); }
.dim.start { left: 0; transform: none; }
.dim.end { left: auto; right: 0; transform: none; }
/* A tiny breakpoint tag, the same shape as the one in the mark. */
.dim::before { content: ''; display: inline-block; width: 9px; height: 8px; margin-right: 7px;
  background: ${PALETTE.breakpoint}; clip-path: polygon(0 0, 60% 0, 100% 50%, 60% 100%, 0 100%); vertical-align: 0; }

.bezel { position: relative; background: linear-gradient(160deg, #2B2F39 0%, #15171D 55%, #0E1014 100%);
  box-shadow: 0 34px 60px -18px rgba(4, 3, 24, .75), 0 14px 26px -12px rgba(4, 3, 24, .6), inset 0 0 0 1px rgba(255,255,255,.10), inset 0 1px 0 rgba(255,255,255,.14); }
.glass { position: relative; overflow: hidden; background: #fff; }
.glass::after { content: ''; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(115deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,0) 36%); }

.laptop .bezel { border-radius: 18px 18px 8px 8px; }
.laptop .cam { position: absolute; top: 6px; left: 50%; width: 5px; height: 5px; margin-left: -2.5px; border-radius: 50%; background: #3A3F4B; }
.laptop .base { position: relative; height: 16px; margin: 0 auto; border-radius: 2px 2px 16px 16px;
  background: linear-gradient(180deg, #E4E7EC 0%, #B9BFC9 55%, #8D94A1 100%);
  box-shadow: 0 30px 40px -16px rgba(4, 3, 24, .8), inset 0 1px 0 rgba(255,255,255,.7); }
.laptop .base::before { content: ''; position: absolute; top: 0; left: 50%; width: 18%; height: 6px; transform: translateX(-50%);
  border-radius: 0 0 8px 8px; background: linear-gradient(180deg, #9AA1AD, #B9BFC9); }

.tablet .bezel, .phone .bezel { border-radius: var(--r); }
.tablet .glass, .phone .glass { border-radius: var(--ri); }
.phone .cam { position: absolute; z-index: 2; top: calc(var(--p) + 7px); left: 50%; width: 8px; height: 8px; margin-left: -4px; border-radius: 50%;
  background: #0B0C10; box-shadow: 0 0 0 2px rgba(255,255,255,.08); }
`;

function screenHtml(vw, vh, scale) {
  return `<div class="screen" style="width:${vw}px;height:${vh}px;transform:scale(${scale})">${SITE_MARKUP}</div>`;
}

/**
 * A generic device frame showing the sample page at a real viewport size.
 * `width` is the on-image width of the screen; everything else derives from it.
 * Returns the HTML plus the outer box size so templates can position it.
 */
export function device({
  kind,
  vw,
  vh,
  width,
  x,
  y,
  label = true,
  labelAlign = 'center',
  labelGap = 14,
  camera = true,
}) {
  const scale = width / vw;
  const sw = Math.round(width);
  const sh = Math.round(vh * scale);
  const align = labelAlign === 'center' ? '' : ` ${labelAlign}`;
  const tag = label ? `<span class="dim${align}" style="top:-${30 + labelGap}px">${vw} × ${vh}</span>` : '';

  if (kind === 'laptop') {
    const side = Math.max(8, Math.round(sw * 0.022));
    const top = side + 6;
    const lidW = sw + side * 2;
    const lidH = sh + top + side;
    const baseW = Math.round(lidW * 1.16);
    const html = `<div class="device laptop" style="left:${x}px;top:${y}px;width:${baseW}px">
  ${tag}
  <div class="bezel" style="width:${lidW}px;height:${lidH}px;padding:${top}px ${side}px ${side}px;margin:0 auto">
    ${camera ? '<span class="cam"></span>' : ''}
    <div class="glass" style="width:${sw}px;height:${sh}px;border-radius:3px">${screenHtml(vw, vh, scale)}</div>
  </div>
  <div class="base" style="width:${baseW}px"></div>
</div>`;
    return { html, width: baseW, height: lidH + 16 };
  }

  const p = Math.max(kind === 'phone' ? 5 : 8, Math.round(sw * (kind === 'phone' ? 0.045 : 0.05)));
  const radius = kind === 'phone' ? Math.round(sw * 0.16) : Math.round(sw * 0.075);
  const inner = Math.max(4, radius - p);
  const html = `<div class="device ${kind}" style="left:${x}px;top:${y}px;--p:${p}px;--r:${radius}px;--ri:${inner}px">
  ${tag}
  <div class="bezel" style="padding:${p}px">
    ${kind === 'phone' && camera ? '<span class="cam"></span>' : ''}
    <div class="glass" style="width:${sw}px;height:${sh}px">${screenHtml(vw, vh, scale)}</div>
  </div>
</div>`;
  return { html, width: sw + p * 2, height: sh + p * 2 };
}

/* ------------------------------------------------------------------ */
/* Page scaffolding                                                    */
/* ------------------------------------------------------------------ */

/** Deep-indigo brand background with soft light and a faint viewport grid. */
export function nightBackgroundCss({ glowX = '78%', glowY = '28%', gridFadeFrom = 'right' } = {}) {
  const fade =
    gridFadeFrom === 'center'
      ? 'radial-gradient(ellipse 70% 80% at 50% 60%, #000 30%, transparent 75%)'
      : `linear-gradient(to ${gridFadeFrom === 'right' ? 'left' : 'right'}, #000 0%, rgba(0,0,0,.55) 45%, transparent 85%)`;
  return `
.bg { position: absolute; inset: 0; overflow: hidden;
  background:
    radial-gradient(60% 75% at ${glowX} ${glowY}, rgba(99, 102, 241, .55) 0%, rgba(99, 102, 241, 0) 70%),
    radial-gradient(45% 60% at 8% 105%, rgba(79, 70, 229, .55) 0%, rgba(79, 70, 229, 0) 70%),
    linear-gradient(140deg, ${PALETTE.night} 0%, ${PALETTE.indigo950} 48%, #26226A 100%); }
.bg::before { content: ''; position: absolute; inset: 0;
  background-image: radial-gradient(rgba(255,255,255,.13) 1px, transparent 1.4px);
  background-size: 24px 24px; -webkit-mask-image: ${fade}; mask-image: ${fade}; }
.bg::after { content: ''; position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,0) 40%); }
`;
}

export function page({ width, height, css, body, transparent = false, lang = 'en' }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: ${transparent ? 'transparent' : PALETTE.night}; }
  body { position: relative; font-family: ${FONTS.text}; color: #fff; -webkit-font-smoothing: antialiased; }
  ${SITE_CSS}
  ${DEVICE_CSS}
  ${css}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

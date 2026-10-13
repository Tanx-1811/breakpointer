// GitHub repository social preview, 1280 × 640 (content kept inside a 40 px safe area).
import { COPY, device, FONTS, nightBackgroundCss, page } from './shared.mjs';

export const width = 1280;
export const height = 640;
export const outputs = { en: 'social/github-social-1280x640.png' };

export function html({ lockup, lang = 'en' }) {
  const copy = COPY[lang];
  const screen = 430;
  const probe = device({ kind: 'laptop', vw: 1440, vh: 900, width: screen, x: 0, y: 0 });
  const lx = Math.round((width - probe.width) / 2);
  const ly = 292;
  const laptop = device({ kind: 'laptop', vw: 1440, vh: 900, width: screen, x: lx, y: ly });
  const tablet = device({ kind: 'tablet', vw: 820, vh: 1180, width: 158, x: lx - 122, y: ly + 62 });
  const phone = device({ kind: 'phone', vw: 390, vh: 844, width: 96, x: lx + probe.width + 2, y: ly + 98 });
  const lockupHeight = 60;

  const css = `
${nightBackgroundCss({ glowX: '50%', glowY: '85%', gridFadeFrom: 'center' })}
.top { position: absolute; left: 0; right: 0; top: 44px; display: flex; flex-direction: column; align-items: center; text-align: center; }
.lockup { display: block; height: ${lockupHeight}px; width: ${Math.round(lockupHeight * lockup.indigo.ratio)}px; }
.headline { margin-top: 26px; font: 700 44px/1.1 ${FONTS.text}; letter-spacing: -0.025em; color: #fff; }
.sub { margin-top: 12px; font: 400 20px/1.4 ${FONTS.text}; color: rgba(224, 231, 255, .8); }
`;

  const body = `<div class="bg"></div>
<div class="top">
  <img class="lockup" src="${lockup.indigo.src}" alt="ViewportLab">
  <h1 class="headline">${copy.tagline}</h1>
  <p class="sub">A Chrome extension for checking responsive layouts at real viewport widths.</p>
</div>
${laptop.html}
${tablet.html}
${phone.html}`;

  return page({ width, height, css, body, lang });
}

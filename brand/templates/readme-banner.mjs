// README header banner, 1600 × 500. Self-contained background with rounded,
// transparent corners so it sits well on GitHub's light and dark themes.
import { device, FONTS, nightBackgroundCss, page, TAGLINE } from './shared.mjs';

export const width = 1600;
export const height = 500;
export const outputs = { en: 'social/readme-banner-1600x500.png' };
export const transparent = true;

export function html({ lockup, lang = 'en' }) {
  const laptop = device({ kind: 'laptop', vw: 1440, vh: 900, width: 500, x: 948, y: 76 });
  const tablet = device({ kind: 'tablet', vw: 820, vh: 1180, width: 172, x: 872, y: 200, labelAlign: 'start' });
  const phone = device({ kind: 'phone', vw: 390, vh: 844, width: 104, x: 1446, y: 238, labelAlign: 'end' });
  const lockupHeight = 58;

  const css = `
.frame { position: absolute; inset: 0; border-radius: 28px; overflow: hidden; }
${nightBackgroundCss({ glowX: '78%', glowY: '45%' })}
.copy-block { position: absolute; left: 100px; top: 0; bottom: 0; width: 720px;
  display: flex; flex-direction: column; justify-content: center; }
.lockup { display: block; height: ${lockupHeight}px; width: ${Math.round(lockupHeight * lockup.indigo.ratio)}px; }
.headline { margin-top: 34px; font: 700 48px/1.08 ${FONTS.text}; letter-spacing: -0.026em; color: #fff; }
.sub { margin-top: 16px; font: 400 20px/1.5 ${FONTS.text}; color: rgba(224, 231, 255, .8); white-space: nowrap; }
`;

  const body = `<div class="frame">
<div class="bg"></div>
<div class="copy-block">
  <img class="lockup" src="${lockup.indigo.src}" alt="ViewportLab">
  <h1 class="headline">${TAGLINE.en}</h1>
  <p class="sub">Preview websites at multiple viewport sizes and check<br>responsive layouts directly in Chrome.</p>
</div>
${laptop.html}
${tablet.html}
${phone.html}
</div>`;

  return page({ width, height, css, body, transparent: true, lang });
}

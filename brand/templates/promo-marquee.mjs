// Chrome Web Store marquee promo tile, 1400 × 560 (English and Vietnamese).
import { COPY, device, FONTS, nightBackgroundCss, page } from './shared.mjs';

export const width = 1400;
export const height = 560;
export const outputs = {
  en: 'store/promo-marquee-1400x560.png',
  vi: 'store/promo-marquee-1400x560-vi.png',
};

export function html({ lockup, lang = 'en' }) {
  const copy = COPY[lang];
  const laptop = device({ kind: 'laptop', vw: 1440, vh: 900, width: 540, x: 702, y: 88 });
  const tablet = device({ kind: 'tablet', vw: 820, vh: 1180, width: 190, x: 614, y: 232, labelAlign: 'start' });
  const phone = device({ kind: 'phone', vw: 390, vh: 844, width: 112, x: 1238, y: 270, labelAlign: 'end' });
  const lockupHeight = 56;

  const css = `
${nightBackgroundCss({ glowX: '74%', glowY: '42%' })}
.copy-block { position: absolute; left: 96px; top: 0; bottom: 0; width: 500px;
  display: flex; flex-direction: column; justify-content: center; }
.lockup { display: block; height: ${lockupHeight}px; width: ${Math.round(lockupHeight * lockup.indigo.ratio)}px; }
.headline { margin-top: 36px; font: 700 ${lang === 'vi' ? 48 : 52}px/1.08 ${FONTS.text}; letter-spacing: -0.028em; color: #fff; }
.sub { margin-top: 18px; font: 400 19px/1.5 ${FONTS.text}; color: rgba(224, 231, 255, .8); white-space: nowrap; }
.chips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
.chip { font: 600 14px/1 ${FONTS.text}; color: #E0E7FF; padding: 9px 14px; border-radius: 999px;
  background: rgba(255,255,255,.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,.16); }
`;

  const body = `<div class="bg"></div>
<div class="copy-block">
  <img class="lockup" src="${lockup.indigo.src}" alt="ViewportLab">
  <h1 class="headline">${copy.taglineTwoLines}</h1>
  <p class="sub">${copy.pitchTwoLines}</p>
  <div class="chips">${copy.chips.map((chip) => `<span class="chip">${chip}</span>`).join('')}</div>
</div>
${laptop.html}
${tablet.html}
${phone.html}`;

  return page({ width, height, css, body, lang });
}

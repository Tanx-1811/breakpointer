// Chrome Web Store small promo tile, 440 × 280 (English and Vietnamese).
// Kept simple: it is often shown at its native size.
import { COPY, device, FONTS, nightBackgroundCss, page } from './shared.mjs';

export const width = 440;
export const height = 280;
export const outputs = {
  en: 'store/promo-small-440x280.png',
  vi: 'store/promo-small-440x280-vi.png',
};

export function html({ lockup, lang = 'en' }) {
  const copy = COPY[lang];
  const screen = 180;
  const probe = device({ kind: 'laptop', vw: 1440, vh: 900, width: screen, x: 0, y: 0, label: false });
  const lx = Math.round((width - probe.width) / 2);
  const bottom = height - 18;
  const laptop = device({
    kind: 'laptop',
    vw: 1440,
    vh: 900,
    width: screen,
    x: lx,
    y: bottom - probe.height,
    label: false,
    camera: false,
  });
  const tabletProbe = device({ kind: 'tablet', vw: 820, vh: 1180, width: 68, x: 0, y: 0, label: false });
  const tablet = device({
    kind: 'tablet',
    vw: 820,
    vh: 1180,
    width: 68,
    x: lx - 38,
    y: bottom + 2 - tabletProbe.height,
    label: false,
  });
  const phoneProbe = device({ kind: 'phone', vw: 390, vh: 844, width: 40, x: 0, y: 0, label: false });
  const phone = device({
    kind: 'phone',
    vw: 390,
    vh: 844,
    width: 40,
    x: lx + probe.width - 26,
    y: bottom + 2 - phoneProbe.height,
    label: false,
    camera: false,
  });
  const lockupHeight = 32;

  const css = `
${nightBackgroundCss({ glowX: '50%', glowY: '80%', gridFadeFrom: 'center' })}
.top { position: absolute; left: 0; right: 0; top: 24px; display: flex; flex-direction: column; align-items: center; }
.lockup { display: block; height: ${lockupHeight}px; width: ${Math.round(lockupHeight * lockup.indigo.ratio)}px; }
.tagline { margin-top: 12px; font: 650 ${lang === 'vi' ? 17 : 19}px/1.2 ${FONTS.text}; letter-spacing: -0.01em; color: #E0E7FF; }
`;

  const body = `<div class="bg"></div>
<div class="top">
  <img class="lockup" src="${lockup.indigo.src}" alt="ViewportLab">
  <p class="tagline">${copy.tagline}</p>
</div>
${laptop.html}
${tablet.html}
${phone.html}`;

  return page({ width, height, css, body, lang });
}

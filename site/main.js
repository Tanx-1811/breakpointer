/* global document, addEventListener, innerWidth, innerHeight, matchMedia, IntersectionObserver */

// Progressive enhancement only: without this file the page works the same, minus two niceties.

// 1. The ruler under the header shows this window's viewport size (what media queries see), like the size
//    read-out in Breakpointer.
const readout = document.querySelector('[data-viewport-size]');

if (readout) {
  const show = () => {
    readout.textContent = `${innerWidth} × ${innerHeight}`;
  };
  show();
  readout.parentElement.hidden = false;
  addEventListener('resize', show, { passive: true });
}

// 2. The demo video plays by itself, muted, only while it is on screen and only when the viewer has no
//    reduced-motion preference. Its controls always let them play or pause it, and a pause sticks.
const video = document.querySelector('video[data-autoplay]');

if (video && typeof IntersectionObserver === 'function') {
  const motionOk = matchMedia('(prefers-reduced-motion: no-preference)');
  let onScreen = false;
  let pausedByViewer = false;
  let pausingByScript = false;

  const update = () => {
    if (onScreen && motionOk.matches && !pausedByViewer) {
      video.play().catch(() => {});
    } else if (!video.paused) {
      pausingByScript = true;
      video.pause();
    }
  };

  video.addEventListener('pause', () => {
    if (!pausingByScript) pausedByViewer = true;
    pausingByScript = false;
  });
  video.addEventListener('play', () => {
    pausedByViewer = false;
  });
  new IntersectionObserver(
    (entries) => {
      onScreen = entries[0].isIntersecting;
      update();
    },
    { threshold: 0.35 },
  ).observe(video);
  motionOk.addEventListener('change', update);
}

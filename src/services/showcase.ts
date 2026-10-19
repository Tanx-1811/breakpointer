import {
  SHAPE_SIZES,
  layoutShowcase,
  outerSize,
  type ShowcaseBackdrop,
  type ShowcaseOptions,
  type ShowcasePlacement,
} from '../state/showcase';

/** One preview as captured on screen, at its viewport size. */
export type ShowcaseShot = { id: string; image: Blob; width: number; height: number };

const SANS = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

type Palette = { text: string; muted: string; device: string; edge: string; shadow: string };

const PALETTES: Record<ShowcaseBackdrop, Palette> = {
  indigo: {
    text: '#ffffff',
    muted: 'rgba(255, 255, 255, 0.78)',
    device: '#14161c',
    edge: 'rgba(255, 255, 255, 0.16)',
    shadow: 'rgba(17, 12, 64, 0.45)',
  },
  soft: {
    text: '#121620',
    muted: '#4f5868',
    device: '#16181e',
    edge: 'rgba(255, 255, 255, 0.1)',
    shadow: 'rgba(16, 24, 40, 0.28)',
  },
  dark: {
    text: '#f4f5f8',
    muted: 'rgba(244, 245, 248, 0.72)',
    device: '#0b0c10',
    edge: 'rgba(255, 255, 255, 0.2)',
    shadow: 'rgba(0, 0, 0, 0.55)',
  },
  transparent: {
    text: '#121620',
    muted: '#4f5868',
    device: '#16181e',
    edge: 'rgba(255, 255, 255, 0.1)',
    shadow: 'rgba(16, 24, 40, 0.3)',
  },
};

function paintBackdrop(context: CanvasRenderingContext2D, backdrop: ShowcaseBackdrop, width: number, height: number) {
  if (backdrop === 'transparent') return;
  const gradient = context.createLinearGradient(0, 0, width, height);
  if (backdrop === 'indigo') {
    gradient.addColorStop(0, '#6366f1');
    gradient.addColorStop(1, '#3730a3');
  } else if (backdrop === 'soft') {
    gradient.addColorStop(0, '#f5f6fa');
    gradient.addColorStop(1, '#e2e6ef');
  } else {
    gradient.addColorStop(0, '#171a23');
    gradient.addColorStop(1, '#0b0d12');
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  // A soft light from the top, behind the devices.
  const glow = context.createRadialGradient(width / 2, height * 0.2, 0, width / 2, height * 0.2, width * 0.6);
  glow.addColorStop(0, backdrop === 'soft' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.14)');
  glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
}

/** Shortens `text` with an ellipsis until it fits `width`. */
function fit(context: CanvasRenderingContext2D, text: string, width: number): string {
  if (context.measureText(text).width <= width) return text;
  let end = text.length;
  while (end > 1 && context.measureText(`${text.slice(0, end)}…`).width > width) end--;
  return `${text.slice(0, end)}…`;
}

/** The product mark (as in Icon.tsx's Logo), `size` pixels wide, at x, y. */
function drawMark(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  context.save();
  context.translate(x, y);
  context.scale(size / 128, size / 128);
  const gradient = context.createLinearGradient(0, 0, 128, 128);
  gradient.addColorStop(0, '#6366F1');
  gradient.addColorStop(1, '#4338CA');
  context.fillStyle = gradient;
  context.beginPath();
  context.roundRect(0, 0, 128, 128, 28);
  context.fill();
  context.lineJoin = 'round';
  context.strokeStyle = '#ffffff';
  context.lineWidth = 11;
  context.stroke(new Path2D('M24 28h28a16 16 0 0 1 0 32H24zM24 60h38a20 20 0 0 1 0 40H24z'));
  const tag = new Path2D('M107 30H89l-11 14 11 14h18z');
  context.fillStyle = '#FBBF24';
  context.strokeStyle = '#FBBF24';
  context.lineWidth = 4;
  context.fill(tag);
  context.stroke(tag);
  context.restore();
}

/** One device: its body (with a shadow), base or stand, and the screenshot in its screen. */
function drawDevice(
  context: CanvasRenderingContext2D,
  place: ShowcasePlacement,
  shot: ShowcaseShot,
  bitmap: ImageBitmap,
  palette: Palette,
  pixel: number,
  host: string,
) {
  const { frame, scale } = place;
  const size = outerSize(frame, shot.width, shot.height);
  const s = (value: number) => value * scale;
  const overhang = frame.base ? s(frame.base.overhang) : 0;
  const bodyX = place.x + overhang;
  const bodyY = place.y;
  const bodyWidth = s(size.bodyWidth);
  const bodyHeight = s(size.bodyHeight);
  const screenX = bodyX + s(frame.left);
  const screenY = bodyY + s(frame.top);
  const screenWidth = s(shot.width);
  const screenHeight = s(shot.height);

  // Stand (behind the body).
  if (frame.stand) {
    const neckWidth = s(frame.stand.neckWidth);
    const neckX = bodyX + (bodyWidth - neckWidth) / 2;
    const neck = context.createLinearGradient(neckX, 0, neckX + neckWidth, 0);
    neck.addColorStop(0, '#9aa0ab');
    neck.addColorStop(0.5, '#c7cbd3');
    neck.addColorStop(1, '#9aa0ab');
    context.fillStyle = neck;
    context.fillRect(neckX, bodyY + bodyHeight - 2, neckWidth, s(frame.stand.neck) + 2);
    const footWidth = s(frame.stand.footWidth);
    context.save();
    context.shadowColor = palette.shadow;
    context.shadowBlur = 24 * pixel;
    context.shadowOffsetY = 8 * pixel;
    context.fillStyle = '#b4b9c2';
    context.beginPath();
    context.roundRect(
      bodyX + (bodyWidth - footWidth) / 2,
      bodyY + bodyHeight + s(frame.stand.neck),
      footWidth,
      s(frame.stand.foot),
      s(frame.stand.foot) / 2,
    );
    context.fill();
    context.restore();
  }

  // Body with its shadow.
  const body = new Path2D();
  body.roundRect(bodyX, bodyY, bodyWidth, bodyHeight, s(frame.radius));
  context.save();
  context.shadowColor = palette.shadow;
  context.shadowBlur = 44 * pixel;
  context.shadowOffsetY = 18 * pixel;
  context.fillStyle = frame.kind === 'window' ? '#eef0f4' : frame.kind === 'plain' ? '#ffffff' : palette.device;
  context.fill(body);
  context.restore();
  if (frame.kind !== 'plain') {
    context.strokeStyle = frame.kind === 'window' ? 'rgba(16, 24, 40, 0.14)' : palette.edge;
    context.lineWidth = 1.5 * pixel;
    context.stroke(body);
  }

  // Window title bar: three dots and the address.
  if (frame.kind === 'window') {
    const bar = s(frame.top);
    const dot = Math.max(3, bar * 0.18);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((color, index) => {
      context.fillStyle = color;
      context.beginPath();
      context.arc(bodyX + bar * 0.6 + index * dot * 3.2, bodyY + bar / 2, dot, 0, Math.PI * 2);
      context.fill();
    });
    const pillWidth = Math.min(bodyWidth * 0.5, Math.max(bodyWidth * 0.3, 160 * pixel));
    const pillX = bodyX + (bodyWidth - pillWidth) / 2;
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.roundRect(pillX, bodyY + bar * 0.2, pillWidth, bar * 0.6, bar * 0.3);
    context.fill();
    if (host) {
      context.fillStyle = '#4f5868';
      context.font = `500 ${Math.max(8, bar * 0.34)}px ${SANS}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(fit(context, host, pillWidth - bar * 0.6), pillX + pillWidth / 2, bodyY + bar / 2);
      context.textAlign = 'left';
      context.textBaseline = 'alphabetic';
    }
  }

  // Laptop camera.
  if (frame.kind === 'laptop') {
    context.fillStyle = '#2b2e36';
    context.beginPath();
    context.arc(bodyX + bodyWidth / 2, bodyY + s(frame.top) / 2, Math.max(1.5, s(frame.top) * 0.12), 0, Math.PI * 2);
    context.fill();
  }

  // The screen.
  context.save();
  const screen = new Path2D();
  screen.roundRect(screenX, screenY, screenWidth, screenHeight, Math.max(0, s(frame.screenRadius)));
  context.clip(screen);
  context.fillStyle = '#ffffff';
  context.fillRect(screenX, screenY, screenWidth, screenHeight);
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, screenX, screenY, screenWidth, screenHeight);
  context.restore();

  // Laptop base, in front of the screen's bottom edge.
  if (frame.base) {
    const baseHeight = s(frame.base.height);
    const baseY = bodyY + bodyHeight - 1;
    const metal = context.createLinearGradient(0, baseY, 0, baseY + baseHeight);
    metal.addColorStop(0, '#d9dce2');
    metal.addColorStop(0.55, '#b7bcc5');
    metal.addColorStop(1, '#8f95a0');
    context.save();
    context.shadowColor = palette.shadow;
    context.shadowBlur = 30 * pixel;
    context.shadowOffsetY = 12 * pixel;
    context.fillStyle = metal;
    context.beginPath();
    context.roundRect(place.x, baseY, place.width, baseHeight, [0, 0, baseHeight * 0.6, baseHeight * 0.6]);
    context.fill();
    context.restore();
    // The thumb notch.
    const notch = place.width * 0.13;
    context.fillStyle = 'rgba(70, 76, 88, 0.35)';
    context.beginPath();
    context.roundRect(place.x + (place.width - notch) / 2, baseY, notch, baseHeight * 0.32, [
      0,
      0,
      baseHeight * 0.2,
      baseHeight * 0.2,
    ]);
    context.fill();
  }
}

/**
 * The showcase image: a backdrop, an optional title, the previews in their
 * frames and an optional credit. Drawn at twice its layout size (or the
 * screen's density, if higher), as a PNG.
 */
export async function composeShowcase(
  shots: ShowcaseShot[],
  options: ShowcaseOptions & { host: string },
): Promise<Blob | null> {
  if (shots.length === 0) return null;
  const pixel = Math.max(2, Math.min(3, window.devicePixelRatio || 1));
  const base = SHAPE_SIZES[options.shape];
  const width = base.width * pixel;
  const height = base.height * pixel;
  const title = options.title.trim();
  const titleSize = Math.round(base.width * (options.shape === 'square' ? 0.042 : 0.036)) * pixel;
  const placements = layoutShowcase(
    shots.map(({ id, width: w, height: h }) => ({ id, width: w, height: h })),
    options.frame,
    {
      width,
      height,
      top: title ? titleSize * 3.1 : base.height * 0.09 * pixel,
      bottom: base.height * (options.credit ? 0.1 : 0.08) * pixel,
      side: base.width * 0.05 * pixel,
    },
  );
  const bitmaps = await Promise.all(shots.map((shot) => createImageBitmap(shot.image)));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const palette = PALETTES[options.backdrop];
    paintBackdrop(context, options.backdrop, width, height);

    if (title) {
      context.fillStyle = palette.text;
      context.font = `700 ${titleSize}px ${SANS}`;
      context.textAlign = 'center';
      context.textBaseline = 'alphabetic';
      context.fillText(fit(context, title, width * 0.86), width / 2, titleSize * 1.75);
      context.textAlign = 'left';
    }

    for (const place of [...placements].sort((a, b) => a.z - b.z)) {
      const index = shots.findIndex((shot) => shot.id === place.id);
      drawDevice(context, place, shots[index]!, bitmaps[index]!, palette, pixel, options.host);
    }

    if (options.credit) {
      const size = Math.round(base.width * 0.0105) * pixel;
      context.font = `600 ${size}px ${SANS}`;
      const text = 'Made with Breakpointer';
      const textWidth = context.measureText(text).width;
      const mark = size * 1.5;
      const x = width - base.width * 0.03 * pixel - textWidth;
      const y = height - base.height * 0.035 * pixel;
      context.globalAlpha = 0.86;
      drawMark(context, x - mark - size * 0.5, y - mark * 0.78, mark);
      context.fillStyle = palette.muted;
      context.fillText(text, x, y);
      context.globalAlpha = 1;
    }

    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}

import { sizeClassOf, type SizeClass } from './size-class';

/**
 * Showcase images: the page at a few sizes in simple, unbranded device-style
 * frames on a backdrop, for a portfolio, a client or a post. The frames are
 * decoration — previews change the viewport, not the device.
 */
export type ShowcaseFrame = 'devices' | 'windows' | 'none';
export type ShowcaseBackdrop = 'indigo' | 'soft' | 'dark' | 'transparent';
export type ShowcaseShape = 'wide' | 'standard' | 'square';

export const SHOWCASE_FRAMES: readonly ShowcaseFrame[] = ['devices', 'windows', 'none'];
export const SHOWCASE_BACKDROPS: readonly ShowcaseBackdrop[] = ['indigo', 'soft', 'dark', 'transparent'];
export const SHOWCASE_SHAPES: readonly ShowcaseShape[] = ['wide', 'standard', 'square'];

/** The image's size in layout units; it is drawn at twice that (or the screen's density, if higher). */
export const SHAPE_SIZES: Record<ShowcaseShape, { width: number; height: number }> = {
  wide: { width: 1600, height: 900 },
  standard: { width: 1600, height: 1200 },
  square: { width: 1400, height: 1400 },
};

/** At most this many previews in one image. */
export const MAX_SHOWCASE_DEVICES = 4;

export type ShowcaseOptions = {
  frame: ShowcaseFrame;
  backdrop: ShowcaseBackdrop;
  shape: ShowcaseShape;
  /** Shown above the devices; empty for none. */
  title: string;
  /** A small "Made with Breakpointer" in a corner. */
  credit: boolean;
};

export const DEFAULT_SHOWCASE: Omit<ShowcaseOptions, 'title'> = {
  frame: 'devices',
  backdrop: 'indigo',
  shape: 'wide',
  credit: true,
};

/**
 * Which previews to show first: the narrowest, the widest and one in between
 * (different size classes where possible), in the workspace's order.
 */
export function pickShowcaseViewports<T extends { id: string; width: number; height: number }>(
  viewports: T[],
  count = 3,
): string[] {
  if (viewports.length <= count) return viewports.map((viewport) => viewport.id);
  const byWidth = [...viewports].sort((a, b) => a.width - b.width);
  const picked = [byWidth[0]!, byWidth.at(-1)!];
  const classes = new Set(picked.map((viewport) => sizeClassOf(viewport.width, viewport.height)));
  // Then other size classes, the middle ones first; then anything left.
  const middle = byWidth.slice(1, -1).sort((a, b) => {
    const center = (byWidth.length - 1) / 2;
    return Math.abs(byWidth.indexOf(a) - center) - Math.abs(byWidth.indexOf(b) - center);
  });
  for (const pass of [true, false])
    for (const viewport of middle) {
      if (picked.length >= count) break;
      if (picked.includes(viewport)) continue;
      const kind = sizeClassOf(viewport.width, viewport.height);
      if (pass && classes.has(kind)) continue;
      picked.push(viewport);
      classes.add(kind);
    }
  return viewports.filter((viewport) => picked.includes(viewport)).map((viewport) => viewport.id);
}

/**
 * The frame around one screen, in the screen's own CSS pixels: the screen sits
 * `top`/`right`/`bottom`/`left` inside the body. Laptops have a base below,
 * desktops a stand; the windows style a title bar.
 */
export type FrameGeometry = {
  kind: SizeClass | 'window' | 'plain';
  top: number;
  right: number;
  bottom: number;
  left: number;
  /** Corner radius of the body, and of the screen inside it. */
  radius: number;
  screenRadius: number;
  /** Laptops: a base as tall as `height`, sticking out `overhang` on each side. */
  base?: { height: number; overhang: number };
  /** Desktops: a neck and a foot below the screen. */
  stand?: { neck: number; neckWidth: number; foot: number; footWidth: number };
};

export function frameGeometry(style: ShowcaseFrame, width: number, height: number): FrameGeometry {
  const short = Math.min(width, height);
  if (style === 'windows')
    return { kind: 'window', top: 34, right: 0, bottom: 0, left: 0, radius: 12, screenRadius: 0 };
  if (style === 'none') {
    const radius = Math.round(Math.min(16, short * 0.03));
    return { kind: 'plain', top: 0, right: 0, bottom: 0, left: 0, radius, screenRadius: radius };
  }
  const kind = sizeClassOf(width, height);
  switch (kind) {
    case 'phone': {
      const bezel = Math.max(10, Math.round(short * 0.045));
      const radius = Math.round(short * 0.15);
      return { kind, top: bezel, right: bezel, bottom: bezel, left: bezel, radius, screenRadius: radius - bezel };
    }
    case 'tablet': {
      const bezel = Math.max(14, Math.round(short * 0.045));
      const radius = Math.round(short * 0.065);
      return { kind, top: bezel, right: bezel, bottom: bezel, left: bezel, radius, screenRadius: radius - bezel };
    }
    case 'laptop': {
      const side = Math.round(short * 0.03);
      return {
        kind,
        top: Math.round(short * 0.042),
        right: side,
        bottom: side,
        left: side,
        radius: Math.round(short * 0.03),
        screenRadius: 4,
        base: { height: Math.round(short * 0.045), overhang: Math.round(width * 0.075) },
      };
    }
    case 'desktop': {
      const bezel = Math.round(short * 0.018);
      return {
        kind,
        top: bezel,
        right: bezel,
        bottom: Math.round(short * 0.028),
        left: bezel,
        radius: Math.round(short * 0.016),
        screenRadius: 2,
        stand: {
          neck: Math.round(short * 0.14),
          neckWidth: Math.round(width * 0.11),
          foot: Math.round(short * 0.022),
          footWidth: Math.round(width * 0.3),
        },
      };
    }
  }
}

/** The whole device, base and stand included, in the screen's CSS pixels. */
export function outerSize(frame: FrameGeometry, width: number, height: number) {
  const bodyWidth = frame.left + width + frame.right;
  const bodyHeight = frame.top + height + frame.bottom;
  const extraWidth = frame.base ? frame.base.overhang * 2 : 0;
  const extraHeight = frame.base ? frame.base.height : frame.stand ? frame.stand.neck + frame.stand.foot : 0;
  return { width: bodyWidth + extraWidth, height: bodyHeight + extraHeight, bodyWidth, bodyHeight };
}

/**
 * CSS pixels aren't the same physical size on every screen: phones show more
 * per inch than laptops, desktop monitors fewer. Devices are drawn at roughly
 * their real size relative to each other — phones and tablets a little smaller,
 * so the large screen leads the picture.
 */
const PHYSICAL_SCALE: Record<FrameGeometry['kind'], number> = {
  phone: 0.82,
  tablet: 0.84,
  laptop: 1,
  desktop: 1.2,
  window: 1,
  plain: 1,
};

export type ShowcaseDevice = { id: string; width: number; height: number };

export type ShowcasePlacement = {
  id: string;
  /** Top-left of the whole device (base included), in image units. */
  x: number;
  y: number;
  /** Image units per CSS pixel of this screen. */
  scale: number;
  frame: FrameGeometry;
  width: number;
  height: number;
  /** Drawing order: higher is in front. */
  z: number;
};

export type ShowcaseArea = {
  width: number;
  height: number;
  /** Space kept free above the devices (for the title). */
  top: number;
  bottom: number;
  side: number;
};

/**
 * Places the devices on one floor line, the largest at the back: wide images
 * spread them out side by side, taller ones stack them closer together, the
 * large one raised behind the others. One scale fits them all in the area,
 * centred in it; smaller devices stand in front. Placements come left to right.
 */
export function layoutShowcase(
  devices: ShowcaseDevice[],
  style: ShowcaseFrame,
  area: ShowcaseArea,
): ShowcasePlacement[] {
  if (devices.length === 0) return [];
  const items = devices.map((device) => {
    const frame = frameGeometry(style, device.width, device.height);
    const physical = style === 'devices' ? PHYSICAL_SCALE[frame.kind] : 1;
    const size = outerSize(frame, device.width, device.height);
    return { device, frame, physical, width: size.width * physical, height: size.height * physical };
  });
  const bySize = [...items].sort((a, b) => b.width * b.height - a.width * a.height);
  const hero = bySize[0]!;
  // Two devices: the second on the right. More: the second on the left, the rest on the right.
  const left = bySize.length >= 3 ? bySize[1] : undefined;
  const right = bySize.slice(left ? 2 : 1);

  const room = area.height - area.top - area.bottom;
  const aspect = (area.width - area.side * 2) / Math.max(1, room);
  // 0 for wide images (about 2:1 and wider), 1 for square ones.
  const stack = Math.min(1, Math.max(0, 2 - aspect));
  // How far a device in front reaches over its neighbour, as a share of its own width.
  const overlap = (style === 'none' && stack === 0 ? -0.06 : 0.12) + 0.36 * stack;

  type Box = { item: (typeof items)[number]; x: number; bottom: number };
  const boxes: Box[] = [{ item: hero, x: 0, bottom: 0 }];
  if (left) boxes.push({ item: left, x: overlap * left.width - left.width, bottom: 0 });
  let edge = hero.width;
  right.forEach((item, index) => {
    const x = edge - (index === 0 ? overlap : Math.max(overlap, 0.12) / 2) * item.width;
    boxes.push({ item, x, bottom: 0 });
    edge = x + item.width;
  });
  // The large device stands higher behind the others, more so in taller images.
  if (boxes.length > 1) boxes[0]!.bottom = -0.5 * stack * Math.min(...boxes.slice(1).map((box) => box.item.height));

  const minX = Math.min(...boxes.map((box) => box.x));
  const maxX = Math.max(...boxes.map((box) => box.x + box.item.width));
  const top = Math.min(...boxes.map((box) => box.bottom - box.item.height));
  const total = { width: maxX - minX, height: -top };
  const fit = Math.min((area.width - area.side * 2) / total.width, room / total.height);
  const x0 = (area.width - total.width * fit) / 2;
  // The group sits in the middle of the room it has.
  const floor = area.height - area.bottom - (room - total.height * fit) / 2;
  return boxes
    .map((box) => ({
      id: box.item.device.id,
      x: x0 + (box.x - minX) * fit,
      y: floor + (box.bottom - box.item.height) * fit,
      scale: fit * box.item.physical,
      frame: box.item.frame,
      width: box.item.width * fit,
      height: box.item.height * fit,
      // The larger a device, the further back.
      z: bySize.indexOf(box.item),
    }))
    .sort((a, b) => a.x - b.x);
}

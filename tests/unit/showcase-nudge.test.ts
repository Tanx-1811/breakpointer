import { describe, expect, it } from 'vitest';
import {
  FIRST_NUDGE_DAYS,
  LATER_NUDGE_DAYS,
  dayKey,
  finish,
  freshUsage,
  parseUsage,
  recordDay,
  shouldNudge,
  snooze,
} from '../../src/state/nudge';
import {
  MAX_SHOWCASE_DEVICES,
  SHAPE_SIZES,
  frameGeometry,
  layoutShowcase,
  outerSize,
  pickShowcaseViewports,
} from '../../src/state/showcase';
import { listingUrl, reviewUrl, storeOf } from '../../src/state/store-links';

const phone = { id: 'phone', width: 390, height: 844 };
const tablet = { id: 'tablet', width: 768, height: 1024 };
const laptop = { id: 'laptop', width: 1440, height: 900 };
const desktop = { id: 'desktop', width: 1920, height: 1080 };

describe('showcase image', () => {
  it('picks the narrowest, the widest and one of another size class', () => {
    expect(pickShowcaseViewports([phone, tablet, laptop])).toEqual(['phone', 'tablet', 'laptop']);
    const phone2 = { id: 'phone2', width: 375, height: 667 };
    // Two phones, a tablet and a laptop: the tablet beats the second phone; workspace order is kept.
    expect(pickShowcaseViewports([laptop, phone2, phone, tablet])).toEqual(['laptop', 'phone2', 'tablet']);
    expect(pickShowcaseViewports([phone])).toEqual(['phone']);
    expect(MAX_SHOWCASE_DEVICES).toBeGreaterThanOrEqual(3);
  });

  it('frames each size class: bezels, a laptop base and a desktop stand', () => {
    const forPhone = frameGeometry('devices', phone.width, phone.height);
    expect(forPhone.kind).toBe('phone');
    expect(forPhone.top).toBeGreaterThan(0);
    expect(forPhone.screenRadius).toBeGreaterThan(0);
    expect(frameGeometry('devices', laptop.width, laptop.height).base).toBeDefined();
    expect(frameGeometry('devices', desktop.width, desktop.height).stand).toBeDefined();
    expect(frameGeometry('windows', laptop.width, laptop.height)).toMatchObject({ kind: 'window', top: 34, left: 0 });
    expect(frameGeometry('none', phone.width, phone.height)).toMatchObject({ kind: 'plain', top: 0 });
    const size = outerSize(frameGeometry('devices', laptop.width, laptop.height), laptop.width, laptop.height);
    expect(size.width).toBeGreaterThan(size.bodyWidth);
    expect(size.height).toBeGreaterThan(size.bodyHeight);
  });

  it.each(['devices', 'windows', 'none'] as const)('fits every device in the image (%s)', (style) => {
    for (const shape of ['wide', 'standard', 'square'] as const) {
      const { width, height } = SHAPE_SIZES[shape];
      const area = { width, height, top: 120, bottom: 80, side: 60 };
      const places = layoutShowcase([phone, tablet, laptop, desktop], style, area);
      expect(places).toHaveLength(4);
      for (const place of places) {
        expect(place.scale).toBeGreaterThan(0);
        expect(place.x).toBeGreaterThanOrEqual(area.side - 0.5);
        expect(place.x + place.width).toBeLessThanOrEqual(width - area.side + 0.5);
        expect(place.y).toBeGreaterThanOrEqual(area.top - 0.5);
        expect(place.y + place.height).toBeLessThanOrEqual(height - area.bottom + 0.5);
      }
      // The devices in front stand on one floor; the large one (behind) never lower.
      const back = places.find((place) => place.z === 0)!;
      const front = places.filter((place) => place !== back);
      const floor = front[0]!.y + front[0]!.height;
      for (const place of front) expect(place.y + place.height).toBeCloseTo(floor, 5);
      expect(back.y + back.height).toBeLessThanOrEqual(floor + 1e-6);
      // The group is centred in the room it has.
      const top = Math.min(...places.map((place) => place.y));
      expect(top - area.top).toBeCloseTo(height - area.bottom - floor, 5);
    }
  });

  it('puts the largest device behind, in the middle of three, and smaller ones in front', () => {
    const places = layoutShowcase([phone, laptop, tablet], 'devices', {
      width: 1600,
      height: 900,
      top: 100,
      bottom: 60,
      side: 60,
    });
    expect(places.map((place) => place.id)).toEqual(['tablet', 'laptop', 'phone']);
    // Two devices: the smaller one on the right.
    const two = layoutShowcase([phone, laptop], 'devices', {
      width: 1600,
      height: 900,
      top: 100,
      bottom: 60,
      side: 60,
    });
    expect(two.map((place) => place.id)).toEqual(['laptop', 'phone']);
    const z = Object.fromEntries(places.map((place) => [place.id, place.z]));
    expect(z.laptop).toBeLessThan(z.tablet!);
    expect(z.tablet).toBeLessThan(z.phone!);
    expect(layoutShowcase([], 'devices', { width: 100, height: 100, top: 0, bottom: 0, side: 0 })).toEqual([]);
  });
});

describe('rating nudge', () => {
  it('counts each day of use once', () => {
    let usage = freshUsage();
    usage = recordDay(usage, '2026-10-19');
    usage = recordDay(usage, '2026-10-19');
    usage = recordDay(usage, '2026-10-20');
    expect(usage.days).toBe(2);
    expect(dayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('asks after a few days, once more after "Not now", then never', () => {
    let usage = { ...freshUsage(), days: FIRST_NUDGE_DAYS - 1 };
    expect(shouldNudge(usage)).toBe(false);
    usage = recordDay(usage, '2026-10-21');
    expect(shouldNudge(usage)).toBe(true);
    usage = snooze(usage);
    expect(usage.nudge).toBe('later');
    expect(shouldNudge(usage)).toBe(false);
    usage = { ...usage, days: usage.days + LATER_NUDGE_DAYS };
    expect(shouldNudge(usage)).toBe(true);
    usage = snooze(usage);
    expect(usage.nudge).toBe('done');
    expect(shouldNudge({ ...usage, days: 999 })).toBe(false);
    expect(shouldNudge(finish({ ...freshUsage(), days: 99 }))).toBe(false);
  });

  it('treats stored usage as untrusted', () => {
    expect(parseUsage(null)).toEqual(freshUsage());
    expect(parseUsage({ days: -3, lastDay: 'yesterday', nudge: 'maybe', askAt: 1 })).toEqual(freshUsage());
    expect(parseUsage({ days: 7, lastDay: '2026-10-19', nudge: 'later', askAt: 21 })).toEqual({
      days: 7,
      lastDay: '2026-10-19',
      nudge: 'later',
      askAt: 21,
    });
  });
});

describe('store links', () => {
  it('tells which store installed this copy', () => {
    expect(storeOf('https://clients2.google.com/service/update2/crx', 'normal')).toBe('chrome');
    expect(storeOf('https://edge.microsoft.com/extensionwebstorebase/v1/crx', 'normal')).toBe('edge');
    expect(storeOf(undefined, 'development')).toBeNull();
    expect(storeOf('https://clients2.google.com/service/update2/crx', 'development')).toBeNull();
    expect(storeOf('https://updates.example.com/crx', 'normal')).toBeNull();
    expect(storeOf('not a url', 'normal')).toBeNull();
  });

  it('links to the listing and its reviews', () => {
    expect(listingUrl('chrome', 'abc')).toBe('https://chromewebstore.google.com/detail/breakpointer/abc');
    expect(reviewUrl('chrome', 'abc')).toBe('https://chromewebstore.google.com/detail/breakpointer/abc/reviews');
    expect(reviewUrl('edge', 'xyz')).toBe('https://microsoftedge.microsoft.com/addons/detail/xyz');
  });
});

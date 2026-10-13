import { describe, expect, it } from 'vitest';
import {
  addViewport,
  clampZoom,
  createViewport,
  duplicateViewport,
  fromTemplates,
  moveViewport,
  moveViewportTo,
  normalizeName,
  removeViewport,
  rotateViewport,
  setZoomForAll,
  showAll,
  stepZoom,
  suggestedZoom,
  updateViewport,
} from '../../src/state/viewports';
import { MAX_VIEWPORTS } from '../../src/utils/constants';

const list = () => [
  createViewport({ name: 'Phone', width: 375, height: 667 }),
  createViewport({ name: 'Tablet', width: 768, height: 1024 }),
  createViewport({ name: 'Laptop', width: 1366, height: 768 }),
];

describe('viewport operations', () => {
  it('creates viewports with clamped sizes, a derived orientation and a suggested zoom', () => {
    const vp = createViewport({ name: '  ', width: 50, height: 99999.6 });
    expect(vp).toMatchObject({ name: '200 × 3840', width: 200, height: 3840, orientation: 'portrait', hidden: false });
    expect(createViewport({ name: 'Wide', width: 1920, height: 1080 })).toMatchObject({
      orientation: 'landscape',
      zoom: 0.33,
    });
  });

  it('adds up to the limit', () => {
    let items = list();
    for (let i = 0; i < 10; i++) items = addViewport(items, { name: `#${i}`, width: 400, height: 800 });
    expect(items).toHaveLength(MAX_VIEWPORTS);
  });

  it('duplicates right after the original and respects the limit', () => {
    const items = list();
    const next = duplicateViewport(items, items[0]!.id);
    expect(next.map((vp) => vp.name)).toEqual(['Phone', 'Phone', 'Tablet', 'Laptop']);
    expect(next[1]!.id).not.toBe(items[0]!.id);
  });

  it('updates, normalising names and recomputing orientation', () => {
    const items = list();
    const next = updateViewport(items, items[0]!.id, { width: 900, name: '  My   phone ' });
    expect(next[0]).toMatchObject({ name: 'My phone', width: 900, height: 667, orientation: 'landscape' });
    expect(next[1]).toBe(items[1]);
  });

  it('rotates by swapping width and height', () => {
    const items = list();
    expect(rotateViewport(items, items[2]!.id)[2]).toMatchObject({ width: 768, height: 1366, orientation: 'portrait' });
  });

  it('moves within bounds', () => {
    const items = list();
    expect(moveViewport(items, items[0]!.id, -1)).toBe(items);
    expect(moveViewport(items, items[0]!.id, 1).map((vp) => vp.name)).toEqual(['Tablet', 'Phone', 'Laptop']);
    expect(moveViewportTo(items, items[2]!.id, 0).map((vp) => vp.name)).toEqual(['Laptop', 'Phone', 'Tablet']);
    expect(moveViewportTo(items, items[2]!.id, 7)).toBe(items);
  });

  it('removes, shows all and sets zoom for all', () => {
    const items = updateViewport(list(), list()[0]!.id, { hidden: true });
    expect(removeViewport(items, items[1]!.id)).toHaveLength(2);
    expect(showAll(items).every((vp) => !vp.hidden)).toBe(true);
    expect(setZoomForAll(items, 5).every((vp) => vp.zoom === 1)).toBe(true);
  });

  it('steps zoom through the preset levels', () => {
    const items = setZoomForAll(list(), 0.5);
    expect(stepZoom(items, 1)).toBe(0.67);
    expect(stepZoom(items, -1)).toBe(0.33);
    expect(stepZoom(setZoomForAll(items, 1), 1)).toBe(1);
    expect(stepZoom(setZoomForAll(items, 0.25), -1)).toBe(0.25);
  });

  it('has sensible helpers', () => {
    expect(clampZoom(0.333)).toBe(0.33);
    expect(clampZoom(0)).toBe(0.1);
    expect(normalizeName('x'.repeat(80), 1, 1)).toHaveLength(40);
    expect(suggestedZoom(375, 667)).toBe(0.75);
    expect(suggestedZoom(2560, 1440)).toBe(0.25);
    expect(fromTemplates([{ name: 'A', width: 300, height: 600, zoom: 0.5 }])[0]).toMatchObject({
      name: 'A',
      hidden: false,
    });
  });
});

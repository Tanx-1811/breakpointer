import { describe, expect, it } from 'vitest';
import { CASCADE_STEP, WINDOW_GAP, tileWindows } from '../../src/state/window-layout';

const screen = { left: 0, top: 25, width: 1440, height: 875 };

describe('placing real windows', () => {
  it('wraps onto a new row when there is room below', () => {
    const rects = tileWindows(
      [
        { width: 700, height: 400 },
        { width: 700, height: 400 },
        { width: 700, height: 400 },
      ],
      screen,
    );
    expect(rects.map((rect) => [rect.left, rect.top])).toEqual([
      [0, 25],
      [700 + WINDOW_GAP, 25],
      [0, 25 + 400 + WINDOW_GAP],
    ]);
  });

  it('puts windows side by side', () => {
    const rects = tileWindows(
      [
        { width: 390, height: 760 },
        { width: 780, height: 500 },
        { width: 400, height: 300 },
      ],
      screen,
    );
    expect(rects[0]).toEqual({ left: 0, top: 25, width: 390, height: 760 });
    expect(rects[1]).toEqual({ left: 390 + WINDOW_GAP, top: 25, width: 780, height: 500 });
    // No room for a second row under the 760px window: the third is cascaded from the top left.
    expect(rects[2]).toEqual({ left: 0, top: 25, width: 400, height: 300 });
  });

  it('cascades windows that no longer fit, keeping them on the screen', () => {
    const rects = tileWindows(
      [
        { width: 1400, height: 800 },
        { width: 1400, height: 800 },
        { width: 1400, height: 800 },
      ],
      screen,
    );
    expect(rects[0]).toEqual({ left: 0, top: 25, width: 1400, height: 800 });
    expect(rects[1]).toEqual({ left: 0, top: 25, width: 1400, height: 800 });
    expect(rects[2]).toEqual({ left: CASCADE_STEP, top: 25 + CASCADE_STEP, width: 1400, height: 800 });
    for (const rect of rects) {
      expect(rect.left + rect.width).toBeLessThanOrEqual(screen.left + screen.width);
      expect(rect.top + rect.height).toBeLessThanOrEqual(screen.top + screen.height);
    }
  });

  it('shrinks a window larger than the screen to it', () => {
    expect(tileWindows([{ width: 3840, height: 2160 }], screen)).toEqual([
      { left: 0, top: 25, width: 1440, height: 875 },
    ]);
  });

  it('starts on the screen the workspace is on', () => {
    const second = { left: 1440, top: 0, width: 1920, height: 1050 };
    expect(tileWindows([{ width: 400, height: 800 }], second)[0]).toEqual({
      left: 1440,
      top: 0,
      width: 400,
      height: 800,
    });
  });
});

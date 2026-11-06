import { describe, expect, it } from 'vitest';
import {
  INPUT_ZOOM_MAX_WIDTH,
  MIN_FIELD_FONT_PX,
  blocksFocusZoom,
  fieldFontText,
  formatOrder,
  isFlexDisplay,
  isGridDisplay,
  isReordered,
  reorderCauses,
  takesTypedText,
  visualOrder,
  zoomsOnFocus,
  type OrderContainerStyle,
  type OrderItemStyle,
  type OrderRect,
} from '../../src/agent/page-utils';
import { CHECK_KINDS, type CheckIssue, type CheckKind } from '../../src/agent/protocol';
import { createTranslator } from '../../src/i18n/translate';
import { issueCell } from '../../src/state/audit';
import { CHECK_HINT_KEYS, CHECK_KIND_KEYS, canHighlight, issueDetail, issueValue } from '../../src/state/checks';
import { isProCheck } from '../../src/state/plan';
import { rangesOf, type ScanSample } from '../../src/state/scan';
import { SCORE_WEIGHTS, scoreIssues } from '../../src/state/score';

const t = createTranslator('en');
const vi = createTranslator('vi');

describe('fields that make iPhones zoom in: the logic', () => {
  it('zooms in on text under 16px', () => {
    expect(MIN_FIELD_FONT_PX).toBe(16);
    expect(INPUT_ZOOM_MAX_WIDTH).toBe(600);
    expect(zoomsOnFocus(15)).toBe(true);
    expect(zoomsOnFocus(13.333)).toBe(true);
    expect(zoomsOnFocus(15.9)).toBe(true);
    expect(zoomsOnFocus(16)).toBe(false);
    expect(zoomsOnFocus(18)).toBe(false);
    // 1.6rem on a 10px root: rounding noise isn't small text.
    expect(zoomsOnFocus(15.999999)).toBe(false);
  });

  it('leaves out text that is hidden or unknown', () => {
    expect(zoomsOnFocus(0)).toBe(false);
    expect(zoomsOnFocus(0.5)).toBe(false);
    expect(zoomsOnFocus(Number.NaN)).toBe(false);
    expect(zoomsOnFocus(Number.POSITIVE_INFINITY)).toBe(false);
    expect(zoomsOnFocus(1)).toBe(true);
  });

  it('writes the size rounded down, so it never reads 16px', () => {
    expect(fieldFontText(14)).toBe('14px');
    expect(fieldFontText(13.333)).toBe('13.3px');
    expect(fieldFontText(15.95)).toBe('15.9px');
    expect(fieldFontText(13.99999)).toBe('14px');
    expect(fieldFontText(12.5)).toBe('12.5px');
  });

  it('only counts inputs people type in', () => {
    for (const type of ['text', 'email', 'search', 'password', 'number', 'tel', 'url', 'date', 'time'])
      expect(takesTypedText(type), type).toBe(true);
    for (const type of ['hidden', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'button', 'reset', 'image'])
      expect(takesTypedText(type), type).toBe(false);
    expect(takesTypedText(' CHECKBOX ')).toBe(false);
  });

  it('knows when the viewport tag keeps Safari from zooming in', () => {
    expect(blocksFocusZoom('width=device-width, initial-scale=1, maximum-scale=1')).toBe(true);
    expect(blocksFocusZoom('width=device-width,maximum-scale=1.0')).toBe(true);
    expect(blocksFocusZoom('maximum-scale = 0.8; width=device-width')).toBe(true);
    expect(blocksFocusZoom('width=device-width, MAXIMUM-SCALE=1')).toBe(true);
    expect(blocksFocusZoom('width=device-width, initial-scale=1')).toBe(false);
    expect(blocksFocusZoom('width=device-width, maximum-scale=5')).toBe(false);
    expect(blocksFocusZoom('width=device-width, user-scalable=no')).toBe(false);
    expect(blocksFocusZoom('width=device-width, minimum-scale=1')).toBe(false);
    expect(blocksFocusZoom('')).toBe(false);
  });
});

const container = (style: Partial<OrderContainerStyle>): OrderContainerStyle => ({
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'nowrap',
  gridAutoFlow: 'row',
  ...style,
});
const item = (style: Partial<OrderItemStyle> = {}): OrderItemStyle => ({
  order: '0',
  gridRowStart: 'auto',
  gridColumnStart: 'auto',
  ...style,
});

describe('order on screen and in the HTML: what reorders', () => {
  it('tells flex and grid containers apart', () => {
    expect(isFlexDisplay('flex')).toBe(true);
    expect(isFlexDisplay('inline-flex')).toBe(true);
    expect(isFlexDisplay('block flex')).toBe(true);
    expect(isFlexDisplay('grid')).toBe(false);
    expect(isFlexDisplay('flow-root')).toBe(false);
    expect(isGridDisplay('grid')).toBe(true);
    expect(isGridDisplay('inline-grid')).toBe(true);
    expect(isGridDisplay('block')).toBe(false);
    expect(isGridDisplay('contents')).toBe(false);
  });

  it('finds order, reversed directions and wrap in flex containers', () => {
    expect(reorderCauses(container({}), [item(), item()])).toEqual([]);
    expect(reorderCauses(container({}), [item(), item({ order: '-1' })])).toEqual(['order']);
    expect(reorderCauses(container({ flexDirection: 'row-reverse' }), [item(), item()])).toEqual(['row-reverse']);
    expect(reorderCauses(container({ flexDirection: 'column-reverse' }), [item()])).toEqual(['column-reverse']);
    expect(reorderCauses(container({ flexWrap: 'wrap-reverse' }), [item()])).toEqual(['wrap-reverse']);
    expect(
      reorderCauses(container({ display: 'inline-flex', flexDirection: 'row-reverse' }), [item({ order: '2' })]),
    ).toEqual(['order', 'row-reverse']);
    // Grid placement means nothing in a flex container.
    expect(reorderCauses(container({}), [item({ gridRowStart: '2' })])).toEqual([]);
  });

  it('finds grid placement and dense packing in grid containers', () => {
    const grid = container({ display: 'grid', flexDirection: 'row-reverse' });
    // A reversed flex direction means nothing in a grid.
    expect(reorderCauses(grid, [item(), item()])).toEqual([]);
    expect(reorderCauses(grid, [item(), item({ gridRowStart: '1' })])).toEqual(['grid placement']);
    expect(reorderCauses(grid, [item({ gridColumnStart: '-1' })])).toEqual(['grid placement']);
    // grid-area: sidebar
    expect(reorderCauses(grid, [item({ gridRowStart: 'sidebar', gridColumnStart: 'sidebar' })])).toEqual([
      'grid placement',
    ]);
    // A span alone is still placed automatically.
    expect(reorderCauses(grid, [item({ gridColumnStart: 'span 2' })])).toEqual([]);
    expect(reorderCauses(container({ display: 'grid', gridAutoFlow: 'row dense' }), [item()])).toEqual(['dense']);
    expect(reorderCauses(container({ display: 'inline-grid', gridAutoFlow: 'dense' }), [item()])).toEqual(['dense']);
    expect(reorderCauses(grid, [item({ order: '1' }), item({ gridRowStart: '3' })])).toEqual([
      'order',
      'grid placement',
    ]);
  });

  it('ignores other containers and odd values', () => {
    expect(
      reorderCauses(container({ display: 'block', flexDirection: 'row-reverse' }), [item({ order: '1' })]),
    ).toEqual([]);
    expect(reorderCauses(container({}), [item({ order: '' }), item({ order: 'auto' })])).toEqual([]);
  });
});

/** Boxes of `width`×`height` at (x, y). */
const box = (x: number, y: number, width = 100, height = 50): OrderRect => ({
  left: x,
  top: y,
  right: x + width,
  bottom: y + height,
});

describe('order on screen and in the HTML: the order seen', () => {
  it('reads a row left to right, and right to left in RTL', () => {
    const row = [box(0, 0), box(100, 0), box(200, 0)];
    expect(visualOrder(row)).toEqual([0, 1, 2]);
    expect(visualOrder(row, { rtl: true })).toEqual([2, 1, 0]);
    // row-reverse: the first item in the HTML is on the right.
    const reversed = [box(200, 0), box(100, 0), box(0, 0)];
    expect(visualOrder(reversed)).toEqual([2, 1, 0]);
    expect(visualOrder(reversed, { rtl: true })).toEqual([0, 1, 2]);
  });

  it('reads rows top to bottom', () => {
    // Two rows of two; the second row's first box is first in the HTML.
    const rects = [box(0, 60), box(0, 0), box(100, 0), box(100, 60)];
    expect(visualOrder(rects)).toEqual([1, 2, 0, 3]);
  });

  it('keeps boxes of different heights on their row', () => {
    // align-items: center — a tall box, a short one and a medium one share a row.
    const rects = [box(0, 0, 100, 100), box(100, 40, 100, 20), box(200, 25, 100, 50), box(0, 120)];
    expect(visualOrder(rects)).toEqual([0, 1, 2, 3]);
    // align-items: flex-end
    expect(visualOrder([box(0, 0, 100, 100), box(100, 80, 100, 20), box(0, 110)])).toEqual([0, 1, 2]);
  });

  it('keeps a box that spans rows in its first row', () => {
    // A sidebar along every row, then cards in two columns.
    const sidebar = box(0, 0, 100, 300);
    const cards = [box(100, 0), box(200, 0), box(100, 100), box(200, 100), box(100, 200), box(200, 200)];
    expect(visualOrder([sidebar, ...cards])).toEqual([0, 1, 2, 3, 4, 5, 6]);
    // The sidebar last in the HTML is read first.
    expect(visualOrder([...cards, sidebar])).toEqual([6, 0, 1, 2, 3, 4, 5]);
    // A box spanning two rows in the second column.
    expect(visualOrder([box(0, 0, 100, 100), box(100, 0, 100, 200), box(0, 100, 100, 100)])).toEqual([0, 1, 2]);
  });

  it('doesn’t merge rows that touch or overlap a little', () => {
    // Negative margins pull the second row 4px up.
    const rects = [box(0, 0), box(100, 0), box(0, 46), box(100, 46)];
    expect(visualOrder(rects)).toEqual([0, 1, 2, 3]);
    expect(visualOrder([box(100, 46), box(0, 46), box(0, 0), box(100, 0)])).toEqual([2, 3, 1, 0]);
  });

  it('reads column flex containers by columns', () => {
    expect(visualOrder([box(0, 100), box(0, 50), box(0, 0)], { columns: true })).toEqual([2, 1, 0]);
    // Items of different widths are one column.
    expect(visualOrder([box(0, 0, 300), box(0, 50, 100), box(0, 100, 200)], { columns: true })).toEqual([0, 1, 2]);
    // Wrapped into two columns: down the first, then the second.
    const wrapped = [box(0, 0), box(0, 50), box(100, 0), box(100, 50)];
    expect(visualOrder(wrapped, { columns: true })).toEqual([0, 1, 2, 3]);
    expect(visualOrder(wrapped)).toEqual([0, 2, 1, 3]);
    // Right to left, the right column comes first.
    expect(visualOrder(wrapped, { columns: true, rtl: true })).toEqual([2, 3, 0, 1]);
  });

  it('keeps HTML order for boxes in the same place, and ignores sub-pixel differences', () => {
    // Slides stacked in one grid cell.
    expect(visualOrder([box(0, 0), box(0, 0), box(0, 0)])).toEqual([0, 1, 2]);
    expect(visualOrder([box(0.4, 0.3), box(0, 0)])).toEqual([0, 1]);
    expect(visualOrder([])).toEqual([]);
    expect(visualOrder([box(10, 10)])).toEqual([0]);
  });
});

describe('order on screen and in the HTML: reporting', () => {
  it('tells when the order seen isn’t the HTML’s', () => {
    expect(isReordered([])).toBe(false);
    expect(isReordered([0])).toBe(false);
    expect(isReordered([0, 1, 2])).toBe(false);
    expect(isReordered([1, 0, 2])).toBe(true);
    expect(isReordered([2, 1, 0])).toBe(true);
    expect(isReordered([0, 2, 1])).toBe(true);
    // Positions that skip some items are still in order.
    expect(isReordered([0, 3, 7])).toBe(false);
  });

  it('writes the HTML positions in the order seen', () => {
    expect(formatOrder([1, 0, 2])).toBe('2, 1, 3');
    expect(formatOrder([2, 1, 0], 2)).toBe('3, 2, …');
    expect(formatOrder([9, 8, 7, 6, 5, 4, 3, 2, 1, 0])).toBe('10, 9, 8, 7, 6, 5, 4, 3, …');
    expect(formatOrder([])).toBe('');
  });
});

describe('v0.14 checks: wiring', () => {
  const kinds: CheckKind[] = ['input-zoom', 'visual-order'];
  const issue = (kind: CheckKind, count: number, detail?: string): CheckIssue => ({ kind, count, detail, samples: [] });

  it('are free checks, shown after long lines and before the Pro ones', () => {
    expect(CHECK_KINDS.indexOf('input-zoom')).toBe(CHECK_KINDS.indexOf('long-lines') + 1);
    expect(CHECK_KINDS.indexOf('visual-order')).toBe(CHECK_KINDS.indexOf('input-zoom') + 1);
    expect(CHECK_KINDS.indexOf('visual-order')).toBeLessThan(CHECK_KINDS.indexOf('missing-alt'));
    for (const kind of kinds) {
      expect(isProCheck(kind)).toBe(false);
      expect(canHighlight(kind)).toBe(true);
    }
  });

  it('are named and explained in English and Vietnamese', () => {
    expect(t(CHECK_KIND_KEYS['input-zoom'])).toBe('Fields that make iPhones zoom in');
    expect(t(CHECK_KIND_KEYS['visual-order'])).toBe('Order on screen differs from the HTML');
    expect(t(CHECK_HINT_KEYS['input-zoom'])).toContain('Safari on iPhone zooms in');
    expect(t(CHECK_HINT_KEYS['visual-order'])).toContain('WCAG 1.3.2, 2.4.3');
    for (const kind of kinds) {
      expect(vi(CHECK_KIND_KEYS[kind])).not.toBe(t(CHECK_KIND_KEYS[kind]));
      expect(vi(CHECK_HINT_KEYS[kind])).not.toBe(t(CHECK_HINT_KEYS[kind]));
    }
  });

  it('cost 4 points each', () => {
    expect(SCORE_WEIGHTS['input-zoom']).toBe(4);
    expect(SCORE_WEIGHTS['visual-order']).toBe(4);
    expect(scoreIssues([[issue('input-zoom', 2, '14px')], [], [], []])).toMatchObject({
      score: 99,
      costs: [{ kind: 'input-zoom', points: 1, sizes: 1 }],
    });
    expect(
      scoreIssues([[issue('visual-order', 1), issue('input-zoom', 1, '15px')], [issue('visual-order', 2)]]),
    ).toMatchObject({
      score: 94,
      costs: [
        { kind: 'visual-order', points: 4, sizes: 2 },
        { kind: 'input-zoom', points: 2, sizes: 1 },
      ],
    });
  });

  it('say how small the fields’ text is', () => {
    expect(issueValue(issue('input-zoom', 3, '14px'), t)).toBe('3 elements · smallest 14px');
    expect(issueValue(issue('input-zoom', 1, '13.3px'), t)).toBe('1 element · smallest 13.3px');
    expect(issueValue(issue('input-zoom', 2), t)).toBe('2 elements');
    expect(issueDetail(issue('input-zoom', 3, '14px'), t)).toBe('3 form fields with text as small as 14px');
    expect(issueDetail(issue('input-zoom', 1, '15px'), t)).toBe('1 form field with 15px text');
    expect(issueDetail(issue('input-zoom', 2), t)).toBe('2 elements');
    expect(issueCell(issue('input-zoom', 3, '14px'))).toBe('3 · 14px');
    expect(issueCell(issue('input-zoom', 2))).toBe('2');
    // The decimal separator of the UI language.
    expect(issueDetail(issue('input-zoom', 1, '13.3px'), vi)).toBe('1 trường nhập có chữ 13,3px');
  });

  it('count the containers shown out of order', () => {
    expect(issueValue(issue('visual-order', 2), t)).toBe('2 containers');
    expect(issueValue(issue('visual-order', 1), t)).toBe('1 container');
    expect(issueDetail(issue('visual-order', 2), t)).toBe(
      '2 flex or grid containers show their items out of HTML order',
    );
    expect(issueDetail(issue('visual-order', 1), t)).toBe('1 flex or grid container shows its items out of HTML order');
    expect(issueCell(issue('visual-order', 2))).toBe('2');
  });

  it('are worst where field text is smallest, or most containers are out of order, in a width scan', () => {
    const at = (width: number, value: CheckIssue): ScanSample => ({ width, height: 2000, issues: [value] });
    const [zoom] = rangesOf(
      [
        at(320, issue('input-zoom', 1, '13px')),
        at(375, issue('input-zoom', 4, '12.5px')),
        at(414, issue('input-zoom', 6, '14px')),
      ],
      'input-zoom',
    );
    expect(zoom).toMatchObject({ from: 320, to: 414, peak: { width: 375 } });
    const [order] = rangesOf(
      [at(768, issue('visual-order', 1)), at(1024, issue('visual-order', 3)), at(1280, issue('visual-order', 2))],
      'visual-order',
    );
    expect(order).toMatchObject({ from: 768, to: 1280, peak: { width: 1024 } });
  });
});

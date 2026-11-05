import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MarkupDialog } from '../../src/components/MarkupDialog/MarkupDialog';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import {
  addMark,
  arrowHead,
  canRedo,
  canUndo,
  constrainBox,
  constrainLine,
  createHistory,
  distanceToSegment,
  hitTest,
  nextStepNumber,
  pixelateGrid,
  push,
  redo,
  removeMark,
  undo,
  type Mark,
} from '../../src/state/markup';

vi.mock('../../src/services/markup-render', async (original) => ({
  ...(await original<typeof import('../../src/services/markup-render')>()),
  loadMarkupImage: vi.fn(async () => ({ image: {} as CanvasImageSource, width: 800, height: 600 })),
  renderMarkup: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));

const arrow = (id: string): Mark => ({
  id,
  kind: 'arrow',
  color: 'red',
  size: 'medium',
  from: { x: 0, y: 0 },
  to: { x: 100, y: 0 },
});
const step = (id: string, number: number): Mark => ({
  id,
  kind: 'step',
  color: 'red',
  size: 'medium',
  at: { x: 50, y: 50 },
  number,
});

describe('markup state', () => {
  it('undoes and redoes the marks, and a new mark clears redo', () => {
    let history = createHistory();
    history = push(history, addMark(history.present, arrow('a')));
    history = push(history, addMark(history.present, arrow('b')));
    expect(history.present.map((mark) => mark.id)).toEqual(['a', 'b']);
    history = undo(history);
    expect(history.present.map((mark) => mark.id)).toEqual(['a']);
    expect(canRedo(history)).toBe(true);
    history = redo(history);
    expect(history.present).toHaveLength(2);
    history = undo(history);
    history = push(history, removeMark(history.present, 'a'));
    expect(history.present).toEqual([]);
    expect(canRedo(history)).toBe(false);
    expect(canUndo(createHistory())).toBe(false);
  });

  it('numbers steps after the highest one', () => {
    expect(nextStepNumber([])).toBe(1);
    expect(nextStepNumber([step('a', 1), step('b', 4), arrow('c')])).toBe(5);
  });

  it('finds the mark under the pointer, the topmost first', () => {
    const marks = [arrow('line'), step('dot', 1)];
    expect(hitTest(marks, { x: 50, y: 3 }, 6)).toBe('line');
    expect(hitTest(marks, { x: 50, y: 50 }, 6)).toBe('dot');
    expect(hitTest(marks, { x: 300, y: 300 }, 6)).toBeNull();
    expect(distanceToSegment({ x: 50, y: 10 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(10);
  });

  it('keeps lines at 45° steps and boxes square with Shift', () => {
    const line = constrainLine({ x: 0, y: 0 }, { x: 100, y: 10 });
    expect(line.y).toBe(0);
    const diagonal = constrainLine({ x: 0, y: 0 }, { x: 100, y: 90 });
    expect(Math.abs(diagonal.x)).toBeCloseTo(Math.abs(diagonal.y), 0);
    const box = constrainBox({ x: 0, y: 0 }, { x: 100, y: 40 });
    expect(Math.abs(box.x)).toBe(Math.abs(box.y));
  });

  it('draws an arrowhead at the tip and cuts a pixelated area into blocks', () => {
    const head = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 5);
    expect(head.tip).toEqual({ x: 100, y: 0 });
    expect(head.base.x).toBeLessThan(100);
    expect(head.left.y).toBeCloseTo(-head.right.y);
    const grid = pixelateGrid({ x: 10, y: 10, width: -120, height: 60 }, 12);
    expect(grid.rect).toEqual({ x: -110, y: 10, width: 120, height: 60 });
    expect([grid.cols, grid.rows]).toEqual([10, 5]);
    expect(pixelateGrid({ x: 0, y: 0, width: 3, height: 3 }, 12)).toMatchObject({ cols: 1, rows: 1 });
  });
});

const wrap = (ui: ReactNode) => render(<I18nProvider language="en">{ui}</I18nProvider>);
const IMAGE = { url: 'blob:test', width: 800, height: 600, name: 'shot.png' };

describe('markup dialog', () => {
  it('says it is capturing until the image is there', () => {
    wrap(<MarkupDialog open image={null} onClose={vi.fn()} onSave={vi.fn()} onCopy={vi.fn()} />);
    expect(screen.getByTestId('markup-capturing')).toHaveTextContent('Capturing the previews…');
  });

  it('has tools, colours and widths as radio groups, and an image named by its marks', async () => {
    wrap(<MarkupDialog open image={IMAGE} onClose={vi.fn()} onSave={vi.fn()} onCopy={vi.fn()} />);
    const tools = screen.getByRole('radiogroup', { name: 'Drawing tools' });
    expect(tools).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Arrow' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Numbered step' }));
    expect(screen.getByRole('radio', { name: 'Numbered step' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radiogroup', { name: 'Colour' })).toBeInTheDocument();
    expect(screen.getByTestId('markup-canvas')).toHaveAccessibleName('Screenshot, no marks yet');
    expect(screen.getByTestId('markup-undo')).toBeDisabled();
    expect(screen.getByTestId('markup-redo')).toBeDisabled();
  });

  it('saves and copies the rendered image', async () => {
    const onSave = vi.fn();
    const onCopy = vi.fn();
    wrap(<MarkupDialog open image={IMAGE} onClose={vi.fn()} onSave={onSave} onCopy={onCopy} />);
    // The image is decoded asynchronously before the buttons work.
    await vi.waitFor(() => expect(screen.getByTestId('markup-save')).toBeEnabled());
    await userEvent.click(screen.getByTestId('markup-save'));
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.any(Blob), 'shot.png'));
    await userEvent.click(screen.getByTestId('markup-copy'));
    await vi.waitFor(() => expect(onCopy).toHaveBeenCalledWith(expect.any(Blob)));
  });
});

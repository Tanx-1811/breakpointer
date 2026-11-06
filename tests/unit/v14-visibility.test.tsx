import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { HiddenElement, ShownState } from '../../src/agent/protocol';
import { AuditPanel, AUDIT_TABS, type AuditRow } from '../../src/components/AuditPanel/AuditPanel';
import { VisibilityTab } from '../../src/components/AuditPanel/VisibilityTab';
import { PlanProvider } from '../../src/components/Plan/PlanContext';
import { en } from '../../src/i18n/en';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import { createTranslator } from '../../src/i18n/translate';
import { EXPLAIN_TOPICS, topicFor } from '../../src/state/explain';
import { FREE_ENTITLEMENT } from '../../src/state/license';
import {
  answeredColumns,
  summaryText,
  unionHidden,
  visibilityMarkdown,
  visibilityRows,
  visibilitySummary,
  type CellState,
  type VisibilityReport,
} from '../../src/state/visibility';

const t = createTranslator('en');

function wrap(ui: ReactNode) {
  return render(
    <I18nProvider language="en">
      <PlanProvider value={{ entitlement: FREE_ENTITLEMENT, upgrade: vi.fn() }}>{ui}</PlanProvider>
    </I18nProvider>,
  );
}

const burger: HiddenElement = {
  selector: 'body > header:nth-of-type(1) > button:nth-of-type(1)',
  label: 'header > button.burger',
};
const nav: HiddenElement = {
  selector: 'body > header:nth-of-type(1) > nav:nth-of-type(1)',
  label: 'header > nav.desktop-nav',
};
const tablet: HiddenElement = { selector: 'body > aside:nth-of-type(1)', label: 'aside.tablet-only' };
const modal: HiddenElement = { selector: '#modal', label: 'div#modal' };
const items = [burger, nav, tablet, modal];

/** A preview's answer about `items`, in order. */
const report = (...states: ShownState[]): VisibilityReport => ({ items, states });

// Narrowest first: burger until 767, the desktop nav from 1024, the aside only at tablet sizes, the modal never.
const phone = {
  id: 'p',
  name: 'Phone',
  width: 375,
  height: 667,
  visibility: report('shown', 'hidden', 'hidden', 'hidden'),
};
const tab = {
  id: 't',
  name: 'Tablet',
  width: 768,
  height: 1024,
  visibility: report('hidden', 'hidden', 'shown', 'hidden'),
};
const laptop = {
  id: 'l',
  name: 'Laptop',
  width: 1366,
  height: 768,
  visibility: report('hidden', 'shown', 'hidden', 'hidden'),
};

const cells = (...pairs: [number, CellState][]) => pairs.map(([width, state]) => ({ width, state }));

describe('unionHidden', () => {
  it('lists each element once, the first label winning, taking from each preview in turn', () => {
    const a = [burger, modal, { selector: '#a', label: 'div#a' }];
    const b = [{ ...burger, label: 'other' }, nav];
    expect(unionHidden([a, null, b]).map((item) => item.selector)).toEqual([
      burger.selector,
      modal.selector,
      nav.selector,
      '#a',
    ]);
    expect(unionHidden([a, b])[0]).toEqual(burger);
    // Every preview gets its share under the limit.
    expect(unionHidden([a, b], 2).map((item) => item.selector)).toEqual([burger.selector, modal.selector]);
    expect(unionHidden([a, [nav]], 2).map((item) => item.selector)).toEqual([burger.selector, nav.selector]);
  });

  it('ignores answers that aren’t elements', () => {
    const odd = [
      { selector: '', label: 'x' },
      { label: 'y' },
      null,
      { selector: '#b', label: '' },
    ] as unknown as HiddenElement[];
    expect(unionHidden([odd])).toEqual([{ selector: '#b', label: '#b' }]);
    expect(unionHidden([])).toEqual([]);
  });
});

describe('visibilitySummary', () => {
  it('names the width where an element starts or stops being shown', () => {
    expect(visibilitySummary(cells([375, 'hidden'], [768, 'hidden'], [1024, 'shown'], [1440, 'shown']))).toEqual({
      kind: 'shownFrom',
      width: 1024,
    });
    expect(visibilitySummary(cells([375, 'shown'], [768, 'hidden'], [1440, 'missing']))).toEqual({
      kind: 'hiddenFrom',
      width: 768,
    });
  });

  it('names a band of widths shown or hidden between others', () => {
    expect(visibilitySummary(cells([375, 'hidden'], [768, 'shown'], [1024, 'shown'], [1440, 'hidden']))).toEqual({
      kind: 'shownBetween',
      from: 768,
      to: 1024,
    });
    expect(visibilitySummary(cells([375, 'shown'], [768, 'missing'], [1440, 'shown']))).toEqual({
      kind: 'hiddenBetween',
      from: 768,
      to: 768,
    });
  });

  it('counts previews when no width rule fits, and leaves unknown ones out', () => {
    expect(visibilitySummary(cells([375, 'shown'], [768, 'hidden'], [1024, 'shown'], [1440, 'hidden']))).toEqual({
      kind: 'some',
      shown: 2,
      total: 4,
    });
    // Two previews of the same width that differ (another height, or a comparison).
    expect(visibilitySummary(cells([375, 'hidden'], [768, 'shown'], [768, 'hidden']))).toEqual({
      kind: 'some',
      shown: 1,
      total: 3,
    });
    expect(visibilitySummary(cells([1440, 'shown'], [375, 'hidden'], [768, 'unknown']))).toEqual({
      kind: 'shownFrom',
      width: 1440,
    });
  });

  it('says it in words', () => {
    expect(summaryText({ kind: 'shownFrom', width: 1024 }, t)).toBe('Shown from 1024 px');
    expect(summaryText({ kind: 'hiddenFrom', width: 768 }, t)).toBe('Hidden from 768 px');
    expect(summaryText({ kind: 'shownBetween', from: 768, to: 768 }, t)).toBe('Shown only at 768 px');
    expect(summaryText({ kind: 'shownBetween', from: 768, to: 1024 }, t)).toBe('Shown only at 768–1024 px');
    expect(summaryText({ kind: 'hiddenBetween', from: 768, to: 768 }, t)).toBe('Hidden only at 768 px');
    expect(summaryText({ kind: 'hiddenBetween', from: 600, to: 768 }, t)).toBe('Hidden only at 600–768 px');
    expect(summaryText({ kind: 'some', shown: 2, total: 4 }, t)).toBe('Shown in 2 of 4 previews');
  });
});

describe('visibilityRows', () => {
  it('keeps the elements shown in some previews and hidden in others, by the width where they switch', () => {
    // Given widest first: the columns are sorted by width.
    const rows = visibilityRows([laptop, phone, tab]);
    expect(rows.map((row) => row.label)).toEqual([
      'header > button.burger',
      'aside.tablet-only',
      'header > nav.desktop-nav',
    ]);
    expect(rows.map((row) => row.switchAt)).toEqual([768, 768, 1366]);
    expect(rows[0]!.states).toEqual({ p: 'shown', t: 'hidden', l: 'hidden' });
    expect(rows.map((row) => summaryText(row.summary, t))).toEqual([
      'Hidden from 768 px',
      'Shown only at 768 px',
      'Shown from 1366 px',
    ]);
  });

  it('leaves out previews that didn’t answer, and needs two that did', () => {
    const missing = { id: 'x', name: 'Wide', width: 1920, height: 1080, visibility: null };
    const pending = { id: 'y', name: 'Small', width: 320, height: 568 };
    expect(answeredColumns([laptop, missing, phone, pending]).map((column) => column.id)).toEqual(['p', 'l']);
    expect(visibilityRows([phone, missing])).toEqual([]);
    const rows = visibilityRows([phone, missing, laptop]);
    expect(Object.keys(rows[0]!.states)).toEqual(['p', 'l']);
  });

  it('counts an element missing from a preview as not shown, and an unknown one as nothing', () => {
    const extra: HiddenElement = { selector: '#late', label: 'div#late' };
    const a = { id: 'a', name: 'A', width: 375, height: 667, visibility: { items: [extra], states: ['missing'] } };
    const b = { id: 'b', name: 'B', width: 1024, height: 768, visibility: { items: [extra], states: ['shown'] } };
    // Asked before this element was found: no answer about it.
    const c = { id: 'c', name: 'C', width: 1440, height: 900, visibility: { items: [], states: [] } };
    const [row] = visibilityRows([a, b, c] as never);
    expect(row!.states).toEqual({ a: 'missing', b: 'shown', c: 'unknown' });
    expect(summaryText(row!.summary, t)).toBe('Shown from 1024 px');
    // Shown wherever it is known: not a row.
    const d = { ...a, visibility: { items: [extra], states: ['shown'] } };
    expect(visibilityRows([d, b, c] as never)).toEqual([]);
  });
});

describe('visibilityMarkdown', () => {
  it('writes the matrix narrowest first, with a legend', () => {
    const markdown = visibilityMarkdown('https://example.com/', [laptop, phone, tab], t);
    expect(markdown).toBe(
      [
        '**Visibility** · https://example.com/',
        '',
        '| Element | Phone (375px) | Tablet (768px) | Laptop (1366px) | When it’s shown |',
        '| --- | --- | --- | --- | --- |',
        '| `header > button.burger` | ✓ | – | – | Hidden from 768 px |',
        '| `aside.tablet-only` | – | ✓ | – | Shown only at 768 px |',
        '| `header > nav.desktop-nav` | – | – | ✓ | Shown from 1366 px |',
        '',
        '✓ shown · – hidden · ∅ not on the page · ? not measured',
        '',
      ].join('\n'),
    );
  });

  it('says when nothing changes, or what couldn’t be read', () => {
    const same = { ...tab, visibility: report('shown', 'hidden', 'hidden', 'hidden') };
    const none = { id: 'n', name: 'Wide', width: 1920, height: 1080, visibility: null };
    expect(visibilityMarkdown('p', [phone, same, none], t)).toBe(
      '**Visibility** · p\n\nNo element is shown in some previews and hidden in others.\n\nNot read: Wide\n',
    );
    expect(visibilityMarkdown('p', [phone, none], t)).toContain('Only one preview could be read');
    expect(visibilityMarkdown('p', [none], t)).toContain('No preview could be read');
  });
});

describe('VisibilityTab', () => {
  it('sums up, shows the matrix with a mark and words in every cell, and inspects a row', async () => {
    const onInspect = vi.fn();
    const none = { id: 'n', name: 'Wide', width: 1920, height: 1080, visibility: null };
    wrap(<VisibilityTab rows={[laptop, none, phone, tab]} measuring={false} onInspect={onInspect} />);
    expect(screen.getByTestId('visibility-summary')).toHaveTextContent('3 elements change between sizes');
    expect(screen.getByTestId('visibility-not-read')).toHaveTextContent('Not read: Wide');
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(legend).toHaveTextContent('shown');
    expect(legend).toHaveTextContent('hidden');
    expect(legend).not.toHaveTextContent('not on the page');

    const table = screen.getByRole('table', { name: 'What each preview shows' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Element', 'Phone375', 'Tablet768', 'Laptop1366', 'Actions']);
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual([
      'header > button.burgerHidden from 768 px',
      'aside.tablet-onlyShown only at 768 px',
      'header > nav.desktop-navShown from 1366 px',
    ]);
    const [first] = screen.getAllByTestId('visibility-row');
    expect(within(first!).getByText('Phone: shown')).toBeInTheDocument();
    expect(within(first!).getByText('Laptop: hidden')).toBeInTheDocument();
    expect(
      within(first!)
        .getAllByTestId('visibility-cell')
        .map((cell) => cell.dataset.state),
    ).toEqual(['shown', 'hidden', 'hidden']);
    // The matrix scrolls sideways on its own and can be reached with the keyboard.
    expect(screen.getByRole('region', { name: 'What each preview shows' })).toHaveAttribute('tabindex', '0');

    await userEvent.click(screen.getByRole('button', { name: 'Inspect header > nav.desktop-nav at every size' }));
    expect(onInspect).toHaveBeenCalledWith(nav.selector);
  });

  it('marks elements not on the page, and has no action column without a callback', () => {
    const extra: HiddenElement = { selector: '#late', label: 'div#late' };
    const a = {
      id: 'a',
      name: 'A',
      width: 375,
      height: 667,
      visibility: { items: [extra], states: ['missing' as const] },
    };
    const b = {
      id: 'b',
      name: 'B',
      width: 1024,
      height: 768,
      visibility: { items: [extra], states: ['shown' as const] },
    };
    wrap(<VisibilityTab rows={[a, b]} measuring={false} />);
    expect(screen.getByTestId('visibility-summary')).toHaveTextContent('1 element changes between sizes');
    expect(screen.getByText('A: not on the page')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Legend' })).toHaveTextContent('not on the page');
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Inspect/ })).toBeNull();
  });

  it('waits, explains, or says nothing changes', () => {
    const pending = { id: 'p', name: 'Phone', width: 375, height: 667 };
    const waiting = wrap(<VisibilityTab rows={[pending]} measuring={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Measuring');
    waiting.unmount();

    const blocked = wrap(<VisibilityTab rows={[{ ...pending, visibility: null }]} measuring={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('No preview could be read');
    blocked.unmount();

    const one = wrap(<VisibilityTab rows={[phone, { ...tab, visibility: null }]} measuring={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Only one preview could be read');
    expect(screen.getByTestId('visibility-not-read')).toHaveTextContent('Not read: Tablet');
    one.unmount();

    const same = { ...tab, visibility: report('shown', 'hidden', 'hidden', 'hidden') };
    wrap(<VisibilityTab rows={[phone, same]} measuring={false} />);
    expect(screen.getByTestId('visibility-summary')).toHaveTextContent(
      'No element is shown in some previews and hidden in others.',
    );
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('AuditPanel visibility tab', () => {
  const props = (extra: Partial<Parameters<typeof AuditPanel>[0]> = {}) => ({
    tab: 'visibility' as const,
    onTab: vi.fn(),
    rows: [phone, tab, laptop].map((row): AuditRow => ({ ...row, report: null, stats: null, type: null })),
    checksOn: true,
    highlights: {},
    needsAccess: false,
    host: 'example.com',
    busy: false,
    measuring: false,
    locale: 'en',
    onHighlight: vi.fn(),
    onReveal: vi.fn(),
    onRefresh: vi.fn(),
    onCopy: vi.fn(),
    onTurnOnChecks: vi.fn(),
    onAllowSite: vi.fn(),
    onClose: vi.fn(),
    ...extra,
  });

  it('is the eighth tab, shown with its label, and passes the inspect callback on', async () => {
    const onInspect = vi.fn();
    const onTab = vi.fn();
    wrap(<AuditPanel {...props({ onInspect, onTab })} />);
    expect(AUDIT_TABS).toHaveLength(8);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.at(-1)).toHaveAttribute('aria-label', 'Visibility');
    expect(screen.getByRole('tab', { name: 'Visibility' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('visibility-tab')).toBeVisible();
    // Measured again on request, like the other measured tabs.
    expect(screen.getByRole('button', { name: 'Measure again' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Inspect header > button.burger at every size' }));
    expect(onInspect).toHaveBeenCalledWith(burger.selector);
    // Arrow keys wrap around the tabs.
    screen.getByRole('tab', { name: 'Visibility' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onTab).toHaveBeenCalledWith('issues');
  });

  it('is explained in “What’s this?”, before the panel itself', () => {
    wrap(<AuditPanel {...props()} />);
    const topic = topicFor(screen.getByTestId('visibility-table'));
    expect(topic?.body).toBe('visibility.explain');
    expect(en[topic!.body]).toContain('hidden in others');
    const index = (selector: string) => EXPLAIN_TOPICS.findIndex((item) => item.selector.includes(selector));
    expect(index('visibility-tab')).toBeLessThan(index('"audit"'));
  });
});

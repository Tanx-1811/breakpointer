import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { MediaQueryReport } from '../../src/agent/protocol';
import { AuditPanel, AUDIT_TABS, type AuditRow } from '../../src/components/AuditPanel/AuditPanel';
import { MediaTab } from '../../src/components/AuditPanel/MediaTab';
import { PlanProvider } from '../../src/components/Plan/PlanContext';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import { FREE_ENTITLEMENT } from '../../src/state/license';

function wrap(ui: ReactNode) {
  return render(
    <I18nProvider language="en">
      <PlanProvider value={{ entitlement: FREE_ENTITLEMENT, upgrade: vi.fn() }}>{ui}</PlanProvider>
    </I18nProvider>,
  );
}

const phone: MediaQueryReport = {
  queries: [
    { text: '(max-width: 767px)', kind: 'media', rules: 20, matches: true },
    { text: '(min-width: 769px)', kind: 'media', rules: 30, matches: false },
    { text: '(prefers-reduced-motion: reduce)', kind: 'media', rules: 4, matches: false },
    { text: 'card (min-width: 400px)', kind: 'container', rules: 3, matches: null },
  ],
  unreadable: 2,
};
const desktop: MediaQueryReport = {
  queries: [
    { text: '(max-width: 767px)', kind: 'media', rules: 20, matches: false },
    { text: '(min-width: 769px)', kind: 'media', rules: 30, matches: true },
  ],
  unreadable: 0,
};

const rows = [
  { id: 'p', name: 'Phone', width: 390, height: 844, media: phone },
  { id: 'd', name: 'Desktop', width: 1440, height: 900, media: desktop },
];

describe('MediaTab', () => {
  it('sums up the queries and lists the gaps with a viewport to see them', async () => {
    const onAddViewport = vi.fn();
    wrap(<MediaTab rows={rows} measuring={false} onAddViewport={onAddViewport} />);
    expect(screen.getByTestId('media-summary')).toHaveTextContent('4 queries · 2 breakpoints · 1 possible mistake');
    const problem = screen.getByTestId('media-problem');
    expect(problem).toHaveAttribute('data-type', 'gap');
    expect(problem).toHaveTextContent('Gap at 768 px');
    expect(problem).toHaveTextContent('Neither query applies at these widths');
    expect(within(problem).getByText('(max-width: 767px)').tagName).toBe('CODE');
    expect(within(problem).getByText('(min-width: 769px)').tagName).toBe('CODE');
    await userEvent.click(within(problem).getByRole('button', { name: 'Add a viewport at 768 px' }));
    expect(onAddViewport).toHaveBeenCalledWith(768);
    expect(screen.getByTestId('media-unreadable')).toHaveTextContent('2 stylesheets from other sites can’t be read');
  });

  it('shows where each width query applies, in a table with headers', () => {
    wrap(<MediaTab rows={rows} measuring={false} />);
    const table = screen.getByRole('table', { name: 'Media queries in each preview' });
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual(['Query', 'Rules', 'Phone390', 'Desktop1440']);
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual(['(max-width: 767px)', '(min-width: 769px)']);
    const [first] = screen.getAllByTestId('media-row');
    expect(within(first!).getByText('Applies in Phone')).toBeInTheDocument();
    expect(within(first!).getByText('Doesn’t apply in Desktop')).toBeInTheDocument();
    expect(within(first!).getAllByRole('cell')[0]).toHaveTextContent('20');
    // The table scrolls sideways on its own and can be reached with the keyboard.
    expect(screen.getByRole('region', { name: 'Media queries in each preview' })).toHaveAttribute('tabindex', '0');
    // No add button without a callback.
    expect(screen.queryByRole('button', { name: /Add a viewport/ })).toBeNull();
  });

  it('shows every condition on request, container queries as depending on their container', async () => {
    wrap(<MediaTab rows={rows} measuring={false} />);
    expect(screen.getAllByTestId('media-row')).toHaveLength(2);
    await userEvent.click(screen.getByRole('radio', { name: 'All conditions' }));
    const all = screen.getAllByTestId('media-row');
    expect(all).toHaveLength(4);
    const container = all.find((row) => row.dataset.kind === 'container')!;
    expect(container).toHaveTextContent('@container card (min-width: 400px)');
    expect(within(container).getAllByText('Depends on the container, not the viewport')).toHaveLength(2);
    expect(screen.getByText(/Container queries \(—\) depend/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Widths' }));
    expect(screen.getAllByTestId('media-row')).toHaveLength(2);
  });

  it('offers no viewport when a preview already shows that width', () => {
    const at768 = [...rows, { id: 't', name: 'Tablet', width: 768, height: 1024, media: desktop }];
    wrap(<MediaTab rows={at768} measuring={false} onAddViewport={vi.fn()} />);
    expect(screen.getByTestId('media-problem')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add a viewport/ })).toBeNull();
  });

  it('says when nothing is wrong, waits for the previews, and says when none could be read or there are no queries', () => {
    const fine: MediaQueryReport = {
      queries: [
        { text: '(max-width: 767.98px)', kind: 'media', rules: 2, matches: true },
        { text: '(min-width: 768px)', kind: 'media', rules: 2, matches: false },
      ],
      unreadable: 0,
    };
    const { unmount } = wrap(
      <MediaTab rows={[{ id: 'p', name: 'Phone', width: 390, height: 844, media: fine }]} measuring={false} />,
    );
    expect(screen.getByTestId('media-summary')).toHaveTextContent('2 queries · 1 breakpoint · no gaps or overlaps');
    expect(screen.queryByTestId('media-problem')).toBeNull();
    unmount();

    const waiting = wrap(<MediaTab rows={[{ id: 'p', name: 'Phone', width: 390, height: 844 }]} measuring={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Measuring');
    waiting.unmount();

    const none = wrap(
      <MediaTab rows={[{ id: 'p', name: 'Phone', width: 390, height: 844, media: null }]} measuring={false} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('No preview could be read');
    none.unmount();

    wrap(
      <MediaTab
        rows={[{ id: 'p', name: 'Phone', width: 390, height: 844, media: { queries: [], unreadable: 1 } }]}
        measuring={false}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('This page’s stylesheets have no media queries.');
    expect(screen.getByTestId('media-unreadable')).toHaveTextContent('1 stylesheet from another site');
  });

  it('says when no query depends on the width', () => {
    const other: MediaQueryReport = {
      queries: [{ text: '(hover: hover)', kind: 'media', rules: 2, matches: true }],
      unreadable: 0,
    };
    wrap(<MediaTab rows={[{ id: 'p', name: 'Phone', width: 390, height: 844, media: other }]} measuring={false} />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText(/No media query depends on the width/)).toBeInTheDocument();
  });
});

describe('AuditPanel media tab', () => {
  const props = (extra: Partial<Parameters<typeof AuditPanel>[0]> = {}) => ({
    tab: 'media' as const,
    onTab: vi.fn(),
    rows: rows.map((row): AuditRow => ({ ...row, report: null, stats: null, type: null })),
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

  it('is the seventh tab, shown with its label, and passes the viewport callback on', async () => {
    const onAddViewport = vi.fn();
    const onTab = vi.fn();
    wrap(<AuditPanel {...props({ onAddViewport, onTab })} />);
    expect(AUDIT_TABS).toHaveLength(7);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.at(-1)).toHaveAttribute('aria-label', 'Media queries');
    expect(screen.getByRole('tab', { name: 'Media queries' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('media-tab')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Add a viewport at 768 px' }));
    expect(onAddViewport).toHaveBeenCalledWith(768);
    // Arrow keys wrap around the tabs.
    screen.getByRole('tab', { name: 'Media queries' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onTab).toHaveBeenCalledWith('issues');
  });
});

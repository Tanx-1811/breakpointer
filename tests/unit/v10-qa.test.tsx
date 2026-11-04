import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { QaPanel } from '../../src/components/QaPanel/QaPanel';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import { setQaResult, type QaResults } from '../../src/state/qa';
import type { QaItem } from '../../src/types';

type Props = ComponentProps<typeof QaPanel>;

const VIEWPORTS = [
  { id: 'p', name: 'Phone', width: 390, height: 844 },
  { id: 't', name: 'Tablet', width: 768, height: 1024 },
  { id: 'd', name: 'Desktop', width: 1440, height: 900 },
];

const ITEMS: QaItem[] = [
  { id: 'a', text: 'Menu opens' },
  { id: 'b', text: 'Forms send' },
];

/** The panel with its items and results kept in state, as the workspace does. */
function Harness({ spies, ...initial }: Partial<Props> & { spies: Partial<Props> }) {
  const [items, setItems] = useState(initial.items ?? ITEMS);
  const [results, setResults] = useState<QaResults>(initial.results ?? {});
  return (
    <QaPanel
      items={items}
      viewports={initial.viewports ?? VIEWPORTS}
      results={results}
      onResult={(itemId, viewportId, result) => {
        spies.onResult?.(itemId, viewportId, result);
        setResults((current) => setQaResult(current, itemId, viewportId, result));
      }}
      onItems={(next) => {
        spies.onItems?.(next);
        setItems(next);
      }}
      onResetResults={spies.onResetResults ?? vi.fn()}
      onRestoreDefaults={spies.onRestoreDefaults ?? vi.fn()}
      onCopy={spies.onCopy ?? vi.fn()}
      onReveal={spies.onReveal}
      onClose={spies.onClose ?? vi.fn()}
    />
  );
}

function renderPanel(props: Partial<Props> = {}) {
  const spies = {
    onResult: vi.fn(),
    onItems: vi.fn(),
    onResetResults: vi.fn(),
    onRestoreDefaults: vi.fn(),
    onCopy: vi.fn(),
    onReveal: vi.fn(),
    onClose: vi.fn(),
  };
  render(
    <I18nProvider language="en">
      <Harness {...props} spies={spies} />
    </I18nProvider>,
  );
  return spies;
}

const cell = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

describe('QA checklist panel', () => {
  it('shows the matrix, the progress and the header actions', async () => {
    const spies = renderPanel({ results: { a: { p: 'pass', t: 'fail' } } });
    const panel = screen.getByTestId('qa-panel');
    expect(panel.tagName).toBe('ASIDE');
    expect(panel.querySelector('header')).not.toBeNull();
    expect(within(panel).getByRole('heading', { name: 'QA checklist' })).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Checks at each viewport' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Check', 'Phone 390', 'Tablet 768', 'Desktop 1440']);
    expect(within(table).getAllByRole('rowheader')).toHaveLength(2);

    expect(screen.getByTestId('qa-progress')).toHaveTextContent('2 of 6 checked · 1 failed');
    const bar = screen.getByRole('progressbar', { name: 'QA checklist' });
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemax', '6');
    expect(bar).toHaveAttribute('aria-valuetext', '2 of 6 checked · 1 failed');
    expect(screen.getByText(/Passed → Failed → Skipped → not checked/)).toBeInTheDocument();

    expect(cell('Phone: Menu opens — Passed')).toHaveAttribute('data-result', 'pass');
    expect(cell('Tablet: Menu opens — Failed')).toHaveAttribute('data-result', 'fail');
    expect(cell('Desktop: Menu opens — Not checked')).toHaveAttribute('data-result', 'none');

    await userEvent.click(screen.getByRole('button', { name: 'Copy as Markdown' }));
    expect(spies.onCopy).toHaveBeenCalled();
    const close = screen.getByRole('button', { name: 'Close the QA checklist' });
    expect(close).toHaveAttribute('data-shortcut', 'Q');
    await userEvent.click(close);
    expect(spies.onClose).toHaveBeenCalled();
    const reveal = screen.getByRole('button', { name: 'Tablet 768' });
    expect(reveal).toHaveAttribute('data-tooltip', 'Go to Tablet');
    await userEvent.click(reveal);
    expect(spies.onReveal).toHaveBeenCalledWith('t');
  });

  it('cycles a cell on click: passed, failed, skipped, not checked', async () => {
    const spies = renderPanel();
    await userEvent.click(cell('Phone: Forms send — Not checked'));
    expect(spies.onResult).toHaveBeenLastCalledWith('b', 'p', 'pass');
    await userEvent.click(cell('Phone: Forms send — Passed'));
    expect(spies.onResult).toHaveBeenLastCalledWith('b', 'p', 'fail');
    await userEvent.click(cell('Phone: Forms send — Failed'));
    expect(spies.onResult).toHaveBeenLastCalledWith('b', 'p', 'skip');
    await userEvent.click(cell('Phone: Forms send — Skipped'));
    expect(spies.onResult).toHaveBeenLastCalledWith('b', 'p', undefined);
    expect(cell('Phone: Forms send — Not checked')).toBeInTheDocument();
  });

  it('moves between cells with the arrow keys; only one cell is in the tab order', async () => {
    const spies = renderPanel();
    const first = cell('Phone: Menu opens');
    expect(first).toHaveAttribute('tabindex', '0');
    expect(cell('Tablet: Menu opens')).toHaveAttribute('tabindex', '-1');

    first.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(cell('Tablet: Menu opens')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(cell('Tablet: Forms send')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(cell('Tablet: Forms send')).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(cell('Desktop: Forms send')).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{Home}');
    expect(cell('Phone: Menu opens')).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(cell('Tablet: Menu opens')).toHaveAttribute('tabindex', '0');
    expect(cell('Phone: Menu opens')).toHaveAttribute('tabindex', '-1');

    await userEvent.keyboard('{Enter}');
    expect(spies.onResult).toHaveBeenLastCalledWith('a', 't', 'pass');
    await userEvent.keyboard(' ');
    expect(spies.onResult).toHaveBeenLastCalledWith('a', 't', 'fail');
    expect(cell('Tablet: Menu opens — Failed')).toHaveFocus();
  });

  it('edits a check: Enter saves, Escape cancels', async () => {
    const spies = renderPanel();
    const [edit] = screen.getAllByRole('button', { name: 'Edit check' });
    expect(edit).toHaveAccessibleDescription('Menu opens');
    await userEvent.click(edit!);
    const input = screen.getByRole('textbox', { name: 'Check text' });
    expect(input).toHaveFocus();
    await userEvent.clear(input);
    await userEvent.type(input, 'Menu opens and closes{Enter}');
    expect(spies.onItems).toHaveBeenCalledTimes(1);
    expect(spies.onItems).toHaveBeenLastCalledWith([{ id: 'a', text: 'Menu opens and closes' }, ITEMS[1]]);
    expect(screen.getByRole('rowheader', { name: /Menu opens and closes/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Edit check' })[0]).toHaveFocus();

    await userEvent.click(screen.getAllByRole('button', { name: 'Edit check' })[1]!);
    await userEvent.type(screen.getByRole('textbox', { name: 'Check text' }), ' and arrive{Escape}');
    expect(spies.onItems).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('textbox', { name: 'Check text' })).not.toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /^Forms send/ })).toBeInTheDocument();
  });

  it('deletes a check but keeps the last one', async () => {
    const spies = renderPanel();
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete check' })[0]!);
    expect(spies.onItems).toHaveBeenLastCalledWith([ITEMS[1]]);
    expect(screen.getAllByRole('rowheader')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Edit check' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Delete check' })).toBeDisabled();
  });

  it('adds a check', async () => {
    const spies = renderPanel();
    const add = screen.getByRole('button', { name: 'Add' });
    expect(add).toBeDisabled();
    await userEvent.type(screen.getByRole('textbox', { name: 'Add a check' }), '  Cookie banner closes {Enter}');
    const next = spies.onItems.mock.calls.at(-1)![0] as QaItem[];
    expect(next).toHaveLength(3);
    expect(next[2]!.text).toBe('Cookie banner closes');
    expect(screen.getByRole('textbox', { name: 'Add a check' })).toHaveValue('');
    expect(screen.getAllByRole('rowheader')).toHaveLength(3);
  });

  it('stops adding at 40 checks', () => {
    const items = Array.from({ length: 40 }, (_, index) => ({ id: `i${index}`, text: `Check ${index}` }));
    renderPanel({ items });
    expect(screen.getByRole('textbox', { name: 'Add a check' })).toBeDisabled();
    expect(screen.getByText('The checklist is full (40 checks).')).toBeInTheDocument();
  });

  it('resets results and restores the default checks from the menu', async () => {
    const spies = renderPanel({ results: { a: { p: 'pass' } } });
    await userEvent.click(screen.getByRole('button', { name: 'More checklist actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Reset results' }));
    expect(spies.onResetResults).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'More checklist actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Restore the default checks' }));
    expect(spies.onRestoreDefaults).toHaveBeenCalled();
  });

  it('explains when no viewport is shown', () => {
    renderPanel({ viewports: [] });
    expect(screen.getByTestId('qa-empty')).toHaveTextContent('No viewport is shown');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy as Markdown' })).toBeDisabled();
  });

  it('offers the default checks when the list is empty', async () => {
    const spies = renderPanel({ items: [] });
    expect(screen.getByTestId('qa-empty')).toHaveTextContent('The checklist is empty');
    await userEvent.click(screen.getByRole('button', { name: 'Restore the default checks' }));
    expect(spies.onRestoreDefaults).toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Add a check' })).toBeInTheDocument();
  });
});

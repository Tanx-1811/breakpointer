import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette } from '../../src/components/CommandPalette/CommandPalette';
import { AddViewportDialog } from '../../src/components/DevicePresetPicker/AddViewportDialog';
import { InspectorPanel } from '../../src/components/Inspector/InspectorPanel';
import { Menu } from '../../src/components/Menu/Menu';
import { ViewportCard, type ViewportCardActions } from '../../src/components/ViewportCard/ViewportCard';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import { createViewport } from '../../src/state/viewports';

const wrap = (ui: ReactNode, language: 'en' | 'vi' = 'en') =>
  render(<I18nProvider language={language}>{ui}</I18nProvider>);

function actions(): ViewportCardActions {
  return {
    onRename: vi.fn(),
    onResize: vi.fn(),
    onZoom: vi.fn(),
    onRotate: vi.fn(),
    onMove: vi.fn(),
    onReload: vi.fn(),
    onCapture: vi.fn(),
    onCopy: vi.fn(),
    onOpenInTab: vi.fn(),
    onOpenInWindow: vi.fn(),
    onDuplicate: vi.fn(),
    onHide: vi.fn(),
    onRemove: vi.fn(),
    onFocus: vi.fn(),
    onColorScheme: vi.fn(),
  };
}

function renderCard(overrides: Partial<Parameters<typeof ViewportCard>[0]> = {}, language: 'en' | 'vi' = 'en') {
  const handlers = actions();
  const viewport = createViewport({ name: 'Phone', width: 375, height: 667, zoom: 0.5 });
  wrap(
    <ViewportCard
      viewport={viewport}
      src="https://example.com/"
      reloadKey="0"
      order={0}
      index={0}
      count={2}
      canDuplicate
      breakpointSet="tailwind"
      showRulers={false}
      {...handlers}
      {...overrides}
    />,
    language,
  );
  return handlers;
}

describe('ViewportCard', () => {
  it('renders a frame at the real viewport size, scaled by zoom', () => {
    renderCard();
    const frame = screen.getByTitle('Phone preview, 375 × 667');
    expect(frame).toHaveAttribute('width', '375');
    expect(frame).toHaveAttribute('height', '667');
    expect(frame).toHaveStyle({ transform: 'scale(0.5)' });
    expect(frame.getAttribute('sandbox')).not.toContain('allow-top-navigation');
    expect(screen.getByTestId('breakpoint-badge')).toHaveTextContent('base');
  });

  it('commits valid sizes and rejects invalid ones', async () => {
    const user = userEvent.setup();
    const { onResize } = renderCard();
    const width = screen.getByRole('spinbutton', { name: 'Width in pixels' });
    await user.clear(width);
    await user.type(width, '412{Enter}');
    expect(onResize).toHaveBeenCalledWith({ width: 412 });

    await user.clear(width);
    await user.type(width, '12{Enter}');
    expect(onResize).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Width must be a whole number from 200 to 3840.');
  });

  it('renames with Enter and cancels with Escape', async () => {
    const user = userEvent.setup();
    const { onRename } = renderCard();
    await user.click(screen.getByRole('button', { name: 'Rename Phone' }));
    await user.keyboard('{Escape}');
    expect(onRename).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Rename Phone' }));
    const input = screen.getByRole('textbox', { name: 'Viewport name' });
    await user.clear(input);
    await user.type(input, 'Checkout{Enter}');
    expect(onRename).toHaveBeenCalledWith('Checkout');
  });

  it('exposes actions with accessible names', async () => {
    const user = userEvent.setup();
    const handlers = renderCard();
    await user.click(screen.getByRole('button', { name: 'Rotate to landscape' }));
    await user.click(screen.getByRole('button', { name: 'Reload Phone' }));
    await user.click(screen.getByRole('button', { name: 'Remove Phone' }));
    expect(handlers.onRotate).toHaveBeenCalled();
    expect(handlers.onReload).toHaveBeenCalled();
    expect(handlers.onRemove).toHaveBeenCalled();
  });

  it('shows a placeholder without a page and disables page actions', () => {
    renderCard({ src: null });
    expect(screen.queryByTitle(/preview/)).toBeNull();
    expect(screen.getByText('Enter an address to preview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload Phone' })).toBeDisabled();
  });

  it('speaks Vietnamese', () => {
    renderCard({}, 'vi');
    expect(screen.getByRole('button', { name: 'Xoay ngang' })).toBeInTheDocument();
  });
});

describe('AddViewportDialog', () => {
  it('adds presets and validated custom sizes', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    wrap(<AddViewportDialog open canAdd onAdd={onAdd} onClose={() => {}} />);
    await user.click(screen.getByTestId('preset-tablet-m'));
    expect(onAdd).toHaveBeenCalledWith({ name: 'Tablet', width: 768, height: 1024 });

    const width = screen.getByRole('spinbutton', { name: 'Width' });
    await user.clear(width);
    await user.type(width, '100');
    await user.click(screen.getByRole('button', { name: 'Add custom viewport' }));
    expect(screen.getByRole('alert')).toHaveTextContent('from 200 to 3840');
    expect(onAdd).toHaveBeenCalledTimes(1);

    await user.clear(width);
    await user.type(width, '1080');
    await user.click(screen.getByRole('button', { name: 'Add custom viewport' }));
    expect(onAdd).toHaveBeenLastCalledWith({ name: '1080 × 768', width: 1080, height: 768 });
  });

  it('explains the limit when full', () => {
    wrap(<AddViewportDialog open canAdd={false} onAdd={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('up to 8 viewports');
    expect(screen.getByTestId('preset-mobile-m')).toBeDisabled();
  });
});

describe('Menu', () => {
  it('opens from the keyboard, moves focus with arrows and activates items', async () => {
    const user = userEvent.setup();
    const first = vi.fn();
    const second = vi.fn();
    render(
      <Menu
        label="Actions"
        entries={[
          { id: 'a', label: 'First', onSelect: first },
          { id: 'b', label: 'Disabled', disabled: true, onSelect: () => {} },
          { id: 'c', label: 'Second', onSelect: second },
        ]}
        trigger={(props) => (
          <button type="button" {...props}>
            Open
          </button>
        )}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    const menu = screen.getByRole('menu', { name: 'Actions' });
    expect(within(menu).getByRole('menuitem', { name: 'First' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(within(menu).getByRole('menuitem', { name: 'Second' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(second).toHaveBeenCalled();
    expect(first).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });
});

describe('CommandPalette', () => {
  it('filters as you type and runs the highlighted command with Enter', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    const add = vi.fn();
    const onClose = vi.fn();
    wrap(
      <CommandPalette
        open
        commands={[
          { id: 'reload', section: 'Page', title: 'Reload all previews', run: reload },
          { id: 'add', section: 'Add viewport', title: 'Add Tablet', keywords: '768x1024 iPad', run: add },
        ]}
        onClose={onClose}
      />,
    );
    const input = screen.getByRole('combobox', { name: 'Search commands, sizes, groups and pages' });
    expect(screen.getAllByRole('option')).toHaveLength(2);
    await user.type(input, 'ipad');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      expect.stringContaining('Add Tablet'),
    ]);
    await user.keyboard('{Enter}');
    expect(onClose).toHaveBeenCalled();
    expect(add).toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('offers to preview a typed address', async () => {
    const user = userEvent.setup();
    const go = vi.fn();
    wrap(
      <CommandPalette
        open
        commands={[]}
        fromQuery={(query) => ({ id: 'go', section: 'Page', title: `Preview ${query}`, run: go })}
        onClose={() => {}}
      />,
    );
    await user.type(screen.getByRole('combobox'), 'example.com');
    expect(screen.getByRole('option', { name: /Preview example.com/ })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Enter}');
    expect(go).toHaveBeenCalled();
  });
});

describe('InspectorPanel', () => {
  const base = {
    picking: false,
    needsAccess: false,
    host: 'example.com',
    busy: false,
    onPick: vi.fn(),
    onClear: vi.fn(),
    onClose: vi.fn(),
    onReveal: vi.fn(),
    onCopySelector: vi.fn(),
    onAllowSite: vi.fn(),
  };
  const info = (width: number, display: string) => ({
    label: 'main > h1',
    width,
    height: 40,
    top: 0,
    left: 0,
    visible: display !== 'none',
    display,
    position: 'static',
    fontSize: '24px',
    lineHeight: '32px',
    fontWeight: '700',
    margin: '0',
    padding: '0',
    layout: '',
  });

  it('invites to pick an element when nothing is selected', () => {
    wrap(<InspectorPanel {...base} selector={null} rows={[]} />);
    expect(screen.getByText('Compare an element at every size')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Pick an element' })).not.toHaveLength(0);
  });

  it('lists the element in every viewport and marks what changes', () => {
    wrap(
      <InspectorPanel
        {...base}
        selector="main > h1:nth-of-type(1)"
        rows={[
          { id: 'a', name: 'Phone', width: 375, height: 667, sizeClass: 'phone', info: info(343, 'block') },
          { id: 'b', name: 'Laptop', width: 1366, height: 768, sizeClass: 'laptop', info: info(800, 'flex') },
          { id: 'c', name: 'Tablet', width: 768, height: 1024, sizeClass: 'tablet', info: null },
        ]}
      />,
    );
    expect(screen.getByText('main > h1')).toBeInTheDocument();
    expect(screen.getAllByTestId('inspector-size').map((size) => size.textContent)).toEqual(['343 × 40', '800 × 40']);
    expect(screen.getByText('Not on this page')).toBeInTheDocument();
    const changed = document.querySelectorAll('[data-changed]');
    expect([...changed].map((item) => item.textContent)).toEqual(['Displayblock', 'Displayflex']);
  });
});

describe('AddViewportDialog search', () => {
  it('filters presets by name or size and marks sizes already in the workspace', async () => {
    const user = userEvent.setup();
    wrap(
      <AddViewportDialog
        open
        canAdd
        viewports={[createViewport({ name: 'Phone', width: 375, height: 667 })]}
        onAdd={() => {}}
        onClose={() => {}}
      />,
    );
    expect(within(screen.getByTestId('preset-mobile-m')).getByText('Already in the workspace')).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Search presets' }), '1024');
    expect(screen.getByTestId('preset-tablet-m')).toBeInTheDocument();
    expect(screen.queryByTestId('preset-mobile-m')).toBeNull();
    await user.clear(screen.getByRole('searchbox', { name: 'Search presets' }));
    await user.click(screen.getByRole('radio', { name: 'Desktop' }));
    expect(screen.getByTestId('preset-desktop-4k')).toBeInTheDocument();
    expect(screen.queryByTestId('preset-tablet-m')).toBeNull();
  });
});

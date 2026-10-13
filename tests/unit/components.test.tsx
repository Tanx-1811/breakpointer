import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AddViewportDialog } from '../../src/components/DevicePresetPicker/AddViewportDialog';
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
    onOpenInTab: vi.fn(),
    onOpenInWindow: vi.fn(),
    onDuplicate: vi.fn(),
    onHide: vi.fn(),
    onRemove: vi.fn(),
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

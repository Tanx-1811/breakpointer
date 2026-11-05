import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ToolkitDialog, type ToolkitViewport } from '../../src/components/ToolkitDialog/ToolkitDialog';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import { DEFAULT_TOOLKIT, type ToolkitState, type ToolkitTab } from '../../src/state/toolkit';

const wrap = (ui: ReactNode) => render(<I18nProvider language="en">{ui}</I18nProvider>);

const VIEWPORTS: ToolkitViewport[] = [
  { id: 'phone', name: 'Phone', width: 375, height: 667, colorScheme: 'dark' },
  { id: 'tablet', name: 'Tablet', width: 768, height: 1024 },
  { id: 'desktop', name: 'Desktop', width: 1440, height: 900 },
];

function Harness({ tab, onCopy = vi.fn() }: { tab: ToolkitTab; onCopy?: (text: string) => void }) {
  const [current, setCurrent] = useState<ToolkitTab>(tab);
  const [state, setState] = useState<ToolkitState>(DEFAULT_TOOLKIT);
  return (
    <ToolkitDialog
      open
      tab={current}
      onTab={setCurrent}
      state={state}
      onChange={setState}
      viewports={VIEWPORTS}
      breakpointSets={[]}
      currentSet="tailwind"
      onCopy={onCopy}
      onClose={vi.fn()}
    />
  );
}

describe('CSS toolkit: grid', () => {
  it('shows the columns at each viewport and the CSS', async () => {
    const onCopy = vi.fn();
    wrap(<Harness tab="grid" onCopy={onCopy} />);
    const columns = () =>
      within(screen.getByTestId('grid-table'))
        .getAllByTestId('grid-columns')
        .map((cell) => cell.textContent);
    expect(columns()).toEqual(['1', '2', '4']);
    await userEvent.clear(screen.getByTestId('grid-min'));
    await userEvent.type(screen.getByTestId('grid-min'), '160');
    expect(columns()).toEqual(['1', '4', '6']);
    expect(screen.getByTestId('grid-code')).toHaveTextContent('minmax(min(100%, 160px), 1fr)');
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(onCopy).toHaveBeenCalledWith(expect.stringContaining('display: grid;'));
    await userEvent.clear(screen.getByTestId('grid-min'));
    expect(screen.getByText(/Enter a column width above 0/)).toBeInTheDocument();
  });
});

describe('CSS toolkit: images', () => {
  it('writes picture markup for the layout, and an img without modern formats', async () => {
    wrap(<Harness tab="images" />);
    const code = () => screen.getByTestId('images-code').textContent ?? '';
    expect(code()).toContain('<picture>');
    expect(code()).toContain('sizes="(min-width: 1248px) 1200px, calc(100vw - 48px)"');
    expect(within(screen.getByTestId('images-table')).getByText('1200 px')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'AVIF and WebP' }));
    expect(code().startsWith('<img')).toBe(true);
    await userEvent.selectOptions(screen.getByTestId('images-layout'), 'full');
    expect(code()).toContain('sizes="100vw"');
    await userEvent.clear(screen.getByTestId('images-pattern'));
    await userEvent.type(screen.getByTestId('images-pattern'), 'hero.png');
    expect(code()).toContain('hero-770.png 770w');
  });
});

describe('CSS toolkit: media query tester', () => {
  it('marks where a query applies, what is unknown and what can’t be read', async () => {
    wrap(<Harness tab="queries" />);
    // (min-width: 768px) and (orientation: landscape): only the desktop.
    expect(screen.getByTestId('queries-summary')).toHaveTextContent('Applies in 1 of 3 viewports');
    await userEvent.click(screen.getByRole('button', { name: '(prefers-color-scheme: dark)' }));
    const results = within(screen.getByTestId('queries-results')).getAllByRole('listitem');
    expect(results[0]).toHaveTextContent('Applies');
    expect(results[1]).toHaveTextContent('Depends on the browser: prefers-color-scheme');
    const input = screen.getByTestId('queries-input');
    await userEvent.clear(input);
    await userEvent.type(input, '(min-widht: 1px)');
    expect(screen.getByText(/can’t be read/)).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});

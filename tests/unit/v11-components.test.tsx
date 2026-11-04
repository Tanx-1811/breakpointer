import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HelpDialog } from '../../src/components/HelpDialog/HelpDialog';
import { PresentBar } from '../../src/components/PresentBar/PresentBar';
import {
  ToolkitDialog,
  type ToolkitBreakpointSet,
  type ToolkitViewport,
} from '../../src/components/ToolkitDialog/ToolkitDialog';
import { FRAMEWORK_BREAKPOINTS } from '../../src/data/breakpoints';
import { shortcutFor } from '../../src/hooks/useShortcuts';
import { en } from '../../src/i18n/en';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import { createTranslator, type Language } from '../../src/i18n/translate';
import { defaultSettings } from '../../src/services/storage';
import { EXPLAIN_TOPICS } from '../../src/state/explain';
import { GUIDES, guideById } from '../../src/state/guides';
import { DEFAULT_TOOLKIT, type ToolkitState, type ToolkitTab } from '../../src/state/toolkit';
import { AUTO_SCROLL_SECONDS, buildCommands, type CommandActions } from '../../src/viewer/commands';

const wrap = (ui: ReactNode, language: Language = 'en') =>
  render(<I18nProvider language={language}>{ui}</I18nProvider>);

const VIEWPORTS: ToolkitViewport[] = [
  { id: 'phone', name: 'Phone', width: 375, height: 667 },
  { id: 'desktop', name: 'Desktop', width: 1440, height: 900 },
];

const SETS: ToolkitBreakpointSet[] = [
  { id: 'tailwind', label: 'Tailwind', ...FRAMEWORK_BREAKPOINTS.tailwind },
  { id: 'bootstrap', label: 'Bootstrap', ...FRAMEWORK_BREAKPOINTS.bootstrap },
  { id: 'custom', label: 'Custom', base: 'base', breakpoints: [] },
];

/** The dialog with its state kept like the workspace keeps it. */
function Harness({ onCopy, initialTab = 'fluid' }: { onCopy: (text: string) => void; initialTab?: ToolkitTab }) {
  const [tab, setTab] = useState<ToolkitTab>(initialTab);
  const [state, setState] = useState<ToolkitState>(DEFAULT_TOOLKIT);
  return (
    <ToolkitDialog
      open
      tab={tab}
      onTab={setTab}
      state={state}
      onChange={setState}
      viewports={VIEWPORTS}
      breakpointSets={SETS}
      currentSet="bootstrap"
      onCopy={onCopy}
      onClose={vi.fn()}
    />
  );
}

describe('CSS toolkit', () => {
  it('has five tools in a tab list that the arrow keys move through', async () => {
    wrap(<Harness onCopy={vi.fn()} />);
    const tabs = within(screen.getByRole('tablist', { name: 'Tools' })).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Fluid type',
      'Units',
      'Breakpoints',
      'Colours',
      'Aspect ratio',
    ]);
    tabs[0]!.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Aspect ratio' })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'Fluid type' })).toHaveAttribute('aria-selected', 'true');
  });

  it('writes a clamp() and its size at every preview, and copies it', async () => {
    const onCopy = vi.fn();
    wrap(<Harness onCopy={onCopy} />);
    expect(screen.getByTestId('fluid-code')).toHaveTextContent('font-size: clamp(1rem,');
    const table = screen.getByRole('table');
    // 360 → 1440 px by default: 16 px grows to 20 px.
    expect(within(table).getByText('16.06 px')).toBeInTheDocument();
    expect(within(table).getByText('20 px')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Use my previews’ widths' }));
    expect(screen.getByTestId('fluid-min-viewport')).toHaveValue('375');
    expect(screen.getByTestId('fluid-max-viewport')).toHaveValue('1440');
    await userEvent.clear(screen.getByTestId('fluid-max-size'));
    await userEvent.type(screen.getByTestId('fluid-max-size'), '48');
    expect(screen.getByText(/may not double/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(onCopy).toHaveBeenCalledWith(expect.stringMatching(/^font-size: clamp\(1rem, .+, 3rem\);$/));
  });

  it('builds a fluid type scale', async () => {
    wrap(<Harness onCopy={vi.fn()} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Type scale' }));
    const scale = screen.getByTestId('fluid-scale');
    expect(within(scale).getByText('--step-5')).toBeInTheDocument();
    expect(within(scale).getByText('--step--2')).toBeInTheDocument();
    expect(screen.getByTestId('fluid-scale-code')).toHaveTextContent('--step-0: clamp(1rem,');
  });

  it('tables a value in every unit at every viewport', async () => {
    const onCopy = vi.fn();
    wrap(<Harness onCopy={onCopy} initialTab="units" />);
    const value = screen.getByTestId('units-value');
    await userEvent.clear(value);
    await userEvent.type(value, '2rem');
    const table = screen.getByTestId('units-table');
    expect(within(table).getAllByText('32px')).toHaveLength(2);
    expect(within(table).getByText('8.533vw')).toBeInTheDocument();
    await userEvent.clear(value);
    await userEvent.type(value, 'wide');
    expect(screen.getByText(/Type a number/)).toBeInTheDocument();
    await userEvent.clear(value);
    await userEvent.type(value, '24px');
    await userEvent.click(screen.getByRole('button', { name: 'Copy as Markdown' }));
    expect(onCopy).toHaveBeenCalledWith(expect.stringContaining('| rem | 1.5rem | 1.5rem |'));
  });

  it('writes the breakpoints in use as code, in other formats and sets too', async () => {
    const onCopy = vi.fn();
    wrap(<Harness onCopy={onCopy} initialTab="code" />);
    // The toolbar's set (Bootstrap) comes first.
    expect(screen.getByTestId('code-output')).toHaveTextContent('@media (min-width: 576px)');
    await userEvent.selectOptions(screen.getByTestId('code-format'), 'tailwind4');
    expect(screen.getByTestId('code-output')).toHaveTextContent('--breakpoint-xxl: 87.5rem;');
    await userEvent.selectOptions(screen.getByTestId('code-source'), 'tailwind');
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(onCopy).toHaveBeenCalledWith(expect.stringContaining('--breakpoint-2xl: 96rem;'));
    await userEvent.selectOptions(screen.getByTestId('code-source'), 'custom');
    expect(screen.getByText(/This set has no breakpoints/)).toBeInTheDocument();
  });

  it('converts a colour to every format and remembers it', async () => {
    const onCopy = vi.fn();
    wrap(<Harness onCopy={onCopy} initialTab="colors" />);
    const input = screen.getByTestId('color-input');
    await userEvent.clear(input);
    await userEvent.type(input, 'hsl(0 100% 50%){Enter}');
    const formats = screen.getByTestId('color-formats');
    expect(formats).toHaveTextContent('#ff0000');
    expect(formats).toHaveTextContent('rgb(255 0 0)');
    expect(formats).toHaveTextContent('oklch(62.8% 0.258 29.2)');
    await userEvent.click(screen.getByRole('button', { name: 'Copy HEX' }));
    expect(onCopy).toHaveBeenCalledWith('#ff0000');
    expect(screen.getByRole('button', { name: 'Use hsl(0 100% 50%)' })).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, '#12');
    expect(screen.getByText(/Type a colour/)).toBeInTheDocument();
  });

  it('turns a size into a ratio with the height at every viewport', async () => {
    wrap(<Harness onCopy={vi.fn()} initialTab="aspect" />);
    expect(screen.getByTestId('aspect-ratio')).toHaveTextContent('16:9');
    await userEvent.click(screen.getByRole('button', { name: '4:3' }));
    expect(screen.getByTestId('aspect-ratio')).toHaveTextContent('4:3');
    expect(screen.getByText('281.25 px')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'From a viewport…' }), 'phone');
    expect(screen.getByTestId('aspect-width')).toHaveValue('375');
    // 375 × 667 has no simpler form: written as a decimal.
    expect(screen.getByTestId('aspect-ratio')).toHaveTextContent('0.562:1');
  });
});

describe('present bar', () => {
  it('starts and stops auto-scrolling', async () => {
    const onAutoScroll = vi.fn();
    const { rerender } = wrap(
      <PresentBar
        host="example.com"
        layout="wrap"
        onLayout={vi.fn()}
        onFit={vi.fn()}
        onExit={vi.fn()}
        onAutoScroll={onAutoScroll}
      />,
    );
    await userEvent.click(screen.getByTestId('present-autoscroll'));
    expect(onAutoScroll).toHaveBeenCalledOnce();
    rerender(
      <I18nProvider language="en">
        <PresentBar
          host="example.com"
          layout="wrap"
          onLayout={vi.fn()}
          onFit={vi.fn()}
          onExit={vi.fn()}
          autoScrolling
          onAutoScroll={onAutoScroll}
        />
      </I18nProvider>,
    );
    expect(screen.getByTestId('present-autoscroll')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('present-autoscroll')).toHaveTextContent('Stop');
  });
});

describe('help and guides', () => {
  it('links to the user guide in the interface’s language', async () => {
    wrap(
      <HelpDialog
        open
        version="0.11.0"
        section="support"
        onClose={vi.fn()}
        commandShortcuts={{ open: '', preview: '' }}
      />,
      'vi',
    );
    expect(screen.getByTestId('help-user-guide')).toHaveAttribute('href', expect.stringMatching(/USER_GUIDE\.vi\.md$/));
  });

  it('lists the new shortcut and news', () => {
    wrap(
      <HelpDialog
        open
        version="0.11.0"
        section="news"
        onClose={vi.fn()}
        commandShortcuts={{ open: '', preview: '' }}
      />,
    );
    expect(screen.getByTestId('whats-new')).toHaveTextContent('CSS toolkit (U)');
    expect(
      shortcutFor({
        key: 'u',
        code: 'KeyU',
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        isComposing: false,
      }),
    ).toBe('toolkit');
  });

  it('has the four new guides, finishing where they promise', () => {
    expect(GUIDES.map((guide) => guide.id)).toEqual(expect.arrayContaining(['toolkit', 'touch', 'readable', 'demo']));
    expect(guideById('toolkit').finish?.action).toBe('toolkit');
    expect(guideById('demo').finish?.action).toBe('present');
    for (const guide of GUIDES) for (const step of guide.steps) expect(en[step.body]).toBeTruthy();
  });

  it('explains the badge and auto-scroll before the panels they sit in', () => {
    const index = (selector: string) => EXPLAIN_TOPICS.findIndex((topic) => topic.selector.includes(selector));
    expect(index('badge-copy')).toBeGreaterThan(-1);
    expect(index('badge-copy')).toBeLessThan(index('data-testid="audit"'));
    expect(index('present-autoscroll')).toBeGreaterThan(-1);
  });
});

describe('palette', () => {
  const t = createTranslator('en');
  const actions = (patch: Partial<CommandActions>): CommandActions =>
    ({
      reloadAll: vi.fn(),
      openInTab: vi.fn(),
      scrollTop: vi.fn(),
      navigate: vi.fn(),
      ...patch,
    }) as unknown as CommandActions;
  const commands = (patch: Partial<CommandActions>, autoScrolling = false) =>
    buildCommands({
      t,
      en: t,
      settings: defaultSettings(),
      hasUrl: true,
      canAdd: true,
      focusedId: null,
      outlines: false,
      hideScrollbars: false,
      liveCss: false,
      inspecting: false,
      autoScrolling,
      actions: actions(patch),
    });

  it('opens each tool of the CSS toolkit', () => {
    const toolkit = vi.fn();
    const list = commands({ toolkit });
    const units = list.find((command) => command.id === 'toolkit-units')!;
    expect(units.title).toBe('CSS toolkit: Units');
    units.run();
    expect(toolkit).toHaveBeenCalledWith('units');
    expect(list.filter((command) => command.id.startsWith('toolkit-'))).toHaveLength(5);
  });

  it('auto-scrolls for 10, 20 or 40 seconds, and stops', () => {
    const autoScroll = vi.fn();
    const list = commands({ autoScroll });
    expect(list.filter((command) => command.id.startsWith('auto-scroll-')).map((command) => command.title)).toEqual(
      AUTO_SCROLL_SECONDS.map((seconds) => `Auto-scroll every preview (${seconds} s)`),
    );
    list.find((command) => command.id === 'auto-scroll-20')!.run();
    expect(autoScroll).toHaveBeenCalledWith(20);
    commands({ autoScroll }, true)
      .find((command) => command.id === 'auto-scroll-stop')!
      .run();
    expect(autoScroll).toHaveBeenLastCalledWith(null);
  });
});

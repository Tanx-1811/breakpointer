import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CompareDialog } from '../../src/components/CompareDialog/CompareDialog';
import { ContrastDialog, type ContrastColors } from '../../src/components/ContrastDialog/ContrastDialog';
import { DesignOverlay } from '../../src/components/DesignOverlay/DesignOverlay';
import { InspectorPanel } from '../../src/components/Inspector/InspectorPanel';
import { LiveCssDialog } from '../../src/components/LiveCssDialog/LiveCssDialog';
import { MeasureOverlay } from '../../src/components/MeasureOverlay/MeasureOverlay';
import { ViewportCard, type ViewportCardActions } from '../../src/components/ViewportCard/ViewportCard';
import { VisionFilters } from '../../src/components/VisionFilters/VisionFilters';
import { WorkspaceBar } from '../../src/components/WorkspaceBar/WorkspaceBar';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import { defaultSettings } from '../../src/services/storage';
import { createViewport } from '../../src/state/viewports';

const wrap = (ui: ReactNode, language: 'en' | 'vi' = 'en') =>
  render(<I18nProvider language={language}>{ui}</I18nProvider>);

describe('ContrastDialog', () => {
  function Harness({ initial, onChange }: { initial: ContrastColors; onChange?: (colors: ContrastColors) => void }) {
    const [colors, setColors] = useState(initial);
    return (
      <ContrastDialog
        open
        colors={colors}
        onChange={(next) => {
          setColors(next);
          onChange?.(next);
        }}
        onClose={() => {}}
      />
    );
  }

  it('shows the ratio and which WCAG levels pass', async () => {
    const user = userEvent.setup();
    wrap(<Harness initial={{ text: '#000000', background: '#ffffff' }} />);
    expect(screen.getByTestId('contrast-ratio')).toHaveTextContent('21.00 : 1');
    expect(screen.getByTestId('contrast-aaaNormal')).toHaveTextContent('Pass');

    const text = screen.getByRole('textbox', { name: 'Text' });
    await user.clear(text);
    await user.type(text, '#767676');
    expect(screen.getByTestId('contrast-ratio')).toHaveTextContent('4.54 : 1');
    expect(screen.getByTestId('contrast-aaNormal')).toHaveTextContent('Pass');
    expect(screen.getByTestId('contrast-aaaNormal')).toHaveTextContent('Fail');
  });

  it('flags an invalid colour and keeps the last valid result', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    wrap(<Harness initial={{ text: '#000000', background: '#ffffff' }} onChange={onChange} />);
    const background = screen.getByRole('textbox', { name: 'Background' });
    await user.clear(background);
    await user.type(background, 'nope');
    expect(background).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a colour such as #1f2430');
    expect(screen.getByTestId('contrast-ratio')).toHaveTextContent('21.00 : 1');
  });

  it('swaps the colours', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    wrap(<Harness initial={{ text: '#111111', background: '#eeeeee' }} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Swap colours' }));
    expect(onChange).toHaveBeenLastCalledWith({ text: '#eeeeee', background: '#111111' });
    expect(screen.getByRole('textbox', { name: 'Text' })).toHaveValue('#eeeeee');
  });

  it('offers the eyedropper only where the browser has one', () => {
    wrap(<Harness initial={{ text: '#000000', background: '#ffffff' }} />);
    expect(screen.queryByRole('button', { name: /Pick the text colour/ })).toBeNull();
    expect(screen.getByText(/can’t pick colours from the screen/)).toBeInTheDocument();
  });

  it('picks a colour with the eyedropper, hiding the dialog meanwhile', async () => {
    const user = userEvent.setup();
    let resolve: ((value: { sRGBHex: string }) => void) | null = null;
    class FakeEyeDropper {
      open() {
        return new Promise<{ sRGBHex: string }>((done) => (resolve = done));
      }
    }
    vi.stubGlobal('EyeDropper', FakeEyeDropper);
    try {
      wrap(<Harness initial={{ text: '#000000', background: '#ffffff' }} />);
      await user.click(screen.getByRole('button', { name: 'Pick the background colour from the screen' }));
      await vi.waitFor(() => expect(document.querySelector('dialog')).toHaveAttribute('data-concealed'));
      // The eyedropper opens once the dialog is out of sight.
      await vi.waitFor(() => expect(resolve).not.toBeNull());
      resolve!({ sRGBHex: '#0000ff' });
      await vi.waitFor(() => expect(screen.getByRole('textbox', { name: 'Background' })).toHaveValue('#0000ff'));
      expect(document.querySelector('dialog')).not.toHaveAttribute('data-concealed');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('CompareDialog', () => {
  it('starts comparing the same page on another site', async () => {
    const user = userEvent.setup();
    const onCompare = vi.fn();
    wrap(
      <CompareDialog
        open
        target={null}
        current="https://example.com/shop"
        onCompare={onCompare}
        onStop={() => {}}
        onClose={() => {}}
      />,
    );
    await user.type(screen.getByRole('textbox', { name: 'Address to compare' }), 'staging.example.com{Enter}');
    expect(onCompare).toHaveBeenCalledWith({ mode: 'mirror', origin: 'https://staging.example.com' });
  });

  it('compares with a fixed address, and explains mistakes', async () => {
    const user = userEvent.setup();
    const onCompare = vi.fn();
    wrap(
      <CompareDialog
        open
        target={null}
        current="https://example.com/a"
        onCompare={onCompare}
        onStop={() => {}}
        onClose={() => {}}
      />,
    );
    const field = screen.getByRole('textbox', { name: 'Address to compare' });
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a website address');

    await user.type(field, 'example.com/a');
    await user.click(screen.getByRole('radio', { name: /One fixed address/ }));
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    expect(screen.getByRole('alert')).toHaveTextContent('That’s the page already shown');

    await user.clear(field);
    await user.type(field, 'example.com/b');
    await user.click(screen.getByRole('button', { name: 'Compare' }));
    expect(onCompare).toHaveBeenCalledWith({ mode: 'fixed', url: 'https://example.com/b' });
  });

  it('can stop an ongoing comparison', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    wrap(
      <CompareDialog
        open
        target={{ mode: 'mirror', origin: 'https://staging.example.com' }}
        current="https://example.com/"
        onCompare={() => {}}
        onStop={onStop}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('textbox', { name: 'Address to compare' })).toHaveValue('https://staging.example.com');
    await user.click(screen.getByRole('button', { name: 'Stop comparing' }));
    expect(onStop).toHaveBeenCalled();
  });
});

describe('MeasureOverlay', () => {
  it('measures a drag in page pixels, whatever the zoom', () => {
    wrap(<MeasureOverlay width={375} height={667} zoom={0.5} />);
    const overlay = screen.getByTestId('measure-overlay');
    overlay.setPointerCapture = () => {};
    overlay.getBoundingClientRect = () => new DOMRect(100, 50, 187.5, 333.5);
    fireEvent.pointerDown(overlay, { button: 0, clientX: 110, clientY: 60, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 160, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(overlay, { pointerId: 1 });
    expect(screen.getByTestId('measure-size')).toHaveTextContent('100 × 80');
    expect(screen.getByText('100 by 80 pixels, 20 from the left and 20 from the top')).toBeInTheDocument();
  });

  it('measures a straight line with Shift', () => {
    wrap(<MeasureOverlay width={375} height={667} zoom={1} />);
    const overlay = screen.getByTestId('measure-overlay');
    overlay.setPointerCapture = () => {};
    overlay.getBoundingClientRect = () => new DOMRect(0, 0, 375, 667);
    fireEvent.pointerDown(overlay, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 210, clientY: 40, shiftKey: true, pointerId: 1 });
    expect(screen.getByTestId('measure-size')).toHaveTextContent('200 × 0');
  });
});

describe('DesignOverlay', () => {
  it('lays the design over the preview and adjusts it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onRemove = vi.fn();
    wrap(
      <DesignOverlay
        overlay={{ src: 'blob:design', opacity: 0.5, difference: false, hidden: false }}
        width={375}
        height={667}
        zoom={0.5}
        scrollY={200}
        name="Phone"
        onChange={onChange}
        onRemove={onRemove}
      />,
    );
    const image = screen.getByTestId('design-overlay');
    expect(image).toHaveStyle({ width: '187.5px', opacity: '0.5', transform: 'translateY(-100px)' });
    const controls = screen.getByRole('group', { name: 'Design overlay of Phone' });
    fireEvent.change(within(controls).getByRole('slider', { name: 'Overlay opacity' }), { target: { value: '0.8' } });
    expect(onChange).toHaveBeenCalledWith({ opacity: 0.8 });
    await user.click(within(controls).getByRole('button', { name: 'Show differences' }));
    expect(onChange).toHaveBeenCalledWith({ difference: true });
    await user.click(within(controls).getByRole('button', { name: 'Hide the overlay' }));
    expect(onChange).toHaveBeenCalledWith({ hidden: true });
    await user.click(within(controls).getByRole('button', { name: 'Remove the overlay' }));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe('LiveCssDialog snippets', () => {
  const base = {
    open: true,
    css: '',
    host: 'example.com',
    siteAllowed: true,
    busy: false,
    onClear: () => {},
    onAllowSite: () => {},
    onClose: () => {},
  };

  it('saves the CSS being edited as a snippet', async () => {
    const user = userEvent.setup();
    const onSaveSnippet = vi.fn();
    wrap(
      <LiveCssDialog
        {...base}
        onApply={() => {}}
        snippets={[]}
        onSaveSnippet={onSaveSnippet}
        onDeleteSnippet={() => {}}
      />,
    );
    const save = screen.getByRole('button', { name: 'Save as snippet' });
    expect(save).toBeDisabled();
    await user.type(screen.getByTestId('live-css-input'), '.banner{{display:none}');
    await user.type(screen.getByRole('textbox', { name: 'Snippet name' }), 'Hide banner');
    await user.click(save);
    expect(onSaveSnippet).toHaveBeenCalledWith('Hide banner', '.banner{display:none}');
  });

  it('edits, applies and deletes saved snippets', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onDeleteSnippet = vi.fn();
    const snippet = { id: 's1', name: 'Hide banner', css: '.banner { display: none }' };
    wrap(
      <LiveCssDialog
        {...base}
        onApply={onApply}
        snippets={[snippet]}
        onSaveSnippet={() => {}}
        onDeleteSnippet={onDeleteSnippet}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Put Hide banner in the editor' }));
    expect(screen.getByTestId('live-css-input')).toHaveValue('.banner { display: none }');
    await user.click(screen.getByRole('button', { name: 'Apply Hide banner to the previews' }));
    expect(onApply).toHaveBeenCalledWith('.banner { display: none }');
    await user.click(screen.getByRole('button', { name: 'Delete Hide banner' }));
    expect(onDeleteSnippet).toHaveBeenCalledWith(snippet);
  });

  it('has no snippets section unless the workspace keeps them', () => {
    wrap(<LiveCssDialog {...base} onApply={() => {}} />);
    expect(screen.queryByRole('heading', { name: 'Saved snippets' })).toBeNull();
  });
});

describe('ViewportCard utilities', () => {
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
  const card = (overrides: Partial<Parameters<typeof ViewportCard>[0]> = {}) => {
    const handlers = actions();
    wrap(
      <ViewportCard
        viewport={createViewport({ name: 'Phone', width: 375, height: 667, zoom: 0.5 })}
        src="https://example.com/"
        reloadKey="0"
        order={0}
        index={0}
        count={1}
        canDuplicate
        breakpointSet="none"
        showRulers={false}
        {...handlers}
        {...overrides}
      />,
    );
    return handlers;
  };

  it('draws the vision filter over the page and the measuring layer on top', () => {
    card({ filter: 'url(#bp-vision-protanopia)', measuring: true });
    expect(screen.getByTitle('Phone preview, 375 × 667')).toHaveStyle({ filter: 'url(#bp-vision-protanopia)' });
    expect(screen.getByTestId('measure-overlay')).toBeInTheDocument();
  });

  it('loads a design from the card menu', async () => {
    const user = userEvent.setup();
    const onOverlayFile = vi.fn();
    card({ onOverlayFile, onOverlayChange: vi.fn(), onOverlayRemove: vi.fn() });
    await user.click(screen.getByRole('button', { name: 'More actions for Phone' }));
    expect(screen.getByRole('menuitem', { name: 'Overlay a design…' })).toBeEnabled();
    const file = new File(['png'], 'design.png', { type: 'image/png' });
    await user.upload(screen.getByTestId('overlay-file'), file);
    expect(onOverlayFile).toHaveBeenCalledWith(file);
  });

  it('points out a page the site served with an error', () => {
    card({ httpStatus: 403 });
    expect(screen.getByTestId('http-status')).toHaveTextContent('HTTP 403');
    expect(screen.getByTestId('http-status')).toHaveAttribute(
      'data-tooltip',
      expect.stringContaining('The site answered this preview with an error (403).'),
    );
  });

  it('says nothing about pages served normally', () => {
    card({ httpStatus: 200 });
    expect(screen.queryByTestId('http-status')).toBeNull();
  });

  it('labels the sides of a comparison; the B card’s close button stops comparing', async () => {
    const user = userEvent.setup();
    const onStopCompare = vi.fn();
    const handlers = card({ compare: { side: 'b', target: 'staging.example.com' }, onStopCompare });
    expect(screen.getByRole('region', { name: 'Phone (B), 375 by 667 pixels' })).toBeInTheDocument();
    expect(screen.getByTestId('compare-side')).toHaveTextContent('B');
    expect(screen.getByTitle('Phone preview of staging.example.com, 375 × 667')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stop comparing' }));
    expect(onStopCompare).toHaveBeenCalled();
    expect(handlers.onRemove).not.toHaveBeenCalled();
  });
});

describe('WorkspaceBar utilities', () => {
  const props = () => {
    const settings = defaultSettings();
    return {
      viewports: settings.viewports,
      groups: [],
      canAddViewport: true,
      breakpoints: 'none' as const,
      siteBreakpoints: null,
      showRulers: false,
      sync: true,
      showGrid: false,
      inspecting: false,
      tools: {
        syncScroll: true,
        syncNavigation: true,
        checks: true,
        outlines: false,
        scrollbars: false,
        grid: false,
        imageSizes: false,
        tabOrder: false,
        gridFlex: false,
        liveCss: false,
      },
      hasUrl: true,
      siteAllowed: true,
      host: 'example.com',
      focusedId: null,
      onToggleVisible: vi.fn(),
      onMoveTo: vi.fn(),
      onApplyGroup: vi.fn(),
      onSaveGroup: vi.fn(),
      onManageGroups: vi.fn(),
      onAddViewport: vi.fn(),
      onBreakpoints: vi.fn(),
      onRulers: vi.fn(),
      onSync: vi.fn(),
      onGrid: vi.fn(),
      onInspect: vi.fn(),
      onTool: vi.fn(),
      onLiveCss: vi.fn(),
      onEdges: vi.fn(),
      onRotateAll: vi.fn(),
      onSortByWidth: vi.fn(),
      onReport: vi.fn(),
      onAllowSite: vi.fn(),
    };
  };

  it('simulates vision and runs stress tests from the Simulate menu', async () => {
    const user = userEvent.setup();
    const onVision = vi.fn();
    const onSimulate = vi.fn();
    wrap(
      <WorkspaceBar
        {...props()}
        simulate={{
          vision: 'none',
          reduceMotion: false,
          moreContrast: false,
          print: false,
          pauseAnimations: false,
          pseudo: true,
          rtl: false,
          spacing: false,
        }}
        onVision={onVision}
        onSimulate={onSimulate}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Simulate' }));
    const menu = screen.getByRole('menu', { name: 'Simulate' });
    expect(within(menu).getByRole('menuitemradio', { name: 'Normal vision' })).toHaveAttribute('aria-checked', 'true');
    expect(within(menu).getByRole('menuitemcheckbox', { name: /Longer text/ })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(menu).getByRole('menuitemcheckbox', { name: /Right to left/ }));
    expect(onSimulate).toHaveBeenCalledWith('rtl');
    await user.click(within(menu).getByRole('menuitemradio', { name: 'No green (deuteranopia)' }));
    expect(onVision).toHaveBeenCalledWith('deuteranopia');
  });

  it('measures, checks contrast and compares from the toolbar', async () => {
    const user = userEvent.setup();
    const handlers = { onMeasure: vi.fn(), onContrast: vi.fn(), onCompare: vi.fn(), onStopCompare: vi.fn() };
    wrap(<WorkspaceBar {...props()} measuring={false} comparing={false} {...handlers} />);
    await user.click(screen.getByTestId('measure-toggle'));
    expect(handlers.onMeasure).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Tools' }));
    const menu = screen.getByRole('menu', { name: 'Tools' });
    // Menu items end with their shortcut key.
    await user.click(within(menu).getByRole('menuitem', { name: /^Colour contrast…/ }));
    expect(handlers.onContrast).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Tools' }));
    await user.click(screen.getByRole('menuitem', { name: 'Compare with another address…' }));
    expect(handlers.onCompare).toHaveBeenCalled();
  });

  it('shows none of it unless the workspace provides it', () => {
    wrap(<WorkspaceBar {...props()} />);
    expect(screen.queryByTestId('measure-toggle')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Simulate' })).toBeNull();
  });
});

describe('InspectorPanel copy table', () => {
  it('copies the comparison when the workspace allows it', async () => {
    const user = userEvent.setup();
    const onCopyTable = vi.fn();
    wrap(
      <InspectorPanel
        picking={false}
        selector="main > h1"
        rows={[]}
        needsAccess={false}
        host="example.com"
        busy={false}
        onPick={() => {}}
        onClear={() => {}}
        onClose={() => {}}
        onReveal={() => {}}
        onCopySelector={() => {}}
        onCopyTable={onCopyTable}
        onAllowSite={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Copy table' }));
    expect(onCopyTable).toHaveBeenCalled();
  });
});

describe('VisionFilters', () => {
  it('defines one colour matrix per colour simulation', () => {
    const { container } = render(<VisionFilters />);
    const ids = [...container.querySelectorAll('filter')].map((filter) => filter.id);
    expect(ids).toEqual([
      'bp-vision-protanopia',
      'bp-vision-deuteranopia',
      'bp-vision-tritanopia',
      'bp-vision-achromatopsia',
    ]);
    expect(container.querySelector('feColorMatrix')?.getAttribute('values')?.split(' ')).toHaveLength(20);
  });
});

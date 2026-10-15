import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { imageDensity, printMedia, swapPrefersContrast, tabOrder } from '../../src/agent/page-utils';
import { FloatingPreview, floatingZoom } from '../../src/components/FloatingPreview/FloatingPreview';
import { GridOverlay } from '../../src/components/GridOverlay/GridOverlay';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import { EXTENSION_FRAMES_RULE_ID, embedRuleForExtensionFrames, embedRuleForTab } from '../../src/services/embed-rules';
import { panelZoom } from '../../src/sidepanel/SidePanel';
import { slicePositions, stitchedHeight } from '../../src/state/full-page';

describe('prefers-contrast', () => {
  it('makes "more" match in a browser without the preference', () => {
    expect(swapPrefersContrast('(prefers-contrast: more)')).toBe('(prefers-contrast: no-preference)');
    expect(swapPrefersContrast('(prefers-contrast:no-preference)')).toBe('(prefers-contrast: more)');
    expect(swapPrefersContrast('(prefers-contrast)')).toBe('(prefers-contrast: no-preference)');
    expect(swapPrefersContrast('screen and (PREFERS-CONTRAST: MORE)')).toBe(
      'screen and (PREFERS-CONTRAST: no-preference)',
    );
    // Other values stay false, as they are without the preference.
    expect(swapPrefersContrast('(prefers-contrast: less)')).toBe('(prefers-contrast: less)');
    expect(swapPrefersContrast('(prefers-contrast: custom)')).toBe('(prefers-contrast: custom)');
  });
});

describe('print styles', () => {
  it('rewrites media types as if printing', () => {
    expect(printMedia('print')).toBe('all');
    expect(printMedia('screen')).toBe('not all');
    expect(printMedia('only screen and (max-width: 600px)')).toBe('not all');
    expect(printMedia('print and (orientation: landscape)')).toBe('all and (orientation: landscape)');
    expect(printMedia('not print')).toBe('not all');
    expect(printMedia('not screen and (color)')).toBe('all');
    expect(printMedia('all and (min-width: 1px)')).toBe('all and (min-width: 1px)');
    expect(printMedia('screen, print')).toBe('not all, all');
    // No media type: the query applies to every medium and stays as it is.
    expect(printMedia('(min-width: 600px)')).toBe('(min-width: 600px)');
  });
});

describe('image sizes', () => {
  it('rates how a file compares to the size it is shown at', () => {
    expect(imageDensity(750, 375)).toEqual({ density: 2, tone: 'ok' });
    expect(imageDensity(300, 375)).toEqual({ density: 0.8, tone: 'low' });
    expect(imageDensity(2400, 375)).toEqual({ density: 6.4, tone: 'high' });
  });
});

describe('tab order', () => {
  it('puts positive tabindex first, from the lowest, then document order', () => {
    const items = [0, 2, 0, 1, 2].map((tabIndex, index) => ({ tabIndex, index }));
    expect(tabOrder(items).map((item) => item.index)).toEqual([3, 1, 4, 0, 2]);
  });
});

describe('frames outside the workspace tab', () => {
  it('get the same embedding rule, for frames Breakpointer itself loads', () => {
    const rule = embedRuleForExtensionFrames('abcdefghijklmnop');
    expect(rule.id).toBe(EXTENSION_FRAMES_RULE_ID);
    expect(rule.condition).toEqual({ initiatorDomains: ['abcdefghijklmnop'], resourceTypes: ['sub_frame'] });
    expect(rule.action).toEqual(embedRuleForTab(1).action);
  });
});

describe('floating preview and side panel', () => {
  it('fit the viewport to the window or panel', () => {
    expect(floatingZoom({ width: 375, height: 667 }, { width: 400, height: 740 })).toBe(1);
    expect(floatingZoom({ width: 375, height: 667 }, { width: 200, height: 400 })).toBeCloseTo(200 / 375);
    expect(panelZoom(375, 420)).toBe(1);
    expect(panelZoom(768, 420)).toBeCloseTo(396 / 768);
  });

  it('shows the page in the floating window and switches viewports', () => {
    const fakeWindow = {
      document,
      innerWidth: 400,
      innerHeight: 740,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window;
    const onViewport = vi.fn();
    const onClose = vi.fn();
    render(
      <I18nProvider language="en">
        <FloatingPreview
          pipWindow={fakeWindow}
          src="https://example.com/"
          viewports={[
            { id: 'phone', name: 'Phone', width: 375, height: 667 },
            { id: 'tablet', name: 'Tablet', width: 768, height: 1024 },
          ]}
          viewportId="phone"
          theme="dark"
          onViewport={onViewport}
          onWorkspace={() => {}}
          onClose={onClose}
        />
      </I18nProvider>,
    );
    const frame = screen.getByTitle('Phone preview, 375 × 667');
    expect(frame).toHaveAttribute('src', 'https://example.com/');
    expect(frame).toHaveAttribute('width', '375');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.title).toBe('Phone · Breakpointer');
    fireEvent.change(screen.getByRole('combobox', { name: 'Viewport' }), { target: { value: 'tablet' } });
    expect(onViewport).toHaveBeenCalledWith('tablet');
    fireEvent.click(screen.getByRole('button', { name: 'Close the floating preview' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('full-page screenshots', () => {
  it('capture one screen at a time, the last one against the bottom', () => {
    expect(slicePositions(2000, 667)).toEqual({ positions: [0, 667, 1333], partial: false });
    expect(stitchedHeight([0, 667, 1333], 667)).toBe(2000);
    // A page no taller than the window is one screen.
    expect(slicePositions(500, 667)).toEqual({ positions: [0], partial: false });
    expect(slicePositions(667, 667)).toEqual({ positions: [0], partial: false });
  });

  it('stop at the limit on very long pages', () => {
    const { positions, partial } = slicePositions(100_000, 800, 5);
    expect(positions).toEqual([0, 800, 1600, 2400, 3200]);
    expect(partial).toBe(true);
    expect(stitchedHeight(positions, 800)).toBe(4000);
  });
});

describe('baseline grid', () => {
  it('draws lines every baseline step, scaled with the preview', () => {
    const grid = { show: true, columns: 'auto' as const, gutter: 24, margin: 16, baseline: 8 };
    render(<GridOverlay grid={grid} width={375} height={667} zoom={0.5} />);
    expect(screen.getByTestId('baseline-grid').style.getPropertyValue('--baseline')).toBe('4px');
  });

  it('has none by default', () => {
    const grid = { show: true, columns: 'auto' as const, gutter: 24, margin: 16, baseline: 0 };
    render(<GridOverlay grid={grid} width={375} height={667} zoom={0.5} />);
    expect(screen.queryByTestId('baseline-grid')).toBeNull();
  });
});

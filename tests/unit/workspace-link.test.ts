import { describe, expect, it } from 'vitest';
import { viewportIndexFor } from '../../src/hooks/useShortcuts';
import { encodeSizes, parseSizes, workspaceLink } from '../../src/state/workspace-link';
import { MAX_VIEWPORTS } from '../../src/utils/constants';

const key = (code: string, extra: Partial<KeyboardEvent> = {}) =>
  ({
    key: '',
    code,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
    ...extra,
  }) as Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing'>;

describe('workspace links', () => {
  it('write the viewports with their page colours and names', () => {
    expect(
      encodeSizes([
        { width: 375, height: 667, name: 'Phone' },
        { width: 768, height: 1024, name: 'Tablet, portrait', colorScheme: 'dark' },
        { width: 1366, height: 768, name: '' },
      ]),
    ).toBe('375x667~Phone,768x1024.dark~Tablet portrait,1366x768');
  });

  it('read them back, checked like stored settings', () => {
    expect(parseSizes('375x667~Phone,768x1024.dark~Tablet,1366x768')).toEqual([
      { name: 'Phone', width: 375, height: 667, zoom: 0.75 },
      { name: 'Tablet', width: 768, height: 1024, zoom: 0.5, colorScheme: 'dark' },
      { name: '1366 × 768', width: 1366, height: 768, zoom: 0.5 },
    ]);
    // Sizes are clamped, malformed entries skipped, names cleaned (and may contain a tilde).
    expect(parseSizes('9999x100~Huge,abc,x,400x300.sepia,500x500~  A ~ B  ')).toEqual([
      { name: 'Huge', width: 3840, height: 200, zoom: 0.25 },
      { name: 'A ~ B', width: 500, height: 500, zoom: 0.75 },
    ]);
    expect(parseSizes('')).toEqual([]);
    expect(parseSizes(null)).toEqual([]);
    expect(parseSizes(Array.from({ length: 12 }, () => '400x400').join(','))).toHaveLength(MAX_VIEWPORTS);
  });

  it('make a workspace address', () => {
    const link = workspaceLink('chrome-extension://abc/viewer/viewer.html', 'https://example.com/a?b=1', [
      { width: 375, height: 667, name: 'Phone' },
    ]);
    const url = new URL(link);
    expect(url.searchParams.get('url')).toBe('https://example.com/a?b=1');
    expect(url.searchParams.get('sizes')).toBe('375x667~Phone');
    expect(parseSizes(url.searchParams.get('sizes'))).toHaveLength(1);
    expect(workspaceLink('chrome-extension://abc/viewer/viewer.html', null, [])).toBe(
      'chrome-extension://abc/viewer/viewer.html',
    );
  });
});

describe('number keys', () => {
  it('pick viewports 1 to 8, on the main keys and the keypad', () => {
    expect(viewportIndexFor(key('Digit1'))).toBe(0);
    expect(viewportIndexFor(key('Numpad8'))).toBe(7);
    expect(viewportIndexFor(key('Digit9'))).toBeNull();
    expect(viewportIndexFor(key('Digit0'))).toBeNull();
    expect(viewportIndexFor(key('Digit2', { ctrlKey: true }))).toBeNull();
    expect(viewportIndexFor(key('Digit2', { shiftKey: true }))).toBeNull();
    expect(viewportIndexFor(key('Digit2', { isComposing: true }))).toBeNull();
  });
});

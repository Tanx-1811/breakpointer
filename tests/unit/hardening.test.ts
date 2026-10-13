import { describe, expect, it } from 'vitest';
import { shortcutFor } from '../../src/hooks/useShortcuts';
import { defaultSettings, createSettingsExport, parseSettingsFile } from '../../src/services/storage';
import { createGroup, deleteGroup, restoreGroup } from '../../src/state/groups';
import { createViewport, removeViewport, restoreViewport, updateViewport } from '../../src/state/viewports';
import { MAX_VIEWPORTS } from '../../src/utils/constants';
import { parsePreviewUrl, toSafeHref } from '../../src/utils/url';

const key = (code: string, key: string, extra: Partial<KeyboardEvent> = {}) =>
  ({
    code,
    key,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    isComposing: false,
    ...extra,
  }) as KeyboardEvent;

describe('URLs with embedded credentials', () => {
  it('are rejected with a clear reason, because Chrome blocks them in frames', () => {
    expect(parsePreviewUrl('https://user:secret@example.com')).toEqual({ ok: false, error: 'credentials' });
    expect(parsePreviewUrl('user@example.com/path')).toEqual({ ok: false, error: 'credentials' });
    expect(toSafeHref('https://user:secret@example.com/')).toBeUndefined();
    expect(parsePreviewUrl('https://example.com/@user')).toMatchObject({ ok: true });
  });
});

describe('targeted undo', () => {
  it('puts a removed viewport back without reverting later changes', () => {
    const a = createViewport({ name: 'A', width: 375, height: 667 });
    const b = createViewport({ name: 'B', width: 768, height: 1024 });
    const c = createViewport({ name: 'C', width: 1366, height: 768 });
    let list = removeViewport([a, b, c], b.id);
    list = updateViewport(list, c.id, { name: 'C renamed later' });
    list = restoreViewport(list, b, 1);
    expect(list.map((vp) => vp.name)).toEqual(['A', 'B', 'C renamed later']);
    expect(restoreViewport(list, b, 1)).toBe(list);
  });

  it('does not exceed the viewport limit', () => {
    const full = Array.from({ length: MAX_VIEWPORTS }, (_, i) =>
      createViewport({ name: `#${i}`, width: 400, height: 800 }),
    );
    const extra = createViewport({ name: 'extra', width: 400, height: 800 });
    expect(restoreViewport(full, extra, 0)).toBe(full);
  });

  it('puts a deleted group back in place', () => {
    const one = createGroup('One', [createViewport({ name: 'A', width: 375, height: 667 })]);
    const two = createGroup('Two', [createViewport({ name: 'B', width: 768, height: 1024 })]);
    const groups = deleteGroup([one, two], one.id);
    expect(restoreGroup(groups, one, 0).map((group) => group.name)).toEqual(['One', 'Two']);
  });
});

describe('keyboard shortcuts', () => {
  it('match the physical key, so input methods and layouts do not break them', () => {
    expect(shortcutFor(key('KeyR', 'r'))).toBe('reload');
    expect(shortcutFor(key('KeyR', 'R', { shiftKey: true }))).toBe('reload');
    expect(shortcutFor(key('KeyF', 'Process'))).toBe('fit');
    expect(shortcutFor(key('Slash', '/'))).toBe('focusAddress');
    expect(shortcutFor(key('Slash', '?', { shiftKey: true }))).toBe('help');
    expect(shortcutFor(key('Equal', '='))).toBe('zoomIn');
    expect(shortcutFor(key('Equal', '+', { shiftKey: true }))).toBe('zoomIn');
    expect(shortcutFor(key('NumpadSubtract', '-'))).toBe('zoomOut');
  });

  it('respect keys produced elsewhere on other layouts', () => {
    expect(shortcutFor(key('Minus', '?', { shiftKey: true }))).toBe('help');
    expect(shortcutFor(key('Digit7', '/', { shiftKey: true }))).toBe('focusAddress');
    expect(shortcutFor(key('BracketRight', '+'))).toBe('zoomIn');
  });

  it('ignore modified keys and text being composed', () => {
    expect(shortcutFor(key('KeyR', 'r', { metaKey: true }))).toBeNull();
    expect(shortcutFor(key('KeyR', 'r', { ctrlKey: true }))).toBeNull();
    expect(shortcutFor(key('KeyS', 's', { altKey: true }))).toBeNull();
    expect(shortcutFor(key('KeyA', 'a', { isComposing: true }))).toBeNull();
    expect(shortcutFor(key('KeyZ', 'z'))).toBeNull();
  });
});

describe('importing settings files', () => {
  it('accepts a byte order mark and rejects anything else', () => {
    const current = defaultSettings();
    const text = `\uFEFF${JSON.stringify(createSettingsExport({ ...current, theme: 'dark' }))}`;
    expect(parseSettingsFile(text, current)?.theme).toBe('dark');
    expect(parseSettingsFile('not json', current)).toBeNull();
    expect(parseSettingsFile('{"app":"Other"}', current)).toBeNull();
  });
});

describe('group names and older exports', () => {
  it('keeps group names unique', async () => {
    const { saveGroup, renameGroup, uniqueGroupName } = await import('../../src/state/groups');
    const vp = createViewport({ name: 'A', width: 375, height: 667 });
    let groups = saveGroup([], createGroup('Checkout', [vp]));
    groups = saveGroup(groups, createGroup('checkout', [vp]));
    groups = saveGroup(groups, createGroup('Checkout', [vp]));
    expect(groups.map((group) => group.name)).toEqual(['Checkout', 'checkout (2)', 'Checkout (3)']);
    expect(renameGroup(groups, groups[0]!.id, 'Checkout')[0]!.name).toBe('Checkout');
    expect(renameGroup(groups, groups[1]!.id, 'Checkout (3)')[1]!.name).toBe('Checkout (3) (2)');
    expect(uniqueGroupName('New', groups)).toBe('New');
  });

  it('accepts files exported under the previous name', () => {
    const current = defaultSettings();
    const legacy = { ...createSettingsExport({ ...current, layout: 'row' }), app: 'ViewportLab' };
    expect(parseSettingsFile(JSON.stringify(legacy), current)?.layout).toBe('row');
  });
});

import { describe, expect, it } from 'vitest';
import {
  addRecentUrl,
  createSettingsExport,
  defaultSettings,
  loadSettings,
  parseSettings,
  parseSettingsImport,
  saveSettings,
  STORAGE_KEY,
} from '../../src/services/storage';
import { MAX_GROUPS, MAX_RECENT_URLS, MAX_VIEWPORTS } from '../../src/utils/constants';

describe('parseSettings', () => {
  it('returns defaults for missing or malformed data', () => {
    for (const raw of [undefined, null, 'x', 42, [], { viewports: 'nope' }]) {
      const settings = parseSettings(raw);
      expect(settings.version).toBe(1);
      expect(settings.viewports.map((vp) => vp.width)).toEqual([375, 768, 1366]);
    }
  });

  it('names default viewports with the given translator', () => {
    expect(parseSettings(undefined, (id) => `#${id}`).viewports.map((vp) => vp.name)).toEqual([
      '#mobile-m',
      '#tablet-m',
      '#laptop-m',
    ]);
  });

  it('validates every field independently', () => {
    const settings = parseSettings({
      version: 99,
      theme: 'neon',
      language: 'vi',
      layout: 'row',
      breakpoints: 'foundation',
      showRulers: 'yes',
      viewports: [
        { id: 'a', name: 'Phone', width: 375, height: 667, zoom: 0.75, hidden: true },
        { id: 'a', name: 'Duplicate id', width: 99999, height: -5, zoom: 7 },
        { name: 'No numbers', width: '375' },
        null,
      ],
      activeUrl: 'javascript:alert(1)',
    });
    expect(settings.theme).toBe('system');
    expect(settings.language).toBe('vi');
    expect(settings.layout).toBe('row');
    expect(settings.breakpoints).toBe('none');
    expect(settings.showRulers).toBe(false);
    expect(settings.embedHints).toBe(true);
    expect(settings.activeUrl).toBeUndefined();
    expect(settings.viewports).toHaveLength(2);
    expect(settings.viewports[0]).toMatchObject({ id: 'a', hidden: true, orientation: 'portrait' });
    expect(settings.viewports[1]).toMatchObject({
      width: 3840,
      height: 200,
      zoom: 1,
      orientation: 'landscape',
      hidden: false,
    });
    expect(settings.viewports[1]!.id).not.toBe('a');
  });

  it('keeps an empty viewport list and caps lists', () => {
    expect(parseSettings({ viewports: [] }).viewports).toEqual([]);
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `#${i}`, width: 400, height: 800 }));
    expect(parseSettings({ viewports: many }).viewports).toHaveLength(MAX_VIEWPORTS);
    const groups = Array.from({ length: 30 }, (_, i) => ({ id: `g${i}`, name: `G${i}`, viewports: many }));
    const parsed = parseSettings({ groups });
    expect(parsed.groups).toHaveLength(MAX_GROUPS);
    expect(parsed.groups[0]!.viewports).toHaveLength(MAX_VIEWPORTS);
  });

  it('drops invalid groups and never accepts built-in ids', () => {
    const parsed = parseSettings({
      groups: [
        { id: 'builtin:basics', name: 'Sneaky', viewports: [{ width: 400, height: 800 }] },
        { id: 'empty', name: 'Empty', viewports: [] },
        { id: 'noname', name: '   ', viewports: [{ width: 400, height: 800 }] },
      ],
    });
    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0]!.id).not.toBe('builtin:basics');
  });

  it('keeps recent addresses only when the user opted in', () => {
    const recentUrls = ['https://a.example/', 'javascript:alert(1)', 'https://a.example/', 'https://b.example/'];
    expect(parseSettings({ rememberRecent: false, recentUrls }).recentUrls).toEqual([]);
    expect(parseSettings({ rememberRecent: true, recentUrls }).recentUrls).toEqual([
      'https://a.example/',
      'https://b.example/',
    ]);
  });
});

describe('storage', () => {
  it('round-trips through chrome.storage.local', async () => {
    const settings = { ...defaultSettings(), theme: 'dark' as const, activeUrl: 'https://example.com/' };
    await saveSettings(settings);
    expect(await loadSettings()).toEqual(settings);
    await chrome.storage.local.set({ [STORAGE_KEY]: 'corrupt' });
    expect((await loadSettings()).theme).toBe('system');
  });
});

describe('export and import', () => {
  it('never exports browsing data', () => {
    const settings = {
      ...defaultSettings(),
      rememberRecent: true,
      recentUrls: ['https://a.example/'],
      activeUrl: 'https://a.example/',
    };
    const exported = createSettingsExport(settings, new Date('2026-01-02T03:04:05Z'));
    expect(exported).toMatchObject({
      app: 'ViewportLab',
      kind: 'settings',
      version: 1,
      exportedAt: '2026-01-02T03:04:05.000Z',
    });
    expect(JSON.stringify(exported)).not.toContain('a.example');
  });

  it('imports valid files, keeping local recent addresses', () => {
    const current = { ...defaultSettings(), rememberRecent: true, recentUrls: ['https://mine.example/'] };
    const source = { ...defaultSettings(), theme: 'dark' as const, layout: 'row' as const };
    const imported = parseSettingsImport(JSON.parse(JSON.stringify(createSettingsExport(source))), current);
    expect(imported).toMatchObject({
      theme: 'dark',
      layout: 'row',
      rememberRecent: true,
      recentUrls: ['https://mine.example/'],
    });
  });

  it('rejects anything else', () => {
    const current = defaultSettings();
    expect(parseSettingsImport({ app: 'Other', kind: 'settings', settings: {} }, current)).toBeNull();
    expect(parseSettingsImport({ viewports: [] }, current)).toBeNull();
    expect(parseSettingsImport('x', current)).toBeNull();
  });

  it('keeps recent addresses unique, newest first and capped', () => {
    let list: string[] = [];
    for (let i = 0; i < 15; i++) list = addRecentUrl(list, `https://${i}.example/`);
    list = addRecentUrl(list, 'https://10.example/');
    expect(list).toHaveLength(MAX_RECENT_URLS);
    expect(list[0]).toBe('https://10.example/');
    expect(new Set(list).size).toBe(list.length);
  });
});

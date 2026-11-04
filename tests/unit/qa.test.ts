import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../src/i18n/translate';
import { createSettingsExport, defaultSettings, parseSettings, parseSettingsImport } from '../../src/services/storage';
import {
  DEFAULT_QA_ITEMS,
  MAX_QA_ITEMS,
  addQaItem,
  editQaItem,
  nextQaResult,
  parseQaChecklist,
  qaMarkdown,
  qaSummary,
  removeQaItem,
  resolveQaItems,
  setQaResult,
  type QaResults,
} from '../../src/state/qa';
import { settingsReducer } from '../../src/state/settings-reducer';

const t = createTranslator('en');

const viewports = [
  { id: 'p', name: 'Phone', width: 390, height: 844 },
  { id: 't', name: 'Tablet', width: 768, height: 1024 },
];

describe('QA checklist: checks', () => {
  it('has eight translated built-in checks with stable ids', () => {
    expect(DEFAULT_QA_ITEMS.map((item) => item.id)).toEqual([
      'default:nav',
      'default:overflow',
      'default:text',
      'default:images',
      'default:tap',
      'default:forms',
      'default:media',
      'default:dialogs',
    ]);
    const items = resolveQaItems([], t);
    expect(items[0]).toEqual({ id: 'default:nav', text: 'The navigation menu opens, closes and every link works' });
    expect(items.every((item) => item.text && !item.text.startsWith('qa.'))).toBe(true);
    // The defaults follow the UI's language until the list is edited.
    expect(resolveQaItems([], createTranslator('vi'))[0]!.text).not.toBe(items[0]!.text);
  });

  it('uses the stored checks when there are any', () => {
    const stored = [{ id: 'a', text: 'Logo links home' }];
    expect(resolveQaItems(stored, t)).toEqual(stored);
  });

  it('adds, edits and removes checks', () => {
    let items = addQaItem([], '  Cookie   banner\ncloses ', 'a');
    expect(items).toEqual([{ id: 'a', text: 'Cookie banner closes' }]);
    expect(addQaItem(items, '   ', 'b')).toEqual(items);
    expect(addQaItem(items, 'Duplicate id', 'a')).toEqual(items);
    expect(addQaItem(items, 'x'.repeat(300), 'b')[1]!.text).toHaveLength(140);
    expect(addQaItem(items, 'Generated id')[1]!.id).toBeTruthy();
    const full = Array.from({ length: MAX_QA_ITEMS }, (_, index) => ({ id: `i${index}`, text: `Check ${index}` }));
    expect(addQaItem(full, 'One more', 'z')).toHaveLength(MAX_QA_ITEMS);

    items = editQaItem(items, 'a', 'Cookie banner can be closed');
    expect(items[0]!.text).toBe('Cookie banner can be closed');
    expect(editQaItem(items, 'a', '  ')).toEqual(items);
    expect(removeQaItem(items, 'a')).toEqual([]);
  });
});

describe('QA checklist: parsing stored checks', () => {
  it('keeps valid checks and trims their text', () => {
    expect(parseQaChecklist([{ id: 'a', text: '  Menu opens  ' }, { id: 'b', text: 'Forms send' }])).toEqual([
      { id: 'a', text: 'Menu opens' },
      { id: 'b', text: 'Forms send' },
    ]);
  });

  it('drops anything else', () => {
    for (const raw of [null, undefined, 'checks', 42, { 0: { id: 'a', text: 'x' } }]) {
      expect(parseQaChecklist(raw)).toEqual([]);
    }
    expect(
      parseQaChecklist([
        null,
        'text',
        ['a', 'b'],
        { id: '', text: 'Empty id' },
        { id: 'x'.repeat(41), text: 'Long id' },
        { id: 7, text: 'Number id' },
        { id: 'a', text: 'First' },
        { id: 'a', text: 'Duplicate' },
        { id: 'b', text: '   ' },
        { id: 'c', text: 'y'.repeat(141) },
        { id: 'd', text: { toString: () => 'object' } },
        { id: 'e', text: 'z'.repeat(140), extra: '<script>' },
      ]),
    ).toEqual([
      { id: 'a', text: 'First' },
      { id: 'e', text: 'z'.repeat(140) },
    ]);
  });

  it('keeps at most 40 checks', () => {
    const raw = Array.from({ length: 60 }, (_, index) => ({ id: `i${index}`, text: `Check ${index}` }));
    const items = parseQaChecklist(raw);
    expect(items).toHaveLength(MAX_QA_ITEMS);
    expect(items.at(-1)!.id).toBe('i39');
  });

  it('is a setting: empty by default, validated, exported and set by the reducer', () => {
    expect(defaultSettings().qaChecklist).toEqual([]);
    expect(parseSettings({}).qaChecklist).toEqual([]);
    expect(parseSettings({ qaChecklist: 'all' }).qaChecklist).toEqual([]);
    expect(parseSettings({ qaChecklist: [{ id: 'a', text: 'Menu' }, { id: 'a' }] }).qaChecklist).toEqual([
      { id: 'a', text: 'Menu' },
    ]);
    const items = [{ id: 'a', text: 'Menu opens' }];
    const state = settingsReducer(defaultSettings(), { type: 'setQaChecklist', items });
    expect(state.qaChecklist).toEqual(items);
    expect(settingsReducer(state, { type: 'setQaChecklist', items: [] }).qaChecklist).toEqual([]);

    const exported = createSettingsExport(state);
    expect(exported.settings.qaChecklist).toEqual(items);
    expect(parseSettingsImport(JSON.parse(JSON.stringify(exported)), defaultSettings())?.qaChecklist).toEqual(items);
    // An older export without checks keeps the current ones.
    const { qaChecklist: _qa, ...older } = exported.settings;
    expect(parseSettingsImport({ ...exported, settings: older }, state)?.qaChecklist).toEqual(items);
  });
});

describe('QA checklist: results', () => {
  it('cycles not checked → passed → failed → skipped → not checked', () => {
    expect(nextQaResult()).toBe('pass');
    expect(nextQaResult('pass')).toBe('fail');
    expect(nextQaResult('fail')).toBe('skip');
    expect(nextQaResult('skip')).toBeUndefined();
  });

  it('sets and clears a cell without changing the others', () => {
    const empty: QaResults = {};
    const one = setQaResult(empty, 'a', 'p', 'pass');
    expect(one).toEqual({ a: { p: 'pass' } });
    expect(empty).toEqual({});
    const two = setQaResult(one, 'a', 't', 'fail');
    expect(two).toEqual({ a: { p: 'pass', t: 'fail' } });
    expect(one).toEqual({ a: { p: 'pass' } });
    expect(setQaResult(two, 'a', 'p', undefined)).toEqual({ a: { t: 'fail' } });
    expect(setQaResult(one, 'a', 'p', undefined)).toEqual({});
    expect(setQaResult(one, 'b', 'p', undefined)).toEqual(one);
  });

  it('counts only the current checks and viewports', () => {
    const items = [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ];
    const results: QaResults = {
      a: { p: 'pass', t: 'fail', gone: 'fail' },
      b: { p: 'skip' },
      removed: { p: 'fail' },
    };
    expect(qaSummary(items, ['p', 't'], results)).toEqual({ total: 4, checked: 3, passed: 1, failed: 1, skipped: 1 });
    expect(qaSummary([], ['p'], results)).toEqual({ total: 0, checked: 0, passed: 0, failed: 0, skipped: 0 });
  });
});

describe('QA checklist: Markdown', () => {
  it('writes a table and the failures', () => {
    const items = [
      { id: 'a', text: 'Menu opens | closes' },
      { id: 'b', text: 'Forms send' },
    ];
    const results: QaResults = { a: { p: 'pass', t: 'fail' }, b: { p: 'skip' } };
    const markdown = qaMarkdown({ page: 'https://example.com/', items, viewports, results, t });
    expect(markdown).toBe(
      [
        '## QA checklist · https://example.com/',
        '',
        '3 of 4 checked · 1 failed',
        '',
        '✅ Passed · ❌ Failed · ➖ Skipped',
        '',
        '| Check | Phone 390 | Tablet 768 |',
        '| --- | --- | --- |',
        '| Menu opens \\| closes | ✅ | ❌ |',
        '| Forms send | ➖ |  |',
        '',
        '### Failed',
        '',
        '- Menu opens | closes — Tablet (768 × 1024)',
        '',
      ].join('\n'),
    );
  });

  it('leaves out the failures section when nothing failed', () => {
    const markdown = qaMarkdown({ page: 'https://example.com/', items: [{ id: 'a', text: 'A' }], viewports, results: {}, t });
    expect(markdown).toContain('0 of 2 checked\n');
    expect(markdown).toContain('| A |  |  |');
    expect(markdown).not.toContain('### Failed');
  });
});

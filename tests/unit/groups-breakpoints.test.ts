import { describe, expect, it } from 'vitest';
import { breakpointFor } from '../../src/data/breakpoints';
import { BUILT_IN_GROUPS } from '../../src/data/groups';
import { PRESETS } from '../../src/data/presets';
import { createTranslator } from '../../src/i18n/translate';
import {
  builtInTemplates,
  createGroup,
  deleteGroup,
  findGroupTemplates,
  renameGroup,
  replaceGroupViewports,
  saveGroup,
} from '../../src/state/groups';
import { createViewport, isValidDimension } from '../../src/state/viewports';
import { MAX_GROUPS, MAX_VIEWPORTS } from '../../src/utils/constants';

const t = createTranslator('en');
const phone = createViewport({ name: 'Phone', width: 375, height: 667 });

describe('groups', () => {
  it('saves, renames, updates and deletes', () => {
    let groups = saveGroup([], createGroup('  QA  ', [phone]));
    expect(groups[0]).toMatchObject({ name: 'QA', viewports: [{ name: 'Phone', width: 375, height: 667 }] });
    const id = groups[0]!.id;
    groups = renameGroup(groups, id, 'Mobile');
    expect(groups[0]!.name).toBe('Mobile');
    expect(renameGroup(groups, id, '   ')).toBe(groups);
    groups = replaceGroupViewports(groups, id, [phone, createViewport({ name: 'Tablet', width: 768, height: 1024 })]);
    expect(groups[0]!.viewports).toHaveLength(2);
    expect(deleteGroup(groups, id)).toEqual([]);
  });

  it('refuses empty, unnamed or too many groups', () => {
    expect(saveGroup([], createGroup('', [phone]))).toEqual([]);
    expect(saveGroup([], createGroup('Empty', []))).toEqual([]);
    const full = Array.from({ length: MAX_GROUPS }, (_, i) => createGroup(`G${i}`, [phone]));
    expect(saveGroup(full, createGroup('One more', [phone]))).toBe(full);
  });

  it('resolves built-in and saved groups by id', () => {
    const saved = createGroup('Mine', [phone]);
    expect(findGroupTemplates('builtin:mobile', [], t)?.name).toBe('Mobile QA');
    expect(findGroupTemplates(saved.id, [saved], t)?.viewports).toHaveLength(1);
    expect(findGroupTemplates('builtin:nope', [], t)).toBeNull();
    expect(findGroupTemplates('missing', [saved], t)).toBeNull();
  });

  it('ships valid built-in groups', () => {
    for (const group of BUILT_IN_GROUPS) {
      const templates = builtInTemplates(group, t);
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.length).toBeLessThanOrEqual(MAX_VIEWPORTS);
      for (const template of templates) {
        expect(isValidDimension(template.width) && isValidDimension(template.height)).toBe(true);
        expect(template.name).not.toMatch(/^preset\./);
      }
    }
  });

  it('ships valid presets', () => {
    expect(new Set(PRESETS.map((preset) => preset.id)).size).toBe(PRESETS.length);
    for (const preset of PRESETS) expect(isValidDimension(preset.width) && isValidDimension(preset.height)).toBe(true);
  });
});

describe('breakpoints', () => {
  it('maps widths to framework breakpoints', () => {
    expect(breakpointFor('none', 1000)).toBeNull();
    expect([375, 640, 767, 768, 1024, 1280, 1536].map((w) => breakpointFor('tailwind', w))).toEqual([
      'base',
      'sm',
      'sm',
      'md',
      'lg',
      'xl',
      '2xl',
    ]);
    expect([375, 576, 768, 992, 1200, 1400].map((w) => breakpointFor('bootstrap', w))).toEqual([
      'xs',
      'sm',
      'md',
      'lg',
      'xl',
      'xxl',
    ]);
  });
});

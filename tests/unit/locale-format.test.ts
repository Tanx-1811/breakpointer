import { describe, expect, it } from 'vitest';
import type { CheckIssue } from '../../src/agent/protocol';
import { createTranslator } from '../../src/i18n/translate';
import { formatBytes, formatMs } from '../../src/state/audit';
import { issueDetail, issueValue, localNumbers } from '../../src/state/checks';
import { isSnapshot, type Snapshot } from '../../src/state/snapshots';

const en = createTranslator('en');
const vi = createTranslator('vi');

const shift: CheckIssue = { kind: 'layout-shift', count: 1, detail: '0.243', samples: [] };
const contrast: CheckIssue = { kind: 'low-contrast', count: 2, detail: '2.85', samples: [] };

describe('numbers measured in pages, in the UI language', () => {
  it('writes the decimals the agent measured with the language’s separator', () => {
    expect(localNumbers('3.89:1 · #d94b2a / #fff4ef', vi)).toBe('3,89:1 · #d94b2a / #fff4ef');
    expect(localNumbers('11.5px', vi)).toBe('11,5px');
    expect(localNumbers('+130px', vi)).toBe('+130px');
    expect(localNumbers('3.89:1', en)).toBe('3.89:1');
  });

  it('agrees with the guidance next to it', () => {
    expect(issueValue(shift, vi)).toBe('CLS 0,243');
    expect(issueValue(contrast, vi)).toBe('2 phần tử · 2,85:1');
    expect(issueDetail(contrast, vi)).toBe('2 phần tử · thấp nhất 2,85:1 (AA cần 4,5:1, chữ lớn cần 3:1)');
    expect(issueValue(contrast, en)).toBe('2 elements · 2.85:1');
  });

  it('says how much wider than the screen in plain Vietnamese', () => {
    expect(issueValue({ kind: 'overflow', count: 1, detail: '130px', samples: [] }, vi)).toBe('tràn 130px');
  });

  it('moves to the next unit when rounding reaches it', () => {
    expect(formatBytes(999_600)).toBe('1.0 MB');
    expect(formatBytes(999.6)).toBe('1 kB');
    expect(formatBytes(999_400)).toBe('999 kB');
    expect(formatMs(999.6)).toBe('1.0 s');
    expect(formatMs(999.4)).toBe('999 ms');
  });
});

describe('stored baselines', () => {
  const snapshot: Snapshot = {
    id: 'https://example.com/ 375x667',
    page: 'https://example.com/',
    viewport: '375x667',
    name: 'Phone',
    width: 375,
    height: 667,
    createdAt: 1,
    image: new Blob(['png'], { type: 'image/png' }),
    imageWidth: 750,
    imageHeight: 1334,
  };

  it('are used only when they are what the visual check saved', () => {
    expect(isSnapshot(snapshot)).toBe(true);
    expect(isSnapshot({ ...snapshot, image: 'data:image/png;base64,' })).toBe(false);
    expect(isSnapshot({ ...snapshot, width: Number.NaN })).toBe(false);
    expect(isSnapshot({ ...snapshot, name: undefined })).toBe(false);
    expect(isSnapshot(null)).toBe(false);
    expect(isSnapshot('snapshot')).toBe(false);
  });
});

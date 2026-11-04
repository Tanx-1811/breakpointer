import { describe, expect, it } from 'vitest';
import {
  LONG_LINE_MIN_TEXT,
  MAX_LINE_CHARS,
  MAX_LINE_CHARS_CJK,
  charsPerLine,
  cjkShare,
  countLines,
  lineCharLimit,
  longLineLength,
  mentionsPointer,
  swapPointerMedia,
  turnsText,
  type LineRect,
} from '../../src/agent/page-utils';
import { CHECK_KINDS, type AgentCommand, type CheckIssue } from '../../src/agent/protocol';
import { createTranslator } from '../../src/i18n/translate';
import { issueCell } from '../../src/state/audit';
import { canHighlight, issueDetail, issueValue } from '../../src/state/checks';
import { isProCheck } from '../../src/state/plan';
import { rangesOf, type ScanSample } from '../../src/state/scan';
import { SCORE_WEIGHTS, scoreIssues } from '../../src/state/score';

const t = createTranslator('en');

describe('touch-screen styles', () => {
  it('swaps hover and pointer values, so a desktop page shows its touch styles', () => {
    expect(swapPointerMedia('(hover: hover)')).toBe('(hover: none)');
    expect(swapPointerMedia('(hover:none)')).toBe('(hover: hover)');
    // The bare feature is true only with hover.
    expect(swapPointerMedia('(hover)')).toBe('(hover: none)');
    expect(swapPointerMedia('(pointer: fine)')).toBe('(pointer: coarse)');
    expect(swapPointerMedia('(pointer: coarse)')).toBe('(pointer: fine)');
  });

  it('leaves what a touch screen has too', () => {
    expect(swapPointerMedia('(pointer)')).toBe('(pointer)');
    expect(swapPointerMedia('(pointer: none)')).toBe('(pointer: none)');
    expect(swapPointerMedia('(any-pointer: none)')).toBe('(any-pointer: none)');
    expect(swapPointerMedia('(any-pointer)')).toBe('(any-pointer)');
    expect(swapPointerMedia('(hover: maybe)')).toBe('(hover: maybe)');
    expect(swapPointerMedia('(min-width: 600px)')).toBe('(min-width: 600px)');
    expect(swapPointerMedia('(prefers-reduced-motion: reduce)')).toBe('(prefers-reduced-motion: reduce)');
  });

  it('handles any-hover and any-pointer without the hover rule rewriting them', () => {
    expect(swapPointerMedia('(any-hover: hover)')).toBe('(any-hover: none)');
    expect(swapPointerMedia('(any-hover: none)')).toBe('(any-hover: hover)');
    expect(swapPointerMedia('(any-hover)')).toBe('(any-hover: none)');
    expect(swapPointerMedia('(any-pointer: coarse)')).toBe('(any-pointer: fine)');
    expect(swapPointerMedia('(any-pointer: fine)')).toBe('(any-pointer: coarse)');
  });

  it('rewrites mixed queries and lists, whatever the case and spacing', () => {
    expect(swapPointerMedia('screen and (hover: hover) and (pointer: fine)')).toBe(
      'screen and (hover: none) and (pointer: coarse)',
    );
    expect(swapPointerMedia('(hover: none), (pointer: coarse)')).toBe('(hover: hover), (pointer: fine)');
    expect(swapPointerMedia('not all and (hover: hover)')).toBe('not all and (hover: none)');
    expect(swapPointerMedia('(HOVER : HOVER ) and ( POINTER:FINE )')).toBe('(HOVER: none ) and ( POINTER: coarse )');
    expect(swapPointerMedia('(Any-Hover:None)')).toBe('(Any-Hover: hover)');
    // Swapping twice gives the query back.
    const query = '(min-width: 768px) and (hover: hover) and (any-pointer: fine)';
    expect(swapPointerMedia(swapPointerMedia(query))).toBe(query);
  });

  it('knows which media lists mention hover or pointer', () => {
    expect(mentionsPointer('(hover: hover)')).toBe(true);
    expect(mentionsPointer('(any-pointer: coarse)')).toBe(true);
    expect(mentionsPointer('(pointer)')).toBe(true);
    expect(mentionsPointer('screen and (ANY-HOVER: none)')).toBe(true);
    expect(mentionsPointer('(min-width: 600px)')).toBe(false);
    expect(mentionsPointer('screen')).toBe(false);
    expect(mentionsPointer('(prefers-reduced-motion)')).toBe(false);
  });

  it('is optional in the preferences command, and auto-scroll can stop', () => {
    const commands: AgentCommand[] = [
      { type: 'preferences', reducedMotion: false, moreContrast: false, print: false },
      { type: 'preferences', reducedMotion: false, moreContrast: false, print: false, touch: true },
      { type: 'autoScroll', duration: 20_000 },
      { type: 'autoScroll', duration: null },
    ];
    expect(commands).toHaveLength(4);
  });
});

/** Rects of `lines` lines of 19 px text, 24 px apart. */
const linesOf = (lines: number, top = 0): LineRect[] =>
  Array.from({ length: lines }, (_, index) => ({ top: top + index * 24, width: 600, height: 19 }));

describe('long lines: counting lines', () => {
  it('counts lines from the rects of the text', () => {
    expect(countLines([])).toBe(0);
    expect(countLines(linesOf(1))).toBe(1);
    expect(countLines(linesOf(4))).toBe(4);
  });

  it('keeps a link, code or a superscript on its line', () => {
    const rects: LineRect[] = [
      { top: 0, width: 200, height: 19 },
      // A link, then <code> in another font (its top a little lower), then a superscript (higher).
      { top: 0, width: 80, height: 19 },
      { top: 2.5, width: 60, height: 16 },
      { top: -1.7, width: 10, height: 14 },
      { top: 0.4, width: 200, height: 19 },
      { top: 24, width: 600, height: 19 },
      { top: 26, width: 40, height: 16 },
      { top: 48, width: 300, height: 19 },
    ];
    expect(countLines(rects)).toBe(3);
  });

  it('leaves out empty rects', () => {
    expect(countLines([...linesOf(2), { top: 90, width: 0, height: 19 }, { top: 120, width: 30, height: 0 }])).toBe(2);
  });

  it('keeps the columns of a multi-column layout apart (rects come in document order)', () => {
    // Three lines in the first column, then three at the same heights in the second.
    expect(countLines([...linesOf(3), ...linesOf(3)])).toBe(6);
  });

  it('tells lines apart even with a tight line height', () => {
    // 10 px text with 10 px lines: rects 11.5 px tall, 10 px apart.
    expect(countLines(Array.from({ length: 5 }, (_, index) => ({ top: index * 10, width: 300, height: 11.5 })))).toBe(
      5,
    );
  });
});

describe('long lines: characters a line', () => {
  it('counts the last line as half', () => {
    expect(charsPerLine(350, 3)).toBe(140);
    expect(charsPerLine(270, 4)).toBeCloseTo(77.14);
    expect(charsPerLine(10, 0)).toBe(0);
  });

  it('measures the share of Chinese, Japanese and Korean letters', () => {
    expect(cjkShare('日本語のテキストです')).toBe(1);
    expect(cjkShare('안녕하세요')).toBe(1);
    expect(cjkShare('中文 text')).toBe(2 / 6);
    expect(cjkShare('Plain English, 123!')).toBe(0);
    expect(cjkShare('123 !!')).toBe(0);
  });

  it('allows fewer characters a line in Chinese, Japanese and Korean', () => {
    expect(lineCharLimit('An English paragraph.')).toBe(MAX_LINE_CHARS);
    expect(lineCharLimit('これは日本語の段落です。CSS')).toBe(MAX_LINE_CHARS_CJK);
    expect(lineCharLimit('日本語 and a lot more English words')).toBe(MAX_LINE_CHARS);
    expect([MAX_LINE_CHARS, MAX_LINE_CHARS_CJK, LONG_LINE_MIN_TEXT]).toEqual([100, 50, 160]);
  });
});

describe('long lines: the decision', () => {
  /** Words of letters, single spaces, `length` characters. */
  const latin = (length: number) => Array.from({ length }, (_, index) => (index % 5 === 2 ? ' ' : 'a')).join('');

  it('reports blocks with more than 100 characters a line', () => {
    // 400 characters on 3 lines: about 160 a line.
    expect(longLineLength(latin(400), linesOf(3))).toBe(160);
    // On 5 lines: about 89 a line.
    expect(longLineLength(latin(400), linesOf(5))).toBeNull();
    // 101 exactly is reported, 100 isn't.
    expect(longLineLength('x'.repeat(250), linesOf(3))).toBeNull();
    expect(longLineLength('x'.repeat(253), linesOf(3))).toBeCloseTo(101.2);
  });

  it('needs 160 characters and 3 lines', () => {
    expect(longLineLength('x'.repeat(159), linesOf(3))).toBeNull();
    expect(longLineLength('x'.repeat(600), linesOf(2))).toBeNull();
    expect(longLineLength('x'.repeat(600), [])).toBeNull();
  });

  it('collapses whitespace before counting', () => {
    const spaced = `  ${'word    '.repeat(40)}\n\n\t`;
    // "word " × 40, trimmed: 199 characters (about 80 a line), not 325.
    expect(longLineLength(spaced, linesOf(3))).toBeNull();
    expect(longLineLength(`${spaced}${'x'.repeat(80)}`, linesOf(3))).toBeCloseTo(280 / 2.5);
  });

  it('counts characters, not UTF-16 code units', () => {
    // 300 emoji (two code units each): 120 a line on 3 lines, not 240.
    expect(longLineLength('😀'.repeat(300), linesOf(3))).toBe(120);
  });

  it('uses 50 characters for Chinese, Japanese or Korean text', () => {
    const japanese = 'これは日本語の文章です。'.repeat(15); // 180 characters
    expect(longLineLength(japanese, linesOf(3))).toBe(72);
    expect(longLineLength(japanese, linesOf(5))).toBeNull();
    // The same length of English isn't too long.
    expect(longLineLength(latin(180), linesOf(3))).toBeNull();
  });
});

describe('long lines: turned text', () => {
  it('knows transforms that turn or skew text', () => {
    expect(turnsText('none')).toBe(false);
    expect(turnsText('')).toBe(false);
    // Moved and scaled text still has its lines one under the other.
    expect(turnsText('matrix(1, 0, 0, 1, 0, -120)')).toBe(false);
    expect(turnsText('matrix(1.5, 0, 0, 1.5, 0, 0)')).toBe(false);
    expect(turnsText('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 0, 1)')).toBe(false);
    expect(turnsText('matrix(0.707107, 0.707107, -0.707107, 0.707107, 0, 0)')).toBe(true);
    expect(turnsText('matrix(1, 0, 0.5, 1, 0, 0)')).toBe(true);
    expect(turnsText('matrix3d(1, 0, 0, 0, 0, 0.5, 0.866, 0, 0, -0.866, 0.5, 0, 0, 0, 0, 1)')).toBe(true);
    expect(turnsText('none', '45deg')).toBe(true);
    expect(turnsText('none', 'none')).toBe(false);
    // Anything else can't be read: counted as turned.
    expect(turnsText('rotate(45deg)')).toBe(true);
    expect(turnsText('matrix(1, 0, 0)')).toBe(true);
  });
});

describe('long lines: the check', () => {
  const issue = (count: number, detail?: string): CheckIssue => ({ kind: 'long-lines', count, detail, samples: [] });

  it('is a free check, shown after layout shifts', () => {
    expect(CHECK_KINDS.indexOf('long-lines')).toBe(CHECK_KINDS.indexOf('layout-shift') + 1);
    expect(CHECK_KINDS.indexOf('long-lines')).toBeLessThan(CHECK_KINDS.indexOf('missing-alt'));
    expect(isProCheck('long-lines')).toBe(false);
    expect(canHighlight('long-lines')).toBe(true);
  });

  it('costs 4 points', () => {
    expect(SCORE_WEIGHTS['long-lines']).toBe(4);
    expect(scoreIssues([[issue(3, '118')], []])).toMatchObject({
      score: 98,
      costs: [{ kind: 'long-lines', points: 2, sizes: 1 }],
    });
  });

  it('says how long the lines are', () => {
    expect(issueValue(issue(3, '118'), t)).toBe('3 elements · ~118 characters a line');
    expect(issueValue(issue(1, '104'), t)).toBe('1 element · ~104 characters a line');
    expect(issueValue(issue(2), t)).toBe('2 elements');
    expect(issueDetail(issue(3, '118'), t)).toBe('3 text blocks with lines of about 118 characters');
    expect(issueDetail(issue(1, '104'), t)).toBe('1 text block with lines of about 104 characters');
    expect(issueDetail(issue(2), t)).toBe('2 elements');
    expect(issueCell(issue(3, '118'))).toBe('3 · ~118 ch');
    expect(issueCell(issue(2))).toBe('2');
  });

  it('is worst where lines are longest in a width scan', () => {
    const at = (width: number, count: number, detail: string): ScanSample => ({
      width,
      height: 2000,
      issues: [issue(count, detail)],
    });
    const [range] = rangesOf([at(1280, 6, '104'), at(1440, 2, '131'), at(1920, 9, '112')], 'long-lines');
    expect(range).toMatchObject({ from: 1280, to: 1920, peak: { width: 1440 } });
  });
});

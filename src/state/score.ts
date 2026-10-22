import { CHECK_KINDS, type CheckIssue, type CheckKind, type CheckReport } from '../agent/protocol';

/**
 * The responsive score: one number from 0 to 100 for a page at the sizes it
 * was checked at. Each kind of issue costs points — more for a page that
 * scrolls sideways than for a blurry image — in proportion to the share of
 * sizes that have it. It only counts what the checks found: a page with no
 * issues scores 100, which says nothing about what the checks don't look at.
 */

/** Points an issue costs when it shows at every size checked. */
export const SCORE_WEIGHTS: Record<CheckKind, number> = {
  overflow: 25,
  'viewport-meta': 20,
  'fixed-cover': 12,
  'clipped-text': 12,
  'tap-targets': 10,
  'layout-shift': 10,
  'small-text': 8,
  'low-contrast': 8,
  'unnamed-control': 8,
  'unlabeled-field': 8,
  'missing-alt': 6,
  'hidden-focus': 6,
  'upscaled-images': 5,
  'missing-lang': 3,
};

export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export type ScoreCost = { kind: CheckKind; points: number; sizes: number };

export type ResponsiveScore = {
  score: number;
  grade: ScoreGrade;
  /** How many sizes the score is made of. */
  sizes: number;
  /** What it lost points for, the costliest first (rounded to tenths). */
  costs: ScoreCost[];
};

export function gradeOf(score: number): ScoreGrade {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/**
 * The score of a page from the issues found at each size it was checked at
 * (one list per size; sizes that weren't checked are left out). Null when no
 * size was checked.
 */
export function scoreIssues(sizes: readonly (readonly CheckIssue[])[]): ResponsiveScore | null {
  if (sizes.length === 0) return null;
  const costs: ScoreCost[] = [];
  for (const kind of CHECK_KINDS) {
    const count = sizes.filter((issues) => issues.some((issue) => issue.kind === kind)).length;
    if (!count) continue;
    costs.push({ kind, points: Math.round(((SCORE_WEIGHTS[kind] * count) / sizes.length) * 10) / 10, sizes: count });
  }
  costs.sort((a, b) => b.points - a.points || CHECK_KINDS.indexOf(a.kind) - CHECK_KINDS.indexOf(b.kind));
  const lost = costs.reduce((sum, cost) => sum + cost.points, 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - lost)));
  return { score, grade: gradeOf(score), sizes: sizes.length, costs };
}

/** The score of previews' check reports (null reports — not checked — are left out). */
export function responsiveScore(reports: readonly (CheckReport | null | undefined)[]): ResponsiveScore | null {
  return scoreIssues(reports.filter((report): report is CheckReport => Boolean(report)).map((report) => report.issues));
}

/** "86/100 · B" */
export const scoreText = (score: ResponsiveScore) => `${score.score}/100 · ${score.grade}`;

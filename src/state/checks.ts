import type { CheckIssue, CheckKind, CheckReport } from '../agent/protocol';
import type { MessageKey } from '../i18n/en';
import type { Translate } from '../i18n/translate';

export const CHECK_KIND_KEYS: Record<CheckKind, MessageKey> = {
  overflow: 'checks.kind.overflow',
  'viewport-meta': 'checks.kind.viewportMeta',
  'small-text': 'checks.kind.smallText',
  'tap-targets': 'checks.kind.tapTargets',
  'upscaled-images': 'checks.kind.upscaledImages',
  'fixed-cover': 'checks.kind.fixedCover',
  'clipped-text': 'checks.kind.clippedText',
  'low-contrast': 'checks.kind.lowContrast',
  'layout-shift': 'checks.kind.layoutShift',
  'missing-alt': 'checks.kind.missingAlt',
  'unnamed-control': 'checks.kind.unnamedControl',
  'unlabeled-field': 'checks.kind.unlabeledField',
  'hidden-focus': 'checks.kind.hiddenFocus',
  'missing-lang': 'checks.kind.missingLang',
};

/** What each check looks for, in a sentence (shown once above the previews that have the issue). */
export const CHECK_HINT_KEYS: Record<CheckKind, MessageKey> = {
  overflow: 'checks.hint.overflow',
  'viewport-meta': 'checks.hint.viewportMeta',
  'small-text': 'checks.hint.smallText',
  'tap-targets': 'checks.hint.tapTargets',
  'upscaled-images': 'checks.hint.upscaledImages',
  'fixed-cover': 'checks.hint.fixedCover',
  'clipped-text': 'checks.hint.clippedText',
  'low-contrast': 'checks.hint.lowContrast',
  'layout-shift': 'checks.hint.layoutShift',
  'missing-alt': 'checks.hint.missingAlt',
  'unnamed-control': 'checks.hint.unnamedControl',
  'unlabeled-field': 'checks.hint.unlabeledField',
  'hidden-focus': 'checks.hint.hiddenFocus',
  'missing-lang': 'checks.hint.missingLang',
};

/**
 * Numbers the frame agent wrote ("0.243", "2.85:1 · #777 / #fff", "11.5px")
 * with the UI language's decimal separator. Not for text taken from the page.
 */
export const localNumbers = (text: string, t: Translate) =>
  text.replace(/(\d)\.(\d)/g, (_, before: string, after: string) => `${before}${t('format.decimal')}${after}`);

/**
 * The issue in a few words, where the check is named already: "184px too
 * wide", "3 elements · 2.85:1", "CLS 0.24"…
 */
export function issueValue(issue: CheckIssue, t: Translate): string {
  const count = issue.count === 1 ? t('checks.detail.countOne') : t('checks.detail.count', { count: issue.count });
  switch (issue.kind) {
    case 'overflow':
      return issue.detail ? t('checks.value.overflow', { amount: issue.detail }) : count;
    case 'viewport-meta':
      return issue.detail ? `“${issue.detail}”` : t('checks.value.metaMissing');
    case 'fixed-cover':
      return issue.detail ? t('checks.value.cover', { amount: issue.detail }) : count;
    case 'layout-shift':
      return `CLS ${localNumbers(issue.detail ?? '', t)}`.trim();
    case 'low-contrast':
      return issue.detail ? `${count} · ${localNumbers(issue.detail, t)}:1` : count;
    case 'missing-lang':
      return t('checks.value.missingLang');
    default:
      return count;
  }
}

/** A report without the checks switched off (an agent may report before it heard of the change). */
export function withoutKinds(
  report: CheckReport | null | undefined,
  disabled: readonly CheckKind[],
): CheckReport | null {
  if (!report) return null;
  if (!disabled.length || !report.issues.some((issue) => disabled.includes(issue.kind))) return report;
  return { ...report, issues: report.issues.filter((issue) => !disabled.includes(issue.kind)) };
}

/** Page-level issues have nothing to point at in the page. */
export const canHighlight = (kind: CheckKind) => kind !== 'viewport-meta' && kind !== 'missing-lang';

/** One line explaining an issue, e.g. "The page scrolls sideways by 184px." */
export function issueDetail(issue: CheckIssue, t: Translate): string {
  switch (issue.kind) {
    case 'overflow':
      return t('checks.detail.overflow', { amount: issue.detail ?? '' });
    case 'viewport-meta':
      return issue.detail
        ? t('checks.detail.viewportMetaWrong', { content: issue.detail })
        : t('checks.detail.viewportMetaMissing');
    case 'fixed-cover':
      return t('checks.detail.fixedCover', { amount: issue.detail ?? '' });
    case 'layout-shift':
      return t('checks.detail.layoutShift', { amount: localNumbers(issue.detail ?? '', t) });
    case 'missing-lang':
      return t('checks.detail.missingLang');
    case 'low-contrast':
      if (issue.detail) {
        const ratio = localNumbers(issue.detail, t);
        return issue.count === 1
          ? t('checks.detail.lowContrastOne', { ratio })
          : t('checks.detail.lowContrast', { count: issue.count, ratio });
      }
      break;
  }
  return issue.count === 1 ? t('checks.detail.countOne') : t('checks.detail.count', { count: issue.count });
}

import type { CheckIssue, CheckKind } from '../agent/protocol';
import type { MessageKey } from '../i18n/en';
import type { Translate } from '../i18n/translate';

export const CHECK_KIND_KEYS: Record<CheckKind, MessageKey> = {
  overflow: 'checks.kind.overflow',
  'viewport-meta': 'checks.kind.viewportMeta',
  'small-text': 'checks.kind.smallText',
  'tap-targets': 'checks.kind.tapTargets',
};

/** One line explaining an issue, e.g. "The page scrolls sideways by 184px." */
export function issueDetail(issue: CheckIssue, t: Translate): string {
  switch (issue.kind) {
    case 'overflow':
      return t('checks.detail.overflow', { amount: issue.detail ?? '' });
    case 'viewport-meta':
      return issue.detail
        ? t('checks.detail.viewportMetaWrong', { content: issue.detail })
        : t('checks.detail.viewportMetaMissing');
    default:
      return issue.count === 1 ? t('checks.detail.countOne') : t('checks.detail.count', { count: issue.count });
  }
}

import type { CheckKind } from '../agent/protocol';
import type { MessageKey } from '../i18n/en';
import type { Entitlement } from './license';

/**
 * What Breakpointer Pro adds. Everything else is free, and stays free:
 * features that were free when Pro started are never moved behind it.
 */
export type ProFeature = 'a11yChecks' | 'syncInteractions' | 'hideCookieBanners' | 'branding' | 'dataExport';

/** In the order they are presented. */
export const PRO_FEATURES: readonly ProFeature[] = [
  'a11yChecks',
  'syncInteractions',
  'hideCookieBanners',
  'branding',
  'dataExport',
];

export const PRO_FEATURE_KEYS: Record<ProFeature, { title: MessageKey; description: MessageKey }> = {
  a11yChecks: { title: 'pro.feature.a11yChecks', description: 'pro.feature.a11yChecksHint' },
  syncInteractions: { title: 'pro.feature.syncInteractions', description: 'pro.feature.syncInteractionsHint' },
  hideCookieBanners: { title: 'pro.feature.hideCookieBanners', description: 'pro.feature.hideCookieBannersHint' },
  branding: { title: 'pro.feature.branding', description: 'pro.feature.brandingHint' },
  dataExport: { title: 'pro.feature.dataExport', description: 'pro.feature.dataExportHint' },
};

/** The accessibility checks, which come with Pro (`a11yChecks`). */
export const PRO_CHECK_KINDS: readonly CheckKind[] = [
  'missing-alt',
  'unnamed-control',
  'unlabeled-field',
  'hidden-focus',
  'missing-lang',
];

export const isProCheck = (kind: CheckKind) => PRO_CHECK_KINDS.includes(kind);

export const isPro = (entitlement: Entitlement) => entitlement.plan === 'pro';

/** Every Pro feature is in the one plan: the feature is named for the upgrade prompt and for tests. */
export const canUse = (entitlement: Entitlement, _feature: ProFeature) => isPro(entitlement);

/**
 * The checks previews skip: those switched off in Settings, and the Pro checks
 * on the free plan. Kept in display order, so it is stable as a key.
 */
export function skippedChecks(
  disabled: readonly CheckKind[],
  entitlement: Entitlement,
  all: readonly CheckKind[],
): CheckKind[] {
  const pro = isPro(entitlement);
  return all.filter((kind) => disabled.includes(kind) || (!pro && isProCheck(kind)));
}

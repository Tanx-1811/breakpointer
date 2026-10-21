import { createContext, use, type ReactNode } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { FREE_ENTITLEMENT, type Entitlement } from '../../state/license';
import { PRO_FEATURE_KEYS, isPro, type ProFeature } from '../../state/plan';
import styles from './Plan.module.css';

type PlanValue = {
  entitlement: Entitlement;
  /** Shows what Pro brings (the feature that was asked for first). */
  upgrade: (feature?: ProFeature) => void;
};

const PlanContext = createContext<PlanValue>({ entitlement: FREE_ENTITLEMENT, upgrade: () => {} });

/** The plan of this browser, for any component that shows a Pro feature (free until told otherwise). */
export function PlanProvider({ value, children }: { value: PlanValue; children: ReactNode }) {
  return <PlanContext value={value}>{children}</PlanContext>;
}

export function usePlan() {
  const value = use(PlanContext);
  return { ...value, pro: isPro(value.entitlement) };
}

/** The small "Pro" mark next to a feature that comes with Breakpointer Pro. */
export function ProBadge({ feature, className }: { feature?: ProFeature; className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={[styles.badge, className].filter(Boolean).join(' ')}
      title={feature ? t('pro.locked', { feature: t(PRO_FEATURE_KEYS[feature].title) }) : t('pro.name')}
      data-pro-badge
    >
      {t('pro.badge')}
    </span>
  );
}

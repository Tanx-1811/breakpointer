import { useI18n } from '../../i18n/I18nProvider';
import type { VerifyResult } from '../../services/license';
import { TRIAL_DAYS, type Entitlement } from '../../state/license';
import { PRO_FEATURES, PRO_FEATURE_KEYS, type ProFeature } from '../../state/plan';
import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { Icon, type IconName } from '../Icon/Icon';
import { LicenseForm } from './LicenseForm';
import styles from './Plan.module.css';

export const PRO_FEATURE_ICONS: Record<ProFeature, IconName> = {
  a11yChecks: 'accessibility',
  syncInteractions: 'pointer',
  hideCookieBanners: 'cookie',
  branding: 'palette',
  dataExport: 'download',
};

type Props = {
  open: boolean;
  /** The feature that was asked for, shown first (null: opened on its own). */
  feature: ProFeature | null;
  entitlement: Entitlement;
  /** Where Pro is bought; null while sales haven't started. */
  checkoutUrl: string | null;
  onStartTrial: () => void;
  onActivate: (key: string) => Promise<VerifyResult>;
  onActivated: (result: Extract<VerifyResult, { ok: true }>) => void;
  onClose: () => void;
};

/** What Breakpointer Pro adds, the free trial, buying, and entering a licence key. */
export function UpgradeDialog(props: Props) {
  const { t } = useI18n();
  const { entitlement, feature } = props;
  const trial = entitlement.trial;
  const features = feature ? [feature, ...PRO_FEATURES.filter((item) => item !== feature)] : PRO_FEATURES;

  return (
    <Dialog
      open={props.open}
      title={t('pro.name')}
      icon="sparkle"
      onClose={props.onClose}
      width={600}
      description={feature ? t('pro.featureLead', { feature: t(PRO_FEATURE_KEYS[feature].title) }) : t('pro.lead')}
    >
      <div data-testid="upgrade-dialog">
        <ul className={styles.features}>
          {features.map((item) => (
            <li key={item} className={styles.feature} data-current={item === feature || undefined}>
              <span className={styles.featureIcon} aria-hidden="true">
                <Icon name={PRO_FEATURE_ICONS[item]} size={16} />
              </span>
              <span className={styles.featureText}>
                <strong>{t(PRO_FEATURE_KEYS[item].title)}</strong>
                <span>{t(PRO_FEATURE_KEYS[item].description)}</span>
              </span>
            </li>
          ))}
        </ul>
        {feature && <p className={styles.freeNote}>{t('pro.lead')}</p>}

        <div className={styles.offer}>
          {trial.status === 'active' ? (
            <p className={styles.trialStatus} data-testid="trial-status">
              <Icon name="clock" size={15} />
              {trial.daysLeft === 1 ? t('pro.trialActiveOne') : t('pro.trialActive', { days: trial.daysLeft })}
            </p>
          ) : trial.status === 'ended' ? (
            <p className={styles.trialStatus}>{t('pro.trialEnded')}</p>
          ) : null}
          {!props.checkoutUrl && <p className={styles.soon}>{t('pro.soon')}</p>}
          <div className={styles.offerActions}>
            {trial.status === 'available' && (
              <Button
                variant={props.checkoutUrl ? 'secondary' : 'primary'}
                icon="sparkle"
                onClick={props.onStartTrial}
                data-testid="start-trial"
              >
                {t('pro.trialStart', { days: TRIAL_DAYS })}
              </Button>
            )}
            {props.checkoutUrl && (
              <a
                className={styles.buy}
                href={props.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-description={t('pro.getHint')}
              >
                <Icon name="sparkle" size={16} />
                {t('pro.get')}
                <Icon name="external" size={14} />
              </a>
            )}
          </div>
          {trial.status === 'available' && <p className={styles.licenseNote}>{t('pro.trialNote')}</p>}
        </div>

        <h3 className={styles.keyTitle}>{t('pro.keyTitle')}</h3>
        <LicenseForm onActivate={props.onActivate} onActivated={props.onActivated} />
      </div>
    </Dialog>
  );
}

import { useI18n } from '../../i18n/I18nProvider';
import { Button } from '../Button/Button';
import { Icon, Logo, type IconName } from '../Icon/Icon';
import styles from './Welcome.module.css';

type Props = { onTryExample: () => void };

const STEPS: {
  icon: IconName;
  title: 'welcome.step1Title' | 'welcome.step2Title' | 'welcome.step3Title';
  body: 'welcome.step1Body' | 'welcome.step2Body' | 'welcome.step3Body';
}[] = [
  { icon: 'globe', title: 'welcome.step1Title', body: 'welcome.step1Body' },
  { icon: 'layers', title: 'welcome.step2Title', body: 'welcome.step2Body' },
  { icon: 'ruler', title: 'welcome.step3Title', body: 'welcome.step3Body' },
];

/** First thing a user sees in an empty workspace: what it does and how to start. */
export function Welcome({ onTryExample }: Props) {
  const { t } = useI18n();
  return (
    <section className={styles.welcome} aria-labelledby="welcome-title">
      <div className={styles.intro}>
        <Logo size={44} />
        <div>
          <h1 id="welcome-title" className={styles.title}>
            {t('welcome.title')}
          </h1>
          <p className={styles.body}>{t('welcome.body')}</p>
        </div>
      </div>
      <ol className={styles.steps}>
        {STEPS.map((step, index) => (
          <li key={step.title} className={styles.step}>
            <span className={styles.stepIcon}>
              <Icon name={step.icon} size={18} />
            </span>
            <div>
              <h2 className={styles.stepTitle}>
                <span className={styles.stepNumber}>{index + 1}</span>
                {t(step.title)}
              </h2>
              <p className={styles.stepBody}>{t(step.body)}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className={styles.actions}>
        <Button variant="primary" icon="arrowRight" onClick={onTryExample}>
          {t('welcome.try')}
        </Button>
      </div>
    </section>
  );
}

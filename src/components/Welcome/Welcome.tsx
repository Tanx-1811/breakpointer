import { useI18n } from '../../i18n/I18nProvider';
import { Button } from '../Button/Button';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './Welcome.module.css';

type Props = {
  savedPages: string[];
  recentUrls: string[];
  paletteShortcut: string;
  onOpen: (url: string) => void;
  onTryExample: () => void;
};

const STEPS: {
  icon: IconName;
  title: 'welcome.step1Title' | 'welcome.step2Title' | 'welcome.step3Title';
  body: 'welcome.step1Body' | 'welcome.step2Body' | 'welcome.step3Body';
}[] = [
  { icon: 'globe', title: 'welcome.step1Title', body: 'welcome.step1Body' },
  { icon: 'layers', title: 'welcome.step2Title', body: 'welcome.step2Body' },
  { icon: 'inspect', title: 'welcome.step3Title', body: 'welcome.step3Body' },
];

const MAX_PAGES = 6;

const shortUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** First thing a user sees in an empty workspace: what it does and how to start. */
export function Welcome({ savedPages, recentUrls, paletteShortcut, onOpen, onTryExample }: Props) {
  const { t } = useI18n();
  const pages = [
    ...savedPages.map((url) => ({ url, saved: true })),
    ...recentUrls.filter((url) => !savedPages.includes(url)).map((url) => ({ url, saved: false })),
  ].slice(0, MAX_PAGES);

  return (
    <section className={styles.welcome} aria-labelledby="welcome-title">
      <div className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} aria-hidden="true" />
            {t('welcome.eyebrow')}
          </p>
          <h1 id="welcome-title" className={styles.title}>
            {t('welcome.title')}
          </h1>
          <p className={styles.body}>{t('welcome.body')}</p>
          <div className={styles.actions}>
            <Button variant="primary" size="lg" iconEnd="arrowRight" onClick={onTryExample}>
              {t('welcome.try')}
            </Button>
            <p className={styles.tips}>
              <span>
                <kbd>/</kbd> {t('welcome.tipAddress')}
              </span>
              <span>
                <kbd>{paletteShortcut}</kbd> {t('welcome.tipPalette')}
              </span>
            </p>
          </div>
        </div>
        <Illustration />
      </div>

      {pages.length > 0 && (
        <div className={styles.pages}>
          <h2 className={styles.pagesTitle}>{t('welcome.jumpBack')}</h2>
          <ul className={styles.pageList}>
            {pages.map((page) => (
              <li key={page.url}>
                <button type="button" className={styles.page} onClick={() => onOpen(page.url)} title={page.url}>
                  <Icon
                    name={page.saved ? 'star' : 'clock'}
                    size={14}
                    className={styles.pageIcon}
                    data-saved={page.saved || undefined}
                  />
                  <span className={styles.pageUrl}>{shortUrl(page.url)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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
    </section>
  );
}

/** Phone, tablet and laptop showing the same page, with breakpoint tags. Decorative. */
function Illustration() {
  return (
    <svg className={styles.art} viewBox="0 0 340 220" aria-hidden="true" focusable="false">
      {/* Laptop */}
      <rect className={styles.frame} x="96" y="14" width="232" height="148" rx="10" />
      <rect className={styles.screen} x="106" y="24" width="212" height="128" rx="4" />
      <rect className={styles.accent} x="116" y="34" width="54" height="8" rx="4" />
      <rect className={styles.muted} x="236" y="34" width="72" height="8" rx="4" />
      <rect className={styles.strong} x="116" y="54" width="120" height="12" rx="4" />
      <rect className={styles.muted} x="116" y="72" width="96" height="7" rx="3.5" />
      <rect className={styles.card} x="116" y="92" width="58" height="48" rx="5" />
      <rect className={styles.card} x="182" y="92" width="58" height="48" rx="5" />
      <rect className={styles.card} x="248" y="92" width="58" height="48" rx="5" />
      <path className={styles.frame} d="M80 162h264l-10 12H90z" />
      {/* Tablet */}
      <rect className={styles.frame} x="12" y="58" width="122" height="156" rx="14" />
      <rect className={styles.screen} x="20" y="68" width="106" height="136" rx="6" />
      <rect className={styles.accent} x="28" y="78" width="40" height="7" rx="3.5" />
      <rect className={styles.strong} x="28" y="94" width="80" height="10" rx="4" />
      <rect className={styles.muted} x="28" y="110" width="64" height="6" rx="3" />
      <rect className={styles.card} x="28" y="126" width="42" height="36" rx="4" />
      <rect className={styles.card} x="76" y="126" width="42" height="36" rx="4" />
      <rect className={styles.card} x="28" y="168" width="42" height="28" rx="4" />
      {/* Phone */}
      <rect className={styles.frameFront} x="150" y="96" width="66" height="120" rx="13" />
      <rect className={styles.screen} x="156" y="106" width="54" height="102" rx="6" />
      <rect className={styles.accent} x="162" y="114" width="22" height="6" rx="3" />
      <rect className={styles.strong} x="162" y="128" width="42" height="9" rx="3.5" />
      <rect className={styles.muted} x="162" y="142" width="34" height="5" rx="2.5" />
      <rect className={styles.card} x="162" y="154" width="42" height="22" rx="4" />
      <rect className={styles.card} x="162" y="181" width="42" height="22" rx="4" />
      {/* Breakpoint tags */}
      <path className={styles.tag} d="M226 108h22l7 7-7 7h-22z" />
      <path className={styles.tag} d="M140 40h22l7 7-7 7h-22z" />
      <path className={styles.tagLine} d="M233 122v84M147 54v24" />
    </svg>
  );
}

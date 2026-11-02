import { useId, useState } from 'react';
import type { PageMeta } from '../../agent/protocol';
import { useI18n } from '../../i18n/I18nProvider';
import {
  DESCRIPTION_MAX,
  META_CHECK_KEYS,
  META_STATUS_KEYS,
  TITLE_MAX,
  breadcrumb,
  headingOutline,
  headingSummary,
  metaChecks,
  metaSummary,
  metaValue,
  truncate,
  type MetaStatus,
} from '../../state/meta';
import { Icon, type IconName } from '../Icon/Icon';
import { Select } from '../Select/Select';
import styles from './MetaTab.module.css';

type Row = { id: string; name: string; width: number; meta?: PageMeta | null | undefined };

type Props = {
  rows: Row[];
  page: string | null;
  measuring: boolean;
  /** The preview read (its card id); default: the first that answered. */
  card?: string | null;
  onCard?: (cardId: string) => void;
};

const STATUS_ICONS: Record<MetaStatus, IconName> = { ok: 'check', warn: 'alert', bad: 'close', info: 'info' };

/**
 * What the page tells search engines and link previews: an approximate search
 * result and link preview, each tag checked, and the outline of its headings.
 */
export function MetaTab({ rows, page, measuring, card, onCard }: Props) {
  const { t } = useI18n();
  const selectId = useId();
  const answered = rows.filter((row): row is Row & { meta: PageMeta } => Boolean(row.meta));
  const row = answered.find((item) => item.id === card) ?? answered[0];
  if (!row)
    return (
      <p className={styles.waiting} role="status">
        {measuring || rows.some((item) => item.meta === undefined) ? t('audit.measuring') : t('meta.empty')}
      </p>
    );

  const { meta } = row;
  const checks = metaChecks(meta, page);
  const summary = metaSummary(checks, meta.headings);
  const outline = headingOutline(meta.headings);
  const trouble = headingSummary(meta.headings);
  const title = metaValue(meta, 'og:title', 'twitter:title') || meta.title;
  const description = metaValue(meta, 'description');
  const socialDescription = metaValue(meta, 'og:description', 'twitter:description') || description;
  const image = metaValue(meta, 'og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image');
  const siteName = metaValue(meta, 'og:site_name');
  const address = meta.canonical ?? page ?? '';
  let host = '';
  try {
    host = new URL(address).host;
  } catch {
    // No address to show.
  }
  const icon =
    meta.icons.find(
      (item) => item.rel.split(/\s+/).includes('icon') && /(^|\s)(32|48|64|96|128|192)x/.test(item.sizes),
    ) ??
    meta.icons.find((item) => item.rel.split(/\s+/).includes('icon')) ??
    meta.icons[0];

  return (
    <div className={styles.tab} data-testid="meta-tab">
      <div className={styles.summary}>
        <span className={styles.summaryIcon} data-tone={summary.fix ? 'bad' : summary.look ? 'warn' : 'ok'}>
          <Icon name="share" size={16} />
        </span>
        <span className={styles.summaryText}>
          <strong data-testid="meta-summary">
            {summary.fix === 0 && summary.look === 0
              ? t('meta.allGood')
              : t('meta.summary', { fix: summary.fix, look: summary.look })}
          </strong>
          <span>{t('meta.readFrom', { name: row.name, width: row.width })}</span>
        </span>
        {answered.length > 1 && onCard && (
          <label className={styles.picker} htmlFor={selectId}>
            <span className="visually-hidden">{t('meta.preview')}</span>
            <Select id={selectId} size="sm" value={row.id} onChange={(event) => onCard(event.target.value)}>
              {answered.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.width}
                </option>
              ))}
            </Select>
          </label>
        )}
      </div>

      <section className={styles.section} aria-labelledby={`${selectId}-serp`}>
        <h3 id={`${selectId}-serp`} className={styles.heading}>
          {t('meta.searchResult')} <span className={styles.approx}>· {t('meta.approximate')}</span>
        </h3>
        <div className={styles.serp} data-testid="meta-serp">
          <div className={styles.serpSite}>
            <span className={styles.favicon}>
              {icon ? <SiteImage src={icon.href} alt="" fallback="globe" /> : <Icon name="globe" size={14} />}
            </span>
            <span className={styles.serpSiteText}>
              <span className={styles.serpName}>{siteName || host || '—'}</span>
              <span className={styles.serpUrl}>{address ? breadcrumb(address) : '—'}</span>
            </span>
          </div>
          <span className={styles.serpTitle} lang={meta.lang || undefined}>
            {meta.title ? truncate(meta.title, TITLE_MAX) : t('meta.noTitle')}
          </span>
          <span className={styles.serpDescription} lang={meta.lang || undefined}>
            {description ? truncate(description, DESCRIPTION_MAX) : t('meta.noDescription')}
          </span>
        </div>
      </section>

      <section className={styles.section} aria-labelledby={`${selectId}-social`}>
        <h3 id={`${selectId}-social`} className={styles.heading}>
          {t('meta.linkPreview')} <span className={styles.approx}>· {t('meta.approximate')}</span>
        </h3>
        <div className={styles.social} data-testid="meta-social">
          <SocialImage src={image} />
          <span className={styles.socialText} lang={meta.lang || undefined}>
            <span className={styles.socialHost}>{host || '—'}</span>
            <span className={styles.socialTitle}>{title || t('meta.noTitle')}</span>
            {socialDescription && <span className={styles.socialDescription}>{socialDescription}</span>}
          </span>
        </div>
      </section>

      <section className={styles.section} aria-labelledby={`${selectId}-tags`}>
        <h3 id={`${selectId}-tags`} className={styles.heading}>
          {t('meta.tags')}
        </h3>
        <ul className={styles.checks}>
          {checks.map((check) => (
            <li key={check.id} className={styles.check} data-status={check.status} data-testid="meta-check">
              <span className={styles.status}>
                <Icon name={STATUS_ICONS[check.status]} size={11} />
                <span className="visually-hidden">{t(META_STATUS_KEYS[check.status])}</span>
              </span>
              <span className={styles.checkText}>
                <span className={styles.checkHead}>
                  <span className={styles.checkName}>{t(META_CHECK_KEYS[check.id])}</span>
                  <span className={styles.checkNote}>{t(check.note, check.params)}</span>
                </span>
                {check.value && (
                  <code className={styles.checkValue} title={check.value}>
                    {check.value}
                  </code>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby={`${selectId}-headings`}>
        <h3 id={`${selectId}-headings`} className={styles.heading}>
          {t('meta.headings')}
          {(trouble.noH1 || trouble.skips > 0) && (
            <span className={styles.headingWarn}>
              {trouble.noH1 ? t('meta.noH1') : t('meta.skips', { count: trouble.skips })}
            </span>
          )}
        </h3>
        {outline.length === 0 ? (
          <p className={styles.empty}>{t('meta.noHeadings')}</p>
        ) : (
          <ol className={styles.outline} data-testid="meta-outline">
            {outline.map((heading, index) => (
              <li
                key={index}
                className={styles.outlineItem}
                style={{ paddingInlineStart: 10 + (heading.level - 1) * 14 }}
                data-hidden={heading.hidden || undefined}
              >
                <span className={styles.level} data-level={heading.level}>
                  H{heading.level}
                </span>
                <span className={styles.outlineText} lang={meta.lang || undefined}>
                  {heading.text || '—'}
                </span>
                {heading.hidden && <span className={styles.tag}>{t('meta.hiddenHeading')}</span>}
                {heading.issue && (
                  <span className={styles.tag} data-tone="warn">
                    {t(heading.issue === 'skip' ? 'meta.skip' : 'meta.extraH1')}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
      <p className={styles.note}>{t('meta.note')}</p>
    </div>
  );
}

/** An image of the previewed site (its icon), or an icon when it can't be loaded. */
function SiteImage({ src, alt, fallback }: { src: string; alt: string; fallback: IconName }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === src) return <Icon name={fallback} size={14} />;
  return <img src={src} alt={alt} referrerPolicy="no-referrer" onError={() => setFailed(src)} />;
}

/** The page's social image at the link preview's 1.91:1, with its size once loaded. */
function SocialImage({ src }: { src: string }) {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState<{ src: string; width: number; height: number } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src)
    return (
      <span className={styles.noImage}>
        <Icon name="image" size={18} />
        {src ? t('meta.imageFailed') : t('meta.noImage')}
      </span>
    );
  const size = loaded?.src === src ? loaded : null;
  return (
    <span className={styles.socialImage}>
      <img
        src={src}
        alt={t('meta.imageAlt')}
        referrerPolicy="no-referrer"
        onLoad={(event) =>
          setLoaded({ src, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })
        }
        onError={() => setFailed(src)}
      />
      {size && (
        <span className={styles.imageSize} data-testid="meta-image-size">
          {size.width} × {size.height}
        </span>
      )}
    </span>
  );
}

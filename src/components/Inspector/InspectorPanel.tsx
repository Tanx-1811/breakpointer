import type { ElementInfo } from '../../agent/protocol';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/en';
import {
  INSPECTED_PROPERTIES,
  changingProperties,
  propertyValue,
  visibilityChanges,
  type InspectedProperty,
} from '../../state/inspector';
import { gapChanges, gapText, type Gap } from '../../state/gap';
import { SIZE_CLASS_ICONS, type SizeClass } from '../../state/size-class';
import { Button, IconButton } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import styles from './InspectorPanel.module.css';

export type InspectorRow = {
  id: string;
  name: string;
  width: number;
  height: number;
  sizeClass: SizeClass;
  /** undefined: no answer yet (or no agent in that preview); null: not on the page. */
  info: ElementInfo | null | undefined;
  /** The distance to the second element (undefined: not measured; null: one of them isn't shown). */
  gap?: Gap | null;
};

type Props = {
  picking: boolean;
  selector: string | null;
  rows: InspectorRow[];
  /** Tools inside previews need the site's permission. */
  needsAccess: boolean;
  host: string | null;
  busy: boolean;
  onPick: () => void;
  onClear: () => void;
  onClose: () => void;
  onReveal: (id: string) => void;
  onCopySelector: (selector: string) => void;
  /** Copies the comparison as a Markdown table (the button shows when given). */
  onCopyTable?: () => void;
  /** The element cut out of every preview, in one image (the button shows when given). */
  onCaptureAll?: () => void;
  onAllowSite: () => void;
  /** The second element the distance is measured to. */
  target?: { selector: string; label: string } | null;
  /** The next pick is the second element. */
  pickingTarget?: boolean;
  /** Picks a second element to measure the distance to (the button shows when given). */
  onPickTarget?: () => void;
  onClearTarget?: () => void;
  onMeasureGaps?: () => void;
};

const PROPERTY_KEYS: Record<InspectedProperty, MessageKey> = {
  size: 'inspector.prop.size',
  display: 'inspector.prop.display',
  font: 'inspector.prop.font',
  margin: 'inspector.prop.margin',
  padding: 'inspector.prop.padding',
  layout: 'inspector.prop.layout',
  position: 'inspector.prop.position',
};

/** Compares one element across every visible viewport (picked by clicking it in any preview). */
export function InspectorPanel(props: Props) {
  const { t } = useI18n();
  const { rows, selector } = props;
  const infos = rows.map((row) => row.info);
  const changing = changingProperties(infos);
  const label = rows.find((row) => row.info)?.info?.label ?? selector;
  const target = props.target ?? null;
  const gapsChange = gapChanges(rows.map((row) => row.gap));

  return (
    <aside className={styles.panel} aria-labelledby="inspector-title" data-testid="inspector">
      <header className={styles.header}>
        <span className={styles.headerIcon} aria-hidden="true">
          <Icon name="inspect" size={16} />
        </span>
        <h2 id="inspector-title" className={styles.title}>
          {t('inspector.title')}
        </h2>
        <IconButton
          icon="inspect"
          size="sm"
          label={props.picking ? t('inspector.stopPicking') : t('inspector.pick')}
          shortcut="I"
          pressed={props.picking}
          onClick={props.onPick}
        />
        <IconButton icon="close" size="sm" label={t('inspector.close')} shortcut="Esc" onClick={props.onClose} />
      </header>

      <div className={styles.body}>
        {props.needsAccess && props.host && (
          <div className={styles.access}>
            <Icon name="shield" size={15} />
            <span>{t('inspector.accessNote')}</span>
            <Button size="sm" variant="primary" onClick={props.onAllowSite} disabled={props.busy}>
              {t('tools.allowSite', { host: props.host })}
            </Button>
          </div>
        )}

        {!selector ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon} data-picking={props.picking || undefined}>
              <Icon name="inspect" size={22} />
            </span>
            <p className={styles.emptyTitle}>
              {props.picking ? t('inspector.pickingTitle') : t('inspector.emptyTitle')}
            </p>
            <p className={styles.emptyBody}>{t('inspector.emptyBody')}</p>
            {!props.picking && (
              <Button variant="primary" icon="inspect" onClick={props.onPick}>
                {t('inspector.pick')}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className={styles.target}>
              <code className={styles.targetLabel} title={selector}>
                {label}
              </code>
              <div className={styles.targetActions}>
                <Button size="sm" variant="ghost" icon="copy" onClick={() => props.onCopySelector(selector)}>
                  {t('inspector.copySelector')}
                </Button>
                {props.onCopyTable && (
                  <Button size="sm" variant="ghost" icon="clipboard" onClick={props.onCopyTable}>
                    {t('inspector.copyTable')}
                  </Button>
                )}
                {props.onCaptureAll && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="gallery"
                    onClick={props.onCaptureAll}
                    data-testid="inspector-capture"
                  >
                    {t('inspector.captureAll')}
                  </Button>
                )}
                {props.onPickTarget && !target && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon="ruler"
                    onClick={props.onPickTarget}
                    aria-pressed={props.pickingTarget}
                    data-testid="inspector-distance-pick"
                  >
                    {props.pickingTarget ? t('inspector.distanceStop') : t('inspector.distancePick')}
                  </Button>
                )}
                <Button size="sm" variant="ghost" icon="close" onClick={props.onClear}>
                  {t('inspector.clear')}
                </Button>
              </div>
              {target && (
                <div className={styles.distance} data-testid="inspector-distance">
                  <Icon name="ruler" size={14} className={styles.distanceIcon} />
                  <span className={styles.distanceText}>
                    {t('inspector.distanceTo')} <code title={target.selector}>{target.label}</code>
                  </span>
                  {props.onMeasureGaps && (
                    <IconButton
                      icon="reload"
                      size="sm"
                      label={t('inspector.distanceAgain')}
                      onClick={props.onMeasureGaps}
                    />
                  )}
                  {props.onClearTarget && (
                    <IconButton
                      icon="close"
                      size="sm"
                      label={t('inspector.distanceClear')}
                      onClick={props.onClearTarget}
                    />
                  )}
                </div>
              )}
            </div>
            {(changing.size > 0 || visibilityChanges(infos)) && (
              <p className={styles.legend}>
                <span className={styles.legendDot} aria-hidden="true" />
                {t('inspector.legend')}
              </p>
            )}
            <ul className={styles.rows}>
              {rows.map((row) => (
                <li key={row.id} className={styles.row} data-size-class={row.sizeClass}>
                  <button
                    type="button"
                    className={styles.rowHeader}
                    onClick={() => props.onReveal(row.id)}
                    data-tooltip={t('inspector.reveal', { name: row.name })}
                  >
                    <span className={styles.rowIcon} aria-hidden="true">
                      <Icon name={SIZE_CLASS_ICONS[row.sizeClass]} size={14} />
                    </span>
                    <span className={styles.rowName}>{row.name}</span>
                    <span className={styles.rowWidth}>{row.width}</span>
                    <RowState info={row.info} changed={changing.has('size')} />
                  </button>
                  {target && <GapLine gap={row.gap} changed={gapsChange} />}
                  {row.info?.visible && (
                    <dl className={styles.props}>
                      {INSPECTED_PROPERTIES.filter((property) => property !== 'size').map((property) => {
                        const value = propertyValue(row.info!, property);
                        if (!value) return null;
                        return (
                          <div
                            key={property}
                            className={styles.prop}
                            data-changed={changing.has(property) || undefined}
                          >
                            <dt>{t(PROPERTY_KEYS[property])}</dt>
                            <dd>{value}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}

function RowState({ info, changed }: { info: ElementInfo | null | undefined; changed: boolean }) {
  const { t } = useI18n();
  if (info === undefined) return <span className={styles.stateMuted}>{t('inspector.waiting')}</span>;
  if (info === null) return <span className={styles.stateWarn}>{t('inspector.missing')}</span>;
  if (!info.visible) return <span className={styles.stateWarn}>{t('inspector.hidden')}</span>;
  return (
    <span className={styles.stateSize} data-changed={changed || undefined} data-testid="inspector-size">
      {info.width} × {info.height}
    </span>
  );
}

function GapLine({ gap, changed }: { gap: Gap | null | undefined; changed: boolean }) {
  const { t } = useI18n();
  return (
    <p className={styles.gap} data-changed={(changed && Boolean(gap)) || undefined} data-testid="inspector-gap">
      <Icon name="ruler" size={12} />
      {gap === undefined
        ? t('inspector.waiting')
        : gap === null
          ? t('inspector.distanceMissing')
          : gapText(gap, {
              overlap: t('inspector.distanceOverlap'),
              inside: (insets) => t('inspector.distanceInside', { insets }),
            })}
    </p>
  );
}

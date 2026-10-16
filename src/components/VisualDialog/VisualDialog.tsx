import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { formatChange } from '../../state/image-diff';
import { SIZE_CLASS_ICONS, sizeClassOf } from '../../state/size-class';
import type { VisualBaseline, VisualResult } from '../../viewer/useVisualCheck';
import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { Icon } from '../Icon/Icon';
import { Segmented } from '../Segmented/Segmented';
import styles from './VisualDialog.module.css';

/** One viewport in the visual check. */
export type VisualRow = {
  /** Identifies its baseline: size and page colours. */
  key: string;
  name: string;
  width: number;
  height: number;
  baseline: VisualBaseline | undefined;
  result: VisualResult | undefined;
};

type Mode = 'side' | 'slider' | 'diff';

type Props = {
  open: boolean;
  /** Out of sight while the previews are captured. */
  concealed: boolean;
  hasPage: boolean;
  rows: VisualRow[];
  busy: boolean;
  onSave: () => void;
  onCompare: () => void;
  /** Makes the capture of a comparison the new baseline. */
  onAccept: (key: string) => void;
  onDelete: () => void;
  onClose: () => void;
};

const date = (time: number, locale: string) =>
  new Date(time).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

/** Baselines of every viewport, and what changed since. */
export function VisualDialog(props: Props) {
  const { t } = useI18n();
  return (
    <Dialog
      open={props.open}
      title={t('visual.title')}
      description={t('visual.description')}
      icon="gallery"
      onClose={props.onClose}
      width={1040}
      concealed={props.concealed}
    >
      {props.open && <VisualBody {...props} />}
    </Dialog>
  );
}

function VisualBody(props: Props) {
  const { t, language } = useI18n();
  const { rows } = props;
  const [selected, setSelected] = useState<string | null>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  // Where focus goes once the grid shows again: the button that had it is gone
  // (the comparison closed, or a capture was accepted).
  const focusAfter = useRef<{ key: string; to: 'view' | 'tile' } | null>(null);
  useEffect(() => {
    const target = focusAfter.current;
    if (!target || !gridRef.current) return;
    focusAfter.current = null;
    const tile = [...gridRef.current.querySelectorAll<HTMLElement>('[data-key]')].find(
      (item) => item.dataset.key === target.key,
    );
    const view = target.to === 'view' ? tile?.querySelector<HTMLElement>('[data-action="view"]') : null;
    (view ?? tile)?.focus();
  });
  const accept = (key: string) => {
    focusAfter.current = { key, to: 'tile' };
    setSelected(null);
    props.onAccept(key);
  };
  const hasBaseline = rows.some((row) => row.baseline);
  const compared = rows.filter((row) => row.result?.status === 'compared');
  const changed = compared.filter((row) => row.result?.status === 'compared' && row.result.ratio > 0);
  const latest = Math.max(0, ...rows.map((row) => row.baseline?.createdAt ?? 0));
  const detail = rows.find((row) => row.key === selected && row.result?.status === 'compared');

  return (
    <div className={styles.body}>
      <div className={styles.toolbar}>
        <Button
          variant={hasBaseline ? 'secondary' : 'primary'}
          icon="camera"
          onClick={props.onSave}
          disabled={props.busy || !props.hasPage || rows.length === 0}
          data-testid="visual-save"
        >
          {hasBaseline ? t('visual.saveAgain') : t('visual.save')}
        </Button>
        <Button
          variant={hasBaseline ? 'primary' : 'secondary'}
          icon="split"
          onClick={props.onCompare}
          disabled={props.busy || !hasBaseline}
          data-testid="visual-compare"
        >
          {t('visual.compare')}
        </Button>
        <span className={styles.summary} role="status" data-testid="visual-summary">
          {compared.length
            ? changed.length
              ? compared.length === 1
                ? t('visual.summaryOnly')
                : t('visual.summary', { changed: changed.length, total: compared.length })
              : t('visual.summaryNone')
            : hasBaseline
              ? t('visual.baselineFrom', { date: date(latest, language) })
              : t('visual.none')}
        </span>
        {hasBaseline && (
          <Button variant="ghost" size="sm" icon="trash" onClick={props.onDelete} disabled={props.busy}>
            {t('visual.delete')}
          </Button>
        )}
      </div>

      {detail && detail.result?.status === 'compared' && detail.baseline ? (
        <Detail
          row={detail}
          result={detail.result}
          baseline={detail.baseline}
          busy={props.busy}
          onBack={() => {
            focusAfter.current = { key: detail.key, to: 'view' };
            setSelected(null);
          }}
          onAccept={() => accept(detail.key)}
        />
      ) : (
        <ul className={styles.grid} ref={gridRef}>
          {rows.map((row) => (
            <Tile
              key={row.key}
              row={row}
              busy={props.busy}
              onView={() => setSelected(row.key)}
              onAccept={() => accept(row.key)}
            />
          ))}
        </ul>
      )}

      <p className={styles.note}>
        <Icon name="info" size={14} />
        <span>
          {t('visual.privacy')} {t('visual.tip')}
        </span>
      </p>
    </div>
  );
}

function Tile({
  row,
  busy,
  onView,
  onAccept,
}: {
  row: VisualRow;
  busy: boolean;
  onView: () => void;
  onAccept: () => void;
}) {
  const { t, language } = useI18n();
  const { result, baseline } = row;
  const sizeClass = sizeClassOf(row.width, row.height);
  const image =
    result?.status === 'compared' ? result.diffUrl : result?.status === 'missing' ? result.currentUrl : baseline?.url;
  const state =
    result?.status === 'compared'
      ? result.ratio > 0
        ? t('visual.changed', { amount: formatChange(result.ratio, language) })
        : t('visual.noChange')
      : result?.status === 'failed'
        ? t('visual.failed')
        : baseline
          ? t('visual.baselineFrom', { date: date(baseline.createdAt, language) })
          : t('visual.noBaseline');
  const tone =
    result?.status === 'compared'
      ? result.ratio > 0
        ? 'changed'
        : 'same'
      : result?.status === 'failed'
        ? 'failed'
        : 'idle';
  return (
    <li className={styles.tile} data-testid="visual-tile" data-state={tone} data-key={row.key} tabIndex={-1}>
      <div className={styles.thumb}>
        {image ? (
          <img src={image} alt={t('visual.imageLabel', { name: row.name, state })} />
        ) : (
          <Icon name={SIZE_CLASS_ICONS[sizeClass]} size={22} className={styles.thumbIcon} />
        )}
      </div>
      <div className={styles.caption}>
        <span className={styles.name} data-size-class={sizeClass}>
          <Icon name={SIZE_CLASS_ICONS[sizeClass]} size={13} className={styles.classIcon} />
          {row.name}
          <span className={styles.size}>
            {row.width} × {row.height}
          </span>
        </span>
        <span className={styles.state} data-tone={tone} data-testid="visual-state">
          {tone === 'changed' && <Icon name="alert" size={12} />}
          {tone === 'same' && <Icon name="check" size={12} />}
          {state}
        </span>
      </div>
      {(result?.status === 'compared' || result?.status === 'missing') && (
        <div className={styles.tileActions}>
          {result.status === 'compared' && (
            <Button
              size="sm"
              variant="ghost"
              icon="eye"
              onClick={onView}
              aria-label={t('visual.viewLabel', { name: row.name })}
              data-action="view"
            >
              {t('visual.view')}
            </Button>
          )}
          {(result.status === 'missing' || result.ratio > 0) && (
            <Button
              size="sm"
              icon="check"
              onClick={onAccept}
              disabled={busy}
              aria-label={t(result.status === 'missing' ? 'visual.saveThisLabel' : 'visual.acceptLabel', {
                name: row.name,
              })}
            >
              {result.status === 'missing' ? t('visual.saveThis') : t('visual.accept')}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function Detail({
  row,
  result,
  baseline,
  busy,
  onBack,
  onAccept,
}: {
  row: VisualRow;
  result: Extract<VisualResult, { status: 'compared' }>;
  baseline: VisualBaseline;
  busy: boolean;
  onBack: () => void;
  onAccept: () => void;
}) {
  const { t, language } = useI18n();
  const [mode, setMode] = useState<Mode>(result.ratio > 0 ? 'diff' : 'side');
  const [split, setSplit] = useState(50);
  const sliderId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  // The button that opened the comparison is gone: focus moves to Back.
  useEffect(() => sectionRef.current?.querySelector<HTMLElement>('button')?.focus(), []);
  const percent = (value: number, total: number) => `${(value / total) * 100}%`;
  return (
    <section className={styles.detail} aria-label={row.name} data-testid="visual-detail" ref={sectionRef}>
      <div className={styles.detailHead}>
        <Button size="sm" variant="ghost" icon="arrowLeft" onClick={onBack}>
          {t('visual.back')}
        </Button>
        <strong className={styles.detailTitle}>
          {row.name}{' '}
          <span className={styles.size}>
            {row.width} × {row.height}
          </span>
        </strong>
        <Segmented
          label={t('visual.mode')}
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'side', label: t('visual.modeSide'), icon: 'columns' },
            { value: 'slider', label: t('visual.modeSlider'), icon: 'split' },
            { value: 'diff', label: t('visual.modeDiff'), icon: 'overlay' },
          ]}
        />
        {result.ratio > 0 && (
          <Button size="sm" icon="check" onClick={onAccept} disabled={busy}>
            {t('visual.accept')}
          </Button>
        )}
      </div>
      <p className={styles.detailStatus}>
        {result.ratio > 0
          ? t('visual.changed', { amount: formatChange(result.ratio, language) })
          : t('visual.noChange')}
        {result.regions.length > 0 &&
          ` · ${result.regions.length === 1 ? t('visual.regionsOne') : t('visual.regions', { count: result.regions.length })}`}
        {result.resized && ` · ${t('visual.resized')}`}
      </p>

      {mode === 'side' && (
        <div className={styles.side}>
          <figure className={styles.figure}>
            <figcaption>{t('visual.baseline')}</figcaption>
            <img src={baseline.url} alt={`${row.name} · ${t('visual.baseline')}`} />
          </figure>
          <figure className={styles.figure}>
            <figcaption>{t('visual.current')}</figcaption>
            <img src={result.currentUrl} alt={`${row.name} · ${t('visual.current')}`} />
          </figure>
        </div>
      )}

      {mode === 'slider' && (
        <div className={styles.sliderView}>
          <div className={styles.stack}>
            <img src={result.currentUrl} alt={`${row.name} · ${t('visual.current')}`} />
            <img
              src={baseline.url}
              alt=""
              className={styles.top}
              style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
            />
            <span className={styles.divider} style={{ left: `${split}%` }} aria-hidden="true" />
            <span className={styles.stackLabel} data-side="left" aria-hidden="true">
              {t('visual.baseline')}
            </span>
            <span className={styles.stackLabel} data-side="right" aria-hidden="true">
              {t('visual.current')}
            </span>
          </div>
          <label className={styles.sliderLabel} htmlFor={sliderId}>
            {t('visual.slider')}
          </label>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={100}
            value={split}
            onChange={(event) => setSplit(Number(event.target.value))}
            aria-valuetext={`${split}%`}
          />
        </div>
      )}

      {mode === 'diff' && (
        <div className={styles.diffView}>
          <div className={styles.stack}>
            <img src={result.diffUrl} alt={`${row.name} · ${t('visual.modeDiff')}`} />
            {result.regions.map((region, index) => (
              <span
                key={index}
                className={styles.region}
                style={{
                  left: percent(region.x, result.width),
                  top: percent(region.y, result.height),
                  width: percent(region.width, result.width),
                  height: percent(region.height, result.height),
                }}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

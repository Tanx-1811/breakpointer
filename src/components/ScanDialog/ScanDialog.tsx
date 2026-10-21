import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ExportFormat } from '../../state/export';
import { useI18n } from '../../i18n/I18nProvider';
import { issueValue, CHECK_KIND_KEYS } from '../../state/checks';
import {
  DEFAULT_SCAN,
  SCAN_STEPS,
  nearestSample,
  rangeText,
  scanCoverage,
  scanFindings,
  scanWidths,
  validScanOptions,
  type ScanOptions,
  type ScanProgress,
  type ScanSample,
} from '../../state/scan';
import { MAX_DIMENSION, MIN_DIMENSION } from '../../utils/constants';
import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { Icon } from '../Icon/Icon';
import { PreviewFrame } from '../PreviewFrame/PreviewFrame';
import { Select } from '../Select/Select';
import { ExportMenu } from '../Plan/ExportMenu';
import styles from './ScanDialog.module.css';

/** A finished (or stopped) scan of one page. */
export type ScanResult = {
  page: string;
  options: ScanOptions;
  height: number;
  samples: ScanSample[];
  /** False when it was stopped before the end. */
  complete: boolean;
};

type Props = {
  open: boolean;
  /** The page to scan; null when there is none. */
  src: string | null;
  /** Names the preview frame the scan runs in (ties its agent to the scan). */
  frameName: string | undefined;
  /** The frame's agent is running (the scan can start). */
  connected: boolean;
  /** Widths of this site's media queries. */
  siteBreakpoints: number[];
  viewports: { id: string; name: string; width: number; height: number }[];
  /** The last scan, kept for the session. */
  result: ScanResult | null;
  onResult: (result: ScanResult) => void;
  /** Checks the page once the preview frame is `width` wide. */
  probe: (width: number) => Promise<ScanSample>;
  needsAccess: boolean;
  host: string | null;
  busy: boolean;
  onAllowSite: () => void;
  onAddViewport: (width: number, height: number) => void;
  onCopy: (result: ScanResult) => void;
  /** CSV or JSON of the scan shown (Pro; the menu shows when given). */
  onExport?: (result: ScanResult, format: ExportFormat) => void;
  onClose: () => void;
};

const PREVIEW_HEIGHT = 260;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * The width scanner: one preview of the page is resized one width at a time
 * and checked at each; the result shows every issue's exact range of widths,
 * the page's height, this site's breakpoints and your viewports.
 */
export function ScanDialog(props: Props) {
  const { t } = useI18n();
  return (
    <Dialog
      open={props.open}
      title={t('scan.title')}
      description={t('scan.description')}
      icon="scan"
      onClose={props.onClose}
      width={1080}
    >
      {props.open && <ScanBody {...props} />}
    </Dialog>
  );
}

function ScanBody(props: Props) {
  const { t, language } = useI18n();
  const { result, src } = props;
  const shown = result && result.page === src ? result : null;
  const [draft, setDraft] = useState(() => ({
    from: String(shown?.options.from ?? DEFAULT_SCAN.from),
    to: String(shown?.options.to ?? DEFAULT_SCAN.to),
    height: String(shown?.height ?? 800),
    step: shown?.options.step ?? DEFAULT_SCAN.step,
  }));
  const [error, setError] = useState(false);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [live, setLive] = useState<ScanSample[] | null>(null);
  const [probeWidth, setProbeWidth] = useState(() => shown?.options.from ?? DEFAULT_SCAN.from);
  const [cursor, setCursor] = useState<number | null>(null);
  const stop = useRef(false);
  const [boxRef, boxWidth] = useWidth<HTMLDivElement>();
  const fieldsId = useId();

  // Closing the dialog (or this page) stops a scan in progress.
  useEffect(
    () => () => {
      stop.current = true;
    },
    [],
  );

  const height = Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.round(Number(draft.height)) || 800));
  const samples = useMemo(() => live ?? shown?.samples ?? [], [live, shown]);
  const range = running || !shown ? readOptions(draft) : shown.options;
  const zoom = Math.min(1, (boxWidth || 1) / probeWidth, PREVIEW_HEIGHT / height);

  const start = async () => {
    const options = readOptions(draft);
    if (!options || !src) {
      setError(true);
      return;
    }
    setError(false);
    setFailed(false);
    setRunning(true);
    setLive([]);
    stop.current = false;
    let checked: ScanSample[] = [];
    try {
      const found = await scanWidths(
        options,
        (width) => {
          setProbeWidth(width);
          return props.probe(width);
        },
        (next, sofar) => {
          setProgress(next);
          setLive(sofar);
          checked = sofar;
        },
        () => stop.current,
      );
      // Stopped before the first width: the last result (if any) stays.
      if (found.length) props.onResult({ page: src, options, height, samples: found, complete: !stop.current });
    } catch (scanError) {
      console.warn('[Breakpointer] The width scan failed.', scanError);
      setFailed(true);
      // What was found before the preview stopped answering is kept (unless the dialog closed).
      if (checked.length && !stop.current)
        props.onResult({ page: src, options, height, samples: checked, complete: false });
    } finally {
      setRunning(false);
      setLive(null);
    }
  };

  const pick = (width: number) => {
    if (running) return;
    setProbeWidth(Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, Math.round(width))));
  };

  const findings = useMemo(() => scanFindings(samples), [samples]);
  const coverage = useMemo(() => (shown ? scanCoverage(shown.options, shown.samples) : null), [shown]);
  const readout = range ? describeWidth(cursor ?? probeWidth, samples, findings, t, language) : '';

  return (
    <div className={styles.body}>
      {props.needsAccess && props.host && (
        <div className={styles.access}>
          <Icon name="shield" size={15} />
          <span>{t('scan.accessNote')}</span>
          <Button size="sm" variant="primary" onClick={props.onAllowSite} disabled={props.busy}>
            {t('tools.allowSite', { host: props.host })}
          </Button>
        </div>
      )}

      <div className={styles.controls} role="group" aria-labelledby={fieldsId}>
        <span id={fieldsId} className="visually-hidden">
          {t('scan.title')}
        </span>
        <NumberInput
          label={t('scan.from')}
          value={draft.from}
          disabled={running}
          onChange={(from) => setDraft({ ...draft, from })}
          invalid={error}
        />
        <NumberInput
          label={t('scan.to')}
          value={draft.to}
          disabled={running}
          onChange={(to) => setDraft({ ...draft, to })}
          invalid={error}
        />
        <NumberInput
          label={t('scan.height')}
          value={draft.height}
          disabled={running}
          onChange={(value) => setDraft({ ...draft, height: value })}
        />
        <label className={styles.field}>
          <span>{t('scan.step')}</span>
          <Select
            size="sm"
            value={String(draft.step)}
            disabled={running}
            onChange={(event) => setDraft({ ...draft, step: Number(event.target.value) })}
          >
            {SCAN_STEPS.map((step, index) => (
              <option key={step} value={step}>
                {t(index === 0 ? 'scan.stepQuick' : index === 1 ? 'scan.stepNormal' : 'scan.stepThorough', { step })}
              </option>
            ))}
          </Select>
        </label>
        <span className={styles.spacer} />
        {running ? (
          <Button variant="danger" icon="close" onClick={() => (stop.current = true)}>
            {t('scan.stop')}
          </Button>
        ) : (
          <Button
            variant="primary"
            icon="scan"
            onClick={() => void start()}
            disabled={!src || !props.connected}
            data-testid="scan-start"
          >
            {shown ? t('scan.again') : t('scan.start')}
          </Button>
        )}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {t('scan.invalid', { min: MIN_DIMENSION, max: MAX_DIMENSION })}
        </p>
      )}

      <div ref={boxRef} className={styles.preview} style={{ height: PREVIEW_HEIGHT }}>
        {src ? (
          <div className={styles.frame} style={{ width: probeWidth * zoom, height: height * zoom }}>
            <PreviewFrame
              src={src}
              width={probeWidth}
              height={height}
              zoom={zoom}
              title={t('frame.title', { name: t('scan.title'), width: probeWidth, height })}
              name={props.frameName}
            />
            <span className={styles.widthBadge} data-testid="scan-width">
              {probeWidth} × {height}
            </span>
          </div>
        ) : (
          <p className={styles.muted}>{t('card.placeholder')}</p>
        )}
      </div>

      <div className={styles.status} role="status" data-testid="scan-status">
        {running && progress ? (
          <>
            <span className={styles.progressTrack} aria-hidden="true">
              <span className={styles.progressFill} style={{ width: `${percentDone(progress)}%` }} />
            </span>
            {/* Every probe changes this line: screen readers hear the share done, in tens. */}
            <span aria-hidden="true">
              {t('scan.progress', { width: progress.width, done: progress.done, total: progress.total })}
            </span>
            <span className="visually-hidden">
              {t('scan.running', { percent: Math.floor(percentDone(progress) / 10) * 10 })}
            </span>
          </>
        ) : failed ? (
          <span className={styles.error}>{t('scan.failed')}</span>
        ) : src && !props.connected && !props.needsAccess ? (
          t('scan.loading')
        ) : shown && coverage && coverage.to < shown.options.to ? (
          t('scan.stopped', { width: coverage.to, from: coverage.from })
        ) : shown && coverage && !shown.complete && coverage.accuracy > 1 ? (
          t('scan.stoppedEdges', { accuracy: coverage.accuracy })
        ) : shown && coverage && coverage.accuracy > 1 ? (
          t('scan.checkedLimit', { count: shown.samples.length, accuracy: coverage.accuracy })
        ) : shown ? (
          t('scan.checked', { count: shown.samples.length })
        ) : range ? (
          t('scan.ready', { from: range.from, to: range.to })
        ) : null}
      </div>

      {range && (
        <ScanChart
          options={range}
          samples={samples}
          findings={findings}
          breakpoints={props.siteBreakpoints}
          viewports={props.viewports}
          cursor={cursor ?? (running ? null : probeWidth)}
          onCursor={setCursor}
          onPick={pick}
          interactive={!running}
        />
      )}

      {range && (
        <div className={styles.slider}>
          <label className={styles.sliderLabel} htmlFor={`${fieldsId}-width`}>
            {t('scan.width')}
          </label>
          <input
            id={`${fieldsId}-width`}
            type="range"
            min={range.from}
            max={range.to}
            step={1}
            value={Math.min(range.to, Math.max(range.from, probeWidth))}
            disabled={running}
            onChange={(event) => pick(Number(event.target.value))}
            aria-valuetext={`${probeWidth}px`}
          />
          {/* Announced when the slider moves, not on every probe or pointer move. */}
          <output className={styles.readout} aria-live={running || cursor !== null ? 'off' : 'polite'}>
            {readout}
          </output>
        </div>
      )}

      {!running && shown && coverage && (
        <section className={styles.findings} aria-label={t('scan.widths')}>
          {findings.length === 0 ? (
            <p className={styles.ok} data-testid="scan-none">
              <Icon name="check" size={15} /> {t('scan.none', { from: coverage.from, to: coverage.to })}
            </p>
          ) : (
            <ul className={styles.findingList}>
              {findings.map(({ kind, ranges }) => (
                <li key={kind} className={styles.finding} data-testid="scan-finding" data-kind={kind}>
                  <span className={styles.findingName}>
                    <Icon name="alert" size={14} className={styles.warn} />
                    {t(CHECK_KIND_KEYS[kind])}
                  </span>
                  <span className={styles.findingRanges}>
                    {ranges.map((item) => (
                      <button
                        key={`${item.from}-${item.to}`}
                        type="button"
                        className={styles.rangeButton}
                        onClick={() => pick(item.peak.width)}
                        data-tooltip={t('scan.worst', {
                          width: item.peak.width,
                          value: issueValue(item.peak.issue, t),
                        })}
                      >
                        {rangeText(item, t)}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className={styles.actions}>
        <Button
          icon="plus"
          disabled={running || !src}
          onClick={() => props.onAddViewport(probeWidth, height)}
          data-testid="scan-add"
        >
          {t('scan.add', { width: probeWidth })}
        </Button>
        <Button
          icon="clipboard"
          variant="ghost"
          disabled={running || !shown}
          onClick={() => shown && props.onCopy(shown)}
        >
          {t('audit.copy')}
        </Button>
        {props.onExport && (
          <ExportMenu
            onExport={(format) => shown && props.onExport?.(shown, format)}
            disabled={running || !shown}
            testId="scan-export"
          />
        )}
      </div>
    </div>
  );
}

const percentDone = (progress: ScanProgress) => Math.min(100, (progress.done / Math.max(1, progress.total)) * 100);

function readOptions(draft: { from: string; to: string; step: number }): ScanOptions | null {
  return validScanOptions({ from: Number(draft.from), to: Number(draft.to), step: draft.step });
}

/** "At 412 px: the page is 3,210 px tall · Content wider than the screen (184px too wide)". */
function describeWidth(
  width: number,
  samples: ScanSample[],
  findings: ReturnType<typeof scanFindings>,
  t: ReturnType<typeof useI18n>['t'],
  language: string,
): string {
  const parts = [t('scan.at', { width })];
  const sample = nearestSample(samples, width);
  if (!sample) return parts[0]!;
  parts.push(t('scan.atHeight', { height: sample.height.toLocaleString(language) }));
  const present = findings.filter(({ ranges }) => ranges.some((item) => item.from <= width && width <= item.to));
  if (present.length === 0) parts.push(t('scan.atNone'));
  for (const { kind } of present) {
    const issue = sample.issues.find((item) => item.kind === kind);
    parts.push(issue ? `${t(CHECK_KIND_KEYS[kind])} (${issueValue(issue, t)})` : t(CHECK_KIND_KEYS[kind]));
  }
  return `${parts[0]}: ${parts.slice(1).join(' · ')}`;
}

function NumberInput({
  label,
  value,
  onChange,
  disabled,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        className={`field ${styles.number}`}
        type="number"
        inputMode="numeric"
        min={MIN_DIMENSION}
        max={MAX_DIMENSION}
        step={1}
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

/* ---------- Chart: issue ranges and the page's height over one width axis ---------- */

const LABEL_WIDTH = 200;
const RIGHT = 14;
const TOP = 18;
const HEIGHT_ROW = 60;
const ROW = 26;
const AXIS = 24;
const MARKERS = 22;

function ticks(from: number, to: number, width: number): number[] {
  const span = to - from;
  const target = Math.max(2, Math.floor(width / 90));
  const raw = span / target;
  const step = [10, 20, 40, 50, 80, 100, 160, 200, 320, 400, 500, 640, 800, 1000].find((value) => value >= raw) ?? 1600;
  const list: number[] = [];
  for (let value = Math.ceil(from / step) * step; value <= to; value += step) list.push(value);
  return list;
}

function ScanChart({
  options,
  samples,
  findings,
  breakpoints,
  viewports,
  cursor,
  onCursor,
  onPick,
  interactive,
}: {
  options: ScanOptions;
  samples: ScanSample[];
  findings: ReturnType<typeof scanFindings>;
  breakpoints: number[];
  viewports: Props['viewports'];
  cursor: number | null;
  onCursor: (width: number | null) => void;
  onPick: (width: number) => void;
  interactive: boolean;
}) {
  const { t, language } = useI18n();
  const [ref, width] = useWidth<HTMLDivElement>();
  const { from, to } = options;
  const plot = Math.max(1, width - LABEL_WIDTH - RIGHT);
  const x = (value: number) => LABEL_WIDTH + ((value - from) / Math.max(1, to - from)) * plot;
  const rows = findings.length || 1;
  const issuesTop = TOP + HEIGHT_ROW + 8;
  const axisTop = issuesTop + rows * ROW;
  const total = axisTop + AXIS + MARKERS;
  const maxHeight = Math.max(1, ...samples.map((sample) => sample.height));
  const y = (value: number) => TOP + HEIGHT_ROW - 4 - (value / maxHeight) * (HEIGHT_ROW - 12);
  const inRange = (value: number) => value >= from && value <= to;
  const line = samples.map((sample) => `${x(sample.width).toFixed(1)},${y(sample.height).toFixed(1)}`).join(' L');
  const area =
    samples.length > 1
      ? `M${x(samples[0]!.width).toFixed(1)},${TOP + HEIGHT_ROW - 4} L${line} L${x(samples.at(-1)!.width).toFixed(1)},${TOP + HEIGHT_ROW - 4} Z`
      : '';

  const widthAt = (event: { currentTarget: SVGSVGElement; clientX: number }) => {
    const box = event.currentTarget.getBoundingClientRect();
    const position = event.clientX - box.left;
    if (position < LABEL_WIDTH - 4 || position > LABEL_WIDTH + plot + 4) return null;
    return Math.round(from + ((position - LABEL_WIDTH) / plot) * (to - from));
  };

  return (
    <div ref={ref} className={styles.chart} data-testid="scan-chart">
      {width > 0 && (
        <svg
          width={width}
          height={total}
          role="img"
          aria-label={t('scan.chart', { from, to })}
          className={styles.svg}
          data-interactive={interactive || undefined}
          onPointerMove={(event) => interactive && onCursor(widthAt(event))}
          onPointerLeave={() => onCursor(null)}
          onClick={(event) => {
            const value = interactive ? widthAt(event) : null;
            if (value !== null) onPick(Math.min(to, Math.max(from, value)));
          }}
        >
          {/* Hairline grid at the axis ticks. */}
          {ticks(from, to, plot).map((value) => (
            <line key={`grid-${value}`} x1={x(value)} x2={x(value)} y1={TOP} y2={axisTop} className={styles.grid} />
          ))}

          {/* The page's height at each width checked (one series: a line and a light wash). */}
          {area && <path d={area} className={styles.heightArea} />}
          {samples.length > 1 && <path d={`M${line}`} className={styles.heightLine} />}

          {/* One row per kind of issue: the widths where it was found. */}
          {findings.map(({ kind, ranges }, index) => {
            const rowY = issuesTop + index * ROW;
            return (
              <g key={kind} data-kind={kind}>
                <line x1={LABEL_WIDTH} x2={LABEL_WIDTH + plot} y1={rowY + 13} y2={rowY + 13} className={styles.lane} />
                {ranges.map((item) => (
                  <rect
                    key={`${item.from}-${item.to}`}
                    x={x(item.from) - 1.5}
                    y={rowY + 6}
                    width={Math.max(3, x(item.to) - x(item.from) + 3)}
                    height={14}
                    rx={4}
                    className={styles.range}
                    data-tooltip={`${rangeText(item, t)} · ${t('scan.worst', {
                      width: item.peak.width,
                      value: issueValue(item.peak.issue, t),
                    })}`}
                  />
                ))}
              </g>
            );
          })}

          {/* This site's breakpoints, across the rows. */}
          {breakpoints.filter(inRange).map((value) => (
            <g key={`bp-${value}`} data-tooltip={`${t('scan.siteBreakpoints')} · ${value}px`}>
              <line x1={x(value)} x2={x(value)} y1={TOP - 4} y2={axisTop} className={styles.breakpoint} />
              <text x={x(value)} y={TOP - 7} className={styles.breakpointLabel} textAnchor="middle">
                {value}
              </text>
            </g>
          ))}

          {/* The width axis. */}
          <line x1={LABEL_WIDTH} x2={LABEL_WIDTH + plot} y1={axisTop} y2={axisTop} className={styles.axis} />
          {ticks(from, to, plot).map((value) => (
            <text key={`tick-${value}`} x={x(value)} y={axisTop + 16} className={styles.tick} textAnchor="middle">
              {value}
            </text>
          ))}

          {/* Your viewports, under the axis. */}
          {viewports
            .filter((viewport) => inRange(viewport.width))
            .map((viewport) => (
              <g key={viewport.id} data-tooltip={`${viewport.name} · ${viewport.width}px`}>
                <circle cx={x(viewport.width)} cy={axisTop + AXIS + 10} r={8} className={styles.markerHit} />
                <circle cx={x(viewport.width)} cy={axisTop + AXIS + 10} r={4} className={styles.marker} />
              </g>
            ))}

          {/* Where the preview is (or where the pointer is). */}
          {cursor !== null && inRange(cursor) && (
            <g className={styles.cursor}>
              <line x1={x(cursor)} x2={x(cursor)} y1={TOP} y2={axisTop} />
              <rect x={x(cursor) - 22} y={axisTop + 4} width={44} height={17} rx={8.5} className={styles.cursorPill} />
              <text x={x(cursor)} y={axisTop + 16} textAnchor="middle" className={styles.cursorLabel}>
                {cursor}
              </text>
            </g>
          )}
        </svg>
      )}
      {/* Row names as text, so long ones are shortened (with the full name on hover) instead of cut. */}
      {width > 0 && (
        <div className={styles.labels} style={{ width: LABEL_WIDTH - 12 }} aria-hidden="true">
          <span className={styles.label} style={{ top: TOP + 2 }}>
            {t('scan.pageHeight')}
          </span>
          {samples.length > 0 && (
            <span className={styles.labelValue} style={{ top: TOP + 20 }}>
              {maxHeight.toLocaleString(language)} px
            </span>
          )}
          {findings.length === 0 && samples.length > 0 && (
            <span className={styles.labelMuted} style={{ top: issuesTop + 5 }}>
              {t('scan.atNone')}
            </span>
          )}
          {findings.map(({ kind }, index) => (
            <span
              key={kind}
              className={styles.label}
              style={{ top: issuesTop + index * ROW + 5 }}
              data-tooltip={t(CHECK_KIND_KEYS[kind])}
            >
              {t(CHECK_KIND_KEYS[kind])}
            </span>
          ))}
          <span className={styles.labelMuted} style={{ top: axisTop + AXIS + 2 }}>
            {t('scan.viewports')}
          </span>
        </div>
      )}
    </div>
  );
}

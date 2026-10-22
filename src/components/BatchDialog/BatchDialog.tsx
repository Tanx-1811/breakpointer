import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ExportFormat } from '../../state/export';
import { useI18n } from '../../i18n/I18nProvider';
import {
  MAX_BATCH_PAGES,
  addToPageList,
  commonOrigin,
  failureText,
  pageIssueKinds,
  pageLabel,
  pageScoreText,
  parsePageList,
  summarizeRun,
  type BatchCell,
  type BatchRun,
  type BatchSize,
} from '../../state/batch';
import { CHECK_KIND_KEYS, issueDetail, localNumbers } from '../../state/checks';
import type { BatchFrame, BatchProgress } from '../../viewer/useBatchCheck';
import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { Icon } from '../Icon/Icon';
import { PreviewFrame } from '../PreviewFrame/PreviewFrame';
import { ExportMenu } from '../Plan/ExportMenu';
import styles from './BatchDialog.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  /** The list as typed (kept for the session by the workspace). */
  text: string;
  onText: (text: string) => void;
  /** The workspace shows a page (links and the sitemap come from it). */
  hasPage: boolean;
  savedPages: string[];
  /** The sizes every page is checked at (the visible viewports). */
  sizes: BatchSize[];
  run: BatchRun | null;
  running: boolean;
  progress: BatchProgress | null;
  /** The page being checked, in the dialog's own preview. */
  frame: BatchFrame | null;
  frameName: string | undefined;
  onFrameLoad: () => void;
  /** Sites in the list Breakpointer isn't allowed on (their pages can't be checked). */
  missingAccess: string[];
  /** A permission prompt is open. */
  busy: boolean;
  onAllow: () => void;
  /** The pages this page links to, or null when they couldn't be read (a message was shown). */
  onFindLinks: () => Promise<string[] | null>;
  /** The pages in the site's sitemap, or null (a message was shown). */
  onFindSitemap: () => Promise<string[] | null>;
  /** Tells how many pages were added to the list (0: all were in it already). */
  onAdded: (count: number, source: 'links' | 'sitemap' | 'saved') => void;
  onStart: (pages: string[]) => void;
  onStop: () => void;
  onOpenPage: (url: string) => void;
  onCopy: () => void;
  /** CSV or JSON of the run (Pro; the menu shows when given). */
  onExport?: (format: ExportFormat) => void;
  onDownload: () => void;
};

const PREVIEW_HEIGHT = 230;

function useBoxWidth<T extends HTMLElement>() {
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
 * Check pages: a list of pages, each loaded in the dialog's own preview and
 * checked at every viewport size; the result is a table of pages × sizes.
 */
export function BatchDialog(props: Props) {
  const { t } = useI18n();
  return (
    <Dialog
      open={props.open}
      title={t('batch.title')}
      description={t('batch.description')}
      icon="pages"
      onClose={props.onClose}
      width={1080}
    >
      {props.open && <BatchBody {...props} />}
    </Dialog>
  );
}

/** A cell whose issues are shown, in the run that started at `run`. */
type Selected = { page: number; size: number; run: number };

function BatchBody(props: Props) {
  const { t } = useI18n();
  const { run, running, progress, sizes, frame } = props;
  const listId = useId();
  const hintId = useId();
  const [adding, setAdding] = useState<null | 'links' | 'sitemap'>(null);
  const [selection, setSelected] = useState<Selected | null>(null);
  const [previewRef, previewWidth] = useBoxWidth<HTMLDivElement>();
  const parsed = useMemo(() => parsePageList(props.text), [props.text]);
  const pages = parsed.pages.slice(0, MAX_BATCH_PAGES);
  const base = useMemo(() => (run ? commonOrigin(run.pages.map((page) => page.url)) : null), [run]);
  const summary = useMemo(() => (run ? summarizeRun(run) : null), [run]);
  // A new run starts with nothing selected.
  const selected = selection && selection.run === run?.started ? selection : null;

  const add = (additions: string[], source: 'links' | 'sitemap' | 'saved') => {
    const next = addToPageList(props.text, additions);
    props.onText(next.text);
    props.onAdded(next.added, source);
  };

  const find = async (source: 'links' | 'sitemap') => {
    setAdding(source);
    try {
      const found = await (source === 'links' ? props.onFindLinks() : props.onFindSitemap());
      if (found) add(found, source);
    } finally {
      setAdding(null);
    }
  };

  const zoom = frame ? Math.min(1, (previewWidth || 1) / frame.width, PREVIEW_HEIGHT / frame.height) : 1;
  const percent = progress
    ? Math.min(
        100,
        ((progress.page * progress.sizes + progress.size) / Math.max(1, progress.pages * progress.sizes)) * 100,
      )
    : 0;
  const current = progress ? sizes[progress.size] : undefined;
  const selectedPage = selected && run ? run.pages[selected.page] : undefined;
  const selectedCell = selected && selectedPage ? selectedPage.cells[selected.size] : undefined;
  const selectedSize = selected && run ? run.sizes[selected.size] : undefined;

  return (
    <div className={styles.body}>
      {props.missingAccess.length > 0 && (
        <div className={styles.access} data-testid="batch-access">
          <Icon name="shield" size={15} />
          <span>
            {props.missingAccess.length === 1
              ? t('batch.accessNoteOne', { host: props.missingAccess[0]! })
              : t('batch.accessNote', { count: props.missingAccess.length })}
          </span>
          <Button size="sm" variant="primary" onClick={props.onAllow} disabled={props.busy}>
            {props.missingAccess.length === 1
              ? t('tools.allowSite', { host: props.missingAccess[0]! })
              : t('batch.allow')}
          </Button>
        </div>
      )}

      <div className={styles.top}>
        <div className={styles.list}>
          <label htmlFor={listId} className={styles.label}>
            {t('batch.listLabel')}
          </label>
          <textarea
            id={listId}
            className={`field ${styles.textarea}`}
            value={props.text}
            onChange={(event) => props.onText(event.target.value)}
            placeholder={t('batch.listPlaceholder')}
            spellCheck={false}
            autoComplete="off"
            rows={8}
            disabled={running}
            aria-describedby={hintId}
            aria-invalid={parsed.invalid.length > 0 || undefined}
            data-autofocus
            data-testid="batch-list"
          />
          <div className={styles.adders} role="group" aria-label={t('batch.addLabel')}>
            <Button
              size="sm"
              icon="link"
              onClick={() => void find('links')}
              disabled={!props.hasPage || running || adding !== null}
              data-testid="batch-links"
            >
              {t('batch.addLinks')}
            </Button>
            <Button
              size="sm"
              icon="globe"
              onClick={() => void find('sitemap')}
              disabled={!props.hasPage || running || adding !== null}
              data-testid="batch-sitemap"
            >
              {t('batch.addSitemap')}
            </Button>
            <Button
              size="sm"
              icon="star"
              onClick={() => add(props.savedPages, 'saved')}
              disabled={props.savedPages.length === 0 || running}
            >
              {t('batch.addSaved', { count: props.savedPages.length })}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => props.onText('')} disabled={running || !props.text}>
              {t('batch.clear')}
            </Button>
          </div>
          <p id={hintId} className={parsed.invalid.length ? styles.error : styles.hint} aria-live="polite">
            {parsed.invalid.length === 1
              ? t('batch.invalidOne', { line: parsed.invalid[0]! })
              : parsed.invalid.length > 1
                ? t('batch.invalid', { lines: parsed.invalid.join(', ') })
                : parsed.pages.length > MAX_BATCH_PAGES
                  ? t('batch.tooMany', { max: MAX_BATCH_PAGES })
                  : t('batch.counts', { pages: pages.length, sizes: sizes.length })}
          </p>
        </div>

        <div ref={previewRef} className={styles.preview} style={{ height: PREVIEW_HEIGHT }}>
          {frame ? (
            <div className={styles.frame} style={{ width: frame.width * zoom, height: frame.height * zoom }}>
              {/* A new frame for every page, so a late event of the last one can't count for this one. */}
              <PreviewFrame
                key={frame.load}
                src={frame.src}
                width={frame.width}
                height={frame.height}
                zoom={zoom}
                title={t('frame.title', { name: t('batch.title'), width: frame.width, height: frame.height })}
                name={props.frameName}
                onLoad={props.onFrameLoad}
              />
              <span className={styles.sizeBadge}>
                {frame.width} × {frame.height}
              </span>
            </div>
          ) : (
            <p className={styles.muted}>{t('batch.previewIdle')}</p>
          )}
        </div>
      </div>

      <div className={styles.controls}>
        <span className={styles.sizesLabel}>{t('batch.sizes')}</span>
        <ul className={styles.sizes}>
          {sizes.map((size) => (
            <li key={size.key} className={styles.size}>
              {size.name} <span className={styles.mono}>{size.width}</span>
            </li>
          ))}
        </ul>
        <span className={styles.spacer} />
        {running ? (
          <Button variant="danger" icon="close" onClick={props.onStop}>
            {t('batch.stop')}
          </Button>
        ) : (
          <Button
            variant="primary"
            icon="pages"
            onClick={() => props.onStart(pages)}
            disabled={pages.length === 0 || sizes.length === 0 || parsed.invalid.length > 0}
            data-testid="batch-start"
          >
            {run ? t('batch.again') : t('batch.start')}
          </Button>
        )}
      </div>

      <div className={styles.status} role="status" data-testid="batch-status">
        {running && progress ? (
          <>
            <span className={styles.progressTrack} aria-hidden="true">
              <span className={styles.progressFill} style={{ width: `${percent}%` }} />
            </span>
            <span aria-hidden="true">
              {t('batch.progress', {
                page: progress.page + 1,
                pages: progress.pages,
                size: current ? `${current.name} (${current.width} × ${current.height})` : '',
              })}
            </span>
            <span className="visually-hidden">{t('batch.running', { percent: Math.floor(percent / 10) * 10 })}</span>
          </>
        ) : sizes.length === 0 ? (
          t('batch.noSizes')
        ) : summary && run ? (
          <>
            {summary.checked === 0
              ? t('batch.summaryNothing')
              : summary.withIssues === 0
                ? t('batch.summaryNone', { checked: summary.checked })
                : t('batch.summary', { issues: summary.withIssues, checked: summary.checked })}
            {!run.complete && ` ${t('batch.stopped')}`}
          </>
        ) : null}
      </div>

      {run && (
        <div className={styles.tableWrap}>
          <table className={styles.table} data-testid="batch-table">
            <thead>
              <tr>
                <th scope="col">{t('batch.page')}</th>
                {run.sizes.map((size) => (
                  <th key={size.key} scope="col" className={styles.sizeHead}>
                    {size.name}
                    <span className={styles.mono}>{size.width}</span>
                  </th>
                ))}
                <th scope="col" className={styles.scoreHead}>
                  {t('score.column')}
                </th>
                <th scope="col">
                  <span className="visually-hidden">{t('batch.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {run.pages.map((page, index) => {
                const label = pageLabel(page.url, base);
                return (
                  <tr
                    key={page.url}
                    data-testid="batch-row"
                    data-page={page.url}
                    data-status={page.status}
                    aria-current={running && progress?.page === index ? 'true' : undefined}
                  >
                    <th scope="row" className={styles.pageCell}>
                      <span className={styles.pageName} data-tooltip={page.url}>
                        {label}
                      </span>
                      {page.finalUrl && (
                        <span className={styles.moved}>
                          {t('batch.redirected', { page: pageLabel(page.finalUrl, base) })}
                        </span>
                      )}
                    </th>
                    {page.status === 'failed' ? (
                      <td colSpan={run.sizes.length} className={styles.failed} data-testid="batch-failed">
                        <Icon name="alert" size={14} /> {failureText(page, t)}
                      </td>
                    ) : (
                      page.cells.map((cell, at) => (
                        <td key={run.sizes[at]!.key}>
                          <CellView
                            cell={cell}
                            checking={running && progress?.page === index && progress.size === at}
                            selected={selected?.page === index && selected.size === at}
                            label={`${label} · ${run.sizes[at]!.name}`}
                            onSelect={() =>
                              setSelected(
                                selected?.page === index && selected.size === at
                                  ? null
                                  : { page: index, size: at, run: run.started },
                              )
                            }
                          />
                        </td>
                      ))
                    )}
                    <td className={styles.scoreCell} data-testid="batch-score">
                      {pageScoreText(page)}
                    </td>
                    <td className={styles.rowActions}>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="external"
                        onClick={() => props.onOpenPage(page.url)}
                        disabled={running}
                        data-tooltip={t('batch.openHint')}
                      >
                        {t('batch.open')}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedPage && selectedSize && selectedCell?.status === 'checked' && selectedCell.issues.length > 0 && (
        <section className={styles.details} aria-label={t('batch.detailsLabel')} data-testid="batch-details">
          <h3 className={styles.detailsTitle}>
            {t('batch.details', {
              page: pageLabel(selectedPage.url, base),
              size: `${selectedSize.name} (${selectedSize.width} × ${selectedSize.height})`,
            })}
          </h3>
          <ul className={styles.issues}>
            {selectedCell.issues.map((issue) => (
              <li key={issue.kind} className={styles.issue}>
                <strong>{t(CHECK_KIND_KEYS[issue.kind])}</strong>
                <span className={styles.issueText}>{issueDetail(issue, t)}</span>
                {issue.samples.length > 0 && (
                  <ul className={styles.samples}>
                    {issue.samples.map((sample, at) => (
                      <li key={`${sample.selector}-${at}`}>
                        <code>{sample.selector}</code>
                        {sample.detail && <span> · {localNumbers(sample.detail, t)}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={styles.actions}>
        <Button icon="clipboard" variant="ghost" onClick={props.onCopy} disabled={running || !run}>
          {t('audit.copy')}
        </Button>
        <Button icon="download" variant="ghost" onClick={props.onDownload} disabled={running || !run}>
          {t('batch.download')}
        </Button>
        {props.onExport && <ExportMenu onExport={props.onExport} disabled={running || !run} testId="batch-export" />}
        {run && !running && (
          <span className={styles.legend}>
            {run.pages.some((page) => pageIssueKinds(page).length) ? t('batch.legend') : null}
          </span>
        )}
      </div>
    </div>
  );
}

function CellView({
  cell,
  checking,
  selected,
  label,
  onSelect,
}: {
  cell: BatchCell | null;
  checking: boolean;
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  if (!cell)
    return checking ? (
      <span className={styles.checking} data-testid="batch-cell" data-state="checking">
        <span className={styles.spinner} aria-hidden="true" />
        <span className="visually-hidden">{t('batch.checkingCell')}</span>
      </span>
    ) : (
      <span className={styles.pending} data-testid="batch-cell" data-state="pending" aria-label={t('batch.notChecked')}>
        —
      </span>
    );
  if (cell.status === 'failed')
    return (
      <span
        className={styles.cellFailed}
        data-testid="batch-cell"
        data-state="failed"
        data-tooltip={t('batch.cellFailed')}
      >
        <Icon name="close" size={13} />
        <span className="visually-hidden">{t('batch.cellFailed')}</span>
      </span>
    );
  if (cell.issues.length === 0)
    return (
      <span className={styles.ok} data-testid="batch-cell" data-state="ok">
        <Icon name="check" size={14} />
        <span className="visually-hidden">{t('batch.cellOk')}</span>
      </span>
    );
  const names = cell.issues.map((issue) => t(CHECK_KIND_KEYS[issue.kind])).join(', ');
  return (
    <button
      type="button"
      className={styles.issuesButton}
      aria-pressed={selected}
      // The visible count starts the name (WCAG 2.5.3, label in name).
      aria-label={`${cell.issues.length} · ${label} · ${names}`}
      data-tooltip={names}
      data-testid="batch-cell"
      data-state="issues"
      data-kinds={cell.issues.map((issue) => issue.kind).join(' ')}
      onClick={onSelect}
    >
      <Icon name="alert" size={13} />
      {cell.issues.length}
    </button>
  );
}

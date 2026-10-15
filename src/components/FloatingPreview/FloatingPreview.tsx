import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/I18nProvider';
import { Icon } from '../Icon/Icon';
import { ALLOW, SANDBOX } from '../PreviewFrame/PreviewFrame';
import styles from './FloatingPreview.module.css';

export type FloatingViewport = { id: string; name: string; width: number; height: number };

/** Height of the floating window's toolbar, in CSS pixels. */
export const FLOATING_TOOLBAR = 40;

type Props = {
  /** The always-on-top window opened with Document Picture-in-Picture. */
  pipWindow: Window;
  /** The workspace's page; the floating preview follows it. */
  src: string | null;
  viewports: FloatingViewport[];
  viewportId: string;
  theme: 'light' | 'dark';
  onViewport: (id: string) => void;
  /** Brings the workspace back to the front. */
  onWorkspace: () => void;
  onClose: () => void;
};

/**
 * A floating window's document starts empty: the workspace's stylesheets
 * (design tokens and component styles) are copied into it, with absolute URLs.
 */
export function adoptStyles(from: Document, to: Document) {
  for (const node of Array.from(from.head.querySelectorAll<HTMLElement>('link[rel="stylesheet"], style'))) {
    const copy = node.cloneNode(true) as HTMLElement;
    if (copy instanceof HTMLLinkElement && node instanceof HTMLLinkElement) copy.href = node.href;
    to.head.append(copy);
  }
}

/** The floating window's document isn't React's: its theme and title are set directly. */
function decorateWindow(pip: Window, theme: string, title: string) {
  pip.document.documentElement.dataset.theme = theme;
  pip.document.title = title;
}

/** The zoom at which a viewport fits the floating window's content area. */
export function floatingZoom(viewport: { width: number; height: number }, area: { width: number; height: number }) {
  return Math.max(0.05, Math.min(1, area.width / viewport.width, (area.height - FLOATING_TOOLBAR) / viewport.height));
}

/**
 * The workspace's page at one viewport size, in a small window that stays on
 * top of every other window — to keep a phone-sized preview next to an editor
 * while working. It follows the workspace's address.
 */
export function FloatingPreview(props: Props) {
  const { pipWindow, src, viewports, viewportId, theme } = props;
  const { t } = useI18n();
  const selectId = useId();
  const viewport = viewports.find((vp) => vp.id === viewportId) ?? viewports[0];
  const [area, setArea] = useState({ width: pipWindow.innerWidth, height: pipWindow.innerHeight });
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    const onResize = () => setArea({ width: pipWindow.innerWidth, height: pipWindow.innerHeight });
    pipWindow.addEventListener('resize', onResize);
    return () => pipWindow.removeEventListener('resize', onResize);
  }, [pipWindow]);

  const title = viewport ? t('floating.title', { name: viewport.name }) : 'Breakpointer';
  useEffect(() => decorateWindow(pipWindow, theme, title), [pipWindow, theme, title]);

  if (!viewport) return null;
  const zoom = floatingZoom(viewport, area);

  return createPortal(
    <div className={styles.root} data-testid="floating-preview">
      <header className={styles.bar}>
        <label className="visually-hidden" htmlFor={selectId}>
          {t('floating.viewport')}
        </label>
        <select
          id={selectId}
          className={styles.select}
          value={viewport.id}
          onChange={(event) => props.onViewport(event.target.value)}
        >
          {viewports.map((vp) => (
            <option key={vp.id} value={vp.id}>
              {vp.name} · {vp.width}×{vp.height}
            </option>
          ))}
        </select>
        <span className={styles.zoom}>{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className={styles.button}
          aria-label={t('floating.reload')}
          title={t('floating.reload')}
          onClick={() => setReloads((count) => count + 1)}
          disabled={!src}
        >
          <Icon name="reload" size={15} />
        </button>
        <button
          type="button"
          className={styles.button}
          aria-label={t('floating.workspace')}
          title={t('floating.workspace')}
          onClick={props.onWorkspace}
        >
          <Icon name="panel" size={15} />
        </button>
        <button
          type="button"
          className={styles.button}
          aria-label={t('floating.close')}
          title={t('floating.close')}
          onClick={props.onClose}
        >
          <Icon name="close" size={15} />
        </button>
      </header>
      <div className={styles.stage}>
        {src ? (
          <div className={styles.viewport} style={{ width: viewport.width * zoom, height: viewport.height * zoom }}>
            <iframe
              key={`${src}#${reloads}`}
              className={styles.frame}
              src={src}
              title={t('frame.title', { name: viewport.name, width: viewport.width, height: viewport.height })}
              width={viewport.width}
              height={viewport.height}
              style={{ width: viewport.width, height: viewport.height, transform: `scale(${zoom})` }}
              sandbox={SANDBOX}
              allow={ALLOW}
              referrerPolicy="strict-origin-when-cross-origin"
              data-viewport-width={viewport.width}
            />
          </div>
        ) : (
          <p className={styles.empty}>{t('floating.empty')}</p>
        )}
      </div>
    </div>,
    pipWindow.document.body,
  );
}

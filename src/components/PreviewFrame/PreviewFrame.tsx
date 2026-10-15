import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { createStrayInputMonitor, type StrayInputKind } from '../../state/stray-input';
import styles from './PreviewFrame.module.css';

/**
 * Sandbox flags: everything a normal page needs, except navigating the top
 * window. That stops "frame-busting" scripts from replacing the workspace.
 */
export const SANDBOX = [
  'allow-scripts',
  'allow-same-origin',
  'allow-forms',
  'allow-popups',
  'allow-popups-to-escape-sandbox',
  'allow-modals',
  'allow-downloads',
  'allow-pointer-lock',
  'allow-presentation',
  'allow-storage-access-by-user-activation',
].join(' ');

/** Features a page would normally have in a tab (video, fullscreen, clipboard…). */
export const ALLOW = 'fullscreen; autoplay; encrypted-media; picture-in-picture; clipboard-write; web-share';

const SLOW_AFTER_MS = 12000;

/* Input aimed at a preview that reached the workspace instead (see state/stray-input.ts). */
const frames = new Set<HTMLIFrameElement>();
const strayInput = createStrayInputMonitor();

function trackFrame(frame: HTMLIFrameElement | null) {
  if (!frame) return;
  frames.add(frame);
  return () => {
    frames.delete(frame);
  };
}

/** Moves every preview by a hundredth of a pixel for two frames and back, so Chrome rebuilds their hit-test data. */
function refreshFrames() {
  const moved = [...frames];
  for (const frame of moved) frame.style.translate = '0.01px 0.01px';
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      for (const frame of moved) frame.style.translate = '';
    }),
  );
}

const onStrayInput = (kind: StrayInputKind) => (event: { timeStamp: number }) => {
  if (strayInput.note(kind, event.timeStamp)) refreshFrames();
};
const onStrayPress = onStrayInput('press');
const onStrayWheel = onStrayInput('wheel');
const onStrayMove = onStrayInput('move');

type Status = 'loading' | 'slow' | 'loaded';

type Props = {
  src: string;
  width: number;
  height: number;
  zoom: number;
  title: string;
  /** Called from the "navigated away" chip to show the original page again. */
  onBack?: () => void;
  /** iframe name; the frame agent reports it so the workspace knows which card it is. */
  name?: string;
  /**
   * Whether the page inside moved away from `src`, when known (from the frame
   * agent). Otherwise a second `load` event is taken to mean it did.
   */
  navigatedAway?: boolean;
  /** A CSS filter drawn over the rendered page (vision simulation). */
  filter?: string | null;
};

/**
 * Renders a page with a real layout viewport of `width` × `height` CSS pixels.
 * The iframe itself has that size, so media queries and layout respond to it;
 * `zoom` only scales the finished rendering to fit the workspace.
 *
 * The loading indicator never covers the page: real sites paint long before
 * their `load` event (which waits for every ad and tracker), so the preview
 * stays visible while a thin bar and a small badge show progress.
 */
export function PreviewFrame({ src, width, height, zoom, title, onBack, name, navigatedAway, filter }: Props) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>('loading');
  // A second load event means the page inside navigated (e.g. a clicked link);
  // the frame no longer shows the address in the workspace's address bar.
  const loads = useRef(0);
  const [navigated, setNavigated] = useState(false);

  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => setStatus('slow'), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <div className={styles.viewport} style={{ width: width * zoom, height: height * zoom }} data-status={status}>
      <iframe
        ref={trackFrame}
        className={styles.frame}
        src={src}
        name={name}
        title={title}
        width={width}
        height={height}
        style={{ width, height, transform: `scale(${zoom})`, filter: filter ?? undefined }}
        sandbox={SANDBOX}
        allow={ALLOW}
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => {
          loads.current += 1;
          if (loads.current > 1) setNavigated(true);
          setStatus('loaded');
        }}
        onPointerDown={onStrayPress}
        onWheel={onStrayWheel}
        onPointerMove={onStrayMove}
        data-testid="preview-frame"
        data-viewport-width={width}
        data-viewport-height={height}
      />
      {(navigatedAway ?? navigated) && onBack && (
        <button type="button" className={styles.navigated} onClick={onBack} data-tooltip={t('frame.navigatedHint')}>
          {t('frame.navigated')}
        </button>
      )}
      {status !== 'loaded' && (
        <>
          <span className={styles.progress} aria-hidden="true" />
          <span
            className={styles.badge}
            role="status"
            title={status === 'slow' ? t('frame.slow') : undefined}
            data-testid="frame-loading"
          >
            <span className={styles.spinner} aria-hidden="true" />
            {status === 'slow' ? t('frame.slowShort') : t('frame.loading')}
          </span>
        </>
      )}
    </div>
  );
}

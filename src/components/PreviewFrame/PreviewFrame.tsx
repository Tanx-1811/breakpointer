import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import styles from './PreviewFrame.module.css';

/**
 * Sandbox flags: everything a normal page needs, except navigating the top
 * window. That stops "frame-busting" scripts from replacing the workspace.
 */
const SANDBOX = [
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
const ALLOW = 'fullscreen; autoplay; encrypted-media; picture-in-picture; clipboard-write; web-share';

const SLOW_AFTER_MS = 12000;

type Status = 'loading' | 'slow' | 'loaded';

type Props = {
  src: string;
  width: number;
  height: number;
  zoom: number;
  title: string;
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
export function PreviewFrame({ src, width, height, zoom, title }: Props) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => setStatus('slow'), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <div className={styles.viewport} style={{ width: width * zoom, height: height * zoom }} data-status={status}>
      <iframe
        className={styles.frame}
        src={src}
        title={title}
        width={width}
        height={height}
        style={{ width, height, transform: `scale(${zoom})` }}
        sandbox={SANDBOX}
        allow={ALLOW}
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => setStatus('loaded')}
        data-testid="preview-frame"
        data-viewport-width={width}
        data-viewport-height={height}
      />
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

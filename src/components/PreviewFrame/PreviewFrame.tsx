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
].join(' ');

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
        allow="fullscreen; clipboard-write"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => setStatus('loaded')}
        data-testid="preview-frame"
        data-viewport-width={width}
        data-viewport-height={height}
      />
      {status !== 'loaded' && (
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          <span className={styles.loadingText}>{status === 'slow' ? t('frame.slow') : t('frame.loading')}</span>
        </div>
      )}
    </div>
  );
}

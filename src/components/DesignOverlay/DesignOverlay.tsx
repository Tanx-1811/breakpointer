import { useI18n } from '../../i18n/I18nProvider';
import { IconButton } from '../Button/Button';
import styles from './DesignOverlay.module.css';

/** A design mockup laid over one preview (this session only; the image never leaves the browser). */
export type DesignOverlayState = {
  /** An object URL of the image file. */
  src: string;
  opacity: number;
  /** Blend with `difference`: identical pixels turn black, so mismatches stand out. */
  difference: boolean;
  hidden: boolean;
};

type Props = {
  overlay: DesignOverlayState;
  /** Viewport size in CSS pixels. */
  width: number;
  height: number;
  zoom: number;
  /** The page's scroll position, when known (the image moves with the page). */
  scrollY: number;
  /** The card's name, for the controls' label. */
  name: string;
  onChange: (patch: Partial<DesignOverlayState>) => void;
  onRemove: () => void;
};

/**
 * The image is as wide as the viewport (designs exported at 1× or 2× of that
 * width both line up) and starts at the top of the page.
 */
export function DesignOverlay({ overlay, width, height, zoom, scrollY, name, onChange, onRemove }: Props) {
  const { t } = useI18n();
  return (
    <>
      {!overlay.hidden && (
        <div className={styles.clip} style={{ width: width * zoom, height: height * zoom }} aria-hidden="true">
          <img
            src={overlay.src}
            alt=""
            draggable={false}
            className={styles.image}
            style={{
              width: width * zoom,
              opacity: overlay.opacity,
              transform: `translateY(${-scrollY * zoom}px)`,
              mixBlendMode: overlay.difference ? 'difference' : undefined,
            }}
            data-testid="design-overlay"
          />
        </div>
      )}
      <div className={styles.bar} role="group" aria-label={t('overlay.label', { name })}>
        <input
          type="range"
          className={styles.range}
          min={0.1}
          max={1}
          step={0.05}
          value={overlay.opacity}
          disabled={overlay.hidden}
          aria-label={t('overlay.opacity')}
          aria-valuetext={`${Math.round(overlay.opacity * 100)}%`}
          data-tooltip={t('overlay.opacity')}
          onChange={(event) => onChange({ opacity: Number(event.target.value) })}
        />
        <IconButton
          icon="contrast"
          size="xs"
          label={t('overlay.difference')}
          pressed={overlay.difference}
          disabled={overlay.hidden}
          onClick={() => onChange({ difference: !overlay.difference })}
        />
        <IconButton
          icon={overlay.hidden ? 'eye' : 'eyeOff'}
          size="xs"
          label={overlay.hidden ? t('overlay.show') : t('overlay.hide')}
          onClick={() => onChange({ hidden: !overlay.hidden })}
        />
        <IconButton icon="close" size="xs" tone="danger" label={t('overlay.remove')} onClick={onRemove} />
      </div>
    </>
  );
}

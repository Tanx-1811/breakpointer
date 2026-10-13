import styles from './Ruler.module.css';

export const RULER_SIZE = 20;

const STEPS = [25, 50, 100, 200, 250, 500, 1000];

/** Label spacing in CSS pixels of the page, chosen so labels stay ≥ 48px apart on screen. */
export function rulerStep(zoom: number): number {
  return STEPS.find((step) => step * zoom >= 48) ?? 1000;
}

type Props = {
  orientation: 'horizontal' | 'vertical';
  /** Length of the page axis in CSS pixels. */
  length: number;
  zoom: number;
};

/** Pixel ruler along a preview, in the page's CSS pixels (not screen pixels). */
export function Ruler({ orientation, length, zoom }: Props) {
  const step = rulerStep(zoom);
  const minor = step / 5;
  const horizontal = orientation === 'horizontal';
  const labels: number[] = [];
  for (let value = step; value < length; value += step) labels.push(value);

  const majorSize = `${step * zoom}px`;
  const minorSize = `${minor * zoom}px`;

  return (
    <div
      className={`${styles.ruler} ${horizontal ? styles.horizontal : styles.vertical}`}
      style={{
        [horizontal ? 'width' : 'height']: length * zoom,
        backgroundSize: horizontal ? `${majorSize} 9px, ${minorSize} 4px` : `9px ${majorSize}, 4px ${minorSize}`,
      }}
      aria-hidden="true"
    >
      {labels.map((value) => (
        <span key={value} className={styles.label} style={{ [horizontal ? 'left' : 'top']: value * zoom }}>
          {value}
        </span>
      ))}
    </div>
  );
}

import { useId, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/en';
import {
  CONTRAST_CRITERIA,
  contrastPasses,
  contrastRatio,
  formatRatio,
  parseColor,
  toHex,
  type ContrastCriterion,
  type Rgb,
} from '../../state/contrast';
import { IconButton } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { Icon } from '../Icon/Icon';
import styles from './ContrastDialog.module.css';

export type ContrastColors = { text: string; background: string };

type Field = keyof ContrastColors;

type Props = {
  open: boolean;
  /** The last valid colours (kept for the session). */
  colors: ContrastColors;
  onChange: (colors: ContrastColors) => void;
  onClose: () => void;
};

type EyeDropperInstance = { open: () => Promise<{ sRGBHex: string }> };
type EyeDropperConstructor = new () => EyeDropperInstance;

/** Chrome's EyeDropper API picks a colour anywhere on screen, previews included (no permission needed). */
const eyeDropper = (): EyeDropperConstructor | undefined =>
  (globalThis as unknown as { EyeDropper?: EyeDropperConstructor }).EyeDropper;

const CRITERION_KEYS: Record<ContrastCriterion, MessageKey> = {
  aaNormal: 'contrast.aaNormal',
  aaLarge: 'contrast.aaLarge',
  aaaNormal: 'contrast.aaaNormal',
  aaaLarge: 'contrast.aaaLarge',
  ui: 'contrast.ui',
};

const cssColor = ({ r, g, b, a }: Rgb) => `rgb(${r} ${g} ${b} / ${a})`;

/** Checks a text colour against a background with the WCAG thresholds; colours can be picked from the screen. */
export function ContrastDialog(props: Props) {
  const { t } = useI18n();
  const [picking, setPicking] = useState(false);
  return (
    <Dialog
      open={props.open}
      title={t('contrast.title')}
      description={t('contrast.description')}
      icon="eyedropper"
      onClose={props.onClose}
      width={540}
      concealed={picking}
    >
      {/* Mounted while open, so the fields start from the last colours. */}
      <Checker {...props} onPicking={setPicking} />
    </Dialog>
  );
}

function Checker({ colors, onChange, onPicking }: Props & { onPicking: (picking: boolean) => void }) {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<ContrastColors>(colors);
  const text = parseColor(colors.text) ?? { r: 0, g: 0, b: 0, a: 1 };
  const background = parseColor(colors.background) ?? { r: 255, g: 255, b: 255, a: 1 };
  const ratio = contrastRatio(text, background);
  const passes = contrastPasses(ratio);

  const update = (field: Field, value: string) => {
    setDrafts((current) => ({ ...current, [field]: value }));
    if (parseColor(value)) onChange({ ...colors, [field]: value.trim() });
  };

  const swap = () => {
    setDrafts({ text: drafts.background, background: drafts.text });
    onChange({ text: colors.background, background: colors.text });
  };

  const pick = async (field: Field, button: HTMLButtonElement | null) => {
    const EyeDropper = eyeDropper();
    if (!EyeDropper) return;
    // Out of sight first, so the colour under the dialog can be picked and isn't dimmed.
    onPicking(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const result = await new EyeDropper().open();
      update(field, result.sRGBHex);
    } catch {
      // Cancelled with Escape.
    } finally {
      onPicking(false);
      requestAnimationFrame(() => button?.focus());
    }
  };

  return (
    <div className={styles.checker}>
      <div className={styles.fields}>
        <ColorField
          field="text"
          label={t('contrast.text')}
          value={drafts.text}
          color={text}
          onChange={(value) => update('text', value)}
          onPick={(button) => void pick('text', button)}
        />
        <IconButton
          icon="swap"
          size="sm"
          variant="secondary"
          label={t('contrast.swap')}
          onClick={swap}
          className={styles.swap}
        />
        <ColorField
          field="background"
          label={t('contrast.background')}
          value={drafts.background}
          color={background}
          onChange={(value) => update('background', value)}
          onPick={(button) => void pick('background', button)}
        />
      </div>

      <div className={styles.sample} style={{ color: cssColor(text), background: cssColor(background) }}>
        <p className={styles.sampleLarge}>{t('contrast.sampleLarge')}</p>
        <p className={styles.sampleNormal}>{t('contrast.sampleNormal')}</p>
      </div>

      <div className={styles.result}>
        <span className={styles.ratioLabel}>{t('contrast.ratio')}</span>
        <output className={styles.ratio} data-testid="contrast-ratio">
          {formatRatio(ratio)}
          <span className={styles.ratioUnit}> : 1</span>
        </output>
      </div>

      <ul className={styles.criteria}>
        {CONTRAST_CRITERIA.map(({ id, min }) => (
          <li key={id} className={styles.criterion} data-pass={passes[id] || undefined} data-testid={`contrast-${id}`}>
            <Icon name={passes[id] ? 'check' : 'close'} size={14} className={styles.criterionIcon} />
            <span className={styles.criterionLabel}>{t(CRITERION_KEYS[id])}</span>
            <span className={styles.criterionMin}>{min}:1</span>
            <span className={styles.criterionState}>{passes[id] ? t('contrast.pass') : t('contrast.fail')}</span>
          </li>
        ))}
      </ul>

      <p className={styles.note}>{t('contrast.note')}</p>
      {!eyeDropper() && <p className={styles.note}>{t('contrast.noEyedropper')}</p>}
    </div>
  );
}

function ColorField({
  field,
  label,
  value,
  color,
  onChange,
  onPick,
}: {
  field: Field;
  label: string;
  value: string;
  /** The last valid colour, shown in the swatch. */
  color: Rgb;
  onChange: (value: string) => void;
  onPick: (button: HTMLButtonElement | null) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const errorId = useId();
  const pickRef = useRef<HTMLButtonElement>(null);
  const valid = parseColor(value) !== null;
  const name = label.toLocaleLowerCase();

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.controls}>
        <input
          type="color"
          className={styles.swatch}
          value={toHex(color)}
          aria-label={t('contrast.swatch', { name })}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          id={id}
          className={`field ${styles.value}`}
          value={value}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={valid ? undefined : true}
          aria-describedby={valid ? undefined : errorId}
          data-autofocus={field === 'text' ? true : undefined}
          data-testid={`contrast-${field}`}
          onChange={(event) => onChange(event.target.value)}
        />
        {eyeDropper() && (
          <button
            ref={pickRef}
            type="button"
            className={styles.pick}
            aria-label={t('contrast.pickLabel', { name })}
            data-tooltip={t('contrast.pick')}
            onClick={() => onPick(pickRef.current)}
          >
            <Icon name="eyedropper" size={15} />
          </button>
        )}
      </div>
      {!valid && (
        <p id={errorId} className={styles.error} role="alert">
          {t('contrast.invalid')}
        </p>
      )}
    </div>
  );
}

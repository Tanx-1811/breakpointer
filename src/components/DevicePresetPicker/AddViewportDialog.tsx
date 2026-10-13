import { useId, useState, type FormEvent } from 'react';
import { PRESET_CATEGORIES, PRESETS } from '../../data/presets';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/en';
import { isValidDimension, type NewViewport } from '../../state/viewports';
import type { PresetCategory } from '../../types';
import { MAX_DIMENSION, MAX_NAME_LENGTH, MAX_VIEWPORTS, MIN_DIMENSION } from '../../utils/constants';
import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './AddViewportDialog.module.css';

const CATEGORY_ICONS: Record<PresetCategory, IconName> = {
  mobile: 'phone',
  foldable: 'tablet',
  tablet: 'tablet',
  laptop: 'laptop',
  desktop: 'desktop',
};

type Props = {
  open: boolean;
  canAdd: boolean;
  onAdd: (viewport: NewViewport) => void;
  onClose: () => void;
};

export function AddViewportDialog({ open, canAdd, onAdd, onClose }: Props) {
  const { t } = useI18n();
  return (
    <Dialog open={open} title={t('add.title')} description={t('add.description')} onClose={onClose} width={680}>
      {!canAdd && (
        <p className={styles.limit} role="status">
          <Icon name="info" size={15} />
          {t('add.limit', { max: MAX_VIEWPORTS })}
        </p>
      )}
      <section aria-labelledby="add-presets" className={styles.section}>
        <h3 id="add-presets" className={styles.sectionTitle}>
          {t('add.presets')}
        </h3>
        {PRESET_CATEGORIES.map((category) => (
          <div key={category} className={styles.category}>
            <h4 className={styles.categoryTitle}>
              <Icon name={CATEGORY_ICONS[category]} size={15} />
              {t(`category.${category}`)}
            </h4>
            <div className={styles.grid}>
              {PRESETS.filter((preset) => preset.category === category).map((preset) => {
                const name = t(`preset.${preset.id}` as MessageKey);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={styles.preset}
                    disabled={!canAdd}
                    onClick={() => onAdd({ name, width: preset.width, height: preset.height })}
                    data-testid={`preset-${preset.id}`}
                  >
                    <span className={styles.presetName}>{name}</span>
                    <span className={styles.presetSize}>
                      {preset.width} × {preset.height}
                    </span>
                    <span className={styles.presetHint}>{t(`hint.${preset.id}` as MessageKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>
      <CustomSizeForm canAdd={canAdd} onAdd={onAdd} />
    </Dialog>
  );
}

function CustomSizeForm({ canAdd, onAdd }: { canAdd: boolean; onAdd: (viewport: NewViewport) => void }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [width, setWidth] = useState('1024');
  const [height, setHeight] = useState('768');
  const [error, setError] = useState(false);
  const errorId = useId();
  const nameId = useId();
  const widthId = useId();
  const heightId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const w = Number(width);
    const h = Number(height);
    if (!isValidDimension(w) || !isValidDimension(h)) {
      setError(true);
      return;
    }
    setError(false);
    onAdd({ name: name || `${w} × ${h}`, width: w, height: h });
  };

  return (
    <section aria-labelledby="add-custom" className={styles.section}>
      <h3 id="add-custom" className={styles.sectionTitle}>
        {t('add.custom')}
      </h3>
      <form className={styles.custom} onSubmit={submit} noValidate>
        <div className={styles.field}>
          <label htmlFor={nameId}>{t('add.customName')}</label>
          <input
            id={nameId}
            className="field"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            placeholder={t('add.customNamePlaceholder')}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={widthId}>{t('add.width')}</label>
          <input
            id={widthId}
            className={`field ${styles.number}`}
            type="number"
            inputMode="numeric"
            min={MIN_DIMENSION}
            max={MAX_DIMENSION}
            value={width}
            aria-invalid={error && !isValidDimension(Number(width)) ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => setWidth(event.target.value)}
          />
        </div>
        <span className={styles.times} aria-hidden="true">
          ×
        </span>
        <div className={styles.field}>
          <label htmlFor={heightId}>{t('add.height')}</label>
          <input
            id={heightId}
            className={`field ${styles.number}`}
            type="number"
            inputMode="numeric"
            min={MIN_DIMENSION}
            max={MAX_DIMENSION}
            value={height}
            aria-invalid={error && !isValidDimension(Number(height)) ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => setHeight(event.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" icon="plus" disabled={!canAdd}>
          {t('add.customSubmit')}
        </Button>
      </form>
      {error && (
        <p id={errorId} role="alert" className={styles.error}>
          {t('add.sizeError', { min: MIN_DIMENSION, max: MAX_DIMENSION })}
        </p>
      )}
    </section>
  );
}

import { useId, useState, type FormEvent } from 'react';
import { PRESET_CATEGORIES, PRESETS } from '../../data/presets';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/en';
import { normalizeText } from '../../state/commands';
import { isValidDimension, type NewViewport } from '../../state/viewports';
import type { PresetCategory, ViewportConfig } from '../../types';
import { MAX_DIMENSION, MAX_NAME_LENGTH, MAX_VIEWPORTS, MIN_DIMENSION } from '../../utils/constants';
import { Button, IconButton } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './AddViewportDialog.module.css';

const CATEGORY_ICONS: Record<PresetCategory, IconName> = {
  mobile: 'phone',
  foldable: 'foldable',
  tablet: 'tablet',
  laptop: 'laptop',
  desktop: 'desktop',
};

type Props = {
  open: boolean;
  canAdd: boolean;
  /** The workspace's viewports, to mark sizes that are already there. */
  viewports?: ViewportConfig[];
  onAdd: (viewport: NewViewport) => void;
  onClose: () => void;
};

export function AddViewportDialog({ open, canAdd, viewports = [], onAdd, onClose }: Props) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      title={t('add.title')}
      description={t('add.description')}
      icon="plus"
      onClose={onClose}
      width={820}
    >
      {/* Rendered while open, so the search starts empty each time. */}
      <Picker canAdd={canAdd} viewports={viewports} onAdd={onAdd} />
    </Dialog>
  );
}

function Picker({
  canAdd,
  viewports,
  onAdd,
}: {
  canAdd: boolean;
  viewports: ViewportConfig[];
  onAdd: (viewport: NewViewport) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PresetCategory | 'all'>('all');
  const sizes = new Set(viewports.map((vp) => `${vp.width}x${vp.height}`));
  const needle = normalizeText(query.trim());

  const matches = PRESETS.filter((preset) => {
    if (category !== 'all' && preset.category !== category) return false;
    if (!needle) return true;
    const text = normalizeText(
      [
        t(`preset.${preset.id}` as MessageKey),
        t(`hint.${preset.id}` as MessageKey),
        t(`category.${preset.category}` as MessageKey),
        `${preset.width}x${preset.height} ${preset.width} ${preset.height}`,
      ].join(' '),
    );
    return needle.split(/\s+/).every((word) => text.includes(word));
  });

  return (
    <>
      {!canAdd && (
        <p className={styles.limit} role="status">
          <Icon name="info" size={15} />
          {t('add.limit', { max: MAX_VIEWPORTS })}
        </p>
      )}
      <section aria-labelledby="add-presets" className={styles.section}>
        <div className={styles.toolbar}>
          <h3 id="add-presets" className={styles.sectionTitle}>
            {t('add.presets')}
          </h3>
          <div className={styles.search}>
            <Icon name="search" size={15} className={styles.searchIcon} />
            <input
              className={`field ${styles.searchInput}`}
              type="search"
              value={query}
              placeholder={t('add.searchPlaceholder')}
              aria-label={t('add.search')}
              onChange={(event) => setQuery(event.target.value)}
              data-autofocus
            />
          </div>
        </div>
        <div className={styles.filters} role="radiogroup" aria-label={t('add.filter')}>
          {(['all', ...PRESET_CATEGORIES] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="radio"
              aria-checked={category === item}
              className={styles.filter}
              onClick={() => setCategory(item)}
            >
              {item !== 'all' && <Icon name={CATEGORY_ICONS[item]} size={14} />}
              {item === 'all' ? t('add.all') : t(`category.${item}`)}
            </button>
          ))}
        </div>
        {matches.length === 0 ? (
          <p className={styles.noMatch}>{t('add.noMatch')}</p>
        ) : (
          <div className={styles.grid}>
            {matches.map((preset) => {
              const name = t(`preset.${preset.id}` as MessageKey);
              const inWorkspace = sizes.has(`${preset.width}x${preset.height}`);
              // A thumbnail with the preset's aspect ratio (the longest side is 26px).
              const scale = 26 / Math.max(preset.width, preset.height);
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={styles.preset}
                  disabled={!canAdd}
                  onClick={() => onAdd({ name, width: preset.width, height: preset.height })}
                  data-category={preset.category}
                  data-testid={`preset-${preset.id}`}
                >
                  <span className={styles.thumb} aria-hidden="true">
                    <span style={{ width: preset.width * scale, height: preset.height * scale }} />
                  </span>
                  <span className={styles.presetText}>
                    <span className={styles.presetName}>{name}</span>
                    <span className={styles.presetMeta}>
                      <span className={styles.presetSize}>
                        {preset.width} × {preset.height}
                      </span>
                      <span className={styles.presetHint}>{t(`hint.${preset.id}` as MessageKey)}</span>
                    </span>
                  </span>
                  {inWorkspace && (
                    <span className={styles.added} data-tooltip={t('add.inWorkspace')}>
                      <Icon name="check" size={12} strokeWidth={2.4} />
                      <span className="visually-hidden">{t('add.inWorkspace')}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>
      <CustomSizeForm canAdd={canAdd} onAdd={onAdd} />
    </>
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
        <div className={`${styles.field} ${styles.nameField}`}>
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
        <IconButton
          icon="swap"
          size="sm"
          label={t('add.swap')}
          className={styles.swap}
          onClick={() => {
            setWidth(height);
            setHeight(width);
          }}
        />
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

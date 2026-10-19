import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/en';
import { composeShowcase, type ShowcaseShot } from '../../services/showcase';
import { copyImageToClipboard } from '../../services/screenshot';
import { SIZE_CLASS_ICONS, sizeClassOf } from '../../state/size-class';
import {
  MAX_SHOWCASE_DEVICES,
  SHOWCASE_BACKDROPS,
  SHOWCASE_FRAMES,
  SHOWCASE_SHAPES,
  type ShowcaseBackdrop,
  type ShowcaseFrame,
  type ShowcaseOptions,
  type ShowcaseShape,
} from '../../state/showcase';
import { downloadBlob, fileNamePart, timestamp } from '../../utils/download';
import { Button } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { Icon } from '../Icon/Icon';
import { Segmented } from '../Segmented/Segmented';
import { Switch } from '../Switch/Switch';
import styles from './ShowcaseDialog.module.css';

const FRAME_KEYS: Record<ShowcaseFrame, MessageKey> = {
  devices: 'showcase.frameDevices',
  windows: 'showcase.frameWindows',
  none: 'showcase.frameNone',
};
const BACKDROP_KEYS: Record<ShowcaseBackdrop, MessageKey> = {
  indigo: 'showcase.backdropIndigo',
  soft: 'showcase.backdropSoft',
  dark: 'showcase.backdropDark',
  transparent: 'showcase.backdropNone',
};
const SHAPE_KEYS: Record<ShowcaseShape, MessageKey> = {
  wide: 'showcase.shapeWide',
  standard: 'showcase.shapeStandard',
  square: 'showcase.shapeSquare',
};

type Props = {
  open: boolean;
  /** Out of sight while the previews are captured. */
  concealed: boolean;
  capturing: boolean;
  /** The visible viewports, in the workspace's order. */
  viewports: { id: string; name: string; width: number; height: number }[];
  /** The viewports in the image (ids, in the workspace's order). */
  selected: string[];
  onSelected: (ids: string[]) => void;
  /** The captures of the visible viewports. */
  shots: ShowcaseShot[];
  options: ShowcaseOptions;
  onOptions: (patch: Partial<ShowcaseOptions>) => void;
  /** The page's host, shown in the windows' address bars and used in the file name. */
  host: string;
  onCapture: () => void;
  onCopied: (copied: boolean) => void;
  onSaved: (fileName: string) => void;
  onClose: () => void;
};

/** A showcase image: the page at a few sizes in simple device frames on a backdrop. */
export function ShowcaseDialog(props: Props) {
  const { t } = useI18n();
  return (
    <Dialog
      open={props.open}
      title={t('showcase.title')}
      description={t('showcase.description')}
      icon="devices"
      onClose={props.onClose}
      width={1080}
      concealed={props.concealed}
    >
      {props.open && <ShowcaseBody {...props} />}
    </Dialog>
  );
}

function ShowcaseBody(props: Props) {
  const { t } = useI18n();
  const titleId = useId();
  const { options, selected } = props;
  // The image, and what it was made of: until it matches the options and previews, it is being made.
  const [image, setImage] = useState<{ url: string; blob: Blob; key: string } | null>(null);
  const latest = useRef<string | null>(null);

  const shots = useMemo(
    () =>
      selected
        .map((id) => props.shots.find((shot) => shot.id === id))
        .filter((shot): shot is ShowcaseShot => Boolean(shot)),
    [selected, props.shots],
  );

  // Compose again when the previews or the options change (a moment after the last change).
  const { host } = props;
  const wanted = useMemo(
    () => JSON.stringify([options, host, shots.map((shot) => [shot.id, shot.width, shot.height, shot.image.size])]),
    [options, host, shots],
  );
  const ready = image !== null && image.key === wanted;
  useEffect(() => {
    if (shots.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void composeShowcase(shots, { ...options, host })
        .then((blob) => {
          if (cancelled || !blob) return;
          const url = URL.createObjectURL(blob);
          setImage((previous) => {
            if (previous) URL.revokeObjectURL(previous.url);
            return { url, blob, key: wanted };
          });
        })
        .catch((error: unknown) => console.warn('[Breakpointer] The showcase image failed.', error));
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [shots, options, host, wanted]);

  // The last image's object URL is released with the dialog.
  useEffect(() => {
    latest.current = image?.url ?? null;
  }, [image]);
  useEffect(
    () => () => {
      if (latest.current) URL.revokeObjectURL(latest.current);
    },
    [],
  );

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    // In the workspace's order.
    props.onSelected(props.viewports.map((viewport) => viewport.id).filter((item) => next.includes(item)));
  };

  const download = () => {
    if (!image || !ready) return;
    const fileName = `breakpointer-showcase_${fileNamePart(props.host || 'page')}_${timestamp()}.png`;
    downloadBlob(image.blob, fileName);
    props.onSaved(fileName);
  };

  const copy = async () => {
    if (!image || !ready) return;
    props.onCopied(await copyImageToClipboard(image.blob));
  };

  const full = selected.length >= MAX_SHOWCASE_DEVICES;

  return (
    <div className={styles.body}>
      <div
        className={styles.stage}
        data-backdrop={options.backdrop}
        data-testid="showcase-stage"
        aria-busy={(shots.length > 0 && !ready) || props.capturing || undefined}
      >
        {image && shots.length > 0 ? (
          <img className={styles.image} src={image.url} alt={t('showcase.imageAlt')} data-testid="showcase-image" />
        ) : (
          <p className={styles.placeholder}>
            {props.capturing
              ? t('showcase.capturing')
              : selected.length === 0
                ? t('showcase.pickOne')
                : t('showcase.waiting')}
          </p>
        )}
      </div>

      <div className={styles.options}>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{t('showcase.viewports', { max: MAX_SHOWCASE_DEVICES })}</legend>
          <ul className={styles.viewports}>
            {props.viewports.map((viewport) => {
              const checked = selected.includes(viewport.id);
              const kind = sizeClassOf(viewport.width, viewport.height);
              return (
                <li key={viewport.id}>
                  <label className={styles.viewport} data-disabled={(!checked && full) || undefined}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={(!checked && full) || props.capturing}
                      onChange={() => toggle(viewport.id)}
                    />
                    <Icon name={SIZE_CLASS_ICONS[kind]} size={15} className={styles[kind]} />
                    <span className={styles.viewportName}>{viewport.name}</span>
                    <span className={styles.mono}>
                      {viewport.width} × {viewport.height}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <div className={styles.row}>
          <span className={styles.label}>{t('showcase.frame')}</span>
          <Segmented
            size="sm"
            label={t('showcase.frame')}
            value={options.frame}
            options={SHOWCASE_FRAMES.map((value) => ({ value, label: t(FRAME_KEYS[value]) }))}
            onChange={(frame) => props.onOptions({ frame })}
          />
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('showcase.backdrop')}</span>
          <Segmented
            size="sm"
            label={t('showcase.backdrop')}
            value={options.backdrop}
            options={SHOWCASE_BACKDROPS.map((value) => ({ value, label: t(BACKDROP_KEYS[value]) }))}
            onChange={(backdrop) => props.onOptions({ backdrop })}
          />
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t('showcase.shape')}</span>
          <Segmented
            size="sm"
            label={t('showcase.shape')}
            value={options.shape}
            options={SHOWCASE_SHAPES.map((value) => ({ value, label: t(SHAPE_KEYS[value]) }))}
            onChange={(shape) => props.onOptions({ shape })}
          />
        </div>
        <div className={styles.titleField}>
          <label htmlFor={titleId} className={styles.label}>
            {t('showcase.titleLabel')}
          </label>
          <input
            id={titleId}
            className="field"
            type="text"
            value={options.title}
            maxLength={80}
            placeholder={t('showcase.titlePlaceholder')}
            onChange={(event) => props.onOptions({ title: event.target.value })}
          />
        </div>
        <Switch
          checked={options.credit}
          onChange={(credit) => props.onOptions({ credit })}
          label={t('showcase.credit')}
          description={t('showcase.creditHint')}
        />
        <p className={styles.note}>{t('showcase.note')}</p>
      </div>

      <div className={styles.actions}>
        <Button icon="camera" variant="ghost" onClick={props.onCapture} disabled={props.capturing}>
          {t('showcase.recapture')}
        </Button>
        <span className={styles.spacer} />
        <Button icon="clipboard" onClick={() => void copy()} disabled={!ready || props.capturing}>
          {t('showcase.copy')}
        </Button>
        <Button
          variant="primary"
          icon="download"
          onClick={download}
          disabled={!ready || props.capturing}
          data-testid="showcase-download"
        >
          {t('showcase.download')}
        </Button>
      </div>
    </div>
  );
}

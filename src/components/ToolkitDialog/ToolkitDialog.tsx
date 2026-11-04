import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { MessageKey } from '../../i18n/en';
import { aspectCss, aspectRatio, heightAt, ratioText, COMMON_RATIOS } from '../../state/aspect';
import { breakpointCode, CODE_FORMATS, namedBreakpoints, type CodeFormat } from '../../state/breakpoint-code';
import {
  allFormats,
  COLOR_FORMATS,
  contrastOnWhiteAndBlack,
  formatColor,
  parseAnyColor,
  type ColorFormat,
} from '../../state/color-formats';
import { formatRatio, toHex } from '../../state/contrast';
import {
  cssNumber,
  fluidAt,
  fluidDeclaration,
  SCALE_RATIOS,
  typeScale,
  typeScaleCss,
  validFluid,
  zoomRisk,
  type FluidSpec,
  type TypeScaleSpec,
} from '../../state/fluid';
import { addRecentColor, readNumber, TOOLKIT_TABS, type ToolkitState, type ToolkitTab } from '../../state/toolkit';
import { CSS_UNITS, formatUnit, parseLength, unitMarkdown, unitTable, type CssUnit } from '../../state/units';
import type { Breakpoint, BreakpointSetId } from '../../types';
import { Button, IconButton } from '../Button/Button';
import { Dialog } from '../Dialog/Dialog';
import { Icon, type IconName } from '../Icon/Icon';
import { Segmented } from '../Segmented/Segmented';
import { Select } from '../Select/Select';
import styles from './ToolkitDialog.module.css';

export type ToolkitViewport = { id: string; name: string; width: number; height: number };

export type ToolkitBreakpointSet = { id: BreakpointSetId; label: string; base: string; breakpoints: Breakpoint[] };

type Props = {
  open: boolean;
  tab: ToolkitTab;
  onTab: (tab: ToolkitTab) => void;
  state: ToolkitState;
  onChange: (state: ToolkitState) => void;
  /** The visible viewports: values are worked out at their sizes. */
  viewports: ToolkitViewport[];
  /** Breakpoint sets the code can be written from, and the one the toolbar uses. */
  breakpointSets: ToolkitBreakpointSet[];
  currentSet: BreakpointSetId;
  onCopy: (text: string) => void;
  onClose: () => void;
};

const TAB_KEYS: Record<ToolkitTab, MessageKey> = {
  fluid: 'toolkit.tab.fluid',
  units: 'toolkit.tab.units',
  code: 'toolkit.tab.code',
  colors: 'toolkit.tab.colors',
  aspect: 'toolkit.tab.aspect',
};

const TAB_ICONS: Record<ToolkitTab, IconName> = {
  fluid: 'text',
  units: 'ruler',
  code: 'code',
  colors: 'palette',
  aspect: 'fit',
};

const FORMAT_KEYS: Record<CodeFormat, MessageKey> = {
  'css-min': 'code.format.cssMin',
  'css-max': 'code.format.cssMax',
  'css-range': 'code.format.cssRange',
  scss: 'code.format.scss',
  tailwind4: 'code.format.tailwind4',
  tailwind3: 'code.format.tailwind3',
  'custom-media': 'code.format.customMedia',
  js: 'code.format.js',
};

const RATIO_KEYS: Record<(typeof SCALE_RATIOS)[number]['name'], MessageKey> = {
  minorSecond: 'fluid.ratio.minorSecond',
  majorSecond: 'fluid.ratio.majorSecond',
  minorThird: 'fluid.ratio.minorThird',
  majorThird: 'fluid.ratio.majorThird',
  perfectFourth: 'fluid.ratio.perfectFourth',
  augmentedFourth: 'fluid.ratio.augmentedFourth',
  perfectFifth: 'fluid.ratio.perfectFifth',
  goldenRatio: 'fluid.ratio.goldenRatio',
};

const COLOR_FORMAT_LABELS: Record<ColorFormat, string> = { hex: 'HEX', rgb: 'RGB', hsl: 'HSL', oklch: 'OKLCH' };

type EyeDropperConstructor = new () => { open: () => Promise<{ sRGBHex: string }> };
const eyeDropper = (): EyeDropperConstructor | undefined =>
  (globalThis as unknown as { EyeDropper?: EyeDropperConstructor }).EyeDropper;

/**
 * Small CSS helpers worked out at the sizes being previewed: fluid type,
 * units, the breakpoints as code, colours and aspect ratios.
 */
export function ToolkitDialog(props: Props) {
  const { t } = useI18n();
  const [picking, setPicking] = useState(false);
  return (
    <Dialog
      open={props.open}
      title={t('toolkit.title')}
      description={t('toolkit.description')}
      icon="code"
      onClose={props.onClose}
      width={760}
      concealed={picking}
    >
      <Toolkit {...props} onPicking={setPicking} />
    </Dialog>
  );
}

function Toolkit(props: Props & { onPicking: (picking: boolean) => void }) {
  const { t } = useI18n();
  const id = useId();
  const tabRefs = useRef<Partial<Record<ToolkitTab, HTMLButtonElement | null>>>({});
  const { tab, onTab } = props;

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    const target =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? TOOLKIT_TABS.length - 1
          : delta
            ? (index + delta + TOOLKIT_TABS.length) % TOOLKIT_TABS.length
            : null;
    if (target === null) return;
    event.preventDefault();
    const next = TOOLKIT_TABS[target]!;
    onTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className={styles.toolkit} data-testid="toolkit">
      <div className={styles.tabs} role="tablist" aria-label={t('toolkit.tabs')}>
        {TOOLKIT_TABS.map((item, index) => (
          <button
            key={item}
            ref={(element) => {
              tabRefs.current[item] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${item}`}
            aria-selected={tab === item}
            aria-controls={`${id}-panel`}
            tabIndex={tab === item ? 0 : -1}
            className={styles.tab}
            data-autofocus={tab === item ? true : undefined}
            data-testid={`toolkit-tab-${item}`}
            onClick={() => onTab(item)}
            onKeyDown={(event) => onTabKey(event, index)}
          >
            <Icon name={TAB_ICONS[item]} size={15} />
            <span>{t(TAB_KEYS[item])}</span>
          </button>
        ))}
      </div>
      <div className={styles.panel} role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`}>
        {tab === 'fluid' && <FluidTab {...props} />}
        {tab === 'units' && <UnitsTab {...props} />}
        {tab === 'code' && <CodeTab {...props} />}
        {tab === 'colors' && <ColorsTab {...props} />}
        {tab === 'aspect' && <AspectTab {...props} />}
      </div>
    </div>
  );
}

/* ---------- Shared bits ---------- */

function Field({
  label,
  value,
  onChange,
  suffix,
  invalid,
  testId,
  wide,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  invalid?: boolean;
  testId?: string;
  wide?: boolean;
}) {
  const id = useId();
  return (
    <div className={`${styles.field} ${wide ? styles.fieldWide : ''}`}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <span className={styles.inputWrap}>
        <input
          id={id}
          className={`field ${styles.input}`}
          value={value}
          inputMode="decimal"
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid || undefined}
          data-testid={testId}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && (
          <span className={styles.suffix} aria-hidden="true">
            {suffix}
          </span>
        )}
      </span>
    </div>
  );
}

function SelectField({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children(id)}
    </div>
  );
}

function Code({ code, label, onCopy, testId }: { code: string; label: string; onCopy: () => void; testId?: string }) {
  const { t } = useI18n();
  return (
    <div className={styles.code}>
      <pre tabIndex={0} aria-label={label} data-testid={testId}>
        <code>{code}</code>
      </pre>
      <Button size="sm" variant="secondary" icon="copy" className={styles.copy} onClick={onCopy}>
        {t('toolkit.copy')}
      </Button>
    </div>
  );
}

function Note({ children, tone }: { children: ReactNode; tone?: 'warning' }) {
  return (
    <p className={styles.note} data-tone={tone}>
      <Icon name={tone === 'warning' ? 'alert' : 'info'} size={14} className={styles.noteIcon} />
      <span>{children}</span>
    </p>
  );
}

const px = (value: number) => `${cssNumber(value, 2)} px`;

function ViewportHead({ viewports }: { viewports: ToolkitViewport[] }) {
  return (
    <>
      {viewports.map((viewport) => (
        <th key={viewport.id} scope="col" className={styles.num}>
          <span className={styles.vpName}>{viewport.name}</span>
          <span className={styles.vpSize}>{viewport.width}</span>
        </th>
      ))}
    </>
  );
}

/* ---------- Fluid type ---------- */

function FluidTab({ state, onChange, viewports, onCopy }: Props) {
  const { t } = useI18n();
  const fluid = state.fluid;
  const set = (patch: Partial<ToolkitState['fluid']>) => onChange({ ...state, fluid: { ...fluid, ...patch } });
  const n = (text: string) => readNumber(text) ?? NaN;
  const common = {
    minViewport: n(fluid.minViewport),
    maxViewport: n(fluid.maxViewport),
    unit: fluid.unit,
    root: n(fluid.root),
  };
  const widths = viewports.map((viewport) => viewport.width);
  const span = widths.length >= 2 ? { min: Math.min(...widths), max: Math.max(...widths) } : null;

  const single: FluidSpec = { ...common, minSize: n(fluid.minSize), maxSize: n(fluid.maxSize) };
  const scale: TypeScaleSpec = {
    ...common,
    minBase: n(fluid.minBase),
    maxBase: n(fluid.maxBase),
    minRatio: n(fluid.minRatio),
    maxRatio: n(fluid.maxRatio),
    stepsDown: n(fluid.stepsDown),
    stepsUp: n(fluid.stepsUp),
  };
  const valid =
    fluid.mode === 'single'
      ? validFluid(single)
      : validFluid({ ...common, minSize: scale.minBase, maxSize: scale.maxBase }) &&
        scale.minRatio > 0 &&
        scale.maxRatio > 0 &&
        scale.stepsDown >= 0 &&
        scale.stepsUp >= 0;
  const steps = valid && fluid.mode === 'scale' ? typeScale(scale) : [];

  const ratioField = (key: 'minRatio' | 'maxRatio', label: string) => (
    <SelectField label={label}>
      {(id) => (
        <Select
          id={id}
          wide
          value={SCALE_RATIOS.some((ratio) => String(ratio.value) === fluid[key]) ? fluid[key] : 'custom'}
          onChange={(event) => event.target.value !== 'custom' && set({ [key]: event.target.value })}
        >
          {SCALE_RATIOS.map((ratio) => (
            <option key={ratio.name} value={String(ratio.value)}>
              {ratio.value} · {t(RATIO_KEYS[ratio.name])}
            </option>
          ))}
          {!SCALE_RATIOS.some((ratio) => String(ratio.value) === fluid[key]) && (
            <option value="custom">{fluid[key]}</option>
          )}
        </Select>
      )}
    </SelectField>
  );

  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <Segmented
          label={t('fluid.mode')}
          size="sm"
          value={fluid.mode}
          onChange={(mode) => set({ mode })}
          options={[
            { value: 'single', label: t('fluid.single') },
            { value: 'scale', label: t('fluid.scale') },
          ]}
        />
        <Segmented
          label={t('fluid.unit')}
          size="sm"
          value={fluid.unit}
          onChange={(unit) => set({ unit })}
          options={[
            { value: 'rem', label: 'rem' },
            { value: 'px', label: 'px' },
          ]}
        />
        {span && span.min !== span.max && (
          <Button
            size="sm"
            variant="ghost"
            icon="devices"
            tooltip={t('fluid.usePreviewsHint', { min: span.min, max: span.max })}
            onClick={() => set({ minViewport: String(span.min), maxViewport: String(span.max) })}
          >
            {t('fluid.usePreviews')}
          </Button>
        )}
      </div>

      <div className={styles.grid}>
        <Field
          label={t('fluid.minViewport')}
          value={fluid.minViewport}
          suffix="px"
          invalid={!(common.minViewport > 0)}
          onChange={(minViewport) => set({ minViewport })}
          testId="fluid-min-viewport"
        />
        <Field
          label={t('fluid.maxViewport')}
          value={fluid.maxViewport}
          suffix="px"
          invalid={!(common.maxViewport > 0)}
          onChange={(maxViewport) => set({ maxViewport })}
          testId="fluid-max-viewport"
        />
        {fluid.mode === 'single' ? (
          <>
            <Field
              label={t('fluid.minSize')}
              value={fluid.minSize}
              suffix="px"
              invalid={!(single.minSize > 0)}
              onChange={(minSize) => set({ minSize })}
              testId="fluid-min-size"
            />
            <Field
              label={t('fluid.maxSize')}
              value={fluid.maxSize}
              suffix="px"
              invalid={!(single.maxSize > 0)}
              onChange={(maxSize) => set({ maxSize })}
              testId="fluid-max-size"
            />
          </>
        ) : (
          <>
            <Field
              label={t('fluid.baseMin')}
              value={fluid.minBase}
              suffix="px"
              invalid={!(scale.minBase > 0)}
              onChange={(minBase) => set({ minBase })}
            />
            <Field
              label={t('fluid.baseMax')}
              value={fluid.maxBase}
              suffix="px"
              invalid={!(scale.maxBase > 0)}
              onChange={(maxBase) => set({ maxBase })}
            />
            {ratioField('minRatio', t('fluid.ratioMin'))}
            {ratioField('maxRatio', t('fluid.ratioMax'))}
            <Field
              label={t('fluid.stepsDown')}
              value={fluid.stepsDown}
              invalid={!(scale.stepsDown >= 0)}
              onChange={(stepsDown) => set({ stepsDown })}
            />
            <Field
              label={t('fluid.stepsUp')}
              value={fluid.stepsUp}
              invalid={!(scale.stepsUp >= 0)}
              onChange={(stepsUp) => set({ stepsUp })}
            />
          </>
        )}
        {fluid.unit === 'rem' && (
          <Field
            label={t('fluid.root')}
            value={fluid.root}
            suffix="px"
            invalid={!(common.root > 0)}
            onChange={(root) => set({ root })}
          />
        )}
        {fluid.mode === 'single' && (
          <SelectField label={t('fluid.property')}>
            {(id) => (
              <input
                id={id}
                className={`field ${styles.input}`}
                value={fluid.property}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => set({ property: event.target.value })}
              />
            )}
          </SelectField>
        )}
      </div>

      {!valid ? (
        <Note tone="warning">{t('fluid.invalid')}</Note>
      ) : fluid.mode === 'single' ? (
        <>
          <Code
            code={fluidDeclaration(fluid.property, single)}
            label={t('toolkit.tab.fluid')}
            testId="fluid-code"
            onCopy={() => onCopy(fluidDeclaration(fluid.property, single))}
          />
          {zoomRisk(single) && <Note tone="warning">{t('fluid.zoomRisk')}</Note>}
          {viewports.length > 0 ? (
            <table className={styles.table}>
              <caption className="visually-hidden">{t('fluid.atViewports')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('fluid.atViewports')}</th>
                  <ViewportHead viewports={viewports} />
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{fluid.property || 'font-size'}</th>
                  {viewports.map((viewport) => (
                    <td key={viewport.id} className={styles.num}>
                      {px(fluidAt(single, viewport.width))}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          ) : (
            <Note>{t('toolkit.noViewports')}</Note>
          )}
          <Note>{t('fluid.note')}</Note>
        </>
      ) : (
        <>
          <div className={styles.scroll} tabIndex={0} aria-label={t('fluid.atViewports')}>
            <table className={styles.table} data-testid="fluid-scale">
              <thead>
                <tr>
                  <th scope="col">{t('fluid.step')}</th>
                  <th scope="col" className={styles.num}>
                    {`${common.minViewport}–${common.maxViewport}`}
                  </th>
                  <ViewportHead viewports={viewports} />
                </tr>
              </thead>
              <tbody>
                {steps.map((step) => (
                  <tr key={step.step} data-base={step.step === 0 || undefined}>
                    <th scope="row" className={styles.mono}>
                      {step.name}
                    </th>
                    <td className={styles.num}>
                      {t('fluid.range', { min: cssNumber(step.min, 1), max: cssNumber(step.max, 1) })}
                    </td>
                    {viewports.map((viewport) => (
                      <td key={viewport.id} className={styles.num}>
                        {px(fluidAt(step.spec, viewport.width))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Code
            code={typeScaleCss(scale, steps)}
            label={t('fluid.scale')}
            testId="fluid-scale-code"
            onCopy={() => onCopy(typeScaleCss(scale, steps))}
          />
          <Note>{t('fluid.scaleNote')}</Note>
        </>
      )}
    </div>
  );
}

/* ---------- Units ---------- */

function UnitsTab({ state, onChange, viewports, onCopy }: Props) {
  const { t } = useI18n();
  const units = state.units;
  const set = (patch: Partial<ToolkitState['units']>) => onChange({ ...state, units: { ...units, ...patch } });
  const parsed = parseLength(units.value);
  const from = parsed?.unit ?? units.from;
  const root = readNumber(units.root);
  const parent = readNumber(units.parent);
  const context = root !== null && root > 0 && parent !== null && parent > 0 ? { root, parent } : null;
  const columns = viewports;
  const rows = parsed && context ? unitTable(parsed.value, from, context, columns) : [];

  const typed = (value: string) => {
    const next = parseLength(value);
    set(next?.unit ? { value, from: next.unit } : { value });
  };

  return (
    <div className={styles.stack}>
      <div className={styles.grid}>
        <Field label={t('units.value')} value={units.value} invalid={!parsed} onChange={typed} testId="units-value" />
        <SelectField label={t('units.from')}>
          {(id) => (
            <Select
              id={id}
              wide
              mono
              value={from}
              onChange={(event) => {
                const unit = event.target.value as CssUnit;
                // A unit typed with the value follows the menu.
                set({ from: unit, value: parsed?.unit ? `${parsed.value}${unit}` : units.value });
              }}
            >
              {CSS_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </Select>
          )}
        </SelectField>
        <Field
          label={t('units.root')}
          value={units.root}
          suffix="px"
          invalid={!(root !== null && root > 0)}
          onChange={(value) => set({ root: value })}
        />
        <Field
          label={t('units.parent')}
          value={units.parent}
          suffix="px"
          invalid={!(parent !== null && parent > 0)}
          onChange={(value) => set({ parent: value })}
        />
      </div>

      {!parsed || !context ? (
        <Note tone="warning">{t('units.invalid')}</Note>
      ) : columns.length === 0 ? (
        <Note>{t('toolkit.noViewports')}</Note>
      ) : (
        <>
          <div className={styles.scroll} tabIndex={0} aria-label={t('units.table')}>
            <table className={styles.table} data-testid="units-table">
              <caption className="visually-hidden">{t('units.table')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('units.unit')}</th>
                  <ViewportHead viewports={columns} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.unit} data-from={row.unit === from || undefined}>
                    <th scope="row" className={styles.mono}>
                      {row.unit}
                      {row.varies && (
                        <span className={styles.varies} title={t('units.varies')}>
                          <Icon name="resize" size={12} />
                          <span className="visually-hidden">{t('units.varies')}</span>
                        </span>
                      )}
                    </th>
                    {row.values.map((value, index) => (
                      <td key={columns[index]!.id} className={`${styles.num} ${styles.mono}`}>
                        {value === null ? '—' : formatUnit(value, row.unit)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.row}>
            <Button
              size="sm"
              variant="secondary"
              icon="clipboard"
              onClick={() => onCopy(unitMarkdown(parsed.value, from, context, columns, { unit: t('units.unit') }))}
            >
              {t('units.copyTable')}
            </Button>
          </div>
          <Note>{t('units.note')}</Note>
        </>
      )}
    </div>
  );
}

/* ---------- Breakpoints as code ---------- */

function CodeTab({ state, onChange, breakpointSets, currentSet, onCopy }: Props) {
  const { t } = useI18n();
  const code = state.code;
  const set = (patch: Partial<ToolkitState['code']>) => onChange({ ...state, code: { ...code, ...patch } });
  const fallback = breakpointSets.some((item) => item.id === currentSet) ? currentSet : 'tailwind';
  const sourceId = code.source && breakpointSets.some((item) => item.id === code.source) ? code.source : fallback;
  const source = breakpointSets.find((item) => item.id === sourceId) ?? breakpointSets[0];
  const list = namedBreakpoints(source?.breakpoints ?? []);
  const text = source ? breakpointCode(code.format, list, { unit: code.unit, base: source.base }) : '';
  const unitApplies = code.format !== 'tailwind4' && code.format !== 'tailwind3';

  return (
    <div className={styles.stack}>
      <div className={styles.grid}>
        <SelectField label={t('code.source')}>
          {(id) => (
            <Select
              id={id}
              wide
              value={sourceId}
              data-testid="code-source"
              onChange={(event) => set({ source: event.target.value as BreakpointSetId })}
            >
              {breakpointSets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                  {item.id === currentSet ? ` · ${t('code.inUse')}` : ''}
                </option>
              ))}
            </Select>
          )}
        </SelectField>
        <SelectField label={t('code.format')}>
          {(id) => (
            <Select
              id={id}
              wide
              value={code.format}
              data-testid="code-format"
              onChange={(event) => set({ format: event.target.value as CodeFormat })}
            >
              {CODE_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {t(FORMAT_KEYS[format])}
                </option>
              ))}
            </Select>
          )}
        </SelectField>
        {unitApplies && (
          <div className={styles.field}>
            <span className={styles.label} aria-hidden="true">
              {t('code.unit')}
            </span>
            <Segmented
              label={t('code.unit')}
              size="sm"
              value={code.unit}
              onChange={(unit) => set({ unit })}
              options={[
                { value: 'px', label: 'px' },
                { value: 'em', label: 'em' },
              ]}
            />
          </div>
        )}
      </div>

      {list.length > 0 && (
        <ul className={styles.chips} aria-label={t('code.list')}>
          <li className={styles.chip}>
            <span className={styles.chipName}>{source?.base}</span>
            <span className={styles.chipValue}>0</span>
          </li>
          {list.map((bp) => (
            <li key={bp.id} className={styles.chip}>
              <span className={styles.chipName}>{bp.name}</span>
              <span className={styles.chipValue}>{bp.min}</span>
            </li>
          ))}
        </ul>
      )}

      {list.length === 0 ? (
        <Note tone="warning">{sourceId === 'site' ? t('code.siteUnknown') : t('code.empty')}</Note>
      ) : (
        <>
          <Code code={text} label={t(FORMAT_KEYS[code.format])} testId="code-output" onCopy={() => onCopy(text)} />
          <Note>{t('code.note')}</Note>
        </>
      )}
    </div>
  );
}

/* ---------- Colours ---------- */

/** Named colours ("rebeccapurple") read through the browser's own CSS parser. */
function resolveNamed(text: string): string | null {
  if (typeof document === 'undefined' || !CSS.supports('color', text)) return null;
  const probe = document.createElement('span');
  probe.style.color = text;
  probe.style.display = 'none';
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color || null;
}

function ColorsTab({ state, onChange, onCopy, onPicking }: Props & { onPicking: (picking: boolean) => void }) {
  const { t } = useI18n();
  const colors = state.colors;
  const inputId = useId();
  const color = parseAnyColor(colors.value, resolveNamed);
  const contrast = color ? contrastOnWhiteAndBlack(color) : null;

  const choose = (value: string, remember: boolean) =>
    onChange({
      ...state,
      colors: {
        value,
        recent: remember && parseAnyColor(value, resolveNamed) ? addRecentColor(colors.recent, value) : colors.recent,
      },
    });

  const pick = async () => {
    const EyeDropper = eyeDropper();
    if (!EyeDropper) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    onPicking(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const result = await new EyeDropper().open();
      choose(result.sRGBHex, true);
    } catch {
      // Cancelled with Escape.
    } finally {
      onPicking(false);
      requestAnimationFrame(() => opener?.focus());
    }
  };

  const grade = (ratio: number): MessageKey =>
    ratio >= 4.5 ? 'colors.passAA' : ratio >= 3 ? 'colors.passLarge' : 'colors.failAA';

  return (
    <div className={styles.stack}>
      <div className={styles.colorTop}>
        <div className={styles.field}>
          <label htmlFor={inputId} className={styles.label}>
            {t('colors.input')}
          </label>
          <span className={styles.colorControls}>
            <input
              type="color"
              className={styles.swatchInput}
              value={color ? toHex(color) : '#000000'}
              aria-label={t('colors.swatch')}
              onChange={(event) => choose(event.target.value, false)}
              onBlur={() => color && choose(colors.value, true)}
            />
            <input
              id={inputId}
              className={`field ${styles.input} ${styles.mono}`}
              value={colors.value}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={color ? undefined : true}
              data-testid="color-input"
              onChange={(event) => choose(event.target.value, false)}
              onBlur={() => color && choose(colors.value, true)}
              onKeyDown={(event) => event.key === 'Enter' && color && choose(colors.value, true)}
            />
            {eyeDropper() && (
              <Button size="sm" variant="secondary" icon="eyedropper" onClick={() => void pick()}>
                {t('colors.pick')}
              </Button>
            )}
          </span>
        </div>
        <span
          className={styles.bigSwatch}
          style={color ? { background: formatColor(color, 'rgb') } : undefined}
          aria-hidden="true"
        />
      </div>

      {!color ? (
        <Note tone="warning">{t('colors.invalid')}</Note>
      ) : (
        <>
          <ul className={styles.formats} aria-label={t('colors.formats')} data-testid="color-formats">
            {COLOR_FORMATS.map((format) => {
              const value = formatColor(color, format);
              return (
                <li key={format} className={styles.format}>
                  <span className={styles.formatName}>{COLOR_FORMAT_LABELS[format]}</span>
                  <code className={styles.formatValue}>{value}</code>
                  <IconButton
                    icon="copy"
                    size="sm"
                    label={t('colors.copyFormat', { format: COLOR_FORMAT_LABELS[format] })}
                    onClick={() => onCopy(value)}
                  />
                </li>
              );
            })}
          </ul>
          <div className={styles.row}>
            <Button size="sm" variant="secondary" icon="clipboard" onClick={() => onCopy(allFormats(color))}>
              {t('colors.copyAll')}
            </Button>
          </div>
          {contrast && (
            <div className={styles.contrast}>
              {(['white', 'black'] as const).map((against) => (
                <div
                  key={against}
                  className={styles.contrastCard}
                  style={{ background: against === 'white' ? '#ffffff' : '#000000', color: formatColor(color, 'rgb') }}
                >
                  <span className={styles.contrastSample} aria-hidden="true">
                    Aa
                  </span>
                  <span className={styles.contrastText} data-against={against}>
                    <span>{t(against === 'white' ? 'colors.onWhite' : 'colors.onBlack')}</span>
                    <strong>{formatRatio(contrast[against])}:1</strong>
                    <span>{t(grade(contrast[against]))}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          <Note>{t('colors.contrastNote')}</Note>
        </>
      )}

      {!eyeDropper() && <Note>{t('contrast.noEyedropper')}</Note>}

      {colors.recent.length > 0 && (
        <div className={styles.recent}>
          <span className={styles.label}>{t('colors.recent')}</span>
          <ul className={styles.recentList}>
            {colors.recent.map((item) => {
              const parsed = parseAnyColor(item, resolveNamed);
              return (
                <li key={item}>
                  <button
                    type="button"
                    className={styles.recentSwatch}
                    style={parsed ? { background: formatColor(parsed, 'rgb') } : undefined}
                    aria-label={t('colors.useRecent', { color: item })}
                    data-tooltip={item}
                    onClick={() => choose(item, false)}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------- Aspect ratio ---------- */

function AspectTab({ state, onChange, viewports, onCopy }: Props) {
  const { t } = useI18n();
  const aspect = state.aspect;
  const set = (patch: Partial<ToolkitState['aspect']>) => onChange({ ...state, aspect: { ...aspect, ...patch } });
  const width = readNumber(aspect.width);
  const height = readNumber(aspect.height);
  const share = readNumber(aspect.share);
  const ratio = width !== null && height !== null ? aspectRatio(width, height) : null;
  const shareValid = share !== null && share > 0 && share <= 100;

  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <span className={styles.label}>{t('aspect.presets')}</span>
        <div className={styles.presets}>
          {COMMON_RATIOS.slice(0, 8).map(([w, h]) => (
            <button
              key={`${w}:${h}`}
              type="button"
              className={styles.preset}
              aria-pressed={ratio?.width === w && ratio.height === h}
              onClick={() => set({ width: String(w), height: String(h) })}
            >
              {w}:{h}
            </button>
          ))}
          {viewports.length > 0 && (
            <Select
              size="sm"
              aria-label={t('aspect.fromViewport')}
              value=""
              onChange={(event) => {
                const viewport = viewports.find((item) => item.id === event.target.value);
                if (viewport) set({ width: String(viewport.width), height: String(viewport.height) });
              }}
            >
              <option value="">{t('aspect.fromViewport')}</option>
              {viewports.map((viewport) => (
                <option key={viewport.id} value={viewport.id}>
                  {viewport.name} · {viewport.width}×{viewport.height}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      <div className={styles.grid}>
        <Field
          label={t('aspect.width')}
          value={aspect.width}
          invalid={!(width !== null && width > 0)}
          onChange={(value) => set({ width: value })}
          testId="aspect-width"
        />
        <Field
          label={t('aspect.height')}
          value={aspect.height}
          invalid={!(height !== null && height > 0)}
          onChange={(value) => set({ height: value })}
          testId="aspect-height"
        />
        <Field
          label={t('aspect.share')}
          value={aspect.share}
          suffix="%"
          invalid={!shareValid}
          onChange={(value) => set({ share: value })}
        />
      </div>

      {!ratio ? (
        <Note tone="warning">{t('aspect.invalid')}</Note>
      ) : (
        <>
          <div className={styles.ratioResult}>
            <span
              className={styles.ratioBox}
              // Fitted into 120 × 72 px.
              style={
                ratio.value >= 120 / 72
                  ? { width: 120, height: Math.max(4, 120 / ratio.value) }
                  : { width: Math.max(4, 72 * ratio.value), height: 72 }
              }
              aria-hidden="true"
            />
            <div>
              <span className={styles.label}>{t('aspect.ratio')}</span>
              <output className={styles.ratioValue} data-testid="aspect-ratio">
                {ratioText(ratio)}
              </output>
              {ratio.near && (
                <span className={styles.near}>
                  {t('aspect.near', { ratio: `${ratio.near.width}:${ratio.near.height}` })}
                </span>
              )}
            </div>
          </div>
          <Code code={aspectCss(ratio)} label={t('aspect.ratio')} onCopy={() => onCopy(aspectCss(ratio))} />
          {shareValid && viewports.length > 0 && (
            <table className={styles.table}>
              <caption className="visually-hidden">{t('aspect.heights')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('aspect.heights')}</th>
                  <ViewportHead viewports={viewports} />
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">{t('aspect.boxWidth')}</th>
                  {viewports.map((viewport) => (
                    <td key={viewport.id} className={styles.num}>
                      {px((viewport.width * share!) / 100)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row">{t('aspect.boxHeight')}</th>
                  {viewports.map((viewport) => {
                    const boxHeight = heightAt(viewport.width, share!, ratio);
                    return (
                      <td
                        key={viewport.id}
                        className={styles.num}
                        data-taller={boxHeight > viewport.height || undefined}
                        title={boxHeight > viewport.height ? t('aspect.taller') : undefined}
                      >
                        {px(boxHeight)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          )}
          {viewports.length === 0 && <Note>{t('toolkit.noViewports')}</Note>}
        </>
      )}
    </div>
  );
}

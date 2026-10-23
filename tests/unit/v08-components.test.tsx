import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ElementInfo, ImageSample, PageStats } from '../../src/agent/protocol';
import { AuditPanel, type AuditRow, type AuditTab } from '../../src/components/AuditPanel/AuditPanel';
import { InspectorPanel, type InspectorRow } from '../../src/components/Inspector/InspectorPanel';
import { PlanProvider } from '../../src/components/Plan/PlanContext';
import { SettingsDialog } from '../../src/components/SettingsDialog/SettingsDialog';
import { Tour } from '../../src/components/Tour/Tour';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import { defaultSettings } from '../../src/services/storage';
import { FREE_ENTITLEMENT, entitlementOf, type Entitlement } from '../../src/state/license';

const NOW = Date.now();
const TRIAL = entitlementOf(null, NOW, NOW);

function wrap(ui: ReactNode, entitlement: Entitlement = FREE_ENTITLEMENT, upgrade = vi.fn()) {
  render(
    <I18nProvider language="en">
      <PlanProvider value={{ entitlement, upgrade }}>{ui}</PlanProvider>
    </I18nProvider>,
  );
  return upgrade;
}

const image = (width: number, naturalWidth: number): ImageSample => ({
  selector: 'main > img',
  label: 'main > img.hero',
  file: 'hero.jpg',
  width,
  height: Math.round(width / 2),
  naturalWidth,
  naturalHeight: Math.round(naturalWidth / 2),
  dpr: 2,
  responsive: false,
});

const stats = (values: Partial<PageStats>): PageStats => ({
  requests: 10,
  transferred: 100_000,
  unknownSize: 0,
  images: 0,
  imagePixels: 0,
  shownPixels: 0,
  dpr: 1,
  elements: 100,
  height: 1000,
  lcp: 1000,
  cls: 0,
  fonts: 0,
  ...values,
});

const row = (id: string, width: number, values: Partial<AuditRow> = {}): AuditRow => ({
  id,
  name: id,
  width,
  height: 800,
  report: { width, issues: [] },
  stats: null,
  type: null,
  ...values,
});

const auditProps = (tab: AuditTab, rows: AuditRow[]) => ({
  tab,
  onTab: vi.fn(),
  rows,
  checksOn: true,
  highlights: {},
  needsAccess: false,
  host: 'example.com',
  busy: false,
  measuring: false,
  locale: 'en',
  onHighlight: vi.fn(),
  onReveal: vi.fn(),
  onRefresh: vi.fn(),
  onCopy: vi.fn(),
  onCopyText: vi.fn(),
  onTurnOnChecks: vi.fn(),
  onAllowSite: vi.fn(),
  onClose: vi.fn(),
});

describe('audit: images, colours and budgets', () => {
  it('shows each image at every size with its fit and a suggested srcset to copy', async () => {
    const props = auditProps('images', [
      row('Phone', 375, { images: [image(375, 2400)] }),
      row('Desktop', 1280, { images: [image(1200, 2400)] }),
    ]);
    wrap(<AuditPanel {...props} />);
    expect(screen.getByRole('tab', { name: /Images/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('images-summary')).toHaveTextContent('1 image');
    const item = screen.getByTestId('image-row');
    expect(item).toHaveTextContent('hero.jpg');
    expect(item).toHaveTextContent('Shown 375 px · file 2400 px · needs 750 px');
    expect(within(item).getByText('Too large')).toBeInTheDocument();
    expect(within(item).getByText('Right size')).toBeInTheDocument();
    expect(screen.getByTestId('image-sizes')).toHaveTextContent('sizes="(max-width: 1279px) 100vw, 94vw"');
    await userEvent.click(within(item).getByRole('button', { name: 'Copy srcset and sizes' }));
    expect(props.onCopyText).toHaveBeenCalledWith(expect.stringContaining('hero-750.jpg 750w'));
  });

  it('says when there are no images', () => {
    wrap(<AuditPanel {...auditProps('images', [row('Phone', 375, { images: [] })])} />);
    expect(screen.getByRole('status')).toHaveTextContent('No images to check');
  });

  it('shows the colours by role and copies them as CSS variables', async () => {
    const props = auditProps('colors', [
      row('Phone', 375, {
        colors: {
          text: [{ hex: '#1f2430', count: 40 }],
          background: [{ hex: '#ffffff', count: 9 }],
          border: [],
        },
      }),
    ]);
    wrap(<AuditPanel {...props} />);
    expect(screen.getByTestId('colors-summary')).toHaveTextContent('2 colours across the previews');
    expect(screen.getAllByTestId('color-role')).toHaveLength(2);
    expect(screen.getByRole('region', { name: 'Text' })).toHaveTextContent('#1f2430');
    await userEvent.click(screen.getByRole('button', { name: 'Copy as CSS variables' }));
    expect(props.onCopyText).toHaveBeenCalledWith(expect.stringContaining('--text-1: #1f2430;'));
  });

  it('marks previews over a performance budget', () => {
    const rows = [
      row('Phone', 375, { stats: stats({ transferred: 900_000 }) }),
      row('Desktop', 1280, { stats: stats({ transferred: 200_000 }) }),
    ];
    wrap(
      <AuditPanel
        {...auditProps('performance', rows)}
        budgets={{ transferred: 500, requests: null, lcp: null, cls: null }}
      />,
    );
    expect(screen.getByTestId('budget-summary')).toHaveTextContent('1 budget exceeded');
    expect(screen.getAllByText('Over budget')).toHaveLength(1);
    expect(screen.getByTestId('budget-limit')).toHaveTextContent('Budget: 500 kB');
  });

  it('shows no budget marks without budgets', () => {
    wrap(<AuditPanel {...auditProps('performance', [row('Phone', 375, { stats: stats({}) })])} budgets={null} />);
    expect(screen.queryByTestId('budget-summary')).not.toBeInTheDocument();
  });
});

describe('budgets in Settings', () => {
  const settingsProps = (entitlement: Entitlement) => ({
    open: true,
    settings: { ...defaultSettings(), budgets: { transferred: 500, requests: null, lcp: null, cls: null } },
    version: '0.8.0',
    siteBreakpoints: null,
    onTheme: vi.fn(),
    onLanguage: vi.fn(),
    onBreakpoints: vi.fn(),
    onCustomBreakpoints: vi.fn(),
    onSync: vi.fn(),
    onChecks: vi.fn(),
    onGrid: vi.fn(),
    onOpenSaved: vi.fn(),
    onRemoveSaved: vi.fn(),
    onRulers: vi.fn(),
    onEmbedHints: vi.fn(),
    onRememberRecent: vi.fn(),
    onClearRecent: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    onReset: vi.fn(),
    onManageAccess: vi.fn(),
    onOpenShortcuts: vi.fn(),
    plan: {
      entitlement,
      checkoutUrl: null,
      onStartTrial: vi.fn(),
      onActivate: vi.fn(),
      onActivated: vi.fn(),
      onRemove: vi.fn(),
    },
    onBudgets: vi.fn(),
    onClose: vi.fn(),
  });

  it('are locked on the free plan', async () => {
    const props = settingsProps(FREE_ENTITLEMENT);
    const upgrade = wrap(<SettingsDialog {...props} />);
    const budgets = screen.getByTestId('budgets');
    expect(within(budgets).getByRole('spinbutton', { name: 'Transferred (kB)' })).toBeDisabled();
    await userEvent.click(within(budgets).getByRole('button', { name: 'See Pro' }));
    expect(upgrade).toHaveBeenCalledWith('budgets');
  });

  it('are set with Pro; an emptied field removes the limit', async () => {
    const props = settingsProps(TRIAL);
    wrap(<SettingsDialog {...props} />, TRIAL);
    const budgets = screen.getByTestId('budgets');
    const requests = within(budgets).getByRole('spinbutton', { name: 'Requests' });
    await userEvent.type(requests, '60{Enter}');
    expect(props.onBudgets).toHaveBeenCalledWith({ requests: 60 });
    const transferred = within(budgets).getByRole('spinbutton', { name: 'Transferred (kB)' });
    expect(transferred).toHaveValue(500);
    await userEvent.clear(transferred);
    await userEvent.tab();
    expect(props.onBudgets).toHaveBeenCalledWith({ transferred: null });
  });
});

describe('inspector distance', () => {
  const info = { label: 'main > h1', visible: true, width: 300, height: 40 } as ElementInfo;
  const rows = (gaps: InspectorRow['gap'][]): InspectorRow[] =>
    gaps.map((gap, index) => ({
      id: `card-${index}`,
      name: index ? 'Desktop' : 'Phone',
      width: index ? 1440 : 375,
      height: 800,
      sizeClass: index ? 'desktop' : 'phone',
      info,
      gap,
    }));
  const props = {
    picking: false,
    selector: 'main > h1',
    needsAccess: false,
    host: 'example.com',
    busy: false,
    onPick: vi.fn(),
    onClear: vi.fn(),
    onClose: vi.fn(),
    onReveal: vi.fn(),
    onCopySelector: vi.fn(),
    onAllowSite: vi.fn(),
  };

  it('offers to pick a second element', async () => {
    const onPickTarget = vi.fn();
    wrap(<InspectorPanel {...props} rows={rows([undefined])} onPickTarget={onPickTarget} />);
    await userEvent.click(screen.getByTestId('inspector-distance-pick'));
    expect(onPickTarget).toHaveBeenCalledOnce();
    expect(screen.queryAllByTestId('inspector-gap')).toHaveLength(0);
  });

  it('shows the distance at every size and marks it when it changes', async () => {
    const onClearTarget = vi.fn();
    wrap(
      <InspectorPanel
        {...props}
        rows={rows([{ relation: 'apart', horizontal: null, vertical: 16 }, null])}
        target={{ selector: 'main > p', label: 'main > p.lead' }}
        onPickTarget={vi.fn()}
        onClearTarget={onClearTarget}
        onMeasureGaps={vi.fn()}
      />,
    );
    expect(screen.getByTestId('inspector-distance')).toHaveTextContent('Distance to main > p.lead');
    const [phone, desktop] = screen.getAllByTestId('inspector-gap');
    expect(phone).toHaveTextContent('↕ 16 px');
    expect(desktop).toHaveTextContent('Not both shown at this size');
    await userEvent.click(screen.getByRole('button', { name: 'Remove the distance' }));
    expect(onClearTarget).toHaveBeenCalledOnce();
  });
});

describe('tour', () => {
  it('walks through the controls that are shown and ends with Escape', async () => {
    document.body.innerHTML = '';
    const controls = ['address-input', 'inspect-toggle', 'help-button'].map((id) => {
      const element = document.createElement('button');
      element.dataset.testid = id;
      element.getBoundingClientRect = () => ({
        x: 10,
        y: 10,
        left: 10,
        top: 10,
        width: 40,
        height: 20,
        right: 50,
        bottom: 30,
        toJSON: () => ({}),
      });
      document.body.append(element);
      return element;
    });
    const onClose = vi.fn();
    render(
      <I18nProvider language="en">
        <Tour open onClose={onClose} />
      </I18nProvider>,
      { container: document.body.appendChild(document.createElement('div')) },
    );
    const tour = screen.getByTestId('tour');
    expect(tour).toHaveTextContent('Step 1 of 3');
    expect(tour).toHaveTextContent('Open any page');
    // The card shows once it has been placed next to the control.
    await userEvent.click(await within(tour).findByRole('button', { name: 'Next' }));
    expect(tour).toHaveTextContent('Inspect');
    await userEvent.click(within(tour).getByRole('button', { name: 'Back' }));
    expect(tour).toHaveTextContent('Step 1 of 3');
    await userEvent.click(within(tour).getByRole('button', { name: 'Next' }));
    await userEvent.click(within(tour).getByRole('button', { name: 'Next' }));
    expect(within(tour).getByRole('button', { name: 'Done' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
    controls.forEach((element) => element.remove());
  });
});

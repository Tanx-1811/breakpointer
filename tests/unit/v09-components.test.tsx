import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PageMeta } from '../../src/agent/protocol';
import { AuditPanel, AUDIT_TABS } from '../../src/components/AuditPanel/AuditPanel';
import { MetaTab } from '../../src/components/AuditPanel/MetaTab';
import { PlanProvider } from '../../src/components/Plan/PlanContext';
import { SettingsDialog } from '../../src/components/SettingsDialog/SettingsDialog';
import { ViewportSidebar, type SidebarViewport } from '../../src/components/Sidebar/ViewportSidebar';
import { StatusBar } from '../../src/components/StatusBar/StatusBar';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import { defaultSettings } from '../../src/services/storage';
import { FREE_ENTITLEMENT } from '../../src/state/license';

function wrap(ui: ReactNode) {
  return render(
    <I18nProvider language="en">
      <PlanProvider value={{ entitlement: FREE_ENTITLEMENT, upgrade: vi.fn() }}>{ui}</PlanProvider>
    </I18nProvider>,
  );
}

const viewports: SidebarViewport[] = [
  { id: 'p', name: 'Phone', width: 390, height: 844, hidden: false, breakpoint: 'base', issues: 2 },
  { id: 't', name: 'Tablet', width: 768, height: 1024, hidden: false, breakpoint: 'md', issues: 0 },
  { id: 'd', name: 'Desktop', width: 1920, height: 1080, hidden: true, breakpoint: '2xl', issues: null },
];

function sidebar(extra: Partial<Parameters<typeof ViewportSidebar>[0]> = {}) {
  const props = {
    viewports,
    canAdd: true,
    focusedId: null,
    breakpoints: [
      { name: 'sm', min: 640 },
      { name: 'md', min: 768 },
    ],
    breakpointsName: 'Tailwind',
    page: {
      title: 'Pricing — Brightside',
      host: 'brightside.example',
      address: 'brightside.example/pricing',
      status: 200,
      allowed: false,
    },
    score: { score: 84, grade: 'B' as const, sizes: 2, costs: [] },
    issueKinds: 2,
    busy: false,
    onAdd: vi.fn(),
    onReveal: vi.fn(),
    onToggleVisible: vi.fn(),
    onMoveTo: vi.fn(),
    onFocus: vi.fn(),
    onAudit: vi.fn(),
    onAllowSite: vi.fn(),
    onClose: vi.fn(),
    ...extra,
  };
  wrap(<ViewportSidebar {...props} />);
  return props;
}

const meta: PageMeta = {
  title: 'Pricing — Brightside',
  lang: 'en',
  tags: [
    { key: 'viewport', value: 'width=device-width, initial-scale=1' },
    { key: 'og:description', value: 'Plans for every team.' },
  ],
  canonical: 'https://brightside.example/pricing',
  icons: [],
  alternates: 0,
  headings: [
    { level: 1, text: 'Plans', hidden: false },
    { level: 3, text: 'Team', hidden: false },
  ],
};

describe('ViewportSidebar', () => {
  it('lists every viewport with its size, breakpoint and issues', () => {
    sidebar();
    const rows = screen.getAllByTestId('sidebar-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAccessibleName(/^Phone\s*390 × 844\s*base\s*2 kinds of issue$/);
    expect(rows[0]).toHaveTextContent('base');
    expect(rows[0]).toHaveTextContent('2');
    // Hidden viewports show no breakpoint or issues.
    expect(rows[2]).not.toHaveTextContent('2xl');
    expect(screen.getByRole('img', { name: /Breakpoints: sm 640, md 768\. Viewports: Phone 390, Tablet 768/ })).toBeVisible();
  });

  it('goes to, focuses, shows, hides and reorders viewports', async () => {
    const props = sidebar();
    const rows = screen.getAllByTestId('sidebar-row');
    await userEvent.click(rows[1]!);
    expect(props.onReveal).toHaveBeenCalledWith('t');
    await userEvent.dblClick(rows[0]!);
    expect(props.onFocus).toHaveBeenCalledWith('p');
    await userEvent.click(screen.getByRole('button', { name: 'Show Desktop' }));
    expect(props.onToggleVisible).toHaveBeenCalledWith('d');
    await userEvent.click(screen.getByRole('button', { name: 'Hide Phone' }));
    expect(props.onToggleVisible).toHaveBeenCalledWith('p');
    rows[0]!.focus();
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(props.onMoveTo).toHaveBeenCalledWith('p', 1);
  });

  it('shows the page, asks for access and opens the audit from the score', async () => {
    const props = sidebar();
    const page = screen.getByTestId('sidebar-page');
    expect(page).toHaveTextContent('Pricing — Brightside');
    expect(page).toHaveTextContent('200');
    await userEvent.click(within(page).getByRole('button', { name: 'Allow brightside.example…' }));
    expect(props.onAllowSite).toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('sidebar-score'));
    expect(props.onAudit).toHaveBeenCalled();
    expect(screen.getByTestId('sidebar-score')).toHaveTextContent('Responsive score · B');
  });
});

describe('StatusBar', () => {
  function bar(extra = {}) {
    const props = {
      shown: 2,
      total: 3,
      hasUrl: true,
      status: 404,
      access: { host: 'brightside.example', allowed: false, allSites: false },
      sync: { scroll: true, navigation: false },
      issueKinds: 3,
      breakpointsName: 'Tailwind',
      widths: '390–768',
      zoom: null,
      layout: 'stack' as const,
      sidebar: false,
      minimap: true,
      onSidebar: vi.fn(),
      onSiteAccess: vi.fn(),
      onSync: vi.fn(),
      onAudit: vi.fn(),
      onFit: vi.fn(),
      onMinimap: vi.fn(),
      ...extra,
    };
    wrap(<StatusBar {...props} />);
    return props;
  }

  it('says what the workspace shows', () => {
    bar();
    const status = screen.getByTestId('status-bar');
    expect(status).toHaveTextContent('2 previews');
    expect(status).toHaveTextContent('1 hidden');
    expect(status).toHaveTextContent('HTTP 404');
    expect(status).toHaveTextContent('Not allowed on brightside.example');
    expect(status).toHaveTextContent('Sync: scrolling');
    expect(status).toHaveTextContent('3 kinds of issue');
    expect(status).toHaveTextContent('390–768 px');
    expect(status).toHaveTextContent('Mixed');
    expect(status).toHaveTextContent('Stack');
  });

  it('is a shortcut to each setting', async () => {
    const props = bar();
    await userEvent.click(screen.getByRole('button', { name: 'Viewports sidebar' }));
    await userEvent.click(screen.getByTestId('status-access'));
    await userEvent.click(screen.getByTestId('status-sync'));
    await userEvent.click(screen.getByTestId('status-issues'));
    await userEvent.click(screen.getByTestId('status-zoom'));
    await userEvent.click(screen.getByRole('button', { name: 'Minimap' }));
    for (const handler of ['onSidebar', 'onSiteAccess', 'onSync', 'onAudit', 'onFit', 'onMinimap'] as const)
      expect(props[handler]).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Minimap' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('leaves out the issues when checks are off', () => {
    bar({ issueKinds: null, access: null, status: 200 });
    expect(screen.queryByTestId('status-issues')).toBeNull();
    expect(screen.queryByTestId('status-access')).toBeNull();
    expect(screen.getByTestId('status-bar')).not.toHaveTextContent('HTTP');
  });
});

describe('MetaTab', () => {
  it('shows the search result, link preview, checks and outline of the preview picked', async () => {
    const onCard = vi.fn();
    wrap(
      <MetaTab
        rows={[
          { id: 'p', name: 'Phone', width: 390, meta },
          { id: 't', name: 'Tablet', width: 768, meta: { ...meta, title: 'Tablet title' } },
        ]}
        page="https://brightside.example/pricing"
        measuring={false}
        card="t"
        onCard={onCard}
      />,
    );
    expect(screen.getByTestId('meta-serp')).toHaveTextContent('Tablet title');
    expect(screen.getByTestId('meta-serp')).toHaveTextContent('https://brightside.example › pricing');
    expect(screen.getByTestId('meta-serp')).toHaveTextContent('No description');
    expect(screen.getByTestId('meta-social')).toHaveTextContent('No social image');
    expect(screen.getByTestId('meta-social')).toHaveTextContent('Plans for every team.');
    // No description is to fix; a short title, no image, no icons and the skipped level are to check.
    expect(screen.getByTestId('meta-summary')).toHaveTextContent('1 to fix · 4 to check');
    expect(screen.getAllByTestId('meta-check')).toHaveLength(10);
    expect(screen.getByTestId('meta-outline')).toHaveTextContent('Skips a level');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Preview to read' }), 'p');
    expect(onCard).toHaveBeenCalledWith('p');
  });

  it('waits for the previews, then says when none could be read', () => {
    const { unmount } = wrap(<MetaTab rows={[{ id: 'p', name: 'Phone', width: 390 }]} page={null} measuring={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('Measuring');
    unmount();
    wrap(<MetaTab rows={[{ id: 'p', name: 'Phone', width: 390, meta: null }]} page={null} measuring={false} />);
    expect(screen.getByRole('status')).toHaveTextContent('No preview could be read');
  });
});

describe('AuditPanel tabs', () => {
  it('names every tab and writes the label of the one shown', () => {
    wrap(
      <AuditPanel
        tab="meta"
        onTab={vi.fn()}
        rows={[{ id: 'p', name: 'Phone', width: 390, height: 844, report: null, stats: null, type: null, meta }]}
        checksOn
        highlights={{}}
        needsAccess={false}
        host="brightside.example"
        busy={false}
        measuring={false}
        locale="en"
        onHighlight={vi.fn()}
        onReveal={vi.fn()}
        onRefresh={vi.fn()}
        onCopy={vi.fn()}
        onTurnOnChecks={vi.fn()}
        onAllowSite={vi.fn()}
        onClose={vi.fn()}
        page="https://brightside.example/pricing"
      />,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(AUDIT_TABS.length);
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual([
      'Issues',
      'Performance',
      'Type',
      'Images',
      'Colours',
      'Meta',
    ]);
    expect(screen.getByRole('tab', { name: 'Meta' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('meta-tab')).toBeVisible();
  });
});

describe('Settings → Appearance', () => {
  it('picks the accent, canvas, layout and panels', async () => {
    const onAccent = vi.fn();
    const onCanvas = vi.fn();
    const onLayout = vi.fn();
    const onPanels = vi.fn();
    const noop = vi.fn();
    wrap(
      <SettingsDialog
        open
        settings={defaultSettings()}
        version="0.9.0"
        siteBreakpoints={null}
        onTheme={noop}
        onLanguage={noop}
        onAccent={onAccent}
        onCanvas={onCanvas}
        onLayout={onLayout}
        onPanels={onPanels}
        onBreakpoints={noop}
        onCustomBreakpoints={noop}
        onSync={noop}
        onChecks={noop}
        onGrid={noop}
        onOpenSaved={noop}
        onRemoveSaved={noop}
        onRulers={noop}
        onEmbedHints={noop}
        onRememberRecent={noop}
        onClearRecent={noop}
        onExport={noop}
        onImport={noop}
        onReset={noop}
        onManageAccess={noop}
        onOpenShortcuts={noop}
        onClose={noop}
      />,
    );
    const accents = screen.getByRole('radiogroup', { name: 'Accent colour' });
    expect(within(accents).getByRole('radio', { name: 'Indigo' })).toBeChecked();
    await userEvent.click(within(accents).getByRole('radio', { name: 'Teal' }));
    expect(onAccent).toHaveBeenCalledWith('teal');
    await userEvent.click(screen.getByRole('radio', { name: 'Grid' }));
    expect(onCanvas).toHaveBeenCalledWith('grid');
    await userEvent.click(screen.getByRole('radio', { name: 'Stack' }));
    expect(onLayout).toHaveBeenCalledWith('stack');
    await userEvent.click(screen.getByRole('switch', { name: 'Viewports sidebar' }));
    expect(onPanels).toHaveBeenCalledWith({ sidebar: true });
    await userEvent.click(screen.getByRole('switch', { name: 'Minimap' }));
    expect(onPanels).toHaveBeenCalledWith({ minimap: false });
  });
});

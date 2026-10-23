import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AuditPanel } from '../../src/components/AuditPanel/AuditPanel';
import { ExportMenu } from '../../src/components/Plan/ExportMenu';
import { LicenseForm } from '../../src/components/Plan/LicenseForm';
import { PlanProvider } from '../../src/components/Plan/PlanContext';
import { UpgradeDialog } from '../../src/components/Plan/UpgradeDialog';
import { SettingsDialog } from '../../src/components/SettingsDialog/SettingsDialog';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import { defaultSettings } from '../../src/services/storage';
import { FREE_ENTITLEMENT, entitlementOf, parseClaims, type Entitlement } from '../../src/state/license';
import { TopBar } from '../../src/viewer/TopBar';

const NOW = Date.now();
const TRIAL = entitlementOf(null, NOW, NOW);
const LICENSED = entitlementOf(
  parseClaims({ aud: 'breakpointer', sub: 'L-42', name: 'Acme Studio', plan: 'pro', iat: Math.floor(NOW / 1000) - 60 }),
  null,
  NOW,
);

function wrap(ui: ReactNode, entitlement: Entitlement = FREE_ENTITLEMENT, upgrade = vi.fn()) {
  render(
    <I18nProvider language="en">
      <PlanProvider value={{ entitlement, upgrade }}>{ui}</PlanProvider>
    </I18nProvider>,
  );
  return upgrade;
}

const upgradeProps = () => ({
  open: true,
  feature: null,
  entitlement: FREE_ENTITLEMENT,
  checkoutUrl: null as string | null,
  onStartTrial: vi.fn(),
  onActivate: vi.fn(async () => ({ ok: false as const, problem: 'signature' as const })),
  onActivated: vi.fn(),
  onClose: vi.fn(),
});

describe('upgrade dialog', () => {
  it('lists Pro, offers the trial and says when sales open', async () => {
    const props = upgradeProps();
    wrap(<UpgradeDialog {...props} />);
    const dialog = screen.getByTestId('upgrade-dialog');
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(7);
    expect(within(dialog).getByText(/licences go on sale soon/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('link', { name: /Get Pro/ })).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Try Pro free for 7 days' }));
    expect(props.onStartTrial).toHaveBeenCalledOnce();
  });

  it('puts the feature asked for first and links to the checkout', () => {
    wrap(
      <UpgradeDialog
        {...upgradeProps()}
        feature="dataExport"
        checkoutUrl="https://shop.example/breakpointer-pro"
        entitlement={TRIAL}
      />,
    );
    expect(screen.getByText('CSV & JSON exports comes with Breakpointer Pro.')).toBeInTheDocument();
    const items = within(screen.getByTestId('upgrade-dialog')).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('CSV & JSON exports');
    expect(screen.getByRole('link', { name: /Get Pro/ })).toHaveAttribute(
      'href',
      'https://shop.example/breakpointer-pro',
    );
    expect(screen.getByTestId('trial-status')).toHaveTextContent('Pro trial · 7 days left');
    expect(screen.queryByRole('button', { name: /Try Pro free/ })).not.toBeInTheDocument();
  });
});

describe('licence form', () => {
  it('explains why a key was refused, and reports a valid one', async () => {
    const claims = parseClaims({ aud: 'breakpointer', sub: 'L-1', name: 'Jane', plan: 'pro', iat: 1_700_000_000 })!;
    const onActivate = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, problem: 'format' })
      .mockResolvedValueOnce({ ok: true, claims });
    const onActivated = vi.fn();
    wrap(<LicenseForm onActivate={onActivate} onActivated={onActivated} />);
    const field = screen.getByRole('textbox', { name: 'Licence key' });
    const activate = screen.getByRole('button', { name: 'Activate' });
    expect(activate).toBeDisabled();
    await userEvent.type(field, 'nonsense');
    await userEvent.click(activate);
    expect(await screen.findByRole('alert')).toHaveTextContent('doesn’t look like a Breakpointer licence key');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    await userEvent.type(field, '.more');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(activate);
    expect(onActivate).toHaveBeenLastCalledWith('nonsense.more');
    expect(onActivated).toHaveBeenCalledWith({ ok: true, claims });
    expect(field).toHaveValue('');
  });
});

describe('Pro marks', () => {
  it('marks exports as Pro on the free plan only', async () => {
    const onExport = vi.fn();
    wrap(<ExportMenu onExport={onExport} />);
    await userEvent.click(screen.getByRole('button', { name: /Export/ }));
    const csv = screen.getByRole('menuitem', { name: /CSV for spreadsheets/ });
    expect(within(csv).getByText('Pro')).toBeInTheDocument();
    await userEvent.click(csv);
    expect(onExport).toHaveBeenCalledWith('csv');
  });

  it('shows no mark with Pro', async () => {
    wrap(<ExportMenu onExport={vi.fn()} />, LICENSED);
    await userEvent.click(screen.getByRole('button', { name: /Export/ }));
    expect(within(screen.getByRole('menu')).queryByText('Pro')).not.toBeInTheDocument();
  });

  it('offers the accessibility checks in the audit on the free plan', async () => {
    const auditProps = {
      tab: 'issues' as const,
      onTab: vi.fn(),
      rows: [
        {
          id: 'a',
          name: 'Phone',
          width: 375,
          height: 667,
          report: { width: 375, issues: [] },
          stats: null,
          type: null,
        },
      ],
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
      onTurnOnChecks: vi.fn(),
      onAllowSite: vi.fn(),
      onClose: vi.fn(),
    };
    const upgrade = wrap(<AuditPanel {...auditProps} />);
    await userEvent.click(within(screen.getByTestId('audit-pro-teaser')).getByRole('button', { name: 'See Pro' }));
    expect(upgrade).toHaveBeenCalledWith('a11yChecks');
  });

  it('shows the trial’s days left in the top bar, and nothing with a licence', () => {
    const topBar = (entitlement: Entitlement) => (
      <TopBar
        address=""
        addressError={null}
        addressRef={{ current: null }}
        recentUrls={[]}
        savedPages={[]}
        saved={false}
        onToggleSaved={vi.fn()}
        hasUrl={false}
        secure={null}
        siteAllowed={null}
        canGoBack={false}
        canGoForward={false}
        onBack={vi.fn()}
        onForward={vi.fn()}
        onAddressChange={vi.fn()}
        onSubmit={vi.fn()}
        onReloadAll={vi.fn()}
        onOpenInTab={vi.fn()}
        onPalette={vi.fn()}
        paletteShortcut="Ctrl K"
        onCapture={vi.fn()}
        onSiteAccess={vi.fn()}
        onToggleTheme={vi.fn()}
        resolvedTheme="light"
        onSettings={vi.fn()}
        onHelp={vi.fn()}
        entitlement={entitlement}
        onPro={vi.fn()}
      />
    );
    const { unmount } = render(<I18nProvider language="en">{topBar(FREE_ENTITLEMENT)}</I18nProvider>);
    expect(screen.getByTestId('pro-button')).toHaveAccessibleName('Get Pro');
    unmount();
    const trial = render(<I18nProvider language="en">{topBar(TRIAL)}</I18nProvider>);
    expect(screen.getByTestId('pro-button')).toHaveAccessibleName('Pro trial, 7 days left');
    trial.unmount();
    render(<I18nProvider language="en">{topBar(LICENSED)}</I18nProvider>);
    expect(screen.queryByTestId('pro-button')).not.toBeInTheDocument();
  });
});

describe('settings', () => {
  const settingsProps = (entitlement: Entitlement) => ({
    open: true,
    settings: defaultSettings(),
    version: '0.6.0',
    siteBreakpoints: null,
    onTheme: vi.fn(),
    onLanguage: vi.fn(),
    onBreakpoints: vi.fn(),
    onCustomBreakpoints: vi.fn(),
    onSync: vi.fn(),
    onChecks: vi.fn(),
    onCheckKind: vi.fn(),
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
    onBranding: vi.fn(),
    onClose: vi.fn(),
  });

  it('locks Pro settings on the free plan and asks to upgrade', async () => {
    const props = settingsProps(FREE_ENTITLEMENT);
    const upgrade = wrap(<SettingsDialog {...props} />);
    expect(screen.getByTestId('plan-status')).toHaveTextContent('Free plan');
    // The accessibility checks are off and marked.
    const altCheck = screen.getByRole('checkbox', { name: /Images without alt text/ });
    expect(altCheck).not.toBeChecked();
    await userEvent.click(altCheck);
    expect(upgrade).toHaveBeenCalledWith('a11yChecks');
    expect(props.onCheckKind).not.toHaveBeenCalled();
    // Synced interactions.
    await userEvent.click(screen.getByRole('switch', { name: /Sync clicks & typing/ }));
    expect(upgrade).toHaveBeenCalledWith('syncInteractions');
    expect(props.onSync).not.toHaveBeenCalled();
    // The brand can't be edited.
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled();
    await userEvent.click(within(screen.getByTestId('brand-settings')).getByRole('button', { name: 'See Pro' }));
    expect(upgrade).toHaveBeenCalledWith('branding');
  });

  it('shows the licence and lets Pro settings change', async () => {
    const props = settingsProps(LICENSED);
    wrap(<SettingsDialog {...props} />, LICENSED);
    expect(screen.getByTestId('plan-status')).toHaveTextContent('Licensed to Acme Studio');
    expect(screen.getByTestId('plan-status')).toHaveTextContent('Never expires');
    await userEvent.click(screen.getByRole('button', { name: 'Remove licence' }));
    expect(props.plan.onRemove).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('switch', { name: /Sync clicks & typing/ }));
    expect(props.onSync).toHaveBeenCalledWith({ interactions: true });
    const name = screen.getByRole('textbox', { name: 'Name' });
    await userEvent.type(name, '  Acme   Studio {Enter}');
    expect(props.onBranding).toHaveBeenCalledWith({ name: 'Acme Studio' });
    const website = screen.getByRole('textbox', { name: 'Website' });
    await userEvent.type(website, 'acme.example{Enter}');
    expect(screen.getByText(/starts with https:\/\//)).toBeInTheDocument();
    expect(props.onBranding).toHaveBeenCalledTimes(1);
  });
});

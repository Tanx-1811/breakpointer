import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlanProvider } from '../../src/components/Plan/PlanContext';
import { SettingsDialog } from '../../src/components/SettingsDialog/SettingsDialog';
import { I18nProvider } from '../../src/i18n/I18nProvider';
import type { Language } from '../../src/i18n/translate';
import { defaultSettings } from '../../src/services/storage';
import { FREE_ENTITLEMENT } from '../../src/state/license';
import { matchRanges, matchesWords, searchWords } from '../../src/state/settings-search';

describe('searching settings', () => {
  it('folds case and accents, and every word must match', () => {
    expect(searchWords('  Giao  DIỆN ')).toEqual(['giao', 'dien']);
    expect(matchesWords('Giao diện', searchWords('giao dien'))).toBe(true);
    expect(matchesWords('Đường kẻ', searchWords('duong'))).toBe(true);
    expect(matchesWords('Column grid', searchWords('grid column'))).toBe(true);
    expect(matchesWords('Column grid', searchWords('grid rows'))).toBe(false);
    expect(matchesWords('anything', [])).toBe(true);
  });

  it('finds where the words are in the original text', () => {
    expect(matchRanges('Giao diện', searchWords('dien'))).toEqual([[5, 9]]);
    // Written decomposed (NFD): the accents of the last letter stay in the range.
    const decomposed = 'Giao diện'.normalize('NFD');
    const [range] = matchRanges(decomposed, searchWords('dien'));
    expect(decomposed.slice(...range!)).toBe('diện'.normalize('NFD'));
    // Overlapping and touching matches are merged; repeats are all found.
    expect(matchRanges('grid grid', searchWords('gri rid'))).toEqual([
      [0, 4],
      [5, 9],
    ]);
    expect(matchRanges('Column grid', [])).toEqual([]);
    expect(matchRanges('', ['a'])).toEqual([]);
  });
});

function settingsDialog(language: Language = 'en', onClose = vi.fn()) {
  const noop = vi.fn();
  return render(
    <I18nProvider language={language}>
      <PlanProvider value={{ entitlement: FREE_ENTITLEMENT, upgrade: vi.fn() }}>
        <SettingsDialog
          open
          settings={defaultSettings()}
          version="0.14.0"
          siteBreakpoints={null}
          onTheme={noop}
          onLanguage={noop}
          onAccent={noop}
          onCanvas={noop}
          onLayout={noop}
          onPanels={noop}
          onBreakpoints={noop}
          onCustomBreakpoints={noop}
          onSync={noop}
          onChecks={noop}
          onCheckKind={noop}
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
          onClose={onClose}
        />
      </PlanProvider>
    </I18nProvider>,
  );
}

const navItems = () =>
  within(screen.getByRole('navigation', { name: 'Settings sections' }))
    .queryAllByRole('button')
    .map((button) => button.textContent);

describe('Settings → search', () => {
  it('keeps the settings that match, with their options, and the sections that have them', async () => {
    settingsDialog();
    const search = screen.getByTestId('settings-search');
    expect(search).toHaveFocus();
    await userEvent.type(search, 'grid');
    expect(navItems()).toEqual(['Appearance', 'Preview tools']);
    expect(screen.getByRole('status')).toHaveTextContent('3 settings found');
    // The column grid's options show with it; settings that don't match are hidden.
    const grid = screen.getByRole('switch', { name: 'Column grid' });
    expect(grid.closest('[data-search-hidden]')).toBeNull();
    expect(screen.getByText('Columns').closest('[data-search-hidden]')).toBeNull();
    expect(screen.getByRole('switch', { name: 'Show rulers' }).closest('[data-search-hidden]')).not.toBeNull();
    expect(
      screen.getByRole('region', { name: 'Saved pages' }).closest('[data-search-hidden]') ??
        screen.getByText('Saved pages', { selector: 'h3' }).closest('[data-search-hidden]'),
    ).not.toBeNull();
  });

  it('says when nothing matches; Escape clears the search before it closes Settings', async () => {
    const onClose = vi.fn();
    settingsDialog('en', onClose);
    const search = screen.getByTestId('settings-search');
    await userEvent.type(search, 'zzzz');
    expect(screen.getByTestId('settings-no-results')).toHaveTextContent('No settings match “zzzz”.');
    expect(navItems()).toEqual([]);
    await userEvent.keyboard('{Escape}');
    expect(search).toHaveValue('');
    expect(screen.queryByTestId('settings-no-results')).toBeNull();
    expect(navItems()).toContain('Privacy & access');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('finds settings without accents in Vietnamese', async () => {
    settingsDialog('vi');
    await userEvent.type(screen.getByTestId('settings-search'), 'ngon ngu');
    expect(screen.getByRole('status').textContent).toMatch(/^Tìm thấy \d+ cài đặt$/);
    expect(screen.getByRole('combobox', { name: 'Ngôn ngữ' }).closest('[data-search-hidden]')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Nhãn breakpoint' }).closest('[data-search-hidden]')).not.toBeNull();
  });

  it('Ctrl + F goes to the search', async () => {
    settingsDialog();
    screen.getByRole('switch', { name: 'Show rulers' }).focus();
    await userEvent.keyboard('{Control>}f{/Control}');
    expect(screen.getByTestId('settings-search')).toHaveFocus();
  });
});

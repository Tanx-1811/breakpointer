import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PopupApp } from '../../src/popup/Popup';
import { parseSettings } from '../../src/services/storage';
import { hasNews, readSeenVersion, updateNewsBadge } from '../../src/services/whats-new';

// The parts of the extension APIs the toolbar badge and the popup use, on top of the shared mock.
const action = {
  setBadgeText: vi.fn(async () => {}),
  setBadgeBackgroundColor: vi.fn(async () => {}),
  setTitle: vi.fn(async () => {}),
};
const tabs = { create: vi.fn(async () => ({})) };
const runtime = {
  getManifest: () => ({ version: '0.13.0' }),
  getURL: (path: string) => `chrome-extension://id/${path}`,
  getContexts: vi.fn(async () => []),
};
const getMessage = (name: string, substitution?: string) =>
  name === 'badgeNew' ? 'NEW' : name === 'actionTitleNews' ? `Updated to ${substitution}` : 'Breakpointer';

beforeEach(() => {
  Object.assign(chrome, { action, tabs, runtime, i18n: { ...chrome.i18n, getMessage } });
  vi.spyOn(window, 'close').mockImplementation(() => {});
});

afterEach(() => vi.clearAllMocks());

const seen = (version: string) => chrome.storage.local.set({ 'breakpointer.seenVersion': version });

describe('news after an update', () => {
  it('are news when the minor version changed since the last one seen', () => {
    expect(hasNews('0.8.0', '0.13.0')).toBe(true);
    expect(hasNews('0.13.0', '0.13.2')).toBe(false);
    // Seen by a version older than the notice itself.
    expect(hasNews(undefined, '0.13.0')).toBe(true);
  });

  it('puts “NEW” on the toolbar button until they’re seen', async () => {
    await seen('0.8.0');
    await updateNewsBadge();
    expect(action.setBadgeText).toHaveBeenLastCalledWith({ text: 'NEW' });
    expect(action.setTitle).toHaveBeenLastCalledWith({ title: 'Updated to 0.13' });
    await seen('0.13.0');
    await updateNewsBadge();
    expect(action.setBadgeText).toHaveBeenLastCalledWith({ text: '' });
    expect(action.setTitle).toHaveBeenLastCalledWith({ title: 'Breakpointer' });
  });
});

const popup = (news: boolean) =>
  render(<PopupApp settings={parseSettings(undefined)} tabUrl={null} shortcut="" version="0.13.0" news={news} />);

describe('the popup after an update', () => {
  it('says what changed and opens the workspace on What’s new', async () => {
    popup(true);
    expect(screen.getByTestId('popup-news')).toHaveTextContent('Breakpointer was updated to 0.13.');
    await userEvent.click(screen.getByRole('button', { name: 'See what’s new' }));
    expect(tabs.create).toHaveBeenCalledWith({ url: 'chrome-extension://id/viewer/viewer.html?news=1' });
  });

  it('can be dismissed, which marks the news as seen', async () => {
    popup(true);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('popup-news')).toBeNull();
    expect(await readSeenVersion()).toBe('0.13.0');
  });

  it('says nothing when there is nothing new', () => {
    popup(false);
    expect(screen.queryByTestId('popup-news')).toBeNull();
  });
});

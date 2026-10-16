import { disableEmbeddingForTab, tabsWithEmbedding } from '../services/embed-rules';
import { agentRegistered, ensureAgentRegistered, unregisterAgent } from '../services/frame-agents';
import { revokeSessionGrants } from '../services/session-access';
import { openSidePanel } from '../shared/side-panel';
import { openViewer, viewerUrl } from '../shared/viewer-url';
import { parsePreviewUrl, toSafeHref } from '../utils/url';

const VIEWER_PAGE = chrome.runtime.getURL('viewer/viewer.html');
const WEB_PAGES = ['http://*/*', 'https://*/*'];

const MENU_PREVIEW_PAGE = 'preview-page';
const MENU_PREVIEW_LINK = 'preview-link';
const MENU_SIDE_PANEL_PAGE = 'side-panel-page';
const MENU_SIDE_PANEL_LINK = 'side-panel-link';

/* ---------- Install: context menus and a first-run welcome ---------- */

chrome.runtime.onInstalled.addListener(({ reason }) => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_PREVIEW_PAGE,
      title: chrome.i18n.getMessage('menuPreviewPage'),
      contexts: ['page'],
      documentUrlPatterns: WEB_PAGES,
    });
    chrome.contextMenus.create({
      id: MENU_PREVIEW_LINK,
      title: chrome.i18n.getMessage('menuPreviewLink'),
      contexts: ['link'],
      targetUrlPatterns: WEB_PAGES,
    });
    chrome.contextMenus.create({
      id: MENU_SIDE_PANEL_PAGE,
      title: chrome.i18n.getMessage('menuSidePanelPage'),
      contexts: ['page'],
      documentUrlPatterns: WEB_PAGES,
    });
    chrome.contextMenus.create({
      id: MENU_SIDE_PANEL_LINK,
      title: chrome.i18n.getMessage('menuSidePanelLink'),
      contexts: ['link'],
      targetUrlPatterns: WEB_PAGES,
    });
  });
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) void openViewer();
});

chrome.runtime.onStartup.addListener(() => {
  void unregisterAgentIfNoWorkspace();
  // Site access given "until Chrome closes" ends now.
  void revokeSessionGrants();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const link = info.menuItemId === MENU_PREVIEW_LINK || info.menuItemId === MENU_SIDE_PANEL_LINK;
  const url = toSafeHref(link ? info.linkUrl : info.pageUrl);
  if (!url) return;
  if (info.menuItemId === MENU_SIDE_PANEL_PAGE || info.menuItemId === MENU_SIDE_PANEL_LINK) {
    // Straight from the click, which is what lets Chrome open the side panel.
    if (tab?.windowId !== undefined) void openSidePanel(tab.windowId, url).catch(() => {});
    return;
  }
  void openViewer({ url }, tab?.index === undefined ? {} : { index: tab.index + 1, windowId: tab.windowId });
});

/* ---------- Keyboard command: preview the current page ---------- */

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'preview-current-page') return;
  // The command grants activeTab, so the tab's URL is readable here.
  const url = toSafeHref(tab?.url);
  void openViewer(url ? { url } : {}, tab?.index === undefined ? {} : { index: tab.index + 1, windowId: tab.windowId });
});

/* ---------- Address bar keyword: "bpt example.com" ---------- */

chrome.omnibox.setDefaultSuggestion({ description: chrome.i18n.getMessage('omniboxDefault') });

chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  const parsed = parsePreviewUrl(text);
  const target = viewerUrl(parsed.ok ? { url: parsed.url.href } : { input: text });
  if (disposition === 'currentTab') void chrome.tabs.update({ url: target });
  else void chrome.tabs.create({ url: target, active: disposition === 'newForegroundTab' });
});

/* ---------- Embedding rules: keep them scoped to open viewer tabs ---------- */

async function viewerIsOpenIn(tabId: number): Promise<boolean> {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['TAB'], tabIds: [tabId] });
  return contexts.some((context) => context.documentUrl?.startsWith(VIEWER_PAGE));
}

/**
 * The viewer removes its rule on pagehide; this is the safety net for tabs
 * that close or navigate away without that running (crash, discard, typed URL).
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  void disableEmbeddingForTab(tabId).catch(() => {});
  void unregisterAgentIfNoWorkspace();
});

const workspaceOpen = async () => {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['TAB'] }).catch(() => []);
  return contexts.some((context) => context.documentUrl?.startsWith(VIEWER_PAGE));
};

/** The frame agent only stays registered while a workspace tab is open. */
async function unregisterAgentIfNoWorkspace(): Promise<void> {
  if (!(await agentRegistered()) || (await workspaceOpen())) return;
  await unregisterAgent();
  // A workspace that opened meanwhile found the agent still registered: put it back.
  if (await workspaceOpen()) await ensureAgentRegistered();
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;
  void (async () => {
    const ruled = await tabsWithEmbedding();
    if (ruled.includes(tabId) && !(await viewerIsOpenIn(tabId))) await disableEmbeddingForTab(tabId);
    // Also when the last workspace tab went to another page (it removed its own rule on the way out).
    await unregisterAgentIfNoWorkspace();
  })().catch(() => {});
});

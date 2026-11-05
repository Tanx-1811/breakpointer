import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';
import { loadSettings } from '../services/storage';
import { hasNews, readSeenVersion } from '../services/whats-new';
import { isRestrictedHost, toSafeHref } from '../utils/url';
import { PopupApp } from './Popup';

async function bootstrap() {
  const [settings, tabs, commands, seen] = await Promise.all([
    loadSettings(),
    // Opening the popup grants activeTab, which makes the tab's URL readable.
    chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []),
    chrome.commands.getAll().catch(() => []),
    readSeenVersion(),
  ]);
  const version = chrome.runtime.getManifest().version;
  const href = toSafeHref(tabs[0]?.url);
  const tabUrl = href ? new URL(href) : null;
  const inWorkspace = Boolean(tabs[0]?.url?.startsWith(chrome.runtime.getURL('viewer/')));
  const shortcut = commands.find((command) => command.name === '_execute_action')?.shortcut ?? '';
  const previewShortcut = commands.find((command) => command.name === 'preview-current-page')?.shortcut ?? '';

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <PopupApp
        settings={settings}
        tabUrl={tabUrl && !isRestrictedHost(tabUrl) ? tabUrl : null}
        restricted={Boolean(tabUrl && isRestrictedHost(tabUrl))}
        inWorkspace={inWorkspace}
        shortcut={shortcut}
        previewShortcut={previewShortcut}
        windowId={tabs[0]?.windowId}
        version={version}
        // Chrome installed an update silently; until its news are seen, the popup says so.
        news={hasNews(seen, version)}
      />
    </StrictMode>,
  );
}

void bootstrap();

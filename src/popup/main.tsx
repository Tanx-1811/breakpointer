import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';
import { loadSettings } from '../services/storage';
import { toSafeHref } from '../utils/url';
import { PopupApp } from './Popup';

async function bootstrap() {
  const [settings, tabs, commands] = await Promise.all([
    loadSettings(),
    // Opening the popup grants activeTab, which makes the tab's URL readable.
    chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []),
    chrome.commands.getAll().catch(() => []),
  ]);
  const href = toSafeHref(tabs[0]?.url);
  const shortcut = commands.find((command) => command.name === '_execute_action')?.shortcut ?? '';

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <PopupApp settings={settings} tabUrl={href ? new URL(href) : null} shortcut={shortcut} />
    </StrictMode>,
  );
}

void bootstrap();

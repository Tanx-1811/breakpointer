import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';
import type { MessageKey } from '../i18n/en';
import { createTranslator, resolveLanguage } from '../i18n/translate';
import { ensureAgentRegistered } from '../services/frame-agents';
import { createIframePreviewAdapter } from '../services/preview-adapter';
import { parseSettings, readStoredSettings, saveSettings } from '../services/storage';
import { findGroupTemplates } from '../state/groups';
import { fromTemplates } from '../state/viewports';
import { parsePreviewUrl, toSafeHref, type UrlParseError } from '../utils/url';
import { ViewerApp } from './Viewer';

async function bootstrap() {
  const adapter = createIframePreviewAdapter();
  // Install the tab's embedding rule and the frame agent before any preview frame starts loading.
  const ready = Promise.all([adapter.start(), ensureAgentRegistered()]);

  let readFailed = false;
  const stored = await readStoredSettings().catch(() => {
    readFailed = true;
    return undefined;
  });
  const language = resolveLanguage(parseSettings(stored).language);
  const t = createTranslator(language);
  let settings = parseSettings(stored, (id) => t(`preset.${id}` as MessageKey));

  // Apply the theme before the first paint to avoid a flash.
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme =
    settings.theme === 'system' ? (prefersDark ? 'dark' : 'light') : settings.theme;
  document.documentElement.lang = language;

  const params = new URLSearchParams(location.search);

  // ?group= applies a group once (from the popup), then is dropped from the URL.
  const groupId = params.get('group');
  let fitGroup = false;
  if (groupId) {
    const group = findGroupTemplates(groupId, settings.groups, t);
    if (group) {
      settings = { ...settings, viewports: fromTemplates(group.viewports) };
      // Built-in groups are fitted to this screen, like when applied in the workspace.
      fitGroup = groupId.startsWith('builtin:');
      await saveSettings(settings).catch(() => {});
    }
    params.delete('group');
    history.replaceState(null, '', params.size ? `?${params}` : location.pathname);
  }

  // First run: keep the defaults (in the user's language), so every tab starts from the same workspace.
  if (stored === undefined && !readFailed && !groupId) await saveSettings(settings).catch(() => {});

  let initialUrl: URL | null = null;
  let initialInput = '';
  let initialError: UrlParseError | null = null;
  const urlParam = toSafeHref(params.get('url'));
  const inputParam = params.get('input');
  if (urlParam) {
    initialUrl = new URL(urlParam);
  } else if (inputParam) {
    const result = parsePreviewUrl(inputParam);
    if (result.ok) initialUrl = result.url;
    else {
      initialInput = inputParam;
      initialError = result.error;
    }
  } else if (settings.activeUrl) {
    initialUrl = new URL(settings.activeUrl);
  }

  await ready;
  // Known before the first render, so no message from a preview frame is missed.
  const tab = await chrome.tabs.getCurrent().catch(() => undefined);
  window.addEventListener('pagehide', () => void adapter.stop());
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) void Promise.all([adapter.start(), ensureAgentRegistered()]);
  });

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ViewerApp
        initialSettings={settings}
        initialUrl={initialUrl}
        initialInput={initialInput}
        initialError={initialError}
        adapter={adapter}
        tabId={tab?.id ?? null}
        version={chrome.runtime.getManifest().version}
        autoFit={fitGroup ? 'now' : stored === undefined ? 'afterFirstPage' : 'none'}
      />
    </StrictMode>,
  );
}

void bootstrap();

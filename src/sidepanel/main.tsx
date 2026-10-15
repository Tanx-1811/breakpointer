import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';
import { enableEmbeddingForExtensionFrames } from '../services/embed-rules';
import { loadSettings } from '../services/storage';
import { toSafeHref } from '../utils/url';
import { SidePanelApp, activeTabUrl } from './SidePanel';

async function bootstrap() {
  const settings = await loadSettings();
  // A page sent here from the popup or the context menu, else the active tab's.
  const initialUrl = toSafeHref(new URLSearchParams(location.search).get('url')) ?? (await activeTabUrl());
  // The panel's frames aren't in a tab: they get the rule for Breakpointer's own frames.
  await enableEmbeddingForExtensionFrames().catch(() => {});
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <SidePanelApp settings={settings} initialUrl={initialUrl ?? null} />
    </StrictMode>,
  );
}

void bootstrap();

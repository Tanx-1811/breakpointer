/**
 * Frame-blocking headers removed from preview responses. Both only matter when
 * a page is shown inside a frame: X-Frame-Options, and CSP `frame-ancestors`
 * (DNR can't edit a single CSP directive, so the whole header is removed for
 * these preview frames only).
 */
const FRAME_BLOCKING_HEADERS = ['x-frame-options', 'content-security-policy'];

/**
 * Some sites read the browser's Fetch Metadata and refuse to be loaded as a
 * frame: a request with `Sec-Fetch-Dest: iframe` gets an error page (Facebook
 * answers "Sorry, something went wrong" with HTTP 400; Instagram says the
 * profile isn't available). Preview frames say they are a document, as when the
 * page is opened in a tab. `Sec-Fetch-Site` is left as it is.
 */
const FRAME_REQUEST_HEADERS: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [
  { header: 'sec-fetch-dest', operation: 'set', value: 'document' },
];

/**
 * A session rule scoped to one viewer tab and to sub-frame documents only.
 * With `declarativeNetRequestWithHostAccess` it applies only to sites the user
 * has granted host access to, so it is inert until they opt in. The tab id is
 * reused as the rule id, which keeps one rule per viewer tab.
 */
export function embedRuleForTab(tabId: number): chrome.declarativeNetRequest.Rule {
  return {
    id: tabId,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: FRAME_REQUEST_HEADERS,
      responseHeaders: FRAME_BLOCKING_HEADERS.map((header) => ({ header, operation: 'remove' })),
    },
    condition: {
      tabIds: [tabId],
      resourceTypes: ['sub_frame'],
    },
  };
}

/**
 * The rule for preview frames outside a workspace tab — the floating preview
 * (Document Picture-in-Picture) and the side panel — which Chrome doesn't tie
 * to the workspace's tab. It matches frames that Breakpointer's own pages load
 * (their initiator is this extension), on sites the user allowed. A fixed id,
 * far above any tab id.
 */
export const EXTENSION_FRAMES_RULE_ID = 2_000_000_001;

export function embedRuleForExtensionFrames(extensionId: string): chrome.declarativeNetRequest.Rule {
  const { action } = embedRuleForTab(0);
  return {
    id: EXTENSION_FRAMES_RULE_ID,
    priority: 1,
    action,
    condition: { initiatorDomains: [extensionId], resourceTypes: ['sub_frame'] },
  };
}

export async function enableEmbeddingForExtensionFrames(): Promise<void> {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [EXTENSION_FRAMES_RULE_ID],
    addRules: [embedRuleForExtensionFrames(chrome.runtime.id)],
  });
}

export async function enableEmbeddingForTab(tabId: number): Promise<void> {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [tabId],
    addRules: [embedRuleForTab(tabId)],
  });
}

export async function disableEmbeddingForTab(tabId: number): Promise<void> {
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] });
}

export async function tabsWithEmbedding(): Promise<number[]> {
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  return rules.map((rule) => rule.id).filter((id) => id !== EXTENSION_FRAMES_RULE_ID);
}

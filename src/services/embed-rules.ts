/**
 * Frame-blocking headers removed from preview responses. Both only matter when
 * a page is shown inside a frame: X-Frame-Options, and CSP `frame-ancestors`
 * (DNR can't edit a single CSP directive, so the whole header is removed for
 * these preview frames only).
 */
const FRAME_BLOCKING_HEADERS = ['x-frame-options', 'content-security-policy'];

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
      responseHeaders: FRAME_BLOCKING_HEADERS.map((header) => ({ header, operation: 'remove' })),
    },
    condition: {
      tabIds: [tabId],
      resourceTypes: ['sub_frame'],
    },
  };
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
  return rules.map((rule) => rule.id);
}

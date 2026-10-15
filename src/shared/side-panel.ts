/** The side panel's page, showing `url` when given. */
export function sidePanelPath(url?: string): string {
  return url ? `sidepanel/sidepanel.html?${new URLSearchParams({ url })}` : 'sidepanel/sidepanel.html';
}

/**
 * Opens Breakpointer's side panel in a window, showing `url`. Must be called
 * straight from a user action (a click or a menu item): Chrome only opens side
 * panels then, so nothing is awaited before `open`.
 */
export function openSidePanel(windowId: number, url?: string): Promise<void> {
  void chrome.sidePanel.setOptions({ path: sidePanelPath(url), enabled: true });
  return chrome.sidePanel.open({ windowId });
}

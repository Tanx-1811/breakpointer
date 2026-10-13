import pkg from '../package.json' with { type: 'json' };

/**
 * Builds manifest.json at build time so the version always matches package.json.
 *
 * Permissions are deliberately minimal; none of them shows a warning at install
 * (see docs/PRIVACY.md and docs/STORE_LISTING.md for the justifications):
 * - storage: saves viewports, groups and preferences locally.
 * - activeTab: reads the current tab's URL only when the user invokes Breakpointer.
 * - contextMenus: "Preview in Breakpointer" on pages and links.
 * - declarativeNetRequestWithHostAccess: lets previews of sites the user has
 *   explicitly allowed ignore frame-blocking headers, inside the viewer tab only.
 * Host access is optional and requested at runtime, per site or for all sites.
 */
export function createManifest(mode: string): chrome.runtime.ManifestV3 {
  const manifest: chrome.runtime.ManifestV3 = {
    manifest_version: 3,
    name: '__MSG_extName__',
    short_name: 'Breakpointer',
    version: pkg.version,
    description: '__MSG_extDescription__',
    default_locale: 'en',
    minimum_chrome_version: '116',
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    action: {
      default_title: '__MSG_actionTitle__',
      default_popup: 'popup/popup.html',
      default_icon: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
      },
    },
    background: {
      service_worker: 'service-worker.js',
      type: 'module',
    },
    permissions: ['storage', 'activeTab', 'contextMenus', 'declarativeNetRequestWithHostAccess', 'scripting'],
    optional_host_permissions: ['<all_urls>'],
    // Kept unusual on purpose: a common word would hijack ordinary searches (e.g. "vp bank").
    omnibox: { keyword: 'bpt' },
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+V' },
        description: '__MSG_commandOpen__',
      },
      'preview-current-page': {
        suggested_key: { default: 'Alt+Shift+P' },
        description: '__MSG_commandPreview__',
      },
    },
  };

  // The e2e build is granted host access up front, because automated tests
  // cannot click Chrome's permission prompt. Production never requests it at install.
  if (mode === 'e2e') {
    manifest.host_permissions = ['<all_urls>'];
  }

  return manifest;
}

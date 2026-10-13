# Architecture

This document records how Breakpointer renders previews, why, and how the pieces fit together. Start here before changing the preview mechanism, permissions or storage.

## ADR-001: How a page is rendered at a viewport size

**Status:** accepted (Milestone 1 spike, verified by `tests/e2e/spike.spec.ts`).

### Context

The product must show one website at several viewport sizes at once, inside Chrome, with real layout. CSS-scaling a page or showing a screenshot is not enough: the page's layout engine has to see the requested width and height, so that media queries, container queries and `window.innerWidth` behave as they would in a window of that size.

### Options considered

| Option                                          | Real layout viewport | Several at once           | Works on every site                                            | Verdict                                                                        |
| ----------------------------------------------- | -------------------- | ------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| A. `<iframe>` per viewport in an extension page | Yes                  | Yes                       | No: `X-Frame-Options` / CSP `frame-ancestors` block many sites | **Chosen**, with an opt-in fix and fallbacks                                   |
| B. Separate tabs or windows                     | Yes                  | Awkward, not side by side | Yes                                                            | Used as the **fallback** (new tab, exact-size window)                          |
| C. DevTools device emulation                    | Yes                  | One at a time             | Yes                                                            | Rejected: not controllable through supported extension APIs without `debugger` |

### Decision

1. Each viewport is an `<iframe>` whose element is exactly `width × height` CSS pixels. Zoom is a CSS `transform: scale()` on that element, so it scales the finished rendering without changing the layout viewport.
2. Sites that refuse framing are made previewable **only if the user allows it**, per site or for all sites, through Chrome's optional host permissions. With access granted, a `declarativeNetRequest` **session rule** removes `X-Frame-Options` and `Content-Security-Policy` from **sub-frame responses in the viewer tab only** (see [Embedding rule](#embedding-rule)).
3. Without access, the viewer explains the likely cause and offers fallbacks: allow the site, open it in a new tab, or open it in a real window sized to the viewport.
4. The rendering mechanism sits behind `PreviewAdapter` (`src/services/preview-adapter.ts`) and the `PreviewFrame` component, so it can be replaced without touching the rest of the UI.

### Spike results

Run against a local test server in Chromium with the extension loaded (`npm run test:e2e`):

| Page                   | Header                        | Without site access                                          | With site access          |
| ---------------------- | ----------------------------- | ------------------------------------------------------------ | ------------------------- |
| `/responsive`, `/demo` | none                          | Renders; `innerWidth` = viewport width; media queries switch | Same                      |
| `/xfo-deny`            | `X-Frame-Options: DENY`       | Blocked (`chrome-error://` frame)                            | Renders at the real width |
| `/csp-frame-ancestors` | `CSP: frame-ancestors 'none'` | Blocked                                                      | Renders at the real width |
| `/framebust`           | script sets `top.location`    | Renders; the workspace is **not** replaced                   | Same                      |

Notes from the spike:

- Cross-origin frames are out-of-process; their size arrives asynchronously, so a page script that reads `innerWidth` during parsing can see `0` before the first layout. This doesn't affect real layout and is why tests poll.
- Chrome fires `load` on the iframe even when it refuses to frame a page and gives the embedder no reliable signal. The viewer therefore can't detect a block without host access; it shows the explanation whenever the current site isn't allowed.
- `chrome.tabs.captureVisibleTab` requires `<all_urls>` (or `activeTab`). Screenshots therefore ask for "all sites" access, after explaining why.
- `chrome.windows.create` sizes include the window frame. The adapter measures the tab's content size (`Tab.width/height`) and corrects the window until the content area matches, reporting when the screen limits it (verified headed on macOS: 375×667 and 1366×768 exact).

### Consequences

- Limitations are stated in the UI and the store listing: some sites still won't render without access; sign-in and third-party cookies can behave differently in frames; previews don't emulate a device's user agent, pixel ratio, touch input or engine.
- Removing the whole CSP header (DNR can't edit one directive) weakens that page's own CSP **inside the preview only**. This is limited to sites the user allowed, to sub-frames, and to the viewer tab.

## Embedding rule

`src/services/embed-rules.ts`

```ts
{
  id: <viewer tab id>,
  action: { type: 'modifyHeaders', responseHeaders: [
    { header: 'x-frame-options', operation: 'remove' },
    { header: 'content-security-policy', operation: 'remove' },
  ] },
  condition: { tabIds: [<viewer tab id>], resourceTypes: ['sub_frame'] },
}
```

- The permission is `declarativeNetRequestWithHostAccess`: rules only act on hosts the user granted, so the rule is inert until they opt in. It has no install-time warning.
- Session rules disappear when Chrome restarts. The viewer installs its rule before any frame loads and removes it on `pagehide`. The service worker also removes it when the tab closes, or when the tab finishes loading something other than the viewer (checked with `chrome.runtime.getContexts`).
- Previews are sandboxed (`allow-scripts allow-same-origin allow-forms allow-popups …`, **no** `allow-top-navigation`), which defeats frame-busting scripts.

## Modules

```
src/
  manifest.ts              Manifest generated at build time (version from package.json)
  background/              Service worker: context menus, omnibox "bpt", commands,
                           first-run welcome, embedding-rule cleanup
  popup/                   Toolbar popup: preview current tab, pick a group, recent addresses
  viewer/                  The workspace page (Viewer.tsx composes everything)
  components/              UI building blocks (cards, dialogs, menu, toast, …)
  hooks/                   Settings persistence, theme, site access, shortcuts
  services/
    preview-adapter.ts     Rendering mechanism boundary (iframe adapter)
    embed-rules.ts         DNR session rule for the viewer tab
    site-access.ts         Optional host permissions
    screenshot.ts          captureVisibleTab + crop to an element
    storage.ts             Settings validation, load/save, export/import
  state/                   Pure, unit-tested state logic (viewports, groups, fit, reducer)
  data/                    Presets, built-in groups, framework breakpoints
  i18n/                    English (source of truth) and Vietnamese UI strings
  shared/viewer-url.ts     Builds viewer URLs (used by popup and service worker)
```

Data flows one way: `Viewer` owns the settings via `useReducer` (`state/settings-reducer.ts`); every change is debounced to `chrome.storage.local` (and flushed on `pagehide`). Components receive data and callbacks; they never touch storage or Chrome APIs directly, except through services.

## Settings and storage

- One key, `breakpointer.settings`, in `chrome.storage.local`. Shape: `BreakpointerSettings` in `src/types/index.ts` (`version: 1`).
- Everything read from storage or an imported file goes through `parseSettings`, which validates each field independently, clamps numbers, drops invalid entries, de-duplicates ids, caps list sizes and falls back to defaults. Unknown or older versions are read leniently.
- Recent addresses are stored only when the user turns on "Remember recent addresses" (off by default) and are cleared when it is turned off. Exports never include recent or last addresses.
- Two open workspace tabs each keep their own state; the last change saved wins.

## Fitting viewports to the screen

`state/fit.ts` finds the largest single zoom (≤ 100%) at which all visible cards fit in the workspace, simulating `flex-wrap` (or a single row) with the measured card chrome, minimum card width and gaps, by binary search over whole percents. One zoom for all keeps sizes comparable.

## Internationalisation

`src/i18n/en.ts` is the source of truth for keys; `vi.ts` is typed as `Record<MessageKey, string>`, so a missing translation is a compile error, and a unit test checks placeholders match. The manifest, context menus and omnibox use `_locales/{en,vi}/messages.json` (they follow Chrome's language); the UI follows the in-app language setting (default: same as Chrome).

## Testing

- Unit (Vitest + Testing Library, jsdom): state logic, storage validation, i18n completeness, components.
- End-to-end (Playwright, Chromium with the extension loaded): two builds — `dist-e2e` (host access granted up front, since tests can't click Chrome's permission prompt) and `dist` (production, no access) — plus axe accessibility checks in light and dark themes.
- `npm run screenshots` regenerates the store screenshots from the real UI.

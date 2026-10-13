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

Run against a local test server in Chrome for Testing (Playwright's bundled browser) with the extension loaded (`npm run test:e2e`):

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
- Previews are sandboxed (`allow-scripts allow-same-origin allow-forms allow-popups … allow-storage-access-by-user-activation`, **no** `allow-top-navigation`). Chrome already blocks cross-origin frames from navigating the top window without a user click; the sandbox also stops user-clicked `target=_top` links from replacing the workspace. Trade-off: a few sites log errors (e.g. assigning `document.domain`).
- Site access is requested for the registrable domain (`*://*.example.com/*`, `*://*.dantri.com.vn/*` — a small list of multi-part suffixes in `utils/url.ts`), so redirects between subdomains stay covered.

## Reachability check

Without host access an extension page can't tell "down" from "up but restricted": a `no-cors` request also fails for sites that send `Cross-Origin-Resource-Policy` (x.com, stackoverflow.com). So `PreviewAdapter.probe` only runs with access to the site, using a CORS-exempt `GET` (any HTTP status = reachable; DNS/TLS/connection failure = unreachable; timeout = unknown), and the result only adds a banner — previews are never hidden, since each frame shows Chrome's own error page anyway.

## Preview cards

- Moving an `<iframe>` in the DOM makes the browser reload it, so cards keep a stable DOM order (`hooks/useStableDomOrder.ts`) and get their visual position from CSS `order`. After reordering, keyboard tab order follows the original order until the workspace reloads.
- "Navigated away · Back" shows when a preview no longer shows the workspace's page. With an agent, the workspace knows (see ADR-002 §5); without one, a second `load` event on the frame is taken to mean the page navigated.
- The loading indicator never covers the frame: real pages paint long before `load`.
- The column grid (`components/GridOverlay`) is drawn over the frame, scaled with the zoom, and never takes the pointer.

## ADR-002: Code inside preview frames (the frame agent)

**Status:** accepted for v0.2 (verified by `tests/e2e/tools.spec.ts` and `no-access.spec.ts`).

**Context.** Synced scrolling and navigation, responsive checks, highlights, outlines and live CSS need code running inside the previewed page. Previews are cross-origin frames inside an extension page.

**Spike findings.** `chrome.scripting.executeScript` with `allFrames` fails ("Cannot access contents of the page") because the tab's top document is an extension page; `chrome.runtime.getFrameId` isn't available to extension pages. A content script registered with `chrome.scripting.registerContentScripts` (`allFrames: true`) **is** injected into the preview frames of sites the extension has host access to, and the workspace can reach each one with `chrome.tabs.sendMessage(tabId, message, { frameId })`.

**Decision.**

1. `src/agent/frame-agent.ts` is bundled as a standalone script (`frame-agent.js`, ~11 KB, no runtime imports). The workspace registers it (`id: breakpointer-agent`, `<all_urls>`, `allFrames`, `document_start`, not persisted across sessions) when it opens; the service worker unregisters it when no workspace tab is left (checked when a tab closes or finishes loading, and at browser start), re-registering it if a workspace opened meanwhile.
2. Chrome injects it only where the user granted host access. It returns immediately unless it is in a frame **directly inside** a Breakpointer workspace (`window.parent === window.top` and `location.ancestorOrigins[0]` is this extension's origin), so normal tabs of allowed sites are unaffected.
3. Each preview iframe is named `bp:<card id>:<generation>`; the generation is a hash of its address and reload counters. The agent reads `window.name` at `document_start`, before the page's scripts can change it, and reports it with every message, so the workspace (`hooks/useFrameAgents.ts`) knows which card a message belongs to and ignores messages from frames that were replaced. A page that renames its window keeps the name in later pages; those messages are matched by Chrome's frame id, which doesn't change while the frame lives. A hello from a different frame id (the card was hidden and shown again) starts afresh. Messages are accepted only from this extension, from the workspace's own tab. Viewport ids are restricted to `[A-Za-z0-9_-]` when settings are read, so they are safe in frame names and selectors.
4. Protocol (`src/agent/protocol.ts`). Agent → workspace: `hello` (address, title), `location` (address changes within the page, polled every 500 ms because the isolated world can't hook `history`), `input` (the user clicked or typed — nothing about what or where; at most once a second), `scroll` (ratio), `zoom` (Ctrl + wheel over the page), `checks` (report), `bye` (page unloading). Workspace → agent: `ping` (say hello again), `scrollTo`, `outlines`, `css`, `highlight`, `checks` (on/off). A new frame gets the current tool state when it says hello.
5. **Synced navigation** follows only what the user did: a new page or address in a card within 10 s of a click or key press in that card. The others then load the new address, and the card that navigated keeps its frame (its `src` is pinned until the next address change, or until it is hidden), so nothing reloads twice. Not followed, and the card is flagged "Navigated away · Back" instead: redirects a page makes by itself (e.g. sending narrow screens to `/m/`, which would otherwise make previews bounce between two pages), and one-time addresses (`?code=`, `token`, `signature`… — loading a sign-in callback several times can make the provider revoke the sign-in). Changes of only the `#fragment` are ignored (scroll-spy pages update it while scrolling), and so are address changes the page makes without user input (e.g. removing tracking parameters). A followed address becomes the workspace's address, exactly as if the user had typed it (it is remembered as the last address, and in recent addresses when that is on).
6. **Zoom**: Ctrl + wheel (or a pinch) over a preview would zoom the whole workspace tab in Chrome; the agent forwards it to the workspace instead, unless the page handles that gesture itself (`defaultPrevented`, e.g. maps). Over previews of sites without access, Chrome's own zoom still applies.
7. **Checks** run in the page at most every 2 s (throttled, after resize, load or DOM changes), scan at most 4 000 elements and report up to 8 samples per issue as short CSS-like descriptions (`div.hero > img`) plus sizes. Overflow reports the outermost elements wider than the viewport, skipping fixed and clipped ones and pages that hide horizontal overflow. The viewport tag, text size (< 12 px, like Lighthouse's legible-text audit) and touch targets (< 24 × 24 px, WCAG 2.5.8 with its inline and spacing exceptions) only apply up to 1024 px. Visually hidden elements (1 × 1 px skip links, 0 px text) are ignored.

**Consequences.** One new permission, `scripting`, with no install warning; no new host access. The agent never sends page text or form data: only the address, title, scroll ratio, the fact that the user clicked or typed, and the check results described above, and only to the workspace tab. Live CSS and outlines are user-supplied styles injected as `<style>` elements and removed when switched off. Sites without access keep working as before; the Tools menu explains how to enable the in-frame tools.

## Reports

`state/report.ts` builds a self-contained HTML file (inline styles, no scripts; every text value escaped; images accepted only as `data:image/…;base64` URLs). The workspace captures each visible preview with `captureVisibleTab` (at most two captures per second, as Chrome allows), crops it to the card and embeds it as JPEG, alongside that preview's checks.

## Modules

```
src/
  manifest.ts              Manifest generated at build time (version from package.json)
  background/              Service worker: context menus, omnibox "bpt", commands,
                           first-run welcome, embedding-rule cleanup
  popup/                   Toolbar popup: preview current tab, pick a group, recent addresses
  viewer/                  The workspace page (Viewer.tsx composes everything)
  components/              UI building blocks (cards, dialogs, menu, toast, …)
  agent/                   Frame agent (content script) and its message protocol
  hooks/                   Settings persistence, theme, site access, shortcuts, frame agents
  services/
    preview-adapter.ts     Rendering mechanism boundary (iframe adapter)
    embed-rules.ts         DNR session rule for the viewer tab
    site-access.ts         Optional host permissions
    screenshot.ts          captureVisibleTab + crop to an element
    frame-agents.ts        Register/unregister the agent; messages to and from it
    storage.ts             Settings validation, load/save, export/import
  state/                   Pure, unit-tested state logic (viewports, groups, fit, reducer,
                           breakpoint validation, check texts, report HTML)
  data/                    Presets, built-in groups, framework breakpoints
  i18n/                    English (source of truth) and Vietnamese UI strings
  shared/viewer-url.ts     Builds viewer URLs (used by popup and service worker)
```

Data flows one way: `Viewer` owns the settings via `useReducer` (`state/settings-reducer.ts`); every change is debounced to `chrome.storage.local` (and flushed on `pagehide`). Components receive data and callbacks; they never touch storage or Chrome APIs directly, except through services.

## Settings and storage

- One key, `breakpointer.settings`, in `chrome.storage.local`. Shape: `BreakpointerSettings` in `src/types/index.ts` (`version: 1`).
- Everything read from storage or an imported file goes through `parseSettings`, which validates each field independently, clamps numbers, drops invalid entries, de-duplicates ids, caps list sizes and falls back to defaults. Unknown or older versions are read leniently.
- Recent addresses are stored only when the user turns on "Remember recent addresses" (off by default) and are cleared when it is turned off. Exports never include recent or last addresses; saved pages (starred by the user) are included.
- v0.2 added `customBreakpoints`, `grid`, `sync`, `checks` and `savedPages`; older stored data simply gets their defaults. Importing a file only replaces the settings the file contains, so an older export keeps the newer settings as they are.
- Two open workspace tabs each keep their own state; the last change saved wins.

## Fitting viewports to the screen

`state/fit.ts` finds the largest single zoom (≤ 100%) at which all visible cards fit in the workspace, simulating `flex-wrap` (or a single row) with the measured card chrome, minimum card width and gaps, by binary search over whole percents. One zoom for all keeps sizes comparable.

## Internationalisation

`src/i18n/en.ts` is the source of truth for keys; `vi.ts` is typed as `Record<MessageKey, string>`, so a missing translation is a compile error, and a unit test checks placeholders match. The manifest, context menus and omnibox use `_locales/{en,vi}/messages.json` (they follow Chrome's language); the UI follows the in-app language setting (default: same as Chrome).

## Testing

- Unit (Vitest + Testing Library, jsdom): state logic, storage validation, i18n completeness, components.
- End-to-end (Playwright, Chrome for Testing with the extension loaded): two builds — `dist-e2e` (host access granted up front, since tests can't click Chrome's permission prompt) and `dist` (production, no access) — plus axe accessibility checks in light and dark themes.
- `npm run screenshots` regenerates the store screenshots from the real UI.

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
  action: { type: 'modifyHeaders',
    requestHeaders: [{ header: 'sec-fetch-dest', operation: 'set', value: 'document' }],
    responseHeaders: [
      { header: 'x-frame-options', operation: 'remove' },
      { header: 'content-security-policy', operation: 'remove' },
    ],
  },
  condition: { tabIds: [<viewer tab id>], resourceTypes: ['sub_frame'] },
}
```

- The permission is `declarativeNetRequestWithHostAccess`: rules only act on hosts the user granted, so the rule is inert until they opt in. It has no install-time warning.
- Session rules disappear when Chrome restarts. The viewer installs its rule before any frame loads and removes it on `pagehide`. The service worker also removes it when the tab closes, or when the tab finishes loading something other than the viewer (checked with `chrome.runtime.getContexts`).
- Previews are sandboxed (`allow-scripts allow-same-origin allow-forms allow-popups … allow-storage-access-by-user-activation`, **no** `allow-top-navigation`). Chrome already blocks cross-origin frames from navigating the top window without a user click; the sandbox also stops user-clicked `target=_top` links from replacing the workspace. Trade-off: a few sites log errors (e.g. assigning `document.domain`).
- Site access is requested for the registrable domain (`*://*.example.com/*`, `*://*.dantri.com.vn/*` — a small list of multi-part suffixes in `utils/url.ts`), so redirects between subdomains stay covered.
- **Fetch Metadata.** Some sites don't send frame-blocking headers but refuse any request that says it is for a frame (`Sec-Fetch-Dest: iframe`): Facebook answers with its "Sorry, something went wrong" page (HTTP 400), Instagram says the profile isn't available. The rule sets `Sec-Fetch-Dest: document` on preview requests, as when the page is opened in a tab (checked against 16 popular sites: it fixes Facebook, Instagram and Threads and changes nothing for the others). `Sec-Fetch-Site` stays `cross-site` for the first load. Like the header removal, it only acts on allowed sites, in the viewer tab.
- **Signed-in sites.** With access to a site, Chrome sends all its cookies — `SameSite=Lax` and `Strict` too — with the preview's own load and with every request the page makes afterwards (its API calls, links, forms), and the frame shares the site's `localStorage` and IndexedDB with your tabs, so you stay signed in. Without access, only `SameSite=None` cookies are sent. Two limits remain: the page's scripts can't read `SameSite=Lax`/`Strict` cookies through `document.cookie` (apps that copy a CSRF token from such a cookie into their requests may fail), and `sessionStorage` starts empty, as in a new tab. Sign-in pages of identity providers usually refuse frames; sign in in a tab first. Verified by `tests/e2e/sign-in.spec.ts`.

- **Frames outside the workspace tab.** Chrome doesn't tie the frames of the floating preview (Document Picture-in-Picture) or of the side panel to the workspace's tab, so the tab-scoped rule can't reach them (checked: neither the workspace's tab id nor "no tab" matches them). A second session rule (`embedRuleForExtensionFrames`, a fixed id far above any tab id) has the same action and matches sub-frame requests whose initiator is this extension (`initiatorDomains: [extension id]`): only frames Breakpointer's own pages load, on allowed sites. Links followed inside those frames are initiated by the site and aren't covered; the floating preview and the side panel follow the workspace's or the tab's address instead.

## Reachability check

Without host access an extension page can't tell "down" from "up but restricted": a `no-cors` request also fails for sites that send `Cross-Origin-Resource-Policy` (x.com, stackoverflow.com). So `PreviewAdapter.probe` only runs with access to the site, using a CORS-exempt `GET` (any HTTP status = reachable; DNS/TLS/connection failure = unreachable; timeout = unknown), and the result only adds a banner — previews are never hidden, since each frame shows Chrome's own error page anyway.

## Preview cards

- Moving an `<iframe>` in the DOM makes the browser reload it, so cards keep a stable DOM order (`hooks/useStableDomOrder.ts`) and get their visual position from CSS `order`. After reordering, keyboard tab order follows the original order until the workspace reloads.
- "Navigated away · Back" shows when a preview no longer shows the workspace's page. With an agent, the workspace knows (see ADR-002 §5); without one, a second `load` event on the frame is taken to mean the page navigated.
- The loading indicator never covers the frame: real pages paint long before `load`.
- The column grid (`components/GridOverlay`) is drawn over the frame, scaled with the zoom, and never takes the pointer.

## Input to preview frames

Chrome sometimes keeps stale hit-test data for cross-origin frames. This can happen when a frame moves or changes size just as its page finishes loading. Chrome then delivers clicks, wheel turns and pointer moves over every preview to the workspace, aimed at the `<iframe>` element, instead of to the page inside. The state lasts until a frame moves again. In stress runs, the old first-run flow left the previews dead about 2–6% of the time: the frames loaded at the default zoom and the fit resized them right afterwards.

- The previews start loading only after the first-run fit, at their final zoom (`Viewer.tsx`).
- The workspace otherwise never gets a press or a wheel turn aimed at a preview, and gets at most one stray pointer move as the pointer crosses a frame's edge. So a press, a wheel turn or three moves within 400 ms trigger a refresh (`state/stray-input.ts`, used by `PreviewFrame`). The refresh moves every frame by 0.01px for two animation frames and back, which makes Chrome rebuild the data. A pointer moving over a preview usually triggers it before the click, so at most that one stray input is lost.
- Don't draw a hit-testable layer over a frame, or clip it with rounded corners, without need. Chrome then asks the renderer about every event over that frame: slower, and the same stale data applies.

## ADR-002: Code inside preview frames (the frame agent)

**Status:** accepted for v0.2 (verified by `tests/e2e/tools.spec.ts` and `no-access.spec.ts`).

**Context.** Synced scrolling and navigation, responsive checks, highlights, outlines and live CSS need code running inside the previewed page. Previews are cross-origin frames inside an extension page.

**Spike findings.** `chrome.scripting.executeScript` with `allFrames` fails ("Cannot access contents of the page") because the tab's top document is an extension page; `chrome.runtime.getFrameId` isn't available to extension pages. A content script registered with `chrome.scripting.registerContentScripts` (`allFrames: true`) **is** injected into the preview frames of sites the extension has host access to, and the workspace can reach each one with `chrome.tabs.sendMessage(tabId, message, { frameId })`.

**Decision.**

1. `src/agent/frame-agent.ts` is bundled as a standalone script (`frame-agent.js`, ~11 KB, no runtime imports). The workspace registers it (`id: breakpointer-agent`, `<all_urls>`, `allFrames`, `document_start`, not persisted across sessions) when it opens; the service worker unregisters it when no workspace tab is left (checked when a tab closes or finishes loading, and at browser start), re-registering it if a workspace opened meanwhile.
2. Chrome injects it only where the user granted host access. It returns immediately unless it is in a frame **directly inside** a Breakpointer workspace (`window.parent === window.top` and `location.ancestorOrigins[0]` is this extension's origin), so normal tabs of allowed sites are unaffected.
3. Each preview iframe is named `bp:<card id>:<generation>`; the generation is a hash of its address and reload counters. The agent reads `window.name` at `document_start`, before the page's scripts can change it, and reports it with every message, so the workspace (`hooks/useFrameAgents.ts`) knows which card a message belongs to and ignores messages from frames that were replaced. A page that renames its window keeps the name in later pages; those messages are matched by Chrome's frame id, which doesn't change while the frame lives. A hello from a different frame id (the card was hidden and shown again) starts afresh. Messages are accepted only from this extension, from the workspace's own tab. Viewport ids are restricted to `[A-Za-z0-9_-]` when settings are read, so they are safe in frame names and selectors.
4. Protocol (`src/agent/protocol.ts`). Agent → workspace: `hello` (address, title, and the HTTP status the page was served with, from Navigation Timing — a card shows "HTTP 403" when a site refuses its preview), `location` (address changes within the page, polled every 500 ms because the isolated world can't hook `history`), `input` (the user clicked or typed — nothing about what or where; at most once a second), `scroll` (ratio, a content anchor — see [Synced scrolling](#synced-scrolling-by-content) — and the scroll position `y`; scrolls the workspace caused are reported, marked `synced`, only to frames asked to `trackScroll`), `zoom` (Ctrl + wheel over the page), `checks` (report), `media` (breakpoints found in the page's stylesheets), `pick` and `element` (the inspector), `key` (Escape pressed in the page while picking), `bye` (page unloading). Workspace → agent: `ping` (say hello again), `scrollTo`, `outlines`, `scrollbars`, `css`, `highlight`, `checks` (on/off), `colorScheme`, `inspect` (pick mode on/off), `select` (outline and report an element), `trackScroll` (also report synced scrolls, for a [design overlay](#measuring-and-design-overlays)), `stress`, `reducedMotion` and `animations` (see [Stress tests and page preferences](#stress-tests-and-page-preferences)). A new frame gets the current tool state when it says hello. Pure helpers the agent uses (media-query parsing, colour-scheme swapping, selectors) live in `src/agent/page-utils.ts` and are unit tested; the agent is still bundled as one classic script (~15 KB).
5. **Synced navigation** follows only what the user did: a new page or address in a card within 10 s of a click or key press in that card. The others then load the new address, and the card that navigated keeps its frame (its `src` is pinned until the next address change, or until it is hidden), so nothing reloads twice. Not followed, and the card is flagged "Navigated away · Back" instead: redirects a page makes by itself (e.g. sending narrow screens to `/m/`, which would otherwise make previews bounce between two pages), and one-time addresses (`?code=`, `token`, `signature`… — loading a sign-in callback several times can make the provider revoke the sign-in). Changes of only the `#fragment` are ignored (scroll-spy pages update it while scrolling), and so are address changes the page makes without user input (e.g. removing tracking parameters). A followed address becomes the workspace's address, exactly as if the user had typed it (it is remembered as the last address, and in recent addresses when that is on).
6. **Zoom**: Ctrl + wheel (or a pinch) over a preview would zoom the whole workspace tab in Chrome; the agent forwards it to the workspace instead, unless the page handles that gesture itself (`defaultPrevented`, e.g. maps). Over previews of sites without access, Chrome's own zoom still applies.
7. **Checks** run in the page at most every 2 s (throttled, after resize, load or DOM changes), scan at most 4 000 elements and report up to 8 samples per issue as short CSS-like descriptions (`div.hero > img`) plus sizes. Overflow reports the outermost elements wider than the viewport, skipping fixed and clipped ones and pages that hide horizontal overflow. The viewport tag, text size (< 12 px, like Lighthouse's legible-text audit) and touch targets (< 24 × 24 px, WCAG 2.5.8 with its inline and spacing exceptions) only apply up to 1024 px. Visually hidden elements (1 × 1 px skip links, 0 px text) are ignored. **Upscaled images** (every width): an image drawn at least 15% and 24 px wider than its `naturalWidth` — which already accounts for the density of the `srcset` candidate — taking `object-fit` into account; SVGs are skipped. **Fixed cover** (up to 1024 px): a 6 × 10 grid of `elementFromPoint` samples; a point is covered when its element sits inside a `position: fixed` element, or a sticky one stuck to the top or bottom edge; more than 35% covered is reported, with the outermost covering elements.

**Consequences.** One new permission, `scripting`, with no install warning; no new host access. The stress tests are the only tools that change a page's content, and only inside its preview (see below). The agent never sends page text or form data: only the address, title, scroll position (a ratio and structural selectors of the element at the reading line), the fact that the user clicked or typed, the check results described above, the widths used by the page's media queries, and — for an element the user picks in the inspector — its selector, short description and layout values (size, display, font, spacing), and only to the workspace tab. Live CSS and outlines are user-supplied styles injected as `<style>` elements and removed when switched off. Sites without access keep working as before; the Tools menu explains how to enable the in-frame tools.

## Reports

`state/report.ts` builds a self-contained HTML file (inline styles, no scripts; every text value escaped; images accepted only as `data:image/…;base64` URLs). The workspace captures each visible preview with `captureVisibleTab` (at most two captures per second, as Chrome allows), crops it to the card and embeds it as JPEG, alongside that preview's checks.

## Synced scrolling by content

Layouts differ by width, so the same scroll percentage shows different content. When a preview scrolls, its agent finds the element at a reading line (30% down the window, skipping fixed and sticky elements) and sends selectors for it and two ancestors, with where the line falls inside each. The others scroll so the first of those elements they can find sits at their own reading line; when none is found (or at the very top or bottom) they use the ratio. Programmatic scrolls are ignored for 150 ms so previews don't echo each other.

## Site breakpoints

`media` reports come from the agent (sites you allow). It walks the readable stylesheets — `document.styleSheets` and adopted sheets, `@import`ed sheets, nested grouping rules and `<link media>` — and turns each media query into the widths where it switches (`(max-width: 767.98px)` → 768, `(min-width: 48em)` → 768, range syntax too; print-only queries and `device-width` are ignored). The 12 most used widths are kept. Sheets from another origin without CORS can't be read and are counted. Breakpointer's own injected styles are skipped. The workspace treats them as the `site` breakpoint set (`data/breakpoints.ts`: "≥768", base "<640"), for labels, snapping, edges and Settings → "Use this site's".

## Page colours

A preview can show the page's light or dark styles whatever the browser prefers (`ViewportConfig.colorScheme`, saved). Chrome gives a frame the browser's `prefers-color-scheme` (an iframe's `color-scheme` doesn't change it — checked in Chrome 156), and changing it otherwise needs the `debugger` permission. So when the wanted scheme differs from the browser's, the agent swaps `prefers-color-scheme: dark` and `light` in the media lists of the page's readable stylesheets and in `<picture><source media>`, remembering the original text to restore it; if the page declares both schemes, it also sets `:root { color-scheme }` so form controls and `light-dark()` follow. Styles added later are handled when the stylesheets change. Limits (stated in the UI): themes chosen by script (`matchMedia`) and styles in unreadable cross-origin sheets don't follow.

## Stress tests and page preferences

The Simulate menu's in-page tools are session state in the workspace, sent to every agent and to each new frame on `hello`.

- **Longer text** (`stress.pseudo`): `pseudoLocalize` (`agent/page-utils.ts`, unit tested) accents letters, doubles vowels until the text is about 40% longer and wraps it in brackets (a missing `]` means the text was cut off). The agent walks the body's text nodes (at most 20 000 per pass) and `placeholder` attributes, skipping `script`, `style`, `code`, `pre`, `kbd`, `samp`, `var`, `textarea`, `template`, editable content and its own overlay, and keeps each node's original and translated text. The `MutationObserver` translates text the page adds or changes later; a node that still shows the translated text is left alone, so its own edits never loop. Switching off puts the original back where the page hasn't changed it since.
- **Text spacing** (`stress.spacing`): an injected style with the WCAG 2.2 (1.4.12) minimums — line height 1.5, paragraph spacing 2em, letter spacing 0.12em, word spacing 0.16em — so text that gets cut off or overlaps shows at once.
- **Right to left** (`stress.rtl`): sets `dir="rtl"` on `<html>` (and on `<body>` when the page sets `dir` there), remembering the attributes to restore them.
- **Prefer reduced motion**, **prefer more contrast** and **print styles** (`preferences`): the same media-list rewrite as [page colours](#page-colours) — when the browser doesn't prefer reduced motion, `prefers-reduced-motion: reduce` and `no-preference` are swapped (`swapReducedMotion`; the bare `(prefers-reduced-motion)` becomes `no-preference`), with the original text kept per media list. `prefers-contrast: more` is swapped the same way (`swapPrefersContrast`; `less` and `custom` stay false). Print styles rewrite each query's media type (`printMedia`): `print` and `all` match, `screen` and other types don't, `not` keeps its meaning, and queries without a type stay as they are — so `@media print` rules, `<link media="print">` sheets and `@import … print` apply, and `@media screen` rules don't. All the overrides combine in `applyMediaOverrides`. What a page decides in script (`matchMedia`, `window.print` handlers) doesn't follow.
- **Pause animations** (`animations`): an injected style sets `animation-play-state: paused` and `transition: none` on everything, for steady screenshots.

## Image sizes and tab order

`annotate` turns on labels the agent draws over the page, in their own closed shadow root (`pointer-events: none`, not seen by the checks), redrawn after scrolling, resizing, image loads and page changes, for what is in view (at most 400 labels): **image sizes** — shown size, file size (`naturalWidth`, which already accounts for the `srcset` density) and density (`imageDensity`: below 1 red, stretched; above 3 amber, much larger than needed); **tab order** — the focusable elements in keyboard order (`tabOrder`: positive `tabindex` first, then document order), each outlined and numbered, positive `tabindex` in amber. Nothing about them leaves the frame.

## Vision simulations

The workspace renders one hidden SVG with colour-matrix filters (`components/VisionFilters`, matrices in `state/vision.ts`): protanopia, deuteranopia and tritanopia use the full-severity matrices of Machado, Oliveira & Fernandes (2009) — as Chrome DevTools does — in linear RGB, the SVG default; achromatopsia keeps the luminance. The chosen mode becomes `filter: url(#bp-vision-…)` (or `blur(2.5px)`) on every preview `<iframe>`, through `PreviewFrame`'s `filter` prop. A CSS filter applies to the frame's rendered output whatever its origin, so it needs no access and never touches the page; it is applied before the zoom transform, so the blur scales with the page. The filter is set only while a mode is chosen (no style by default), and captures include it.

## Measuring and design overlays

Both are layers inside the card's stage, above the frame, so they work on every site.

- **Measure** (`components/MeasureOverlay`, maths in `state/measure.ts`): while measuring, an overlay the size of the scaled frame takes the pointer. Points are converted to page pixels by dividing by the zoom and are kept inside the viewport; a drag draws a rectangle with its size, its distance from the left and top edges, and a polite live-region summary for screen readers; `Shift` keeps one axis. Picking an element in the inspector and measuring exclude each other; `Esc` ends it.
- **Design overlay** (`components/DesignOverlay`): an image file chosen from the card menu is read as an object URL (it never leaves the browser; URLs are revoked when removed or when the workspace closes) and drawn as wide as the viewport, from the top of the page, with `pointer-events: none`, an opacity slider and a `mix-blend-mode: difference` toggle. On sites with an agent, the card sends `trackScroll`, so the agent reports every scroll position — including ones synced scrolling caused — and the image moves with the page. Overlays are per card and last for the session.

## Comparing two addresses

`state/compare.ts` describes the comparison: `mirror` (the same path, query and fragment on another origin) or `fixed` (one address). While it is on, every visible viewport is shown as two cards — A, and B with the card id `<viewport id>~b` (`~` can't occur in viewport ids, which are `[\w-]`) — placed next to each other with CSS `order`; B cards are appended to the stable DOM order, so A frames never move or reload. A card's address is `pageFor(card, page)`; frame names, generations, overrides, strays, checks, highlights, inspector results and captures are all keyed by card id, so every tool works on both sides. Navigation: B follows A automatically (its address is derived from A's); in mirror mode a link followed in B is mapped back onto A's site (`mirrorBack`) and followed like any synced navigation, the card that led keeping its frame. Synced scrolling uses content anchors between A and B when their paths match. Fitting counts the B cards, but starting a comparison doesn't fit by itself (no rescaling of frames that are still loading). B's site may need its own access: if it lacks it, a toast offers to allow it and reloads the B frames. Swapping makes B's address the workspace's page (a new history entry) and A's the comparison. The comparison is session state, not saved.

## Colour contrast

`components/ContrastDialog` keeps the text and background colours for the session. `state/contrast.ts` parses hex (3, 4, 6, 8 digits) and `rgb()`/`rgba()` colours, blends a translucent text colour over the background, computes the WCAG 2 relative luminance and contrast ratio, and grades it against AA/AAA for normal and large text and 3:1 for non-text contrast. Ratios are truncated to two decimals, never rounded up past a threshold. "Pick from screen" uses Chrome's `EyeDropper` API (no permission); the dialog stays open but out of sight, without its backdrop, while the eyedropper is open, so the colour under it can be picked as it really is.

## Real windows

`services/windows.ts` opens one popup window per visible viewport (`chrome.windows.create`, no permission needed), places them side by side on the screen the workspace is on (`state/window-layout.ts`: rows like the workspace, then cascaded; the window frame is measured on the first one), and corrects each window until its content area — the page's layout viewport — has the viewport's size (`fitWindowContent`, also used by a card's "Open in a window of this size"). Chrome keeps windows on its screen; when it refuses a position, it places the window itself. The workspace keeps the windows' ids for the session: they load each new address the workspace previews, can be brought to the front, captured (`captureVisibleTab` per window, in one labelled image) or closed together, and drop out when closed by hand. They are ordinary top-level pages, so everything a tab can do works there: sign-in, cookies read by scripts, bot checks, sites that refuse frames. The in-page tools don't run in them.

## Floating preview

`P` opens a Document Picture-in-Picture window (`documentPictureInPicture.requestWindow`, from the click): a window that stays on top of every other window, filled by the workspace itself. `components/FloatingPreview` renders into it with a React portal (React listens for events on portal containers, so its controls work there); the workspace's stylesheets are copied into its document with absolute URLs and its theme follows. It shows the workspace's page in a frame at one viewport (the focused one, else the narrowest), scaled to fit the window as the user resizes it, and follows the workspace's address. Its frame gets the [rule for frames outside the workspace tab](#embedding-rule).

## Side panel

`src/sidepanel/` is Chrome's side panel (`sidePanel` permission, `side_panel.default_path`). It shows a page in a frame at one preset size (portrait or landscape, kept in settings as `sidePanel`), scaled to the panel's width. The popup ("Preview in the side panel") and the context menu open it straight from the click (`chrome.sidePanel.open`, which Chrome only allows then), passing the address in the panel's path (`setOptions`). It follows the active tab (`tabs.onActivated`, `onUpdated`, `windows.onFocusChanged`) only where Breakpointer may read the tab's address — sites the user allowed, or right after they clicked Breakpointer (activeTab) — so no "tabs" permission is needed. Typing an address stops following until it is turned on again. Its frames get the [rule for frames outside the workspace tab](#embedding-rule).

## Full-page screenshots

A card's "Full-page screenshot" (sites you allow, with screenshot access) shows that preview on its own, fitted to the screen, asks its agent for the page and window heights (`pageMetrics`), then for each screen (`state/full-page.ts`: one per window height, the last one against the bottom, at most 30) asks it to scroll there (`captureScroll`, which also hides fixed and stuck elements after the first screen so headers and cookie bars appear once, and answers `scrolled` once painted), waits a moment for lazy content, and captures the frame (`captureVisibleTab`, at most two a second). `stitchSlices` draws each screen where it was on the page, at the capture's resolution (scaled down when longer than Chrome's canvas limit). Then the page's scroll position, its fixed elements and the workspace's focus are put back. Requests to the agent wait for their answer (`askAgent`, keyed by card and reply type, with a timeout).

## Inspector

`I` (or the toolbar) turns on pick mode in every agent: hovering outlines elements (an overlay in a closed shadow root, `pointer-events: none`), and a click picks one instead of activating it (pointer, mouse and click events are swallowed while picking, so links and buttons do nothing). The agent sends a structural selector (the nearest unique id, then tag names with their position among siblings of the same type — classes are avoided because frameworks change them at breakpoints) and the element's details (box, display, position, font, margin and padding as shorthand, flex/grid summary). The workspace sends `select` to every preview; each outlines the element, scrolls it into view (without moving the others) and reports its details, again after resizes and DOM changes. `state/inspector.ts` works out which details change between sizes, and writes the comparison as a Markdown table for "Copy table". Results are kept per frame generation, so a reloaded or replaced preview never shows stale values.

## Resizing, focus and history

- **Drag to resize**: handles sit just outside each card (right, bottom, corner), so they never cover the page's scrollbar. The card keeps a draft size while dragging (the frame resizes live, the setting is saved once on release). `state/resize.ts` clamps, rounds to 10 px with Shift and snaps to the breakpoints in use within 8 screen pixels (Alt: free). While dragging, `html[data-resizing]` makes every preview frame ignore the pointer: Chrome sends events to an out-of-process frame under the pointer despite pointer capture. The edge handles are focusable separators with arrow-key resizing.
- **Focus mode** is workspace state (not saved): the other cards get `display: none` — their frames stay loaded — and the focused card uses its own fitted zoom, which the dock then controls.
- **History**: every previewed address (typed, picked, followed by synced navigation) is `history.pushState`d; `popstate` shows the address in the URL. The Navigation API (`canGoBack`/`canGoForward`, which only list the workspace's own entries) enables the toolbar buttons.

## Command palette

`components/CommandPalette` is a modal `<dialog>` with a combobox and a listbox. `viewer/commands.ts` builds the commands (actions, presets, groups, saved and recent pages, settings) as a snapshot when the palette opens; `state/commands.ts` searches them, ignoring case and Vietnamese accents, requiring every typed word to match the title or keywords (English names are keywords in every language), with a subsequence fallback. A typed address becomes a "Preview …" command.

## All viewports in one image

Each visible preview is captured as on screen (the same `captureVisibleTab` + crop as screenshots), then `services/composite.ts` draws them on a canvas in rows (`state/composite.ts` lays them out) with the page title, address, date and a label per preview, and saves a PNG. "Copy screenshot" writes a PNG with the async Clipboard API (no extra permission: the workspace has focus).

## Design system

Tokens (colours for both themes, radii, shadows, motion) are CSS custom properties in `styles/global.css`; components use semantic names only. Native controls keep their behaviour and accessibility and get the product's look (`components/Select` wraps a `<select>`; dialogs are `<dialog>`, menus and popovers use the Popover API). One `TooltipLayer` shows `data-tooltip` (and `data-shortcut`) for the hovered or keyboard-focused control in the top layer, hidden from assistive technology because it repeats the accessible name. Entry animations only use `transform` (axe measures colours mid-animation) and respect reduced motion.

## Modules

```
src/
  manifest.ts              Manifest generated at build time (version from package.json)
  background/              Service worker: context menus, omnibox "bpt", commands,
                           first-run welcome, embedding-rule cleanup
  popup/                   Toolbar popup: preview current tab, pick a group, saved and recent pages,
                           open the side panel
  sidepanel/               Chrome side panel: the browsed page at a preset size
  viewer/                  The workspace page (Viewer.tsx composes everything; TopBar,
                           commands.ts builds the command palette, workspace gestures)
  components/              UI building blocks (cards, dock, palette, inspector, dialogs,
                           menu, select, tooltip layer, toast, …)
  agent/                   Frame agent (content script), its message protocol and page helpers
  hooks/                   Settings persistence, theme, site access, shortcuts, frame agents,
                           navigation history
  services/
    preview-adapter.ts     Rendering mechanism boundary (iframe adapter)
    embed-rules.ts         DNR session rules: the viewer tab, and Breakpointer's own frames elsewhere
    site-access.ts         Optional host permissions
    screenshot.ts          captureVisibleTab + crop to an element; clipboard
    composite.ts           All viewports in one image; full-page stitching (canvas)
    windows.ts             Real windows: open side by side at exact sizes, follow, close
    frame-agents.ts        Register/unregister the agent; messages to and from it
    storage.ts             Settings validation, load/save, export/import
  state/                   Pure, unit-tested state logic (viewports, groups, fit, reducer,
                           breakpoint validation, check texts, report HTML, command search,
                           drag snapping, image sheet layout, inspector diffs, size classes,
                           A/B comparison, contrast, measuring, vision matrices, window
                           placement, full-page slices)
  data/                    Presets, built-in groups, framework and site breakpoints
  i18n/                    English (source of truth) and Vietnamese UI strings
  shared/viewer-url.ts     Builds viewer URLs (used by popup and service worker)
  shared/side-panel.ts     Opens the side panel with an address (popup and context menu)
  styles/global.css        Design tokens (both themes) and shared control styles
```

Data flows one way: `Viewer` owns the settings via `useReducer` (`state/settings-reducer.ts`); every change is debounced to `chrome.storage.local` (and flushed on `pagehide`). Components receive data and callbacks; they never touch storage or Chrome APIs directly, except through services.

## Settings and storage

- One key, `breakpointer.settings`, in `chrome.storage.local`. Shape: `BreakpointerSettings` in `src/types/index.ts` (`version: 1`).
- Everything read from storage or an imported file goes through `parseSettings`, which validates each field independently, clamps numbers, drops invalid entries, de-duplicates ids, caps list sizes and falls back to defaults. Unknown or older versions are read leniently.
- Recent addresses are stored only when the user turns on "Remember recent addresses" (off by default) and are cleared when it is turned off. Exports never include recent or last addresses; saved pages (starred by the user) are included.
- v0.2 added `customBreakpoints`, `grid`, `sync`, `checks` and `savedPages`; v0.3 added the `site` breakpoint set, an optional `colorScheme` (`light`/`dark`) per viewport and saved-group viewport, `cssSnippets` (name and CSS, at most 20; saving under an existing name replaces it), `grid.baseline` (0, 4, 8, 12, 16 or 24 px) and `sidePanel` (a preset id and its orientation). The side panel changes its own setting by reading, changing and saving the stored settings (`updateStoredSettings`); open workspaces follow the change. Older stored data simply gets their defaults. Importing a file only replaces the settings the file contains, so an older export keeps the newer settings as they are.
- On the very first run the defaults are saved at once. The default viewports have fixed ids (`default-<preset>`), so two workspace tabs opened on a fresh install write the same workspace instead of replacing each other's (which would reload every preview).
- Two open workspace tabs each keep their own state; the last change saved wins.

## Fitting viewports to the screen

`state/fit.ts` finds the largest single zoom (≤ 100%) at which all visible cards fit in the workspace, simulating `flex-wrap` (or a single row) with the measured card chrome, minimum card width and gaps, by binary search over whole percents. One zoom for all keeps sizes comparable. The space under the cards that the floating zoom dock covers is left out. The first-run fit waits until a page is shown (before that the welcome panel takes the room), and the previews start loading after it (see _Input to preview frames_).

## Internationalisation

`src/i18n/en.ts` is the source of truth for keys; `vi.ts` is typed as `Record<MessageKey, string>`, so a missing translation is a compile error, and a unit test checks placeholders match. The manifest, context menus and omnibox use `_locales/{en,vi}/messages.json` (they follow Chrome's language); the UI follows the in-app language setting (default: same as Chrome).

## Testing

- Unit (Vitest + Testing Library, jsdom): state logic, storage validation, i18n completeness, components.
- End-to-end (Playwright, Chrome for Testing with the extension loaded): two builds — `dist-e2e` (host access granted up front, since tests can't click Chrome's permission prompt) and `dist` (production, no access) — plus axe accessibility checks in light and dark themes.
- `npm run screenshots` regenerates the store screenshots from the real UI.

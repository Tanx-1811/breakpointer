# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [0.4.0] — 2026-10-16

Find where it breaks without looking for it: scan every width, audit every size in one place, and check what changed against a baseline.

### Added

- **Scan every width** (`W`, Tools or the palette): the page is resized one width at a time in its own preview and checked at each — every issue's exact first and last width is found to the pixel (a first pass every 8, 16 or 32 px, then halving the gap wherever the issues change). A chart shows each issue's widths, the page's height, this site's breakpoints and your viewports; hover or use the slider to see any width, click a range to jump to its worst width, add a viewport there in one click, or copy the findings as Markdown. A scan you stop (or one that reaches its limit of 600 widths) says how far it got and how exact its edges are; it waits while the tab is hidden.
- **Audit panel** (`E`, or the Audit toggle with its count of issues): every issue of every preview in one place, grouped by check, with a highlight per preview; **Performance** — page weight, requests, image pixels (and how they compare with what the screen needs), largest contentful paint, layout shift, page height, elements and web fonts as bars per preview; **Type** — the font size, line height and weight of headings, paragraphs, links, buttons and fields at every size, with what changes marked. Each tab copies as a Markdown table.
- **Visual check** (`V`): save a baseline screenshot of every viewport, compare later and see what changed, pixel by pixel — the share of the image that changed, boxes around the areas, and three views (side by side, a slider, the differences). Accept a capture as the new baseline. Baselines stay in this browser (IndexedDB), are listed in Settings and are never exported.
- Three **new checks**: **text cut off by its box** (a line partly hidden by a box that hides its overflow — ellipses, line clamps, fading masks, carousel slides and animated text are left alone), **low-contrast text** (WCAG AA, where the colour behind the text is known: solid backgrounds, read in any CSS colour space including `oklch()`; text over images, gradients, other content or a shadow root's own boxes is skipped rather than guessed) and **layout shifts** (cumulative layout shift above 0.1, with the elements that moved; shifts before the page first paints, which Chrome reports for frames settling into their size, don't count). Each check can be switched off in **Settings → Responsive checks**.
- **Inspector**: hovering shows the element's margin (orange) and padding (green); **Capture at every size** saves the element cut out of every preview, side by side at the same scale.
- **Grid & flex layouts** (Tools): the columns and rows of every grid container and the direction of every flex container, drawn over the page.
- **Reloads keep your place**: each preview comes back to where it was scrolled. **Reload automatically** every 5, 10, 30 or 60 seconds (the menu next to Reload, or the palette); it pauses while a dialog is open or the tab is hidden.
- **Workspace links** (Tools → Copy workspace link): a link that opens the page with your viewports — sizes, names and page colours — for anyone with Breakpointer. Opening one can be undone.
- **Page colours of every preview** (Simulate menu, palette): show the page's light or dark styles in every preview at once, with undo.
- **Allow until Chrome closes**: site access that is removed the next time Chrome starts (the blocked-site tip and Site access); keep it for good from Site access.
- `1`–`8` focus that viewport (again: all of them).
- Six presets: tall phone (360 × 780), pro phone (402 × 874), Android tablet (800 × 1280), large 2-in-1 (912 × 1368), pro tablet 13″ (1032 × 1376) and HD+ desktop (1600 × 900).
- Reports include the page stats of every preview, the last width scan of the page and the element being inspected.
- Help shows what's new after an update (a dot on the Help button until it is opened).

### Changed

- The toolbar's toggles keep their icon (and the Audit count) and move their label to the tooltip below 1500px wide, leaving room for the viewport chips.
- Visual differences are counted from a faint tint upwards (a white background turning light pink is a change).
- Image-size labels show "SVG" for vector images instead of a density.
- Highlights tint elements with an inset shadow instead of a background colour, so a highlighted element keeps its own background.
- Vietnamese: numbers measured in pages use a decimal comma (CLS 0,24; 2,85:1).

### Fixed

- "Images shown larger than their real size" no longer reports lazy-loading placeholders (files of a pixel or two).

## [0.3.0] — 2026-10-14

A redesigned workspace and a professional toolkit: find, inspect and fix responsive problems faster — then measure, simulate, stress-test and compare what you find.

### Added

- **Command palette** (`Ctrl/⌘ + K` or `K`): search and run every action, preset, group, saved or recent page and setting; type an address to preview it. Finds Vietnamese commands without accents and English names in any language.
- **Drag to resize**: drag a preview's right or bottom edge (or corner) and watch the page reflow live. Edges snap to the breakpoints in use, with guides and a live size and breakpoint read-out; `Shift` moves in 10px steps, `Alt` turns snapping off. The handles also work from the keyboard (arrow keys, `Shift` for 10px).
- **Inspector** (`I`): click an element in any preview to compare it at every size — box size, display, font, margin, padding, flex/grid layout and position — with what changes between sizes highlighted, the element outlined in every preview, and its selector one click away.
- **This site's breakpoints**: the widths used by the page's own media queries are detected (on sites you allow) and can label the viewports ("≥768"), drive "Test breakpoint edges", snap resizing, and fill your custom breakpoints.
- **Page colours per viewport**: show a preview with the page's light or dark styles (`prefers-color-scheme`) whatever your browser prefers — compare light and dark side by side. Kept with the viewport and in saved groups.
- **Focus mode**: show one viewport on its own, fitted to the screen (double-click its header or use its menu); `Esc` brings the others back without reloading them.
- **Back and forward** between previewed pages (toolbar buttons, `Alt + ←/→`, mouse buttons).
- **Address suggestions**: saved and recent pages in a list under the address bar, with the keyboard.
- **All viewports in one image**: every visible preview side by side with its name and size, under the page's title — ready for a ticket. **Copy screenshot** puts a preview or the workspace on the clipboard.
- **Hide scrollbars** in previews, like on phones and tablets; **Sort by width**; **Scroll every preview to the top**.
- Add viewport: **search** by name or size, filter by device type, aspect-ratio thumbnails, sizes already in the workspace are marked, and a width ⇄ height swap.
- Manage groups: apply a group from the list.
- **Compare two addresses** (Tools → Compare with another address…): each viewport gets a second preview, **B**, next to the usual one. B shows either the same page on another site (staging next to production; it follows A to other pages, and a link followed in B takes A along) or one fixed address. Swap A and B, change or stop from the banner; screenshots, the all-in-one image, reports and the inspector label the B side.
- **Simulate** menu — **vision**: no red (protanopia), no green (deuteranopia), no blue (tritanopia), no colour (achromatopsia) and blurred vision, drawn over every preview on any site; `Esc` turns it off.
- **Simulate** menu — **layout stress tests** (sites you allow): **Longer text** pseudo-translates the page (about 40% longer, accented, in [brackets]) to find layouts that break when translated; **Right to left** lays the page out like Arabic or Hebrew. Both are undone when switched off.
- **Simulate** menu — **page preferences** (sites you allow): **Prefer reduced motion** shows the page's `prefers-reduced-motion` styles; **Pause animations** freezes CSS animations and transitions for steady screenshots.
- **Colour contrast checker** (`C`): a text colour graded against its background with the WCAG 2.2 thresholds (AA and AAA for normal and large text, and 3:1 for icons and borders). Pick colours from any preview with the eyedropper, or type hex or `rgb()`; swap them in one click.
- **Measure** (`X`): drag over any preview to measure an area in CSS pixels at any zoom, with its distance from the edges; `Shift` measures a straight line. Works on every site.
- **Design overlay** (card menu → Overlay a design…): lay a mockup over a preview, with adjustable opacity and a "show differences" blend; on sites you allow it moves with the page's scroll. The image never leaves your browser.
- Two more **responsive checks**: images shown larger than their real size (they look blurry), and fixed or sticky elements covering more than a third of a phone or tablet screen (cookie walls, tall headers) — both with highlight.
- **Saved live CSS snippets**: save CSS you use often, then edit it or apply it again from the Live CSS dialog or the command palette. Included in exports.
- **Inspector → Copy table**: the comparison as a Markdown table, ready for a ticket or a pull request.
- A preview the site served with an error (a refused frame, a bot check, a missing sign-in) shows **HTTP 403** (or whichever status) on its card, with what to try.
- Shortcuts `[` / `]` (focus the previous / next viewport), `0` (zoom to 100%), `O` (layout outlines), `X` (measure) and `C` (contrast); commands to scroll every preview to the bottom and to copy the page address.
- **Real windows** (toolbar or Tools → Open as real windows): every visible viewport as its own Chrome window with a content area of the exact size, placed side by side. They are normal pages, so sign-in, bot checks and sites that refuse previews all work; they follow the address you preview, and you can show, capture (all windows in one image) or close them together.
- **Floating preview** (`P`): a small always-on-top window (Document Picture-in-Picture) with the page at one viewport size — keep a phone-sized preview next to your editor. It follows the workspace's address; switch the viewport or reload from its toolbar.
- **Side panel**: preview the page you're browsing at a phone (or any preset) size in Chrome's side panel, from the popup or by right-clicking a page or link. It follows the active tab on sites you allow, remembers its size and opens the workspace in one click.
- **Full-page screenshot** (card menu or palette): the whole page of a preview in one tall PNG, captured screen by screen, with fixed headers and cookie bars shown only once.
- **Simulate** menu — **text spacing** (WCAG 1.4.12), **prefer more contrast** (`prefers-contrast: more`) and **print styles** (`@media print` at each width).
- **Image sizes** and **tab order** (Tools, sites you allow): labels over the page with each image's shown size, file size and density (red: stretched, amber: far larger than needed), or numbers in keyboard order (amber: a positive `tabindex`).
- **Baseline grid**: horizontal lines every 4–24px with the column grid (Settings → Column grid).

### Changed

- **New look** across the workspace, popup and dialogs: a refined design system (colours, depth, motion, type), device-class colours, chips with icons, a floating zoom dock (`−` · zoom · `+` · Fit · layout), styled selects, rich tooltips with shortcuts, a two-pane Settings dialog and a redesigned welcome page.
- **Synced scrolling keeps the same content in view** in every preview instead of the same percentage of the page (falls back to the percentage when the content isn't found).
- The first-run fit waits until a page is shown, so the welcome panel no longer shrinks the previews, and the previews start loading at the fitted zoom (no jump in size). The first-run viewports have fixed ids, so two tabs opened on a fresh install no longer reload each other's previews.
- The address bar is a combobox with its own suggestion list (was a `datalist`).
- "Open in new tab" from a card opens the page that preview shows now.
- A dialog or menu whose content doesn't fit (such as Help on a small screen) can be scrolled from the keyboard; menus are taller before they scroll.
- New permission `sidePanel` (no warning at install) for the side panel. See the [privacy policy](docs/PRIVACY.md).

### Fixed

- Dragging over a preview of another site no longer loses the pointer.
- Previews that stop taking clicks recover. Chrome can stop sending input to the previews when one moves just as its page finishes loading; the workspace notices the stray input and refreshes them, so the next click goes through.
- Facebook, Instagram, Threads and other sites that refuse to load inside frames by the browser's Fetch Metadata (Facebook showed "Sorry, something went wrong" in every preview) now show in previews of sites you allow. Your sign-in carries over: with access, the site's cookies (of every SameSite kind) and storage reach its previews.

## [0.2.0] — 2026-10-13

The inspection toolkit: tools that work inside the previews, plus more ways to set up and share a check.

### Added

- **Tools menu** in the toolbar, and **Sync** and **Grid** switches above the previews.
- **Synced scrolling**: scroll one preview and the others follow to the same relative position.
- **Synced navigation**: a link, form or single-page-app route you open in one preview opens in all of them, and the address bar follows. Redirects a page makes by itself (e.g. to a mobile site), in-page `#anchors` and one-time links such as sign-in callbacks are not followed; the preview shows “Navigated away · Back” instead.
- **Responsive checks** on every card (✓ or ⚠ n): sideways overflow with the elements causing it, a missing mobile viewport tag, text under 12 px, touch targets under 24×24 px. **Highlight** marks them in the page.
- **Layout outlines** and **Live CSS** (try a fix in every preview at once; `Ctrl/⌘ + Enter` applies) for the current session.
- **Column grid** overlay: automatic 4 / 8 / 12 columns or a fixed count, with gutter and margin in Settings.
- **Custom breakpoints**: edit your own list in Settings and pick “Custom” as the breakpoint labels.
- **Test breakpoint edges**: viewports on both sides of each breakpoint (e.g. 767 and 768), fitted to the screen, with undo.
- **Rotate all** visible viewports, with undo.
- **Saved pages**: star a page in the address bar; saved pages are suggested first, listed in the toolbar popup and managed in Settings.
- **Export report**: a self-contained HTML file with a screenshot and the checks of every visible viewport.
- **Ctrl/⌘ + wheel** (or a pinch) zooms all viewports — also over previews of sites you allowed, instead of zooming the whole tab; **hold Space and drag** to pan the workspace.
- Seven presets: compact phone, foldable (folded and open), 11″ pro tablet, 14″ laptop, ultrawide and 4K desktop.

### Changed

- New permission `scripting` (no install warning) to run Breakpointer's packaged script inside previews of sites you allowed, only while a workspace is open. See the [privacy policy](docs/PRIVACY.md).
- Toggle items in menus stay open so several tools can be switched in a row.
- Importing settings only replaces what the file contains; an older export keeps your newer settings (such as saved pages).

## [0.1.1] — 2026-10-13

Hardening after testing on 30 real websites, a full code review and a feature-by-feature QA pass.

### Fixed

- Sites that are up (x.com, stackoverflow.com, facebook.com…) were reported as unreachable and their previews hidden. The check now only runs with site access and uses a CORS request; an unreachable site shows a banner above the previews instead of replacing them.
- The loading overlay hid pages until their `load` event (which waits for every ad); previews now show as soon as they paint, with a thin progress bar and a corner badge.
- Undo of a removed viewport or deleted group restored an old snapshot and lost later changes; it now restores only that item. Replacing a group's viewports can be undone.
- Settings → Manage site access closed immediately; toasts (and Undo) were hidden behind open dialogs; dialogs opened with focus on Close; the Save group field didn't get focus.
- Chip drag and drop landed one slot off and couldn't reach the end; moving a card reloaded its preview (cards now keep a stable DOM order).
- Fit shrank to 10% and still overflowed with many viewports or in the row layout; with nothing visible it set 100%.
- Two workspace tabs overwrote each other's settings; opening a preview always added another tab (open workspaces are now reused).
- Pages opened from the popup, context menu, command or address-bar keyword weren't remembered; new viewports ignored the shared zoom; a size error stayed after rotating.
- Shortcuts didn't work with Vietnamese input methods or other keyboard layouts; holding a key repeated the action.
- Addresses with `user:pass@` showed blank previews; they are now refused with a clear message.
- Site access covers the whole registrable domain (incl. `.com.vn`, `.co.uk`, `github.io`…), so redirects between subdomains keep working.
- Screenshots could capture another tab or include the toolbars; file names now include the zoom and keep "đ".
- Theme button now switches light ↔ dark; dialog Close button is translated; duplicate logo ids, toast timers restarting, missing feedback when a permission request fails or access can't be removed.

### Added

- "Navigated away · Back" on previews that followed a link.
- Previews may autoplay video, go fullscreen, use picture-in-picture and the Storage Access API, like a normal tab.
- Dismissed blocked-site tips stay dismissed until Chrome closes; tip to add the port for `localhost`.
- The popup explains when it is opened on the workspace or on the Chrome Web Store.
- Imports accept files with a byte order mark and exports made under the earlier name.
- Group names are kept unique ("Checkout (2)").

## [0.1.0] — 2026-10-13

First release (V1 / MVP).

### Added

- Workspace that previews one page in several viewports at once, each with a real layout width and height; zoom only scales the rendering.
- 15 presets (mobile, tablet, laptop, desktop), custom sizes (200–3840 px), rotate, rename, resize, duplicate, hide/show, reorder (menu, drag-and-drop, keyboard), reload one or all, remove with undo.
- Fit: the largest common zoom at which every visible viewport fits the screen; automatic on first use.
- Saved viewport groups plus six built-in groups (Responsive basics, Mobile QA, Tablets, Laptop & desktop, Tailwind and Bootstrap breakpoints).
- Breakpoint labels (Tailwind, Bootstrap) and pixel rulers.
- Screenshots of one preview or the visible workspace; open a preview in a new tab or in a window of the exact size.
- Opt-in site access to show sites that block framing (per site or all sites), with a manager to review and revoke access.
- Toolbar popup (preview the current tab, choose a group, recent addresses), context menu, address-bar keyword `bpt`, commands `Alt+Shift+V` and `Alt+Shift+P`, workspace shortcuts and a help dialog.
- Light, dark and system themes; English and Vietnamese.
- Settings saved locally with validation and safe defaults; export/import as JSON (browsing data excluded); opt-in recent addresses.
- Brand kit, store assets and screenshots; documentation (plan, architecture, privacy, store listing, testing).
- Unit, end-to-end and accessibility tests; CI.

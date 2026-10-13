# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

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

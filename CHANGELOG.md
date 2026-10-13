# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

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
- Toolbar popup (preview the current tab, choose a group, recent addresses), context menu, address-bar keyword `vp`, commands `Alt+Shift+V` and `Alt+Shift+P`, workspace shortcuts and a help dialog.
- Light, dark and system themes; English and Vietnamese.
- Settings saved locally with validation and safe defaults; export/import as JSON (browsing data excluded); opt-in recent addresses.
- Brand kit, store assets and screenshots; documentation (plan, architecture, privacy, store listing, testing).
- Unit, end-to-end and accessibility tests; CI.

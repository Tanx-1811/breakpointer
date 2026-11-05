# Breakpointer User Guide

[Tiếng Việt](USER_GUIDE.vi.md) · [Privacy](PRIVACY.md) · [Plan](PLAN.md) · [How previews work](ARCHITECTURE.md#adr-001-how-a-page-is-rendered-at-a-viewport-size)

Breakpointer is a Chrome extension that shows one web page at several real viewport sizes side by side, so you can see — and pin down to the pixel — where a layout breaks. Each preview gets a real layout viewport of the size you choose: media queries, container queries and `window.innerWidth` respond exactly as they would in a browser window that size, and zoom only scales the finished picture to fit your screen. Breakpointer changes the viewport only. It doesn't emulate a device's user agent, pixel density, touch input or browser engine — those stay the ones of your Chrome.

This guide covers Breakpointer 0.11. Features marked **New in 0.11** arrive with that release; features marked **(Pro)** come with [Breakpointer Pro](#breakpointer-pro); everything else is free.

## Contents

1. [Getting started](#getting-started) — install, open a page, site access, the welcome screen, learning as you go
2. [The workspace](#the-workspace) — viewports, presets, groups, sizes, zoom, layouts, focus, sidebar, status bar, breakpoints, projects
3. [Finding layout problems](#finding-layout-problems) — sync, checks, score, the audit, the width scanner, inspector, Elements (HTML & CSS, New in 0.13), measure, overlays, A/B comparison
4. [Simulations and stress tests](#simulations-and-stress-tests) — vision, page preferences, touch-screen styles, longer text, right to left
5. [Manual testing](#manual-testing) — the QA checklist, notes and bug reports
6. [Whole sites and regressions](#whole-sites-and-regressions) — Check pages, visual check
7. [Screenshots, reports and sharing](#screenshots-reports-and-sharing) — captures, annotating a screenshot (New in 0.12), showcase, HTML report, present mode, auto-scroll, score badge and score history, real windows, floating preview, side panel
8. [CSS toolkit](#css-toolkit) — fluid type, units, breakpoints as code, colours, aspect ratio (New in 0.11); grid, image markup and media queries (New in 0.12)
9. [Settings](#settings)
10. [Breakpointer Pro](#breakpointer-pro)
11. [Keyboard shortcuts](#keyboard-shortcuts)
12. [Privacy and permissions](#privacy-and-permissions)
13. [Troubleshooting and FAQ](#troubleshooting-and-faq)

---

<a id="getting-started"></a>

## 1. Getting started

### Install

1. Open **[Breakpointer on the Chrome Web Store](https://chromewebstore.google.com/detail/naoadcallefanlcneemohjepkficejjh)** and click **Add to Chrome**. Breakpointer is free; it needs Chrome 116 or later.
2. Pin it: click Chrome's puzzle-piece icon and the pin next to Breakpointer, so its button stays in the toolbar.

Note: another extension on the store is also called “Breakpointer”. Look for the full name, **Breakpointer — Responsive Viewport Tester**.

No permission shows a warning at install. Breakpointer asks for access to a site only when you need it (see [Site access](#site-access)).

### Open a page

Pick whichever way is closest to where you are:

| Where you are                 | What to do                                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| On the page you want to check | Click the Breakpointer button (or press `Alt+Shift+V`) and choose **Preview this page**.                                         |
| Anywhere in Chrome            | Press `Alt+Shift+P` to preview the current tab.                                                                                  |
| On a page or a link           | Right-click → **Preview this page in Breakpointer** or **Preview link in Breakpointer**.                                         |
| In Chrome's address bar       | Type `bpt`, a space, then an address, and press Enter.                                                                           |
| Already in the workspace      | Type or paste an address in the workspace's address bar (press `/` to jump there) and press Enter, or click **Try example.com**. |
| In the toolbar popup          | Type an address under **Preview another address**, or click a page under **Saved pages** or **Recent**.                          |

The toolbar popup also lets you choose which **Viewports** the page opens with — the **Current workspace** or a group — and has **Open workspace**, **Preview in the side panel** and the current **Shortcut**.

Only `http://` and `https://` pages can be previewed. Chrome doesn't let extensions show `chrome://` pages or the Chrome Web Store. For a local dev server, include the port (for example `localhost:5173`). Addresses with a username or password (`user:pass@`) are refused.

You can change `Alt+Shift+V` and `Alt+Shift+P` at `chrome://extensions/shortcuts` (or **Settings → Privacy & access → Customize Chrome shortcuts**).

<a id="site-access"></a>

### Site access: why Breakpointer asks

Many sites tell browsers not to show them inside other pages. A preview of such a site stays blank or says “refused to connect”. Breakpointer works without any access for sites that allow framing, but most of its tools run a small script inside the previews, and that needs your permission for the site.

**What site access unlocks:** previews of sites that block framing, synced scrolling and navigation, the responsive checks, the audit, the width scanner, the inspector, this site's breakpoints, live CSS, the page preferences and stress tests, notes that follow the page, and Check pages. Vision simulations, measuring, the design overlay and the column grid work on any site.

To allow a site:

1. Click **Allow on _site_** in the tip above a blocked preview — or click the shield button in the top bar (**Site access**), or the site access part of the status bar.
2. Choose how long:
   - **Allow on _site_** — until you remove it.
   - **Until Chrome closes** — the access is removed the next time Chrome starts. You can **Keep** it later from Site access.
   - **Allow on all sites** — every site, and screenshots (Chrome only lets an extension capture a tab with access to all sites).
3. Confirm Chrome's prompt.

Access covers the whole registrable domain (`example.com` includes `www.example.com` and `shop.example.com`). Review or remove access any time in **Site access** (the list of **Allowed sites**) or **Settings → Privacy & access → Manage site access**.

When a site blocks previews, the tip also offers **Open in new tab** and **Don't show again**. Tips can be turned back on in **Settings → Workspace → Tips for blocked sites**.

### The welcome screen

With no page open, the workspace shows a welcome screen:

- **Try example.com** loads a sample page.
- **Take the tour** walks through the main controls (it never starts by itself).
- **Guides** opens Help on the list of guides.
- **Jump back in** lists your saved (★) and recent pages, when there are some.
- Reminders: `/` to type an address, `Ctrl/⌘ + K` for every command.

On first use, Breakpointer starts with three viewports — **Phone** 375 × 667, **Tablet** 768 × 1024 and **Laptop** 1366 × 768 — and fits them to the screen when the first page shows.

<a id="learn"></a>

### Learn as you go

**Help centre** (`?`, or the **?** button in the top bar) has four sections — **Get started**, **Shortcuts**, **What's new** and **Support** (feedback, rating, sharing and, from 0.11, a link to this **User guide**) — and a search over guides and shortcuts. After an update it opens on **What's new**, and the Help button shows a dot until you do. Chrome installs updates by itself without a word, so Breakpointer says so: the toolbar icon shows **NEW**, the popup names the new version with **See what's new**, and the workspace shows a message once.

**Getting-started checklist.** Eight things worth doing once, ticked off by themselves as you do them: preview a page, add or resize a viewport, inspect an element at every size, open the audit, scan every width, pin a note on a preview, take a screenshot and try “What's this?” mode. Each has **Show me**. The status bar shows **Get started 3/8** until the list is done or you choose **Hide from the status bar**. Open it from Help → **Get started**, the status bar, or “Get started checklist” in the command palette. Only which tasks are done is kept, on this device.

**Guides.** Step-by-step walks, each card pointing at the control it talks about. A step can open what it explains (the audit, the inspector, notes, the QA checklist) and the last step can start the task (**Scan now**, **Open Check pages**…). Open them from Help → **Get started** → **Guides**, from the welcome screen, from “What's this?” mode, or by typing “Guide” in the command palette.

| Guide                             | What it walks through                                                             |
| --------------------------------- | --------------------------------------------------------------------------------- |
| Workspace basics                  | The main controls, in one short walk (the tour)                                   |
| Find where a layout breaks        | Pick sizes, drag between them and scan every width                                |
| Audit a page at every size        | Issues, performance, type and more, side by side                                  |
| Find gaps between breakpoints     | The page's media queries and the widths that fall between                         |
| Compare one element at every size | Its size, type and spacing in every preview                                       |
| Report a bug with notes           | Pin what's wrong and copy a ready-made bug report                                 |
| Run a QA checklist                | Tick off manual checks at every size                                              |
| Catch visual changes              | Save a baseline, change the site, see what moved                                  |
| Check a whole site                | Many pages at every size, in one table                                            |
| Share screenshots                 | Images of the workspace, showcases and present mode                               |
| Fluid type with the CSS toolkit   | **New in 0.11** — `clamp()`, units and breakpoints as code, at your preview sizes |
| Test touch-screen styles          | **New in 0.11** — the menus and buttons a page shows on phones and tablets        |
| Readable text at every size       | **New in 0.11** — line length, small text, zoom and spacing                       |
| Present a responsive demo         | **New in 0.11** — full-screen previews that scroll by themselves                  |
| Annotate a screenshot             | **New in 0.12** — arrows, boxes, numbered steps, and private details hidden       |
| Ship responsive images            | **New in 0.12** — right sizes, modern formats and lazy loading                    |
| Track a page's score              | **New in 0.12** — see the responsive score improve, day by day                    |
| Read a page's HTML and CSS        | **New in 0.13** — the tree of tags, the CSS of each element, and a summary        |

Throughout this guide, “In the app:” names the guide that covers the same task.

**“What's this?” mode** (`H`, Help → **Turn on**, or the command palette). Point at any control — or move the keyboard focus to it — to see what it does and its shortcut. Clicking keeps the card open instead of using the control, and **Show me how** opens its guide when there is one. Press `Esc` or **Done** to leave.

**Command palette** (`Ctrl/⌘ + K`, or `K`, or **Search…** in the top bar). Every action, preset, group, saved or recent page, project, guide and setting in one search. Type a few letters and press Enter; type an address to preview it. It finds commands in your language and their English names.

---

<a id="the-workspace"></a>

## 2. The workspace

The workspace is the Breakpointer tab. From top to bottom:

- **Top bar** — back and forward, **Reload all previews** (with the reload options menu), the address bar with its ★, **Open page in a new tab**, **Open as real windows**, **Floating preview**, **Get Pro** (on the free plan), **Search…**, the **Screenshots** menu, **Present**, **Site access**, the theme button, **Settings** and **Help**.
- **Workspace bar** — the **Viewports sidebar** button, **Projects**, **Groups**, a chip for each viewport, **Add viewport**, then **Breakpoints**, **Rulers**, **Grid**, **Sync**, **Inspect**, **Audit**, **Measure**, **Notes**, **Simulate** and **Tools**. Below 1500 px wide, these toggles keep their icon and move their label to the tooltip.
- **Previews** — one card per visible viewport.
- **Zoom dock** — floating at the bottom: `−`, the zoom, `+`, **Fit** and the layout.
- **Status bar** — along the bottom (see [Status bar and minimap](#status-bar)).

### Preview cards

Each card is one viewport. Its header has:

- the **name** — click it to rename the viewport;
- the **size** — click the width or height, type a number from 200 to 3840 and press Enter;
- the card's **zoom**;
- a **breakpoint badge** (when breakpoint labels are on), a **light/dark** badge when the card shows the page's other colours, and an **HTTP** badge when the site answered with an error;
- the responsive checks badge (**✓** or **⚠ n**);
- buttons to **rotate** (portrait ↔ landscape), **reload**, take a **screenshot**, open **more actions** (⋯) and **remove** it (with Undo).

The ⋯ menu has **Focus on this viewport**, **Duplicate**, **Full-page screenshot**, **Copy screenshot**, **Open in new tab**, **Open in a window of this size**, **Overlay a design…**, **Page colors** (**Like the browser**, **Light**, **Dark**), **Move left**, **Move right** and **Hide**.

### Add viewports

1. Click **Add viewport** (or press `A`).
2. Search the **Presets** by name or size (“768”), or filter by **Device type**: mobile, foldable, tablet, laptop, desktop. Each preset shows its aspect ratio; sizes already in the workspace are marked **Already in the workspace**.
3. Click a preset — or, under **Custom size**, enter a **Width**, a **Height** (200–3840 CSS pixels) and an optional **Name**, use **Swap width and height** if needed, and click **Add custom viewport**.

You can have up to 8 viewports, shown or hidden. The 30 presets run from a compact phone (320 × 568) to a 4K desktop (3840 × 2160), named by size class — a hint names a device of that size, but the preview is the size only.

### Groups

A group is a saved set of viewports, applied in one click (`G`, or **Groups** in the workspace bar).

- **Built-in** groups: Most-used sizes (360 × 800 to 1920 × 1080), Responsive basics, Mobile QA, Tablets, Laptop & desktop, Tailwind breakpoints, Bootstrap breakpoints and WCAG reflow (zoom 200–400%) — 320 × 256, 640 × 512 and 1280 × 1024, a 1280 × 1024 screen at 400%, 200% and 100%.
- **Save current as group…** saves your viewports (sizes, names, page colours) under a name — up to 20 groups.
- **Manage groups…** applies (**Use**), renames, updates (**Replace with current viewports**) or deletes groups. Applying or deleting can be undone.

### Change viewports

- **Show or hide** — click its chip. Hidden previews don't load.
- **Reorder** — drag a chip, use **Move left / Move right** in the card menu, or press `Alt + ←` / `Alt + →` on a focused chip.
- **Resize by dragging** — drag a card's right or bottom edge, or its corner, and watch the page reflow live. Edges snap to the breakpoints in use, with guides and a live size and breakpoint read-out. Hold `Shift` for 10 px steps, `Alt` to stop snapping. The handles work from the keyboard too (arrow keys, `Shift` for 10 px).
- **Rotate all** (Tools → **Arrange**) — every visible viewport at once, with Undo.
- **Sort by width** (Tools → **Arrange**) — narrowest to widest.
- **Duplicate**, **Hide** and **remove** from the card.

In the app: **Find where a layout breaks**.

### Zoom, Fit and layouts

Zoom changes how large previews look, never the size the page lays out at.

- **Fit** (`F`) — the largest common zoom at which every visible preview fits the window.
- `+` / `−` zoom all; `0` zooms to 100%; `Ctrl/⌘` + mouse wheel (or a trackpad pinch) zooms all viewports, also over previews.
- Each card also has its own zoom.
- **Pan**: hold `Space` and drag the workspace.
- **Layout** (`L` cycles): **Wrap** (cards wrap onto rows), **Row** (one row that scrolls sideways) and **Stack** (one centred column that scrolls down; Fit fits the widest card to the width).

### Focus mode

Show one viewport on its own, fitted to the screen: double-click its card header or its chip, choose **Focus on this viewport** from its menu, press `1`–`8` for the viewport at that position, or `[` / `]` for the previous or next one. Press the same number again, **Show all**, or `Esc` to bring the others back — they don't reload.

<a id="sidebar"></a>

### Viewports sidebar

A list of every viewport with a map of where each sits among the breakpoints (`\`, the sidebar button at the start of the workspace bar, the status bar, the palette, or **Settings → Appearance → Viewports sidebar**). Off by default.

- Each row shows the viewport's size, breakpoint and the kinds of issue found. Click a row to go to its preview (showing it if hidden), double-click to focus it, use the eye to show or hide it, drag or press `Alt + ↑` / `Alt + ↓` to reorder.
- The **Breakpoint map** shows your viewports against the breakpoints in use. Pick a breakpoint set on the toolbar to see which side of each breakpoint every viewport falls on.
- The **Page** card shows the page's title, HTTP status, site access (with **Allow** when it's missing) and its **Responsive score** — click it to open the audit.

While the sidebar is open on a wide window, it replaces the viewport chips on the toolbar.

<a id="status-bar"></a>

### Status bar and minimap

The **status bar** (on by default) sums up the workspace, and most of its parts are shortcuts: previews shown and hidden, the page's HTTP error, site access (opens Site access), sync (turns it on or off), kinds of issue (opens the audit), the breakpoint set, the range of widths, the zoom (fits), the layout, the sidebar, the minimap and **Get started n/8**.

The **minimap** (on by default) appears while the workspace scrolls: an overview of every preview in its size-class colour and the part on screen. Press or drag on it to scroll there.

Turn both on or off in **Settings → Appearance → Panels** or the command palette.

<a id="breakpoints"></a>

### Breakpoint labels, rulers and grids

**Breakpoints** (workspace bar) labels every card with the breakpoint its width falls in, guides drag-to-resize snapping and feeds the breakpoint map, the width scanner chart and **Test breakpoint edges**. Choose:

- a framework's set — Tailwind, Bootstrap, Material UI, Chakra UI, Ant Design, Bulma or Foundation;
- **Custom** — your own list, edited in **Settings → Workspace → Custom breakpoints** (a name and a min-width each, up to 8);
- **This site (n)** — the widths used in the page's own media queries (sites you allow). If the page's stylesheets come from another domain, they can't be read and its breakpoints stay unknown. **Use this site's** in Settings copies them into your custom list;
- **No labels**.

**Test breakpoint edges** (Tools → **Arrange**) replaces the viewports with ones on both sides of each breakpoint in use — for example 767 and 768 — fitted to the screen, with Undo (Tailwind's when no labels are chosen).

**Rulers** (`M`) — pixel rulers along each preview, with the breakpoints marked.

**Grid** — a column grid over every preview: automatic 4 / 8 / 12 columns by width, or a fixed count, with gutter, margin and an optional baseline grid every 4–24 px, set in **Settings → Preview tools → Column grid**.

### Light and dark page colours

Show any preview with the page's light or dark styles (`prefers-color-scheme`), whatever your browser prefers: card ⋯ → **Page colors** → **Light** or **Dark** (sites you allow). To compare light and dark side by side, **Duplicate** a viewport and set one to each. The choice is kept with the viewport and in saved groups. To switch every preview at once, use **Simulate → Page colours of every preview**.

### Address bar, pages and reloading

- **★** saves the page (up to 30 saved pages). Saved pages are suggested first in the address bar, listed in the popup and on the welcome screen, and managed in **Settings → Saved pages**.
- **Recent addresses** are kept only if you turn on **Settings → Workspace → Remember recent addresses** (off by default, the last 10, on this device).
- **Back / forward** between previewed pages: the arrow buttons, `Alt + ←` / `Alt + →`, or your mouse's back and forward buttons.
- **Reload all previews** (`R`) brings each preview back to where it was scrolled. The menu next to it has **Reload automatically** — **Off** or every 5, 10, 30 or 60 seconds — for editing a site while you watch; it pauses while a dialog is open or the tab is hidden.

### Projects

A project saves a site's whole setup — the page, the viewports (shown and hidden), breakpoint labels, the column grid, live CSS and the address compared with — and opens it again in one click.

1. Open the page and set things up.
2. **Projects** (workspace bar) → **Save as project…**, give it a name and save. Saving under an existing name updates that project.
3. Later, pick it from **Projects** (or “Open project …” in the palette). Opening can be undone.

**Manage projects…** opens, renames, updates (**Update with the current setup**) or deletes projects. Projects are included when you export settings. The free plan keeps one project; **Unlimited projects (Pro)** keeps up to 50.

### Workspace links

**Tools → Copy workspace link** copies a link that opens the page with your viewports — sizes, names and page colours — for anyone who has Breakpointer. Opening one replaces the viewports, with Undo.

---

<a id="finding-layout-problems"></a>

## 3. Finding layout problems

Most tools in this chapter run inside the previews, so they need [site access](#site-access) for the site. When it's missing, the Tools menu, the audit and the inspector offer **Allow _site_…**.

### Synced scrolling and navigation

With **Sync** on (the default), scrolling one preview scrolls the others to the **same content** — not the same percentage of the page — and following a link, submitting a form or changing a single-page-app route in one preview opens it in all of them; the address bar follows. Turn each on or off separately in **Tools → Sync scrolling / Sync navigation** or **Settings → Preview tools**.

Redirects a page makes by itself (to a mobile site, say), in-page `#anchors` and one-time links such as sign-in callbacks are not followed: that preview shows **↩ Navigated away · Back** instead.

**Sync clicks & typing (Pro)** (Tools or Settings, off by default): open a menu, switch a tab or fill in a form in one preview and every preview of the same page does the same. Links to other pages still use synced navigation. Forms are never submitted in the other previews, and passwords, one-time codes, payment fields and files are never copied.

<a id="checks"></a>

### Responsive checks

With **Tools → Responsive checks** on (the default), every card checks its page at its own size and shows **✓** or **⚠ n** in its header. Click the badge to see each issue with the elements involved (for example `div.hero > img`) and **Highlight** them in the page. Switch any check off in **Settings → Preview tools → Checks to run**.

| Check                                       | What it finds                                                                                                                                                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content wider than the screen               | The page scrolls sideways; lists the outermost elements causing it and by how much.                                                                                                                              |
| No mobile viewport tag                      | No `<meta name="viewport" content="width=device-width, initial-scale=1">`, so phones lay the page out about 980 px wide and shrink it.                                                                           |
| Text smaller than 12px                      | Hard to read on phones and tablets.                                                                                                                                                                              |
| Touch targets smaller than 24×24px          | Hard to tap without hitting a neighbour (WCAG 2.5.8).                                                                                                                                                            |
| Text cut off by its box                     | A line partly hidden by a box that hides its overflow — often a fixed width or height. Ellipses, line clamps, fading masks, carousel slides and animated text are left alone.                                    |
| Low-contrast text                           | Below WCAG AA — 4.5:1, or 3:1 for large text — where the colour behind the text is known (solid backgrounds, any CSS colour space). Text over images, gradients or other content is skipped rather than guessed. |
| Images shown larger than their real size    | Stretched beyond their file's pixels, so they look blurry.                                                                                                                                                       |
| Fixed elements cover much of the screen     | Fixed or sticky elements cover more than a third of a phone or tablet screen (cookie walls, tall headers).                                                                                                       |
| The layout shifts while loading             | Cumulative layout shift above 0.1, with the elements that moved. Reserve space for images, embeds and late content.                                                                                              |
| Long lines of text — **New in 0.11**        | Paragraphs whose lines run past about 100 characters (50 for Chinese, Japanese and Korean) are tiring to read on wide screens; WCAG 1.4.8 suggests 80 at most.                                                   |
| Images without alt text **(Pro)**           | Screen readers can't describe them (WCAG 1.1.1). Decorative images need an empty `alt=""`.                                                                                                                       |
| Buttons and links without a name **(Pro)**  | Screen readers only say “button” or “link” — often the icon-only menu button that only shows on phones (WCAG 4.1.2).                                                                                             |
| Form fields without a label **(Pro)**       | People can't tell what to enter (WCAG 1.3.1).                                                                                                                                                                    |
| Keyboard focus on hidden elements **(Pro)** | The Tab key reaches elements that are off screen or hidden, such as a closed off-canvas menu or focusable elements inside `aria-hidden` (WCAG 2.4.7).                                                            |
| No page language **(Pro)**                  | `<html>` has no `lang`, so screen readers may use the wrong voice (WCAG 3.1.1).                                                                                                                                  |

The same checks run in the audit, the width scanner and Check pages, and count toward the [responsive score](#score). The accessibility checks are not run on the free plan; the audit mentions them.

For long lines, cap paragraphs at about `70ch` with `max-width`, and let the [CSS toolkit](#fluid-type) write a `clamp()` that grows text smoothly between your smallest and largest viewport.

In the app: **Readable text at every size** (New in 0.11).

<a id="score"></a>

### Responsive score

One number from 0 to 100 for the page at the sizes it was checked at, with a grade — **A** (90 and up), **B** (75), **C** (60), **D** (40) or **F** — and **What costs the most points**. Each kind of issue costs points by how bad it is and how many sizes have it. The score is at the top of the audit's Issues tab, in the sidebar's Page card, in HTML reports and as a column of Check pages.

<a id="audit"></a>

### The audit

Every issue of every preview in one panel, plus how the page performs, its type, images, colours, meta tags and media queries — each compared across your previews.

Open it with `E`, the **Audit** toggle (it shows how many kinds of issue were found), the status bar or the palette. The header has **Measure again**, **Copy as Markdown** (the current tab, as a table for a ticket), **Export** (Pro) and close. The audit runs inside previews of sites you allow.

In the app: **Audit a page at every size**.

**Issues.** The responsive score card, then each kind of issue with the previews that have it (**In 2 of 3**). Select one to see the elements, **Highlight in _viewport_** or **Go to _viewport_**. From 0.11 the score card can also make a [score badge](#score-badge), and from 0.12 it shows the page's [score history](#score-history).

**Performance.** Bars per preview for **Page weight** (bytes transferred), **Requests**, **Image pixels** (and how they compare with what the screen needs — responsive images load fewer on small screens), **Largest contentful paint** (good: under 2.5 s), **Layout shift** (good: under 0.1), **Page height**, **Elements** and **Web fonts**. Sizes count what the browser reports: files from other sites that don't share their timing, and files from the cache, aren't included. With **performance budgets (Pro)** set in Settings, each limit is shown and every preview over one is marked, with a summary at the top.

**Type.** The font size, line height and weight of the first heading, paragraph, link, button and field of each kind in every preview, with what changes between sizes marked.

**Images.** Every image the previews show (24 px or larger), at every viewport: the width it is shown at, its file's width and what the screen needs (shown width × pixel ratio), marked **Too large**, **Too small** or **Right size**, the most wasteful first. For each image, a suggested `sizes` that matches the viewports previewed (in `vw` where the image follows the viewport, in px where it stops growing) and `srcset` widths for 1× and 2× screens — **Copy srcset and sizes**. Add viewports for a finer suggestion.

**Image tips** (New in 0.12) appear under an image when something besides its size could be better, and the tab's summary counts them:

- a JPEG, PNG or GIF shown wider than 160 px — **AVIF or WebP is usually 30–50% smaller** at the same quality;
- **lazy-loaded, yet in the first screen** at some size — load it straight away (with `fetchpriority="high"` if it's the main image);
- **below the first screen at every size** and loaded at once — add `loading="lazy"`;
- **no `width` and `height` attributes** — the page jumps while it loads; add them (the file's size is enough).

To write the markup for a new image, use the CSS toolkit's [Images](#toolkit-images) tool. In the app: **Ship responsive images**.

**Colours.** The colours the page uses for **Text**, **Backgrounds** and **Borders** across the previews, as swatches with how many elements use each — **Copy as CSS variables** or as a Markdown table.

**Meta.** Choose the **Preview to read**, then see an approximate **Search result** and **Link preview** (with the social image and its size), the **Tags** checked — title and description length, social title and image, X card, canonical address, language, viewport (and whether it blocks zooming), robots (`noindex`) and icons, each **OK**, **Check**, **Fix** or **Note** — and the outline of its **Headings**, with skipped levels, a missing or second `H1` and headings hidden at that size. Every search engine and app shows links its own way; treat the previews as approximate.

**Media queries.** Every media and container query in the page's own CSS, its number of rules and the previews it applies in (✓ / –). **Queries shown**: **Widths** or **All conditions**. Likely mistakes are listed under **Possible breakpoint mistakes**:

- a **gap** — `(max-width: 599px)` and `(min-width: 601px)` leave 600 px with neither;
- an **overlap** — both sides apply at the same width.

Click **Add a viewport at 600 px** to see the problem width. Container queries (—) depend on their container, not the viewport. Stylesheets from other sites can't be read, so their queries aren't listed.

In the app: **Find gaps between breakpoints**.

<a id="scan"></a>

### Scan every width

Instead of guessing widths, let Breakpointer resize the page one width at a time and find each issue's exact first and last width, to the pixel.

1. Press `W`, or **Tools → Scan every width…**.
2. Set **From** and **To** (320–1920 px by default), the **Height**, and the **Step** of the first pass: **Quick · 32px**, **Normal · 16px** or **Thorough · 8px**.
3. Click **Scan**. The page loads in a preview of its own and is checked at every step; wherever the issues change between two widths, the gap is halved until the edge is found.
4. Read the chart: each issue's ranges, the page's height, this site's breakpoints and your viewports. Hover it or use the slider to see any width.
5. Click a range to jump to its worst width, then **Add a viewport at \_width_px** to keep it. **Copy as Markdown** or **Export** (Pro) the findings.

A scan checks at most 600 widths. If you stop it — or it reaches the limit — it says how far it got and how exact its edges are. It waits while the tab is hidden. The last scan of the page is included in HTML reports.

In the app: **Find where a layout breaks**.

<a id="inspector"></a>

### Inspector

Compare one element at every size.

1. Press `I`, click **Inspect**, or **Tools → Inspect element**.
2. Click an element in any preview. While picking, hovering shows its margin (orange) and padding (green).
3. The inspector lists its **Size**, **Display**, **Font**, **Margin**, **Padding**, **Layout** (flex/grid) and **Position** in every viewport, side by side, with what changes between sizes highlighted. The element is outlined in every preview; it may be **Hidden at this size** or **Not on this page**.

Then:

- **Copy selector**, or **Copy table** — the comparison as a Markdown table, ready for a ticket or a pull request.
- **Capture at every size** — the element cut out of every preview, side by side at the same scale, in one image.
- **Distance to…** — pick a second element to see the space between them, across and down, at every viewport (or how far one sits inside the other, or **Overlapping**). It's measured again when sizes change and added to the copied table. **Remove the distance** to stop.
- **Go to _viewport_** scrolls to that preview; **Clear** forgets the element.

The inspected element is included in HTML reports. In the app: **Compare one element at every size**.

<a id="elements"></a>

### Elements (HTML & CSS) — New in 0.13

Every tag of the page and the CSS of each, like the browser's developer tools (F12) — but for the preview you choose, at its size.

1. Press `J`, or **Tools → Elements (HTML & CSS)**, or “Elements” in the palette. The panel opens at the side (it takes the place of the inspector, the audit or the QA checklist).
2. Choose the **Preview** to read when you have several — the same page at 375 px and at 1440 px can have different styles.
3. Browse the tree: click the arrow, or use `↑` `↓` to move, `→` to open, `←` to close, `Enter` to select. Tags in italics with a crossed eye aren't shown at that size. Or click the **Pick** button in the panel's header and click an element in any preview: the tree opens down to it and switches to that preview.
4. The selected element is outlined in its preview. Read its details:
   - **Styles** — `element.style` (its `style` attribute), then every rule that matches, the winning ones first, with the `@media`, `@supports`, `@container` or `@layer` around it and the file it comes from. Declarations that lose to another rule are struck through; hover a selector for its specificity. A rule inside a media query shows only in previews where that query applies.
   - **Computed** — the final value of each property; the layout ones first, **Show all** for the rest, and a filter.
   - **Box** — margin, border, padding and content size.
   - **Summary** — the page's HTML and CSS at a glance (see below).
5. **Copy CSS** copies the rules as text; **Try in Live CSS** opens [Live CSS](#live-css) with a rule for this element, to change it in every preview at once; **Compare at every size** opens the [inspector](#inspector) with the same element.

**Summary** audits the page: the number of **Elements** and the **Deepest level** (flagged past 1,500 and 32, Lighthouse's limits), **Duplicate ids**, **Obsolete tags** (`center`, `font`, `marquee`…), **Images without alt**, **Inline styles** and **!important declarations**, with the most used tags and the stylesheets. **Copy as Markdown** puts it in a ticket.

Notes: Elements works in previews of sites you allow. Stylesheets from other sites that don't allow it can't be read (the panel says how many), so their rules aren't listed. Whether an `@container` rule applies can't be told from outside: its rules are listed with their condition. In the app: **Read a page's HTML and CSS**.

### Measure

Press `X` (or **Measure**), then drag over any preview to measure an area in CSS pixels, whatever the zoom, with its distance from the left and top. Hold `Shift` for a straight line. Works on every site. `Esc` or **Done** leaves.

### Colour contrast checker

1. Press `C`, or **Tools → Colour contrast…**.
2. Set the **Text** and **Background** colours: type hex or `rgb()`, use the swatch, or **Pick from screen** with the eyedropper (from any preview). **Swap colours** in one click.
3. Read the **Contrast ratio** and the WCAG 2.2 grades: **AA · normal text** (4.5:1), **AA · large text** (3:1), **AAA · normal text** (7:1), **AAA · large text** (4.5:1) and **Icons and borders** (3:1), each **Pass** or **Fail**, with samples at 16 px and 24 px.

Large text is at least 24 px, or 18.66 px bold. A translucent text colour is blended over the background first. If the browser has no eyedropper, type the colours.

### Overlays inside the previews

From **Tools → Inside previews** (sites you allow, except the column grid):

- **Layout outlines** (`O`) — an outline around every element, to see boxes and overflow.
- **Grid & flex layouts** — the columns and rows of every grid container and the direction of every flex container.
- **Image sizes** — a label on each image with its shown size, file size and density; red: stretched, amber: far larger than needed (“SVG” for vector images).
- **Tab order** — numbers the elements in keyboard order; amber: a positive `tabindex`.
- **Hide scrollbars** — like on phones and tablets.
- **Hide cookie banners (Pro)** — the consent banners of 25+ common tools (OneTrust, Cookiebot, Didomi, Usercentrics and more) hidden for clean screenshots and checks. Nothing is accepted or refused; switch it off and they're back.
- **Column grid** — see [Breakpoint labels, rulers and grids](#breakpoints).

### Live CSS

Try a fix in every preview at once.

1. **Tools → Live CSS…**.
2. Type CSS, for example `.hero h1 { font-size: clamp(2rem, 6vw, 4rem); }`.
3. **Apply to previews** (`Ctrl/⌘ + Enter`). **Remove** takes it out.

Live CSS lasts for the session and never changes the site. Under **Saved snippets**, **Save as snippet** keeps CSS you use often (up to 20) — **Edit** puts it in the editor, **Apply** applies it straight away; “Apply CSS snippet …” in the palette does the same. Snippets are included in exports; live CSS is saved with a project.

### Design overlay

Lay a mockup over a preview and compare it pixel by pixel.

1. Card ⋯ → **Overlay a design…** and choose an image.
2. Adjust **Overlay opacity**; turn on **Show differences** for a difference blend.
3. **Hide the overlay** / **Show the overlay**, or **Remove the overlay** (also in the card menu).

On sites you allow, the overlay moves with the page's scroll. The image never leaves your browser.

<a id="compare"></a>

### Compare two addresses

Give every viewport a second preview, **B**, next to the usual one, **A** — staging next to production, or a redesign next to the live page.

1. **Tools → Compare with another address…**.
2. Enter the **Address to compare** and choose **What B shows**:
   - **The same page on another site** — B shows the current path on that site and follows A to other pages (a link followed in B takes A along);
   - **One fixed address** — B always shows exactly that address.
3. Click **Compare**.

The banner has **Swap A and B**, **Change…** and **Stop comparing**. Screenshots, the all-in-one image, reports and the inspector label the B side. Comparing doubles the previews: hide a few viewports if the workspace gets slow. The compared address is saved with a project.

---

<a id="simulations-and-stress-tests"></a>

## 4. Simulations and stress tests

The **Simulate** menu (workspace bar) changes how previews look or what the page is asked to do — never the device. Vision simulations work on every site; page preferences and stress tests work on sites you allow and are undone when switched off.

### Vision

**Normal vision**, **No red (protanopia)**, **No green (deuteranopia)**, **No blue (tritanopia)**, **No colour (achromatopsia)** and **Blurred vision** — an approximation drawn over every preview. `Esc` turns it off. Also in the palette (“Vision: …”).

### Page colours of every preview

**Like the browser**, **Light** or **Dark** for every preview at once (`prefers-color-scheme`), with Undo. Per-viewport colours are in each card's menu.

### Page preferences

- **Prefer reduced motion** — the page's `prefers-reduced-motion` styles.
- **Prefer more contrast** — its `prefers-contrast: more` styles.
- **Print styles** — the page as it would print (`@media print`), at each width.
- **Pause animations** — freezes CSS animations and transitions, for steady screenshots.
- **Touch-screen styles** — **New in 0.11**. Previews use the page's CSS for touch screens — `(hover: none)` and `(pointer: coarse)` — so you see, for example, menus that open on a tap instead of on hover, or larger touch-friendly controls. Look for menus, buttons or tooltips that only appear on hover: on a touch screen they have no way in. Only these CSS media features change: no touch events are sent, and it isn't a device emulation. Tip: add “Menus work without hover” to the [QA checklist](#qa-checklist) and mark it at every size.

In the app: **Test touch-screen styles** (New in 0.11).

### Layout stress tests

- **Longer text** — pseudo-translates the page: about 40% longer, accented, in [brackets], to find layouts that break when translated.
- **Right to left** — lays the page out like Arabic or Hebrew.
- **Text spacing (WCAG)** — line height 1.5, paragraph spacing 2, letter spacing 0.12em, word spacing 0.16em (WCAG 1.4.12): nothing should be cut off.
- **Text at 200%** — every font size doubled, like text-only zoom (WCAG 1.4.4): nothing should be cut off or overlap.

Run the [responsive checks](#checks) or the [width scanner](#scan) with a stress test on to find the breakage, then switch it off — the page is restored.

---

<a id="manual-testing"></a>

## 5. Manual testing

### QA checklist

Some things only a person can check — does the menu open, does the form send? The QA checklist keeps track of them for every viewport.

1. Press `Q`, or **Tools → QA checklist**, or the palette. A panel opens with a row per check and a column per visible viewport.
2. Try each check in each preview, then click its cell: **Passed** → **Failed** → **Skipped** → **Not checked**. Arrow keys move between cells; **Go to _viewport_** scrolls to that preview.
3. **Copy as Markdown** — a table of the results with what failed listed first, ready for a ticket.

The eight default checks: the navigation menu opens, closes and every link works; nothing is cut off or scrolls sideways; text is readable without zooming; images are sharp and not stretched; buttons and links are easy to tap; forms can be filled in and sent; videos, maps and embeds fit the screen; pop-ups and menus fit and can be closed.

Edit a check, delete it (with Undo) or type a new one in **Add a check…** — up to 40. The ⋯ menu has **Reset results** and **Restore the default checks**. Your list of checks is kept (and included in exported settings); results are kept for the session only.

In the app: **Run a QA checklist**.

<a id="notes"></a>

### Notes and bug reports

Pin what's wrong on the previews and copy a ready-made bug report.

1. Press `N`, or click **Notes**.
2. Click a preview where something is wrong: a numbered pin appears. Type what's wrong (“What's wrong here?”) and click **Done**. **Delete** removes a note, with Undo.
3. In the notes bar, **Copy bug report** copies Markdown with the page, the browser, and each viewport's size, breakpoint and notes — ready for an issue tracker. The camera button (**Save the previews and their notes as one image**) saves every preview with its notes in one labelled image.

On sites you allow, notes follow the page as it scrolls. They show in screenshots. **Tools → Copy bug report** and **Clear notes** work while notes are off. Up to 50 notes a session; notes are kept for the session only, never stored or sent.

In the app: **Report a bug with notes**.

---

<a id="whole-sites-and-regressions"></a>

## 6. Whole sites and regressions

<a id="check-pages"></a>

### Check pages

Check a whole list of pages at every viewport in one run, and see which pages break at which sizes.

1. Press `B`, or **Tools → Check pages…**.
2. Fill **Pages, one address per line** — type or paste addresses, or use **Add pages**: **Links on this page** (other pages of the site linked from the page you're previewing), **From the sitemap** (from its `robots.txt` or `/sitemap.xml`) or **Saved pages**. **Clear** empties the list. Up to 50 pages a run.
3. Pages are checked at the size of every visible viewport (**At every viewport**). Show the sizes you want first.
4. Click **Start checking**. Each page loads in a preview of its own and runs the same checks as the cards.
5. Read the table — pages × sizes: **✓** no issues, a number = kinds of issue (select it to see the issues and elements), **✗** no answer, **—** not checked — and each page's score. A page that couldn't be checked says why: an HTTP error such as 404, a site Breakpointer isn't allowed on, or a page that didn't load in time. Redirects show **Went to …**.
6. **Open** a page in the workspace from its row, **Copy as Markdown**, **Download report** (HTML), or **Export** (Pro).

If some sites in the list aren't allowed yet, **Allow these sites…** asks for all of them in one prompt. Links that would act rather than show something (signing out, deleting, one-time sign-in links) and files are left out.

In the app: **Check a whole site**.

<a id="visual-check"></a>

### Visual check

Save a baseline screenshot of every viewport, then compare later — after a deploy, a CSS change or against staging — and see what moved, pixel by pixel.

1. Press `V`, or **Tools → Visual check…**.
2. **Save baseline** captures every visible viewport.
3. Change the site (or wait for a deploy), reload, and open Visual check again.
4. **Compare with baseline**. Each viewport shows **No change** or how much changed and how many areas, boxed in magenta.
5. **View** a viewport and pick **Show**: **Side by side**, **Slider** or **Differences**.
6. **Accept** a capture as the new baseline when the change is intended, or **Save new baseline** for all.

For exact results, compare at the same window size and zoom. Baselines stay in this browser (up to 400, oldest removed first), are never exported, and can be deleted here (**Delete this page's baselines**) or in **Settings → Backup & reset → Visual baselines**. Taking captures needs all-sites access, like other [screenshots](#screenshots).

In the app: **Catch visual changes**.

---

<a id="screenshots-reports-and-sharing"></a>

## 7. Screenshots, reports and sharing

<a id="screenshots"></a>

### Screenshots

Chrome lets an extension capture what's on screen only when it has access to all sites. The first time you take a screenshot, Breakpointer explains this — **Allow and capture** grants it (you can remove it later in Site access).

From the **Screenshots** menu in the top bar:

- **Capture visible workspace** (`S`) — a PNG of what's on screen.
- **All viewports in one image** — each visible preview side by side with its name and size, under the page's title, ready for a ticket.
- **Copy visible workspace** — to paste into a ticket or a chat.
- **Annotate a screenshot…** — every preview in one image, opened for drawing (New in 0.12, see below).
- **Showcase image…** — see below.

From a card: the camera button saves that preview; ⋯ → **Copy screenshot** copies it; ⋯ → **Full-page screenshot** captures the whole page of that preview in one tall PNG, screen by screen, with fixed headers and cookie bars shown once (very long pages stop after 30 screens).

Notes show in screenshots. For clean shots, try **Hide cookie banners** (Pro) and **Pause animations**.

<a id="annotate"></a>

### Annotate a screenshot — New in 0.12

Point at what's wrong — and hide what's private — before you share a screenshot.

1. **Screenshots → Annotate a screenshot…** (or “Annotate a screenshot” in the palette). Every visible preview is captured into one labelled image, like **All viewports in one image**, and opens in the editor.
2. Pick a tool under **Drawing tools**:
   - **Arrow** and **Box** — drag on the image; hold `Shift` for 45° lines and square boxes.
   - **Pen** and **Highlighter** — draw freehand; the highlighter is wide and see-through.
   - **Text** — click where the label goes, type it, press `Enter` (`Esc` cancels).
   - **Numbered step** — each click places the next number (1, 2, 3…), to match a list of steps in your ticket.
   - **Hide (pixelate)** — drag over names, emails, prices or anything private: that area is pixelated in the saved image.
   - **Select and move** — click a mark to select it, drag to move it or its handles, `Delete` removes it.
3. Choose a **Colour** (red, orange, yellow, green, blue, black, white) and a **Line width** (**Thin**, **Medium**, **Thick**); with a mark selected, they change that mark.
4. **Undo** and **Redo** (`Ctrl/⌘ + Z`, `Shift + Ctrl/⌘ + Z`), or **Clear all marks**.
5. **Save PNG** (full resolution) or **Copy image**.

The image and your marks stay in the Breakpointer tab until you save or copy them. In the app: **Annotate a screenshot**.

### Showcase image

Your page at several sizes in simple device frames on a backdrop — for a portfolio, a client or a post.

1. **Screenshots → Showcase image…** (or the palette).
2. Choose up to four **Viewports**, the **Frames** (**Devices**, **Windows** or **None**), the **Backdrop** (**Indigo**, **Light**, **Dark** or **Transparent**), the **Shape** (**16:9**, **4:3** or **Square**) and an optional **Title**. **Credit Breakpointer** adds a small “Made with Breakpointer”; switch it off if you like.
3. **Download PNG** (drawn at twice its size or your screen's density) or **Copy image**. **Capture again** after the page changes.

The frames are decoration: the previews show your page at these viewport sizes, not on real devices.

In the app: **Share screenshots**.

### HTML report

**Tools → Export report…** saves one self-contained HTML file: a screenshot and the checks of every visible viewport, the responsive score, each preview's page stats, the last width scan of the page and the element being inspected. It's created in your browser; nothing is uploaded. With **Your brand on reports (Pro)**, the report says “Prepared by …” with your name, website and logo.

<a id="score-badge"></a>

### Score badge — New in 0.11

Show off a page's responsive score as a badge — “responsive | 92 A” — in a README, a pull request or a client report.

1. Open the audit (`E`) on the **Issues** tab.
2. On the responsive score card, click **Copy badge** (the SVG goes on the clipboard: paste it into a file or a README) or **Download the badge (SVG)**.

<a id="score-history"></a>

### Score history — New in 0.12

Watch a page's responsive score improve as you fix it.

- Each time every preview of a page has been checked, its score is kept for the day (the day's last score) — on this device only, under a code made from the page's address, never the address itself; 30 days for up to 200 pages.
- From the second day, the score card in the audit shows a small chart and the change since the first day kept — for example **+12 since 2 Nov · 5 days** — in green when the score went up.
- The trash button on the card forgets the whole history (with **Undo**). The history isn't part of exported settings.

In the app: **Track a page's score**.

### Present mode

Only the previews, full screen where Chrome allows — for screen sharing and client demos.

1. Press `D`, click **Present** in the top bar, or “Present mode” in the palette.
2. A small bar offers the layout, **Fit**, **Auto-scroll** (New in 0.11) and **Exit**.
3. `Esc` or **Exit** leaves.

### Auto-scroll — New in 0.11

Every preview scrolls slowly from top to bottom by itself, together — for demos and screen recordings.

- In present mode, click **Auto-scroll** in the bar (20 seconds to the bottom); it becomes **Stop** while it runs.
- Or, in the command palette, choose “Auto-scroll every preview” at 10, 20 or 40 seconds, and “Stop auto-scrolling” to stop.

Scrolling a preview yourself stops it there.

In the app: **Present a responsive demo** (New in 0.11).

### Real windows

Open every visible viewport as its own Chrome window with a content area of the exact size, placed side by side: **Open as real windows** in the top bar or the Tools menu. They're normal pages, so sign-in, bot checks and sites that refuse previews all work. They follow the address you preview in the workspace; the banner has **Show windows**, **Capture windows** (all windows in one image) and **Close windows**. Chrome may limit a window to your screen size; Breakpointer tells you when it does.

For a single preview, card ⋯ → **Open in a window of this size** (or **Open in new tab**).

### Floating preview

A small always-on-top window with the page at one viewport size — keep a phone-sized preview next to your editor. Press `P`, or **Floating preview** in the top bar or Tools. It follows the workspace's address; its toolbar switches the **Viewport**, reloads, or goes **Back to the workspace**. It needs Chrome's Document Picture-in-Picture; if the browser lacks it, Breakpointer says so.

### Side panel

Preview the page you're browsing in Chrome's side panel, at a phone (or any preset) size: **Preview in the side panel** in the popup, or right-click a page or link → **Preview this page in the side panel** / **Preview link in the side panel**. Choose the **Size**, **Rotate**, type an address, or turn on **Follow the current tab** (on sites you allowed). **Open in the workspace** takes the page to the full workspace. The side panel remembers its size.

### Exports (Pro)

**Export** in Check pages, the width scanner and the audit saves **CSV for spreadsheets** (a row per page, size and issue — or per issue range, or per preview) or **JSON for scripts** (the full results, including meta tags, images and colours from the audit).

---

<a id="css-toolkit"></a>

## 8. CSS toolkit — New in 0.11

Fluid sizes, units, breakpoints, colours and ratios — worked out at the sizes you preview. Each tool shows its result at every visible viewport, so you see what the numbers mean on your page, and **Copy** puts the CSS on the clipboard.

Open it with `U`, **Tools → CSS toolkit**, or “CSS toolkit: …” in the command palette (which opens that tab). It has eight tabs: **Fluid type**, **Units**, **Breakpoints**, **Colours**, **Aspect ratio** and, new in 0.12, **Grid**, **Images** and **Queries**. Show at least one viewport to see the values at its size.

In the app: **Fluid type with the CSS toolkit**.

<a id="fluid-type"></a>

### Fluid type

Turn a size for your smallest viewport and one for your largest into a CSS `clamp()` that grows smoothly in between.

1. Under **What to make**, choose **One size**.
2. Set the **Smallest viewport** and **Largest viewport** — or click **Use my previews' widths** to take them from your narrowest and widest preview.
3. Set the **Size at the smallest** and **Size at the largest**, choose **Write sizes in** px or rem (with the **Root font size**, 16 by default) and the CSS **Property** (`font-size` by default).
4. Read the declaration — for example `font-size: clamp(…);` — and the size it gives **At your viewports**. **Copy** it.

Below the smallest viewport the size stays at its minimum; above the largest, at its maximum. The `rem` part of the middle value keeps text zoomable. If the largest size is more than 2.5 times the smallest, the toolkit warns that text zoomed to 200% may not double (WCAG 1.4.4).

**Type scale.** Choose **Type scale** under **What to make** for a whole set of sizes: **Body text at the smallest** and **at the largest**, a **Scale at the smallest** and **at the largest** (Minor second, Major second, Minor third, Major third, Perfect fourth, Augmented fourth, Perfect fifth or Golden ratio), and the **Steps below body text** and **Steps above body text** (up to 8 each). Step 0 is body text; each step up multiplies it by the scale. Every step becomes a `clamp()`, shown at each viewport, and the scale is copied as CSS custom properties — use them as `font-size: var(--step-2)`.

Tip: paste the result into [Live CSS](#live-css) to try it on the page at every size before you change your code.

### Units

Type a **Value** — a number with a unit if you like (`24px`, `1.5rem`, `4vw`) — or pick its **Unit**, and set the **Root font size** and the **Parent font size**. A table shows the value in every unit — `px`, `rem`, `em`, `pt`, `vw`, `vh`, `vmin` and `vmax` — at each viewport, marking the ones that change with the viewport; **Copy as Markdown** copies it. `vw`, `vh`, `vmin` and `vmax` are worked out at each viewport's size; `em` uses the parent font size; 1pt is 4/3 px. Handy when a design says px and your CSS says rem.

### Breakpoints

The breakpoints in use — a framework's, your own or this site's (choose under **Breakpoints**; the toolbar's set is marked **in use**) — written as code. Choose **Write as**:

- **CSS · mobile first (min-width)**, **CSS · desktop first (max-width)** or **CSS · range syntax**;
- **Sass map and mixins**;
- **Tailwind CSS v4 (@theme)** or **Tailwind CSS v3 (config)**;
- **CSS @custom-media**;
- **JavaScript** — the breakpoints as an object, with media query strings for `window.matchMedia`.

Pick the **Query unit** (px or em) and **Copy**. `em` values are at 16 px, as browsers read `em` in media queries; `max-width` queries stop 0.02 px short, so no width falls in two ranges. This site's breakpoints are read from its CSS once a preview of an allowed site has loaded.

### Colours

Type a **Colour** — `#4f46e5`, `rgb(79 70 229)`, `hsl(243 75% 59%)`, `oklch(51% 0.23 277)` or a name — choose one, or **Pick from screen** with the eyedropper (from any preview). The **Formats** list shows it as HEX, RGB, HSL and OKLCH: **Copy** one, or **Copy all formats**. Its contrast as text **On white** and **On black** is graded **Passes AA**, **AA for large text only** or **Fails AA**. **Recent colours** keeps your picks during the session. For a full text-on-background check, use the [colour contrast checker](#colour-contrast-checker) (`C`).

### Aspect ratio

Enter a **Width** and a **Height** — or choose one of the **Common ratios** (1:1, 4:3, 16:9, 21:9, 9:16…), or **From a viewport…** — to get the simplest **Ratio** (and the common one it's **Close to**, such as 1366 × 768 ≈ 16:9) and the CSS: an `aspect-ratio` declaration with a `padding-top` fallback. Set the **Box width** as a share of the viewport (100% by default) to see the box's width and height **At your viewports**, with a note where the box is **Taller than the viewport**.

### Grid — New in 0.12

How many columns `repeat(auto-fit, minmax(…, 1fr))` makes at each of your viewports — before you write it.

1. Set the **Narrowest column**, the **Gap**, the container's **Side padding**, and optionally its **Max width** and **Max columns**, and how many **Items** the grid holds.
2. Choose the **Repeat mode**: **auto-fit** (items stretch to fill the row) or **auto-fill** (empty columns keep their room).
3. Read, **At your viewports**, the **Columns**, the **Item width**, the **Rows** and a small **Preview**; a width in amber means the container is narrower than one column (the CSS's `min(100%, …)` keeps it from overflowing).
4. **Copy** the CSS — no media queries needed.

<a id="toolkit-images"></a>

### Images — New in 0.12

Responsive image markup for the way an image is laid out.

1. Under **The image is**, choose **As wide as the viewport**, **In a content column** (with its side padding and max width), **A share of the viewport** (in vw) or **The same width everywhere**.
2. Set the image's **Proportions** (width and height, e.g. 16 and 9), the **File names** with `{w}` where the width goes (`photo-{w}.jpg`) and the **Alternative text**.
3. Switch **Below the first screen** on to lazy-load it (off gives a main image `fetchpriority="high"`), and **AVIF and WebP** for a `<picture>` with the smaller formats first.
4. The table shows the width the image is **Shown at** and the **File on a 2× screen** at each viewport; **Copy** the markup — `sizes`, the `srcset` widths your viewports need at 1× and 2×, and `width` and `height` so the page doesn't jump while it loads.

### Queries — New in 0.12

Test a media query against your viewports: type it under **Media query** — or click one of the **Examples** — and see **Applies in 2 of 3 viewports**, with each viewport marked **Applies**, **Doesn't apply** or **Depends on the browser** (for features such as hover, pointer or resolution, which depend on the device). Widths, heights, orientation and aspect ratio are worked out from each viewport (em and rem at 16 px), with min-/max- or range syntax, `and`, `or`, `not`, lists and media types; `prefers-color-scheme` follows each preview's page colours. A query that can't be read says so.

---

<a id="settings"></a>

## 9. Settings

Open **Settings** from the gear in the top bar. Sections are listed on the left; settings are saved as you change them, on this device.

| Section              | What's in it                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Appearance**       | **Theme** (System, Light, Dark; `T` switches light ↔ dark). **Accent colour**: Indigo, Blue, Violet, Teal, Rose, Graphite — each readable in both themes. **Canvas** behind the previews: Dots, Grid, Plain. **Layout**: Wrap, Row, Stack. **Panels**: Viewports sidebar, Status bar, Minimap. **Language**: Same as Chrome, or one of ten languages. |
| **Workspace**        | **Breakpoint labels**; **Custom breakpoints** (Name, From (px), **Add breakpoint**, **Use this site's**); **Show rulers**; **Tips for blocked sites**; **Remember recent addresses** and **Clear recent addresses**.                                                                                                                                  |
| **Preview tools**    | **Sync scrolling**, **Sync navigation**, **Sync clicks & typing** (Pro); **Responsive checks** and **Checks to run** (switch each check off or on); **Column grid** (Columns: Auto (4 · 8 · 12) or 4–16, Gutter, Margin, Baseline); **Performance budgets** (Pro): Transferred (kB), Requests, LCP (ms), CLS — empty means no limit.                  |
| **Your brand** (Pro) | **Name**, **Website**, **Logo** (PNG, JPEG or WebP up to 150 KB) and **Mention Breakpointer** — shown on reports, Check pages reports and images instead of Breakpointer.                                                                                                                                                                             |
| **Saved pages**      | Your starred pages: **Open** or remove them.                                                                                                                                                                                                                                                                                                          |
| **Backup & reset**   | **Export settings** / **Import settings** (JSON); **Visual baselines** (delete per page or **Delete all baselines**); **Reset workspace** (restores the default viewports, keeps saved groups).                                                                                                                                                       |
| **Plan**             | Free plan, Pro trial or licence: **Try Pro free for 7 days**, **Get Pro**, a **Licence key** field with **Activate**, who it's licensed to and until when, **Remove licence**, and **What's in Pro**.                                                                                                                                                 |
| **Privacy & access** | **Manage site access**, **Customize Chrome shortcuts** and the version.                                                                                                                                                                                                                                                                               |

The ten languages are English, Tiếng Việt, Español, Português (Brasil), Français, Deutsch, 日本語, Bahasa Indonesia, 简体中文 and Русский. They cover the interface, Chrome's menus and the store listing.

**Export and import.** An export contains your viewports, groups, preferences, saved pages, CSS snippets, projects, QA checks, budgets and brand — so a team can share one setup. It never contains recent or last addresses, visual baselines, site access, your licence key or the trial date. Importing only replaces what the file contains, and can be undone.

---

<a id="breakpointer-pro"></a>

## 10. Breakpointer Pro

Everything Breakpointer did before Pro is free and stays free. Pro adds tools for people who test websites for a living:

| Pro feature           | What it does                                                                                                     | Where                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Accessibility checks  | Images without alt text, unnamed buttons and links, unlabeled fields, focus on hidden elements, no page language | Cards, audit, width scanner, Check pages              |
| Sync clicks & typing  | Clicks and typing in one preview repeated in every preview of the page                                           | Tools, Settings → Preview tools                       |
| Hide cookie banners   | Consent banners of 25+ common tools out of sight (nothing accepted)                                              | Tools                                                 |
| Unlimited projects    | Up to 50 projects instead of one                                                                                 | Projects                                              |
| Performance budgets   | Limits for page weight, requests, LCP and CLS; previews over a limit marked                                      | Settings → Preview tools; the audit's Performance tab |
| Your brand on reports | Your name, website and logo on reports and images you send                                                       | Settings → Your brand                                 |
| CSV & JSON exports    | Results of Check pages, width scans and audits for spreadsheets and scripts                                      | **Export** in those three places                      |

On the free plan, Pro features are marked **Pro**; selecting one shows what Pro brings.

**Free trial.** Seven days of every Pro feature, once per installation — no card, no account. Start it from the **Get Pro** button in the top bar (it counts down the days during the trial) or **Settings → Plan → Try Pro free for 7 days**.

**Buying and activating.**

1. Click **Get Pro** in the top bar, then **Get Pro** in the dialog: the purchase page opens in a new tab. (If the dialog says licences go on sale soon, you can still start the trial.)
2. Copy the licence key from your purchase email.
3. **Settings → Plan** (or “Enter a licence key” in the palette) → paste it in **Licence key** → **Activate**.
4. Settings → Plan shows who it's licensed to and until when (or **Never expires**). **Remove licence** forgets it in this browser, with Undo.

The key is checked in your browser with a public key built into Breakpointer — no account, no server, nothing sent.

---

<a id="keyboard-shortcuts"></a>

## 11. Keyboard shortcuts

Single-key shortcuts work in the workspace, not while you type in a field or while a dialog or menu is open. They also pause while a preview has the focus: click the workspace background to use them again. They follow the physical key, so they work with Vietnamese input methods and other keyboard layouts.

| Key                   | Action                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Ctrl/⌘ + K` or `K`   | Command palette                                                                                                         |
| `/`                   | Focus the address bar                                                                                                   |
| `R`                   | Reload all previews                                                                                                     |
| `A`                   | Add viewport                                                                                                            |
| `G`                   | Groups                                                                                                                  |
| `F`                   | Fit viewports to the screen                                                                                             |
| `+` / `−`             | Zoom in / out                                                                                                           |
| `0`                   | Zoom to 100%                                                                                                            |
| `L`                   | Switch layout (wrap → row → stack)                                                                                      |
| `\`                   | Show or hide the viewports sidebar                                                                                      |
| `M`                   | Rulers                                                                                                                  |
| `I`                   | Inspect an element                                                                                                      |
| `E`                   | Audit                                                                                                                   |
| `W`                   | Scan every width                                                                                                        |
| `B`                   | Check pages                                                                                                             |
| `V`                   | Visual check                                                                                                            |
| `Q`                   | QA checklist                                                                                                            |
| `U`                   | CSS toolkit — **New in 0.11**                                                                                           |
| `J`                   | Elements: HTML and CSS — **New in 0.13**                                                                                |
| `X`                   | Measure                                                                                                                 |
| `N`                   | Notes                                                                                                                   |
| `C`                   | Colour contrast                                                                                                         |
| `O`                   | Layout outlines                                                                                                         |
| `P`                   | Floating preview                                                                                                        |
| `D`                   | Present mode                                                                                                            |
| `H`                   | “What's this?” mode                                                                                                     |
| `S`                   | Capture the visible workspace                                                                                           |
| `T`                   | Switch theme                                                                                                            |
| `[` / `]`             | Focus the previous / next viewport                                                                                      |
| `1` … `8`             | Focus that viewport (again: show all)                                                                                   |
| `Esc`                 | Leave present mode, picking, measuring, notes, focus, the inspector, a vision simulation, the audit or the QA checklist |
| `Alt + ←` / `Alt + →` | Previous / next previewed page (on a focused chip: move it)                                                             |
| `?`                   | Help                                                                                                                    |
| `Space` + drag        | Pan the workspace                                                                                                       |
| `Ctrl/⌘` + wheel      | Zoom all viewports                                                                                                      |
| Drag a preview's edge | Resize (`Shift`: 10 px steps, `Alt`: no snapping)                                                                       |
| `Alt + ↑` / `Alt + ↓` | Reorder a viewport in the sidebar                                                                                       |
| `Ctrl/⌘ + Enter`      | Apply live CSS (in the Live CSS dialog)                                                                                 |
| Arrow keys            | Move between cells of the QA checklist; resize a focused preview edge                                                   |

**Anywhere in Chrome:**

| Key           | Action                                    |
| ------------- | ----------------------------------------- |
| `Alt+Shift+V` | Open Breakpointer (the popup)             |
| `Alt+Shift+P` | Preview the current page                  |
| `bpt` + space | Address-bar keyword: then type an address |

Change the Chrome shortcuts at `chrome://extensions/shortcuts`.

---

<a id="privacy-and-permissions"></a>

## 12. Privacy and permissions

- No account, no server, no analytics, no tracking. Breakpointer collects nothing and sends nothing anywhere.
- Settings stay in your browser (`chrome.storage.local`); visual baselines in the extension's own database (IndexedDB); the score history (from 0.12) is kept on this device under a code made from each page's address, never the address itself.
- Previews are ordinary page loads by your browser, as if you visited the site in a tab.
- On sites you allowed, a small script packaged with Breakpointer runs inside the previews while a workspace is open, to measure the layout for its tools. It never sends page text; what it finds stays in the Breakpointer tab.
- Breakpointer Pro adds no permission and no request: licence keys are checked in your browser.

| Permission                            | Used for                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| `storage`                             | Your viewports, groups and preferences, stored locally                                    |
| `activeTab`                           | Reading the current tab's address when you invoke Breakpointer                            |
| `contextMenus`                        | “Preview in Breakpointer” on pages and links                                              |
| `declarativeNetRequestWithHostAccess` | Letting previews of sites **you allowed** ignore frame-blocking, only inside Breakpointer |
| `scripting`                           | Running Breakpointer's own script in previews of sites **you allowed**                    |
| `sidePanel`                           | The side panel preview                                                                    |
| Host access (optional)                | Asked at runtime, per site or for all sites — never at install                            |

Read the full [privacy policy](PRIVACY.md).

---

<a id="troubleshooting-and-faq"></a>

## 13. Troubleshooting and FAQ

**A preview is blank or says “refused to connect”.**
The site tells browsers not to show it inside other pages. Click **Allow on _site_** in the tip (or **Until Chrome closes**), then reload. If it still won't show, use card ⋯ → **Open in a window of this size**, or **Open as real windows**.

**A card shows HTTP 403 (or another status).**
The site answered that preview with an error: some sites refuse frames, run bot checks or need you to sign in in a tab first. Sign in in a normal tab, then reload — or open the viewport in a window of its size.

**Tools are marked “works on sites you allow”, or the audit, inspector or checks show nothing.**
Those tools run inside the previews and need [site access](#site-access). Use **Allow _site_…** in the Tools menu, the audit or the inspector, or the status bar. Vision simulations, measuring, the design overlay and the column grid work without it.

**Screenshots ask for access to all sites.**
Chrome only lets an extension capture a tab's image with access to all sites. Allow it once with **Allow and capture**; you can remove it later in Site access. Visual check and the showcase image need it too.

**I'm signed in to the site, but the previews aren't.**
With site access, the site's cookies and storage reach its previews, so your sign-in usually carries over. Some sign-in flows, cookie banners and bot checks still behave differently inside frames. Use **Open as real windows** — they're normal pages.

**Why doesn't Breakpointer emulate devices?**
Breakpointer changes the viewport size, which is what responsive CSS responds to. The user agent, pixel density, touch input and browser engine stay those of your Chrome. Device names in presets and showcase frames describe sizes, not devices. **Touch-screen styles** (New in 0.11) only switches the `hover` and `pointer` media features. For engine-specific bugs, test in the real browser or on a real device.

**This site's breakpoints are unknown.**
The page's stylesheets come from another domain and can't be read. Use a framework's set or your own breakpoints instead.

**Keyboard shortcuts don't work.**
A preview probably has the focus (you clicked inside it). Click the workspace background. Shortcuts also pause while you type in a field or a dialog is open.

**A local site doesn't load.**
Include your dev server's port, for example `localhost:5173`. Only `http://` and `https://` addresses work.

**The workspace is slow.**
Each visible preview is a full page load. Hide viewports you don't need (hidden previews don't load), stop comparing two addresses, or turn off automatic reloads.

**The width scanner stopped early.**
It checks at most 600 widths per scan and waits while the tab is hidden. Use a narrower range or a larger step; the result says how exact its edges are.

**Visual check shows changes I didn't make.**
Compare at the same window size and zoom; a viewport captured at another size shows scaling as small changes. Pause animations and hide cookie banners (Pro) for steadier captures.

**The floating preview or the eyedropper doesn't open.**
Both rely on features of recent Chrome. If yours lacks them, Breakpointer says so; type colours by hand instead of picking them.

**How do I move my setup to another computer or share it with my team?**
**Settings → Backup & reset → Export settings**, then **Import settings** on the other side. For one page and its viewports, a **workspace link** is enough.

**Where do I report a problem or a site that won't show?**
**Help → Support → Send feedback** opens GitHub's issue forms. This guide is **Help → Support → User guide** (from 0.11); it opens on GitHub, in Vietnamese when Breakpointer is set to Vietnamese.

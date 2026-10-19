# Breakpointer brand kit

Breakpointer is a lightweight, trustworthy responsive-testing toolkit for developers, designers and QA: it shows a page at several real viewport sizes so you can find where the layout breaks. The brand should feel the same way: clear, precise and calm, with one spark of warmth where it matters — the breakpoint. It is a workbench, not a gadget.

Everything in this folder is generated from source files in `brand/templates/` by one command (see [Regenerating](#regenerating)). Edit the templates rather than the PNGs.

## Assets

| File                                               | Size               | Use it for                                                             |
| -------------------------------------------------- | ------------------ | ---------------------------------------------------------------------- |
| `logo/mark.svg`                                    | vector             | The mark on its own: favicons, avatars, app icons                      |
| `logo/mark-512.png`, `logo/mark-1024.png`          | 512², 1024²        | Raster mark (transparent corners)                                      |
| `logo/mark-mono-white.svg`                         | vector             | Single-colour mark on dark or busy backgrounds                         |
| `logo/mark-mono-black.svg`                         | vector             | Single-colour mark on light backgrounds, print, stamps                 |
| `logo/lockup-horizontal-light.svg` / `@2x.png`     | 638 × 128 / 1200 w | Primary logo on light backgrounds                                      |
| `logo/lockup-horizontal-dark.svg` / `@2x.png`      | 638 × 128 / 1200 w | Primary logo on dark UI backgrounds (`#0F1114`–`#171A1F`)              |
| `logo/lockup-horizontal-on-indigo.svg` / `@2x.png` | 638 × 128 / 1200 w | Logo on the deep-indigo brand background used in promo art             |
| `store/store-icon-128.png`                         | 128²               | Chrome Web Store icon: 96 × 96 artwork with 16 px transparent padding  |
| `store/promo-small-440x280.png` (+ `-vi`)          | 440 × 280          | Chrome Web Store **small promo tile** (English / Vietnamese listing)   |
| `store/promo-marquee-1400x560.png` (+ `-vi`)       | 1400 × 560         | Chrome Web Store **marquee promo tile** (English / Vietnamese listing) |
| `social/github-social-1280x640.png`                | 1280 × 640         | GitHub repository social preview (Settings → General → Social preview) |
| `social/readme-banner-1600x500.png`                | 1600 × 500         | Header image for the project README (rounded, transparent corners)     |
| `social/demo.mp4`, `social/demo.gif`               | 1280 × 800, 800 w  | A 26-second product demo (scan, Check pages, showcase): posts, README  |

The promo tiles and the GitHub social preview are 24-bit PNGs (no alpha), as the Chrome Web Store requires for promo images. The store icon keeps its transparent padding, and the README banner keeps transparent rounded corners so it suits GitHub's light and dark themes. Store screenshots (1280 × 800) should be captured from the real extension UI, not drawn. The demo video is recorded the same way: `npm run demo-video` (needs ffmpeg).

Embed the banner at the top of the README with:

```html
<p align="center">
  <img src="brand/social/readme-banner-1600x500.png" alt="Breakpointer — Find where your layout breaks." width="100%" />
</p>
```

## Logo

**The mark** is a rounded square with an indigo gradient (`#6366F1` → `#4338CA`, top-left to bottom-right) holding two things:

- A white **B** drawn from two width blocks: a narrow block stacked on a wide one, the way a layout steps from a phone width to a desktop width. It is the initial of the name and the product's subject — layouts at different widths — in one stroke.
- An amber **breakpoint tag**, the arrow-shaped marker developers know from code editors and DevTools, pointing exactly at the spot where the narrow block ends: the breakpoint. That is the “pointer” in Breakpointer.

Three ideas, two shapes, one warm accent — so it still reads at 16 px in the Chrome toolbar. It is the same artwork as the extension icon (`assets/icon.svg`) and the in-app logo (`Logo` in `src/components/Icon/Icon.tsx`). On the 128-unit grid the B is a pair of D-shapes (`M24 28h28a16 16 0 0 1 0 32H24z` and `M24 60h38a20 20 0 0 1 0 40H24z`, stroke 11, round joins) and the tag is `M107 30H89l-11 14 11 14h18z` (stroke 4, round joins).

**The lockup** pairs the mark with the wordmark _Breakpointer_, set in Avenir Next Demi Bold with slight negative tracking and converted to outlines. “Break” takes the text colour; “pointer” takes the accent colour, echoing the tag in the mark.

- **Clear space:** keep at least ¼ of the mark's height free on every side (32 px around a 128 px mark).
- **Minimum size:** mark 16 px (it is designed to hold up as a toolbar icon); lockup 24 px tall on screen, 10 mm in print. Below that, use the mark alone.
- **Name:** always _Breakpointer_ — one word, capital B only. Never “BreakPointer”, “Break Pointer”, “Breakpoint-er” or “BP”. The store name adds the descriptor: _Breakpointer — Responsive Viewport Tester_.

Do:

- Use the light lockup on white/light grey, the dark lockup on dark UI, the on-indigo lockup on the brand night background.
- Use a mono mark when the full-colour tile would sit on a photo or a strong colour.

Don't:

- Recolour, rotate, stretch or re-letter the wordmark, or retype it in another font.
- Add shadows, glows, outlines or 3D effects to the mark.
- Put the full-colour mark on indigo/violet backgrounds where the tile disappears; use mono white instead.
- Separate the tag from the B, flip it to point away, or recolour it anything but breakpoint amber.
- Use breakpoint amber for anything other than breakpoint markers (no amber buttons, headlines or backgrounds).

## Colour

### Brand

| Token            | Hex       | Role                                                                                  |
| ---------------- | --------- | ------------------------------------------------------------------------------------- |
| Indigo 500       | `#6366F1` | Mark gradient start                                                                   |
| Indigo 700       | `#4338CA` | Mark gradient end, accent hover                                                       |
| Accent           | `#4F46E5` | Primary actions and links in the light UI; “pointer” in the light lockup              |
| Accent (dark UI) | `#8B93FF` | Primary actions in the dark UI; “pointer” in the dark lockup                          |
| Breakpoint amber | `#FBBF24` | **Only** breakpoint markers: the tag in the mark, the tags in size pills, guide lines |
| Night            | `#100E2E` | Promo background, darkest stop                                                        |
| Indigo 950       | `#1E1B4B` | Promo background, mid stop                                                            |
| Indigo 300       | `#A5B4FC` | “pointer” on night backgrounds, highlights                                            |
| Indigo 100       | `#E0E7FF` | Secondary text and labels on night backgrounds                                        |

### Product UI (from `src/styles/global.css`)

| Token                             | Light                 | Dark                  |
| --------------------------------- | --------------------- | --------------------- |
| `--bg`                            | `#F4F5F7`             | `#0F1114`             |
| `--canvas` (workspace)            | `#ECEEF2`             | `#0B0D10`             |
| `--surface`                       | `#FFFFFF`             | `#171A1F`             |
| `--surface-2`                     | `#F6F7F9`             | `#1D2127`             |
| `--border`                        | `#E1E4E9`             | `#2A3038`             |
| `--border-strong`                 | `#C9CED6`             | `#3B424D`             |
| `--text`                          | `#171A1F`             | `#E7E9EC`             |
| `--text-muted`                    | `#59626F`             | `#A2AAB5`             |
| `--text-subtle`                   | `#687180`             | `#8A94A1`             |
| `--accent`                        | `#4F46E5`             | `#8B93FF`             |
| `--accent-soft`                   | `#EEF0FF`             | `#23264A`             |
| `--danger`                        | `#C4302B`             | `#F17570`             |
| `--success`                       | `#17804A`             | `#4CC489`             |
| `--warning-text` / `--warning-bg` | `#634800` / `#FFF8E6` | `#F1D48C` / `#2A2412` |

Indigo is the brand hue; breakpoint amber is its single, deliberately small counterpoint (indigo and amber sit almost opposite each other on the colour wheel, so a few amber pixels are enough to find the breakpoint). Illustration content (the sample page's thumbnails) may use soft sky, violet, amber and green gradients, but UI chrome, buttons and type stay neutral + indigo.

## Typography

| Use                    | Typeface                                                                 | Notes                                                              |
| ---------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Wordmark               | Avenir Next Demi Bold                                                    | Outlined in the logo files; never typeset it live                  |
| Headlines in marketing | System UI (SF Pro on macOS, Segoe UI on Windows, Roboto elsewhere), Bold | Tight tracking (about −0.025 em), sentence case                    |
| Body and UI            | System UI, Regular / Semibold                                            | Same stack as the extension UI                                     |
| Dimensions and code    | `ui-monospace`, SF Mono, Menlo, Consolas                                 | Write sizes as `390 × 844` with the multiplication sign and spaces |

## Imagery

- Generic device frames only: dark graphite bezels, no notches, no logos, no recognisable hardware.
- Show the **same page** adapting at each size (3 columns on a laptop, 2 on a tablet, stacked on a phone). The sample page in `templates/shared.mjs` is built with container queries, so this is literally true in the artwork.
- Label sizes with mono dimension pills (`1440 × 900`), mirroring the product UI. Each pill starts with a tiny amber breakpoint tag, the same shape as the one in the mark.
- Backgrounds: deep-indigo night gradient with soft light and a faint dot grid, a nod to the workspace canvas.

## Voice and tone

Clear, honest, practical. Say what the product does and where it stops.

- Talk about **viewports, viewport sizes and responsive layouts**. A preview changes the layout viewport; it does not emulate a device's user agent, pixel ratio, touch input or browser engine.
- Don't write “device emulator/simulator”, “pixel-perfect on every device”, “test on real devices” or “works with every website”. Some sites refuse to be embedded; say so and offer the fallback.
- Prefer short, active sentences and concrete verbs: _preview, compare, resize, rotate, save_.
- Name limitations plainly in help text and listings; it builds trust.
- In Vietnamese, keep the same tone: friendly and concise. Keep established technical terms such as _viewport_ and _responsive_.

### Taglines and descriptions

|                   | English                                                                                                                         | Tiếng Việt                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Name              | Breakpointer                                                                                                                    | Breakpointer (not translated)                                                                                     |
| Store descriptor  | Breakpointer — Responsive Viewport Tester                                                                                       | Breakpointer — Responsive Viewport Tester                                                                         |
| Tagline           | Find where your layout breaks.                                                                                                  | Tìm chỗ bố cục bị vỡ, ở mọi kích thước. (short form: Tìm chỗ bố cục bị vỡ.)                                       |
| Secondary line    | See every screen size at once.                                                                                                  | Xem mọi kích thước màn hình cùng lúc.                                                                             |
| Short description | Responsive design tester: preview any site at many screen sizes side by side and find the exact width where your layout breaks. | Kiểm tra responsive: xem trang ở nhiều kích thước màn hình cùng lúc và tìm chính xác chiều rộng nơi bố cục bị vỡ. |
| Pitch             | See every screen size at once — side by side, right in Chrome.                                                                  | Xem mọi kích thước màn hình cùng lúc — đặt cạnh nhau, ngay trong Chrome.                                          |
| Feature chips     | Side-by-side previews · Custom sizes · Saved groups                                                                             | Xem song song · Kích thước tùy chỉnh · Lưu nhóm viewport                                                          |

The name is a portmanteau of _breakpoint_ (the width at which a responsive layout changes) and _pointer_ (it points you to it). Lead with the tagline; use the secondary line to say how.

## Regenerating

```sh
node scripts/brand/render.mjs                    # every asset
node scripts/brand/render.mjs --only marquee     # one image template: marquee | small | githubSocial | readmeBanner
node scripts/brand/render.mjs --html /tmp/brand  # also write the composed HTML for inspection
```

- Runs fully offline. Logos are rendered with `@resvg/resvg-js`; promo and social images with Playwright's Chromium (`npx playwright install chromium` once).
- Requires macOS: the wordmark is outlined from `/System/Library/Fonts/Avenir Next.ttc`, and the image templates use the macOS system fonts. On other systems the script stops with an explanation instead of producing off-brand output.
- Sources: `templates/shared.mjs` (name, palette, copy, mark, lockup, device frames, sample page), plus one module per image (`promo-marquee.mjs`, `promo-small.mjs`, `github-social.mjs`, `readme-banner.mjs`). The extension icons come from `assets/icon.svg` via `npm run icons`; keep its geometry identical to the mark in `templates/shared.mjs` and to `Logo` in `src/components/Icon/Icon.tsx`.
- The script prints each file's size, pixel dimensions and colour type, and warns if any image exceeds 1 MB.

## Store screenshots

`store/screenshots/{en,vi}/` holds the 1280 × 800 Chrome Web Store screenshots (workspace, groups, add viewport, dark theme with rulers, responsive checks, inspector, command palette, drag to resize — the store takes five, see `docs/STORE_LISTING.md`) and a popup image, captured from the real extension by `npm run screenshots` (Playwright; the demo site is a fictional page served as `https://brightside.example/`).

# Testing

## Automated

```sh
npm test            # unit tests (Vitest, jsdom)
npm run test:e2e    # builds dist + dist-e2e, then Playwright end-to-end and accessibility tests
npm run screenshots # regenerates store screenshots from the real UI (brand/store/screenshots)
```

The end-to-end suite loads the real extension into **Chrome for Testing**, Google's Chrome build for automation that Playwright bundles (156 at the time of writing). Branded Google Chrome (137 and later) no longer loads extensions from the command line, so testing in your everyday Chrome is manual: `chrome://extensions` → Developer mode → Load unpacked → `dist/`.

- **with-access** (`dist-e2e`): host access is granted in the manifest, as if the user allowed all sites, because automated tests can't click Chrome's permission prompt. Covers real viewport widths, blocked sites, frame-busting, workspace editing, groups, persistence, settings, screenshots, popup and axe checks.
- **no-access** (`dist`): the production build exactly as installed — checks the embedding notice, that blocked sites stay blocked, that screenshots explain the permission first, and that the manifest requests no host access.

Run headed with `HEADED=1 npx playwright test`.

## Manual compatibility matrix

Run on a clean Chrome profile with the packaged build (`npm run package`, then load `dist/` unpacked). Record date, Chrome version and result.

| #   | Scenario                      | Example                                            | Expected                                                                                                 |
| --- | ----------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1   | Site that allows framing      | https://example.com                                | Renders in all viewports without any prompt                                                              |
| 2   | Site that blocks framing      | a site sending `X-Frame-Options: DENY`             | Notice appears; "Allow on <site>" → Chrome prompt → previews reload and render                           |
| 3   | Same site, access refused     | as above, click "Deny"                             | Toast explains; "Open in new tab" works                                                                  |
| 4   | Responsive navigation         | a site with a hamburger menu below a breakpoint    | Phone/tablet show the mobile nav, laptop the desktop nav                                                 |
| 5   | Long page                     | any long article                                   | Each preview scrolls independently                                                                       |
| 6   | Sign-in / third-party content | a site you're logged into                          | Renders; logged-in state may differ (documented limitation). Never type real credentials during testing. |
| 7   | Frame-busting site            | a site that redirects `top`                        | Workspace stays; preview shows the page                                                                  |
| 8   | Unreachable host              | https://does-not-exist.invalid                     | "Can't reach …" with Try again / Open in new tab / Show anyway                                           |
| 9   | Exact-size window             | card menu → "Open in a window of this size"        | Content area matches (or a toast says how Chrome limited it)                                             |
| 10  | Screenshots                   | camera on a card; `S` for workspace                | First time: explanation → Chrome prompt; PNG downloads                                                   |
| 11  | Context menu & omnibox        | right-click a link; type `bpt example.com`         | Opens the workspace with that address                                                                    |
| 12  | Shortcuts                     | `Alt+Shift+V`, `Alt+Shift+P`, `?` in the workspace | Popup opens; current page previews; help opens                                                           |
| 13  | Language                      | Settings → Tiếng Việt                              | Entire UI in Vietnamese                                                                                  |
| 14  | Persistence                   | change layout, close and reopen                    | Same workspace                                                                                           |
| 15  | Two workspace tabs            | change something in one                            | The other follows; nothing is lost                                                                       |
| 16  | Link inside a preview         | click a link in one preview                        | Only that preview navigates and shows "Navigated away · Back"                                            |
| 17  | Vietnamese input method       | switch the keyboard to Telex/VNI, press R, F, ?    | Shortcuts still work                                                                                     |

## Release checklist

- [ ] `npm run lint && npm run format:check && npm run typecheck && npm test && npm run test:e2e` pass.
- [ ] `npm run package`; load the zip's contents unpacked in a clean profile; matrix above passes.
- [ ] `chrome://extensions` shows no errors; the install dialog shows **no** permission warnings.
- [ ] Permissions in the store listing match `src/manifest.ts`; privacy policy is up to date.
- [ ] No debug logging (only `console.warn` on failures).
- [ ] Version bumped in `package.json`; CHANGELOG updated; screenshots regenerated if the UI changed.

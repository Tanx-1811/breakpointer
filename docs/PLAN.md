# Breakpointer — Product & Delivery Plan

> **Version:** 0.1.0 (V1 / MVP) · **Status:** MVP built and tested; ready for store preparation
> **Source:** refines the original planning brief (`plan.md`) into a delivery plan with decisions, status and acceptance criteria.

**Product goal:** help people check how a website looks at several viewport sizes, side by side, directly in Chrome — reliably, with minimal permissions, and honest about limits.

**Principle:** start with a reliable responsive preview workflow, then grow into a broader responsive testing toolkit.

---

## 1. Status at a glance

| Milestone                      | Goal                                                                                           | Status                             | Evidence                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------- |
| M1 — Technical spike           | Prove pages render at a real viewport; know what fails and the fallback                        | ✅ Done                            | [ARCHITECTURE.md — ADR-001](ARCHITECTURE.md), `tests/e2e/spike.spec.ts` |
| M2 — Working MVP               | Toolbar, workspace, presets, custom sizes, add/remove/reload/rotate, zoom, persistence, errors | ✅ Done                            | `src/`, `tests/e2e/viewer.spec.ts`                                      |
| M3 — Quality & packaging       | Tests, accessibility, permission review, store assets, packaged build                          | ✅ Done (store submission pending) | `tests/`, `brand/`, `docs/STORE_LISTING.md`, `npm run package`          |
| M4 — Feedback-driven iteration | Small user group, privacy-respecting feedback, prioritise next features                        | ⏳ Next                            | [§8](#8-milestone-4--feedback-and-iteration)                            |

---

## 2. Decisions made

| #   | Decision                                                                                                                 | Why                                                                                                                                                                 | Revisit when                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| D1  | Render each viewport in an iframe sized to the real viewport; zoom with CSS transform                                    | Only option giving real layout for several sizes at once with public APIs                                                                                           | A supported API for multi-viewport rendering appears                                 |
| D2  | Blocked sites: **opt-in** host access (per site or all sites) + DNR session rule scoped to the viewer tab and sub-frames | Works for most sites without install-time permissions; user stays in control                                                                                        | Chrome changes DNR/permission behaviour                                              |
| D3  | Fallbacks: open in a new tab, or in a real window sized to the viewport                                                  | Some sites still won't render in frames; the user always has a path                                                                                                 | —                                                                                    |
| D4  | No backend, accounts, analytics or AI in V1                                                                              | Plan non-goals; privacy and trust                                                                                                                                   | Validated demand for sync/teams (V4)                                                 |
| D5  | Screenshots via `captureVisibleTab`, which needs "all sites" access; ask only when used, explain first                   | Chrome requires `<all_urls>` for capture; keep install permissions minimal                                                                                          | —                                                                                    |
| D6  | React + TypeScript + Vite (multi-entry MV3 build), CSS Modules, Vitest, Playwright, ESLint + Prettier                    | Plan stack; no extra runtime dependencies beyond React                                                                                                              | —                                                                                    |
| D7  | English + Vietnamese UI from day one                                                                                     | Owner's market; i18n is cheap to add early and costly later                                                                                                         | Add languages on demand                                                              |
| D8  | Max 8 viewports; hidden viewports don't load                                                                             | Each preview is a full page load (memory/CPU)                                                                                                                       | Performance data says otherwise                                                      |
| D9  | Product name **Breakpointer** (working title was ViewportLab), tagline "Find where your layout breaks"                   | Owner chose it (2026-10-13): instantly clear to frontend developers and designers (breakpoint + pointer), memorable, distinctive; no extension with this name found | Before store submission, re-check trademarks; a small npm library uses the same name |
| D10 | Address-bar keyword `bpt` instead of `vp`                                                                                | A common word or abbreviation would capture ordinary searches (e.g. "vp bank")                                                                                      | User feedback                                                                        |
| D11 | Public GitHub repository                                                                                                 | Owner decision (2026-10-13); hosts the privacy policy, issues and feedback for the store listing                                                                    | Choose a license before inviting contributions                                       |

---

## 3. Scope — what V1 delivers

### P0 (required for the first usable release) — all done

- [x] Open Breakpointer from the Chrome toolbar (popup, `Alt+Shift+V`).
- [x] Preview a typed URL or the current tab's URL (popup "Preview this page", context menu, `Alt+Shift+P`, address-bar keyword `bpt`).
- [x] Multiple viewport previews in one workspace (wrap or single-row layout).
- [x] Presets for mobile, tablet, laptop and desktop (15 sizes, named by size class — no device-emulation claims).
- [x] Custom viewport by width × height, validated (200–3840 px).
- [x] Portrait/landscape toggle per viewport.
- [x] Reload one preview, or all.
- [x] Remove a viewport (with undo) and add another.
- [x] Zoom per viewport, zoom all, and **Fit** (largest common zoom that fits the screen).
- [x] Layout and preferences saved in `chrome.storage.local`, validated on read.
- [x] Clear errors: invalid URL, unsupported scheme, unreachable host, likely embedding block.
- [x] Fallback to open a blocked site in a normal tab (plus exact-size window).

### P1 — delivered in V1

- [x] Rename and reorder viewports (card menu, drag-and-drop chips, `Alt+←/→` on chips).
- [x] Saved viewport groups (save/rename/update/delete) + 6 built-in groups (Responsive basics, Mobile QA, Tablets, Laptop & desktop, Tailwind and Bootstrap breakpoints).
- [x] Keyboard shortcuts (workspace single-key shortcuts + Chrome commands) and a help dialog.
- [x] Dark, light and system themes.
- [x] Screenshot export (one preview, or the visible workspace) — permission explained first.
- [x] Keyboard accessibility, visible focus, axe WCAG 2.1 AA checks in both themes; popup tuned for its small size.

### Extras added to make V1 complete

- [x] Show/hide viewports without losing them (hidden previews don't load).
- [x] Breakpoint labels for Tailwind and Bootstrap; pixel rulers.
- [x] Duplicate viewport; undo for remove, group apply, import, reset, group delete.
- [x] Export/import settings as JSON (browsing data excluded) for backup or team sharing.
- [x] Opt-in "remember recent addresses" (off by default, local only).
- [x] Site access manager (see and revoke what was granted); blocked-site tips with "Don’t show again".
- [x] English and Vietnamese UI; Vietnamese store listing and promo images.
- [x] First-run welcome; first page load auto-fits to the screen.

### Non-goals (unchanged)

No accounts or cloud, no AI, no collaboration, no hosted dashboard, no promise that every site embeds, no claim of real-device emulation.

---

## 4. Permissions and privacy

| Permission                            | When                     | Install warning              | Why                                                                                     |
| ------------------------------------- | ------------------------ | ---------------------------- | --------------------------------------------------------------------------------------- |
| `storage`                             | Install                  | None                         | Save viewports, groups and preferences locally                                          |
| `activeTab`                           | Install                  | None                         | Read the current tab's URL only when the user invokes Breakpointer                      |
| `contextMenus`                        | Install                  | None                         | "Preview in Breakpointer" on pages and links                                            |
| `declarativeNetRequestWithHostAccess` | Install                  | None                         | Let previews of **allowed** sites ignore frame-blocking headers, in the viewer tab only |
| Host access (`<all_urls>` subset)     | **Optional**, at runtime | Chrome prompt when requested | Per site: show blocked sites. All sites: also enables screenshots                       |

No data leaves the browser. Details: [PRIVACY.md](PRIVACY.md). Store justifications: [STORE_LISTING.md](STORE_LISTING.md).

---

## 5. Quality

| Area          | How it's covered                                                                                                                                                                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logic         | 68 unit tests (URLs, viewport ops, fit, storage validation, groups, breakpoints, i18n completeness, reducer, DNR rule, components)                                                                                                                                         |
| Behaviour     | 49 end-to-end tests in Chrome for Testing with the real extension: real viewport widths, blocked/allowed sites, frame-busting, add/resize/rotate/remove/undo, groups, persistence, malformed storage, language, theme, rulers, export/import, screenshots, popup, keyboard |
| Accessibility | axe (WCAG 2.1 A/AA, serious+critical) on the workspace, dialogs and popup in light and dark                                                                                                                                                                                |
| Permissions   | E2E asserts the production manifest's permissions and that no host access exists at install                                                                                                                                                                                |
| CI            | GitHub Actions: lint, format, typecheck, unit, build, e2e, packaged zip artifact                                                                                                                                                                                           |
| Manual        | [TESTING.md](TESTING.md) compatibility matrix and release checklist                                                                                                                                                                                                        |

---

## 6. Release plan (M3 → store)

1. `npm run package` → `release/breakpointer-0.1.0.zip`; load it unpacked in a **clean Chrome profile** and run the manual checklist in [TESTING.md](TESTING.md).
2. Create the Chrome Web Store item; upload the zip.
3. Listing: copy from [STORE_LISTING.md](STORE_LISTING.md) (EN + VI), icon `brand/store/store-icon-128.png`, screenshots `brand/store/screenshots/{en,vi}/1–5`, promo tiles `brand/store/promo-*.png`.
4. Privacy tab: single purpose, permission justifications, "does not collect user data", link to a hosted copy of [PRIVACY.md](PRIVACY.md).
5. Provide a support contact (email or GitHub issues).
6. Submit for review; publish as **unlisted** first for the M4 test group, then public.

**Owner decisions still needed:** license (the repository is public but has no license yet, so all rights are reserved), support email, publisher account, unlisted-first vs. public launch.

**Links for the store:** privacy policy https://github.com/Tanx-1811/breakpointer/blob/main/docs/PRIVACY.md · support https://github.com/Tanx-1811/breakpointer/issues · homepage https://github.com/Tanx-1811/breakpointer

---

## 7. Risks and mitigations

| Risk                               | Mitigation in V1                                                                                      | Next step                                                                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Many sites block framing           | Opt-in site access, clear notice, new-tab and exact-size-window fallbacks                             | Track "blocked" rate in feedback (M4)                                         |
| Users distrust "all sites" access  | Never requested at install; per-site option first; explained before Chrome's prompt; revocable in-app | Consider an "allow for this session only" mode                                |
| Preview differs from a real device | Copy says "viewport", not "device"; help dialog lists what isn't emulated                             | V2 could add optional UA header per workspace                                 |
| Performance with many previews     | Max 8 viewports; hidden previews don't load at all                                                    | Measure memory on low-end machines; consider lazy-loading off-screen previews |
| Looks like existing tools          | Fast workflow, saved groups, breakpoint labels, honest errors, bilingual UI                           | Validate differentiators with testers                                         |
| Scope creep                        | V2–V4 kept as ideas behind feedback                                                                   | Re-prioritise after M4                                                        |

---

## 8. Milestone 4 — feedback and iteration

**Goal:** learn what to build next from real use, without invasive analytics.

| Task                                                                 | Acceptance criteria                                                                            |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Recruit 5–10 testers (devs, designers, QA, agency)                   | Each uses it on ≥ 3 of their own sites over a week                                             |
| Add an in-app "Send feedback" link (mailto or GitHub issue template) | Reachable from Help; no data collected automatically                                           |
| Short survey                                                         | Questions: blocked-site rate, most used presets/groups, missing features, trust in permissions |
| Triage                                                               | Rank requests by frequency × effort; update this plan                                          |

Success signals (only from opt-in feedback): successful preview starts, how often sites are blocked, time to set up a workspace, 7/30-day return use, use of saved groups.

---

## 9. Roadmap after V1 (ideas, ordered by expected value)

**v0.2 — polish from feedback**

- Synchronized scrolling and navigation across previews (requires a content script on allowed sites; opt-in).
- Per-workspace custom breakpoint sets.
- "Allow for this session" site access.
- More languages if requested.

**V2 — Responsive Inspector**

- Detect horizontal overflow per viewport (content script on allowed sites).
- Inspect an element's box at each size.
- Compare two viewport configurations; export a simple report.

**V3 — Visual regression**

- Baseline screenshots per URL × viewport; diff and highlight changes; repeatable runs.

**V4 — Broader toolkit**

- Optional projects and sync, team sharing, CI integration — only if validated.

---

## 10. Definition of done (per change)

- Lint, format, typecheck, unit and e2e tests pass in CI.
- New UI strings exist in English and Vietnamese.
- Keyboard accessible with visible focus; axe passes.
- No new permission without a written justification in this plan and the store listing.
- Docs updated (README, PLAN, ARCHITECTURE as relevant) and a CHANGELOG entry added.

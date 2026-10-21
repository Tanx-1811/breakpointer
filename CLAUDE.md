# Breakpointer — notes for AI assistants

Chrome extension (MV3) that previews a page at several real viewport sizes. React 19 + TypeScript + Vite 8 (multi-entry: `src/popup`, `src/viewer`, `src/background`). Read `docs/ARCHITECTURE.md` before touching rendering, permissions or storage; scope and decisions are in `docs/PLAN.md`.

## Commands

- `npm run build` — typecheck + production build to `dist/` (load unpacked in `chrome://extensions`)
- `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test` (Vitest)
- `npm run test:e2e` — builds `dist` and `dist-e2e`, runs Playwright with the extension loaded (needs `npx playwright install chromium`)
- `npm run screenshots` — regenerates `brand/store/screenshots` from the real UI; `npm run brand` regenerates brand images (macOS)

## Conventions

- Every UI string goes in `src/i18n/en.ts` **and** `src/i18n/vi.ts` (typed; a unit test checks placeholders).
- Pure logic lives in `src/state/` and is unit-tested; components get data and callbacks, and reach Chrome APIs only through `src/services/`.
- Settings read from storage or files must go through `parseSettings` (treat stored data as untrusted).
- No new permission without updating `docs/PLAN.md` §4, `docs/PRIVACY.md` and `docs/STORE_LISTING.md`. Host access stays optional.
- Never claim device emulation in copy: previews change the viewport only.
- E2E tests wait for `html[data-ready]` before using keyboard shortcuts.
- Breakpointer Pro (`docs/PRO.md`): features free before Pro stay free; a new Pro feature is added to `src/state/plan.ts`, checked with `usePlan()`/`canUse()` and shows the upgrade dialog via `upgrade(feature)` on the free plan. Never commit a private signing key; only the e2e build may accept the test licence key.

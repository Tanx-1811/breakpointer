# Breakpointer Pro — selling and licences

How Breakpointer Pro is sold, how licence keys are made and checked, and what to do before each release. The design (and why it needs no server) is in [ARCHITECTURE.md — Plans and licences](ARCHITECTURE.md#plans-and-licences-breakpointer-pro); the decisions are D51–D57 in [PLAN.md](PLAN.md#2-decisions-made).

## What is in Pro

| Feature               | Where                                                                                                                                                   | Free plan                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Accessibility checks  | Five more checks (`missing-alt`, `unnamed-control`, `unlabeled-field`, `hidden-focus`, `missing-lang`) in cards, the audit, the scanner and Check pages | Not run; marked “Pro” in Settings → Checks to run; a note in the audit |
| Sync clicks & typing  | Tools menu, Settings → Preview tools, command palette                                                                                                   | Marked “Pro”; selecting it shows what Pro brings                       |
| Hide cookie banners   | Tools menu, command palette                                                                                                                             | Same                                                                   |
| Unlimited projects    | Projects menu: a site's whole setup saved and opened in one click                                                                                       | One project; saving a second shows what Pro brings                     |
| Your brand on reports | Settings → Your brand; reports, Check pages reports, showcase and sheet images                                                                          | Fields disabled with “See Pro”                                         |
| CSV & JSON exports    | “Export” in Check pages, the width scanner and the audit panel                                                                                          | Items marked “Pro”                                                     |

**Rule:** everything that was free before Pro stays free (D52). New Pro features are listed in `src/state/plan.ts` (`PRO_FEATURES`, `PRO_CHECK_KINDS`); the UI asks `usePlan()` / `canUse()` and opens the upgrade dialog through `upgrade(feature)`.

## Selling

1. Create a product “Breakpointer Pro” with a payment provider that is a merchant of record (it handles VAT and sales tax), for example Lemon Squeezy, Paddle or Gumroad. Decide the price and whether a licence lasts a year (`--days 365`) or forever.
2. Put the checkout page's address in `PRO_CHECKOUT_URL` in `src/utils/links.ts`. While it is empty, the extension offers the trial and says licences go on sale soon, and `npm run package` refuses to build a release (use `npm run package -- --allow-no-checkout` to ship the trial only).
3. After each sale, issue a key (below) and send it to the buyer with the provider's fulfilment email or by hand. Providers that can call a webhook can automate this later with the same signing code (`issueLicense` in `scripts/license.mjs`) in a small serverless function that holds the private key as a secret.

## Licence keys

A key is a compact JWS signed with ES256: `header.payload.signature`. The payload carries `aud` (the app it unlocks: `breakpointer`), `sub` (licence id), `name` (who it is for, shown in Settings), `plan: "pro"`, `iat` and optionally `exp` (seconds). Breakpointer refuses a key whose `aud` isn't `breakpointer`. Breakpointer checks the signature with WebCrypto against the public keys in `src/data/license-keys.ts` — offline, every time a workspace opens.

```sh
# Once: create the signing key (private half in ~/.breakpointer/license-signing-key.json, mode 600).
npm run license -- keygen --kid bp-2026

# Each sale: a key for a buyer (prints it). --days 365 for a yearly licence; omit for a lifetime one.
npm run license -- issue --name "Jane Doe <jane@example.com>" --id L-0001 --days 365

# Check a key someone sent you.
npm run license -- verify <key>
```

`BREAKPOINTER_LICENSE_KEY=/path/to/key.json` or `--key <file>` uses another signing key file.

**Back up the signing key** (e.g. in a password manager). Without it no new key can be made for the public key built into the extension, and a lost key means a new key pair and a new release. **Never commit it**: only public halves go into `src/data/license-keys.ts`.

**Rotating:** run `keygen` with a new `--kid` (and `--key` for a new file), add the printed public key to `LICENSE_KEYS` next to the old one, release, and sign new licences with the new key. Keep old public keys so licences already sold stay valid.

**Refunds:** a key can't be revoked offline. Issue yearly keys if that matters, or accept that a refunded key keeps working until it expires.

## Selling several apps

The same tooling sells any number of apps without one app's key unlocking another:

- **One merchant-of-record account**, one product (or one per term, e.g. yearly and lifetime) per app; payouts and tax reports stay in one place.
- **One publisher website** (one domain) with a page per app and shared Terms, Refund and Privacy pages: Paddle approves each domain separately, so pages under one domain need one approval.
- **One signing key per app**, so a leaked key affects one app only: `npm run license -- keygen --kid colorpicker-2026 --key ~/.breakpointer/colorpicker-signing-key.json`, and that app embeds only its own public key.
- **The product claim:** issue with `--product <app id>` (default `breakpointer`); each app accepts only its own `aud`, as defence in depth even if a key were shared.
- **A register of issued licences** (date, app, licence id, buyer, order id, term) kept with the signing keys, for support, renewals and refunds.
- Later, one small webhook function can serve every app: the provider calls it after a sale, it signs the key for that product and emails it.

## Trial

Seven days of every Pro feature, once per installation, started from the upgrade dialog or Settings → Plan. Only the start date is stored (`breakpointer.license` in `chrome.storage.local`); a clock turned back by more than a day ends it. Reinstalling allows another trial — acceptable for a developer tool without accounts.

## Testing

- Unit: `tests/unit/pro.test.ts` (keys, claims, trial, plan, exports, branding, the `license.mjs` round trip), `tests/unit/a11y.test.ts`, `tests/unit/pro-components.test.tsx`.
- End to end: `tests/e2e/pro.spec.ts` (e2e build) signs keys with the **test key** in `tests/e2e/fixtures/license-test-key.json`. Its private half is public on purpose, so only the e2e build accepts it (`ACCEPTED_LICENSE_KEYS`); `tests/e2e/pro-no-access.spec.ts` checks that the production build refuses it, and `npm run package` refuses a build that contains it.

## Before each release

- `PRO_CHECKOUT_URL` points to the live checkout (or ship with `--allow-no-checkout` on purpose).
- Issue a real key with your signing key and activate it in a clean profile with the packaged build: Settings → Plan shows “Licensed to …”.
- The store listing says Pro is paid, with a free trial (see [STORE_LISTING.md](STORE_LISTING.md)).

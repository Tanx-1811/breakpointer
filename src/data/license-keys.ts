/**
 * Public keys that sign Breakpointer Pro licences (ES256, P-256), by key id
 * (`kid` in a licence's header). Only public halves live here; the private
 * signing key stays with the publisher (`npm run license -- keygen`). To rotate,
 * add the new key and keep the old one so licences already issued stay valid.
 */
export const LICENSE_KEYS: Readonly<Record<string, JsonWebKey>> = {
  'bp-2026': {
    kty: 'EC',
    crv: 'P-256',
    x: 'b0gBwgA6Gpfl4lOZtAwlnQd94P1FvUr-MVH7zw2r32g',
    y: 'yY5xIYvK5blI3AF5uiNnaLEkPjm0JtUCZodNR-wrrco',
  },
};

/**
 * The end-to-end build also accepts licences signed with the test key in
 * tests/e2e/fixtures/license-test-key.json (its private half is public, so
 * production builds must never accept it; `npm run package` checks).
 */
export const TEST_LICENSE_KEY_ID = 'bp-test';
const TEST_LICENSE_KEYS: Readonly<Record<string, JsonWebKey>> = {
  [TEST_LICENSE_KEY_ID]: {
    kty: 'EC',
    crv: 'P-256',
    x: 'SUIfhYiFmu7iHjUcSBHj7zb7XPk6mo2eB8DL0MtTfZs',
    y: 'nchDLDsG6vFI0VHatY9EPHRj3yGXSn_v1SxUKZqvHD8',
  },
};

/** The keys this build accepts. */
export const ACCEPTED_LICENSE_KEYS: Readonly<Record<string, JsonWebKey>> =
  import.meta.env.MODE === 'e2e' ? { ...LICENSE_KEYS, ...TEST_LICENSE_KEYS } : LICENSE_KEYS;

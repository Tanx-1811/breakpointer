import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHECK_KINDS, type CheckIssue } from '../../src/agent/protocol';
import { CONSENT_BANNER_SELECTORS, consentBannerCss } from '../../src/data/consent-banners';
import { LICENSE_KEYS, TEST_LICENSE_KEY_ID } from '../../src/data/license-keys';
import { createTranslator } from '../../src/i18n/translate';
import {
  LICENSE_STORAGE_KEY,
  activateLicense,
  loadEntitlement,
  removeLicense,
  startTrial,
  verifyLicenseKey,
} from '../../src/services/license';
import { defaultSettings, parseSettings, parseSettingsImport, createSettingsExport } from '../../src/services/storage';
import { newRun, setCell, updatePage, batchReportHtml } from '../../src/state/batch';
import {
  EMPTY_BRANDING,
  activeBranding,
  normalizeBrandUrl,
  parseBranding,
  reportEyebrow,
  reportFooter,
} from '../../src/state/branding';
import { auditCsv, auditJson, batchCsv, batchJson, csvCell, scanCsv, scanJson, toCsv } from '../../src/state/export';
import {
  FREE_ENTITLEMENT,
  TRIAL_DAYS,
  base64UrlToBytes,
  bytesToBase64Url,
  decodeLicenseKey,
  entitlementOf,
  nextChange,
  normalizeLicenseKey,
  parseClaims,
  parseLicenseRecord,
  trialState,
} from '../../src/state/license';
import { PRO_CHECK_KINDS, PRO_FEATURES, canUse, isProCheck, skippedChecks } from '../../src/state/plan';
import { buildReportHtml } from '../../src/state/report';
import { settingsReducer } from '../../src/state/settings-reducer';

const t = createTranslator('en');
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 21, 10, 0, 0);

/* ---------- Signing keys made for the tests (as scripts/license.mjs does) ---------- */

const ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const json = (value: unknown) => bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));

async function makeKey(kid: string) {
  const pair = await crypto.subtle.generateKey(ALGORITHM, true, ['sign', 'verify']);
  const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { kid, privateKey: pair.privateKey, publicJwk: { kty, crv, x, y } as JsonWebKey };
}

async function sign(
  key: { kid: string; privateKey: CryptoKey },
  payload: Record<string, unknown>,
  header: Record<string, unknown> = {},
) {
  const input = `${json({ alg: 'ES256', typ: 'BPL', kid: key.kid, ...header })}.${json(payload)}`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key.privateKey,
    new TextEncoder().encode(input),
  );
  return `${input}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

const claims = (extra: Record<string, unknown> = {}) => ({
  aud: 'breakpointer',
  sub: 'L-0001',
  name: 'Jane Doe <jane@example.com>',
  plan: 'pro',
  iat: Math.floor(NOW / 1000) - 3600,
  ...extra,
});

describe('licence keys', () => {
  it('decodes base64url both ways', () => {
    const bytes = new Uint8Array([0, 255, 62, 63, 250, 1]);
    expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes);
    expect(base64UrlToBytes('a+b/')).toBeNull();
    expect(base64UrlToBytes('abcde')).toBeNull();
  });

  it('normalizes a pasted key', () => {
    expect(normalizeLicenseKey('  "abc.\n def.\r\nghi"  ')).toBe('abc.def.ghi');
  });

  it('validates claims and converts seconds to milliseconds', () => {
    expect(parseClaims(claims())).toEqual({
      id: 'L-0001',
      name: 'Jane Doe <jane@example.com>',
      plan: 'pro',
      issuedAt: (Math.floor(NOW / 1000) - 3600) * 1000,
      expiresAt: null,
    });
    const iat = Math.floor(NOW / 1000);
    expect(parseClaims(claims({ iat, exp: iat + 100 }))?.expiresAt).toBe((iat + 100) * 1000);
    expect(parseClaims(claims({ plan: 'team' }))).toBeNull();
    // A licence for another app of the same publisher, or one that names no app.
    expect(parseClaims(claims({ aud: 'color-picker-pro' }))).toBeNull();
    expect(parseClaims(claims({ aud: undefined }))).toBeNull();
    expect(parseClaims(claims({ sub: 'has space' }))).toBeNull();
    expect(parseClaims(claims({ name: '   ' }))).toBeNull();
    expect(parseClaims(claims({ name: 'x'.repeat(101) }))).toBeNull();
    expect(parseClaims(claims({ iat: 'yesterday' }))).toBeNull();
    expect(parseClaims(claims({ iat, exp: iat - 1 }))).toBeNull();
    expect(parseClaims('pro')).toBeNull();
  });

  it('refuses anything that is not an ES256 Breakpointer licence', async () => {
    const key = await makeKey('k1');
    expect(decodeLicenseKey('')).toEqual({ ok: false, problem: 'format' });
    expect(decodeLicenseKey('not a key')).toEqual({ ok: false, problem: 'format' });
    expect(decodeLicenseKey('a.b')).toEqual({ ok: false, problem: 'format' });
    expect(decodeLicenseKey(await sign(key, claims(), { alg: 'HS256' }))).toEqual({ ok: false, problem: 'format' });
    expect(decodeLicenseKey(await sign(key, claims(), { typ: 'JWT' }))).toEqual({ ok: false, problem: 'format' });
    expect(decodeLicenseKey(await sign(key, claims({ plan: 'free' })))).toEqual({ ok: false, problem: 'claims' });
    const [header, payload] = (await sign(key, claims())).split('.');
    expect(decodeLicenseKey(`${header}.${payload}.AAAA`)).toEqual({ ok: false, problem: 'signature' });
    expect(decodeLicenseKey('x'.repeat(5000))).toEqual({ ok: false, problem: 'format' });
  });

  it('verifies the signature with WebCrypto against the known keys', async () => {
    const key = await makeKey('k1');
    const other = await makeKey('k2');
    const keys = { k1: key.publicJwk };
    const licence = await sign(key, claims());
    expect(await verifyLicenseKey(licence, keys)).toMatchObject({ ok: true, claims: { id: 'L-0001' } });
    // Pasted with line breaks, as from an email.
    expect(await verifyLicenseKey(`${licence.slice(0, 40)}\n${licence.slice(40)}`, keys)).toMatchObject({ ok: true });
    // Signed by a key Breakpointer doesn't know.
    expect(await verifyLicenseKey(await sign(other, claims()), keys)).toEqual({ ok: false, problem: 'unknownKey' });
    // Signed by another key under a known id.
    expect(await verifyLicenseKey(await sign({ ...other, kid: 'k1' }, claims()), keys)).toEqual({
      ok: false,
      problem: 'signature',
    });
    // The payload changed after signing (a longer licence).
    const [header, , signature] = licence.split('.');
    const forged = `${header}.${json(claims({ name: 'Mallory' }))}.${signature}`;
    expect(await verifyLicenseKey(forged, keys)).toEqual({ ok: false, problem: 'signature' });
    // A key id that is an Object property must not be taken for a key.
    expect(await verifyLicenseKey(await sign({ ...key, kid: 'constructor' }, claims()), keys)).toEqual({
      ok: false,
      problem: 'unknownKey',
    });
  });

  it('builds production keys only from real public keys', () => {
    expect(Object.keys(LICENSE_KEYS)).not.toContain(TEST_LICENSE_KEY_ID);
    for (const jwk of Object.values(LICENSE_KEYS)) {
      expect(jwk).toMatchObject({ kty: 'EC', crv: 'P-256' });
      expect(jwk).not.toHaveProperty('d');
    }
  });

  it('accepts keys issued by scripts/license.mjs', async () => {
    const root = resolve(import.meta.dirname, '../..');
    const keyFile = resolve(root, 'tests/e2e/fixtures/license-test-key.json');
    const output = execFileSync(
      process.execPath,
      ['scripts/license.mjs', 'issue', '--key', keyFile, '--name', 'Script Test', '--id', 'L-SCRIPT', '--days', '30'],
      { cwd: root, encoding: 'utf8' },
    );
    const licence = output.trim().split('\n').pop()!;
    const { kid, kty, crv, x, y } = JSON.parse(readFileSync(keyFile, 'utf8'));
    const result = await verifyLicenseKey(licence, { [kid]: { kty, crv, x, y } });
    expect(result).toMatchObject({ ok: true, claims: { id: 'L-SCRIPT', name: 'Script Test' } });
    if (result.ok) expect(result.claims.expiresAt! - result.claims.issuedAt).toBe(30 * DAY);

    // The same signing tool and key, but a licence for another app: Breakpointer refuses it.
    const other = execFileSync(
      process.execPath,
      ['scripts/license.mjs', 'issue', '--key', keyFile, '--name', 'Other', '--product', 'color-picker-pro'],
      { cwd: root, encoding: 'utf8' },
    );
    expect(await verifyLicenseKey(other.trim().split('\n').pop()!, { [kid]: { kty, crv, x, y } })).toEqual({
      ok: false,
      problem: 'claims',
    });
  });
});

describe('trial and plan', () => {
  it('runs the trial for seven days from its start', () => {
    expect(trialState(null, NOW)).toEqual({ status: 'available' });
    expect(trialState(NOW, NOW)).toEqual({ status: 'active', endsAt: NOW + TRIAL_DAYS * DAY, daysLeft: 7 });
    expect(trialState(NOW - 6.5 * DAY, NOW)).toMatchObject({ status: 'active', daysLeft: 1 });
    expect(trialState(NOW - 7 * DAY, NOW)).toEqual({ status: 'ended', endedAt: NOW });
    // A clock turned back by days ends the trial; a few hours are tolerated.
    expect(trialState(NOW + 3 * DAY, NOW).status).toBe('ended');
    expect(trialState(NOW + 3_600_000, NOW).status).toBe('active');
  });

  it('gives Pro with a valid licence or during the trial', () => {
    const licence = parseClaims(claims())!;
    expect(entitlementOf(null, null, NOW)).toEqual(FREE_ENTITLEMENT);
    expect(entitlementOf(licence, null, NOW)).toMatchObject({ plan: 'pro', source: 'license' });
    expect(entitlementOf(null, NOW - DAY, NOW)).toMatchObject({ plan: 'pro', source: 'trial' });
    // An expired licence is still shown, and the trial (if any) still counts.
    const expired = { ...licence, expiresAt: NOW - DAY };
    expect(entitlementOf(expired, null, NOW)).toMatchObject({
      plan: 'free',
      license: { expired: true, name: 'Jane Doe <jane@example.com>' },
    });
    expect(entitlementOf(expired, NOW - DAY, NOW)).toMatchObject({ plan: 'pro', source: 'trial' });
  });

  it('knows when the plan changes by itself', () => {
    const licence = { ...parseClaims(claims())!, expiresAt: NOW + 10 * DAY };
    expect(nextChange(entitlementOf(null, null, NOW), NOW)).toBeNull();
    expect(nextChange(entitlementOf(null, NOW, NOW), NOW)).toBe(NOW + 7 * DAY);
    expect(nextChange(entitlementOf(licence, NOW, NOW), NOW)).toBe(NOW + 7 * DAY);
    expect(nextChange(entitlementOf(licence, null, NOW), NOW)).toBe(NOW + 10 * DAY);
  });

  it('reads the stored record as untrusted', () => {
    expect(parseLicenseRecord(undefined)).toEqual({ key: null, trialStartedAt: null });
    expect(parseLicenseRecord({ key: 42, trialStartedAt: 'today' })).toEqual({ key: null, trialStartedAt: null });
    expect(parseLicenseRecord({ key: ' a.b.c ', trialStartedAt: NOW })).toEqual({ key: 'a.b.c', trialStartedAt: NOW });
    expect(parseLicenseRecord({ key: 'x'.repeat(5000), trialStartedAt: -1 })).toEqual({
      key: null,
      trialStartedAt: null,
    });
  });

  it('skips the accessibility checks on the free plan only', () => {
    const pro = entitlementOf(null, NOW, NOW);
    expect(PRO_CHECK_KINDS.every(isProCheck)).toBe(true);
    expect(isProCheck('overflow')).toBe(false);
    expect(skippedChecks([], FREE_ENTITLEMENT, CHECK_KINDS)).toEqual([...PRO_CHECK_KINDS]);
    expect(skippedChecks(['overflow'], FREE_ENTITLEMENT, CHECK_KINDS)).toEqual(['overflow', ...PRO_CHECK_KINDS]);
    expect(skippedChecks(['missing-alt'], pro, CHECK_KINDS)).toEqual(['missing-alt']);
    expect(skippedChecks([], pro, CHECK_KINDS)).toEqual([]);
    for (const feature of PRO_FEATURES) {
      expect(canUse(FREE_ENTITLEMENT, feature)).toBe(false);
      expect(canUse(pro, feature)).toBe(true);
    }
  });
});

describe('licence storage', () => {
  it('keeps a valid key, starts the trial once and forgets the key', async () => {
    const licence = await sign({ kid: 'none', privateKey: (await makeKey('none')).privateKey }, claims());
    // Not signed by a key this build knows: refused and not stored.
    expect(await activateLicense(licence)).toEqual({ ok: false, problem: 'unknownKey' });
    expect((await chrome.storage.local.get(LICENSE_STORAGE_KEY))[LICENSE_STORAGE_KEY]).toBeUndefined();

    expect(await loadEntitlement(NOW)).toMatchObject({ plan: 'free', trial: { status: 'available' } });
    expect(await startTrial(NOW)).toBe(true);
    expect(await startTrial(NOW + DAY)).toBe(false);
    expect(await loadEntitlement(NOW + DAY)).toMatchObject({ plan: 'pro', source: 'trial' });
    expect(await loadEntitlement(NOW + 8 * DAY)).toMatchObject({ plan: 'free', trial: { status: 'ended' } });

    // A key stored by hand (or by an older version) is verified again: an invalid one gives nothing.
    await chrome.storage.local.set({ [LICENSE_STORAGE_KEY]: { key: licence, trialStartedAt: null } });
    expect(await loadEntitlement(NOW)).toMatchObject({ plan: 'free', license: null });
    await removeLicense();
    expect((await chrome.storage.local.get(LICENSE_STORAGE_KEY))[LICENSE_STORAGE_KEY]).toEqual({
      key: null,
      trialStartedAt: null,
    });
  });
});

describe('branding', () => {
  it('validates each field', () => {
    expect(parseBranding(undefined)).toEqual(EMPTY_BRANDING);
    expect(
      parseBranding({
        name: '  Acme   Studio ',
        url: 'javascript:alert(1)',
        logo: 'data:image/svg+xml;base64,PHN2Zz4=',
        credit: false,
      }),
    ).toEqual({ name: 'Acme Studio', url: '', logo: '', credit: false });
    expect(parseBranding({ url: 'https://acme.example/studio', logo: 'data:image/png;base64,iVBORw0KGgo=' })).toEqual({
      name: '',
      url: 'https://acme.example/studio',
      logo: 'data:image/png;base64,iVBORw0KGgo=',
      credit: true,
    });
    expect(normalizeBrandUrl('acme.example')).toBe('');
    expect(normalizeBrandUrl('https://acme.example/"><script>')).toBe('');
  });

  it('applies only with Pro and a name or logo', () => {
    const brand = { ...EMPTY_BRANDING, name: 'Acme' };
    expect(activeBranding(brand, false)).toBeNull();
    expect(activeBranding(EMPTY_BRANDING, true)).toBeNull();
    expect(activeBranding(brand, true)).toBe(brand);
  });

  it('escapes the brand in report headers and footers', () => {
    const brand = { name: '<Acme & Co>', url: 'https://acme.example/', logo: '', credit: true };
    expect(reportEyebrow(brand, 'Responsive report')).toContain('&lt;Acme &amp; Co&gt; · Responsive report');
    const footer = reportFooter(brand, t, '0.6.0', 'https://breakpointer.example');
    expect(footer).toContain(
      'Prepared by <a href="https://acme.example/" rel="noopener noreferrer">&lt;Acme &amp; Co&gt;</a>',
    );
    expect(footer).toContain('<a href="https://breakpointer.example">Breakpointer</a> 0.6.0');
    const quiet = reportFooter({ ...brand, credit: false }, t, '0.6.0', 'https://breakpointer.example');
    expect(quiet).not.toContain('Breakpointer');
    expect(reportFooter(null, t, '0.6.0', undefined)).toContain('Made with Breakpointer 0.6.0');
  });

  it('puts the brand in reports instead of Breakpointer', () => {
    const brand = { name: 'Acme Studio', url: '', logo: 'data:image/png;base64,iVBORw0KGgo=', credit: false };
    const html = buildReportHtml(
      {
        url: 'https://example.com/',
        title: 'Example',
        created: new Date(NOW),
        version: '0.6.0',
        language: 'en',
        cards: [],
        brand,
      },
      t,
    );
    expect(html).toContain('<img src="data:image/png;base64,iVBORw0KGgo=" alt="Acme Studio">');
    expect(html).toContain('Acme Studio · Responsive report');
    expect(html).not.toMatch(/Made with Breakpointer/);
    const run = newRun(['https://example.com/'], [], NOW);
    const batch = batchReportHtml(
      run,
      { created: new Date(NOW), version: '0.6.0', language: 'en', homepage: 'https://x.example', brand },
      t,
    );
    expect(batch).toContain('Acme Studio · Check pages');
  });

  it('is kept in settings, imports and exports', () => {
    let settings = defaultSettings();
    expect(settings.branding).toEqual(EMPTY_BRANDING);
    expect(settings.sync.interactions).toBe(false);
    settings = settingsReducer(settings, { type: 'setBranding', branding: { name: 'Acme' } });
    expect(settings.branding.name).toBe('Acme');
    const exported = createSettingsExport(settings);
    expect(exported.settings.branding.name).toBe('Acme');
    const imported = parseSettingsImport(exported, defaultSettings());
    expect(imported?.branding.name).toBe('Acme');
    expect(parseSettings({ sync: { interactions: true } }).sync).toEqual({
      scroll: true,
      navigation: true,
      interactions: true,
    });
  });
});

describe('exports', () => {
  const issue = (kind: CheckIssue['kind'], extra: Partial<CheckIssue> = {}): CheckIssue => ({
    kind,
    count: 2,
    samples: [{ selector: 'div.hero > img', detail: '320×200' }, { selector: 'nav > button' }],
    ...extra,
  });

  it('writes safe CSV cells', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(12)).toBe('12');
    expect(csvCell(Number.NaN)).toBe('');
    expect(csvCell(null)).toBe('');
    // Spreadsheets would run these as formulas.
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-1')).toBe("'-1");
    expect(csvCell('@sum')).toBe("'@sum");
    const csv = toCsv(['A', 'B'], [['1', 'x,y']]);
    expect(csv.startsWith('\uFEFFA,B\r\n1,"x,y"\r\n')).toBe(true);
  });

  it('exports Check pages as one row per page, size and issue', () => {
    const sizes = [
      { key: '375x667', name: 'Phone', width: 375, height: 667, colorScheme: null },
      { key: '1280x800', name: 'Laptop', width: 1280, height: 800, colorScheme: null },
    ];
    let run = newRun(['https://example.com/', 'https://example.com/missing'], sizes, NOW);
    run = setCell(run, 0, 0, {
      status: 'checked',
      issues: [issue('missing-alt'), issue('overflow', { detail: '40px' })],
    });
    run = setCell(run, 0, 1, { status: 'checked', issues: [] });
    run = updatePage(run, 1, { status: 'failed', failure: 'http', httpStatus: 404 });
    const lines = batchCsv(run, t).replace('\uFEFF', '').trim().split('\r\n');
    expect(lines[0]).toBe(
      'Page,Ended at,Viewport,Width (px),Height (px),Result,Check,Check id,Elements,Value,Examples',
    );
    expect(lines).toHaveLength(5);
    expect(lines[1]).toBe(
      'https://example.com/,,Phone,375,667,Issues,Images without alt text,missing-alt,2,,div.hero > img (320×200); nav > button',
    );
    expect(lines[2]).toContain(',overflow,2,40px,');
    expect(lines[3]).toBe('https://example.com/,,Laptop,1280,800,No issues,,,,,');
    expect(lines[4]).toBe('https://example.com/missing,,,,,Not checked: the page answered HTTP 404,,,,,');

    const data = JSON.parse(batchJson(run, '0.6.0', new Date(NOW)));
    expect(data).toMatchObject({ app: 'Breakpointer', kind: 'check-pages', version: '0.6.0', complete: false });
    expect(data.pages[0].results[0]).toEqual({
      size: '375x667',
      status: 'checked',
      issues: [
        {
          kind: 'missing-alt',
          count: 2,
          samples: [{ selector: 'div.hero > img', detail: '320×200' }, { selector: 'nav > button' }],
        },
        expect.objectContaining({ kind: 'overflow', detail: '40px' }),
      ],
    });
    expect(data.pages[1]).toMatchObject({ status: 'failed', failure: 'http', httpStatus: 404 });
  });

  it('exports a width scan by ranges', () => {
    const samples = [
      { width: 400, height: 900, issues: [] },
      { width: 320, height: 1000, issues: [issue('overflow', { detail: '30px' })] },
      { width: 360, height: 950, issues: [issue('overflow', { detail: '10px' })] },
    ];
    const lines = scanCsv(samples, t).replace('\uFEFF', '').trim().split('\r\n');
    expect(lines).toEqual([
      'Check,Check id,From (px),To (px),Worst at (px),Value',
      'Content wider than the screen,overflow,320,360,320,30px',
    ]);
    const data = JSON.parse(scanJson('https://example.com/', { from: 320, to: 400, step: 16 }, samples, '0.6.0'));
    expect(data.findings[0]).toMatchObject({
      kind: 'overflow',
      ranges: [{ from: 320, to: 360, worst: { width: 320 } }],
    });
    expect(data.samples.map((sample: { width: number }) => sample.width)).toEqual([320, 360, 400]);
  });

  it('exports the audit', () => {
    const rows = [
      { name: 'Phone', width: 375, height: 667, report: { width: 375, issues: [issue('missing-lang', { count: 1 })] } },
      { name: 'Laptop', width: 1280, height: 800, report: { width: 1280, issues: [] } },
      { name: 'Tablet', width: 768, height: 1024, report: null },
    ];
    const lines = auditCsv(rows, t).replace('\uFEFF', '').trim().split('\r\n');
    expect(lines.slice(1)).toEqual([
      'Phone,375,667,Issues,No page language,missing-lang,1,,div.hero > img (320×200); nav > button',
      'Laptop,1280,800,No issues,,,,,',
      'Tablet,768,1024,Not checked,,,,,',
    ]);
    const data = JSON.parse(auditJson('https://example.com/', rows, '0.6.0'));
    expect(data.previews.map((preview: { checked: boolean }) => preview.checked)).toEqual([true, true, false]);
  });
});

describe('cookie banners', () => {
  it('hides only tools’ own elements with valid selectors', () => {
    for (const selector of CONSENT_BANNER_SELECTORS) {
      expect(() => document.querySelector(selector), selector).not.toThrow();
      // Never a bare generic word that a page could use for its content.
      expect(selector, selector).not.toMatch(/^[.#](cookie|consent|banner|gdpr|modal|overlay)$/i);
    }
    const css = consentBannerCss();
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    // One invalid selector would drop the whole rule.
    expect(style.sheet?.cssRules.length).toBe(2);
    style.remove();
  });
});

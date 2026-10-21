/**
 * Breakpointer Pro licences, the pure part: decoding a licence key, checking
 * its claims, the free trial and the plan they add up to.
 *
 * A licence key is a compact JWS signed with ES256 (ECDSA P-256 + SHA-256) by
 * the publisher: `header.payload.signature`, each part base64url. Breakpointer
 * checks the signature in the browser against the public keys built into it
 * (data/license-keys.ts; services/license.ts) — no server, no account, and the
 * key never leaves the browser. See docs/ARCHITECTURE.md, "Plans and licences".
 */

/** `typ` of a licence key's header, so another JWS (e.g. a login token) is never taken for one. */
export const LICENSE_TYPE = 'BPL';
export const LICENSE_ALG = 'ES256';
/** A pasted key longer than this isn't a licence key (real ones are about 350 characters). */
export const MAX_LICENSE_KEY = 4096;
/** Days of Pro the free trial gives, once per installation. */
export const TRIAL_DAYS = 7;
export const MAX_LICENSE_NAME = 100;
export const MAX_LICENSE_ID = 64;

const DAY_MS = 86_400_000;
/** A clock up to this far behind the trial's start is tolerated (time zones, a clock set by hand). */
const CLOCK_SKEW_MS = DAY_MS;

export type LicenseClaims = {
  /** The licence's id, for support (the `sub` claim). */
  id: string;
  /** Who it was issued to, a name or an email address, shown in Settings. */
  name: string;
  plan: 'pro';
  /** Milliseconds since the epoch. */
  issuedAt: number;
  /** Milliseconds since the epoch; null for a licence that never expires. */
  expiresAt: number | null;
};

/** Why a key was refused. */
export type LicenseProblem =
  /** Not a licence key at all (wrong shape, not base64url, not JSON). */
  | 'format'
  /** Signed with a key this version of Breakpointer doesn't know. */
  | 'unknownKey'
  /** The signature doesn't match: the key was changed or made up. */
  | 'signature'
  /** Signed, but its contents aren't a valid licence. */
  | 'claims';

export type DecodedLicense = {
  /** Which public key signed it (the header's `kid`). */
  keyId: string;
  claims: LicenseClaims;
  /** `header.payload`, the bytes the signature covers. */
  signingInput: string;
  /** The raw signature: r and s, 32 bytes each (JWS ES256). */
  signature: Uint8Array<ArrayBuffer>;
};

export type DecodeResult = { ok: true; license: DecodedLicense } | { ok: false; problem: LicenseProblem };

/** What is kept in the browser: the key the user entered and when the trial started. */
export type LicenseRecord = {
  key: string | null;
  /** Milliseconds since the epoch; null while the trial hasn't been started. */
  trialStartedAt: number | null;
};

export const EMPTY_LICENSE_RECORD: LicenseRecord = { key: null, trialStartedAt: null };

export type TrialState =
  | { status: 'available' }
  | { status: 'active'; endsAt: number; daysLeft: number }
  | { status: 'ended'; endedAt: number };

/** What the user may use right now, and why. */
export type Entitlement = {
  plan: 'free' | 'pro';
  /** What gives Pro: a licence, or the trial (null on the free plan). */
  source: 'license' | 'trial' | null;
  /** The licence entered, valid or expired (null when none, or when it was refused). */
  license: (Pick<LicenseClaims, 'id' | 'name' | 'expiresAt'> & { expired: boolean }) | null;
  trial: TrialState;
};

export const FREE_ENTITLEMENT: Entitlement = {
  plan: 'free',
  source: null,
  license: null,
  trial: { status: 'available' },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A key as pasted from an email or a web page: spaces, line breaks and quotes around it removed. */
export function normalizeLicenseKey(text: string): string {
  return text.replace(/\s+/g, '').replace(/^["'`]+|["'`]+$/g, '');
}

const BASE64URL = /^[A-Za-z0-9_-]+$/;

export function base64UrlToBytes(text: string): Uint8Array<ArrayBuffer> | null {
  if (!BASE64URL.test(text) || text.length % 4 === 1) return null;
  try {
    const binary = atob(
      text
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(Math.ceil(text.length / 4) * 4, '='),
    );
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeJson(part: string): unknown {
  const bytes = base64UrlToBytes(part);
  if (!bytes) return undefined;
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return undefined;
  }
}

const SAFE_ID = /^[\w.:-]+$/;
const isSeconds = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1e11;

/** The claims of a licence's payload, or null when they aren't a valid Pro licence. */
export function parseClaims(payload: unknown): LicenseClaims | null {
  if (!isRecord(payload)) return null;
  const { sub, name, plan, iat, exp } = payload;
  if (plan !== 'pro') return null;
  if (typeof sub !== 'string' || !sub || sub.length > MAX_LICENSE_ID || !SAFE_ID.test(sub)) return null;
  if (typeof name !== 'string') return null;
  const shownName = name.replace(/\s+/g, ' ').trim();
  if (!shownName || shownName.length > MAX_LICENSE_NAME) return null;
  if (!isSeconds(iat)) return null;
  if (exp !== undefined && exp !== null && (!isSeconds(exp) || exp <= iat)) return null;
  return {
    id: sub,
    name: shownName,
    plan: 'pro',
    issuedAt: iat * 1000,
    expiresAt: isSeconds(exp) ? exp * 1000 : null,
  };
}

/**
 * Splits and decodes a licence key without checking its signature (that needs
 * WebCrypto: services/license.ts). Refuses anything that isn't an ES256
 * Breakpointer licence.
 */
export function decodeLicenseKey(text: string): DecodeResult {
  const key = normalizeLicenseKey(text);
  if (!key || key.length > MAX_LICENSE_KEY) return { ok: false, problem: 'format' };
  const parts = key.split('.');
  if (parts.length !== 3) return { ok: false, problem: 'format' };
  const [headerPart, payloadPart, signaturePart] = parts as [string, string, string];
  const header = decodeJson(headerPart);
  const payload = decodeJson(payloadPart);
  const signature = base64UrlToBytes(signaturePart);
  if (!isRecord(header) || payload === undefined || !signature) return { ok: false, problem: 'format' };
  if (header.alg !== LICENSE_ALG || header.typ !== LICENSE_TYPE || typeof header.kid !== 'string' || !header.kid)
    return { ok: false, problem: 'format' };
  if (signature.length !== 64) return { ok: false, problem: 'signature' };
  const claims = parseClaims(payload);
  if (!claims) return { ok: false, problem: 'claims' };
  return {
    ok: true,
    license: { keyId: header.kid, claims, signingInput: `${headerPart}.${payloadPart}`, signature },
  };
}

/** Stored data is untrusted: anything unexpected falls back to "nothing entered, trial not started". */
export function parseLicenseRecord(raw: unknown): LicenseRecord {
  if (!isRecord(raw)) return { ...EMPTY_LICENSE_RECORD };
  const key =
    typeof raw.key === 'string' && raw.key.length <= MAX_LICENSE_KEY && normalizeLicenseKey(raw.key)
      ? normalizeLicenseKey(raw.key)
      : null;
  const started = raw.trialStartedAt;
  const trialStartedAt = typeof started === 'number' && Number.isFinite(started) && started > 0 ? started : null;
  return { key, trialStartedAt };
}

export function trialState(trialStartedAt: number | null, now: number): TrialState {
  if (trialStartedAt === null) return { status: 'available' };
  const endsAt = trialStartedAt + TRIAL_DAYS * DAY_MS;
  // A start in the future means the clock was turned back: the trial is over.
  if (now >= endsAt || trialStartedAt - now > CLOCK_SKEW_MS) return { status: 'ended', endedAt: endsAt };
  return { status: 'active', endsAt, daysLeft: Math.max(1, Math.ceil((endsAt - now) / DAY_MS)) };
}

/**
 * The plan given by a verified licence's claims (null when none was entered or
 * it was refused) and the trial. A valid licence wins over the trial.
 */
export function entitlementOf(claims: LicenseClaims | null, trialStartedAt: number | null, now: number): Entitlement {
  const trial = trialState(trialStartedAt, now);
  const license = claims
    ? {
        id: claims.id,
        name: claims.name,
        expiresAt: claims.expiresAt,
        expired: claims.expiresAt !== null && now >= claims.expiresAt,
      }
    : null;
  if (license && !license.expired) return { plan: 'pro', source: 'license', license, trial };
  if (trial.status === 'active') return { plan: 'pro', source: 'trial', license, trial };
  return { plan: 'free', source: null, license, trial };
}

/** When the plan may change by itself (the trial or a licence ending); null when it won't. */
export function nextChange(entitlement: Entitlement, now: number): number | null {
  const times = [
    entitlement.trial.status === 'active' ? entitlement.trial.endsAt : null,
    entitlement.license && !entitlement.license.expired ? entitlement.license.expiresAt : null,
  ].filter((time): time is number => time !== null && time > now);
  return times.length ? Math.min(...times) : null;
}

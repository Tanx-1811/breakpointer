import { ACCEPTED_LICENSE_KEYS } from '../data/license-keys';
import {
  EMPTY_LICENSE_RECORD,
  decodeLicenseKey,
  entitlementOf,
  normalizeLicenseKey,
  parseLicenseRecord,
  type Entitlement,
  type LicenseClaims,
  type LicenseProblem,
  type LicenseRecord,
} from '../state/license';

/**
 * The licence key the user entered and when the trial started, kept apart
 * from the settings: it is personal, so it is never exported, and only this
 * browser reads it.
 */
export const LICENSE_STORAGE_KEY = 'breakpointer.license';

export type VerifyResult = { ok: true; claims: LicenseClaims } | { ok: false; problem: LicenseProblem };

const ECDSA_P256 = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const ES256 = { name: 'ECDSA', hash: 'SHA-256' } as const;

/**
 * Checks a licence key's signature with WebCrypto against the public keys this
 * build accepts. Nothing is sent anywhere. Expiry isn't checked here: an
 * expired licence is still the user's, and Settings says when it ended.
 */
export async function verifyLicenseKey(
  text: string,
  keys: Readonly<Record<string, JsonWebKey>> = ACCEPTED_LICENSE_KEYS,
  subtle: SubtleCrypto = globalThis.crypto.subtle,
): Promise<VerifyResult> {
  const decoded = decodeLicenseKey(text);
  if (!decoded.ok) return decoded;
  const { keyId, signingInput, signature, claims } = decoded.license;
  const jwk = Object.hasOwn(keys, keyId) ? keys[keyId] : undefined;
  if (!jwk) return { ok: false, problem: 'unknownKey' };
  try {
    const key = await subtle.importKey('jwk', jwk, ECDSA_P256, false, ['verify']);
    const valid = await subtle.verify(ES256, key, signature, new TextEncoder().encode(signingInput));
    return valid ? { ok: true, claims } : { ok: false, problem: 'signature' };
  } catch {
    return { ok: false, problem: 'signature' };
  }
}

export async function readLicenseRecord(): Promise<LicenseRecord> {
  try {
    return parseLicenseRecord((await chrome.storage.local.get(LICENSE_STORAGE_KEY))[LICENSE_STORAGE_KEY]);
  } catch {
    return { ...EMPTY_LICENSE_RECORD };
  }
}

async function writeLicenseRecord(record: LicenseRecord): Promise<void> {
  await chrome.storage.local.set({ [LICENSE_STORAGE_KEY]: record });
}

/** The plan as stored now: the entered key is verified again every time (stored data is untrusted). */
export async function loadEntitlement(now = Date.now()): Promise<Entitlement> {
  const record = await readLicenseRecord();
  const verified = record.key ? await verifyLicenseKey(record.key) : null;
  return entitlementOf(verified?.ok ? verified.claims : null, record.trialStartedAt, now);
}

/** Verifies a key and keeps it when it is valid (an expired one too: Settings shows it ended). */
export async function activateLicense(text: string): Promise<VerifyResult> {
  const result = await verifyLicenseKey(text);
  if (!result.ok) return result;
  const record = await readLicenseRecord();
  await writeLicenseRecord({ ...record, key: normalizeLicenseKey(text) });
  return result;
}

/** Forgets the entered key (the trial, if used, stays used). */
export async function removeLicense(): Promise<void> {
  const record = await readLicenseRecord();
  await writeLicenseRecord({ ...record, key: null });
}

/** Starts the free trial, once per installation; false when it was already used. */
export async function startTrial(now = Date.now()): Promise<boolean> {
  const record = await readLicenseRecord();
  if (record.trialStartedAt !== null) return false;
  await writeLicenseRecord({ ...record, trialStartedAt: now });
  return true;
}

/** Calls back when the licence or trial changes in any page of the extension. */
export function onLicenseChanged(callback: () => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && LICENSE_STORAGE_KEY in changes) callback();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

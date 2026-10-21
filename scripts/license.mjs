// Breakpointer Pro licence keys: create the signing key, issue keys, check a key.
//
//   npm run license -- keygen [--kid bp-2026] [--key <file>]
//   npm run license -- issue --name "Jane Doe <jane@example.com>" [--id L-0001] [--days 365] [--product breakpointer] [--key <file>]
//   npm run license -- verify <licence key> [--key <file>]
//
// The private signing key never goes into the repository: by default it lives
// in ~/.breakpointer/license-signing-key.json (or the file in
// BREAKPOINTER_LICENSE_KEY / --key). Keep a backup in a password manager:
// without it no new key can be issued for the public key built into
// Breakpointer (src/data/license-keys.ts). Keys are compact JWS (ES256), see
// src/state/license.ts.
import { webcrypto } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { subtle } = webcrypto;
const ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN = { name: 'ECDSA', hash: 'SHA-256' };

const toBase64Url = (bytes) => Buffer.from(bytes).toString('base64url');
const fromBase64Url = (text) => new Uint8Array(Buffer.from(text, 'base64url'));
const jsonPart = (value) => toBase64Url(new TextEncoder().encode(JSON.stringify(value)));

/** The public half of a signing key, as built into Breakpointer. */
export function publicJwk(jwk) {
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
}

export async function generateSigningKey(kid) {
  const pair = await subtle.generateKey(ALGORITHM, true, ['sign', 'verify']);
  const jwk = await subtle.exportKey('jwk', pair.privateKey);
  return { kid, ...jwk, key_ops: undefined, ext: undefined };
}

/**
 * Signs a licence. `days`: how long it lasts (absent or 0: it never expires).
 * `product` (the `aud` claim) is the app it unlocks: each app accepts only its own.
 */
export async function issueLicense(signingKey, { id, name, days = 0, product = 'breakpointer', now = Date.now() }) {
  const { kid, ...jwk } = signingKey;
  const key = await subtle.importKey('jwk', { ...jwk, key_ops: ['sign'] }, ALGORITHM, false, ['sign']);
  const iat = Math.floor(now / 1000);
  const payload = {
    aud: product,
    sub: id,
    name,
    plan: 'pro',
    iat,
    ...(days > 0 ? { exp: iat + Math.round(days * 86_400) } : {}),
  };
  const signingInput = `${jsonPart({ alg: 'ES256', typ: 'BPL', kid })}.${jsonPart(payload)}`;
  const signature = new Uint8Array(await subtle.sign(SIGN, key, new TextEncoder().encode(signingInput)));
  return `${signingInput}.${toBase64Url(signature)}`;
}

/** Checks a key's signature against a signing key's public half; returns its payload, or null. */
export async function verifyLicense(signingKey, licence) {
  const [header, payload, signature] = licence.replace(/\s+/g, '').split('.');
  if (!header || !payload || !signature) return null;
  const key = await subtle.importKey('jwk', publicJwk(signingKey), ALGORITHM, false, ['verify']);
  const ok = await subtle.verify(SIGN, key, fromBase64Url(signature), new TextEncoder().encode(`${header}.${payload}`));
  if (!ok) return null;
  return {
    header: JSON.parse(Buffer.from(header, 'base64url').toString('utf8')),
    payload: JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')),
  };
}

const defaultKeyFile = () =>
  process.env.BREAKPOINTER_LICENSE_KEY || resolve(homedir(), '.breakpointer', 'license-signing-key.json');

function readSigningKey(file) {
  if (!existsSync(file)) {
    console.error(`No signing key at ${file}. Create one with: npm run license -- keygen`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      key: { type: 'string' },
      kid: { type: 'string', default: `bp-${new Date().getFullYear()}` },
      name: { type: 'string' },
      id: { type: 'string' },
      days: { type: 'string', default: '0' },
      product: { type: 'string', default: 'breakpointer' },
    },
  });
  const [command, argument] = positionals;
  const file = resolve(values.key ?? defaultKeyFile());

  if (command === 'keygen') {
    if (existsSync(file)) {
      console.error(`${file} already exists; refusing to replace a signing key. Use --key for another file.`);
      process.exit(1);
    }
    const signingKey = await generateSigningKey(values.kid);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(signingKey, null, 2)}\n`, { mode: 0o600 });
    chmodSync(file, 0o600);
    console.log(`Private signing key written to ${file} (back it up; never commit it).`);
    console.log('Add this public key to LICENSE_KEYS in src/data/license-keys.ts:');
    console.log(`  '${signingKey.kid}': ${JSON.stringify(publicJwk(signingKey))},`);
    return;
  }

  if (command === 'issue') {
    const name = values.name?.trim();
    if (!name) {
      console.error('Who is the licence for? Pass --name "Jane Doe <jane@example.com>".');
      process.exit(1);
    }
    const days = Number(values.days);
    if (!Number.isFinite(days) || days < 0) {
      console.error('--days must be a number of days (0: never expires).');
      process.exit(1);
    }
    const id = values.id ?? `L-${Date.now().toString(36).toUpperCase()}`;
    const product = values.product.trim();
    if (!/^[a-z0-9-]+$/.test(product)) {
      console.error('--product must be the app id, e.g. breakpointer (lower-case letters, digits and -).');
      process.exit(1);
    }
    const licence = await issueLicense(readSigningKey(file), { id, name, days, product });
    console.log(`${product} licence ${id} for ${name}${days ? `, valid for ${days} days` : ', never expires'}:\n`);
    console.log(licence);
    return;
  }

  if (command === 'verify') {
    if (!argument) {
      console.error('Pass the licence key to check.');
      process.exit(1);
    }
    const result = await verifyLicense(readSigningKey(file), argument);
    if (!result) {
      console.error('Invalid: the signature does not match this signing key.');
      process.exit(1);
    }
    const { payload } = result;
    const expires = payload.exp ? new Date(payload.exp * 1000).toISOString() : 'never';
    console.log(
      `Valid (${result.header.kid}): ${payload.aud ?? '(no product)'} licence ${payload.sub} for ${payload.name}, expires ${expires}.`,
    );
    return;
  }

  console.error('Usage: npm run license -- keygen | issue --name "…" [--days N] | verify <key>');
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

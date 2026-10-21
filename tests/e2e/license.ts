import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Licence keys for the end-to-end tests, signed with the test key that only
 * the e2e build accepts (see src/data/license-keys.ts).
 */
const TEST_KEY = JSON.parse(readFileSync(new URL('./fixtures/license-test-key.json', import.meta.url), 'utf8')) as {
  kid: string;
} & JsonWebKey;

const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

export async function testLicense({ name = 'E2E Tester', id = 'L-E2E', days = 0 } = {}): Promise<string> {
  const { kid, ...jwk } = TEST_KEY;
  const key = await webcrypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const iat = Math.floor(Date.now() / 1000) - 60;
  const payload = { aud: 'breakpointer', sub: id, name, plan: 'pro', iat, ...(days ? { exp: iat + days * 86_400 } : {}) };
  const input = `${part({ alg: 'ES256', typ: 'BPL', kid })}.${part(payload)}`;
  const signature = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(input));
  return `${input}.${Buffer.from(signature).toString('base64url')}`;
}

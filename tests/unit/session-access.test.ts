import { describe, expect, it, vi } from 'vitest';
import {
  addSessionGrant,
  cleanPatterns,
  forgetSessionGrants,
  revokeSessionGrants,
  sessionGrants,
} from '../../src/services/session-access';
import { hasNews, minorVersion } from '../../src/services/whats-new';

describe('site access until Chrome closes', () => {
  it('keeps a clean list of patterns', () => {
    expect(cleanPatterns(['*://*.a.test/*', 4, '*://*.a.test/*', null, '*://*.b.test/*'])).toEqual([
      '*://*.a.test/*',
      '*://*.b.test/*',
    ]);
    expect(cleanPatterns('nope')).toEqual([]);
    expect(cleanPatterns(['x'.repeat(400)])).toEqual([]);
  });

  it('remembers the patterns granted for this session, and forgets kept ones', async () => {
    await addSessionGrant('*://*.a.test/*');
    await addSessionGrant('*://*.b.test/*');
    await addSessionGrant('*://*.a.test/*');
    expect(await sessionGrants()).toEqual(['*://*.a.test/*', '*://*.b.test/*']);
    await forgetSessionGrants(['*://*.a.test/*']);
    expect(await sessionGrants()).toEqual(['*://*.b.test/*']);
  });

  it('removes them when Chrome starts again', async () => {
    const remove = vi.spyOn(chrome.permissions, 'remove');
    await revokeSessionGrants();
    expect(remove).not.toHaveBeenCalled();

    await addSessionGrant('*://*.a.test/*');
    await revokeSessionGrants();
    expect(remove).toHaveBeenCalledWith({ origins: ['*://*.a.test/*'] });
    expect(await sessionGrants()).toEqual([]);
  });

  it('still forgets them when Chrome refuses to remove one', async () => {
    vi.spyOn(chrome.permissions, 'remove').mockRejectedValueOnce(new Error('Required permission'));
    await addSessionGrant('*://*.a.test/*');
    await revokeSessionGrants();
    expect(await sessionGrants()).toEqual([]);
  });
});

describe("what's new", () => {
  it('is shown once per minor version', () => {
    expect(minorVersion('0.4.1')).toBe('0.4');
    expect(hasNews(undefined, '0.4.0')).toBe(true);
    expect(hasNews('0.3.0', '0.4.0')).toBe(true);
    expect(hasNews('0.4.0', '0.4.2')).toBe(false);
    expect(hasNews(42, '0.4.0')).toBe(true);
  });
});

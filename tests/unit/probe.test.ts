import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIframePreviewAdapter } from '../../src/services/preview-adapter';

const adapter = createIframePreviewAdapter();
const url = new URL('https://example.com/');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('reachability probe', () => {
  it('never guesses without host access, and skips local servers', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await adapter.probe(url, { hasAccess: false })).toEqual({ kind: 'unknown' });
    expect(await adapter.probe(new URL('http://localhost:5173/'), { hasAccess: true })).toEqual({ kind: 'unknown' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats any HTTP response as reachable, even 403', async () => {
    const cancel = vi.fn(() => Promise.resolve());
    const fetchMock = vi.fn(async () => ({ status: 403, body: { cancel } }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await adapter.probe(url, { hasAccess: true })).toEqual({ kind: 'reachable' });
    expect(fetchMock).toHaveBeenCalledWith(
      url.href,
      expect.objectContaining({ method: 'GET', mode: 'cors', credentials: 'omit' }),
    );
    expect(cancel).toHaveBeenCalled();
  });

  it('reports network failures as unreachable and timeouts as unknown', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))),
    );
    expect(await adapter.probe(url, { hasAccess: true })).toEqual({ kind: 'unreachable' });

    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: string, init: RequestInit) =>
          new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
      ),
    );
    expect(await adapter.probe(url, { hasAccess: true, timeoutMs: 20 })).toEqual({ kind: 'unknown' });
  });
});

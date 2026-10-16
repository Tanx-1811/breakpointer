import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AGENT_SOURCE, type AgentCommand, type AgentEvent } from '../../src/agent/protocol';
import { useFrameAgents, type FrameAgentHandlers } from '../../src/hooks/useFrameAgents';

const TAB = 1;
type Listener = (message: unknown, sender: chrome.runtime.MessageSender) => void;
let listeners: Listener[] = [];
const sent: { command: AgentCommand; frameId?: number }[] = [];

beforeEach(() => {
  listeners = [];
  sent.length = 0;
  Object.assign(chrome, {
    runtime: {
      id: 'extension',
      onMessage: {
        addListener: (listener: Listener) => listeners.push(listener),
        removeListener: (listener: Listener) => (listeners = listeners.filter((item) => item !== listener)),
      },
    },
    tabs: {
      sendMessage: vi.fn(async (_tab: number, command: AgentCommand, options?: { frameId?: number }) => {
        sent.push({ command, frameId: options?.frameId });
      }),
    },
  });
});
afterEach(() => vi.useRealTimers());

/** A message from the agent in frame `frameId`, named for card `cardId` (generation g1). */
function fromAgent(frameId: number, event: AgentEvent, cardId = 'a') {
  act(() => {
    for (const listener of listeners)
      listener(
        { ...event, source: AGENT_SOURCE, name: `bp:${cardId}:g1` },
        { id: 'extension', tab: { id: TAB } as chrome.tabs.Tab, frameId },
      );
  });
}

const handlers: FrameAgentHandlers = {
  onHello: () => {},
  onNavigate: () => {},
  onScroll: () => {},
  onZoom: () => {},
  onPick: () => {},
  onElement: () => {},
  onKey: () => {},
};

const hello = (href = 'https://example.com/'): AgentEvent => ({ type: 'hello', href, title: 'Example' });
const stats = (requests: number) =>
  ({
    type: 'stats',
    stats: {
      requests,
      transferred: 0,
      unknownSize: 0,
      images: 0,
      imagePixels: 0,
      shownPixels: 0,
      dpr: 1,
      elements: 0,
      height: 0,
      lcp: null,
      cls: 0,
      fonts: 0,
    },
  }) as const;

function setup(generations: Record<string, string> = { a: 'g1' }) {
  const hook = renderHook(({ frames }) => useFrameAgents(TAB, frames, handlers), {
    initialProps: { frames: generations },
  });
  fromAgent(7, hello());
  return hook;
}

const lastId = () => sent.at(-1)!.command.id;

describe('asking a preview’s agent', () => {
  it('takes only the answer to its own request', async () => {
    const { result } = setup();
    let answer: unknown;
    let first!: Promise<unknown>;
    act(() => {
      first = result.current.ask('a', { type: 'scanProbe', width: 400 }, 'scanned');
    });
    const firstId = lastId();
    act(() => {
      result.current.ask('a', { type: 'scanProbe', width: 500 }, 'scanned').then((reply) => (answer = reply));
    });
    await expect(first).rejects.toThrow('Another scanned was requested');
    // The late answer to the first request doesn't answer the second.
    fromAgent(7, { type: 'scanned', id: firstId, width: 400, height: 900, report: { width: 400, issues: [] } });
    await Promise.resolve();
    expect(answer).toBeUndefined();
    fromAgent(7, { type: 'scanned', id: lastId(), width: 500, height: 800, report: { width: 500, issues: [] } });
    await vi.waitFor(() => expect(answer).toMatchObject({ width: 500 }));
  });

  it('shares one answer between the same question asked twice', async () => {
    const { result } = setup();
    let audit!: Promise<{ stats: { requests: number } }>;
    let report!: Promise<{ stats: { requests: number } }>;
    act(() => {
      audit = result.current.ask('a', { type: 'getStats' }, 'stats');
      report = result.current.ask('a', { type: 'getStats' }, 'stats');
    });
    expect(sent.filter((item) => item.command.type === 'getStats')).toHaveLength(1);
    fromAgent(7, { ...stats(12), id: lastId() });
    await expect(audit).resolves.toMatchObject({ stats: { requests: 12 } });
    await expect(report).resolves.toMatchObject({ stats: { requests: 12 } });
  });

  it('gives up when the agent doesn’t answer in time', async () => {
    const { result } = setup();
    vi.useFakeTimers();
    let request!: Promise<unknown>;
    act(() => {
      request = result.current.ask('a', { type: 'getTypeScale' }, 'typeScale', 1000);
    });
    const failed = expect(request).rejects.toThrow('No typeScale from the preview');
    await vi.advanceTimersByTimeAsync(1001);
    await failed;
  });
});

describe('a card that leaves and comes back', () => {
  it('isn’t connected until its new frame says hello', async () => {
    const { result, rerender } = setup();
    expect(result.current.frameOf('a')?.frameId).toBe(7);
    // The dialog with the card's preview closes, and opens again on the same page.
    rerender({ frames: {} });
    rerender({ frames: { a: 'g1' } });
    expect(result.current.frameOf('a')).toBeUndefined();
    await expect(result.current.ask('a', { type: 'getStats' }, 'stats')).rejects.toThrow('No agent in that preview');
    fromAgent(9, hello());
    expect(result.current.frameOf('a')?.frameId).toBe(9);
  });
});

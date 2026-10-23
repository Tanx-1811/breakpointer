import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AgentCommand, AgentEvent, AgentReplyType } from '../agent/protocol';
import { gapBetween, type Gap } from '../state/gap';

type Ask = <T extends AgentReplyType>(
  cardId: string,
  command: AgentCommand,
  reply: T,
  timeoutMs?: number,
) => Promise<Extract<AgentEvent, { type: T }>>;

/** One preview's distance, for its frame (generation) and the pair of elements measured. */
type Measured = Record<string, { generation: string; pair: string; value: Gap | null }>;

/** How long after the previews change size the distance is measured again (their layout settles). */
const SETTLE_MS = 400;

type Options = {
  /** The two elements' selectors (null: no distance to measure). */
  pair: readonly [string, string] | null;
  cardIds: string[];
  generations: Record<string, string>;
  /** Changes whenever a preview connects, is replaced or changes size. */
  layoutKey: string;
  ask: Ask;
};

/**
 * The inspector's distance between two elements in every preview: measured when
 * the second element is picked, when previews connect or change size, and on
 * request. null: one of them isn't shown at that size (or the preview couldn't
 * be measured).
 */
export function useElementGaps({ pair, cardIds, generations, layoutKey, ask }: Options) {
  const [gaps, setGaps] = useState<Measured>({});
  const [pending, setPending] = useState(0);
  const pairKey = pair ? pair.join('\n') : '';
  const latest = useRef({ pair, cardIds, generations });
  useLayoutEffect(() => {
    latest.current = { pair, cardIds, generations };
  });

  const measure = useCallback(async () => {
    const { pair: selectors, cardIds: ids, generations: frames } = latest.current;
    if (!selectors) return;
    const key = selectors.join('\n');
    setPending((count) => count + 1);
    try {
      await Promise.all(
        ids.map(async (cardId) => {
          const generation = frames[cardId];
          if (!generation) return;
          const value = await ask(cardId, { type: 'getRects', selectors: [...selectors] }, 'rects', 2000)
            .then(({ rects: [a, b] }) => (a && b ? gapBetween(a, b) : null))
            .catch(() => null);
          setGaps((map) => ({ ...map, [cardId]: { generation, pair: key, value } }));
        }),
      );
    } finally {
      setPending((count) => count - 1);
    }
  }, [ask]);

  useEffect(() => {
    if (!pairKey) return;
    const timer = setTimeout(() => void measure(), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [pairKey, layoutKey, measure]);

  /** undefined: not measured yet. */
  const gapOf = (cardId: string): Gap | null | undefined => {
    const entry = gaps[cardId];
    return entry && entry.generation === generations[cardId] && entry.pair === pairKey ? entry.value : undefined;
  };

  return { gapOf, measuring: pending > 0, refresh: measure };
}

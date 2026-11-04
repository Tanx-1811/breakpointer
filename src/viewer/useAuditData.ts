import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  AgentCommand,
  AgentEvent,
  AgentReplyType,
  ColorSample,
  ImageSample,
  MediaQueryReport,
  PageMeta,
  PageStats,
  TypeSample,
} from '../agent/protocol';
import type { AuditTab } from '../components/AuditPanel/AuditPanel';

type Ask = <T extends AgentReplyType>(
  cardId: string,
  command: AgentCommand,
  reply: T,
  timeoutMs?: number,
) => Promise<Extract<AgentEvent, { type: T }>>;

/** A measurement of one preview's frame (its generation); null: it couldn't be measured. */
type Measured<T> = Record<string, { generation: string; value: T | null }>;

/** How long after previews connect they are measured again: their pages have loaded more by then. */
const SETTLE_MS = 2500;

type Options = {
  open: boolean;
  tab: AuditTab;
  cardIds: string[];
  generations: Record<string, string>;
  /** Changes whenever a preview's agent connects or its frame is replaced. */
  connectedKey: string;
  ask: Ask;
};

/** What each tab measures (the issues come with the checks). */
type Measure = 'stats' | 'type' | 'images' | 'colors' | 'meta' | 'media';
const MEASURE_OF: Record<Exclude<AuditTab, 'issues'>, Measure> = {
  performance: 'stats',
  type: 'type',
  images: 'images',
  colors: 'colors',
  meta: 'meta',
  media: 'media',
};

/**
 * The page stats, type samples, images, colours, meta tags and media queries of every preview for the audit panel: asked
 * for when their tab is shown, again a moment after previews connect, and on
 * request. Results are kept per frame, so a reloaded preview is never shown
 * with its previous page's numbers.
 */
export function useAuditData({ open, tab, cardIds, generations, connectedKey, ask }: Options) {
  const [stats, setStats] = useState<Measured<PageStats>>({});
  const [type, setType] = useState<Measured<TypeSample[]>>({});
  const [images, setImages] = useState<Measured<ImageSample[]>>({});
  const [colors, setColors] = useState<Measured<ColorSample>>({});
  const [meta, setMeta] = useState<Measured<PageMeta>>({});
  const [media, setMedia] = useState<Measured<MediaQueryReport>>({});
  const [pending, setPending] = useState(0);
  const latest = useRef({ cardIds, generations });
  useLayoutEffect(() => {
    latest.current = { cardIds, generations };
  });

  const measure = useCallback(
    async (which: Measure) => {
      const { cardIds: ids, generations: frames } = latest.current;
      setPending((count) => count + 1);
      try {
        await Promise.all(
          ids.map(async (cardId) => {
            const generation = frames[cardId];
            if (!generation) return;
            if (which === 'stats') {
              const value = await ask(cardId, { type: 'getStats' }, 'stats', 3000)
                .then((reply) => reply.stats)
                .catch(() => null);
              setStats((map) => ({ ...map, [cardId]: { generation, value } }));
            } else if (which === 'type') {
              const value = await ask(cardId, { type: 'getTypeScale' }, 'typeScale', 3000)
                .then((reply) => reply.samples)
                .catch(() => null);
              setType((map) => ({ ...map, [cardId]: { generation, value } }));
            } else if (which === 'images') {
              const value = await ask(cardId, { type: 'getImages' }, 'images', 3000)
                .then((reply) => reply.images)
                .catch(() => null);
              setImages((map) => ({ ...map, [cardId]: { generation, value } }));
            } else if (which === 'meta') {
              const value = await ask(cardId, { type: 'getMeta' }, 'meta', 3000)
                .then((reply) => reply.meta)
                .catch(() => null);
              setMeta((map) => ({ ...map, [cardId]: { generation, value } }));
            } else if (which === 'media') {
              const value = await ask(cardId, { type: 'getMediaQueries' }, 'mediaQueries', 3000)
                .then((reply) => reply.report)
                .catch(() => null);
              setMedia((map) => ({ ...map, [cardId]: { generation, value } }));
            } else {
              const value = await ask(cardId, { type: 'getColors' }, 'colors', 4000)
                .then((reply) => reply.colors)
                .catch(() => null);
              setColors((map) => ({ ...map, [cardId]: { generation, value } }));
            }
          }),
        );
      } finally {
        setPending((count) => count - 1);
      }
    },
    [ask],
  );

  useEffect(() => {
    if (!open || tab === 'issues') return;
    const which = MEASURE_OF[tab];
    const now = setTimeout(() => void measure(which), 0);
    const later = setTimeout(() => void measure(which), SETTLE_MS);
    return () => {
      clearTimeout(now);
      clearTimeout(later);
    };
  }, [open, tab, connectedKey, measure]);

  const refresh = useCallback(() => {
    if (tab !== 'issues') void measure(MEASURE_OF[tab]);
  }, [measure, tab]);

  /** undefined: not measured yet; null: it couldn't be (no agent in that preview). */
  const statsOf = (cardId: string): PageStats | null | undefined => {
    const entry = stats[cardId];
    return entry && entry.generation === generations[cardId] ? entry.value : undefined;
  };
  const typeOf = (cardId: string): TypeSample[] | null | undefined => {
    const entry = type[cardId];
    return entry && entry.generation === generations[cardId] ? entry.value : undefined;
  };

  const imagesOf = (cardId: string): ImageSample[] | null | undefined => {
    const entry = images[cardId];
    return entry && entry.generation === generations[cardId] ? entry.value : undefined;
  };
  const colorsOf = (cardId: string): ColorSample | null | undefined => {
    const entry = colors[cardId];
    return entry && entry.generation === generations[cardId] ? entry.value : undefined;
  };

  const metaOf = (cardId: string): PageMeta | null | undefined => {
    const entry = meta[cardId];
    return entry && entry.generation === generations[cardId] ? entry.value : undefined;
  };

  const mediaOf = (cardId: string): MediaQueryReport | null | undefined => {
    const entry = media[cardId];
    return entry && entry.generation === generations[cardId] ? entry.value : undefined;
  };

  return { statsOf, typeOf, imagesOf, colorsOf, metaOf, mediaOf, measuring: pending > 0, refresh };
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { AgentCommand, AgentEvent, CheckReport, ElementInfo, MediaReport, ScrollAnchor } from '../agent/protocol';
import { listenToAgents, parseFrameName, pingAgents, sendToAgent } from '../services/frame-agents';

/** A navigation this soon after a click or key press in the preview counts as the user's. */
export const USER_NAVIGATION_MS = 10_000;

export type FrameAgentState = {
  /** Chrome's id for the preview frame; it stays the same while the page inside changes. */
  frameId: number;
  /** An agent is running in the frame's current page. */
  connected: boolean;
  /** Which load of the card's frame this is (changes when the frame is replaced). */
  generation: string;
  href: string;
  title: string;
  report: CheckReport | null;
  /** Breakpoints and colour-scheme styles found in the page's stylesheets. */
  media: MediaReport | null;
  /** The HTTP status the page was served with (0 when unknown). */
  status: number;
};

export type FrameNavigation = {
  /** The user clicked or typed in that preview shortly before (not a redirect by the page). */
  user: boolean;
  /** A new page loaded, rather than the address changing within the page. */
  newDocument: boolean;
};

export type FrameAgentHandlers = {
  /** A frame's agent started (new page): push the current tool state to it. */
  onHello: (cardId: string) => void;
  /** The page inside a frame changed after its first load (link, form, script, single-page-app route). */
  onNavigate: (cardId: string, href: string, navigation: FrameNavigation) => void;
  /**
   * A preview scrolled. `y` is its scroll position in CSS pixels; `synced` marks
   * a scroll the workspace caused (reported only to frames asked to track scrolling).
   */
  onScroll: (cardId: string, ratio: number, anchor: ScrollAnchor | undefined, y: number, synced: boolean) => void;
  onZoom: (direction: 1 | -1) => void;
  /** The user picked an element in this preview while inspecting. */
  onPick: (cardId: string, selector: string, element: ElementInfo) => void;
  /** This preview's answer for the selected element (null: not on the page). */
  onElement: (cardId: string, selector: string, element: ElementInfo | null) => void;
  /** A key the workspace handles was pressed inside a preview. */
  onKey: (cardId: string, key: 'Escape') => void;
  /** An answer to a request (`pageMetrics`, `captureScroll`). */
  onReply?: (cardId: string, reply: Extract<AgentEvent, { type: 'metrics' | 'scrolled' }>) => void;
};

/**
 * Connects the workspace to the agents running in its preview frames.
 * `generations` maps each card to the generation of its current frame; events
 * from replaced frames are ignored.
 */
export function useFrameAgents(
  tabId: number | null,
  generations: Record<string, string>,
  handlers: FrameAgentHandlers,
) {
  const [frames, setFrames] = useState<Record<string, FrameAgentState>>({});
  const framesRef = useRef(frames);
  const generationsRef = useRef(generations);
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    generationsRef.current = generations;
    handlersRef.current = handlers;
  });

  // The ref is updated synchronously so lookups in the same tick see the latest frames.
  const update = useCallback(
    (cardId: string, patch: Partial<FrameAgentState> & Pick<FrameAgentState, 'generation'>) => {
      const all = framesRef.current;
      const previous = all[cardId];
      const base: FrameAgentState =
        previous && previous.generation === patch.generation
          ? previous
          : {
              frameId: -1,
              connected: false,
              generation: patch.generation,
              href: '',
              title: '',
              report: null,
              media: null,
              status: 0,
            };
      const next = { ...all, [cardId]: { ...base, ...patch } };
      framesRef.current = next;
      setFrames(next);
    },
    [],
  );

  useEffect(() => {
    if (tabId === null) return;
    /** When the user last clicked or typed in each card's preview. */
    const inputAt: Record<string, number> = {};
    const stop = listenToAgents(tabId, ({ message, frameId }) => {
      const parsed = parseFrameName(message.name);
      let cardId = parsed && parsed.cardId in generationsRef.current ? parsed.cardId : undefined;
      // A page can overwrite window.name (it survives into the next page): fall
      // back to the frame we already know, whose id doesn't change.
      cardId ??= Object.keys(framesRef.current).find((id) => framesRef.current[id]?.frameId === frameId);
      if (!cardId) return;
      const generation = generationsRef.current[cardId];
      if (!generation || (parsed && parsed.cardId === cardId && parsed.generation !== generation)) return;
      const previous = framesRef.current[cardId];
      const known = previous?.generation === generation ? previous : undefined;
      // A different frame (e.g. the card was hidden and shown again) starts afresh.
      const sameFrame = known !== undefined && known.frameId === frameId;
      const navigation = (newDocument: boolean): FrameNavigation => ({
        user: Date.now() - (inputAt[cardId] ?? -Infinity) < USER_NAVIGATION_MS,
        newDocument,
      });

      switch (message.type) {
        case 'hello':
          update(cardId, {
            generation,
            frameId,
            connected: true,
            href: message.href,
            title: message.title,
            status: typeof message.status === 'number' ? message.status : 0,
            // The same page saying hello again keeps its last reports until new ones arrive.
            report: sameFrame && known.href === message.href ? known.report : null,
            media: sameFrame && known.href === message.href ? known.media : null,
          });
          handlersRef.current.onHello(cardId);
          // A second page in the same frame means the preview navigated.
          if (sameFrame && known.href && known.href !== message.href)
            handlersRef.current.onNavigate(cardId, message.href, navigation(true));
          break;
        case 'location':
          update(cardId, { generation, frameId, connected: true, href: message.href, title: message.title });
          if (sameFrame && known.href !== message.href)
            handlersRef.current.onNavigate(cardId, message.href, navigation(false));
          break;
        case 'bye':
          // Not connected until the next page says hello (if it runs an agent at all).
          if (sameFrame) update(cardId, { generation, connected: false, report: null, media: null });
          break;
        case 'input':
          inputAt[cardId] = Date.now();
          break;
        case 'scroll':
          handlersRef.current.onScroll(
            cardId,
            message.ratio,
            message.anchor,
            typeof message.y === 'number' ? message.y : 0,
            message.synced === true,
          );
          break;
        case 'zoom':
          handlersRef.current.onZoom(message.direction);
          break;
        case 'checks':
          if (sameFrame) update(cardId, { generation, report: message.report });
          break;
        case 'media':
          if (sameFrame) update(cardId, { generation, media: message.report });
          break;
        case 'pick':
          if (sameFrame) handlersRef.current.onPick(cardId, message.selector, message.element);
          break;
        case 'element':
          if (sameFrame) handlersRef.current.onElement(cardId, message.selector, message.element);
          break;
        case 'key':
          handlersRef.current.onKey(cardId, message.key);
          break;
        case 'metrics':
        case 'scrolled':
          if (sameFrame) handlersRef.current.onReply?.(cardId, message);
          break;
      }
    });
    // Frames that loaded before this listener started say hello again.
    pingAgents(tabId);
    return stop;
  }, [tabId, update]);

  /** The agent state of a card's current frame, if an agent is running in it. */
  const frameOf = useCallback(
    (cardId: string): FrameAgentState | undefined => {
      const frame = frames[cardId];
      return frame && frame.generation === generations[cardId] && frame.connected ? frame : undefined;
    },
    [frames, generations],
  );

  const send = useCallback(
    (cardId: string, command: AgentCommand) => {
      const frame = framesRef.current[cardId];
      if (tabId === null || !frame || frame.generation !== generationsRef.current[cardId] || !frame.connected) return;
      sendToAgent(tabId, frame.frameId, command);
    },
    [tabId],
  );

  const broadcast = useCallback(
    (command: AgentCommand, exceptCardId?: string) => {
      for (const cardId of Object.keys(generationsRef.current)) if (cardId !== exceptCardId) send(cardId, command);
    },
    [send],
  );

  return { frameOf, send, broadcast };
}

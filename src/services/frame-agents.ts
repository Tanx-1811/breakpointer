import { AGENT_SCRIPT_ID, AGENT_SOURCE, type AgentCommand, type AgentMessage } from '../agent/protocol';

/**
 * The frame agent is a content script registered only while a workspace tab
 * is open (the service worker unregisters it when the last one closes). Chrome
 * only injects it into sites the user has allowed; on any page that isn't a
 * preview frame inside a Breakpointer workspace it returns immediately.
 */
const AGENT_SCRIPT: chrome.scripting.RegisteredContentScript = {
  id: AGENT_SCRIPT_ID,
  js: ['frame-agent.js'],
  matches: ['<all_urls>'],
  allFrames: true,
  // Early, to read the frame's name before the page can change it.
  runAt: 'document_start',
  persistAcrossSessions: false,
};

export async function ensureAgentRegistered(): Promise<boolean> {
  try {
    const [existing] = await chrome.scripting.getRegisteredContentScripts({ ids: [AGENT_SCRIPT_ID] });
    if (!existing) await chrome.scripting.registerContentScripts([AGENT_SCRIPT]);
    // Registered by an earlier version of the extension in this browser session.
    else if (existing.runAt !== AGENT_SCRIPT.runAt || existing.js?.[0] !== AGENT_SCRIPT.js![0])
      await chrome.scripting.updateContentScripts([AGENT_SCRIPT]);
    return true;
  } catch (error) {
    console.warn('[Breakpointer] Could not register the frame agent.', error);
    return false;
  }
}

export async function agentRegistered(): Promise<boolean> {
  try {
    return (await chrome.scripting.getRegisteredContentScripts({ ids: [AGENT_SCRIPT_ID] })).length > 0;
  } catch {
    return false;
  }
}

export async function unregisterAgent(): Promise<void> {
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [AGENT_SCRIPT_ID] });
  } catch {
    // Not registered.
  }
}

export type AgentEnvelope = { message: AgentMessage; frameId: number };

/** Messages from agents in this tab's preview frames. Returns an unsubscribe function. */
export function listenToAgents(tabId: number, callback: (envelope: AgentEnvelope) => void): () => void {
  const listener = (message: unknown, sender: chrome.runtime.MessageSender) => {
    if (sender.id !== chrome.runtime.id || sender.tab?.id !== tabId || sender.frameId === undefined) return;
    if (!message || typeof message !== 'object' || (message as { source?: unknown }).source !== AGENT_SOURCE) return;
    callback({ message: message as AgentMessage, frameId: sender.frameId });
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}

/** Asks every agent in the tab to say hello again. */
export function pingAgents(tabId: number): void {
  const ping: AgentCommand = { type: 'ping' };
  chrome.tabs.sendMessage(tabId, ping).catch(() => {
    // No preview frame runs an agent yet.
  });
}

export function sendToAgent(tabId: number, frameId: number, command: AgentCommand): void {
  chrome.tabs.sendMessage(tabId, command, { frameId }).catch(() => {
    // The frame navigated or was removed; its next hello re-establishes contact.
  });
}

/** The iframe name that ties an agent to its card: "bp:<card id>:<generation>". */
export function frameName(cardId: string, generation: string): string {
  return `bp:${cardId}:${generation}`;
}

export function parseFrameName(name: string): { cardId: string; generation: string } | null {
  const match = /^bp:([^:]+):(.+)$/.exec(name);
  return match ? { cardId: match[1]!, generation: match[2]! } : null;
}

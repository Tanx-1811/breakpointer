import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => cleanup());

// jsdom lacks parts of <dialog> and the Popover API.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

// jsdom hides [popover] elements but has no showPopover(); emulate opening them.
if (!HTMLElement.prototype.showPopover) {
  HTMLElement.prototype.showPopover = function showPopover(this: HTMLElement) {
    this.style.display = 'block';
  };
  HTMLElement.prototype.hidePopover = function hidePopover(this: HTMLElement) {
    this.style.display = '';
  };
}

// A minimal in-memory stand-in for the extension APIs used by the code under test.
const store = new Map<string, unknown>();
const chromeMock = {
  storage: {
    local: {
      get: vi.fn(async (key: string) => (store.has(key) ? { [key]: structuredClone(store.get(key)) } : {})),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(items)) store.set(key, structuredClone(value));
      }),
      clear: () => store.clear(),
    },
  },
  i18n: { getUILanguage: () => 'en-US' },
  permissions: {
    contains: vi.fn(async () => false),
    request: vi.fn(async () => false),
    remove: vi.fn(async () => true),
    getAll: vi.fn(async () => ({ origins: [] })),
    onAdded: { addListener: vi.fn(), removeListener: vi.fn() },
    onRemoved: { addListener: vi.fn(), removeListener: vi.fn() },
  },
};

Object.assign(globalThis, { chrome: chromeMock });
afterEach(() => store.clear());

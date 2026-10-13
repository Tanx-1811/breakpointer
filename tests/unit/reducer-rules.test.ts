import { describe, expect, it } from 'vitest';
import { embedRuleForTab } from '../../src/services/embed-rules';
import { defaultSettings } from '../../src/services/storage';
import { settingsReducer } from '../../src/state/settings-reducer';

describe('settingsReducer', () => {
  it('records visited addresses only when remembering is on', () => {
    let state = settingsReducer(defaultSettings(), { type: 'visitUrl', url: 'https://a.example/' });
    expect(state).toMatchObject({ activeUrl: 'https://a.example/', recentUrls: [] });
    state = settingsReducer(state, { type: 'setRememberRecent', rememberRecent: true });
    state = settingsReducer(state, { type: 'visitUrl', url: 'https://b.example/' });
    expect(state.recentUrls).toEqual(['https://b.example/']);
    state = settingsReducer(state, { type: 'setRememberRecent', rememberRecent: false });
    expect(state.recentUrls).toEqual([]);
  });

  it('updates a group with the current viewports', () => {
    let state = defaultSettings();
    state = settingsReducer(state, {
      type: 'saveGroup',
      group: { id: 'g', name: 'G', viewports: [{ name: 'A', width: 300, height: 600, zoom: 1 }] },
    });
    state = settingsReducer(state, { type: 'updateGroupViewports', id: 'g' });
    expect(state.groups[0]!.viewports).toHaveLength(3);
  });
});

describe('embedRuleForTab', () => {
  it('is scoped to one tab and to sub-frames, and only removes frame-blocking headers', () => {
    const rule = embedRuleForTab(42);
    expect(rule.id).toBe(42);
    expect(rule.condition).toEqual({ tabIds: [42], resourceTypes: ['sub_frame'] });
    expect(rule.action.type).toBe('modifyHeaders');
    expect(rule.action.responseHeaders).toEqual([
      { header: 'x-frame-options', operation: 'remove' },
      { header: 'content-security-policy', operation: 'remove' },
    ]);
    expect(rule.action.requestHeaders).toBeUndefined();
  });
});

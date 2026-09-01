import { describe, it, expect, beforeEach } from 'vitest';
import { usePreferencesStore } from './usePreferencesStore';

describe('usePreferencesStore', () => {
  beforeEach(() => {
    usePreferencesStore.setState({ stickyScrollEnabled: true });
    localStorage.clear();
  });

  it('initializes with stickyScrollEnabled = true by default', () => {
    const state = usePreferencesStore.getState();
    expect(state.stickyScrollEnabled).toBe(true);
  });

  it('sets stickyScrollEnabled to specified boolean value', () => {
    usePreferencesStore.getState().setStickyScrollEnabled(false);
    expect(usePreferencesStore.getState().stickyScrollEnabled).toBe(false);

    usePreferencesStore.getState().setStickyScrollEnabled(true);
    expect(usePreferencesStore.getState().stickyScrollEnabled).toBe(true);
  });

  it('toggles stickyScrollEnabled back and forth', () => {
    usePreferencesStore.getState().toggleStickyScroll();
    expect(usePreferencesStore.getState().stickyScrollEnabled).toBe(false);

    usePreferencesStore.getState().toggleStickyScroll();
    expect(usePreferencesStore.getState().stickyScrollEnabled).toBe(true);
  });
});


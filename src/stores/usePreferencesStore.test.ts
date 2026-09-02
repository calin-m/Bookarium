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

  it('initializes speech preferences with default values', () => {
    const state = usePreferencesStore.getState();
    expect(state.speechRate).toBe(1.0);
    expect(state.speechVoiceURI).toBeNull();
    expect(state.speechAutoPageAdvance).toBe(true);
    expect(state.speechHighlightEnabled).toBe(true);
  });

  it('updates speech preferences and resets them correctly', () => {
    usePreferencesStore.getState().setSpeechRate(1.5);
    usePreferencesStore.getState().setSpeechVoiceURI('Jenny');
    usePreferencesStore.getState().setSpeechAutoPageAdvance(false);
    usePreferencesStore.getState().setSpeechHighlightEnabled(false);

    let state = usePreferencesStore.getState();
    expect(state.speechRate).toBe(1.5);
    expect(state.speechVoiceURI).toBe('Jenny');
    expect(state.speechAutoPageAdvance).toBe(false);
    expect(state.speechHighlightEnabled).toBe(false);

    usePreferencesStore.getState().resetSpeechPreferences();
    state = usePreferencesStore.getState();
    expect(state.speechRate).toBe(1.0);
    expect(state.speechVoiceURI).toBeNull();
    expect(state.speechAutoPageAdvance).toBe(true);
    expect(state.speechHighlightEnabled).toBe(true);
  });
});


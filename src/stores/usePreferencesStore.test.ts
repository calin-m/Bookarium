import { describe, it, expect, beforeEach } from 'vitest';
import { usePreferencesStore, type ScholarPreferencesSnapshot } from './usePreferencesStore';

describe('usePreferencesStore', () => {
  beforeEach(() => {
    usePreferencesStore.getState().resetAllPreferencesStore();
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

  it('initializes with exitBookmarkReminderEnabled = true by default and allows toggling', () => {
    const state = usePreferencesStore.getState();
    expect(state.exitBookmarkReminderEnabled).toBe(true);

    usePreferencesStore.getState().setExitBookmarkReminderEnabled(false);
    expect(usePreferencesStore.getState().exitBookmarkReminderEnabled).toBe(false);

    usePreferencesStore.getState().toggleExitBookmarkReminder();
    expect(usePreferencesStore.getState().exitBookmarkReminderEnabled).toBe(true);
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

  it('stores customDefaults, preferencesUpdatedAt, and resets all store state via resetAllPreferencesStore', () => {
    const samplePreset: ScholarPreferencesSnapshot = {
      theme: 'sepia',
      stickyScrollEnabled: false,
      fontFamily: 'mono',
      fontSize: 22,
      lineHeight: 2.0,
      brightness: 85,
      readingMode: 'scroll',
      columnWidth: 'narrow',
      spoilerShieldEnabled: false,
      speechRate: 1.25,
      speechVoiceURI: 'Jenny',
      speechAutoPageAdvance: false,
      speechHighlightEnabled: false,
    };

    usePreferencesStore.getState().setCustomDefaults(samplePreset);
    usePreferencesStore.getState().setPreferencesUpdatedAt('2026-10-31T19:00:00.000Z');
    usePreferencesStore.getState().setStickyScrollEnabled(false);
    usePreferencesStore.getState().setExitBookmarkReminderEnabled(false);

    expect(usePreferencesStore.getState().customDefaults).toEqual(samplePreset);
    expect(usePreferencesStore.getState().preferencesUpdatedAt).toBe(
      '2026-10-31T19:00:00.000Z'
    );

    usePreferencesStore.getState().resetAllPreferencesStore();
    expect(usePreferencesStore.getState().customDefaults).toBeNull();
    expect(usePreferencesStore.getState().preferencesUpdatedAt).toBeNull();
    expect(usePreferencesStore.getState().stickyScrollEnabled).toBe(true);
    expect(usePreferencesStore.getState().exitBookmarkReminderEnabled).toBe(true);
  });
});

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/config/site-config';
import { safeLocalStorage } from '@/lib/safe-storage';
import type { AppTheme } from './useThemeStore';
import type { ReaderFontFamily, ReaderReadingMode, ReaderColumnWidth } from './useReaderStore';

export interface ScholarPreferencesSnapshot {
  theme: AppTheme;
  stickyScrollEnabled: boolean;
  fontFamily: ReaderFontFamily;
  fontSize: number;
  lineHeight: number;
  brightness: number;
  readingMode: ReaderReadingMode;
  columnWidth: ReaderColumnWidth;
  spoilerShieldEnabled: boolean;
  speechRate: number;
  speechVoiceURI: string | null;
  speechAutoPageAdvance: boolean;
  speechHighlightEnabled: boolean;
}

export interface PreferencesState {
  stickyScrollEnabled: boolean;
  setStickyScrollEnabled: (enabled: boolean) => void;
  toggleStickyScroll: () => void;

  // Read-Aloud & Audio Narration Preferences
  speechRate: number;
  speechVoiceURI: string | null;
  speechAutoPageAdvance: boolean;
  speechHighlightEnabled: boolean;
  setSpeechRate: (rate: number) => void;
  setSpeechVoiceURI: (voiceURI: string | null) => void;
  setSpeechAutoPageAdvance: (enabled: boolean) => void;
  setSpeechHighlightEnabled: (enabled: boolean) => void;
  resetSpeechPreferences: () => void;

  // User Saved Custom Default Preset & Cloud Sync Timestamp
  customDefaults: ScholarPreferencesSnapshot | null;
  preferencesUpdatedAt: string | null;
  setCustomDefaults: (preset: ScholarPreferencesSnapshot | null) => void;
  setPreferencesUpdatedAt: (updatedAt: string | null) => void;
  resetAllPreferencesStore: () => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      stickyScrollEnabled: true,
      setStickyScrollEnabled: (enabled: boolean) => set({ stickyScrollEnabled: enabled }),
      toggleStickyScroll: () => set({ stickyScrollEnabled: !get().stickyScrollEnabled }),

      speechRate: 1.0,
      speechVoiceURI: null,
      speechAutoPageAdvance: true,
      speechHighlightEnabled: true,
      setSpeechRate: (rate: number) => set({ speechRate: rate }),
      setSpeechVoiceURI: (voiceURI: string | null) => set({ speechVoiceURI: voiceURI }),
      setSpeechAutoPageAdvance: (enabled: boolean) => set({ speechAutoPageAdvance: enabled }),
      setSpeechHighlightEnabled: (enabled: boolean) => set({ speechHighlightEnabled: enabled }),
      resetSpeechPreferences: () =>
        set({
          speechRate: 1.0,
          speechVoiceURI: null,
          speechAutoPageAdvance: true,
          speechHighlightEnabled: true,
        }),

      customDefaults: null,
      preferencesUpdatedAt: null,
      setCustomDefaults: (customDefaults) => set({ customDefaults }),
      setPreferencesUpdatedAt: (preferencesUpdatedAt) => set({ preferencesUpdatedAt }),
      resetAllPreferencesStore: () =>
        set({
          stickyScrollEnabled: true,
          speechRate: 1.0,
          speechVoiceURI: null,
          speechAutoPageAdvance: true,
          speechHighlightEnabled: true,
          customDefaults: null,
          preferencesUpdatedAt: null,
        }),
    }),
    {
      name: STORAGE_KEYS.PREFERENCES,
      storage: createJSONStorage(() => safeLocalStorage),
    }
  )
);

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/config/site-config';

export interface PreferencesState {
  stickyScrollEnabled: boolean;
  setStickyScrollEnabled: (enabled: boolean) => void;
  toggleStickyScroll: () => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      stickyScrollEnabled: true,
      setStickyScrollEnabled: (enabled: boolean) => set({ stickyScrollEnabled: enabled }),
      toggleStickyScroll: () => set({ stickyScrollEnabled: !get().stickyScrollEnabled }),
    }),
    {
      name: STORAGE_KEYS.PREFERENCES,
      storage: createJSONStorage(() => localStorage),
    }
  )
);


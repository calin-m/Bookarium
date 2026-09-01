import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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
      name: 'bookarium-navigation-preferences',
      storage: createJSONStorage(() => localStorage),
    }
  )
);


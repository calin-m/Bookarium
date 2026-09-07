import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/config/site-config';
import { createClient } from '@/lib/supabase/client';
import { useHasMounted } from '@/hooks/useHasMounted';
import {
  AccoladeId,
  AccoladeDefinition,
  UnlockedAccolade,
  AccoladeEvaluationContext,
  AccoladeProgress,
} from '@/types/accolades.types';
import { ACCOLADES_CATALOG } from '@/config/accolades-config';
import { evaluateAccolades } from '@/lib/accolades-engine';

export const MAX_PINNED_ACCOLADES = 3;

export interface AccoladesState {
  unlockedAccolades: Record<AccoladeId, UnlockedAccolade>;
  pinnedAccoladeIds: AccoladeId[];
  pendingCelebrations: AccoladeDefinition[];
  activeCelebration: AccoladeDefinition | null;
  isSyncing: boolean;
  lastSyncAt: string | null;

  // Actions
  evaluateAndUnlock: (
    context: AccoladeEvaluationContext,
    userId?: string
  ) => { newlyUnlocked: AccoladeDefinition[]; progressMap: Record<AccoladeId, AccoladeProgress> };
  dismissCelebration: () => void;
  togglePin: (id: AccoladeId, userId?: string) => Promise<boolean>;
  syncWithCloud: (userId: string) => Promise<void>;
  resetAccolades: () => void;

  // Selectors
  isPinned: (id: AccoladeId) => boolean;
  isUnlocked: (id: AccoladeId) => boolean;
  getPinnedAccolades: () => AccoladeDefinition[];
}

export const useAccoladesStore = create<AccoladesState>()(
  persist(
    (set, get) => ({
      unlockedAccolades: {} as Record<AccoladeId, UnlockedAccolade>,
      pinnedAccoladeIds: [],
      pendingCelebrations: [],
      activeCelebration: null,
      isSyncing: false,
      lastSyncAt: null,

      evaluateAndUnlock: (context: AccoladeEvaluationContext, userId?: string) => {
        const state = get();
        const result = evaluateAccolades(context, ACCOLADES_CATALOG, state.unlockedAccolades);

        if (result.newlyUnlocked.length > 0) {
          const updatedUnlocked = { ...result.unlockedAccolades };
          const updatedPending = [...state.pendingCelebrations, ...result.newlyUnlocked];
          const nextActive = state.activeCelebration || result.newlyUnlocked[0];

          set({
            unlockedAccolades: updatedUnlocked,
            pendingCelebrations: updatedPending,
            activeCelebration: nextActive,
          });

          // If authenticated, asynchronously push newly unlocked accolades to Supabase
          if (userId) {
            const supabase = createClient();
            const inserts = result.newlyUnlocked.map((def) => ({
              user_id: userId,
              accolade_id: def.id,
              unlocked_at: updatedUnlocked[def.id]?.unlockedAt || new Date().toISOString(),
              is_pinned: false,
              metadata: {},
            }));

            supabase
              .from('user_accolades')
              .upsert(inserts, { onConflict: 'user_id,accolade_id' })
              .then(({ error }) => {
                if (error) {
                  console.warn('[AccoladesStore] Cloud sync error on unlock:', error.message);
                }
              });
          }
        }

        return {
          newlyUnlocked: result.newlyUnlocked,
          progressMap: result.progressMap,
        };
      },

      dismissCelebration: () => {
        const { pendingCelebrations, activeCelebration } = get();
        if (!activeCelebration) return;

        // Filter out the current celebration from pending
        const remaining = pendingCelebrations.filter((acc) => acc.id !== activeCelebration.id);
        const nextActive = remaining.length > 0 ? remaining[0] : null;

        set({
          pendingCelebrations: remaining,
          activeCelebration: nextActive,
        });
      },

      togglePin: async (id: AccoladeId, userId?: string) => {
        const state = get();
        const accolade = state.unlockedAccolades[id];
        if (!accolade) {
          // Cannot pin locked accolades
          return false;
        }

        const isCurrentlyPinned = state.pinnedAccoladeIds.includes(id);

        if (isCurrentlyPinned) {
          // Unpin
          const nextPinned = state.pinnedAccoladeIds.filter((pinnedId) => pinnedId !== id);
          const nextUnlocked = {
            ...state.unlockedAccolades,
            [id]: { ...accolade, isPinned: false },
          };

          set({
            pinnedAccoladeIds: nextPinned,
            unlockedAccolades: nextUnlocked,
          });

          if (userId) {
            const supabase = createClient();
            await supabase
              .from('user_accolades')
              .update({ is_pinned: false, updated_at: new Date().toISOString() })
              .eq('user_id', userId)
              .eq('accolade_id', id);
          }

          return true;
        } else {
          // Pin
          if (state.pinnedAccoladeIds.length >= MAX_PINNED_ACCOLADES) {
            // Cannot pin more than MAX_PINNED_ACCOLADES
            return false;
          }

          const nextPinned = [...state.pinnedAccoladeIds, id];
          const nextUnlocked = {
            ...state.unlockedAccolades,
            [id]: { ...accolade, isPinned: true },
          };

          set({
            pinnedAccoladeIds: nextPinned,
            unlockedAccolades: nextUnlocked,
          });

          if (userId) {
            const supabase = createClient();
            await supabase
              .from('user_accolades')
              .update({ is_pinned: true, updated_at: new Date().toISOString() })
              .eq('user_id', userId)
              .eq('accolade_id', id);
          }

          return true;
        }
      },

      syncWithCloud: async (userId: string) => {
        if (!userId) return;

        set({ isSyncing: true });
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('user_accolades')
            .select('*')
            .eq('user_id', userId);

          if (error) {
            console.warn('[AccoladesStore] Cloud fetch error:', error.message);
            set({ isSyncing: false });
            return;
          }

          const currentUnlocked = get().unlockedAccolades;
          const remoteRows = data || [];
          const remoteMap = new Map<string, (typeof remoteRows)[number]>();
          for (const row of remoteRows) {
            remoteMap.set(row.accolade_id, row);
          }

          // 1. Identify local accolades that are not in cloud and push them
          const localOnly = Object.values(currentUnlocked).filter(
            (local) => !remoteMap.has(local.id)
          );

          if (localOnly.length > 0) {
            const inserts = localOnly.map((acc) => ({
              user_id: userId,
              accolade_id: acc.id,
              unlocked_at: acc.unlockedAt,
              is_pinned: acc.isPinned,
              metadata: (acc.metadata || {}) as any,
            }));

            await supabase
              .from('user_accolades')
              .upsert(inserts, { onConflict: 'user_id,accolade_id' });
          }

          // 2. Merge remote records into local state
          const mergedUnlocked: Record<AccoladeId, UnlockedAccolade> = { ...currentUnlocked };
          for (const row of remoteRows) {
            const accId = row.accolade_id as AccoladeId;
            mergedUnlocked[accId] = {
              id: accId,
              unlockedAt: row.unlocked_at,
              isPinned: row.is_pinned ?? false,
              metadata: (row.metadata as Record<string, unknown>) || undefined,
            };
          }

          // 3. Derive pinned accolade IDs from merged record
          const derivedPinned = Object.values(mergedUnlocked)
            .filter((acc) => acc.isPinned)
            .map((acc) => acc.id)
            .slice(0, MAX_PINNED_ACCOLADES);

          set({
            unlockedAccolades: mergedUnlocked,
            pinnedAccoladeIds: derivedPinned,
            isSyncing: false,
            lastSyncAt: new Date().toISOString(),
          });
        } catch (err) {
          console.warn('[AccoladesStore] Unexpected error during sync:', err);
          set({ isSyncing: false });
        }
      },

      resetAccolades: () => {
        set({
          unlockedAccolades: {} as Record<AccoladeId, UnlockedAccolade>,
          pinnedAccoladeIds: [],
          pendingCelebrations: [],
          activeCelebration: null,
          isSyncing: false,
          lastSyncAt: null,
        });
      },

      isPinned: (id: AccoladeId) => get().pinnedAccoladeIds.includes(id),

      isUnlocked: (id: AccoladeId) => Boolean(get().unlockedAccolades[id]),

      getPinnedAccolades: () => {
        const { pinnedAccoladeIds } = get();
        return pinnedAccoladeIds
          .map((id) => ACCOLADES_CATALOG.find((def) => def.id === id))
          .filter((def): def is AccoladeDefinition => Boolean(def));
      },
    }),
    {
      name: STORAGE_KEYS.ACCOLADES,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        unlockedAccolades: state.unlockedAccolades,
        pinnedAccoladeIds: state.pinnedAccoladeIds,
        lastSyncAt: state.lastSyncAt,
      }),
    }
  )
);

/**
 * Hydration-safe React hook for accessing accolades store in components.
 */
export function useHydratedAccolades() {
  const hasMounted = useHasMounted();
  const store = useAccoladesStore();

  return {
    ...store,
    isHydrated: hasMounted,
  };
}


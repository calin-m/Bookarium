import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/config/site-config';
import { createClient } from '@/lib/supabase/client';
import { useHasMounted } from '@/hooks/useHasMounted';
import {
  calculateStreak,
  calculateAnnualGoalProgress,
  formatReadingDuration,
  formatLocalDate,
  type StreakStats,
  type AnnualGoalProgress,
} from '@/lib/reading-analytics';

export interface HabitsState {
  annualGoal: number;
  annualGoalYear: number;
  goalUpdatedAt: string | null;
  activeDates: string[];
  totalReadingSeconds: number;
  isSyncing: boolean;

  // Actions
  recordDailyActivity: (dateStr?: string, userId?: string) => void;
  addReadingDuration: (seconds: number, userId?: string) => void;
  setAnnualGoal: (target: number, year?: number, userId?: string) => void;
  syncWithCloud: (userId: string) => Promise<void>;
  resetHabits: () => void;

  // Computed Selectors
  getStreakStats: (referenceDate?: Date) => StreakStats;
  getAnnualProgress: (completedBooksCount: number) => AnnualGoalProgress;
  getFormattedDuration: () => string;
}

let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export const useHabitsStore = create<HabitsState>()(
  persist(
    (set, get) => ({
      annualGoal: 12,
      annualGoalYear: new Date().getFullYear(),
      goalUpdatedAt: null,
      activeDates: [],
      totalReadingSeconds: 0,
      isSyncing: false,

      recordDailyActivity: (dateStr, userId) => {
        const todayStr = dateStr || formatLocalDate(new Date());
        const currentDates = get().activeDates;

        if (!currentDates.includes(todayStr)) {
          const nextDates = [...currentDates, todayStr].sort();
          set({ activeDates: nextDates });

          if (userId) {
            get().syncWithCloud(userId).catch(() => {});
          }
        }
      },

      addReadingDuration: (seconds, userId) => {
        if (seconds <= 0) return;

        const todayStr = formatLocalDate(new Date());
        const currentDates = get().activeDates;
        const nextDates = currentDates.includes(todayStr)
          ? currentDates
          : [...currentDates, todayStr].sort();

        set((state) => ({
          totalReadingSeconds: state.totalReadingSeconds + Math.round(seconds),
          activeDates: nextDates,
        }));

        if (userId) {
          if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
          syncDebounceTimer = setTimeout(() => {
            get().syncWithCloud(userId).catch(() => {});
          }, 2000);
        }
      },

      setAnnualGoal: (target, year, userId) => {
        const safeTarget = Math.min(Math.max(Math.round(target), 1), 365);
        const safeYear = year || get().annualGoalYear || new Date().getFullYear();
        const now = new Date().toISOString();

        set({
          annualGoal: safeTarget,
          annualGoalYear: safeYear,
          goalUpdatedAt: now,
        });

        if (userId) {
          get().syncWithCloud(userId).catch(() => {});
        }
      },

      syncWithCloud: async (userId: string) => {
        if (!userId) return;
        set({ isSyncing: true });

        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('user_reading_habits')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

          if (error && error.code !== 'PGRST116') {
            // Network or schema error, fallback silently
            set({ isSyncing: false });
            return;
          }

          const localState = get();
          let mergedDates = [...localState.activeDates];
          let mergedSeconds = localState.totalReadingSeconds;
          let mergedGoal = localState.annualGoal;
          const mergedYear = localState.annualGoalYear;
          let mergedGoalUpdatedAt = localState.goalUpdatedAt;

          if (data) {
            const remoteDates = Array.isArray(data.active_dates)
              ? (data.active_dates.filter((d): d is string => typeof d === 'string'))
              : [];
            const dateSet = new Set<string>([...mergedDates, ...remoteDates]);
            mergedDates = Array.from(dateSet).sort();
            mergedSeconds = Math.max(mergedSeconds, Number(data.total_reading_seconds) || 0);

            if (data.annual_goal_year === mergedYear && data.annual_goal) {
              const remoteTime = data.updated_at ? new Date(data.updated_at).getTime() : 0;
              const localTime = localState.goalUpdatedAt ? new Date(localState.goalUpdatedAt).getTime() : 0;

              // Last-Write-Wins: only adopt remote goal if remote is strictly newer than local modification
              if (!localState.goalUpdatedAt || remoteTime > localTime) {
                mergedGoal = Number(data.annual_goal);
                mergedGoalUpdatedAt = data.updated_at || null;
              }
            }
          }

          // Update local state with merged values
          set({
            activeDates: mergedDates,
            totalReadingSeconds: mergedSeconds,
            annualGoal: mergedGoal,
            annualGoalYear: mergedYear,
            goalUpdatedAt: mergedGoalUpdatedAt,
          });

          // Upsert merged state back to Supabase
          await supabase.from('user_reading_habits').upsert(
            {
              user_id: userId,
              annual_goal: mergedGoal,
              annual_goal_year: mergedYear,
              active_dates: mergedDates,
              total_reading_seconds: mergedSeconds,
              updated_at: mergedGoalUpdatedAt || new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );
        } catch {
          // Graceful fallback for offline mode
        } finally {
          set({ isSyncing: false });
        }
      },

      resetHabits: () => {
        set({
          annualGoal: 12,
          annualGoalYear: new Date().getFullYear(),
          goalUpdatedAt: null,
          activeDates: [],
          totalReadingSeconds: 0,
        });
      },

      getStreakStats: (referenceDate) => {
        return calculateStreak(get().activeDates, referenceDate);
      },

      getAnnualProgress: (completedBooksCount) => {
        return calculateAnnualGoalProgress(
          completedBooksCount,
          get().annualGoal,
          get().annualGoalYear
        );
      },

      getFormattedDuration: () => {
        return formatReadingDuration(get().totalReadingSeconds);
      },
    }),
    {
      name: STORAGE_KEYS.HABITS,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        annualGoal: state.annualGoal,
        annualGoalYear: state.annualGoalYear,
        goalUpdatedAt: state.goalUpdatedAt,
        activeDates: state.activeDates,
        totalReadingSeconds: state.totalReadingSeconds,
      }),
    }
  )
);

/**
 * Hydration-safe React hook for accessing habits store in components.
 */
export function useHydratedHabits() {
  const hasMounted = useHasMounted();
  const store = useHabitsStore();

  return {
    ...store,
    isHydrated: hasMounted,
  };
}

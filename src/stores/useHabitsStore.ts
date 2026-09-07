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

export const MIN_STREAK_DURATION_SECONDS = 300; // 5 minutes of active immersion required for daily streak credit

export interface HabitsState {
  annualGoal: number;
  annualGoalYear: number;
  goalUpdatedAt: string | null;
  activeDates: string[];
  totalReadingSeconds: number;
  totalListeningSeconds: number;
  dailyActivitySeconds: Record<string, number>;
  isSyncing: boolean;

  // Actions
  recordDailyActivity: (dateStr?: string, userId?: string) => void;
  addReadingDuration: (seconds: number, userId?: string) => void;
  addListeningDuration: (seconds: number, userId?: string) => void;
  setAnnualGoal: (target: number, year?: number, userId?: string) => void;
  syncWithCloud: (userId: string) => Promise<void>;
  resetHabits: () => void;

  // Computed Selectors
  getStreakStats: (referenceDate?: Date) => StreakStats;
  getAnnualProgress: (completedBooksCount: number) => AnnualGoalProgress;
  getFormattedDuration: () => string;
  getTotalImmersionSeconds: () => number;
  getTodayImmersionSeconds: (dateStr?: string) => number;
  getStreakProgress: (dateStr?: string) => {
    todaySeconds: number;
    targetSeconds: number;
    remainingSeconds: number;
    remainingMinutes: number;
    percent: number;
    isUnlocked: boolean;
    isCompleted: boolean;
  };
  getFormattedDurationBreakdown: () => {
    total: string;
    reading: string;
    listening: string;
  };
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
      totalListeningSeconds: 0,
      dailyActivitySeconds: {},
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

        const rounded = Math.round(seconds);
        const todayStr = formatLocalDate(new Date());
        const currentDaily = get().dailyActivitySeconds || {};
        const newDailyToday = (currentDaily[todayStr] || 0) + rounded;
        const nextDaily = { ...currentDaily, [todayStr]: newDailyToday };

        const currentDates = get().activeDates;
        const qualifiesForStreak = newDailyToday >= MIN_STREAK_DURATION_SECONDS;
        const nextDates =
          qualifiesForStreak && !currentDates.includes(todayStr)
            ? [...currentDates, todayStr].sort()
            : currentDates;

        set((state) => ({
          totalReadingSeconds: state.totalReadingSeconds + rounded,
          dailyActivitySeconds: nextDaily,
          activeDates: nextDates,
        }));

        if (userId) {
          if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
          syncDebounceTimer = setTimeout(() => {
            get().syncWithCloud(userId).catch(() => {});
          }, 2000);
        }
      },

      addListeningDuration: (seconds, userId) => {
        if (seconds <= 0) return;

        const rounded = Math.round(seconds);
        const todayStr = formatLocalDate(new Date());
        const currentDaily = get().dailyActivitySeconds || {};
        const newDailyToday = (currentDaily[todayStr] || 0) + rounded;
        const nextDaily = { ...currentDaily, [todayStr]: newDailyToday };

        const currentDates = get().activeDates;
        const qualifiesForStreak = newDailyToday >= MIN_STREAK_DURATION_SECONDS;
        const nextDates =
          qualifiesForStreak && !currentDates.includes(todayStr)
            ? [...currentDates, todayStr].sort()
            : currentDates;

        set((state) => ({
          totalListeningSeconds: state.totalListeningSeconds + rounded,
          dailyActivitySeconds: nextDaily,
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
          let mergedReadingSeconds = localState.totalReadingSeconds || 0;
          let mergedListeningSeconds = localState.totalListeningSeconds || 0;
          let mergedGoal = localState.annualGoal;
          const mergedYear = localState.annualGoalYear;
          let mergedGoalUpdatedAt = localState.goalUpdatedAt;

          if (data) {
            const remoteDates = Array.isArray(data.active_dates)
              ? (data.active_dates.filter((d): d is string => typeof d === 'string'))
              : [];
            const dateSet = new Set<string>([...mergedDates, ...remoteDates]);
            mergedDates = Array.from(dateSet).sort();
            mergedReadingSeconds = Math.max(mergedReadingSeconds, Number(data.total_reading_seconds) || 0);
            mergedListeningSeconds = Math.max(mergedListeningSeconds, Number(data.total_listening_seconds) || 0);

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
            totalReadingSeconds: mergedReadingSeconds,
            totalListeningSeconds: mergedListeningSeconds,
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
              total_reading_seconds: mergedReadingSeconds,
              total_listening_seconds: mergedListeningSeconds,
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
          totalListeningSeconds: 0,
          dailyActivitySeconds: {},
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

      getTotalImmersionSeconds: () => {
        return (get().totalReadingSeconds || 0) + (get().totalListeningSeconds || 0);
      },

      getTodayImmersionSeconds: (dateStr) => {
        const targetDate = dateStr || formatLocalDate(new Date());
        return (get().dailyActivitySeconds || {})[targetDate] || 0;
      },

      getStreakProgress: (dateStr) => {
        const targetDate = dateStr || formatLocalDate(new Date());
        const todaySeconds = (get().dailyActivitySeconds || {})[targetDate] || 0;
        const targetSeconds = MIN_STREAK_DURATION_SECONDS;
        const remainingSeconds = Math.max(0, targetSeconds - todaySeconds);
        const remainingMinutes = Math.ceil(remainingSeconds / 60);
        const percent = Math.min(100, Math.round((todaySeconds / targetSeconds) * 100));
        const isUnlocked = todaySeconds >= targetSeconds || get().activeDates.includes(targetDate);

        return {
          todaySeconds,
          targetSeconds,
          remainingSeconds,
          remainingMinutes,
          percent,
          isUnlocked,
          isCompleted: isUnlocked,
        };
      },

      getFormattedDuration: () => {
        const total = (get().totalReadingSeconds || 0) + (get().totalListeningSeconds || 0);
        return formatReadingDuration(total);
      },

      getFormattedDurationBreakdown: () => {
        const reading = get().totalReadingSeconds || 0;
        const listening = get().totalListeningSeconds || 0;
        const total = reading + listening;
        return {
          total: formatReadingDuration(total),
          reading: formatReadingDuration(reading),
          listening: formatReadingDuration(listening),
        };
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
        totalListeningSeconds: state.totalListeningSeconds,
        dailyActivitySeconds: state.dailyActivitySeconds,
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

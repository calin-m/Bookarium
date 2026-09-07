import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useHabitsStore } from './useHabitsStore';

const { mockMaybeSingle, mockUpsert } = vi.hoisted(() => ({
  mockMaybeSingle: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
      upsert: mockUpsert,
    })),
  })),
}));

describe('useHabitsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    mockMaybeSingle.mockReset();
    mockUpsert.mockReset();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockUpsert.mockResolvedValue({ data: null, error: null });
    useHabitsStore.getState().resetHabits();
  });

  it('initializes with default values', () => {
    const state = useHabitsStore.getState();
    expect(state.annualGoal).toBe(12);
    expect(state.annualGoalYear).toBe(new Date().getFullYear());
    expect(state.activeDates).toEqual([]);
    expect(state.totalReadingSeconds).toBe(0);
    expect(state.isSyncing).toBe(false);
  });

  it('records daily activity without duplicates', () => {
    useHabitsStore.getState().recordDailyActivity('2026-09-05');
    expect(useHabitsStore.getState().activeDates).toEqual(['2026-09-05']);

    // Record same date again
    useHabitsStore.getState().recordDailyActivity('2026-09-05');
    expect(useHabitsStore.getState().activeDates).toEqual(['2026-09-05']);

    // Record next date
    useHabitsStore.getState().recordDailyActivity('2026-09-06');
    expect(useHabitsStore.getState().activeDates).toEqual(['2026-09-05', '2026-09-06']);
  });

  it('accumulates reading duration and logs today date once 5-minute threshold is met', () => {
    useHabitsStore.getState().addReadingDuration(120);
    expect(useHabitsStore.getState().totalReadingSeconds).toBe(120);
    // Under 300 seconds (5 mins), streak date is not logged yet
    expect(useHabitsStore.getState().activeDates.length).toBe(0);

    useHabitsStore.getState().addReadingDuration(180);
    expect(useHabitsStore.getState().totalReadingSeconds).toBe(300);
    // Combined today activity reached 300s, so activeDates is logged
    expect(useHabitsStore.getState().activeDates.length).toBe(1);

    // Negative or zero duration ignored
    useHabitsStore.getState().addReadingDuration(0);
    useHabitsStore.getState().addReadingDuration(-50);
    expect(useHabitsStore.getState().totalReadingSeconds).toBe(300);
  });

  it('accumulates listening duration independently and contributes to daily streak threshold', () => {
    useHabitsStore.getState().addListeningDuration(150);
    expect(useHabitsStore.getState().totalListeningSeconds).toBe(150);
    expect(useHabitsStore.getState().totalReadingSeconds).toBe(0);
    expect(useHabitsStore.getState().activeDates.length).toBe(0);

    // Add reading duration to reach combined 300 seconds
    useHabitsStore.getState().addReadingDuration(150);
    expect(useHabitsStore.getState().totalListeningSeconds).toBe(150);
    expect(useHabitsStore.getState().totalReadingSeconds).toBe(150);
    expect(useHabitsStore.getState().activeDates.length).toBe(1);

    // Negative or zero duration ignored
    useHabitsStore.getState().addListeningDuration(0);
    useHabitsStore.getState().addListeningDuration(-100);
    expect(useHabitsStore.getState().totalListeningSeconds).toBe(150);
  });

  it('updates annual reading target clamped between 1 and 365', () => {
    useHabitsStore.getState().setAnnualGoal(25, 2026);
    expect(useHabitsStore.getState().annualGoal).toBe(25);
    expect(useHabitsStore.getState().annualGoalYear).toBe(2026);

    // Clamps below 1
    useHabitsStore.getState().setAnnualGoal(-5);
    expect(useHabitsStore.getState().annualGoal).toBe(1);

    // Clamps above 365
    useHabitsStore.getState().setAnnualGoal(500);
    expect(useHabitsStore.getState().annualGoal).toBe(365);
  });

  it('resets habits back to defaults', () => {
    useHabitsStore.getState().setAnnualGoal(50);
    useHabitsStore.getState().addReadingDuration(5000);
    useHabitsStore.getState().recordDailyActivity('2026-09-01');

    useHabitsStore.getState().resetHabits();

    const state = useHabitsStore.getState();
    expect(state.annualGoal).toBe(12);
    expect(state.activeDates).toEqual([]);
    expect(state.totalReadingSeconds).toBe(0);
  });

  it('provides computed selectors for streaks, progress, and duration', () => {
    const store = useHabitsStore.getState();
    store.recordDailyActivity('2026-09-06');
    store.addReadingDuration(3600);
    store.setAnnualGoal(20, 2026);

    const refDate = new Date(2026, 8, 6);
    const streaks = useHabitsStore.getState().getStreakStats(refDate);
    expect(streaks.currentStreak).toBe(1);
    expect(streaks.hasReadToday).toBe(true);

    const progress = useHabitsStore.getState().getAnnualProgress(5);
    expect(progress.completedBooks).toBe(5);
    expect(progress.targetBooks).toBe(20);
    expect(progress.percent).toBe(25);

    const formattedTime = useHabitsStore.getState().getFormattedDuration();
    expect(formattedTime).toBe('1.0 hrs');
  });

  it('preserves freshly set local goal over older Supabase goal via Last-Write-Wins', async () => {
    // Supabase has an older record with annual_goal = 12
    mockMaybeSingle.mockResolvedValue({
      data: {
        user_id: 'user-1',
        annual_goal: 12,
        annual_goal_year: 2026,
        active_dates: ['2026-09-01'],
        total_reading_seconds: 1000,
        updated_at: '2026-09-01T10:00:00.000Z',
      },
      error: null,
    });

    // User sets new goal of 1 volume
    useHabitsStore.getState().setAnnualGoal(1, 2026);
    expect(useHabitsStore.getState().annualGoal).toBe(1);

    // Sync with cloud triggers
    await useHabitsStore.getState().syncWithCloud('user-1');

    // Local goal MUST remain 1 and not snap back to 12
    expect(useHabitsStore.getState().annualGoal).toBe(1);

    // Upsert to Supabase sends the new goal = 1
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        annual_goal: 1,
        annual_goal_year: 2026,
      }),
      { onConflict: 'user_id' }
    );
  });

  it('adopts remote Supabase goal on fresh device where local goal was never modified', async () => {
    // Fresh device: goalUpdatedAt is null
    expect(useHabitsStore.getState().goalUpdatedAt).toBeNull();

    mockMaybeSingle.mockResolvedValue({
      data: {
        user_id: 'user-2',
        annual_goal: 24,
        annual_goal_year: 2026,
        active_dates: ['2026-09-02'],
        total_reading_seconds: 2000,
        updated_at: '2026-09-02T10:00:00.000Z',
      },
      error: null,
    });

    await useHabitsStore.getState().syncWithCloud('user-2');

    // Goal was adopted from Supabase
    expect(useHabitsStore.getState().annualGoal).toBe(24);
    expect(useHabitsStore.getState().activeDates).toEqual(['2026-09-02']);
    expect(useHabitsStore.getState().totalReadingSeconds).toBe(2000);
  });

  it('provides computed immersion selectors and breakdown strings', () => {
    const store = useHabitsStore.getState();
    store.addReadingDuration(3600); // 1.0 hr
    store.addListeningDuration(1800); // 0.5 hr

    expect(store.getTotalImmersionSeconds()).toBe(5400); // 1.5 hrs
    expect(store.getFormattedDuration()).toBe('1.5 hrs');

    const breakdown = store.getFormattedDurationBreakdown();
    expect(breakdown.reading).toBe('1.0 hrs');
    expect(breakdown.listening).toBe('30 min');

    const progress = store.getStreakProgress();
    expect(progress.targetSeconds).toBe(300);
    expect(progress.isCompleted).toBe(true);
    expect(progress.percent).toBe(100);
  });

  it('computes partial streak progress correctly when under 5 minutes', () => {
    const store = useHabitsStore.getState();
    store.addReadingDuration(120); // 2 minutes

    const progress = store.getStreakProgress();
    expect(progress.todaySeconds).toBe(120);
    expect(progress.targetSeconds).toBe(300);
    expect(progress.remainingSeconds).toBe(180);
    expect(progress.remainingMinutes).toBe(3);
    expect(progress.isCompleted).toBe(false);
    expect(progress.percent).toBe(40);
  });

  it('synchronizes and merges total_listening_seconds with Supabase cloud', async () => {
    // Local has 1200 reading, 500 listening
    useHabitsStore.getState().addReadingDuration(1200);
    useHabitsStore.getState().addListeningDuration(500);

    // Remote has 1000 reading, 800 listening
    mockMaybeSingle.mockResolvedValue({
      data: {
        user_id: 'user-3',
        annual_goal: 15,
        annual_goal_year: 2026,
        active_dates: ['2026-09-03'],
        total_reading_seconds: 1000,
        total_listening_seconds: 800,
        updated_at: '2026-09-03T10:00:00.000Z',
      },
      error: null,
    });

    await useHabitsStore.getState().syncWithCloud('user-3');

    // Both should take the maximum (local vs remote)
    expect(useHabitsStore.getState().totalReadingSeconds).toBe(1200);
    expect(useHabitsStore.getState().totalListeningSeconds).toBe(800);

    // Upsert sends merged maximums
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-3',
        total_reading_seconds: 1200,
        total_listening_seconds: 800,
      }),
      { onConflict: 'user_id' }
    );
  });
});


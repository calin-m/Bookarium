import { describe, it, expect } from 'vitest';
import {
  calculateStreak,
  formatReadingDuration,
  calculateAnnualGoalProgress,
  calculateCompletedBooksCount,
  resolvePublicReadingHabits,
  formatLocalDate,
} from './reading-analytics';

describe('reading-analytics', () => {
  describe('formatLocalDate', () => {
    it('formats a date to YYYY-MM-DD', () => {
      const d = new Date(2026, 8, 6); // Month 8 is September (0-indexed)
      expect(formatLocalDate(d)).toBe('2026-09-06');
    });

    it('pads single-digit month and day with zeros', () => {
      const d = new Date(2026, 0, 5); // January 5
      expect(formatLocalDate(d)).toBe('2026-01-05');
    });
  });

  describe('calculateStreak', () => {
    it('returns zeroes when activeDates is empty', () => {
      const refDate = new Date(2026, 8, 6);
      const stats = calculateStreak([], refDate);
      expect(stats.currentStreak).toBe(0);
      expect(stats.longestStreak).toBe(0);
      expect(stats.hasReadToday).toBe(false);
      expect(stats.weekActivity).toHaveLength(7);
      expect(stats.weekActivity.every((d) => !d.isCompleted)).toBe(true);
    });

    it('filters out invalid date strings', () => {
      const refDate = new Date(2026, 8, 6);
      const stats = calculateStreak(['invalid', 'not-a-date', ''], refDate);
      expect(stats.currentStreak).toBe(0);
      expect(stats.longestStreak).toBe(0);
      expect(stats.hasReadToday).toBe(false);
    });

    it('calculates 1-day streak when user has only read today', () => {
      const refDate = new Date(2026, 8, 6);
      const stats = calculateStreak(['2026-09-06'], refDate);
      expect(stats.currentStreak).toBe(1);
      expect(stats.longestStreak).toBe(1);
      expect(stats.hasReadToday).toBe(true);

      const todayItem = stats.weekActivity[stats.weekActivity.length - 1];
      expect(todayItem.isToday).toBe(true);
      expect(todayItem.isCompleted).toBe(true);
    });

    it('preserves grace period streak if user read yesterday but not yet today', () => {
      const refDate = new Date(2026, 8, 6); // Today is 2026-09-06
      const stats = calculateStreak(['2026-09-04', '2026-09-05'], refDate);
      expect(stats.hasReadToday).toBe(false);
      expect(stats.currentStreak).toBe(2); // Still 2 days active until midnight!
      expect(stats.longestStreak).toBe(2);
    });

    it('breaks current streak to 0 if neither today nor yesterday was active', () => {
      const refDate = new Date(2026, 8, 6);
      const stats = calculateStreak(['2026-09-03', '2026-09-04'], refDate);
      expect(stats.hasReadToday).toBe(false);
      expect(stats.currentStreak).toBe(0);
      expect(stats.longestStreak).toBe(2); // Preserves longest historical streak
    });

    it('accurately calculates consecutive streaks and longest historical streak', () => {
      const refDate = new Date(2026, 8, 6);
      // Historical 4-day streak in August, plus current 3-day streak ending today
      const dates = [
        '2026-08-10',
        '2026-08-11',
        '2026-08-12',
        '2026-08-13',
        '2026-09-04',
        '2026-09-05',
        '2026-09-06',
      ];
      const stats = calculateStreak(dates, refDate);
      expect(stats.currentStreak).toBe(3);
      expect(stats.longestStreak).toBe(4);
      expect(stats.hasReadToday).toBe(true);
    });

    it('handles deduplication and arbitrary sorting order', () => {
      const refDate = new Date(2026, 8, 6);
      const dates = [
        '2026-09-06',
        '2026-09-06', // duplicate
        '2026-09-05',
        '2026-09-04',
      ];
      const stats = calculateStreak(dates, refDate);
      expect(stats.currentStreak).toBe(3);
      expect(stats.longestStreak).toBe(3);
    });

    it('populates 7 days of weekActivity ending with today', () => {
      const refDate = new Date(2026, 8, 6);
      const stats = calculateStreak(['2026-09-06', '2026-09-04'], refDate);
      expect(stats.weekActivity).toHaveLength(7);
      expect(stats.weekActivity[6].date).toBe('2026-09-06');
      expect(stats.weekActivity[6].isToday).toBe(true);
      expect(stats.weekActivity[6].isCompleted).toBe(true);

      expect(stats.weekActivity[4].date).toBe('2026-09-04');
      expect(stats.weekActivity[4].isCompleted).toBe(true);

      expect(stats.weekActivity[5].date).toBe('2026-09-05');
      expect(stats.weekActivity[5].isCompleted).toBe(false);
    });
  });

  describe('formatReadingDuration', () => {
    it('returns "0 min" for zero or negative values', () => {
      expect(formatReadingDuration(0)).toBe('0 min');
      expect(formatReadingDuration(-10)).toBe('0 min');
    });

    it('returns "< 1 min" for durations under 60 seconds', () => {
      expect(formatReadingDuration(45)).toBe('< 1 min');
      expect(formatReadingDuration(10)).toBe('< 1 min');
    });

    it('returns minutes for durations between 1 and 59 minutes', () => {
      expect(formatReadingDuration(120)).toBe('2 min');
      expect(formatReadingDuration(1500)).toBe('25 min');
    });

    it('returns decimal hours for durations between 1 and 10 hours', () => {
      expect(formatReadingDuration(3600)).toBe('1.0 hrs');
      expect(formatReadingDuration(5400)).toBe('1.5 hrs');
      expect(formatReadingDuration(7200)).toBe('2.0 hrs');
    });

    it('returns rounded hours for large durations', () => {
      expect(formatReadingDuration(43200)).toBe('12 hrs');
      expect(formatReadingDuration(90000)).toBe('25 hrs');
    });
  });

  describe('calculateAnnualGoalProgress', () => {
    it('handles zero completed books', () => {
      const progress = calculateAnnualGoalProgress(0, 12, 2026);
      expect(progress.year).toBe(2026);
      expect(progress.completedBooks).toBe(0);
      expect(progress.targetBooks).toBe(12);
      expect(progress.percent).toBe(0);
      expect(progress.remainingBooks).toBe(12);
      expect(progress.isCompleted).toBe(false);
    });

    it('clamps target to at least 1', () => {
      const progress = calculateAnnualGoalProgress(0, 0, 2026);
      expect(progress.targetBooks).toBe(1);
    });

    it('calculates accurate percentages and remaining counts', () => {
      const progress = calculateAnnualGoalProgress(5, 20, 2026);
      expect(progress.percent).toBe(25);
      expect(progress.remainingBooks).toBe(15);
      expect(progress.isCompleted).toBe(false);
    });

    it('marks isCompleted as true and caps percent at 100 when target is met or exceeded', () => {
      const progress = calculateAnnualGoalProgress(25, 20, 2026);
      expect(progress.percent).toBe(100);
      expect(progress.remainingBooks).toBe(0);
      expect(progress.isCompleted).toBe(true);
    });
  });

  describe('calculateCompletedBooksCount', () => {
    it('returns 0 when both maps are undefined or empty', () => {
      expect(calculateCompletedBooksCount()).toBe(0);
      expect(calculateCompletedBooksCount(null, null)).toBe(0);
      expect(calculateCompletedBooksCount({}, {})).toBe(0);
    });

    it('deduplicates finished statuses and >= 100% progress entries', () => {
      const statuses = {
        10: 'finished',
        20: 'currently_reading',
        30: 'finished',
      };
      const progress = {
        10: 100, // duplicate with status 'finished'
        20: 100, // completed via progress
        40: 85,
      };
      expect(calculateCompletedBooksCount(statuses, progress)).toBe(3);
    });
  });

  describe('resolvePublicReadingHabits', () => {
    it('returns null when neither habitRow nor fallback is provided', () => {
      expect(resolvePublicReadingHabits(null)).toBeNull();
      expect(resolvePublicReadingHabits(undefined, {})).toBeNull();
    });

    it('resolves online habitRow and merges localCompletedBooksCount when provided', () => {
      const refDate = new Date(2026, 8, 6);
      const res = resolvePublicReadingHabits(
        {
          active_dates: ['2026-09-05', '2026-09-06'],
          annual_goal: 18,
          completed_books_count: 3,
        },
        { localCompletedBooksCount: 6, referenceDate: refDate }
      );

      expect(res).toEqual({
        current_streak: 2,
        longest_streak: 2,
        active_days: 2,
        annual_goal: 18,
        completed_books_count: 6,
      });
    });

    it('preserves explicit current_streak, longest_streak, and remote completed_books_count for visitor views', () => {
      const res = resolvePublicReadingHabits({
        current_streak: 9,
        longest_streak: 14,
        active_dates: 'invalid',
        annual_goal: 0,
        completed_books_count: 5,
      });

      expect(res).toEqual({
        current_streak: 9,
        longest_streak: 14,
        active_days: 0,
        annual_goal: 0,
        completed_books_count: 5,
      });
    });

    it('resolves offline local fallback when habitRow is null', () => {
      const refDate = new Date(2026, 8, 6);
      const res = resolvePublicReadingHabits(null, {
        activeDates: ['2026-09-06'],
        annualGoal: 24,
        localCompletedBooksCount: 4,
        referenceDate: refDate,
      });

      expect(res).toEqual({
        current_streak: 1,
        longest_streak: 1,
        active_days: 1,
        annual_goal: 24,
        completed_books_count: 4,
      });
    });
  });
});


/**
 * Reading Analytics & Streak Engine - Bookarium
 *
 * Pure, deterministic mathematical calculations for consecutive reading streaks,
 * active reading duration, weekly activity sparklines, and annual reading goals.
 * Built to provide foundational telemetry for Milestone 4 accolades.
 */

export interface DayActivity {
  date: string; // YYYY-MM-DD
  dayLabel: string; // 'M', 'T', 'W', etc.
  dayName: string; // 'Mon', 'Tue', etc.
  isCompleted: boolean;
  isToday: boolean;
}

export interface StreakStats {
  currentStreak: number;
  longestStreak: number;
  hasReadToday: boolean;
  weekActivity: DayActivity[];
}

export interface AnnualGoalProgress {
  year: number;
  completedBooks: number;
  targetBooks: number;
  percent: number;
  remainingBooks: number;
  isCompleted: boolean;
}

export interface ReadingSessionTelemetry {
  bookId: number;
  bookTitle?: string;
  durationSeconds: number;
  timestamp: string;
  pagesTurned?: number;
}

/**
 * Formats a Date object to YYYY-MM-DD string in local time.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates consecutive reading streaks, longest streak, and 7-day activity.
 *
 * Grace Period Rule: If the reader logged activity yesterday but hasn't yet
 * read today, the current streak remains active until midnight.
 */
export function calculateStreak(activeDates: string[], referenceDate: Date = new Date()): StreakStats {
  if (!activeDates || activeDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      hasReadToday: false,
      weekActivity: generateWeekActivity(new Set(), referenceDate),
    };
  }

  // Deduplicate and filter valid YYYY-MM-DD dates
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const uniqueDateSet = new Set(
    activeDates
      .map((d) => (typeof d === 'string' ? d.trim().slice(0, 10) : ''))
      .filter((d) => datePattern.test(d))
  );

  if (uniqueDateSet.size === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      hasReadToday: false,
      weekActivity: generateWeekActivity(new Set(), referenceDate),
    };
  }

  const todayStr = formatLocalDate(referenceDate);
  const hasReadToday = uniqueDateSet.has(todayStr);

  // Compute Current Streak
  let currentStreak = 0;
  const checkDate = new Date(referenceDate.getTime());

  if (!hasReadToday) {
    // If not read today, check if read yesterday to maintain grace period
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = formatLocalDate(checkDate);
    if (!uniqueDateSet.has(yesterdayStr)) {
      currentStreak = 0;
    } else {
      // Streak is alive from yesterday
      while (uniqueDateSet.has(formatLocalDate(checkDate))) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }
  } else {
    // Read today, count consecutive past days
    while (uniqueDateSet.has(formatLocalDate(checkDate))) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }

  // Compute Longest Streak across all recorded history
  const sortedDates = Array.from(uniqueDateSet).sort();
  let longestStreak = 0;
  let runningStreak = 0;
  let prevDate: Date | null = null;

  for (const dateStr of sortedDates) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const currDate = new Date(y, m - 1, d);

    if (!prevDate) {
      runningStreak = 1;
    } else {
      const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        runningStreak++;
      } else if (diffDays > 1) {
        runningStreak = 1;
      }
    }

    if (runningStreak > longestStreak) {
      longestStreak = runningStreak;
    }
    prevDate = currDate;
  }

  // Longest streak must always be at least current streak
  longestStreak = Math.max(longestStreak, currentStreak);

  return {
    currentStreak,
    longestStreak,
    hasReadToday,
    weekActivity: generateWeekActivity(uniqueDateSet, referenceDate),
  };
}

/**
 * Generates the last 7 calendar days activity indicators ending on referenceDate.
 */
function generateWeekActivity(activeSet: Set<string>, referenceDate: Date): DayActivity[] {
  const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const result: DayActivity[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(referenceDate.getTime());
    d.setDate(d.getDate() - i);
    const dateStr = formatLocalDate(d);
    const dayOfWeek = d.getDay();

    result.push({
      date: dateStr,
      dayLabel: dayLetters[dayOfWeek],
      dayName: dayNames[dayOfWeek],
      isCompleted: activeSet.has(dateStr),
      isToday: i === 0,
    });
  }

  return result;
}

/**
 * Formats total seconds into human-friendly hours or minutes.
 * Examples: 45s -> "< 1 min", 1500s -> "25 min", 7200s -> "2.0 hrs"
 */
export function formatReadingDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds < 0) return '0 min';

  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 1) {
    return '< 1 min';
  }

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = totalSeconds / 3600;
  if (hours < 10) {
    // 1 decimal place (e.g. 2.5 hrs)
    return `${hours.toFixed(1)} hrs`;
  }

  // Whole hours for larger values
  return `${Math.round(hours)} hrs`;
}

/**
 * Computes progress towards an annual reading challenge.
 */
export function calculateAnnualGoalProgress(
  completedBooks: number,
  targetBooks: number = 12,
  year: number = new Date().getFullYear()
): AnnualGoalProgress {
  const safeTarget =
    typeof targetBooks === 'number' && !isNaN(targetBooks)
      ? Math.max(1, Math.round(targetBooks))
      : 12;
  const safeCompleted = Math.max(0, Math.round(completedBooks || 0));
  const percent = Math.min(100, Math.round((safeCompleted / safeTarget) * 100));
  const remainingBooks = Math.max(0, safeTarget - safeCompleted);

  return {
    year,
    completedBooks: safeCompleted,
    targetBooks: safeTarget,
    percent,
    remainingBooks,
    isCompleted: safeCompleted >= safeTarget,
  };
}

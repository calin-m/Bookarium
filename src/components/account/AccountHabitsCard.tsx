import React, { useState, useEffect } from 'react';
import { Flame, Clock, Trophy, Edit3, Plus, Minus, CheckCircle, Calendar, Check, AlertCircle } from 'lucide-react';
import { useHydratedHabits, useHabitsStore } from '@/stores/useHabitsStore';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatReadingDuration } from '@/lib/reading-analytics';

export interface AccountHabitsCardProps {
  userId?: string;
  completedBooksCount?: number;
}

function getReadingPaceHint(books: number): string {
  if (books <= 0) return 'Set an annual target to see your reading pace.';
  if (books === 12) return '~1.0 volume per month';
  if (books === 24) return '~2.0 volumes per month (1 every 2 weeks)';
  if (books === 52) return '~1.0 volume per week';
  const perMonth = (books / 12).toFixed(1);
  return `~${perMonth} volumes per month`;
}

export const AccountHabitsCard: React.FC<AccountHabitsCardProps> = ({
  userId,
  completedBooksCount = 0,
}) => {
  const {
    annualGoal,
    annualGoalYear,
    activeDates,
    totalReadingSeconds,
    totalListeningSeconds,
    setAnnualGoal,
    getStreakStats,
    getStreakProgress,
    getAnnualProgress,
    getFormattedDurationBreakdown,
    isHydrated,
  } = useHydratedHabits();

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [rawGoalInput, setRawGoalInput] = useState<string>(String(annualGoal));

  // Pull latest cloud habits on mount when authenticated user is present
  useEffect(() => {
    if (userId) {
      useHabitsStore.getState().syncWithCloud(userId).catch(() => {});
    }
  }, [userId]);

  const streakStats = getStreakStats();
  const streakProgress = getStreakProgress();
  const annualProgress = getAnnualProgress(completedBooksCount);
  const durationBreakdown = getFormattedDurationBreakdown();

  const numericGoal = parseInt(rawGoalInput, 10);
  const currentGoalValue = !isNaN(numericGoal) ? numericGoal : 0;

  const handleOpenGoalModal = () => {
    setRawGoalInput(String(annualGoal));
    setIsGoalModalOpen(true);
  };

  const handleSaveGoal = () => {
    const finalTarget = Math.min(Math.max(currentGoalValue || 1, 1), 365);
    setAnnualGoal(finalTarget, annualGoalYear, userId);
    setIsGoalModalOpen(false);
  };

  const handleAdjustGoal = (delta: number) => {
    const nextVal = Math.min(Math.max(currentGoalValue + delta, 1), 365);
    setRawGoalInput(String(nextVal));
  };

  const handleSetPreset = (preset: number) => {
    setRawGoalInput(String(preset));
  };

  return (
    <section
      className="bg-card border border-border rounded-2xl p-6 sm:p-7 space-y-5 shadow-booksaw relative overflow-hidden"
      aria-label="Reading Habits and Annual Goal"
      data-testid="account-habits-card"
    >
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-border text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-serif font-bold text-foreground flex items-center gap-2">
              <span>Reading Habits & Challenges</span>
            </h2>
            <p className="text-xs text-muted-foreground font-sans">
              Daily streaks, literary immersion time, and annual challenge tracking.
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-secondary text-secondary-foreground border border-border self-start sm:self-auto">
          <Calendar className="w-3.5 h-3.5" />
          <span>{annualGoalYear} Challenge</span>
        </div>
      </div>

      {/* Variation 1: 3 Stacked Horizontal Editorial Strips */}
      <div className="space-y-4">
        {/* Strip 1: Consecutive Reading Streak */}
        <div
          className="bg-muted/30 border border-border rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors hover:border-primary/40 hover:bg-muted/50"
          data-testid="reading-streak-metric"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase text-muted-foreground tracking-wider font-semibold">
                Reading Streak
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold ${
                  streakStats.currentStreak > 0
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Flame className="w-3 h-3" />
                <span>{streakStats.currentStreak > 0 ? 'Active' : 'Idle'}</span>
              </span>
            </div>

            <div className="flex items-baseline gap-3">
              <div className="text-2xl sm:text-3xl font-serif font-bold text-foreground">
                {isHydrated ? streakStats.currentStreak : 0}{' '}
                <span className="text-sm font-sans font-normal text-muted-foreground">
                  {streakStats.currentStreak === 1 ? 'consecutive day' : 'consecutive days'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-sans">
              <span>Personal Best: <strong className="text-foreground">{isHydrated ? streakStats.longestStreak : 0} days</strong></span>
              <span>•</span>
              {streakStats.hasReadToday ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <Check className="w-3.5 h-3.5" />
                  Today&apos;s 5-minute reading logged
                </span>
              ) : streakStats.currentStreak > 0 ? (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {streakProgress.todaySeconds > 0
                    ? `${Math.floor(streakProgress.todaySeconds / 60)}m / 5m logged today (${Math.ceil(streakProgress.remainingSeconds / 60)}m left to keep streak!)`
                    : 'Read 5 minutes today to maintain streak!'}
                </span>
              ) : (
                <span>
                  {streakProgress.todaySeconds > 0
                    ? `${Math.floor(streakProgress.todaySeconds / 60)}m / 5m logged today (${Math.ceil(streakProgress.remainingSeconds / 60)}m to start streak)`
                    : 'Read 5 minutes to start a new streak'}
                </span>
              )}
            </div>
          </div>

          {/* 7-Day Activity Week Sparkline (Expansive Horizontal Layout) */}
          <div className="md:border-l md:border-border md:pl-6 shrink-0 space-y-1.5">
            <span className="text-[11px] font-mono text-muted-foreground block text-left md:text-right">
              Past 7 Days
            </span>
            <div
              className="flex items-center gap-2 sm:gap-2.5"
              role="group"
              aria-label="7-day activity"
            >
              {streakStats.weekActivity.map((day) => (
                <div key={day.date} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-mono transition-all ${
                      day.isCompleted
                        ? 'bg-amber-500 text-white font-bold shadow-xs'
                        : day.isToday
                        ? 'border-2 border-dashed border-amber-500 text-foreground bg-amber-500/5'
                        : 'bg-muted/60 text-muted-foreground border border-border'
                    }`}
                    title={`${day.dayName}, ${day.date}: ${day.isCompleted ? 'Completed' : 'No session'}`}
                    aria-label={`${day.dayName}: ${day.isCompleted ? 'Completed' : 'Missed'}`}
                  >
                    {day.dayLabel}
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground hidden sm:block">
                    {day.dayName.slice(0, 2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Strip 2: Total Time Immersed (Reading + Listening) */}
        <div
          className="bg-muted/30 border border-border rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:border-primary/40 hover:bg-muted/50"
          data-testid="reading-time-metric"
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase text-muted-foreground tracking-wider font-semibold">
                Time Immersed
              </span>
              <Clock className="w-3.5 h-3.5 text-primary" />
            </div>

            <div className="text-2xl sm:text-3xl font-serif font-bold text-foreground">
              {isHydrated ? durationBreakdown.total : '0 min'}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-primary/10 text-primary border border-border"
                data-testid="reading-duration-badge"
              >
                <span>📖</span>
                <span>{isHydrated ? durationBreakdown.reading : '0 min'} reading</span>
              </span>
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-secondary text-secondary-foreground border border-border"
                data-testid="listening-duration-badge"
              >
                <span>🎧</span>
                <span>{isHydrated ? durationBreakdown.listening : '0 min'} listening</span>
              </span>
            </div>

            <p className="text-xs text-muted-foreground font-sans pt-1">
              Recorded across <strong className="text-foreground">{isHydrated ? activeDates.length : 0}</strong> active {activeDates.length === 1 ? 'day' : 'days'}
            </p>
          </div>

          <div className="sm:text-right text-xs text-muted-foreground font-sans space-y-1 sm:border-l sm:border-border sm:pl-6">
            <span className="font-mono text-[11px] text-muted-foreground uppercase block">
              Immersion Pace
            </span>
            {activeDates.length > 0 ? (
              <span className="text-foreground font-medium block">
                Avg ~{Math.round(((totalReadingSeconds || 0) + (totalListeningSeconds || 0)) / (activeDates.length || 1) / 60)} min per active day
              </span>
            ) : (
              <span className="block">Time accumulates automatically as you read or listen</span>
            )}
          </div>
        </div>

        {/* Strip 3: Annual Reading Challenge (Full Width Banner) */}
        <div
          className="bg-muted/30 border border-border rounded-xl p-4 sm:p-5 space-y-4 transition-colors hover:border-primary/40 hover:bg-muted/50"
          data-testid="annual-goal-metric"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-mono uppercase text-muted-foreground tracking-wider font-semibold">
                {annualGoalYear} Reading Challenge
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenGoalModal}
              className="h-7 px-2.5 text-xs font-mono text-foreground hover:text-primary gap-1.5"
              aria-label="Edit annual reading goal"
            >
              <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Edit Goal</span>
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-serif font-bold text-foreground">
                {annualProgress.completedBooks}{' '}
                <span className="text-sm font-sans font-normal text-muted-foreground">
                  / {annualProgress.targetBooks} Volumes
                </span>
              </span>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-border">
                {annualProgress.percent}%
              </span>
            </div>

            <p className="text-xs text-muted-foreground font-sans">
              {annualProgress.isCompleted
                ? 'Challenge completed! 🎉 You reached your annual reading target.'
                : `${annualProgress.remainingBooks} ${annualProgress.remainingBooks === 1 ? 'volume' : 'volumes'} remaining to complete goal`}
            </p>
          </div>

          {/* Full-Width Expansive Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden border border-border">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500 shadow-xs"
                style={{ width: `${annualProgress.percent}%` }}
                role="progressbar"
                aria-valuenow={annualProgress.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Annual reading goal: ${annualProgress.percent}% completed`}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span>0 Volumes</span>
              <span>{annualProgress.targetBooks} Volumes Goal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Goal Edit Modal */}
      <Modal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        title={`Set ${annualGoalYear} Reading Challenge`}
        maxWidth="sm"
      >
        <div className="p-6 space-y-6">
          <p className="text-xs text-muted-foreground font-sans leading-relaxed">
            Choose how many public domain volumes you aspire to read in {annualGoalYear}.
          </p>

          {/* Input & Stepper Controls */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-4 py-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleAdjustGoal(-1)}
                disabled={currentGoalValue <= 1}
                aria-label="Decrease target"
              >
                <Minus className="w-4 h-4" />
              </Button>

              <div className="w-28 text-center">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={rawGoalInput}
                  onChange={(e) => setRawGoalInput(e.target.value)}
                  onBlur={() => {
                    const parsed = parseInt(rawGoalInput, 10);
                    if (isNaN(parsed) || parsed < 1) {
                      setRawGoalInput('1');
                    } else if (parsed > 365) {
                      setRawGoalInput('365');
                    }
                  }}
                  className="w-full text-center text-3xl font-serif font-bold text-foreground bg-transparent border-b-2 border-primary focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  aria-label="Annual reading target number"
                />
                <span className="text-[11px] font-mono text-muted-foreground block mt-1">
                  volumes
                </span>
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={() => handleAdjustGoal(1)}
                disabled={currentGoalValue >= 365}
                aria-label="Increase target"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Dynamic Reading Pace Hint */}
            <p className="text-xs font-mono text-primary text-center font-medium">
              {getReadingPaceHint(currentGoalValue)}
            </p>
          </div>

          {/* Quick Preset Chips */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono text-muted-foreground uppercase block text-center">
              Quick Suggestions
            </span>
            <div className="flex items-center justify-center gap-2">
              {[12, 24, 52].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={currentGoalValue === preset ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => handleSetPreset(preset)}
                  className="text-xs font-mono h-8 px-3"
                >
                  {preset} {preset === 12 ? '(1/mo)' : preset === 24 ? '(2/mo)' : '(1/wk)'}
                </Button>
              ))}
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsGoalModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveGoal}
              className="gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Save Challenge</span>
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
};

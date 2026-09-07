import React, { useEffect } from 'react';
import { Flame, Clock, Trophy, Calendar, Check, AlertCircle, Sparkles } from 'lucide-react';
import { useHydratedHabits, useHabitsStore } from '@/stores/useHabitsStore';

export interface AccountHabitsCardProps {
  userId?: string;
  completedBooksCount?: number;
}

export interface ChallengeTier {
  id: string;
  title: string;
  latinMotto: string;
  tier: 'bronze' | 'silver' | 'gold' | 'masterwork';
  target: number;
  badgeLabel: string;
  pace: string;
}

export const CANONICAL_CHALLENGE_TIERS: ChallengeTier[] = [
  {
    id: 'bibliophile-novice',
    title: 'Bibliophile Novice',
    latinMotto: 'Ad Initium',
    tier: 'bronze',
    target: 6,
    badgeLabel: 'Bronze • 6 Volumes',
    pace: '~1 vol every 2 months',
  },
  {
    id: 'canonical-scholar',
    title: 'Canonical Scholar',
    latinMotto: 'Annus Mirabilis',
    tier: 'silver',
    target: 12,
    badgeLabel: 'Silver • 12 Volumes',
    pace: '~1 vol per month',
  },
  {
    id: 'master-of-the-canon',
    title: 'Master of the Canon',
    latinMotto: 'Litterarum Magister',
    tier: 'gold',
    target: 24,
    badgeLabel: 'Gold • 24 Volumes',
    pace: '~2 vols per month',
  },
  {
    id: 'the-laureates-crown',
    title: "The Laureate's Crown",
    latinMotto: 'Coronam Accipere',
    tier: 'masterwork',
    target: 52,
    badgeLabel: 'Masterwork • 52 Volumes',
    pace: '~1 vol per week',
  },
];

export const AccountHabitsCard: React.FC<AccountHabitsCardProps> = ({
  userId,
  completedBooksCount = 0,
}) => {
  const {
    annualGoalYear,
    activeDates,
    totalReadingSeconds,
    totalListeningSeconds,
    getStreakStats,
    getStreakProgress,
    getFormattedDurationBreakdown,
    isHydrated,
  } = useHydratedHabits();

  // Pull latest cloud habits on mount when authenticated user is present
  useEffect(() => {
    if (userId) {
      useHabitsStore.getState().syncWithCloud(userId).catch(() => {});
    }
  }, [userId]);

  const streakStats = getStreakStats();
  const streakProgress = getStreakProgress();
  const durationBreakdown = getFormattedDurationBreakdown();

  // Canonical milestone progression
  const currentCompleted = Math.max(0, completedBooksCount);
  const nextTier =
    CANONICAL_CHALLENGE_TIERS.find((t) => currentCompleted < t.target) ||
    CANONICAL_CHALLENGE_TIERS[CANONICAL_CHALLENGE_TIERS.length - 1];
  const isMasterworkCompleted = currentCompleted >= 52;
  const currentTarget = nextTier.target;
  const tierPercent = isMasterworkCompleted
    ? 100
    : Math.min(100, Math.round((currentCompleted / currentTarget) * 100));
  const remainingBooks = Math.max(0, currentTarget - currentCompleted);

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

        {/* Strip 3: Annual Reading Challenge (Canonical 4-Tier Milestone Ladder) */}
        <div
          className="bg-muted/30 border border-border rounded-xl p-4 sm:p-5 space-y-4 transition-colors hover:border-primary/40 hover:bg-muted/50"
          data-testid="annual-goal-metric"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-xs font-mono uppercase text-muted-foreground tracking-wider font-semibold">
                {annualGoalYear} Reading Challenge
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-border">
                {isMasterworkCompleted ? 'Masterwork Attained' : `${nextTier.title} in sight`}
              </span>
            </div>

            <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5 self-start sm:self-auto">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>4 Canonical Accolade Tiers</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-serif font-bold text-foreground">
                {currentCompleted}{' '}
                <span className="text-sm font-sans font-normal text-muted-foreground">
                  / {currentTarget} Volumes
                </span>
              </span>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-border">
                {tierPercent}%
              </span>
            </div>

            <p className="text-xs text-muted-foreground font-sans">
              {isMasterworkCompleted
                ? "The Laureate's Crown achieved! 🎉 All 52 canonical volumes completed."
                : `${remainingBooks} ${remainingBooks === 1 ? 'volume' : 'volumes'} remaining to unlock ${nextTier.title}`}
            </p>
          </div>

          {/* Full-Width Expansive Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden border border-border">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500 shadow-xs"
                style={{ width: `${tierPercent}%` }}
                role="progressbar"
                aria-valuenow={tierPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Annual reading challenge: ${tierPercent}% completed towards ${nextTier.title}`}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span>0 Volumes</span>
              <span>Next Milestone: {currentTarget} Volumes ({nextTier.title})</span>
            </div>
          </div>

          {/* 4 Canonical Milestone Ladder Cards */}
          <div className="pt-2 border-t border-border">
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider block mb-2.5">
              Canonical Milestone Ladder
            </span>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {CANONICAL_CHALLENGE_TIERS.map((tier) => {
                const isAttained = currentCompleted >= tier.target;
                const isCurrentTarget = !isAttained && nextTier.id === tier.id;

                return (
                  <div
                    key={tier.id}
                    className={`rounded-lg p-2.5 border transition-all ${
                      isAttained
                        ? 'bg-primary/5 border-primary/30 text-foreground'
                        : isCurrentTarget
                        ? 'bg-muted/60 border-primary/40 shadow-xs'
                        : 'bg-muted/20 border-border opacity-65 text-muted-foreground'
                    }`}
                    data-testid={`milestone-tier-${tier.id}`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                        {tier.tier}
                      </span>
                      {isAttained ? (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <Check className="w-3 h-3" />
                          <span>Attained</span>
                        </span>
                      ) : isCurrentTarget ? (
                        <span className="text-[10px] font-mono font-semibold text-primary px-1.5 py-0.5 rounded-full bg-primary/10 border border-border">
                          In Sight
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {tier.target} vols
                        </span>
                      )}
                    </div>
                    <div className="font-serif font-bold text-xs text-foreground line-clamp-1">
                      {tier.title}
                    </div>
                    <div className="text-[10px] font-serif italic text-muted-foreground line-clamp-1">
                      &ldquo;{tier.latinMotto}&rdquo;
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground mt-1.5">
                      {tier.pace}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

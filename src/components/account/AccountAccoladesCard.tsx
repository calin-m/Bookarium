'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Award,
  Sparkles,
  Pin,
  AlertCircle,
  Filter,
  X,
} from 'lucide-react';
import { ACCOLADES_CATALOG, ACCOLADE_CATEGORIES } from '@/config/accolades-config';
import { AccoladeCategory, AccoladeId } from '@/types/accolades.types';
import {
  useHydratedAccolades,
  MAX_PINNED_ACCOLADES,
} from '@/stores/useAccoladesStore';
import { useHydratedHabits } from '@/stores/useHabitsStore';
import { useHydratedBookshelf } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useHydratedAnnotations } from '@/stores/useAnnotationStore';
import { useHydratedFellowship } from '@/stores/useFellowshipStore';
import { buildAccoladeContext, evaluateAccolades } from '@/lib/accolades-engine';
import { calculateCompletedBooksCount } from '@/lib/reading-analytics';
import { Alert } from '@/components/ui/Alert';
import { ExLibrisBookplate } from '@/components/accolades/ExLibrisBookplate';
import { MotionReveal } from '@/components/motion/MotionReveal';
import { StaggerGroup } from '@/components/motion/StaggerGroup';
import { useHasMounted } from '@/hooks/useHasMounted';
import { usePerformanceTier } from '@/hooks/usePerformanceTier';

const AccoladeCelebrationModal = dynamic(
  () => import('@/components/accolades/AccoladeCelebrationModal').then((mod) => mod.AccoladeCelebrationModal),
  { ssr: false }
);

export interface AccountAccoladesCardProps {
  userId?: string;
  activeCategory?: AccoladeCategory;
  onCategoryChange?: (category: AccoladeCategory) => void;
  onOpenFilter?: () => void;
}

export function AccountAccoladesCard({
  userId,
  activeCategory: controlledCategory,
  onCategoryChange,
  onOpenFilter,
}: AccountAccoladesCardProps) {
  const [internalCategory, setInternalCategory] = useState<AccoladeCategory>('all');
  const activeCategory = controlledCategory ?? internalCategory;
  const setActiveCategory = useCallback(
    (category: AccoladeCategory) => {
      onCategoryChange?.(category);
      if (controlledCategory === undefined) {
        setInternalCategory(category);
      }
    },
    [controlledCategory, onCategoryChange]
  );
  const [pinLimitWarning, setPinLimitWarning] = useState<string | null>(null);

  const {
    unlockedAccolades,
    pinnedAccoladeIds,
    togglePin,
    syncWithCloud,
    evaluateAndUnlock,
    isHydrated,
  } = useHydratedAccolades();
  const hasMounted = useHasMounted();
  const { allowHeavyMotion } = usePerformanceTier();
  const enableStagger = hasMounted && allowHeavyMotion;

  const habits = useHydratedHabits();
  const bookshelf = useHydratedBookshelf();
  const readingProgress = useReaderStore((s) => s.readingProgress);
  const { annotations } = useHydratedAnnotations();
  const { symposiums } = useHydratedFellowship();

  const completedBooksCount = useMemo(
    () => calculateCompletedBooksCount(bookshelf.bookStatuses, readingProgress),
    [bookshelf.bookStatuses, readingProgress]
  );

  const completedSymposiumsCount = useMemo(
    () =>
      symposiums.filter(
        (s) => s.status === 'completed' || (s.host_progress >= 100 && s.fellow_progress >= 100)
      ).length,
    [symposiums]
  );

  // Evaluate accolades deterministically when habits, bookshelf, annotations, or symposiums change
  useEffect(() => {
    if (!isHydrated) return;

    const streakStats = habits.getStreakStats();
    const annualProgress = habits.getAnnualProgress(completedBooksCount);

    const context = buildAccoladeContext({
      habits: {
        currentStreak: streakStats.currentStreak,
        longestStreak: streakStats.longestStreak,
        totalReadingSeconds: habits.totalReadingSeconds,
        totalListeningSeconds: habits.totalListeningSeconds,
        activeDates: habits.activeDates,
        annualGoalPercent: annualProgress.percent,
      },
      savedBooks: bookshelf.savedBooks,
      bookStatuses: bookshelf.bookStatuses,
      readingProgress,
      annotations,
      completedSymposiumsCount,
      existingUnlockedIds: Object.keys(unlockedAccolades),
    });

    evaluateAndUnlock(context, userId);
  }, [
    isHydrated,
    userId,
    habits.totalReadingSeconds,
    habits.totalListeningSeconds,
    habits.activeDates,
    bookshelf.savedBooks,
    bookshelf.bookStatuses,
    readingProgress,
    completedBooksCount,
    annotations,
    completedSymposiumsCount,
    evaluateAndUnlock,
    habits,
    unlockedAccolades,
  ]);

  // Sync with cloud on initial mount for authenticated users
  useEffect(() => {
    if (userId) {
      syncWithCloud(userId, { minSyncIntervalMs: 15_000 }).catch(() => {});
    }
  }, [userId, syncWithCloud]);

  // Compute live progress map for all catalog items
  const progressMap = useMemo(() => {
    const streakStats = habits.getStreakStats();
    const annualProgress = habits.getAnnualProgress(completedBooksCount);

    const context = buildAccoladeContext({
      habits: {
        currentStreak: streakStats.currentStreak,
        longestStreak: streakStats.longestStreak,
        totalReadingSeconds: habits.totalReadingSeconds,
        totalListeningSeconds: habits.totalListeningSeconds,
        activeDates: habits.activeDates,
        annualGoalPercent: annualProgress.percent,
      },
      savedBooks: bookshelf.savedBooks,
      bookStatuses: bookshelf.bookStatuses,
      readingProgress,
      annotations,
      completedSymposiumsCount,
      existingUnlockedIds: Object.keys(unlockedAccolades),
    });

    return evaluateAccolades(context, ACCOLADES_CATALOG, unlockedAccolades).progressMap;
  }, [habits, bookshelf, readingProgress, completedBooksCount, annotations, completedSymposiumsCount, unlockedAccolades]);

  // Pinned definitions for the showcase
  const pinnedDefinitions = useMemo(() => {
    return pinnedAccoladeIds
      .map((id) => ACCOLADES_CATALOG.find((a) => a.id === id))
      .filter((a): a is (typeof ACCOLADES_CATALOG)[number] => Boolean(a));
  }, [pinnedAccoladeIds]);

  // Catalog filtered by category
  const filteredCatalog = useMemo(() => {
    if (activeCategory === 'all') return ACCOLADES_CATALOG;
    return ACCOLADES_CATALOG.filter((item) => item.category === activeCategory);
  }, [activeCategory]);

  const unlockedCount = useMemo(() => {
    return Object.values(progressMap).filter((p) => p.isUnlocked).length;
  }, [progressMap]);

  const handleTogglePin = useCallback(
    async (id: AccoladeId) => {
      const isAlreadyPinned = pinnedAccoladeIds.includes(id);
      if (!isAlreadyPinned && pinnedAccoladeIds.length >= MAX_PINNED_ACCOLADES) {
        setPinLimitWarning('Showcase limit reached (maximum 3 bookplates). Unpin one to add this.');
        setTimeout(() => setPinLimitWarning(null), 4000);
        return false;
      }

      setPinLimitWarning(null);
      return await togglePin(id, userId);
    },
    [pinnedAccoladeIds, togglePin, userId]
  );

  const activeCategoryLabel =
    ACCOLADE_CATEGORIES.find((cat) => cat.id === activeCategory)?.label || 'All Bookplates';

  return (
    <section
      id="account-accolades-card"
      className="bg-card border border-border rounded-3xl p-5 sm:p-6 lg:p-8 space-y-6 shadow-xs"
      aria-label="Literary Accolades and Ex-Libris Bookplates"
      data-testid="account-accolades-card"
    >
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-border text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-serif font-bold text-foreground flex items-center gap-2">
              <span>Ex-Libris Bookplates & Accolades</span>
            </h2>
            <p className="text-xs text-muted-foreground font-sans">
              Classical honors for scholarly streaks, immersion, and public domain curation.
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-secondary text-secondary-foreground border border-border self-start sm:self-auto whitespace-nowrap">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            {unlockedCount} / {ACCOLADES_CATALOG.length} Unlocked
          </span>
        </div>
      </div>

      {/* Pin limit warning alert */}
      {pinLimitWarning && (
        <Alert
          variant="warning"
          icon={<AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />}
          className="gap-2 px-3.5 py-2.5 rounded-xl animate-in fade-in"
        >
          {pinLimitWarning}
        </Alert>
      )}

      {/* Personal Showcase (Pinned Bookplates) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Pin className="w-3.5 h-3.5" />
            <span>Personal Showcase ({pinnedDefinitions.length}/{MAX_PINNED_ACCOLADES})</span>
          </h3>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Pin up to 3 bookplates to showcase on your profile
          </span>
        </div>

        {pinnedDefinitions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {pinnedDefinitions.map((def) => (
              <ExLibrisBookplate
                key={`showcase-${def.id}`}
                definition={def}
                progress={progressMap[def.id]}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-5 text-center bg-muted/20">
            <p className="text-xs text-muted-foreground font-serif italic">
              No bookplates pinned yet. Unlock achievements and click the pin icon to curate your personal 3-plate showcase.
            </p>
          </div>
        )}
      </div>

      {/* Compendium Header & Subtle Filter Indicator (Bottom Capsule Controlled) */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Accolade Compendium
            </h3>
            <span className="text-[11px] font-mono text-muted-foreground">
              ({filteredCatalog.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenFilter ? (
              <button
                type="button"
                onClick={onOpenFilter}
                data-testid="accolades-open-filter-btn"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border border-border bg-muted/40 hover:bg-muted text-foreground transition-colors cursor-pointer"
                aria-label={`Filter accolades (${activeCategoryLabel})`}
              >
                <Filter className="w-3 h-3 text-primary shrink-0" />
                <span>{activeCategoryLabel}</span>
              </button>
            ) : (
              <span
                data-testid="accolades-active-category-badge"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border border-border bg-muted/40 text-muted-foreground"
              >
                <Filter className="w-3 h-3 text-primary shrink-0" />
                <span>{activeCategoryLabel}</span>
              </span>
            )}
            {activeCategory !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                data-testid="accolades-reset-filter-btn"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono border border-border text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                aria-label="Reset accolade category filter"
              >
                <X className="w-3 h-3" />
                <span>Show all</span>
              </button>
            )}
          </div>
        </div>

        {/* Bookplate Grid */}
        <StaggerGroup
          key={`accolade-cat-${activeCategory}`}
          disabled={!enableStagger}
          data-testid="accolades-compendium-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pt-2"
        >
          {filteredCatalog.map((def) => (
            <MotionReveal
              key={def.id}
              staggerChild
              disabled={!enableStagger}
            >
              <ExLibrisBookplate
                definition={def}
                progress={progressMap[def.id]}
                onTogglePin={handleTogglePin}
              />
            </MotionReveal>
          ))}
        </StaggerGroup>
      </div>

      {/* Celebration Modal (Mounted for seamless popups when accolades unlock) */}
      <AccoladeCelebrationModal />
    </section>
  );
}

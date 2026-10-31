'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Award,
  Sparkles,
  Pin,
  AlertCircle,
  Flame,
  Clock,
  Compass,
  BookOpen,
  Library,
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
import { createTabScrubberHandlers } from '@/lib/scroll-utils';
import { ExLibrisBookplate } from '@/components/accolades/ExLibrisBookplate';

const AccoladeCelebrationModal = dynamic(
  () => import('@/components/accolades/AccoladeCelebrationModal').then((mod) => mod.AccoladeCelebrationModal),
  { ssr: false }
);

export interface AccountAccoladesCardProps {
  userId?: string;
}

export function AccountAccoladesCard({ userId }: AccountAccoladesCardProps) {
  const [activeCategory, setActiveCategory] = useState<AccoladeCategory>('all');
  const [pinLimitWarning, setPinLimitWarning] = useState<string | null>(null);

  const {
    unlockedAccolades,
    pinnedAccoladeIds,
    togglePin,
    syncWithCloud,
    evaluateAndUnlock,
    isHydrated,
  } = useHydratedAccolades();

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
      syncWithCloud(userId).catch(() => {});
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

  return (
    <section
      className="bg-card border border-border rounded-2xl p-4 sm:p-6 lg:p-7 space-y-6 shadow-booksaw relative overflow-hidden"
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
        <div
          role="alert"
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 dark:border-amber-500/50 text-amber-800 dark:text-amber-200 text-xs animate-in fade-in"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>{pinLimitWarning}</span>
        </div>
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

      {/* Category Tabs */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Accolade Compendium
          </h3>
        </div>

        {/* Centered Editorial Underline Category Sub-Tabs */}
        <div className="flex items-center justify-center border-b border-border">
          <nav
            role="tablist"
            data-no-swipe
            aria-label="Accolade categories"
            {...createTabScrubberHandlers(setActiveCategory)}
            className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-px [scrollbar-width:none] select-none"
          >
            {ACCOLADE_CATEGORIES.map((category) => {
              const isActive = activeCategory === category.id;
              const count =
                category.id === 'all'
                  ? ACCOLADES_CATALOG.length
                  : ACCOLADES_CATALOG.filter((item) => item.category === category.id).length;

              const getCategoryIcon = () => {
                switch (category.id) {
                  case 'all':
                    return <Award className="w-3.5 h-3.5 shrink-0" />;
                  case 'streaks':
                    return <Flame className="w-3.5 h-3.5 shrink-0 text-amber-500" />;
                  case 'immersion':
                    return <Clock className="w-3.5 h-3.5 shrink-0 text-sky-500" />;
                  case 'exploration':
                    return <Compass className="w-3.5 h-3.5 shrink-0 text-emerald-500" />;
                  case 'scholarship':
                    return <BookOpen className="w-3.5 h-3.5 shrink-0 text-purple-500" />;
                  case 'curation':
                    return <Library className="w-3.5 h-3.5 shrink-0 text-amber-600" />;
                  default:
                    return <Award className="w-3.5 h-3.5 shrink-0" />;
                }
              };

              return (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  data-tab-id={category.id}
                  aria-selected={isActive}
                  aria-label={category.label}
                  title={category.label}
                  onClick={() => setActiveCategory(category.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs font-mono uppercase tracking-wider font-bold border-b-2 transition-all duration-200 ease-out whitespace-nowrap shrink-0 cursor-pointer select-none ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  {getCategoryIcon()}
                  <span className={isActive ? 'inline' : 'hidden md:inline'}>{category.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none font-bold ${
                      isActive
                        ? 'bg-primary/15 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bookplate Grid */}
        <div
          key={`accolade-cat-${activeCategory}`}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pt-2 animate-in fade-in duration-150"
        >
          {filteredCatalog.map((def) => (
            <ExLibrisBookplate
              key={def.id}
              definition={def}
              progress={progressMap[def.id]}
              onTogglePin={handleTogglePin}
            />
          ))}
        </div>
      </div>

      {/* Celebration Modal (Mounted for seamless popups when accolades unlock) */}
      <AccoladeCelebrationModal />
    </section>
  );
}

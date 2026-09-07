'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Award, Sparkles, Pin, AlertCircle } from 'lucide-react';
import { ACCOLADES_CATALOG, ACCOLADE_CATEGORIES } from '@/config/accolades-config';
import { AccoladeCategory, AccoladeId } from '@/types/accolades.types';
import {
  useHydratedAccolades,
  MAX_PINNED_ACCOLADES,
} from '@/stores/useAccoladesStore';
import { useHydratedHabits } from '@/stores/useHabitsStore';
import { useHydratedBookshelf } from '@/stores/useBookshelfStore';
import { useHydratedAnnotations } from '@/stores/useAnnotationStore';
import { buildAccoladeContext, evaluateAccolades } from '@/lib/accolades-engine';
import { ExLibrisBookplate } from '@/components/accolades/ExLibrisBookplate';
import { AccoladeCelebrationModal } from '@/components/accolades/AccoladeCelebrationModal';

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
  const { annotations } = useHydratedAnnotations();

  // Evaluate accolades deterministically when habits, bookshelf, or annotations change
  useEffect(() => {
    if (!isHydrated) return;

    const streakStats = habits.getStreakStats();
    const annualProgress = habits.getAnnualProgress(bookshelf.savedBooks.length);

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
      annotations,
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
    annotations,
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
    const annualProgress = habits.getAnnualProgress(bookshelf.savedBooks.length);

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
      annotations,
      existingUnlockedIds: Object.keys(unlockedAccolades),
    });

    return evaluateAccolades(context, ACCOLADES_CATALOG, unlockedAccolades).progressMap;
  }, [habits, bookshelf, annotations, unlockedAccolades]);

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
      className="bg-card border border-border rounded-2xl p-6 sm:p-7 space-y-6 shadow-booksaw relative overflow-hidden"
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

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-secondary text-secondary-foreground border border-border self-start sm:self-auto">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
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

        <div className="flex flex-wrap gap-1.5 border-b border-border pb-3" role="tablist">
          {ACCOLADE_CATEGORIES.map((category) => {
            const isActive = activeCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveCategory(category.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        {/* Bookplate Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pt-2">
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

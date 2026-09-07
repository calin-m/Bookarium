/**
 * Deterministic Literary Accolades & Ex-Libris Bookplate Evaluation Engine
 * Bookarium Milestone 4, Point 1
 */

import {
  AccoladeId,
  AccoladeDefinition,
  AccoladeEvaluationContext,
  AccoladeEvaluationResult,
  AccoladeProgress,
  UnlockedAccolade,
} from '@/types/accolades.types';
import { ACCOLADES_CATALOG } from '@/config/accolades-config';
import type { GutendexBook, ReadingStatus } from '@/types/book.types';
import type { Annotation } from '@/stores/useAnnotationStore';
import type { HabitsState } from '@/stores/useHabitsStore';

/**
 * Maps author birth/death year or book metadata to a historical literary era.
 */
export function determineBookEra(book: GutendexBook): string | null {
  // Check author birth or death year
  const author = book.authors?.[0];
  const year = author?.death_year ?? author?.birth_year ?? null;

  if (year !== null) {
    if (year <= 500) return 'antiquity';
    if (year <= 1400) return 'middle-ages';
    if (year <= 1650) return 'renaissance';
    if (year <= 1800) return 'enlightenment';
    if (year <= 1900) return 'victorian';
    return 'early-20th';
  }

  // Fallback: Check subjects and bookshelves for era markers
  const metadataText = [...(book.subjects || []), ...(book.bookshelves || [])].join(' ').toLowerCase();

  if (metadataText.includes('classical antiquity') || metadataText.includes('greece') || metadataText.includes('rome') || book.languages?.includes('la') || book.languages?.includes('el')) {
    return 'antiquity';
  }
  if (metadataText.includes('middle ages') || metadataText.includes('medieval')) {
    return 'middle-ages';
  }
  if (metadataText.includes('renaissance') || metadataText.includes('early modern')) {
    return 'renaissance';
  }
  if (metadataText.includes('enlightenment') || metadataText.includes('18th century')) {
    return 'enlightenment';
  }
  if (metadataText.includes('19th century') || metadataText.includes('victorian')) {
    return 'victorian';
  }
  if (metadataText.includes('20th century')) {
    return 'early-20th';
  }

  return null;
}

/**
 * Determines whether a book belongs to Antiquity or the Middle Ages (pre-1400 CE).
 */
export function isAncientBook(book: GutendexBook): boolean {
  const era = determineBookEra(book);
  if (era === 'antiquity' || era === 'middle-ages') {
    return true;
  }
  const author = book.authors?.[0];
  const year = author?.death_year ?? author?.birth_year ?? null;
  return year !== null && year <= 1400;
}

export interface BuildAccoladeContextParams {
  habits?: Partial<Pick<HabitsState, 'activeDates' | 'totalReadingSeconds' | 'totalListeningSeconds' | 'annualGoal'>> & {
    currentStreak?: number;
    longestStreak?: number;
    annualGoalPercent?: number;
  };
  savedBooks?: GutendexBook[];
  bookStatuses?: Record<number, ReadingStatus>;
  annotations?: Annotation[];
  existingUnlockedIds?: string[];
}

/**
 * Builds a unified AccoladeEvaluationContext from store slices.
 */
export function buildAccoladeContext(params: BuildAccoladeContextParams): AccoladeEvaluationContext {
  const { habits, savedBooks = [], bookStatuses = {}, annotations = [], existingUnlockedIds = [] } = params;

  // Identify completed books
  const completedBooks = savedBooks.filter((book) => bookStatuses[book.id] === 'finished');

  // Compute unique historical eras explored in completed books
  const erasSet = new Set<string>();
  let hasAncient = false;

  for (const book of completedBooks) {
    const era = determineBookEra(book);
    if (era) erasSet.add(era);
    if (isAncientBook(book)) hasAncient = true;
  }

  // Also check if any saved books or active reading volumes satisfy ancient
  if (!hasAncient) {
    for (const book of savedBooks) {
      if (bookStatuses[book.id] === 'finished' && isAncientBook(book)) {
        hasAncient = true;
        break;
      }
    }
  }

  // Extract highlight colors used
  const colorsUsed = Array.from(new Set(annotations.map((a) => a.color).filter(Boolean)));

  return {
    currentStreak: habits?.currentStreak ?? 0,
    longestStreak: habits?.longestStreak ?? 0,
    totalReadingSeconds: habits?.totalReadingSeconds ?? 0,
    totalListeningSeconds: habits?.totalListeningSeconds ?? 0,
    activeDates: habits?.activeDates ?? [],
    annualGoalPercent: habits?.annualGoalPercent ?? 0,
    completedBooksCount: completedBooks.length,
    historicalErasExplored: Array.from(erasSet),
    hasCompletedAncientBook: hasAncient,
    totalAnnotationsCount: annotations.length,
    highlightColorsUsed: colorsUsed,
    existingUnlockedIds,
  };
}

/**
 * Finds a definition by ID in the catalog.
 */
export function getAccoladeById(id: AccoladeId, catalog: AccoladeDefinition[] = ACCOLADES_CATALOG): AccoladeDefinition | undefined {
  return catalog.find((acc) => acc.id === id);
}

/**
 * Formats progress value and target with units for display.
 */
export function formatAccoladeProgress(progress: AccoladeProgress, definition: AccoladeDefinition): string {
  if (definition.unit === '%') {
    return `${Math.min(100, Math.round(progress.current))}%`;
  }
  return `${progress.current} / ${definition.target} ${definition.unit}`;
}

/**
 * Evaluates the full accolades catalog deterministically against the provided context.
 */
export function evaluateAccolades(
  context: AccoladeEvaluationContext,
  catalog: AccoladeDefinition[] = ACCOLADES_CATALOG,
  existingUnlocked: Record<AccoladeId, UnlockedAccolade> = {} as Record<AccoladeId, UnlockedAccolade>
): AccoladeEvaluationResult {
  const progressMap = {} as Record<AccoladeId, AccoladeProgress>;
  const unlockedAccolades = { ...existingUnlocked } as Record<AccoladeId, UnlockedAccolade>;
  const newlyUnlocked: AccoladeDefinition[] = [];
  const existingUnlockedIds = new Set(context.existingUnlockedIds || Object.keys(existingUnlocked));

  const nowIso = new Date().toISOString();

  for (const def of catalog) {
    const rawVal = def.evaluate(context);
    const current = Math.max(0, rawVal);
    const percent = Math.min(100, Math.round((current / def.target) * 100));
    const wasAlreadyUnlocked = existingUnlockedIds.has(def.id) || Boolean(existingUnlocked[def.id]);
    const isNowUnlocked = wasAlreadyUnlocked || current >= def.target;

    let unlockedAt = existingUnlocked[def.id]?.unlockedAt;
    const isPinned = existingUnlocked[def.id]?.isPinned ?? false;

    if (isNowUnlocked && !wasAlreadyUnlocked) {
      unlockedAt = nowIso;
      newlyUnlocked.push(def);
      unlockedAccolades[def.id] = {
        id: def.id,
        unlockedAt: nowIso,
        isPinned,
      };
    }

    progressMap[def.id] = {
      id: def.id,
      current,
      target: def.target,
      percent,
      isUnlocked: isNowUnlocked,
      unlockedAt,
      isPinned,
    };
  }

  return {
    progressMap,
    unlockedAccolades,
    newlyUnlocked,
  };
}


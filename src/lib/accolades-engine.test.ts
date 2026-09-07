import { describe, it, expect } from 'vitest';
import {
  determineBookEra,
  isAncientBook,
  buildAccoladeContext,
  getAccoladeById,
  formatAccoladeProgress,
  evaluateAccolades,
} from './accolades-engine';
import { ACCOLADES_CATALOG } from '@/config/accolades-config';
import type { GutendexBook } from '@/types/book.types';
import type { Annotation } from '@/stores/useAnnotationStore';

describe('accolades-engine', () => {
  const sampleAncientBook: GutendexBook = {
    id: 100,
    title: 'Meditations',
    authors: [{ name: 'Marcus Aurelius', birth_year: 121, death_year: 180 }],
    translators: [],
    subjects: ['Philosophy', 'Classical Antiquity'],
    bookshelves: ['Classical Literature'],
    languages: ['el', 'en'],
    copyright: false,
    media_type: 'Text',
    formats: {},
    download_count: 50000,
  };

  const sampleVictorianBook: GutendexBook = {
    id: 200,
    title: 'Pride and Prejudice',
    authors: [{ name: 'Jane Austen', birth_year: 1775, death_year: 1817 }],
    translators: [],
    subjects: ['Fiction', '19th Century'],
    bookshelves: ['Best Books Ever'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    formats: {},
    download_count: 100000,
  };

  const sampleRenaissanceBook: GutendexBook = {
    id: 300,
    title: 'Hamlet',
    authors: [{ name: 'William Shakespeare', birth_year: 1564, death_year: 1616 }],
    translators: [],
    subjects: ['Drama', 'Tragedy'],
    bookshelves: [],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    formats: {},
    download_count: 80000,
  };

  describe('determineBookEra', () => {
    it('determines antiquity from author years', () => {
      expect(determineBookEra(sampleAncientBook)).toBe('antiquity');
    });

    it('determines victorian/19th century from author years', () => {
      expect(determineBookEra(sampleVictorianBook)).toBe('victorian');
    });

    it('determines renaissance from author years', () => {
      expect(determineBookEra(sampleRenaissanceBook)).toBe('renaissance');
    });

    it('falls back to subjects and languages when author years are null', () => {
      const latinBook: GutendexBook = {
        ...sampleAncientBook,
        authors: [{ name: 'Anonymous', birth_year: null, death_year: null }],
        languages: ['la'],
        subjects: [],
        bookshelves: [],
      };
      expect(determineBookEra(latinBook)).toBe('antiquity');
    });

    it('returns null if no era markers can be inferred', () => {
      const unknownBook: GutendexBook = {
        ...sampleAncientBook,
        authors: [{ name: 'Unknown Author', birth_year: null, death_year: null }],
        languages: ['en'],
        subjects: ['General'],
        bookshelves: [],
      };
      expect(determineBookEra(unknownBook)).toBeNull();
    });
  });

  describe('isAncientBook', () => {
    it('identifies antiquity and middle-ages works as ancient', () => {
      expect(isAncientBook(sampleAncientBook)).toBe(true);
      expect(isAncientBook(sampleVictorianBook)).toBe(false);
    });
  });

  describe('buildAccoladeContext', () => {
    it('builds a comprehensive context from store state slices', () => {
      const annotations: Annotation[] = [
        {
          id: 'a1',
          bookId: 100,
          chapterIndex: 0,
          chapterPage: 1,
          selectedText: 'Wise thought',
          color: 'yellow',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'a2',
          bookId: 100,
          chapterIndex: 0,
          chapterPage: 2,
          selectedText: 'Another reflection',
          color: 'rose',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const ctx = buildAccoladeContext({
        habits: {
          currentStreak: 7,
          longestStreak: 12,
          totalReadingSeconds: 7200,
          totalListeningSeconds: 3600,
          activeDates: ['2026-09-01', '2026-09-02'],
          annualGoalPercent: 50,
        },
        savedBooks: [sampleAncientBook, sampleVictorianBook, sampleRenaissanceBook],
        bookStatuses: {
          100: 'finished',
          200: 'finished',
          300: 'finished',
        },
        annotations,
      });

      expect(ctx.currentStreak).toBe(7);
      expect(ctx.longestStreak).toBe(12);
      expect(ctx.completedBooksCount).toBe(3);
      expect(ctx.hasCompletedAncientBook).toBe(true);
      expect(ctx.historicalErasExplored).toContain('antiquity');
      expect(ctx.historicalErasExplored).toContain('victorian');
      expect(ctx.historicalErasExplored).toContain('renaissance');
      expect(ctx.totalAnnotationsCount).toBe(2);
      expect(ctx.highlightColorsUsed).toEqual(['yellow', 'rose']);
    });
  });

  describe('getAccoladeById & formatAccoladeProgress', () => {
    it('finds definitions by ID', () => {
      const sage = getAccoladeById('seven-day-sage');
      expect(sage).toBeDefined();
      expect(sage?.latinMotto).toBe('Nulla Dies Sine Linea');
    });

    it('formats progress with correct units', () => {
      const sage = getAccoladeById('seven-day-sage')!;
      const crown = getAccoladeById('the-laureates-crown')!;
      const novice = getAccoladeById('bibliophile-novice')!;

      expect(
        formatAccoladeProgress(
          { id: 'seven-day-sage', current: 5, target: 7, percent: 71, isUnlocked: false, isPinned: false },
          sage
        )
      ).toBe('5 / 7 days');

      expect(
        formatAccoladeProgress(
          { id: 'bibliophile-novice', current: 3, target: 6, percent: 50, isUnlocked: false, isPinned: false },
          novice
        )
      ).toBe('3 / 6 volumes');

      expect(
        formatAccoladeProgress(
          { id: 'the-laureates-crown', current: 52, target: 52, percent: 100, isUnlocked: true, isPinned: false },
          crown
        )
      ).toBe('52 / 52 volumes');
    });
  });

  describe('evaluateAccolades', () => {
    it('accurately unlocks accolades and reports newly unlocked', () => {
      const context = {
        currentStreak: 7,
        longestStreak: 7,
        totalReadingSeconds: 90000, // 25 hours
        totalListeningSeconds: 18000, // 5 hours
        hasCompletedAncientBook: true,
        historicalErasExplored: ['antiquity', 'middle-ages', 'renaissance'],
        totalAnnotationsCount: 15,
        highlightColorsUsed: ['yellow', 'amber', 'mint', 'rose'],
        completedBooksCount: 52,
      };

      const result = evaluateAccolades(context);

      expect(result.progressMap['seven-day-sage'].isUnlocked).toBe(true);
      expect(result.progressMap['the-marathon-reader'].isUnlocked).toBe(true);
      expect(result.progressMap['audio-ascetic'].isUnlocked).toBe(true);
      expect(result.progressMap['ancient-antiquarian'].isUnlocked).toBe(true);
      expect(result.progressMap['century-voyager'].isUnlocked).toBe(true);
      expect(result.progressMap['commonplace-scholar'].isUnlocked).toBe(true);
      expect(result.progressMap['palette-virtuoso'].isUnlocked).toBe(true);
      expect(result.progressMap['bibliophile-novice'].isUnlocked).toBe(true);
      expect(result.progressMap['canonical-scholar'].isUnlocked).toBe(true);
      expect(result.progressMap['master-of-the-canon'].isUnlocked).toBe(true);
      expect(result.progressMap['the-laureates-crown'].isUnlocked).toBe(true);

      // Centurion is 100 days, so should not be unlocked
      expect(result.progressMap['centurion-of-letters'].isUnlocked).toBe(false);
      expect(result.progressMap['centurion-of-letters'].percent).toBe(7);

      expect(result.newlyUnlocked.length).toBeGreaterThan(0);
    });

    it('evaluates progressive tiers of curation ladder based on completedBooksCount', () => {
      // 15 completed books: Novice (6) and Scholar (12) unlocked, Master (24) and Laureate (52) locked
      const context = {
        completedBooksCount: 15,
      };

      const result = evaluateAccolades(context);

      expect(result.progressMap['bibliophile-novice'].isUnlocked).toBe(true);
      expect(result.progressMap['canonical-scholar'].isUnlocked).toBe(true);

      expect(result.progressMap['master-of-the-canon'].isUnlocked).toBe(false);
      expect(result.progressMap['master-of-the-canon'].current).toBe(15);
      expect(result.progressMap['master-of-the-canon'].target).toBe(24);
      expect(result.progressMap['master-of-the-canon'].percent).toBe(63);

      expect(result.progressMap['the-laureates-crown'].isUnlocked).toBe(false);
      expect(result.progressMap['the-laureates-crown'].current).toBe(15);
      expect(result.progressMap['the-laureates-crown'].target).toBe(52);
      expect(result.progressMap['the-laureates-crown'].percent).toBe(29);
    });

    it('does not include already unlocked accolades in newlyUnlocked', () => {
      const context = {
        currentStreak: 7,
        existingUnlockedIds: ['seven-day-sage'],
      };

      const existingUnlocked = {
        'seven-day-sage': {
          id: 'seven-day-sage' as const,
          unlockedAt: '2026-09-01T00:00:00.000Z',
          isPinned: true,
        },
      };

      const result = evaluateAccolades(context, ACCOLADES_CATALOG, existingUnlocked as any);

      expect(result.progressMap['seven-day-sage'].isUnlocked).toBe(true);
      expect(result.progressMap['seven-day-sage'].isPinned).toBe(true);
      expect(result.newlyUnlocked.some((a) => a.id === 'seven-day-sage')).toBe(false);
    });
  });
});


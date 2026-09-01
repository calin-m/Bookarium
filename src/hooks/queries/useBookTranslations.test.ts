import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useBookTranslations,
  extractRootTitle,
  extractSignificantTitleKeywords,
  extractAuthorSurname,
  resolveLanguageLabel,
} from './useBookTranslations';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useBookTranslations and helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('extractRootTitle', () => {
    it('strips subtitles after semicolons and colons', () => {
      expect(extractRootTitle('Frankenstein; Or, The Modern Prometheus')).toBe('Frankenstein');
      expect(extractRootTitle('Faust: A Tragedy in Two Parts')).toBe('Faust');
    });

    it('strips volume and part suffixes', () => {
      expect(extractRootTitle('The German Classics of the 19th Century, Vol. 01')).toBe(
        'The German Classics of the 19th Century'
      );
      expect(extractRootTitle('The History of Rome, Volume 2')).toBe('The History of Rome');
    });

    it('returns original string when no subtitles or volumes exist', () => {
      expect(extractRootTitle('Pride and Prejudice')).toBe('Pride and Prejudice');
      expect(extractRootTitle('')).toBe('');
    });
  });

  describe('extractSignificantTitleKeywords', () => {
    it('strips leading structural stopwords to yield core search keywords', () => {
      expect(extractSignificantTitleKeywords('The History of Don Quixote, Volume 1')).toBe(
        'Don Quixote'
      );
      expect(extractSignificantTitleKeywords('Frankenstein; Or, The Modern Prometheus')).toBe(
        'Frankenstein'
      );
      expect(extractSignificantTitleKeywords('The Metamorphosis')).toBe('Metamorphosis');
    });
  });

  describe('extractAuthorSurname', () => {
    it('extracts surname when author is formatted as "Surname, Forename"', () => {
      expect(extractAuthorSurname('Austen, Jane')).toBe('Austen');
      expect(extractAuthorSurname('Shelley, Mary Wollstonecraft')).toBe('Shelley');
      expect(extractAuthorSurname('Cervantes Saavedra, Miguel de')).toBe('Cervantes');
    });

    it('extracts primary name when author has noble prefix or is formatted without comma', () => {
      expect(extractAuthorSurname('Jane Austen')).toBe('Austen');
      expect(extractAuthorSurname('Miguel de Cervantes Saavedra')).toBe('Cervantes');
      expect(extractAuthorSurname('')).toBe('');
    });
  });

  describe('resolveLanguageLabel', () => {
    it('resolves known ISO codes to human-readable names', () => {
      expect(resolveLanguageLabel('en')).toBe('English');
      expect(resolveLanguageLabel('fr')).toBe('French (Français)');
      expect(resolveLanguageLabel('es')).toBe('Spanish (Español)');
      expect(resolveLanguageLabel('de')).toBe('German (Deutsch)');
    });

    it('falls back to uppercase code for unknown languages', () => {
      expect(resolveLanguageLabel('xx')).toBe('XX');
      expect(resolveLanguageLabel('')).toBe('Unknown');
    });
  });

  describe('useBookTranslations hook', () => {
    it('returns the current book as active translation immediately', () => {
      const { result } = renderHook(
        () => useBookTranslations('Pride and Prejudice', 'Jane Austen', 1342, ['en']),
        { wrapper: createWrapper() }
      );

      expect(result.current.currentLanguage).toBe('English');
      expect(result.current.translations).toHaveLength(1);
      expect(result.current.translations[0]).toEqual({
        bookId: 1342,
        title: 'Pride and Prejudice',
        languageCode: 'en',
        languageLabel: 'English',
        isCurrent: true,
      });
    });

    it('fetches and groups available international translations from API', async () => {
      const mockApiResponse = {
        results: [
          {
            id: 1342,
            title: 'Pride and Prejudice',
            authors: [{ name: 'Austen, Jane' }],
            languages: ['en'],
          },
          {
            id: 67890,
            title: 'Orgueil et Préjugés',
            authors: [{ name: 'Austen, Jane' }],
            languages: ['fr'],
          },
          {
            id: 54321,
            title: 'Orgullo y Prejuicio',
            authors: [{ name: 'Austen, Jane' }],
            languages: ['es'],
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as any);

      const { result } = renderHook(
        () => useBookTranslations('Pride and Prejudice', 'Jane Austen', 1342, ['en']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.translations.length).toBe(3);
      });

      // Current English edition should be first
      expect(result.current.translations[0].isCurrent).toBe(true);
      expect(result.current.translations[0].languageCode).toBe('en');

      // Discovered translations
      const frenchEdition = result.current.translations.find((t) => t.languageCode === 'fr');
      expect(frenchEdition).toBeDefined();
      expect(frenchEdition?.bookId).toBe(67890);
      expect(frenchEdition?.languageLabel).toBe('French (Français)');
      expect(frenchEdition?.isCurrent).toBe(false);

      const spanishEdition = result.current.translations.find((t) => t.languageCode === 'es');
      expect(spanishEdition).toBeDefined();
      expect(spanishEdition?.bookId).toBe(54321);
      expect(spanishEdition?.languageLabel).toBe('Spanish (Español)');
      expect(spanishEdition?.isCurrent).toBe(false);
    });

    it('handles a bilingual or multi-language current volume and includes all constituent languages', () => {
      const { result } = renderHook(
        () => useBookTranslations('Aeneid Latin-English Parallel', 'Virgil', 227, ['la', 'en']),
        { wrapper: createWrapper() }
      );

      expect(result.current.currentLanguage).toBe('Latin (Lingua Latina), English');
      expect(result.current.translations).toHaveLength(2);
      expect(result.current.translations.map((t) => t.languageCode)).toEqual(
        expect.arrayContaining(['la', 'en'])
      );
      expect(result.current.translations.every((t) => t.isCurrent)).toBe(true);
    });

    it('pulls all available languages when API returns diverse multilingual editions', async () => {
      const mockApiResponse = {
        results: [
          { id: 996, title: 'Don Quixote', authors: [{ name: 'Cervantes, Miguel de' }], languages: ['en'] },
          { id: 2000, title: 'Don Quijote', authors: [{ name: 'Cervantes, Miguel de' }], languages: ['es'] },
          { id: 55752, title: 'Don Quichotte', authors: [{ name: 'Cervantes, Miguel de' }], languages: ['fr'] },
          { id: 22367, title: 'Leben und Taten des scharfsinnigen Edlen Don Quixote', authors: [{ name: 'Cervantes, Miguel de' }], languages: ['de'] },
          { id: 41234, title: 'L’ingegnoso idalgo don Chisciotte della Mancia', authors: [{ name: 'Cervantes, Miguel de' }], languages: ['it'] },
          { id: 31234, title: 'Дон Кихот', authors: [{ name: 'Cervantes, Miguel de' }], languages: ['ru'] },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockApiResponse,
      } as any);

      const { result } = renderHook(
        () => useBookTranslations('Don Quixote', 'Miguel de Cervantes', 996, ['en']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.translations.length).toBe(6);
      });

      const codes = result.current.translations.map((t) => t.languageCode);
      expect(codes).toContain('en');
      expect(codes).toContain('es');
      expect(codes).toContain('fr');
      expect(codes).toContain('de');
      expect(codes).toContain('it');
      expect(codes).toContain('ru');
    });

    it('gracefully handles fetch error and retains current edition', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as any);

      const { result } = renderHook(
        () => useBookTranslations('Frankenstein', 'Mary Shelley', 84, ['en']),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.translations).toHaveLength(1);
      expect(result.current.translations[0].bookId).toBe(84);
      expect(result.current.translations[0].isCurrent).toBe(true);
    });
  });
});


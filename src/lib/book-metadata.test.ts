import { describe, it, expect } from 'vitest';
import {
  resolveBookMetadata,
  isPlaceholderAuthor,
  isPlaceholderTitle,
  cleanBookTitle,
} from './book-metadata';
import type { GutendexBook, GutendexResponse } from '@/mocks/handlers';

describe('src/lib/book-metadata', () => {
  describe('cleanBookTitle', () => {
    it('strips Gutenberg preamble prefixes cleanly', () => {
      expect(cleanBookTitle('The Project Gutenberg eBook of Frankenstein; Or, The Modern Prometheus')).toBe('Frankenstein; Or, The Modern Prometheus');
      expect(cleanBookTitle('The Project Gutenberg EBook of Pride and Prejudice')).toBe('Pride and Prejudice');
      expect(cleanBookTitle("Project Gutenberg's Alice in Wonderland")).toBe('Alice in Wonderland');
      expect(cleanBookTitle('The Project Gutenberg Edition of The Odyssey')).toBe('The Odyssey');
      expect(cleanBookTitle('The Gutenberg eBook of Dracula')).toBe('Dracula');
      expect(cleanBookTitle('Moby Dick')).toBe('Moby Dick');
      expect(cleanBookTitle('')).toBe('');
      expect(cleanBookTitle(null)).toBe('');
      expect(cleanBookTitle(undefined)).toBe('');
    });
  });

  describe('isPlaceholderAuthor', () => {
    it('identifies placeholder and empty authors correctly', () => {
      expect(isPlaceholderAuthor('')).toBe(true);
      expect(isPlaceholderAuthor(null)).toBe(true);
      expect(isPlaceholderAuthor(undefined)).toBe(true);
      expect(isPlaceholderAuthor('Unknown')).toBe(true);
      expect(isPlaceholderAuthor('Unknown Author')).toBe(true);
      expect(isPlaceholderAuthor('anonymous')).toBe(true);
      expect(isPlaceholderAuthor('Classic Masterwork')).toBe(true);
      expect(isPlaceholderAuthor('Public Domain Classic')).toBe(true);
      expect(isPlaceholderAuthor('the author')).toBe(true);
      expect(isPlaceholderAuthor('Project Gutenberg')).toBe(true);
      expect(isPlaceholderAuthor('Various')).toBe(true);
      expect(isPlaceholderAuthor('Various Authors')).toBe(true);

      expect(isPlaceholderAuthor('Jane Austen')).toBe(false);
      expect(isPlaceholderAuthor('F. Scott Fitzgerald')).toBe(false);
    });
  });

  describe('isPlaceholderTitle', () => {
    it('identifies placeholder and generic volume titles correctly', () => {
      expect(isPlaceholderTitle('')).toBe(true);
      expect(isPlaceholderTitle(null)).toBe(true);
      expect(isPlaceholderTitle(undefined)).toBe(true);
      expect(isPlaceholderTitle('Unknown Volume')).toBe(true);
      expect(isPlaceholderTitle('Public Domain Classic')).toBe(true);
      expect(isPlaceholderTitle('Gutenberg Volume #1342')).toBe(true);
      expect(isPlaceholderTitle('The Project Gutenberg eBook')).toBe(true);
      expect(isPlaceholderTitle('Project Gutenberg eBook')).toBe(true);

      expect(isPlaceholderTitle('Pride and Prejudice')).toBe(false);
      expect(isPlaceholderTitle('The Great Gatsby')).toBe(false);
    });
  });

  describe('resolveBookMetadata', () => {
    it('resolves curated static fixtures (Tier 1) for featured book IDs with 0ms preloaded data', () => {
      const result = resolveBookMetadata({ id: 64317 });
      expect(result.id).toBe(64317);
      expect(result.title).toBe('The Great Gatsby');
      expect(result.author).toBe('F. Scott Fitzgerald');
      expect(result.displayAuthor).toBe('F. Scott Fitzgerald');
      expect(result.isPublicDomain).toBe(true);
    });

    it('resolves metadata from Zustand client store (Tier 2) when matching ID', () => {
      const storeBook: GutendexBook = {
        id: 9999,
        title: 'Custom Local Novel',
        authors: [{ name: 'Smith, John', birth_year: null, death_year: null }],
        translators: [],
        subjects: ['Adventure Stories'],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 100,
      };

      const result = resolveBookMetadata({ id: 9999, currentBook: storeBook });
      expect(result.id).toBe(9999);
      expect(result.title).toBe('Custom Local Novel');
      expect(result.author).toBe('John Smith');
      expect(result.primarySubject).toBe('Adventure Stories');
    });

    it('resolves metadata from REST API response (Tier 3)', () => {
      const booksData: GutendexResponse = {
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 8888,
            title: 'API Discovered Work',
            authors: [{ name: 'Shelley, Mary Wollstonecraft', birth_year: 1797, death_year: 1851 }],
            translators: [],
            subjects: ['Gothic Fiction'],
            bookshelves: [],
            languages: ['en'],
            copyright: false,
            media_type: 'Text',
            formats: {},
            download_count: 500,
          },
        ],
      };

      const result = resolveBookMetadata({ id: 8888, booksData });
      expect(result.id).toBe(8888);
      expect(result.title).toBe('API Discovered Work');
      expect(result.author).toBe('Mary Wollstonecraft Shelley');
      expect(result.primarySubject).toBe('Gothic Fiction');
    });

    it('falls back to extracted Gutenberg raw text header (Tier 4) when store and API are unavailable or have placeholders', () => {
      const result = resolveBookMetadata({
        id: 7777,
        extractedMeta: {
          title: 'Direct Link Classic Volume',
          author: 'Poe, Edgar Allan',
        },
      });

      expect(result.id).toBe(7777);
      expect(result.title).toBe('Direct Link Classic Volume');
      expect(result.author).toBe('Edgar Allan Poe');
    });

    it('bypasses store placeholder authors and uses authentic API/header authors', () => {
      const placeholderStoreBook: GutendexBook = {
        id: 64317,
        title: 'The Great Gatsby',
        authors: [{ name: 'Unknown', birth_year: null, death_year: null }],
        translators: [],
        subjects: ['Classic'],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 100,
      };

      const result = resolveBookMetadata({
        id: 64317,
        currentBook: placeholderStoreBook,
      });

      expect(result.author).toBe('F. Scott Fitzgerald');
    });

    it('handles fallback defaults when all metadata sources are empty', () => {
      const result = resolveBookMetadata({ id: 0 });
      expect(result.id).toBe(0);
      expect(result.title).toBe('Public Domain Classic');
      expect(result.author).toBe('');
      expect(result.displayAuthor).toBe('Public Domain Classic');
      expect(result.primarySubject).toBe('Classic Literature');
      expect(result.languages).toEqual(['en']);
      expect(result.isPublicDomain).toBe(true);

      const numericResult = resolveBookMetadata({ id: 12345 });
      expect(numericResult.title).toBe('Gutenberg Volume #12345');
    });

    it('resolves languages correctly with strict ID-guarding from store, API, and header metadata', () => {
      // 1. Store book with matching ID
      const matchingStoreBook: GutendexBook = {
        id: 25946,
        title: 'Gevoel en verstand',
        authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
        translators: [],
        subjects: ['Classic'],
        bookshelves: [],
        languages: ['nl'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 50,
      };
      const resultStore = resolveBookMetadata({
        id: 25946,
        currentBook: matchingStoreBook,
      });
      expect(resultStore.languages).toEqual(['nl']);

      // 2. Store book with mismatched ID (stale previous route)
      const staleStoreBook: GutendexBook = {
        id: 1342,
        title: 'Pride and Prejudice',
        authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
        translators: [],
        subjects: ['Classic'],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 50,
      };
      const resultStale = resolveBookMetadata({
        id: 25946,
        currentBook: staleStoreBook,
        extractedMeta: { title: 'Gevoel en verstand', author: 'Jane Austen', language: 'nl' },
      });
      // Should ignore stale store languages ('en') and use extractedMeta language ('nl')
      expect(resultStale.languages).toEqual(['nl']);

      // 3. API result
      const resultApi = resolveBookMetadata({
        id: 3333,
        booksData: {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 3333,
              title: 'Faust',
              authors: [],
              translators: [],
              subjects: [],
              bookshelves: [],
              languages: ['de'],
              copyright: false,
              media_type: 'Text',
              formats: {},
              download_count: 10,
            },
          ],
        },
      });
      expect(resultApi.languages).toEqual(['de']);
    });
  });
});

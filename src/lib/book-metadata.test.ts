import { describe, it, expect } from 'vitest';
import {
  resolveBookMetadata,
  isPlaceholderAuthor,
  isPlaceholderTitle,
} from './book-metadata';
import type { GutendexBook, GutendexResponse } from '@/mocks/handlers';

describe('src/lib/book-metadata', () => {
  describe('isPlaceholderAuthor', () => {
    it('identifies placeholder and empty authors correctly', () => {
      expect(isPlaceholderAuthor('')).toBe(true);
      expect(isPlaceholderAuthor(null)).toBe(true);
      expect(isPlaceholderAuthor(undefined)).toBe(true);
      expect(isPlaceholderAuthor('Unknown')).toBe(true);
      expect(isPlaceholderAuthor('anonymous')).toBe(true);
      expect(isPlaceholderAuthor('Classic Masterwork')).toBe(true);
      expect(isPlaceholderAuthor('Public Domain Classic')).toBe(true);
      expect(isPlaceholderAuthor('the author')).toBe(true);

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
      expect(result.isPublicDomain).toBe(true);

      const numericResult = resolveBookMetadata({ id: 12345 });
      expect(numericResult.title).toBe('Gutenberg Volume #12345');
    });
  });
});

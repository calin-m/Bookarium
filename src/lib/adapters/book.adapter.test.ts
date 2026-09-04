import { describe, it, expect } from 'vitest';
import {
  normalizeAuthorName,
  extractFormatUrl,
  isCanonicalBook,
  toCanonicalBook,
} from './book.adapter';
import type { GutendexBook, Book } from '@/types/book.types';

describe('book.adapter', () => {
  describe('normalizeAuthorName', () => {
    it('normalizes "LastName, FirstName" to "FirstName LastName"', () => {
      expect(normalizeAuthorName('Austen, Jane')).toBe('Jane Austen');
      expect(normalizeAuthorName('Dostoyevsky, Fyodor')).toBe('Fyodor Dostoyevsky');
      expect(normalizeAuthorName('Conan Doyle, Arthur')).toBe('Arthur Conan Doyle');
    });

    it('returns single word or standard formatted names unchanged', () => {
      expect(normalizeAuthorName('Homer')).toBe('Homer');
      expect(normalizeAuthorName('Jane Austen')).toBe('Jane Austen');
      expect(normalizeAuthorName('')).toBe('');
    });

    it('handles multiple commas gracefully', () => {
      expect(normalizeAuthorName('Tolkien, J. R. R., Sir')).toBe('J. R. R. Sir Tolkien');
    });
  });

  describe('extractFormatUrl', () => {
    it('extracts exact matching MIME type', () => {
      const formats = {
        'text/html': 'https://example.com/book.html',
        'application/epub+zip': 'https://example.com/book.epub',
      };
      expect(extractFormatUrl(formats, ['application/epub+zip'])).toBe('https://example.com/book.epub');
    });

    it('extracts partial/prefix match if exact match is absent', () => {
      const formats = {
        'text/plain; charset=utf-8': 'https://example.com/book.txt',
      };
      expect(extractFormatUrl(formats, ['text/plain'])).toBe('https://example.com/book.txt');
    });

    it('returns null when no preferred MIME is available or formats is invalid', () => {
      expect(extractFormatUrl(undefined, ['text/html'])).toBeNull();
      expect(extractFormatUrl(null, ['text/html'])).toBeNull();
      expect(extractFormatUrl({ 'audio/mp3': 'https://example.com/audio.mp3' }, ['text/html'])).toBeNull();
    });
  });

  describe('isCanonicalBook', () => {
    it('identifies valid canonical Book object', () => {
      const canonical: Book = {
        id: 1342,
        title: 'Pride and Prejudice',
        authors: ['Jane Austen'],
        subjects: ['Classic Literature'],
        languages: ['en'],
        coverUrl: 'https://example.com/cover.jpg',
        epubUrl: 'https://example.com/epub.epub',
        htmlUrl: 'https://example.com/html.html',
        txtUrl: 'https://example.com/txt.txt',
        downloadCount: 50000,
      };
      expect(isCanonicalBook(canonical)).toBe(true);
    });

    it('rejects raw GutendexBook or non-book values', () => {
      const raw: GutendexBook = {
        id: 1342,
        title: 'Pride and Prejudice',
        authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
        translators: [],
        subjects: [],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 50000,
      };
      expect(isCanonicalBook(raw)).toBe(false);
      expect(isCanonicalBook(null)).toBe(false);
      expect(isCanonicalBook('string')).toBe(false);
    });
  });

  describe('toCanonicalBook', () => {
    it('transforms GutendexBook into canonical Book with normalized authors and format URLs', () => {
      const raw: GutendexBook = {
        id: 84,
        title: 'Frankenstein; Or, The Modern Prometheus',
        authors: [{ name: 'Shelley, Mary Wollstonecraft', birth_year: 1797, death_year: 1851 }],
        translators: [],
        subjects: ['Science fiction', 'Horror tales'],
        bookshelves: ['Gothic Fiction'],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {
          'image/jpeg': 'https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg',
          'application/epub+zip': 'https://www.gutenberg.org/ebooks/84.epub3.images',
          'text/html': 'https://www.gutenberg.org/files/84/84-h/84-h.htm',
          'text/plain; charset=utf-8': 'https://www.gutenberg.org/files/84/84-0.txt',
        },
        download_count: 85230,
      };

      const result = toCanonicalBook(raw);

      expect(result.id).toBe(84);
      expect(result.title).toBe('Frankenstein; Or, The Modern Prometheus');
      expect(result.authors).toEqual(['Mary Wollstonecraft Shelley']);
      expect(result.subjects).toEqual(['Science fiction', 'Horror tales']);
      expect(result.languages).toEqual(['en']);
      expect(result.coverUrl).toBe('https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg');
      expect(result.epubUrl).toBe('https://www.gutenberg.org/ebooks/84.epub3.images');
      expect(result.htmlUrl).toBe('https://www.gutenberg.org/files/84/84-h/84-h.htm');
      expect(result.txtUrl).toBe('https://www.gutenberg.org/files/84/84-0.txt');
      expect(result.downloadCount).toBe(85230);
    });

    it('is idempotent when given an already-canonical Book', () => {
      const canonical: Book = {
        id: 2701,
        title: 'Moby Dick',
        authors: ['Herman Melville'],
        subjects: ['Whaling', 'Sea stories'],
        languages: ['en'],
        coverUrl: 'https://example.com/cover.jpg',
        epubUrl: 'https://example.com/epub.epub',
        htmlUrl: 'https://example.com/html.html',
        txtUrl: 'https://example.com/txt.txt',
        downloadCount: 12000,
      };

      const result = toCanonicalBook(canonical);
      expect(result).toEqual(canonical);
    });

    it('handles missing or empty fields safely with reasonable fallbacks', () => {
      expect(toCanonicalBook(null)).toEqual({
        id: 0,
        title: 'Unknown Title',
        authors: ['Anonymous'],
        subjects: [],
        languages: [],
        coverUrl: null,
        epubUrl: null,
        htmlUrl: null,
        txtUrl: null,
        downloadCount: 0,
      });

      const minimal = {
        id: 10,
        title: '',
        authors: [],
      };

      const result = toCanonicalBook(minimal as any);
      expect(result.id).toBe(10);
      expect(result.title).toBe('Untitled');
      expect(result.authors).toEqual(['Anonymous']);
      expect(result.coverUrl).toBeNull();
      expect(result.downloadCount).toBe(0);
    });
  });
});


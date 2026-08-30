import { describe, it, expect } from 'vitest';
import {
  cn,
  extractBookFormats,
  formatDownloadCount,
  calculateReadingTime,
  truncate,
} from './utils';

describe('lib/utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('px-2 py-1', 'bg-blue-500')).toBe('px-2 py-1 bg-blue-500');
      expect(cn('px-2', false && 'hidden', 'px-4')).toBe('px-4');
    });
  });

  describe('extractBookFormats', () => {
    it('should extract standard Gutenberg format keys', () => {
      const formats = {
        'application/epub+zip': 'https://gutenberg.org/ebooks/1342.epub3.images',
        'text/html; charset=utf-8': 'https://gutenberg.org/files/1342/1342-h/1342-h.htm',
        'text/plain; charset=utf-8': 'https://gutenberg.org/ebooks/1342.txt.utf-8',
        'application/x-mobipocket-ebook': 'https://gutenberg.org/ebooks/1342.kindle.images',
        'image/jpeg': 'https://gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg',
        'application/pdf': 'https://gutenberg.org/ebooks/1342.pdf',
      };

      const extracted = extractBookFormats(formats);
      expect(extracted.epub).toBe('https://gutenberg.org/ebooks/1342.epub3.images');
      expect(extracted.html).toBe('https://gutenberg.org/files/1342/1342-h/1342-h.htm');
      expect(extracted.txt).toBe('https://gutenberg.org/ebooks/1342.txt.utf-8');
      expect(extracted.mobi).toBe('https://gutenberg.org/ebooks/1342.kindle.images');
      expect(extracted.coverImage).toBe('https://gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg');
      expect(extracted.pdf).toBe('https://gutenberg.org/ebooks/1342.pdf');
    });

    it('should handle empty or undefined formats gracefully', () => {
      expect(extractBookFormats(undefined)).toEqual({});
      expect(extractBookFormats({})).toEqual({});
    });
  });

  describe('formatDownloadCount', () => {
    it('should format numbers with k and M suffix', () => {
      expect(formatDownloadCount(0)).toBe('0');
      expect(formatDownloadCount(500)).toBe('500');
      expect(formatDownloadCount(1500)).toBe('1.5k');
      expect(formatDownloadCount(25000)).toBe('25k');
      expect(formatDownloadCount(1200000)).toBe('1.2M');
      expect(formatDownloadCount(NaN)).toBe('0');
    });
  });

  describe('calculateReadingTime', () => {
    it('should estimate reading time based on word counts', () => {
      expect(calculateReadingTime(0)).toBe('~1 hr');
      expect(calculateReadingTime(2200)).toBe('10 min read');
      expect(calculateReadingTime(50000)).toBe('3.8 hrs read');
    });
  });

  describe('truncate', () => {
    it('should truncate strings with ellipsis', () => {
      expect(truncate('Short text', 20)).toBe('Short text');
      expect(truncate('The quick brown fox jumps over the lazy dog', 15)).toBe('The quick...');
      expect(truncate('', 10)).toBe('');
    });
  });
});


import { describe, it, expect } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  parseContributors,
  computeLifespanBounds,
  buildStandardFormats,
  normalizeCsvRow,
} = require('./sync-gutenberg-catalog');

describe('sync-gutenberg-catalog parser', () => {
  describe('parseContributors', () => {
    it('parses empty or missing strings safely', () => {
      expect(parseContributors('')).toEqual({ authors: [], translators: [] });
      expect(parseContributors(null)).toEqual({ authors: [], translators: [] });
      expect(parseContributors(undefined)).toEqual({ authors: [], translators: [] });
    });

    it('parses single author with standard birth and death years', () => {
      const res = parseContributors('Austen, Jane, 1775-1817');
      expect(res.authors).toEqual([
        {
          name: 'Austen, Jane',
          birth_year: 1775,
          death_year: 1817,
        },
      ]);
      expect(res.translators).toEqual([]);
    });

    it('parses multiple authors separated by semicolons', () => {
      const res = parseContributors('Marx, Karl, 1818-1883; Engels, Friedrich, 1820-1895');
      expect(res.authors).toHaveLength(2);
      expect(res.authors[0]).toEqual({
        name: 'Marx, Karl',
        birth_year: 1818,
        death_year: 1883,
      });
      expect(res.authors[1]).toEqual({
        name: 'Engels, Friedrich',
        birth_year: 1820,
        death_year: 1895,
      });
    });

    it('correctly categorizes translators based on role annotations', () => {
      const res = parseContributors(
        'Tolstoy, Leo, graf, 1828-1910; Maude, Aylmer, 1858-1938 [Translator]; Maude, Louise, 1855-1939 [Translator]'
      );
      expect(res.authors).toEqual([
        {
          name: 'Tolstoy, Leo, graf',
          birth_year: 1828,
          death_year: 1910,
        },
      ]);
      expect(res.translators).toEqual([
        {
          name: 'Maude, Aylmer',
          birth_year: 1858,
          death_year: 1938,
        },
        {
          name: 'Maude, Louise',
          birth_year: 1855,
          death_year: 1939,
        },
      ]);
    });

    it('handles BCE year dates correctly', () => {
      const res = parseContributors('Plato, 428? BCE-348? BCE');
      expect(res.authors).toEqual([
        {
          name: 'Plato',
          birth_year: -428,
          death_year: -348,
        },
      ]);
    });

    it('handles death-only notation', () => {
      const res = parseContributors('Shakespeare, William, d. 1616');
      expect(res.authors).toEqual([
        {
          name: 'Shakespeare, William',
          birth_year: null,
          death_year: 1616,
        },
      ]);
    });

    it('handles birth-only notation with b., born, or trailing hyphen', () => {
      const res1 = parseContributors('Smith, John, b. 1850');
      expect(res1.authors).toEqual([
        {
          name: 'Smith, John',
          birth_year: 1850,
          death_year: null,
        },
      ]);

      const res2 = parseContributors('Doe, Jane, 1860-');
      expect(res2.authors).toEqual([
        {
          name: 'Doe, Jane',
          birth_year: 1860,
          death_year: null,
        },
      ]);
    });

    it('safely parses authors with single-letter initials without mistaking them for birth years', () => {
      const res1 = parseContributors('Wortham, B. Hale [Translator]');
      expect(res1.translators).toEqual([
        {
          name: 'Wortham, B. Hale',
          birth_year: null,
          death_year: null,
        },
      ]);

      const res2 = parseContributors('Barker, B. (Benjamin); Jones, B. W.');
      expect(res2.authors).toEqual([
        {
          name: 'Barker, B. (Benjamin)',
          birth_year: null,
          death_year: null,
        },
        {
          name: 'Jones, B. W.',
          birth_year: null,
          death_year: null,
        },
      ]);
    });

    it('handles authors without any lifespan dates', () => {
      const res = parseContributors('United States');
      expect(res.authors).toEqual([
        {
          name: 'United States',
          birth_year: null,
          death_year: null,
        },
      ]);
    });
  });

  describe('computeLifespanBounds', () => {
    it('returns nulls for empty inputs', () => {
      expect(computeLifespanBounds([], [])).toEqual({ maxDeath: null, minBirth: null });
    });

    it('calculates min birth and max death spanning authors and translators', () => {
      const authors = [
        { name: 'Author A', birth_year: 1800, death_year: 1860 },
        { name: 'Author B', birth_year: 1810, death_year: 1880 },
      ];
      const translators = [
        { name: 'Translator C', birth_year: 1850, death_year: 1920 },
      ];

      const bounds = computeLifespanBounds(authors, translators);
      expect(bounds.minBirth).toBe(1800);
      expect(bounds.maxDeath).toBe(1920);
    });
  });

  describe('buildStandardFormats', () => {
    it('constructs deterministic Gutenberg mirror endpoints for book id', () => {
      const formats = buildStandardFormats(1342);
      expect(formats['text/plain; charset=utf-8']).toBe('https://www.gutenberg.org/ebooks/1342.txt.utf-8');
      expect(formats['application/epub+zip']).toBe('https://www.gutenberg.org/ebooks/1342.epub3.images');
      expect(formats['image/jpeg']).toBe('https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg');
      expect(formats['text/html']).toBe('https://www.gutenberg.org/ebooks/1342.html.images');
    });
  });

  describe('normalizeCsvRow', () => {
    it('returns null for malformed or non-text rows', () => {
      expect(normalizeCsvRow([])).toBeNull();
      expect(normalizeCsvRow(['invalid', 'Text', '2020-01-01', 'Test'])).toBeNull();
      expect(normalizeCsvRow(['100', 'Sound', '2020-01-01', 'Audiobook'])).toBeNull();
    });

    it('normalizes valid Gutenberg CSV row into complete Book schema object', () => {
      const row = [
        '1342',
        'Text',
        '1998-06-01',
        'Pride and Prejudice',
        'en',
        'Austen, Jane, 1775-1817',
        'England -- Fiction; Young women -- Fiction; Love stories',
        'PR',
        'Best Books Ever; Harvard Classics',
      ];

      const book = normalizeCsvRow(row);
      expect(book).not.toBeNull();
      expect(book.id).toBe(1342);
      expect(book.title).toBe('Pride and Prejudice');
      expect(book.languages).toEqual(['en']);
      expect(book.authors).toEqual([
        { name: 'Austen, Jane', birth_year: 1775, death_year: 1817 },
      ]);
      expect(book.subjects).toEqual([
        'England -- Fiction',
        'Young women -- Fiction',
        'Love stories',
      ]);
      expect(book.bookshelves).toEqual(['Best Books Ever', 'Harvard Classics']);
      expect(book.copyright).toBe(false);
      expect(book.media_type).toBe('Text');
      expect(book.max_author_death_year).toBe(1817);
      expect(book.min_author_birth_year).toBe(1775);
      expect(book.formats['text/plain; charset=utf-8']).toBeDefined();
    });

    it('normalizes multi-line and whitespace title strings cleanly', () => {
      const row = [
        '4',
        'Text',
        '1973-11-01',
        'Lincoln\'s Gettysburg Address\nGiven November 19, 1863 on the battlefield',
        'en',
        'Lincoln, Abraham, 1809-1865',
        'Consecration of cemeteries',
        'E456',
        'US Civil War',
      ];

      const book = normalizeCsvRow(row);
      expect(book.title).toBe('Lincoln\'s Gettysburg Address Given November 19, 1863 on the battlefield');
    });
  });
});


import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ingestCatalog = require('./ingest-catalog');
const {
  resolveRepositoryOrSiteUrl,
  resolveIngestUserAgent,
  CURATED_CLASSICS,
  buildStandardFormats,
  computeLifespanBounds,
  generateSql,
  generateContentUpdateSql,
} = ingestCatalog;

interface CuratedClassicEntry {
  id: number;
  title: string;
  copyright: boolean;
  authors: Array<{ name: string; birth_year: number | null; death_year: number | null }>;
  translators: Array<{ name: string; birth_year: number | null; death_year: number | null }>;
}

describe('scripts/ingest-catalog CLI helpers & invariants', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_GITHUB_REPO;
    delete process.env.BOOKARIUM_REPO_URL;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.VERCEL_GIT_REPO_OWNER;
    delete process.env.VERCEL_GIT_REPO_SLUG;
    delete process.env.GUTENBERG_CONTACT_EMAIL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('resolveRepositoryOrSiteUrl & resolveIngestUserAgent', () => {
    it('prioritizes explicit NEXT_PUBLIC_GITHUB_REPO and optional contact email', () => {
      process.env.NEXT_PUBLIC_GITHUB_REPO = ' https://github.com/example/bookarium ';
      process.env.GUTENBERG_CONTACT_EMAIL = 'maintainer@example.org';

      expect(resolveRepositoryOrSiteUrl()).toBe('https://github.com/example/bookarium');
      expect(resolveIngestUserAgent('2.9.24')).toBe(
        'Bookarium/2.9.24 (+https://github.com/example/bookarium; maintainer@example.org)'
      );
    });

    it('falls back through GITHUB_REPOSITORY and VERCEL_GIT_REPO_* cleanly', () => {
      process.env.GITHUB_REPOSITORY = '/org/bookarium/';
      expect(resolveRepositoryOrSiteUrl()).toBe('https://github.com/org/bookarium');

      delete process.env.GITHUB_REPOSITORY;
      process.env.VERCEL_GIT_REPO_OWNER = 'owner';
      process.env.VERCEL_GIT_REPO_SLUG = 'repo';
      expect(resolveRepositoryOrSiteUrl()).toBe('https://github.com/owner/repo');
      expect(resolveIngestUserAgent('2.9.24')).toBe('Bookarium/2.9.24 (+https://github.com/owner/repo)');
    });
  });

  describe('CURATED_CLASSICS & buildStandardFormats', () => {
    it('enforces public-domain copyright=false and contributor records across all curated titles', () => {
      expect(CURATED_CLASSICS.length).toBeGreaterThan(0);
      for (const book of CURATED_CLASSICS as CuratedClassicEntry[]) {
        expect(book.id).toBeGreaterThan(0);
        expect(book.copyright).toBe(false);
        expect(book.authors.length).toBeGreaterThan(0);
      }
    });

    it('constructs standard HTTPS Project Gutenberg format URLs', () => {
      const formats = buildStandardFormats(1342);
      expect(formats['text/html']).toBe('https://www.gutenberg.org/ebooks/1342.html.images');
      expect(formats['application/epub+zip']).toBe('https://www.gutenberg.org/ebooks/1342.epub3.images');
      expect(formats['image/jpeg']).toBe('https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg');
    });
  });

  describe('computeLifespanBounds', () => {
    it('returns null bounds when contributor lists are empty', () => {
      expect(computeLifespanBounds([], [])).toEqual({ maxDeath: null, minBirth: null });
    });

    it('computes max death across authors and translators under Berne Art. 7bis/Art. 2(3)', () => {
      const bounds = computeLifespanBounds(
        [{ name: 'Dostoyevsky, Fyodor', birth_year: 1821, death_year: 1881 }],
        [{ name: 'Garnett, Constance', birth_year: 1861, death_year: 1946 }]
      );
      expect(bounds).toEqual({ maxDeath: 1946, minBirth: 1821 });
    });

    it('uses birth + 100 heuristic when death_year is missing, and fails closed if any contributor lacks both years', () => {
      expect(
        computeLifespanBounds([{ name: 'Author', birth_year: 1800, death_year: null }], [])
      ).toEqual({ maxDeath: 1900, minBirth: 1800 });

      expect(
        computeLifespanBounds(
          [
            { name: 'Known', birth_year: 1800, death_year: 1850 },
            { name: 'Unknown', birth_year: null, death_year: null },
          ],
          []
        )
      ).toEqual({ maxDeath: null, minBirth: 1800 });
    });
  });

  describe('generateSql & generateContentUpdateSql', () => {
    it('emits idempotent ON CONFLICT upsert SQL and escapes single quotes safely', () => {
      const sql = generateSql([
        {
          id: 84,
          title: "Frankenstein's Monster",
          authors: [{ name: 'Shelley, Mary', birth_year: 1797, death_year: 1851 }],
          translators: [],
          subjects: ["Gothic 'Horror'"],
          bookshelves: ['Gothic Fiction'],
          languages: ['en'],
          copyright: false,
          download_count: 85210,
          max_author_death_year: 1851,
          min_author_birth_year: 1797,
        },
      ]);

      expect(sql).toContain('ALTER TABLE public.books ADD COLUMN IF NOT EXISTS content TEXT;');
      expect(sql).toContain("INSERT INTO public.books (");
      expect(sql).toContain("'Frankenstein''s Monster'");
      expect(sql).toContain("'Gothic ''Horror'''");
      expect(sql).toContain('ON CONFLICT (id) DO UPDATE SET');
    });

    it('emits dollar-quoted idempotent content UPDATE statements only for books with content', () => {
      const updateSql = generateContentUpdateSql([
        { id: 11, title: "Alice's Adventures", content: 'Chapter I text body' },
        { id: 84, title: 'Frankenstein' },
      ]);

      expect(updateSql).toContain('-- Total Volumes: 1');
      expect(updateSql).toContain(
        'UPDATE public.books SET content = $bookarium_txt_11$Chapter I text body$bookarium_txt_11$, updated_at = NOW() WHERE id = 11;'
      );
      expect(updateSql).not.toContain('WHERE id = 84');
    });
  });
});

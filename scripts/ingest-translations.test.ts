import { describe, it, expect } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  normalizeLanguageToCode,
  extractAuthorSurname,
  isOmnibusOrAnthology,
  extractRootTitle,
  extractSignificantKeywords,
  checkAuthorCompatibility,
  checkHeuristicWorkMatch,
  loadFallbackSnapshot,
  filterValidCatalogBookIds,
  generateAtomicSeedSql,
} = require('./ingest-translations');

describe('scripts/ingest-translations Engine', () => {
  describe('normalizeLanguageToCode', () => {
    it('normalizes common language names and variants to ISO codes', () => {
      expect(normalizeLanguageToCode('English')).toBe('en');
      expect(normalizeLanguageToCode('French')).toBe('fr');
      expect(normalizeLanguageToCode('German')).toBe('de');
      expect(normalizeLanguageToCode('Spanish')).toBe('es');
      expect(normalizeLanguageToCode('Catalan')).toBe('ca');
      expect(normalizeLanguageToCode('Ancient Greek')).toBe('grc');
      expect(normalizeLanguageToCode('Esperanto')).toBe('eo');
      expect(normalizeLanguageToCode('Tagalog')).toBe('tl');
      expect(normalizeLanguageToCode('es-MX')).toBe('es');
      expect(normalizeLanguageToCode(null)).toBe('en');
      expect(normalizeLanguageToCode('')).toBe('en');
    });
  });

  describe('extractAuthorSurname', () => {
    it('extracts primary identifying surname across various international conventions', () => {
      expect(extractAuthorSurname('Austen, Jane')).toBe('Austen');
      expect(extractAuthorSurname('Doyle, Arthur Conan')).toBe('Doyle');
      expect(extractAuthorSurname('Cervantes Saavedra, Miguel de')).toBe('Cervantes');
      expect(extractAuthorSurname('Maupassant, Guy de')).toBe('Maupassant');
      expect(extractAuthorSurname('Guy de Maupassant')).toBe('Maupassant');
      expect(extractAuthorSurname('Homer')).toBe('Homer');
      expect(extractAuthorSurname('')).toBe('');
      expect(extractAuthorSurname(null)).toBe('');
    });
  });

  describe('isOmnibusOrAnthology (Defense 2)', () => {
    it('identifies and quarantines omnibus multi-work collections', () => {
      expect(isOmnibusOrAnthology('The Complete Works of William Shakespeare')).toBe(true);
      expect(isOmnibusOrAnthology('Collected Works of Henrik Ibsen')).toBe(true);
      expect(isOmnibusOrAnthology('The Harvard Classics, Volume 01')).toBe(true);
      expect(isOmnibusOrAnthology('An Anthology of Modern Verse')).toBe(true);
      expect(isOmnibusOrAnthology('Oeuvres complètes de Voltaire')).toBe(true);
      expect(isOmnibusOrAnthology('Pride and Prejudice')).toBe(false);
      expect(isOmnibusOrAnthology('Don Quixote')).toBe(false);
    });
  });

  describe('extractRootTitle & extractSignificantKeywords', () => {
    it('strips subtitles and volume numbers to reveal significant keywords', () => {
      expect(extractRootTitle('Frankenstein; Or, The Modern Prometheus')).toBe('Frankenstein');
      expect(extractRootTitle('The History of Don Quixote, Volume 1')).toBe('The History of Don Quixote');

      const kw = extractSignificantKeywords('The History of Don Quixote, Volume 1');
      expect(kw).toContain('don');
      expect(kw).toContain('quixote');
      expect(kw).not.toContain('the');
      expect(kw).not.toContain('of');
    });
  });

  describe('checkAuthorCompatibility (Blocker 2)', () => {
    it('blocks disparate authors (Zero False Positive Enforcement)', () => {
      const bookAlcover = {
        id: 76831,
        title: 'Cap al tard',
        authors: [{ name: 'Alcover, Joan' }],
      };
      const bookAlcove = {
        id: 1851,
        title: 'The Woman in the Alcove',
        authors: [{ name: 'Green, Anna Katharine' }],
      };

      expect(checkAuthorCompatibility(bookAlcover, bookAlcove)).toBe(false);
    });

    it('permits authentic translations sharing primary authors or translators', () => {
      const bookOriginal = {
        id: 2000,
        title: 'Don Quijote',
        authors: [{ name: 'Cervantes Saavedra, Miguel de' }],
      };
      const bookTrans = {
        id: 996,
        title: 'The History of Don Quixote',
        authors: [{ name: 'Cervantes Saavedra, Miguel de' }],
        translators: [{ name: 'Ormsby, John' }],
      };

      expect(checkAuthorCompatibility(bookOriginal, bookTrans)).toBe(true);
    });
  });

  describe('checkHeuristicWorkMatch (Defense 5)', () => {
    it('rejects different works by the same prolific author', () => {
      const lesMis = {
        id: 135,
        title: 'Les Misérables',
        authors: [{ name: 'Hugo, Victor' }],
        subjects: ['Paris (France) -- Fiction', 'Ex-convicts -- Fiction'],
      };
      const notreDame = {
        id: 2610,
        title: 'Notre-Dame de Paris',
        authors: [{ name: 'Hugo, Victor' }],
        subjects: ['Quasimodo (Fictitious character) -- Fiction', 'Cathedrals -- Fiction'],
      };

      const res = checkHeuristicWorkMatch(lesMis, notreDame);
      expect(res.matches).toBe(false);
      expect(res.reason).toContain('different works');
    });

    it('matches authentic translations via cognates or subjects', () => {
      const prideEn = {
        id: 1342,
        title: 'Pride and Prejudice',
        authors: [{ name: 'Austen, Jane' }],
        subjects: ['Courtship -- Fiction', 'Young women -- Fiction'],
      };
      const prideFr = {
        id: 43647,
        title: 'Orgueil et Préjugé',
        authors: [{ name: 'Austen, Jane' }],
        translators: [{ name: 'Malespine, Eloïse' }],
        subjects: ['Courtship -- Fiction', 'Young women -- Fiction'],
      };

      const res = checkHeuristicWorkMatch(prideEn, prideFr);
      expect(res.matches).toBe(true);
      expect(res.reason).toContain('Subjects');
    });

    it('quarantines omnibuses even if author matches (Defense 2)', () => {
      const complete = {
        id: 100,
        title: 'The Complete Works of William Shakespeare',
        authors: [{ name: 'Shakespeare, William' }],
        subjects: ['English drama'],
      };
      const hamlet = {
        id: 1524,
        title: 'Hamlet, Prince of Denmark',
        authors: [{ name: 'Shakespeare, William' }],
        subjects: ['Hamlet (Legendary character)', 'English drama'],
      };

      const res = checkHeuristicWorkMatch(complete, hamlet);
      expect(res.matches).toBe(false);
      expect(res.reason).toContain('Omnibus');
    });
  });

  describe('loadFallbackSnapshot (Defense 3)', () => {
    it('loads offline backup snapshot successfully', () => {
      const snapshot = loadFallbackSnapshot();
      expect(Array.isArray(snapshot)).toBe(true);
      expect(snapshot.length).toBeGreaterThan(0);
      expect(snapshot[0]).toHaveProperty('workId');
      expect(snapshot[0]).toHaveProperty('editions');
    });
  });

  describe('generateAtomicSeedSql (Blocker 5 & Defense 4)', () => {
    it('generates atomic transaction with foreign key safe join on public.books', () => {
      const sample = [
        {
          work_id: 'Q170583',
          book_id: 1342,
          language: 'en',
          is_original: true,
          confidence_score: 1.0,
          source: 'authority_wikidata',
        },
        {
          work_id: 'Q170583',
          book_id: 43647,
          language: 'fr',
          is_original: false,
          confidence_score: 1.0,
          source: 'authority_wikidata',
        },
      ];

      const sql = generateAtomicSeedSql(sample);
      expect(sql).toContain('BEGIN;');
      expect(sql).toContain('COMMIT;');
      expect(sql).toContain('INSERT INTO public.book_translations');
      expect(sql).toContain('JOIN public.books b ON b.id = v.book_id');
      expect(sql).toContain('ON CONFLICT (work_id, book_id) DO UPDATE');
      expect(sql).toContain("('Q170583', 1342, 'en', true, 1.00, 'authority_wikidata')");
    });
  });

  describe('filterValidCatalogBookIds (Defense 4)', () => {
    it('returns all candidate IDs when supabase client is not provided', async () => {
      const candidates = [1, 2, 3];
      const result = await filterValidCatalogBookIds(null, candidates);
      expect(Array.from(result)).toEqual([1, 2, 3]);
    });

    it('filters out book IDs that do not exist in public.books table', async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            in: async (_col: string, ids: number[]) => {
              // Simulate only IDs 1342 and 43647 existing in catalog, while 999999 is missing
              const valid = ids.filter((id) => id !== 999999).map((id) => ({ id }));
              return { data: valid, error: null };
            },
          }),
        }),
      };

      const candidates = [1342, 43647, 999999];
      const result = await filterValidCatalogBookIds(mockSupabase, candidates);
      expect(result.has(1342)).toBe(true);
      expect(result.has(43647)).toBe(true);
      expect(result.has(999999)).toBe(false);
      expect(result.size).toBe(2);
    });

    it('gracefully falls back to candidates when database query fails', async () => {
      const mockSupabase = {
        from: () => ({
          select: () => ({
            in: async () => ({ data: null, error: { message: 'Network error' } }),
          }),
        }),
      };

      const candidates = [100, 200];
      const result = await filterValidCatalogBookIds(mockSupabase, candidates);
      expect(Array.from(result)).toEqual([100, 200]);
    });
  });
});


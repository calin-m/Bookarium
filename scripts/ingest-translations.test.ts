import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ingestTranslations = require('./ingest-translations');
const {
  WIKIDATA_SPARQL_TIMEOUT_MS,
  resolveSiteOriginFallback,
  resolveUserAgent,
  normalizeLanguageToCode,
  extractAuthorSurname,
  isOmnibusOrAnthology,
  extractRootTitle,
  extractSignificantKeywords,
  checkAuthorCompatibility,
  checkHeuristicWorkMatch,
  fetchWikidataTranslations,
  loadFallbackSnapshot,
  isTransientSupabaseError,
  filterValidCatalogBookIds,
  upsertTranslationBatchesWithRetry,
  generateAtomicSeedSql,
} = ingestTranslations;

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
      expect(sql).toContain('WHERE b.copyright = false');
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
      let capturedTable = '';
      let capturedSelect = '';
      let capturedInCol = '';
      const mockSupabase = {
        from: (table: string) => {
          capturedTable = table;
          return {
            select: (cols: string) => {
              capturedSelect = cols;
              return {
                in: async (col: string, ids: number[]) => {
                  capturedInCol = col;
                  // Simulate IDs 1342 and 43647 cleared, 90123 copyrighted, and 999999 missing
                  const valid = ids
                    .filter((id) => id !== 999999)
                    .map((id) =>
                      id === 90123
                        ? { id, copyright: true }
                        : id === 43647
                          ? { id, copyright: false }
                          : { id }
                    );
                  return { data: valid, error: null };
                },
              };
            },
          };
        },
      };

      const candidates = [1342, 43647, 90123, 999999];
      const result = await filterValidCatalogBookIds(mockSupabase, candidates);
      expect(capturedTable).toBe('books');
      expect(capturedSelect).toBe('id, copyright');
      expect(capturedInCol).toBe('id');
      expect(result.has(1342)).toBe(true);
      expect(result.has(43647)).toBe(true);
      expect(result.has(90123)).toBe(false);
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

  describe('resolveSiteOriginFallback & resolveUserAgent', () => {
    it('normalizes canonical origin fallbacks across NEXT_PUBLIC_SITE_URL and Vercel production vars', () => {
      expect(resolveSiteOriginFallback({})).toBe('https://bookarium.vercel.app');
      expect(
        resolveSiteOriginFallback({
          VERCEL_PROJECT_PRODUCTION_URL: 'bookarium.ro/',
        })
      ).toBe('https://bookarium.ro');
      expect(
        resolveSiteOriginFallback({
          NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: 'cdn.bookarium.ro',
          VERCEL_PROJECT_PRODUCTION_URL: 'ignored.example.com',
        })
      ).toBe('https://cdn.bookarium.ro');
      expect(
        resolveSiteOriginFallback({
          NEXT_PUBLIC_SITE_URL: 'https://primary.bookarium.ro///',
          NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: 'cdn.bookarium.ro',
        })
      ).toBe('https://primary.bookarium.ro');
      expect(
        resolveSiteOriginFallback({
          NEXT_PUBLIC_SITE_URL: 'javascript:alert(1)',
          VERCEL_PROJECT_PRODUCTION_URL: 'http://localhost:3000/',
        })
      ).toBe('http://localhost:3000');
    });

    it('builds descriptive Bookarium-Gatekeeper User-Agent strings from explicit or resolved origins', () => {
      expect(
        resolveUserAgent({
          BOOKARIUM_REPO_URL: 'https://bookarium.ro',
          GUTENBERG_CONTACT_EMAIL: 'ops@bookarium.ro',
        })
      ).toBe('Bookarium-Gatekeeper/1.0 (+https://bookarium.ro; ops@bookarium.ro)');

      expect(
        resolveUserAgent({
          GITHUB_REPOSITORY: '/custom-org/bookarium-fork/',
        })
      ).toBe('Bookarium-Gatekeeper/1.0 (+https://github.com/custom-org/bookarium-fork)');

      expect(resolveUserAgent({})).toMatch(/^Bookarium-Gatekeeper\/1\.0 \(\+https?:\/\/.+\)$/);
    });
  });

  describe('Wikidata SPARQL Timeout, Strict FK Validation & Upsert Retry/Bisection', () => {
    it('aborts hung Wikidata SPARQL requests via WIKIDATA_SPARQL_TIMEOUT_MS socket timeout handler', async () => {
      expect(WIKIDATA_SPARQL_TIMEOUT_MS).toBe(45_000);

      let capturedTimeoutMs: number | undefined;
      const destroyMock = vi.fn();
      const mockHttpsGet = vi.fn(
        (_url: string, opts: { timeout?: number }, _cb: (res: unknown) => void) => {
          capturedTimeoutMs = opts.timeout;
          const reqEmitter = new EventEmitter() as EventEmitter & {
            setTimeout: (ms: number, handler: () => void) => void;
            destroy: typeof destroyMock;
          };
          reqEmitter.destroy = destroyMock;
          reqEmitter.setTimeout = (_ms: number, handler: () => void) => {
            queueMicrotask(() => handler());
          };
          return reqEmitter;
        }
      );

      await expect(
        fetchWikidataTranslations(10, { timeoutMs: 250, httpsGet: mockHttpsGet })
      ).rejects.toThrow(/timed out after 250ms/);
      expect(capturedTimeoutMs).toBe(250);
      expect(destroyMock).toHaveBeenCalledTimes(1);
    });

    it('retries transient FK pre-checks, honors throwOnError, and returns empty Set when catalog is empty', async () => {
      expect(isTransientSupabaseError(new Error('canceling statement due to statement timeout'))).toBe(true);
      expect(isTransientSupabaseError(new Error('violates foreign key constraint'))).toBe(false);

      let attempts = 0;
      const flakySupabase = {
        from: () => ({
          select: () => ({
            in: async () => {
              attempts++;
              if (attempts < 2) {
                return { data: null, error: { message: 'statement timeout' } };
              }
              return { data: [], error: null };
            },
          }),
        }),
      };

      const emptyResult = await filterValidCatalogBookIds(flakySupabase, [100, 200], {
        retries: 3,
        baseDelayMs: 0,
        throwOnError: true,
      });
      expect(attempts).toBe(2);
      expect(emptyResult instanceof Set).toBe(true);
      expect(emptyResult.size).toBe(0);

      const deadSupabase = {
        from: () => ({
          select: () => ({
            in: async () => ({ data: null, error: { message: 'persistent connection reset' } }),
          }),
        }),
      };

      await expect(
        filterValidCatalogBookIds(deadSupabase, [100, 200], {
          retries: 2,
          baseDelayMs: 0,
          throwOnError: true,
        })
      ).rejects.toThrow(/Foreign-key catalog pre-check failed: persistent connection reset/);
    });

    it('retries transient batch upserts, bisects failing chunks down to failing rows, and tracks failedRowCount', async () => {
      const sampleRows = [
        { work_id: 'Q1', book_id: 10, language: 'en', is_original: false, confidence_score: 1, source: 'authority_wikidata' },
        { work_id: 'Q1', book_id: 20, language: 'fr', is_original: false, confidence_score: 1, source: 'authority_wikidata' },
        { work_id: 'Q2', book_id: 999999, language: 'de', is_original: false, confidence_score: 1, source: 'authority_wikidata' },
        { work_id: 'Q2', book_id: 30, language: 'es', is_original: false, confidence_score: 1, source: 'authority_wikidata' },
      ];

      let transientAttempts = 0;
      const warnSpy = vi.fn();
      const mixedSupabase = {
        from: () => ({
          upsert: async (slice: Array<{ book_id: number }>) => {
            if (slice.length === 4 && transientAttempts === 0) {
              transientAttempts++;
              return { error: { message: 'canceling statement due to statement timeout' } };
            }
            if (slice.some((r) => r.book_id === 999999)) {
              return { error: { message: 'violates foreign key constraint "book_translations_book_id_fkey"' } };
            }
            return { error: null };
          },
        }),
      };

      const res = await upsertTranslationBatchesWithRetry(mixedSupabase, sampleRows, {
        batchSize: 4,
        retries: 2,
        baseDelayMs: 0,
        ignoreDuplicates: false,
        logger: { warn: warnSpy },
      });

      expect(res.upsertedCount).toBe(3);
      expect(res.failedRowCount).toBe(1);
      expect(res.failedBatchCount).toBe(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(res.errors[0]).toContain('foreign key constraint');
    });
  });
});


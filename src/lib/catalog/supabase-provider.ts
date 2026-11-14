import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ICatalogProvider,
  CatalogQueryOptions,
  CatalogQueryResult,
} from '@/types/catalog.types';
import { CatalogProviderError } from '@/types/catalog.types';
import type { GutendexBook, Author, BookPassage } from '@/types/book.types';
import type { Database, DatabaseBook } from '@/types/database.types';
import { createClient } from '@/lib/supabase/client';
import {
  isBookPublicDomainInJurisdiction,
  getJurisdictionRule,
  type JurisdictionRule,
} from '@/lib/copyright-engine';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';
import { LITERARY_QUOTES } from '@/config/literary-quotes';

/**
 * Columns explicitly selected for catalog search to prevent transferring large unabridged text,
 * unrendered quote arrays, or unmapped internal indexing/timestamp columns.
 */
export const CATALOG_METADATA_COLUMNS =
  'id, title, authors, translators, subjects, bookshelves, languages, copyright, media_type, formats, download_count' as const;

/**
 * Extended catalog columns including full quote passages when specifically requested by options.hasQuotes.
 */
export const CATALOG_WITH_QUOTES_COLUMNS =
  `${CATALOG_METADATA_COLUMNS}, quotes` as const;

/**
 * 2-spread quota-sliced columns for high-efficiency Quote Pool discovery via PostgREST native JSON array element projection.
 */
export const QUOTE_POOL_COLUMNS =
  'id, title, authors, translators, subjects, bookshelves, languages, copyright, download_count, quote0:quotes->0, quote1:quotes->1' as const;

/**
 * Default number of quote-enriched books transferred per Quote Pool batch (~22 KB).
 */
export const DEFAULT_QUOTE_POOL_LIMIT = 48;
export const MAX_CATALOG_OFFSET = 160_000;

/**
 * 12-hour cache lifetime (ms) for Quote Pool batches. Over 7 days (Sunday -> Sunday = 14 half-day windows),
 * 14 batches x 48 books = 672 book slots, cycling through all ~564 weekly quote-enriched books.
 */
export const QUOTE_POOL_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CATALOG_CACHE_ENTRIES = 64;
const METADATA_WARM_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_SHARED_METADATA_ENTRIES = 1000;

interface CatalogQueryCacheEntry {
  result: CatalogQueryResult;
  expiresAt: number;
}

interface SharedBookMetadataEntry {
  book: {
    id: number;
    title: string;
    authors?: Author[];
    translators?: Author[];
    copyright?: boolean | null;
  };
  expiresAt: number;
}

const globalForCatalogCache = globalThis as typeof globalThis & {
  __bookariumCatalogQueryCache?: Map<string, CatalogQueryCacheEntry>;
  __bookariumMetadataCache?: Map<number, SharedBookMetadataEntry>;
};

const catalogQueryCache =
  globalForCatalogCache.__bookariumCatalogQueryCache ??
  (globalForCatalogCache.__bookariumCatalogQueryCache = new Map<string, CatalogQueryCacheEntry>());

function warmBookMetadataCache(books: GutendexBook[]): void {
  if (!books || books.length === 0) return;
  const metadataCache =
    globalForCatalogCache.__bookariumMetadataCache ??
    (globalForCatalogCache.__bookariumMetadataCache = new Map<number, SharedBookMetadataEntry>());
  const expiresAt = Date.now() + METADATA_WARM_TTL_MS;

  for (const book of books) {
    if (!book || typeof book.id !== 'number') continue;
    if (metadataCache.has(book.id)) {
      metadataCache.delete(book.id);
    } else if (metadataCache.size >= MAX_SHARED_METADATA_ENTRIES) {
      const oldestKey = metadataCache.keys().next().value;
      if (typeof oldestKey === 'number') {
        metadataCache.delete(oldestKey);
      }
    }
    metadataCache.set(book.id, {
      book: {
        id: book.id,
        title: book.title,
        authors: book.authors,
        translators: book.translators,
        copyright: book.copyright,
      },
      expiresAt,
    });
  }
}

const FEATURED_HERO_ORDER_MAP = new Map<number, number>(
  FEATURED_HERO_BOOKS.map((b, idx) => [b.id, idx])
);

/**
 * Deterministically slices a candidate ID pool for a 12-hour cache window when the total candidate
 * set exceeds `limit`. Preserves a rotating 12-book window of `FEATURED_HERO_BOOKS` for SSR hydration
 * parity and fills the remaining slots by striding through the dynamic candidate IDs (`500` top + `64` recent)
 * so 100% of the weekly Sunday-to-Sunday batch is showcased across the 14 weekly 12-hour windows.
 */
export function selectRotatingQuotePoolCandidateIds(
  allCandidateIds: number[],
  limit: number = DEFAULT_QUOTE_POOL_LIMIT,
  timestampMs: number = Date.now()
): number[] {
  const boundedLimit = Math.max(1, Math.min(DEFAULT_QUOTE_POOL_LIMIT, limit));
  const uniqueIds = Array.from(
    new Set(allCandidateIds.filter((id) => Number.isInteger(id) && id > 0))
  );
  if (uniqueIds.length <= boundedLimit) {
    return uniqueIds;
  }

  const windowIndex = Math.max(0, Math.floor(timestampMs / QUOTE_POOL_CACHE_TTL_MS));
  const heroIdsInPool = uniqueIds.filter((id) => FEATURED_HERO_ORDER_MAP.has(id));
  const dynamicIds = uniqueIds.filter((id) => !FEATURED_HERO_ORDER_MAP.has(id));

  const heroQuota = Math.min(heroIdsInPool.length, Math.min(12, Math.ceil(boundedLimit / 4)));
  const selectedIds: number[] = [];

  if (heroIdsInPool.length > 0 && heroQuota > 0) {
    const heroStart = (windowIndex * heroQuota) % heroIdsInPool.length;
    for (let i = 0; i < heroQuota; i++) {
      selectedIds.push(heroIdsInPool[(heroStart + i) % heroIdsInPool.length]);
    }
  }

  const dynamicQuota = Math.min(dynamicIds.length, boundedLimit - selectedIds.length);
  if (dynamicIds.length > 0 && dynamicQuota > 0) {
    const dynamicStart = (windowIndex * dynamicQuota) % dynamicIds.length;
    for (let i = 0; i < dynamicQuota; i++) {
      selectedIds.push(dynamicIds[(dynamicStart + i) % dynamicIds.length]);
    }
  }

  if (selectedIds.length < boundedLimit) {
    const chosenSet = new Set(selectedIds);
    for (const id of uniqueIds) {
      if (selectedIds.length >= boundedLimit) break;
      if (!chosenSet.has(id)) {
        selectedIds.push(id);
        chosenSet.add(id);
      }
    }
  }

  return selectedIds;
}

export function filterValidBookPassages(rawQuotes: unknown): BookPassage[] {
  if (!Array.isArray(rawQuotes)) return [];
  return rawQuotes.filter(
    (item): item is BookPassage =>
      Boolean(
        item &&
          typeof item === 'object' &&
          typeof (item as BookPassage).openingLine === 'string' &&
          typeof (item as BookPassage).quoteExcerpt === 'string' &&
          !String((item as BookPassage).commentary || '').startsWith(
            'Bibliographic sentinel record'
          )
      )
  );
}

export function sortQuoteEnrichedBooksDeterministically(books: GutendexBook[]): GutendexBook[] {
  return [...books].sort((a, b) => {
    const idxA = FEATURED_HERO_ORDER_MAP.get(a.id);
    const idxB = FEATURED_HERO_ORDER_MAP.get(b.id);
    if (idxA !== undefined && idxB !== undefined) {
      return idxA - idxB;
    }
    if (idxA !== undefined) return -1;
    if (idxB !== undefined) return 1;
    return (b.download_count ?? 0) - (a.download_count ?? 0) || a.id - b.id;
  });
}

/**
 * Checks if Supabase credentials are genuinely configured (non-empty, non-placeholder).
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return false;
  if (url.includes('placeholder.supabase.co') || key.includes('placeholder-anon-key')) {
    return false;
  }
  return true;
}

/**
 * Maps a database row from `public.books` to standard GutendexBook format.
 */
export function mapDatabaseBookToGutendexBook(row: DatabaseBook): GutendexBook {
  const mapped: GutendexBook = {
    id: row.id,
    title: row.title,
    authors: (Array.isArray(row.authors) ? (row.authors as unknown as Author[]) : []),
    translators: (Array.isArray(row.translators) ? (row.translators as unknown as Author[]) : []),
    subjects: Array.isArray(row.subjects) ? row.subjects : [],
    bookshelves: Array.isArray(row.bookshelves) ? row.bookshelves : [],
    languages: Array.isArray(row.languages) ? row.languages : [],
    copyright: row.copyright,
    media_type: row.media_type || 'Text',
    formats:
      row.formats && typeof row.formats === 'object' && !Array.isArray(row.formats)
        ? (row.formats as Record<string, string>)
        : {},
    download_count: row.download_count ?? 0,
  };
  if (Array.isArray(row.quotes) && row.quotes.length > 0) {
    const validQuotes = (row.quotes as unknown as BookPassage[]).filter(
      (q) =>
        q &&
        typeof q === 'object' &&
        !String(q.commentary || '').startsWith('Bibliographic sentinel record')
    );
    if (validQuotes.length > 0) {
      mapped.quotes = validQuotes;
    }
  }
  return mapped;
}

/**
 * Supabase PostgreSQL Catalog Provider
 * Queries dedicated Supabase PostgreSQL catalog with GIN indexed full-text search,
 * indexed language/subject matching, pre-computed lifespan filtering, and Berne Convention verification.
 */
export class SupabaseCatalogProvider implements ICatalogProvider {
  public readonly name = 'supabase' as const;
  private client: SupabaseClient<Database> | null;
  private instanceQueryCache = new Map<string, CatalogQueryCacheEntry>();
  private lastHealthCheckTime = 0;
  private lastHealthCheckResult = false;
  public static readonly HEALTH_CACHE_TTL_MS = 60 * 1000; // 60 seconds

  constructor(client?: SupabaseClient<Database>) {
    this.client = client || null;
  }

  public resetHealthCache(): void {
    this.lastHealthCheckTime = 0;
    this.lastHealthCheckResult = false;
    this.instanceQueryCache.clear();
    if (!this.client) {
      catalogQueryCache.clear();
    }
  }

  private getQueryCache(): Map<string, CatalogQueryCacheEntry> {
    return this.client ? this.instanceQueryCache : catalogQueryCache;
  }

  private getCachedCatalogResult(
    cacheKey: string,
    now: number
  ): CatalogQueryResult | undefined {
    const cache = this.getQueryCache();
    const cached = cache.get(cacheKey);
    if (!cached) return undefined;
    if (cached.expiresAt <= now) {
      cache.delete(cacheKey);
      return undefined;
    }
    cache.delete(cacheKey);
    cache.set(cacheKey, cached);
    return {
      ...cached.result,
      latencyMs: 0,
    };
  }

  private setCachedCatalogResult(
    cacheKey: string,
    result: CatalogQueryResult,
    now: number
  ): void {
    const cache = this.getQueryCache();
    if (cache.has(cacheKey)) {
      cache.delete(cacheKey);
    } else if (cache.size >= MAX_CATALOG_CACHE_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (typeof oldestKey === 'string') {
        cache.delete(oldestKey);
      }
    }
    cache.set(cacheKey, {
      result,
      expiresAt: now + CATALOG_CACHE_TTL_MS,
    });
    warmBookMetadataCache(result.results);
  }

  private getSupabase(): SupabaseClient<Database> {
    if (!this.client) {
      this.client = createClient();
    }
    return this.client;
  }

  /**
   * Health check verifying Supabase connectivity and presence of catalog records.
   * Returns false if unconfigured, unreachable, or table is empty.
   * Caches result for 60 seconds to eliminate redundant network roundtrips on consecutive queries.
   */
  public async isHealthy(): Promise<boolean> {
    if (!isSupabaseConfigured() && !this.client) {
      return false;
    }

    const now = Date.now();
    if (now - this.lastHealthCheckTime < SupabaseCatalogProvider.HEALTH_CACHE_TTL_MS) {
      return this.lastHealthCheckResult;
    }

    try {
      const supabase = this.getSupabase();
      let query = supabase
        .from('books')
        .select('id', { count: 'estimated', head: true });

      const abortableQuery = query as typeof query & { abortSignal?: (signal: AbortSignal) => typeof query };
      if (typeof abortableQuery.abortSignal === 'function') {
        query = abortableQuery.abortSignal(AbortSignal.timeout(2500));
      }

      const { count, error } = await query;

      if (error || count === null || count === undefined || count === 0) {
        this.lastHealthCheckResult = false;
      } else {
        this.lastHealthCheckResult = true;
      }
      this.lastHealthCheckTime = now;
      return this.lastHealthCheckResult;
    } catch {
      this.lastHealthCheckResult = false;
      this.lastHealthCheckTime = now;
      return false;
    }
  }

  /**
   * Filters and verifies a raw database batch against copyright jurisdiction and formats.
   */
  private filterBatch(
    rawRows: DatabaseBook[],
    options: CatalogQueryOptions,
    country: string,
    currentYear: number
  ): {
    validBooks: GutendexBook[];
    restrictedCount: number;
    sentinelCount: number;
  } {
    const gutendexBooks = rawRows.map(mapDatabaseBookToGutendexBook);
    const filteredResults = options.includeRestrictedMetadata
      ? gutendexBooks
      : gutendexBooks.filter((b) => {
          const evalResult = isBookPublicDomainInJurisdiction(b, country, currentYear);
          return evalResult.isAllowed;
        });

    const restrictedCount = gutendexBooks.length - filteredResults.length;

    const mimeTypes = options.mimeType
      ? options.mimeType.split(',').map((m) => m.trim()).filter(Boolean)
      : [];
    const mimeFilteredResults = mimeTypes.length > 0
      ? filteredResults.filter((b) =>
          mimeTypes.some((fmt) => {
            const baseMime = fmt.split(';')[0].trim();
            return Object.keys(b.formats || {}).some(
              (key) => key === fmt || key.startsWith(baseMime)
            );
          })
        )
      : filteredResults;

    const finalResults = options.hasQuotes
      ? mimeFilteredResults.filter((b) => Array.isArray(b.quotes) && b.quotes.length > 0)
      : mimeFilteredResults;

    const sentinelCount = mimeFilteredResults.length - finalResults.length;

    return {
      validBooks: finalResults,
      restrictedCount,
      sentinelCount,
    };
  }

  /**
   * Constructs the base Supabase query with all filters and ordering applied (without range).
   */
  private buildSearchQuery(
    supabase: SupabaseClient<Database>,
    options: CatalogQueryOptions,
    jurisdictionRule: string,
    currentYear: number
  ) {
    const selectedColumns = options.hasQuotes
      ? CATALOG_WITH_QUOTES_COLUMNS
      : CATALOG_METADATA_COLUMNS;
    let query = supabase.from('books').select(selectedColumns as string, { count: 'estimated' });

    // Enforce zero-copyright
    query = query.eq('copyright', false);

    // IDs filter (comma-delimited)
    if (options.ids) {
      const idList = options.ids
        .split(',')
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id));
      if (idList.length > 0) {
        query = query.in('id', idList);
      }
    }

    // Full-text search and topic filtering on GIN search_vector (title + subjects)
    const cleanSearch = options.search && options.search.trim().length >= 2 ? options.search.trim() : null;
    const cleanTopic = options.topic && options.topic.trim().length > 0 ? options.topic.trim() : null;
    const topicList = cleanTopic ? cleanTopic.split(',').map((t) => t.trim()).filter(Boolean) : [];
    const searchVectorQuery = [cleanSearch, topicList.join(' or ')].filter(Boolean).join(' ');

    if (searchVectorQuery) {
      query = query.textSearch('search_vector', searchVectorQuery, {
        type: !cleanSearch && topicList.length === 1 ? 'plain' : 'websearch',
        config: 'english',
      });
    }

    // Languages filter (array overlap)
    if (options.languages && options.languages.length > 0) {
      query = query.overlaps('languages', options.languages);
    }

    // Quote-enriched volumes filter (uses partial index idx_books_with_quotes_popular)
    if (options.hasQuotes) {
      query = query.neq('quotes', '[]');
    }

    // Author era bounds
    if (options.authorYearStart !== undefined) {
      query = query.gte('max_author_death_year', options.authorYearStart);
    }
    if (options.authorYearEnd !== undefined) {
      query = query.lte('min_author_birth_year', options.authorYearEnd);
    }

    // Jurisdictional copyright filtering at query level (indexed B-Tree bounds)
    if (!options.includeRestrictedMetadata && jurisdictionRule !== 'US_PUBLIC_DOMAIN') {
      let termYears = 70;
      if (jurisdictionRule === 'LIFE_100') {
        termYears = 100;
      } else if (jurisdictionRule === 'LIFE_80') {
        termYears = 80;
      }
      const cutoffYear = currentYear - termYears - 1;
      query = query.lte('max_author_death_year', cutoffYear);
    }

    // Sorting
    if (options.sort === 'descending') {
      query = query.order('id', { ascending: false });
    } else if (options.sort === 'ascending') {
      query = query.order('id', { ascending: true });
    } else {
      // Default / 'popular' (aligned 1:1 with single-column idx_books_download_count)
      query = query.order('download_count', { ascending: false });
    }

    return query;
  }

  /**
   * Fetches quote-enriched books (`WHERE quotes <> '[]'::jsonb`) bounded by the top popular
   * and recent candidate IDs (Primary Key scan), slicing each volume to 2 spreads to optimize
   * Vercel Edge caching and browser localStorage quota capacity.
   */
  public async fetchQuoteEnrichedPool(
    options: CatalogQueryOptions,
    jurisdictionRule: JurisdictionRule
  ): Promise<CatalogQueryResult> {
    const startTime = Date.now();
    const limit = Math.max(
      1,
      Math.min(DEFAULT_QUOTE_POOL_LIMIT, options.limit || DEFAULT_QUOTE_POOL_LIMIT)
    );
    const quoteCacheKey = JSON.stringify({
      mode: 'quotes',
      country: options.country,
      jurisdictionRule,
      limit,
      quoteWindow: Math.floor(startTime / QUOTE_POOL_CACHE_TTL_MS),
    });
    const cachedQuotePool = this.getCachedCatalogResult(quoteCacheKey, startTime);
    if (cachedQuotePool) {
      return cachedQuotePool;
    }

    const supabase = this.getSupabase();

    try {
      const candidateIdSet = new Set<number>([
        ...FEATURED_HERO_BOOKS.map((b) => b.id),
        ...LITERARY_QUOTES.map((q) => q.bookId),
      ]);
      const idScanSpecs = [
        { col: 'download_count', scanLimit: 500 },
        { col: 'id', scanLimit: 64 },
      ] as const;

      const scanResults = await Promise.all(
        idScanSpecs.map(async (spec) => {
          const idSelect = supabase.from('books').select('id');
          if (idSelect && typeof idSelect.order === 'function') {
            const ordered = idSelect.order(spec.col, { ascending: false });
            if (ordered && typeof ordered.limit === 'function') {
              return ordered.limit(spec.scanLimit);
            }
          }
          return { data: null };
        })
      );

      for (const res of scanResults) {
        if (Array.isArray(res?.data)) {
          for (const row of res.data) {
            if (row && typeof row.id === 'number') {
              candidateIdSet.add(row.id);
            }
          }
        }
      }

      const selectedCandidateIds = selectRotatingQuotePoolCandidateIds(
        Array.from(candidateIdSet),
        limit
      );

      const baseSelect = supabase
        .from('books')
        .select(QUOTE_POOL_COLUMNS);
      const scopedSelect =
        baseSelect && typeof baseSelect.in === 'function'
          ? baseSelect.in('id', selectedCandidateIds)
          : baseSelect;

      const { data, error } = await scopedSelect
        .neq('quotes', '[]')
        .order('download_count', { ascending: false })
        .limit(limit);

      if (error || !Array.isArray(data)) {
        throw new CatalogProviderError(
          `Supabase Quote Pool query error: ${error?.message || 'Empty or invalid response'}`,
          500,
          'supabase'
        );
      }

      this.lastHealthCheckTime = Date.now();
      this.lastHealthCheckResult = true;

      const books: GutendexBook[] = [];
      for (const row of data) {
        if (!row || typeof row.id !== 'number' || typeof row.title !== 'string') continue;
        const rowWithQuotes = row as { quotes?: unknown; quote0?: unknown; quote1?: unknown };
        const rawQuotes = Array.isArray(rowWithQuotes.quotes)
          ? rowWithQuotes.quotes
          : [rowWithQuotes.quote0, rowWithQuotes.quote1].filter(Boolean);
        const validPassages = filterValidBookPassages(rawQuotes);
        if (validPassages.length === 0) continue;

        books.push({
          id: row.id,
          title: row.title,
          authors: Array.isArray(row.authors)
            ? (row.authors as unknown as GutendexBook['authors'])
            : [],
          translators: Array.isArray(row.translators)
            ? (row.translators as unknown as GutendexBook['translators'])
            : [],
          subjects: Array.isArray(row.subjects) ? row.subjects : [],
          bookshelves: Array.isArray((row as { bookshelves?: string[] }).bookshelves)
            ? ((row as { bookshelves: string[] }).bookshelves)
            : [],
          languages: Array.isArray(row.languages) ? row.languages : ['en'],
          copyright: typeof row.copyright === 'boolean' ? row.copyright : false,
          media_type: 'Text',
          formats: {},
          download_count: typeof row.download_count === 'number' ? row.download_count : 0,
          quotes: validPassages.slice(0, 2),
        });
      }

      const sortedBooks = sortQuoteEnrichedBooksDeterministically(books);

      const result: CatalogQueryResult = {
        count: sortedBooks.length,
        next: null,
        previous: null,
        results: sortedBooks,
        source: 'supabase',
        latencyMs: Date.now() - startTime,
        clientCountry: options.country,
        jurisdictionRule,
      };
      this.setCachedCatalogResult(quoteCacheKey, result, Date.now());
      return result;
    } catch (err: unknown) {
      if (err instanceof CatalogProviderError) throw err;
      throw new CatalogProviderError(
        `Supabase Quote Pool error: ${err instanceof Error ? err.message : String(err)}`,
        500,
        'supabase'
      );
    }
  }

  public async searchBooks(options: CatalogQueryOptions): Promise<CatalogQueryResult> {
    const startTime = Date.now();
    const country = options.country;
    const jurisdictionRule = getJurisdictionRule(country);
    const currentYear = new Date().getFullYear();

    if (options.pool === 'quotes') {
      return this.fetchQuoteEnrichedPool(options, jurisdictionRule);
    }

    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 32));
    const from = (page - 1) * limit;

    if (from >= MAX_CATALOG_OFFSET) {
      return {
        count: 0,
        next: null,
        previous: page > 1 ? `/api/books?page=${page - 1}` : null,
        results: [],
        source: 'supabase',
        latencyMs: Date.now() - startTime,
        clientCountry: country,
        jurisdictionRule,
        totalFiltered: 0,
      };
    }

    const searchCacheKey = JSON.stringify({
      mode: 'search',
      search: options.search || '',
      topic: options.topic || '',
      languages: Array.isArray(options.languages) ? [...options.languages].sort().join(',') : '',
      sort: options.sort || 'popular',
      page,
      limit,
      mimeType: options.mimeType || '',
      authorYearStart: options.authorYearStart ?? null,
      authorYearEnd: options.authorYearEnd ?? null,
      ids: options.ids || '',
      hasQuotes: Boolean(options.hasQuotes),
      includeRestrictedMetadata: Boolean(options.includeRestrictedMetadata),
      country,
      jurisdictionRule,
      year: currentYear,
    });
    const cachedSearch = this.getCachedCatalogResult(searchCacheKey, startTime);
    if (cachedSearch) {
      return cachedSearch;
    }

    const supabase = this.getSupabase();

    try {
      const executeInitialProbe = async () => {
        const res = await this.buildSearchQuery(supabase, options, jurisdictionRule, currentYear)
          .range(from, from + limit);
        if (res.error) {
          throw new CatalogProviderError(
            `Supabase Catalog query error: ${res.error.message}`,
            500,
            'supabase'
          );
        }
        return res;
      };

      let initialProbe;
      try {
        initialProbe = await executeInitialProbe();
      } catch {
        // Single fast transient retry for cold serverless connection hiccups
        initialProbe = await executeInitialProbe();
      }

      const { data, count } = initialProbe;

      this.lastHealthCheckTime = Date.now();
      this.lastHealthCheckResult = true;

      const rawRows: DatabaseBook[] = (data || []) as unknown as DatabaseBook[];
      const initialBatch = this.filterBatch(rawRows, options, country, currentYear);
      const finalResults = [...initialBatch.validBooks];
      let totalFiltered = initialBatch.restrictedCount;
      let totalSentinelFiltered = initialBatch.sentinelCount;

      let sqlExhausted = rawRows.length < limit + 1;
      const targetValidCount = limit + 1;

      // Exact limit + 1 probing & bounded backfill: whenever runtime jurisdictional or format filtering
      // withholds rows and SQL has not reached EOF, top up toward limit + 1 compliant items so pagination
      // links accurately reflect real available items beyond inaccurate estimated row counts.
      if (
        finalResults.length < targetValidCount &&
        !sqlExhausted &&
        !options.includeRestrictedMetadata
      ) {
        let nextOffset = from + rawRows.length;
        let iterations = 0;
        const MAX_BACKFILL_ITERATIONS = 5;

        while (finalResults.length < targetValidCount && iterations < MAX_BACKFILL_ITERATIONS) {
          iterations++;
          const deficit = targetValidCount - finalResults.length;
          const fetchBatch = Math.max(deficit * 2, 32);
          const backfillQuery = this.buildSearchQuery(
            supabase,
            options,
            jurisdictionRule,
            currentYear
          ).range(nextOffset, nextOffset + fetchBatch - 1);

          const { data: backfillData, error: backfillError } = await backfillQuery;
          if (backfillError) {
            break;
          }
          if (!backfillData || backfillData.length === 0) {
            sqlExhausted = true;
            break;
          }

          const rawBackfill = backfillData as unknown as DatabaseBook[];
          const backfillBatch = this.filterBatch(rawBackfill, options, country, currentYear);
          totalFiltered += backfillBatch.restrictedCount;
          totalSentinelFiltered += backfillBatch.sentinelCount;

          for (const book of backfillBatch.validBooks) {
            if (finalResults.length < targetValidCount) {
              finalResults.push(book);
            } else {
              break;
            }
          }

          nextOffset += rawBackfill.length;
          if (rawBackfill.length < fetchBatch) {
            sqlExhausted = true;
            break;
          }
        }
      }

      const pageResults = finalResults.slice(0, limit);
      const hasNext =
        finalResults.length > limit || (!sqlExhausted && pageResults.length === limit);

      const estimatedAdjusted =
        count !== null && count !== undefined
          ? Math.max(0, count - totalFiltered - totalSentinelFiltered)
          : 0;

      const totalCount =
        pageResults.length === 0 && sqlExhausted
          ? from === 0
            ? 0
            : Math.min(from, estimatedAdjusted)
          : sqlExhausted
            ? from + pageResults.length
            : count !== null && count !== undefined
              ? Math.max(from + pageResults.length, estimatedAdjusted)
              : from + pageResults.length;
      const latencyMs = Date.now() - startTime;

      // Next / previous pagination links
      const hasPrev = page > 1;

      const nextUrl = hasNext ? `/api/books?page=${page + 1}` : null;
      const prevUrl = hasPrev ? `/api/books?page=${page - 1}` : null;

      const result: CatalogQueryResult = {
        count: totalCount,
        next: nextUrl,
        previous: prevUrl,
        results: pageResults,
        source: 'supabase',
        latencyMs,
        clientCountry: country,
        jurisdictionRule,
        totalFiltered,
      };
      this.setCachedCatalogResult(searchCacheKey, result, Date.now());
      return result;
    } catch (err: unknown) {
      if (err instanceof CatalogProviderError) {
        throw err;
      }
      throw new CatalogProviderError(
        `Supabase Catalog unexpected failure: ${err instanceof Error ? err.message : String(err)}`,
        500,
        'supabase'
      );
    }
  }

  /**
   * Retrieves verified multi-language translations and editions for a specific volume ID.
   * Performs an indexed relational join via public.book_translations using IN subquery defense,
   * strictly enforcing public domain copyright and regional jurisdiction rules.
   */
  public async getBookTranslations(
    bookId: number,
    country: string = 'US'
  ): Promise<RelationalTranslationOption[]> {
    if (!bookId || bookId <= 0) return [];

    try {
      const supabase = this.getSupabase();

      // 1. Fetch work_id(s) for the target book
      const { data: workMappings, error: workErr } = await supabase
        .from('book_translations')
        .select('work_id')
        .eq('book_id', bookId);

      if (workErr || !workMappings || workMappings.length === 0) {
        return [];
      }

      const workIds = (workMappings as { work_id: string }[]).map((w) => w.work_id);

      // 2. Fetch all edition book_ids in the same work(s) (Defense 1: IN subquery defense)
      const { data: clusterEditions, error: clusterErr } = await supabase
        .from('book_translations')
        .select('book_id, language, is_original')
        .in('work_id', workIds);

      if (clusterErr || !clusterEditions || clusterEditions.length === 0) {
        return [];
      }

      const editions = clusterEditions as { book_id: number; language: string; is_original: boolean }[];
      const editionBookIds = editions.map((e) => e.book_id);

      // 3. Fetch title, download_count, copyright, and creator lifespans for discovered books
      const { data: books, error: booksErr } = await supabase
        .from('books')
        .select('id, title, download_count, copyright, authors, translators')
        .in('id', editionBookIds);

      if (booksErr || !books) {
        return [];
      }

      const typedBooks = books as {
        id: number;
        title: string;
        download_count: number;
        copyright?: boolean | null;
        authors?: DatabaseBook['authors'] | null;
        translators?: DatabaseBook['translators'] | null;
      }[];

      // Filter out any edition that is under copyright or restricted in the caller's jurisdiction
      const allowedBooks = typedBooks.filter((b) => {
        if (b.copyright === true) return false;
        const evaluation = isBookPublicDomainInJurisdiction(
          {
            id: b.id,
            title: b.title,
            authors: Array.isArray(b.authors) ? (b.authors as unknown as Author[]) : [],
            translators: Array.isArray(b.translators) ? (b.translators as unknown as Author[]) : [],
            copyright: b.copyright ?? false,
          },
          country
        );
        return evaluation.isAllowed;
      });

      const booksMap = new Map(allowedBooks.map((b) => [b.id, b]));

      const results: RelationalTranslationOption[] = [];
      for (const ed of editions) {
        const book = booksMap.get(ed.book_id);
        if (book) {
          results.push({
            bookId: ed.book_id,
            title: book.title,
            languageCode: ed.language,
            isOriginal: Boolean(ed.is_original),
            isCurrent: ed.book_id === bookId,
          });
        }
      }

      // Sort: Current book first, then original edition, then by download_count
      return results.sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
        if (a.isOriginal !== b.isOriginal) return a.isOriginal ? -1 : 1;
        const countA = booksMap.get(a.bookId)?.download_count ?? 0;
        const countB = booksMap.get(b.bookId)?.download_count ?? 0;
        return countB - countA;
      });
    } catch {
      return [];
    }
  }
}

export interface RelationalTranslationOption {
  bookId: number;
  title: string;
  languageCode: string;
  isOriginal: boolean;
  isCurrent: boolean;
}

export const supabaseCatalogProvider = new SupabaseCatalogProvider();

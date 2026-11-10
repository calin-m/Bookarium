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
 * Columns explicitly selected for catalog search to prevent transferring large unabridged text.
 */
export const CATALOG_METADATA_COLUMNS =
  'id, title, authors, translators, subjects, bookshelves, languages, copyright, media_type, formats, download_count, quotes, max_author_death_year, min_author_birth_year, created_at, updated_at' as const;

const FEATURED_HERO_ORDER_MAP = new Map<number, number>(
  FEATURED_HERO_BOOKS.map((b, idx) => [b.id, idx])
);

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
  private lastHealthCheckTime = 0;
  private lastHealthCheckResult = false;
  public static readonly HEALTH_CACHE_TTL_MS = 60 * 1000; // 60 seconds

  constructor(client?: SupabaseClient<Database>) {
    this.client = client || null;
  }

  public resetHealthCache(): void {
    this.lastHealthCheckTime = 0;
    this.lastHealthCheckResult = false;
  }

  private getSupabase(): SupabaseClient<Database> {
    if (!this.client) {
      this.client = createClient();
    }
    return this.client;
  }

  /**
   * Health check verifying Supabase connectivity and presence of catalog records.
   * Returns false if unconfigured, unreachable, or table is empty (triggering Gutendex fallback).
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
    let query = supabase.from('books').select(CATALOG_METADATA_COLUMNS, { count: 'estimated' });

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
    const supabase = this.getSupabase();
    const limit = Math.max(1, Math.min(600, options.limit || 600));

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

      const baseSelect = supabase
        .from('books')
        .select(
          'id, title, authors, translators, subjects, bookshelves, languages, copyright, download_count, quotes'
        );
      const scopedSelect =
        baseSelect && typeof baseSelect.in === 'function'
          ? baseSelect.in('id', Array.from(candidateIdSet))
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

      const books: GutendexBook[] = [];
      for (const row of data) {
        if (!row || typeof row.id !== 'number' || typeof row.title !== 'string') continue;
        const validPassages = filterValidBookPassages(row.quotes);
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

      return {
        count: sortedBooks.length,
        next: null,
        previous: null,
        results: sortedBooks,
        source: 'supabase',
        latencyMs: Date.now() - startTime,
        clientCountry: options.country,
        jurisdictionRule,
      };
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
    const supabase = this.getSupabase();
    const country = options.country;
    const jurisdictionRule = getJurisdictionRule(country);
    const currentYear = new Date().getFullYear();

    if (options.pool === 'quotes') {
      return this.fetchQuoteEnrichedPool(options, jurisdictionRule);
    }

    try {
      const baseQuery = this.buildSearchQuery(supabase, options, jurisdictionRule, currentYear);

      // Pagination
      const page = Math.max(1, options.page || 1);
      const limit = Math.max(1, Math.min(100, options.limit || 32));
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const query = baseQuery.range(from, to);

      const { data, count, error } = await query;

      if (error) {
        throw new CatalogProviderError(
          `Supabase Catalog query error: ${error.message}`,
          500,
          'supabase'
        );
      }

      const rawRows: DatabaseBook[] = (data || []) as DatabaseBook[];
      const initialBatch = this.filterBatch(rawRows, options, country, currentYear);
      const finalResults = [...initialBatch.validBooks];
      let totalFiltered = initialBatch.restrictedCount;
      let totalSentinelFiltered = initialBatch.sentinelCount;

      // Resilient dynamic backfill: if runtime jurisdictional or format filtering withheld
      // rows and we haven't reached the end of the table, top up until finalResults.length === limit.
      if (
        finalResults.length < limit &&
        rawRows.length === limit &&
        !options.includeRestrictedMetadata
      ) {
        let nextOffset = to + 1;
        let iterations = 0;
        const MAX_BACKFILL_ITERATIONS = 2;

        while (finalResults.length < limit && iterations < MAX_BACKFILL_ITERATIONS) {
          iterations++;
          const deficit = limit - finalResults.length;
          const fetchBatch = Math.max(deficit * 2, 8);
          const backfillQuery = this.buildSearchQuery(
            supabase,
            options,
            jurisdictionRule,
            currentYear
          ).range(nextOffset, nextOffset + fetchBatch - 1);

          const { data: backfillData, error: backfillError } = await backfillQuery;
          if (backfillError || !backfillData || backfillData.length === 0) {
            break;
          }

          const rawBackfill = backfillData as DatabaseBook[];
          const backfillBatch = this.filterBatch(rawBackfill, options, country, currentYear);
          totalFiltered += backfillBatch.restrictedCount;
          totalSentinelFiltered += backfillBatch.sentinelCount;

          for (const book of backfillBatch.validBooks) {
            if (finalResults.length < limit) {
              finalResults.push(book);
            } else {
              break;
            }
          }

          nextOffset += rawBackfill.length;
          if (rawBackfill.length < fetchBatch) {
            break;
          }
        }
      }

      const totalCount =
        count !== null && count !== undefined
          ? Math.max(0, count - totalFiltered - totalSentinelFiltered)
          : finalResults.length;
      const latencyMs = Date.now() - startTime;

      // Next / previous pagination links
      const hasNext = from + limit < (count ?? 0);
      const hasPrev = page > 1;

      const nextUrl = hasNext ? `/api/books?page=${page + 1}` : null;
      const prevUrl = hasPrev ? `/api/books?page=${page - 1}` : null;

      return {
        count: totalCount,
        next: nextUrl,
        previous: prevUrl,
        results: finalResults,
        source: 'supabase',
        latencyMs,
        clientCountry: country,
        jurisdictionRule,
        totalFiltered,
      };
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

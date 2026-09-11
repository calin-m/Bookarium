import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ICatalogProvider,
  CatalogQueryOptions,
  CatalogQueryResult,
} from '@/types/catalog.types';
import { CatalogProviderError } from '@/types/catalog.types';
import type { GutendexBook, Author } from '@/types/book.types';
import type { Database, DatabaseBook } from '@/types/database.types';
import { createClient } from '@/lib/supabase/client';
import {
  isBookPublicDomainInJurisdiction,
  getJurisdictionRule,
} from '@/lib/copyright-engine';

/**
 * Checks if Supabase credentials are genuinely configured (non-empty, non-placeholder).
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  const cleanUrl = url.trim();
  if (!cleanUrl || cleanUrl.includes('placeholder.supabase.co')) return false;
  if (!key || key.includes('placeholder-anon-key')) return false;
  return true;
}

/**
 * Maps a database row from `public.books` to standard GutendexBook format.
 */
export function mapDatabaseBookToGutendexBook(row: DatabaseBook): GutendexBook {
  return {
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
}

/**
 * Supabase PostgreSQL Catalog Provider
 * Queries local/self-hosted PostgreSQL catalog with GIN indexed full-text search,
 * indexed language/subject matching, pre-computed lifespan filtering, and Berne Convention verification.
 */
export class SupabaseCatalogProvider implements ICatalogProvider {
  public readonly name = 'supabase' as const;
  private client: SupabaseClient<Database> | null;

  constructor(client?: SupabaseClient<Database>) {
    this.client = client || null;
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
   */
  public async isHealthy(): Promise<boolean> {
    if (!isSupabaseConfigured() && !this.client) {
      return false;
    }

    try {
      const supabase = this.getSupabase();
      const { count, error } = await supabase
        .from('books')
        .select('id', { count: 'exact', head: true });

      if (error || count === null || count === undefined || count === 0) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  public async searchBooks(options: CatalogQueryOptions): Promise<CatalogQueryResult> {
    const startTime = Date.now();
    const supabase = this.getSupabase();
    const country = options.country;
    const jurisdictionRule = getJurisdictionRule(country);
    const currentYear = new Date().getFullYear();

    try {
      let query = supabase.from('books').select('*', { count: 'exact' });

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

      // Full-text search on GIN search_vector (title + authors + subjects)
      if (options.search && options.search.trim().length >= 2) {
        const cleanSearch = options.search.trim();
        query = query.textSearch('search_vector', cleanSearch, {
          type: 'websearch',
          config: 'english',
        });
      }

      // Topic filter (contained in subjects or bookshelves)
      if (options.topic && options.topic.trim().length > 0) {
        const topic = options.topic.trim();
        query = query.or(`subjects.cs.{"${topic}"},bookshelves.cs.{"${topic}"}`);
      }

      // Languages filter (array overlap)
      if (options.languages && options.languages.length > 0) {
        query = query.overlaps('languages', options.languages);
      }

      // Author era bounds
      if (options.authorYearStart !== undefined) {
        query = query.gte('max_author_death_year', options.authorYearStart);
      }
      if (options.authorYearEnd !== undefined) {
        query = query.lte('min_author_birth_year', options.authorYearEnd);
      }

      // Jurisdictional copyright filtering at query level (sub-50ms index query)
      if (jurisdictionRule !== 'US_PUBLIC_DOMAIN') {
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
        // Default / 'popular'
        query = query.order('download_count', { ascending: false });
      }

      // Pagination
      const page = Math.max(1, options.page || 1);
      const limit = Math.max(1, Math.min(100, options.limit || 32));
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) {
        throw new CatalogProviderError(
          `Supabase Catalog query error: ${error.message}`,
          500,
          'supabase'
        );
      }

      const rawRows: DatabaseBook[] = (data || []) as DatabaseBook[];
      const gutendexBooks = rawRows.map(mapDatabaseBookToGutendexBook);

      // Runtime jurisdictional verification pass (guarantees translator & joint author compliance)
      const filteredResults = gutendexBooks.filter((b) => {
        const evalResult = isBookPublicDomainInJurisdiction(b, country, currentYear);
        return evalResult.isAllowed;
      });

      // Filter by mimeType if specified
      const finalResults = options.mimeType
        ? filteredResults.filter((b) => Boolean(b.formats && b.formats[options.mimeType!]))
        : filteredResults;

      const totalFiltered = gutendexBooks.length - filteredResults.length;
      const totalCount =
        count !== null && count !== undefined
          ? Math.max(0, count - totalFiltered)
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
}

export const supabaseCatalogProvider = new SupabaseCatalogProvider();

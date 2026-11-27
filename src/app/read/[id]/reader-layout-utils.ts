/**
 * @module src/app/read/[id]/reader-layout-utils
 * @scope Server-side Reader volume metadata resolver with 24h cross-isolate Next.js Data Cache (`createOptionalDataCache`), `quote0` excerpt projection, cached R2 cover `HEAD` verification (`checkBookCoverAvailable`), bounded negative-lookup LRU (`confirmedNotFoundIds`), and structured SEO schema builder for `/read/[id]`.
 * @invariant Anchor `serverMetadataCache` and `confirmedNotFoundIds` on `globalThis` capped at `MAX_SERVER_METADATA_CACHE_ENTRIES` FIFO-LRU entries, back cold Supabase and R2 `HEAD` lookups cleanly via 24h `unstable_cache` without caching transient errors, only mark IDs confirmed missing when Supabase is configured and responded cleanly (`!supabaseUnavailable`), and preserve curated fallback lifespans before emitting `noindex` or metadata.
 * @rationale Cross-isolate Data Caching prevents Supabase egress exhaustion during bot crawls, `HEAD` verification stops `Book.image` from emitting `404` cover URLs, and distinguishing upstream outages from confirmed missing IDs protects search rankings.
 * @adr ADR-016, ADR-036, ADR-070, ADR-086, ADR-087
 */

import { cache } from 'react';
import type { BookPassage, CatalogBook } from '@/types/book.types';
import { SITE_CONFIG } from '@/config/site-config';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';
import {
  isSupabaseConfigured,
  mapDatabaseBookToCatalogBook,
  CATALOG_METADATA_COLUMNS,
} from '@/lib/catalog/supabase-provider';
import { createClient } from '@/lib/supabase/client';
import {
  featuredHeroToCatalogBook,
  isPlaceholderAuthor,
  resolveBookOpeningSnippet,
  truncateTextAtWordBoundary,
  type ResolvedBookIdentity,
} from '@/lib/book-metadata';
import { resolveBookTags } from '@/lib/book-tags';
import { buildR2BookFormats, formatAuthorName } from '@/lib/utils';
import { isBookPublicDomainInJurisdiction } from '@/lib/copyright-engine';
import { headR2CoverExists, isR2Configured } from '@/lib/r2-client';
import { createOptionalDataCache } from '@/lib/server-data-cache';
import { isClientSideNavigation } from '@/lib/server-rsc-nav';
import type { DatabaseBook } from '@/types/database.types';

export { isClientSideNavigation };

export const MAX_SERVER_METADATA_CACHE_ENTRIES = 500;
export const MAX_SERP_DESCRIPTION_LENGTH = 158;
const SERVER_READER_SELECT_COLUMNS = `${CATALOG_METADATA_COLUMNS}, quote0:quotes->0`;

const globalForReaderMetadata = globalThis as typeof globalThis & {
  __bookariumServerMetadataCache?: Map<number, CatalogBook>;
  __bookariumConfirmedNotFoundIds?: Set<number>;
};

export const serverMetadataCache =
  globalForReaderMetadata.__bookariumServerMetadataCache ??
  (globalForReaderMetadata.__bookariumServerMetadataCache = new Map<number, CatalogBook>());

const confirmedNotFoundIds =
  globalForReaderMetadata.__bookariumConfirmedNotFoundIds ??
  (globalForReaderMetadata.__bookariumConfirmedNotFoundIds = new Set<number>());

function markConfirmedNotFound(bookId: number): void {
  if (confirmedNotFoundIds.has(bookId)) {
    confirmedNotFoundIds.delete(bookId);
  } else if (confirmedNotFoundIds.size >= MAX_SERVER_METADATA_CACHE_ENTRIES) {
    const oldestKey = confirmedNotFoundIds.keys().next().value;
    if (typeof oldestKey === 'number') {
      confirmedNotFoundIds.delete(oldestKey);
    }
  }
  confirmedNotFoundIds.add(bookId);
}

export function isConfirmedMissingBook(bookId: number): boolean {
  return confirmedNotFoundIds.has(bookId);
}

export function clearConfirmedNotFoundCache(): void {
  confirmedNotFoundIds.clear();
}

export function setServerMetadataCache(bookId: number, book: CatalogBook): void {
  confirmedNotFoundIds.delete(bookId);
  if (serverMetadataCache.has(bookId)) {
    serverMetadataCache.delete(bookId);
  } else if (serverMetadataCache.size >= MAX_SERVER_METADATA_CACHE_ENTRIES) {
    const oldestKey = serverMetadataCache.keys().next().value;
    if (typeof oldestKey === 'number') {
      serverMetadataCache.delete(oldestKey);
    }
  }
  serverMetadataCache.set(bookId, book);
}

export function clearServerMetadataCache(): void {
  serverMetadataCache.clear();
  confirmedNotFoundIds.clear();
}

async function querySupabaseBookMetadataRaw(bookId: number): Promise<CatalogBook | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('books')
    .select(SERVER_READER_SELECT_COLUMNS)
    .eq('id', bookId)
    .abortSignal(AbortSignal.timeout(2500))
    .maybeSingle();

  if (error) {
    throw new Error(error.message || 'Supabase reader metadata query failed.');
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as DatabaseBook & { quote0?: BookPassage | null };
  const mapped = mapDatabaseBookToCatalogBook(row);
  if (row.quote0 && typeof row.quote0 === 'object') {
    mapped.quotes = [row.quote0];
  }
  return mapped;
}

const fetchCachedSupabaseBookMetadata = createOptionalDataCache(
  querySupabaseBookMetadataRaw,
  ['bookarium-reader-book-v1'],
  { revalidate: 86400, tags: ['books-metadata', 'catalog'] }
);

export const fetchBookData = cache(async (bookId: number): Promise<CatalogBook | null> => {
  if (!bookId || isNaN(bookId)) return null;

  // Tier 1: In-memory LRU server cache
  const cached = serverMetadataCache.get(bookId);
  if (cached) {
    serverMetadataCache.delete(bookId);
    serverMetadataCache.set(bookId, cached);
    return cached;
  }

  let supabaseUnavailable = false;

  // Tier 2: Cross-isolate 24h Data Cache -> Supabase PostgreSQL catalog
  if (isSupabaseConfigured()) {
    try {
      const book = await fetchCachedSupabaseBookMetadata(bookId);
      if (book) {
        setServerMetadataCache(bookId, book);
        return book;
      }
    } catch {
      supabaseUnavailable = true;
    }
  }

  const featured = FEATURED_HERO_BOOKS.find((b) => b.id === bookId);

  // Tier 3: Bundled curated classics fallback (zero external HTTP requests)
  if (featured) {
    const fallbackBook = featuredHeroToCatalogBook(featured, {
      formats: buildR2BookFormats(featured.id),
    });
    if (featured.translators) {
      fallbackBook.translators = [...featured.translators];
    }
    setServerMetadataCache(bookId, fallbackBook);
    return fallbackBook;
  }

  if (isSupabaseConfigured() && !supabaseUnavailable) {
    markConfirmedNotFound(bookId);
  }
  return null;
});

async function queryR2CoverExistsRaw(bookId: number): Promise<boolean> {
  const status = await headR2CoverExists(bookId);
  if (status === 'ok') return true;
  if (status === 'not_found' || status === 'unconfigured') return false;
  throw new Error(`R2 cover HEAD status unavailable: ${status}`);
}

const fetchCachedR2CoverExists = createOptionalDataCache(
  queryR2CoverExistsRaw,
  ['bookarium-r2-cover-exists-v1'],
  { revalidate: 86400, tags: ['covers'] }
);

/**
 * Checks with 24h Data Caching whether a book has a live JPEG cover stored in R2
 * so `Book.image` never emits broken `404` schema image URLs to search engines.
 */
export const checkBookCoverAvailable = cache(async (bookId: number): Promise<boolean> => {
  if (!Number.isInteger(bookId) || bookId <= 0 || !isR2Configured()) {
    return false;
  }
  try {
    return await fetchCachedR2CoverExists(bookId);
  } catch {
    return false;
  }
});

export interface ReaderSeoPerson {
  name: string;
  birthDate?: string;
  deathDate?: string;
}

export interface ReaderSeoMetadataPayload {
  authorNames: string[];
  translatorNames: string[];
  authorsMeta: ReaderSeoPerson[];
  translatorsMeta: ReaderSeoPerson[];
  genres: string[];
  keywords: string[];
  openingHook: string;
  description: string;
  ogDescription: string;
  isUsRestricted: boolean;
  gutenbergUrl: string;
  availableFormats: string[];
}

function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(trimmed);
    }
  }
  return unique;
}

function dedupeContributors(
  contributors: Array<{ name: string; birth_year?: number | null; death_year?: number | null }>
): ReaderSeoPerson[] {
  const seen = new Set<string>();
  const people: ReaderSeoPerson[] = [];
  for (const entry of contributors) {
    const formatted = formatAuthorName(entry.name).trim();
    if (!formatted || isPlaceholderAuthor(formatted)) continue;
    const key = formatted.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    people.push({
      name: formatted,
      ...(typeof entry.birth_year === 'number' ? { birthDate: String(entry.birth_year) } : {}),
      ...(typeof entry.death_year === 'number' ? { deathDate: String(entry.death_year) } : {}),
    });
  }
  return people;
}

export function buildOpeningHook(openingLine?: string, maxLength = 135): string {
  if (!openingLine) return '';
  return truncateTextAtWordBoundary(openingLine, maxLength);
}

function resolveReadableLanguageLabel(languages?: string[]): string {
  const primary = languages?.[0]?.trim().toLowerCase();
  if (!primary || primary === 'en') return '';
  try {
    const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
    return displayNames.of(primary) || '';
  } catch {
    return '';
  }
}

function extractAvailableEncodingFormats(formats?: Record<string, string>): string[] {
  if (!formats) return [];
  const resolved: string[] = [];
  const keys = Object.keys(formats).filter((k) => Boolean(formats[k]));
  if (keys.some((k) => k === 'application/epub+zip')) {
    resolved.push('application/epub+zip');
  }
  if (keys.some((k) => k === 'application/x-mobipocket-ebook')) {
    resolved.push('application/x-mobipocket-ebook');
  }
  if (keys.some((k) => k.startsWith('text/html'))) {
    resolved.push('text/html');
  }
  if (keys.some((k) => k.startsWith('text/plain'))) {
    resolved.push('text/plain');
  }
  return resolved;
}

/**
 * Builds deterministic non-visual SEO metadata payloads (SERP 158-char meta description,
 * richer OG description, opening hooks, lifespan contributors, encoding formats, and genres).
 */
export function buildReaderSeoMetadataPayload(
  meta: ResolvedBookIdentity,
  bookId: number,
  formats?: Record<string, string>,
  bookData?: CatalogBook | null
): ReaderSeoMetadataPayload {
  const parsedAuthors = dedupeContributors(meta.authors || []);
  const authorsMeta =
    parsedAuthors.length > 0
      ? parsedAuthors
      : meta.displayAuthor && !isPlaceholderAuthor(meta.displayAuthor)
      ? [{ name: meta.displayAuthor }]
      : [];

  const translatorsMeta = dedupeContributors(meta.translators || []);
  const authorNames = authorsMeta.map((p) => p.name);
  const translatorNames = translatorsMeta.map((p) => p.name);

  const tagSet = resolveBookTags(meta.subjects, meta.bookshelves);
  const genres = dedupeCaseInsensitive([
    ...tagSet.allTags,
    ...tagSet.primaryDesktop,
  ]);
  const resolvedGenres = genres.length > 0 ? genres : [meta.primarySubject || 'Classic Literature'];

  const rawHook = resolveBookOpeningSnippet(bookId, bookData);
  const openingHook = buildOpeningHook(rawHook, 135);

  const snippetGenres = resolvedGenres.slice(0, 3).join(', ');
  const languageLabel = resolveReadableLanguageLabel(meta.languages);
  const languageClause = languageLabel ? ` (${languageLabel})` : '';
  const authorPhrase = authorNames.length > 0 ? ` by ${authorNames.join(', ')}` : '';
  const translatorClause =
    translatorNames.length > 0 ? ` (translated by ${translatorNames.join(', ')})` : '';
  const genreClause = snippetGenres ? ` — ${snippetGenres}` : '';

  const ogSummary = `Read ${meta.title}${authorPhrase}${translatorClause}${languageClause}${genreClause} unabridged and 100% legal in the public domain`;
  const ogDescription = openingHook
    ? `${openingHook} — ${ogSummary} on ${SITE_CONFIG.NAME}.`
    : `${ogSummary}. In-browser focus reader with synchronized voice narration and dynamic translations on ${SITE_CONFIG.NAME}.`;

  const serpCoreSuffix = `Read ${meta.title}${authorPhrase}${languageClause} free online & plain text (${snippetGenres}).`;
  let description = serpCoreSuffix;
  if (openingHook) {
    const ctaTail = ` — Read ${meta.title}${authorPhrase} free on ${SITE_CONFIG.NAME}.`;
    const remainingHookBudget = MAX_SERP_DESCRIPTION_LENGTH - ctaTail.length - 2;
    if (remainingHookBudget >= 42) {
      const compactHook = buildOpeningHook(rawHook, remainingHookBudget);
      description = `"${compactHook}"${ctaTail}`;
    } else {
      description = truncateTextAtWordBoundary(
        `${serpCoreSuffix} 100% public domain on ${SITE_CONFIG.NAME}.`,
        MAX_SERP_DESCRIPTION_LENGTH
      );
    }
  } else {
    const withTranslator = translatorClause
      ? `Read ${meta.title}${authorPhrase}${translatorClause}${languageClause} free online (${snippetGenres}). Public domain on ${SITE_CONFIG.NAME}.`
      : `${serpCoreSuffix} 100% legal public domain on ${SITE_CONFIG.NAME}.`;
    description = truncateTextAtWordBoundary(withTranslator, MAX_SERP_DESCRIPTION_LENGTH);
  }

  const isUsRestricted = bookData
    ? !isBookPublicDomainInJurisdiction(bookData, 'US').isAllowed
    : false;

  const keywords = dedupeCaseInsensitive([
    meta.title,
    ...authorNames,
    ...translatorNames,
    ...resolvedGenres,
    ...(meta.languages || []),
    'Public Domain Books',
    'Project Gutenberg',
  ]);

  return {
    authorNames,
    translatorNames,
    authorsMeta,
    translatorsMeta,
    genres: resolvedGenres,
    keywords,
    openingHook,
    description,
    ogDescription,
    isUsRestricted,
    gutenbergUrl: SITE_CONFIG.GUTENBERG_EBOOK(bookId),
    availableFormats: extractAvailableEncodingFormats(formats),
  };
}

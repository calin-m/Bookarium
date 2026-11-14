import { cache } from 'react';
import type { GutendexBook } from '@/types/book.types';
import { SITE_CONFIG } from '@/config/site-config';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';
import {
  isSupabaseConfigured,
  mapDatabaseBookToGutendexBook,
  CATALOG_METADATA_COLUMNS,
} from '@/lib/catalog/supabase-provider';
import { createClient } from '@/lib/supabase/client';
import {
  featuredHeroToGutendexBook,
  isPlaceholderAuthor,
  type ResolvedBookIdentity,
} from '@/lib/book-metadata';
import { resolveBookTags } from '@/lib/book-tags';
import { formatAuthorName } from '@/lib/utils';
import { isClientSideNavigation } from '@/lib/server-rsc-nav';
import type { DatabaseBook } from '@/types/database.types';

export { isClientSideNavigation };

export const MAX_SERVER_METADATA_CACHE_ENTRIES = 500;
export const serverMetadataCache = new Map<number, GutendexBook>();
const confirmedNotFoundIds = new Set<number>();

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

export function setServerMetadataCache(bookId: number, book: GutendexBook): void {
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

export const fetchBookData = cache(async (bookId: number): Promise<GutendexBook | null> => {
  if (!bookId || isNaN(bookId)) return null;

  // Tier 1: In-memory LRU server cache
  const cached = serverMetadataCache.get(bookId);
  if (cached) {
    serverMetadataCache.delete(bookId);
    serverMetadataCache.set(bookId, cached);
    return cached;
  }

  let supabaseUnavailable = false;

  // Tier 2: Dedicated Supabase PostgreSQL catalog (sub-15ms)
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('books')
        .select(CATALOG_METADATA_COLUMNS)
        .eq('id', bookId)
        .abortSignal(AbortSignal.timeout(2500))
        .maybeSingle();

      if (!error && data) {
        const book = mapDatabaseBookToGutendexBook(data as unknown as DatabaseBook);
        setServerMetadataCache(bookId, book);
        return book;
      }
      if (error) {
        supabaseUnavailable = true;
      }
    } catch {
      supabaseUnavailable = true;
    }
  }

  const featured = FEATURED_HERO_BOOKS.find((b) => b.id === bookId);

  // Tier 3: Bundled curated classics fallback (zero external HTTP requests)
  if (featured) {
    const fallbackBook = featuredHeroToGutendexBook(featured, {
      formats: {
        'text/plain; charset=utf-8': `https://www.gutenberg.org/cache/epub/${featured.id}/pg${featured.id}.txt`,
        'text/html': `https://www.gutenberg.org/cache/epub/${featured.id}/pg${featured.id}-images.html`,
        'application/epub+zip': `https://www.gutenberg.org/cache/epub/${featured.id}/pg${featured.id}.epub`,
        'image/jpeg': `https://www.gutenberg.org/cache/epub/${featured.id}/pg${featured.id}.cover.medium.jpg`,
      },
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
  description: string;
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

function buildOpeningHook(openingLine?: string, maxLength = 135): string {
  if (!openingLine) return '';
  const collapsed = openingLine.replace(/\s+/g, ' ').trim();
  if (!collapsed) return '';
  if (collapsed.length <= maxLength) return collapsed;
  const sliced = collapsed.slice(0, maxLength - 1);
  const lastSpace = sliced.lastIndexOf(' ');
  const cutoff = lastSpace > 40 ? sliced.slice(0, lastSpace) : sliced;
  return `${cutoff.replace(/[,;:\s]+$/, '')}…`;
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
 * Builds non-visual SEO metadata (OpenGraph book tags, meta keywords, enriched snippet
 * description, lifespan contributors, encoding formats, and Schema.org genres/identifiers).
 */
export function buildReaderSeoMetadataPayload(
  meta: ResolvedBookIdentity,
  bookId: number,
  formats?: Record<string, string>
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

  const featuredFixture = FEATURED_HERO_BOOKS.find((b) => b.id === bookId);
  const openingHook = buildOpeningHook(featuredFixture?.openingLine);

  const snippetGenres = resolvedGenres.slice(0, 3).join(', ');
  const translatorClause =
    translatorNames.length > 0 ? ` (translated by ${translatorNames.join(', ')})` : '';
  const genreClause = snippetGenres ? ` — ${snippetGenres}` : '';
  const baseSummary = `Read ${meta.title} by ${meta.displayAuthor}${translatorClause}${genreClause} unabridged and 100% legal in the public domain`;
  const description = openingHook
    ? `${openingHook} — ${baseSummary} on Bookarium.`
    : `${baseSummary}. In-browser focus reader with synchronized voice narration and dynamic translations on Bookarium.`;

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
    description,
    gutenbergUrl: SITE_CONFIG.GUTENBERG_EBOOK(bookId),
    availableFormats: extractAvailableEncodingFormats(formats),
  };
}

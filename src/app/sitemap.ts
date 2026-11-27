import type { MetadataRoute } from 'next';
import { SITE_CONFIG } from '@/config/site-config';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';
import { ROUTES } from '@/config/routes';
import { isSupabaseConfigured } from '@/lib/catalog/supabase-provider';
import { createClient } from '@/lib/supabase/client';
import { createOptionalDataCache } from '@/lib/server-data-cache';

export const revalidate = 86400;
export const SITEMAP_TOP_BOOKS_LIMIT = 5000;
const SITEMAP_PAGE_SIZE = 1000;

export const FEATURED_CLASSIC_BOOK_IDS = [
  84, // Frankenstein by Mary Wollstonecraft Shelley
  1342, // Pride and Prejudice by Jane Austen
  11, // Alice's Adventures in Wonderland by Lewis Carroll
  345, // Dracula by Bram Stoker
  64317, // The Great Gatsby by F. Scott Fitzgerald
  2701, // Moby Dick by Herman Melville
  1661, // The Adventures of Sherlock Holmes by Arthur Conan Doyle
  1232, // The Prince by Niccolò Machiavelli
  74, // The Adventures of Tom Sawyer by Mark Twain
  98, // A Tale of Two Cities by Charles Dickens
] as const;

export interface SitemapBookRow {
  id: number;
  updated_at?: string | null;
}

async function fetchTopPublicDomainBooksRaw(): Promise<SitemapBookRow[]> {
  const supabase = createClient();
  const rows: SitemapBookRow[] = [];

  for (let offset = 0; offset < SITEMAP_TOP_BOOKS_LIMIT; offset += SITEMAP_PAGE_SIZE) {
    const end = Math.min(SITEMAP_TOP_BOOKS_LIMIT - 1, offset + SITEMAP_PAGE_SIZE - 1);
    const { data, error } = await supabase
      .from('books')
      .select('id, updated_at')
      .eq('copyright', false)
      .order('download_count', { ascending: false })
      .range(offset, end)
      .abortSignal(AbortSignal.timeout(4000));

    if (error) {
      throw new Error(error.message || 'Failed to load sitemap catalog rows.');
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const item of data) {
      if (typeof item.id === 'number' && item.id > 0) {
        rows.push({
          id: item.id,
          updated_at: typeof item.updated_at === 'string' ? item.updated_at : null,
        });
      }
    }

    if (data.length < SITEMAP_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

const fetchCachedTopPublicDomainBooks = createOptionalDataCache(
  fetchTopPublicDomainBooksRaw,
  ['bookarium-sitemap-top-books-v1'],
  { revalidate: 86400, tags: ['sitemap', 'catalog'] }
);

export async function fetchTopPublicDomainSitemapBooks(): Promise<SitemapBookRow[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }
  try {
    return await fetchCachedTopPublicDomainBooks();
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_CONFIG.SITE_URL;
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}${ROUTES.PRIVACY}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}${ROUTES.COPYRIGHT}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  const seenBookIds = new Set<number>();
  const curatedIds = [
    ...FEATURED_CLASSIC_BOOK_IDS,
    ...FEATURED_HERO_BOOKS.map((book) => book.id),
  ];

  for (const bookId of curatedIds) {
    if (seenBookIds.has(bookId)) continue;
    seenBookIds.add(bookId);
    entries.push({
      url: `${baseUrl}${ROUTES.READ(bookId)}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    });
  }

  const popularBooks = await fetchTopPublicDomainSitemapBooks();
  for (const row of popularBooks) {
    if (seenBookIds.has(row.id)) continue;
    seenBookIds.add(row.id);

    const parsedDate = row.updated_at ? new Date(row.updated_at) : now;
    const lastModified = Number.isNaN(parsedDate.getTime()) ? now : parsedDate;

    entries.push({
      url: `${baseUrl}${ROUTES.READ(row.id)}`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  return entries;
}

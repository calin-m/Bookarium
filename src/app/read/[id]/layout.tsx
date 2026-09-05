import { cache } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { SITE_CONFIG } from '@/config/site-config';
import { resolveBookMetadata } from '@/lib/book-metadata';
import type { GutendexBook } from '@/types/book.types';

interface ReaderLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

const serverMetadataCache = new Map<number, GutendexBook>();

export function clearServerMetadataCache(): void {
  serverMetadataCache.clear();
}

/**
 * Detects whether the incoming request is an internal Next.js client-side router transition (RSC).
 * When true, we bypass outbound network fetches to gutendex.com so client readers transition in 0ms.
 */
export async function isClientSideNavigation(): Promise<boolean> {
  try {
    const headersList = await headers();
    return (
      headersList.get('rsc') === '1' ||
      Boolean(headersList.get('next-router-state-tree')) ||
      Boolean(headersList.get('next-router-prefetch')) ||
      headersList.get('accept')?.includes('text/x-component') === true
    );
  } catch {
    return false;
  }
}

export const fetchBookData = cache(async (bookId: number): Promise<GutendexBook | null> => {
  if (!bookId || isNaN(bookId)) return null;

  if (serverMetadataCache.has(bookId)) {
    return serverMetadataCache.get(bookId) || null;
  }

  try {
    const res = await fetch(`https://gutendex.com/books?ids=${bookId}`, {
      signal: AbortSignal.timeout(1500),
      next: { revalidate: 86400 }, // 24-hour ISR edge cache
    });

    if (!res.ok) return null;
    const data = await res.json();
    const book = data.results?.[0] || null;
    if (book) {
      serverMetadataCache.set(bookId, book);
    }
    return book;
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const bookId = parseInt(id, 10);

  if (!bookId || isNaN(bookId)) {
    return {
      title: 'Book Reader',
      description: 'Read unabridged public domain literature freely on Bookarium.',
    };
  }

  // Fast-path: Skip outbound network calls on client-side router navigations to guarantee 0ms transitions
  const isClientTransition = await isClientSideNavigation();
  const bookData = (!isClientTransition || serverMetadataCache.has(bookId))
    ? await fetchBookData(bookId)
    : null;

  const meta = resolveBookMetadata({
    id: bookId,
    booksData: bookData ? { count: 1, next: null, previous: null, results: [bookData] } : null,
  });

  const title = `${meta.title} by ${meta.displayAuthor}`;
  const description = `Read ${meta.title} by ${meta.displayAuthor} unabridged and 100% legal in the public domain. In-browser focus reader with synchronized voice narration and dynamic translations on Bookarium.`;
  const coverUrl =
    bookData?.formats?.['image/jpeg'] ||
    `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.cover.medium.jpg`;

  return {
    title,
    description,
    alternates: {
      canonical: `/read/${bookId}`,
    },
    openGraph: {
      type: 'book',
      locale: 'en_US',
      url: `${SITE_CONFIG.SITE_URL}/read/${bookId}`,
      siteName: SITE_CONFIG.NAME,
      title: `${title} | Bookarium`,
      description,
      images: [
        {
          url: coverUrl,
          width: 800,
          height: 1200,
          alt: `${meta.title} cover`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Bookarium`,
      description,
      images: [coverUrl],
    },
  };
}

export default async function BookReaderLayout({ children, params }: ReaderLayoutProps) {
  const { id } = await params;
  const bookId = parseInt(id, 10);
  let bookJsonLd: Record<string, unknown> | null = null;

  if (bookId && !isNaN(bookId)) {
    // For client-side transitions, never block layout rendering on remote Gutendex API
    const isClientTransition = await isClientSideNavigation();
    const bookData = (!isClientTransition || serverMetadataCache.has(bookId))
      ? await fetchBookData(bookId)
      : null;

    const meta = resolveBookMetadata({
      id: bookId,
      booksData: bookData ? { count: 1, next: null, previous: null, results: [bookData] } : null,
    });

    const coverUrl =
      bookData?.formats?.['image/jpeg'] ||
      `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.cover.medium.jpg`;

    bookJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: meta.title,
      author: {
        '@type': 'Person',
        name: meta.displayAuthor,
      },
      inLanguage: meta.languages || ['en'],
      isAccessibleForFree: true,
      license: 'https://creativecommons.org/publicdomain/mark/1.0/',
      url: `${SITE_CONFIG.SITE_URL}/read/${bookId}`,
      image: coverUrl,
      publisher: {
        '@type': 'Organization',
        name: 'Project Gutenberg',
        url: 'https://www.gutenberg.org',
      },
      genre: meta.primarySubject,
    };
  }

  return (
    <>
      {bookJsonLd && (
        <script
          type="application/ld+json"
        >
          {JSON.stringify(bookJsonLd)}
        </script>
      )}
      {children}
    </>
  );
}


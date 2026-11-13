import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { SITE_CONFIG } from '@/config/site-config';
import { resolveBookMetadata } from '@/lib/book-metadata';
import { decodeReadingCardShareToken } from '@/lib/reading-card-export';
import {
  serverMetadataCache,
  isClientSideNavigation,
  isConfirmedMissingBook,
  fetchBookData,
  buildReaderSeoMetadataPayload,
  type ReaderSeoPerson,
} from './reader-layout-utils';

interface ReaderLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

function toSchemaPerson(person: ReaderSeoPerson) {
  return {
    '@type': 'Person',
    name: person.name,
    ...(person.birthDate ? { birthDate: person.birthDate } : {}),
    ...(person.deathDate ? { deathDate: person.deathDate } : {}),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const bookId = parseInt(id, 10);

  if (!bookId || isNaN(bookId) || bookId <= 0) {
    return {
      title: {
        absolute: `${SITE_CONFIG.NAME} | ${SITE_CONFIG.READER_NAME}`,
      },
      description: 'Read unabridged public domain literature freely on Bookarium.',
      robots: {
        index: false,
        follow: false,
      },
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

  const authorSuffix = meta.displayAuthor ? ` — ${meta.displayAuthor}` : '';
  const readerTitle = `${SITE_CONFIG.NAME} | ${SITE_CONFIG.READER_NAME} | ${meta.title}${authorSuffix}`;
  const seo = buildReaderSeoMetadataPayload(meta, bookId, bookData?.formats);
  const coverUrl =
    bookData?.formats?.['image/jpeg'] ||
    `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.cover.medium.jpg`;

  let validShareToken: string | null = null;
  try {
    const headersList = await headers();
    const rawToken = headersList.get('x-bookarium-share-token');
    if (rawToken && decodeReadingCardShareToken(bookId, rawToken)) {
      validShareToken = rawToken;
    }
  } catch {
    // Non-blocking fallback outside request context
  }

  const cardImageUrl = `${SITE_CONFIG.SITE_URL}/api/books/content?id=${bookId}&type=card${
    validShareToken ? `&s=${validShareToken}` : ''
  }`;
  const shouldNoIndex = !isClientTransition && !bookData && isConfirmedMissingBook(bookId);

  return {
    title: {
      absolute: readerTitle,
    },
    description: seo.description,
    keywords: seo.keywords,
    ...(seo.authorNames.length > 0
      ? { authors: seo.authorNames.map((name) => ({ name })) }
      : {}),
    alternates: {
      canonical: `/read/${bookId}`,
    },
    ...(shouldNoIndex
      ? {
          robots: {
            index: false,
            follow: true,
          },
        }
      : {}),
    openGraph: {
      type: 'book',
      locale: 'en_US',
      url: `${SITE_CONFIG.SITE_URL}/read/${bookId}`,
      siteName: SITE_CONFIG.NAME,
      title: readerTitle,
      description: seo.description,
      ...(seo.authorNames.length > 0 ? { authors: seo.authorNames } : {}),
      tags: seo.genres,
      images: [
        {
          url: cardImageUrl,
          width: 1200,
          height: 630,
          alt: `${meta.title} — Bookarium Reading Card`,
        },
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
      title: readerTitle,
      description: seo.description,
      images: [cardImageUrl],
    },
  };
}

export default async function BookReaderLayout({ children, params }: ReaderLayoutProps) {
  const { id } = await params;
  const bookId = parseInt(id, 10);
  let bookJsonLd: Record<string, unknown> | null = null;
  let breadcrumbJsonLd: Record<string, unknown> | null = null;

  if (bookId && !isNaN(bookId) && bookId > 0) {
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
    const seo = buildReaderSeoMetadataPayload(meta, bookId, bookData?.formats);
    const authorSchema =
      seo.authorsMeta.length > 1
        ? seo.authorsMeta.map(toSchemaPerson)
        : toSchemaPerson(seo.authorsMeta[0] || { name: meta.displayAuthor });

    bookJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: meta.title,
      identifier: `gutenberg:${bookId}`,
      bookFormat: 'https://schema.org/EBook',
      author: authorSchema,
      ...(seo.translatorsMeta.length > 0
        ? {
            translator:
              seo.translatorsMeta.length > 1
                ? seo.translatorsMeta.map(toSchemaPerson)
                : toSchemaPerson(seo.translatorsMeta[0]),
          }
        : {}),
      ...(seo.availableFormats.length > 0
        ? {
            encoding: seo.availableFormats.map((encodingFormat) => ({
              '@type': 'MediaObject',
              encodingFormat,
            })),
          }
        : {}),
      inLanguage: meta.languages || ['en'],
      isAccessibleForFree: true,
      license: 'https://creativecommons.org/publicdomain/mark/1.0/',
      url: `${SITE_CONFIG.SITE_URL}/read/${bookId}`,
      sameAs: seo.gutenbergUrl,
      image: coverUrl,
      publisher: {
        '@type': 'Organization',
        name: 'Project Gutenberg',
        url: 'https://www.gutenberg.org',
      },
      genre: seo.genres,
      keywords: seo.genres.join(', '),
    };

    breadcrumbJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: SITE_CONFIG.NAME,
          item: SITE_CONFIG.SITE_URL,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: meta.title,
          item: `${SITE_CONFIG.SITE_URL}/read/${bookId}`,
        },
      ],
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
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          id="reader-breadcrumb-jsonld"
        >
          {JSON.stringify(breadcrumbJsonLd)}
        </script>
      )}
      {children}
    </>
  );
}

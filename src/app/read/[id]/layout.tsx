import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { SITE_CONFIG } from '@/config/site-config';
import { ROUTES } from '@/config/routes';
import { formatReaderDocumentTitle, resolveBookMetadata } from '@/lib/book-metadata';
import { CARD_DIMENSIONS } from '@/lib/share-card-primitives';
import { decodeReadingCardShareToken } from '@/lib/reading-card-export';
import {
  serverMetadataCache,
  isClientSideNavigation,
  isConfirmedMissingBook,
  fetchBookData,
  checkBookCoverAvailable,
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

  const readerTitle = formatReaderDocumentTitle(meta.title, meta.displayAuthor);
  const seo = buildReaderSeoMetadataPayload(meta, bookId, bookData?.formats, bookData);
  const hasVerifiedCover = !isClientTransition ? await checkBookCoverAvailable(bookId) : false;

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

  const cardImageUrl = `${SITE_CONFIG.SITE_URL}${ROUTES.OG_BOOK_CARD(bookId, validShareToken)}`;
  const coverImageUrl = hasVerifiedCover
    ? `${SITE_CONFIG.SITE_URL}${ROUTES.COVER_ASSET(bookId)}`
    : null;

  const shouldNoIndex =
    !isClientTransition &&
    ((bookData && seo.isUsRestricted) || (!bookData && isConfirmedMissingBook(bookId)));

  const ogImages = [
    {
      url: cardImageUrl,
      width: CARD_DIMENSIONS.width,
      height: CARD_DIMENSIONS.height,
      alt: `${meta.title} — Bookarium Reading Card`,
    },
    ...(coverImageUrl
      ? [
          {
            url: coverImageUrl,
            width: 800,
            height: 1200,
            alt: `${meta.title} cover`,
          },
        ]
      : []),
  ];

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
      canonical: ROUTES.READ(bookId),
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
      url: `${SITE_CONFIG.SITE_URL}${ROUTES.READ(bookId)}`,
      siteName: SITE_CONFIG.NAME,
      title: readerTitle,
      description: seo.ogDescription,
      ...(seo.authorNames.length > 0 ? { authors: seo.authorNames } : {}),
      tags: seo.genres,
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: readerTitle,
      description: seo.ogDescription,
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
    // For client-side transitions, avoid blocking layout rendering on remote metadata lookups
    const isClientTransition = await isClientSideNavigation();
    const bookData = (!isClientTransition || serverMetadataCache.has(bookId))
      ? await fetchBookData(bookId)
      : null;

    const meta = resolveBookMetadata({
      id: bookId,
      booksData: bookData ? { count: 1, next: null, previous: null, results: [bookData] } : null,
    });

    const seo = buildReaderSeoMetadataPayload(meta, bookId, bookData?.formats, bookData);
    const hasVerifiedCover = !isClientTransition ? await checkBookCoverAvailable(bookId) : false;
    const verifiedCoverUrl = hasVerifiedCover
      ? `${SITE_CONFIG.SITE_URL}${ROUTES.COVER_ASSET(bookId)}`
      : null;
    const fallbackCardUrl = `${SITE_CONFIG.SITE_URL}${ROUTES.OG_BOOK_CARD(bookId)}`;
    const primarySchemaImage = verifiedCoverUrl
      ? {
          '@type': 'ImageObject',
          url: verifiedCoverUrl,
          width: 800,
          height: 1200,
        }
      : {
          '@type': 'ImageObject',
          url: fallbackCardUrl,
          width: CARD_DIMENSIONS.width,
          height: CARD_DIMENSIONS.height,
        };
    const canonicalReaderUrl = `${SITE_CONFIG.SITE_URL}${ROUTES.READ(bookId)}`;

    const authorSchema =
      seo.authorsMeta.length > 1
        ? seo.authorsMeta.map(toSchemaPerson)
        : toSchemaPerson(seo.authorsMeta[0] || { name: meta.displayAuthor });

    const encodingSchemas =
      seo.availableFormats.length > 0
        ? seo.availableFormats.map((encodingFormat) => ({
            '@type': 'MediaObject',
            encodingFormat,
          }))
        : undefined;

    bookJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Book',
      name: meta.title,
      description: seo.description,
      abstract: seo.ogDescription,
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
      ...(encodingSchemas ? { encoding: encodingSchemas } : {}),
      inLanguage: meta.languages || ['en'],
      isAccessibleForFree: true,
      license: 'https://creativecommons.org/publicdomain/mark/1.0/',
      url: canonicalReaderUrl,
      sameAs: seo.gutenbergUrl,
      image: primarySchemaImage,
      thumbnailUrl: verifiedCoverUrl || fallbackCardUrl,
      publisher: {
        '@type': 'Organization',
        name: SITE_CONFIG.NAME,
        url: SITE_CONFIG.SITE_URL,
      },
      isBasedOn: {
        '@type': 'CreativeWork',
        name: 'Project Gutenberg',
        url: seo.gutenbergUrl,
      },
      workExample: {
        '@type': 'Book',
        name: meta.title,
        bookFormat: 'https://schema.org/EBook',
        inLanguage: meta.languages || ['en'],
        isAccessibleForFree: true,
        url: canonicalReaderUrl,
        ...(encodingSchemas ? { encoding: encodingSchemas } : {}),
        potentialAction: {
          '@type': 'ReadAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: canonicalReaderUrl,
            actionPlatform: [
              'https://schema.org/DesktopWebPlatform',
              'https://schema.org/MobileWebPlatform',
            ],
          },
          expectsAcceptanceOf: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
          },
        },
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
          item: canonicalReaderUrl,
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

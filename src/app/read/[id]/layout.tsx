import type { Metadata } from 'next';
import { SITE_CONFIG } from '@/config/site-config';
import { resolveBookMetadata } from '@/lib/book-metadata';
import type { GutendexBook } from '@/types/book.types';

interface ReaderLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

async function fetchBookData(bookId: number): Promise<GutendexBook | null> {
  if (!bookId || isNaN(bookId)) return null;

  try {
    const res = await fetch(`https://gutendex.com/books?ids=${bookId}`, {
      next: { revalidate: 86400 }, // 24-hour ISR edge cache
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.results?.[0] || null;
  } catch {
    return null;
  }
}

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

  const bookData = await fetchBookData(bookId);
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
    const bookData = await fetchBookData(bookId);
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


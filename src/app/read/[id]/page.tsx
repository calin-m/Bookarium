import { notFound } from 'next/navigation';
import { BookReaderClient } from '@/components/reader/BookReaderClient';
import {
  fetchBookData,
  isClientSideNavigation,
  isConfirmedMissingBook,
  serverMetadataCache,
} from './reader-layout-utils';

export default async function BookReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bookId = parseInt(id, 10);

  if (!bookId || isNaN(bookId) || bookId <= 0) {
    notFound();
  }

  const isClientTransition = await isClientSideNavigation();
  const bookData =
    !isClientTransition || serverMetadataCache.has(bookId)
      ? await fetchBookData(bookId)
      : null;

  if (!isClientTransition && !bookData && isConfirmedMissingBook(bookId)) {
    notFound();
  }

  return <BookReaderClient initialBook={bookData} />;
}

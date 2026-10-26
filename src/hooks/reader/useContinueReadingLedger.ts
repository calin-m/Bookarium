'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useReaderStore } from '@/stores/useReaderStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useHasMounted } from '@/hooks/useHasMounted';
import { useBooks } from '@/hooks/queries/useBooks';
import { toCanonicalBook, normalizeAuthorName } from '@/lib/adapters/book.adapter';
import { resolveBookMetadata, cleanBookTitle, isPlaceholderAuthor } from '@/lib/book-metadata';
import { parseLifespansFromName } from '@/lib/copyright-engine';
import { useOfflineBooks } from '@/hooks/useOfflineBooks';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import type {
  ActiveReadingVolume,
  Author,
  LedgerFilter,
  LedgerItemStatus,
  ReadingStatus,
} from '@/types/book.types';

export type BookmarksSortOption =
  | 'recent'
  | 'title_asc'
  | 'title_desc'
  | 'author_asc'
  | 'author_desc'
  | 'progress_desc'
  | 'progress_asc'
  | 'downloaded';

export interface UseContinueReadingLedgerReturn {
  volumes: ActiveReadingVolume[];
  filteredVolumes: ActiveReadingVolume[];
  activeFilter: LedgerFilter;
  setActiveFilter: (filter: LedgerFilter) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: BookmarksSortOption;
  setSortBy: (sort: BookmarksSortOption) => void;
  counts: {
    all: number;
    in_progress: number;
    completed: number;
    on_hold: number;
  };
  isLoading: boolean;
  updateVolumeStatus: (bookId: number, status: LedgerItemStatus) => Promise<void>;
  clearVolumeProgress: (bookId: number) => void;
  clearAllVolumes: () => void;
}

/**
 * Headless ledger hook aggregating active reading volumes, coordinates,
 * bookmarks, and curation statuses across local reader and bookshelf stores.
 */
export function useContinueReadingLedger(): UseContinueReadingLedgerReturn {
  const hasMounted = useHasMounted();
  const [activeFilter, setActiveFilter] = useState<LedgerFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<BookmarksSortOption>('recent');
  const { isBookOffline, offlineBooks = [] } = useOfflineBooks();
  const { isOnline } = useNetworkStatus();

  const readingProgress = useReaderStore((s) => s.readingProgress);
  const readingPositions = useReaderStore((s) => s.readingPositions);
  const clearReadingPosition = useReaderStore((s) => s.clearReadingPosition);
  const setProgress = useReaderStore((s) => s.setProgress);

  const savedBooks = useBookshelfStore((s) => s.savedBooks);
  const favoriteBooks = useBookshelfStore((s) => s.favoriteBooks);
  const recentBooks = useBookshelfStore((s) => s.recentBooks);
  const bookStatuses = useBookshelfStore((s) => s.bookStatuses);
  const setReadingStatus = useBookshelfStore((s) => s.setReadingStatus);

  const allActiveIds = useMemo(() => {
    if (!hasMounted) return [];

    const idSet = new Set<number>();
    Object.entries(readingPositions).forEach(([idStr, pos]) => {
      const id = parseInt(idStr, 10);
      if (Number.isNaN(id) || !pos) return;
      const prog = readingProgress[id] ?? 0;
      const hasStatus = Boolean(bookStatuses[id]);
      const isPastPageOne =
        (pos.globalPage ?? 1) > 1 ||
        (pos.chapterIndex ?? 0) > 0 ||
        (pos.chapterPage ?? 1) > 1 ||
        (pos.bookmarkRow ?? 0) > 0;
      if (prog > 0 || isPastPageOne || hasStatus) {
        idSet.add(id);
      }
    });

    Object.entries(readingProgress).forEach(([idStr, prog]) => {
      const id = parseInt(idStr, 10);
      if (!Number.isNaN(id) && prog > 0) idSet.add(id);
    });

    return Array.from(idSet).sort((a, b) => a - b);
  }, [hasMounted, readingPositions, readingProgress, bookStatuses]);

  const missingIds = useMemo(() => {
    const hasAuthenticAuthor = (authors?: (Author | string)[]): boolean => {
      if (!authors || authors.length === 0) return false;
      return authors.some((a) => {
        const name = typeof a === 'string' ? a : a?.name;
        return Boolean(name && !isPlaceholderAuthor(name));
      });
    };

    const known = new Set<number>();
    savedBooks.forEach((b) => b?.id && hasAuthenticAuthor(b.authors) && known.add(b.id));
    favoriteBooks.forEach((b) => b?.id && hasAuthenticAuthor(b.authors) && known.add(b.id));
    recentBooks.forEach((b) => b?.id && hasAuthenticAuthor(b.authors) && known.add(b.id));
    offlineBooks.forEach((b) => b?.id && hasAuthenticAuthor(b.authors) && known.add(b.id));
    const current = useReaderStore.getState().currentBook;
    if (current?.id && hasAuthenticAuthor(current.authors)) known.add(current.id);

    Object.entries(readingPositions).forEach(([idStr, pos]) => {
      const id = parseInt(idStr, 10);
      if (!Number.isNaN(id) && pos?.bookTitle && hasAuthenticAuthor(pos?.bookAuthors)) {
        known.add(id);
      }
    });

    return allActiveIds.filter((id) => !known.has(id));
  }, [allActiveIds, savedBooks, favoriteBooks, recentBooks, offlineBooks, readingPositions]);

  const idsParam = useMemo(() => missingIds.join(','), [missingIds]);
  const { data: missingBooksData, isLoading: isMissingBooksLoading } = useBooks(
    { ids: idsParam, copyright: false, includeRestrictedMetadata: true },
    { enabled: isOnline && missingIds.length > 0 }
  );

  useEffect(() => {
    if (missingBooksData?.results && missingBooksData.results.length > 0) {
      useBookshelfStore.getState().enrichSavedBooks(missingBooksData.results);
      useReaderStore.getState().enrichReadingPositions(missingBooksData.results);
    }
  }, [missingBooksData]);

  const volumes: ActiveReadingVolume[] = useMemo(() => {
    if (!hasMounted) return [];

    const bookDictionary = new Map<number, ReturnType<typeof toCanonicalBook>>();

    const hasLifespan = (b: ReturnType<typeof toCanonicalBook>) =>
      Boolean(b.authorDetails?.some((a) => a.birth_year != null || a.death_year != null));

    const hasAuthenticDomainAuthors = (b: ReturnType<typeof toCanonicalBook>) =>
      Boolean(b.authors?.some((name) => name && !isPlaceholderAuthor(name)));

    const setOrMergeBook = (candidate: ReturnType<typeof toCanonicalBook>) => {
      const existing = bookDictionary.get(candidate.id);
      if (!existing) {
        bookDictionary.set(candidate.id, candidate);
        return;
      }

      const existingHasAuthors = hasAuthenticDomainAuthors(existing);
      const candidateHasAuthors = hasAuthenticDomainAuthors(candidate);
      const existingHasLifespan = hasLifespan(existing);
      const candidateHasLifespan = hasLifespan(candidate);

      // If existing has authentic authors and candidate only has placeholder (e.g. offline Anonymous fallback)
      if (existingHasAuthors && !candidateHasAuthors) {
        bookDictionary.set(candidate.id, {
          ...candidate,
          authors: existing.authors,
          authorDetails: existing.authorDetails,
          translators: candidate.translators?.length ? candidate.translators : existing.translators,
        });
        return;
      }

      // If existing has verified lifespan details, candidate does not
      if (existingHasLifespan && !candidateHasLifespan) {
        bookDictionary.set(candidate.id, {
          ...candidate,
          authors: candidateHasAuthors ? candidate.authors : existing.authors,
          authorDetails: existing.authorDetails,
          translators: candidate.translators?.length ? candidate.translators : existing.translators,
        });
        return;
      }

      bookDictionary.set(candidate.id, candidate);
    };

    // Prioritize metadata sources while never overwriting verified authorDetails lifespans with partial data
    favoriteBooks.forEach((b) => {
      if (b && typeof b.id === 'number') {
        setOrMergeBook(toCanonicalBook(b));
      }
    });

    savedBooks.forEach((b) => {
      if (b && typeof b.id === 'number') {
        setOrMergeBook(toCanonicalBook(b));
      }
    });

    recentBooks.forEach((b) => {
      if (b && typeof b.id === 'number') {
        setOrMergeBook(toCanonicalBook(b));
      }
    });

    offlineBooks.forEach((b) => {
      if (b && typeof b.id === 'number') {
        setOrMergeBook(toCanonicalBook(b));
      }
    });

    const currentBook = useReaderStore.getState().currentBook;
    if (currentBook && typeof currentBook.id === 'number') {
      setOrMergeBook(toCanonicalBook(currentBook));
    }

    if (missingBooksData?.results) {
      missingBooksData.results.forEach((b) => {
        if (b && typeof b.id === 'number') {
          setOrMergeBook(toCanonicalBook(b));
        }
      });
    }

    const extractAuthorsFromPosition = (rawAuthors: string[] | undefined): {
      displayAuthors: string[];
      parsedDetails: Author[];
    } => {
      if (!rawAuthors || rawAuthors.length === 0) {
        return { displayAuthors: [], parsedDetails: [] };
      }
      const displayAuthors = rawAuthors
        .map((name) => normalizeAuthorName(name))
        .filter((name) => name.length > 0);
      const parsedDetails: Author[] = [];
      for (const raw of rawAuthors) {
        const parsed = parseLifespansFromName(raw);
        if (parsed.birthYear !== null || parsed.deathYear !== null) {
          parsedDetails.push({
            name: raw,
            birth_year: parsed.birthYear,
            death_year: parsed.deathYear,
          });
        }
      }
      return { displayAuthors, parsedDetails };
    };

    const items: ActiveReadingVolume[] = [];

    allActiveIds.forEach((bookId) => {
      let book = bookDictionary.get(bookId);
      const position = readingPositions[bookId];
      const { displayAuthors: posDisplayAuthors, parsedDetails: posAuthorDetails } =
        extractAuthorsFromPosition(position?.bookAuthors);

      if (book) {
        const bookHasAuthenticAuthors = hasAuthenticDomainAuthors(book);
        const posHasAuthenticAuthors =
          posDisplayAuthors.length > 0 && !posDisplayAuthors.every(isPlaceholderAuthor);
        if (!bookHasAuthenticAuthors && posHasAuthenticAuthors) {
          book = {
            ...book,
            authors: posDisplayAuthors,
            ...(posAuthorDetails.length > 0 ? { authorDetails: posAuthorDetails } : {}),
          };
        }
      }

      if (!book) {
        const resolved = resolveBookMetadata({
          id: bookId,
          currentBook: currentBook?.id === bookId ? currentBook : undefined,
        });

        const effectiveAuthorDetails =
          posAuthorDetails.length > 0
            ? posAuthorDetails
            : resolved.authors.length > 0
            ? resolved.authors
            : undefined;

        const fallbackAuthors =
          posDisplayAuthors.length > 0
            ? posDisplayAuthors
            : resolved.authors.length > 0
            ? resolved.authors.map((a) => normalizeAuthorName(a.name))
            : resolved.author
            ? [normalizeAuthorName(resolved.author)]
            : ['Public Domain Author'];

        book = {
          id: bookId,
          title: cleanBookTitle(position?.bookTitle || resolved.title) || `Volume #${bookId}`,
          authors: fallbackAuthors,
          ...(effectiveAuthorDetails ? { authorDetails: effectiveAuthorDetails } : {}),
          ...(resolved.translators.length > 0 ? { translators: resolved.translators } : {}),
          subjects: resolved.primarySubject ? [resolved.primarySubject] : [],
          languages: resolved.languages,
          coverUrl:
            position?.coverUrl ||
            `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.cover.medium.jpg`,
          epubUrl: `https://www.gutenberg.org/ebooks/${bookId}.epub3.images`,
          htmlUrl: null,
          txtUrl: null,
          downloadCount: 0,
        };
      } else {
        let enrichedDetails = book.authorDetails;
        if (!hasLifespan(book)) {
          if (posAuthorDetails.length > 0) {
            enrichedDetails = posAuthorDetails;
          } else {
            const resolved = resolveBookMetadata({ id: bookId });
            if (resolved.authors.some((a) => a.birth_year != null || a.death_year != null)) {
              enrichedDetails = resolved.authors;
            }
          }
        }
        book = {
          ...book,
          title: cleanBookTitle(book.title),
          ...(enrichedDetails ? { authorDetails: enrichedDetails } : {}),
        };
      }

      const rawProgress = readingProgress[bookId] ?? 0;
      const progress = Math.min(Math.max(Math.round(rawProgress), 0), 100);
      const rawStatus = bookStatuses[bookId];

      let status: LedgerItemStatus = 'in_progress';
      if (rawStatus === 'finished') {
        status = 'completed';
      } else if (rawStatus === 'want_to_read') {
        status = 'on_hold';
      } else if (rawStatus === 'currently_reading') {
        status = 'in_progress';
      } else if (progress >= 100) {
        status = 'completed';
      }

      items.push({
        book,
        progressPercent: progress,
        lastReadAt: position?.lastReadAt || new Date(0).toISOString(),
        chapterIndex: position?.chapterIndex ?? 0,
        chapterPage: position?.chapterPage ?? 1,
        globalPage: position?.globalPage ?? 1,
        ...(position?.bookmarkRow && position.bookmarkRow > 0
          ? { bookmarkRow: position.bookmarkRow }
          : {}),
        status,
        bookmarksCount: position ? 1 : 0,
      });
    });

    // Sort by lastReadAt descending (most recently read first)
    items.sort((a, b) => {
      const timeA = new Date(a.lastReadAt).getTime();
      const timeB = new Date(b.lastReadAt).getTime();
      return timeB - timeA;
    });

    return items;
  }, [
    hasMounted,
    allActiveIds,
    readingPositions,
    readingProgress,
    recentBooks,
    savedBooks,
    favoriteBooks,
    bookStatuses,
    missingBooksData,
    offlineBooks,
  ]);

  const counts = useMemo(() => {
    let inProgress = 0;
    let completed = 0;
    let onHold = 0;

    volumes.forEach((vol) => {
      if (vol.status === 'in_progress') inProgress++;
      else if (vol.status === 'completed') completed++;
      else if (vol.status === 'on_hold') onHold++;
    });

    return {
      all: volumes.length,
      in_progress: inProgress,
      completed,
      on_hold: onHold,
    };
  }, [volumes]);

  const filteredVolumes = useMemo(() => {
    let result = volumes;
    if (activeFilter !== 'all') {
      result = result.filter((vol) => vol.status === activeFilter);
    }
    const cleanQuery = searchQuery.trim().toLowerCase();
    if (cleanQuery) {
      result = result.filter((vol) => {
        const titleMatch = vol.book.title?.toLowerCase().includes(cleanQuery);
        const authorMatch = vol.book.authors?.some((author) =>
          author.toLowerCase().includes(cleanQuery)
        );
        const subjectMatch = vol.book.subjects?.some((subject) =>
          subject.toLowerCase().includes(cleanQuery)
        );
        return Boolean(titleMatch || authorMatch || subjectMatch);
      });
    }

    if (sortBy === 'downloaded') {
      result = result.filter((item) => isBookOffline(item.book.id));
    }

    const sortedResult = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'title_asc':
          return a.book.title.localeCompare(b.book.title, undefined, { sensitivity: 'base' });
        case 'title_desc':
          return b.book.title.localeCompare(a.book.title, undefined, { sensitivity: 'base' });
        case 'author_asc':
        case 'author_desc': {
          const authorA = a.book.authors[0] || '';
          const authorB = b.book.authors[0] || '';
          return sortBy === 'author_asc'
            ? authorA.localeCompare(authorB, undefined, { sensitivity: 'base' })
            : authorB.localeCompare(authorA, undefined, { sensitivity: 'base' });
        }
        case 'progress_desc':
          return b.progressPercent - a.progressPercent;
        case 'progress_asc':
          return a.progressPercent - b.progressPercent;
        case 'recent':
        default: {
          const timeA = new Date(a.lastReadAt).getTime();
          const timeB = new Date(b.lastReadAt).getTime();
          return timeB - timeA;
        }
      }
    });

    return sortedResult;
  }, [volumes, activeFilter, searchQuery, sortBy, isBookOffline]);

  const updateVolumeStatus = useCallback(
    async (bookId: number, status: LedgerItemStatus) => {
      let mappedStatus: ReadingStatus = 'currently_reading';
      if (status === 'completed') mappedStatus = 'finished';
      else if (status === 'on_hold') mappedStatus = 'want_to_read';

      await setReadingStatus(bookId, mappedStatus);

      const currentProgress = useReaderStore.getState().readingProgress[bookId] ?? 0;
      if (status === 'completed' && currentProgress < 100) {
        setProgress(bookId, 100);
      } else if (status === 'in_progress' && currentProgress >= 100) {
        const currentPos = useReaderStore.getState().readingPositions[bookId];
        useReaderStore.getState().saveReadingPosition(bookId, {
          chapterIndex: 0,
          chapterPage: 1,
          globalPage: 1,
          lastReadAt: new Date().toISOString(),
          bookTitle: currentPos?.bookTitle,
          bookAuthors: currentPos?.bookAuthors,
          coverUrl: currentPos?.coverUrl,
        });
        setProgress(bookId, 0);
      }
    },
    [setReadingStatus, setProgress]
  );

  const clearVolumeProgress = useCallback(
    (bookId: number) => {
      clearReadingPosition(bookId);
      setProgress(bookId, 0);
    },
    [clearReadingPosition, setProgress]
  );

  const clearAllVolumes = useCallback(async () => {
    await useReaderStore.getState().clearAllVolumes();
  }, []);

  return {
    volumes,
    filteredVolumes,
    activeFilter,
    setActiveFilter,
    searchQuery,
    setSearchQuery,
    counts,
    sortBy,
    setSortBy,
    isLoading: !hasMounted || (missingIds.length > 0 && isMissingBooksLoading),
    updateVolumeStatus,
    clearVolumeProgress,
    clearAllVolumes,
  };
}


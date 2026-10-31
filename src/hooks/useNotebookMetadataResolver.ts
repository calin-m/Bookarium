'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  useAnnotationStore,
  type Annotation,
  type FellowAnnotation,
} from '@/stores/useAnnotationStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useFellowshipStore } from '@/stores/useFellowshipStore';
import { useJurisdiction } from '@/stores/useJurisdictionStore';
import { useOfflineBooks } from '@/hooks/useOfflineBooks';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useBooks } from '@/hooks/queries/useBooks';
import {
  isBookPublicDomainInJurisdiction,
  parseLifespansFromName,
  type GenericBookInput,
} from '@/lib/copyright-engine';
import { FEATURED_HERO_BOOKS, type FeaturedHeroBook } from '@/config/featured-books';
import {
  cleanBookTitle,
  isPlaceholderAuthor,
  isPlaceholderTitle,
  hasAuthorLifespans,
  featuredHeroToGutendexBook,
} from '@/lib/book-metadata';
import { formatAuthorNames } from '@/lib/utils';
import type { GutendexBook } from '@/types/book.types';

const EMPTY_OFFLINE_BOOKS: GutendexBook[] = [];

export interface ResolvedNotebookBookDetails {
  title: string;
  author: string;
  isRestricted: boolean;
  country: string;
}

/**
 * Encapsulates multi-pool book metadata resolution (`savedBooks`, `favoriteBooks`,
 * `recentBooks`, `offlineBooks`, `FEATURED_HERO_BOOKS`, and remote Gutendex fallback),
 * automatic store metadata self-healing, Fellow Scholar profile hydration,
 * and `primeReaderForBook` for the Literary Notebook.
 */
export function useNotebookMetadataResolver(
  annotations: Annotation[],
  fellowAnnotations: FellowAnnotation[],
  userId?: string
) {
  const savedBooks = useBookshelfStore((s) => s.savedBooks);
  const favoriteBooks = useBookshelfStore((s) => s.favoriteBooks);
  const recentBooks = useBookshelfStore((s) => s.recentBooks);
  const updateBookMetadata = useAnnotationStore((s) => s.updateBookMetadata);
  const { country } = useJurisdiction();
  const { isBookOffline, offlineBooks = EMPTY_OFFLINE_BOOKS } = useOfflineBooks();
  const { isOnline, isOffline } = useNetworkStatus();
  const [attemptedMetadataIds, setAttemptedMetadataIds] = useState<Set<number>>(() => new Set());
  const [resolvedRemoteBooks, setResolvedRemoteBooks] = useState<Map<number, GutendexBook>>(
    () => new Map()
  );

  // Identify book IDs across own and fellow annotations that lack resolved titles/authors
  // (or lack author lifespans in non-US jurisdictions) and are not in local stores or static fixtures
  const missingMetadataBookIds = useMemo(() => {
    const ids = new Set<number>();
    const allAnnotations = [...annotations, ...fellowAnnotations];
    const cachedRemotePool = Array.from(resolvedRemoteBooks.values());
    for (const ann of allAnnotations) {
      if (!ann.bookId || ann.bookId <= 0 || attemptedMetadataIds.has(ann.bookId)) continue;
      const cleanTitle = cleanBookTitle(ann.bookTitle);
      const hasValidTitle = Boolean(cleanTitle && !isPlaceholderTitle(cleanTitle));
      const hasValidAuthor = Boolean(ann.bookAuthor && !isPlaceholderAuthor(ann.bookAuthor));
      const annParsed = ann.bookAuthor
        ? parseLifespansFromName(ann.bookAuthor)
        : { birthYear: null, deathYear: null };
      const annHasLifespan = annParsed.birthYear != null || annParsed.deathYear != null;

      if (hasValidTitle && hasValidAuthor && (country === 'US' || annHasLifespan)) continue;

      const hasVerifiedStoreAuthors = (b: GutendexBook) => {
        if (country === 'US') return true;
        return hasAuthorLifespans(b.authors);
      };

      const inLocalPools = [
        savedBooks,
        favoriteBooks,
        recentBooks,
        offlineBooks,
        cachedRemotePool,
      ].some((pool) => pool.some((b) => b.id === ann.bookId && hasVerifiedStoreAuthors(b)));
      const inFeatured = FEATURED_HERO_BOOKS.some((b) => b.id === ann.bookId);

      if (!inLocalPools && !inFeatured) {
        ids.add(ann.bookId);
      }
    }
    return Array.from(ids).sort((a, b) => a - b);
  }, [
    annotations,
    fellowAnnotations,
    savedBooks,
    favoriteBooks,
    recentBooks,
    offlineBooks,
    country,
    attemptedMetadataIds,
    resolvedRemoteBooks,
  ]);

  // Query Gutendex remote API / cache for any unindexed annotated books
  const { data: remoteBooksData } = useBooks(
    {
      ids: missingMetadataBookIds.join(','),
      page: 1,
      copyright: false,
      includeRestrictedMetadata: true,
    },
    { enabled: isOnline && missingMetadataBookIds.length > 0 }
  );

  const [prevRemoteResults, setPrevRemoteResults] = useState<unknown>(null);
  if (remoteBooksData?.results && remoteBooksData.results !== prevRemoteResults) {
    setPrevRemoteResults(remoteBooksData.results);
    if (remoteBooksData.results.length > 0) {
      let nextMap: Map<number, GutendexBook> | null = null;
      for (const book of remoteBooksData.results) {
        if (resolvedRemoteBooks.get(book.id) !== book) {
          if (!nextMap) nextMap = new Map(resolvedRemoteBooks);
          nextMap.set(book.id, book);
        }
      }
      if (nextMap) {
        setResolvedRemoteBooks(nextMap);
      }
    }
    if (missingMetadataBookIds.length > 0) {
      let nextSet: Set<number> | null = null;
      for (const id of missingMetadataBookIds) {
        if (!attemptedMetadataIds.has(id)) {
          if (!nextSet) nextSet = new Set(attemptedMetadataIds);
          nextSet.add(id);
        }
      }
      if (nextSet) {
        setAttemptedMetadataIds(nextSet);
      }
    }
  }

  // Auto-heal missing metadata in local annotations, bookshelf, and reading positions when remote books resolve
  useEffect(() => {
    if (!remoteBooksData?.results || remoteBooksData.results.length === 0) return;
    useBookshelfStore.getState().enrichSavedBooks(remoteBooksData.results);
    useReaderStore.getState().enrichReadingPositions(remoteBooksData.results);
    for (const book of remoteBooksData.results) {
      const author = book.authors ? formatAuthorNames(book.authors) : undefined;
      updateBookMetadata(book.id, book.title, author);
    }
  }, [remoteBooksData, updateBookMetadata]);

  // Hydrate reader circle and symposium companion identities and resolve any stale placeholder usernames
  useEffect(() => {
    if (!userId || !isOnline) return;
    const fellowshipStore = useFellowshipStore.getState();
    const annotationStore = useAnnotationStore.getState();

    fellowshipStore
      .fetchFellowshipData(userId)
      .then(async () => {
        await annotationStore.syncWithCloud(userId);
        annotationStore.enrichFellowAnnotations();
        return annotationStore.resolveStaleFellowProfiles();
      })
      .catch(() => {
        // Non-blocking
      });
  }, [userId, isOnline]);

  // Helper to resolve literary metadata for an annotation
  const resolveBookDetails = useCallback(
    (ann: Annotation): ResolvedNotebookBookDetails => {
      const matchingPoolBooks = [
        ...savedBooks,
        ...favoriteBooks,
        ...recentBooks,
        ...offlineBooks,
        ...Array.from(resolvedRemoteBooks.values()),
        ...(remoteBooksData?.results || []),
      ].filter((b) => b.id === ann.bookId);
      const fromPool = matchingPoolBooks[0];
      const fromFeatured = FEATURED_HERO_BOOKS.find((b: FeaturedHeroBook) => b.id === ann.bookId);

      let poolTitle = '';
      let poolAuthor = '';
      for (const b of matchingPoolBooks) {
        const cleanedPoolTitle = cleanBookTitle(b.title);
        if (!poolTitle && cleanedPoolTitle && !isPlaceholderTitle(cleanedPoolTitle)) {
          poolTitle = cleanedPoolTitle;
        }
        if (!poolAuthor && b.authors?.length) {
          const formatted = formatAuthorNames(b.authors);
          if (!isPlaceholderAuthor(formatted)) {
            poolAuthor = formatted;
          }
        }
      }

      const cleanedAnnTitle = cleanBookTitle(ann.bookTitle);
      const hasValidAnnTitle = cleanedAnnTitle && !isPlaceholderTitle(cleanedAnnTitle);

      const candidateTitle =
        (hasValidAnnTitle ? cleanedAnnTitle : '') ||
        poolTitle ||
        fromFeatured?.title ||
        cleanedAnnTitle;

      const cleanedAnnAuthor = !isPlaceholderAuthor(ann.bookAuthor)
        ? ann.bookAuthor?.replace(/^by\s+/i, '').trim()
        : '';

      const candidateAuthor = cleanedAnnAuthor || poolAuthor || fromFeatured?.author || '';

      const cleanTitle = cleanBookTitle(candidateTitle);
      const finalTitle =
        (!isPlaceholderTitle(cleanTitle) ? cleanTitle : '') ||
        cleanBookTitle(fromFeatured?.title) ||
        poolTitle ||
        (ann.bookId ? `Volume #${ann.bookId}` : 'Public Domain Classic');

      const finalAuthor = candidateAuthor || fromFeatured?.author || 'Classic Literature';

      let bookEntity: GenericBookInput | undefined =
        fromPool ||
        (fromFeatured
          ? {
              id: fromFeatured.id,
              title: fromFeatured.title,
              authors: [
                {
                  name: fromFeatured.author,
                  birth_year: fromFeatured.authorBirthYear,
                  death_year: fromFeatured.authorDeathYear,
                },
              ],
            }
          : undefined);

      // Fallback enrichment: If a book entity exists but its authors lack lifespan dates,
      // recover them from FEATURED_HERO_BOOKS or parse them from author strings
      if (bookEntity && bookEntity.authors && bookEntity.authors.length > 0) {
        const authorsNeedLifespan = bookEntity.authors.every((a) => {
          if (typeof a === 'string') return true;
          return a.birth_year == null && a.death_year == null;
        });

        if (authorsNeedLifespan) {
          if (fromFeatured) {
            bookEntity = {
              ...bookEntity,
              authors: [
                {
                  name: fromFeatured.author,
                  birth_year: fromFeatured.authorBirthYear,
                  death_year: fromFeatured.authorDeathYear,
                },
              ],
            };
          } else {
            const enrichedAuthors = bookEntity.authors.map((a) => {
              const nameStr = typeof a === 'string' ? a : a.name;
              const parsed = parseLifespansFromName(nameStr);
              if (parsed.birthYear != null || parsed.deathYear != null) {
                return {
                  name: nameStr,
                  birth_year: parsed.birthYear,
                  death_year: parsed.deathYear,
                };
              }
              return a;
            });
            bookEntity = {
              ...bookEntity,
              authors: enrichedAuthors,
            };
          }
        }
      }

      if (!bookEntity && ann.bookId > 0) {
        const parsed = parseLifespansFromName(finalAuthor);
        if (parsed.birthYear != null || parsed.deathYear != null) {
          bookEntity = {
            id: ann.bookId,
            title: finalTitle,
            authors: [
              {
                name: finalAuthor,
                birth_year: parsed.birthYear,
                death_year: parsed.deathYear,
              },
            ],
          };
        }
      }

      const evaluation = bookEntity
        ? isBookPublicDomainInJurisdiction(bookEntity, country)
        : { isAllowed: true };
      const isRestricted = !evaluation.isAllowed;

      return {
        title: finalTitle,
        author: finalAuthor,
        isRestricted,
        country,
      };
    },
    [
      savedBooks,
      favoriteBooks,
      recentBooks,
      offlineBooks,
      resolvedRemoteBooks,
      remoteBooksData,
      country,
    ]
  );

  const primeReaderForBook = useCallback(
    (bookId: number) => {
      const matchedBook =
        resolvedRemoteBooks.get(bookId) ||
        remoteBooksData?.results?.find((b) => b.id === bookId) ||
        savedBooks.find((b) => b.id === bookId) ||
        favoriteBooks.find((b) => b.id === bookId) ||
        recentBooks.find((b) => b.id === bookId) ||
        offlineBooks.find((b) => b.id === bookId);
      if (matchedBook) {
        useReaderStore.getState().openReader(matchedBook);
      } else {
        const fromFeatured = FEATURED_HERO_BOOKS.find((b: FeaturedHeroBook) => b.id === bookId);
        if (fromFeatured) {
          useReaderStore.getState().openReader(featuredHeroToGutendexBook(fromFeatured));
        }
      }
    },
    [resolvedRemoteBooks, remoteBooksData, savedBooks, favoriteBooks, recentBooks, offlineBooks]
  );

  return {
    resolveBookDetails,
    primeReaderForBook,
    isBookOffline,
    isOffline,
  };
}


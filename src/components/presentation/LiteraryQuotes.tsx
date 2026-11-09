'use client';

import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import Link from 'next/link';
import { ArrowRight, Quote, Shuffle, Sparkles, BookOpen } from 'lucide-react';
import {
  LITERARY_QUOTES,
  getJurisdictionSafeLiteraryQuotes,
  selectHourlyLiteraryQuotes,
  type LiteraryQuote,
} from '@/config/literary-quotes';
import { ROUTES } from '@/config/routes';
import { formatAuthorNames, formatPrimarySubject } from '@/lib/utils';
import { isBookPublicDomainInJurisdiction } from '@/lib/copyright-engine';
import { useJurisdiction } from '@/stores/useJurisdictionStore';
import { useHasMounted } from '@/hooks/useHasMounted';
import { useFeaturedQuotes, useQuoteEnrichedBooks } from '@/hooks/queries/useBooks';

const subscribeHourly = (callback: () => void) => {
  const interval = setInterval(callback, 60 * 1000);
  return () => clearInterval(interval);
};

const getCurrentHourlyIndex = () => {
  return Math.floor(Date.now() / (1000 * 60 * 60));
};

const getHourlySnapshot = () => {
  return getCurrentHourlyIndex();
};

const getHourlyServerSnapshot = () => {
  return getCurrentHourlyIndex();
};

export const LiteraryQuotes: React.FC = () => {
  const { country } = useJurisdiction();
  const hasMounted = useHasMounted();
  const hourlyIndex = useSyncExternalStore(
    subscribeHourly,
    getHourlySnapshot,
    getHourlyServerSnapshot
  );

  const baseSafeQuotes = useMemo(() => {
    if (!hasMounted) {
      return LITERARY_QUOTES.slice(0, 3);
    }
    const filtered = getJurisdictionSafeLiteraryQuotes(country);
    return filtered.length >= 3 ? filtered : LITERARY_QUOTES.slice(0, 3);
  }, [country, hasMounted]);

  // The hook gates its own fetch on client mount, so no `enabled` override is needed here; leaving it
  // unset keeps `isPoolSettled` false until the quote pool is final (hydration-safe single reveal).
  const { data: quoteEnrichedBooks, isPoolSettled } = useQuoteEnrichedBooks();

  const hasEnrichedPool = useMemo(
    () =>
      Boolean(
        quoteEnrichedBooks &&
          quoteEnrichedBooks.some((b) => Array.isArray(b.quotes) && b.quotes.length > 0)
      ),
    [quoteEnrichedBooks]
  );

  const quoteBookIds = useMemo(() => {
    if (hasEnrichedPool) return [];
    return Array.from(new Set(baseSafeQuotes.map((q) => q.bookId)));
  }, [baseSafeQuotes, hasEnrichedPool]);

  const { data: featuredQuotesMap } = useFeaturedQuotes(quoteBookIds, {
    enabled: hasMounted && !hasEnrichedPool && quoteBookIds.length > 0,
  });

  // Build safeQuotes strictly from database public.books.quotes (useQuoteEnrichedBooks) when available,
  // falling back to baseSafeQuotes only when unconfigured/empty or to top up to 3 distinct books.
  const safeQuotes = useMemo(() => {
    const hasMap = Boolean(featuredQuotesMap && Object.keys(featuredQuotesMap).length > 0);
    if (!hasMap && !hasEnrichedPool) {
      return baseSafeQuotes;
    }

    const cleanQuoteText = (raw: string) => raw.replace(/^[“"'\s]+|[”"'\s]+$/g, '').trim();
    const expanded: LiteraryQuote[] = [];
    let syntheticId = 1000;
    const seenBookIds = new Set<number>();

    for (const dbBook of quoteEnrichedBooks || []) {
      if (
        seenBookIds.has(dbBook.id) ||
        !Array.isArray(dbBook.quotes) ||
        dbBook.quotes.length === 0 ||
        !isBookPublicDomainInJurisdiction(dbBook, country).isAllowed
      ) {
        continue;
      }
      const authorName = formatAuthorNames(dbBook.authors) || 'Classic Author';
      const category = (formatPrimarySubject(dbBook.subjects) || 'Classic Literature').toUpperCase();
      const firstAuthor = dbBook.authors?.[0];
      const year =
        firstAuthor?.birth_year && firstAuthor?.death_year
          ? `${firstAuthor.birth_year}–${firstAuthor.death_year}`
          : 'Classic';

      let addedForBook = false;
      for (const passage of dbBook.quotes) {
        const excerptText = cleanQuoteText(passage.quoteExcerpt || passage.openingLine || '');
        if (excerptText.length >= 25) {
          addedForBook = true;
          expanded.push({
            id: syntheticId++,
            bookId: dbBook.id,
            category,
            year,
            bookTitle: dbBook.title,
            author: authorName,
            authorBirthYear: firstAuthor?.birth_year ?? undefined,
            authorDeathYear: firstAuthor?.death_year ?? undefined,
            translators: dbBook.translators || [],
            quote: excerptText,
            citation: passage.chapterLabel || `${dbBook.title} • Vol. #${dbBook.id}`,
          });
        }
      }
      if (addedForBook) {
        seenBookIds.add(dbBook.id);
      }
    }

    // Only include fallback/featuredQuotesMap entries if database pool has fewer than 3 distinct books
    if (seenBookIds.size < 3) {
      for (const item of baseSafeQuotes) {
        if (seenBookIds.has(item.bookId)) continue;
        seenBookIds.add(item.bookId);
        const dbPassages = featuredQuotesMap?.[item.bookId];
        if (Array.isArray(dbPassages) && dbPassages.length > 0) {
          for (const passage of dbPassages) {
            const excerptText = cleanQuoteText(passage.quoteExcerpt || passage.openingLine || '');
            if (excerptText.length >= 25) {
              expanded.push({
                ...item,
                id: syntheticId++,
                quote: excerptText,
                citation: passage.chapterLabel || item.citation,
              });
            }
          }
        } else {
          expanded.push(item);
        }
      }
    }

    return expanded.length >= 3 ? expanded : baseSafeQuotes;
  }, [baseSafeQuotes, featuredQuotesMap, quoteEnrichedBooks, hasEnrichedPool, country]);

  // Helper to select up to `count` quotes from distinct `bookId`s
  const pickDistinctBookQuotes = useCallback(
    (candidates: LiteraryQuote[], count: number = 3, initialSelected: LiteraryQuote[] = []) => {
      const selected: LiteraryQuote[] = [...initialSelected];
      const usedIds = new Set(selected.map((q) => q.id));
      const usedBookIds = new Set(selected.map((q) => q.bookId));

      for (const item of candidates) {
        if (selected.length >= count) break;
        if (!usedIds.has(item.id) && !usedBookIds.has(item.bookId)) {
          selected.push(item);
          usedIds.add(item.id);
          usedBookIds.add(item.bookId);
        }
      }

      for (const item of candidates) {
        if (selected.length >= count) break;
        if (!usedIds.has(item.id)) {
          selected.push(item);
          usedIds.add(item.id);
        }
      }

      return selected;
    },
    []
  );

  // User-selected shuffled quotes (null when using default anthology selection)
  const [shuffledQuotes, setShuffledQuotes] = useState<LiteraryQuote[] | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const shuffleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Compute deterministic hourly default quotes across 3 distinct books
  const defaultHourlyQuotes = useMemo(() => {
    return selectHourlyLiteraryQuotes(safeQuotes, hourlyIndex, 3);
  }, [safeQuotes, hourlyIndex]);

  // Synchronously compute displayed quotes across 3 distinct books, strictly enforcing active jurisdiction safety
  const displayedQuotes = useMemo(() => {
    if (shuffledQuotes && shuffledQuotes.length === 3) {
      const safeIds = new Set(safeQuotes.map((q) => q.id));
      const allowed = shuffledQuotes.filter((q) => safeIds.has(q.id));
      if (allowed.length === 3) return allowed;
    }
    return defaultHourlyQuotes.length >= 3
      ? defaultHourlyQuotes
      : pickDistinctBookQuotes(safeQuotes, 3);
  }, [safeQuotes, shuffledQuotes, defaultHourlyQuotes, pickDistinctBookQuotes]);

  useEffect(() => {
    return () => {
      if (shuffleTimerRef.current) {
        clearTimeout(shuffleTimerRef.current);
      }
    };
  }, []);

  const handleShuffle = useCallback(() => {
    setIsShuffling(true);
    const shuffleArray = <T,>(items: T[]): T[] => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const currentIds = new Set(displayedQuotes.map((q) => q.id));
    const currentBookIds = new Set(displayedQuotes.map((q) => q.bookId));
    const quotesByBook = new Map<number, LiteraryQuote[]>();

    for (const q of safeQuotes) {
      if (currentIds.has(q.id)) continue;
      const list = quotesByBook.get(q.bookId);
      if (list) {
        list.push(q);
      } else {
        quotesByBook.set(q.bookId, [q]);
      }
    }

    const unseenBookQuotes: LiteraryQuote[] = [];
    const fallbackBookQuotes: LiteraryQuote[] = [];

    for (const [bookId, bookQuotes] of quotesByBook.entries()) {
      const randomPassage = bookQuotes[Math.floor(Math.random() * bookQuotes.length)];
      if (!currentBookIds.has(bookId)) {
        unseenBookQuotes.push(randomPassage);
      } else {
        fallbackBookQuotes.push(randomPassage);
      }
    }

    const prioritizedPool = [
      ...shuffleArray(unseenBookQuotes),
      ...shuffleArray(fallbackBookQuotes),
      ...shuffleArray(safeQuotes),
    ];
    setShuffledQuotes(pickDistinctBookQuotes(prioritizedPool, 3));

    if (shuffleTimerRef.current) {
      clearTimeout(shuffleTimerRef.current);
    }
    shuffleTimerRef.current = setTimeout(() => setIsShuffling(false), 300);
  }, [displayedQuotes, safeQuotes, pickDistinctBookQuotes]);

  return (
    <section className="bg-muted pt-6 sm:pt-8 pb-10 sm:pb-16 border-t border-border transition-colors duration-theme">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
        {/* Section Heading & Interactive Shuffle Trigger */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 sm:pb-8 border-b border-border">
          <div className="text-center sm:text-left space-y-2 max-w-2xl min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-widest uppercase text-primary font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              TIMELESS VOICES & PASSAGES
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-foreground tracking-tight text-balance">
              Words That Shaped Humanity
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-serif italic text-pretty">
              Iconic quotes and opening lines from public domain masterworks. Click any passage to read the unabridged volume.
            </p>
          </div>

          <button
            type="button"
            onClick={handleShuffle}
            disabled={!isPoolSettled}
            className={`shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[38px] sm:min-h-[36px] rounded-lg border border-border bg-card text-foreground hover:text-primary hover:border-primary text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 ${
              isShuffling ? 'opacity-60 scale-95' : ''
            }`}
            aria-label="Discover more literary quotes"
          >
            <Shuffle className={`w-3.5 h-3.5 ${isShuffling ? 'animate-spin' : ''}`} />
            <span>Discover More</span>
          </button>
        </div>

        {/* Passages Grid: Single Card on Mobile (<640px), 3-Column on Desktop (>=1024px) */}
        <div
          data-testid="literary-quotes-grid"
          aria-busy={!isPoolSettled}
          className={`grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 ${
            isPoolSettled ? 'animate-ink-appear' : 'opacity-0'
          }`}
        >
          {displayedQuotes.map((item, index) => (
            <Link
              key={item.id}
              href={ROUTES.READ(item.bookId)}
              className={`group relative flex-col justify-between p-5 sm:p-8 rounded-xl bg-card border border-border shadow-booksaw hover:shadow-booksaw-hover hover:-translate-y-1.5 transition-all duration-300 cursor-pointer h-full ${
                index > 0 ? 'hidden sm:flex' : 'flex'
              }`}
              data-testid={`quote-card-${item.id}`}
              aria-label={`Read ${item.bookTitle} by ${item.author}`}
            >
              {/* Top Section: Category Kicker & Quote Passage (Grows vertically to push bottom info down) */}
              <div className="flex-1 flex flex-col space-y-5 mb-6">
                {/* Category & Era Kicker */}
                <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-muted-foreground pb-3 border-b border-border">
                  <span className="text-primary font-bold flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    {item.category}
                  </span>
                  <span>{item.year}</span>
                </div>

                {/* Decorative Quote Icon & Passage */}
                <div className="relative flex-1">
                  <Quote className="w-8 h-8 text-primary/20 absolute -top-3 -left-2 -z-0" />
                  <p className="relative z-10 font-serif italic text-base sm:text-lg text-foreground leading-relaxed transition-colors indent-7 sm:indent-8 text-pretty">
                    &ldquo;{item.quote}&rdquo;
                  </p>
                </div>
              </div>

              {/* Bottom Section: Citation, Author Attribution & Read Prompt (Permanently aligned at the bottom across all cards) */}
              <div className="pt-4 border-t border-border space-y-4">
                <div>
                  <div className="font-serif font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    {item.author}
                  </div>
                  <div className="text-xs text-muted-foreground font-serif italic">
                    {item.bookTitle}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                    {item.citation}
                  </div>
                </div>

                {/* Read Action Prompt */}
                <div className="pt-3 border-t border-border flex items-center justify-between text-xs font-mono text-primary font-bold">
                  <span>Read Full Volume</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

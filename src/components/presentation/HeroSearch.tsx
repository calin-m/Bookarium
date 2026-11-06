'use client';

import React, { useState, useEffect, useRef, useMemo, useSyncExternalStore } from 'react';
import {
  Search,
  X,
  ShieldCheck,
  Zap,
  Download,
  Library,
  Compass,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { HERO_POPULAR_TOPICS } from '@/config/catalog-filters';
import {
  gutendexBookToFeaturedHeroBook,
  selectHourlyHeroFromPool,
  type FeaturedHeroBook,
} from '@/config/featured-books';
import type { GutendexBook } from '@/types/book.types';
import { useJurisdiction } from '@/stores/useJurisdictionStore';
import { useQuoteEnrichedBooks } from '@/hooks/queries/useBooks';
import { LanguageSelector } from './LanguageSelector';
import { HeroFeaturedBook3D } from './HeroFeaturedBook3D';
import { attachHorizontalDragAndWheelScroll } from '@/lib/scroll-utils';

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

export interface HeroSearchProps {
  search?: string;
  onSearchChange?: (query: string) => void;
  onSearch?: (query: string) => void;
  selectedTopic?: string;
  onTopicChange?: (topic: string) => void;
  onTopicSelect?: (topic: string) => void;
  selectedLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  onReadFeaturedBook?: (book?: FeaturedHeroBook | GutendexBook) => void;
  featuredBook?: GutendexBook | FeaturedHeroBook;
  books?: GutendexBook[];
}

const FEATURES = [
  {
    icon: ShieldCheck,
    title: '100% Public Domain',
    desc: 'Pure Zero-Copyright (CC0) works.',
  },
  {
    icon: Zap,
    title: 'Zero Setup or Keys',
    desc: 'No accounts, paywalls, or tokens.',
  },
  {
    icon: Download,
    title: 'Multi-Format Downloads',
    desc: 'Direct EPUB, Kindle MOBI, & Text.',
  },
  {
    icon: Library,
    title: 'Offline Reading Shelf',
    desc: 'Local browser storage & progress.',
  },
];

const subscribeReducedMotion = (callback: () => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  try {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    mq.addEventListener?.('change', callback);
    return () => mq.removeEventListener?.('change', callback);
  } catch {
    return () => {};
  }
};

const getReducedMotionSnapshot = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const getReducedMotionServerSnapshot = () => false;

export interface HeroFeatureTypewriterProps {
  features?: typeof FEATURES;
  testId?: string;
}

export const HeroFeatureTypewriter: React.FC<HeroFeatureTypewriterProps> = ({
  features = FEATURES,
  testId = 'hero-feature-typewriter',
}) => {
  const activeFeatures = features && features.length > 0 ? features : FEATURES;
  const [featureIdx, setFeatureIdx] = useState(0);
  const [titleChars, setTitleChars] = useState(activeFeatures[0].title.length);
  const [descChars, setDescChars] = useState(activeFeatures[0].desc.length);
  const [phase, setPhase] = useState<
    'paused' | 'deleting_desc' | 'deleting_title' | 'paused_empty' | 'typing_title' | 'typing_desc'
  >('paused');
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  const currentFeature = activeFeatures[featureIdx % activeFeatures.length];
  const Icon = currentFeature.icon;

  useEffect(() => {
    if (prefersReducedMotion) {
      const timer = setTimeout(() => {
        setFeatureIdx((prev) => (prev + 1) % activeFeatures.length);
      }, 5000);
      return () => clearTimeout(timer);
    }

    let timer: NodeJS.Timeout;

    if (phase === 'paused') {
      timer = setTimeout(() => {
        setPhase('deleting_desc');
      }, 3500);
    } else if (phase === 'deleting_desc') {
      timer = setTimeout(() => {
        if (descChars > 1) {
          setDescChars((prev) => prev - 1);
        } else {
          setDescChars(0);
          setPhase('deleting_title');
        }
      }, 18);
    } else if (phase === 'deleting_title') {
      timer = setTimeout(() => {
        if (titleChars > 1) {
          setTitleChars((prev) => prev - 1);
        } else {
          setTitleChars(0);
          setPhase('paused_empty');
        }
      }, 22);
    } else if (phase === 'paused_empty') {
      timer = setTimeout(() => {
        setFeatureIdx((prev) => (prev + 1) % activeFeatures.length);
        setPhase('typing_title');
      }, 200);
    } else if (phase === 'typing_title') {
      const targetLen = currentFeature.title.length;
      timer = setTimeout(() => {
        if (titleChars < targetLen) {
          setTitleChars((prev) => prev + 1);
        } else {
          setPhase('typing_desc');
        }
      }, 38);
    } else if (phase === 'typing_desc') {
      const targetLen = currentFeature.desc.length;
      timer = setTimeout(() => {
        if (descChars < targetLen) {
          setDescChars((prev) => prev + 1);
        } else {
          setPhase('paused');
        }
      }, 26);
    }

    return () => clearTimeout(timer);
  }, [phase, descChars, titleChars, currentFeature, activeFeatures.length, prefersReducedMotion]);

  const displayTitle = prefersReducedMotion ? currentFeature.title : currentFeature.title.slice(0, titleChars);
  const displayDesc = prefersReducedMotion ? currentFeature.desc : currentFeature.desc.slice(0, descChars);

  return (
    <div
      data-testid={testId}
      className="relative flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl bg-card border border-border shadow-xs h-[72px] sm:h-[76px] overflow-hidden"
    >
      <div className="w-9 h-9 rounded-lg bg-muted text-primary flex items-center justify-center shrink-0 border border-border transition-all duration-300">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <h4 className="text-xs font-serif font-bold text-foreground flex items-center h-[18px] leading-[18px] truncate">
          <span>{displayTitle}</span>
          {(phase === 'typing_title' || phase === 'deleting_title') && (
            <span className="inline-block w-[2px] h-3 bg-primary ml-1 shrink-0 animate-pulse" aria-hidden="true" />
          )}
        </h4>
        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center h-[16px] leading-[16px] truncate">
          <span>{displayDesc}</span>
          {(phase === 'typing_desc' || phase === 'deleting_desc' || phase === 'paused') && (
            <span className="inline-block w-[1.5px] h-2.5 bg-primary/70 ml-0.5 shrink-0 animate-pulse" aria-hidden="true" />
          )}
        </p>
      </div>
    </div>
  );
};

export const HeroSearch: React.FC<HeroSearchProps> = ({
  search = '',
  onSearchChange,
  onSearch,
  selectedTopic = '',
  onTopicChange,
  onTopicSelect,
  selectedLanguage = '',
  onLanguageChange,
  onReadFeaturedBook,
  featuredBook,
  books,
}) => {
  const [prevSearch, setPrevSearch] = useState(search);
  const [query, setQuery] = useState(search);
  const [searchError, setSearchError] = useState<string | null>(null);
  const { country } = useJurisdiction();
  const { data: quoteEnrichedBooks } = useQuoteEnrichedBooks();
  const topicsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = topicsRef.current;
    if (!el) return;
    return attachHorizontalDragAndWheelScroll(el);
  }, []);

  if (search !== prevSearch) {
    setPrevSearch(search);
    setQuery(search);
    setSearchError(null);
  }

  // Deterministic hourly rotation: the Featured Book changes every hour (3,600,000 ms)
  const hourlyIndex = useSyncExternalStore(subscribeHourly, getHourlySnapshot, getHourlyServerSnapshot);

  // Decoupled editorial spotlight: rotates strictly on an hourly basis by jurisdiction,
  // independent of catalog discovery filters (topic and language)
  const selectionKey = `${hourlyIndex}|${country}`;
  const [lockedPoolSelection, setLockedPoolSelection] = useState<{
    key: string;
    bookId: number;
  } | null>(null);

  const hasEnrichedPool = Boolean(quoteEnrichedBooks && quoteEnrichedBooks.length > 0);
  if (
    hasEnrichedPool &&
    !featuredBook &&
    (!books || books.length === 0) &&
    lockedPoolSelection?.key !== selectionKey
  ) {
    const resolved = selectHourlyHeroFromPool(
      quoteEnrichedBooks,
      hourlyIndex * 1000 * 60 * 60,
      country
    );
    setLockedPoolSelection({ key: selectionKey, bookId: resolved.id });
  }

  // Stable active Featured Book: selects from the full database pool of books with quotes when available
  const activeFeatured: FeaturedHeroBook & { rawBook?: GutendexBook } = useMemo(() => {
    const dbBooksById = new Map<number, GutendexBook>(
      (quoteEnrichedBooks || []).map((b) => [b.id, b])
    );

    const toHeroWithRawBook = (b: FeaturedHeroBook): FeaturedHeroBook & { rawBook: GutendexBook } => {
      const dbMatch = dbBooksById.get(b.id);
      if (dbMatch && Array.isArray(dbMatch.quotes) && dbMatch.quotes.length > 0) {
        return gutendexBookToFeaturedHeroBook(dbMatch);
      }
      return {
        ...b,
        rawBook: ({
          id: b.id,
          title: b.title,
          authors: [
            {
              name: b.author,
              birth_year: b.authorBirthYear ?? null,
              death_year: b.authorDeathYear ?? null,
            },
          ],
          translators: b.translators || [],
          subjects: [b.primarySubject],
          languages: ['en'],
          formats: {},
          download_count: 50000,
          quotes: b.quotes,
        } as GutendexBook),
      };
    };

    const targetCustom = featuredBook || (books && books.length > 0 ? books[0] : null);
    if (targetCustom) {
      if ('rawBook' in targetCustom && targetCustom.rawBook) {
        return targetCustom as FeaturedHeroBook & { rawBook?: GutendexBook };
      }
      if ('authors' in targetCustom) {
        return gutendexBookToFeaturedHeroBook(targetCustom as GutendexBook);
      }
      return toHeroWithRawBook(targetCustom as FeaturedHeroBook);
    }

    if (lockedPoolSelection?.key === selectionKey) {
      const lockedMatch = dbBooksById.get(lockedPoolSelection.bookId);
      if (lockedMatch && Array.isArray(lockedMatch.quotes) && lockedMatch.quotes.length > 0) {
        return gutendexBookToFeaturedHeroBook(lockedMatch);
      }
    }

    return selectHourlyHeroFromPool(
      quoteEnrichedBooks,
      hourlyIndex * 1000 * 60 * 60,
      country
    );
  }, [
    featuredBook,
    books,
    hourlyIndex,
    country,
    quoteEnrichedBooks,
    lockedPoolSelection,
    selectionKey,
  ]);

  const emitSearch = (val: string) => {
    setSearchError(null);
    onSearch?.(val);
    onSearchChange?.(val);
  };

  const handleInputChange = (val: string) => {
    setQuery(val);
    if (searchError && (val.trim().length === 0 || val.trim().length >= 2)) {
      setSearchError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = query.trim().replace(/\s+/g, ' ');

    if (normalized.length === 1) {
      setSearchError('Please enter at least 2 characters to search.');
      return;
    }

    emitSearch(normalized);
  };

  const handleClear = () => {
    setQuery('');
    emitSearch('');
  };

  const handleTopicClick = (topicId: string) => {
    const nextTopic = selectedTopic.toLowerCase() === topicId ? '' : topicId;
    onTopicChange?.(nextTopic);
    onTopicSelect?.(nextTopic);
  };

  return (
    <section className="relative overflow-hidden bg-muted min-h-[460px] sm:min-h-[calc(100dvh-7.6875rem)] flex flex-col justify-between pt-6 sm:pt-8 pb-6 sm:pb-8 border-b border-border transition-colors duration-theme">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full flex-1 flex flex-col justify-between gap-6 sm:gap-8">
        
        {/* Booksaw Asymmetric Hero Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center my-auto">
          
          {/* Left Column (Editorial Typography + Search + Language) */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {/* Category Kicker */}
            <div className="text-[11px] font-mono tracking-widest uppercase text-muted-foreground font-semibold flex items-center gap-2.5">
              <span className="w-8 h-[1.5px] bg-primary" />
              <span>THE PUBLIC DOMAIN ATHENAEUM • 70,000+ VOLUMES</span>
            </div>

            {/* Classical Serif Headline */}
            <div className="space-y-1">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-foreground tracking-tight leading-[1.08] text-balance">
                Timeless Literature.
              </h1>
              <div className="text-4xl sm:text-5xl md:text-6xl font-serif italic text-primary tracking-normal leading-[1.08] text-balance">
                Free Forever.
              </div>
            </div>

            {/* Description */}
            <p className="text-muted-foreground text-sm sm:text-base w-full font-sans leading-relaxed text-pretty">
              Explore humanity&apos;s greatest public domain books. Zero subscriptions, zero DRM restrictions, readable directly in your browser or downloaded in full format.
            </p>

            {/* Booksaw Spotlight Search Input */}
            <form onSubmit={handleSubmit} className="relative w-full pt-1">
              <div className="relative flex items-center">
                <div className="absolute left-4 pointer-events-none flex items-center justify-center text-muted-foreground">
                  <Search className="w-4 h-4" aria-hidden="true" />
                </div>

                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Search 70,000+ books by title or author..."
                  className={`w-full h-12 pl-11 ${
                    query ? 'pr-32' : 'pr-24 sm:pr-28'
                  } text-xs sm:text-sm font-sans rounded-xl bg-card border shadow-booksaw hover:border-primary/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground placeholder:truncate transition-all duration-150 ${
                    searchError
                      ? 'border-destructive focus:border-destructive focus:ring-destructive'
                      : 'border-border'
                  }`}
                  data-testid="search-input"
                  aria-invalid={Boolean(searchError)}
                  aria-describedby={searchError ? 'search-validation-error' : undefined}
                />

                <div className="absolute right-2 flex items-center gap-1.5">
                  {query && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <Button
                    type="submit"
                    size="sm"
                    className="px-5 py-2 font-mono text-xs uppercase tracking-wider rounded-lg bg-foreground hover:opacity-90 text-background font-bold shrink-0"
                  >
                    Search
                  </Button>
                </div>
              </div>
              {searchError && (
                <p
                  id="search-validation-error"
                  role="alert"
                  className="mt-1.5 text-xs font-mono text-destructive text-left animate-in fade-in duration-200"
                >
                  {searchError}
                </p>
              )}
            </form>

            {/* Genre Quick Links & Language Selector */}
            <div className="space-y-3 pt-2">
              <div
                ref={topicsRef}
                data-no-swipe
                className="flex overflow-x-auto no-scrollbar scroll-smooth lg:flex-wrap items-center gap-1.5 -mx-4 px-4 sm:mx-0 sm:px-0 py-1 select-none"
                data-testid="hero-topics-container"
              >
                <span className="text-[11px] font-mono uppercase text-muted-foreground mr-1 select-none flex items-center gap-1 shrink-0">
                  <Compass className="w-3 h-3 text-primary" /> Explore Topics:
                </span>
                {HERO_POPULAR_TOPICS.map((topic) => {
                  const isSelected = selectedTopic.toLowerCase() === topic.id;
                  return (
                    <button
                      key={topic.id || 'all'}
                      type="button"
                      onClick={() => handleTopicClick(topic.id)}
                      data-testid={`topic-chip-${topic.id || 'all'}`}
                      className={`px-3 py-1 text-xs font-mono font-medium rounded border transition-colors shrink-0 ${
                        isSelected
                          ? 'bg-foreground text-background border-foreground shadow-xs'
                          : 'bg-card border-border text-foreground hover:border-primary'
                      }`}
                    >
                      {topic.label}
                    </button>
                  );
                })}
              </div>

              {/* Language Selector */}
              <LanguageSelector
                variant="compact"
                value={selectedLanguage}
                onChange={onLanguageChange}
                dataTestId="language-select"
              />
            </div>
          </div>

          {/* Right Column: Booksaw Standing 3D Book Spotlight with Realistic 3D Opening Physics */}
          <div className="lg:col-span-5 flex justify-center 2xl:justify-end">
            <HeroFeaturedBook3D
              featuredBook={activeFeatured}
              onReadFeaturedBook={onReadFeaturedBook}
              isQuoteDataReady={true}
            />
          </div>

        </div>

        {/* Booksaw 4-Pillar Value Proposition Strip (Widescreen Desktop >= 1280px: Single Horizontal Row of 4) */}
        <div className="hidden xl:grid xl:grid-cols-4 gap-3.5 pt-6 border-t border-border mt-auto">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="flex items-start gap-3.5 p-4 rounded-xl bg-card border border-border shadow-xs"
              >
                <div className="w-9 h-9 rounded-lg bg-muted text-primary flex items-center justify-center shrink-0 border border-border">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-serif font-bold text-foreground">
                    {feature.title}
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">
                    {feature.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Booksaw Paired 2-Card Typewriter Ticker (Intermediate 640px – 1279px: 2 Columns with Generous Single-Line Width) */}
        <div className="hidden sm:grid sm:grid-cols-2 xl:hidden gap-3.5 pt-4 sm:pt-6 border-t border-border mt-auto">
          <HeroFeatureTypewriter features={FEATURES.slice(0, 2)} testId="hero-feature-typewriter-left" />
          <HeroFeatureTypewriter features={FEATURES.slice(2, 4)} testId="hero-feature-typewriter-right" />
        </div>

        {/* Booksaw Single-Card Typewriter Ticker (Mobile Viewports < 640px: 1 Full-Width Rotating Card) */}
        <div className="block sm:hidden pt-4 border-t border-border mt-auto">
          <HeroFeatureTypewriter features={FEATURES} testId="hero-feature-typewriter" />
        </div>

        {/* Accessible sr-only list for screen readers and search engines */}
        <div className="sr-only">
          <ul>
            {FEATURES.map((f) => (
              <li key={f.title}>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </section>
  );
};

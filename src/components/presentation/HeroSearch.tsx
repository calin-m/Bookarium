'use client';

import React, { useState, useEffect, useRef, useMemo, useSyncExternalStore } from 'react';
import { useHasMounted } from '@/hooks/useHasMounted';

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
  return 0;
};
import {
  Search,
  X,
  ShieldCheck,
  Zap,
  Download,
  Bookmark,
  Sparkles,
  RotateCw,
  Quote,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { HERO_POPULAR_TOPICS } from '@/config/catalog-filters';
import { getBookPassages, type BookPassage, FEATURED_HERO_BOOKS, type FeaturedHeroBook } from '@/config/featured-books';
import { extractDynamicBookPassages } from '@/lib/gutenberg-parser';
import { useBookContent } from '@/hooks/queries/useBookContent';
import type { GutendexBook } from '@/mocks/handlers';
import { formatAuthorNames, formatPrimarySubject } from '@/lib/utils';
import { LanguageSelector } from './LanguageSelector';

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
    icon: Bookmark,
    title: 'Offline Reading Shelf',
    desc: 'Local browser storage & progress.',
  },
];

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
  const [activePassageIndex, setActivePassageIndex] = useState(0);
  const [prevPassageIndex, setPrevPassageIndex] = useState(0);
  const [isTurningLeaf, setIsTurningLeaf] = useState(false);
  const [pinState, setPinState] = useState<'auto' | 'open' | 'closed'>('auto');
  const hasMounted = useHasMounted();
  const [isHovered, setIsHovered] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  if (search !== prevSearch) {
    setPrevSearch(search);
    setQuery(search);
  }

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Deterministic hourly rotation: the Featured Book changes every hour (3,600,000 ms)
  const hourlyIndex = useSyncExternalStore(subscribeHourly, getHourlySnapshot, getHourlyServerSnapshot);

  // Stable active Featured Book: anchored deterministically by hour to prevent flash-on-refresh
  const activeFeatured: FeaturedHeroBook & { rawBook?: GutendexBook } = useMemo(() => {
    const targetCustom = featuredBook || (books && books.length > 0 ? books[0] : null);
    if (targetCustom) {
      if ('rawBook' in targetCustom && targetCustom.rawBook) {
        return targetCustom as FeaturedHeroBook & { rawBook?: GutendexBook };
      }
      if ('authors' in targetCustom) {
        const b = targetCustom as GutendexBook;
        const authorName = formatAuthorNames(b.authors) || 'Anonymous';
        const subject = formatPrimarySubject(b.subjects);

        return {
          id: b.id,
          title: b.title,
          author: authorName,
          year: 'Public Domain',
          primarySubject: subject,
          license: 'CC0 / Free',
          volumeNumber: `Vol. #${b.id}`,
          quoteExcerpt: 'Preserved in the public domain for all readers.',
          openingLine: 'Preserved in the public domain for all readers.',
          rawBook: b,
        };
      }
      const fh = targetCustom as FeaturedHeroBook;
      return {
        ...fh,
        rawBook: {
          id: fh.id,
          title: fh.title,
          authors: [{ name: fh.author }],
          subjects: [fh.primarySubject],
          languages: ['en'],
          formats: {},
          download_count: 50000,
        } as GutendexBook,
      };
    }

    const idx = hasMounted ? (hourlyIndex % FEATURED_HERO_BOOKS.length) : 0;
    const b = FEATURED_HERO_BOOKS[idx] || FEATURED_HERO_BOOKS[0];
    return {
      ...b,
      rawBook: {
        id: b.id,
        title: b.title,
        authors: [{ name: b.author }],
        subjects: [b.primarySubject],
        languages: ['en'],
        formats: {},
        download_count: 50000,
      } as GutendexBook,
    };
  }, [featuredBook, books, hourlyIndex, hasMounted]);

  // On-demand fetch of full text for the active Featured Book to dynamically extract authentic quotes
  const { data: rawBookText } = useBookContent(undefined, activeFeatured.id);

  const curatedPassages = useMemo(() => {
    return getBookPassages({
      id: activeFeatured.id,
      title: activeFeatured.title,
      authors: activeFeatured.rawBook?.authors || [{ name: activeFeatured.author }],
      subjects: activeFeatured.rawBook?.subjects || [activeFeatured.primarySubject],
    });
  }, [activeFeatured]);

  const dynamicPassages = useMemo(() => {
    if (rawBookText) {
      return extractDynamicBookPassages(rawBookText, {
        id: activeFeatured.id,
        title: activeFeatured.title,
        authors: activeFeatured.rawBook?.authors || [{ name: activeFeatured.author }],
        subjects: activeFeatured.rawBook?.subjects || [activeFeatured.primarySubject],
      });
    }
    return [];
  }, [rawBookText, activeFeatured]);

  // Keep index 0 locked to curated incipit so text never jumps unexpectedly,
  // while supplying dynamic multi-chapter passages for in-book shuffling
  const passages: BookPassage[] = useMemo(() => {
    const baseFirst = curatedPassages[0] || dynamicPassages[0];
    if (!baseFirst) return [];
    if (dynamicPassages.length > 1) {
      return [baseFirst, ...dynamicPassages.slice(1)];
    }
    return curatedPassages.length > 0 ? curatedPassages : [baseFirst];
  }, [curatedPassages, dynamicPassages]);

  const currentPassage = passages[activePassageIndex] || {
    chapterLabel: 'Chapter I',
    openingLine: 'Preserved in the public domain for all readers.',
    quoteExcerpt: 'A timeless literary classic.',
  };

  const prevPassage = passages[prevPassageIndex] || currentPassage;

  // Shuffling rotates through passages and chapters within this specific open book
  const handleNextPassage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTurningLeaf || passages.length <= 1) return;
    setPrevPassageIndex(activePassageIndex);
    setActivePassageIndex((prev) => (prev + 1) % passages.length);
    setIsTurningLeaf(true);
  };

  const isBookOpen = pinState === 'open' || (pinState === 'auto' && isHovered);

  const handleBookClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }
    e.stopPropagation();
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      return;
    }
    if (isBookOpen) {
      setPinState('closed');
    } else {
      setPinState('open');
    }
  };

  const handleMouseEnter = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return;
    setIsHovered(true);
    if (pinState === 'closed') {
      setPinState('auto');
    }
  };

  const handleMouseLeave = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return;
    setIsHovered(false);
    if (pinState === 'closed') {
      setPinState('auto');
    }
  };

  const handleInputChange = (val: string) => {
    setQuery(val);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      if (onSearchChange) onSearchChange(val);
    }, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (onSearch) onSearch(query);
    if (onSearchChange) onSearchChange(query);
  };

  const handleClear = () => {
    setQuery('');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (onSearchChange) onSearchChange('');
    if (onSearch) onSearch('');
  };

  const handleTopicClick = (topicId: string) => {
    const nextTopic = selectedTopic.toLowerCase() === topicId ? '' : topicId;
    if (onTopicChange) onTopicChange(nextTopic);
    if (onTopicSelect) onTopicSelect(nextTopic);
  };

  return (
    <section className="relative overflow-hidden bg-muted lg:min-h-[calc(100vh-7.25rem)] flex flex-col justify-between pt-6 sm:pt-8 pb-6 sm:pb-8 border-b border-border transition-colors duration-theme">
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
            <p className="text-muted-foreground text-sm sm:text-base max-w-lg font-sans leading-relaxed text-pretty">
              Explore humanity&apos;s greatest public domain books. Zero subscriptions, zero DRM restrictions, readable directly in your browser or downloaded in full format.
            </p>

            {/* Booksaw Spotlight Search Input */}
            <form onSubmit={handleSubmit} className="relative max-w-xl pt-1">
              <div className="relative flex items-center shadow-booksaw rounded-lg overflow-hidden border border-border bg-card focus-within:ring-2 focus-within:ring-primary/40 transition-all">
                <Search className="w-4 h-4 text-muted-foreground ml-4 shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Search 70,000+ classics by title or author (e.g. Austen, Plato)..."
                  className="w-full py-3.5 pl-3 pr-10 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden"
                  data-testid="search-input"
                />
                {query && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1.5 mr-2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  className="mr-2 px-6 py-2.5 font-mono text-xs uppercase tracking-wider rounded bg-foreground hover:opacity-90 text-background font-bold"
                >
                  Search
                </Button>
              </div>
            </form>

            {/* Genre Quick Links & Language Selector */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-mono uppercase text-muted-foreground mr-1 select-none flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary" /> Curated:
                </span>
                {HERO_POPULAR_TOPICS.map((topic) => {
                  const isSelected = selectedTopic.toLowerCase() === topic.id;
                  return (
                    <button
                      key={topic.id || 'all'}
                      type="button"
                      onClick={() => handleTopicClick(topic.id)}
                      data-testid={`topic-chip-${topic.id || 'all'}`}
                      className={`px-3 py-1 text-xs font-mono rounded border transition-all ${
                        isSelected
                          ? 'bg-foreground text-background border-foreground font-bold shadow-xs'
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
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div
              className={`relative group cursor-pointer book-3d-stage hero-3d-stage ${
                pinState === 'open' ? 'book-open' : pinState === 'closed' ? 'book-closed' : ''
              }`}
              onClick={handleBookClick}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                    return;
                  }
                  if (isBookOpen) {
                    setPinState('closed');
                  } else {
                    setPinState('open');
                  }
                }
              }}
              aria-label={isBookOpen ? "Click to close volume" : "Click to pin open volume"}
            >
              <div className="book-3d-rig relative">
                
                {/* Desktop Open Book Spread Base (Right Page: straight left spine, rounded right outer edge) */}
                <div className="hidden lg:flex absolute inset-0 rounded-r-lg rounded-l-none open-book-page-right border border-border p-6 flex-col justify-between text-foreground z-0 overflow-hidden">
                  <div key={`right-page-base-${activeFeatured.id}-${activePassageIndex}`} className="animate-ink-appear flex flex-col justify-between h-full relative">
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-muted-foreground mb-3 pb-1 border-b border-border">
                        <span>{currentPassage.chapterLabel || 'Notable Passage'}</span>
                        <span className="opacity-60">p. 2</span>
                      </div>

                      <div className="p-3.5 rounded-lg bg-card/60 border border-border shadow-xs mb-2">
                        <Quote className="w-4 h-4 text-primary/60 mb-1.5 shrink-0" />
                        <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-8 text-pretty">
                          &ldquo;{currentPassage.quoteExcerpt}&rdquo;
                        </p>
                      </div>
                    </div>

                    {/* Right Page Footer Actions */}
                    <div className="pt-2.5 border-t border-border flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="chip"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNextPassage(e);
                        }}
                        title="Shuffle to Next Passage in this Book"
                        aria-label="Shuffle to Next Passage in this Book"
                        data-testid="hero-book-shuffle-btn"
                      >
                        <RotateCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                        <span>Shuffle</span>
                      </Button>

                      {onReadFeaturedBook && (
                        <Button
                          variant="primary"
                          size="chip"
                          onClick={(e) => {
                            e.stopPropagation();
                            onReadFeaturedBook(activeFeatured.rawBook || activeFeatured);
                          }}
                          aria-label="Read"
                          data-testid="hero-book-read-btn"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Read</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Physical 3D Turning Leaf (Flips Right to Left across the spine on shuffle: 0deg -> -180deg) */}
                {isTurningLeaf && (
                  <div
                    key={`turning-leaf-${activeFeatured.id}-${activePassageIndex}`}
                    className="hidden lg:block book-turning-leaf"
                    onAnimationEnd={() => setIsTurningLeaf(false)}
                  >
                    {/* Front Face of Turning Leaf: Outgoing Right Page quote lifting away */}
                    <div className="turning-leaf-face-front rounded-r-lg rounded-l-none open-book-page-right border border-border p-6 flex flex-col justify-between text-foreground overflow-hidden">
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-muted-foreground mb-3 pb-1 border-b border-border">
                          <span>{prevPassage.chapterLabel || 'Notable Passage'}</span>
                          <span className="opacity-60">p. 2</span>
                        </div>

                        <div className="p-3.5 rounded-lg bg-card/60 border border-border shadow-xs mb-2">
                          <Quote className="w-4 h-4 text-primary/60 mb-1.5 shrink-0" />
                          <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-8 text-pretty">
                            &ldquo;{prevPassage.quoteExcerpt}&rdquo;
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Back Face of Turning Leaf: Incoming Left Page title & quote landing onto left side */}
                    <div className="turning-leaf-face-back rounded-l-lg rounded-r-none open-book-page-left border border-border p-6 flex flex-col justify-between text-foreground overflow-hidden">
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-primary font-bold mb-2.5 pb-1 border-b border-border">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Public Domain
                          </span>
                          <span>{currentPassage.chapterLabel || activeFeatured.volumeNumber}</span>
                        </div>

                        <h3 className="text-xl sm:text-2xl font-serif font-bold leading-tight mb-1 text-foreground text-balance">
                          {activeFeatured.title}
                        </h3>
                        <p className="text-xs font-mono italic text-muted-foreground mb-2">
                          by {activeFeatured.author} ({activeFeatured.year})
                        </p>

                        <div className="relative pl-3 border-l-2 border-primary/40 my-2">
                          <p className="text-xs sm:text-[13px] font-serif italic text-foreground/90 leading-relaxed line-clamp-8 text-pretty">
                            &ldquo;{currentPassage.openingLine}&rdquo;
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-border">
                        <span className="truncate max-w-[160px]">{activeFeatured.primarySubject}</span>
                        <span className="opacity-60">p. 1</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3D Flipping Front Cover (Hinged on Left Spine) */}
                <div className="relative w-64 sm:w-72 md:w-80 aspect-[2/3] book-3d-flipper z-10">
                  
                  {/* FRONT FACE: Physical Hardcover Book (Closed State) */}
                  <div className="absolute inset-0 book-3d-face-front rounded-r-lg rounded-l-sm bg-gradient-to-r from-stone-900 via-stone-800 to-stone-950 p-6 flex flex-col justify-between text-white shadow-[25px_25px_50px_rgba(0,0,0,0.18),0_10px_20px_rgba(0,0,0,0.08)] border-r-2 border-stone-700 overflow-hidden">
                    {/* 3D Spine & Page Edge Accents */}
                    <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-black/40 via-black/20 to-transparent rounded-l-sm pointer-events-none" />
                    <div className="absolute right-0 top-1 bottom-1 w-2 bg-gradient-to-l from-white/30 to-transparent pointer-events-none" />

                    <div key={`front-face-content-${activeFeatured.id}-${activePassageIndex}`} className="animate-ink-appear flex flex-col justify-between h-full relative z-10">
                      {/* Header */}
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-primary-300 mb-3 pb-2 border-b border-white/10">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-primary-400" /> Featured Book
                          </span>
                          {/* Clean Volume Label */}
                          <span className="text-stone-400 font-mono tracking-widest text-[10px]">
                            {activeFeatured.volumeNumber}
                          </span>
                        </div>

                        <h3 className="text-2xl sm:text-3xl font-serif font-bold text-white leading-tight mb-1.5 text-balance">
                          {activeFeatured.title}
                        </h3>
                        <p className="text-xs font-mono uppercase tracking-wider text-stone-300">
                          {activeFeatured.author} • {activeFeatured.year}
                        </p>
                      </div>

                      {/* Center Quote Excerpt */}
                      <div className="my-3 p-3 rounded bg-stone-900 border border-stone-800">
                        <p className="text-xs font-serif italic text-stone-200 leading-relaxed line-clamp-4 text-pretty">
                          &ldquo;{currentPassage.quoteExcerpt}&rdquo;
                        </p>
                      </div>

                      {/* Footer */}
                      <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                          {activeFeatured.license}
                        </span>
                        {onReadFeaturedBook && (
                          <Button
                            variant="primary"
                            size="chip"
                            className="lg:hidden"
                            onClick={(e) => {
                              e.stopPropagation();
                              onReadFeaturedBook(activeFeatured.rawBook || activeFeatured);
                            }}
                            aria-label="Read"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Read</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* BACK FACE: Inside Left Page (Visible when rotated -180deg on desktop hover) */}
                  <div className="absolute inset-0 book-3d-face-back rounded-l-lg rounded-r-none open-book-page-left border border-border p-6 flex flex-col justify-between text-foreground overflow-hidden">
                    <div key={`left-page-content-${activeFeatured.id}-${isTurningLeaf ? prevPassageIndex : activePassageIndex}`} className="flex flex-col justify-between h-full relative">
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-primary font-bold mb-2.5 pb-1 border-b border-border">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Public Domain
                          </span>
                          <span>{(isTurningLeaf ? prevPassage : currentPassage).chapterLabel || activeFeatured.volumeNumber}</span>
                        </div>

                        <h3 className="text-xl sm:text-2xl font-serif font-bold leading-tight mb-1 text-foreground text-balance">
                          {activeFeatured.title}
                        </h3>
                        <p className="text-xs font-mono italic text-muted-foreground mb-2">
                          by {activeFeatured.author} ({activeFeatured.year})
                        </p>

                        <div className="relative pl-3 border-l-2 border-primary/40 my-2">
                          <p className="text-xs sm:text-[13px] font-serif italic text-foreground/90 leading-relaxed line-clamp-8 text-pretty">
                            &ldquo;{(isTurningLeaf ? prevPassage : currentPassage).openingLine}&rdquo;
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-border">
                        <span className="truncate max-w-[140px]">{activeFeatured.primarySubject}</span>
                        <span className="opacity-60">p. 1</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Ambient Floor Shadow - Closed State */}
                <div className={`absolute -bottom-4 left-6 right-6 h-6 bg-black/15 dark:bg-black/40 rounded-full blur-xl pointer-events-none transition-opacity duration-700 ${
                  pinState === 'open' ? 'opacity-0' : pinState === 'closed' ? 'opacity-100' : 'group-hover:opacity-0'
                }`} />
                {/* Ambient Floor Shadow - Open 2-Page Spread State */}
                <div className={`hidden lg:block absolute -bottom-6 -left-64 -right-8 h-8 bg-black/20 dark:bg-black/50 rounded-full blur-2xl pointer-events-none transition-opacity duration-700 ${
                  pinState === 'open' ? 'opacity-100' : pinState === 'closed' ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
                }`} />
              </div>
            </div>
          </div>

        </div>

        {/* Booksaw 4-Pillar Value Proposition Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-4 sm:pt-6 border-t border-border mt-auto">
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

      </div>
    </section>
  );
};

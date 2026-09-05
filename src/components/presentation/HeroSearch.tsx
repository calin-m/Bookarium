'use client';

import React, { useState, useMemo, useSyncExternalStore } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { HERO_POPULAR_TOPICS } from '@/config/catalog-filters';
import { FEATURED_HERO_BOOKS, type FeaturedHeroBook } from '@/config/featured-books';
import type { GutendexBook } from '@/types/book.types';
import { formatAuthorNames, formatPrimarySubject } from '@/lib/utils';
import { LanguageSelector } from './LanguageSelector';
import { HeroFeaturedBook3D } from './HeroFeaturedBook3D';

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
  const [searchError, setSearchError] = useState<string | null>(null);
  const hasMounted = useHasMounted();

  if (search !== prevSearch) {
    setPrevSearch(search);
    setQuery(search);
    setSearchError(null);
  }

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



  const handleInputChange = (val: string) => {
    setQuery(val);
    if (searchError && (val.trim().length === 0 || val.trim().length >= 2)) {
      setSearchError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = query.trim().replace(/\s+/g, ' ');

    if (normalized.length === 0) {
      setSearchError(null);
      if (onSearch) onSearch('');
      if (onSearchChange) onSearchChange('');
      return;
    }

    if (normalized.length === 1) {
      setSearchError('Please enter at least 2 characters to search.');
      return;
    }

    setSearchError(null);
    if (onSearch) onSearch(normalized);
    if (onSearchChange) onSearchChange(normalized);
  };

  const handleClear = () => {
    setQuery('');
    setSearchError(null);
    if (onSearch) onSearch('');
    if (onSearchChange) onSearchChange('');
  };

  const handleTopicClick = (topicId: string) => {
    const nextTopic = selectedTopic.toLowerCase() === topicId ? '' : topicId;
    if (onTopicChange) onTopicChange(nextTopic);
    if (onTopicSelect) onTopicSelect(nextTopic);
  };

  return (
    <section className="relative overflow-hidden bg-muted min-h-[460px] lg:min-h-[min(calc(100vh-7.25rem),780px)] flex flex-col justify-between pt-6 sm:pt-8 pb-6 sm:pb-8 border-b border-border transition-colors duration-theme">
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
              <div
                className={`relative flex items-center shadow-booksaw rounded-lg overflow-hidden border bg-card focus-within:ring-2 transition-all ${
                  searchError
                    ? 'border-destructive focus-within:ring-destructive/40'
                    : 'border-border focus-within:ring-primary/40'
                }`}
              >
                <Search className="w-4 h-4 text-muted-foreground ml-4 shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Search 70,000+ classics by title or author (e.g. Austen, Plato)..."
                  className="w-full py-3.5 pl-3 pr-10 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden"
                  data-testid="search-input"
                  aria-invalid={Boolean(searchError)}
                  aria-describedby={searchError ? 'search-validation-error' : undefined}
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
                  className="mr-2 px-6 py-2.5 font-mono text-xs uppercase tracking-wider rounded bg-foreground hover:opacity-90 text-background font-bold shrink-0"
                >
                  Search
                </Button>
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
          {/* Right Column: Booksaw Standing 3D Book Spotlight with Realistic 3D Opening Physics */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <HeroFeaturedBook3D
              featuredBook={activeFeatured}
              onReadFeaturedBook={onReadFeaturedBook}
            />
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

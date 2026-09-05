import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { Library, Heart, Highlighter, Layers, Bookmark, ArrowUpRight } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { LIBRARY_THEMES } from '@/config/library-tokens';

export interface AccountLibraryStatsProps {
  savedCount: number;
  favoriteCount: number;
  customShelvesCount: number;
  annotationCount?: number;
  bookmarksCount?: number;
}

interface LibraryCardConfig {
  id: string;
  name: string;
  label: string;
  ariaLabel: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  theme: (typeof LIBRARY_THEMES)[keyof typeof LIBRARY_THEMES];
  count: number;
  testId?: string;
}

export const AccountLibraryStats: React.FC<AccountLibraryStatsProps> = ({
  savedCount,
  favoriteCount,
  customShelvesCount,
  annotationCount = 0,
  bookmarksCount = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollActiveIndex, setScrollActiveIndex] = useState<number>(-1);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const activeIndex = hoveredIndex !== null ? hoveredIndex : scrollActiveIndex;

  const libraryCards: LibraryCardConfig[] = [
    {
      id: 'shelved',
      name: 'Shelved Volumes',
      label: 'Shelved Volumes',
      ariaLabel: 'View Shelved Volumes in Bookshelf',
      href: LIBRARY_THEMES.bookshelf.route,
      icon: Library,
      theme: LIBRARY_THEMES.bookshelf,
      count: savedCount,
    },
    {
      id: 'favorites',
      name: 'Favorite Titles',
      label: 'Favorite Titles',
      ariaLabel: 'View Favorite Titles in Favorites',
      href: LIBRARY_THEMES.favorites.route,
      icon: Heart,
      theme: LIBRARY_THEMES.favorites,
      count: favoriteCount,
    },
    {
      id: 'notebook',
      name: 'Notes & Quotes',
      label: 'Notes & Quotes',
      ariaLabel: 'View Saved Notes & Quotes in Notebook',
      href: LIBRARY_THEMES.notebook.route,
      icon: Highlighter,
      theme: LIBRARY_THEMES.notebook,
      count: annotationCount,
      testId: 'notes-quotes-count',
    },
    {
      id: 'customShelves',
      name: 'Custom Shelves',
      label: 'Custom Shelves',
      ariaLabel: 'View Custom Shelves in Bookshelf',
      href: LIBRARY_THEMES.customShelves.route,
      icon: Layers,
      theme: LIBRARY_THEMES.customShelves,
      count: customShelvesCount,
      testId: 'custom-shelves-count',
    },
    {
      id: 'bookmarks',
      name: 'Reading Bookmarks',
      label: 'Reading Bookmarks',
      ariaLabel: 'View Reading Bookmarks in Bookmarks',
      href: LIBRARY_THEMES.bookmarks.route,
      icon: Bookmark,
      theme: LIBRARY_THEMES.bookmarks,
      count: bookmarksCount,
      testId: 'bookmarks-count',
    },
  ];

  useEffect(() => {
    let ticking = false;

    const updateProgressStepper = () => {
      if (typeof window === 'undefined' || window.innerWidth >= 1024) {
        setScrollActiveIndex(-1);
        ticking = false;
        return;
      }

      const container = containerRef.current;
      if (!container) {
        ticking = false;
        return;
      }

      const rect = container.getBoundingClientRect();
      const vh = window.innerHeight || 800;

      // Generous focal band: starts when container top enters lower viewport (75% vh),
      // ends when container bottom leaves upper viewport (20% vh).
      const startTop = vh * 0.75;
      const endTop = vh * 0.2 - rect.height;
      const totalRange = startTop - endTop;

      if (totalRange <= 0 || rect.top > startTop || rect.top < endTop) {
        setScrollActiveIndex(-1);
        ticking = false;
        return;
      }

      // Calculate normalized 0 to 1 progress through the focal travel zone
      const progress = (startTop - rect.top) / totalRange;
      const slot = Math.floor(progress * 5);
      const clampedIndex = Math.min(4, Math.max(0, slot));

      setScrollActiveIndex(clampedIndex);
      ticking = false;
    };

    const handleScroll = () => {
      // Clear hover override when actively scrolling
      setHoveredIndex(null);
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(updateProgressStepper);
      }
    };

    const handleResize = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(updateProgressStepper);
      }
    };

    // Initial calculation
    updateProgressStepper();

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-booksaw space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground font-bold">
          Library
        </h2>
        <Link
          href={ROUTES.BOOKSHELF}
          className="text-xs font-mono text-primary hover:underline font-bold"
        >
          Open Bookshelf →
        </Link>
      </div>

      <div
        ref={containerRef}
        data-testid="account-library-stack"
        className="flex flex-col gap-2.5 sm:gap-3"
      >
        {libraryCards.map((card, idx) => {
          const isActive = idx === activeIndex;
          const IconComponent = card.icon;

          return (
            <Link
              key={card.id}
              href={card.href}
              data-active={isActive ? 'true' : 'false'}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`p-3 sm:p-3.5 rounded-xl border transition-all duration-150 flex items-center justify-between group block focus-visible:outline-hidden focus-visible:ring-2 ${card.theme.focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-background w-full ${
                isActive
                  ? `${card.theme.hoverBorder} max-lg:${card.theme.navActiveBorder} max-lg:bg-muted/60 max-lg:-translate-y-0.5 max-lg:shadow-xs border-border bg-muted/30 hover:bg-muted/60 hover:-translate-y-0.5 hover:shadow-xs`
                  : `${card.theme.hoverBorder} border-border bg-muted/30 hover:bg-muted/60 hover:-translate-y-0.5 hover:shadow-xs`
              }`}
              aria-label={card.ariaLabel}
            >
              <div className="flex items-center gap-2.5 text-muted-foreground text-xs font-mono">
                <IconComponent className={`w-3.5 h-3.5 ${card.theme.iconColor} shrink-0`} />
                <span
                  className={`truncate transition-colors font-medium ${
                    isActive ? 'max-lg:text-foreground group-hover:text-foreground' : 'group-hover:text-foreground'
                  }`}
                >
                  {card.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <p
                  {...(card.testId ? { 'data-testid': card.testId } : {})}
                  className="text-lg sm:text-xl font-mono font-bold text-foreground leading-none"
                >
                  {card.count}
                </p>
                <ArrowUpRight
                  className={`w-4 h-4 ${card.theme.arrowColor} transition-all duration-150 shrink-0 ${
                    isActive
                      ? 'opacity-0 max-lg:opacity-100 max-lg:translate-x-0.5 max-lg:-translate-y-0.5 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'
                      : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5'
                  }`}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};


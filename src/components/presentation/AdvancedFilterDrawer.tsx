'use client';

import React, { useEffect } from 'react';
import { X, Filter, RotateCcw, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  LITERARY_ERAS,
  SORT_OPTIONS,
  GENRE_FACETS,
  FORMAT_FILTERS,
} from '@/config/catalog-filters';
import { LanguageSelector } from './LanguageSelector';


export interface AdvancedFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEra: string;
  onEraChange: (era: string) => void;
  selectedSort: 'popular' | 'descending' | 'ascending' | '';
  onSortChange: (sort: 'popular' | 'descending' | 'ascending' | '') => void;
  selectedTopic: string;
  onTopicChange: (topic: string) => void;
  selectedLanguage: string;
  onLanguageChange: (lang: string) => void;
  selectedFormat: string;
  onFormatChange: (format: string) => void;
  onResetAll: () => void;
  activeFilterCount: number;
}

export const AdvancedFilterDrawer: React.FC<AdvancedFilterDrawerProps> = ({
  isOpen,
  onClose,
  selectedEra,
  onEraChange,
  selectedSort,
  onSortChange,
  selectedTopic,
  onTopicChange,
  selectedLanguage,
  onLanguageChange,
  selectedFormat,
  onFormatChange,
  onResetAll,
  activeFilterCount,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    // Lock body and html scrolling on mobile/tablet to prevent background scroll bleed
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;

    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 xl:top-16 xl:inset-y-0 xl:left-0 z-50 xl:z-30 flex flex-col justify-end xl:justify-start pointer-events-none animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="advanced-filter-title"
      data-testid="advanced-filter-drawer"
    >
      {/* Click-outside blurred backdrop on mobile, tablet & laptop (< xl) */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs pointer-events-auto xl:hidden transition-opacity touch-none"
        onClick={onClose}
        onTouchMove={(e) => e.preventDefault()}
        aria-hidden="true"
        data-testid="filter-backdrop"
      />

      <div className="relative w-full max-h-[88vh] xl:max-h-none xl:w-96 h-auto xl:h-[calc(100vh-4rem)] rounded-t-2xl xl:rounded-none bg-background text-foreground flex flex-col justify-between shadow-2xl border-t xl:border-t-0 xl:border-r border-border animate-in slide-in-from-bottom xl:slide-in-from-left duration-300 overflow-hidden pointer-events-auto z-10">
        
        {/* Mobile Grab Handle Bar */}
        <div className="w-12 h-1 rounded-full bg-muted-foreground/30 mx-auto mt-2.5 mb-1 shrink-0 xl:hidden" aria-hidden="true" />

        {/* Drawer Header */}
        <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between bg-background shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-border">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 id="advanced-filter-title" className="font-serif font-bold text-base sm:text-lg leading-tight text-foreground">
                Advanced Archive Filters
              </h3>
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                {activeFilterCount > 0 ? `${activeFilterCount} active filters` : 'Customize catalog query'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            aria-label="Close filters"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Filter Sections */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6">
          
          {/* Section 1: Literary Era / Century (Chip Cloud) */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Historical Literary Era
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {LITERARY_ERAS.map((era) => {
                const isSelected = selectedEra === era.id;
                return (
                  <button
                    key={era.id}
                    type="button"
                    onClick={() => onEraChange(era.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-sans flex items-center gap-1.5 border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-foreground text-background border-foreground font-bold shadow-xs'
                        : 'bg-card border-border text-foreground hover:border-primary'
                    }`}
                    data-testid={`era-option-${era.id || 'all'}`}
                  >
                    <span>{era.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Sort Order */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
              Sort Ordering
            </h4>
            <select
              value={selectedSort}
              onChange={(e) => onSortChange(e.target.value as 'popular' | 'descending' | 'ascending' | '')}
              className="w-full bg-card border border-border rounded-lg p-2.5 text-xs text-foreground focus:outline-hidden focus:border-primary cursor-pointer"
              data-testid="sort-select"
            >
              {SORT_OPTIONS.map((sort) => (
                <option key={sort.value} value={sort.value} className="bg-card text-foreground">
                  {sort.label}
                </option>
              ))}
            </select>
          </div>

          {/* Section 3: Genre & Subject Facet (Chip Cloud) */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
              Subject & Category
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {GENRE_FACETS.map((facet) => {
                const isSelected = selectedTopic.toLowerCase() === facet.id;
                return (
                  <button
                    key={facet.id}
                    type="button"
                    onClick={() => onTopicChange(facet.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-sans flex items-center gap-1.5 border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-foreground text-background border-foreground font-bold shadow-xs'
                        : 'bg-card border-border text-foreground hover:border-primary'
                    }`}
                    data-testid={`genre-facet-${facet.id || 'all'}`}
                  >
                    <span>{facet.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Catalog Languages */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
              Language
            </h4>
            <LanguageSelector
              variant="full"
              value={selectedLanguage}
              onChange={onLanguageChange}
              dataTestId="language-drawer-select"
            />
          </div>

          {/* Section 5: Format Availability */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
              Format Filter
            </h4>
            <select
              value={selectedFormat}
              onChange={(e) => onFormatChange(e.target.value)}
              className="w-full bg-card border border-border rounded-lg p-2.5 text-xs text-foreground focus:outline-hidden focus:border-primary cursor-pointer"
              data-testid="format-drawer-select"
            >
              {FORMAT_FILTERS.map((fmt) => (
                <option key={fmt.value} value={fmt.value} className="bg-card text-foreground">
                  {fmt.label}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Drawer Bottom Actions (Sticky Footer) */}
        <div className="p-4 sm:p-5 border-t border-border bg-card/95 backdrop-blur-xs flex items-center justify-between gap-3 shrink-0 sticky bottom-0 z-20">
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetAll}
            data-testid="reset-filters-btn"
            className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground gap-1.5"
            aria-label="Reset all filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onClose}
            data-testid="apply-filters-btn"
            className="px-6 py-2.5 text-xs font-mono uppercase tracking-wider font-bold rounded-lg bg-primary hover:opacity-90 text-primary-foreground shadow-xs"
            aria-label="Apply filters"
          >
            Show Results
          </Button>
        </div>

      </div>
    </div>
  );
};

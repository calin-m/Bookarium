'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Filter, RotateCcw, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  LITERARY_ERAS,
  SORT_OPTIONS,
  GENRE_FACETS,
  FORMAT_FILTERS,
  CATALOG_LANGUAGES,
} from '@/config/catalog-filters';

export interface AdvancedFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEra: string;
  onEraChange?: (era: string) => void;
  selectedSort: 'popular' | 'descending' | 'ascending' | '';
  onSortChange?: (sort: 'popular' | 'descending' | 'ascending' | '') => void;
  selectedTopic: string;
  onTopicChange?: (topic: string) => void;
  selectedLanguage: string;
  onLanguageChange?: (lang: string) => void;
  selectedFormat: string;
  onFormatChange?: (format: string) => void;
  onApplyFilters?: (filters: {
    era: string;
    sort: 'popular' | 'descending' | 'ascending' | '';
    topic: string;
    language: string;
    format: string;
  }) => void;
  onResetAll?: () => void;
  activeFilterCount?: number;
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
  onApplyFilters,
  onResetAll,
  activeFilterCount: _activeFilterCount = 0,
}) => {
  const [draftEra, setDraftEra] = useState(selectedEra);
  const [draftSort, setDraftSort] = useState(selectedSort);
  const [draftTopic, setDraftTopic] = useState(selectedTopic);
  const [draftLanguage, setDraftLanguage] = useState(selectedLanguage);
  const [draftFormat, setDraftFormat] = useState(selectedFormat);

  // Synchronize draft state from props during render (React 19 pattern: adjusting state when props change)
  const [prevSync, setPrevSync] = useState({
    isOpen,
    selectedEra,
    selectedSort,
    selectedTopic,
    selectedLanguage,
    selectedFormat,
  });

  if (
    prevSync.isOpen !== isOpen ||
    (isOpen &&
      (prevSync.selectedEra !== selectedEra ||
        prevSync.selectedSort !== selectedSort ||
        prevSync.selectedTopic !== selectedTopic ||
        prevSync.selectedLanguage !== selectedLanguage ||
        prevSync.selectedFormat !== selectedFormat))
  ) {
    setPrevSync({
      isOpen,
      selectedEra,
      selectedSort,
      selectedTopic,
      selectedLanguage,
      selectedFormat,
    });
    if (isOpen) {
      setDraftEra(selectedEra);
      setDraftSort(selectedSort);
      setDraftTopic(selectedTopic);
      setDraftLanguage(selectedLanguage);
      setDraftFormat(selectedFormat);
    }
  }

  const selectedLanguages = useMemo(() => {
    return draftLanguage
      ? draftLanguage.split(',').map((l) => l.trim()).filter(Boolean)
      : [];
  }, [draftLanguage]);

  const selectedEras = useMemo(() => {
    return draftEra
      ? draftEra.split(',').map((e) => e.trim()).filter(Boolean)
      : [];
  }, [draftEra]);

  const selectedTopics = useMemo(() => {
    return draftTopic
      ? draftTopic.split(',').map((t) => t.trim()).filter(Boolean)
      : [];
  }, [draftTopic]);

  const selectedFormats = useMemo(() => {
    return draftFormat
      ? draftFormat.split(',').map((f) => f.trim()).filter(Boolean)
      : [];
  }, [draftFormat]);

  const handleToggleLanguage = (code: string) => {
    if (!code) {
      setDraftLanguage('');
      return;
    }
    const currentCodes = draftLanguage
      ? draftLanguage.split(',').map((l) => l.trim()).filter(Boolean)
      : [];
    if (currentCodes.includes(code)) {
      const remaining = currentCodes.filter((c) => c !== code);
      setDraftLanguage(remaining.join(','));
    } else {
      setDraftLanguage([...currentCodes, code].join(','));
    }
  };

  const handleToggleEra = (eraId: string) => {
    if (!eraId) {
      setDraftEra('');
      return;
    }
    const current = draftEra ? draftEra.split(',').map((e) => e.trim()).filter(Boolean) : [];
    if (current.includes(eraId)) {
      setDraftEra(current.filter((e) => e !== eraId).join(','));
    } else {
      setDraftEra([...current, eraId].join(','));
    }
  };

  const handleToggleTopic = (topicId: string) => {
    if (!topicId) {
      setDraftTopic('');
      return;
    }
    const current = draftTopic ? draftTopic.split(',').map((t) => t.trim()).filter(Boolean) : [];
    if (current.includes(topicId)) {
      setDraftTopic(current.filter((t) => t !== topicId).join(','));
    } else {
      setDraftTopic([...current, topicId].join(','));
    }
  };

  const handleToggleFormat = (formatVal: string) => {
    if (!formatVal) {
      setDraftFormat('');
      return;
    }
    const current = draftFormat ? draftFormat.split(',').map((f) => f.trim()).filter(Boolean) : [];
    if (current.includes(formatVal)) {
      setDraftFormat(current.filter((f) => f !== formatVal).join(','));
    } else {
      setDraftFormat([...current, formatVal].join(','));
    }
  };

  const stagedFilterCount = useMemo(() => {
    let count = 0;
    if (draftEra) {
      count += draftEra.split(',').filter(Boolean).length;
    }
    if (draftSort && draftSort !== 'popular') count++;
    if (draftTopic) {
      count += draftTopic.split(',').filter(Boolean).length;
    }
    if (draftLanguage) {
      count += draftLanguage.split(',').filter(Boolean).length;
    }
    if (draftFormat) {
      count += draftFormat.split(',').filter(Boolean).length;
    }
    return count;
  }, [draftEra, draftSort, draftTopic, draftLanguage, draftFormat]);

  const handleApply = () => {
    if (onApplyFilters) {
      onApplyFilters({
        era: draftEra,
        sort: draftSort,
        topic: draftTopic,
        language: draftLanguage,
        format: draftFormat,
      });
    } else {
      if (draftEra !== selectedEra) onEraChange?.(draftEra);
      if (draftSort !== selectedSort) onSortChange?.(draftSort);
      if (draftTopic !== selectedTopic) onTopicChange?.(draftTopic);
      if (draftLanguage !== selectedLanguage) onLanguageChange?.(draftLanguage);
      if (draftFormat !== selectedFormat) onFormatChange?.(draftFormat);
    }
    onClose();
  };

  const handleReset = () => {
    setDraftEra('');
    setDraftSort('popular');
    setDraftTopic('');
    setDraftLanguage('');
    setDraftFormat('');
    onResetAll?.();
  };
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
                {stagedFilterCount > 0 ? `${stagedFilterCount} active ${stagedFilterCount === 1 ? 'filter' : 'filters'}` : 'Customize catalog query'}
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
          
          {/* Section 1: Literary Era / Century (Multi-Select Touch Chips) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Historical Literary Era
              </h4>
              {selectedEras.length > 0 && (
                <span className="text-[10px] font-mono text-primary font-bold">
                  {selectedEras.length} selected
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Historical Literary Eras">
              {LITERARY_ERAS.map((era) => {
                const isAll = era.id === '';
                const isSelected = isAll
                  ? selectedEras.length === 0
                  : selectedEras.includes(era.id);

                return (
                  <button
                    key={era.id || 'all'}
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    onClick={() => handleToggleEra(era.id)}
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
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Sort Ordering">
              {SORT_OPTIONS.map((sort) => {
                const isSelected = (draftSort || 'popular') === (sort.value || 'popular');
                return (
                  <button
                    key={sort.value || 'popular'}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setDraftSort(sort.value as 'popular' | 'descending' | 'ascending' | '')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-sans flex items-center gap-1.5 border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-foreground text-background border-foreground font-bold shadow-xs'
                        : 'bg-card border-border text-foreground hover:border-primary'
                    }`}
                    data-testid={`sort-option-${sort.value || 'popular'}`}
                  >
                    <span>{sort.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Genre & Subject Facet (Multi-Select Touch Chips) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
                Subject & Category
              </h4>
              {selectedTopics.length > 0 && (
                <span className="text-[10px] font-mono text-primary font-bold">
                  {selectedTopics.length} selected
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Subject Categories">
              {GENRE_FACETS.map((facet) => {
                const isAll = facet.id === '';
                const isSelected = isAll
                  ? selectedTopics.length === 0
                  : selectedTopics.includes(facet.id);

                return (
                  <button
                    key={facet.id || 'all'}
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    onClick={() => handleToggleTopic(facet.id)}
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

          {/* Section 4: Catalog Languages (Responsive Multi-Select Touch Chips) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
                Language
              </h4>
              {selectedLanguages.length > 0 && (
                <span className="text-[10px] font-mono text-primary font-bold">
                  {selectedLanguages.length} selected
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Catalog Languages">
              {CATALOG_LANGUAGES.map((lang) => {
                const isAll = lang.value === '';
                const isSelected = isAll
                  ? selectedLanguages.length === 0
                  : selectedLanguages.includes(lang.value);

                return (
                  <button
                    key={lang.value || 'all'}
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    onClick={() => handleToggleLanguage(lang.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-sans flex items-center gap-1.5 border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-foreground text-background border-foreground font-bold shadow-xs'
                        : 'bg-card border-border text-foreground hover:border-primary'
                    }`}
                    data-testid={`language-option-${lang.value || 'all'}`}
                  >
                    <span>{lang.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 5: Format Availability (Multi-Select Touch Chips) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
                Format Filter
              </h4>
              {selectedFormats.length > 0 && (
                <span className="text-[10px] font-mono text-primary font-bold">
                  {selectedFormats.length} selected
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Format Filters">
              {FORMAT_FILTERS.map((fmt) => {
                const isAll = fmt.value === '';
                const isSelected = isAll
                  ? selectedFormats.length === 0
                  : selectedFormats.includes(fmt.value);

                return (
                  <button
                    key={fmt.value || 'all'}
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    onClick={() => handleToggleFormat(fmt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-sans flex items-center gap-1.5 border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-foreground text-background border-foreground font-bold shadow-xs'
                        : 'bg-card border-border text-foreground hover:border-primary'
                    }`}
                    data-testid={`format-option-${fmt.value ? fmt.value.replace(/[^a-zA-Z0-9]/g, '-') : 'all'}`}
                  >
                    <span>{fmt.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Drawer Bottom Actions (Sticky Footer) */}
        <div className="p-4 sm:p-5 border-t border-border bg-card/95 backdrop-blur-xs flex items-center justify-between gap-3 shrink-0 sticky bottom-0 z-20">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
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
            onClick={handleApply}
            data-testid="apply-filters-btn"
            className="px-6 py-2.5 text-xs font-mono uppercase tracking-wider font-bold rounded-lg bg-primary hover:opacity-90 text-primary-foreground shadow-xs"
            aria-label="Apply filters"
          >
            Show Results {stagedFilterCount > 0 ? `(${stagedFilterCount})` : ''}
          </Button>
        </div>

      </div>
    </div>
  );
};

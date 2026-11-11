'use client';

import React, { useState, useMemo } from 'react';
import { Filter, Sparkles } from 'lucide-react';
import {
  BottomSheetDrawerShell,
  splitCsvTokens,
  toggleCsvToken,
} from '@/components/ui/BottomSheetDrawerShell';
import {
  LITERARY_ERAS,
  SORT_OPTIONS,
  GENRE_FACETS,
  FORMAT_FILTERS,
  CATALOG_LANGUAGES,
  INITIAL_VISIBLE_FACET_COUNT,
  INITIAL_VISIBLE_LANGUAGE_COUNT,
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
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [showAllLanguages, setShowAllLanguages] = useState(false);

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

  const selectedLanguages = useMemo(() => splitCsvTokens(draftLanguage), [draftLanguage]);
  const selectedEras = useMemo(() => splitCsvTokens(draftEra), [draftEra]);
  const selectedTopics = useMemo(() => splitCsvTokens(draftTopic), [draftTopic]);
  const selectedFormats = useMemo(() => splitCsvTokens(draftFormat), [draftFormat]);

  const visibleGenreFacets = useMemo(() => {
    if (showAllTopics) return GENRE_FACETS;
    const initial = GENRE_FACETS.slice(0, INITIAL_VISIBLE_FACET_COUNT);
    const extraSelected = GENRE_FACETS.slice(INITIAL_VISIBLE_FACET_COUNT).filter(
      (facet) => facet.id && selectedTopics.includes(facet.id)
    );
    return [...initial, ...extraSelected];
  }, [showAllTopics, selectedTopics]);

  const visibleLanguages = useMemo(() => {
    if (showAllLanguages) return CATALOG_LANGUAGES;
    const initial = CATALOG_LANGUAGES.slice(0, INITIAL_VISIBLE_LANGUAGE_COUNT);
    const extraSelected = CATALOG_LANGUAGES.slice(INITIAL_VISIBLE_LANGUAGE_COUNT).filter(
      (lang) => lang.value && selectedLanguages.includes(lang.value)
    );
    return [...initial, ...extraSelected];
  }, [showAllLanguages, selectedLanguages]);

  const handleToggleLanguage = (code: string) => setDraftLanguage(toggleCsvToken(draftLanguage, code));
  const handleToggleEra = (eraId: string) => setDraftEra(toggleCsvToken(draftEra, eraId));
  const handleToggleTopic = (topicId: string) => setDraftTopic(toggleCsvToken(draftTopic, topicId));
  const handleToggleFormat = (formatVal: string) => setDraftFormat(toggleCsvToken(draftFormat, formatVal));

  const stagedFilterCount = useMemo(() => {
    let count = 0;
    count += selectedEras.length;
    if (draftSort && draftSort !== 'descending') count++;
    count += selectedTopics.length;
    count += selectedLanguages.length;
    count += selectedFormats.length;
    return count;
  }, [selectedEras, draftSort, selectedTopics, selectedLanguages, selectedFormats]);

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
    setDraftSort('descending');
    setDraftTopic('');
    setDraftLanguage('');
    setDraftFormat('');
    onResetAll?.();
  };

  return (
    <BottomSheetDrawerShell
      isOpen={isOpen}
      onClose={onClose}
      title="Gutenberg Catalog Filters"
      titleId="advanced-filter-title"
      subtitle={stagedFilterCount > 0 ? `${stagedFilterCount} active ${stagedFilterCount === 1 ? 'filter' : 'filters'}` : 'Customize catalog query'}
      icon={<Filter className="w-4 h-4" />}
      dialogTestId="advanced-filter-drawer"
      backdropTestId="filter-backdrop"
      resetBtnTestId="reset-filters-btn"
      applyBtnTestId="apply-filters-btn"
      headerPaddingClass="p-4 sm:p-6"
      activeFilterCount={stagedFilterCount}
      onResetAll={handleReset}
      onApply={handleApply}
    >
      {/* Section 1: Author Lifespan & Literary Era (Multi-Select Touch Chips) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Author Lifespan &amp; Literary Era
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
                className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-foreground text-background border-foreground shadow-xs'
                    : 'bg-card border-border text-foreground hover:border-primary'
                }`}
                data-testid={`era-option-${era.id || 'all'}`}
              >
                <span>{era.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: Sort Order */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
          Sort Order
        </h4>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Sort Ordering">
          {SORT_OPTIONS.map((sort) => {
            const isSelected = (draftSort || 'descending') === (sort.value || 'descending');
            return (
              <button
                key={sort.value || 'descending'}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setDraftSort(sort.value as 'popular' | 'descending' | 'ascending' | '')}
                className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-foreground text-background border-foreground shadow-xs'
                    : 'bg-card border-border text-foreground hover:border-primary'
                }`}
                data-testid={`sort-option-${sort.value || 'descending'}`}
              >
                <span>{sort.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 3: Bookshelf & Subject Facet (Multi-Select Touch Chips) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
            Bookshelf &amp; Subject
          </h4>
          {selectedTopics.length > 0 && (
            <span className="text-[10px] font-mono text-primary font-bold">
              {selectedTopics.length} selected
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Subject Categories">
          {visibleGenreFacets.map((facet) => {
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
                className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-foreground text-background border-foreground shadow-xs'
                    : 'bg-card border-border text-foreground hover:border-primary'
                }`}
                data-testid={`genre-facet-${facet.id || 'all'}`}
              >
                <span>{facet.label}</span>
              </button>
            );
          })}
        </div>
        {GENRE_FACETS.length > INITIAL_VISIBLE_FACET_COUNT && (
          <button
            type="button"
            onClick={() => setShowAllTopics((prev) => !prev)}
            data-testid="toggle-all-topics-btn"
            className="text-xs font-mono font-bold text-primary hover:underline cursor-pointer pt-0.5"
          >
            {showAllTopics
              ? 'Show fewer'
              : `+ Show all ${GENRE_FACETS.length - 1} Bookshelves`}
          </button>
        )}
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
          {visibleLanguages.map((lang) => {
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
                className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-foreground text-background border-foreground shadow-xs'
                    : 'bg-card border-border text-foreground hover:border-primary'
                }`}
                data-testid={`language-option-${lang.value || 'all'}`}
              >
                <span>{lang.label}</span>
              </button>
            );
          })}
        </div>
        {CATALOG_LANGUAGES.length > INITIAL_VISIBLE_LANGUAGE_COUNT && (
          <button
            type="button"
            onClick={() => setShowAllLanguages((prev) => !prev)}
            data-testid="toggle-all-languages-btn"
            className="text-xs font-mono font-bold text-primary hover:underline cursor-pointer pt-0.5"
          >
            {showAllLanguages
              ? 'Show fewer'
              : `+ Show all ${CATALOG_LANGUAGES.length - 1} Languages`}
          </button>
        )}
      </div>

      {/* Section 5: Format Availability (Multi-Select Touch Chips) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
            E-Book Format
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
                className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-foreground text-background border-foreground shadow-xs'
                    : 'bg-card border-border text-foreground hover:border-primary'
                }`}
                data-testid={`format-option-${fmt.value ? fmt.value.replace(/[^a-zA-Z0-9]/g, '-') : 'all'}`}
              >
                <span>{fmt.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheetDrawerShell>
  );
};

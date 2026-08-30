'use client';

import React from 'react';
import { X, Filter, RotateCcw, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface EraOption {
  id: string;
  label: string;
  start?: number;
  end?: number;
}

export const LITERARY_ERAS: EraOption[] = [
  { id: '', label: 'All Historical Eras' },
  { id: 'antiquity', label: 'Antiquity (Pre-500 CE)', start: -800, end: 500 },
  { id: 'middle-ages', label: 'Middle Ages (500–1400 CE)', start: 500, end: 1400 },
  { id: 'renaissance', label: 'Renaissance & Early Modern (1400–1650)', start: 1400, end: 1650 },
  { id: 'enlightenment', label: 'Enlightenment & Reason (1650–1800)', start: 1650, end: 1800 },
  { id: 'victorian', label: '19th Century Victorian & Romantic (1800–1900)', start: 1800, end: 1900 },
  { id: 'early-20th', label: 'Early 20th Century (1900–1928)', start: 1900, end: 1928 },
];

export const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular (Download Count)' },
  { value: 'descending', label: 'Recently Added to Gutenberg' },
  { value: 'ascending', label: 'Oldest Catalog ID' },
];

export const GENRE_FACETS = [
  { id: '', label: 'All Subjects' },
  { id: 'philosophy', label: 'Classical Philosophy & Ethics' },
  { id: 'fiction', label: 'Classic Literature & Fiction' },
  { id: 'gothic', label: 'Gothic, Mystery & Horror' },
  { id: 'poetry', label: 'Poetry, Epics & Sonnets' },
  { id: 'science', label: 'Science, Mathematics & Nature' },
  { id: 'drama', label: 'Drama, Theatre & Plays' },
  { id: 'history', label: 'History, Treatises & Biographies' },
  { id: 'adventure', label: 'Sea Stories, Voyages & Adventure' },
  { id: 'mythology', label: 'Mythology & Folklore' },
];

export const EXTENDED_LANGUAGES = [
  { value: '', label: 'All Languages' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French (Français)' },
  { value: 'de', label: 'German (Deutsch)' },
  { value: 'es', label: 'Spanish (Español)' },
  { value: 'it', label: 'Italian (Italiano)' },
  { value: 'la', label: 'Latin (Lingua Latina)' },
  { value: 'el', label: 'Ancient & Modern Greek' },
  { value: 'pt', label: 'Portuguese (Português)' },
  { value: 'nl', label: 'Dutch (Nederlands)' },
  { value: 'ru', label: 'Russian (Русский)' },
  { value: 'zh', label: 'Chinese (中文)' },
];

export const FORMAT_FILTERS = [
  { value: '', label: 'All Digital Formats' },
  { value: 'application/epub+zip', label: 'EPUB E-Reader Available' },
  { value: 'text/html', label: 'HTML / Web Reader Available' },
  { value: 'text/plain', label: 'Plain Text UTF-8 Available' },
];

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
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="advanced-filter-title"
      data-testid="advanced-filter-drawer"
    >
      <div className="w-full max-w-md h-full bg-[#f9f8f6] dark:bg-[#0e1117] text-stone-900 dark:text-stone-100 flex flex-col justify-between shadow-2xl border-l border-stone-300/80 dark:border-stone-800 animate-in slide-in-from-right duration-300 overflow-hidden">
        
        {/* Drawer Header */}
        <div className="p-6 border-b border-stone-200/80 dark:border-stone-800 flex items-center justify-between bg-white dark:bg-stone-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center border border-primary-200/60 dark:border-primary-900/60">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 id="advanced-filter-title" className="font-serif font-bold text-lg leading-tight">
                Advanced Archive Filters
              </h3>
              <p className="text-[11px] font-mono uppercase tracking-wider text-stone-500">
                {activeFilterCount > 0 ? `${activeFilterCount} active filters` : 'Customize catalog query'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 transition-colors"
            aria-label="Close filters"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Filter Sections */}
        <div className="flex-1 overflow-y-auto p-6 space-y-7">
          
          {/* Section 1: Literary Era / Century */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-primary-600 dark:text-primary-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Historical Literary Era
            </h4>
            <div className="space-y-1.5">
              {LITERARY_ERAS.map((era) => {
                const isSelected = selectedEra === era.id;
                return (
                  <button
                    key={era.id}
                    type="button"
                    onClick={() => onEraChange(era.id)}
                    className={`w-full text-left px-3.5 py-2 rounded-lg text-xs font-sans flex items-center justify-between border transition-all ${
                      isSelected
                        ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-stone-900 dark:border-stone-100 font-bold shadow-xs'
                        : 'bg-white dark:bg-stone-900/90 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-stone-400'
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
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-stone-600 dark:text-stone-300">
              Sort Ordering
            </h4>
            <select
              value={selectedSort}
              onChange={(e) => onSortChange(e.target.value as any)}
              className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg p-2.5 text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-primary-500"
              data-testid="sort-select"
            >
              {SORT_OPTIONS.map((sort) => (
                <option key={sort.value} value={sort.value}>
                  {sort.label}
                </option>
              ))}
            </select>
          </div>

          {/* Section 3: Genre & Subject Facet */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-stone-600 dark:text-stone-300">
              Subject & Category
            </h4>
            <div className="grid grid-cols-1 gap-1.5">
              {GENRE_FACETS.map((facet) => {
                const isSelected = selectedTopic.toLowerCase() === facet.id;
                return (
                  <button
                    key={facet.id}
                    type="button"
                    onClick={() => onTopicChange(facet.id)}
                    className={`w-full text-left px-3.5 py-2 rounded-lg text-xs font-sans flex items-center justify-between border transition-all ${
                      isSelected
                        ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-stone-900 dark:border-stone-100 font-bold shadow-xs'
                        : 'bg-white dark:bg-stone-900/90 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-stone-400'
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

          {/* Section 4: Extended Languages */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-stone-600 dark:text-stone-300">
              Language
            </h4>
            <select
              value={selectedLanguage}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg p-2.5 text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-primary-500"
              data-testid="language-drawer-select"
            >
              {EXTENDED_LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Section 5: Format Availability */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-stone-600 dark:text-stone-300">
              Format Filter
            </h4>
            <select
              value={selectedFormat}
              onChange={(e) => onFormatChange(e.target.value)}
              className="w-full bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-lg p-2.5 text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:border-primary-500"
              data-testid="format-drawer-select"
            >
              {FORMAT_FILTERS.map((fmt) => (
                <option key={fmt.value} value={fmt.value}>
                  {fmt.label}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Drawer Bottom Actions */}
        <div className="p-5 border-t border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetAll}
            className="text-xs font-mono uppercase tracking-wider text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 gap-1.5"
            aria-label="Reset all filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onClose}
            className="px-6 py-2 text-xs font-mono uppercase tracking-wider font-bold rounded bg-primary-600 hover:bg-primary-700 text-white"
            aria-label="Apply filters"
          >
            Apply Filters
          </Button>
        </div>

      </div>
    </div>
  );
};


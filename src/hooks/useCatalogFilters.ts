import { useState, useMemo, useCallback } from 'react';
import { LITERARY_ERAS, EXTENDED_LANGUAGES, GENRE_FACETS } from '@/config/catalog-filters';

export interface ActiveFilterChip {
  id: string;
  label: string;
  type: 'search' | 'topic' | 'language' | 'era' | 'format';
}

export type CatalogView = 'catalog' | 'bookshelf' | 'likes';
export type CatalogViewMode = 'grid' | 'shelf';
export type CatalogSortOption = 'popular' | 'descending' | 'ascending' | '';

export interface CatalogQueryParams {
  search?: string;
  topic?: string;
  languages?: string;
  authorYearStart?: number;
  authorYearEnd?: number;
  sort?: CatalogSortOption;
  mimeType?: string;
  page: number;
  copyright: false;
}

export function useCatalogFilters() {
  const [activeView, setActiveView] = useState<CatalogView>('catalog');
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('');
  const [era, setEra] = useState('');
  const [sort, setSort] = useState<CatalogSortOption>('popular');
  const [format, setFormat] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(32);
  const [viewMode, setViewMode] = useState<CatalogViewMode>('grid');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const selectedEraObj = useMemo(() => {
    return LITERARY_ERAS.find((e) => e.id === era);
  }, [era]);

  const queryParams = useMemo<CatalogQueryParams>(() => {
    return {
      search: search || undefined,
      topic: topic || undefined,
      languages: language || undefined,
      authorYearStart: selectedEraObj?.start,
      authorYearEnd: selectedEraObj?.end,
      sort: sort || undefined,
      mimeType: format || undefined,
      page,
      copyright: false as const,
    };
  }, [search, topic, language, selectedEraObj, sort, format, page]);

  const activeFilterChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];

    if (search) {
      chips.push({ id: 'search', label: `Search: "${search}"`, type: 'search' });
    }
    if (topic) {
      const facet = GENRE_FACETS.find((f) => f.id === topic);
      chips.push({ id: 'topic', label: facet ? facet.label : topic, type: 'topic' });
    }
    if (language) {
      const lang = EXTENDED_LANGUAGES.find((l) => l.value === language);
      chips.push({ id: 'language', label: lang ? lang.label : language.toUpperCase(), type: 'language' });
    }
    if (era) {
      const eraObj = LITERARY_ERAS.find((e) => e.id === era);
      chips.push({ id: 'era', label: eraObj ? eraObj.label : era, type: 'era' });
    }
    if (format) {
      chips.push({ id: 'format', label: 'Format Filter Active', type: 'format' });
    }

    return chips;
  }, [search, topic, language, era, format]);

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val);
    setPage(1);
  }, []);

  const handleTopicChange = useCallback((val: string) => {
    setTopic(val);
    setPage(1);
  }, []);

  const handleLanguageChange = useCallback((val: string) => {
    setLanguage(val);
    setPage(1);
  }, []);

  const handleEraChange = useCallback((val: string) => {
    setEra(val);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((val: CatalogSortOption) => {
    setSort(val);
    setPage(1);
  }, []);

  const handleFormatChange = useCallback((val: string) => {
    setFormat(val);
    setPage(1);
  }, []);

  const handleResetAllFilters = useCallback(() => {
    setSearch('');
    setTopic('');
    setLanguage('');
    setEra('');
    setFormat('');
    setSort('popular');
    setPage(1);
  }, []);

  const removeFilterChip = useCallback((chipId: string) => {
    switch (chipId) {
      case 'search':
        setSearch('');
        break;
      case 'topic':
        setTopic('');
        break;
      case 'language':
        setLanguage('');
        break;
      case 'era':
        setEra('');
        break;
      case 'format':
        setFormat('');
        break;
    }
    setPage(1);
  }, []);

  return {
    // State
    activeView,
    search,
    topic,
    language,
    era,
    sort,
    format,
    page,
    pageSize,
    viewMode,
    isFilterDrawerOpen,
    selectedEraObj,
    queryParams,
    activeFilterChips,

    // Actions & Setters
    setActiveView,
    setPage,
    setPageSize,
    setViewMode,
    setIsFilterDrawerOpen,
    handleSearchChange,
    handleTopicChange,
    handleLanguageChange,
    handleEraChange,
    handleSortChange,
    handleFormatChange,
    handleResetAllFilters,
    removeFilterChip,
  };
}

import { useState, useMemo, useCallback, useEffect } from 'react';
import { LITERARY_ERAS, CATALOG_LANGUAGES, GENRE_FACETS } from '@/config/catalog-filters';

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

function getInitialUrlParams() {
  if (typeof window === 'undefined') return {};
  try {
    const sp = new URLSearchParams(window.location.search);
    return {
      search: sp.get('search') || '',
      topic: sp.get('topic') || '',
      language: sp.get('languages') || sp.get('language') || '',
      era: sp.get('era') || '',
      sort: (sp.get('sort') as CatalogSortOption) || 'popular',
      format: sp.get('format') || sp.get('mime_type') || '',
      page: parseInt(sp.get('page') || '1', 10) || 1,
      view: (sp.get('view') as CatalogView) || 'catalog',
    };
  } catch {
    return {};
  }
}

export function useCatalogFilters() {
  const initialParams = useMemo(() => getInitialUrlParams(), []);

  const [activeView, setActiveView] = useState<CatalogView>(initialParams.view || 'catalog');
  const [search, setSearch] = useState(initialParams.search || '');
  const [topic, setTopic] = useState(initialParams.topic || '');
  const [language, setLanguage] = useState(initialParams.language || '');
  const [era, setEra] = useState(initialParams.era || '');
  const [sort, setSort] = useState<CatalogSortOption>(initialParams.sort || 'popular');
  const [format, setFormat] = useState(initialParams.format || '');
  const [page, setPage] = useState(initialParams.page || 1);
  const [pageSize, setPageSize] = useState(32);
  const [viewMode, setViewMode] = useState<CatalogViewMode>('grid');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Sync state to URL search parameters without page reload
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      if (search) url.searchParams.set('search', search);
      else url.searchParams.delete('search');

      if (topic) url.searchParams.set('topic', topic);
      else url.searchParams.delete('topic');

      if (language) url.searchParams.set('language', language);
      else url.searchParams.delete('language');

      if (era) url.searchParams.set('era', era);
      else url.searchParams.delete('era');

      if (sort && sort !== 'popular') url.searchParams.set('sort', sort);
      else url.searchParams.delete('sort');

      if (format) url.searchParams.set('format', format);
      else url.searchParams.delete('format');

      if (page > 1) url.searchParams.set('page', String(page));
      else url.searchParams.delete('page');

      if (activeView !== 'catalog') url.searchParams.set('view', activeView);
      else url.searchParams.delete('view');

      window.history.replaceState(null, '', url.pathname + (url.search ? url.search : ''));
    } catch {
      // Safe fallback in test or sandboxed environments
    }
  }, [search, topic, language, era, sort, format, page, activeView]);

  // Support browser Back/Forward navigation popstate
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const init = getInitialUrlParams();
      if (init.search !== undefined) setSearch(init.search);
      if (init.topic !== undefined) setTopic(init.topic);
      if (init.language !== undefined) setLanguage(init.language);
      if (init.era !== undefined) setEra(init.era);
      if (init.sort !== undefined) setSort(init.sort);
      if (init.format !== undefined) setFormat(init.format);
      if (init.page !== undefined) setPage(init.page);
      if (init.view !== undefined) setActiveView(init.view);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
      const lang = CATALOG_LANGUAGES.find((l) => l.value === language);
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

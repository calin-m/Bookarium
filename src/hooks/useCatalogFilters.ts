import { useState, useMemo, useCallback, useEffect } from 'react';
import { LITERARY_ERAS, CATALOG_LANGUAGES, GENRE_FACETS } from '@/config/catalog-filters';
import { useHasMounted } from '@/hooks/useHasMounted';

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
      search: sp.get('search') || undefined,
      topic: sp.get('topic') || undefined,
      language: sp.get('languages') || sp.get('language') || undefined,
      era: sp.get('era') || undefined,
      sort: (sp.get('sort') as CatalogSortOption) || undefined,
      format: sp.get('format') || sp.get('mime_type') || undefined,
      page: sp.get('page') ? parseInt(sp.get('page')!, 10) : undefined,
      view: (sp.get('view') as CatalogView) || undefined,
    };
  } catch {
    return {};
  }
}

export function useCatalogFilters() {
  const hasMounted = useHasMounted();
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

  const initialParams = useMemo(() => {
    if (!hasMounted) return {};
    return getInitialUrlParams();
  }, [hasMounted]);

  // Derive effective filter values: fallback to URL params once mounted to guarantee 0 SSR mismatch
  const effectiveActiveView = hasMounted && activeView === 'catalog' && initialParams.view ? initialParams.view : activeView;
  const effectiveSearch = hasMounted && search === '' && initialParams.search ? initialParams.search : search;
  const effectiveTopic = hasMounted && topic === '' && initialParams.topic ? initialParams.topic : topic;
  const effectiveLanguage = hasMounted && language === '' && initialParams.language ? initialParams.language : language;
  const effectiveEra = hasMounted && era === '' && initialParams.era ? initialParams.era : era;
  const effectiveSort = hasMounted && sort === 'popular' && initialParams.sort ? initialParams.sort : sort;
  const effectiveFormat = hasMounted && format === '' && initialParams.format ? initialParams.format : format;
  const effectivePage = hasMounted && page === 1 && initialParams.page ? initialParams.page : page;

  // Sync state to URL search parameters without page reload (after hydration)
  useEffect(() => {
    if (typeof window === 'undefined' || !hasMounted) return;
    try {
      const url = new URL(window.location.href);
      if (effectiveSearch) url.searchParams.set('search', effectiveSearch);
      else url.searchParams.delete('search');

      if (effectiveTopic) url.searchParams.set('topic', effectiveTopic);
      else url.searchParams.delete('topic');

      if (effectiveLanguage) url.searchParams.set('language', effectiveLanguage);
      else url.searchParams.delete('language');

      if (effectiveEra) url.searchParams.set('era', effectiveEra);
      else url.searchParams.delete('era');

      if (effectiveSort && effectiveSort !== 'popular') url.searchParams.set('sort', effectiveSort);
      else url.searchParams.delete('sort');

      if (effectiveFormat) url.searchParams.set('format', effectiveFormat);
      else url.searchParams.delete('format');

      if (effectivePage > 1) url.searchParams.set('page', String(effectivePage));
      else url.searchParams.delete('page');

      if (effectiveActiveView !== 'catalog') url.searchParams.set('view', effectiveActiveView);
      else url.searchParams.delete('view');

      window.history.replaceState(null, '', url.pathname + (url.search ? url.search : ''));
    } catch {
      // Safe fallback in test or sandboxed environments
    }
  }, [effectiveSearch, effectiveTopic, effectiveLanguage, effectiveEra, effectiveSort, effectiveFormat, effectivePage, effectiveActiveView, hasMounted]);

  // Support browser Back/Forward navigation popstate
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const init = getInitialUrlParams();
      setSearch(init.search || '');
      setTopic(init.topic || '');
      setLanguage(init.language || '');
      setEra(init.era || '');
      setSort(init.sort || 'popular');
      setFormat(init.format || '');
      setPage(init.page || 1);
      setActiveView(init.view || 'catalog');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const selectedEraObj = useMemo(() => {
    return LITERARY_ERAS.find((e) => e.id === effectiveEra);
  }, [effectiveEra]);

  const queryParams = useMemo<CatalogQueryParams>(() => {
    return {
      search: effectiveSearch || undefined,
      topic: effectiveTopic || undefined,
      languages: effectiveLanguage || undefined,
      authorYearStart: selectedEraObj?.start,
      authorYearEnd: selectedEraObj?.end,
      sort: effectiveSort || undefined,
      mimeType: effectiveFormat || undefined,
      page: effectivePage,
      copyright: false as const,
    };
  }, [effectiveSearch, effectiveTopic, effectiveLanguage, selectedEraObj, effectiveSort, effectiveFormat, effectivePage]);

  const activeFilterChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];

    if (effectiveSearch) {
      chips.push({ id: 'search', label: `Search: "${effectiveSearch}"`, type: 'search' });
    }
    if (effectiveTopic) {
      const facet = GENRE_FACETS.find((f) => f.id === effectiveTopic);
      chips.push({ id: 'topic', label: facet ? facet.label : effectiveTopic, type: 'topic' });
    }
    if (effectiveLanguage) {
      const lang = CATALOG_LANGUAGES.find((l) => l.value === effectiveLanguage);
      chips.push({ id: 'language', label: lang ? lang.label : effectiveLanguage.toUpperCase(), type: 'language' });
    }
    if (effectiveEra) {
      const eraObj = LITERARY_ERAS.find((e) => e.id === effectiveEra);
      chips.push({ id: 'era', label: eraObj ? eraObj.label : effectiveEra, type: 'era' });
    }
    if (effectiveFormat) {
      chips.push({ id: 'format', label: 'Format Filter Active', type: 'format' });
    }

    return chips;
  }, [effectiveSearch, effectiveTopic, effectiveLanguage, effectiveEra, effectiveFormat]);

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
    activeView: effectiveActiveView,
    search: effectiveSearch,
    topic: effectiveTopic,
    language: effectiveLanguage,
    era: effectiveEra,
    sort: effectiveSort,
    format: effectiveFormat,
    page: effectivePage,
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

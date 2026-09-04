import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { LITERARY_ERAS, CATALOG_LANGUAGES, GENRE_FACETS } from '@/config/catalog-filters';
import { useHasMounted } from '@/hooks/useHasMounted';

export interface ActiveFilterChip {
  id: string;
  label: string;
  type: 'search' | 'topic' | 'language' | 'era' | 'format';
}

export type CatalogView = 'catalog' | 'bookshelf' | 'likes' | 'notebook' | 'bookmarks';
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
  const searchParams = useSearchParams();
  const hasMounted = useHasMounted();
  const [activeView, setActiveView] = useState<CatalogView>(() => {
    const init = getInitialUrlParams();
    return init.view && ['catalog', 'bookshelf', 'likes', 'notebook', 'bookmarks'].includes(init.view) ? init.view : 'catalog';
  });

  // Synchronize state with Next.js router URL searchParams during render
  const currentViewParam = searchParams?.get('view') || null;
  const [prevViewParam, setPrevViewParam] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('view') : null;
  });

  if (currentViewParam !== prevViewParam) {
    setPrevViewParam(currentViewParam);
    if (currentViewParam && ['catalog', 'bookshelf', 'likes', 'notebook', 'bookmarks'].includes(currentViewParam)) {
      setActiveView(currentViewParam as CatalogView);
    }
  }
  const [search, setSearch] = useState(() => getInitialUrlParams().search || '');
  const [topic, setTopic] = useState(() => getInitialUrlParams().topic || '');
  const [language, setLanguage] = useState(() => getInitialUrlParams().language || '');
  const [era, setEra] = useState(() => getInitialUrlParams().era || '');
  const [sort, setSort] = useState<CatalogSortOption>(() => getInitialUrlParams().sort || 'popular');
  const [format, setFormat] = useState(() => getInitialUrlParams().format || '');
  const [page, setPage] = useState(() => getInitialUrlParams().page || 1);
  const [pageSize, setPageSize] = useState(32);
  const [viewMode, setViewMode] = useState<CatalogViewMode>('grid');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Sync state to URL search parameters without page reload (after hydration)
  useEffect(() => {
    if (typeof window === 'undefined' || !hasMounted) return;
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
  }, [search, topic, language, era, sort, format, page, activeView, hasMounted]);

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
      page: page,
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

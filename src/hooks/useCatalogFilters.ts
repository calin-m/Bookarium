import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { LITERARY_ERAS, CATALOG_LANGUAGES, GENRE_FACETS } from '@/config/catalog-filters';
import { useHasMounted } from '@/hooks/useHasMounted';

export interface ActiveFilterChip {
  id: string;
  label: string;
  type: 'search' | 'topic' | 'language' | 'era' | 'format';
}

export type CatalogView = 'catalog' | 'bookshelf' | 'favorites' | 'notebook' | 'bookmarks';
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

export function normalizeCatalogView(raw?: string | null): CatalogView {
  if (raw === 'likes' || raw === 'favorites') return 'favorites';
  if (raw && ['catalog', 'bookshelf', 'notebook', 'bookmarks'].includes(raw)) {
    return raw as CatalogView;
  }
  return 'catalog';
}

export function parseFiltersFromUrl(
  pathname?: string | null,
  searchParams?: { get: (name: string) => string | null } | null
) {
  let sp: { get: (name: string) => string | null } | null = searchParams || null;
  let p = pathname || '';

  if (typeof window !== 'undefined') {
    if (!sp) {
      try {
        sp = new URLSearchParams(window.location.search);
      } catch {
        sp = null;
      }
    }
    if (!p) {
      p = window.location.pathname || '';
    }
  }

  const pathSegment = (p || '').replace(/^\/+|\/+$/g, '').toLowerCase();

  let pathView: CatalogView | undefined = undefined;
  if (pathSegment && ['catalog', 'bookshelf', 'favorites', 'notebook', 'bookmarks'].includes(pathSegment)) {
    pathView = normalizeCatalogView(pathSegment);
  }
  const queryView = sp?.get('view') ? normalizeCatalogView(sp.get('view')) : undefined;

  const rawPage = sp?.get('page');
  const parsedPage = rawPage ? parseInt(rawPage, 10) : undefined;
  const validPage = parsedPage && !isNaN(parsedPage) && parsedPage >= 1 ? parsedPage : undefined;

  return {
    search: sp?.get('search') || '',
    topic: sp?.get('topic') || '',
    language: sp?.get('languages') || sp?.get('language') || '',
    era: sp?.get('era') || '',
    sort: (sp?.get('sort') as CatalogSortOption) || 'popular',
    format: sp?.get('format') || sp?.get('mime_type') || '',
    page: validPage || 1,
    view: pathView || queryView || 'catalog',
  };
}

export function useCatalogFilters() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasMounted = useHasMounted();

  const initialParams = useMemo(() => {
    return parseFiltersFromUrl(pathname, searchParams);
  }, [pathname, searchParams]);

  const [activeView, setActiveView] = useState<CatalogView>(() => initialParams.view);

  // Synchronize state with Next.js router URL pathname or searchParams during render
  const cleanPath = (pathname || '').replace(/^\/+|\/+$/g, '').toLowerCase();
  const currentViewFromRoute: CatalogView | null = ['bookshelf', 'favorites', 'notebook', 'bookmarks'].includes(cleanPath)
    ? (cleanPath as CatalogView)
    : searchParams?.get('view')
    ? normalizeCatalogView(searchParams.get('view'))
    : cleanPath === 'catalog' || pathname === '/'
    ? 'catalog'
    : null;

  const [prevViewFromRoute, setPrevViewFromRoute] = useState<CatalogView | null>(() => initialParams.view);

  if (currentViewFromRoute !== prevViewFromRoute) {
    setPrevViewFromRoute(currentViewFromRoute);
    if (currentViewFromRoute) {
      setActiveView(currentViewFromRoute);
    }
  }
  const [search, setSearch] = useState(() => initialParams.search);
  const [topic, setTopic] = useState(() => initialParams.topic);
  const [language, setLanguage] = useState(() => initialParams.language);
  const [era, setEra] = useState(() => initialParams.era);
  const [sort, setSort] = useState<CatalogSortOption>(() => initialParams.sort);
  const [format, setFormat] = useState(() => initialParams.format);
  const [page, setPage] = useState(() => initialParams.page);
  const [pageSize, setPageSize] = useState(32);
  const [viewMode, setViewMode] = useState<CatalogViewMode>('grid');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Sync state to URL search parameters and clean path without page reload (after hydration)
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

      // Clear legacy 'view' parameter for clean paths
      url.searchParams.delete('view');

      // Determine clean target path based on activeView
      const targetPath = activeView === 'catalog' ? '/' : `/${activeView}`;
      const searchStr = url.searchParams.toString();
      const newRelativeUrl = searchStr ? `${targetPath}?${searchStr}` : targetPath;

      const currentRelativeUrl = `${window.location.pathname}${window.location.search}`;
      if (currentRelativeUrl !== newRelativeUrl) {
        window.history.replaceState(null, '', newRelativeUrl);
      }
    } catch {
      // Safe fallback in test or sandboxed environments
    }
  }, [search, topic, language, era, sort, format, page, activeView, hasMounted]);

  // Support browser Back/Forward navigation popstate
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const sp = new URLSearchParams(window.location.search);
      const parsed = parseFiltersFromUrl(window.location.pathname, sp);
      setSearch(parsed.search);
      setTopic(parsed.topic);
      setLanguage(parsed.language);
      setEra(parsed.era);
      setSort(parsed.sort);
      setFormat(parsed.format);
      setPage(parsed.page);
      setActiveView(parsed.view);
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

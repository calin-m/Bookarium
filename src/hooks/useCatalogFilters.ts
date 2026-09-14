import { useState, useMemo, useCallback, useEffect, useSyncExternalStore } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { LITERARY_ERAS, CATALOG_LANGUAGES, GENRE_FACETS, FORMAT_FILTERS } from '@/config/catalog-filters';
import { useHasMounted } from '@/hooks/useHasMounted';

function subscribeMobile(callback: () => void) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(max-width: 767px)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getMobileSnapshot() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

function getServerMobileSnapshot() {
  return false;
}

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

  const rawSize = sp?.get('size');
  let parsedSize: number | undefined = undefined;
  if (rawSize === '8' || rawSize === '16' || rawSize === '32') {
    parsedSize = parseInt(rawSize, 10);
  }

  return {
    search: (sp?.get('search') || '').trim().replace(/\s+/g, ' '),
    topic: sp?.get('topic') || '',
    language: sp?.get('languages') || sp?.get('language') || '',
    era: sp?.get('era') || '',
    sort: (sp?.get('sort') as CatalogSortOption) || 'popular',
    format: sp?.get('format') || sp?.get('mime_type') || '',
    page: validPage || 1,
    size: parsedSize || 16,
    explicitSize: parsedSize,
    view: pathView || queryView || 'catalog',
  };
}

export function useCatalogFilters() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasMounted = useHasMounted();
  const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, getServerMobileSnapshot);

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
  const [explicitPageSize, setExplicitPageSize] = useState<number | null>(() => initialParams.explicitSize ?? null);
  const [viewMode, setViewMode] = useState<CatalogViewMode>('grid');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const pageSize = explicitPageSize ?? (isMobile ? 8 : 16);
  const [prevPageSize, setPrevPageSize] = useState(pageSize);

  // Translate page coordinates upon responsive breakpoint change to prevent redundant API fetches and preserve reading position
  if (hasMounted && prevPageSize !== pageSize) {
    setPrevPageSize(pageSize);
    const currentFirstBookIndex = (page - 1) * prevPageSize;
    const newPage = Math.max(1, Math.floor(currentFirstBookIndex / pageSize) + 1);
    setPage(newPage);
  } else if (!hasMounted && prevPageSize !== pageSize) {
    setPrevPageSize(pageSize);
  }

  // Sync state to URL search parameters and clean path without page reload (after hydration)
  useEffect(() => {
    if (typeof window === 'undefined' || !hasMounted) return;
    try {
      if (activeView !== 'catalog') {
        // View-scoped: non-catalog views (bookshelf, favorites, notebook, bookmarks)
        // are personal collections and do not carry catalog pagination or search queries.
        const targetPath = `/${activeView}`;
        const currentRelativeUrl = `${window.location.pathname}${window.location.search}`;
        if (currentRelativeUrl !== targetPath) {
          window.history.replaceState(null, '', targetPath);
        }
        return;
      }

      // Catalog view: sync search, topic, language, era, sort, format, page, size
      const searchParams = new URLSearchParams();
      if (search) searchParams.set('search', search);
      if (topic) searchParams.set('topic', topic);
      if (language) searchParams.set('language', language);
      if (era) searchParams.set('era', era);
      if (sort && sort !== 'popular') searchParams.set('sort', sort);
      if (format) searchParams.set('format', format);
      if (page > 1) searchParams.set('page', String(page));

      const defaultSize = isMobile ? 8 : 16;
      if (explicitPageSize && explicitPageSize !== defaultSize) {
        searchParams.set('size', String(explicitPageSize));
      }

      const searchStr = searchParams.toString();
      const newRelativeUrl = searchStr ? `/?${searchStr}` : '/';

      const currentRelativeUrl = `${window.location.pathname}${window.location.search}`;
      if (currentRelativeUrl !== newRelativeUrl) {
        window.history.replaceState(null, '', newRelativeUrl);
      }
    } catch {
      // Safe fallback in test or sandboxed environments
    }
  }, [search, topic, language, era, sort, format, page, explicitPageSize, isMobile, activeView, hasMounted]);

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
      setExplicitPageSize(parsed.explicitSize ?? null);
      setActiveView(parsed.view);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const selectedEraObjs = useMemo(() => {
    if (!era) return [];
    const eraIds = era.split(',').map((e) => e.trim()).filter(Boolean);
    return LITERARY_ERAS.filter((e) => eraIds.includes(e.id));
  }, [era]);

  const authorYearStart = useMemo(() => {
    if (selectedEraObjs.length === 0) return undefined;
    const starts = selectedEraObjs.map((e) => e.start).filter((s): s is number => s !== undefined);
    return starts.length > 0 ? Math.min(...starts) : undefined;
  }, [selectedEraObjs]);

  const authorYearEnd = useMemo(() => {
    if (selectedEraObjs.length === 0) return undefined;
    const ends = selectedEraObjs.map((e) => e.end).filter((e): e is number => e !== undefined);
    return ends.length > 0 ? Math.max(...ends) : undefined;
  }, [selectedEraObjs]);

  const queryParams = useMemo<CatalogQueryParams>(() => {
    const subPagesPerBatch = Math.max(1, Math.floor(32 / pageSize));
    const apiPage = Math.floor((page - 1) / subPagesPerBatch) + 1;

    return {
      search: search || undefined,
      topic: topic || undefined,
      languages: language || undefined,
      authorYearStart,
      authorYearEnd,
      sort: sort || undefined,
      mimeType: format || undefined,
      page: apiPage,
      copyright: false as const,
    };
  }, [search, topic, language, authorYearStart, authorYearEnd, sort, format, page, pageSize]);

  const activeFilterChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];

    if (search) {
      chips.push({ id: 'search', label: `Search: "${search}"`, type: 'search' });
    }
    if (topic) {
      const topicList = topic.split(',').map((t) => t.trim()).filter(Boolean);
      if (topicList.length === 1) {
        const facet = GENRE_FACETS.find((f) => f.id === topicList[0]);
        chips.push({ id: 'topic', label: facet ? facet.label : topicList[0], type: 'topic' });
      } else if (topicList.length > 1) {
        chips.push({ id: 'topic', label: `${topicList.length} Subjects`, type: 'topic' });
      }
    }
    if (language) {
      const langCodes = language.split(',').map((l) => l.trim()).filter(Boolean);
      if (langCodes.length === 1) {
        const lang = CATALOG_LANGUAGES.find((l) => l.value === langCodes[0]);
        chips.push({ id: 'language', label: lang ? lang.label : langCodes[0].toUpperCase(), type: 'language' });
      } else if (langCodes.length > 1) {
        chips.push({ id: 'language', label: `${langCodes.length} Languages`, type: 'language' });
      }
    }
    if (era) {
      const eraList = era.split(',').map((e) => e.trim()).filter(Boolean);
      if (eraList.length === 1) {
        const eraObj = LITERARY_ERAS.find((e) => e.id === eraList[0]);
        chips.push({ id: 'era', label: eraObj ? eraObj.label : eraList[0], type: 'era' });
      } else if (eraList.length > 1) {
        chips.push({ id: 'era', label: `${eraList.length} Historical Eras`, type: 'era' });
      }
    }
    if (format) {
      const formatList = format.split(',').map((f) => f.trim()).filter(Boolean);
      if (formatList.length === 1) {
        const fmt = FORMAT_FILTERS.find((f) => f.value === formatList[0]);
        chips.push({ id: 'format', label: fmt ? fmt.label : 'Format Filter', type: 'format' });
      } else if (formatList.length > 1) {
        chips.push({ id: 'format', label: `${formatList.length} Formats`, type: 'format' });
      }
    }

    return chips;
  }, [search, topic, language, era, format]);

  const handleSearchChange = useCallback((val: string) => {
    const cleanVal = val.trim().replace(/\s+/g, ' ');
    setSearch(cleanVal);
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

  const handlePageSizeChange = useCallback((newSize: number) => {
    if (newSize === pageSize) return;
    const currentFirstBookIndex = (page - 1) * pageSize;
    const newPage = Math.max(1, Math.floor(currentFirstBookIndex / newSize) + 1);
    setExplicitPageSize(newSize);
    setPrevPageSize(newSize);
    setPage(newPage);
  }, [page, pageSize]);

  const handleApplyFilters = useCallback((filters: {
    era?: string;
    sort?: CatalogSortOption;
    topic?: string;
    language?: string;
    format?: string;
  }) => {
    if (filters.era !== undefined) setEra(filters.era);
    if (filters.sort !== undefined) setSort(filters.sort);
    if (filters.topic !== undefined) setTopic(filters.topic);
    if (filters.language !== undefined) setLanguage(filters.language);
    if (filters.format !== undefined) setFormat(filters.format);
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
    selectedEraObjs,
    selectedEraObj: selectedEraObjs[0] || null,
    queryParams,
    activeFilterChips,
    isMobile,

    // Actions & Setters
    setActiveView,
    setPage,
    setPageSize: handlePageSizeChange,
    setViewMode,
    setIsFilterDrawerOpen,
    handleSearchChange,
    handleTopicChange,
    handleLanguageChange,
    handleEraChange,
    handleSortChange,
    handleFormatChange,
    handleApplyFilters,
    handleResetAllFilters,
    removeFilterChip,
  };
}

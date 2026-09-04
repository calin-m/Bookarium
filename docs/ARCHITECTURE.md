# Architecture Matrix & Living Technical Reference — Bookarium

> **Auto-Generated Living Architecture**: Programmatically compiled from Source AST.  
> **Last Synchronized**: `2026-09-04`  
> **Topology Health**: `130` Modules Analyzed • `407` Static Linkages • `0` Circular Dependencies • `0` Orphaned Modules

---

## 🏛️ System Architecture & Data Flow

Bookarium is built on a **100% Pure Live API Architecture** with real-time telemetry, zero local mock archives, and deterministic state isolation.

```mermaid
flowchart TD
    User["👤 Reader / Public Domain Explorer"]
    
    subgraph FrontendSPA ["Client SPA Layer (Next.js 16 App Router)"]
        Nav["Navbar.tsx\n(Brand Reset, Navigation Tabs, Theme Cycler)"]
        Hero["HeroSearch.tsx\n(Dynamic 3D Rotating Spotlight & Search)"]
        Toolbar["StickyCatalogToolbar.tsx\n(0px Flush Header, Filters Toggle, Telemetry)"]
        FilterDrawer["AdvancedFilterDrawer.tsx\n(Left Push-Sidebar: Eras, Sort, Formats)"]
        Grid["BookGrid.tsx\n(Editorial Card Grid & 3D Wooden Shelf)"]
        ReaderPage["Dedicated Reader Page (/read/[id])\n(Multi-Tier Meta, Chapter AST, Virtual Pagination)"]
        Downloads["DownloadDrawer.tsx\n(EPUB, MOBI, TXT Direct Streams)"]
        
        StoreShelf[("⚡ Bookshelf Store\n(localStorage: saved, likes, queue, history)")]
        StoreReader[("📖 Reader Store\n(localStorage: theme, typography, progress map)")]
        StoreTheme[("🎨 Theme Store\n(localStorage: day, sepia, obsidian)")]
        
        QueryBooks["🔄 useBooks(search, topic, page, sort, era)"]
        QueryContent["🔄 useBookContent(url, bookId)"]
    end

    subgraph ServerLayer ["Next.js Edge Proxy Layer"]
        ProxyBooks["GET /api/books\n(SWR 120s Cache, Latency Tracking, copyright=false)"]
        ProxyContent["GET /api/books/content\n(Unabridged Text Stream, SWR 24h)"]
    end

    subgraph UpstreamServices ["100% Public Domain Gutenberg Network"]
        Gutendex["🌐 Gutendex Search API\n(70,000+ Zero-Copyright Volumes)"]
        GutenbergCDN["🌐 Project Gutenberg CDN\n(Official EPUB & Raw Plain-Text)"]
    end

    User <--> Nav
    User <--> Hero
    User <--> Toolbar
    Toolbar --> FilterDrawer
    Toolbar --> Grid
    Grid --> ReaderPage
    Grid --> Downloads
    
    Toolbar --> QueryBooks
    QueryBooks --> ProxyBooks
    ProxyBooks --> Gutendex
    QueryBooks -.->|Client Failover on 504| Gutendex
    
    ReaderPage --> QueryContent
    QueryContent --> ProxyContent
    ProxyContent --> GutenbergCDN
    
    Grid --> StoreShelf
    Nav --> StoreShelf
    Nav --> StoreTheme
    ReaderPage --> StoreReader
```

---

## 🧩 Component Catalog & Props Interface Matrix

Auto-extracted from Component TypeScript interfaces:

| Component | Exported Props Interface | Primary Props & Signals | Architectural Role |
| :--- | :--- | :--- | :--- |
| **`HeroSearch`** | `HeroSearchProps` | `search`, `onSearchChange`, `selectedTopic`, `selectedLanguage`, `onReadFeaturedBook` | Dynamic rotating 3D book spotlight, unified search bar, and popular topic pills |
| **`StickyCatalogToolbar`** | `StickyCatalogToolbarProps` | `page`, `onPageChange`, `viewMode`, `onOpenFilters`, `isFiltersOpen`, `activeFilterChips`, `latencyMs` | 0px flush sticky toolbar with live latency telemetry and filter toggle |
| **`BookCard`** | `BookCardProps` | `book`, `onDownloadClick` | Open-book skeuomorphic cover, like/save actions, and instant reader handoff |
| **`BookGrid`** | `BookGridProps` | `books`, `isLoading`, `isError`, `page`, `viewMode`, `onViewModeChange`, `onDownloadClick` | Responsive catalog container toggling between Editorial Grid and 3D Shelf |
| **`BookshelfRack`** | `BookshelfRackProps` | `books`, `onRemoveBook`, `onDownloadClick` | Skeuomorphic wooden shelf with embossed vertical book spines and touch panning |
| **`AdvancedFilterDrawer`** | `AdvancedFilterDrawerProps` | `isOpen`, `onClose`, `selectedEra`, `selectedSort`, `selectedTopic`, `selectedLanguage`, `selectedFormat` | Collapsible left-side filter sidebar with desktop smooth push transition |
| **`DownloadDrawer`** | `DownloadDrawerProps` | `book`, `isOpen`, `onClose` | Multi-format download hub (EPUB, MOBI, Plain Text, HTML) |
| **`Navbar`** | `NavbarProps` | `activeView`, `onViewChange` | Top brand header, live badge counters, view switcher, and theme cycler |
| **`LiteraryQuotes`** | _Autonomous_ | None (Internal Shuffle State) | 3-column classic literary passage showcase with shuffle discovery |
| **`ReaderHeader`** | `ReaderHeaderProps` | `title`, `author`, `activeChapterTitle`, `readingMode`, `currentVolumeNumber` | Focus reader header with dual-mode `[ ⇄ Info ]` metadata switcher |
| **`ReaderControls`** | `ReaderControlsProps` | `isOpen`, `fontSize`, `fontFamily`, `lineHeight`, `theme`, `columnWidth` | Compact typography and reading mode customization popover (0 scrollbars) |
| **`ReaderTocDrawer`** | `ReaderTocDrawerProps` | `isOpen`, `chapters`, `activeChapterIndex`, `onSelectChapter` | Table of Contents slide-over with page numbers and transparent backdrop |
| **`ReaderSurface`** | `ReaderSurfaceProps` | `content`, `fontSize`, `fontFamily`, `lineHeight`, `columnWidth`, `currentPage` | Fluid paragraph reflow engine with continuous virtual page spreads |
| **`ReaderFooter`** | `ReaderFooterProps` | `currentPage`, `totalPages`, `progressPercentage`, `onPageJump` | Thin sticky bottom pagination bar with direct page jump input |

---

## ⚡ State Management & Store Architecture

Zustand client-side state stores with persistent browser storage:

### 1. `useBookshelfStore` (`src/stores/useBookshelfStore.ts`)
* **Storage Key**: `bookarium-bookshelf` (localStorage)
* **State Tree**:
  * `savedBooks: GutendexBook[]` — Books saved to personal collection.
  * `likedBookIds: number[]` — IDs of favorited masterworks.
  * `readingQueue: GutendexBook[]` — Up next reading list.
  * `readingHistory: ReadingHistoryEntry[]` — Timeline of recently read volumes with timestamps.
* **Core Actions**: `saveBook`, `removeBook`, `toggleSave`, `toggleLike`, `addToQueue`, `removeFromQueue`, `recordHistory`, `clearAllBooks`.

### 2. `useReaderStore` (`src/stores/useReaderStore.ts`)
* **Storage Keys**: `bookarium-reader-preferences`, `bookarium-progress-map` (localStorage)
* **State Tree**:
  * `currentBook: GutendexBook | null` — Active book metadata payload.
  * `fontSize: number` — Active font size (12px–36px, default 18px).
  * `fontFamily: 'serif' | 'sans' | 'mono'` — Active font pairing.
  * `lineHeight: number` — Active line height (1.2–2.6, default 1.8).
  * `theme: 'light' | 'sepia' | 'dark'` — Active reader theme.
  * `columnWidth: 'narrow' | 'normal' | 'wide'` — Reading column width (576px / 768px / 1024px).
  * `readingMode: 'page' | 'scroll'` — Virtual paginated vs. vertical scroll.
  * `progress: Record<number, BookProgress>` — Per-book percentage and chapter bookmarks.
* **Core Actions**: `openReader`, `closeReader`, `setFontSize`, `setFontFamily`, `setLineHeight`, `setTheme`, `setColumnWidth`, `setReadingMode`, `saveProgress`.

### 3. `useThemeStore` (`src/stores/useThemeStore.ts`)
* **Storage Key**: `bookarium-theme` (localStorage)
* **State Tree**: `theme: 'light' | 'dark' | 'sepia'`
* **Core Actions**: `setTheme`, `cycleTheme`, `applyThemeToDocument`.

---

## 🌐 API Routes, Query Hooks & Network Contracts

| Endpoint / Hook | Method / Layer | Query Parameters | Cache & Fallback Strategy | Upstream Target |
| :--- | :--- | :--- | :--- | :--- |
| **`/api/books`** | `GET` (Route) | `search`, `topic`, `languages`, `page`, `sort`, `author_year_start`, `author_year_end`, `mime_type`, `ids` | `s-maxage=120, stale-while-revalidate=600` • Real-time latency tracking | `https://gutendex.com/books/` |
| **`/api/books/content`** | `GET` (Route) | `url`, `id` | `s-maxage=86400, stale-while-revalidate=604800` • UTF-8 plain text streaming | `https://www.gutenberg.org/cache/epub/{id}/pg{id}.txt` |
| **`useBooks`** | TanStack Query | `{ search, topic, languages, page, sort, era, mimeType, enabled }` | `placeholderData: keepPreviousData` • 5m staleTime • Direct client failover on 504 | `/api/books` $\to$ Gutendex |
| **`useBookContent`** | TanStack Query | `{ textUrl, bookId, enabled }` | 24h cache • Automated Gutenberg chapter AST parsing | `/api/books/content` $\to$ Gutenberg CDN |

---

## 📚 Curated Configurations & Design Token Registry

* **`FEATURED_HERO_BOOKS`** (`src/config/featured-books.ts`): 10 curated classic masterpieces (*Pride and Prejudice, Frankenstein, Moby Dick, The Great Gatsby, Alice in Wonderland, Dorian Gray, Sherlock Holmes, Dracula, A Tale of Two Cities, The Time Machine*) with verified volume numbers and quotes.
* **`LITERARY_ERAS`** (`src/config/catalog-filters.ts`): 6 historical eras spanning from Antiquity (-800 to 500) to Mid-20th Century (1914 to 1960).
* **`GENRE_FACETS`** (`src/config/catalog-filters.ts`): Curated genre tags (Gothic & Horror, Philosophy, Adventure, Sci-Fi, Poetry, Drama, Detective & Mystery, History).
* **`READER_THEMES`** (`src/config/reader-themes.ts`): 3 reading themes (Day Paper, Sepia Parchment, Obsidian Dark) with color tokens for background, text, borders, and accents.
* **`LITERARY_QUOTES`** (`src/config/literary-quotes.ts`): 12 literary passages and opening lines from immortal masterworks.

---

## 🔗 AST Module Interconnection & Topology Matrix

Every source file is analyzed for upstream imports and downstream consumers to guarantee zero orphaned or unlinked code:

| Module / Component | Upstream Dependencies (Imports) | Downstream Consumers (Consumed By) | Role & Responsibilities |
| :--- | :--- | :--- | :--- |
| [`page.tsx`](src/app/account/page.tsx) | `stores/useAuthStore`, `stores/useBookshelfStore`, `stores/useAnnotationStore`, `stores/useReaderStore`, `stores/useThemeStore`, `stores/usePreferencesStore`, `hooks/useScrollDirection`, `components/presentation/Navbar`, `components/presentation/Footer`, `components/ui/Button`, `components/ui/BackToTop`, `components/account/AccountIdentityCard`, `components/account/AccountLibraryStats`, `components/account/AccountSecuritySection`, `components/account/AccountPreferencesSection`, `components/account/AccountDeleteModal`, `lib/password`, `config/routes` | _App Route Entry_ | Production Module |
| [`route.ts`](src/app/api/books/content/route.ts) | `config/site-config`, `lib/rate-limiter` | _App Route Entry_ | Production Module |
| [`route.ts`](src/app/api/books/route.ts) | `config/api-endpoints`, `types/book.types`, `lib/rate-limiter` | _App Route Entry_ | Production Module |
| [`route.ts`](src/app/api/translate/route.ts) | `lib/rate-limiter`, `config/site-config` | `usePageTranslation.ts` | Production Module |
| [`route.ts`](src/app/auth/callback/route.ts) | `lib/supabase/server` | _App Route Entry_ | Production Module |
| [`page.tsx`](src/app/auth/confirm-deletion/page.tsx) | `stores/useAuthStore`, `components/presentation/Navbar`, `components/presentation/Footer`, `components/ui/Button`, `config/routes` | _App Route Entry_ | Production Module |
| [`error.tsx`](src/app/error.tsx) | `components/ui/Button`, `config/routes` | _Direct Root Consumer_ | Production Module |
| [`global-error.tsx`](src/app/global-error.tsx) | _Root Primitive_ | _Direct Root Consumer_ | Production Module |
| [`layout.tsx`](src/app/layout.tsx) | `./providers`, `config/site-config`, `./globals.css` | _App Route Entry_ | Production Module |
| [`manifest.ts`](src/app/manifest.ts) | `config/site-config` | _Direct Root Consumer_ | Production Module |
| [`not-found.tsx`](src/app/not-found.tsx) | `components/ui/Button`, `config/routes` | _Direct Root Consumer_ | Production Module |
| [`page.tsx`](src/app/page.tsx) | `components/presentation/Navbar`, `components/presentation/HeroSearch`, `components/presentation/StickyCatalogToolbar`, `components/presentation/AdvancedFilterDrawer`, `components/presentation/BookGrid`, `components/presentation/LiteraryQuotes`, `components/presentation/DownloadDrawer`, `components/presentation/BookPreviewModal`, `components/presentation/bookshelf/BookshelfMobileModal`, `components/presentation/NotebookView`, `components/presentation/BookmarksView`, `components/ui/Modal`, `components/ui/SectionHeader`, `components/presentation/Footer`, `components/ui/BackToTop`, `hooks/queries/useBooks`, `hooks/useCatalogFilters`, `hooks/useScrollDirection`, `stores/useBookshelfStore`, `stores/useReaderStore`, `stores/usePreferencesStore`, `hooks/useOfflineBooks`, `hooks/useHasMounted`, `types/book.types`, `components/ui/Button`, `components/presentation/CollectionSearchBar`, `lib/smart-search`, `config/routes` | _App Route Entry_ | Production Module |
| [`page.tsx`](src/app/privacy/page.tsx) | `components/presentation/Navbar`, `components/presentation/Footer`, `config/routes`, `config/site-config` | _App Route Entry_ | Production Module |
| [`providers.tsx`](src/app/providers.tsx) | `stores/useAuthStore`, `stores/useBookshelfStore`, `stores/useAnnotationStore`, `components/auth/AuthModal`, `components/pwa/ServiceWorkerRegister` | _Direct Root Consumer_ | Production Module |
| [`page.tsx`](src/app/read/[id]/page.tsx) | `hooks/queries/useBookContent`, `hooks/queries/useBooks`, `hooks/queries/useBookTranslations`, `hooks/queries/usePageTranslation`, `stores/useReaderStore`, `stores/useThemeStore`, `hooks/useHasMounted`, `types/book.types`, `lib/gutenberg-parser`, `hooks/reader/useGutenbergParserWorker`, `config/reader-themes`, `lib/book-metadata`, `components/reader/ReaderHeader`, `components/reader/ReaderFooter`, `components/reader/ReaderTocDrawer`, `components/reader/ReaderSearchDrawer`, `components/reader/ReaderControls`, `components/reader/ReaderLanguageDrawer`, `components/reader/ReaderSpeechBar`, `components/reader/ReaderSurface`, `components/reader/TextHighlightPopover`, `components/reader/ReaderAnnotationsDrawer`, `hooks/reader/useReaderDrawers`, `hooks/reader/useReaderSpeech`, `hooks/reader/useReaderSession`, `stores/usePreferencesStore`, `stores/useAnnotationStore`, `stores/useAuthStore`, `stores/useBookshelfStore`, `components/ui/StarRating`, `components/ui/Modal`, `components/ui/Button`, `config/routes` | _App Route Entry_ | Production Module |
| [`AccountDeleteModal.tsx`](src/components/account/AccountDeleteModal.tsx) | `components/ui/Modal`, `components/ui/Button` | `page.tsx` | Production Module |
| [`AccountIdentityCard.tsx`](src/components/account/AccountIdentityCard.tsx) | `types/database.types`, `components/ui/Button`, `components/ui/Input` | `page.tsx` | Production Module |
| [`AccountLibraryStats.tsx`](src/components/account/AccountLibraryStats.tsx) | `config/routes`, `config/library-tokens` | `page.tsx` | Production Module |
| [`AccountPreferencesSection.tsx`](src/components/account/AccountPreferencesSection.tsx) | `stores/useThemeStore`, `lib/speech-utils`, `lib/library-backup`, `./AccountRestoreModal` | `page.tsx` | Production Module |
| [`AccountRestoreModal.tsx`](src/components/account/AccountRestoreModal.tsx) | `components/ui/Modal`, `components/ui/Button`, `lib/library-backup` | _Direct Root Consumer_ | Production Module |
| [`AccountSecuritySection.tsx`](src/components/account/AccountSecuritySection.tsx) | `components/ui/Button`, `components/ui/Input`, `components/ui/PasswordStrengthMeter`, `lib/password` | `page.tsx` | Production Module |
| [`AuthModal.tsx`](src/components/auth/AuthModal.tsx) | `stores/useAuthStore`, `stores/useBookshelfStore`, `components/ui/Button`, `components/ui/Input`, `components/ui/PasswordStrengthMeter`, `lib/password` | `providers.tsx` | Production Module |
| [`ReadingStatusSelector.tsx`](src/components/bookshelf/ReadingStatusSelector.tsx) | `types/book.types` | `BookPreviewModal.tsx`, `BookshelfMobileModal.tsx` | Production Module |
| [`MotionReveal.tsx`](src/components/motion/MotionReveal.tsx) | `./motion-config` | _Direct Root Consumer_ | Production Module |
| [`StaggerGroup.tsx`](src/components/motion/StaggerGroup.tsx) | `./motion-config` | _Direct Root Consumer_ | Production Module |
| [`motion-config.ts`](src/components/motion/motion-config.ts) | _Root Primitive_ | _Direct Root Consumer_ | Production Module |
| [`AdvancedFilterDrawer.tsx`](src/components/presentation/AdvancedFilterDrawer.tsx) | `components/ui/Button`, `config/catalog-filters`, `./LanguageSelector` | `page.tsx` | Production Module |
| [`BookCard.tsx`](src/components/presentation/BookCard.tsx) | `hooks/useCursorTooltip`, `components/ui/CursorTooltip`, `types/book.types`, `lib/utils`, `stores/useBookshelfStore`, `stores/useReaderStore`, `components/ui/Badge`, `components/ui/Button`, `components/ui/Card`, `components/ui/StarRating`, `config/routes` | _Direct Root Consumer_ | Production Module |
| [`BookGrid.tsx`](src/components/presentation/BookGrid.tsx) | `types/book.types`, `./BookCard`, `./BookshelfRack`, `components/ui/Button` | `page.tsx` | Production Module |
| [`BookPreviewModal.tsx`](src/components/presentation/BookPreviewModal.tsx) | `types/book.types`, `hooks/useBookPassageShuffle`, `lib/utils`, `components/ui/Button`, `components/ui/StarRating`, `components/bookshelf/ReadingStatusSelector`, `stores/useBookshelfStore`, `./BookCard` | `page.tsx` | Production Module |
| [`BookmarkCard.tsx`](src/components/presentation/BookmarkCard.tsx) | `types/book.types`, `components/ui/Button`, `config/routes`, `stores/useReaderStore`, `lib/utils` | _Direct Root Consumer_ | Production Module |
| [`BookmarksView.tsx`](src/components/presentation/BookmarksView.tsx) | `hooks/reader/useContinueReadingLedger`, `hooks/useOfflineBooks`, `stores/useReaderStore`, `./BookmarkCard`, `./CollectionSearchBar`, `components/ui/Button`, `components/ui/Modal`, `components/ui/SectionHeader`, `config/routes`, `types/book.types` | `page.tsx` | Production Module |
| [`BookshelfRack.tsx`](src/components/presentation/BookshelfRack.tsx) | `types/book.types`, `stores/useBookshelfStore`, `stores/useReaderStore`, `stores/useAuthStore`, `hooks/useOfflineBooks`, `components/ui/Button`, `./bookshelf/BookshelfSpine`, `./bookshelf/BookshelfMobileModal`, `./bookshelf/BookshelfManageModals`, `config/routes` | _Direct Root Consumer_ | Production Module |
| [`CollectionSearchBar.tsx`](src/components/presentation/CollectionSearchBar.tsx) | _Root Primitive_ | `page.tsx` | Production Module |
| [`DownloadDrawer.tsx`](src/components/presentation/DownloadDrawer.tsx) | `types/book.types`, `lib/utils`, `components/ui/Modal`, `components/ui/Button`, `components/ui/Badge` | `page.tsx` | Production Module |
| [`Footer.tsx`](src/components/presentation/Footer.tsx) | `config/site-config`, `config/routes` | `page.tsx`, `page.tsx`, `page.tsx`, `page.tsx` | Production Module |
| [`HeroFeaturedBook3D.tsx`](src/components/presentation/HeroFeaturedBook3D.tsx) | `types/book.types`, `config/featured-books`, `components/ui/Button`, `hooks/useBookPassageShuffle`, `hooks/usePerformanceTier` | _Direct Root Consumer_ | Production Module |
| [`HeroSearch.tsx`](src/components/presentation/HeroSearch.tsx) | `hooks/useHasMounted`, `components/ui/Button`, `config/catalog-filters`, `config/featured-books`, `types/book.types`, `lib/utils`, `./LanguageSelector`, `./HeroFeaturedBook3D` | `page.tsx` | Production Module |
| [`LanguageSelector.tsx`](src/components/presentation/LanguageSelector.tsx) | `config/catalog-filters` | _Direct Root Consumer_ | Production Module |
| [`LiteraryQuotes.tsx`](src/components/presentation/LiteraryQuotes.tsx) | `config/literary-quotes`, `config/routes` | `page.tsx` | Production Module |
| [`Navbar.tsx`](src/components/presentation/Navbar.tsx) | `stores/useBookshelfStore`, `stores/useAnnotationStore`, `stores/useReaderStore`, `stores/useThemeStore`, `stores/useAuthStore`, `components/ui/Button`, `config/routes`, `config/site-config`, `config/library-tokens` | `page.tsx`, `page.tsx`, `page.tsx`, `page.tsx` | Production Module |
| [`NotebookView.tsx`](src/components/presentation/NotebookView.tsx) | `stores/useAnnotationStore`, `stores/useBookshelfStore`, `stores/useAuthStore`, `config/featured-books`, `hooks/queries/useBooks`, `components/ui/Button`, `components/ui/Modal`, `components/ui/SectionHeader`, `lib/book-metadata`, `lib/utils`, `types/book.types` | `page.tsx` | Production Module |
| [`StickyCatalogToolbar.tsx`](src/components/presentation/StickyCatalogToolbar.tsx) | `components/ui/Button` | `page.tsx` | Production Module |
| [`BookshelfManageModals.tsx`](src/components/presentation/bookshelf/BookshelfManageModals.tsx) | `components/ui/Button`, `components/ui/Input` | _Direct Root Consumer_ | Production Module |
| [`BookshelfMobileModal.tsx`](src/components/presentation/bookshelf/BookshelfMobileModal.tsx) | `types/book.types`, `types/database.types`, `stores/useReaderStore`, `stores/useBookshelfStore`, `components/ui/StarRating`, `components/bookshelf/ReadingStatusSelector`, `components/ui/Button`, `lib/utils`, `config/routes` | `page.tsx` | Production Module |
| [`BookshelfSpine.tsx`](src/components/presentation/bookshelf/BookshelfSpine.tsx) | `hooks/useCursorTooltip`, `components/ui/CursorTooltip`, `types/book.types`, `types/database.types`, `stores/useReaderStore`, `stores/useBookshelfStore`, `components/ui/StarRating`, `lib/utils`, `config/routes` | _Direct Root Consumer_ | Production Module |
| [`ServiceWorkerRegister.tsx`](src/components/pwa/ServiceWorkerRegister.tsx) | _Root Primitive_ | `providers.tsx` | Production Module |
| [`GutenbergInfoModal.tsx`](src/components/reader/GutenbergInfoModal.tsx) | `config/site-config`, `config/reader-themes` | _Direct Root Consumer_ | Production Module |
| [`ReaderAnnotationsDrawer.tsx`](src/components/reader/ReaderAnnotationsDrawer.tsx) | `./ReaderDrawerShell`, `components/ui/Modal`, `components/ui/Button`, `stores/useAnnotationStore`, `stores/useReaderStore`, `config/reader-themes`, `./TextHighlightPopover` | `page.tsx` | Production Module |
| [`ReaderControls.tsx`](src/components/reader/ReaderControls.tsx) | `stores/useReaderStore`, `config/reader-themes`, `config/reader-config`, `./ReaderDrawerShell` | `page.tsx` | Production Module |
| [`ReaderDrawerShell.tsx`](src/components/reader/ReaderDrawerShell.tsx) | `stores/useReaderStore`, `config/reader-themes`, `hooks/useHasMounted` | _Direct Root Consumer_ | Production Module |
| [`ReaderErrorView.tsx`](src/components/reader/ReaderErrorView.tsx) | `config/reader-themes` | _Direct Root Consumer_ | Production Module |
| [`ReaderFooter.tsx`](src/components/reader/ReaderFooter.tsx) | `stores/useReaderStore`, `config/reader-themes` | `page.tsx` | Production Module |
| [`ReaderHeader.tsx`](src/components/reader/ReaderHeader.tsx) | `stores/useReaderStore`, `config/reader-themes`, `config/featured-books`, `lib/book-metadata`, `hooks/queries/useBookTranslations`, `config/translation-languages`, `hooks/useHasMounted`, `./GutenbergInfoModal`, `./ReaderSubHeaderRibbon` | `page.tsx` | Production Module |
| [`ReaderLanguageDrawer.tsx`](src/components/reader/ReaderLanguageDrawer.tsx) | `stores/useReaderStore`, `config/reader-themes`, `hooks/queries/useBookTranslations`, `config/translation-languages`, `./ReaderDrawerShell` | `page.tsx` | Production Module |
| [`ReaderLoadingView.tsx`](src/components/reader/ReaderLoadingView.tsx) | `config/reader-themes` | _Direct Root Consumer_ | Production Module |
| [`ReaderSearchDrawer.tsx`](src/components/reader/ReaderSearchDrawer.tsx) | `lib/gutenberg-parser`, `lib/in-book-search`, `stores/useReaderStore`, `config/reader-themes`, `config/reader-config`, `./ReaderDrawerShell` | `page.tsx` | Production Module |
| [`ReaderSpeechBar.tsx`](src/components/reader/ReaderSpeechBar.tsx) | `stores/useReaderStore`, `config/reader-themes`, `lib/speech-utils` | `page.tsx` | Production Module |
| [`ReaderSubHeaderRibbon.tsx`](src/components/reader/ReaderSubHeaderRibbon.tsx) | `stores/useReaderStore`, `config/reader-themes` | _Direct Root Consumer_ | Production Module |
| [`ReaderSurface.tsx`](src/components/reader/ReaderSurface.tsx) | `stores/useReaderStore`, `lib/gutenberg-parser`, `stores/useAnnotationStore`, `config/reader-themes`, `config/reader-config`, `hooks/reader/useReaderGestures`, `./ReaderLoadingView`, `./ReaderErrorView` | `page.tsx` | Production Module |
| [`ReaderTocDrawer.tsx`](src/components/reader/ReaderTocDrawer.tsx) | `lib/gutenberg-parser`, `lib/gutenberg-parser`, `stores/useReaderStore`, `config/reader-themes`, `./ReaderDrawerShell` | `page.tsx` | Production Module |
| [`TextHighlightPopover.tsx`](src/components/reader/TextHighlightPopover.tsx) | `stores/useAnnotationStore`, `stores/useReaderStore`, `hooks/useHasMounted` | `page.tsx` | Production Module |
| [`BackToTop.tsx`](src/components/ui/BackToTop.tsx) | _Root Primitive_ | `page.tsx`, `page.tsx` | Production Module |
| [`Badge.tsx`](src/components/ui/Badge.tsx) | `lib/utils` | `BookCard.tsx`, `DownloadDrawer.tsx` | Production Module |
| [`Button.tsx`](src/components/ui/Button.tsx) | `lib/utils` | `page.tsx`, `page.tsx`, `error.tsx`, `not-found.tsx`, `page.tsx`, `page.tsx`, `AccountDeleteModal.tsx`, `AccountIdentityCard.tsx`, `AccountRestoreModal.tsx`, `AccountSecuritySection.tsx`, `AuthModal.tsx`, `AdvancedFilterDrawer.tsx`, `BookCard.tsx`, `BookGrid.tsx`, `BookmarkCard.tsx`, `BookmarksView.tsx`, `BookPreviewModal.tsx`, `BookshelfManageModals.tsx`, `BookshelfMobileModal.tsx`, `BookshelfRack.tsx`, `DownloadDrawer.tsx`, `HeroFeaturedBook3D.tsx`, `HeroSearch.tsx`, `Navbar.tsx`, `NotebookView.tsx`, `StickyCatalogToolbar.tsx`, `ReaderAnnotationsDrawer.tsx` | Production Module |
| [`Card.tsx`](src/components/ui/Card.tsx) | `lib/utils` | `BookCard.tsx` | Production Module |
| [`CursorTooltip.tsx`](src/components/ui/CursorTooltip.tsx) | _Root Primitive_ | `BookCard.tsx`, `BookshelfSpine.tsx` | Production Module |
| [`Input.tsx`](src/components/ui/Input.tsx) | `lib/utils` | `AccountIdentityCard.tsx`, `AccountSecuritySection.tsx`, `AuthModal.tsx`, `BookshelfManageModals.tsx` | Production Module |
| [`Modal.tsx`](src/components/ui/Modal.tsx) | `lib/utils` | `page.tsx`, `page.tsx`, `AccountDeleteModal.tsx`, `AccountRestoreModal.tsx`, `BookmarksView.tsx`, `DownloadDrawer.tsx`, `NotebookView.tsx`, `ReaderAnnotationsDrawer.tsx` | Production Module |
| [`PasswordStrengthMeter.tsx`](src/components/ui/PasswordStrengthMeter.tsx) | `lib/password` | `AccountSecuritySection.tsx`, `AuthModal.tsx` | Production Module |
| [`SectionHeader.tsx`](src/components/ui/SectionHeader.tsx) | `lib/utils` | `page.tsx`, `BookmarksView.tsx`, `NotebookView.tsx` | Production Module |
| [`StarRating.tsx`](src/components/ui/StarRating.tsx) | _Root Primitive_ | `page.tsx`, `BookCard.tsx`, `BookPreviewModal.tsx`, `BookshelfMobileModal.tsx`, `BookshelfSpine.tsx` | Production Module |
| [`api-endpoints.ts`](src/config/api-endpoints.ts) | _Root Primitive_ | `route.ts`, `useBookContent.ts`, `useBooks.ts`, `useOfflineBooks.ts` | Production Module |
| [`catalog-filters.ts`](src/config/catalog-filters.ts) | _Root Primitive_ | `AdvancedFilterDrawer.tsx`, `HeroSearch.tsx`, `LanguageSelector.tsx`, `useBookTranslations.ts`, `useCatalogFilters.ts` | Production Module |
| [`featured-books.ts`](src/config/featured-books.ts) | `lib/utils` | `HeroFeaturedBook3D.tsx`, `HeroSearch.tsx`, `NotebookView.tsx`, `ReaderHeader.tsx`, `useBookPassageShuffle.ts`, `book-metadata.ts` | Production Module |
| [`library-tokens.ts`](src/config/library-tokens.ts) | `config/routes` | `AccountLibraryStats.tsx`, `Navbar.tsx` | Production Module |
| [`literary-quotes.ts`](src/config/literary-quotes.ts) | _Root Primitive_ | `LiteraryQuotes.tsx` | Production Module |
| [`reader-config.ts`](src/config/reader-config.ts) | _Root Primitive_ | `ReaderControls.tsx`, `ReaderSearchDrawer.tsx`, `ReaderSurface.tsx`, `useReaderGestures.ts`, `useReaderStore.ts` | Production Module |
| [`reader-themes.ts`](src/config/reader-themes.ts) | `stores/useReaderStore` | `page.tsx`, `GutenbergInfoModal.tsx`, `ReaderAnnotationsDrawer.tsx`, `ReaderControls.tsx`, `ReaderDrawerShell.tsx`, `ReaderErrorView.tsx`, `ReaderFooter.tsx`, `ReaderHeader.tsx`, `ReaderLanguageDrawer.tsx`, `ReaderLoadingView.tsx`, `ReaderSearchDrawer.tsx`, `ReaderSpeechBar.tsx`, `ReaderSubHeaderRibbon.tsx`, `ReaderSurface.tsx`, `ReaderTocDrawer.tsx` | Production Module |
| [`routes.ts`](src/config/routes.ts) | _Root Primitive_ | `page.tsx`, `page.tsx`, `error.tsx`, `not-found.tsx`, `page.tsx`, `page.tsx`, `page.tsx`, `AccountLibraryStats.tsx`, `BookCard.tsx`, `BookmarkCard.tsx`, `BookmarksView.tsx`, `BookshelfMobileModal.tsx`, `BookshelfSpine.tsx`, `BookshelfRack.tsx`, `Footer.tsx`, `LiteraryQuotes.tsx`, `Navbar.tsx`, `library-tokens.ts`, `useAuthStore.ts` | Production Module |
| [`site-config.ts`](src/config/site-config.ts) | _Root Primitive_ | `route.ts`, `route.ts`, `layout.tsx`, `manifest.ts`, `page.tsx`, `Footer.tsx`, `Navbar.tsx`, `GutenbergInfoModal.tsx`, `useAnnotationStore.ts`, `useBookshelfStore.ts`, `usePreferencesStore.ts`, `useReaderStore.ts`, `useThemeStore.ts` | Production Module |
| [`translation-languages.ts`](src/config/translation-languages.ts) | _Root Primitive_ | `ReaderHeader.tsx`, `ReaderLanguageDrawer.tsx` | Production Module |
| [`useBookContent.ts`](src/hooks/queries/useBookContent.ts) | `mocks/handlers`, `config/api-endpoints`, `lib/offline-storage` | `page.tsx`, `useBookPassageShuffle.ts` | Production Module |
| [`useBookTranslations.ts`](src/hooks/queries/useBookTranslations.ts) | `config/catalog-filters`, `lib/book-metadata`, `types/book.types` | `page.tsx`, `ReaderHeader.tsx`, `ReaderLanguageDrawer.tsx` | Production Module |
| [`useBooks.ts`](src/hooks/queries/useBooks.ts) | `types/book.types`, `config/api-endpoints` | `page.tsx`, `page.tsx`, `NotebookView.tsx`, `useContinueReadingLedger.ts` | Production Module |
| [`usePageTranslation.ts`](src/hooks/queries/usePageTranslation.ts) | `app/api/translate/route` | `page.tsx` | Production Module |
| [`useContinueReadingLedger.ts`](src/hooks/reader/useContinueReadingLedger.ts) | `stores/useReaderStore`, `stores/useBookshelfStore`, `hooks/useHasMounted`, `hooks/queries/useBooks`, `lib/adapters/book.adapter`, `lib/book-metadata`, `types/book.types` | `BookmarksView.tsx` | Production Module |
| [`useGutenbergParserWorker.ts`](src/hooks/reader/useGutenbergParserWorker.ts) | `lib/gutenberg-parser` | `page.tsx` | Production Module |
| [`useReaderDrawers.ts`](src/hooks/reader/useReaderDrawers.ts) | _Root Primitive_ | `page.tsx` | Production Module |
| [`useReaderGestures.ts`](src/hooks/reader/useReaderGestures.ts) | `config/reader-config` | `ReaderSurface.tsx` | Production Module |
| [`useReaderSession.ts`](src/hooks/reader/useReaderSession.ts) | `stores/useReaderStore`, `stores/useAuthStore`, `lib/gutenberg-parser` | `page.tsx` | Production Module |
| [`useReaderSpeech.ts`](src/hooks/reader/useReaderSpeech.ts) | `lib/speech-utils` | `page.tsx` | Production Module |
| [`useBookPassageShuffle.ts`](src/hooks/useBookPassageShuffle.ts) | `config/featured-books`, `lib/gutenberg/passages`, `hooks/queries/useBookContent` | `BookPreviewModal.tsx`, `HeroFeaturedBook3D.tsx` | Production Module |
| [`useCatalogFilters.ts`](src/hooks/useCatalogFilters.ts) | `config/catalog-filters`, `hooks/useHasMounted` | `page.tsx` | Production Module |
| [`useCursorTooltip.ts`](src/hooks/useCursorTooltip.ts) | _Root Primitive_ | `BookCard.tsx`, `BookshelfSpine.tsx` | Production Module |
| [`useHasMounted.ts`](src/hooks/useHasMounted.ts) | _Root Primitive_ | `page.tsx`, `page.tsx`, `HeroSearch.tsx`, `ReaderDrawerShell.tsx`, `ReaderHeader.tsx`, `TextHighlightPopover.tsx`, `useContinueReadingLedger.ts`, `useCatalogFilters.ts`, `useAnnotationStore.ts`, `useBookshelfStore.ts` | Production Module |
| [`useOfflineBooks.ts`](src/hooks/useOfflineBooks.ts) | `types/book.types`, `lib/offline-storage`, `config/api-endpoints` | `page.tsx`, `BookmarksView.tsx`, `BookshelfRack.tsx` | Production Module |
| [`usePerformanceTier.ts`](src/hooks/usePerformanceTier.ts) | _Root Primitive_ | `HeroFeaturedBook3D.tsx` | Production Module |
| [`useScrollDirection.ts`](src/hooks/useScrollDirection.ts) | _Root Primitive_ | `page.tsx`, `page.tsx` | Production Module |
| [`book.adapter.ts`](src/lib/adapters/book.adapter.ts) | `types/book.types`, `lib/utils`, `lib/book-metadata` | `useContinueReadingLedger.ts` | Production Module |
| [`book-metadata.ts`](src/lib/book-metadata.ts) | `types/book.types`, `config/featured-books`, `lib/utils` | `page.tsx`, `NotebookView.tsx`, `ReaderHeader.tsx`, `useBookTranslations.ts`, `useContinueReadingLedger.ts`, `book.adapter.ts`, `useAnnotationStore.ts` | Production Module |
| [`gutenberg-parser.ts`](src/lib/gutenberg-parser.ts) | _Root Primitive_ | `page.tsx`, `ReaderSearchDrawer.tsx`, `ReaderSurface.tsx`, `ReaderTocDrawer.tsx`, `useGutenbergParserWorker.ts`, `useReaderSession.ts`, `in-book-search.ts`, `gutenberg.worker.ts` | Production Module |
| [`index.ts`](src/lib/gutenberg/index.ts) | _Root Primitive_ | _Direct Root Consumer_ | Production Module |
| [`metadata.ts`](src/lib/gutenberg/metadata.ts) | `./types` | _Direct Root Consumer_ | Production Module |
| [`pagination.ts`](src/lib/gutenberg/pagination.ts) | `./types` | _Direct Root Consumer_ | Production Module |
| [`passages.ts`](src/lib/gutenberg/passages.ts) | `./types`, `./segmentation` | `useBookPassageShuffle.ts` | Production Module |
| [`reflow.ts`](src/lib/gutenberg/reflow.ts) | _Root Primitive_ | _Direct Root Consumer_ | Production Module |
| [`segmentation.ts`](src/lib/gutenberg/segmentation.ts) | `./types`, `./reflow` | _Direct Root Consumer_ | Production Module |
| [`types.ts`](src/lib/gutenberg/types.ts) | _Root Primitive_ | _Direct Root Consumer_ | Production Module |
| [`in-book-search.ts`](src/lib/in-book-search.ts) | `lib/gutenberg-parser`, `lib/gutenberg-parser`, `lib/smart-search` | `ReaderSearchDrawer.tsx` | Production Module |
| [`library-backup.ts`](src/lib/library-backup.ts) | `stores/useBookshelfStore`, `stores/useReaderStore`, `stores/useAnnotationStore`, `stores/usePreferencesStore`, `stores/useThemeStore`, `types/book.types`, `types/database.types`, `lib/utils`, `lib/offline-storage` | `AccountPreferencesSection.tsx`, `AccountRestoreModal.tsx` | Production Module |
| [`offline-storage.ts`](src/lib/offline-storage.ts) | _Root Primitive_ | `useBookContent.ts`, `useOfflineBooks.ts`, `library-backup.ts` | Production Module |
| [`password.ts`](src/lib/password.ts) | _Root Primitive_ | `page.tsx`, `AccountSecuritySection.tsx`, `AuthModal.tsx`, `PasswordStrengthMeter.tsx` | Production Module |
| [`rate-limiter.ts`](src/lib/rate-limiter.ts) | _Root Primitive_ | `route.ts`, `route.ts`, `route.ts` | Production Module |
| [`smart-search.ts`](src/lib/smart-search.ts) | `types/book.types` | `page.tsx`, `in-book-search.ts` | Production Module |
| [`speech-utils.ts`](src/lib/speech-utils.ts) | _Root Primitive_ | `AccountPreferencesSection.tsx`, `ReaderSpeechBar.tsx`, `useReaderSpeech.ts` | Production Module |
| [`client.ts`](src/lib/supabase/client.ts) | `types/database.types` | `useAnnotationStore.ts`, `useAuthStore.ts`, `useBookshelfStore.ts`, `useReaderStore.ts` | Production Module |
| [`middleware.ts`](src/lib/supabase/middleware.ts) | `types/database.types`, `./client` | `proxy.ts` | Production Module |
| [`server.ts`](src/lib/supabase/server.ts) | `types/database.types`, `./client` | `route.ts` | Production Module |
| [`utils.ts`](src/lib/utils.ts) | _Root Primitive_ | `BookCard.tsx`, `BookmarkCard.tsx`, `BookPreviewModal.tsx`, `BookshelfMobileModal.tsx`, `BookshelfSpine.tsx`, `DownloadDrawer.tsx`, `HeroSearch.tsx`, `NotebookView.tsx`, `Badge.tsx`, `Button.tsx`, `Card.tsx`, `Input.tsx`, `Modal.tsx`, `SectionHeader.tsx`, `featured-books.ts`, `book.adapter.ts`, `book-metadata.ts`, `library-backup.ts`, `useAnnotationStore.ts` | Production Module |
| [`proxy.ts`](src/proxy.ts) | `lib/supabase/middleware` | _Direct Root Consumer_ | Production Module |
| [`useAnnotationStore.ts`](src/stores/useAnnotationStore.ts) | `config/site-config`, `lib/supabase/client`, `hooks/useHasMounted`, `lib/book-metadata`, `lib/utils` | `page.tsx`, `providers.tsx`, `page.tsx`, `Navbar.tsx`, `NotebookView.tsx`, `ReaderAnnotationsDrawer.tsx`, `ReaderSurface.tsx`, `TextHighlightPopover.tsx`, `library-backup.ts` | Production Module |
| [`useAuthStore.ts`](src/stores/useAuthStore.ts) | `lib/supabase/client`, `types/database.types`, `config/routes` | `page.tsx`, `page.tsx`, `providers.tsx`, `page.tsx`, `AuthModal.tsx`, `BookshelfRack.tsx`, `Navbar.tsx`, `NotebookView.tsx`, `useReaderSession.ts` | Production Module |
| [`useBookshelfStore.ts`](src/stores/useBookshelfStore.ts) | `types/book.types`, `hooks/useHasMounted`, `lib/supabase/client`, `types/database.types`, `config/site-config`, `./useAuthStore`, `./useReaderStore` | `page.tsx`, `page.tsx`, `providers.tsx`, `page.tsx`, `AuthModal.tsx`, `BookCard.tsx`, `BookPreviewModal.tsx`, `BookshelfMobileModal.tsx`, `BookshelfSpine.tsx`, `BookshelfRack.tsx`, `Navbar.tsx`, `NotebookView.tsx`, `useContinueReadingLedger.ts`, `library-backup.ts` | Production Module |
| [`usePreferencesStore.ts`](src/stores/usePreferencesStore.ts) | `config/site-config` | `page.tsx`, `page.tsx`, `page.tsx`, `library-backup.ts` | Production Module |
| [`useReaderStore.ts`](src/stores/useReaderStore.ts) | `types/book.types`, `./useThemeStore`, `./useAuthStore`, `lib/supabase/client`, `config/site-config`, `config/reader-config` | `page.tsx`, `page.tsx`, `page.tsx`, `BookCard.tsx`, `BookmarkCard.tsx`, `BookmarksView.tsx`, `BookshelfMobileModal.tsx`, `BookshelfSpine.tsx`, `BookshelfRack.tsx`, `Navbar.tsx`, `ReaderAnnotationsDrawer.tsx`, `ReaderControls.tsx`, `ReaderDrawerShell.tsx`, `ReaderFooter.tsx`, `ReaderHeader.tsx`, `ReaderLanguageDrawer.tsx`, `ReaderSearchDrawer.tsx`, `ReaderSpeechBar.tsx`, `ReaderSubHeaderRibbon.tsx`, `ReaderSurface.tsx`, `ReaderTocDrawer.tsx`, `TextHighlightPopover.tsx`, `reader-themes.ts`, `useContinueReadingLedger.ts`, `useReaderSession.ts`, `library-backup.ts` | Production Module |
| [`useThemeStore.ts`](src/stores/useThemeStore.ts) | `config/site-config` | `page.tsx`, `page.tsx`, `AccountPreferencesSection.tsx`, `Navbar.tsx`, `library-backup.ts` | Production Module |
| [`book.types.ts`](src/types/book.types.ts) | _Root Primitive_ | `route.ts`, `page.tsx`, `page.tsx`, `ReadingStatusSelector.tsx`, `BookCard.tsx`, `BookGrid.tsx`, `BookmarkCard.tsx`, `BookmarksView.tsx`, `BookPreviewModal.tsx`, `BookshelfMobileModal.tsx`, `BookshelfSpine.tsx`, `BookshelfRack.tsx`, `DownloadDrawer.tsx`, `HeroFeaturedBook3D.tsx`, `HeroSearch.tsx`, `NotebookView.tsx`, `useBooks.ts`, `useBookTranslations.ts`, `useContinueReadingLedger.ts`, `useOfflineBooks.ts`, `book.adapter.ts`, `book-metadata.ts`, `library-backup.ts`, `smart-search.ts`, `useBookshelfStore.ts`, `useReaderStore.ts` | Production Module |
| [`database.types.ts`](src/types/database.types.ts) | _Root Primitive_ | `AccountIdentityCard.tsx`, `BookshelfMobileModal.tsx`, `BookshelfSpine.tsx`, `library-backup.ts`, `client.ts`, `middleware.ts`, `server.ts`, `useAuthStore.ts`, `useBookshelfStore.ts` | Production Module |
| [`gutenberg.worker.ts`](src/workers/gutenberg.worker.ts) | `lib/gutenberg-parser` | _Direct Root Consumer_ | Production Module |

---

## ⚡ Data Pulling & Caching Strategy

1. **100% Pure Live API Queries**: All catalog items are retrieved in real-time from Project Gutenberg (`https://gutendex.com/books/`).
2. **2-Part Visible Telemetry**: `StickyCatalogToolbar.tsx` renders live API connectivity status alongside exact roundtrip latency in milliseconds.
3. **Customizable Batch Sizing**: Readers can dynamically toggle batch sizes (`Show: [8 | 16 | 24 | 32]`) without page reloads.
4. **Edge SWR Caching**: Common queries are cached with `s-maxage=120, stale-while-revalidate=600` for sub-10ms response times on repeated visits.
5. **On-Demand Text Streaming**: Large book texts (2MB–5MB) are fetched strictly when the focus reader opens.

---

## 🔒 Verification & Compliance

This architecture document is verified deterministically by **Pass 4 of the 7-Gateway Quality Engine** (`npm run verify`).

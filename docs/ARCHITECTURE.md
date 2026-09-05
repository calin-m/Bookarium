# Architecture Matrix & Living Technical Reference — Bookarium

> **Auto-Generated Living Architecture**: Programmatically compiled from Source AST via `scripts/lib/ast-parser.js` (Governance Rule 2).  
> **Last Synchronized**: `2026-09-05`  
> **Topology Health**: `135` Modules Analyzed • `424` Static Linkages • `0` Circular Dependencies • `0` Orphaned Modules

---

## 🏛️ System Architecture & Data Flow

Bookarium is built on a **100% Pure Live API Architecture** with real-time telemetry, zero local mock archives, and deterministic state isolation.

```mermaid
flowchart TD
    User["👤 Reader / Public Domain Scholar"]
    
    subgraph FrontendSPA ["Client SPA Layer (Next.js 16 App Router)"]
        Nav["Navbar.tsx\n(Brand Reset, View Switcher, Theme Cycler)"]
        Hero["HeroSearch.tsx\n(Dynamic 3D Rotating Spotlight & Search)"]
        Toolbar["StickyCatalogToolbar.tsx\n(0px Flush Header, Filters Toggle, Telemetry)"]
        FilterDrawer["AdvancedFilterDrawer.tsx\n(Left Push-Sidebar: Eras, Sort, Formats)"]
        
        subgraph Views ["Primary Application Views (/ & Edge Rewrites)"]
            Grid["Catalog View (/)\n(Editorial Card Grid & 3D Hardwood Shelf)"]
            ShelfView["Bookshelf View (/bookshelf)\n(Curated Library & Custom Named Shelves)"]
            FavView["Favorites View (/favorites)\n(Personal Masterworks Collection)"]
            MarksView["Bookmarks View (/bookmarks)\n(Tactile Reading Ledger & Telemetry)"]
            NoteView["Commonplace Notebook (/notebook)\n(Highlights, Reflections & Tags)"]
            AccView["Account Hub (/account)\n(Library Stats, Cloud Sync & JSON Backup)"]
            ReaderPage["Focus Reader Page (/read/[id])\n(Continuous Pagination, Subtitles, AST)"]
        end
        
        subgraph ReaderDrawers ["Portaled Mutual-Exclusion Dialogs (z-[10000])"]
            TocDrawer["ReaderTocDrawer\n(Rich Subtitles & Page Numbers)"]
            SearchDrawer["ReaderSearchDrawer\n(In-Volume Live Text Search)"]
            ControlsDrawer["ReaderControls\n(Typography, Speech & Themes)"]
            LangDrawer["ReaderLanguageDrawer\n(International Editions Handoff)"]
            DownDrawer["DownloadDrawer\n(EPUB, MOBI, TXT Direct Streams)"]
        end
        
        subgraph StateStores ["Zustand Persistent State & Offline Engine"]
            StoreShelf[("⚡ useBookshelfStore\n(saved, likes, queue, history, shelves)")]
            StoreReader[("📖 useReaderStore\n(typography, progress map, coordinates)")]
            StoreTheme[("🎨 useThemeStore\n(day, sepia, obsidian)")]
            StoreAuth[("🔐 useAuthStore\n(session, cloud migration, profile)")]
            StorePref[("⚙️ usePreferencesStore\n(sticky scroll, layout choices)")]
            StoreAnnot[("🖍️ useAnnotationStore\n(pastel highlights, notes, tags)")]
            StoreOffline[("📦 IndexedDB Engine\n(unabridged offline volume cache)")]
        end
        
        subgraph ReaderEngine ["Reader Runtime & Web Speech Subsystem"]
            SpeechHook["🔊 useReaderSpeech\n(SpeechSynthesis, Boundary Sync, Auto-Flip)"]
            WorkerHook["⚙️ useGutenbergParserWorker\n(Persistent Worker Chapter AST)"]
            LedgerHook["🔖 useContinueReadingLedger\n(Two-Way Hydration & 0ms Resume)"]
        end
        
        QueryBooks["🔄 useBooks & usePrefetchNextPage\n(Windowed Sub-Pages & Predictive Prefetch)"]
        QueryContent["🔄 useBookContent(url, bookId)\n(IndexedDB Check -> CDN Stream)"]
        QueryTranslate["🌐 useBookTranslations\n(International Editions Aggregation)"]
        Telemetry["📊 Vercel Telemetry\n(<Analytics />, <SpeedInsights />)"]
    end

    subgraph ServerLayer ["Next.js Edge Proxy & Telemetry Layer"]
        ProxyBooks["GET /api/books\n(SWR 120s Cache, Latency Tracking, Rate Limit)"]
        ProxyContent["GET /api/books/content\n(Unabridged Text Stream, Anti-SSRF, SWR 24h)"]
        ProxyTranslate["POST /api/translate\n(Neural MT Proxy, 40+ Languages)"]
        LayoutServer["Server Layout (/read/[id])\n(React.cache, ISR 24h, OpenGraph, JSON-LD)"]
    end

    subgraph UpstreamServices ["100% Public Domain & Cloud Infrastructure"]
        Gutendex["🌐 Gutendex Search API\n(70,000+ Zero-Copyright Volumes)"]
        GutenbergCDN["🌐 Project Gutenberg CDN\n(Official EPUB & Raw Plain-Text)"]
        GoogleNMT["🌐 Google Neural MT\n(Serverless AI Translation)"]
        SupabaseCloud[("⚡ Supabase Cloud\n(Postgres RLS, Auth, reading_progress)")]
        VercelEdge["⚡ Vercel Edge Platform\n(Cookie-less Analytics & Speed Insights)"]
    end

    User <--> Nav
    User <--> Hero
    User <--> Toolbar
    Toolbar --> FilterDrawer
    Toolbar --> Grid
    Nav --> Views
    
    Grid --> QueryBooks
    QueryBooks --> ProxyBooks
    ProxyBooks --> Gutendex
    QueryBooks -.->|Client Failover on 504| Gutendex
    
    ReaderPage --> QueryContent
    ReaderPage --> ReaderDrawers
    ReaderPage --> ReaderEngine
    QueryContent --> ProxyContent
    ProxyContent --> GutenbergCDN
    ReaderPage --> QueryTranslate
    QueryTranslate --> ProxyTranslate
    ProxyTranslate --> GoogleNMT
    
    Views --> StateStores
    ReaderEngine --> StateStores
    StoreShelf <-->|Cloud Sync (RLS)| SupabaseCloud
    StoreReader <-->|Progress Sync| SupabaseCloud
    StoreAuth <-->|Session Auth| SupabaseCloud
    Telemetry -.->|Anonymous Metrics| VercelEdge
```

---

## 🧩 Component Catalog & Props Interface Matrix

Auto-extracted dynamically from **57 Production UI Components** using Babel AST:

| Component | Category | Exported Props Interface | Primary Props & Signals | Module Link |
| :--- | :--- | :--- | :--- | :--- |
| **`AccountDeleteModal`** | Account | `AccountDeleteModalProps` | `isOpen`, `onClose`, `userEmail`, `isSendingDeletionEmail`, `deletionEmailSent`, `deleteError`, `onRequestDeletion` | [`src/components/account/AccountDeleteModal.tsx`](src/components/account/AccountDeleteModal.tsx) |
| **`AccountIdentityCard`** | Account | `AccountIdentityCardProps` | `user`, `profile`, `formattedDate`, `displayName`, `onDisplayNameChange`, `onSaveProfile`, `isSaving`, `saveSuccess`, `saveError`, `onResendVerification`, `isResendingVerification`, `resendSuccess`, `resendError`, `resendCooldown` | [`src/components/account/AccountIdentityCard.tsx`](src/components/account/AccountIdentityCard.tsx) |
| **`AccountLibraryStats`** | Account | `AccountLibraryStatsProps` | `savedCount`, `favoriteCount`, `customShelvesCount`, `annotationCount`, `bookmarksCount` | [`src/components/account/AccountLibraryStats.tsx`](src/components/account/AccountLibraryStats.tsx) |
| **`AccountPreferencesSection`** | Account | `AccountPreferencesSectionProps` | `theme`, `onThemeChange`, `stickyScrollEnabled`, `onStickyScrollChange`, `speechRate`, `onSpeechRateChange`, `speechVoiceURI`, `onSpeechVoiceChange`, `speechAutoPageAdvance`, `onSpeechAutoPageAdvanceChange`, `speechHighlightEnabled`, `onSpeechHighlightEnabledChange`, `onResetSpeechPreferences`, `userId` | [`src/components/account/AccountPreferencesSection.tsx`](src/components/account/AccountPreferencesSection.tsx) |
| **`AccountRestoreModal`** | Account | `AccountRestoreModalProps` | `isOpen`, `onClose`, `backupData`, `onRestore`, `isRestoring`, `restoreSuccess`, `restoreError` | [`src/components/account/AccountRestoreModal.tsx`](src/components/account/AccountRestoreModal.tsx) |
| **`AccountSecuritySection`** | Account | `AccountSecuritySectionProps` | `newPassword`, `confirmPassword`, `showPassword`, `copiedPassword`, `isUpdatingPassword`, `passwordSuccess`, `passwordError`, `strength`, `onNewPasswordChange`, `onConfirmPasswordChange`, `onToggleShowPassword`, `onGeneratePassword`, `onUpdatePassword`, `onSignOut`, `onOpenDeleteModal` | [`src/components/account/AccountSecuritySection.tsx`](src/components/account/AccountSecuritySection.tsx) |
| **`AuthModal`** | Auth | _Autonomous_ | None (Self-Contained) | [`src/components/auth/AuthModal.tsx`](src/components/auth/AuthModal.tsx) |
| **`ReadingStatusSelector`** | Bookshelf | `ReadingStatusSelectorProps` | `status`, `onChange`, `size`, `showClear`, `className` | [`src/components/bookshelf/ReadingStatusSelector.tsx`](src/components/bookshelf/ReadingStatusSelector.tsx) |
| **`motion-config`** | Motion | _Autonomous_ | None (Self-Contained) | [`src/components/motion/motion-config.ts`](src/components/motion/motion-config.ts) |
| **`MotionReveal`** | Motion | `MotionRevealProps` | `children`, `delay`, `className` | [`src/components/motion/MotionReveal.tsx`](src/components/motion/MotionReveal.tsx) |
| **`StaggerGroup`** | Motion | `StaggerGroupProps` | `children`, `className` | [`src/components/motion/StaggerGroup.tsx`](src/components/motion/StaggerGroup.tsx) |
| **`AdvancedFilterDrawer`** | Presentation | `AdvancedFilterDrawerProps` | `isOpen`, `onClose`, `selectedEra`, `onEraChange`, `selectedSort`, `onSortChange`, `selectedTopic`, `onTopicChange`, `selectedLanguage`, `onLanguageChange`, `selectedFormat`, `onFormatChange`, `onResetAll`, `activeFilterCount` | [`src/components/presentation/AdvancedFilterDrawer.tsx`](src/components/presentation/AdvancedFilterDrawer.tsx) |
| **`BookCard`** | Presentation | `BookCardProps` | `book`, `onDownloadClick`, `onPreviewClick`, `isPreviewActive`, `activeView` | [`src/components/presentation/BookCard.tsx`](src/components/presentation/BookCard.tsx) |
| **`BookGrid`** | Presentation | `BookGridProps` | `books`, `isLoading`, `isError`, `onRetry`, `page`, `onPageChange`, `hasNextPage`, `onDownloadClick`, `onPreviewClick`, `activePreviewBookId`, `emptyTitle`, `emptyDescription`, `viewMode`, `onViewModeChange`, `initialViewMode`, `showViewToggle`, `onBrowseCatalog`, `searchQuery`, `onClearSearch`, `activeView` | [`src/components/presentation/BookGrid.tsx`](src/components/presentation/BookGrid.tsx) |
| **`BookmarkCard`** | Presentation | `BookmarkCardProps` | `volume`, `isOffline`, `onResume`, `onStatusChange`, `onClear` | [`src/components/presentation/BookmarkCard.tsx`](src/components/presentation/BookmarkCard.tsx) |
| **`BookmarksView`** | Presentation | `BookmarksViewProps` | `onBrowseCatalog` | [`src/components/presentation/BookmarksView.tsx`](src/components/presentation/BookmarksView.tsx) |
| **`BookPreviewModal`** | Presentation | `BookPreviewModalProps` | `book`, `originRect`, `isOpen`, `activeView`, `onWillClose`, `onClose`, `onReadBook` | [`src/components/presentation/BookPreviewModal.tsx`](src/components/presentation/BookPreviewModal.tsx) |
| **`BookshelfManageModals`** | Presentation | `BookshelfManageModalsProps` | `isCreatingShelf`, `newShelfName`, `onNewShelfNameChange`, `onCloseCreateShelf`, `onCreateShelf`, `editingShelfId`, `editingShelfName`, `onEditingShelfNameChange`, `onCloseRenameShelf`, `onRenameShelf`, `deletingShelfId`, `onCloseDeleteShelf`, `onDeleteShelf`, `isClearingOfflineShelf`, `onCloseClearOfflineShelf`, `onConfirmClearOfflineShelf`, `isSubmitting` | [`src/components/presentation/bookshelf/BookshelfManageModals.tsx`](src/components/presentation/bookshelf/BookshelfManageModals.tsx) |
| **`BookshelfMobileModal`** | Presentation | `BookshelfMobileModalProps` | `selectedMobileBook`, `isClosingMobileSheet`, `onClose`, `readingProgress`, `isSaved`, `isFavorite`, `isOffline`, `onToggleSave`, `onToggleFavorite`, `onToggleOffline`, `onBookClick`, `onDownloadClick`, `cloudBookshelves`, `cloudBookshelfItems`, `defaultShelfId`, `currentActiveShelfId`, `userId`, `onMoveBookToShelf`, `activeView`, `className` | [`src/components/presentation/bookshelf/BookshelfMobileModal.tsx`](src/components/presentation/bookshelf/BookshelfMobileModal.tsx) |
| **`BookshelfRack`** | Presentation | `BookshelfRackProps` | `books`, `onBookClick`, `onDownloadClick`, `onBrowseCatalog`, `searchQuery`, `onClearSearch` | [`src/components/presentation/BookshelfRack.tsx`](src/components/presentation/BookshelfRack.tsx) |
| **`BookshelfSpine`** | Presentation | `BookshelfSpineProps` | `book`, `bookIndex`, `readingProgress`, `isSaved`, `isFavorite`, `isOffline`, `onToggleSave`, `onToggleFavorite`, `onToggleOffline`, `onSpineClick`, `onBookClick`, `onDownloadClick`, `cloudBookshelves`, `cloudBookshelfItems`, `defaultShelfId`, `currentActiveShelfId`, `userId`, `onMoveBookToShelf` | [`src/components/presentation/bookshelf/BookshelfSpine.tsx`](src/components/presentation/bookshelf/BookshelfSpine.tsx) |
| **`CollectionSearchBar`** | Presentation | `CollectionSearchBarProps` | `query`, `onQueryChange`, `placeholder`, `mobilePlaceholder`, `totalCount`, `filteredCount`, `collectionName`, `className` | [`src/components/presentation/CollectionSearchBar.tsx`](src/components/presentation/CollectionSearchBar.tsx) |
| **`DownloadDrawer`** | Presentation | `DownloadDrawerProps` | `book`, `isOpen`, `onClose` | [`src/components/presentation/DownloadDrawer.tsx`](src/components/presentation/DownloadDrawer.tsx) |
| **`Footer`** | Presentation | _Autonomous_ | None (Self-Contained) | [`src/components/presentation/Footer.tsx`](src/components/presentation/Footer.tsx) |
| **`HeroFeaturedBook3D`** | Presentation | `HeroFeaturedBook3DProps` | `featuredBook`, `onReadFeaturedBook` | [`src/components/presentation/HeroFeaturedBook3D.tsx`](src/components/presentation/HeroFeaturedBook3D.tsx) |
| **`HeroSearch`** | Presentation | `HeroSearchProps` | `search`, `onSearchChange`, `onSearch`, `selectedTopic`, `onTopicChange`, `onTopicSelect`, `selectedLanguage`, `onLanguageChange`, `onReadFeaturedBook`, `featuredBook`, `books` | [`src/components/presentation/HeroSearch.tsx`](src/components/presentation/HeroSearch.tsx) |
| **`LanguageSelector`** | Presentation | `LanguageSelectorProps` | `value`, `onChange`, `variant`, `id`, `dataTestId`, `className`, `showIcon` | [`src/components/presentation/LanguageSelector.tsx`](src/components/presentation/LanguageSelector.tsx) |
| **`LiteraryQuotes`** | Presentation | _Autonomous_ | None (Self-Contained) | [`src/components/presentation/LiteraryQuotes.tsx`](src/components/presentation/LiteraryQuotes.tsx) |
| **`Navbar`** | Presentation | `NavbarProps` | `activeView`, `onViewChange`, `isVisible` | [`src/components/presentation/Navbar.tsx`](src/components/presentation/Navbar.tsx) |
| **`NotebookView`** | Presentation | `NotebookViewProps` | `onBrowseCatalog` | [`src/components/presentation/NotebookView.tsx`](src/components/presentation/NotebookView.tsx) |
| **`StickyCatalogToolbar`** | Presentation | `StickyCatalogToolbarProps` | `page`, `onPageChange`, `hasNextPage`, `viewMode`, `onViewModeChange`, `onOpenFilters`, `isFiltersOpen`, `activeFilterCount`, `activeFilterChips`, `onClearAllFilters`, `isFetching`, `onPrefetchNext`, `latencyMs`, `isError`, `pageSize`, `onPageSizeChange`, `isHeaderVisible`, `isVisible` | [`src/components/presentation/StickyCatalogToolbar.tsx`](src/components/presentation/StickyCatalogToolbar.tsx) |
| **`ServiceWorkerRegister`** | Pwa | _Autonomous_ | None (Self-Contained) | [`src/components/pwa/ServiceWorkerRegister.tsx`](src/components/pwa/ServiceWorkerRegister.tsx) |
| **`GutenbergInfoModal`** | Reader | `GutenbergInfoModalProps` | `isOpen`, `onClose`, `bookId`, `title`, `author`, `theme` | [`src/components/reader/GutenbergInfoModal.tsx`](src/components/reader/GutenbergInfoModal.tsx) |
| **`ReaderAnnotationsDrawer`** | Reader | `ReaderAnnotationsDrawerProps` | `isOpen`, `onClose`, `annotations`, `bookTitle`, `theme`, `onJumpToAnnotation`, `onDeleteAnnotation`, `onUpdateNote` | [`src/components/reader/ReaderAnnotationsDrawer.tsx`](src/components/reader/ReaderAnnotationsDrawer.tsx) |
| **`ReaderControls`** | Reader | `ReaderControlsProps` | `isOpen`, `onClose`, `fontSize`, `onFontSizeChange`, `lineHeight`, `onLineHeightChange`, `fontFamily`, `onFontFamilyChange`, `theme`, `onThemeChange`, `readingMode`, `onReadingModeChange`, `columnWidth`, `onColumnWidthChange` | [`src/components/reader/ReaderControls.tsx`](src/components/reader/ReaderControls.tsx) |
| **`ReaderDrawerShell`** | Reader | `ReaderDrawerShellProps` | `isOpen`, `onClose`, `title`, `titleIcon`, `theme`, `children`, `ariaLabel`, `closeAriaLabel`, `backdropTestId`, `panelTestId`, `className`, `role` | [`src/components/reader/ReaderDrawerShell.tsx`](src/components/reader/ReaderDrawerShell.tsx) |
| **`ReaderErrorView`** | Reader | `ReaderErrorViewProps` | `activeTheme`, `onRetry` | [`src/components/reader/ReaderErrorView.tsx`](src/components/reader/ReaderErrorView.tsx) |
| **`ReaderFooter`** | Reader | `ReaderFooterProps` | `globalPage`, `totalBookPages`, `chapterTitle`, `chapterPage`, `chapterPageCount`, `onPrevPage`, `onNextPage`, `onPageJump`, `isPrevDisabled`, `isNextDisabled`, `readingMode`, `theme`, `currentChapterIndex`, `totalChapters`, `onSelectChapter` | [`src/components/reader/ReaderFooter.tsx`](src/components/reader/ReaderFooter.tsx) |
| **`ReaderHeader`** | Reader | `ReaderHeaderProps` | `title`, `author`, `bookId`, `progress`, `onBack`, `isTocOpen`, `onToggleToc`, `isSearchOpen`, `onToggleSearch`, `isControlsOpen`, `onToggleControls`, `isTranslationsOpen`, `onToggleTranslations`, `isSpeechOpen`, `onToggleSpeech`, `isAnnotationsOpen`, `onToggleAnnotations`, `annotationsCount`, `theme`, `totalChapters`, `currentChapterIndex`, `onThemeChange`, `resumeNotice`, `onRestart`, `onDismissResume`, `translations`, `isTranslationsLoading`, `onSelectTranslation`, `dynamicTargetLanguage`, `displayMode` | [`src/components/reader/ReaderHeader.tsx`](src/components/reader/ReaderHeader.tsx) |
| **`ReaderLanguageDrawer`** | Reader | `ReaderLanguageDrawerProps` | `isOpen`, `onClose`, `translations`, `onSelectTranslation`, `theme`, `dynamicTargetLanguage`, `onSelectDynamicLanguage`, `displayMode`, `onSelectDisplayMode`, `isTranslating` | [`src/components/reader/ReaderLanguageDrawer.tsx`](src/components/reader/ReaderLanguageDrawer.tsx) |
| **`ReaderLoadingView`** | Reader | `ReaderLoadingViewProps` | `activeTheme` | [`src/components/reader/ReaderLoadingView.tsx`](src/components/reader/ReaderLoadingView.tsx) |
| **`ReaderSearchDrawer`** | Reader | `ReaderSearchDrawerProps` | `isOpen`, `onClose`, `chapters`, `fontSize`, `onSelectMatch`, `bookTitle`, `theme` | [`src/components/reader/ReaderSearchDrawer.tsx`](src/components/reader/ReaderSearchDrawer.tsx) |
| **`ReaderSpeechBar`** | Reader | `ReaderSpeechBarProps` | `isOpen`, `onClose`, `isPlaying`, `isPaused`, `currentSentenceIndex`, `totalSentences`, `rate`, `availableVoices`, `naturalVoices`, `standardVoices`, `selectedVoice`, `onPlay`, `onPause`, `onResume`, `onSkipNext`, `onSkipPrev`, `onRateChange`, `onVoiceChange`, `theme`, `bookTitle`, `currentPage`, `totalPages`, `isPrevDisabled`, `isNextDisabled` | [`src/components/reader/ReaderSpeechBar.tsx`](src/components/reader/ReaderSpeechBar.tsx) |
| **`ReaderSubHeaderRibbon`** | Reader | `ReaderSubHeaderRibbonProps` | `bookId`, `progress`, `totalChapters`, `currentChapterIndex`, `theme`, `resumeNotice`, `onRestart`, `onDismissResume`, `onOpenInfoModal` | [`src/components/reader/ReaderSubHeaderRibbon.tsx`](src/components/reader/ReaderSubHeaderRibbon.tsx) |
| **`ReaderSurface`** | Reader | `ReaderSurfaceProps` | `theme`, `fontFamily`, `fontSize`, `lineHeight`, `columnWidth`, `readingMode`, `chapter`, `currentPageText`, `chapterPage`, `activeChapterIndex`, `totalChapters`, `isLoading`, `isError`, `onRetry`, `bookTitle`, `bookAuthor`, `onPreviousPage`, `onNextPage`, `onFontSizeChange`, `highlightedSentence`, `translationSegments`, `translatedText`, `displayMode`, `isTranslating`, `annotations`, `onSelectAnnotation`, `onTextSelected` | [`src/components/reader/ReaderSurface.tsx`](src/components/reader/ReaderSurface.tsx) |
| **`ReaderTocDrawer`** | Reader | `ReaderTocDrawerProps` | `isOpen`, `onClose`, `chapters`, `activeChapterIndex`, `onSelectChapter`, `bookTitle`, `theme` | [`src/components/reader/ReaderTocDrawer.tsx`](src/components/reader/ReaderTocDrawer.tsx) |
| **`TextHighlightPopover`** | Reader | `TextHighlightPopoverProps` | `isOpen`, `selectedText`, `position`, `activeColor`, `existingNote`, `existingAnnotationId`, `onSelectColor`, `onSaveNote`, `onDelete`, `onCopyQuote`, `onClose`, `theme` | [`src/components/reader/TextHighlightPopover.tsx`](src/components/reader/TextHighlightPopover.tsx) |
| **`BackToTop`** | Ui | `BackToTopProps` | `threshold`, `className` | [`src/components/ui/BackToTop.tsx`](src/components/ui/BackToTop.tsx) |
| **`Badge`** | Ui | `BadgeProps` | `variant`, `size` | [`src/components/ui/Badge.tsx`](src/components/ui/Badge.tsx) |
| **`Button`** | Ui | _Autonomous_ | None (Self-Contained) | [`src/components/ui/Button.tsx`](src/components/ui/Button.tsx) |
| **`Card`** | Ui | `CardProps` | `variant` | [`src/components/ui/Card.tsx`](src/components/ui/Card.tsx) |
| **`CursorTooltip`** | Ui | `CursorTooltipProps` | `isVisible`, `mousePos`, `offset`, `children`, `className`, `testId` | [`src/components/ui/CursorTooltip.tsx`](src/components/ui/CursorTooltip.tsx) |
| **`Input`** | Ui | `InputProps` | `icon`, `onClear` | [`src/components/ui/Input.tsx`](src/components/ui/Input.tsx) |
| **`Modal`** | Ui | `ModalProps` | `isOpen`, `onClose`, `title`, `children`, `className`, `maxWidth`, `showCloseButton` | [`src/components/ui/Modal.tsx`](src/components/ui/Modal.tsx) |
| **`PasswordStrengthMeter`** | Ui | `PasswordStrengthMeterProps` | `strength`, `className` | [`src/components/ui/PasswordStrengthMeter.tsx`](src/components/ui/PasswordStrengthMeter.tsx) |
| **`SectionHeader`** | Ui | `SectionHeaderProps` | `eyebrow`, `title`, `subtitle`, `titleAs`, `showFlankLines`, `className`, `titleClassName`, `children` | [`src/components/ui/SectionHeader.tsx`](src/components/ui/SectionHeader.tsx) |
| **`StarRating`** | Ui | `StarRatingProps` | `value`, `onChange`, `size`, `readOnly`, `showLabel`, `className` | [`src/components/ui/StarRating.tsx`](src/components/ui/StarRating.tsx) |

---

## ⚡ State Management & Store Architecture

Zustand client-side state stores programmatically verified across **6 Persistent Modules**:

### 1. `useAnnotationStore` ([`src/stores/useAnnotationStore.ts`](src/stores/useAnnotationStore.ts))
* **Storage Key**: `STORAGE_KEYS.ANNOTATIONS` (localStorage)
* **Role & State**: Scholar marginalia, categorical pastel highlights (Amber, Emerald, Rose, Sky, Violet), reflections, tags, and commonplace book exports.

### 2. `useAuthStore` ([`src/stores/useAuthStore.ts`](src/stores/useAuthStore.ts))
* **Storage Key**: `bookarium-auth-profile` (localStorage)
* **Role & State**: Supabase session authentication, guest status, password generation, and cloud profile synchronization.

### 3. `useBookshelfStore` ([`src/stores/useBookshelfStore.ts`](src/stores/useBookshelfStore.ts))
* **Storage Key**: `General` (localStorage)
* **Role & State**: Personal library collections, reading queue, reading history, custom named shelves, deletion tombstones, and ratings.

### 4. `usePreferencesStore` ([`src/stores/usePreferencesStore.ts`](src/stores/usePreferencesStore.ts))
* **Storage Key**: `STORAGE_KEYS.PREFERENCES` (localStorage)
* **Role & State**: Reader display choices, sticky header auto-hide preferences, and navigation behaviors.

### 5. `useReaderStore` ([`src/stores/useReaderStore.ts`](src/stores/useReaderStore.ts))
* **Storage Key**: `STORAGE_KEYS.READER_SETTINGS` (localStorage)
* **Role & State**: Active book payload, typography settings (size, family, line height), reading mode (paginated vs scroll), and coordinates.

### 6. `useThemeStore` ([`src/stores/useThemeStore.ts`](src/stores/useThemeStore.ts))
* **Storage Key**: `STORAGE_KEYS.THEME` (localStorage)
* **Role & State**: Global application theme state (Day Paper, Sepia Parchment, Obsidian Dark) with immediate document class application.

---

## 🌐 API Routes, Query Hooks & Reader Engine

### 1. API Route Handlers (Edge Proxy & Telemetry)

| Endpoint / Route | Method(s) | Source File | Cache & Security Strategy | Upstream Target |
| :--- | :--- | :--- | :--- | :--- |
| **`/api/books`** | `GET` | [`src/app/api/books/route.ts`](src/app/api/books/route.ts) | `s-maxage=120, stale-while-revalidate=600` • Sliding-Window Rate Limit | `https://gutendex.com/books/` |
| **`/api/books/content`** | `GET` | [`src/app/api/books/content/route.ts`](src/app/api/books/content/route.ts) | `s-maxage=86400, stale-while-revalidate=604800` • Anti-SSRF Allowlist | `https://www.gutenberg.org/cache/epub/{id}/pg{id}.txt` |
| **`/api/translate`** | `POST` | [`src/app/api/translate/route.ts`](src/app/api/translate/route.ts) | Serverless Neural MT Proxy • 40+ Languages | Google Neural Machine Translation |

### 2. Custom Hooks (Data Queries & Reader Subsystems)

| Hook Name | Subsystem / Layer | Source File | Architectural Responsibility |
| :--- | :--- | :--- | :--- |
| **`useBookPassageShuffle`** | Hooks | [`src/hooks/useBookPassageShuffle.ts`](src/hooks/useBookPassageShuffle.ts) | Autonomous literary quote selection and multi-chapter shuffle engine. |
| **`useCatalogFilters`** | Hooks | [`src/hooks/useCatalogFilters.ts`](src/hooks/useCatalogFilters.ts) | Catalog filter state URL parameter binding, debounce, and query synchronization. |
| **`useCursorTooltip`** | Hooks | [`src/hooks/useCursorTooltip.ts`](src/hooks/useCursorTooltip.ts) | Adaptive unconstrained cursor tooltips for interactive bookshelf elements. |
| **`useHasMounted`** | Hooks | [`src/hooks/useHasMounted.ts`](src/hooks/useHasMounted.ts) | SSR hydration barrier hook preventing client-server markup mismatches. |
| **`useOfflineBooks`** | Hooks | [`src/hooks/useOfflineBooks.ts`](src/hooks/useOfflineBooks.ts) | IndexedDB cache enumeration and local offline book deletion management. |
| **`usePerformanceTier`** | Hooks | [`src/hooks/usePerformanceTier.ts`](src/hooks/usePerformanceTier.ts) | Hardware concurrency and memory heuristic detection for fluid 60fps animations. |
| **`useScrollDirection`** | Hooks | [`src/hooks/useScrollDirection.ts`](src/hooks/useScrollDirection.ts) | Stepped directional scroll detection with user auto-hide preference persistence. |
| **`useBookContent`** | Queries | [`src/hooks/queries/useBookContent.ts`](src/hooks/queries/useBookContent.ts) | TanStack Query fetching book plain text with IndexedDB offline-first check. |
| **`useBooks`** | Queries | [`src/hooks/queries/useBooks.ts`](src/hooks/queries/useBooks.ts) | TanStack Query fetching catalog volumes with sub-pagination and client failover. |
| **`useBookTranslations`** | Queries | [`src/hooks/queries/useBookTranslations.ts`](src/hooks/queries/useBookTranslations.ts) | TanStack Query aggregating international language translations and editions. |
| **`usePageTranslation`** | Queries | [`src/hooks/queries/usePageTranslation.ts`](src/hooks/queries/usePageTranslation.ts) | On-demand page-level dynamic neural translation caching. |
| **`useContinueReadingLedger`** | Reader | [`src/hooks/reader/useContinueReadingLedger.ts`](src/hooks/reader/useContinueReadingLedger.ts) | Headless continue reading ledger with authentic telemetry enrollment and query hydration. |
| **`useGutenbergParserWorker`** | Reader | [`src/hooks/reader/useGutenbergParserWorker.ts`](src/hooks/reader/useGutenbergParserWorker.ts) | Persistent Web Worker chapter segmentation and layout pagination calculations. |
| **`useReaderDrawers`** | Reader | [`src/hooks/reader/useReaderDrawers.ts`](src/hooks/reader/useReaderDrawers.ts) | Mutual exclusivity coordination for in-reader tool drawers and modals. |
| **`useReaderGestures`** | Reader | [`src/hooks/reader/useReaderGestures.ts`](src/hooks/reader/useReaderGestures.ts) | Touch swipe detection, keyboard shortcuts, and selection gesture conflict guards. |
| **`useReaderSession`** | Reader | [`src/hooks/reader/useReaderSession.ts`](src/hooks/reader/useReaderSession.ts) | Reading coordinates restoration, resume ribbons, and cloud session synchronization. |
| **`useReaderSpeech`** | Reader | [`src/hooks/reader/useReaderSpeech.ts`](src/hooks/reader/useReaderSpeech.ts) | Browser-native Web Speech synthesis with boundary word highlighting and auto-flip. |

---

## 📚 Curated Configurations & Design Token Registry

* **`FEATURED_HERO_BOOKS`** (`src/config/featured-books.ts`): 10 curated classic masterpieces (*Pride and Prejudice, Frankenstein, Moby Dick, The Great Gatsby, Alice in Wonderland, Dorian Gray, Sherlock Holmes, Dracula, A Tale of Two Cities, The Time Machine*) with verified volume numbers and quotes.
* **`LITERARY_ERAS`** (`src/config/catalog-filters.ts`): 6 historical eras spanning from Antiquity (-800 to 500) to Mid-20th Century (1914 to 1960).
* **`GENRE_FACETS`** (`src/config/catalog-filters.ts`): Curated genre tags (Gothic & Horror, Philosophy, Adventure, Sci-Fi, Poetry, Drama, Detective & Mystery, History).
* **`READER_THEMES`** (`src/config/reader-themes.ts`): 3 reading themes (Day Paper, Sepia Parchment, Obsidian Dark) with color tokens for background, text, borders, and accents.
* **`LITERARY_QUOTES`** (`src/config/literary-quotes.ts`): 12 literary passages and opening lines from immortal masterworks.
* **`ROUTES`** (`src/config/routes.ts`): Centralized single-source route registry defining clean path targets and dynamic route builders.
* **`SITE_CONFIG`** (`src/config/site-config.ts`): Canonical site metadata, storage key registry, and public domain policy declarations.

---

## 🔗 AST Module Interconnection & Topology Matrix

Every source file is analyzed for upstream imports and downstream consumers to guarantee zero orphaned or unlinked code:

| Module / Component | Upstream Dependencies (Imports) | Downstream Consumers (Consumed By) | Role & Responsibilities |
| :--- | :--- | :--- | :--- |
| [`layout.tsx`](src/app/account/layout.tsx) | _Root Primitive_ | _App Route Entry_ | Production Module |
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
| [`layout.tsx`](src/app/privacy/layout.tsx) | _Root Primitive_ | _App Route Entry_ | Production Module |
| [`page.tsx`](src/app/privacy/page.tsx) | `components/presentation/Navbar`, `components/presentation/Footer`, `config/routes`, `config/site-config` | _App Route Entry_ | Production Module |
| [`providers.tsx`](src/app/providers.tsx) | `stores/useAuthStore`, `stores/useBookshelfStore`, `stores/useAnnotationStore`, `stores/useReaderStore`, `components/auth/AuthModal`, `components/pwa/ServiceWorkerRegister` | `layout.tsx` | Production Module |
| [`layout.tsx`](src/app/read/[id]/layout.tsx) | `config/site-config`, `lib/book-metadata`, `types/book.types` | _App Route Entry_ | Production Module |
| [`page.tsx`](src/app/read/[id]/page.tsx) | `hooks/queries/useBookContent`, `hooks/queries/useBooks`, `hooks/queries/useBookTranslations`, `hooks/queries/usePageTranslation`, `stores/useReaderStore`, `stores/useThemeStore`, `hooks/useHasMounted`, `types/book.types`, `lib/gutenberg-parser`, `hooks/reader/useGutenbergParserWorker`, `config/reader-themes`, `lib/book-metadata`, `components/reader/ReaderHeader`, `components/reader/ReaderFooter`, `components/reader/ReaderTocDrawer`, `components/reader/ReaderSearchDrawer`, `components/reader/ReaderControls`, `components/reader/ReaderLanguageDrawer`, `components/reader/ReaderSpeechBar`, `components/reader/ReaderSurface`, `components/reader/TextHighlightPopover`, `components/reader/ReaderAnnotationsDrawer`, `hooks/reader/useReaderDrawers`, `hooks/reader/useReaderSpeech`, `hooks/reader/useReaderSession`, `stores/usePreferencesStore`, `stores/useAnnotationStore`, `stores/useAuthStore`, `stores/useBookshelfStore`, `components/ui/StarRating`, `components/ui/Modal`, `components/ui/Button`, `config/routes`, `config/site-config` | _App Route Entry_ | Production Module |
| [`robots.ts`](src/app/robots.ts) | `config/site-config` | _Direct Root Consumer_ | Production Module |
| [`sitemap.ts`](src/app/sitemap.ts) | `config/site-config` | _Direct Root Consumer_ | Production Module |
| [`AccountDeleteModal.tsx`](src/components/account/AccountDeleteModal.tsx) | `components/ui/Modal`, `components/ui/Button` | `page.tsx` | Production Module |
| [`AccountIdentityCard.tsx`](src/components/account/AccountIdentityCard.tsx) | `types/database.types`, `components/ui/Button`, `components/ui/Input` | `page.tsx` | Production Module |
| [`AccountLibraryStats.tsx`](src/components/account/AccountLibraryStats.tsx) | `config/routes`, `config/library-tokens` | `page.tsx` | Production Module |
| [`AccountPreferencesSection.tsx`](src/components/account/AccountPreferencesSection.tsx) | `stores/useThemeStore`, `lib/speech-utils`, `lib/library-backup`, `./AccountRestoreModal` | `page.tsx` | Production Module |
| [`AccountRestoreModal.tsx`](src/components/account/AccountRestoreModal.tsx) | `components/ui/Modal`, `components/ui/Button`, `lib/library-backup` | `AccountPreferencesSection.tsx` | Production Module |
| [`AccountSecuritySection.tsx`](src/components/account/AccountSecuritySection.tsx) | `components/ui/Button`, `components/ui/Input`, `components/ui/PasswordStrengthMeter`, `lib/password` | `page.tsx` | Production Module |
| [`AuthModal.tsx`](src/components/auth/AuthModal.tsx) | `stores/useAuthStore`, `stores/useBookshelfStore`, `components/ui/Button`, `components/ui/Input`, `components/ui/PasswordStrengthMeter`, `lib/password` | `providers.tsx` | Production Module |
| [`ReadingStatusSelector.tsx`](src/components/bookshelf/ReadingStatusSelector.tsx) | `types/book.types` | `BookPreviewModal.tsx`, `BookshelfMobileModal.tsx` | Production Module |
| [`MotionReveal.tsx`](src/components/motion/MotionReveal.tsx) | `./motion-config` | _Direct Root Consumer_ | Production Module |
| [`StaggerGroup.tsx`](src/components/motion/StaggerGroup.tsx) | `./motion-config` | _Direct Root Consumer_ | Production Module |
| [`motion-config.ts`](src/components/motion/motion-config.ts) | _Root Primitive_ | `MotionReveal.tsx`, `StaggerGroup.tsx` | Production Module |
| [`AdvancedFilterDrawer.tsx`](src/components/presentation/AdvancedFilterDrawer.tsx) | `components/ui/Button`, `config/catalog-filters`, `./LanguageSelector` | `page.tsx` | Production Module |
| [`BookCard.tsx`](src/components/presentation/BookCard.tsx) | `hooks/useCursorTooltip`, `components/ui/CursorTooltip`, `types/book.types`, `lib/utils`, `stores/useBookshelfStore`, `stores/useReaderStore`, `components/ui/Badge`, `components/ui/Button`, `components/ui/Card`, `components/ui/StarRating`, `config/routes` | `BookGrid.tsx`, `BookPreviewModal.tsx` | Production Module |
| [`BookGrid.tsx`](src/components/presentation/BookGrid.tsx) | `types/book.types`, `./BookCard`, `./BookshelfRack`, `components/ui/Button` | `page.tsx` | Production Module |
| [`BookPreviewModal.tsx`](src/components/presentation/BookPreviewModal.tsx) | `types/book.types`, `hooks/useBookPassageShuffle`, `lib/utils`, `components/ui/Button`, `components/ui/StarRating`, `components/bookshelf/ReadingStatusSelector`, `stores/useBookshelfStore`, `./BookCard` | `page.tsx` | Production Module |
| [`BookmarkCard.tsx`](src/components/presentation/BookmarkCard.tsx) | `types/book.types`, `components/ui/Button`, `config/routes`, `stores/useReaderStore`, `lib/utils` | `BookmarksView.tsx` | Production Module |
| [`BookmarksView.tsx`](src/components/presentation/BookmarksView.tsx) | `hooks/reader/useContinueReadingLedger`, `hooks/useOfflineBooks`, `stores/useReaderStore`, `./BookmarkCard`, `./CollectionSearchBar`, `components/ui/Button`, `components/ui/Modal`, `components/ui/SectionHeader`, `config/routes`, `types/book.types` | `page.tsx` | Production Module |
| [`BookshelfRack.tsx`](src/components/presentation/BookshelfRack.tsx) | `types/book.types`, `stores/useBookshelfStore`, `stores/useReaderStore`, `stores/useAuthStore`, `hooks/useOfflineBooks`, `components/ui/Button`, `./bookshelf/BookshelfSpine`, `./bookshelf/BookshelfMobileModal`, `./bookshelf/BookshelfManageModals`, `config/routes` | `BookGrid.tsx` | Production Module |
| [`CollectionSearchBar.tsx`](src/components/presentation/CollectionSearchBar.tsx) | _Root Primitive_ | `page.tsx`, `BookmarksView.tsx` | Production Module |
| [`DownloadDrawer.tsx`](src/components/presentation/DownloadDrawer.tsx) | `types/book.types`, `lib/utils`, `components/ui/Modal`, `components/ui/Button`, `components/ui/Badge` | `page.tsx` | Production Module |
| [`Footer.tsx`](src/components/presentation/Footer.tsx) | `config/site-config`, `config/routes` | `page.tsx`, `page.tsx`, `page.tsx`, `page.tsx` | Production Module |
| [`HeroFeaturedBook3D.tsx`](src/components/presentation/HeroFeaturedBook3D.tsx) | `types/book.types`, `config/featured-books`, `components/ui/Button`, `hooks/useBookPassageShuffle`, `hooks/usePerformanceTier` | `HeroSearch.tsx` | Production Module |
| [`HeroSearch.tsx`](src/components/presentation/HeroSearch.tsx) | `hooks/useHasMounted`, `components/ui/Button`, `config/catalog-filters`, `config/featured-books`, `types/book.types`, `lib/utils`, `./LanguageSelector`, `./HeroFeaturedBook3D` | `page.tsx` | Production Module |
| [`LanguageSelector.tsx`](src/components/presentation/LanguageSelector.tsx) | `config/catalog-filters` | `AdvancedFilterDrawer.tsx`, `HeroSearch.tsx` | Production Module |
| [`LiteraryQuotes.tsx`](src/components/presentation/LiteraryQuotes.tsx) | `config/literary-quotes`, `config/routes` | `page.tsx` | Production Module |
| [`Navbar.tsx`](src/components/presentation/Navbar.tsx) | `stores/useBookshelfStore`, `stores/useAnnotationStore`, `stores/useReaderStore`, `stores/useThemeStore`, `stores/useAuthStore`, `components/ui/Button`, `config/routes`, `config/site-config`, `config/library-tokens` | `page.tsx`, `page.tsx`, `page.tsx`, `page.tsx` | Production Module |
| [`NotebookView.tsx`](src/components/presentation/NotebookView.tsx) | `stores/useAnnotationStore`, `stores/useBookshelfStore`, `stores/useAuthStore`, `config/featured-books`, `hooks/queries/useBooks`, `components/ui/Button`, `components/ui/Modal`, `components/ui/SectionHeader`, `lib/book-metadata`, `lib/utils`, `types/book.types` | `page.tsx` | Production Module |
| [`StickyCatalogToolbar.tsx`](src/components/presentation/StickyCatalogToolbar.tsx) | `components/ui/Button`, `hooks/useHasMounted` | `page.tsx` | Production Module |
| [`BookshelfManageModals.tsx`](src/components/presentation/bookshelf/BookshelfManageModals.tsx) | `components/ui/Button`, `components/ui/Input` | `BookshelfRack.tsx` | Production Module |
| [`BookshelfMobileModal.tsx`](src/components/presentation/bookshelf/BookshelfMobileModal.tsx) | `types/book.types`, `types/database.types`, `stores/useReaderStore`, `stores/useBookshelfStore`, `components/ui/StarRating`, `components/bookshelf/ReadingStatusSelector`, `components/ui/Button`, `hooks/useHasMounted`, `lib/utils`, `config/routes` | `page.tsx`, `BookshelfRack.tsx` | Production Module |
| [`BookshelfSpine.tsx`](src/components/presentation/bookshelf/BookshelfSpine.tsx) | `hooks/useCursorTooltip`, `components/ui/CursorTooltip`, `types/book.types`, `types/database.types`, `stores/useReaderStore`, `stores/useBookshelfStore`, `components/ui/StarRating`, `lib/utils`, `config/routes` | `BookshelfRack.tsx` | Production Module |
| [`ServiceWorkerRegister.tsx`](src/components/pwa/ServiceWorkerRegister.tsx) | _Root Primitive_ | `providers.tsx` | Production Module |
| [`GutenbergInfoModal.tsx`](src/components/reader/GutenbergInfoModal.tsx) | `config/site-config`, `config/reader-themes` | `ReaderHeader.tsx` | Production Module |
| [`ReaderAnnotationsDrawer.tsx`](src/components/reader/ReaderAnnotationsDrawer.tsx) | `./ReaderDrawerShell`, `components/ui/Modal`, `components/ui/Button`, `stores/useAnnotationStore`, `stores/useReaderStore`, `config/reader-themes`, `./TextHighlightPopover` | `page.tsx` | Production Module |
| [`ReaderControls.tsx`](src/components/reader/ReaderControls.tsx) | `stores/useReaderStore`, `config/reader-themes`, `config/reader-config`, `./ReaderDrawerShell` | `page.tsx` | Production Module |
| [`ReaderDrawerShell.tsx`](src/components/reader/ReaderDrawerShell.tsx) | `stores/useReaderStore`, `config/reader-themes`, `hooks/useHasMounted` | `ReaderAnnotationsDrawer.tsx`, `ReaderControls.tsx`, `ReaderLanguageDrawer.tsx`, `ReaderSearchDrawer.tsx`, `ReaderTocDrawer.tsx` | Production Module |
| [`ReaderErrorView.tsx`](src/components/reader/ReaderErrorView.tsx) | `config/reader-themes` | `ReaderSurface.tsx` | Production Module |
| [`ReaderFooter.tsx`](src/components/reader/ReaderFooter.tsx) | `stores/useReaderStore`, `config/reader-themes` | `page.tsx` | Production Module |
| [`ReaderHeader.tsx`](src/components/reader/ReaderHeader.tsx) | `stores/useReaderStore`, `config/reader-themes`, `config/featured-books`, `lib/book-metadata`, `hooks/queries/useBookTranslations`, `config/translation-languages`, `hooks/useHasMounted`, `./GutenbergInfoModal`, `./ReaderSubHeaderRibbon` | `page.tsx` | Production Module |
| [`ReaderLanguageDrawer.tsx`](src/components/reader/ReaderLanguageDrawer.tsx) | `stores/useReaderStore`, `config/reader-themes`, `hooks/queries/useBookTranslations`, `config/translation-languages`, `./ReaderDrawerShell` | `page.tsx` | Production Module |
| [`ReaderLoadingView.tsx`](src/components/reader/ReaderLoadingView.tsx) | `config/reader-themes` | `ReaderSurface.tsx` | Production Module |
| [`ReaderSearchDrawer.tsx`](src/components/reader/ReaderSearchDrawer.tsx) | `lib/gutenberg-parser`, `lib/in-book-search`, `stores/useReaderStore`, `config/reader-themes`, `config/reader-config`, `./ReaderDrawerShell` | `page.tsx` | Production Module |
| [`ReaderSpeechBar.tsx`](src/components/reader/ReaderSpeechBar.tsx) | `stores/useReaderStore`, `config/reader-themes`, `lib/speech-utils` | `page.tsx` | Production Module |
| [`ReaderSubHeaderRibbon.tsx`](src/components/reader/ReaderSubHeaderRibbon.tsx) | `stores/useReaderStore`, `config/reader-themes` | `ReaderHeader.tsx` | Production Module |
| [`ReaderSurface.tsx`](src/components/reader/ReaderSurface.tsx) | `stores/useReaderStore`, `lib/gutenberg-parser`, `stores/useAnnotationStore`, `config/reader-themes`, `config/reader-config`, `hooks/reader/useReaderGestures`, `./ReaderLoadingView`, `./ReaderErrorView` | `page.tsx` | Production Module |
| [`ReaderTocDrawer.tsx`](src/components/reader/ReaderTocDrawer.tsx) | `lib/gutenberg-parser`, `lib/gutenberg-parser`, `stores/useReaderStore`, `config/reader-themes`, `./ReaderDrawerShell` | `page.tsx` | Production Module |
| [`TextHighlightPopover.tsx`](src/components/reader/TextHighlightPopover.tsx) | `stores/useAnnotationStore`, `stores/useReaderStore`, `hooks/useHasMounted` | `page.tsx`, `ReaderAnnotationsDrawer.tsx` | Production Module |
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
| [`site-config.ts`](src/config/site-config.ts) | _Root Primitive_ | `route.ts`, `route.ts`, `layout.tsx`, `manifest.ts`, `page.tsx`, `layout.tsx`, `page.tsx`, `robots.ts`, `sitemap.ts`, `Footer.tsx`, `Navbar.tsx`, `GutenbergInfoModal.tsx`, `useAnnotationStore.ts`, `useBookshelfStore.ts`, `usePreferencesStore.ts`, `useReaderStore.ts`, `useThemeStore.ts` | Production Module |
| [`translation-languages.ts`](src/config/translation-languages.ts) | _Root Primitive_ | `ReaderHeader.tsx`, `ReaderLanguageDrawer.tsx` | Production Module |
| [`useBookContent.ts`](src/hooks/queries/useBookContent.ts) | `mocks/handlers`, `config/api-endpoints`, `lib/offline-storage` | `page.tsx`, `useBookPassageShuffle.ts` | Production Module |
| [`useBookTranslations.ts`](src/hooks/queries/useBookTranslations.ts) | `config/catalog-filters`, `lib/book-metadata`, `types/book.types` | `page.tsx`, `ReaderHeader.tsx`, `ReaderLanguageDrawer.tsx` | Production Module |
| [`useBooks.ts`](src/hooks/queries/useBooks.ts) | `types/book.types`, `config/api-endpoints` | `page.tsx`, `page.tsx`, `NotebookView.tsx`, `useContinueReadingLedger.ts` | Production Module |
| [`usePageTranslation.ts`](src/hooks/queries/usePageTranslation.ts) | `app/api/translate/route` | `page.tsx` | Production Module |
| [`useContinueReadingLedger.ts`](src/hooks/reader/useContinueReadingLedger.ts) | `stores/useReaderStore`, `stores/useBookshelfStore`, `hooks/useHasMounted`, `hooks/queries/useBooks`, `lib/adapters/book.adapter`, `lib/book-metadata`, `types/book.types` | `BookmarksView.tsx` | Production Module |
| [`useGutenbergParserWorker.ts`](src/hooks/reader/useGutenbergParserWorker.ts) | `lib/gutenberg-parser`, `../../workers/gutenberg.worker.ts` | `page.tsx` | Production Module |
| [`useReaderDrawers.ts`](src/hooks/reader/useReaderDrawers.ts) | _Root Primitive_ | `page.tsx` | Production Module |
| [`useReaderGestures.ts`](src/hooks/reader/useReaderGestures.ts) | `config/reader-config` | `ReaderSurface.tsx` | Production Module |
| [`useReaderSession.ts`](src/hooks/reader/useReaderSession.ts) | `stores/useReaderStore`, `stores/useAuthStore`, `lib/gutenberg-parser` | `page.tsx` | Production Module |
| [`useReaderSpeech.ts`](src/hooks/reader/useReaderSpeech.ts) | `lib/speech-utils` | `page.tsx` | Production Module |
| [`useBookPassageShuffle.ts`](src/hooks/useBookPassageShuffle.ts) | `config/featured-books`, `lib/gutenberg/passages`, `hooks/queries/useBookContent` | `BookPreviewModal.tsx`, `HeroFeaturedBook3D.tsx` | Production Module |
| [`useCatalogFilters.ts`](src/hooks/useCatalogFilters.ts) | `config/catalog-filters`, `hooks/useHasMounted` | `page.tsx` | Production Module |
| [`useCursorTooltip.ts`](src/hooks/useCursorTooltip.ts) | _Root Primitive_ | `BookCard.tsx`, `BookshelfSpine.tsx` | Production Module |
| [`useHasMounted.ts`](src/hooks/useHasMounted.ts) | _Root Primitive_ | `page.tsx`, `page.tsx`, `BookshelfMobileModal.tsx`, `HeroSearch.tsx`, `StickyCatalogToolbar.tsx`, `ReaderDrawerShell.tsx`, `ReaderHeader.tsx`, `TextHighlightPopover.tsx`, `useContinueReadingLedger.ts`, `useCatalogFilters.ts`, `useAnnotationStore.ts`, `useBookshelfStore.ts` | Production Module |
| [`useOfflineBooks.ts`](src/hooks/useOfflineBooks.ts) | `types/book.types`, `lib/offline-storage`, `config/api-endpoints` | `page.tsx`, `BookmarksView.tsx`, `BookshelfRack.tsx` | Production Module |
| [`usePerformanceTier.ts`](src/hooks/usePerformanceTier.ts) | _Root Primitive_ | `HeroFeaturedBook3D.tsx` | Production Module |
| [`useScrollDirection.ts`](src/hooks/useScrollDirection.ts) | _Root Primitive_ | `page.tsx`, `page.tsx` | Production Module |
| [`book.adapter.ts`](src/lib/adapters/book.adapter.ts) | `types/book.types`, `lib/utils`, `lib/book-metadata` | `useContinueReadingLedger.ts` | Production Module |
| [`book-metadata.ts`](src/lib/book-metadata.ts) | `types/book.types`, `config/featured-books`, `lib/utils` | `layout.tsx`, `page.tsx`, `NotebookView.tsx`, `ReaderHeader.tsx`, `useBookTranslations.ts`, `useContinueReadingLedger.ts`, `book.adapter.ts`, `useAnnotationStore.ts` | Production Module |
| [`gutenberg-parser.ts`](src/lib/gutenberg-parser.ts) | `./gutenberg` | `page.tsx`, `ReaderSearchDrawer.tsx`, `ReaderSurface.tsx`, `ReaderTocDrawer.tsx`, `useGutenbergParserWorker.ts`, `useReaderSession.ts`, `in-book-search.ts`, `gutenberg.worker.ts` | Production Module |
| [`index.ts`](src/lib/gutenberg/index.ts) | `./types`, `./reflow`, `./pagination`, `./metadata`, `./segmentation`, `./passages` | `gutenberg-parser.ts` | Production Module |
| [`metadata.ts`](src/lib/gutenberg/metadata.ts) | `./types` | `index.ts` | Production Module |
| [`pagination.ts`](src/lib/gutenberg/pagination.ts) | `./types` | `index.ts` | Production Module |
| [`passages.ts`](src/lib/gutenberg/passages.ts) | `./types`, `./segmentation` | `useBookPassageShuffle.ts`, `index.ts` | Production Module |
| [`reflow.ts`](src/lib/gutenberg/reflow.ts) | _Root Primitive_ | `index.ts`, `segmentation.ts` | Production Module |
| [`segmentation.ts`](src/lib/gutenberg/segmentation.ts) | `./types`, `./reflow` | `index.ts`, `passages.ts` | Production Module |
| [`types.ts`](src/lib/gutenberg/types.ts) | _Root Primitive_ | `index.ts`, `metadata.ts`, `pagination.ts`, `passages.ts`, `segmentation.ts` | Production Module |
| [`in-book-search.ts`](src/lib/in-book-search.ts) | `lib/gutenberg-parser`, `lib/gutenberg-parser`, `lib/smart-search` | `ReaderSearchDrawer.tsx` | Production Module |
| [`library-backup.ts`](src/lib/library-backup.ts) | `stores/useBookshelfStore`, `stores/useReaderStore`, `stores/useAnnotationStore`, `stores/usePreferencesStore`, `stores/useThemeStore`, `types/book.types`, `types/database.types`, `lib/utils`, `lib/offline-storage` | `AccountPreferencesSection.tsx`, `AccountRestoreModal.tsx` | Production Module |
| [`offline-storage.ts`](src/lib/offline-storage.ts) | _Root Primitive_ | `useBookContent.ts`, `useOfflineBooks.ts`, `library-backup.ts` | Production Module |
| [`password.ts`](src/lib/password.ts) | _Root Primitive_ | `page.tsx`, `AccountSecuritySection.tsx`, `AuthModal.tsx`, `PasswordStrengthMeter.tsx` | Production Module |
| [`rate-limiter.ts`](src/lib/rate-limiter.ts) | _Root Primitive_ | `route.ts`, `route.ts`, `route.ts` | Production Module |
| [`smart-search.ts`](src/lib/smart-search.ts) | `types/book.types` | `page.tsx`, `in-book-search.ts` | Production Module |
| [`speech-utils.ts`](src/lib/speech-utils.ts) | _Root Primitive_ | `AccountPreferencesSection.tsx`, `ReaderSpeechBar.tsx`, `useReaderSpeech.ts` | Production Module |
| [`client.ts`](src/lib/supabase/client.ts) | `types/database.types` | `middleware.ts`, `server.ts`, `useAnnotationStore.ts`, `useAuthStore.ts`, `useBookshelfStore.ts`, `useReaderStore.ts` | Production Module |
| [`middleware.ts`](src/lib/supabase/middleware.ts) | `types/database.types`, `./client` | `proxy.ts` | Production Module |
| [`server.ts`](src/lib/supabase/server.ts) | `types/database.types`, `./client` | `route.ts` | Production Module |
| [`utils.ts`](src/lib/utils.ts) | _Root Primitive_ | `BookCard.tsx`, `BookmarkCard.tsx`, `BookPreviewModal.tsx`, `BookshelfMobileModal.tsx`, `BookshelfSpine.tsx`, `DownloadDrawer.tsx`, `HeroSearch.tsx`, `NotebookView.tsx`, `Badge.tsx`, `Button.tsx`, `Card.tsx`, `Input.tsx`, `Modal.tsx`, `SectionHeader.tsx`, `featured-books.ts`, `book.adapter.ts`, `book-metadata.ts`, `library-backup.ts`, `useAnnotationStore.ts` | Production Module |
| [`proxy.ts`](src/proxy.ts) | `lib/supabase/middleware` | _Direct Root Consumer_ | Production Module |
| [`useAnnotationStore.ts`](src/stores/useAnnotationStore.ts) | `config/site-config`, `lib/supabase/client`, `hooks/useHasMounted`, `lib/book-metadata`, `lib/utils` | `page.tsx`, `providers.tsx`, `page.tsx`, `Navbar.tsx`, `NotebookView.tsx`, `ReaderAnnotationsDrawer.tsx`, `ReaderSurface.tsx`, `TextHighlightPopover.tsx`, `library-backup.ts` | Production Module |
| [`useAuthStore.ts`](src/stores/useAuthStore.ts) | `lib/supabase/client`, `types/database.types`, `config/routes` | `page.tsx`, `page.tsx`, `providers.tsx`, `page.tsx`, `AuthModal.tsx`, `BookshelfRack.tsx`, `Navbar.tsx`, `NotebookView.tsx`, `useReaderSession.ts`, `useBookshelfStore.ts`, `useReaderStore.ts` | Production Module |
| [`useBookshelfStore.ts`](src/stores/useBookshelfStore.ts) | `types/book.types`, `hooks/useHasMounted`, `lib/supabase/client`, `types/database.types`, `config/site-config`, `./useAuthStore`, `./useReaderStore` | `page.tsx`, `page.tsx`, `providers.tsx`, `page.tsx`, `AuthModal.tsx`, `BookCard.tsx`, `BookPreviewModal.tsx`, `BookshelfMobileModal.tsx`, `BookshelfSpine.tsx`, `BookshelfRack.tsx`, `Navbar.tsx`, `NotebookView.tsx`, `useContinueReadingLedger.ts`, `library-backup.ts` | Production Module |
| [`usePreferencesStore.ts`](src/stores/usePreferencesStore.ts) | `config/site-config` | `page.tsx`, `page.tsx`, `page.tsx`, `library-backup.ts` | Production Module |
| [`useReaderStore.ts`](src/stores/useReaderStore.ts) | `types/book.types`, `./useThemeStore`, `./useAuthStore`, `lib/supabase/client`, `config/site-config`, `config/reader-config` | `page.tsx`, `page.tsx`, `providers.tsx`, `page.tsx`, `BookCard.tsx`, `BookmarkCard.tsx`, `BookmarksView.tsx`, `BookshelfMobileModal.tsx`, `BookshelfSpine.tsx`, `BookshelfRack.tsx`, `Navbar.tsx`, `ReaderAnnotationsDrawer.tsx`, `ReaderControls.tsx`, `ReaderDrawerShell.tsx`, `ReaderFooter.tsx`, `ReaderHeader.tsx`, `ReaderLanguageDrawer.tsx`, `ReaderSearchDrawer.tsx`, `ReaderSpeechBar.tsx`, `ReaderSubHeaderRibbon.tsx`, `ReaderSurface.tsx`, `ReaderTocDrawer.tsx`, `TextHighlightPopover.tsx`, `reader-themes.ts`, `useContinueReadingLedger.ts`, `useReaderSession.ts`, `library-backup.ts`, `useBookshelfStore.ts` | Production Module |
| [`useThemeStore.ts`](src/stores/useThemeStore.ts) | `config/site-config` | `page.tsx`, `page.tsx`, `AccountPreferencesSection.tsx`, `Navbar.tsx`, `library-backup.ts`, `useReaderStore.ts` | Production Module |
| [`book.types.ts`](src/types/book.types.ts) | _Root Primitive_ | `route.ts`, `page.tsx`, `layout.tsx`, `page.tsx`, `ReadingStatusSelector.tsx`, `BookCard.tsx`, `BookGrid.tsx`, `BookmarkCard.tsx`, `BookmarksView.tsx`, `BookPreviewModal.tsx`, `BookshelfMobileModal.tsx`, `BookshelfSpine.tsx`, `BookshelfRack.tsx`, `DownloadDrawer.tsx`, `HeroFeaturedBook3D.tsx`, `HeroSearch.tsx`, `NotebookView.tsx`, `useBooks.ts`, `useBookTranslations.ts`, `useContinueReadingLedger.ts`, `useOfflineBooks.ts`, `book.adapter.ts`, `book-metadata.ts`, `library-backup.ts`, `smart-search.ts`, `useBookshelfStore.ts`, `useReaderStore.ts` | Production Module |
| [`database.types.ts`](src/types/database.types.ts) | _Root Primitive_ | `AccountIdentityCard.tsx`, `BookshelfMobileModal.tsx`, `BookshelfSpine.tsx`, `library-backup.ts`, `client.ts`, `middleware.ts`, `server.ts`, `useAuthStore.ts`, `useBookshelfStore.ts` | Production Module |
| [`gutenberg.worker.ts`](src/workers/gutenberg.worker.ts) | `lib/gutenberg-parser` | `useGutenbergParserWorker.ts` | Production Module |

---

## ⚡ Data Pulling & Caching Strategy

1. **100% Pure Live API Queries**: All catalog items are retrieved in real-time from Project Gutenberg (`https://gutendex.com/books/`).
2. **2-Part Visible Telemetry**: `StickyCatalogToolbar.tsx` renders live API connectivity status alongside exact roundtrip latency in milliseconds.
3. **Customizable Batch Sizing**: Readers can dynamically toggle batch sizes (`Show: [8 | 16 | 24 | 32]`) without page reloads.
4. **Edge SWR Caching**: Common queries are cached with `s-maxage=120, stale-while-revalidate=600` for sub-10ms response times on repeated visits.
5. **On-Demand Text Streaming**: Large book texts (2MB–5MB) are fetched strictly when the focus reader opens.
6. **Native IndexedDB Offline Cache**: Downloaded unabridged texts are cached in browser IndexedDB for 100% offline access.

---

## 🔒 Verification & Compliance

This architecture document is verified deterministically by **Pass 4 of the 7-Gateway Quality Engine** (`npm run verify`).

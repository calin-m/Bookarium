# Quality Audit & Test Suite Catalog Report

**Last Generated**: Tue, 01 Sep 2026 23:15:13 GMT  
**Overall Status**: 🟢 PASSED  
**Total Test Suites**: 66 passed  
**Total Verified Tests**: 428 passed  

---

## 🛡️ 7-Gateway Quality Summary

| Gateway | Check | Status | Details |
|---|---|---|---|
| **Pass 0.5** | Pre-Commit Secret Scanner | ✅ Passed | 0 exposed tokens, API keys, or private certificates |
| **Pass 1** | TypeScript Compiler | ✅ Passed | Strict type checking (`tsc --noEmit`) 0 errors |
| **Pass 2** | MSW Server & Queries | ✅ Passed | Mock Service Worker v2 network interception verified |
| **Pass 3** | Vitest Test Suite | ✅ Passed | **66/66 test suites passed** (428 total tests) |
| **Pass 3.5** | Coverage Threshold | ✅ Passed | Minimum 80% coverage threshold met across all metrics |
| **Pass 4** | Living Docs AST Sync | ✅ Passed | `docs/ARCHITECTURE.md`, `CHANGELOG.md`, & `docs/QUALITY_AUDIT_REPORT.md` synced |
| **Pass 5** | ADR Decision Ledger | ✅ Passed | 11 Architectural Decision Records validated |
| **Pass 6** | ESLint & Knip Audit | ✅ Passed | 0 lint errors, 0 unused exports / dead files |
| **Pass 7** | Next.js Production Build | ✅ Passed | Turbopack production bundle compiled cleanly |

---

## 📊 Code Coverage Metrics

- **Lines**: **92.15%** (2467/2677) — *Target: $ge$ 80%*
- **Statements**: **90.54%** (2692/2973) — *Target: $ge$ 80%*
- **Functions**: **88.31%** (635/719) — *Target: $ge$ 80%*
- **Branches**: **80.47%** (2329/2894) — *Target: $ge$ 80%*

---

## 🧪 Comprehensive Test Suite Catalog (66 Suites / 428 Tests)

### 🚀 App Routes & Pages (8 Suites · 46 Tests)

<details>
<summary><b><code>src/app/api/books/content/route.test.ts</code></b> (6 tests)</summary>

- ✔ `should return 429 when client exceeds rate limits`
- ✔ `should return 400 if neither url nor id is provided`
- ✔ `should block SSRF attempts targeting cloud metadata or internal network`
- ✔ `should validate official Gutenberg upstream URLs as safe`
- ✔ `should fetch and return book text for valid id`
- ✔ `should return 502 if upstream fails or times out`

</details>

<details>
<summary><b><code>src/app/api/books/route.test.ts</code></b> (6 tests)</summary>

- ✔ `should return 429 when client exceeds max request rate limit`
- ✔ `should fetch and return public domain books JSON with zero copyright and latencyMs`
- ✔ `should pass topic, language, page, era, sort, and mime_type query parameters`
- ✔ `should return error response when upstream API returns an error status`
- ✔ `should return 504 status code when upstream API times out or network fails`
- ✔ `should return 502 status code when upstream API returns invalid non-JSON body`

</details>

<details>
<summary><b><code>src/app/auth/callback/route.test.ts</code></b> (3 tests)</summary>

- ✔ `exchanges code for session and redirects to valid destination`
- ✔ `sanitizes open redirect attempts to safe root destination`
- ✔ `redirects with auth error if exchange fails or code is missing`

</details>

<details>
<summary><b><code>src/app/auth/confirm-deletion/page.test.tsx</code></b> (4 tests)</summary>

- ✔ `renders loading state when isLoading is true`
- ✔ `renders expired/invalid link state when unauthenticated`
- ✔ `renders authenticated confirmation portal and handles successful deletion`
- ✔ `renders error message if deleteAccount fails`

</details>

<details>
<summary><b><code>src/app/layout.test.tsx</code></b> (2 tests)</summary>

- ✔ `should expose valid metadata`
- ✔ `should render children within html structure`

</details>

<details>
<summary><b><code>src/app/page.test.tsx</code></b> (11 tests)</summary>

- ✔ `should render catalog, hero search, sticky toolbar, and books list`
- ✔ `should handle search, topic, and language change interactions`
- ✔ `should open advanced filter drawer and apply era and sort filters`
- ✔ `should switch to bookshelf view and require confirmation to clear shelf`
- ✔ `should switch to favorites view and require confirmation to clear favorites`
- ✔ `should open download hub and close it`
- ✔ `should open 3D book preview modal when book cover is clicked and close it on desktop`
- ✔ `renders Bookshelf and Favorites when views are switched via Navbar`
- ✔ `E2E Journey: full catalog search -> preview open -> reader launch -> shelf curation`
- ✔ `should dynamically filter bookshelf books with smart multi-word search in arbitrary order`
- ✔ `should dynamically filter favorites books and show empty search feedback`

</details>

<details>
<summary><b><code>src/app/providers.test.tsx</code></b> (1 tests)</summary>

- ✔ `should render children within QueryClientProvider`

</details>

<details>
<summary><b><code>src/app/read/[id]/page.test.tsx</code></b> (13 tests)</summary>

- ✔ `renders header, reading surface, and sticky footer with metadata`
- ✔ `navigates back to previous scroll position when back button is clicked`
- ✔ `falls back to router.push(`
- ✔ `opens and closes Table of Contents drawer`
- ✔ `opens and closes appearance controls popover`
- ✔ `navigates between chapters using footer Next/Prev buttons`
- ✔ `supports keyboard navigation via ArrowLeft and ArrowRight`
- ✔ `handles quick theme cycling from the header`
- ✔ `handles quick font size adjustments`
- ✔ `handles page jump input directly from footer`
- ✔ `sets reading progress to 0% on page 1 and updates progress as reader advances`
- ✔ `automatically resumes at saved chapter and page, renders resume toast, and handles restart`
- ✔ `renders language and translation dropdown in reader and navigates on translation selection`

</details>

### 🎨 Catalog & Presentation (16 Suites · 112 Tests)

<details>
<summary><b><code>src/components/presentation/AdvancedFilterDrawer.test.tsx</code></b> (6 tests)</summary>

- ✔ `should render drawer with all filter sections when open`
- ✔ `should handle era selection and sort order change`
- ✔ `should handle genre facet selection and format change`
- ✔ `should handle language selection, reset filters, and apply filters`
- ✔ `should not render anything when isOpen is false`
- ✔ `should close when pressing the Escape key`

</details>

<details>
<summary><b><code>src/components/presentation/BookCard.test.tsx</code></b> (12 tests)</summary>

- ✔ `should render book title, author, and formats`
- ✔ `should render multiple separate subject tag pills in the card body`
- ✔ `should render link to /read/[id] when clicking Read button`
- ✔ `should toggle like and bookmark state on button clicks`
- ✔ `should call onDownloadClick when clicking Formats button`
- ✔ `should call onPreviewClick when clicking book cover visual on desktop`
- ✔ `should navigate to /read/[id] on mobile when clicking book cover visual`
- ✔ `applies opacity-0 when isPreviewActive is true`
- ✔ `should render cursor tooltip on hover when onPreviewClick is provided`
- ✔ `renders fallback cover when image error occurs`
- ✔ `triggers preview on Enter or Space key press on cover`
- ✔ `updates cursor tooltip to Add to Favorites and Add to Bookshelf when hovering action buttons`

</details>

<details>
<summary><b><code>src/components/presentation/BookGrid.test.tsx</code></b> (7 tests)</summary>

- ✔ `should render loading skeletons when isLoading is true`
- ✔ `should render error state with retry button`
- ✔ `should render empty state when no books exist`
- ✔ `should render book cards and trigger pagination`
- ✔ `should switch between editorial grid and bookshelf rack views`
- ✔ `should forward onPreviewClick to BookCard`
- ✔ `hides the active preview card when activePreviewBookId matches`

</details>

<details>
<summary><b><code>src/components/presentation/BookPreviewModal.test.tsx</code></b> (8 tests)</summary>

- ✔ `renders nothing when isOpen is false or book is null`
- ✔ `renders book preview modal and triggers cover open animation`
- ✔ `handles shuffle click and cycles through passages`
- ✔ `calls onClose when close button or backdrop is clicked or Escape is pressed`
- ✔ `calls onReadBook on action button click and closes modal`
- ✔ `applies FLIP transform when originRect is provided`
- ✔ `invokes onWillClose during the landing flight prior to full onClose`
- ✔ `renders long book titles and authors in full without truncation`

</details>

<details>
<summary><b><code>src/components/presentation/bookshelf/BookshelfManageModals.test.tsx</code></b> (2 tests)</summary>

- ✔ `renders create modal and submits new shelf`
- ✔ `renders rename and delete modals`

</details>

<details>
<summary><b><code>src/components/presentation/bookshelf/BookshelfMobileModal.test.tsx</code></b> (2 tests)</summary>

- ✔ `returns null when selectedMobileBook is null`
- ✔ `renders modal with formatted author names and triggers actions`

</details>

<details>
<summary><b><code>src/components/presentation/bookshelf/BookshelfSpine.test.tsx</code></b> (2 tests)</summary>

- ✔ `renders spine title, author, and handles keyboard interaction`
- ✔ `triggers quick actions from desktop hover card`

</details>

<details>
<summary><b><code>src/components/presentation/BookshelfRack.test.tsx</code></b> (24 tests)</summary>

- ✔ `renders shelf with books`
- ✔ `renders empty message when no books are provided`
- ✔ `triggers onBookClick or openReader when book spine is clicked`
- ✔ `supports keyboard navigation via Enter and Space keys`
- ✔ `opens reader route using default handler if onBookClick is omitted`
- ✔ `handles quick action download and bookmark clicks`
- ✔ `renders guest mode sync prompt and triggers auth modal`
- ✔ `displays rounded integer percentage for reading progress`
- ✔ `displays 0% read for opened books on page 1`
- ✔ `renders cloud shelves and allows switching active shelf`
- ✔ `opens rename shelf modal and submits new shelf name`
- ✔ `opens delete shelf modal and confirms custom shelf deletion`
- ✔ `opens create shelf modal and submits a new custom shelf`
- ✔ `renders empty shelf state and allows browsing catalog`
- ✔ `calls onBrowseCatalog callback when clicking Browse Catalog in empty state`
- ✔ `allows moving a book between shelves when user has multiple shelves`
- ✔ `triggers quick actions from hover card (download, read, save, like)`
- ✔ `opens quick-action bottom sheet on mobile spine tap without immediate navigation`
- ✔ `triggers onBookClick and closes sheet when clicking Read in mobile action sheet`
- ✔ `dismisses mobile action sheet when clicking backdrop`
- ✔ `handles mobile action sheet close button and dismiss`
- ✔ `triggers download callback from mobile action sheet`
- ✔ `toggles bookmark and like status from mobile action sheet`
- ✔ `handles moving a book to another shelf and default read routing from mobile action sheet`

</details>

<details>
<summary><b><code>src/components/presentation/CollectionSearchBar.test.tsx</code></b> (6 tests)</summary>

- ✔ `should render search input with placeholder and accessible label`
- ✔ `should call onQueryChange when user types in the input`
- ✔ `should display clear button and counter badge when query is present`
- ✔ `should call onQueryChange with empty string when clicking clear button`
- ✔ `should clear search query when pressing Escape key`
- ✔ `should not display clear button or counter when query is blank or whitespace`

</details>

<details>
<summary><b><code>src/components/presentation/DownloadDrawer.test.tsx</code></b> (2 tests)</summary>

- ✔ `should render download formats when opened with a book`
- ✔ `should return null when book is null`

</details>

<details>
<summary><b><code>src/components/presentation/Footer.test.tsx</code></b> (1 tests)</summary>

- ✔ `should render legal manifesto, links, and attribution`

</details>

<details>
<summary><b><code>src/components/presentation/HeroSearch.test.tsx</code></b> (12 tests)</summary>

- ✔ `should render headline, featured book, and 4-pillar benefit strip`
- ✔ `should handle search input changes with debounce`
- ✔ `should handle topic chip and language selection`
- ✔ `should handle read featured book button click`
- ✔ `should render open-book spread with left and right page quotes on featured spotlight`
- ✔ `should accept dynamic books prop from API and render the active volume`
- ✔ `should clear search input and submit search correctly`
- ✔ `should shuffle to next passage within the featured book when rotate button is clicked`
- ✔ `should toggle pinned open and closed states on click and keyboard events on desktop`
- ✔ `should not toggle pinned open state on mobile viewports (< 1024px)`
- ✔ `should trigger onReadFeaturedBook from the action button in open state`
- ✔ `renders static volume badge on the cover across all viewports`

</details>

<details>
<summary><b><code>src/components/presentation/LanguageSelector.test.tsx</code></b> (4 tests)</summary>

- ✔ `renders compact inline variant with Globe icon and label`
- ✔ `renders full width variant without inline wrapper`
- ✔ `triggers onChange with selected language code`
- ✔ `contains all 12 supported public domain languages`

</details>

<details>
<summary><b><code>src/components/presentation/LiteraryQuotes.test.tsx</code></b> (4 tests)</summary>

- ✔ `should render section heading, kicker, and 3 literary quote cards`
- ✔ `should shuffle quotes when clicking Discover More button`
- ✔ `should have links pointing to valid /read/[id] routes`
- ✔ `should cleanly unmount without errors during active shuffle`

</details>

<details>
<summary><b><code>src/components/presentation/Navbar.test.tsx</code></b> (12 tests)</summary>

- ✔ `should render brand and navigation items`
- ✔ `should fill bookmark icon when books are saved to bookshelf`
- ✔ `should fill heart icon when books are liked in favorites`
- ✔ `should trigger onViewChange callback when clicking tabs`
- ✔ `should cycle through themes when clicking theme button`
- ✔ `renders Sign In button for guests and triggers openAuthModal`
- ✔ `renders user avatar when authenticated and manages dropdown menu and sign out`
- ✔ `handles keyboard Enter and Space on brand logo to navigate back to catalog`
- ✔ `opens and dismisses user dropdown when clicking outside or clicking profile link`
- ✔ `falls back to Reader when profile display_name is not set without leaking email`
- ✔ `applies -translate-y-full when isVisible is false`
- ✔ `applies translate-y-0 when isVisible is true`

</details>

<details>
<summary><b><code>src/components/presentation/StickyCatalogToolbar.test.tsx</code></b> (8 tests)</summary>

- ✔ `should render filter trigger, active chips, and 2-part API status badge`
- ✔ `should handle page size selection`
- ✔ `should trigger filter opening, remove individual chips, and clear all filters`
- ✔ `should handle view mode switching between grid and shelf`
- ✔ `should handle pagination next button and direct page jump form`
- ✔ `should display error indicator in status badge when isError is true`
- ✔ `applies translate-y-0 when isHeaderVisible is true and -translate-y-16 when false`
- ✔ `applies -translate-y-[calc(100%+4rem)] and pointer-events-none when isVisible is false`

</details>

### 📖 In-Browser Focus Reader (5 Suites · 40 Tests)

<details>
<summary><b><code>src/components/reader/ReaderControls.test.tsx</code></b> (7 tests)</summary>

- ✔ `renders theme and font selection buttons`
- ✔ `renders correctly under sepia and dark themes`
- ✔ `triggers onThemeChange and onFontFamilyChange`
- ✔ `triggers onReadingModeChange and onColumnWidthChange`
- ✔ `handles font size and line height slider changes with proper aria attributes`
- ✔ `closes controls on Escape key press`
- ✔ `does not render when isOpen is false`

</details>

<details>
<summary><b><code>src/components/reader/ReaderFooter.test.tsx</code></b> (5 tests)</summary>

- ✔ `renders global volume pagination and chapter title`
- ✔ `triggers onPrevPage and onNextPage callbacks when buttons are clicked`
- ✔ `handles page jump input changes`
- ✔ `disables previous and next buttons when boundary disabled flags are set`
- ✔ `renders continuous flow indicator and chapter navigation when in scroll mode`

</details>

<details>
<summary><b><code>src/components/reader/ReaderHeader.test.tsx</code></b> (11 tests)</summary>

- ✔ `renders book title, author, and progress metrics correctly`
- ✔ `triggers onBack when back button is clicked`
- ✔ `triggers onToggleToc and onToggleControls when respective buttons are clicked`
- ✔ `triggers right-side theme cycling for light, sepia, and dark`
- ✔ `opens and closes the Gutenberg Archive volume info modal`
- ✔ `sanitizes and renders extra long titles and multiline strings gracefully`
- ✔ `filters out placeholder author strings and falls back to featured fixture`
- ✔ `renders the dedicated sub-header metadata ribbon with Book ID, Section, and Progress`
- ✔ `renders integrated resume notice ribbon in sub-header and handles restart and dismiss`
- ✔ `renders language and translation switcher and handles edition selection`
- ✔ `handles link copying when share button is clicked`

</details>

<details>
<summary><b><code>src/components/reader/ReaderSurface.test.tsx</code></b> (12 tests)</summary>

- ✔ `renders archival frontispiece banner on opening section and standard chapter banner on subsequent sections`
- ✔ `applies dynamic fontSize and lineHeight directly to the content body`
- ✔ `renders loading spinner and status message when isLoading is true`
- ✔ `renders error alert with retry button when isError is true`
- ✔ `applies correct surface theme classes for Sepia and Dark themes`
- ✔ `triggers next and previous page handlers on mobile horizontal swipe gestures`
- ✔ `renders correctly in scroll reading mode and handles empty content fallback`
- ✔ `ignores vertical touch swipes or touches in scroll mode`
- ✔ `renders narrow, wide, mono, and sans typography and layout modes`
- ✔ `scales up font size and displays HUD pill on pinch-out gesture`
- ✔ `clamps font size to minimum (12px) on extreme pinch-in gesture`
- ✔ `clamps font size to maximum (36px) on extreme pinch-out gesture`

</details>

<details>
<summary><b><code>src/components/reader/ReaderTocDrawer.test.tsx</code></b> (5 tests)</summary>

- ✔ `renders table of contents with chapters and starting page badges`
- ✔ `filters chapters based on search query and clears search query`
- ✔ `calls onSelectChapter and onClose when a chapter item is clicked`
- ✔ `closes drawer on Escape key press`
- ✔ `does not render when isOpen is false`

</details>

### 🔐 Authentication & Security (1 Suites · 11 Tests)

<details>
<summary><b><code>src/components/auth/AuthModal.test.tsx</code></b> (11 tests)</summary>

- ✔ `renders nothing when isAuthModalOpen is false`
- ✔ `renders Sign In view with email and password inputs`
- ✔ `renders Sign Up view, submits with email confirmation required, and shows confirmation screen`
- ✔ `validates password mismatch on Sign Up`
- ✔ `handles form submission in sign in mode`
- ✔ `renders error alert when error exists`
- ✔ `handles magic link view and submission and email confirmation screen`
- ✔ `handles Suggest Strong Password generation and visibility toggle`
- ✔ `navigates from sign in view to forgot password view`
- ✔ `submits password reset request and displays check email confirmation`
- ✔ `navigates back to sign in from confirmation screen`

</details>

### ⚡ Zustand State Stores (5 Suites · 43 Tests)

<details>
<summary><b><code>src/stores/useAuthStore.test.ts</code></b> (13 tests)</summary>

- ✔ `manages modal open, close, and view state transitions`
- ✔ `handles signInWithPassword success and error states`
- ✔ `handles sign in error and sets error message`
- ✔ `handles signOut`
- ✔ `handles signUpWithPassword success (with session and unconfirmed)`
- ✔ `handles signInWithOtp (magic link) success and error`
- ✔ `handles signInWithOAuth success and error`
- ✔ `handles initializeAuth subscription and session hydration`
- ✔ `handles updateProfile when logged in and logged out`
- ✔ `handles resetPasswordForEmail success and failure`
- ✔ `handles updatePassword success and failure`
- ✔ `handles requestAccountDeletion success and failure`
- ✔ `handles deleteAccount success and failure`

</details>

<details>
<summary><b><code>src/stores/useBookshelfStore.test.ts</code></b> (14 tests)</summary>

- ✔ `should initialize with empty collections`
- ✔ `should toggle save book in bookshelf`
- ✔ `should manage reading queue`
- ✔ `should toggle like status and store likedBooks`
- ✔ `should sync and clear liked books`
- ✔ `returns live hydrated state and reactive actions`
- ✔ `handles activeBookshelfId selection and cloud bookshelf list`
- ✔ `handles syncWithCloud fetching bookshelves and items`
- ✔ `handles createCloudBookshelf and migrateLocalBooksToCloud`
- ✔ `handles updateCloudBookshelf and deleteCloudBookshelf`
- ✔ `handles moveBookToShelf properly`
- ✔ `creates a new bookshelf item if book is not in cloudBookshelfItems yet`
- ✔ `returns saved books count via useSavedBooksCount`
- ✔ `returns isSaved status via useIsBookSaved`

</details>

<details>
<summary><b><code>src/stores/usePreferencesStore.test.ts</code></b> (3 tests)</summary>

- ✔ `initializes with stickyScrollEnabled = true by default`
- ✔ `sets stickyScrollEnabled to specified boolean value`
- ✔ `toggles stickyScrollEnabled back and forth`

</details>

<details>
<summary><b><code>src/stores/useReaderStore.test.ts</code></b> (7 tests)</summary>

- ✔ `should initialize with default reader settings`
- ✔ `should open and close reader modal with book`
- ✔ `should clamp font size between 12 and 36`
- ✔ `should clamp line height between 1.2 and 2.6`
- ✔ `should update theme and font family`
- ✔ `should record and retrieve reading progress percentage`
- ✔ `should save, retrieve, and clear exact reading positions`

</details>

<details>
<summary><b><code>src/stores/useThemeStore.test.ts</code></b> (6 tests)</summary>

- ✔ `initializes with default light theme`
- ✔ `sets sepia theme and syncs sepia DOM class`
- ✔ `sets dark theme and syncs dark DOM class`
- ✔ `sets light theme and clears dark/sepia DOM classes`
- ✔ `cycles theme through light -> sepia -> dark -> light`
- ✔ `applyThemeToDocument handles document manipulation safely`

</details>

### 📚 Gutenberg Parsers & Metadata (6 Suites · 77 Tests)

<details>
<summary><b><code>src/lib/book-metadata.test.ts</code></b> (8 tests)</summary>

- ✔ `identifies placeholder and empty authors correctly`
- ✔ `identifies placeholder and generic volume titles correctly`
- ✔ `resolves curated static fixtures (Tier 1) for featured book IDs with 0ms preloaded data`
- ✔ `resolves metadata from Zustand client store (Tier 2) when matching ID`
- ✔ `resolves metadata from REST API response (Tier 3)`
- ✔ `falls back to extracted Gutenberg raw text header (Tier 4) when store and API are unavailable or have placeholders`
- ✔ `bypasses store placeholder authors and uses authentic API/header authors`
- ✔ `handles fallback defaults when all metadata sources are empty`

</details>

<details>
<summary><b><code>src/lib/gutenberg-parser.test.ts</code></b> (22 tests)</summary>

- ✔ `returns empty array on null or undefined input`
- ✔ `correctly calculates reading time based on 200 WPM`
- ✔ `reflows single-newline Gutenberg hard wraps while preserving double newlines`
- ✔ `reflows standard Gutenberg paragraphs that have 4-space first-line indentation`
- ✔ `preserves indented verse and poetry lines during reflow`
- ✔ `calculates dynamic characters per page scaled by font size`
- ✔ `parses structured Project Gutenberg eBook into preamble, chapters, and license colophon`
- ✔ `suppresses front-matter Table of Contents cluster lines from becoming empty duplicate chapters`
- ✔ `calculates true continuous volume page spreads`
- ✔ `falls back cleanly to Complete Volume for unformatted single-block text`
- ✔ `extracts Title and Author directly from Gutenberg header preamble`
- ✔ `paginates chapter content snapping cleanly to sentence and word boundaries without splitting words`
- ✔ `parses short story anthologies with front-matter CONTENTS lists into individual story sections`
- ✔ `returns empty array on empty or invalid text`
- ✔ `extracts opening lines and authentic quote passages from full book text`
- ✔ `extracts passages from a 5-chapter book across narrative arc`
- ✔ `extracts passages from a 3-chapter and 2-chapter book`
- ✔ `extracts passages from a single-chapter un-segmented text by paragraph chunks`
- ✔ `parses books formatted with standalone Roman numerals (such as The Great Gatsby)`
- ✔ `parses multi-work anthologies with standalone titles and footnote brackets (e.g. Book 831 Four Arthurian Romances)`
- ✔ `parses complex TOC without catastrophic backtracking or thread lock`
- ✔ `caches and retrieves paginated chapter content with clearPaginationCache support`

</details>

<details>
<summary><b><code>src/lib/rate-limiter.test.ts</code></b> (7 tests)</summary>

- ✔ `allows requests within the configured max limit`
- ✔ `blocks requests exceeding the max limit within the sliding window`
- ✔ `isolates rate limits between different clients`
- ✔ `resets sliding window after the windowMs expires`
- ✔ `cleans up stale records during periodic garbage collection and preserves active ones`
- ✔ `allows manual reset of all records`
- ✔ `supports default options in constructor and global exports`

</details>

<details>
<summary><b><code>src/lib/smart-search.test.ts</code></b> (20 tests)</summary>

- ✔ `should return empty string for null, undefined, or empty inputs`
- ✔ `should lowercase text`
- ✔ `should strip diacritics and accents`
- ✔ `should replace punctuation with single spaces and trim`
- ✔ `should return empty array for empty queries`
- ✔ `should split multi-word query into normalized tokens`
- ✔ `should return true for empty or whitespace query`
- ✔ `should match single exact and partial words`
- ✔ `should match multi-word query in natural order`
- ✔ `should match multi-word query in REVERSE / arbitrary word order`
- ✔ `should return false if any token is missing from haystack`
- ✔ `should return all books when query is empty or blank`
- ✔ `should filter by title`
- ✔ `should filter by author name`
- ✔ `should filter with title + author in mixed / arbitrary word order`
- ✔ `should filter by subject / genre`
- ✔ `should filter by bookshelf tag`
- ✔ `should filter with diacritics / accent variations`
- ✔ `should return empty array when query does not match any volume`
- ✔ `should concatenate title, authors, subjects, bookshelves, and languages into searchable string`

</details>

<details>
<summary><b><code>src/lib/supabase/supabase.test.ts</code></b> (4 tests)</summary>

- ✔ `creates a browser Supabase client with environment variables`
- ✔ `creates a server Supabase client with cookie store and invokes cookie helpers`
- ✔ `handles updateSession middleware for incoming requests and cookies`
- ✔ `sanitizes Supabase URLs with trailing slashes, /rest/v1, or empty values`

</details>

<details>
<summary><b><code>src/lib/utils.test.ts</code></b> (16 tests)</summary>

- ✔ `should merge class names correctly`
- ✔ `should extract standard Gutenberg format keys`
- ✔ `should handle empty or undefined formats gracefully`
- ✔ `should format numbers with k and M suffix`
- ✔ `should estimate reading time based on word counts`
- ✔ `should truncate strings with ellipsis`
- ✔ `should convert last, first author strings to natural first last`
- ✔ `should strip birth and death years and parenthesized expansions from author strings`
- ✔ `should preserve single or clean names without commas`
- ✔ `should format array of author objects into comma separated string`
- ✔ `strips LCSH subdivisions separated by double dashes`
- ✔ `handles truncation when maxLength is specified`
- ✔ `falls back to Classic Literature for empty or missing inputs`
- ✔ `extracts and deduplicates clean subject tags up to maxTags`
- ✔ `deduplicates identical base subjects`
- ✔ `falls back to Classic Literature when empty or missing`

</details>

### 🔄 Hooks & React Query (7 Suites · 46 Tests)

<details>
<summary><b><code>src/hooks/queries/useBookContent.test.ts</code></b> (3 tests)</summary>

- ✔ `should fetch book text content from URL`
- ✔ `should return sample text when neither url nor bookId is provided`
- ✔ `should throw when fetch returns non-ok status or empty content`

</details>

<details>
<summary><b><code>src/hooks/queries/useBooks.test.ts</code></b> (12 tests)</summary>

- ✔ `should fetch public domain books list successfully`
- ✔ `should filter books by search term, topic, languages, era, and sort`
- ✔ `should execute fetchBooks directly`
- ✔ `should support predictive prefetching for next page`
- ✔ `should fallback to direct upstream when internal proxy fails`
- ✔ `should throw error when both internal proxy and direct API fail`
- ✔ `should throw when direct upstream returns non-ok status`
- ✔ `should fetch in server environment when window is undefined`
- ✔ `should throw in server environment when server fetch fails`
- ✔ `should handle simulated offline network drop in useBooks hook`
- ✔ `should respect enabled: false and not fetch books`
- ✔ `should throw when upstream returns invalid non-JSON body`

</details>

<details>
<summary><b><code>src/hooks/queries/useBookTranslations.test.ts</code></b> (13 tests)</summary>

- ✔ `strips subtitles after semicolons and colons`
- ✔ `strips volume and part suffixes`
- ✔ `returns original string when no subtitles or volumes exist`
- ✔ `strips leading structural stopwords to yield core search keywords`
- ✔ `extracts surname when author is formatted as `
- ✔ `extracts primary name when author has noble prefix or is formatted without comma`
- ✔ `resolves known ISO codes to human-readable names`
- ✔ `falls back to uppercase code for unknown languages`
- ✔ `returns the current book as active translation immediately`
- ✔ `fetches and groups available international translations from API`
- ✔ `handles a bilingual or multi-language current volume and includes all constituent languages`
- ✔ `pulls all available languages when API returns diverse multilingual editions`
- ✔ `gracefully handles fetch error and retains current edition`

</details>

<details>
<summary><b><code>src/hooks/useCatalogFilters.test.ts</code></b> (7 tests)</summary>

- ✔ `initializes with default catalog filters and page 1`
- ✔ `updates search and resets page to 1`
- ✔ `handles topic, language, and era updates correctly`
- ✔ `removes individual filter chips`
- ✔ `resets all filters cleanly`
- ✔ `toggles view modes and drawer visibility`
- ✔ `hydrates initial filter state from window.location.search including view=bookshelf`

</details>

<details>
<summary><b><code>src/hooks/useHasMounted.test.ts</code></b> (1 tests)</summary>

- ✔ `returns true after mounting on client`

</details>

<details>
<summary><b><code>src/hooks/usePerformanceTier.test.ts</code></b> (2 tests)</summary>

- ✔ `should detect performance tier and device capabilities`
- ✔ `should respect reduced motion preference`

</details>

<details>
<summary><b><code>src/hooks/useScrollDirection.test.ts</code></b> (8 tests)</summary>

- ✔ `initializes with BOTH header and toolbar visible at top of page`
- ✔ `preserves BOTH_VISIBLE while scrolling down within Hero section (scrollY <= dockOffset)`
- ✔ `preserves header visibility on initial arrival at catalog dock point`
- ✔ `transitions to toolbar-only docked at top-0 on subsequent downward scroll gesture`
- ✔ `transitions to fully hidden on third downward scroll gesture`
- ✔ `immediately reveals filter toolbar upon upward scroll reversal`
- ✔ `measures dynamic element offset from DOM when heroDockSelector is provided`
- ✔ `keeps both header and toolbar unconditionally visible when enabled is false`

</details>

### 🧩 UI Primitives & Motion (18 Suites · 53 Tests)

<details>
<summary><b><code>src/app/account/page.test.tsx</code></b> (12 tests)</summary>

- ✔ `renders guest prompt when unauthenticated`
- ✔ `renders authenticated profile and handles saving display name`
- ✔ `updates user reading atmosphere theme in account settings`
- ✔ `handles sign out action and redirects to home catalog`
- ✔ `renders Navbar and Footer with working navigation handlers`
- ✔ `handles toggling catalog sticky scroll navigation setting`
- ✔ `accurately calculates and renders custom shelves count excluding default shelf`
- ✔ `handles password update with validation and success feedback`
- ✔ `handles Suggest Strong Password in Profile Security card and auto-fills both fields`
- ✔ `opens delete account modal and cancels without deleting`
- ✔ `submits account deletion request and displays verification email confirmation`
- ✔ `renders BackToTop button on scroll threshold and triggers window scrollTo`

</details>

<details>
<summary><b><code>src/components/account/AccountDeleteModal.test.tsx</code></b> (1 tests)</summary>

- ✔ `renders confirmation modal and handles cancel and send deletion link`

</details>

<details>
<summary><b><code>src/components/account/AccountIdentityCard.test.tsx</code></b> (2 tests)</summary>

- ✔ `renders user details and handles input change and submit`
- ✔ `renders error message and success feedback`

</details>

<details>
<summary><b><code>src/components/account/AccountLibraryStats.test.tsx</code></b> (1 tests)</summary>

- ✔ `renders library statistics with links and values`

</details>

<details>
<summary><b><code>src/components/account/AccountPreferencesSection.test.tsx</code></b> (1 tests)</summary>

- ✔ `handles theme switching and sticky scroll toggle`

</details>

<details>
<summary><b><code>src/components/account/AccountSecuritySection.test.tsx</code></b> (1 tests)</summary>

- ✔ `renders password fields, strength meter, and buttons`

</details>

<details>
<summary><b><code>src/components/motion/MotionReveal.test.tsx</code></b> (1 tests)</summary>

- ✔ `should render children elements properly`

</details>

<details>
<summary><b><code>src/components/motion/StaggerGroup.test.tsx</code></b> (1 tests)</summary>

- ✔ `should render staggered child nodes`

</details>

<details>
<summary><b><code>src/components/ui/BackToTop.test.tsx</code></b> (4 tests)</summary>

- ✔ `does not render when scrollY is below threshold`
- ✔ `renders when scrolled past threshold`
- ✔ `scrolls smoothly to top when clicked`
- ✔ `hides when scrolling back below threshold`

</details>

<details>
<summary><b><code>src/components/ui/Badge.test.tsx</code></b> (1 tests)</summary>

- ✔ `should render badge content with variant and size classes`

</details>

<details>
<summary><b><code>src/components/ui/Button.test.tsx</code></b> (4 tests)</summary>

- ✔ `should render button text and handle click events`
- ✔ `should display loading spinner and disable button when isLoading is true`
- ✔ `should apply variant and size classes properly`
- ✔ `should render polymorphically with as=`

</details>

<details>
<summary><b><code>src/components/ui/Card.test.tsx</code></b> (1 tests)</summary>

- ✔ `should render card children properly`

</details>

<details>
<summary><b><code>src/components/ui/Input.test.tsx</code></b> (2 tests)</summary>

- ✔ `should render input and handle text changes`
- ✔ `should render clear button when onClear is provided and value is not empty`

</details>

<details>
<summary><b><code>src/components/ui/Modal.test.tsx</code></b> (3 tests)</summary>

- ✔ `should not render anything when isOpen is false`
- ✔ `should render modal content when isOpen is true`
- ✔ `should trigger onClose when clicking backdrop or pressing Escape`

</details>

<details>
<summary><b><code>src/config/config.test.ts</code></b> (10 tests)</summary>

- ✔ `defines valid non-empty endpoint URLs`
- ✔ `provides literary eras with valid date boundaries`
- ✔ `provides genre facets with valid IDs and labels`
- ✔ `provides language mappings with ISO-639 codes`
- ✔ `provides valid sort and format options`
- ✔ `provides valid hero book spotlight and collection of classics`
- ✔ `extracts passages for featured and generic books via getBookPassages`
- ✔ `provides 12 curated quotes with non-empty metadata`
- ✔ `provides complete theme configs for light, sepia, and dark`
- ✔ `getReaderTheme returns exact theme or falls back to light`

</details>

<details>
<summary><b><code>src/config/routes.test.ts</code></b> (3 tests)</summary>

- ✔ `provides static canonical routes`
- ✔ `builds dynamic reader route with id`
- ✔ `builds view query route correctly`

</details>

<details>
<summary><b><code>src/config/site-config.test.ts</code></b> (3 tests)</summary>

- ✔ `provides site branding and metadata constants`
- ✔ `builds canonical Gutenberg ebook URL`
- ✔ `provides persistent storage keys`

</details>

<details>
<summary><b><code>src/proxy.test.ts</code></b> (2 tests)</summary>

- ✔ `calls updateSession with the incoming request`
- ✔ `exports valid matcher config`

</details>

---

## Quality Gate Verification
All 7 Closed-Loop Quality Gateways passed with zero blockers. The application is release-ready.

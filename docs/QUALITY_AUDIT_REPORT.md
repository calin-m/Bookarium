# Quality Audit & Test Suite Catalog Report

**Last Generated**: Thu, 03 Sep 2026 17:14:28 GMT  
**Overall Status**: 🟢 PASSED  
**Total Test Suites**: 107 passed  
**Total Verified Tests**: 731 passed  

---

## 🛡️ 7-Gateway Quality Summary

| Gateway | Check | Status | Details |
|---|---|---|---|
| **Pass 0.5** | Pre-Commit Secret Scanner | ✅ Passed | 0 exposed tokens, API keys, or private certificates |
| **Pass 1** | TypeScript Compiler | ✅ Passed | Strict type checking (`tsc --noEmit`) 0 errors |
| **Pass 2** | MSW Server & Queries | ✅ Passed | Mock Service Worker v2 network interception verified |
| **Pass 3** | Vitest Test Suite | ✅ Passed | **107/107 test suites passed** (731 total tests) |
| **Pass 3.5** | Coverage Threshold | ✅ Passed | Minimum 80% coverage threshold met across all metrics |
| **Pass 4** | Living Docs AST Sync | ✅ Passed | `docs/ARCHITECTURE.md`, `CHANGELOG.md`, & `docs/QUALITY_AUDIT_REPORT.md` synced |
| **Pass 5** | ADR Decision Ledger | ✅ Passed | 12 Architectural Decision Records validated |
| **Pass 6** | ESLint & Knip Audit | ✅ Passed | 0 lint errors, 0 unused exports / dead files |
| **Pass 7** | Next.js Production Build | ✅ Passed | Turbopack production bundle compiled cleanly |

---

## 📊 Code Coverage Metrics

- **Lines**: **91.92%** (3861/4200) — *Target: $ge$ 80%*
- **Statements**: **90.12%** (4209/4670) — *Target: $ge$ 80%*
- **Functions**: **87.32%** (1020/1168) — *Target: $ge$ 80%*
- **Branches**: **80.2%** (3509/4375) — *Target: $ge$ 80%*

---

## 🧪 Comprehensive Test Suite Catalog (107 Suites / 731 Tests)

### 🚀 App Routes & Pages (10 Suites · 75 Tests)

<details>
<summary><b><code>src/app/api/books/content/route.security.test.ts</code></b> (8 tests)</summary>

- ✔ `blocks AWS and GCP cloud metadata IP endpoints`
- ✔ `blocks loopback and private RFC 1918 IPv4/IPv6 addresses`
- ✔ `blocks domain spoofing and subdomains targeting gutenberg.org`
- ✔ `blocks directory traversal attempts in query parameters and paths`
- ✔ `blocks non-HTTP/HTTPS protocols`
- ✔ `ensures global.fetch is never triggered for unauthenticated/malicious inputs`
- ✔ `strictly confines legitimate outgoing requests to approved Gutenberg CDN endpoints`
- ✔ `protects backend from request flooding by enforcing 429 response`

</details>

<details>
<summary><b><code>src/app/api/books/content/route.test.ts</code></b> (9 tests)</summary>

- ✔ `should return 429 when client exceeds rate limits`
- ✔ `should return 400 if neither url nor id is provided`
- ✔ `should block SSRF attempts targeting cloud metadata or internal network`
- ✔ `should validate official Gutenberg upstream URLs as safe and sanitize them`
- ✔ `should reject path traversal attempts in upstream URLs`
- ✔ `should fetch and return book text for valid id`
- ✔ `should return 502 if upstream fails or times out`
- ✔ `guarantees fetch is strictly called with canonical Gutenberg endpoints only`
- ✔ `never calls fetch when an invalid or SSRF payload is provided`

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
<summary><b><code>src/app/api/translate/route.test.ts</code></b> (11 tests)</summary>

- ✔ `translates text successfully and returns segments`
- ✔ `rejects request with invalid JSON payload`
- ✔ `rejects request with missing or empty text`
- ✔ `rejects request with invalid target language code`
- ✔ `handles upstream service failure with 502`
- ✔ `handles malformed upstream payload with 502`
- ✔ `handles timeout (AbortError) with 504`
- ✔ `handles unexpected failure with 500`
- ✔ `enforces rate limiting and returns 429 when quota exceeded`
- ✔ `rejects request exceeding 15,000 character maximum payload`
- ✔ `serves identical translation from in-memory LRU cache on second call with X-Cache-Lookup HIT`

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
<summary><b><code>src/app/page.test.tsx</code></b> (12 tests)</summary>

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
- ✔ `should switch to Notebook view when Notebook tab in Navbar is clicked`

</details>

<details>
<summary><b><code>src/app/providers.test.tsx</code></b> (1 tests)</summary>

- ✔ `should render children within QueryClientProvider`

</details>

<details>
<summary><b><code>src/app/read/[id]/page.test.tsx</code></b> (19 tests)</summary>

- ✔ `renders header, reading surface, and sticky footer with metadata`
- ✔ `navigates back to origin page (preserving catalog/bookshelf/favorites state) when back button is clicked`
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
- ✔ `opens In-Book Search Drawer, finds matching phrase, and jumps to chapter on selection`
- ✔ `toggles In-Book Search Drawer using Ctrl+F keyboard shortcut`
- ✔ `enforces mutual exclusivity between all 4 reader modals (TOC, Search, Controls, Language)`
- ✔ `toggles Read Aloud audio bar and triggers speech controls`
- ✔ `toggles Annotations & Notes drawer from reader header`
- ✔ `allows user to select text, apply highlight color, update note, and delete from drawer`

</details>

### 🎨 Catalog & Presentation (18 Suites · 153 Tests)

<details>
<summary><b><code>src/components/presentation/AdvancedFilterDrawer.test.tsx</code></b> (10 tests)</summary>

- ✔ `should render drawer with all filter sections when open`
- ✔ `should handle era selection on click`
- ✔ `should handle sort order change`
- ✔ `should handle genre facet selection on chip click`
- ✔ `should handle format selection change`
- ✔ `should handle language selection change`
- ✔ `should reset all filters on reset button click`
- ✔ `should apply filters and close drawer on apply button click`
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
<summary><b><code>src/components/presentation/bookshelf/BookshelfManageModals.test.tsx</code></b> (3 tests)</summary>

- ✔ `renders create modal and submits new shelf`
- ✔ `renders rename and delete modals`
- ✔ `renders clear offline shelf confirmation modal and handles cancel and confirm`

</details>

<details>
<summary><b><code>src/components/presentation/bookshelf/BookshelfMobileModal.test.tsx</code></b> (3 tests)</summary>

- ✔ `returns null when selectedMobileBook is null`
- ✔ `renders modal with formatted author names and triggers actions`
- ✔ `renders offline indicator and fires onToggleOffline`

</details>

<details>
<summary><b><code>src/components/presentation/bookshelf/BookshelfSpine.test.tsx</code></b> (4 tests)</summary>

- ✔ `renders spine title, author, and handles keyboard interaction`
- ✔ `triggers quick actions from desktop hover card`
- ✔ `renders offline indicator and fires onToggleOffline when clicked`
- ✔ `renders cursor-following portal tooltip on hover card button hover`

</details>

<details>
<summary><b><code>src/components/presentation/BookshelfRack.test.tsx</code></b> (30 tests)</summary>

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
- ✔ `triggers onBookClick when Read button is clicked on hover card`
- ✔ `triggers onDownloadClick when Download button is clicked on hover card`
- ✔ `toggles saved bookmark state when Save button is clicked on hover card`
- ✔ `toggles liked state when Like button is clicked on hover card`
- ✔ `opens quick-action bottom sheet on mobile spine tap without immediate navigation`
- ✔ `triggers onBookClick and closes sheet when clicking Read in mobile action sheet`
- ✔ `dismisses mobile action sheet when clicking backdrop`
- ✔ `handles mobile action sheet close button and dismiss`
- ✔ `triggers download callback from mobile action sheet`
- ✔ `toggles bookmark and like status from mobile action sheet`
- ✔ `handles moving a book to another shelf and default read routing from mobile action sheet`
- ✔ `renders offline download button and triggers download all`
- ✔ `renders individual offline download button on book spine and triggers toggle`
- ✔ `renders All Saved for Offline notice and Clear Offline Shelf button when all books are offline, opens modal, and confirms removeAll`

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
<summary><b><code>src/components/presentation/DownloadDrawer.test.tsx</code></b> (3 tests)</summary>

- ✔ `should render download formats when opened with a book`
- ✔ `should return null when book is null`
- ✔ `should provide canonical Gutenberg download links even if book.formats is empty`

</details>

<details>
<summary><b><code>src/components/presentation/Footer.test.tsx</code></b> (1 tests)</summary>

- ✔ `should render legal manifesto, links, and attribution`

</details>

<details>
<summary><b><code>src/components/presentation/HeroFeaturedBook3D.test.tsx</code></b> (5 tests)</summary>

- ✔ `renders book title, author, and public domain badges`
- ✔ `triggers shuffle when shuffle button is clicked`
- ✔ `triggers read callback when Read button is clicked`
- ✔ `renders static 2D presentation when hardware tier is low or heavy motion is disallowed`
- ✔ `triggers read callback from 2D presentation mode`

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
<summary><b><code>src/components/presentation/Navbar.test.tsx</code></b> (16 tests)</summary>

- ✔ `should render brand and navigation items`
- ✔ `should fill highlighter icon when annotations are saved in notebook`
- ✔ `triggers onViewChange with notebook when Notebook tab is clicked`
- ✔ `applies active styling when activeView is notebook`
- ✔ `should fill bookmark icon when books are saved to bookshelf`
- ✔ `should fill heart icon when books are liked in favorites`
- ✔ `should trigger onViewChange callback when clicking tabs`
- ✔ `should cycle through themes when clicking theme button`
- ✔ `renders Sign In button for guests and triggers openAuthModal`
- ✔ `renders direct Account Link when user is authenticated`
- ✔ `handles keyboard Enter and Space on brand logo to navigate back to catalog`
- ✔ `applies -translate-y-full when isVisible is false`
- ✔ `applies translate-y-0 when isVisible is true`
- ✔ `renders active account button styling when activeView is account`
- ✔ `renders active Sign In button styling for guests when activeView is account`
- ✔ `renders GitHub repository link with target _blank on the header`

</details>

<details>
<summary><b><code>src/components/presentation/NotebookView.test.tsx</code></b> (17 tests)</summary>

- ✔ `renders empty state when there are no annotations`
- ✔ `renders saved annotations grouped by volume with resolved metadata`
- ✔ `filters annotations by search query across quote, note, title, and author`
- ✔ `filters annotations by pastel color tabs`
- ✔ `allows toggling between By Book grouping and Chronological stream`
- ✔ `allows user to edit note inline and cancel or save`
- ✔ `allows copying quote with formatted academic citation`
- ✔ `navigates directly to the reader when clicking Read Passage`
- ✔ `shows confirmation modal and deletes an individual quote card when confirmed`
- ✔ `cancels individual quote deletion when clicking cancel in modal`
- ✔ `clears all annotations when confirming clear everything in modal`
- ✔ `cancels clear everything in modal when clicking cancel button`
- ✔ `allows adding a personal note when none was initially provided`
- ✔ `navigates to reader when volume header title is clicked`
- ✔ `shows reset filters button when search returns 0 results and resets filters`
- ✔ `resolves metadata from savedBooks and fallback when bookTitle is not stored`
- ✔ `translates vertical wheel scroll to horizontal scroll on color filter tabs`

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

### 📖 In-Browser Focus Reader (15 Suites · 111 Tests)

<details>
<summary><b><code>src/components/reader/GutenbergInfoModal.test.tsx</code></b> (3 tests)</summary>

- ✔ `renders null when not open`
- ✔ `renders volume metadata, title, and handles close action`
- ✔ `triggers onClose when clicking backdrop`

</details>

<details>
<summary><b><code>src/components/reader/ReaderAnnotationsDrawer.test.tsx</code></b> (9 tests)</summary>

- ✔ `renders annotations list with quotes and section pills`
- ✔ `renders empty state when there are no annotations`
- ✔ `filters annotations by color tab`
- ✔ `filters annotations by search input`
- ✔ `calls onJumpToAnnotation and closes drawer when jump button is clicked`
- ✔ `allows editing an annotation note`
- ✔ `shows confirmation modal and calls onDeleteAnnotation when confirmed`
- ✔ `cancels deletion when clicking cancel in modal`
- ✔ `translates vertical wheel scroll to horizontal scroll on color filter tags`

</details>

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
<summary><b><code>src/components/reader/ReaderDrawerShell.test.tsx</code></b> (5 tests)</summary>

- ✔ `renders children when open`
- ✔ `does not render when isOpen is false`
- ✔ `calls onClose when close button is clicked`
- ✔ `calls onClose when clicking the backdrop`
- ✔ `calls onClose when pressing Escape key`

</details>

<details>
<summary><b><code>src/components/reader/ReaderErrorView.test.tsx</code></b> (2 tests)</summary>

- ✔ `renders error message and retry button`
- ✔ `renders without retry button when onRetry is not provided`

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
<summary><b><code>src/components/reader/ReaderHeader.test.tsx</code></b> (14 tests)</summary>

- ✔ `renders book title, author, and progress metrics correctly`
- ✔ `triggers onBack when back button is clicked`
- ✔ `triggers onToggleToc and onToggleControls when respective buttons are clicked`
- ✔ `triggers onToggleSearch when search button is clicked`
- ✔ `triggers right-side theme cycling for light, sepia, and dark`
- ✔ `opens and closes the Gutenberg Archive volume info modal`
- ✔ `sanitizes and renders extra long titles and multiline strings gracefully`
- ✔ `filters out placeholder author strings and falls back to featured fixture`
- ✔ `renders the dedicated sub-header metadata ribbon with Book ID, Section, and Progress`
- ✔ `renders integrated resume notice ribbon in sub-header and handles restart and dismiss`
- ✔ `renders language and translation switcher and handles edition selection`
- ✔ `handles link copying when share button is clicked`
- ✔ `toggles mobile action tray and executes actions`
- ✔ `renders Read Aloud button and handles click toggles`

</details>

<details>
<summary><b><code>src/components/reader/ReaderLanguageDrawer.test.tsx</code></b> (7 tests)</summary>

- ✔ `does not render content when isOpen is false`
- ✔ `renders dual-tier layout with archival editions and instant translation`
- ✔ `allows selecting popular translation quick-picks and dropdown`
- ✔ `supports toggling reading display mode and reverting to original`
- ✔ `unselects dynamic language when clicking the active quick-pick chip`
- ✔ `renders fallback message when archival translations array is empty`
- ✔ `renders properly in Sepia theme`

</details>

<details>
<summary><b><code>src/components/reader/ReaderLoadingView.test.tsx</code></b> (1 tests)</summary>

- ✔ `renders loading indicators and typography text`

</details>

<details>
<summary><b><code>src/components/reader/ReaderSearchDrawer.test.tsx</code></b> (8 tests)</summary>

- ✔ `renders search drawer with input when isOpen is true`
- ✔ `does not render when isOpen is false`
- ✔ `updates search query, shows match count, and renders result cards`
- ✔ `clears search query when clear button is clicked`
- ✔ `calls onSelectMatch and onClose when clicking a search match card`
- ✔ `shows empty feedback when no matches are found`
- ✔ `closes drawer on Escape key press`
- ✔ `closes drawer when clicking the backdrop`

</details>

<details>
<summary><b><code>src/components/reader/ReaderSpeechBar.test.tsx</code></b> (10 tests)</summary>

- ✔ `renders null when isOpen is false`
- ✔ `renders narration metadata, page coordinates, and progress percentage`
- ✔ `handles play, pause, and resume actions accurately`
- ✔ `navigates previous and next sentences and respects boundary disable flags`
- ✔ `allows changing voices via dropdown`
- ✔ `renders categorized optgroups for Natural and Standard voices with quality badge`
- ✔ `allows selecting speed rates from the popover menu`
- ✔ `calls onClose when clicking close button`
- ✔ `adapts properly to sepia and dark themes`
- ✔ `renders with mobile-responsive positioning and WCAG touch target classes`

</details>

<details>
<summary><b><code>src/components/reader/ReaderSubHeaderRibbon.test.tsx</code></b> (2 tests)</summary>

- ✔ `renders default archival metadata, section counter, and progress pill`
- ✔ `renders resume notice when resumeNotice data is provided`

</details>

<details>
<summary><b><code>src/components/reader/ReaderSurface.test.tsx</code></b> (21 tests)</summary>

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
- ✔ `renders highlighted sentence with mark tag when highlightedSentence matches text`
- ✔ `renders translating indicator when isTranslating is true`
- ✔ `renders translatedText in place of base content when provided in translated mode`
- ✔ `renders bilingual mode with paired translation segments and speech highlight`
- ✔ `renders user annotations with designated highlight color marks and triggers onSelectAnnotation`
- ✔ `renders multiple annotations with amber, mint, and rose colors alongside speech highlight`
- ✔ `detects window text selection and triggers onTextSelected on mouseUp`
- ✔ `applies color-specific selection styling to highlight marks`
- ✔ `renders user annotations inside bilingual parallel mode segments`

</details>

<details>
<summary><b><code>src/components/reader/ReaderTocDrawer.test.tsx</code></b> (5 tests)</summary>

- ✔ `renders table of contents with chapters and starting page badges`
- ✔ `filters chapters based on search query and clears search query`
- ✔ `calls onSelectChapter and onClose when a chapter item is clicked`
- ✔ `closes drawer on Escape key press`
- ✔ `does not render when isOpen is false`

</details>

<details>
<summary><b><code>src/components/reader/TextHighlightPopover.test.tsx</code></b> (12 tests)</summary>

- ✔ `renders all 4 color choices and action buttons`
- ✔ `calls onSelectColor when a color button is clicked`
- ✔ `expands note input and calls onSaveNote with entered text`
- ✔ `calls onCopyQuote when copy button is clicked`
- ✔ `renders delete button and calls onDelete when existingAnnotationId is present`
- ✔ `calls onClose when escape key is pressed`
- ✔ `calls onClose when clicking outside the popover`
- ✔ `calls onCopyQuote when provided, or copies selected text to clipboard`
- ✔ `submits note on clicking Save Note button in note textarea`
- ✔ `renders in sepia and dark themes without crashing`
- ✔ `calls onClose when touchstart occurs outside the popover`
- ✔ `positions below anchor on touch devices to avoid native mobile context menu collision`

</details>

### 🔐 Authentication & Security (1 Suites · 15 Tests)

<details>
<summary><b><code>src/components/auth/AuthModal.test.tsx</code></b> (15 tests)</summary>

- ✔ `renders nothing when isAuthModalOpen is false`
- ✔ `renders Sign In view with email and password inputs`
- ✔ `renders Sign Up view with inputs and create button`
- ✔ `submits valid Sign Up credentials to auth store`
- ✔ `renders email verification screen and navigates to sign in when email confirmation is required`
- ✔ `validates password mismatch on Sign Up`
- ✔ `handles form submission in sign in mode`
- ✔ `renders error alert when error exists`
- ✔ `renders resend link when error indicates email not confirmed and executes resend`
- ✔ `submits magic link request on valid email`
- ✔ `renders magic link confirmation screen and navigates back to sign in`
- ✔ `handles Suggest Strong Password generation and visibility toggle`
- ✔ `navigates from sign in view to forgot password view`
- ✔ `submits password reset request and displays check email confirmation`
- ✔ `navigates back to sign in from confirmation screen`

</details>

### ⚡ Zustand State Stores (6 Suites · 70 Tests)

<details>
<summary><b><code>src/stores/useAnnotationStore.test.ts</code></b> (16 tests)</summary>

- ✔ `initializes with empty annotations and outbox`
- ✔ `adds an annotation in guest mode (offline/local only)`
- ✔ `updates an annotation note`
- ✔ `updates an annotation color without creating duplicates`
- ✔ `deduplicates addAnnotation on identical text by updating color and note`
- ✔ `syncs color update to Supabase when userId is provided and queues outbox on error`
- ✔ `deletes an annotation`
- ✔ `filters annotations by book and page correctly`
- ✔ `syncs to Supabase when userId is provided`
- ✔ `queues outbox mutation on Supabase error and flushes on reconnect`
- ✔ `syncWithCloud merges remote notes and uploads un-synced guest notes`
- ✔ `updates annotation note with userId and falls back to outbox on network error`
- ✔ `deletes annotation with userId and falls back to outbox on network error`
- ✔ `handles syncWithCloud with empty userId or network error safely`
- ✔ `records tombstones on deleteAnnotation and prevents zombie resurrection during sync`
- ✔ `clamps oversized text and note payloads to prevent localStorage quota exhaustion`

</details>

<details>
<summary><b><code>src/stores/useAuthStore.test.ts</code></b> (18 tests)</summary>

- ✔ `manages modal open, close, and view state transitions`
- ✔ `handles signInWithPassword success and error states`
- ✔ `handles sign in error and sets error message`
- ✔ `handles signOut`
- ✔ `handles signUpWithPassword success (with session and unconfirmed)`
- ✔ `handles resendVerificationEmail success and error`
- ✔ `handles signInWithOtp (magic link) success and error`
- ✔ `handles signInWithOAuth success and error`
- ✔ `hydrates user on initializeAuth when active session exists`
- ✔ `updates auth state when onAuthStateChange triggers SIGNED_OUT`
- ✔ `unsubscribes cleanly when initializeAuth cleanup function is called`
- ✔ `returns error when updateProfile is called while logged out`
- ✔ `updates profile display name in Supabase and local store when logged in`
- ✔ `handles updateProfile database failure and records error`
- ✔ `handles resetPasswordForEmail success and failure`
- ✔ `handles updatePassword success and failure`
- ✔ `handles requestAccountDeletion success and failure`
- ✔ `handles deleteAccount success and failure`

</details>

<details>
<summary><b><code>src/stores/useBookshelfStore.test.ts</code></b> (17 tests)</summary>

- ✔ `should initialize with empty collections`
- ✔ `should toggle save book in bookshelf`
- ✔ `should manage reading queue`
- ✔ `should toggle like status and store likedBooks`
- ✔ `should sync and clear liked books`
- ✔ `should call Supabase upsert and delete on toggleLikeBook with userId`
- ✔ `returns live hydrated state and reactive actions`
- ✔ `handles activeBookshelfId selection and cloud bookshelf list`
- ✔ `handles syncWithCloud fetching bookshelves and items`
- ✔ `bidirectionally pushes unsynced local books and favorites to Supabase during syncWithCloud`
- ✔ `handles createCloudBookshelf and migrateLocalBooksToCloud`
- ✔ `handles updateCloudBookshelf and deleteCloudBookshelf`
- ✔ `handles moveBookToShelf properly`
- ✔ `creates a new bookshelf item if book is not in cloudBookshelfItems yet`
- ✔ `queues offline actions to outbox when Supabase network rejects and flushes them on syncWithCloud`
- ✔ `returns saved books count via useSavedBooksCount`
- ✔ `returns isSaved status via useIsBookSaved`

</details>

<details>
<summary><b><code>src/stores/usePreferencesStore.test.ts</code></b> (5 tests)</summary>

- ✔ `initializes with stickyScrollEnabled = true by default`
- ✔ `sets stickyScrollEnabled to specified boolean value`
- ✔ `toggles stickyScrollEnabled back and forth`
- ✔ `initializes speech preferences with default values`
- ✔ `updates speech preferences and resets them correctly`

</details>

<details>
<summary><b><code>src/stores/useReaderStore.test.ts</code></b> (8 tests)</summary>

- ✔ `should initialize with default reader settings`
- ✔ `should open and close reader modal with book`
- ✔ `should clamp font size between 12 and 36`
- ✔ `should clamp line height between 1.2 and 2.6`
- ✔ `should update theme and font family`
- ✔ `should record and retrieve reading progress percentage`
- ✔ `should save, retrieve, and clear exact reading positions`
- ✔ `should toggle and set isMobileTrayOpen`

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

### 📚 Gutenberg Parsers & Metadata (15 Suites · 113 Tests)

<details>
<summary><b><code>src/lib/book-metadata.test.ts</code></b> (9 tests)</summary>

- ✔ `identifies placeholder and empty authors correctly`
- ✔ `identifies placeholder and generic volume titles correctly`
- ✔ `resolves curated static fixtures (Tier 1) for featured book IDs with 0ms preloaded data`
- ✔ `resolves metadata from Zustand client store (Tier 2) when matching ID`
- ✔ `resolves metadata from REST API response (Tier 3)`
- ✔ `falls back to extracted Gutenberg raw text header (Tier 4) when store and API are unavailable or have placeholders`
- ✔ `bypasses store placeholder authors and uses authentic API/header authors`
- ✔ `handles fallback defaults when all metadata sources are empty`
- ✔ `resolves languages correctly with strict ID-guarding from store, API, and header metadata`

</details>

<details>
<summary><b><code>src/lib/gutenberg/metadata.test.ts</code></b> (2 tests)</summary>

- ✔ `extracts Title and Author directly from Gutenberg header preamble`
- ✔ `normalizes language names to standard codes`

</details>

<details>
<summary><b><code>src/lib/gutenberg/pagination.test.ts</code></b> (5 tests)</summary>

- ✔ `correctly calculates reading time based on 200 WPM`
- ✔ `calculates dynamic characters per page scaled by font size`
- ✔ `calculates true continuous volume page spreads`
- ✔ `paginates chapter content snapping cleanly to sentence and word boundaries without splitting words`
- ✔ `caches and retrieves paginated chapter content with clearPaginationCache support`

</details>

<details>
<summary><b><code>src/lib/gutenberg/passages.test.ts</code></b> (5 tests)</summary>

- ✔ `returns empty array on empty or invalid text`
- ✔ `extracts opening lines and authentic quote passages from full book text`
- ✔ `extracts passages from a 5-chapter book across narrative arc`
- ✔ `extracts passages from a 3-chapter and 2-chapter book`
- ✔ `extracts passages from a single-chapter un-segmented text by paragraph chunks`

</details>

<details>
<summary><b><code>src/lib/gutenberg/reflow.test.ts</code></b> (3 tests)</summary>

- ✔ `reflows single-newline Gutenberg hard wraps while preserving double newlines`
- ✔ `reflows standard Gutenberg paragraphs that have 4-space first-line indentation`
- ✔ `preserves indented verse and poetry lines during reflow`

</details>

<details>
<summary><b><code>src/lib/gutenberg/segmentation.test.ts</code></b> (9 tests)</summary>

- ✔ `returns empty array on null or undefined input`
- ✔ `falls back cleanly to Complete Volume for unformatted single-block text`
- ✔ `parses structured Project Gutenberg eBook into preamble, chapters, and license colophon`
- ✔ `suppresses front-matter Table of Contents cluster lines from becoming empty duplicate chapters`
- ✔ `parses short story anthologies with front-matter CONTENTS lists into individual story sections`
- ✔ `parses books formatted with standalone Roman numerals (such as The Great Gatsby)`
- ✔ `parses multi-work anthologies with standalone titles and footnote brackets (e.g. Book 831 Four Arthurian Romances)`
- ✔ `parses complex TOC without catastrophic backtracking or thread lock`
- ✔ `parses books formatted with dotted Roman numerals and subtitle lines (such as The Time Machine)`

</details>

<details>
<summary><b><code>src/lib/gutenberg-parser.test.ts</code></b> (2 tests)</summary>

- ✔ `re-exports all core Gutenberg subsystems and functions without regression`
- ✔ `delegates parsing correctly through the facade`

</details>

<details>
<summary><b><code>src/lib/in-book-search.test.ts</code></b> (9 tests)</summary>

- ✔ `returns empty result when chapters array is empty or undefined`
- ✔ `returns empty result when search query is empty, whitespace, or less than 2 chars`
- ✔ `finds exact case-insensitive matches across chapters`
- ✔ `finds phrase matches preserving surrounding context and pagination coordinates`
- ✔ `safely handles regex special characters and punctuation in query`
- ✔ `handles diacritic normalization fallback`
- ✔ `caps matches to maxResults limit`
- ✔ `safely skips chapters with null or empty content`
- ✔ `caps matches to maxResults when using diacritic fallback`

</details>

<details>
<summary><b><code>src/lib/offline-storage.test.ts</code></b> (10 tests)</summary>

- ✔ `saves book text to offline storage`
- ✔ `retrieves offline book text correctly`
- ✔ `returns null when book is not offline`
- ✔ `checks if a book is offline`
- ✔ `removes offline book`
- ✔ `fetches all offline book IDs`
- ✔ `retrieves all offline books metadata without returning full text payloads`
- ✔ `clears all offline books`
- ✔ `returns storage quota metrics from navigator.storage.estimate`
- ✔ `evicts oldest downloaded books first to free requested space`

</details>

<details>
<summary><b><code>src/lib/password.test.ts</code></b> (8 tests)</summary>

- ✔ `generates a password of default length 16`
- ✔ `generates a password of custom length`
- ✔ `produces distinct passwords on successive calls (entropy check)`
- ✔ `handles empty or null string`
- ✔ `handles passwords shorter than 6 characters as Too short`
- ✔ `rates standard 6-character passwords as Weak`
- ✔ `rates mixed-case alphanumeric passwords as Moderate`
- ✔ `rates long complex passwords with symbols as Strong`

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
<summary><b><code>src/lib/speech-utils.test.ts</code></b> (3 tests)</summary>

- ✔ `returns true for high-definition neural and natural voice names`
- ✔ `returns false for standard mechanical or missing voice names`
- ✔ `removes vendor brand prefixes and trims whitespace`

</details>

<details>
<summary><b><code>src/lib/supabase/supabase.test.ts</code></b> (4 tests)</summary>

- ✔ `creates a browser Supabase client with environment variables`
- ✔ `creates a server Supabase client with cookie store and invokes cookie helpers`
- ✔ `handles updateSession middleware for incoming requests and cookies`
- ✔ `sanitizes Supabase URLs with trailing slashes, /rest/v1, or empty values`

</details>

<details>
<summary><b><code>src/lib/utils.test.ts</code></b> (17 tests)</summary>

- ✔ `should merge class names correctly`
- ✔ `should extract standard Gutenberg format keys`
- ✔ `should handle empty or undefined formats gracefully`
- ✔ `should generate canonical Project Gutenberg fallback URLs when bookId is provided`
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

### 🔄 Hooks & React Query (17 Suites · 111 Tests)

<details>
<summary><b><code>src/hooks/queries/useBookContent.test.ts</code></b> (4 tests)</summary>

- ✔ `should fetch book text content from URL`
- ✔ `should return sample text when neither url nor bookId is provided`
- ✔ `should throw when fetch returns non-ok status or empty content`
- ✔ `should return offline cached content without calling fetch when available`

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
<summary><b><code>src/hooks/queries/useBookTranslations.test.ts</code></b> (14 tests)</summary>

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
- ✔ `discovers alternative translations bi-directionally when active book is in a non-English edition (e.g. Dutch -> English)`
- ✔ `gracefully handles fetch error and retains current edition`

</details>

<details>
<summary><b><code>src/hooks/queries/usePageTranslation.test.ts</code></b> (7 tests)</summary>

- ✔ `generates consistent cache keys`
- ✔ `handles localStorage read and write safely`
- ✔ `returns empty result when targetLanguage is null`
- ✔ `fetches translation and populates result and localStorage`
- ✔ `uses cached translation directly without calling fetch`
- ✔ `handles API error gracefully`
- ✔ `throws error when fetchTranslation fails without JSON body`

</details>

<details>
<summary><b><code>src/hooks/reader/speech-utils.test.ts</code></b> (5 tests)</summary>

- ✔ `returns true for high-definition neural and natural voice names`
- ✔ `returns false for standard mechanical or missing voice names`
- ✔ `splits paragraphs into punctuation-delimited sentences`
- ✔ `handles quotes and dialogue gracefully`
- ✔ `returns empty array for empty or whitespace text`

</details>

<details>
<summary><b><code>src/hooks/reader/useGutenbergParserWorker.test.ts</code></b> (5 tests)</summary>

- ✔ `returns empty result when contentText is empty or undefined`
- ✔ `parses text synchronously via fallback when workerFactory returns null`
- ✔ `dispatches worker postMessage and handles worker response when Worker is available`
- ✔ `falls back gracefully when worker encounters an error`
- ✔ `cancels in-flight worker and prevents stale data when switching books`

</details>

<details>
<summary><b><code>src/hooks/reader/useReaderDrawers.test.ts</code></b> (5 tests)</summary>

- ✔ `initializes with all drawers closed`
- ✔ `opens a drawer via openDrawer`
- ✔ `toggles a drawer open and closed`
- ✔ `switches between drawers maintaining mutual exclusivity`
- ✔ `closes active drawer via closeDrawer`

</details>

<details>
<summary><b><code>src/hooks/reader/useReaderGestures.test.ts</code></b> (5 tests)</summary>

- ✔ `initializes with null zoom feedback`
- ✔ `triggers onNextPage on leftward swipe with sufficient distance`
- ✔ `triggers onPreviousPage on rightward swipe with sufficient distance`
- ✔ `does not trigger swipe if vertical delta exceeds threshold ratio`
- ✔ `handles 2-finger pinch scaling and clamps font size`

</details>

<details>
<summary><b><code>src/hooks/reader/useReaderSession.test.ts</code></b> (4 tests)</summary>

- ✔ `initializes on chapter 0 and page 1`
- ✔ `handles next and previous page transitions across chapters`
- ✔ `allows chapter selection and restart to chapter 0 page 1`
- ✔ `jumps to target page accurately across chapters`

</details>

<details>
<summary><b><code>src/hooks/reader/useReaderSpeech.test.ts</code></b> (17 tests)</summary>

- ✔ `detects Web Speech API support and prioritizes Natural voices`
- ✔ `plays sentences and updates playback state`
- ✔ `pauses and resumes playback correctly`
- ✔ `progresses to next sentence on utterance onend`
- ✔ `triggers onPageComplete callback when all sentences finish`
- ✔ `supports skipNext and skipPrev navigation`
- ✔ `allows rate adjustment and voice switching`
- ✔ `handles utterance onerror correctly`
- ✔ `handles voiceschanged event and diverse voice scoring keywords`
- ✔ `triggers MediaSession action handlers`
- ✔ `updates utterance dynamically when setRate or setVoice called while actively playing`
- ✔ `handles fallback when no voices are available`
- ✔ `cleans up and cancels speech upon stop() or unmount`
- ✔ `adapts to text change when user flips page while playing and restarts from sentence 0`
- ✔ `triggers onNextPage when skipNext called on the final sentence of current page`
- ✔ `triggers onPreviousPage when skipPrev called on the first sentence of current page`
- ✔ `respects defaultRate, preferredVoiceURI, and invokes onRateChange and onVoiceChange`

</details>

<details>
<summary><b><code>src/hooks/useBookPassageShuffle.test.ts</code></b> (3 tests)</summary>

- ✔ `initializes with curated fallback passages for known books`
- ✔ `cycles to the next passage on shuffleNextPassage`
- ✔ `resets passages to index 0 on resetPassages`

</details>

<details>
<summary><b><code>src/hooks/useCatalogFilters.test.ts</code></b> (8 tests)</summary>

- ✔ `initializes with default catalog filters and page 1`
- ✔ `updates search and resets page to 1`
- ✔ `handles topic, language, and era updates correctly`
- ✔ `removes individual filter chips`
- ✔ `resets all filters cleanly`
- ✔ `toggles view modes and drawer visibility`
- ✔ `hydrates initial filter state from window.location.search including view=bookshelf`
- ✔ `hydrates initial filter state with view=notebook`

</details>

<details>
<summary><b><code>src/hooks/useCursorTooltip.test.ts</code></b> (4 tests)</summary>

- ✔ `initializes with default state`
- ✔ `updates mouse coordinates on handleMouseMove`
- ✔ `activates tooltip after specified delay on mouseEnter`
- ✔ `cleans up state and resets action on mouseLeave`

</details>

<details>
<summary><b><code>src/hooks/useHasMounted.test.ts</code></b> (1 tests)</summary>

- ✔ `returns true after mounting on client`

</details>

<details>
<summary><b><code>src/hooks/useOfflineBooks.test.ts</code></b> (6 tests)</summary>

- ✔ `initializes and fetches offline book IDs on mount`
- ✔ `downloads a single book and updates offline status`
- ✔ `handles download failure gracefully`
- ✔ `removes an offline book and refreshes ids`
- ✔ `downloads all missing books in batch with progress updates`
- ✔ `removes all books in batch`

</details>

<details>
<summary><b><code>src/hooks/usePerformanceTier.test.ts</code></b> (2 tests)</summary>

- ✔ `should detect performance tier and device capabilities`
- ✔ `should respect reduced motion preference`

</details>

<details>
<summary><b><code>src/hooks/useScrollDirection.test.ts</code></b> (9 tests)</summary>

- ✔ `initializes with BOTH header and toolbar visible at top of page`
- ✔ `preserves BOTH_VISIBLE while scrolling down within Hero section (scrollY <= dockOffset)`
- ✔ `preserves header visibility on initial arrival at catalog dock point`
- ✔ `transitions to toolbar-only docked at top-0 on subsequent downward scroll gesture`
- ✔ `transitions to fully hidden during a single long continuous scroll gesture past continuousThreshold`
- ✔ `transitions to fully hidden on third downward scroll gesture`
- ✔ `immediately reveals filter toolbar upon upward scroll reversal`
- ✔ `measures dynamic element offset from DOM when heroDockSelector is provided`
- ✔ `keeps both header and toolbar unconditionally visible when enabled is false`

</details>

### 🧩 UI Primitives & Motion (25 Suites · 83 Tests)

<details>
<summary><b><code>src/app/account/page.test.tsx</code></b> (16 tests)</summary>

- ✔ `renders guest prompt when unauthenticated`
- ✔ `renders authenticated profile and handles saving display name`
- ✔ `updates user reading atmosphere theme in account settings`
- ✔ `handles sign out action and redirects to home catalog`
- ✔ `renders Navbar and Footer with working navigation handlers`
- ✔ `handles toggling catalog sticky scroll navigation setting`
- ✔ `accurately calculates and renders custom shelves count excluding default shelf`
- ✔ `validates password mismatch before submitting update`
- ✔ `submits updatePassword with valid matching credentials and shows success feedback`
- ✔ `handles Suggest Strong Password in Profile Security card and auto-fills both fields`
- ✔ `opens delete account modal and cancels without deleting`
- ✔ `submits account deletion request and displays verification email confirmation`
- ✔ `dismisses deletion verification confirmation screen on close button click`
- ✔ `renders BackToTop button on scroll threshold and triggers window scrollTo`
- ✔ `handles resending email verification on unverified account`
- ✔ `renders notes & quotes count in library statistics`

</details>

<details>
<summary><b><code>src/app/manifest.test.ts</code></b> (2 tests)</summary>

- ✔ `returns valid metadata complying with PWA standards`
- ✔ `includes required icon sizes and purposes for desktop and mobile installation`

</details>

<details>
<summary><b><code>src/app/privacy/page.test.tsx</code></b> (4 tests)</summary>

- ✔ `renders page header and architectural manifesto`
- ✔ `renders all core GDPR and ePrivacy disclosure sections`
- ✔ `provides working navigation links to catalog and account settings`
- ✔ `handles Navbar view change callback by navigating via router`

</details>

<details>
<summary><b><code>src/components/account/AccountDeleteModal.test.tsx</code></b> (1 tests)</summary>

- ✔ `renders confirmation modal and handles cancel and send deletion link`

</details>

<details>
<summary><b><code>src/components/account/AccountIdentityCard.test.tsx</code></b> (3 tests)</summary>

- ✔ `renders verified reader badge when email_confirmed_at is present`
- ✔ `renders unverified badge and resend banner when email is not confirmed`
- ✔ `renders error message and success feedback`

</details>

<details>
<summary><b><code>src/components/account/AccountLibraryStats.test.tsx</code></b> (2 tests)</summary>

- ✔ `renders library statistics with links and values including notes and quotes`
- ✔ `renders default 0 for annotationCount when omitted`

</details>

<details>
<summary><b><code>src/components/account/AccountPreferencesSection.test.tsx</code></b> (5 tests)</summary>

- ✔ `handles theme switching and sticky scroll toggle`
- ✔ `renders read-aloud section and handles speed selection`
- ✔ `handles auto-page advance and sentence highlight toggles`
- ✔ `handles voice preview audio playback and toggle`
- ✔ `covers light and dark theme buttons and preview completion callbacks`

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
<summary><b><code>src/components/pwa/ServiceWorkerRegister.test.tsx</code></b> (3 tests)</summary>

- ✔ `renders null without throwing`
- ✔ `attempts registration in production when serviceWorker is available`
- ✔ `does not attempt registration in development mode`

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
<summary><b><code>src/components/ui/CursorTooltip.test.tsx</code></b> (3 tests)</summary>

- ✔ `renders null when not visible`
- ✔ `renders null when mousePos is null`
- ✔ `renders in document.body with applied coordinate offsets`

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
<summary><b><code>src/components/ui/PasswordStrengthMeter.test.tsx</code></b> (3 tests)</summary>

- ✔ `renders nothing when strength is empty or score is 0 without label`
- ✔ `renders score segments and label for Moderate password`
- ✔ `renders all 3 segments filled for Strong password`

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
<summary><b><code>src/config/reader-config.test.ts</code></b> (2 tests)</summary>

- ✔ `defines valid font size boundaries and defaults`
- ✔ `defines valid gesture thresholds`

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
<summary><b><code>src/config/translation-languages.test.ts</code></b> (3 tests)</summary>

- ✔ `contains curated popular languages with valid codes and flags`
- ✔ `contains complete alphabetized language catalog`
- ✔ `resolves languages correctly by full code or prefix`

</details>

<details>
<summary><b><code>src/proxy.test.ts</code></b> (2 tests)</summary>

- ✔ `calls updateSession with the incoming request`
- ✔ `exports valid matcher config`

</details>

---

## Quality Gate Verification
All 7 Closed-Loop Quality Gateways passed with zero blockers. The application is release-ready.

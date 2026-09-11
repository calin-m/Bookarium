# Quality Audit & Test Suite Catalog Report

**Last Generated**: Fri, 11 Sep 2026 17:19:10 GMT  
**Overall Status**: 🟢 PASSED  
**Total Test Suites**: 161 passed  
**Total Verified Tests**: 1378 passed  

---

## 🛡️ 7-Gateway Quality Summary

| Gateway | Check | Status | Details |
|---|---|---|---|
| **Pass 0.5** | Pre-Commit Secret Scanner | ✅ Passed | 0 exposed tokens, API keys, or private certificates |
| **Pass 1** | TypeScript Compiler | ✅ Passed | Strict type checking (`tsc --noEmit`) 0 errors |
| **Pass 2** | MSW Server & Queries | ✅ Passed | Mock Service Worker v2 network interception verified |
| **Pass 3** | Vitest Test Suite | ✅ Passed | **161/161 test suites passed** (1378 total tests) |
| **Pass 3.5** | Coverage Threshold | ✅ Passed | Minimum 80% coverage threshold met across all metrics |
| **Pass 4** | Living Docs AST Sync | ✅ Passed | `docs/ARCHITECTURE.md`, `CHANGELOG.md`, & `docs/QUALITY_AUDIT_REPORT.md` synced |
| **Pass 5** | ADR Decision Ledger | ✅ Passed | 40 Architectural Decision Records validated |
| **Pass 6** | ESLint & Knip Audit | ✅ Passed | 0 lint errors, 0 unused exports / dead files |
| **Pass 7** | Next.js Production Build | ✅ Passed | Turbopack production bundle compiled cleanly |

---

## 📊 Code Coverage Metrics

- **Lines**: **92.74%** (6498/7006) — *Target: $ge$ 80%*
- **Statements**: **91.25%** (7021/7694) — *Target: $ge$ 80%*
- **Functions**: **89.03%** (1542/1732) — *Target: $ge$ 80%*
- **Branches**: **81.68%** (5960/7296) — *Target: $ge$ 80%*

---

## 🧪 Comprehensive Test Suite Catalog (161 Suites / 1378 Tests)

### 🚀 App Routes & Pages (14 Suites · 153 Tests)

<details>
<summary><b><code>src/app/api/books/content/metadata-cache.test.ts</code></b> (7 tests)</summary>

- ✔ `stores and retrieves cached metadata correctly`
- ✔ `returns cached metadata if not expired without network fetch`
- ✔ `fetches metadata from upstream with trailing slash when not cached and Supabase is unconfigured`
- ✔ `resolves metadata directly from Supabase when configured and present`
- ✔ `falls back to upstream Gutendex when Supabase record is not found`
- ✔ `returns null when upstream returns error status`
- ✔ `returns null when network throws an error`

</details>

<details>
<summary><b><code>src/app/api/books/content/route.security.test.ts</code></b> (12 tests)</summary>

- ✔ `blocks AWS and GCP cloud metadata IP endpoints`
- ✔ `blocks loopback and private RFC 1918 IPv4/IPv6 addresses`
- ✔ `blocks domain spoofing and subdomains targeting gutenberg.org`
- ✔ `blocks directory traversal attempts in query parameters and paths`
- ✔ `blocks non-HTTP/HTTPS protocols`
- ✔ `ensures global.fetch is never triggered for unauthenticated/malicious inputs`
- ✔ `strictly confines legitimate outgoing requests to approved Gutenberg CDN endpoints`
- ✔ `protects backend from request flooding by enforcing 429 response`
- ✔ `enforces redirect: manual and rejects 301/302 redirects to private link-local endpoints`
- ✔ `strips all upstream server headers and sets explicit sanitized response headers`
- ✔ `rejects oversized Content-Length headers exceeding 15MB threshold`
- ✔ `aborts upstream stream if payload chunks exceed 15MB limit`

</details>

<details>
<summary><b><code>src/app/api/books/content/route.test.ts</code></b> (16 tests)</summary>

- ✔ `should return 429 when client exceeds rate limits`
- ✔ `should return 400 if neither url nor id is provided`
- ✔ `should block SSRF attempts targeting cloud metadata or internal network`
- ✔ `should validate official Gutenberg upstream URLs as safe and sanitize them`
- ✔ `should reject path traversal attempts in upstream URLs`
- ✔ `should return HTTP 451 Unavailable For Legal Reasons when book is protected in UK`
- ✔ `should return HTTP 451 in local development via ?country=GB query parameter without headers`
- ✔ `should return HTTP 451 when book is protected in Mexico (Life + 100)`
- ✔ `should return HTTP 503 fail-closed when metadata cannot be retrieved for international user`
- ✔ `should fetch and return book text for valid public domain id in US`
- ✔ `should stream public domain book to GB user when metadata confirms death year <= 1955`
- ✔ `should return 502 if upstream text mirrors fail or time out`
- ✔ `guarantees fetch is strictly called with canonical Gutenberg endpoints only`
- ✔ `falls back to secondary mirror when primary mirror returns 404`
- ✔ `streams content directly from Supabase (Tier 1) without external network fetch`
- ✔ `safely follows redirects to trusted Gutenberg mirrors`

</details>

<details>
<summary><b><code>src/app/api/books/content/url-validator.test.ts</code></b> (9 tests)</summary>

- ✔ `accepts legitimate Project Gutenberg URLs`
- ✔ `rejects foreign and untrusted domains`
- ✔ `rejects path traversal attempts`
- ✔ `rejects credentials in URLs`
- ✔ `rejects local and private network addresses`
- ✔ `handles malformed URLs safely without throwing`
- ✔ `sanitizes standard Gutenberg URLs to canonical cache paths`
- ✔ `preserves files-0 and files paths for older legacy Gutenberg mirrors`
- ✔ `returns null for unsafe or invalid URLs`

</details>

<details>
<summary><b><code>src/app/api/books/route.test.ts</code></b> (15 tests)</summary>

- ✔ `should return 429 when client exceeds max request rate limit`
- ✔ `should fetch and return public domain books JSON with zero copyright and latencyMs`
- ✔ `should forward copyright=false to upstream Gutendex API`
- ✔ `should filter out authors who died within Life + 70 when requested from GB`
- ✔ `should filter out protected authors in local development via ?country=GB query parameter without headers`
- ✔ `should filter out authors who died within Life + 100 when requested from Mexico (MX)`
- ✔ `should pass topic, language, page, era, sort, and mime_type query parameters`
- ✔ `should ignore single-character search queries to protect upstream API`
- ✔ `should normalize whitespace in search queries when passing to upstream API`
- ✔ `should return error response when upstream API returns an error status`
- ✔ `should return 502 status code when network connection fails`
- ✔ `should return 504 status code when upstream API times out via AbortError`
- ✔ `should return 502 status code when upstream API returns invalid non-JSON body`
- ✔ `should query Supabase provider first when healthy and return source supabase`
- ✔ `should gracefully degrade to upstream Gutendex when Supabase provider throws an error`

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
<summary><b><code>src/app/layout.test.tsx</code></b> (3 tests)</summary>

- ✔ `should expose valid metadata with OpenGraph, Twitter, and canonical alternates`
- ✔ `should render children within html structure alongside analytics and performance telemetry`
- ✔ `should render Schema.org @graph JSON-LD script declaring WebSite and universal WebApplication entities`

</details>

<details>
<summary><b><code>src/app/page.test.tsx</code></b> (19 tests)</summary>

- ✔ `should render catalog, hero search, sticky toolbar, and books list`
- ✔ `should handle search, topic, and language change interactions`
- ✔ `should open advanced filter drawer and apply era and sort filters`
- ✔ `should switch to bookshelf view and require confirmation to clear shelf`
- ✔ `should switch to favorites view and require confirmation to clear favorites`
- ✔ `should open download hub and close it`
- ✔ `should open 3D book preview modal when book cover is clicked and close it on desktop`
- ✔ `renders Bookshelf and Favorites when views are switched via Navbar`
- ✔ `navigates to /account when swiping left on mobile while on Bookmarks view`
- ✔ `allows user to toggle between 8 and 16 books per page via toolbar`
- ✔ `prevents search execution on 1-character query in HeroSearch on catalog page`
- ✔ `triggers predictive prefetching when approaching batch end on sub-page 3 (size 8)`
- ✔ `E2E Journey: full catalog search -> preview open -> reader launch -> shelf curation`
- ✔ `should dynamically filter bookshelf books with smart multi-word search in arbitrary order`
- ✔ `should dynamically filter favorites books and show empty search feedback`
- ✔ `should switch to Notebook view when Notebook tab in Navbar is clicked`
- ✔ `switches to Bookmarks view and renders reading ledger when Bookmarks nav tab is clicked`
- ✔ `smoothly scrolls to catalog-section and updates display mode when toggling between Cards and Bookshelves`
- ✔ `switches views when swiping horizontally across main on mobile`

</details>

<details>
<summary><b><code>src/app/providers.test.tsx</code></b> (4 tests)</summary>

- ✔ `should render children within QueryClientProvider`
- ✔ `should call syncAllStoresWithCloud when user is logged in`
- ✔ `should trigger syncAllStoresWithCloud on window online event when user is logged in`
- ✔ `should trigger syncAllStoresWithCloud on document visibilitychange when user is logged in and cooldown passed`

</details>

<details>
<summary><b><code>src/app/read/[id]/layout.test.tsx</code></b> (7 tests)</summary>

- ✔ `generates rich metadata for a curated hero classic (Frankenstein #84)`
- ✔ `provides safe fallback metadata for invalid book ID`
- ✔ `bypasses outbound network calls on client-side router navigation (rsc: 1 fast-path)`
- ✔ `detects client-side navigation correctly from various Next.js headers`
- ✔ `serves repeated requests from in-memory server cache without network calls`
- ✔ `renders children and Schema.org Book JSON-LD script`
- ✔ `falls back gracefully when upstream fetch times out or fails`

</details>

<details>
<summary><b><code>src/app/read/[id]/page.test.tsx</code></b> (30 tests)</summary>

- ✔ `renders header, reading surface, and sticky footer with metadata`
- ✔ `navigates back to origin page (preserving catalog/bookshelf/favorites state) when back button is clicked`
- ✔ `falls back to router.push("/") when history length is <= 1`
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
- ✔ `enforces mutual exclusivity between all 5 reader drawers (TOC, Search, Controls, Language, Annotations)`
- ✔ `automatically dismisses text selection popover when any reader drawer is opened`
- ✔ `toggles Read Aloud audio bar and triggers speech controls`
- ✔ `automatically closes any open side drawer when Read Aloud narration is opened from the header`
- ✔ `toggles Annotations & Notes drawer from reader header`
- ✔ `renders selection popover on mouseUp and applies chosen highlight color`
- ✔ `attaches and saves a personal reflection note to an existing highlight`
- ✔ `displays saved note in notes drawer and closes drawer upon jumping to passage`
- ✔ `updates highlight color in-place without duplicating annotations in store`
- ✔ `removes highlight and note upon confirmation in delete modal`
- ✔ `automatically sets reading status to currently_reading when beginning a volume`
- ✔ `renders volume completion modal with star rating and sets status to finished on the final page`
- ✔ `persists authentic resolved book metadata to recentBooks and warms reader store on load`
- ✔ `synchronizes document.title with the authentic resolved book title and author`
- ✔ `renders HTTP 451 legal restriction screen when useBookContent encounters copyright restriction`

</details>

<details>
<summary><b><code>src/app/read/[id]/reader-layout-utils.test.ts</code></b> (13 tests)</summary>

- ✔ `clears all cached items from serverMetadataCache`
- ✔ `returns true when rsc header is 1`
- ✔ `returns true when next-router-state-tree is present`
- ✔ `returns true when next-router-prefetch is present`
- ✔ `returns true when accept header includes text/x-component`
- ✔ `returns false for standard SSR page loads`
- ✔ `returns false when headers() throws`
- ✔ `returns null for non-numeric or falsy book IDs`
- ✔ `returns cached book immediately if present in serverMetadataCache`
- ✔ `fetches upstream book and populates serverMetadataCache when Supabase is unconfigured`
- ✔ `resolves book directly from Supabase catalog when configured`
- ✔ `returns null on upstream fetch error or 404`
- ✔ `returns null on network failure / exception`

</details>

### 🎨 Catalog & Presentation (23 Suites · 243 Tests)

<details>
<summary><b><code>src/components/presentation/AdvancedFilterDrawer.test.tsx</code></b> (11 tests)</summary>

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
- ✔ `renders header icon container with theme-aware solid border-border without fractional opacity`

</details>

<details>
<summary><b><code>src/components/presentation/BookCard.test.tsx</code></b> (17 tests)</summary>

- ✔ `should render book title, author, and formats`
- ✔ `should render multiple separate subject tag pills in the card body`
- ✔ `should render link to /read/[id] when clicking Read button`
- ✔ `should toggle favorite and bookmark state on button clicks`
- ✔ `should call onDownloadClick when clicking Formats button`
- ✔ `should call onPreviewClick when clicking book cover visual on desktop`
- ✔ `should navigate to /read/[id] on mobile when clicking book cover visual in catalog view`
- ✔ `should call onPreviewClick on mobile when activeView is favorites`
- ✔ `applies responsive active styling (desktop hide, mobile highlight) when isPreviewActive is true`
- ✔ `should render cursor tooltip on hover when onPreviewClick is provided`
- ✔ `renders fallback cover when image error occurs`
- ✔ `triggers preview on Enter or Space key press on cover`
- ✔ `updates cursor tooltip to Add to Favorites and Add to Bookshelf when hovering action buttons`
- ✔ `requires two clicks on favorite button to remove from favorites when activeView="favorites"`
- ✔ `auto-disarms favorite removal confirmation after timeout when activeView="favorites"`
- ✔ `disarms favorite removal confirmation on mouse leave or blur when activeView="favorites"`
- ✔ `renders Protected (GB) badge and disabled Restricted button when book is protected in UK`

</details>

<details>
<summary><b><code>src/components/presentation/BookGrid.test.tsx</code></b> (7 tests)</summary>

- ✔ `should render loading skeletons when isLoading is true`
- ✔ `should render error state with retry button`
- ✔ `should render empty state when no books exist`
- ✔ `should render book cards and trigger pagination`
- ✔ `should switch between editorial grid and bookshelf rack views`
- ✔ `should forward onPreviewClick to BookCard`
- ✔ `applies responsive active preview classes when activePreviewBookId matches`

</details>

<details>
<summary><b><code>src/components/presentation/BookmarkCard.test.tsx</code></b> (13 tests)</summary>

- ✔ `renders book metadata, formatted author names, progress bar, and reading coordinates`
- ✔ `triggers onResume callback and warms reader store when Resume button is clicked`
- ✔ `triggers onResume and warms reader store when cover thumbnail is clicked or activated via keyboard`
- ✔ `falls back to router.push when onResume is not provided`
- ✔ `renders offline badge when isOffline is true`
- ✔ `handles status changes from harmonized select dropdown`
- ✔ `triggers onClear when delete action is clicked`
- ✔ `renders fallback state when cover image triggers onError`
- ✔ `applies solid border and canonical booksaw shadow styling`
- ✔ `rounds floating-point progress to the nearest integer and applies rounded-full pill styling`
- ✔ `displays relative time formatted via canonical formatRelativeTime`
- ✔ `renders Start and global page coordinate when chapterIndex is 0`
- ✔ `renders "Read Again" button with RotateCcw icon and accessible label when status is completed`

</details>

<details>
<summary><b><code>src/components/presentation/BookmarksView.test.tsx</code></b> (10 tests)</summary>

- ✔ `renders empty state when no volumes are in the ledger`
- ✔ `renders active volumes and updates filter tabs`
- ✔ `filters active volumes using the search bar and supports clearing search`
- ✔ `opens confirmation modal on Clear Bookmarks, cancels, and clears ledger when confirmed`
- ✔ `resumes volume by pre-populating useReaderStore and navigating to reader route`
- ✔ `passes offline status to BookmarkCard when book is saved in offline storage`
- ✔ `allows user to change status of completed volume to reading directly via dropdown`
- ✔ `hydrates missing book metadata (e.g. Volume #55179) and displays real title and author`
- ✔ `applies adaptive responsive label expansion and tooltip attributes to filter tabs`
- ✔ `renders completed volume with 100% progress and Read Again action`

</details>

<details>
<summary><b><code>src/components/presentation/BookPreviewModal.test.tsx</code></b> (14 tests)</summary>

- ✔ `renders nothing when isOpen is false or book is null`
- ✔ `renders book preview modal and triggers cover open animation`
- ✔ `handles shuffle click and cycles through passages`
- ✔ `calls onClose when close button or backdrop is clicked or Escape is pressed`
- ✔ `calls onReadBook on action button click and closes modal`
- ✔ `applies FLIP transform when originRect is provided`
- ✔ `invokes onWillClose during the landing flight prior to full onClose`
- ✔ `renders long book titles and authors in full without truncation`
- ✔ `does not render curation controls for unsaved books in catalog view`
- ✔ `renders curation controls when activeView is bookshelf or favorites`
- ✔ `does not render curation controls in catalog view even if book is saved or has ratings in store`
- ✔ `renders curation toolbar with solid bg-card and text-foreground modal styling`
- ✔ `closes modal when clicking empty space in the viewport container outside the book`
- ✔ `does not close modal when clicking inside the curation bar`

</details>

<details>
<summary><b><code>src/components/presentation/bookshelf/BookshelfManageModals.test.tsx</code></b> (4 tests)</summary>

- ✔ `renders create modal and submits new shelf`
- ✔ `renders rename and delete modals`
- ✔ `renders clear offline shelf confirmation modal and handles cancel and confirm`
- ✔ `toggles shelf privacy in create and rename modals`

</details>

<details>
<summary><b><code>src/components/presentation/bookshelf/BookshelfMobileModal.test.tsx</code></b> (7 tests)</summary>

- ✔ `returns null when selectedMobileBook is null`
- ✔ `renders modal with formatted author names and triggers actions`
- ✔ `renders offline indicator and fires onToggleOffline`
- ✔ `renders rating and reading status controls and handles interactions`
- ✔ `calls onClose when clicking the backdrop or pressing Escape`
- ✔ `hides personal curation section when activeView is catalog`
- ✔ `shows personal curation section when activeView is favorites`

</details>

<details>
<summary><b><code>src/components/presentation/bookshelf/BookshelfSpine.test.tsx</code></b> (4 tests)</summary>

- ✔ `renders spine title, author, and handles keyboard interaction`
- ✔ `triggers quick actions from desktop hover card`
- ✔ `renders offline indicator and fires onToggleOffline when clicked`
- ✔ `renders cursor-following portal tooltip on hover card button hover`

</details>

<details>
<summary><b><code>src/components/presentation/BookshelfRack.test.tsx</code></b> (35 tests)</summary>

- ✔ `renders shelf with books`
- ✔ `renders empty message when no books are provided`
- ✔ `triggers onBookClick or openReader when book spine is clicked`
- ✔ `supports keyboard navigation via Enter and Space keys`
- ✔ `opens reader route using default handler if onBookClick is omitted`
- ✔ `opens mobile modal when book spine is clicked on mobile screen (<640px)`
- ✔ `handles quick action download and bookmark clicks`
- ✔ `renders guest mode sync prompt and triggers auth modal`
- ✔ `displays rounded integer percentage for reading progress`
- ✔ `displays 0% read for opened books on page 1`
- ✔ `renders cloud shelves and allows switching active shelf`
- ✔ `opens rename shelf modal and submits new shelf name`
- ✔ `opens delete shelf modal and confirms custom shelf deletion`
- ✔ `opens create shelf modal and submits a new custom shelf`
- ✔ `displays private shelf indicator on shelf pills when is_public is false`
- ✔ `renders empty shelf state and allows browsing catalog`
- ✔ `calls onBrowseCatalog callback when clicking Browse Catalog in empty state`
- ✔ `allows moving a book between shelves when user has multiple shelves`
- ✔ `triggers onBookClick when Read button is clicked on hover card`
- ✔ `triggers onDownloadClick when Download button is clicked on hover card`
- ✔ `toggles saved bookmark state when Save button is clicked on hover card`
- ✔ `toggles favorite state when Favorite button is clicked on hover card`
- ✔ `opens quick-action bottom sheet on mobile spine tap without immediate navigation`
- ✔ `triggers onBookClick and closes sheet when clicking Read in mobile action sheet`
- ✔ `dismisses mobile action sheet when clicking backdrop`
- ✔ `handles mobile action sheet close button and dismiss`
- ✔ `triggers download callback from mobile action sheet`
- ✔ `toggles bookmark and favorite status from mobile action sheet`
- ✔ `handles moving a book to another shelf and default read routing from mobile action sheet`
- ✔ `renders offline download button and triggers download all`
- ✔ `renders individual offline download button on book spine and triggers toggle`
- ✔ `renders All Saved for Offline notice and Clear Offline Shelf button when all books are offline, opens modal, and confirms removeAll`
- ✔ `renders Edit and Delete buttons to the left of Download Shelf Offline button on custom shelves`
- ✔ `does not render syncing indicator when isSyncing is false`
- ✔ `renders floating syncing indicator with status role when isSyncing is true`

</details>

<details>
<summary><b><code>src/components/presentation/CollectionSearchBar.test.tsx</code></b> (11 tests)</summary>

- ✔ `should render search input with placeholder and accessible label`
- ✔ `should call onQueryChange when user types in the input`
- ✔ `should display clear button and counter badge when query is present`
- ✔ `should call onQueryChange with empty string when clicking clear button`
- ✔ `should clear search query when pressing Escape key`
- ✔ `should not display clear button or counter when query is blank or whitespace`
- ✔ `should apply compact right padding (pr-4) when idle and expanded padding (pr-24) when filtering`
- ✔ `should render mobilePlaceholder when screen is mobile viewport and respond to change events`
- ✔ `should return server and client snapshot correctly and handle undefined matchMedia`
- ✔ `should render correct accessible labels when collectionName is bookmarks`
- ✔ `should apply crisp focus-ring styling matching the Notebooks search bar effect`

</details>

<details>
<summary><b><code>src/components/presentation/DownloadDrawer.test.tsx</code></b> (4 tests)</summary>

- ✔ `should render download formats when opened with a public domain book in US`
- ✔ `should return null when book is null`
- ✔ `should neutralize download links and show legal banner when book is protected in UK`
- ✔ `should provide canonical Gutenberg download links even if book.formats is empty`

</details>

<details>
<summary><b><code>src/components/presentation/EditorialQuoteSection.test.tsx</code></b> (14 tests)</summary>

- ✔ `renders section landmark, Classic of the Day badge, and book details`
- ✔ `navigates to reader and dispatches openReader on button click`
- ✔ `dynamically avoids collision when heroBookId matches candidate book`
- ✔ `accepts custom className and applies it to root section`
- ✔ `renders title, author, and quote without punctuation or regex issues`
- ✔ `renders title, author, and quote without punctuation or regex issues`
- ✔ `renders title, author, and quote without punctuation or regex issues`
- ✔ `renders title, author, and quote without punctuation or regex issues`
- ✔ `renders title, author, and quote without punctuation or regex issues`
- ✔ `renders title, author, and quote without punctuation or regex issues`
- ✔ `renders title, author, and quote without punctuation or regex issues`
- ✔ `renders title, author, and quote without punctuation or regex issues`
- ✔ `renders title, author, and quote without punctuation or regex issues`
- ✔ `renders title, author, and quote without punctuation or regex issues`

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
<summary><b><code>src/components/presentation/HeroSearch.test.tsx</code></b> (8 tests)</summary>

- ✔ `should render headline, featured book, 4-pillar benefit strip, static volume badge, and focus classes`
- ✔ `handles search input lifecycle: typing validation, clear button, whitespace normalization, and explicit submit`
- ✔ `should handle topic chip and language selection`
- ✔ `should accept dynamic books prop from API, render open-book spread, and handle read featured book`
- ✔ `should accept dynamic books prop from API and render the active volume`
- ✔ `should shuffle to next passage within the featured book when rotate button is clicked`
- ✔ `should toggle pinned open and closed states on click and keyboard events on desktop, and trigger read from open action button`
- ✔ `should not toggle pinned open state on mobile viewports (< 1024px)`

</details>

<details>
<summary><b><code>src/components/presentation/LanguageSelector.test.tsx</code></b> (4 tests)</summary>

- ✔ `renders compact inline variant with Globe icon and label`
- ✔ `renders full width variant without inline wrapper`
- ✔ `triggers onChange with selected language code`
- ✔ `contains all 12 supported public domain languages`

</details>

<details>
<summary><b><code>src/components/presentation/LiteraryQuotes.test.tsx</code></b> (5 tests)</summary>

- ✔ `should render section heading, kicker, and 3 literary quote cards`
- ✔ `should shuffle quotes when clicking Discover More button`
- ✔ `should have links pointing to valid /read/[id] routes`
- ✔ `should cleanly unmount without errors during active shuffle`
- ✔ `applies theme-aware border-border classes to card dividers without unsupported opacity modifiers`

</details>

<details>
<summary><b><code>src/components/presentation/Navbar.test.tsx</code></b> (21 tests)</summary>

- ✔ `should render brand and navigation items with responsive title classes`
- ✔ `should fill highlighter icon when annotations are saved in notebook`
- ✔ `triggers onViewChange with notebook when Notebook tab is clicked`
- ✔ `applies active styling when activeView is notebook`
- ✔ `triggers onViewChange with bookmarks when Bookmarks tab is clicked`
- ✔ `applies active styling when activeView is bookmarks`
- ✔ `should fill library icon when books are saved to bookshelf`
- ✔ `should fill heart icon when books are favorited`
- ✔ `should trigger onViewChange callback when clicking tabs`
- ✔ `applies active styling when activeView is favorites`
- ✔ `should cycle through themes when clicking theme button`
- ✔ `renders Sign In button for guests and triggers openAuthModal`
- ✔ `renders direct Account Link when user is authenticated`
- ✔ `handles keyboard Enter and Space on brand logo to navigate back to catalog`
- ✔ `applies -translate-y-full when isVisible is false`
- ✔ `applies translate-y-0 when isVisible is true`
- ✔ `renders active account button styling when activeView is account`
- ✔ `renders active Sign In button styling for guests when activeView is account`
- ✔ `renders GitHub repository link with target _blank on the header`
- ✔ `renders dynamic active view masthead subtitle with section theme color and responsive classes`
- ✔ `applies hidden and lg:inline responsive classes to navigation and action text labels`

</details>

<details>
<summary><b><code>src/components/presentation/NotablePassagesSpread.test.tsx</code></b> (3 tests)</summary>

- ✔ `renders primary quote with CC0 header badge`
- ✔ `renders secondary and tertiary quotes when provided`
- ✔ `adjusts padding and line clamp when there are 2 quotes`

</details>

<details>
<summary><b><code>src/components/presentation/NotebookQuoteCard.test.tsx</code></b> (9 tests)</summary>

- ✔ `renders book metadata, quote excerpt, and note`
- ✔ `toggles color swatch popover and updates color on click`
- ✔ `dismisses color popover when pressing Escape`
- ✔ `enters edit mode and handles saving modified note and color shade`
- ✔ `calls onCancelEdit when cancelling editing`
- ✔ `triggers delete reflection from editor and from note header`
- ✔ `triggers delete annotation and jump to reader from card footer`
- ✔ `copies formatted citation to clipboard and displays Copied state`
- ✔ `displays Add a personal note prompt when annotation has no note`

</details>

<details>
<summary><b><code>src/components/presentation/NotebookView.test.tsx</code></b> (26 tests)</summary>

- ✔ `renders empty state when there are no annotations`
- ✔ `renders saved annotations grouped by volume with resolved metadata`
- ✔ `cleans raw Gutenberg preamble titles and resolves authentic metadata in Notebook`
- ✔ `cleans raw preamble titles for non-featured books and falls back gracefully for placeholders`
- ✔ `resolves authentic title and author for non-featured, non-saved book (e.g. 31635) via remote book query`
- ✔ `filters annotations by search query across quote, note, title, and author`
- ✔ `filters annotations by pastel color tabs`
- ✔ `allows toggling between By Book grouping and Chronological stream`
- ✔ `allows user to edit note inline and cancel or save`
- ✔ `allows deleting personal reflection via card header with confirmation modal`
- ✔ `allows deleting personal reflection from within edit mode toolbar`
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
- ✔ `toggles quick color popover and changes highlight color on 1-click swatch`
- ✔ `dismisses quick color popover when clicking outside or pressing Escape`
- ✔ `allows full editing of personal reflection and color via card footer Edit button`
- ✔ `live-previews selected color during edit mode and reverts if cancelled`

</details>

<details>
<summary><b><code>src/components/presentation/StickyCatalogToolbar.test.tsx</code></b> (10 tests)</summary>

- ✔ `should render filter trigger, active chips, and 2-part API status badge`
- ✔ `should handle page size selection`
- ✔ `should trigger filter opening, remove individual chips, and clear all filters`
- ✔ `should handle view mode switching between grid and shelf`
- ✔ `should handle pagination next button and direct page jump form`
- ✔ `should display error indicator in status badge when isError is true`
- ✔ `applies translate-y-0 when isHeaderVisible is true and -translate-y-16 when false`
- ✔ `applies -translate-y-[calc(100%+4rem)] and pointer-events-none when isVisible is false`
- ✔ `renders archive fetching badge when isFetching is true`
- ✔ `renders direct page jump input without redundant Pg label`

</details>

### 📖 In-Browser Focus Reader (17 Suites · 140 Tests)

<details>
<summary><b><code>src/components/reader/DeleteAnnotationModal.test.tsx</code></b> (4 tests)</summary>

- ✔ `renders correctly when open with quote text and note preview`
- ✔ `calls onClose when Cancel button is clicked`
- ✔ `calls onConfirm when Delete Note button is clicked`
- ✔ `supports custom title and description overrides`

</details>

<details>
<summary><b><code>src/components/reader/GutenbergInfoModal.test.tsx</code></b> (3 tests)</summary>

- ✔ `renders null when not open`
- ✔ `renders volume metadata, title, and handles close action`
- ✔ `triggers onClose when clicking backdrop`

</details>

<details>
<summary><b><code>src/components/reader/QuoteDeletePreview.test.tsx</code></b> (3 tests)</summary>

- ✔ `renders selectedText within quotes`
- ✔ `renders note when provided`
- ✔ `does not render note section when note is null or omitted`

</details>

<details>
<summary><b><code>src/components/reader/ReaderAnnotationsDrawer.test.tsx</code></b> (10 tests)</summary>

- ✔ `renders annotations list with quotes and section pills`
- ✔ `renders empty state when there are no annotations`
- ✔ `filters annotations by color tab`
- ✔ `filters annotations by search input`
- ✔ `calls onJumpToAnnotation and closes drawer when jump button is clicked`
- ✔ `allows editing an annotation note`
- ✔ `shows confirmation modal and calls onDeleteAnnotation when confirmed`
- ✔ `cancels deletion when clicking cancel in modal`
- ✔ `translates vertical wheel scroll to horizontal scroll on color filter tags`
- ✔ `renders a vertically scrollable list container with sticky non-compressible controls`

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
<summary><b><code>src/components/reader/ReaderDrawerShell.test.tsx</code></b> (7 tests)</summary>

- ✔ `renders children when open`
- ✔ `does not render when isOpen is false`
- ✔ `calls onClose when close button is clicked`
- ✔ `calls onClose when clicking the backdrop`
- ✔ `calls onClose when pressing Escape key`
- ✔ `applies min-h-0 and overflow-hidden to the panel by default`
- ✔ `allows custom className to override overflow using cn/twMerge`

</details>

<details>
<summary><b><code>src/components/reader/ReaderErrorView.test.tsx</code></b> (4 tests)</summary>

- ✔ `renders error message and retry button for generic errors`
- ✔ `renders without retry button when onRetry is not provided`
- ✔ `renders dedicated HTTP 451 legal restriction view when error is LegalRestrictionError`
- ✔ `renders legal restriction view for plain object with isLegalRestriction: true`

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
<summary><b><code>src/components/reader/ReaderHeader.test.tsx</code></b> (19 tests)</summary>

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
- ✔ `renders single target language with sparkles when dynamic translation is active in translated mode`
- ✔ `renders parallel notation (e.g. EN ∥ ES) when bilingual mode is active`
- ✔ `renders active indicator dot in mobile action tray when dynamic translation is active`
- ✔ `handles link copying when share button is clicked`
- ✔ `toggles mobile action tray visibility when clicking the handle button`
- ✔ `dispatches TOC, Search, and Controls actions while keeping mobile tray open`
- ✔ `dismisses open mobile action tray when pressing Escape key`
- ✔ `renders Read Aloud button and handles click toggles`

</details>

<details>
<summary><b><code>src/components/reader/ReaderLanguageDrawer.test.tsx</code></b> (8 tests)</summary>

- ✔ `does not render content when isOpen is false`
- ✔ `renders dual-tier layout with archival editions and instant translation`
- ✔ `allows selecting popular translation quick-picks and dropdown`
- ✔ `supports toggling reading display mode and reverting to original`
- ✔ `unselects dynamic language when clicking the active quick-pick chip`
- ✔ `renders fallback message when archival translations array is empty`
- ✔ `renders properly in Sepia theme`
- ✔ `renders active language badge with supported numbered tokens in default light/dark mode`

</details>

<details>
<summary><b><code>src/components/reader/ReaderLoadingView.test.tsx</code></b> (1 tests)</summary>

- ✔ `renders loading indicators and typography text`

</details>

<details>
<summary><b><code>src/components/reader/ReaderSearchDrawer.test.tsx</code></b> (9 tests)</summary>

- ✔ `renders search drawer with input when isOpen is true`
- ✔ `does not render when isOpen is false`
- ✔ `updates search query, shows match count, and renders result cards`
- ✔ `clears search query when clear button is clicked`
- ✔ `calls onSelectMatch and onClose when clicking a search match card`
- ✔ `shows empty feedback when no matches are found`
- ✔ `closes drawer on Escape key press`
- ✔ `closes drawer when clicking the backdrop`
- ✔ `applies crisp focus ring styling to search input`

</details>

<details>
<summary><b><code>src/components/reader/ReaderSpeechBar.test.tsx</code></b> (13 tests)</summary>

- ✔ `renders null when isOpen is false`
- ✔ `renders with elevated z-[10001] stacking context to remain interactive above drawer backdrops`
- ✔ `renders narration metadata, page coordinates, and progress percentage`
- ✔ `handles play, pause, and resume actions accurately`
- ✔ `disables previous sentence button and skips to next sentence at start of text`
- ✔ `disables next sentence button and skips to previous sentence at end of text`
- ✔ `allows changing voices via dropdown`
- ✔ `renders categorized optgroups for Natural and Standard voices with quality badge`
- ✔ `allows selecting speed rates from the popover menu`
- ✔ `calls onClose when clicking close button`
- ✔ `adapts properly to sepia and dark themes`
- ✔ `renders with mobile-responsive positioning and WCAG touch target classes`
- ✔ `correctly uses UseReaderSpeechReturn facade prop when provided`

</details>

<details>
<summary><b><code>src/components/reader/ReaderSubHeaderRibbon.test.tsx</code></b> (3 tests)</summary>

- ✔ `renders default archival metadata, section counter, and progress pill`
- ✔ `renders resume notice when resumeNotice data is provided`
- ✔ `renders clean completed notice without Resumed prefix when chapterTitle includes Completed`

</details>

<details>
<summary><b><code>src/components/reader/ReaderSurface.test.tsx</code></b> (26 tests)</summary>

- ✔ `renders archival frontispiece banner on opening section and standard chapter banner on subsequent sections`
- ✔ `applies dynamic fontSize and lineHeight directly to the content body`
- ✔ `renders loading spinner and status message when isLoading is true`
- ✔ `renders error alert with retry button when isError is true`
- ✔ `renders legal restriction screen when isError is true with LegalRestrictionError`
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
- ✔ `triggers onTextSelected on selectionchange within reader content`
- ✔ `ignores collapsed text selections on mouseUp`
- ✔ `ignores text selections anchored outside reader content body`
- ✔ `triggers onTextSelected with text and coordinate bounds on valid mouseUp`

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
<summary><b><code>src/components/reader/TextHighlightPopover.test.tsx</code></b> (13 tests)</summary>

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
- ✔ `positions docked at bottom on touch devices to avoid native mobile context menu collision`
- ✔ `positions contextually near anchor on desktop devices`

</details>

### 🔐 Authentication & Security (2 Suites · 19 Tests)

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

<details>
<summary><b><code>src/components/auth/EmailSentView.test.tsx</code></b> (4 tests)</summary>

- ✔ `renders title, email, and message prefix`
- ✔ `renders optional subtitle and resendSuccess message`
- ✔ `triggers onBackToSignIn with custom label`
- ✔ `renders and handles resend button interactions`

</details>

### ⚡ Zustand State Stores (9 Suites · 137 Tests)

<details>
<summary><b><code>src/stores/useAccoladesStore.test.ts</code></b> (8 tests)</summary>

- ✔ `initializes with clean default state`
- ✔ `evaluates and unlocks accolades when context meets criteria`
- ✔ `dismisses active celebration and shifts next pending celebration`
- ✔ `toggles pinning of unlocked accolades up to MAX_PINNED_ACCOLADES`
- ✔ `rejects pinning locked accolades`
- ✔ `enforces maximum pinned limit of 3 accolades`
- ✔ `retrieves pinned accolade definitions via selector`
- ✔ `syncs with cloud by merging remote accolades and pushing local ones`

</details>

<details>
<summary><b><code>src/stores/useAnnotationStore.test.ts</code></b> (20 tests)</summary>

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
- ✔ `updates book metadata for annotations with missing or placeholder metadata`
- ✔ `ignores invalid or placeholder titles when calling updateBookMetadata`
- ✔ `flushes outbox with polymorphic dispatchers for UPSERT and DELETE actions`
- ✔ `retains failing actions in outbox when dispatcher throws error`

</details>

<details>
<summary><b><code>src/stores/useAuthStore.test.ts</code></b> (27 tests)</summary>

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
- ✔ `rejects empty or whitespace-only username`
- ✔ `rejects username shorter than 3 characters`
- ✔ `rejects username longer than 30 characters`
- ✔ `rejects invalid characters like spaces or special symbols`
- ✔ `accepts valid alphanumeric handles with underscores and hyphens`
- ✔ `rejects update when username is invalid`
- ✔ `normalizes username to lowercase and updates public profile preferences`
- ✔ `normalizes empty string username to null`
- ✔ `signs out from Supabase, clears user profile, flushes outbox, and cleanses local bookshelf`

</details>

<details>
<summary><b><code>src/stores/useBookshelfStore.test.ts</code></b> (36 tests)</summary>

- ✔ `should initialize with empty collections`
- ✔ `should toggle save book in bookshelf`
- ✔ `should manage reading queue`
- ✔ `should toggle favorite status and store favoriteBooks`
- ✔ `should sync and clear favorite books`
- ✔ `should call Supabase upsert and delete on toggleFavoriteBook with userId`
- ✔ `returns live hydrated state and reactive actions`
- ✔ `handles activeBookshelfId selection and cloud bookshelf list`
- ✔ `handles syncWithCloud fetching bookshelves and items`
- ✔ `bidirectionally pushes unsynced local books and favorites to Supabase during syncWithCloud`
- ✔ `treats Supabase as authoritative for savedBooks on subsequent syncs and does not re-upload missing books`
- ✔ `handles createCloudBookshelf and migrateLocalBooksToCloud`
- ✔ `updates cloud bookshelf name and updates local store state`
- ✔ `updates bookshelf privacy status via updateBookshelfPrivacy`
- ✔ `deletes cloud bookshelf and falls back activeBookshelfId to default shelf`
- ✔ `handles moveBookToShelf properly`
- ✔ `creates a new bookshelf item if book is not in cloudBookshelfItems yet`
- ✔ `queues offline actions to outbox when Supabase network rejects and flushes them on syncWithCloud`
- ✔ `returns saved books count via useSavedBooksCount`
- ✔ `returns isSaved status via useIsBookSaved`
- ✔ `returns book rating via useBookRating`
- ✔ `returns reading status via useReadingStatus`
- ✔ `returns combined curation via useBookCuration`
- ✔ `initializes with empty ratings and statuses`
- ✔ `sets and clears 1-5 star ratings with proper clamping`
- ✔ `sets and toggles reading statuses`
- ✔ `queues outbox action when rating a book while offline/authenticated`
- ✔ `flushes UPSERT_CURATION and DELETE_CURATION from outbox`
- ✔ `syncs curation from cloud and merges with local guest ratings`
- ✔ `resets curation upon clearBookshelf`
- ✔ `synchronizes reading progress to 100% in reader store when marked finished`
- ✔ `tracks mutation timestamps in curationHistory`
- ✔ `preserves newer local offline curation over older cloud records via LWW`
- ✔ `manages deletedBookIds tombstones and suppresses ghost resurrection during syncWithCloud`
- ✔ `manages deletedFavoriteBookIds and suppresses ghost favorite resurrection during syncWithCloud`
- ✔ `removes local favorite when deleted on another device and syncing with cloud`

</details>

<details>
<summary><b><code>src/stores/useHabitsStore.test.ts</code></b> (12 tests)</summary>

- ✔ `initializes with default values`
- ✔ `records daily activity without duplicates`
- ✔ `accumulates reading duration and logs today date once 5-minute threshold is met`
- ✔ `accumulates listening duration independently and contributes to daily streak threshold`
- ✔ `updates annual reading target clamped between 1 and 365`
- ✔ `resets habits back to defaults`
- ✔ `provides computed selectors for streaks, progress, and duration`
- ✔ `preserves freshly set local goal over older Supabase goal via Last-Write-Wins`
- ✔ `adopts remote Supabase goal on fresh device where local goal was never modified`
- ✔ `provides computed immersion selectors and breakdown strings`
- ✔ `computes partial streak progress correctly when under 5 minutes`
- ✔ `synchronizes and merges total_listening_seconds with Supabase cloud`

</details>

<details>
<summary><b><code>src/stores/useJurisdictionStore.test.ts</code></b> (5 tests)</summary>

- ✔ `initializes with default US public domain rule`
- ✔ `updates country and switches jurisdiction rule to Life + 70 for GB`
- ✔ `updates country and switches jurisdiction rule to Life + 100 for MX`
- ✔ `supports developer country overrides`
- ✔ `reads cookie value from document.cookie`

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
<summary><b><code>src/stores/useReaderStore.test.ts</code></b> (18 tests)</summary>

- ✔ `should initialize with default reader settings`
- ✔ `should open and close reader modal with book`
- ✔ `should clamp font size between 12 and 36`
- ✔ `should clamp line height between 1.2 and 2.6`
- ✔ `should update theme and font family`
- ✔ `should record and retrieve reading progress percentage`
- ✔ `should save, retrieve, and clear exact reading positions`
- ✔ `should toggle and set isMobileTrayOpen`
- ✔ `does not invoke Supabase in guest mode (Zero Auth / Zero Key)`
- ✔ `debounces cloud upsert by 2000ms when authenticated`
- ✔ `restores reading position and progress from cloud`
- ✔ `enriches cloud upsert with book metadata from currentBook`
- ✔ `bulk synchronizes all user reading progress via syncWithCloud`
- ✔ `deletes from Supabase when clearReadingPosition is invoked while authenticated`
- ✔ `deletes all user records from Supabase on clearAllVolumes while authenticated`
- ✔ `returns 0 for null, undefined, or empty state`
- ✔ `returns unique volume count across positions and progress`
- ✔ `provides hydration-safe reader defaults and activeReadingCount`

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

### 📚 Gutenberg Parsers & Metadata (27 Suites · 271 Tests)

<details>
<summary><b><code>src/lib/accolades-engine.test.ts</code></b> (12 tests)</summary>

- ✔ `determines antiquity from author years`
- ✔ `determines victorian/19th century from author years`
- ✔ `determines renaissance from author years`
- ✔ `falls back to subjects and languages when author years are null`
- ✔ `returns null if no era markers can be inferred`
- ✔ `identifies antiquity and middle-ages works as ancient`
- ✔ `builds a comprehensive context from store state slices`
- ✔ `finds definitions by ID`
- ✔ `formats progress with correct units`
- ✔ `accurately unlocks accolades and reports newly unlocked`
- ✔ `evaluates progressive tiers of curation ladder based on completedBooksCount`
- ✔ `does not include already unlocked accolades in newlyUnlocked`

</details>

<details>
<summary><b><code>src/lib/adapters/book.adapter.test.ts</code></b> (16 tests)</summary>

- ✔ `normalizes "LastName, FirstName" to "FirstName LastName"`
- ✔ `returns single word or standard formatted names unchanged`
- ✔ `handles multiple commas gracefully`
- ✔ `extracts exact matching MIME type`
- ✔ `extracts partial/prefix match if exact match is absent`
- ✔ `returns null when no preferred MIME is available or formats is invalid`
- ✔ `identifies valid canonical Book object`
- ✔ `rejects raw GutendexBook or non-book values`
- ✔ `transforms GutendexBook into canonical Book with normalized authors and format URLs`
- ✔ `is idempotent when given an already-canonical Book`
- ✔ `handles missing or empty fields safely with reasonable fallbacks`
- ✔ `cleans Gutenberg title preambles and normalizes author names with dates`
- ✔ `reconstructs GutendexBook with Gutenberg format URLs and normalized author objects`
- ✔ `handles null cover_url and empty authors gracefully`
- ✔ `formats a GutendexBook into a standardized Supabase insert payload`
- ✔ `omits bookshelf_id when not provided`

</details>

<details>
<summary><b><code>src/lib/api-utils.test.ts</code></b> (7 tests)</summary>

- ✔ `prioritizes x-vercel-forwarded-for when present`
- ✔ `prioritizes cf-connecting-ip when vercel header is missing`
- ✔ `prioritizes x-real-ip when cloud provider headers are missing`
- ✔ `extracts rightmost edge client IP from x-forwarded-for to prevent client spoofing`
- ✔ `falls back to 127.0.0.1 when no IP headers are present`
- ✔ `returns a 429 response with default message and standard headers`
- ✔ `merges custom message and additional body properties`

</details>

<details>
<summary><b><code>src/lib/book-metadata.test.ts</code></b> (10 tests)</summary>

- ✔ `strips Gutenberg preamble prefixes cleanly`
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
<summary><b><code>src/lib/cache.test.ts</code></b> (4 tests)</summary>

- ✔ `stores and retrieves items correctly`
- ✔ `evicts the least recently used item when maxEntries is exceeded`
- ✔ `overwriting an existing key updates its value and recency without exceeding max size`
- ✔ `supports has, delete, and clear operations`

</details>

<details>
<summary><b><code>src/lib/catalog/gutendex-provider.test.ts</code></b> (8 tests)</summary>

- ✔ `has name "gutendex"`
- ✔ `searches books, enforces copyright=false, and calculates latency`
- ✔ `applies jurisdictional filtering when queried from GB`
- ✔ `throws CatalogProviderError with status 400 on upstream bad request`
- ✔ `throws CatalogProviderError with status 502 on network failure`
- ✔ `throws CatalogProviderError with status 504 on request timeout`
- ✔ `throws CatalogProviderError with status 502 on invalid non-JSON body`
- ✔ `checks isHealthy via HEAD request`

</details>

<details>
<summary><b><code>src/lib/catalog/query-parser.test.ts</code></b> (7 tests)</summary>

- ✔ `defaults to safe base values when no query parameters are provided`
- ✔ `normalizes whitespace in search query and trims input`
- ✔ `drops single-character search queries to protect upstream API`
- ✔ `parses valid numeric page and limit while defaulting invalid values`
- ✔ `parses author year bounds, sort directions, and mime_type`
- ✔ `parses comma-separated languages into string array`
- ✔ `resolves country code through the priority cascade`

</details>

<details>
<summary><b><code>src/lib/catalog/supabase-provider.test.ts</code></b> (18 tests)</summary>

- ✔ `returns true when valid non-placeholder URL and key are set`
- ✔ `returns false when NEXT_PUBLIC_SUPABASE_URL contains placeholder`
- ✔ `returns false when NEXT_PUBLIC_SUPABASE_ANON_KEY contains placeholder`
- ✔ `returns false when credentials are missing or empty`
- ✔ `correctly maps all fields and defaults nullish values`
- ✔ `handles non-array or nullish authors, formats, and download count`
- ✔ `returns false when Supabase is not configured and no client was injected`
- ✔ `returns true when client returns count > 0 without error`
- ✔ `returns false when table has count === 0 (unseeded)`
- ✔ `returns false when select returns an error or rejects`
- ✔ `caches health check result for 60 seconds without re-querying Supabase`
- ✔ `successfully queries books and applies US public domain rules`
- ✔ `filters out authors protected under Life + 70 when client is in GB`
- ✔ `generates next and previous pagination links when page bounds allow`
- ✔ `filters results by mimeType if specified`
- ✔ `filters by comma-delimited book IDs`
- ✔ `applies ascending and descending sort directions`
- ✔ `throws CatalogProviderError when Supabase returns an error`

</details>

<details>
<summary><b><code>src/lib/copyright-engine.test.ts</code></b> (23 tests)</summary>

- ✔ `normalizes valid 2-letter codes to uppercase`
- ✔ `defaults null, undefined, or empty values to US`
- ✔ `identifies US jurisdictions`
- ✔ `identifies Life + 100 jurisdictions`
- ✔ `identifies Life + 80 jurisdictions`
- ✔ `identifies Life + 70 EU and non-EU jurisdictions`
- ✔ `defaults unknown or unmapped international countries to Life + 70`
- ✔ `evaluates Agatha Christie (d. 1976): Allowed in US, Blocked in GB/EU and MX`
- ✔ `evaluates Ernest Hemingway (d. 1961): Allowed in US, Blocked in GB/CA/AU and MX`
- ✔ `evaluates F. Scott Fitzgerald (d. 1940): Allowed in US and GB, but Blocked in Mexico (Life + 100)`
- ✔ `evaluates Arthur Conan Doyle (d. 1930): Allowed in US and GB, but Blocked in Mexico (Life + 100)`
- ✔ `evaluates Jane Austen (d. 1817): Allowed globally`
- ✔ `withholds work if any co-author died within the regional copyright period`
- ✔ `withholds ancient work if modern translator died within regional term`
- ✔ `allows ancient work if translator died long ago`
- ✔ `blocks author born in 1890 with null death year in Life + 70`
- ✔ `clears author born in 1840 with null death year in Life + 70`
- ✔ `withholds book outside US if both birth and death years are null (fail-closed)`
- ✔ `handles null or undefined book gracefully`
- ✔ `blocks book in US if copyright === true`
- ✔ `evaluates canonical Book interface with string authors and authorDetails`
- ✔ `withholds book if authors array is completely empty outside US`
- ✔ `formats human-readable descriptions for all jurisdiction rules`

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
<summary><b><code>src/lib/gutenberg/segmentation.test.ts</code></b> (15 tests)</summary>

- ✔ `returns empty array on null or undefined input`
- ✔ `falls back cleanly to Complete Volume for unformatted single-block text`
- ✔ `parses structured Project Gutenberg eBook into preamble, chapters, and license colophon`
- ✔ `suppresses front-matter Table of Contents cluster lines from becoming empty duplicate chapters`
- ✔ `parses short story anthologies with front-matter CONTENTS lists into individual story sections`
- ✔ `parses books formatted with standalone Roman numerals (such as The Great Gatsby)`
- ✔ `parses multi-work anthologies with standalone titles and footnote brackets (e.g. Book 831 Four Arthurian Romances)`
- ✔ `parses complex TOC without catastrophic backtracking or thread lock`
- ✔ `parses books formatted with dotted Roman numerals and subtitle lines (such as The Time Machine)`
- ✔ `suppresses single-digit front-matter TOC items with subtitles and enriches body chapter titles (such as Jules Verne)`
- ✔ `preserves repeated chapter numbers across multi-part books`
- ✔ `harvests subtitles from Roman and Arabic numeral front-matter TOC lists and attaches them to chapters`
- ✔ `harvests body subtitles when chapter headings have standalone subtitle lines without a TOC`
- ✔ `deduplicates analytical/descriptive front-matter TOC entries with multi-line synopses`
- ✔ `protects real chapters from suppression when referenced elsewhere in body narrative or footnotes`

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
<summary><b><code>src/lib/library-backup.test.ts</code></b> (19 tests)</summary>

- ✔ `generates a complete, structured backup payload from active stores`
- ✔ `creates a download blob and triggers click in DOM`
- ✔ `generates a valid CSV string with proper escaping and headers`
- ✔ `escapes cells containing commas, quotes, and newlines`
- ✔ `accepts a valid backup payload`
- ✔ `rejects non-object raw inputs`
- ✔ `rejects payloads from foreign applications`
- ✔ `rejects missing library section`
- ✔ `rejects invalid savedBooks structure`
- ✔ `rejects corrupted book items inside savedBooks`
- ✔ `rejects non-array annotations, favoriteBookIds, or likedBookIds if provided`
- ✔ `merges incoming backup non-destructively by default`
- ✔ `overwrites state completely when replace strategy is selected`
- ✔ `triggers cloud sync if userId is provided`
- ✔ `restores readingQueue correctly in replace mode`
- ✔ `rejects payloads containing prototype pollution keys`
- ✔ `validates all items in large savedBooks arrays beyond index 50`
- ✔ `rejects malformed customShelves missing bookIds array`
- ✔ `filters out-of-bounds ratings and non-standard statuses`

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
<summary><b><code>src/lib/reader-annotator.test.ts</code></b> (6 tests)</summary>

- ✔ `returns empty array when text or annotations are empty`
- ✔ `returns empty array when no annotations match the text`
- ✔ `matches single annotation with exact coordinates`
- ✔ `sorts multiple disjoint annotations in start order`
- ✔ `resolves overlapping annotations by prioritizing earlier non-overlapping spans`
- ✔ `captures multiple occurrences of the same phrase`

</details>

<details>
<summary><b><code>src/lib/reading-analytics.test.ts</code></b> (19 tests)</summary>

- ✔ `formats a date to YYYY-MM-DD`
- ✔ `pads single-digit month and day with zeros`
- ✔ `returns zeroes when activeDates is empty`
- ✔ `filters out invalid date strings`
- ✔ `calculates 1-day streak when user has only read today`
- ✔ `preserves grace period streak if user read yesterday but not yet today`
- ✔ `breaks current streak to 0 if neither today nor yesterday was active`
- ✔ `accurately calculates consecutive streaks and longest historical streak`
- ✔ `handles deduplication and arbitrary sorting order`
- ✔ `populates 7 days of weekActivity ending with today`
- ✔ `returns "0 min" for zero or negative values`
- ✔ `returns "< 1 min" for durations under 60 seconds`
- ✔ `returns minutes for durations between 1 and 59 minutes`
- ✔ `returns decimal hours for durations between 1 and 10 hours`
- ✔ `returns rounded hours for large durations`
- ✔ `handles zero completed books`
- ✔ `clamps target to at least 1`
- ✔ `calculates accurate percentages and remaining counts`
- ✔ `marks isCompleted as true and caps percent at 100 when target is met or exceeded`

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
<summary><b><code>src/lib/supabase/supabase.test.ts</code></b> (6 tests)</summary>

- ✔ `creates a browser Supabase client with environment variables`
- ✔ `creates a server Supabase client with cookie store and invokes cookie helpers`
- ✔ `handles updateSession middleware for incoming requests and cookies`
- ✔ `gracefully handles updateSession when getUser rejects with an error`
- ✔ `returns next response early when Supabase environment variables are missing`
- ✔ `sanitizes Supabase URLs with trailing slashes, /rest/v1, or empty values`

</details>

<details>
<summary><b><code>src/lib/sync-utils.test.ts</code></b> (3 tests)</summary>

- ✔ `triggers syncWithCloud concurrently on Bookshelf, Annotation, Reader, Habits, and Accolades stores`
- ✔ `safely exits without calling stores if userId is empty`
- ✔ `gracefully settles and does not throw if one store encounters a network rejection`

</details>

<details>
<summary><b><code>src/lib/utils.test.ts</code></b> (24 tests)</summary>

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
- ✔ `should format array of author objects or strings into comma separated string`
- ✔ `strips LCSH subdivisions separated by double dashes`
- ✔ `handles truncation when maxLength is specified`
- ✔ `falls back to Classic Literature for empty or missing inputs`
- ✔ `extracts and deduplicates clean subject tags up to maxTags`
- ✔ `deduplicates identical base subjects`
- ✔ `falls back to Classic Literature when empty or missing`
- ✔ `returns "Just now" for timestamps less than 1 minute ago`
- ✔ `returns minutes ago for timestamps under 1 hour`
- ✔ `returns hours ago for timestamps under 24 hours`
- ✔ `returns days ago for timestamps under 7 days`
- ✔ `formats date string for timestamps older than 7 days`
- ✔ `falls back gracefully to "Recently" for invalid dates or epoch zero`
- ✔ `creates an anchor, appends to body, clicks, removes anchor, and revokes object URL`

</details>

### 🔄 Hooks & React Query (20 Suites · 179 Tests)

<details>
<summary><b><code>src/hooks/queries/useBookContent.test.ts</code></b> (6 tests)</summary>

- ✔ `should fetch book text content from URL`
- ✔ `should return sample text when neither url nor bookId is provided`
- ✔ `should throw when fetch returns non-ok status or empty content`
- ✔ `should return offline cached content without calling fetch when available`
- ✔ `should handle request abort on network timeout`
- ✔ `should throw LegalRestrictionError when proxy returns HTTP 451`

</details>

<details>
<summary><b><code>src/hooks/queries/useBooks.test.ts</code></b> (13 tests)</summary>

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
- ✔ `should filter protected books during Strategy 2 fallback for international users`

</details>

<details>
<summary><b><code>src/hooks/queries/useBookTranslations.test.ts</code></b> (14 tests)</summary>

- ✔ `strips subtitles after semicolons and colons`
- ✔ `strips volume and part suffixes`
- ✔ `returns original string when no subtitles or volumes exist`
- ✔ `strips leading structural stopwords to yield core search keywords`
- ✔ `extracts surname when author is formatted as "Surname, Forename"`
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
<summary><b><code>src/hooks/reader/useContinueReadingLedger.test.ts</code></b> (16 tests)</summary>

- ✔ `returns empty list when no books have reading activity or saved state`
- ✔ `aggregates reading activity and normalizes metadata into canonical Book`
- ✔ `filters volumes by tab (all, in_progress, completed, on_hold)`
- ✔ `updates volume status and completes progress when set to completed`
- ✔ `allows transitioning completed volume back to in_progress with clean progress reset for re-reading`
- ✔ `allows transitioning completed volume to on_hold without getting trapped in completed`
- ✔ `infers completed status when progress is 100% on uncurated volume`
- ✔ `clears volume progress, coordinates, and recentBooks via clearVolumeProgress`
- ✔ `filters volumes by search query across title, author, and subject`
- ✔ `wipes all ledger progress and coordinates via clearAllVolumes without mutating bookshelf curation`
- ✔ `rounds floating-point readingProgress to the nearest integer`
- ✔ `excludes un-opened books that are only in recentBooks or bookStatuses with 0 progress`
- ✔ `resolves real title and author via resolveBookMetadata when book is not in savedBooks`
- ✔ `actively queries and hydrates missing book metadata (e.g. Volume #55179) and caches in recentBooks`
- ✔ `immediately renders volumes using cloud-restored bookTitle and authors on readingPosition without calling useBooks`
- ✔ `clears individual volume progress and all volumes via store methods`

</details>

<details>
<summary><b><code>src/hooks/reader/useGutenbergParserWorker.test.ts</code></b> (6 tests)</summary>

- ✔ `returns empty result when contentText is empty or undefined`
- ✔ `parses text synchronously via fallback when workerFactory returns null`
- ✔ `dispatches worker postMessage and handles worker response when Worker is available`
- ✔ `falls back gracefully when worker encounters an error`
- ✔ `cancels in-flight worker and prevents stale data when switching books`
- ✔ `preserves persistent worker across font size changes without terminating it`

</details>

<details>
<summary><b><code>src/hooks/reader/useReaderDrawers.test.ts</code></b> (6 tests)</summary>

- ✔ `initializes with all drawers closed`
- ✔ `opens a drawer via openDrawer`
- ✔ `toggles a drawer open and closed`
- ✔ `switches between drawers maintaining mutual exclusivity`
- ✔ `supports annotations drawer with strict mutual exclusivity`
- ✔ `closes active drawer via closeDrawer`

</details>

<details>
<summary><b><code>src/hooks/reader/useReaderGestures.test.ts</code></b> (8 tests)</summary>

- ✔ `initializes with null zoom feedback`
- ✔ `triggers onNextPage on leftward swipe with sufficient distance`
- ✔ `triggers onPreviousPage on rightward swipe with sufficient distance`
- ✔ `does not trigger swipe if vertical delta exceeds threshold ratio`
- ✔ `handles 2-finger pinch scaling and clamps font size`
- ✔ `cancels pending zoom feedback timeout upon unmounting`
- ✔ `suppresses swipe navigation when text selection is active`
- ✔ `suppresses swipe navigation when touch target is inside a dialog or popover`

</details>

<details>
<summary><b><code>src/hooks/reader/useReaderSession.test.ts</code></b> (10 tests)</summary>

- ✔ `initializes on chapter 0 and page 1`
- ✔ `handles next and previous page transitions across chapters`
- ✔ `allows chapter selection and restart to chapter 0 page 1`
- ✔ `jumps to target page accurately across chapters`
- ✔ `auto-resumes from stored local reading position and triggers notice`
- ✔ `restores position from cloud when authenticated and local is empty`
- ✔ `does not overwrite readingProgress with 0 and shows completed notice when readingStatus is finished`
- ✔ `handleRestart resets progress to 0 and transitions readingStatus to currently_reading`
- ✔ `jumps directly to a specified chapter and page using jumpTo`
- ✔ `works with default internalized hasMounted when not explicitly passed`

</details>

<details>
<summary><b><code>src/hooks/reader/useReaderSpeech.test.ts</code></b> (21 tests)</summary>

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
- ✔ `skips empty whitespace sentences when narrating`
- ✔ `clears active inter-sentence delay timeout on stop()`
- ✔ `handles Chromium fallback polling timers on mount and text flip during active sentence delay`
- ✔ `hydrates voices when voices load asynchronously after initial mount (Chromium cold start)`

</details>

<details>
<summary><b><code>src/hooks/useBookPassageShuffle.test.ts</code></b> (3 tests)</summary>

- ✔ `initializes with curated fallback passages for known books`
- ✔ `cycles to the next passage on shuffleNextPassage`
- ✔ `resets passages to index 0 on resetPassages`

</details>

<details>
<summary><b><code>src/hooks/useCatalogFilters.test.ts</code></b> (23 tests)</summary>

- ✔ `initializes with default catalog filters and page 1`
- ✔ `updates search and resets page to 1`
- ✔ `handles topic, language, and era updates correctly`
- ✔ `removes individual filter chips`
- ✔ `resets all filters cleanly`
- ✔ `toggles view modes and drawer visibility`
- ✔ `hydrates initial filter state from clean pathname /bookshelf`
- ✔ `hydrates initial filter state from clean pathname /favorites, /notebook, and /bookmarks`
- ✔ `preserves backward compatibility by hydrating from legacy query param view=bookshelf`
- ✔ `preserves backward compatibility with legacy view=notebook and view=bookmarks`
- ✔ `preserves backward compatibility with legacy view=favorites and view=likes`
- ✔ `parses page from searchParams in SSR and client environments`
- ✔ `handles empty parameters with safe defaults`
- ✔ `sanitizes invalid page numbers to default page 1`
- ✔ `correctly maps route pathname to view mode`
- ✔ `parses size parameter with valid values and safe fallback`
- ✔ `maps client sub-pages to upstream 32-batch apiPage`
- ✔ `translates reading position when switching pageSize between 8 and 16`
- ✔ `defaults to pageSize 8 on mobile viewports (<768px)`
- ✔ `normalizes page coordinates and prevents redundant API query changes when resizing from mobile to desktop`
- ✔ `normalizes page coordinates and preserves batch index when resizing from desktop to mobile`
- ✔ `preserves higher batch coordinates (batch 2) across mobile-to-desktop resize`
- ✔ `does not alter page or pageSize when explicit size override is set`

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
<summary><b><code>src/hooks/useMobileViewSwipe.test.ts</code></b> (10 tests)</summary>

- ✔ `advances to next view on valid swipe left`
- ✔ `navigates to previous view on valid swipe right`
- ✔ `clamps at boundaries (no-op when swiping right on catalog or left on account)`
- ✔ `ignores swipe if touch starts within 25px edge dead-zone (native Safari/Android back-forward)`
- ✔ `ignores swipe originating on interactive controls or inputs`
- ✔ `ignores diagonal or vertical scroll gestures failing dominance ratio`
- ✔ `ignores gestures exceeding max duration or below min distance`
- ✔ `does nothing when disabled`
- ✔ `supports custom config overrides`
- ✔ `cycles across all 6 views in sequence`

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
<summary><b><code>src/hooks/useReadingTimer.test.ts</code></b> (9 tests)</summary>

- ✔ `does nothing when disabled or bookId is missing`
- ✔ `does not grant daily streak on mounting until 5 minutes of immersion are completed`
- ✔ `accumulates reading seconds and flushes on interval`
- ✔ `flushes uncommitted seconds on unmount`
- ✔ `stops accumulating seconds when user is idle beyond idleTimeoutMs`
- ✔ `resets idle guard when registerInteraction is invoked`
- ✔ `tracks listening duration when isPlayingTTS is true, even in background tab`
- ✔ `pauses visual reading time when tab is hidden but resumes when visible`
- ✔ `qualifies 5-minute daily streak when 300 seconds of immersion are accumulated`

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

### 🧩 UI Primitives & Motion (49 Suites · 219 Tests)

<details>
<summary><b><code>src/app/account/layout.test.tsx</code></b> (2 tests)</summary>

- ✔ `exposes accurate account metadata and blocks search engine indexing`
- ✔ `renders children transparently without modifying DOM tree`

</details>

<details>
<summary><b><code>src/app/account/page.test.tsx</code></b> (12 tests)</summary>

- ✔ `renders guest prompt when unauthenticated and handles scroll to top`
- ✔ `renders authenticated dashboard with profile identity, library statistics, and accolades`
- ✔ `renders segmented sub-tabs navigation and switches active tabs`
- ✔ `supports keyboard navigation across sub-tabs with ArrowRight and ArrowLeft`
- ✔ `initializes active tab from URL search parameters (?tab=preferences) and handles tab delete when switching back to habits`
- ✔ `falls back to habits tab when search param has invalid value`
- ✔ `handles user preferences: atmosphere themes and catalog sticky scroll navigation`
- ✔ `handles password security lifecycle: mismatch validation, strong password generation, and password update`
- ✔ `handles account deletion modal lifecycle: opening, cancellation, submission, and confirmation dismissal`
- ✔ `handles resending email verification on unverified account`
- ✔ `navigates back to bookmarks when swiping right on mobile`
- ✔ `renders Public Scholar Profile section and handles saving public preferences`

</details>

<details>
<summary><b><code>src/app/error.test.tsx</code></b> (3 tests)</summary>

- ✔ `renders heading, description, and action buttons`
- ✔ `renders error digest when provided`
- ✔ `calls reset handler when Try Again button is clicked`

</details>

<details>
<summary><b><code>src/app/global-error.test.tsx</code></b> (2 tests)</summary>

- ✔ `renders critical error message and reset button`
- ✔ `displays error digest when available`

</details>

<details>
<summary><b><code>src/app/manifest.test.ts</code></b> (2 tests)</summary>

- ✔ `returns valid metadata complying with PWA standards`
- ✔ `includes required icon sizes and purposes for desktop and mobile installation`

</details>

<details>
<summary><b><code>src/app/not-found.test.tsx</code></b> (1 tests)</summary>

- ✔ `renders heading, literary quote, and navigation links`

</details>

<details>
<summary><b><code>src/app/privacy/layout.test.tsx</code></b> (2 tests)</summary>

- ✔ `exposes accurate privacy metadata and canonical url`
- ✔ `renders children transparently without modifying DOM tree`

</details>

<details>
<summary><b><code>src/app/privacy/page.test.tsx</code></b> (4 tests)</summary>

- ✔ `renders page header and architectural manifesto`
- ✔ `renders all core GDPR and ePrivacy disclosure sections`
- ✔ `provides working navigation links to catalog and account settings`
- ✔ `handles Navbar view change callback by navigating via router`

</details>

<details>
<summary><b><code>src/app/robots.test.ts</code></b> (2 tests)</summary>

- ✔ `returns valid crawler rules and sitemap location`
- ✔ `allows public canonical pages while strictly disallowing query parameter search crawling and private routes`

</details>

<details>
<summary><b><code>src/app/sitemap.test.ts</code></b> (3 tests)</summary>

- ✔ `generates canonical sitemap entries for root and privacy routes`
- ✔ `indexes featured public domain classic books`
- ✔ `provides valid timestamps across all entries`

</details>

<details>
<summary><b><code>src/app/u/[username]/page.test.tsx</code></b> (5 tests)</summary>

- ✔ `renders public scholar profile with habits, accolades, and bookshelves`
- ✔ `renders PrivateProfileNotice when profile does not exist in Supabase`
- ✔ `renders PrivateProfileNotice when profile has is_public = false`
- ✔ `resolves authenticated user profile from local store fallback when viewing own public profile`
- ✔ `filters out private bookshelves and respects show_saved_books and show_custom_shelves toggles`

</details>

<details>
<summary><b><code>src/components/accolades/AccoladeCelebrationModal.test.tsx</code></b> (5 tests)</summary>

- ✔ `renders nothing when activeAccolade is null`
- ✔ `renders celebration details when an accolade is provided`
- ✔ `dismisses when close button is clicked`
- ✔ `dismisses when backdrop is clicked`
- ✔ `dismisses when Escape key is pressed`

</details>

<details>
<summary><b><code>src/components/accolades/ExLibrisBookplate.test.tsx</code></b> (8 tests)</summary>

- ✔ `renders title, Latin motto, and description`
- ✔ `displays unlocked state with date and interactive pin button`
- ✔ `displays pinned state when isPinned is true`
- ✔ `displays locked state with progress indicator and lock icon`
- ✔ `disables pinning when isPinningDisabled is true and item is not already pinned`
- ✔ `handles mouse interactions for 3D perspective sheen without crashing`
- ✔ `applies theme-aware solid borders on woodcut frame and dividers without vanishing fractional opacities`
- ✔ `applies GPU-stabilized vector rendering and z-index isolation without conflicting scale-105`

</details>

<details>
<summary><b><code>src/components/account/AccountAccoladesCard.test.tsx</code></b> (7 tests)</summary>

- ✔ `renders card title, subtitle, and category tabs`
- ✔ `shows empty showcase message when no bookplates are pinned`
- ✔ `filters bookplates when clicking category tabs`
- ✔ `renders pinned bookplate in showcase when pinned`
- ✔ `displays warning when trying to pin more than 3 bookplates`
- ✔ `invokes cloud sync on mount if userId is provided`
- ✔ `applies theme-aware solid borders without vanishing fractional opacities`

</details>

<details>
<summary><b><code>src/components/account/AccountDeleteModal.test.tsx</code></b> (1 tests)</summary>

- ✔ `renders confirmation modal and handles cancel and send deletion link`

</details>

<details>
<summary><b><code>src/components/account/AccountHabitsCard.test.tsx</code></b> (10 tests)</summary>

- ✔ `renders reading habits card with streak, duration, and canonical challenge horizontal strips`
- ✔ `renders 7-day activity indicators in the streak strip`
- ✔ `displays today 5-minute reading logged indicator when read today`
- ✔ `displays remaining streak progress prompt when partially read today`
- ✔ `renders dual immersion breakdown badges for reading and listening time`
- ✔ `renders canonical 4-tier milestone ladder cards with titles, Latin mottos, and paces`
- ✔ `elevates milestone target dynamically as reader completes books`
- ✔ `does not expose arbitrary user edit buttons or input fields (anti-tamper integrity)`
- ✔ `triggers cloud sync on mount when authenticated userId is provided`
- ✔ `applies theme-aware solid borders and surfaces without fractional opacity variants that vanish in Sepia or Dark mode`

</details>

<details>
<summary><b><code>src/components/account/AccountIdentityCard.test.tsx</code></b> (5 tests)</summary>

- ✔ `renders verified reader badge when email_confirmed_at is present`
- ✔ `renders unverified badge and handles resend verification click`
- ✔ `renders sending spinner and cooldown timer during resend verification states`
- ✔ `displays save error alert when profile update fails`
- ✔ `displays save success and verification alert banners`

</details>

<details>
<summary><b><code>src/components/account/AccountLibraryStats.test.tsx</code></b> (11 tests)</summary>

- ✔ `renders library statistics with links and values including notes and quotes`
- ✔ `renders default 0 for annotationCount and bookmarksCount when omitted`
- ✔ `applies theme-tokenized hover border and focus classes on each library card`
- ✔ `renders all 5 library cards with uniform horizontal flex layout`
- ✔ `renders clean vertical flex column layout for all library cards`
- ✔ `calculates active card with equal scroll progression stepper in single-column mode`
- ✔ `prioritizes mouse hover over scroll position on narrow desktop windows`
- ✔ `resets active spotlight when library container is scrolled outside focal travel range`
- ✔ `disables scroll focal spotlight on widescreen desktop displays`
- ✔ `cleans up scroll and resize listeners when component unmounts`
- ✔ `renders reading streak badge when readingStreak is greater than 0`

</details>

<details>
<summary><b><code>src/components/account/AccountPreferencesSection.test.tsx</code></b> (11 tests)</summary>

- ✔ `handles theme switching and sticky scroll toggle`
- ✔ `renders read-aloud section and handles speed selection`
- ✔ `handles auto-page advance and sentence highlight toggles`
- ✔ `handles voice preview audio playback and toggle`
- ✔ `triggers onThemeChange when clicking Light and Dark theme buttons`
- ✔ `handles speech synthesis voice preview completion and error callbacks`
- ✔ `renders the portability section with JSON, CSV, and Import buttons`
- ✔ `handles JSON and CSV export clicks`
- ✔ `handles file input change and shows error on corrupted file`
- ✔ `shows error when backup file exceeds 10MB limit`
- ✔ `handles exportLibraryData utility directly`

</details>

<details>
<summary><b><code>src/components/account/AccountPublicProfileSection.test.tsx</code></b> (8 tests)</summary>

- ✔ `renders public scholar profile section with profile data`
- ✔ `toggles master public profile switch and updates badge`
- ✔ `validates username format and displays descriptive error`
- ✔ `copies shareable link to clipboard when clicked`
- ✔ `submits updated profile settings and handles success`
- ✔ `blocks submission and displays error when public is enabled without username`
- ✔ `displays error message if update fails`
- ✔ `allows toggling Saved Works and Custom Shelves independently`

</details>

<details>
<summary><b><code>src/components/account/AccountRestoreModal.test.tsx</code></b> (5 tests)</summary>

- ✔ `renders nothing when closed or no backupData and no success`
- ✔ `renders backup metadata counts and allows strategy switching`
- ✔ `displays loading state while restoring`
- ✔ `displays error message if restore failed`
- ✔ `displays success state when restore succeeds`

</details>

<details>
<summary><b><code>src/components/account/AccountSecuritySection.test.tsx</code></b> (1 tests)</summary>

- ✔ `renders password fields, strength meter, and buttons`

</details>

<details>
<summary><b><code>src/components/bookshelf/ReadingStatusSelector.test.tsx</code></b> (7 tests)</summary>

- ✔ `renders all three reading status options`
- ✔ `marks current status as checked`
- ✔ `calls onChange with selected status when clicked`
- ✔ `clears status when clicking the active option`
- ✔ `renders clear button when status is active and invokes onChange(null)`
- ✔ `renders clear button immediately following the selected option across all status variants`
- ✔ `applies theme-aware border and background classes to active and inactive buttons without unsupported opacity variants`

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
<summary><b><code>src/components/profile/PinnedAccoladesShelf.test.tsx</code></b> (2 tests)</summary>

- ✔ `renders pinned bookplate items and badge count`
- ✔ `renders empty showcase state when no bookplates are pinned`

</details>

<details>
<summary><b><code>src/components/profile/PrivateProfileNotice.test.tsx</code></b> (3 tests)</summary>

- ✔ `renders neutral not-found sanctuary title and classical description without echoing username`
- ✔ `renders catalog navigation buttons with proper hrefs`
- ✔ `renders gracefully without username parameter`

</details>

<details>
<summary><b><code>src/components/profile/PublicProfileView.test.tsx</code></b> (7 tests)</summary>

- ✔ `renders public scholar view with profile info, telemetry, and bookshelves`
- ✔ `renders PrivateProfileNotice when is_public is false`
- ✔ `enforces strict Zero-PII guarantee (no email or sensitive fields)`
- ✔ `respects granular privacy toggles by omitting telemetry and bookshelves`
- ✔ `falls back to username handle when display_name is missing`
- ✔ `falls back to Bookarium Scholar when both display_name and username are missing`
- ✔ `copies public profile link when share button is clicked`

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
<summary><b><code>src/components/ui/Badge.test.tsx</code></b> (3 tests)</summary>

- ✔ `should render badge content with variant and size classes`
- ✔ `should render success variant correctly`
- ✔ `should render default secondary variant and md size`

</details>

<details>
<summary><b><code>src/components/ui/Button.test.tsx</code></b> (4 tests)</summary>

- ✔ `should render button text and handle click events`
- ✔ `should display loading spinner and disable button when isLoading is true`
- ✔ `should apply variant and size classes properly`
- ✔ `should render polymorphically with as="a" and apply chip size styling`

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
<summary><b><code>src/components/ui/SectionHeader.test.tsx</code></b> (4 tests)</summary>

- ✔ `renders title text inside default h2 with decorative flank lines`
- ✔ `supports custom semantic heading tag and hiding flank lines`
- ✔ `renders eyebrow, title, and subtitle correctly`
- ✔ `renders optional children like buttons or badges`

</details>

<details>
<summary><b><code>src/components/ui/StarRating.test.tsx</code></b> (7 tests)</summary>

- ✔ `renders 5 interactive star buttons in interactive mode`
- ✔ `marks the active star as aria-checked`
- ✔ `calls onChange with star index on click`
- ✔ `toggles rating off (calls onChange with null) when clicking active star`
- ✔ `updates display rating on hover and restores on mouse leave with fixed width to prevent layout shift`
- ✔ `supports keyboard navigation with arrow keys and enter`
- ✔ `renders correctly in readOnly mode without interactive buttons`

</details>

<details>
<summary><b><code>src/config/annotation-tokens.test.ts</code></b> (4 tests)</summary>

- ✔ `contains configurations for all 4 primary highlight colors`
- ✔ `populates ANNOTATION_COLOR_LIST with all 4 items`
- ✔ `provides complete styling tokens for each color theme`
- ✔ `exports valid fallback class for all colors filter badge`

</details>

<details>
<summary><b><code>src/config/config.test.ts</code></b> (14 tests)</summary>

- ✔ `defines valid non-empty endpoint URLs`
- ✔ `provides literary eras with valid date boundaries`
- ✔ `provides genre facets with valid IDs and labels`
- ✔ `provides language mappings with ISO-639 codes`
- ✔ `provides valid sort and format options`
- ✔ `provides valid hero book spotlight and collection of classics`
- ✔ `extracts passages for featured and generic books via getBookPassages`
- ✔ `getHourlyHeroBook returns deterministic book based on hourly index`
- ✔ `getDailyEditorialBook rotates daily and avoids collision with heroBookId`
- ✔ `filters out titles protected in Life + 100 countries (Mexico)`
- ✔ `includes all featured books for US jurisdiction`
- ✔ `provides 12 curated quotes with non-empty metadata`
- ✔ `provides complete theme configs for light, sepia, and dark`
- ✔ `getReaderTheme returns exact theme or falls back to light`

</details>

<details>
<summary><b><code>src/config/library-tokens.test.ts</code></b> (5 tests)</summary>

- ✔ `contains all expected library section keys`
- ✔ `guarantees non-empty class strings and valid metadata for every section`
- ✔ `preserves intentional conceptual grouping between bookshelf and customShelves`
- ✔ `maps correct route targets for favorites and notebook`
- ✔ `retrieves tokens via getLibraryTheme helper correctly`

</details>

<details>
<summary><b><code>src/config/reader-config.test.ts</code></b> (2 tests)</summary>

- ✔ `defines valid font size boundaries and defaults`
- ✔ `defines valid gesture thresholds`

</details>

<details>
<summary><b><code>src/config/reader-themes.test.ts</code></b> (3 tests)</summary>

- ✔ `returns valid config tokens for all supported themes`
- ✔ `falls back gracefully to light theme for null, undefined, or invalid theme`
- ✔ `correctly cycles through themes with NEXT_READER_THEME`

</details>

<details>
<summary><b><code>src/config/routes.test.ts</code></b> (4 tests)</summary>

- ✔ `provides static canonical routes`
- ✔ `builds dynamic reader route with id`
- ✔ `builds dynamic public profile route with sanitized username`
- ✔ `builds clean view path route correctly`

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
<summary><b><code>src/config/views.config.test.ts</code></b> (6 tests)</summary>

- ✔ `contains all 5 primary navigation items`
- ✔ `has valid labels, titles, and icons for each nav item`
- ✔ `assigns correct countKey for collections`
- ✔ `has configuration for all views including account`
- ✔ `correctly calculates catalog titles and subtitles`
- ✔ `correctly formats bookshelf and favorites content`

</details>

<details>
<summary><b><code>src/proxy.test.ts</code></b> (7 tests)</summary>

- ✔ `calls updateSession with the incoming request`
- ✔ `gracefully falls back to NextResponse.next when updateSession throws`
- ✔ `exports valid matcher config`
- ✔ `detects country from x-vercel-ip-country and stamps cookie and header`
- ✔ `respects development query parameter override ?country=DE`
- ✔ `falls back to existing cookie when no IP headers are present`
- ✔ `defaults to US when no geo signals exist`

</details>

---

## 🧹 Static Analysis & Dead Code Audit (ESLint 9 & Knip)

- **ESLint 9 Code Quality**: **0 errors**, **7 warnings**
- **Knip Dead Code & Unused Exports**: **0 issues** (0 unused files, 0 unused dependencies, 0 dead exports)
---

## Quality Gate Verification
All 7 Closed-Loop Quality Gateways passed with zero blockers. The application is release-ready.

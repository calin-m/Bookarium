const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');
const adrPath = path.join(rootDir, 'docs', 'DECISIONS.md');
const readmePath = path.join(rootDir, 'README.md');

// Exhaustive milestone catalog adhering to Keep a Changelog 1.0.0 & SemVer
const RELEASES = [
  {
    version: '2.8.1',
    date: '2026-10-24',
    title: 'Layered Dual-Band Highlights, Unified Overlapping Notes, Zero-CLS Theme Cycling & Drag-to-Scroll Pills',
    sections: {
      Added: [
        'Global Symposium Marginalia Cloud Synchronization & Rich Shared Notebook Display (`src/stores/useAnnotationStore.ts`, `src/lib/sync-utils.ts`, `src/app/read/[id]/page.tsx`, `src/components/presentation/NotebookView.tsx`, `src/components/presentation/NotebookQuoteCard.tsx`, `src/components/reader/ReaderAnnotationsDrawer.tsx`, `ADR-068`): Implemented `fetchAllFellowAnnotations` in `useAnnotationStore.ts` to automatically fetch Fellow Scholars\' highlights and notes across all active and completed Symposiums directly on global cloud sync, Notebook mount, and reader drawer open without requiring readers to open individual books; rendered fallback italic attribution callouts on overlapping quotes saved without a fellow note; preserved paired fellow annotations in "My Marginalia"; enabled paired color matching and fellow scholar search; and sorted chronological quotes by the latest activity timestamp.',
        'Interactive In-Page Row-Snapping Bookmark & Tablet Single-Column Notebook Layout (`src/components/reader/ReaderSurface.tsx`, `src/hooks/reader/useReaderSession.ts`, `src/stores/useReaderStore.ts`, `src/hooks/reader/useContinueReadingLedger.ts`, `src/components/presentation/BookmarkCard.tsx`, `src/components/reader/ReaderSubHeaderRibbon.tsx`, `src/components/reader/ReaderHeader.tsx`, `src/app/read/[id]/page.tsx`, `src/components/presentation/NotebookView.tsx`, `ADR-068`): Added a permanently visible, draggable row-snapping silk bookmark tab along the left margin of the reading page (`data-testid="reader-page-bookmark"`, `role="slider"`, `data-prevent-swipe`) with a subtle horizontal row guide line, discrete line-height snapping (`fontSize * lineHeight`), click-to-snap rail (`data-testid="reader-bookmark-rail"`), keyboard navigation (`ArrowDown`, `ArrowUp`, `Home`), double-click reset to Line 1 (`bookmarkRow = 0`), automatic top-of-page reset on page/chapter transitions, smooth scroll-to-row on session resume, `• Line X` badges in `BookmarkCard` and `ReaderSubHeaderRibbon`, and zero-migration Supabase cloud synchronization via fractional `scroll_offset` encoding (`chapterPage + bookmarkRow / 1000`); and adjusted the Literary Notebook quote card grids in `NotebookView.tsx` from `md:grid-cols-2` to `lg:grid-cols-2` so tablet viewports (`768px–1023px`) display an uncramped single-column layout.',
        '7-Pillar SAST & OWASP Security Suite Extension & Zero-Warning ESLint Gate (`scripts/verify-build.js`, `scripts/generate-quality-report.js`, `package.json`, `src/components/presentation/BookPreviewModal.tsx`, `src/components/presentation/BookPreviewModal.test.tsx`, `src/hooks/useOfflineBooks.test.ts`, `src/app/page.test.tsx`, `ADR-067`): Extended Pass 0.5 secret scanning with fine-grained GitHub PAT, Supabase token, EC/OpenSSH key, webhook, and client-bundle SUPABASE_SERVICE_ROLE_KEY leak guards; expanded Pass 0.75 into a 7-Pillar SAST & OWASP Security Suite verifying production CVEs, API route RateLimiter.check() and redirect-hop SSRF guards, DOM XSS sinks (.innerHTML, document.write, string timers), dynamic callback redirect sanitization, MIT/public-domain integrity, PostgreSQL Row-Level Security (RLS) across all 13 public tables and SET search_path = \'\' on all SECURITY DEFINER functions in supabase/schema.sql, and all 7 OWASP HTTP security headers in next.config.ts; resolved all 6 ESLint unused-variable warnings; and enforced --max-warnings 0 in package.json and generate-quality-report.js.',
        'Dedicated Favorites Cover Grid, Tablet Notebook Toolbar Collision Elimination & Unified Active-Shelf Clear Action (`src/app/page.tsx`, `src/components/presentation/NotebookView.tsx`, `src/components/presentation/CollectionToolbar.tsx`, `src/stores/useBookshelfStore.ts`, `src/components/presentation/BookshelfRack.tsx`, `ADR-066`): Disconnected Catalog viewMode from Favorites to guarantee Favorites consistently renders its visual Cover Grid with star ratings, favorite hearts, and 3D preview cards without cross-tab display leaks; fixed tablet Notebook toolbar flex collision by hiding By Book / Chronological text labels on viewports <1024px (hidden lg:inline, displaying clean icon pills) and adding md:shrink-0 to the controls row in CollectionToolbar; removed redundant lower Clear Offline buttons from BookshelfRack in favor of the dedicated Downloaded smart shelf pill; and upgraded the SectionHeader clear button and confirmation modal to dynamically adapt to the active shelf (clearing all saved books on General, clearing only the active custom shelf\'s books via clearCustomShelfBooks, or clearing offline downloads on Downloaded).',
        'Tablet Bookshelf Spine Modal, Dedicated Bookmark Resume CTA & Hermetic CI Navigation Physics (`src/components/presentation/BookshelfRack.tsx`, `src/components/presentation/bookshelf/BookshelfSpine.tsx`, `src/components/presentation/BookmarkCard.tsx`, `src/components/presentation/Navbar.test.tsx`, `ADR-065`): Expanded Bookshelf spine touch modal activation threshold from mobile-only (<640px) to touch tablet devices (<1024px) in BookshelfRack and shifted spine hover popover disclosure to lg:group-hover:flex so tablet users can seamlessly rate, shelve, download, and manage books without accidental reader navigation; removed accidental reader navigation from the book cover thumbnail and title on BookmarkCard so that reading ledger cards cleanly activate and focus while reserving reader launches exclusively to the dedicated "Resume" / "Read Again" button; and eliminated CI host-runner hardware concurrency divergence in Navbar.test.tsx by hermetically mocking performance tier physics across directional glide assertions.',
        'Catalog Pagination Smooth-Scroll Stabilization, Header Brand Page-1 Reset, Unified API Telemetry Pill & Responsive Spacing Stabilization (`src/components/presentation/BookGrid.tsx`, `src/components/presentation/Navbar.tsx`, `src/app/page.tsx`, `src/components/presentation/StickyCatalogToolbar.tsx`, `src/components/presentation/LiteraryQuotes.tsx`, `src/components/presentation/EditorialQuoteSection.tsx`, `src/components/presentation/Footer.tsx`, `ADR-064`): Preserved grid height and bottom pagination bar during async API batch fetches by passing pageSize to BookGrid and rendering pageSize skeletons (matching 8/16/32 card count) with disabled pagination controls; added scroll-mt-16 to #catalog-section and post-fetch alignment so smooth scrolling never snaps or aborts mid-flight; connected Navbar Bookarium brand logo and active navigation tab clicks to onBrandReset, immediately resetting the catalog to Page 1, clearing active filters, and scrolling to top; merged the separate live status and latency badges into a single compact telemetry pill in StickyCatalogToolbar with dynamic pulsing dot (green online / red offline) and high-precision latency formatting (ms under 1000ms, up to 3-decimal seconds for 1000ms+); and stabilized vertical rhythm across mobile and desktop by scaling LiteraryQuotes (py-10 sm:py-16) with balanced header divider spacing (pb-6 sm:pb-8), eliminating the 96px mobile catalog section bottom gap (pb-8 sm:pb-12), scaling EditorialQuoteSection (py-10 sm:py-16, p-6 sm:p-12), and relocating mobile floating dock clearance to Footer (pb-24 md:pb-8).',
        'Zero-CLS Bookshelf Stabilization & Codebase-Wide Typography Invariance (`src/app/page.tsx`, `src/components/presentation/BookshelfRack.tsx`, `src/components/ui/Pagination.tsx`, `src/components/presentation/StickyCatalogToolbar.tsx`, `src/components/presentation/AdvancedFilterDrawer.tsx`, `src/components/presentation/BookmarksView.tsx`, `src/components/account/AccountAccoladesCard.tsx`, `src/app/account/page.tsx`, `src/components/account/AccountPreferencesSection.tsx`, `src/components/account/AccountSymposiumSection.tsx`, `src/components/reader/ReaderAnnotationsDrawer.tsx`, `src/components/presentation/HeroSearch.tsx`, `ADR-063`): Eliminated the ~134px layout jump when switching to empty custom shelves by gating SectionHeader actions and CollectionToolbar on total library count (`totalCollectionCount > 0`); enforced invariant 1px borders and transition-colors across shelf switcher pills, pagination buttons, and the StickyCatalogToolbar active filter capsule; standardized invariant font-weights across filter drawer facet chips, underline navigation tabs, annotation color filters, and hero search chips; and keyed BookshelfRack strictly by active shelf ID to prevent unneeded container remounts.',
        'BookmarkCard Desktop Cursor Exit Focus Release (`src/components/presentation/BookmarkCard.tsx`, `src/components/presentation/BookmarksView.tsx`, `src/components/presentation/BookmarkCard.test.tsx`, `src/components/presentation/BookmarksView.test.tsx`, `ADR-063`): Added `onDeactivate` callback with `onMouseLeave` (viewports >= 768px) and `onBlur` listeners to BookmarkCard so that reading ledger cards release their active border ring and title highlight immediately when the mouse leaves the card or focus changes, while preserving mobile scroll-focus.',
        'Mobile Compact Star Rating & Anti-Overlap Badge Layout (`src/components/ui/StarRating.tsx`, `src/components/presentation/BookCard.tsx`, `src/components/ui/StarRating.test.tsx`, `src/components/presentation/BookCard.test.tsx`, `ADR-063`): Added `compactOnMobile` prop to StarRating to render a single compact gold star + label (~34px) on mobile viewports (< 640px) while preserving all 5 stars on sm+, and applied `gap-1.5 min-w-0` and `shrink-0 whitespace-nowrap` to right-hand status/license badges on BookCard, completely preventing text cramming and horizontal overflow on rated books in 2-column mobile grids.',
        'Default Catalog Sort to Recently Added to Gutenberg (`src/config/catalog-filters.ts`, `src/hooks/useCatalogFilters.ts`, `src/components/presentation/AdvancedFilterDrawer.tsx`, `src/config/catalog-filters.test.ts`, `src/hooks/useCatalogFilters.test.ts`, `src/components/presentation/AdvancedFilterDrawer.test.tsx`, `ADR-063`): Optimized default catalog sorting from \'popular\' to \'descending\' (Recently Added to Gutenberg) across initial state, URL sync, filter drawer reset, and SORT_OPTIONS ordering; verified zero extra API load and zero blocking risk due to Supabase primary key B-Tree index scanning and edge caching.',
        'Unified Personal Collection "Downloaded" Filtering, Smart Bookshelf & Spine Hover Refinements (`src/components/presentation/BookshelfRack.tsx`, `src/components/presentation/bookshelf/BookshelfSpine.tsx`, `src/app/page.tsx`, `src/lib/book-sorting.ts`, `src/hooks/reader/useContinueReadingLedger.ts`, `src/components/presentation/BookmarksView.tsx`, `src/components/presentation/NotebookView.tsx`, `src/components/presentation/BookmarkCard.tsx`, `ADR-062`): Introduced an emerald "Downloaded (N)" smart shelf pill in BookshelfRack directly adjacent to General that dynamically appears when downloaded books exist with automatic fallback to General if emptied; retired the redundant status pill next to Clear Offline Shelf; enforced a uniform 12-book per-shelf row limit across General, Downloaded, and custom shelves on the Bookshelf page; removed redundant top Downloaded pills from BookmarkCard and BookshelfSpine while consolidating offline management into the invariant square 4-state bottom action button with a 24px bottom cursor leeway cushion on spine hover cards; and added unified "Downloaded" filter options to CollectionSortDropdown across Bookshelf, Favorites, Notebook, and Bookmarks.',
        'Tier-Adaptive Gliding Active Underline Cradle (`src/components/presentation/Navbar.tsx`, `src/config/library-tokens.ts`, `src/config/library-tokens.test.ts`, `src/components/presentation/Navbar.test.tsx`, `ADR-061`): Architected a shared GPU-accelerated active underline cradle in `Navbar.tsx` that replicates the exact original `h-8 rounded border-b-2` shape at rest (tapered upward corner tips, zero glow) and executes a two-phase Directional Elastic Bridge + Corner-Tip Curl animation on `high` performance tier devices (leading edge reaches with `rounded-b-lg` corner curl; trailing edge snaps into place with `rounded` settlement at 110ms), a smooth single-step glide on `medium` tier, graceful out-of-tab exit (`opacity-0 scale-x-50`) on Account, and zero-CLS native `border-b-2` fallback for `low` tier or `prefers-reduced-motion`.',
        'Authentic Notched Silk Bookmark Ribbon Marker (`src/components/presentation/BookmarkCard.tsx`, `src/components/presentation/BookmarkCard.test.tsx`, `ADR-061`, `ADR-062`): Upgraded the top-right bookmark accent on Reading Ledger cards from a flat rounded rectangle (`w-3 h-6 rounded-b-sm`) to an authentic vector silk ribbon marker (`w-4 h-7`) featuring a classic V-notch / chevron cutout (`M0 0 H16 V28 L8 22 L0 28 Z`), top-fold depth shadow, reading status-reactive coloring (`text-primary` for in progress, `text-emerald-500` for completed, `text-amber-500` for on hold), and top-pinned card-hover extension (`origin-top transition-transform duration-300 group-hover:scale-y-110`).',
        'Account Page Editorial Sub-Tab Unification, Top-Level Placement & Mobile Active-Only Label Expansion (`src/app/account/page.tsx`, `src/components/account/AccountPublicProfileSection.tsx`, `src/components/account/AccountSymposiumSection.tsx`, `src/components/account/AccountPreferencesSection.tsx`, `src/components/account/AccountAccoladesCard.tsx`, `ADR-060`): Standardized all Tier-2 sub-tabs across Habits & Accolades, Public Scholar, Symposiums & Circle, Preferences, and the Accolade Compendium categories into a centered editorial underline strip positioned outside and directly above the section cards for a consistent 3-tier visual hierarchy, with theme-solid active indicator, single-row horizontal flex containment, and responsive active-only label expansion on viewports < 768px to eliminate layout snapping and text truncation on phones.',
        'Layered Dual-Band Overlapping Highlights (Option A) (`src/lib/reader-annotator.ts`, `src/components/reader/ReaderSurface.tsx`, `ADR-059`): Implemented elementary non-overlapping interval partitioning to split intersecting highlight boundaries with `isFellowEnd` tag, and rendered an outer taller amber Fellow highlight frame (`py-[3.5px] px-0.5 border-dashed border-amber-600/85`) enclosing an inner, tighter personal highlight (`py-[0.5px] px-0.5 ring-1 ring-inset`) with single trailing companion badge.',
        'Privacy-Preserving Fellow Scholar Display Name Attribution (`src/components/reader/ReaderSurface.tsx`, `src/components/reader/ReaderSubHeaderRibbon.tsx`, `src/components/reader/TextHighlightPopover.tsx`, `src/components/presentation/NotebookQuoteCard.tsx`, `src/components/account/AccountSymposiumSection.tsx`, `ADR-059`): Replaced `@username` with `displayName` (with `@username` fallback) across in-book highlight badges, milestone dispatch banners, companion progress micro-pills, popover empty-note fallbacks, notebook reflection cards, and account symposium progress bars, while strictly preserving `is_public = false` RLS boundary protections for uninvited public profile visitors.',
        'Unified Overlapping Marginalia Cards & Inline Shared Span Highlighting (`src/lib/reader-annotator.ts`, `src/components/presentation/NotebookQuoteCard.tsx`, `src/components/presentation/NotebookView.tsx`, `src/components/reader/ReaderAnnotationsDrawer.tsx`, `ADR-060`): Implemented `areAnnotationsOverlapping`, `computeSharedQuoteSegments`, and `pairOverlappingAnnotations` so that when `sourceFilter === \'all\'` is active, overlapping personal and Fellow highlights coalesce into a single unified card displaying the union quote, a highlighted inner span (`data-testid="shared-quote-overlap-span"`), dual attribution badges (`You + @username`), and stacked reflection callouts.',
        '1-Click Fellow Passage Saving (`src/components/reader/TextHighlightPopover.tsx`, `src/components/reader/ReaderAnnotationsDrawer.tsx`, `src/components/presentation/NotebookQuoteCard.tsx`, `ADR-060`): Added 1-click `+ Save to My Notes` / `+ Add My Note` actions across the in-book fellow attribution popover, the in-reader Annotations Drawer, and the Commonplace Notebook.',
        'Smart Fellow Marginalia Save Status, Deduplicated All Marginalia Counter & Inline Reflection Editing (`src/lib/reader-annotator.ts`, `src/components/presentation/NotebookQuoteCard.tsx`, `src/components/presentation/NotebookView.tsx`, `src/components/reader/ReaderAnnotationsDrawer.tsx`, `src/components/reader/TextHighlightPopover.tsx`, `ADR-060`): Implemented `findMatchingOwnAnnotation` to cross-reference personal and fellow notes on overlapping quotes; replaced redundant `Save to My Notes` with an `In My Notes` badge on fellow cards when already saved; enabled inline `+ Add My Note` / `Edit My Note` personal reflection editing on fellow marginalia across the Notebook, Reader Drawer, and in-text Popover; and aligned the Notebook `All Marginalia` pill counter to reflect the deduplicated card count.',
        'Horizontal Click-and-Drag & Wheel Filter Pill Scrolling (`src/lib/scroll-utils.ts`, `src/components/reader/ReaderAnnotationsDrawer.tsx`, `src/components/presentation/NotebookView.tsx`, `ADR-060`): Added `attachHorizontalDragAndWheelScroll` with a 5px movement deadzone, capture-phase click suppression after drag, and vertical-wheel-to-horizontal translation on the note color filter pill bars.',
        'Universal Cross-Device Offline Reading Controls, Interactive "Downloaded" Badge, Removal Confirmation Modal & Orphaned Cache Cleanup (`src/components/ui/RemoveOfflineBookModal.tsx`, `src/lib/offline-storage.ts`, `src/hooks/useOfflineBooks.ts`, `src/stores/useBookshelfStore.ts`, `src/components/presentation/BookshelfRack.tsx`, `src/components/presentation/bookshelf/BookshelfSpine.tsx`, `src/components/presentation/bookshelf/BookshelfMobileModal.tsx`, `src/components/presentation/BookPreviewModal.tsx`, `src/components/presentation/DownloadDrawer.tsx`, `src/components/presentation/BookCard.tsx`, `ADR-060`, `ADR-062`): Added cross-instance `bookarium:offline-updated` and `bookarium:offline-downloading` event synchronization across all mounted `useOfflineBooks` hooks, enabled partial-shelf offline clearing (`Clear Offline (N)`) in `BookshelfRack`, added `isDownloadingOffline` loading spinners (`Loader2`) on single-book downloads, brought offline toggle parity to Desktop\'s 3D `BookPreviewModal`, added an in-app browser offline cache card to `DownloadDrawer`, renamed offline status indicators to `Downloaded` across all surfaces, made `Downloaded` badge interactive on `BookCard` with `RemoveOfflineBookModal` confirmation dialog across all removal points (while `BookmarkCard` centralizes offline controls in its 4-state action button per ADR-062), and automated IndexedDB cache cleanup when unshelving or clearing books in `useBookshelfStore`.',
        'Fellow Scholar Identity Resolution & Sync Across Private Sanctuaries (`supabase/schema.sql`, `src/stores/useFellowshipStore.ts`, `src/stores/useAnnotationStore.ts`, `src/stores/useAuthStore.ts`, `src/components/presentation/NotebookQuoteCard.tsx`, `src/components/presentation/NotebookView.tsx`, `src/components/reader/ReaderAnnotationsDrawer.tsx`, `src/components/reader/TextHighlightPopover.tsx`, `src/components/reader/ReaderSubHeaderRibbon.tsx`, `src/components/account/AccountSymposiumSection.tsx`, `src/components/symposium/SymposiumInviteModal.tsx`, `ADR-060`): Added companion profile RLS policy on `public.profiles` allowing fellows in shared Reader Circles or Symposiums to resolve `@username` and `display_name` even when profiles are set to Private Sanctuary (`is_public = false`), added `handle_profile_identity_sync()` PostgreSQL trigger, implemented `formatFellowScholarLabel` and `isPlaceholderUsername` with automatic stale placeholder healing, and synchronized profile updates across fellowship and annotation stores.',
        'Multi-Layer Offline Reader Resilience & Route Warmup (`src/hooks/useCatalogFilters.ts`, `src/app/page.tsx`, `src/app/read/[id]/page.tsx`, `public/sw.js`, `src/hooks/useOfflineBooks.ts`, `src/hooks/queries/useBookContent.ts`, `ADR-060`): Implemented App Shell fallback reader mounting from `src/app/page.tsx`, path-based book ID extraction (`extractReaderBookIdFromPath`), client-side Reader chunk preloading, Service Worker `/read/*` RSC query handling (`bookarium-app-shell-v2`), and offline copyright parity checks.',
        'BookCard Card-Level Hover "Remove" Transition, Mobile Tactile Tap Modal & Clean 3D Spread (`src/components/presentation/BookCard.tsx`, `src/components/presentation/BookPreviewModal.tsx`, `src/app/page.tsx`, `ADR-060`): Upgraded top-left Downloaded badge on BookCard to reveal Remove on card hover, unified mobile (<1024px) Catalog cover taps to open BookshelfMobileModal with card outline rings and offline removal confirmation modals, and removed technical offline badges from inside the opened 3D book preview spread.',
        'Bookmarks 4-State Offline Button & Tactile Active Zone (`src/components/presentation/BookmarkCard.tsx`, `src/components/presentation/BookmarksView.tsx`, `src/components/presentation/bookshelf/BookshelfMobileModal.tsx`, `src/components/presentation/bookshelf/BookshelfSpine.tsx`, `ADR-033`, `ADR-062`): Standardized square offline button across Bookmarks, Bookshelf Spine, and Mobile Modal to preserve <HardDriveDownload /> neutral -> emerald hover when not downloaded, emerald idle -> destructive red <Trash2 /> hover when downloaded; and implemented mobile single-column scroll focus zone (<768px) and multi-column tap-to-activate with outside-click dismissal in BookmarksView.',
        'Navbar Tabs Sleek Uniform Typography (`src/components/presentation/Navbar.tsx`, `src/components/presentation/Navbar.test.tsx`, `ADR-061`): Replaced active font-bold on top navigation tabs (Catalog, Bookshelf, Favorites, Notebook, Bookmarks) with uniform font-medium and transition-colors, eliminating text-width micro-jumps while relying on the colored underline, text color, and icon fill for active identification.',
      ],
      Fixed: [
        'Non-Overlapping In-Page Bookmark Geometry & Margin Gutter Isolation (`src/components/reader/ReaderSurface.tsx`, `src/components/reader/ReaderSurface.test.tsx`, `ADR-068`): Repositioned the interactive row bookmark tab to `right-full mr-1.5 sm:mr-2.5 origin-right` and expanded `<article>` left padding (`pl-12` mobile to `md:px-16` desktop) so the bookmark ribbon tab and snapping guide line reside strictly within the dedicated left margin gutter, completely eliminating text overlap across all viewports (`320px` to `4K`), typography settings, and line offsets.',
        'Global Symposium Fellow Marginalia Synchronization & Notebook Paired Overlap Display (`src/stores/useAnnotationStore.ts`, `src/lib/sync-utils.ts`, `src/app/read/[id]/page.tsx`, `src/components/presentation/NotebookView.tsx`, `src/components/presentation/NotebookQuoteCard.tsx`, `src/components/reader/ReaderAnnotationsDrawer.tsx`, `ADR-068`): Resolved missing fellow annotations on the Literary Notebook by adding `fetchAllFellowAnnotations` and wiring it into global cloud sync, Notebook mount, and reader drawer open events; fixed missing fellow callouts on overlapping quotes saved without a reflection note by rendering a dedicated attribution line (`Also saved and highlighted in this Literary Symposium.`); preserved paired fellow context in \'My Marginalia\'; and enabled paired color filtering, deep companion search, and latest-activity recency sorting.',
        'Offline Mobile PWA Reader Redirection & App Shell Fallback (`src/hooks/useCatalogFilters.ts`, `src/app/page.tsx`, `src/app/read/[id]/page.tsx`, `ADR-060`): Prevented `useCatalogFilters` from overwriting `/read/[id]` routes with `/` when offline, fixed missing book ID hydration on App Shell fallback, and guarded reader store initialization to eliminate re-render loops.',
        'Color-Nuanced Overlap Highlight Rings (`src/config/annotation-tokens.ts`, `src/components/reader/ReaderSurface.tsx`, `ADR-060`): Replaced the unthemed black/white border (`ring-1 ring-foreground/20`) on overlapping personal + fellow highlights with palette-harmonized `overlapRingClass` tokens (`ring-yellow-500/45`, `ring-amber-500/45`, `ring-emerald-500/45`, `ring-rose-500/45`) across Light, Sepia, and Dark themes.',
        'Zero-CLS Reader Theme Cycling (`src/components/reader/ReaderHeader.tsx`, `src/components/reader/ReaderControls.tsx`, `src/config/reader-themes.ts`, `src/app/globals.css`, `ADR-060`): Eliminated layout shifts when cycling Light/Sepia/Dark reading modes by enforcing consistent `1px` borders on the header translation count badge and `READER_THEMES` `activePill` tokens, narrowing `transition-all` to `transition-colors` on theme buttons, and refactoring `.reader-surface-light/.sepia/.dark` scrollbar rules to use shared CSS custom properties (`--reader-sb-*`).',
        'Symposium Continuous Progress Infinite Re-Render Loop Resolution (`src/stores/useFellowshipStore.ts`, `src/app/read/[id]/page.tsx`, `ADR-059`): Resolved Next.js `Maximum update depth exceeded` in `syncSymposiumProgress` by adding coordinate equality diff checks before calling store `set(...)`, and narrowed `read/[id]/page.tsx` effect dependencies from mutable `activeSymposium` to scalar primitives.',
        '7-Layer Author Lifespan Preservation, Cloud Self-Healing & False HTTP 451 Elimination (`src/lib/adapters/book.adapter.ts`, `src/stores/useReaderStore.ts`, `src/lib/book-metadata.ts`, `src/hooks/useCollectionAutoHeal.ts`, `src/hooks/queries/useBookContent.ts`, `src/hooks/useOfflineBooks.ts`, `src/app/read/[id]/page.tsx`, `src/stores/useAnnotationStore.ts`, `src/components/presentation/NotebookView.tsx`, `src/app/api/books/content/metadata-cache.ts`, `ADR-060`): Prevented un-enriched cloud `reading_progress` rows, partial `currentBook` payloads, and `fellowAnnotations` from stripping verified author lifespans, added bidirectional Supabase `reading_progress` lifespan self-healing, expanded `useCollectionAutoHeal` and `NotebookView` metadata enrichment across `annotations`, `fellowAnnotations`, and `symposiums`, deferred client-side IndexedDB copyright gatekeeping to `/api/books/content` when local author records lack birth/death years while online, and added a Tier 3 `FEATURED_HERO_BOOKS` fallback to `metadata-cache.ts`.',
      ],
      Updated: [
        'Next.js 16.4.3 Supply-Chain Upgrade (`package.json`, `package-lock.json`, `README.md`, `docs/DECISIONS.md`, `ADR-059`): Upgraded `next` and `eslint-config-next` to `16.4.3`, verifying Turbopack and Webpack production build stability and updating project documentation badges.',
        '4-Tier Vitest Suite Hardening & >= 85% Coverage Enforcement (`vitest.config.mts`, `src/config/featured-books.test.ts`, `src/config/literary-quotes.test.ts`, `src/config/catalog-filters.test.ts`, `src/workers/gutenberg.worker.test.ts`, `src/components/ui/RemoveOfflineBookModal.test.tsx`, `src/hooks/useOfflineBooks.ts`, `ADR-060`): Added 5 new co-located unit suites (187 suites / 1,852 tests total), expanded branch and error-recovery tests across pages, UI components, Zustand stores, cloud sync, and IndexedDB storage, eliminated React 19 `act(...)` warnings, excluded pure TypeScript type definitions and re-export barrels from V8 coverage noise, and raised enforced coverage thresholds from `80%` to `85%` across `lines` (`95.78%`), `statements` (`94.43%`), `functions` (`92.44%`), and `branches` (`85.04%`).',
      ],
    },
  },
  {
    version: '2.8.0',
    date: '2026-10-23',
    title: 'WCAG 2.2 AA Focus Trapping & Dynamic ARIA, Zero-Any Strict TypeScript, Overlay Code-Splitting, Monolith Decomposition & Hardened Production CSP',
    sections: {
      Added: [
        'WCAG 2.2 AA Modal Focus Trapping & Focus Restoration (`src/components/ui/Modal.tsx`, `src/components/reader/ReaderDrawerShell.tsx`, `src/components/auth/AuthModal.tsx`, `ADR-058`): Added keyboard `Tab` / `Shift+Tab` boundary trapping within all modals and reader drawers using a stable callback ref pattern that preserves input focus across parent re-renders, automatic focus restoration to the previously active element on close with `{ preventScroll: true }`, Escape key dismissal for `AuthModal`, and dynamic `useId()` ARIA labelled-by association.',
        'Zero-Any TypeScript Strictness & Compiler Governance (`eslint.config.mjs`, `src/test/setup.ts`, `src/lib/library-backup.ts`, `src/stores/useBookshelfStore.ts`, `src/stores/useReaderStore.ts`, `src/app/account/page.tsx`, `ADR-058`): Eradicated all explicit `any` usages across production stores, adapters, page routes, and `src/test/setup.ts`, replacing them with typed interfaces (`GutendexBook`, `UserBookCurationRow`, `RawBackupCandidate`, `Record<string, unknown>`), and activated `"@typescript-eslint/no-explicit-any": "error"` in ESLint.',
        'React Server Component Conversion for Informational Routes (`src/app/copyright/page.tsx`, `src/app/privacy/page.tsx`, `ADR-058`): Converted static informational pages to React Server Components (RSC), eliminating client bundle weight and hydration overhead.',
        'Dynamic Code-Splitting for Closed-by-Default Overlays (`src/app/providers.tsx`, `src/app/page.tsx`, `src/components/account/AccountAccoladesCard.tsx`, `src/components/account/AccountSymposiumSection.tsx`, `src/components/presentation/BookmarkCard.tsx`, `src/components/profile/PublicProfileView.tsx`, `scripts/lib/ast-parser.js`, `ADR-058`): Converted `AuthModal`, `AdvancedFilterDrawer`, `DownloadDrawer`, `BookPreviewModal`, `AccoladeCelebrationModal`, and `SymposiumInviteModal` to lazy `next/dynamic(..., { ssr: false })` loading, and extended AST matrix parser for dynamic `import()` expressions.',
      ],
      Fixed: [
        'Symposium Fellow Marginalia Attribution & Self-Healing (`src/stores/useAnnotationStore.ts`, `src/app/read/[id]/page.tsx`, `src/components/reader/ReaderAnnotationsDrawer.tsx`, `src/components/reader/TextHighlightPopover.tsx`, `src/components/presentation/NotebookQuoteCard.tsx`, `ADR-058`): Added `buildFellowScholarsMap` and `enrichFellowAnnotations` in `useAnnotationStore.ts` (cross-referencing `useFellowshipStore` `symposiums` and `circles` with a `profiles` fallback lookup) and coordinated Reader load order so Fellow Scholar quotes and marginalia display the scholar\'s display name and `@username` instead of `@fellow_scholar`.',
        'Canonical Auth Redirect Origin, Cross-Device Email Verification & Complete 11-Table Account Erasure (`src/lib/redirect-sanitizer.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/callback/route.test.ts`, `src/stores/useAuthStore.ts`, `src/app/providers.tsx`, `src/components/auth/AuthModal.tsx`, `src/app/auth/confirm-deletion/page.tsx`, `src/components/account/AccountSecuritySection.tsx`, `src/components/account/AccountDeleteModal.tsx`, `ADR-058`): Normalized non-local authentication redirect origins to `SITE_CONFIG.SITE_URL` (`https://bookarium.vercel.app`) so protected Vercel preview URLs never leak into outgoing confirmation emails, routed `signInWithOtp` and `signInWithOAuth` through `/auth/callback`, added `token_hash` + `type` (`verifyOtp`) and cross-device PKCE verifier fallback (`/?auth_notice=email_verified`) to `/auth/callback`, added client-side confirmation/expiration banners in `AuthModal` with automatic URL parameter cleanup, and expanded `deleteAccount()` to purge all 11 user-linked Supabase tables (`symposium_sessions`, `reader_circles`, `user_accolades`, etc.) and reset all 6 local Zustand/IndexedDB stores.',
        'React `act(...)` Warning Elimination & Deep Branch Test Coverage (`src/hooks/useOfflineBooks.ts`, `src/components/presentation/BookshelfRack.test.tsx`, `src/app/account/page.test.tsx`, `src/components/presentation/bookshelf/BookshelfSpine.test.tsx`, `src/components/presentation/bookshelf/BookshelfMobileModal.test.tsx`, `src/lib/offline-storage.test.ts`, `src/hooks/queries/useBookContent.test.ts`, `src/components/account/AccountSymposiumSection.test.tsx`, `src/app/u/[username]/page.test.tsx`, `src/components/reader/ReaderSpeechBar.test.tsx`, `ADR-058`): Added no-op functional state guards in `useOfflineBooks.ts` and wrapped asynchronous state mutations in `act(...)` and `waitFor`, completely eliminating React testing environment stderr warnings while raising branch coverage across storage, speech synthesis, and public profile views.',
        'Hardened Production Content Security Policy (`next.config.ts`, `ADR-058`): Removed \'unsafe-eval\' from script-src in production builds, restricting evaluation exceptions strictly to `process.env.NODE_ENV !== \'production\'`.',
        'Top-Level Navigation Fallback (`src/components/presentation/Navbar.tsx`, `src/components/presentation/Navbar.test.tsx`): Added router fallback navigation (`router.push(ROUTES.VIEW(item.id))`) to `Navbar.tsx` when `onViewChange` callback is omitted.',
      ],
      Refactored: [
        'Phase 5 Monolith Decomposition (`src/lib/backup-validator.ts`, `src/lib/library-backup.ts`, `src/components/account/AccountNarrationSubPanel.tsx`, `src/components/account/AccountPortabilitySubPanel.tsx`, `src/components/account/AccountPreferencesSection.tsx`, `src/lib/bookshelf-cloud-sync.ts`, `src/stores/useBookshelfStore.ts`, `ADR-058`): Extracted schema validation (`backup-validator.ts`), account preference sub-panels (`AccountNarrationSubPanel.tsx`, `AccountPortabilitySubPanel.tsx`), and bidirectional cloud bookshelf reconciliation (`bookshelf-cloud-sync.ts`) into dedicated single-responsibility modules with co-located unit tests and 100% backward-compatible re-exports.',
      ],
    },
  },
  {
    version: '2.7.1',
    date: '2026-10-16',
    title: 'Mobile Viewport Ergonomics, Horizontal Overflow Clipping, 3×2 Account Bento Grid & Non-Breaking Tailwind CSS v4 Supply-Chain Upgrade',
    sections: {
      Added: [
        'Non-Breaking Tailwind CSS v4 Oxide Migration & Zero-Vulnerability Supply Chain (`package.json`, `postcss.config.mjs`, `src/app/globals.css`, `src/lib/utils.ts`, `src/components/presentation/BookCard.tsx`, `ADR-056`): Upgraded to `tailwindcss@4.3.3` and `@tailwindcss/postcss@4.3.3` using the `@config "../../tailwind.config.ts"` compatibility bridge, `@custom-variant dark`, Preflight v3 border/cursor parity rules, `extendTailwindMerge` custom shadow group registration, and pre-v4 editorial `BookCard` border/badge parity, and aliased `"fast-glob": "npm:tinyglobby@^0.2.17"` in `package.json` `"overrides"` to eliminate all 7 transitive `braces`/`micromatch` audit warnings (`0 vulnerabilities`).',
        'Multi-Resolution Transparent Favicon Pipeline (`public/icon.svg`, `public/favicon.ico`, `scripts/generate-pwa-icons.js`, `src/app/layout.tsx`, `ADR-057`): Generated standards-compliant 32-bit RGBA binary multi-resolution `.ico` (16x16, 32x32, 48x48) and vector `icon.svg` with squircle edge anti-aliasing (`alpha = 0` outside rounded rect) and transparent exterior corners, eliminating squared white corners in browser tabs, and applied squircle corner masks to non-maskable PWA icons (`icon-192.png`, `icon-512.png`).',
        'Next.js App Router Route Handler Type Isolation (`src/lib/redirect-sanitizer.ts`, `src/lib/redirect-sanitizer.test.ts`, `src/app/auth/callback/route.ts`, `ADR-057`): Extracted `sanitizeRedirectPath` into a dedicated utility module with co-located unit tests to satisfy Next.js 16 Route Handler type constraints (TS2344) forbidding non-HTTP exports from `route.ts`.',
      ],
      Fixed: [
        'Bookshelf Icon Semantics Unification (`Library` vs. `Bookmark`) (`src/components/presentation/BookCard.tsx`, `src/components/presentation/bookshelf/BookshelfSpine.tsx`, `src/components/presentation/bookshelf/BookshelfMobileModal.tsx`, `src/config/views.config.ts`, `src/components/presentation/HeroSearch.tsx`, `src/app/not-found.tsx`, `src/components/account/AccountPublicProfileSection.tsx`, `ADR-057`): Replaced the `Bookmark` ribbon icon with `Library` across all "Save to Bookshelf" action buttons, cursor hover tooltips, empty-shelf descriptions, and profile privacy toggles, reserving `Bookmark` strictly for the Bookmarks ledger (`/bookmarks`).',
        'Account Tier-2 Sub-Tab Mobile Overflow Containment (`src/components/account/AccountSymposiumSection.tsx`, `src/components/account/AccountPreferencesSection.tsx`, `src/components/account/AccountPublicProfileSection.tsx`, `src/app/account/page.tsx`, `ADR-057`): Enforced `w-full max-w-full min-w-0 overflow-hidden` on all Tier-2 sub-tab bars, added `min-w-0` to sub-tab buttons, scaled font sizes (`text-[11px] sm:text-xs`), hid decorative icons on viewports `< 420px`, and applied `truncate` to mobile text spans, preventing horizontal overflow on mobile screens down to 320px.',
        'Defensive Upstream Mirror Header Parsing & Webpack Build Stability (`src/app/api/books/content/route.ts`, `scripts/verify-build.js`, `ADR-057`): Added optional chaining to `response.headers?.get(...)` in the content route handler to prevent uncaught TypeError on mock/unconventional mirror responses, and aligned Pass 7 in `verify-build.js` to execute `next build --webpack` to resolve Windows Turbopack IPC worker process disconnection crashes.',
        'Mobile Swipe & Favorites Horizontal Overflow Prevention (`src/app/globals.css`, `src/app/page.tsx`, `src/app/account/page.tsx`, `src/components/presentation/BookCard.tsx`): Enforced `overflow-x: clip` on `html, body` and `overflow-x-clip` on root layout and `<main>` containers so `translateX(±20px)` swipe animations never expand scrollWidth or offset the sticky Navbar, and added `min-w-0` to `BookCard` and its inner metadata column preventing 2-column mobile cards from blowing out their 1fr track.',
        'Notebook Toolbar & Pagination Mobile Fit (`src/components/presentation/NotebookView.tsx`, `src/components/presentation/CollectionToolbar.tsx`, `src/components/presentation/CollectionSortDropdown.tsx`): Collapsed `By Book` and `Chronological` segmented toggle labels to icon-only on mobile (`hidden sm:inline` on text spans with preserved accessible names) and allowed the sort dropdown container to flex cleanly (`flex-1 min-w-[105px] max-w-[155px] sm:flex-none sm:min-w-[145px] sm:max-w-[195px]`), guaranteeing top pagination (`< 1 / N >`) never overflows on narrow 320px–430px viewports.',
        'Account Canonical Milestone Ladder Mobile Stacking (`src/components/account/AccountHabitsCard.tsx`): Updated Milestone Ladder grid to `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`, stacking the 4 canonical accolade milestones in a single column on mobile (< 640px) for balanced horizontal breathing room.',
        'Account Identity 3×2 Non-Scrolling Bento Grid & Zero Hydration CLS (`src/components/account/AccountIdentityCard.tsx`): Replaced the scrolling stat strip with a compact 3×2 non-scrolling bento grid (`grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap`) and permanently rendered the 6th `🔥 Nd Streak` pill (neutral `0d Streak` when idle, amber when active) so all 6 cells stay locked with zero hydration pop-in or horizontal scrollbars.',
        'Account Multi-Screen Visual Polish, Zero-CLS Sub-Tabs & Duplicate Library Breakdown Retirement (`src/app/account/page.tsx`, `src/components/account/AccountSymposiumSection.tsx`, `src/components/account/AccountPreferencesSection.tsx`, `src/components/account/AccountPublicProfileSection.tsx`, `src/components/account/AccountSecuritySection.tsx`, `src/components/account/AccountHabitsCard.tsx`, `src/components/account/AccountAccoladesCard.tsx`, `src/components/accolades/ExLibrisBookplate.tsx`): Standardized outer section padding (`p-4 sm:p-6 lg:p-7`), upgraded section header + sub-tab switcher rows to stack cleanly until `lg:flex-row` (`1024px+`), added `whitespace-nowrap`, concise mobile labels (`< 640px`), and `border-transparent` inactive borders across all Tier-1 and Tier-2 tabs, permanently mounted the Preferred System Narrator Voice `<select>` to prevent async `onvoiceschanged` layout jumps, removed `scale3d(1.02)` and `scale-[1.02]` hover/active shifts, and retired the duplicate `Library Breakdown` sub-tab (`AccountLibraryStats.tsx`).',
        'Cross-Theme (`Light`, `Sepia`, `Dark`) & Cross-Page Border Harmonization (`src/components/presentation/BookCard.tsx`, `src/app/account/page.tsx`, `src/components/account/AccountIdentityCard.tsx`, `src/components/account/AccountPublicProfileSection.tsx`, `src/components/account/AccountSymposiumSection.tsx`, `src/components/account/AccountPreferencesSection.tsx`, `src/components/symposium/SymposiumInviteModal.tsx`, `src/components/profile/PublicProfileView.tsx`, `src/components/profile/PinnedAccoladesShelf.tsx`, `src/components/profile/PrivateProfileNotice.tsx`, `src/app/privacy/page.tsx`): Restored `bg-muted dark:bg-secondary/30` on the `BookCard` cover pedestal, added solid `border-border` to top-right floating action buttons for Sepia/Dark contrast and to `+N` popover topic tags on hover, eliminated all vanishing fractional `border-border/60..80` classes across Sepia/Dark modes, and standardized header icon boxes, status pills, and Tier-2 sub-tabs to solid `border-border`.',
        'Mobile Spacing & Collection Ergonomics Decluttering (`src/components/ui/SectionHeader.tsx`, `src/components/presentation/BookGrid.tsx`, `src/components/presentation/NotebookView.tsx`, `src/components/presentation/BookmarksView.tsx`): Spaced 7-day sparkline circles evenly (`justify-between sm:justify-start gap-1 sm:gap-2.5`), made `SectionHeader` / `SectionTitle` responsive (`text-2xl sm:text-4xl`, flank lines `w-6 sm:w-12 shrink`, `mb-5 sm:mb-10`), tightened collection vertical padding (`py-6 sm:py-12` / `pt-6 sm:pt-12`), and tightened mobile 2-column grid gap (`gap-2.5 sm:gap-6`).',
        'WCAG `[hidden]` Account Tabpanel Semantics & Vitest Suite Speed/Isolation Optimization (`src/app/account/page.tsx`, `src/app/account/page.test.tsx`, `src/app/api/books/content/route.test.ts`, `src/app/api/books/content/route.security.test.ts`, `src/app/api/books/content/metadata-cache.test.ts`, `src/components/presentation/NotebookView.test.tsx`, `src/app/page.test.tsx`): Added native HTML `hidden` attributes alongside `.hidden` classes on inactive `<section role="tabpanel">` and Tier-2 sub-panel containers, isolated `NEXT_PUBLIC_SUPABASE_URL` in Tier 2 Gutenberg content route tests (`~75x` faster offline execution), and scoped pagination/landmark queries with `within(...)` (`~8–12x` speedup).',
      ],
    },
  },
  {
    version: '2.7.0',
    date: '2026-10-15',
    title: 'Reader Circles & Literary Symposiums (Dual Reading), Shared Marginalia, Spoiler Shield & Two-Tier Account Workspace Architecture',
    sections: {
      Added: [
        'Two-Tier Account Workspace Architecture (`src/app/account/page.tsx`, `ADR-055`): Redesigned `/account` with a top-level mode switch between **Reading Studio** (Habits & Streaks, Ex-Libris Accolades, Public Profile, Reader Circles & Symposiums) and **Account & System** (Preferences, Security, Data Portability & Danger Zone), plus URL `?tab=` deep-linking and scroll-aware compact sub-tab transitions on mobile (`< 768px`).',
        'Reader Circles & Literary Symposiums Schema (`supabase/schema.sql`, `src/types/database.types.ts`, `src/stores/useFellowshipStore.ts`): Provisioned idempotent `public.reader_circles` and `public.symposium_sessions` tables with strict RLS participant isolation, `lookup_scholar_by_username` RPC, and scoped `user_annotations` RLS policy allowing Literary Fellows in active symposiums to view shared marginalia.',
        'Symposium Invitations & Fellowship Hub (`src/components/account/AccountSymposiumSection.tsx`, `src/components/symposium/SymposiumInviteModal.tsx`, `src/components/profile/PublicProfileView.tsx`, `src/components/presentation/BookmarkCard.tsx`): Added Literary Fellowship invitations by `@username` or direct `/u/[username]` profile CTA, active symposium progress cards, and 1-click "Read with a Fellow" symposium invitations.',
        'Shared Symposium Marginalia, Overlap Switcher & Spoiler Shield (`src/lib/reader-annotator.ts`, `src/components/reader/ReaderSurface.tsx`, `src/components/reader/TextHighlightPopover.tsx`, `src/components/reader/ReaderAnnotationsDrawer.tsx`, `src/components/presentation/NotebookView.tsx`, `src/components/presentation/NotebookQuoteCard.tsx`): Rendered fellow highlights with dashed archival underlines (`border-dashed`), multi-highlight overlap switcher tabs (`You` | `🤝 @fellow`), source filter pills (`All | Mine | Fellows`), and a client-side Spoiler Shield that conceals fellow notes beyond the reader\'s current section and page.',
        'Companion Progress Micro-Pill, Milestone Dispatches & Symposium Accolade (`src/components/reader/ReaderSubHeaderRibbon.tsx`, `src/config/accolades-config.ts`): Added responsive companion progress micro-pill (`🤝 X%` on mobile, `🤝 @username: Sec. Y (X%)` on desktop), single-banner priority milestone dispatch notices, and the Gold-tier *Symposium Companion* (*"Societas Litterarum"*) Ex-Libris bookplate.',
      ],
      Fixed: [
        'Bookmark & Collection Copyright Lifespan Persistence & Auto-Healing (`src/stores/useReaderStore.ts`, `src/hooks/reader/useContinueReadingLedger.ts`, `src/hooks/useCollectionAutoHeal.ts`, `src/stores/useBookshelfStore.ts`, `src/lib/adapters/book.adapter.ts`, `src/lib/copyright-engine.ts`): Embedded author birth/death years in `readingPositions.bookAuthors` and cloud `reading_progress` payloads via `formatAuthorWithLifespan`, prevented partial book records from overwriting verified `authorDetails` lifespans in `useContinueReadingLedger`, extended `useCollectionAutoHeal` to heal incomplete `favoriteBooks` and `readingPositions`, and generalized `parseLifespansFromName` for BCE and 1–4 digit year ranges.',
      ],
      Refactored: [
        'Dedicated Public Profile Tab Extraction (`src/components/account/AccountIdentityCard.tsx`, `src/components/account/AccountPublicProfileSection.tsx`, `src/components/account/AccountPreferencesSection.tsx`): Extracted Public Scholar Profile controls into a dedicated studio sub-tab and relocated Territorial Copyright Jurisdiction settings into Account Preferences.',
      ],
    },
  },
  {
    version: '2.5.4',
    date: '2026-09-18',
    title: 'Mobile Catalog Dock Inactivity Auto-Fade (1.4s), Biomechanical Touch-Swipe Ergonomics (Zero False Negatives) & Directional View Slide Transitions',
    sections: {
      Added: [
        'Hardware-Accelerated Mobile Dock Auto-Fade (`src/components/presentation/StickyCatalogToolbar.tsx`): Integrated scroll inactivity auto-fade transitioning the floating mobile catalog capsule dock to `opacity-0 pointer-events-none` after 1,400ms of inactivity, waking instantly (<180ms) upon scrolling, touching, or hovering.',
        'Directional View Slide Transitions (`src/app/globals.css`, `src/app/page.tsx`): Built 220ms hardware-accelerated slide-in transitions (`animate-view-slide-left` from right on forward swipe, `animate-view-slide-right` from left on backward swipe), with clean fallback to grounded Booksaw vertical fade (`animate-page-turn`) on manual tab taps and full `@media (prefers-reduced-motion: reduce)` accessibility support.',
        'Biomechanical Touch-Swipe Ergonomics (`src/hooks/useMobileViewSwipe.ts`): Relaxed `dominanceRatio` from 1.8 to 1.25 to natively support natural human thumb arcs (up to 38.6°), extended `maxDurationMs` from 500ms to 650ms for deliberate swipes, lowered `minDistancePx` from 50px to 40px for responsive flicks, and added `lastSwipeDirection` state with `onSwipeDirection` callbacks.',
        'Mobile Browser Touch Protection (`src/app/page.tsx`): Declared `touch-pan-y` on the root `<main>` container and wired `handleTouchCancel` to prevent mobile Safari and Chrome from swallowing or aborting horizontal touch sequences.',
        'Architecture Decision Record (`ADR-050`): Formally ratified mobile dock inactivity auto-fade, biomechanical touch ergonomics, and directional view transitions in `docs/DECISIONS.md`.',
      ],
      Fixed: [
        'Collection Sort Dropdown Icon Overlap (`src/components/presentation/CollectionSortDropdown.tsx`): Replaced arbitrary Tailwind classes with standard spacing (`pl-8 sm:pl-9 pr-7 sm:pr-8`) and bounded width (`min-w-[125px] sm:min-w-[145px] max-w-[165px] sm:max-w-[195px]`), guaranteeing a clean 10px clear gutter from the ArrowUpDown icon.',
        'Touch-Swipe False Negatives & Dropped Gestures: Eliminated dropped swipes caused by overly strict Cartesian angle thresholds, timeout cutoffs, and edge bezel touch rejections.',
        'Portaled Modal Viewport Centering & Ancestor Transform Isolation (`src/components/ui/Modal.tsx`, `src/app/globals.css`): Portaled `Modal.tsx` directly into `document.body` via `createPortal(..., document.body)` with `data-no-swipe`, and normalized `100% { transform: none }` keyframes with `will-change: auto !important` in mobile/reduced-motion media queries so confirmation dialogs never get trapped inside tall ancestor scroll containers.',
        'Listen Mode Minimize/Expand Corner Distortion (`src/components/reader/ReaderSpeechBar.tsx`): Isolated the Expanded (`key="speech-expanded"`, `rounded-2xl`) and Minimized (`key="speech-minimized"`, `rounded-full`) narration surfaces onto distinct keyed `<motion.div>` elements inside `<AnimatePresence initial={false}>` and scoped CSS transitions to `transition-[background-color,border-color,box-shadow]`, eliminating the `9999px -> 16px` border-radius snap and padding squish across desktop, tablet, and mobile.',
      ],
      Refactored: [
        'Unified View-Transition Wrapper (`src/app/page.tsx`): Consolidated view presentation containers across Catalog, Bookshelf, Favorites, Bookmarks, and Notebook into a unified dynamic transition wrapper with automatic direction cleanup on animation end.',
        'Streamlined Bookmarks Header & Unified Transparent Collection Modals (`src/components/presentation/BookmarksView.tsx`, `src/config/views.config.ts`, `src/components/presentation/NotebookView.tsx`, `src/components/reader/DeleteAnnotationModal.tsx`, `src/app/page.tsx`): Simplified Bookmarks heading from `"Continue Reading & Bookmarks"` to `"Bookmarks"`, and standardized `backdropClassName="bg-transparent backdrop-blur-none"` across all collection confirmation modals.',
      ],
    },
  },
  {
    version: '2.5.3',
    date: '2026-09-17',
    title: 'Unified Collection Workbench, Strict 2-Row Mobile Ergonomics, Multi-Shelf Pagination & Viewport-Aware Scroll Architecture',
    sections: {
      Added: [
        'Unified Collection Toolbar (`src/components/presentation/CollectionToolbar.tsx`): Built a single reusable workbench card adopting the Notebook container aesthetic (`bg-card border border-border rounded-xl shadow-booksaw`), encapsulating search input, clear shortcut (`Esc`), match counter badge (`X / Y`), sort dropdown, top pagination (`CollectionTopPagination`), volume count badge, and `extraControls`.',
        'Strict 2-Row Mobile Architecture: Guaranteed that controls across Bookshelf, Favorites, Bookmarks, and Notebook never wrap across 3 rows on mobile viewports (<640px) — Row 1 is a 100% full-width search bar; Row 2 is a single balanced utility flex row.',
        'Compact Collection Sort Dropdown (`src/components/presentation/CollectionSortDropdown.tsx`): Reduced mobile width from 150px to 125px with py-1.5 padding and preserved 16px font sizing on mobile inputs to eliminate iOS Safari auto-zoom while maintaining tight proportions.',
        'Responsive Multi-Shelf Pagination (`src/app/page.tsx`): Configured Bookshelf pagination to display 2 bookshelves per page on desktop/tablet (>=640px) and 1 bookshelf per page on mobile (<640px). Configured Favorites pagination to 24 books per page with both top and bottom pagination controls.',
        'Viewport-Aware Smart Smooth Scroll Engine (`src/lib/scroll-utils.ts`): Created `smartScrollToContent(elementId, { offsetTop, behavior })`, measuring element viewport coordinates to gracefully skip scrolling if already comfortably visible or smoothly glide to content with fixed header clearance.',
        'Deterministic Multi-Attribute Book Sorting Engine (`src/lib/book-sorting.ts`): Implemented pure computational utility sorting books across Recently Added, Title (A-Z/Z-A), Author (A-Z/Z-A), Release Year, and Downloads.',
        'Mobile Bottom Capsule Dock & Adaptive Bottom Sheet Filters (`ADR-046`): Built floating thumb-friendly bottom dock on mobile catalog view and converted filter drawer into a native mobile bottom sheet with 2-column catalog grid density.',
        'Atomic Filter Staging & Multi-Select Touch Chips (`ADR-047`): Buffered catalog filter selections into local draft state with multi-select touch chips across Eras, Topics, Languages, and Formats, slashing database query volume by >75%.',
        'Filter Bar Top-Margin Scroll Docking & Segmented Quick Clear (`ADR-048`): Restored seamless top-margin docking at top-16/top-0 and introduced a segmented split-capsule filter clear button `[ ⚡ Filters (N) | ✕ ]`.',
        'Architecture Decision Records (`ADR-046` to `ADR-049`): Formally ratified mobile bottom dock, atomic filter staging, scroll docking quick clear, and unified collection toolbar architecture in `docs/DECISIONS.md`.',
      ],
      Fixed: [
        'Mobile Multi-Row Control Wrap: Eliminated 3-row layout overflow on narrow mobile screens (320px–390px) by compacting sort dropdowns and shortening toggle labels (`Book` and `Chrono` on <420px).',
        'Clear Button ARIA Collisions: Disambiguated clear search accessible labels (`clearAriaLabel`) across Bookmarks, Bookshelf, and Favorites to eliminate collisions with empty-state action buttons.',
        'Jarring Blind Scroll Resets: Replaced jarring `window.scrollTo(0, 0)` on collection page changes with non-disorienting `smartScrollToContent`.',
      ],
      Refactored: [
        'Collection Presentation Unification: Migrated Bookshelf, Favorites, Bookmarks, and Notebook views to the unified `CollectionToolbar` component.',
      ],
    },
  },
  {
    version: '2.5.2',
    date: '2026-09-13',
    title: 'Literary Notebook Dynamic Reflow Deep Linking, Transparent Dialogs & Smart Reading Milestones',
    sections: {
      Added: [
        'Literary Notebook "Read Passage" Deep Linking (`src/components/presentation/NotebookView.tsx`, `src/components/reader/ReaderAnnotationsDrawer.tsx`, `src/app/read/[id]/page.tsx`): Integrated URL query parameter propagation (`&annotationId=${ann.id}`), bidirectional reader session override (`initialPosition`), and targeted mark scrolling with a temporary 2.5s focus pulse ring (`ring-2 ring-primary ring-offset-2 animate-pulse`).',
        'Dynamic Font-Reflow Healing Algorithm (`src/app/read/[id]/page.tsx`): Added runtime AST page text substring scanning (`chapter.pages.findIndex(p => p.includes(ann.selectedText))`) that dynamically corrects target page coordinates whenever the user changes font size or column width between reading sessions.',
        'Smart Bookmark Completion Confirmation Modal (`src/components/presentation/BookmarksView.tsx`): Implemented status-change confirmation dialog when selecting "Finished" on any volume below 100% progress, warning the user that their reading ledger will advance to 100%, while bypassing confirmation for already-completed volumes.',
        'Single-Bookmark Deletion Confirmation Modal (`src/components/presentation/BookmarksView.tsx`): Added safety confirmation dialog protecting users against accidental bookmark deletions with volume title highlights.',
        'Transparent Modal Backdrop Architecture (`src/components/presentation/bookshelf/BookshelfManageModals.tsx`, `src/components/presentation/BookmarksView.tsx`, `src/components/presentation/NotebookView.tsx`, `src/components/reader/DeleteAnnotationModal.tsx`, `src/app/page.tsx`): Standardized collection confirmation and management modals on transparent non-dimming surfaces (`bg-transparent backdrop-blur-none`).',
        'Architecture Decision Record (`ADR-045`): Formally ratified literary notebook dynamic font-reflow deep linking, transparent dialog surfaces, and smart reading milestones in `docs/DECISIONS.md`.',
      ],
      Fixed: [
        'Bookshelf Refresh Horizontal Layout & Order Shift (`src/components/presentation/BookshelfRack.tsx`, `src/components/presentation/bookshelf/BookshelfSpine.tsx`, `src/stores/useBookshelfStore.ts`, `src/hooks/useCollectionAutoHeal.ts`): Eliminated initial render capacity jumps (29 → 18 books) on desktop by aligning initial `shelfCapacity` state calculations with `max-w-7xl` (1280px) container bounds (`calculateShelfCapacity`), decoupled outer spine flex transitions, added defensive secondary `.order(\'book_id\', { ascending: true })` tie-breakers across PostgreSQL cloud synchronization queries, and persisted auto-healing attempts in `sessionStorage`.',
        'Viewport Scroll Conflict on Note Navigation (`src/components/reader/ReaderSurface.tsx`): Guarded standard page-turn scroll-to-top with `!targetAnnotationId`, preventing automatic top scrolling from overriding smooth scroll centering on notes located below the fold.',
        'Content Route Metadata Cache Duplicate Prefix Bug (`src/app/api/books/content/metadata-cache.ts`): Fixed URL template concatenation that previously generated redundant `/books/books/` path segments during plain-text stream resolution.',
      ],
      Refactored: [
        'Client Route Suspense Boundary (`src/app/read/[id]/page.tsx`): Wrapped reader default export in `<React.Suspense fallback={<ReaderLoadingView />}>` for Next.js 16 client search params hydration compliance.',
        'In-Reader Annotation Drawer Jump Architecture (`src/components/reader/ReaderAnnotationsDrawer.tsx`): Extended `onJumpToAnnotation` signature to forward annotation IDs, closing the drawer, healing reflowed page targets, and highlighting targeted excerpts.',
      ],
    },
  },
  {
    version: '2.5.1',
    date: '2026-09-12',
    title: 'Seamless Dynamic SSR Pre-Hydration, Curated Anthology Expansion & Declarative Copyright Encapsulation',
    sections: {
      Added: [
        'Synchronized Dynamic SSR & Jurisdictional Edge Cookie Seeding (`src/app/layout.tsx`, `src/stores/useJurisdictionStore.ts`): Declared `export const dynamic = \'force-dynamic\'`, extracted edge cookie `bookarium-geo-country` via Next.js `cookies()`, and passed `initialCountry` into `<Providers>`, eliminating Frankenstein (Book #0) and Pride & Prejudice (Book #1342) pre-hydration flash-on-mount swaps.',
        '27-Masterwork & 36-Quote Curated Anthology Expansion (`src/config/featured-books.ts`, `src/config/literary-quotes.ts`, `src/components/presentation/LiteraryQuotes.tsx`): Expanded `FEATURED_HERO_BOOKS` from 10 to 27 classic masterworks and `LITERARY_QUOTES` from 12 to 36 iconic passages with verified author birth/death lifespans and territorial copyright filtering.',
        'Declarative Copyright Subsystem Encapsulation & Unified Presentation Notice (`src/hooks/useBookCopyright.ts`, `src/components/presentation/CopyrightNoticeBanner.tsx`): Introduced declarative facade hook `useBookCopyright` and unified `CopyrightNoticeBanner` component, refactoring 8 presentation components and separating legal calculations from UI layouts.',
        '100% AST-Driven Architecture Engine Upgrade (`scripts/lib/ast-parser.js`, `scripts/generate-architecture-matrix.js`): Added dynamic AST extraction for all 13 config modules, 4 type modules, Web Workers, and proxy routes with 0% drift.',
        'Dedicated Copyright & Public Domain Governance Route (`src/app/copyright/page.tsx`): Built comprehensive public domain educational portal detailing US 1930 rule, Berne Convention (Life+70), Mexico (Life+100), Colombia/Spain (Life+80), Joint Authorship (Berne Art. 7bis), and Translator Rights (Berne Art. 2(3)), with Project Gutenberg upstream compliance and DMCA Notice & Takedown channel.',
        'Statutory Functional Cookie Classification & Privacy Transparency (`src/app/privacy/page.tsx`): Codified `bookarium-geo-country` under EU ePrivacy Directive Art. 5(3) as an exempt functional cookie, and formalized 13+ digital consent thresholds under US COPPA & EU GDPR Art. 8 alongside anonymous guest reading.',
        'Digital Age Consent Self-Declaration (`src/components/auth/AuthModal.tsx`): Integrated accessible 13+ age consent self-declaration checkbox linking directly to `/privacy` and `/copyright` for account registration.',
        'Autonomous Content Advisory Subsystem (`src/lib/content-advisory.ts`, `src/components/presentation/ContentAdvisoryBanner.tsx`): Implemented domain lexical scanner evaluating Library of Congress subjects and bookshelves for mature themes and erotic literature, rendering non-blocking editorial banners across preview modals, download drawers, and reader volume info.',
        'Safe-by-Design Catalog Discovery Facets (`src/config/catalog-filters.ts`): Added dedicated "Children\'s & Juvenile Literature" filters to genre facets and hero popular topics.',
        'Architecture Decision Records (`ADR-041` to `ADR-044`): Formally ratified declarative copyright facade, synchronized dynamic SSR pre-hydration, estimated planner statistics optimization, and multi-jurisdiction copyright governance & content safety architecture in `docs/DECISIONS.md`.',
      ],
      Fixed: [
        'Pre-Hydration Book Flash & Swap (`src/components/presentation/HeroSearch.tsx`, `src/components/presentation/EditorialQuoteSection.tsx`): Aligned server snapshots with current hourly rotation index and removed static fallback logic, delivering 0.00 Cumulative Layout Shift and zero hydration mismatch warnings.',
        'Supabase PostgreSQL Statement Timeout on Large Catalogs (`src/lib/catalog/supabase-provider.ts`): Switched count mode from `exact` to `estimated` to leverage PostgreSQL planner statistics, eliminating 57014 statement timeouts and cutting search latency from >3,000ms down to ~275ms.',
        'Mobile Numeric Pagination Typing & Erase Behavior (`src/components/presentation/StickyCatalogToolbar.tsx`): Decoupled input state from current page fallback, added auto-select on focus/tap, `inputMode="numeric"`, and `aria-pressed` accessibility attributes.',
      ],
      Refactored: [
        'Presentation Layer Copyright Separation: Delegated territorial copyright checks across `BookCard`, `BookPreviewModal`, `BookmarkCard`, `BookshelfRack`, `DownloadDrawer`, `BookshelfMobileModal`, and `BookshelfSpine` to `useBookCopyright`.',
        'Smooth Scrolling on Catalog Page Size Toggle (`src/app/page.tsx`): Smoothly scrolls `#catalog-section` into view when toggling between 8 and 16 books per page.',
      ],
    },
  },
  {
    version: '2.5.0',
    date: '2026-09-11',
    title: 'Autonomous Gutenberg Catalog Ingestion, PostgreSQL GIN Search & Dual-Provider Resilience',
    sections: {
      Added: [
        'Autonomous Full-Catalog Gutenberg Ingestion (`scripts/sync-gutenberg-catalog.js`): Streamed and batch-upserted 78,086 Project Gutenberg titles into Supabase PostgreSQL (`public.books`) via a zero-dependency RFC 4180 gunzip pipeline with recursive timeout splitting.',
        'Self-Hosted PostgreSQL Catalog & GIN Search (`src/lib/catalog/supabase-provider.ts`): Implemented native database full-text search (`search_vector` tsvector) and author lifespan bounds for sub-50ms single-book lookups and ~1–2s catalog page queries.',
        'Dual-Provider Catalog Seam & Failover (`src/app/api/books/route.ts`): Unified catalog querying behind `ICatalogProvider` with primary Supabase execution, automatically degrading to Gutendex when unseeded or offline.',
        'Multi-Tier Content Streaming & Plain-Text Caching (`src/app/api/books/content/route.ts`): Sub-30ms instant book text streaming from self-hosted Supabase with multi-mirror Gutenberg fallback (`aleph.gutenberg.org`, `gutenberg.readingroo.ms`).',
        'Automated Scheduled Weekly Ingestion (`.github/workflows/catalog-sync.yml`): Sunday 02:00 UTC GitHub Actions workflow to stream new catalog additions and keep Supabase active.',
        'Architecture Decision Records (`ADR-037` to `ADR-040`): Formally ratified self-hosted catalog schema, Strangler Fig provider seam, content streaming pipeline, and autonomous periodic synchronization in `docs/DECISIONS.md`.',
        'Zero-CLS Floating Overlay Sync Badge (`src/components/presentation/BookshelfRack.tsx`): Decoupled the cloud syncing indicator from the document layout flow into an absolutely positioned floating pill (`top-0 right-2 sm:right-4 z-20 pointer-events-none`) with `AnimatePresence` and subtle fade transitions, guaranteeing 0.00 Cumulative Layout Shift during cloud synchronization.',
        'Authoritative Cloud Synchronization Anchor (`src/stores/useBookshelfStore.ts`): Introduced `lastBookshelfSyncAt` sync anchor, making Supabase the authoritative source of truth on subsequent syncs to eliminate multi-device ghost resurrections while pre-sync outbox draining (`flushOutbox`) safeguards offline additions.',
        'Architecture Decision Record (`ADR-035`): Formally ratified authoritative cloud state reconciliation, Next.js 16 edge proxy migration, and zero-CLS floating sync badge architecture in `docs/DECISIONS.md`.',
        'Authentic Bibliographic Metadata Resolution for Protected Volumes (`catalog.types.ts`, `query-parser.ts`, `supabase-provider.ts`, `gutendex-provider.ts`, `useBooks.ts`): Introduced `includeRestrictedMetadata` parameter returning factual citation data (title, author, subjects) by explicit book ID while strictly keeping full-text streaming blocked under HTTP 451.',
        'Protected Book Visual Indicators in Personal Views (`NotebookView.tsx`, `NotebookQuoteCard.tsx`, `BookmarkCard.tsx`, `ReaderErrorView.tsx`): Rendered authentic titles and authors alongside discrete `Protected (${country})` pill badges on personal notes, bookmarks, and reader error screens, completely eliminating generic "Volume #... by Classic Literature" fallbacks.',
        'Unified Multi-Collection Auto-Healing Pipeline (`useCollectionAutoHeal.ts`): Extracted decoupled hook that scans Favorites and Bookshelf collections for missing lifespans and performs a single deduplicated batch query to rehydrate author birth and death years.',
      ],
      Fixed: [
        'Non-Literary Contributor Parsing Bug (`scripts/sync-gutenberg-catalog.js`, `src/lib/copyright-engine.ts`): Excluded secondary auxiliary contributors (`[Illustrator]`, `[Photographer]`, `[Engraver]`, `[Artist]`, etc.) from the primary `authors` array so that unlisted illustrator lifespans no longer falsely trigger fail-closed copyright restrictions on public domain books (e.g. Louis Tracy\'s *The Silent Barrier* #31635).',
        'Lifespan Preservation in Bookshelf & Cloud Storage (`book.adapter.ts`, `useBookshelfStore.ts`): Losslessly encoded author lifespans in stored author strings (`"Austen, Jane, 1775-1817"`), preventing public domain works from losing author dates when saved to user collections.',
        'Upstream Content Metadata Cache Double URL Bug (`metadata-cache.ts`): Fixed URL template concatenation that previously generated redundant `/books/books/` path segments resulting in HTTP 404/503 errors on plain text streams.',
        'Catalog Latency Sequential Probing (`src/lib/catalog/supabase-provider.ts`): Added a 60-second in-memory health cache (`HEALTH_CACHE_TTL_MS = 60_000`) on `isHealthy()`, eliminating redundant `SELECT count(id)` round-trips before searches.',
        'Bookshelf Mount Layout Jitter (`src/components/presentation/BookshelfRack.tsx`, `BookshelfRack.test.tsx`): Eliminated ~58px vertical layout jump caused by conditional in-flow element insertion inside Tailwind `space-y-8` container, preserving static shelf rail coordinates throughout the sync lifecycle.',
        'Next.js 16 Edge Proxy Routing Resilience (`src/proxy.ts`, `src/lib/supabase/middleware.ts`): Wrapped session token refresh in defensive non-blocking fallback (`try...catch`), preventing `TypeError: fetch failed` route transition crashes during offline browsing or network timeouts.',
      ],
      Refactored: [
        'Supabase-First Reader SEO & Layout Resolution (`src/app/read/[id]/reader-layout-utils.ts`): Fast-path in-memory and Supabase metadata resolution for `/read/[id]`, generating rich OpenGraph and Schema.org tags in <15ms without third-party rate limits.',
        'Authoritative Cloud Synchronization & Next.js 16 Edge Proxy (`src/stores/useBookshelfStore.ts`, `src/proxy.ts`): Decommissioned legacy `src/middleware.ts` in favor of Next.js 16 native `src/proxy.ts` with 100% co-located unit test coverage.',
        'Sanitized Sign-Out & Outbox Drain (`src/stores/useAuthStore.ts`): Enhanced `signOut()` to drain pending offline mutations before logout and wipe in-memory state via `clearBookshelf()`, preventing cross-account contamination while preserving downloaded offline books in IndexedDB.',
        'Offline Download Bookshelf Linking (`src/hooks/useOfflineBooks.ts`): Linked `downloadBook()` to automatically save offline volumes to the user\'s bookshelf if not already saved.',
      ],
    },
  },
  {
    version: '2.4.0',
    date: '2026-09-09',
    title: 'Next.js 16 Route Handler Modularization, SSRF Validation & Test Architecture Optimization',
    sections: {
      Added: [
        'SSRF & Upstream URL Validation Engine (`src/app/api/books/content/url-validator.ts`): Extracted pure upstream URL validation and sanitization out of the Content API route into a modular, single-responsibility module with co-located unit test coverage (`url-validator.test.ts`).',
        'Architecture Decision Record (`ADR-034`): Formally ratified Next.js 16 App Router route handler strict typing, SSRF validation separation, and Vitest performance architecture in `docs/DECISIONS.md`.',
      ],
      Fixed: [
        'Next.js 16 Route Handler Typing Conformance (`src/app/api/books/content/route.ts`): Cleaned route exports to strictly export standard HTTP `GET`, satisfying Next.js 16 App Router route type generation (`tsc --noEmit`).',
        'Next.js 16 Native SWC Windows Binary Fallback (`package.json`, `scripts/open-browser.js`): Added `--webpack` fallback flag across dev scripts and implemented active HTTP socket healthcheck polling before browser launch, resolving `ERR_CONNECTION_REFUSED` and Windows Smart App Control native DLL blocks.',
      ],
      Refactored: [
        'Vitest Test Suite Performance Architecture (`AccountPage.test.tsx`, `HeroSearch.test.tsx`): Consolidated redundant composite page and 3D hero remount cycles into authentic user journeys, cutting `AccountPage.test.tsx` execution by 69% (11.22s to 3.46s) and `HeroSearch.test.tsx` by 81% (18.38s to 3.49s) with 100% authentic assertions and zero synthetic mocks.',
        'Zero-Latency Node Environment for Pure Algorithm Suites (`src/lib/gutenberg/*`, `password.test.ts`): Configured `// @vitest-environment node` docblock directives on pure algorithm and server test files, reducing environment bootstrap time from ~350ms to 0ms.',
      ],
    },
  },
  {
    version: '2.3.0',
    date: '2026-09-07',
    title: 'Canonical 4-Tier Reading Challenge Ladder, Anti-Tamper Progression & Accolade Visual Stabilization',
    sections: {
      Added: [
        'Canonical 4-Tier Milestone Accolades Ladder (`accolades-config.ts`, `accolades.types.ts`): Expanded the single curation accolade into a four-tier progressive compendium ladder evaluated deterministically against `completedBooksCount`: Bibliophile Novice (6 volumes, Bronze), Canonical Scholar (12 volumes, Silver), Master of the Canon (24 volumes, Gold), and The Laureate\'s Crown (52 volumes, Masterwork).',
        'Dynamic Milestone Ladder Presentation (`AccountHabitsCard.tsx`): Added an interactive 4-card milestone track to the Reading Challenge dashboard strip displaying tier badges, Latin mottos, pace indicators, and real-time status badges (Attained with checkmark, In Sight, or locked with volume targets).',
        'Architecture Decision Record (`ADR-032`): Formally ratified the canonical 4-tier challenge ladder, anti-tamper progression, and vector stroke stabilization in `docs/DECISIONS.md`.',
      ],
      Security: [
        'Supabase Function Search Path & RPC Privileges Hardening (`supabase/schema.sql`, `README.md`): Enforced immutable `SET search_path = \'\'` on `handle_new_user()` and `delete_current_user()` to eliminate search-path injection vulnerabilities. Revoked `EXECUTE` on `handle_new_user()` across all public and authenticated roles, and restricted `delete_current_user()` to authenticated sessions with active `auth.uid()` null guards.',
      ],
      Refactored: [
        'Anti-Tamper Challenge Tracking (`AccountHabitsCard.tsx`): Retired the arbitrary goal edit modal, input stepper, and "Edit Goal" button to prevent gamification exploits (e.g. setting goal = 1 to trivially trigger Masterwork accolades), calibrating progress bars directly to the active milestone target.',
        'Accolade Symbol Vector Stroke Stabilization (`ExLibrisBookplate.tsx`): Eliminated stroke thickness throbbing on earned bookplate hover by removing conflicting `group-hover:scale-105` transforms, promoting SVG icons to dedicated GPU compositor layers via `[transform:translateZ(0)]`, `[backface-visibility:hidden]`, and `[shape-rendering:geometricPrecision]`, and isolating specular sheen gradients to `z-0` behind foreground content `relative z-10`.',
      ],
    },
  },
  {
    version: '2.2.0',
    date: '2026-09-07',
    title: 'Global Encapsulation, Polymorphic Strategy Dispatching & Subsystem Architecture',
    sections: {
      Added: [
        'Single-Responsibility Notebook Quote Presenter (`NotebookQuoteCard.tsx`): Extracted full quote card presentation, inline color popover, citation copy feedback, and draft reflection editing with render-time state adjustment out of `NotebookView.tsx`, reducing file length by 302 lines with co-located unit test coverage (`NotebookQuoteCard.test.tsx`).',
        'Unified Delete Annotation Modal (`DeleteAnnotationModal.tsx`): Replaced triplicated delete confirmation modals across `ReaderAnnotationsDrawer`, `NotebookView`, and `read/[id]/page.tsx` with a shared dialog composing `@/components/ui/Modal` and `QuoteDeletePreview`.',
        'Notable Passages Book Spread Component (`NotablePassagesSpread.tsx`): Extracted dual-face quote spread out of `BookPreviewModal.tsx`, reducing modal length by 104 lines while ensuring 100% layout and quote stack parity across stationary base and 3D flipping leaf.',
        'Computational Reader Annotation Partitioning Engine (`reader-annotator.ts`): Extracted pure computational string search and collision-free interval partition algorithm out of `ReaderSurface.tsx` into `computeAnnotationSpans()`, fully covered by unit tests (`reader-annotator.test.ts`).',
        'Architecture Decision Record (`ADR-031`): Formally ratified global encapsulation, polymorphic strategy dispatching, and layout DRY refactoring in `docs/DECISIONS.md`.',
      ],
      Refactored: [
        'Polymorphic Outbox Dispatcher in Annotation Store (`useAnnotationStore.ts`): Replaced procedural switch ladder in `flushOutbox` with declarative `ANNOTATION_OUTBOX_DISPATCHERS` strategy map matching the pattern in `useBookshelfStore.ts`.',
        'Declarative Reader Theme Cycling & Tokens (`reader-themes.ts`): Implemented `NEXT_READER_THEME` transition cycle map and added `speechHighlight` token to `ReaderThemeConfig`, eliminating repeated ternary cascades across desktop/mobile headers and `ReaderSurface.tsx`.',
        'Unified Action Matrices in Reader Header (`ReaderHeader.tsx`): Consolidated desktop and mobile navigation buttons into declarative `ReaderHeaderToolAction[]` configuration, eliminating ~150 lines of duplicate JSX while preserving all accessibility roles and test attributes.',
        'Facade Prop in Reader Speech Bar (`ReaderSpeechBar.tsx`): Added `speech?: UseReaderSpeechReturn` facade prop, reducing 16 individual prop bindings down to a single prop in `read/[id]/page.tsx` with backward-compatible unit test support.',
        'Navigation & Hydration Encapsulation (`useReaderSession.ts`): Integrated `jumpTo(chapterIndex, page)` and internalized hydration detection with `useHasMounted()`, simplifying search jump handlers in reader view.',
        'Polymorphic Dialog Composition (`Modal.tsx`, `GutenbergInfoModal.tsx`, `BookshelfManageModals.tsx`): Standardized `GutenbergInfoModal` and all 4 bookshelf management dialogs to compose UI primitive `@/components/ui/Modal`.',
        'Account Page Spatial Rhythm & Contrast Harmonization (`AccountSecuritySection.tsx`, `page.tsx`): Enhanced vertical separation between Security & Password, Account Session, and Danger Zone cards with comfortable gap spacing and high-contrast solid borders across Sepia and Dark modes.',
      ],
    },
  },
  {
    version: '2.1.0',
    date: '2026-09-07',
    title: 'Deterministic Literary Accolades & Tactile Ex-Libris Bookplates (Milestone 4, Point 1)',
    sections: {
      Added: [
        'Deterministic Literary Accolades Engine (`accolades-engine.ts`, `accolades-config.ts`): Pure evaluation algorithms calculating literary honors across 5 categories (Streaks, Immersion, Exploration, Scholarship, Curation) and 4 tiers (Parchment Bronze, Specular Silver, Gilded Gold, Obsidian Masterwork) with authentic Latin mottos.',
        'Historical Era Detection & Classical Antiquity Exploration (`accolades-engine.ts`): Mathematical mapper evaluating author birth/death years and Gutenberg subjects to classify works into Antiquity, Middle Ages, Renaissance, Enlightenment, Victorian, and Early 20th Century eras.',
        'Local-First Accolades Store with Cloud Sync (`useAccoladesStore.ts`): Zustand persistent store managing unlocked accolades, celebration queues, personal showcase pinning (max 3 bookplates), and bi-directional Supabase synchronization merging records idempotently into `public.user_accolades`.',
        'Tactile Ex-Libris Bookplate Cards (`ExLibrisBookplate.tsx`): Classical woodcut-bordered bookplates with desktop 3D perspective tilt and specular sheen gradient tracking mouse position, and mobile spring physics tap interactions.',
        'Wax-Seal Accolade Celebration Modal (`AccoladeCelebrationModal.tsx`): Accessible celebratory modal dialog displaying bestowed bookplates with animated wax-seal stamps, classical typography, escape key dismissal, and mobile haptic vibration feedback (`navigator.vibrate`).',
        'Account Accolades Compendium & Showcase Card (`AccountAccoladesCard.tsx`): Interactive Account dashboard card featuring a 3-plate personal showcase, category filter tabs, live unlocked counter, and compendium grid.',
        'Idempotent Database Schema & RLS Co-Evolution (`supabase/schema.sql`, `database.types.ts`): Provisioned `public.user_accolades` table with unique constraint on `(user_id, accolade_id)` and granular authenticated user isolation policies (`auth.uid() = user_id`).',
        'Architecture Decision Record (`ADR-030`): Formally ratified deterministic literary accolades, tactile ex-libris bookplates, and showcase architecture in `docs/DECISIONS.md`.',
      ],
    },
  },
  {
    version: '2.0.0',
    date: '2026-09-07',
    title: 'Reading Habit Telemetry, Annual Challenges & Reading Analytics (Milestone 3 Completion)',
    sections: {
      Added: [
        'Reading Streaks & Habit Telemetry Engine (`reading-analytics.ts`, `useHabitsStore.ts`): Pure mathematical consecutive streak calculations with 1-day grace period, longest streak tracking, 7-day visual week activity indicators, and total literary immersion duration tracking.',
        'Dual Immersion Telemetry & Background Audio Narration (`useReadingTimer.ts`, `useHabitsStore.ts`): Disentangled literary immersion into reading time (`totalReadingSeconds`) and listening time (`totalListeningSeconds`). Added background tab and idle bypass exception for active Text-to-Speech narration (`isPlayingTTS`), preserving immersion seconds when listening with the browser in the background.',
        '5-Minute Active Streak Threshold Standard (`useHabitsStore.ts`, `AccountHabitsCard.tsx`): Elevated daily streak qualification from 1 second to 5 minutes (`300s`) of combined active immersion, eliminating false streaks from accidental page opens and providing dynamic progress prompts (`Xm / 5m logged today`).',
        'Annual Reading Challenge & Progress Tracking (`AccountHabitsCard.tsx`, `reading-analytics.ts`): Interactive annual volume challenge with customizable goal targets, real-time pace indicators (on pace, ahead, behind), and smooth progress bar updates.',
        'Idle-Aware Reading Session Telemetry (`useReadingTimer.ts`): Unobtrusive reading session timer in `/read/[id]` with a 2-minute inactivity guard, pausing on reader idle and flushing on page visibility transitions (`visibilitychange`).',
        'Multi-Device Cloud Habit Sync & LWW Reconciliation (`sync-utils.ts`, `providers.tsx`): Synchronizes habit state with Supabase `public.user_reading_habits` using Last-Write-Wins (LWW) conflict resolution via `goalUpdatedAt` timestamps and a 15-second debounced visibilitychange sync trigger.',
        'Idempotent Reading Habits Database Schema (`supabase/schema.sql`, `database.types.ts`): Added `public.user_reading_habits` table with `total_listening_seconds` column, strict Row Level Security (RLS) policies, and automatic trigger execution for new users.',
        'Architecture Decision Record (`ADR-027`): Formally ratified reading habit telemetry, annual goals, and extensible accolade architecture in `docs/DECISIONS.md`.',
        'Architecture Decision Record (`ADR-028`): Formally ratified analytical table of contents deduplication and cross-reference protection invariants in `docs/DECISIONS.md`.',
        'Architecture Decision Record (`ADR-029`): Formally ratified dual immersion telemetry (reading vs. listening) and 5-minute active streak threshold in `docs/DECISIONS.md`.',
      ],
      Fixed: [
        'Reading Telemetry Background Audio Retention (`useReadingTimer.ts`): Resolved issue where switching tabs during Text-to-Speech playback paused telemetry, ensuring uninterrupted listening time accumulation.',
        'Analytical Table of Contents Deduplication (`segmentation.ts`, `types.ts`): Resolved double-chapter parsing on 19th-century descriptive TOCs (e.g. Austin Bidwell\'s `read/24739`) by recognizing multi-line chapter synopses within the front-matter TOC window (`TOC_SEARCH_WINDOW_BYTES: 45000`) and suppressing them when full-length narrative chapters exist later, while preserving strict immunity for in-body chapter cross-references.',
        'Border Harmonization across Themes (`AccountHabitsCard.tsx`, `AdvancedFilterDrawer.tsx`): Harmonized all fractional border tokens (`border-border/60`, `border-border/50`, `border-primary/20`) to standard `border-border` and canonical surfaces, resolving vanishing border lines in Sepia and Dark Obsidian modes.',
        'Catalog View Mode Toggle Scroll Coordinate (`src/app/page.tsx`): Implemented smooth scroll into view on `#catalog-section` when switching between Cards (`grid`) and Bookshelves (`shelf`) display modes, matching the behavior of catalog pagination.',
        'React Hooks Purity & ESLint 9 Hygiene (`useReadingTimer.ts`, `AccountHabitsCard.tsx`, `useHabitsStore.ts`): Resolved render-time impurity in `useReadingTimer` by initializing interaction refs to 0 and stabilizing effect cleanup, escaped JSX HTML entities in `AccountHabitsCard`, and pruned unused type imports across `views.config.ts` and `ReaderSurface.tsx`.',
      ],
    },
  },
  {
    version: '1.9.9',
    date: '2026-09-06',
    title: 'Enterprise Polymorphism, Encapsulation & Code Redundancy Elimination',
    sections: {
      Added: [
        'Domain Cloud Row Adapters & Normalized Inserts (`book.adapter.ts`): Bidirectional transformation between Supabase PostgreSQL schema rows and GutendexBook domain models (`toGutendexBookFromCloudRow`), with type overloads ensuring compatibility with `RejectExcessProperties` in Supabase inserts (`toCloudBookInsert`).',
        'Declarative View Configuration & Main View Strategy (`views.config.ts`): Unified application views (`NAV_ITEMS`, `NAVBAR_VIEW_CONFIG`) and content metadata (`VIEW_CONTENT_CONFIG`), eliminating 12+ nested ternaries across view headers, search placeholders, and collection empty states.',
        'Canonical Annotation Token Registry (`annotation-tokens.ts`): Centralized single source of truth for annotation colors (`yellow`, `amber`, `mint`, `rose`), surface highlight classes, dot/border styling, and filter badges across Reader Surface, Drawers, Popovers, and Notebooks.',
        'Polymorphic Email Confirmation Presenter (`EmailSentView.tsx`): Extracted repeated authentication email confirmation cards (sign-up, magic link, password reset) into a unified presenter component with full cooldown and resend action bindings.',
        'Cloud Sync Orchestration Engine (`sync-utils.ts`): Isolated parallel store synchronization (`syncAllStoresWithCloud`) coordinating Bookshelf, Annotation, and Reader stores via `Promise.allSettled` on auth transitions and network reconnection.',
        'Shared API Route Utilities & Standalone Domain LRU Cache (`api-utils.ts`, `cache.ts`): Deduplicated client IP resolution (`getClientIp`) and HTTP 429 rate limit responses (`createRateLimitErrorResponse`), and extracted generic `SimpleLRUCache<K, V>` into a standalone module with backward-compatible re-exports.',
        'Reader SSR Hydration & Active Reading Count Hooks (`useReaderStore.ts`): Introduced `useHydratedReader()` to encapsulate reader store SSR hydration, and canonicalized `getActiveReadingCount(state)` as the unified selector across Navbar and Account statistics.',
        'Architecture Decision Record (`ADR-026`): Formally ratified enterprise polymorphism, encapsulation, and code redundancy elimination in `docs/DECISIONS.md`.',
      ],
      Refactored: [
        'Polymorphic Outbox Command Dispatcher (`useBookshelfStore.ts`): Replaced 40-line `if-else` ladder in `flushOutbox` with a polymorphic command dispatcher dictionary `OUTBOX_DISPATCHERS`.',
        'Data-Driven Navigation Architecture (`Navbar.tsx`): Migrated hardcoded static `<button>` elements to declarative `NAV_ITEMS.map(...)` iteration with dynamic active styling, responsive badges, and canonical reading count.',
        'Main View Nested Ternary Elimination (`src/app/page.tsx`): Streamlined `SectionHeader`, `CollectionSearchBar`, and `BookGrid` empty states by querying `VIEW_CONTENT_CONFIG` strategy mappings.',
        'Annotation Palette Deduplication (`ReaderSurface.tsx`, `ReaderAnnotationsDrawer.tsx`, `TextHighlightPopover.tsx`, `NotebookView.tsx`): Replaced 6 duplicate local color dictionaries with derived tokens from `ANNOTATION_COLOR_CONFIG`.',
        'Auth Modal Header & Action Label Declarative Mapping (`AuthModal.tsx`): Replaced view switching ternaries with `AUTH_VIEW_CONFIG` and unified confirmation markup with `<EmailSentView />`.',
        'DOM Blob Download Encapsulation (`utils.ts`, `library-backup.ts`): Deduplicated imperative anchor creation and object URL lifecycle management across JSON and CSV exports via `triggerBlobDownload(blob, filename)`.',
        'API Proxy Rate Limiter Deduplication (`api/books/route.ts`, `api/books/content/route.ts`): Replaced duplicated proxy IP parsing and HTTP 429 response formatting with `api-utils.ts`.',
        'Reading Count Unification (`Navbar.tsx`, `account/page.tsx`): Replaced duplicate manual set aggregations and loops with canonical `useReaderStore(getActiveReadingCount)`.',
      ],
      Fixed: [
        'Reader SSR Hydration Parity (`src/app/read/[id]/page.tsx`): Guarded all 10 reader settings against SSR hydration mismatches through unified `useHydratedReader()` hook.',
      ],
    },
  },
  {
    version: '1.9.8',
    date: '2026-09-06',
    title: 'Completed Reading State Latch, Native Inset Search Architecture & Library Navigation Streamlining',
    sections: {
      Added: [
        'Completed Reading Progress Latch & "Read Again" Flow (`useReaderSession.ts`, `BookmarkCard.tsx`): Guarded 100% completed status and progress coordinates when resuming finished books from bookmarks or the catalog. Added a dedicated "Read Again" button on completed volumes allowing readers to restart from Page 1 without prematurely destroying their ledger completion status.',
        'Classic of the Day Editorial Showcase (`EditorialQuoteSection.tsx`): Dedicated curated literary quote section under the Catalog search bar, featuring deterministic hourly rotation with anti-collision filtering to ensure candidate books never duplicate the active Hero volume.',
        'Native `<input>` Architecture for Catalog Hero Search (`HeroSearch.tsx`): Refactored the Catalog search bar to a native `<input>`-centric structure with inset floating submit and clear buttons, matching `CollectionSearchBar.tsx` and unlocking authentic 150ms outward focus ring bloom and `hover:border-primary/40` state.',
        'Architecture Decision Record (`ADR-025`): Formally ratified the completed reading state latch, "Read Again" flow, native inset search architecture, and library navigation streamlining in `docs/DECISIONS.md`.',
      ],
      Fixed: [
        'Reading Status Latch in Bookmarks Ledger (`useContinueReadingLedger.ts`): Resolved issue where resuming a completed volume erroneously reset the reading status badge to "In Progress" in the Bookmarks ledger.',
        'Notes & Highlights Modal Content Overflow: Fixed height constraints and scrolling containers to prevent notes and annotation highlights from overflowing modal boundaries on mobile and desktop viewports.',
        'Search Box Focus Harmonization across All Views (`CollectionSearchBar.tsx`, `ReaderSearchDrawer.tsx`, `HeroSearch.tsx`): Harmonized all search boxes across Bookshelf, Favorites, Bookmarks, Reader Search Drawer, and Catalog Hero to use unified `focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary` and `hover:border-primary/40` styling.',
        'Reading Surface Typography Harmonization (`ReaderSurface.tsx`): Removed hardcoded `font-serif` overrides on frontispiece title `<h1>`, author `<p>`, chapter headings `<h2>`, and bilingual comparison lines, allowing the entire reading canvas to dynamically adapt to the reader\'s chosen font family (Serif, Sans, or Mono).',
        'Literary Quote Card Divider Harmonization (`LiteraryQuotes.tsx`): Harmonized the divider line above "Read Full Volume" to use the standard theme-aware `border-border` token, resolving broken styling and ensuring visual consistency with the author divider across Light, Dark, and Sepia modes.',
        'Archival Editions Language Badge Styling (`ReaderLanguageDrawer.tsx`): Replaced unsupported bare `primary/40` and `primary/20` classes with supported numbered tokens (`primary-500/30`, `primary-500/15`), restoring the intended soft translucent badge and subtle border across Light, Dark, and Sepia modes.',
        'Reading Status Selector Button Borders (`ReadingStatusSelector.tsx`): Harmonized the active "Currently Reading" button to `border-primary-500/40` and `bg-primary-500/15` matching its sibling status pills, and reset inactive buttons and clear controls to standard theme-aware `border-border`.',
        'Design Token Opacity Hygiene (`HeroFeaturedBook3D.tsx`, `NotebookView.tsx`, `Navbar.tsx`, `AccountRestoreModal.tsx`): Normalized unsupported bare variable slash-modifiers (`border-border/80`, `border-border/60`, `border-border/50`, `border-border/40`) to canonical `border-border`, eliminating silent CSS drop-outs and ensuring consistent border rendering across themes.',
        'Badge Component Color Palette Alignment (`Badge.tsx`): Updated `primary` and `success` badge variants to use concrete numbered palette tokens (`primary-500/15`, `primary-500/30`, `emerald-500/10`, `emerald-500/30`), restoring soft translucent backgrounds and tinted borders.',
        'Quote Delete Preview Deduplication (`QuoteDeletePreview.tsx`, `ReaderAnnotationsDrawer.tsx`, `src/app/read/[id]/page.tsx`): Extracted identical quote deletion confirmation markup into a reusable, co-located presenter component with full test coverage.',
        'Vitest Test Suite Granularization (`page.test.tsx`, `AccountPreferencesSection.test.tsx`, `useBookshelfStore.test.ts`, `ReaderHeader.test.tsx`, `ReaderSurface.test.tsx`, `ReaderSpeechBar.test.tsx`, `AccountIdentityCard.test.tsx`): Decomposed 7 compound and monolithic test cases into 21 focused, single-responsibility tests, eliminating artificial rerender flips and providing isolated regression tracking across reader navigation, audio synthesis, text selection, and cloud shelf state.',
      ],
      Removed: [
        'Redundant Header Link (`AccountLibraryStats.tsx`): Pruned "Open Bookshelf →" text link from the Library stats card header, consolidating library navigation strictly into the tactile card buttons below.',
      ],
    },
  },
  {
    version: '1.9.7',
    date: '2026-09-05',
    title: 'Gutenberg Heading Semantic Normalization, Phantom Chapter Elimination & Reading Coordinate Harmonization',
    sections: {
      Added: [
        'Semantic Gutenberg Heading Normalization (`segmentation.ts`): Replaced brittle fixed-length string slicing with canonical keyword and numeral extraction (`normalizeHeadingId`), matching single-digit and multi-digit chapter identifiers consistently across front-matter TOCs and body text.',
        'Multi-Pattern TOC Subtitle & Body Subtitle Harvesting (`segmentation.ts`): Added Roman/Arabic numeral TOC extraction (`I. THE HIRED CAR 1`) and standalone body subtitle heuristics for books without front-matter TOCs or completing wrapped entries (`read/31472`), formatting Roman numerals strictly uppercase in reader navigation.',
        'AST-Driven Gutenberg Parser Living Reference (`docs/GUTENBERG_PARSER.md`): Implemented `scripts/generate-parser-docs.js` using Babel AST traversal to compile parser configurations, API contracts, and regex heuristics directly from TypeScript AST, wired into `npm run docs:sync` and Pass 4 of `npm run verify`.',
        'Server-Side Fetch Deduplication & Timeout Hardening (`src/app/read/[id]/layout.tsx`): Wrapped reader layout metadata fetching with React `cache()` and an `AbortSignal.timeout(2500)` guard, collapsing redundant server requests into a single call and preventing slow upstream API queries from blocking page transitions.',
        'Dynamic AST-Driven Architecture Engine (Governance Rule 2): Implemented `scripts/lib/ast-parser.js` using Babel AST traversal, mathematical DFS cycle detection, and automated discovery of all 57 components, 6 stores, and 17 hooks, eliminating static table hardcoding in `docs/ARCHITECTURE.md`.',
        'Architecture Decision Records (`ADR-017` through `ADR-023`): Formally ratified Gutenberg heading normalization, Web Speech narration, Commonplace Notebook, IndexedDB offline engine, Clean Path edge rewrites, API proxy security, and library backup engine in `docs/DECISIONS.md`.',
      ],
      Fixed: [
        'Gutenberg Phantom Chapter Leakage (`segmentation.ts`): Resolved bug where single-digit chapters in front-matter TOC clusters (Chapters 1–9) failed duplicate detection due to trailing space mismatches in naive `slice(0, 10)`, eliminating 9 empty ghost chapters on Jules Verne\'s *A Journey to the Centre of the Earth* (`read/18857`) and similar books.',
        'Reading Coordinates Off-by-One Discrepancy (`BookmarkCard.tsx`): Aligned reading coordinates to display the global book page number (`globalPage`) instead of chapter-local page (`chapterPage`), and eliminated false `chapterIndex + 1` addition so bookmarks and reader footer (`ReaderFooter.tsx`) display identical coordinates.',
        'Session Resume Notice Coordinate Sync (`useReaderSession.ts`): Updated reader resume notice ribbon to display `savedGlobalPage` and correct chapter number upon session restoration, eliminating coordinate divergence between bookmarks, notification ribbons, and reader footers.',
      ],
    },
  },
  {
    version: '1.9.6',
    date: '2026-09-05',
    title: 'Technical SEO Architecture, Dynamic OpenGraph Previews, Windowed Sub-Pagination & Upstream Rate-Shielding',
    sections: {
      Added: [
        'Technical SEO & Crawl Protection (`src/app/robots.ts`): Native Next.js 16 crawl directives disallowing search query parameters (`/*?*search=*`, `/*?*topic=*`, `/*?*languages=*`) and private routes, protecting Project Gutenberg and Gutendex upstream servers from bot query exhaustion.',
        'Curated Masterworks Canonical Sitemap (`src/app/sitemap.ts`): High-performance static XML sitemap indexing core routes and 10 iconic public domain masterworks with zero build-time API timeouts.',
        'Dynamic Social OpenGraph & Twitter Cards (`src/app/read/[id]/layout.tsx`): Server Component layout dynamically resolving book identity and cover artwork with 24-hour Next.js ISR edge caching (`revalidate: 86400`).',
        'Safe Structured Data (JSON-LD): Injected `schema.org/WebSite` (with Sitelinks SearchAction), universal `schema.org/WebApplication` (`isAccessibleForFree: true`), and `schema.org/Book` using native React 19 text nodes with zero `dangerouslySetInnerHTML`.',
        'Windowed Chunk Sub-Pagination & Predictive Prefetching: Viewport-optimized sub-pagination (8 books/page mobile, 16 desktop) with predictive background prefetching triggered on Sub-page 3 for instant 0ms transitions.',
        'Privacy-First Web Telemetry: Integrated `@vercel/analytics` and `@vercel/speed-insights` for anonymous aggregate performance telemetry with zero tracking cookies or personal data collection.',
        'Open Design & AI Co-Engineering Attributions: Added compliant footer credits for Booksaw Bookstore UI template (CC BY 4.0) and Google Antigravity.',
        'Architecture Decision Records (`ADR-015`, `ADR-016`): Formally ratified privacy telemetry and technical SEO rate-shielding in `docs/DECISIONS.md`.',
        'Co-Located Test Suite Hardening: Added co-located unit and integration tests for all layouts, sitemaps, and robots (`robots.test.ts`, `sitemap.test.ts`, `read/[id]/layout.test.tsx`, `privacy/layout.test.tsx`, `account/layout.test.tsx`, `layout.test.tsx`), reaching 125 suites and 957 verified tests.',
      ],
      Fixed: [
        'Keystroke Query Flooding: Replaced 300ms keystroke debouncing on catalog search with explicit form submission and a 2-character minimum guardrail, eliminating redundant API load.',
        'Mobile Prefetch Timing Gaps: Widened prefetch buffer on mobile to initiate on Sub-page 3, providing 15-25s lead time before batch boundaries.',
      ],
    },
  },
  {
    version: '1.9.5',
    date: '2026-09-04',
    title: 'Multi-Device Deletion Tombstones, Cloud Reading Progress Synchronization & Persistent Worker Architecture',
    sections: {
      Added: [
        'Multi-Device Deletion Tombstones (`useBookshelfStore.ts`): Integrated `deletedBookIds` tombstone tracking to prevent deleted bookshelf volumes from being resurrected as ghost items during cross-device Supabase cloud reconciliation.',
        'Cross-Device Cloud Reading Progress Sync (`useReaderStore.ts`, `useReaderSession.ts`): 2000ms debounced upsert to Supabase `public.reading_progress` table with automatic reading coordinate restoration when resuming sessions on new devices, strictly gated for authenticated accounts with 0ms/zero-network guest mode.',
        'Persistent Gutenberg Parser Worker (`useGutenbergParserWorker.ts`): Maintained a single long-lived Web Worker instance across typography, font scaling, and line spacing adjustments, eliminating worker churn and UI thread freezes with non-blocking async fallback.',
        'Selection-Safe Touch Gestures (`useReaderGestures.ts`): Suppressed horizontal swipe navigation when active DOM text selection exists or touch starts inside an active modal/popover, preventing accidental page turns during passage highlighting.',
        'Content Fetch Timeout & Failover (`useBookContent.ts`): Added an 8000ms client-side `AbortSignal.timeout` to gracefully trigger Gutenberg mirror failover during slow or stalled upstream connections.',
        'Architecture Decision Record (`ADR-014`): Formally ratified Deletion Tombstones, Cloud Reading Progress Synchronization & Persistent Worker Architecture in `docs/DECISIONS.md`.',
        'Co-Located Test Suite Hardening: Expanded unit and integration test coverage across all 120 test suites and 906 tests, maintaining 100% pass rate and 92.14% line coverage.',
      ],
      Fixed: [
        'Ghost Volume Resurrection: Resolved issue where deleting a book on one client could be overwritten and resurrected upon syncing with cloud storage.',
        'Swipe Gesture Collisions with Text Selection: Resolved conflicts where attempting to drag selection handles on mobile readers triggered page flips.',
        'Knip Dead Code Hygiene: Cleaned up unused exports across presentation and mock layers, ensuring full Pass 6 compliance with zero errors.',
      ],
    },
  },
  {
    version: '1.9.4',
    date: '2026-09-04',
    title: 'Bookmarks & Continue Reading Ledger, Unified SectionHeader Component & Hardened Pre-Commit Hook',
    sections: {
      Added: [
        'Bookmarks & Continue Reading Ledger (`/?view=bookmarks`): Dedicated reading ledger with tactile bookmark cards, bookmark ribbon accents, live progress percentages, last-read coordinates, status filter tabs (All, In Progress, Completed, On Hold), real-time search (`CollectionSearchBar`), "Clear Bookmarks" accessible confirmation modal, and 1-click chapter resume.',
        'Authentic Reading Telemetry & Unopened Volume Exclusion: Refined `useContinueReadingLedger` to strictly enroll books with active reading coordinates (`readingPositions`) or progress (`readingProgress > 0`), eliminating contradictory "Never opened" cards on bookmarks and decoupling ledger resets from user curation.',
        'Two-Way Metadata Synchronization & Warm Reader Handoff: Active query hydration in `useContinueReadingLedger` resolves missing book metadata via TanStack Query without displaying generic Gutenberg fallbacks; `/read/[id]` immediately persists resolved book identity to `recentBooks` on load and primes reader state upon resume.',
        'DRY Parser & Adapter Normalization: Unified author reversed-name parsing, lifespan stripping (`formatAuthorNames`), title prefix cleaning (`cleanBookTitle`), and relative time calculation (`formatRelativeTime`) into canonical `@/lib/utils` and `book.adapter.ts`.',
        'Unified SectionHeader & Editorial Typography Harmonization (`SectionHeader.tsx`): Reusable `<SectionHeader>` and `<SectionTitle>` component standardizing subtle decorative flank border lines (`h-[1px] w-12 bg-border`), refined typography scale (`text-3xl sm:text-4xl`), and action slots across Catalog, Bookshelf, Favorites, Bookmarks, and Literary Notebook views.',
        'Tactile Booksaw Page-Turn Transitions: Integrated hardware-accelerated `animate-page-turn` transitions on view transitions and filter tab switching in the Bookmarks ledger.',
        'Canonical Domain Book Entity & Adapter (`toCanonicalBook`): Provider-agnostic Book and ActiveReadingVolume domain entities in `src/types/book.types.ts` and `src/lib/adapters/book.adapter.ts` for clean architectural decoupling.',
        'Headless Reading Ledger Hook (`useContinueReadingLedger.ts`): Aggregates reading progress, bookmarks, and statuses across stores with client-side multi-field search filtering, status filtering, and recency sorting.',
        'Navigation & Route Integration: Added Bookmarks tab to Navbar with BookMarked icon, active styling in `library-tokens.ts`, and BOOKMARKS route target in `routes.ts`.',
        'Co-Located Test Suite Expansion: Added new test suites (120 suites / 896 tests total) with 100% pass rate and >= 92% coverage.',
      ],
      Fixed: [
        'Pre-Commit Hook Hardening (`.husky/pre-commit`): Eliminated child git process lock collisions on Windows NTFS by running the 7-Gateway Quality Engine via pure Node.js.',
        'Generic Gutenberg Fallbacks (e.g. Volume #55179): Resolved placeholder title and author display by dynamically querying Gutendex and persisting metadata across client reading sessions.',
        'Un-Opened Books Appearing on Bookmarks: Fixed ledger volume calculation so unread bookshelf books never pollute the continue reading flow with "Never opened" tags.',
      ],
    },
  },
  {
    version: '1.9.3',
    date: '2026-09-04',
    title: 'Personal Curation (Ratings & Statuses), Mobile Action Sheet & Live Static Analysis Telemetry',
    sections: {
      Added: [
        'Personal 1-5 Star Book Ratings (`StarRating.tsx`): Tactile star rating widget with hover preview, clear toggle, and zero layout shift.',
        'Reading Status Management (`ReadingStatusSelector.tsx`): 3-tier reading status selector (Want to Read, Currently Reading, Finished) with active visual states.',
        'Viewport-Level Mobile Modal (`BookshelfMobileModal.tsx`): Touch-optimized action sheet for mobile and vertical displays (< 1024px) enabling full rating and shelf curation on Favorites and Bookshelf.',
        'Live Static Analysis Telemetry (`scripts/generate-quality-report.js`): Automated execution and telemetry recording of ESLint 9 and Knip dead code audits directly in `QUALITY_AUDIT_REPORT.md` and `quality-audit-results.json`.',
        'Co-Located Test Suite Expansion: Expanded unit test coverage across 112 suites and 819 tests, achieving 92.05% line coverage.',
      ],
      Fixed: [
        'Knip Duplicate Export Resolution (`BookshelfMobileModal.tsx`): Removed redundant alias exports (`BookMobileModal`), ensuring clean Pass 6 audit compliance with 0 errors.',
        'Outside-Click Dismissal & Event Isolation (`BookPreviewModal.tsx`): Enabled whitespace dismissal while strictly isolating interactive curation controls.',
      ],
    },
  },
  {
    version: '1.9.2',
    date: '2026-09-04',
    title: 'Library Portability Engine, JSON Backup/Restore, CSV Catalog Export & Pre-Commit Sync',
    sections: {
      Added: [
        'Pure Domain Library Portability Engine (`src/lib/library-backup.ts`): Single-click portable JSON backup and RFC 4180 compliant CSV spreadsheet catalog export capturing volumes, shelves, bookmarks, and literary annotations.',
        'Defensive Backup Schema Validation (`validateLibraryBackup`): Strict JSON structure, application name, and array integrity checks preventing corrupted or malformed payload injection.',
        'Dual-Strategy Library Restore (`restoreLibraryBackup`): Non-destructive "Merge with Existing Library" preserving current collections and "Replace Entire Library" for clean snapshot restores, with automatic cloud sync for authenticated readers.',
        'Account Portability & Backup Interface (`AccountPreferencesSection.tsx`, `AccountRestoreModal.tsx`): Dedicated dashboard controls for JSON/CSV exports and accessible restore modal with live preview badges and destructive action safeguards.',
        'Co-Located Test Suite Expansion: Added unit test coverage across `library-backup.test.ts` and `AccountRestoreModal.test.tsx`, reaching 110 suites and 784 verified tests.',
      ],
      Fixed: [
        'Pre-Commit Auto-Staging (`.husky/pre-commit`): Included `README.md` and `ROADMAP.md` in automated staging list, guaranteeing 0% unstaged drift after quality engine passes.',
      ],
    },
  },
  {
    version: '1.9.1',
    date: '2026-09-04',
    title: 'Centralized Library Design Tokens, Reader Dynamic Language Indicators & Account Border Polish',
    sections: {
      Added: [
        'Centralized Library Design Tokens (`src/config/library-tokens.ts`): Single source of truth for library category colorways (`LIBRARY_THEMES`), synchronizing active borders, focus rings, and filled SVG icons across navbar tabs and account metric cards.',
        'Reader Language Editions & Translation Indicators (`src/components/reader/ReaderHeader.tsx`, `read/[id]/page.tsx`): Header translation trigger displays active book language code and available historical editions badge.',
        'Co-Located Test Suite Expansion: Added unit tests for library tokens and expanded test coverage across `AccountLibraryStats.test.tsx` and `ReaderHeader.test.tsx`, achieving 108 suites and 760 passing tests.',
      ],
      Fixed: [
        'Account Library Statistics Hover Border Contrast (`src/components/account/AccountLibraryStats.tsx`): Resolved Tailwind v3 CSS variable opacity stripping on custom properties (`hover:border-primary/50` -> `hover:border-primary`, `hover:border-destructive`), guaranteeing distinct, visible 1px card borders on hover and keyboard focus across Light, Dark, and Sepia themes.',
      ],
    },
  },
  {
    version: '1.9.0',
    date: '2026-09-03',
    title: 'Literary Notebook, Text Highlighting & Annotations Engine, and PWA Standalone Mode',
    sections: {
      Added: [
        'Progressive Web App (PWA) Standalone Mode (`src/app/manifest.ts`, `src/app/layout.tsx`, `public/icons/`): Configured Next.js 16 web app manifest, mobile viewport, apple-touch-icon, and a suite of maskable/standard icons for home screen installation.',
        'Native Service Worker Offline App Shell (`public/sw.js`, `ServiceWorkerRegister.tsx`): Built App Shell caching and offline navigation fallback enabling unabridged reading of saved IndexedDB books in airplane mode.',
        'Text Highlighting & Annotations Engine (`public.user_annotations`, `src/stores/useAnnotationStore.ts`): Built local-first persistence with Supabase PostgreSQL cloud sync, Row-Level Security, offline mutation outbox, and automatic guest-to-cloud merge upon login.',
        'Cloud Sync Deletion Tombstones & Quota Safety (`useAnnotationStore.ts`): Implemented persistent deletion tombstones eliminating cross-device zombie note resurrection, and store-level character clamping protecting localStorage quotas.',
        'Contextual Text Highlight Popover (`src/components/reader/TextHighlightPopover.tsx`, `ReaderSurface.tsx`): Real-time text selection popover supporting 4 pastel highlight colors (Yellow, Amber, Mint, Rose), coarse-pointer context menu clearance, touchstart dismissal, and inline reflection editor.',
        'Single Note/Quote Deletion Confirmation Modals (`NotebookView.tsx`, `ReaderAnnotationsDrawer.tsx`, `read/[id]/page.tsx`): Guarded against accidental loss of quotes and marginalia reflections with accessible confirmation modals featuring formatted quote excerpt previews.',
        'Highlight-Specific Selection Styling (`globals.css`, `ReaderSurface.tsx`): Color-matched `::selection` styling for Canary Yellow, Vintage Amber, Calm Mint, and Soft Rose across Light, Dark, and Sepia themes, eliminating default browser/theme selection background clashing.',
        'Bilingual Mode Annotation Integration (`ReaderSurface.tsx`): Enabled full highlight rendering and marginalia interaction inside Bilingual Parallel reading mode segments.',
        'Slide-Out Annotations Drawer (`src/components/reader/ReaderAnnotationsDrawer.tsx`): Focus reader drawer with full-text search across quotes and personal notes, 5 color filter tabs, chronological section/page coordinates, and direct 1-click chapter jumps.',
        'Literary Notebook Commonplace View (`src/components/presentation/NotebookView.tsx`, `Navbar.tsx`): Dedicated 4th navigation tab (`/?view=notebook`) displaying preserved passages, searchable across text, notes, and authors, with By-Book vs Chronological grouping, academic citation generation, and deep-linking to reader.',
        'Account Page Reading Journal Metric (`AccountLibraryStats.tsx`, `account/page.tsx`): Added a 4th metric card for "Notes & Quotes" in a responsive 2x2 grid with live reflection counts and direct deep-linking to the Commonplace Notebook.',
        'Horizontal Mouse Wheel Scroll Translation (`ReaderAnnotationsDrawer.tsx`, `NotebookView.tsx`): Translates standard vertical mouse wheel scroll (`deltaY`) into horizontal displacement across color filter tags without jumping the background drawer or page.',
        'Refined Clear & Delete Confirmation Modals (`NotebookView.tsx`, `app/page.tsx`, `ReaderAnnotationsDrawer.tsx`): Consistent `maxWidth="md"`, `p-6 space-y-5` padding, and warning iconography across all collection wipe and item deletion dialogs.',
      ],
      Changed: [
        'Web Worker Async Unblocking & Stale-Data Hash Guard (`useGutenbergParserWorker.ts`): Eliminated main-thread CPU freeze by calculating synchronously only in fallback environments, and attached content hashes to isolate book switches and prevent stale TOC cross-talk.',
        'Chapter-Scoped Annotation Anchoring (`app/read/[id]/page.tsx`): Scoped annotations to the active chapter to prevent duplicate text from falsely highlighting across different chapters.',
        'Booksaw Editorial Header Alignment (`src/components/presentation/NotebookView.tsx`): Aligned section eyebrow typography (`text-[11px] font-mono tracking-widest uppercase font-semibold`) and tactile page-turn animation to match Bookshelf and Favorites.',
        'Minimalist Navbar Notebook Tab (`src/components/presentation/Navbar.tsx`): Streamlined notebook navbar button by removing numeric counter badge and using dynamic amber fill state matching Bookshelf and Favorites icons.',
        'Co-Located Test Suite Expansion: Expanded unit and integration test coverage across all 106 test suites and 720 tests with 91.92% line coverage.',
      ],
    },
  },
  {
    version: '1.8.0',
    date: '2026-09-03',
    title: 'Architectural Decoupling, Headless Hooks, Bidirectional Cloud Sync & Storage Engine',
    sections: {
      Added: [
        'Cryptographic Password Domain Engine (`src/lib/password.ts`, `PasswordStrengthMeter.tsx`): Extracted pure domain password generation (`generateStrongPassword`) and 3-tier entropy scoring (`evaluatePasswordStrength`) paired with a reusable 3-segment progress indicator across Sign Up and Account Security.',
        'Web Worker Main-Thread Offloading (`src/workers/gutenberg.worker.ts`, `src/hooks/reader/useGutenbergParserWorker.ts`): Offloaded CPU-heavy chapter segmentation regex splitting and pagination spread calculations to a background Web Worker with automatic synchronous fallback.',
        'Storage Quotas & LRU Emergency Eviction (`src/lib/offline-storage.ts`, `src/hooks/useOfflineBooks.ts`): Integrated `navigator.storage.estimate()` monitoring, automatic oldest-volume LRU eviction, and `QuotaExceededError` write recovery in IndexedDB.',
        'Offline Mutation Outbox & Auto-Reconnection (`src/stores/useBookshelfStore.ts`, `src/app/providers.tsx`): Built persistent offline outbox queue ensuring offline shelf deletions and favorite toggles are retained and atomically dispatched upon online network restoration.',
        'Hardware Tiering & 2D Reduced-Motion Hero Presentation (`src/components/presentation/HeroFeaturedBook3D.tsx`): Automatic detection of low-tier hardware and user reduced-motion preferences via `usePerformanceTier` to present an accessible, static 2D hero card.',
        'Headless Cursor Tooltip Hook & Zero-Clipping Portal Primitive (`src/hooks/useCursorTooltip.ts`, `src/components/ui/CursorTooltip.tsx`): Encapsulated mouse coordinate tracking and hover timers into a headless hook with a body-portaled tooltip, removing duplicate handlers from `BookCard` and `BookshelfSpine`.',
        'Decoupled 3D Open-Book Kinematics & Presentation Rig (`src/hooks/useBookPassageShuffle.ts`, `src/components/presentation/HeroFeaturedBook3D.tsx`): Decoupled the standing 3D book rig, turning leaf physics, and passage shuffle engine from search state, reducing `HeroSearch.tsx` by 240+ lines and simplifying `BookPreviewModal.tsx`.',
        'Modular Reader Header & Archival Info Modal (`src/components/reader/GutenbergInfoModal.tsx`, `src/components/reader/ReaderSubHeaderRibbon.tsx`): Decomposed the monolithic reader header by extracting the Project Gutenberg archival metadata modal and the dual-state sub-header ribbon from `ReaderHeader.tsx`.',
        'Headless Reader Session Hook (`src/hooks/reader/useReaderSession.ts`): Decoupled reader pagination, chapter transitions, exact page bookmarking auto-resume, progress persistence, and bidirectional page turning from `src/app/read/[id]/page.tsx`.',
        'Bidirectional Bookshelf & Favorites Cloud Synchronization (`src/stores/useBookshelfStore.ts`, `src/components/auth/AuthModal.tsx`): Upgraded `syncWithCloud` to perform automatic two-way synchronization: on login or app launch, any volumes saved locally in browser storage that are missing from Supabase are automatically upserted to `bookshelf_items` and `user_favorites`, ensuring 100% library parity across mobile and desktop devices.',
        'Cross-Device Favorites Cloud Sync (`src/stores/useBookshelfStore.ts`, `user_favorites` table): Implemented cloud synchronization of user-liked books and favorites via Supabase PostgreSQL with RLS, merging local guest favorites upon login, and auto-purging on account deletion.',
        'Native IndexedDB Offline Book Storage Engine (`src/lib/offline-storage.ts`, `src/hooks/useOfflineBooks.ts`, `src/hooks/queries/useBookContent.ts`): Zero-dependency browser IndexedDB storage engine (`BookariumOfflineDB`) bypassing the 5MB `localStorage` limit to store full classic texts offline with instant cache-hit reading.',
        'Interactive Shelf Offline Lifecycle & Confirmation Modal (`src/components/presentation/BookshelfRack.tsx`, `src/components/presentation/bookshelf/BookshelfManageModals.tsx`): "Download Shelf Offline" with live `Saving X/Y` progress indicator, 1.5s completion flash, seamless transition to "Clear Offline Shelf", and accessible confirmation modal dialog.',
        'Canonical Project Gutenberg Format Fallback Engine (`src/lib/utils.ts`, `src/components/presentation/DownloadDrawer.tsx`): Automatic generation of official Project Gutenberg permanent URLs for EPUB, Kindle, Clean Plain Text, and Web HTML, guaranteeing active download buttons across all books on the Bookshelf, in Favorites, and in the Catalog.',
        'Bookshelf Cursor-Following Portal Tooltips (`src/components/presentation/bookshelf/BookshelfSpine.tsx`): Zero-clipping cursor-tracking tooltips portaled to `document.body` across all 5 spine hover preview actions matching `BookCard`.',
        'Bookshelf Deduplication & Database Unique Constraints Guardrails (`supabase/schema.sql`, `src/stores/useBookshelfStore.ts`): Enforced `unique_user_default_bookshelf` and `unique_user_shelf_name` unique constraints in PostgreSQL, `ON CONFLICT DO NOTHING` on auto-provisioning triggers, and client-side deduplication.',
        'Responsive Header Ergonomics & GitHub Repository Integration (`src/components/presentation/Navbar.tsx`, `src/components/presentation/Footer.tsx`): Direct repository links across header and footer, brand anti-truncation protection (`shrink-0`, `whitespace-nowrap`), space-aware responsive GitHub button disclosure (`min-[440px]:inline-flex`), synchronized tablet/desktop text expansion at `md:`, anti-jitter `border-b-2 border-transparent` tabs, and desktop hover tooltips.',
        'SPDX Standard MIT License Provisioning (`LICENSE`, `package.json`): Installed official MIT License text with copyright attribution and package manifest metadata for automated GitHub `licensee` badge detection.',
        'Archival Language Editions & Translation Hub (`src/components/reader/ReaderLanguageDrawer.tsx`, `src/hooks/queries/useBookTranslations.ts`): Language Editions hub supporting authentic Project Gutenberg international translations, FRBR work mapping, and native browser translation guidance.',
        'Co-Located Test Suite Expansion: Expanded unit and integration test coverage across all 100 test suites and 646 tests with 91.7% line coverage.',
      ],
      Changed: [
        'Bookshelf "All Saved for Offline" Status Notice (`src/components/presentation/BookshelfRack.tsx`): Converted from an interactive button to an accessible, non-clickable status notice (`role="status"`, `select-none`, `cursor-default`) positioned cleanly alongside the actionable "Clear Offline Shelf" button.',
        'Single Responsibility Refactor: Decomposed `ReaderHeader.tsx`, `HeroSearch.tsx`, `BookshelfRack.tsx`, and `app/read/[id]/page.tsx` into focused presentation components and headless custom hooks.',
        'Auth Return Contract: `signInWithPassword` in `useAuthStore.ts` returns the authenticated user object directly to eliminate React component closure lag during authentication.',
      ],
      Fixed: [
        'Fixed cross-device bookshelf count disparity by auto-upserting unsynced local volumes into Supabase upon cloud synchronization.',
        'Fixed stale auth user closure in `AuthModal.tsx` on sign-in and sign-up.',
        'Eliminated clipping and z-index overlap in book card and spine hover action tooltips via React DOM portal.',
      ],
    },
  },
  {
    version: '1.7.0',
    date: '2026-09-02',
    title: 'Enterprise Security Hardening, Next.js 16 Proxy Migration & Performance Optimization',
    sections: {
      Added: [
        'Zero-Dependency Sliding-Window Rate Limiter (`src/lib/rate-limiter.ts`): In-memory sliding window rate limiter protecting upstream Project Gutenberg APIs (60 req/min for search, 30 req/min for full-text) with standard `X-RateLimit-*` and `Retry-After` headers and automatic 30s garbage collection.',
        'Next.js 16 Edge Proxy Migration (`src/proxy.ts`, `src/proxy.test.ts`): Upgraded from deprecated `middleware.ts` to native Next.js 16 Edge `proxy.ts` convention with 100% co-located unit tests.',
        'Enterprise HTTP Security Headers (`next.config.ts`): Enforces HSTS (`max-age=63072000; includeSubDomains; preload`), Clickjacking protection (`X-Frame-Options: SAMEORIGIN`), MIME-sniffing defense (`X-Content-Type-Options: nosniff`), Referrer-Policy, and Permissions-Policy.',
        'SSRF & Path Traversal Immunity (`/api/books/content`): Upstream URL whitelisting (`isSafeUpstreamUrl`) restricting fetches strictly to official Project Gutenberg domains, strict numeric ID regex verification (`^\\d{1,8}$`), and manual redirect handling.',
        'Open Redirect Sanitization (`/auth/callback`): Added `sanitizeRedirectPath` to secure OAuth and magic-link redirect paths against off-site phishing vectors.',
        'ReDoS Defense & LRU Pagination Cache (`src/lib/gutenberg-parser.ts`): Non-backtracking regular expressions (`[^\\n]{0,80}`), bounded 120,000-character sampling windows, and a 500-entry LRU pagination cache for instant virtual page turns.',
        'Datacenter Proximity & Payload Compression (`vercel.json`): Pinned serverless execution to `iad1` (Washington D.C. / US-East) adjacent to Gutenberg/Gutendex nodes with `gzip, deflate, br` payload compression and HTTP Keep-Alive.',
        'Single-Source Route Registry (`src/config/routes.ts`): Type-safe centralized registry providing static paths (`ROUTES.HOME`, `ROUTES.ACCOUNT`, `ROUTES.CONFIRM_DELETION`, `ROUTES.BOOKSHELF`, `ROUTES.LIKES`) and dynamic builders (`ROUTES.READ(id)`, `ROUTES.VIEW(view)`).',
        'Site Branding & Storage Registry (`src/config/site-config.ts`): Consolidated canonical project links (`SITE_CONFIG`), upstream Gutenberg mirrors, and persistent storage keys (`STORAGE_KEYS`).',
        'Bookshelf Component Decomposition: Modularized `BookshelfRack.tsx` into single-responsibility sub-components (`BookshelfSpine.tsx`, `BookshelfMobileModal.tsx`, `BookshelfManageModals.tsx`) with 100% co-located tests.',
        'Account Settings Modularization & Route Migration: Migrated `/profile` to `/account` with modular sub-components in `src/components/account/` with 100% co-located tests.',
        'Order-Independent Dynamic Smart Search (`/lib/smart-search.ts`, `CollectionSearchBar.tsx`): Real-time, zero-network-latency client search engine for Bookshelf and Favorites supporting order-independent multi-token matching, diacritic insensitivity, instant clear button, and live counter badges.',
        'Unconstrained Viewport Cursor Tooltips (`BookCard.tsx`): Direct DOM body portaling (`createPortal`) of cursor-following tooltips tracking mouse coordinates at `+12px, +14px` across card edges without boundary clipping, dynamically swapping actions.',
        'Dynamic 3D Preview Modal Typography & Overflow Safeguard (`BookPreviewModal.tsx`): Directly composed shared `<BookCard />` on 3D flipper cover with responsive fluid typography, adaptive line-clamping, and scroll containment for long book titles without text truncation.',
        'Dynamic Active Icon Fills & Zero-Shift Header Hydration: Clean dynamic SVG fills for Bookshelf (`fill-primary`) and Favorites (`fill-destructive`) when containing saved items, eliminating text clutter and delivering 100% stable layouts (CLS = 0).',
        'Test Suite Expansion & 100% Quality Gateway: Expanded test suite to 66 suites and 428 focused, single-responsibility tests with 92.15% line coverage.',
      ],
      Changed: [
        'Codebase Orchestration: Reduced `BookshelfRack.tsx` from 861 to 389 lines (-55%) and `src/app/account/page.tsx` from 787 to 328 lines (-58%).',
        'Link & Storage Adoption: Replaced all scattered hardcoded routes and storage key strings across Navbar, Footer, BookCard, Bookshelf, Account, Reader, and Zustand stores with centralized configuration singletons.',
        'Audit Telemetry: Enhanced Pass 6 audit reporting in `scripts/verify-build.js` with detailed ESLint and Knip metrics and added `npm run audit:detailed`.',
      ],
      Fixed: [
        'Eliminated Next.js 16 middleware deprecation warning by migrating to proxy convention.',
        'Eliminated potential ReDoS vulnerabilities and event loop freezing during large text parsing.',
        'Fixed header layout shift and text reflow during client-side hydration.',
      ],
    },
  },
  {
    version: '1.6.0',
    date: '2026-09-01',
    title: 'Dynamic Shelf Capacity, Mobile In-Shelf Modals, Reader Share & Dynamic Viewport Ergonomics',
    sections: {
      Added: [
        'Dynamic Bookshelf Capacity Engine: `ResizeObserver`-driven physical book packing automatically scaling from 6-8 books on mobile up to 18-24 books on wide displays, eliminating empty side gaps.',
        'Mobile Tap-to-Activate In-Shelf Modal: Smooth interactive floating modal rendered directly within the active shelf niche on mobile without premature navigation.',
        'Reader Share Button: Integrated header share action copying volume direct links to clipboard via `navigator.clipboard` with tactile 2-second visual checkmark feedback.',
        'Mobile Dynamic Viewport Engine: Upgraded reader architecture to `h-[100dvh]` and `pb-[env(safe-area-inset-bottom)]`, preventing footers and pagination from being clipped by collapsing mobile browser address bars.',
        'Natural Author Name Formatting: Integrated `formatAuthorNames` for all desktop hover and mobile quick-action modal cards, transforming raw catalog strings into natural reading order.',
        'Profile Library Section Modernization: Renamed statistics to "Shelved Volumes", "Favorite Titles", and "Custom Shelves" with direct interactive routing to bookshelf and favorites views.',
      ],
      Changed: [
        'Bookshelf Alignment: Balanced center alignment across both mobile and desktop viewports (`justify-center px-4 sm:px-8`).',
        'Reader Modal Geometry: Centered Table of Contents (`ReaderTocDrawer`) and Reading Controls (`ReaderControls`) horizontally on mobile screens.',
        'Text Selection Ergonomics: Unlocked natural cursor highlighting and touch selection (`select-text`) for titles, authors, and book content across desktop and mobile.',
      ],
      Fixed: [
        'Fixed empty side gaps on wide screens caused by the legacy hardcoded 8-book shelf capacity limit.',
        'Fixed accidental instant reader navigation on mobile bookshelf spine taps by introducing the quick-action modal.',
        'Eliminated mobile address bar content overlap in paginated reading mode via dynamic viewport units (`dvh`).',
      ],
    },
  },
  {
    version: '1.5.0',
    date: '2026-09-01',
    title: 'Account Security Lifecycle, In-App Password Generator & Email-Verified Deletion',
    sections: {
      Added: [
        'Forgot Password Flow: Direct password reset email request interface within the authentication modal delivering secure one-time reset links via Supabase Auth.',
        'In-App Password Generator: Cryptographic high-entropy 16-character password generator button (`KeyRound`) with dual auto-fill and instant clipboard copy feedback.',
        'Live Password Strength Meter: Color-coded real-time complexity bar (Weak / Moderate / Strong) calculating entropy score across both Sign Up and Profile dashboard.',
        'Dual-Password Confirmation: Dedicated Confirm Password fields in Sign Up registration and Profile password changes with real-time mismatch validation.',
        'Email-Verified Account Deletion: Two-step deletion verification protocol with upfront guidance modal, one-time verification link, and final authorization at the `/auth/confirm-deletion` portal.',
        'Dedicated Deletion Portal (`/auth/confirm-deletion`): Standalone client portal verifying user identity, displaying destructive warnings, and purging cloud bookshelves, profiles, and active sessions.',
        'Accidental Clear Confirmation Modals: Tactile confirmation dialogs preventing accidental clearing of personal bookshelves or liked favorites.',
        'Literary Tagline Refresh: Updated footer literary attribution to "Crafted with care for book lovers everywhere".',
      ],
      Changed: [
        '`useAuthStore` Architecture: Added `resetPasswordForEmail`, `updatePassword`, `requestAccountDeletion`, and `deleteAccount` state handlers with deterministic session termination.',
      ],
      Fixed: [
        'Prevented password mismatch errors during registration and credential updates via simultaneous dual-input auto-fill.',
      ],
    },
  },
  {
    version: '1.4.0',
    date: '2026-09-01',
    title: 'Classic Library Aesthetics, Tactile Hardwood Bookshelves & Cross-Theme Harmonization',
    sections: {
      Added: [
        'Unified Bookcase Architecture: Integrated shelf back-wall alcove and solid hardwood timber rail into a single structural module, guaranteeing zero vertical air gap on desktop and smooth flush touch-scrolling on mobile.',
        'Convex 3D Spine Physics: Created `.book-spine-convex` multi-stop cylindrical specular lighting overlay simulating authentic curved hardcover spines and hinge creases.',
        'Hot-Foil Typography & Seals: Designed `.spine-emboss-gold` and `.spine-emboss-silver` text treatments with gilded headcap rules and embossed author volume stamps.',
        'Curated Library Palettes: Implemented 8 authentic bookbinding colorways (Oxblood Burgundy, Imperial Navy, Emerald Leather, Amber Saddle, Royal Plum, Aged Charcoal, Dark Teal, Espresso).',
        'Theme-Tailored Wood Railings: Added dedicated `.sepia .shelf-wood-ledge` (dark mahogany) and `.dark .shelf-wood-ledge` (charcoal walnut) with top specular bevel lines (`inset 0 1px 0`).',
        'Ambient Alcove Lighting: Added `.shelf-ambient-niche` soft radial spotlight vignette behind books across Light, Sepia, and Dark themes.',
        'Semantic Border Parity: Bound shelf container borders to 100% opacity theme tokens (`--border: #462e22` for Sepia, `#292524` for Dark) matching Profile page cards.',
      ],
      Changed: [
        'Hover Physics: Upgraded spine interaction to grounded pull-forward expansion (`origin-bottom scale-105`) with ambient drop shadow while preserving baseline alignment.',
        'Toolbar Ergonomics: Relocated shelf Rename and Delete action buttons to the right-aligned toolbar beside cloud sync status, preserving uniform shelf switcher tab sizing.',
      ],
      Fixed: [
        'Eliminated mobile horizontal scroll overflow where book spines previously extended beyond the bottom rail ledge.',
        'Fixed floating preview card reading percentage to accurately display 0% on page 1 of freshly opened books.',
      ],
    },
  },
  {
    version: '1.3.0',
    date: '2026-09-01',
    title: 'Cloud Bookshelves, Multi-Category Indexing & Supabase Synchronization',
    sections: {
      Added: [
        'Supabase PostgreSQL Cloud Sync: Bi-directional synchronization for custom named bookshelves and bookshelf items with Row Level Security (RLS) isolation.',
        'Master "General" Shelf: Aggregated view displaying all saved volumes across all custom collections with real-time volume counters.',
        'Floating "Move to Shelf" Dropdown: Instant shelf reassignment selector on spine hover cards with optimistic UI updates and background cloud persistence.',
        'Safe Shelf Deletion Workflow: Modal confirmation flow that automatically reassigns orphaned volumes back to the master "General" shelf before deleting the category.',
        'Custom Shelf Modals: Non-intrusive modal dialogs for creating, renaming, and deleting custom shelves with auto-focus inputs and validation.',
        'Guest-to-Cloud Migration: Automatic one-click sync that safely uploads local Zustand `localStorage` collections into Supabase upon user sign-in.',
      ],
      Changed: [
        '`useBookshelfStore` Architecture: Multi-shelf indexing with dynamic filtering, optimistic updates, and fallback handling for unassigned items.',
      ],
      Fixed: [
        'Fixed "Browse Catalog" button on empty shelf states to smoothly transition active view back to catalog browsing.',
        'Resolved shelf item mapping fallbacks for books saved prior to custom category creation.',
      ],
    },
  },
  {
    version: '1.2.0',
    date: '2026-08-31',
    title: 'Multi-Volume Gutenberg Parser, Table of Contents & Reader Navigation',
    sections: {
      Added: [
        'Multi-Volume Segmentation Engine: Intelligent detection and segmentation for multi-volume works (e.g. Volumes I-III, Books 1-12, Cantos, Acts, Tomes).',
        'Volume Selector Drawer: Quick drawer interface allowing readers to switch between individual volumes of multi-part works.',
        'Smart Chapter Heading Detector: Automatic Roman numeral, numbered, and titled chapter hierarchy parser.',
        'Table of Contents Drawer (`ReaderTocDrawer`): Accessible slide-out navigation with direct chapter jumps and active section tracking.',
        'Typography Preferences: Reader controls for font size scaling (12px-36px), line height adjustments (1.2-2.6), and serif/sans/monospace font families.',
        'Reader Drop-Cap Styling: Classic editorial initial-letter styling for opening chapter paragraphs.',
        'Verified Reader Profile (`/profile`): User account dashboard with reading statistics (saved volumes, liked titles, custom shelves) and atmosphere settings.',
      ],
      Changed: [
        'Progress Precision: Recalibrated reading progress tracking to strictly report 0% on page 1 with rounded integer percentages.',
        'Theme Engine: Full support for Light, Sepia (antique parchment), and Dark (midnight) modes with zero-CLS scrollbar stability (`scrollbar-gutter: stable`).',
      ],
      Fixed: [
        'Prevented premature reading completion flags when completing intermediate sub-volumes of multi-volume anthologies.',
        'Tiered Metadata Fallbacks: Implemented 4-tier resolution engine (static fixtures -> Zustand store -> REST API -> raw text headers) eliminating placeholder titles and authors.',
      ],
    },
  },
  {
    version: '1.1.0',
    date: '2026-08-31',
    title: '3D Interactive Catalog, Zero-Copyright Download Hub & Instant Discovery',
    sections: {
      Added: [
        '3D Interactive Book Rig: Realistic 3D perspective book cards (`.book-3d-rig`, `.book-3d-flipper`) with interactive hover opening physics.',
        'Zero-Copyright Download Hub: Client-side download drawer supporting EPUB, Plain Text (UTF-8), and Kindle (MOBI) formats directly from public domain mirrors.',
        'Instant & Remote Search: Dual-tier search combining debounced Gutendex API querying with instant local fuzzy filtering over featured library books.',
        'Topic & Language Drawers: Filtering drawers across genres (Fiction, Philosophy, Poetry, Science, History) and languages (English, French, German, Spanish, Italian, Latin, Ancient Greek).',
        'Literary Quote Banner: Dynamic rotator carousel featuring curated public domain passages and quotes.',
        'Back-to-Top Navigation: Floating action button with smooth window scroll restoration.',
      ],
      Changed: [
        'TanStack React Query Cache: Implemented 5-minute stale-time caching strategy with preloaded static fixtures for instant hero catalog rendering.',
      ],
    },
  },
  {
    version: '1.0.0',
    date: '2026-08-30',
    title: 'Initial Scaffold, Public Domain Discovery & 7-Gateway Governance Engine',
    sections: {
      Added: [
        'Core Next.js Architecture: Next.js App Router, React 19, and Tailwind CSS.',
        'Public Domain Integrity Layer: API route proxy (`/api/books`, `/api/books/content`) strictly enforcing `copyright=false` queries.',
        'Offline Focus Reader: In-browser focus reading surface with local storage progress persistence via Zustand.',
        'Testing Suite: Complete test suite with Vitest, MSW v2 network interception, and Testing Library (>= 80% coverage co-located with every component, hook, and store).',
        '7-Gateway Quality Engine (`scripts/verify-build.js`): Automated pre-commit verification pipeline enforcing secret prevention, type checking, unit tests, coverage floor, living docs sync, ADR schema validation, ESLint/Knip audits, and Next.js production builds.',
        'Living Documentation: AST-driven architecture matrix parser (`scripts/generate-architecture-matrix.js`) and ADR decision ledger (`docs/DECISIONS.md`).',
      ],
    },
  },
];

function generateChangelog() {
  let content = `# Changelog

All notable changes to Bookarium are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---
`;

  for (const rel of RELEASES) {
    content += `\n## [${rel.version}] - ${rel.date}\n`;
    if (rel.title) {
      content += `### *${rel.title}*\n\n`;
    }

    for (const [sectionName, items] of Object.entries(rel.sections)) {
      if (items && items.length > 0) {
        content += `### ${sectionName}\n`;
        for (const item of items) {
          content += `- ${item}\n`;
        }
        content += '\n';
      }
    }
  }

  // Link ADRs if available
  if (fs.existsSync(adrPath)) {
    const adrContent = fs.readFileSync(adrPath, 'utf-8');
    const adrMatches = [...adrContent.matchAll(/## (ADR-\d+: [^\n]+)/g)].map((m) => m[1]);
    if (adrMatches.length > 0) {
      content += `---

## Architectural Decision Records (ADRs)
The following key architectural decisions are recorded in [\`docs/DECISIONS.md\`](docs/DECISIONS.md):
`;
      for (const adr of adrMatches) {
        content += `- **${adr}**\n`;
      }
      content += '\n';
    }
  }

  fs.writeFileSync(changelogPath, content.trim() + '\n', 'utf-8');
  console.log('✔ [SUCCESS] CHANGELOG.md generated successfully.');
}

function syncReadmeLatestRelease() {
  if (!fs.existsSync(readmePath)) return;
  const readmeContent = fs.readFileSync(readmePath, 'utf-8');
  const startMarker = '<!-- BEGIN:latest-release -->';
  const endMarker = '<!-- END:latest-release -->';

  const startIndex = readmeContent.indexOf(startMarker);
  const endIndex = readmeContent.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) return;

  const latest = RELEASES[0];
  if (!latest) return;

  // Pick top 4-5 major highlight bullets
  const topHighlights = [];
  if (latest.sections.Added) {
    for (const item of latest.sections.Added) {
      if (topHighlights.length >= 3) break;
      if (!topHighlights.includes(item)) topHighlights.push(item);
    }
  }
  if (latest.sections.Refactored) {
    for (const item of latest.sections.Refactored) {
      if (topHighlights.length >= 5) break;
      if (!topHighlights.includes(item)) topHighlights.push(item);
    }
  }
  if (latest.sections.Fixed && topHighlights.length < 5) {
    topHighlights.push(latest.sections.Fixed[0]);
  }

  const bullets = topHighlights
    .map((item) => {
      const colonIdx = item.indexOf(': ');
      if (colonIdx !== -1 && !item.startsWith('**')) {
        return `- **${item.slice(0, colonIdx)}**: ${item.slice(colonIdx + 2)}`;
      }
      if (!item.startsWith('**') && item.startsWith('Fixed ')) {
        return `- **Fix**: ${item}`;
      }
      return `- ${item}`;
    })
    .join('\n');

  const replacement = `${startMarker}
## 🛠️ Latest Improvements (v${latest.version})

${bullets}

> 📖 **Complete Historical Ledger**: For full chronological release notes, breaking changes, and migration details across all versions, see [**\`CHANGELOG.md\`**](CHANGELOG.md).
${endMarker}`;

  const updatedReadme =
    readmeContent.substring(0, startIndex) +
    replacement +
    readmeContent.substring(endIndex + endMarker.length);

  fs.writeFileSync(readmePath, updatedReadme, 'utf-8');
  console.log(`✔ [SUCCESS] README.md latest release section synchronized (v${latest.version}).`);
}

generateChangelog();
syncReadmeLatestRelease();
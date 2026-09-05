# Changelog

All notable changes to Bookarium are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.9.5] - 2026-09-04
### *Multi-Device Deletion Tombstones, Cloud Reading Progress Synchronization & Persistent Worker Architecture*

### Added
- Multi-Device Deletion Tombstones (`useBookshelfStore.ts`): Integrated `deletedBookIds` tombstone tracking to prevent deleted bookshelf volumes from being resurrected as ghost items during cross-device Supabase cloud reconciliation.
- Cross-Device Cloud Reading Progress Sync (`useReaderStore.ts`, `useReaderSession.ts`): 2000ms debounced upsert to Supabase `public.reading_progress` table with automatic reading coordinate restoration when resuming sessions on new devices, strictly gated for authenticated accounts with 0ms/zero-network guest mode.
- Persistent Gutenberg Parser Worker (`useGutenbergParserWorker.ts`): Maintained a single long-lived Web Worker instance across typography, font scaling, and line spacing adjustments, eliminating worker churn and UI thread freezes with non-blocking async fallback.
- Selection-Safe Touch Gestures (`useReaderGestures.ts`): Suppressed horizontal swipe navigation when active DOM text selection exists or touch starts inside an active modal/popover, preventing accidental page turns during passage highlighting.
- Content Fetch Timeout & Failover (`useBookContent.ts`): Added an 8000ms client-side `AbortSignal.timeout` to gracefully trigger Gutenberg mirror failover during slow or stalled upstream connections.
- Architecture Decision Record (`ADR-014`): Formally ratified Deletion Tombstones, Cloud Reading Progress Synchronization & Persistent Worker Architecture in `docs/DECISIONS.md`.
- Co-Located Test Suite Hardening: Expanded unit and integration test coverage across all 120 test suites and 906 tests, maintaining 100% pass rate and 92.14% line coverage.

### Fixed
- Ghost Volume Resurrection: Resolved issue where deleting a book on one client could be overwritten and resurrected upon syncing with cloud storage.
- Swipe Gesture Collisions with Text Selection: Resolved conflicts where attempting to drag selection handles on mobile readers triggered page flips.
- Knip Dead Code Hygiene: Cleaned up unused exports across presentation and mock layers, ensuring full Pass 6 compliance with zero errors.


## [1.9.4] - 2026-09-04
### *Bookmarks & Continue Reading Ledger, Unified SectionHeader Component & Hardened Pre-Commit Hook*

### Added
- Bookmarks & Continue Reading Ledger (`/?view=bookmarks`): Dedicated reading ledger with tactile bookmark cards, bookmark ribbon accents, live progress percentages, last-read coordinates, status filter tabs (All, In Progress, Completed, On Hold), real-time search (`CollectionSearchBar`), "Clear Bookmarks" accessible confirmation modal, and 1-click chapter resume.
- Authentic Reading Telemetry & Unopened Volume Exclusion: Refined `useContinueReadingLedger` to strictly enroll books with active reading coordinates (`readingPositions`) or progress (`readingProgress > 0`), eliminating contradictory "Never opened" cards on bookmarks and decoupling ledger resets from user curation.
- Two-Way Metadata Synchronization & Warm Reader Handoff: Active query hydration in `useContinueReadingLedger` resolves missing book metadata via TanStack Query without displaying generic Gutenberg fallbacks; `/read/[id]` immediately persists resolved book identity to `recentBooks` on load and primes reader state upon resume.
- DRY Parser & Adapter Normalization: Unified author reversed-name parsing, lifespan stripping (`formatAuthorNames`), title prefix cleaning (`cleanBookTitle`), and relative time calculation (`formatRelativeTime`) into canonical `@/lib/utils` and `book.adapter.ts`.
- Unified SectionHeader & Editorial Typography Harmonization (`SectionHeader.tsx`): Reusable `<SectionHeader>` and `<SectionTitle>` component standardizing subtle decorative flank border lines (`h-[1px] w-12 bg-border`), refined typography scale (`text-3xl sm:text-4xl`), and action slots across Catalog, Bookshelf, Favorites, Bookmarks, and Literary Notebook views.
- Tactile Booksaw Page-Turn Transitions: Integrated hardware-accelerated `animate-page-turn` transitions on view transitions and filter tab switching in the Bookmarks ledger.
- Canonical Domain Book Entity & Adapter (`toCanonicalBook`): Provider-agnostic Book and ActiveReadingVolume domain entities in `src/types/book.types.ts` and `src/lib/adapters/book.adapter.ts` for clean architectural decoupling.
- Headless Reading Ledger Hook (`useContinueReadingLedger.ts`): Aggregates reading progress, bookmarks, and statuses across stores with client-side multi-field search filtering, status filtering, and recency sorting.
- Navigation & Route Integration: Added Bookmarks tab to Navbar with BookMarked icon, active styling in `library-tokens.ts`, and BOOKMARKS route target in `routes.ts`.
- Co-Located Test Suite Expansion: Added new test suites (120 suites / 896 tests total) with 100% pass rate and >= 92% coverage.

### Fixed
- Pre-Commit Hook Hardening (`.husky/pre-commit`): Eliminated child git process lock collisions on Windows NTFS by running the 7-Gateway Quality Engine via pure Node.js.
- Generic Gutenberg Fallbacks (e.g. Volume #55179): Resolved placeholder title and author display by dynamically querying Gutendex and persisting metadata across client reading sessions.
- Un-Opened Books Appearing on Bookmarks: Fixed ledger volume calculation so unread bookshelf books never pollute the continue reading flow with "Never opened" tags.


## [1.9.3] - 2026-09-04
### *Personal Curation (Ratings & Statuses), Mobile Action Sheet & Live Static Analysis Telemetry*

### Added
- Personal 1-5 Star Book Ratings (`StarRating.tsx`): Tactile star rating widget with hover preview, clear toggle, and zero layout shift.
- Reading Status Management (`ReadingStatusSelector.tsx`): 3-tier reading status selector (Want to Read, Currently Reading, Finished) with active visual states.
- Viewport-Level Mobile Modal (`BookshelfMobileModal.tsx`): Touch-optimized action sheet for mobile and vertical displays (< 1024px) enabling full rating and shelf curation on Favorites and Bookshelf.
- Live Static Analysis Telemetry (`scripts/generate-quality-report.js`): Automated execution and telemetry recording of ESLint 9 and Knip dead code audits directly in `QUALITY_AUDIT_REPORT.md` and `quality-audit-results.json`.
- Co-Located Test Suite Expansion: Expanded unit test coverage across 112 suites and 819 tests, achieving 92.05% line coverage.

### Fixed
- Knip Duplicate Export Resolution (`BookshelfMobileModal.tsx`): Removed redundant alias exports (`BookMobileModal`), ensuring clean Pass 6 audit compliance with 0 errors.
- Outside-Click Dismissal & Event Isolation (`BookPreviewModal.tsx`): Enabled whitespace dismissal while strictly isolating interactive curation controls.


## [1.9.2] - 2026-09-04
### *Library Portability Engine, JSON Backup/Restore, CSV Catalog Export & Pre-Commit Sync*

### Added
- Pure Domain Library Portability Engine (`src/lib/library-backup.ts`): Single-click portable JSON backup and RFC 4180 compliant CSV spreadsheet catalog export capturing volumes, shelves, bookmarks, and literary annotations.
- Defensive Backup Schema Validation (`validateLibraryBackup`): Strict JSON structure, application name, and array integrity checks preventing corrupted or malformed payload injection.
- Dual-Strategy Library Restore (`restoreLibraryBackup`): Non-destructive "Merge with Existing Library" preserving current collections and "Replace Entire Library" for clean snapshot restores, with automatic cloud sync for authenticated readers.
- Account Portability & Backup Interface (`AccountPreferencesSection.tsx`, `AccountRestoreModal.tsx`): Dedicated dashboard controls for JSON/CSV exports and accessible restore modal with live preview badges and destructive action safeguards.
- Co-Located Test Suite Expansion: Added unit test coverage across `library-backup.test.ts` and `AccountRestoreModal.test.tsx`, reaching 110 suites and 784 verified tests.

### Fixed
- Pre-Commit Auto-Staging (`.husky/pre-commit`): Included `README.md` and `ROADMAP.md` in automated staging list, guaranteeing 0% unstaged drift after quality engine passes.


## [1.9.1] - 2026-09-04
### *Centralized Library Design Tokens, Reader Dynamic Language Indicators & Account Border Polish*

### Added
- Centralized Library Design Tokens (`src/config/library-tokens.ts`): Single source of truth for library category colorways (`LIBRARY_THEMES`), synchronizing active borders, focus rings, and filled SVG icons across navbar tabs and account metric cards.
- Dynamic Reader Language & Bilingual Mode Indicators (`src/components/reader/ReaderHeader.tsx`, `read/[id]/page.tsx`): Header translation trigger dynamically displays active target language code (`ES`) when translated, parallel dual-language format (`EN ∥ ES`) in Bilingual mode, accompanied by visual sparkles and active indicator dot.
- Co-Located Test Suite Expansion: Added unit tests for library tokens and expanded test coverage across `AccountLibraryStats.test.tsx` and `ReaderHeader.test.tsx`, achieving 108 suites and 760 passing tests.

### Fixed
- Account Library Statistics Hover Border Contrast (`src/components/account/AccountLibraryStats.tsx`): Resolved Tailwind v3 CSS variable opacity stripping on custom properties (`hover:border-primary/50` -> `hover:border-primary`, `hover:border-destructive`), guaranteeing distinct, visible 1px card borders on hover and keyboard focus across Light, Dark, and Sepia themes.


## [1.9.0] - 2026-09-03
### *Literary Notebook, Text Highlighting & Annotations Engine, and PWA Standalone Mode*

### Added
- Progressive Web App (PWA) Standalone Mode (`src/app/manifest.ts`, `src/app/layout.tsx`, `public/icons/`): Configured Next.js 16 web app manifest, mobile viewport, apple-touch-icon, and a suite of maskable/standard icons for home screen installation.
- Native Service Worker Offline App Shell (`public/sw.js`, `ServiceWorkerRegister.tsx`): Built App Shell caching and offline navigation fallback enabling unabridged reading of saved IndexedDB books in airplane mode.
- Text Highlighting & Annotations Engine (`public.user_annotations`, `src/stores/useAnnotationStore.ts`): Built local-first persistence with Supabase PostgreSQL cloud sync, Row-Level Security, offline mutation outbox, and automatic guest-to-cloud merge upon login.
- Cloud Sync Deletion Tombstones & Quota Safety (`useAnnotationStore.ts`): Implemented persistent deletion tombstones eliminating cross-device zombie note resurrection, and store-level character clamping protecting localStorage quotas.
- Contextual Text Highlight Popover (`src/components/reader/TextHighlightPopover.tsx`, `ReaderSurface.tsx`): Real-time text selection popover supporting 4 pastel highlight colors (Yellow, Amber, Mint, Rose), coarse-pointer context menu clearance, touchstart dismissal, and inline reflection editor.
- Single Note/Quote Deletion Confirmation Modals (`NotebookView.tsx`, `ReaderAnnotationsDrawer.tsx`, `read/[id]/page.tsx`): Guarded against accidental loss of quotes and marginalia reflections with accessible confirmation modals featuring formatted quote excerpt previews.
- Highlight-Specific Selection Styling (`globals.css`, `ReaderSurface.tsx`): Color-matched `::selection` styling for Canary Yellow, Vintage Amber, Calm Mint, and Soft Rose across Light, Dark, and Sepia themes, eliminating default browser/theme selection background clashing.
- Bilingual Mode Annotation Integration (`ReaderSurface.tsx`): Enabled full highlight rendering and marginalia interaction inside Bilingual Parallel reading mode segments.
- Slide-Out Annotations Drawer (`src/components/reader/ReaderAnnotationsDrawer.tsx`): Focus reader drawer with full-text search across quotes and personal notes, 5 color filter tabs, chronological section/page coordinates, and direct 1-click chapter jumps.
- Literary Notebook Commonplace View (`src/components/presentation/NotebookView.tsx`, `Navbar.tsx`): Dedicated 4th navigation tab (`/?view=notebook`) displaying preserved passages, searchable across text, notes, and authors, with By-Book vs Chronological grouping, academic citation generation, and deep-linking to reader.
- Account Page Reading Journal Metric (`AccountLibraryStats.tsx`, `account/page.tsx`): Added a 4th metric card for "Notes & Quotes" in a responsive 2x2 grid with live reflection counts and direct deep-linking to the Commonplace Notebook.
- Horizontal Mouse Wheel Scroll Translation (`ReaderAnnotationsDrawer.tsx`, `NotebookView.tsx`): Translates standard vertical mouse wheel scroll (`deltaY`) into horizontal displacement across color filter tags without jumping the background drawer or page.
- Refined Clear & Delete Confirmation Modals (`NotebookView.tsx`, `app/page.tsx`, `ReaderAnnotationsDrawer.tsx`): Consistent `maxWidth="md"`, `p-6 space-y-5` padding, and warning iconography across all collection wipe and item deletion dialogs.

### Changed
- Web Worker Async Unblocking & Stale-Data Hash Guard (`useGutenbergParserWorker.ts`): Eliminated main-thread CPU freeze by calculating synchronously only in fallback environments, and attached content hashes to isolate book switches and prevent stale TOC cross-talk.
- Chapter-Scoped Annotation Anchoring (`app/read/[id]/page.tsx`): Scoped annotations to the active chapter to prevent duplicate text from falsely highlighting across different chapters.
- Booksaw Editorial Header Alignment (`src/components/presentation/NotebookView.tsx`): Aligned section eyebrow typography (`text-[11px] font-mono tracking-widest uppercase font-semibold`) and tactile page-turn animation to match Bookshelf and Favorites.
- Minimalist Navbar Notebook Tab (`src/components/presentation/Navbar.tsx`): Streamlined notebook navbar button by removing numeric counter badge and using dynamic amber fill state matching Bookshelf and Favorites icons.
- Co-Located Test Suite Expansion: Expanded unit and integration test coverage across all 106 test suites and 720 tests with 91.92% line coverage.


## [1.8.0] - 2026-09-03
### *Architectural Decoupling, Headless Hooks, Bidirectional Cloud Sync & Storage Engine*

### Added
- Cryptographic Password Domain Engine (`src/lib/password.ts`, `PasswordStrengthMeter.tsx`): Extracted pure domain password generation (`generateStrongPassword`) and 3-tier entropy scoring (`evaluatePasswordStrength`) paired with a reusable 3-segment progress indicator across Sign Up and Account Security.
- Web Worker Main-Thread Offloading (`src/workers/gutenberg.worker.ts`, `src/hooks/reader/useGutenbergParserWorker.ts`): Offloaded CPU-heavy chapter segmentation regex splitting and pagination spread calculations to a background Web Worker with automatic synchronous fallback.
- Storage Quotas & LRU Emergency Eviction (`src/lib/offline-storage.ts`, `src/hooks/useOfflineBooks.ts`): Integrated `navigator.storage.estimate()` monitoring, automatic oldest-volume LRU eviction, and `QuotaExceededError` write recovery in IndexedDB.
- Offline Mutation Outbox & Auto-Reconnection (`src/stores/useBookshelfStore.ts`, `src/app/providers.tsx`): Built persistent offline outbox queue ensuring offline shelf deletions and favorite toggles are retained and atomically dispatched upon online network restoration.
- In-Memory SHA-256 LRU Caching & Abuse Shielding (`src/app/api/translate/route.ts`): Hardened the translation proxy with in-memory SHA-256 LRU caching (1,000 entries max) and strict 15,000-character payload rejection to prevent silent truncation.
- Hardware Tiering & 2D Reduced-Motion Hero Presentation (`src/components/presentation/HeroFeaturedBook3D.tsx`): Automatic detection of low-tier hardware and user reduced-motion preferences via `usePerformanceTier` to present an accessible, static 2D hero card.
- Headless Cursor Tooltip Hook & Zero-Clipping Portal Primitive (`src/hooks/useCursorTooltip.ts`, `src/components/ui/CursorTooltip.tsx`): Encapsulated mouse coordinate tracking and hover timers into a headless hook with a body-portaled tooltip, removing duplicate handlers from `BookCard` and `BookshelfSpine`.
- Decoupled 3D Open-Book Kinematics & Presentation Rig (`src/hooks/useBookPassageShuffle.ts`, `src/components/presentation/HeroFeaturedBook3D.tsx`): Decoupled the standing 3D book rig, turning leaf physics, and passage shuffle engine from search state, reducing `HeroSearch.tsx` by 240+ lines and simplifying `BookPreviewModal.tsx`.
- Modular Reader Header & Archival Info Modal (`src/components/reader/GutenbergInfoModal.tsx`, `src/components/reader/ReaderSubHeaderRibbon.tsx`): Decomposed the monolithic reader header by extracting the Project Gutenberg archival metadata modal and the dual-state sub-header ribbon from `ReaderHeader.tsx`.
- Headless Reader Session Hook (`src/hooks/reader/useReaderSession.ts`): Decoupled reader pagination, chapter transitions, exact page bookmarking auto-resume, progress persistence, and bidirectional page turning from `src/app/read/[id]/page.tsx`.
- Bidirectional Bookshelf & Favorites Cloud Synchronization (`src/stores/useBookshelfStore.ts`, `src/components/auth/AuthModal.tsx`): Upgraded `syncWithCloud` to perform automatic two-way synchronization: on login or app launch, any volumes saved locally in browser storage that are missing from Supabase are automatically upserted to `bookshelf_items` and `user_favorites`, ensuring 100% library parity across mobile and desktop devices.
- Cross-Device Favorites Cloud Sync (`src/stores/useBookshelfStore.ts`, `user_favorites` table): Implemented cloud synchronization of user-liked books and favorites via Supabase PostgreSQL with RLS, merging local guest favorites upon login, and auto-purging on account deletion.
- Native IndexedDB Offline Book Storage Engine (`src/lib/offline-storage.ts`, `src/hooks/useOfflineBooks.ts`, `src/hooks/queries/useBookContent.ts`): Zero-dependency browser IndexedDB storage engine (`BookariumOfflineDB`) bypassing the 5MB `localStorage` limit to store full classic texts offline with instant cache-hit reading.
- Interactive Shelf Offline Lifecycle & Confirmation Modal (`src/components/presentation/BookshelfRack.tsx`, `src/components/presentation/bookshelf/BookshelfManageModals.tsx`): "Download Shelf Offline" with live `Saving X/Y` progress indicator, 1.5s completion flash, seamless transition to "Clear Offline Shelf", and accessible confirmation modal dialog.
- Canonical Project Gutenberg Format Fallback Engine (`src/lib/utils.ts`, `src/components/presentation/DownloadDrawer.tsx`): Automatic generation of official Project Gutenberg permanent URLs for EPUB, Kindle, Clean Plain Text, and Web HTML, guaranteeing active download buttons across all books on the Bookshelf, in Favorites, and in the Catalog.
- Bookshelf Cursor-Following Portal Tooltips (`src/components/presentation/bookshelf/BookshelfSpine.tsx`): Zero-clipping cursor-tracking tooltips portaled to `document.body` across all 5 spine hover preview actions matching `BookCard`.
- Bookshelf Deduplication & Database Unique Constraints Guardrails (`supabase/schema.sql`, `src/stores/useBookshelfStore.ts`): Enforced `unique_user_default_bookshelf` and `unique_user_shelf_name` unique constraints in PostgreSQL, `ON CONFLICT DO NOTHING` on auto-provisioning triggers, and client-side deduplication.
- Responsive Header Ergonomics & GitHub Repository Integration (`src/components/presentation/Navbar.tsx`, `src/components/presentation/Footer.tsx`): Direct repository links across header and footer, brand anti-truncation protection (`shrink-0`, `whitespace-nowrap`), space-aware responsive GitHub button disclosure (`min-[440px]:inline-flex`), synchronized tablet/desktop text expansion at `md:`, anti-jitter `border-b-2 border-transparent` tabs, and desktop hover tooltips.
- SPDX Standard MIT License Provisioning (`LICENSE`, `package.json`): Installed official MIT License text with copyright attribution and package manifest metadata for automated GitHub `licensee` badge detection.
- Dynamic On-Demand Translation & Dual-Tier Language Hub (`/api/translate`, `src/hooks/queries/usePageTranslation.ts`, `src/components/reader/ReaderLanguageDrawer.tsx`): Zero-key Google Neural Machine Translation proxy with offline page-level caching, 18 popular language quick-select chips, 40+ language catalog, Bilingual Parallel reading mode with original sentence subtitles, and dynamic native neural voice narration synchronization with Read-Aloud.
- Co-Located Test Suite Expansion: Expanded unit and integration test coverage across all 100 test suites and 646 tests with 91.7% line coverage.

### Changed
- Bookshelf "All Saved for Offline" Status Notice (`src/components/presentation/BookshelfRack.tsx`): Converted from an interactive button to an accessible, non-clickable status notice (`role="status"`, `select-none`, `cursor-default`) positioned cleanly alongside the actionable "Clear Offline Shelf" button.
- Single Responsibility Refactor: Decomposed `ReaderHeader.tsx`, `HeroSearch.tsx`, `BookshelfRack.tsx`, and `app/read/[id]/page.tsx` into focused presentation components and headless custom hooks.
- Auth Return Contract: `signInWithPassword` in `useAuthStore.ts` returns the authenticated user object directly to eliminate React component closure lag during authentication.

### Fixed
- Fixed cross-device bookshelf count disparity by auto-upserting unsynced local volumes into Supabase upon cloud synchronization.
- Fixed stale auth user closure in `AuthModal.tsx` on sign-in and sign-up.
- Eliminated clipping and z-index overlap in book card and spine hover action tooltips via React DOM portal.


## [1.7.0] - 2026-09-02
### *Enterprise Security Hardening, Next.js 16 Proxy Migration & Performance Optimization*

### Added
- Zero-Dependency Sliding-Window Rate Limiter (`src/lib/rate-limiter.ts`): In-memory sliding window rate limiter protecting upstream Project Gutenberg APIs (60 req/min for search, 30 req/min for full-text) with standard `X-RateLimit-*` and `Retry-After` headers and automatic 30s garbage collection.
- Next.js 16 Edge Proxy Migration (`src/proxy.ts`, `src/proxy.test.ts`): Upgraded from deprecated `middleware.ts` to native Next.js 16 Edge `proxy.ts` convention with 100% co-located unit tests.
- Enterprise HTTP Security Headers (`next.config.ts`): Enforces HSTS (`max-age=63072000; includeSubDomains; preload`), Clickjacking protection (`X-Frame-Options: SAMEORIGIN`), MIME-sniffing defense (`X-Content-Type-Options: nosniff`), Referrer-Policy, and Permissions-Policy.
- SSRF & Path Traversal Immunity (`/api/books/content`): Upstream URL whitelisting (`isSafeUpstreamUrl`) restricting fetches strictly to official Project Gutenberg domains, strict numeric ID regex verification (`^\d{1,8}$`), and manual redirect handling.
- Open Redirect Sanitization (`/auth/callback`): Added `sanitizeRedirectPath` to secure OAuth and magic-link redirect paths against off-site phishing vectors.
- ReDoS Defense & LRU Pagination Cache (`src/lib/gutenberg-parser.ts`): Non-backtracking regular expressions (`[^\n]{0,80}`), bounded 120,000-character sampling windows, and a 500-entry LRU pagination cache for instant virtual page turns.
- Datacenter Proximity & Payload Compression (`vercel.json`): Pinned serverless execution to `iad1` (Washington D.C. / US-East) adjacent to Gutenberg/Gutendex nodes with `gzip, deflate, br` payload compression and HTTP Keep-Alive.
- Single-Source Route Registry (`src/config/routes.ts`): Type-safe centralized registry providing static paths (`ROUTES.HOME`, `ROUTES.ACCOUNT`, `ROUTES.CONFIRM_DELETION`, `ROUTES.BOOKSHELF`, `ROUTES.LIKES`) and dynamic builders (`ROUTES.READ(id)`, `ROUTES.VIEW(view)`).
- Site Branding & Storage Registry (`src/config/site-config.ts`): Consolidated canonical project links (`SITE_CONFIG`), upstream Gutenberg mirrors, and persistent storage keys (`STORAGE_KEYS`).
- Bookshelf Component Decomposition: Modularized `BookshelfRack.tsx` into single-responsibility sub-components (`BookshelfSpine.tsx`, `BookshelfMobileModal.tsx`, `BookshelfManageModals.tsx`) with 100% co-located tests.
- Account Settings Modularization & Route Migration: Migrated `/profile` to `/account` with modular sub-components in `src/components/account/` with 100% co-located tests.
- Order-Independent Dynamic Smart Search (`/lib/smart-search.ts`, `CollectionSearchBar.tsx`): Real-time, zero-network-latency client search engine for Bookshelf and Favorites supporting order-independent multi-token matching, diacritic insensitivity, instant clear button, and live counter badges.
- Unconstrained Viewport Cursor Tooltips (`BookCard.tsx`): Direct DOM body portaling (`createPortal`) of cursor-following tooltips tracking mouse coordinates at `+12px, +14px` across card edges without boundary clipping, dynamically swapping actions.
- Dynamic 3D Preview Modal Typography & Overflow Safeguard (`BookPreviewModal.tsx`): Directly composed shared `<BookCard />` on 3D flipper cover with responsive fluid typography, adaptive line-clamping, and scroll containment for long book titles without text truncation.
- Dynamic Active Icon Fills & Zero-Shift Header Hydration: Clean dynamic SVG fills for Bookshelf (`fill-primary`) and Favorites (`fill-destructive`) when containing saved items, eliminating text clutter and delivering 100% stable layouts (CLS = 0).
- Test Suite Expansion & 100% Quality Gateway: Expanded test suite to 66 suites and 428 focused, single-responsibility tests with 92.15% line coverage.

### Changed
- Codebase Orchestration: Reduced `BookshelfRack.tsx` from 861 to 389 lines (-55%) and `src/app/account/page.tsx` from 787 to 328 lines (-58%).
- Link & Storage Adoption: Replaced all scattered hardcoded routes and storage key strings across Navbar, Footer, BookCard, Bookshelf, Account, Reader, and Zustand stores with centralized configuration singletons.
- Audit Telemetry: Enhanced Pass 6 audit reporting in `scripts/verify-build.js` with detailed ESLint and Knip metrics and added `npm run audit:detailed`.

### Fixed
- Eliminated Next.js 16 middleware deprecation warning by migrating to proxy convention.
- Eliminated potential ReDoS vulnerabilities and event loop freezing during large text parsing.
- Fixed header layout shift and text reflow during client-side hydration.


## [1.6.0] - 2026-09-01
### *Dynamic Shelf Capacity, Mobile In-Shelf Modals, Reader Share & Dynamic Viewport Ergonomics*

### Added
- Dynamic Bookshelf Capacity Engine: `ResizeObserver`-driven physical book packing automatically scaling from 6-8 books on mobile up to 18-24 books on wide displays, eliminating empty side gaps.
- Mobile Tap-to-Activate In-Shelf Modal: Smooth interactive floating modal rendered directly within the active shelf niche on mobile without premature navigation.
- Reader Share Button: Integrated header share action copying volume direct links to clipboard via `navigator.clipboard` with tactile 2-second visual checkmark feedback.
- Mobile Dynamic Viewport Engine: Upgraded reader architecture to `h-[100dvh]` and `pb-[env(safe-area-inset-bottom)]`, preventing footers and pagination from being clipped by collapsing mobile browser address bars.
- Natural Author Name Formatting: Integrated `formatAuthorNames` for all desktop hover and mobile quick-action modal cards, transforming raw catalog strings into natural reading order.
- Profile Library Section Modernization: Renamed statistics to "Shelved Volumes", "Favorite Titles", and "Custom Shelves" with direct interactive routing to bookshelf and favorites views.

### Changed
- Bookshelf Alignment: Balanced center alignment across both mobile and desktop viewports (`justify-center px-4 sm:px-8`).
- Reader Modal Geometry: Centered Table of Contents (`ReaderTocDrawer`) and Reading Controls (`ReaderControls`) horizontally on mobile screens.
- Text Selection Ergonomics: Unlocked natural cursor highlighting and touch selection (`select-text`) for titles, authors, and book content across desktop and mobile.

### Fixed
- Fixed empty side gaps on wide screens caused by the legacy hardcoded 8-book shelf capacity limit.
- Fixed accidental instant reader navigation on mobile bookshelf spine taps by introducing the quick-action modal.
- Eliminated mobile address bar content overlap in paginated reading mode via dynamic viewport units (`dvh`).


## [1.5.0] - 2026-09-01
### *Account Security Lifecycle, In-App Password Generator & Email-Verified Deletion*

### Added
- Forgot Password Flow: Direct password reset email request interface within the authentication modal delivering secure one-time reset links via Supabase Auth.
- In-App Password Generator: Cryptographic high-entropy 16-character password generator button (`KeyRound`) with dual auto-fill and instant clipboard copy feedback.
- Live Password Strength Meter: Color-coded real-time complexity bar (Weak / Moderate / Strong) calculating entropy score across both Sign Up and Profile dashboard.
- Dual-Password Confirmation: Dedicated Confirm Password fields in Sign Up registration and Profile password changes with real-time mismatch validation.
- Email-Verified Account Deletion: Two-step deletion verification protocol with upfront guidance modal, one-time verification link, and final authorization at the `/auth/confirm-deletion` portal.
- Dedicated Deletion Portal (`/auth/confirm-deletion`): Standalone client portal verifying user identity, displaying destructive warnings, and purging cloud bookshelves, profiles, and active sessions.
- Accidental Clear Confirmation Modals: Tactile confirmation dialogs preventing accidental clearing of personal bookshelves or liked favorites.
- Literary Tagline Refresh: Updated footer literary attribution to "Crafted with care for book lovers everywhere".

### Changed
- `useAuthStore` Architecture: Added `resetPasswordForEmail`, `updatePassword`, `requestAccountDeletion`, and `deleteAccount` state handlers with deterministic session termination.

### Fixed
- Prevented password mismatch errors during registration and credential updates via simultaneous dual-input auto-fill.


## [1.4.0] - 2026-09-01
### *Classic Library Aesthetics, Tactile Hardwood Bookshelves & Cross-Theme Harmonization*

### Added
- Unified Bookcase Architecture: Integrated shelf back-wall alcove and solid hardwood timber rail into a single structural module, guaranteeing zero vertical air gap on desktop and smooth flush touch-scrolling on mobile.
- Convex 3D Spine Physics: Created `.book-spine-convex` multi-stop cylindrical specular lighting overlay simulating authentic curved hardcover spines and hinge creases.
- Hot-Foil Typography & Seals: Designed `.spine-emboss-gold` and `.spine-emboss-silver` text treatments with gilded headcap rules and embossed author volume stamps.
- Curated Library Palettes: Implemented 8 authentic bookbinding colorways (Oxblood Burgundy, Imperial Navy, Emerald Leather, Amber Saddle, Royal Plum, Aged Charcoal, Dark Teal, Espresso).
- Theme-Tailored Wood Railings: Added dedicated `.sepia .shelf-wood-ledge` (dark mahogany) and `.dark .shelf-wood-ledge` (charcoal walnut) with top specular bevel lines (`inset 0 1px 0`).
- Ambient Alcove Lighting: Added `.shelf-ambient-niche` soft radial spotlight vignette behind books across Light, Sepia, and Dark themes.
- Semantic Border Parity: Bound shelf container borders to 100% opacity theme tokens (`--border: #462e22` for Sepia, `#292524` for Dark) matching Profile page cards.

### Changed
- Hover Physics: Upgraded spine interaction to grounded pull-forward expansion (`origin-bottom scale-105`) with ambient drop shadow while preserving baseline alignment.
- Toolbar Ergonomics: Relocated shelf Rename and Delete action buttons to the right-aligned toolbar beside cloud sync status, preserving uniform shelf switcher tab sizing.

### Fixed
- Eliminated mobile horizontal scroll overflow where book spines previously extended beyond the bottom rail ledge.
- Fixed floating preview card reading percentage to accurately display 0% on page 1 of freshly opened books.


## [1.3.0] - 2026-09-01
### *Cloud Bookshelves, Multi-Category Indexing & Supabase Synchronization*

### Added
- Supabase PostgreSQL Cloud Sync: Bi-directional synchronization for custom named bookshelves and bookshelf items with Row Level Security (RLS) isolation.
- Master "General" Shelf: Aggregated view displaying all saved volumes across all custom collections with real-time volume counters.
- Floating "Move to Shelf" Dropdown: Instant shelf reassignment selector on spine hover cards with optimistic UI updates and background cloud persistence.
- Safe Shelf Deletion Workflow: Modal confirmation flow that automatically reassigns orphaned volumes back to the master "General" shelf before deleting the category.
- Custom Shelf Modals: Non-intrusive modal dialogs for creating, renaming, and deleting custom shelves with auto-focus inputs and validation.
- Guest-to-Cloud Migration: Automatic one-click sync that safely uploads local Zustand `localStorage` collections into Supabase upon user sign-in.

### Changed
- `useBookshelfStore` Architecture: Multi-shelf indexing with dynamic filtering, optimistic updates, and fallback handling for unassigned items.

### Fixed
- Fixed "Browse Catalog" button on empty shelf states to smoothly transition active view back to catalog browsing.
- Resolved shelf item mapping fallbacks for books saved prior to custom category creation.


## [1.2.0] - 2026-08-31
### *Multi-Volume Gutenberg Parser, Table of Contents & Reader Navigation*

### Added
- Multi-Volume Segmentation Engine: Intelligent detection and segmentation for multi-volume works (e.g. Volumes I-III, Books 1-12, Cantos, Acts, Tomes).
- Volume Selector Drawer: Quick drawer interface allowing readers to switch between individual volumes of multi-part works.
- Smart Chapter Heading Detector: Automatic Roman numeral, numbered, and titled chapter hierarchy parser.
- Table of Contents Drawer (`ReaderTocDrawer`): Accessible slide-out navigation with direct chapter jumps and active section tracking.
- Typography Preferences: Reader controls for font size scaling (12px-36px), line height adjustments (1.2-2.6), and serif/sans/monospace font families.
- Reader Drop-Cap Styling: Classic editorial initial-letter styling for opening chapter paragraphs.
- Verified Reader Profile (`/profile`): User account dashboard with reading statistics (saved volumes, liked titles, custom shelves) and atmosphere settings.

### Changed
- Progress Precision: Recalibrated reading progress tracking to strictly report 0% on page 1 with rounded integer percentages.
- Theme Engine: Full support for Light, Sepia (antique parchment), and Dark (midnight) modes with zero-CLS scrollbar stability (`scrollbar-gutter: stable`).

### Fixed
- Prevented premature reading completion flags when completing intermediate sub-volumes of multi-volume anthologies.
- Tiered Metadata Fallbacks: Implemented 4-tier resolution engine (static fixtures -> Zustand store -> REST API -> raw text headers) eliminating placeholder titles and authors.


## [1.1.0] - 2026-08-31
### *3D Interactive Catalog, Zero-Copyright Download Hub & Instant Discovery*

### Added
- 3D Interactive Book Rig: Realistic 3D perspective book cards (`.book-3d-rig`, `.book-3d-flipper`) with interactive hover opening physics.
- Zero-Copyright Download Hub: Client-side download drawer supporting EPUB, Plain Text (UTF-8), and Kindle (MOBI) formats directly from public domain mirrors.
- Instant & Remote Search: Dual-tier search combining debounced Gutendex API querying with instant local fuzzy filtering over featured library books.
- Topic & Language Drawers: Filtering drawers across genres (Fiction, Philosophy, Poetry, Science, History) and languages (English, French, German, Spanish, Italian, Latin, Ancient Greek).
- Literary Quote Banner: Dynamic rotator carousel featuring curated public domain passages and quotes.
- Back-to-Top Navigation: Floating action button with smooth window scroll restoration.

### Changed
- TanStack React Query Cache: Implemented 5-minute stale-time caching strategy with preloaded static fixtures for instant hero catalog rendering.


## [1.0.0] - 2026-08-30
### *Initial Scaffold, Public Domain Discovery & 7-Gateway Governance Engine*

### Added
- Core Next.js Architecture: Next.js App Router, React 19, and Tailwind CSS.
- Public Domain Integrity Layer: API route proxy (`/api/books`, `/api/books/content`) strictly enforcing `copyright=false` queries.
- Offline Focus Reader: In-browser focus reading surface with local storage progress persistence via Zustand.
- Testing Suite: Complete test suite with Vitest, MSW v2 network interception, and Testing Library (>= 80% coverage co-located with every component, hook, and store).
- 7-Gateway Quality Engine (`scripts/verify-build.js`): Automated pre-commit verification pipeline enforcing secret prevention, type checking, unit tests, coverage floor, living docs sync, ADR schema validation, ESLint/Knip audits, and Next.js production builds.
- Living Documentation: AST-driven architecture matrix parser (`scripts/generate-architecture-matrix.js`) and ADR decision ledger (`docs/DECISIONS.md`).

---

## Architectural Decision Records (ADRs)
The following key architectural decisions are recorded in [`docs/DECISIONS.md`](docs/DECISIONS.md):
- **ADR-001: Next.js 15 App Router & React 19 Adoption**
- **ADR-002: Public Domain Zero-Copyright Enforcement**
- **ADR-003: Zustand for Offline Bookshelf and Reader State**
- **ADR-004: TanStack React Query for Server Data Caching**
- **ADR-005: Supabase Authentication & Cloud Bookshelf Synchronization with Progressive Enhancement**
- **ADR-006: Tactile Hardwood Bookshelves & 3D Convex Book Spine Physics**
- **ADR-007: Single-Source Type-Safe Route Registry & Configuration Singletons**
- **ADR-008: Order-Independent Multi-Token Client Smart Search Engine**
- **ADR-009: Stepped Directional Scroll with User-Configurable Sticky Preferences**
- **ADR-010: Universal Multi-Language Translations & Reader Handoff Engine**
- **ADR-011: Zero-CLS Header Hydration & Dynamic Active Icon Fill Architecture**
- **ADR-012: Unified Portaled Drawer Architecture & Mutual Exclusivity for Reader Modals**
- **ADR-013: Headless Continue Reading Ledger, Authentic Telemetry & Two-Way Metadata Synchronization**
- **ADR-014: Deletion Tombstones, Cloud Reading Progress Synchronization & Persistent Worker Architecture**
- **ADR-015: Adoption of Privacy-First Vercel Web Analytics and Real User Speed Insights**

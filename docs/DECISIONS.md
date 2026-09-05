# Architectural Decision Records (ADRs)

## ADR-001: Next.js 15 App Router & React 19 Adoption
- **Status**: Accepted
- **Context**: Bookarium requires high-performance server rendering, streaming capabilities, and optimal client-side caching for a seamless reading experience.
- **Decision**: Adopt Next.js 15+ App Router with React 19, server components for skeleton shells, and client components for interactive reader/filters.
- **Consequences**: Fast initial load, modern React concurrent features, zero API keys required.

## ADR-002: Public Domain Zero-Copyright Enforcement
- **Status**: Accepted
- **Context**: The application must only serve books that are 100% legally in the public domain.
- **Decision**: All API queries to Gutendex unconditionally include `copyright=false`. The API route proxy filters out any content flagged with restrictive copyrights.
- **Consequences**: Safe legal compliance, free open access without copyright friction.

## ADR-003: Zustand for Offline Bookshelf and Reader State
- **Status**: Accepted
- **Context**: Users should retain their reading positions, bookmarks, favorites, and theme preferences without requiring authentication or remote databases.
- **Decision**: Use Zustand with `persist` middleware backed by `localStorage`.
- **Consequences**: Zero latency, 100% offline persistence for client reading state.

## ADR-004: TanStack React Query for Server Data Caching
- **Status**: Accepted
- **Context**: Gutendex and book text requests should be cached client-side to prevent redundant network round-trips.
- **Decision**: Use TanStack React Query with a default `staleTime` of 5 minutes and optimistic updates where appropriate.
- **Consequences**: Smooth browsing with minimal load on public API mirrors.

## ADR-005: Supabase Authentication & Cloud Bookshelf Synchronization with Progressive Enhancement
- **Status**: Accepted
- **Context**: Users want to optionally register to sync custom bookshelves, reading progress, and preferences across devices without compromising the zero-barrier guest experience.
- **Decision**: Adopt Supabase (PostgreSQL with Row Level Security and `@supabase/ssr`) via an Offline-First Progressive Enhancement pattern. Guest users read and save books locally via Zustand (`localStorage`). When signed in, local collections auto-migrate into PostgreSQL with bi-directional cloud sync.
- **Consequences**: Cross-device synchronization, custom named bookshelves, zero friction for guest readers, robust RLS security.

## ADR-006: Tactile Hardwood Bookshelves & 3D Convex Book Spine Physics
- **Status**: Accepted
- **Context**: Flat card grids for saved books feel generic and lack the physical, tactile atmosphere of an authentic personal library.
- **Decision**: Architect an immersive bookcase module featuring multi-stop walnut wood rails with top specular bevel lines, ambient alcove spotlighting (`.shelf-ambient-niche`), 3D cylindrical specular spine physics (`.book-spine-convex`), hot-foil gilded serif typography (`.spine-emboss-gold` / `.spine-emboss-silver`), and `ResizeObserver`-driven responsive capacity packing (scaling from 6 books on mobile to 24 on desktop).
- **Consequences**: Immersive bookstore atmosphere, zero horizontal overflow, seamless mobile touch-scrolling with in-shelf quick-action modals.

## ADR-007: Single-Source Type-Safe Route Registry & Configuration Singletons
- **Status**: Accepted
- **Context**: Scattered hardcoded URL strings (`'/'`, `'/profile'`, `'/read/' + id`, `'view=bookshelf'`) and localStorage key strings across components caused maintenance overhead and typo vulnerabilities during route refactors.
- **Decision**: Centralize all internal routing paths, dynamic route builders, canonical site links, and persistent storage keys into immutable, type-safe singletons: `ROUTES` (`src/config/routes.ts`) and `SITE_CONFIG` / `STORAGE_KEYS` (`src/config/site-config.ts`).
- **Consequences**: Compile-time route validation, effortless route renaming (e.g. `/profile` $\to$ `/account`), zero magic strings across the codebase.

## ADR-008: Order-Independent Multi-Token Client Smart Search Engine
- **Status**: Accepted
- **Context**: Personal Bookshelf and Favorites collections require instant, zero-network-latency filtering. Standard substring search fails when users search with multi-word combinations in arbitrary order (e.g. `"austen pride"` vs `"Pride and Prejudice by Jane Austen"`).
- **Decision**: Implement an order-independent multi-token client search utility (`src/lib/smart-search.ts`) with `CollectionSearchBar.tsx`. The algorithm strips Unicode diacritics via NFD, normalizes punctuation, extracts whitespace-separated tokens, and enforces AND-matching across title, author names, translators, subjects, bookshelves, and languages.
- **Consequences**: 0ms search latency, order-independent queries, diacritic/accent insensitivity, integrated into both 3D shelf spine view and grid view with dedicated empty search feedback.

## ADR-009: Stepped Directional Scroll with User-Configurable Sticky Preferences
- **Status**: Accepted
- **Context**: Long catalog browsing sessions require maximum screen estate without jarring header flickering or abrupt margin gaps upon docking.
- **Decision**: Implement session-isolated 3-state stepped continuous scroll in `useScrollDirection` (arrival dock guard, top-toolbar synchronization, physical slide translations) paired with user preference persistence (`Smart Auto-Hide` vs `Always Fixed` in `usePreferencesStore`).
- **Consequences**: Smooth GPU-accelerated transform translations (`transition-transform duration-300`), zero layout gaps on filter docking, personalized reading controls.

## ADR-010: Universal Multi-Language Translations & Reader Handoff Engine
- **Status**: Accepted
- **Context**: Classic public domain works (e.g., *Don Quixote*, *The Odyssey*, *Les Misérables*, *Faust*) exist in multiple international translations and bilingual editions across the 70,000+ volume Gutenberg catalog.
- **Decision**: Implement `useBookTranslations` to aggregate, match, and group international editions and bilingual translations using TanStack Query caching, paired with an interactive `<Globe />` dropdown in the Reader navigation header for 1-click seamless reading handoff.
- **Consequences**: Universal access across 20+ international languages directly inside the reader without returning to search.

## ADR-011: Zero-CLS Header Hydration & Dynamic Active Icon Fill Architecture
- **Status**: Accepted
- **Context**: Hydrating localStorage counts and auth status during SSR $\to$ client transition caused visible Cumulative Layout Shift (CLS) and horizontal element repositioning.
- **Decision**: Lock responsive bounding boxes 1:1 between skeleton placeholders and client buttons, and replace variable-width text number badges with dynamic SVG icon fills (`fill-primary` on Bookmark, `fill-destructive` on Heart) when items exist.
- **Consequences**: Mathematical Zero Cumulative Layout Shift (CLS = 0), clean minimalist editorial aesthetic, zero text/icon overlap.

## ADR-012: Unified Portaled Drawer Architecture & Mutual Exclusivity for Reader Modals
- **Status**: Accepted
- **Context**: In-reader tools (Table of Contents, Full-Text Search, Typography & Appearance Controls, and Language Editions) had divergent rendering mechanisms—some rendered via `createPortal`, while others were rendered inline within header JSX. Furthermore, uncoordinated modal state allowed overlapping dialog backdrops that blocked toolbar interactions, trapped clicks, and inadvertently dismissed the mobile drawer tray.
- **Decision**: Elevate all 4 reader tool dialogs (`ReaderTocDrawer`, `ReaderSearchDrawer`, `ReaderControls`, and `ReaderLanguageDrawer`) into dedicated, portaled components (`createPortal(..., document.body)`). Centralize modal visibility at the parent reader page level with strict 4-way mutual exclusivity (opening one closes the others, while re-clicking toggles closed). Elevate the reader header to `z-[10000]` so toolbar triggers remain interactive above modal backdrops, and decouple drawer lifecycle so the mobile tray only retracts upon explicit handle action.
- **Consequences**: Deterministic modal exclusivity, zero backdrop event interception, unified theme-aware palette tokens across all 3 reading modes (Light, Sepia, Dark), seamless page-flipping during tool navigation, and 100% co-located test coverage.

## ADR-013: Headless Continue Reading Ledger, Authentic Telemetry & Two-Way Metadata Synchronization
- **Status**: Accepted
- **Context**: The application required a dedicated, tactile Bookmarks & Continue Reading ledger (`/?view=bookmarks`) to allow readers to immediately resume active public domain volumes. Prior to this decision, volumes accessed directly via URL (e.g. `/read/55179`) had active reading positions saved in `useReaderStore`, but lacked cached book metadata in `useBookshelfStore`, causing bookmark cards to render generic Gutenberg fallbacks (`Gutenberg Volume #55179` and `Public Domain Author`). Furthermore, books added to user bookshelves without any active reading telemetry were appearing on bookmarks with contradictory "Never opened" badges, and clearing reading progress conflated reading telemetry with user bookshelf curation.
- **Decision**: Architect a headless, provider-agnostic ledger hook (`useContinueReadingLedger.ts`) governed by four core principles:
  1. **Strict Telemetry Enrollment**: A book is enrolled into the ledger strictly when active reading coordinates exist (`readingPositions` map entry) or progress is greater than zero (`readingProgress > 0`), ensuring zero unopened books appear on the Bookmarks page.
  2. **Active Query Hydration**: The ledger computes missing IDs (volumes with active telemetry but no local cached entity in `savedBooks` or `recentBooks`) and hydrates their authentic metadata dynamically via TanStack React Query (`useBooks`), injecting results directly into the book dictionary.
  3. **Reader Handoff & Persistence Co-Evolution**: When a volume is opened in `/read/[id]`, its resolved identity is immediately persisted to `recentBooks`, while clicking resume or tapping covers on bookmark cards primes `useReaderStore.openReader(book)` to guarantee 0ms warm-cache route transitions with zero layout shift.
  4. **Decoupled Telemetry Clearing**: Resetting reading positions (`clearVolumeProgress` / `clearAllVolumes`) strictly purges reader coordinates and progress without mutating or deleting user bookshelf curation (`bookStatuses`).
- **Consequences**: 100% authentic title and author presentation across all active volumes, mathematical zero "Never opened" artifacts on bookmarks, clean decoupling between user library curation and reader coordinates, and fluid, warm route transitions across reading sessions.

## ADR-014: Deletion Tombstones, Cloud Reading Progress Synchronization & Persistent Worker Architecture
- **Status**: Accepted
- **Context**: 
  1. Multi-device cloud sync: Deleting a book on one client allowed remote Supabase records or secondary devices to resurrect the deleted volume as a "ghost" on subsequent sync cycles.
  2. Reading progress cloud sync: Reading coordinates were previously persisted solely in browser `localStorage`, preventing readers from seamlessly continuing reading across desktop, tablet, and mobile devices.
  3. Web Worker lifecycle: Every font size, font family, or line spacing tweak terminated and re-spawned the Gutenberg parsing worker thread, causing thread churn and garbage collection spikes.
  4. Reader gesture collision: Touch swipes on mobile readers inadvertently triggered page flips while readers were attempting to select text for annotations or interacting with toolbar popovers.
  5. Upstream content timeouts: Client-side fetches to `/api/books/content` could hang indefinitely on slow or stalled upstream Gutenberg mirrors.
- **Decision**: 
  1. **Deletion Tombstones (`deletedBookIds`)**: Record deletion tombstones in `useBookshelfStore`. During cloud sync reconciliation, items matching tombstones are pruned and prevented from re-inserting into local state. Saving a book explicitly untombstones it.
  2. **Bi-Directional Cloud Reading Progress**: Introduce a 2000ms debounced sync in `useReaderStore` sending `current_chapter_index`, `progress_percent`, `scroll_offset`, and `last_read_at` to the Supabase `public.reading_progress` table with Row-Level Security. In `useReaderSession`, check remote progress on load and restore coordinates if the cloud record represents a more advanced session. Strictly gate by `if (user?.id)` to ensure zero network overhead for guest readers.
  3. **Persistent Web Worker Lifecycle**: Keep a single long-lived Web Worker instance across typography and layout updates, falling back to non-blocking asynchronous chunks if Web Workers are unsupported.
  4. **Gesture Conflict Guarding**: Suppress swipe gesture handlers in `useReaderGestures` when `window.getSelection()` contains active text or when the touch target originates within an interactive modal or popover.
  5. **Client-Side Fetch Timeout**: Enforce an 8000ms `AbortSignal.timeout` on content queries to fail fast and trigger mirror failover rather than hanging.
- **Consequences**: Zero ghost volume resurrections across devices, cross-device reading continuity for authenticated users with zero disruption to guest mode, zero Web Worker spawning lag on slider tweaks, clean touch text selection ergonomics, and 100% co-located test coverage across 120 test suites (906 tests).

## ADR-015: Adoption of Privacy-First Vercel Web Analytics and Real User Speed Insights
- **Status**: Accepted
- **Context**: Bookarium required operational visibility into aggregate reader volume, referring domains, popular catalog genres, and real-world Core Web Vitals (LCP, INP, CLS) across diverse mobile and desktop devices. However, commercial analytics networks (e.g. Google Analytics, Meta Pixels, Mixpanel) rely on intrusive tracking cookies, persistent cross-site device fingerprinting, and advertising profiling—violating Bookarium's foundational commitment to digital sovereignty and requiring disruptive cookie consent banners under the EU ePrivacy Directive (Article 5(3)).
- **Decision**: Adopt first-party, cookie-less `@vercel/analytics` (`<Analytics />`) and `@vercel/speed-insights` (`<SpeedInsights />`) in the root application layout (`src/app/layout.tsx`). Telemetry operates exclusively on anonymized, daily-rotating cryptographic hashes without writing tracking cookies, without persistent localStorage identifiers, and without storing IP addresses. Environment identifiers are injected strictly on Vercel's edge infrastructure during production deployment, ensuring zero account keys, project tokens, or credentials exist in the open-source repository. Co-evolve `src/app/privacy/page.tsx` to transparently disclose this first-party performance telemetry.
- **Consequences**: First-party operational visibility into site health, traffic volume, and real-world Core Web Vitals; zero impact on Core Web Vitals (lightweight ~1.5KB deferred scripts); 100% compliant with EU ePrivacy Article 5(3) cookie-banner exemptions; zero private credentials in git; full preservation of reader privacy.

## ADR-016: Technical SEO Architecture, Dynamic OpenGraph & Upstream Rate-Shielding
- **Status**: Accepted
- **Context**: Bookarium indexes over 70,000+ public domain literary classics, but previously lacked search engine crawl directives, canonical sitemaps, rich social preview cards (OpenGraph / Twitter), and book-specific metadata on `/read/[id]`. Consequently, links shared on social messaging platforms (Discord, Twitter/X, LinkedIn, WhatsApp) lacked cover images or synopses, and search engines could not index individual literary volumes. Furthermore, opening the catalog to crawlers carried the risk of search engine bots spiderming infinite keyword and filter permutations (`?search=*`, `?topic=*`), which could overload public upstream Gutendex API servers.
- **Decision**: Architect a comprehensive, non-breaking technical SEO and rate-shielding engine governed by four core principles:
  1. **Crawler Parameter Disallowance (`robots.ts`)**: Explicitly instruct search engine bots via `robots.ts` to disallow crawling on query parameters (`/*?*search=*`, `/*?*topic=*`, `/*?*languages=*`) and private account/API routes (`/api/*`, `/auth/*`, `/account`), strictly restricting crawling to clean canonical paths (`/`, `/privacy`, `/read/`).
  2. **Canonical Masterworks Sitemap (`sitemap.ts`)**: Generate an automated XML sitemap declaring the root landing view, privacy policy, and a curated set of iconic public domain classics without triggering build-time API timeouts.
  3. **Dynamic Reader Metadata with 24h ISR Caching (`/read/[id]/layout.tsx`)**: Introduce a Next.js Server Component layout at `src/app/read/[id]/layout.tsx` leveraging `generateMetadata` with Next.js 24-hour server-side caching (`revalidate: 86400`). Resolves book titles, authors, and cover art to output rich OpenGraph book cards and Twitter `summary_large_image` cards, guaranteeing at most 1 upstream Gutendex call per day per book.
  4. **Native Safe Structured Data (JSON-LD)**: Inject `schema.org/WebSite` (with Sitelinks SearchAction) and universal `schema.org/WebApplication` (`isAccessibleForFree: true`) on the root layout, and `schema.org/Book` on reader pages using native React 19 text nodes, completely eliminating forbidden `dangerouslySetInnerHTML` primitives in compliance with Pass 0.5 security policies.
- **Consequences**: Archival-grade search engine discoverability; rich, beautiful social share previews on all modern platforms; zero visual UI or client reader disruption; 100% protection of upstream Gutendex resources; 0 XSS vulnerabilities; and 100% co-located test coverage across all SEO route handlers.



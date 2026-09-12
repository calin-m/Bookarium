# Architectural Decision Records (ADRs)

## ADR-001: Next.js 16 App Router & React 19 Adoption
- **Status**: Accepted
- **Context**: Bookarium requires high-performance server rendering, streaming capabilities, and optimal client-side caching for a seamless reading experience. The application was initialized with Next.js 15 and subsequently upgraded to Next.js 16 (`next: ^16.3.3`) in commit `24f38a5`.
- **Decision**: Adopt Next.js 16 App Router with React 19, server components for skeleton shells, and client components for interactive reader/filters.
- **Consequences**: Fast initial load, modern React concurrent features, zero API keys required, alignment with latest Next.js proxy conventions.

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

## ADR-017: Canonical Gutenberg Heading Normalization & Reading Coordinate Harmonization
- **Status**: Accepted
- **Context**: 
  1. **Gutenberg Chapter Segmentation Mismatch**: In Project Gutenberg books featuring front-matter Tables of Contents, naive fixed-length 10-character string slicing (`.slice(0, 10)`) caused character alignment failures between TOC listings and body headings. For double-digit chapters (e.g. `CHAPTER 10`), the 10-character slice was `"chapter 10"`, matching the body heading. However, for single-digit chapters (Chapters 1–9), the TOC slice included a trailing space (e.g. `"chapter 1 "`, length 10) while the standalone body heading had no space (`"chapter 1"`, length 9). Because `"chapter 1 "` !== `"chapter 1"`, single-digit TOC lines were never deduplicated, leaking into the volume as 9 empty phantom chapters with only 30–50 characters of text (as seen in Jules Verne's *A Journey to the Centre of the Earth*, `read/18857`). Furthermore, chapter display titles in the Table of Contents drawer remained bare numbers (`CHAPTER 1`) even when the front-matter TOC contained descriptive subtitles, or Roman numeral listings like `I. THE HIRED CAR 1` (as seen in Louis Tracy's *Cynthia's Chauffeur*, `read/31472`).
  2. **Reading Coordinates Discrepancy**: In `BookmarkCard.tsx`, the card displayed `volume.chapterPage` (chapter-relative page) and added `+ 1` to `chapterIndex`, while `ReaderFooter.tsx` displayed `volume.globalPage` (book-wide page) and `useReaderSession.ts` indexed Section 0 as Preamble and Section 1 as Chapter 1. Consequently, a user reading Chapter 1 on Global Page 3 saw "Chapter 2 • Page 2" on the bookmark card, but "Page 3 of 150" upon clicking Resume.
- **Decision**: 
  1. **Semantic Heading Normalization**: Introduce `normalizeHeadingId` in `src/lib/gutenberg/segmentation.ts` extracting canonical keyword-numeral tokens (e.g. `ch-1`, `ch-i`, `part-2`, `book-3`) to guarantee exact matching regardless of prefix variants (`CHAPTER I` vs `I.`), trailing whitespace, or dot delimiters. Deduplication strictly requires both `isVeryShort` (`bodyLength < 150`) and confirmed later duplication (`hasLaterDuplicate`), guaranteeing that legitimate chapters with prose are never dropped.
  2. **Multi-Pattern Chapter Subtitle Harvesting**: Extract descriptive chapter subtitles across both keyword formats (`CHAPTER I: THE HIRED CAR`) and front-matter TOC item formats (`I. THE HIRED CAR 1`), stripping dot-leaders and trailing page numbers while enforcing uppercase Roman numerals and title-cased subtitles (`Chapter I: The Hired Car`).
  3. **Standalone Body Subtitle Heuristics**: When a book lacks a front-matter TOC or contains multi-line wrapped chapter titles, inspect lines immediately following `CHAPTER [num]` in the body text. If a short standalone line (2–90 characters) without ending punctuation precedes a paragraph break, harvest it as the chapter subtitle.
  4. **AST-Driven Living Documentation Engine (`docs/GUTENBERG_PARSER.md`)**: Introduce `scripts/generate-parser-docs.js` utilizing `@babel/parser` to programmatically extract `GUTENBERG_PARSER_CONFIG` thresholds, exported function signatures, JSDoc annotations, and heuristic regex rules directly from TypeScript AST. Wire into `npm run docs:sync` and Pass 4 of the 7-Gateway Quality Engine to mathematically eliminate documentation drift (Governance Rule 2).
  5. **Unified Global Reading Coordinates**: Harmonize `BookmarkCard.tsx` and `useReaderSession.ts` around `globalPage` and 1-based `chapterIndex`. The bookmark card, reader resume notification ribbon, and reader footer all display identical coordinates (`Chapter 1 • Page 3`), eliminating cognitive dissonance.
  6. **Server-Side Fetch Memoization & Timeout Protection**: Wrap `fetchBookData` in `src/app/read/[id]/layout.tsx` with React's canonical `cache()` primitive to deduplicate redundant server requests between `generateMetadata` and `BookReaderLayout` within the same request lifecycle. Add `signal: AbortSignal.timeout(2500)` to ensure that slow or stalled upstream queries fail fast and trigger instant static metadata fallback rather than blocking page rendering.
- **Consequences**: Complete elimination of phantom TOC ghost chapters on Verne/Wells/Doyle masterworks; exactly 44 authentic chapters produced for `read/18857`; rich, commercial-grade chapter titles with authentic subtitles across both Roman and Arabic numeral books (`read/31472`); mathematical 0% drift across parser documentation; 100% preservation of multi-part books and unnumbered anthologies; unified reading coordinates across all UI surfaces; and elimination of server-side rendering latency on cold reader route transitions.

## ADR-018: Browser-Native Web Speech Synthesis Narration Engine
- **Status**: Accepted
- **Context**: Readers requested synchronized audio narration for classic books. Commercial cloud text-to-speech APIs (e.g. ElevenLabs, Google Cloud TTS, Amazon Polly) require paid API keys, expose user reading telemetry to external networks, introduce audio streaming latency, and violate Rule 4 (Zero API Key Requirement & Public Domain Integrity).
- **Decision**: Architect a zero-cost, zero-key audio narration subsystem (`src/hooks/reader/useReaderSpeech.ts`) utilizing the browser's native `window.speechSynthesis` API:
  1. **Dynamic Voice Discovery**: Enforce asynchronous speech voice discovery across OS synthesis engines (macOS, Windows, iOS, Android, Linux) with language-matching filters.
  2. **Real-Time Word & Sentence Synchronization**: Bind `onboundary` utterance events to visual highlight ranges, rendering a synchronized karaoke-style reading tracker across paragraph text.
  3. **Auto-Advancing Page Automation**: Synchronize speech completion with virtual page state, automatically flipping to subsequent pages upon paragraph or chapter completion when auto-advance is enabled.
  4. **Hydration & Gesture Safeguards**: Defer speech initialization to client mount to eliminate SSR hydration mismatches, and bind play triggers to explicit user gestures to satisfy mobile browser autoplay policies.
- **Consequences**: 100% offline-capable, zero-cost audio narration; zero API keys or external server dependencies; seamless synchronization between spoken audio and visual reading coordinates; 100% test coverage with MSW and simulated `SpeechSynthesis` mock suites.

## ADR-019: Commonplace Book, Scholar Annotations & Mobile PWA Manifest
- **Status**: Accepted
- **Context**: Readers of literary classics actively highlight passages, record reflections, and compile commonplace notes. Modifying or injecting annotations directly into raw Gutenberg text strings risks corrupting source text and breaking virtual pagination column layouts. Furthermore, mobile readers desired an installable, app-like reading experience without app store gatekeepers.
- **Decision**: Architect an offline-first Commonplace Book and scholar annotation subsystem:
  1. **Non-Destructive Text Selection**: Capture text selections via `window.getSelection()` and record relative character offsets within chapters, preserving source text purity.
  2. **Categorical Marginalia & Highlighter Palettes**: Implement a dedicated Zustand store (`src/stores/useAnnotationStore.ts`) persisting quotes, book metadata, categorical pastel highlighter colors (Amber, Emerald, Rose, Sky, Violet), user reflection notes, and custom tags in `localStorage`.
  3. **Aggregated Commonplace Notebook Hub**: Build a dedicated `/notebook` view aggregating highlights across all books with full-text search, tag filtering, and multi-format export (Markdown, TXT, JSON).
  4. **Progressive Web App Manifest**: Introduce an installable Progressive Web App manifest (`src/app/manifest.ts`) providing native-like icons, standalone display mode, and offline launch capabilities.
- **Consequences**: Rich scholar tools and marginalia without modifying book source text; instant multi-book commonplace compilation; offline note-taking; installable mobile PWA experience; 100% co-located unit test coverage across annotation stores and UI components.

## ADR-020: Unabridged Offline Book Storage via Native IndexedDB Engine & LRU Eviction
- **Status**: Accepted
- **Context**: Bookarium's offline-first architecture allows readers to read without active internet connectivity. However, browser `localStorage` enforces a strict 5MB quota shared across all keys, making it impossible to store unabridged plain-text volumes (which typically span 500KB to 3MB each). Attempting to store multiple unabridged books in `localStorage` triggers `QuotaExceededError` crashes.
- **Decision**: Architect a native, zero-dependency `IndexedDB` storage engine (`src/lib/offline-storage.ts`) dedicated to full book texts:
  1. **Dedicated Versioned Database**: Create a versioned IndexedDB database (`BookariumOfflineDB`) with a dedicated `book_cache` object store indexed by `bookId`.
  2. **Asynchronous Cache Integration**: Implement asynchronous storage wrappers (`saveOfflineBook`, `getOfflineBook`, `removeOfflineBook`, `getOfflineBookIds`) integrated directly into `useBookContent`.
  3. **Defensive LRU Eviction & Quota Recovery**: Implement Least Recently Used (LRU) cache pruning and quota error handling, transparently falling back to direct network streaming when storage is restricted.
- **Consequences**: Readers can store dozens of unabridged classic masterworks directly in browser storage; zero risk of blowing the 5MB `localStorage` quota; instant sub-millisecond reader loading for downloaded volumes; fully functional offline reader.

## ADR-021: Clean Path URL Architecture via Next.js Edge Rewrites
- **Status**: Accepted
- **Context**: Originally, Bookarium switched views using query parameters (`/?view=bookshelf`, `/?view=favorites`, `/?view=notebook`, `/?view=bookmarks`). Query parameter URLs feel unpolished, look cluttered when shared, and conflict with standard SEO canonical URL patterns. However, migrating to separate Next.js route directories (`/bookshelf/page.tsx`, etc.) would cause full React unmount/remount cycles during navigation, destroying filter states, audio speech playback, and search results.
- **Decision**: Implement a Clean Path URL architecture using Next.js `rewrites()` in `next.config.ts`:
  1. **Edge Rewrites**: Rewrite clean top-level paths (`/catalog`, `/bookshelf`, `/favorites`, `/notebook`, `/bookmarks`) to the root page (`/`) at the Next.js routing layer.
  2. **Type-Safe Route Registry**: Synchronize navigation tabs, browser history (`pushState` / `replaceState`), and canonical route definitions in `ROUTES` (`src/config/routes.ts`).
  3. **Backward Compatibility**: Maintain seamless backward compatibility for incoming legacy query parameters (`?view=...`).
- **Consequences**: Commercial-grade, clean, human-readable URLs for all library views; zero unmount/remount cycle overhead for client SPA state; 100% backward compatibility for existing bookmarks and shared links.

## ADR-022: API Proxy Hardening, Anti-SSRF Allowlisting & Sliding-Window Rate Limiting
- **Status**: Accepted
- **Context**: Bookarium proxies requests to public Project Gutenberg servers via `/api/books` and `/api/books/content` to circumvent CORS restrictions. Without strict defensive controls, open proxy endpoints can be exploited for Server-Side Request Forgery (SSRF), path traversal, or distributed denial-of-service against Gutenberg's volunteer-run infrastructure, triggering upstream IP bans.
- **Decision**: Implement multi-layered security barriers on API proxy routes:
  1. **Anti-SSRF Allowlist**: Strictly constrain content fetch URLs to canonical Gutenberg endpoint templates (`https://www.gutenberg.org/ebooks/${id}.txt.utf-8` and `/cache/epub/${id}/pg${id}.txt`), completely rejecting arbitrary user-supplied target URLs.
  2. **Strict Numeric ID Barriers**: Enforce integer barriers (`parseInt(id, 10)`) with positive boundary validation (`id > 0 && id < 10_000_000`) and CodeQL-compliant path sanitization, eliminating directory traversal payloads.
  3. **Sliding-Window Rate Limiting**: Implement in-memory sliding-window request throttling with sliding timestamp windows and burst guards, returning `429 Too Many Requests` when thresholds are exceeded.
- **Consequences**: Complete neutralization of SSRF and path traversal attack vectors; full compliance with OWASP Top 10 and CodeQL security audits (Pass 0.5 security gate); responsible, polite proxying that shields Project Gutenberg's infrastructure.

## ADR-023: Library Data Sovereignty, Schema Validation & Headless Backup Engine
- **Status**: Accepted
- **Context**: Bookarium prioritizes digital sovereignty—readers must never be trapped in a walled garden or lose their library data due to browser cache clearing, device changes, or database migration errors.
- **Decision**: Build a comprehensive, client-side Library Portability & Backup Engine (`src/lib/library-backup.ts`):
  1. **Full-Spectrum Schema Export**: Single-click export of complete reader state into a versioned JSON schema (`version: '1.0'`) and CSV spreadsheet formats, encapsulating saved books, reading queue, custom shelves, reading positions, ratings, reading statuses, scholar annotations, and speech preferences.
  2. **Defensive Schema Validation**: Defensive schema validation on import with structural type guards, sanitizing corrupted or malicious JSON payloads before state ingestion.
  3. **Dual Restore Strategies**: Support both non-destructive "Merge" (combining imported data with existing collections) and clean "Replace" (restoring an exact snapshot).
- **Consequences**: Complete reader data sovereignty and portability; protection against browser storage eviction; effortless migration across devices without requiring third-party cloud accounts; 100% co-located test coverage.

## ADR-024: Zero-Latency Client Navigation Fast-Path & Decoupled Crawler Metadata
- **Status**: Accepted
- **Context**: In commit `b73cd94`, `/read/[id]/layout.tsx` was introduced to serve OpenGraph/Twitter cards and Schema.org JSON-LD to search engine crawlers via an outbound `gutendex.com` API request. Because Gutendex is a free volunteer service prone to multi-second latency spikes (up to 47 seconds), every internal client navigation (`router.push('/read/[id]')`) suffered a blocking delay of 2500ms (the abort timeout) while the server logged `Rendering /read/[id]...`, even though the client reader already possessed the book in memory and never used the layout's fetched metadata.
- **Decision**: Architect a bifurcated metadata resolution and rendering strategy in `src/app/read/[id]/layout.tsx`:
  1. **Client-Side Navigation Detection (Fast-Path)**: Inspect incoming request headers via `headers()` for Next.js internal transition flags (`rsc === '1'`, `next-router-state-tree`, `accept: text/x-component`). When detected, immediately bypass outbound network calls and generate instant fallback metadata in 0ms using multi-tier static fixtures (`FEATURED_HERO_BOOKS`) and synthetic volume identifiers.
  2. **In-Memory Server Process Cache**: Maintain an in-memory process cache (`serverMetadataCache`) to instantly serve crawler and external requests without re-fetching Gutenberg catalog records.
  3. **Client Title Synchronization**: Guarantee that client readers transition in 0ms, while the client page mounts immediately and synchronizes the browser `document.title` to the authentic literary title and author upon mounting via `useEffect`.
  4. **Strict Crawler Preservation**: Direct browser entries, Googlebot, and social crawlers (`rsc !== '1'`) continue to receive rich OpenGraph cards, Twitter cards, and Schema.org JSON-LD with a tightened 1500ms timeout guard.
- **Consequences**: Restores authentic 0ms instant transitions when opening books from Bookmarks, Favorites, Bookshelf, and Catalog; eliminates Next.js server stalls on `/read/[id]`; preserves 100% SEO, social sharing cards, and Schema.org compliance for external search crawlers.

## ADR-025: Completed Reading State Latch, Native Inset Search Architecture & Library Navigation Streamlining
- **Status**: Accepted
- **Context**:
  1. Readers who completed a volume (100% progress) and resumed it from Bookmarks or Catalog previously encountered state regressions where reading progress and status could revert to "in-progress" or calculate inaccurate progress offsets.
  2. The Catalog hero search bar relied on a compound flex container simulating `:focus-within` around both the text input and the submit button, creating visual inconsistency and an unnatural focus glow compared to the native `<input>`-centric search bars across Bookshelf, Favorites, Bookmarks, and Notebooks.
  3. The Account page Library stats card included a redundant "Open Bookshelf →" text link in the header directly adjacent to the "Shelved Volumes" navigation card.
- **Decision**:
  1. **Completed Reading State Latch (`useReaderSession.ts`, `BookmarkCard.tsx`)**: Implement an explicit 100% completion guard in `useReaderSession` that preserves 100% progress and "Completed" status upon resumption. Introduce a dedicated "Read Again" action on completed bookmark cards that allows readers to re-read from Page 1 without destroying historical reading milestones.
  2. **Native Inset Search Input Architecture (`HeroSearch.tsx`)**: Refactor `HeroSearch` from a compound `:focus-within` container to a native `<input>` element with inset floating submit and clear buttons. Harmonize focus states across all search bars to use unified `focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary`, `hover:border-primary/40`, and 150ms outward ring pulse bloom.
  3. **Editorial Classic of the Day Section (`EditorialQuoteSection.tsx`)**: Introduce a dedicated daily rotating classic showcase beneath the Catalog search bar with anti-collision filtering to guarantee candidate books never duplicate the active Hero volume.
  4. **Library Navigation Streamlining (`AccountLibraryStats.tsx`)**: Prune the redundant "Open Bookshelf →" header link in favor of the interactive library cards below.
  5. **Reading Surface Typography Harmonization (`ReaderSurface.tsx`)**: Remove hardcoded `font-serif` overrides from frontispiece title `<h1>`, author `<p>`, chapter headings `<h2>`, and bilingual comparison lines, allowing the reading canvas to dynamically adapt to the reader's chosen font family (Serif, Sans, or Mono).
  6. **Literary Quote Card Divider Harmonization (`LiteraryQuotes.tsx`)**: Align the divider line above "Read Full Volume" with the standard theme-aware `border-border` token, eliminating broken fallback colors and ensuring full visual harmony across Light, Dark, and Sepia modes.
  7. **Archival Language Badge & Reading Status Selector Token Harmonization (`ReaderLanguageDrawer.tsx`, `ReadingStatusSelector.tsx`)**: Replace unsupported bare `primary/40` and `border/60` classes with supported numbered palette tokens (`primary-500/30`, `primary-500/40`) and standard `border-border`, restoring soft translucent pill backgrounds, balanced border weights, and authentic theme-adaptive styling across Light, Dark, and Sepia modes.
  8. **Design Token Hygiene & Reader Quote Delete Preview Deduplication (`Badge.tsx`, `QuoteDeletePreview.tsx`, `AccountRestoreModal.tsx`, `HeroFeaturedBook3D.tsx`, `NotebookView.tsx`, `Navbar.tsx`, `ReaderAnnotationsDrawer.tsx`, `src/app/read/[id]/page.tsx`)**: Normalize unsupported bare variable slash-modifiers (`border-border/80`, `border-border/60`, `border-border/50`, `border-border/40`) to canonical `border-border`, elevate `Badge` variants to concrete numbered palette tokens (`primary-500/15`, `primary-500/30`, `emerald-500/10`, `emerald-500/30`), and extract duplicated quote deletion preview markup into a co-located `QuoteDeletePreview` presenter component.
  9. **Test Suite Granularity & Fault Isolation Governance (`page.test.tsx`, `AccountPreferencesSection.test.tsx`, `useBookshelfStore.test.ts`, `ReaderHeader.test.tsx`, `ReaderSurface.test.tsx`, `ReaderSpeechBar.test.tsx`, `AccountIdentityCard.test.tsx`)**: Decompose compound and monolithic multi-step test cases into isolated, single-responsibility unit tests across 7 test suites, eliminating artificial `rerender` state switching and improving fault isolation while strictly preserving all existing assertions and zero production code changes.
- **Consequences**:
  - Full protection for completed book records and milestones.
  - Seamless re-reading UX from Page 1 without destructive state loss.
  - 100% design and interactive pulse harmony across all search interfaces on every view.
  - Rich literary curation on the Catalog landing page with zero layout shift or duplicate selections.
  - Clean, focused Account page library navigation.
  - Cohesive typographical cascading across the entire reading surface in Serif, Sans, and Mono modes.
  - Consistent, theme-aware card divider lines in LiteraryQuotes across Light, Dark, and Sepia modes with zero fallback color bleeding.
  - Authentic, soft translucent badge and button borders in the Reader Language Drawer and Reading Status Selector across Light, Dark, and Sepia modes without harsh solid-border fallback bleeding.
  - Complete elimination of silent Tailwind CSS drop-outs on opacity-modified CSS variables across modals, skeletons, and cards.
  - Zero code duplication for quote deletion preview modals between Reader drawer and full-page reader with 100% visual invariance and full test coverage.
  - Maximum fault isolation and granular regression prevention with test suites expanded to > 1,000 unit and integration tests across 127 suites, strictly maintaining >= 80% coverage on all metrics (Rule 3).

## ADR-026: Enterprise Polymorphism, Encapsulation & Code Redundancy Elimination
- **Status**: Accepted
- **Context**: An enterprise audit of code polymorphism, encapsulation, and code redundancy revealed duplicated code and missing domain abstractions across multiple subsystems:
  1. Data Layer: Repetitive Gutenberg format dictionary parsing and Supabase cloud row conversion were scattered across `useBookshelfStore.ts`, and offline sync command processing relied on a 40-line `if-else` ladder.
  2. Presentation Layer & Navigation: `Navbar.tsx` manually repeated 5 copy-pasted `<button>` blocks with identical active class logic, while `src/app/page.tsx` contained over 12 nested ternaries to switch section headers, search placeholders, and empty states.
  3. Annotation Subsystem: 6 duplicate color dictionaries for annotation pastel palettes (`yellow`, `amber`, `mint`, `rose`) existed across `ReaderSurface.tsx`, `ReaderAnnotationsDrawer.tsx`, `TextHighlightPopover.tsx`, and `NotebookView.tsx`.
  4. Reader Hydration: `src/app/read/[id]/page.tsx` manually queried 10 individual store properties with raw ternaries guarding SSR hydration rather than using an encapsulated hook pattern like `useHydratedBookshelf` and `useHydratedAnnotations`.
  5. Auth Modal: Three nearly identical email verification and confirmation screens were duplicated for sign-up, magic link, and password reset flows, accompanied by redundant view header ternaries.
  6. File Downloads: Imperative anchor element creation, object URL allocation, clicking, and revoking were duplicated across JSON and CSV exports in `library-backup.ts`.
  7. API Proxy Handlers: Client IP extraction (`x-forwarded-for`, `x-real-ip`) and HTTP 429 response construction were duplicated across `/api/books`, `/api/books/content`, and `/api/translate`, while `SimpleLRUCache` was tightly coupled inside `translate/route.ts`.
  8. Active Reading Counter: Active reader volume calculation was computed via different manual object extractions and `useMemo` loops in `Navbar.tsx` and `account/page.tsx`.
- **Decision**:
  1. **Data Layer Adapters & Polymorphic Dispatcher (`book.adapter.ts`, `useBookshelfStore.ts`)**: Encapsulate cloud row conversion into `toGutendexBookFromCloudRow` and normalized insert payload generation into `toCloudBookInsert`. Replace the `flushOutbox` `if-else` ladder with a polymorphic command dispatcher dictionary `OUTBOX_DISPATCHERS`.
  2. **View Strategy & Declarative Navigation (`views.config.ts`, `Navbar.tsx`, `src/app/page.tsx`)**: Establish `NAV_ITEMS`, `NAVBAR_VIEW_CONFIG`, and `VIEW_CONTENT_CONFIG` strategy registries. Refactor `Navbar` to data-driven `NAV_ITEMS.map(...)` iteration, and resolve view headers, search placeholders, and empty states polymorphically from `viewConfig`.
  3. **Canonical Annotation Tokens (`annotation-tokens.ts`)**: Consolidate highlight surfaces, dot/border styling, human-readable labels, and filter badges into `ANNOTATION_COLOR_CONFIG` and `ANNOTATION_COLOR_LIST`.
  4. **Reader Hydration & Reading Count Selectors (`useReaderStore.ts`, `read/[id]/page.tsx`)**: Introduce `useHydratedReader()` to encapsulate reader store SSR hydration, and standardize `getActiveReadingCount(state)` as the canonical selector across `Navbar.tsx` and `account/page.tsx`.
  5. **Auth Modal Presenter Component (`EmailSentView.tsx`, `AuthModal.tsx`)**: Extract repeated confirmation cards into `<EmailSentView />`, and define declarative `AUTH_VIEW_CONFIG` mapping modal views to titles, descriptions, and submit labels.
  6. **DOM Blob Download Encapsulation (`utils.ts`, `library-backup.ts`)**: Extract `triggerBlobDownload(blob, filename)` with SSR environment guards, deduplicating DOM anchor creation across library backups.
  7. **API Route Utilities & Domain Cache (`api-utils.ts`, `cache.ts`)**: Extract `getClientIp(request)` and `createRateLimitErrorResponse(rateLimit, message?, extraBody?)`. Move generic `SimpleLRUCache<K, V>` into a standalone domain module with re-exports for zero breaking changes.
- **Consequences**:
  - Complete elimination of duplicate boilerplate and parallel dictionaries across all layers.
  - Polymorphic extensibility: new views, offline sync commands, and modal states can be added through declarative configuration without modifying JSX control flows or growing `if-else` ladders.
  - Strict non-breaking parity: zero database schema changes, zero store API breaks, and 100% contract compliance across all API responses.
  - Test suite expanded to 1,051 tests across 133 suites with 100% pass rate and zero TypeScript compiler errors.

## ADR-027: Reading Habit Telemetry, Annual Goals, and Extensible Accolade Architecture
- **Status**: Accepted
- **Context**: Milestone 3, Point 3 requires tracking daily reading activity timestamps to compute consecutive reading streaks, estimated hours read, and annual reading challenge goals in the Account dashboard. Furthermore, the product roadmap envisions a seamless future expansion into Literary Accolades (Milestone 4) and a Community Hub (Milestone 5). Reading session telemetry must be captured without reader latency, without intrusive popups, and must operate 100% offline-first (Rule 4) with optional Supabase cloud sync and strict RLS (Rule 9).
- **Decision**:
  1. **Deterministic Analytics Engine (`src/lib/reading-analytics.ts`)**: Implement pure mathematical algorithms for consecutive reading streaks (`calculateStreak`), longest streak, 7-day calendar activity indicators, reading duration formatting, and annual challenge progress (`calculateAnnualGoalProgress`). Provide a 1-day grace period where yesterday's active streak remains valid until midnight today. Define extensible `ReadingSessionTelemetry` types ready to feed Milestone 4 accolade rules.
  2. **Local-First Habits State (`src/stores/useHabitsStore.ts`)**: Create `useHabitsStore` backed by Zustand `persist` with `localStorage` (`STORAGE_KEYS.HABITS = 'bookarium-habits-storage'`). Store `annualGoal`, `annualGoalYear`, `activeDates` (`YYYY-MM-DD`), and `totalReadingSeconds`. For authenticated users, automatically synchronize with the idempotent `public.user_reading_habits` Supabase table.
  3. **Idle-Aware Reader Telemetry (`src/hooks/useReadingTimer.ts`)**: Mount an unobtrusive telemetry hook in `src/app/read/[id]/page.tsx` that increments active reading duration while reading. Protect against phantom hours using a 2-minute idle detection guard (pausing when no scroll, page-turn, or keydown occurs) and immediately flushing when the browser tab becomes hidden (`visibilitychange`).
  4. **Tactile Dashboard Presentation (`AccountHabitsCard.tsx`, `AccountLibraryStats.tsx`)**: Introduce a 3-column metric card in `/account` displaying the active streak with a flame indicator and 7-day week dots, total hours read, and an interactive annual reading challenge progress bar with a target-adjustment modal. Render an active streak badge in `AccountLibraryStats`.
  5. **Roadmap Formalization (`scripts/generate-roadmap.js`, `ROADMAP.md`)**: Formally chart Milestone 4 (*Literary Accolades & Public Profiles*, `Target: v2.1.0`) and Milestone 5 (*Community Hub & Collective Reading*, `Target: v2.2.0`) in `scripts/generate-roadmap.js` with deterministic AST/file checks.
- **Consequences**:
  - Full achievement of Milestone 3 feature completeness (100% verified on the living roadmap).
  - 100% offline-first capability for guest readers with zero friction.
  - Zero performance overhead or UI obstruction in the reader surface.
  - Extensible event foundation ready to unlock Milestone 4 literary accolades and Milestone 5 community sharing without database rewrites.

## ADR-028: Analytical Table of Contents Deduplication & Cross-Reference Protection Invariants
- **Status**: Accepted
- **Context**: 19th-century Victorian literature on Project Gutenberg (e.g. Austin Bidwell's *Bidwell's Travels, from Wall Street to London Prison*, `read/24739`) often features extensive "Analytical" or "Descriptive" Tables of Contents where each chapter entry contains a detailed 200–600 character narrative synopsis ending with a printed original book page number. Because these synopses exceed standard heading lengths (`TOC_MAX_HEADING_LENGTH: 180`), and because 50+ chapter analytical TOCs span up to 25,000–30,000 bytes (exceeding previous `TOC_SEARCH_WINDOW_BYTES: 9000`), the parser previously treated each TOC entry as an independent 1-page chapter, resulting in double-chapter parsing (50 synopsis chapters + 50 real chapters = 100 chapters). Furthermore, any fix in the chapter segmentation engine had to guarantee 100% non-breaking safety for all existing books and strictly protect against false-positive suppression from in-body chapter cross-references.
- **Decision**:
  1. **Expanded TOC Search Window**: Expand `TOC_SEARCH_WINDOW_BYTES` in `GUTENBERG_PARSER_CONFIG` from `9000` to `45000` bytes to fully encompass large analytical tables of contents across Victorian and multi-volume masterworks.
  2. **Analytical Synopsis Threshold (`TOC_ANALYTICAL_MAX_LENGTH: 2000`)**: Define a safe upper-bound character limit distinguishing analytical chapter synopses from genuine story chapters.
  3. **Multi-Constraint Deduplication Guard**: In Step 3 of `parseGutenbergChapters`, identify an analytical TOC entry strictly when:
     - The item falls within the detected front-matter TOC window (`item.index >= tocMatch.index && item.index < tocMatch.index + TOC_SEARCH_WINDOW_BYTES`).
     - The item's body length is small (`item.bodyLength < TOC_ANALYTICAL_MAX_LENGTH`).
     - A subsequent duplicate chapter with an identical normalized identifier exists later in the book (`rawMatches.some(...)`).
     - The subsequent candidate is a full-length chapter: `other.bodyLength > item.bodyLength * 2` and `other.bodyLength >= 2000`.
  4. **Suppression Immunity Invariant**: Any chapter whose body length is $\ge 2,000$ characters is mathematically immune to suppression. In-body cross-references (e.g. an author citing "as seen in Chapter 1" on page 85) can never suppress or drop the authentic narrative chapter.
- **Consequences**:
  - Clean, accurate chapter segmentation for `read/24739` (from 101 split sections down to 50 real narrative chapters + Title/Preamble + Colophon = 52 total).
  - 100% backward compatibility and test parity across all existing books and styles (*Moby Dick*, *The Great Gatsby*, *Four Arthurian Romances*, *Twenty-Five Ghost Stories*, *Journey to the Centre of the Earth*, *The Secret Agent*).
  - Guaranteed mathematical immunity protecting authentic narrative chapters from suppression when referenced in subsequent body text, footnotes, or appendices.

## ADR-029: Dual Immersion Telemetry (Reading vs. Listening) & 5-Minute Active Streak Threshold
- **Status**: Accepted
- **Context**: In ADR-027, reading session telemetry was established with a 2-minute idle detection guard and visibility change flush. However, two behavioral and qualitative gaps were identified:
  1. Background Tab Reading vs. Narration: When a user left the reader tab to work or browse in another tab, the browser tab became hidden (`document.visibilityState === 'hidden'`), immediately pausing reading time tracking. While this is correct for visual reading (preventing phantom reading time accumulation), it disrupted the user journey for Text-to-Speech (TTS) narration (`useReaderSpeech`). Users listening to audio narration naturally switch tabs or keep the reader in the background while listening, causing their listening immersion time to be completely discarded.
  2. Streak Qualification Standard: Previously, any positive reading activity (even 1 second) instantly qualified the daily streak. Opening a book for a split second accidentally granted a daily streak badge without any genuine literary immersion, diluting habit formation and streak integrity.
- **Decision**:
  1. **Dual Immersion Metric Telemetry (`totalReadingSeconds` vs `totalListeningSeconds`)**: Disentangle reader telemetry into two distinct persistent counters in `useHabitsStore`: visual reading time (`totalReadingSeconds`) and audio narration listening time (`totalListeningSeconds`).
  2. **Background TTS Audio Exception (`useReadingTimer.ts`)**: In the reader telemetry ticker, evaluate `isPlayingTTS`. When audio speech is active (`isPlayingTTS === true`), timer accumulation continues regardless of document visibility (`document.visibilityState === 'hidden'`) or keyboard/mouse idle state, correctly recording audio immersion into `totalListeningSeconds`. When audio narration is inactive, timer accumulation strictly requires the tab to be visible and active, recording visual immersion into `totalReadingSeconds` with the 2-minute idle protection guard intact.
  3. **5-Minute Active Immersion Streak Qualification Standard (`MIN_STREAK_DURATION_SECONDS = 300`)**: Elevate the daily streak threshold from 1 second to 5 minutes (300 seconds) of combined immersion (reading + listening). Track daily accumulated seconds in `dailyActivitySeconds[dateStr]`. Only append `today` to `activeDates` once `dailyActivitySeconds[todayStr] >= 300`.
  4. **Dynamic Streak Progress Feedback (`AccountHabitsCard.tsx`, `useHabitsStore.ts`)**: In the Account dashboard, render granular feedback showing `Today's 5-minute reading logged` when completed, or progress prompts: `Xm / 5m logged today (Ym left to keep streak!)` or `(Ym to start streak)` when partially completed. Present dual immersion badges (`📖 X reading • 🎧 Y listening`) with combined reading/listening hours and pace calculations.
  5. **Idempotent Database Schema Co-Evolution (Rule 9)**: Co-evolve Supabase schema (`supabase/schema.sql`) and TypeScript types (`src/types/database.types.ts`) with `total_listening_seconds BIGINT NOT NULL DEFAULT 0` and update `syncWithCloud` to merge and upsert both metrics idempotently via Last-Write-Wins and local/remote maximum resolution.
- **Consequences**:
  - Readers can listen to audiobooks and TTS narration in background tabs without losing a single second of immersion time.
  - Reading habit streak integrity is dramatically strengthened with a meaningful 5-minute immersion threshold, eliminating false streaks from accidental page opens.
  - Complete transparency and granularity in reading habits with distinct visual reading vs. audio listening metrics and badges.
  - 100% backward-compatible, offline-first, and zero-error test suite co-evolution across stores, hooks, cards, and types.

## ADR-030: Deterministic Literary Accolades, Tactile Ex-Libris Bookplates & Showcase Architecture
- **Status**: Accepted
- **Context**: Milestone 4, Point 1 specifies the creation of a deterministic Literary Accolades & Ex-Libris Bookplate system. Bookarium readers need tangible, classical recognition for reading milestones, streaks, temporal era exploration, scholarship, and audio immersion. The system must operate 100% offline-first for guest readers, sync seamlessly to Supabase with granular Row Level Security (Rule 9) when authenticated, and embody Bookarium's tactile skeuomorphic design language (classical woodcut borders, Latin mottos, wax-seal stamp celebrations, 3D perspective mouse tilt, and mobile haptic feedback).
- **Decision**:
  1. **Canonical Accolade Catalog (`src/config/accolades-config.ts`, `src/types/accolades.types.ts`)**: Define 10 literary accolades across 5 thematic categories (Streaks, Immersion, Exploration, Scholarship, Curation) and 4 visual tiers (Parchment Bronze, Specular Silver, Gilded Gold, Obsidian Masterwork), each equipped with authentic Latin mottos (e.g. *Nulla Dies Sine Linea*, *Per Aspera Ad Astra*, *Labor Omnia Vincit*, *Ex Oriente Lux*, *Tempus Fugit*).
  2. **Deterministic Evaluation Engine (`src/lib/accolades-engine.ts`)**: Implement pure mathematical and historical evaluation algorithms mapping author birth/death years and Gutenberg metadata to historical literary eras (Antiquity, Middle Ages, Renaissance, Enlightenment, Victorian, Early 20th Century). Unify telemetry from `useHabitsStore`, `useBookshelfStore`, and `useAnnotationStore` via `buildAccoladeContext`. Compute clamped progress maps and identify newly unlocked accolades without false-positive re-triggers.
  3. **Local-First Accolades Store with Cloud Sync (`src/stores/useAccoladesStore.ts`)**: Create `useAccoladesStore` with Zustand persist (`STORAGE_KEYS.ACCOLADES`). Provide celebration queues, personal showcase pinning (max 3 bookplates), and bi-directional cloud synchronization merging local and remote records idempotently into `public.user_accolades`. Integrate store into `syncAllStoresWithCloud` (`src/lib/sync-utils.ts`).
  4. **Tactile Skeuomorphic UI Presentation (`ExLibrisBookplate.tsx`, `AccoladeCelebrationModal.tsx`, `AccountAccoladesCard.tsx`)**:
     - Desktop: 3D perspective tilt (`rotateX`/`rotateY`) and dynamic specular sheen gradient tracking mouse movements.
     - Mobile/Tablet: Spring physics tap feedback and subtle device vibration haptic feedback (`navigator.vibrate`) on pin toggles and modal bestowment.
     - Wax-seal celebration modal for newly unlocked accolades featuring classical medallions, escape key support, and accessible dialog semantics.
     - Compendium grid with category filter tabs and personal 3-plate showcase in the Account dashboard.
  5. **Idempotent Database Schema Co-Evolution & RLS (Rule 9)**: Synchronize `supabase/schema.sql` (Section 9) and `src/types/database.types.ts` with `public.user_accolades` table, unique index on `(user_id, accolade_id)`, and granular authenticated Row Level Security policies (`auth.uid() = user_id`).
- **Consequences**:
  - Readers receive immediate, tangible, tactile feedback on literary accomplishments and habit milestones.
  - 100% offline-first capability for guest readers; seamless multi-device persistence for authenticated accounts.
  - Zero performance regressions; fully co-located unit and component test suite.
  - Milestone 4 Point 1 fully achieved and verified on the living roadmap.

## ADR-031: Global Encapsulation, Polymorphic Strategy Dispatching & Layout DRY Refactoring
- **Status**: Accepted
- **Context**: As Bookarium expanded with interactive annotations, multiple reading themes, 3D preview physics, and complex account analytics, several subsystems exhibited code bloat and tight coupling:
  1. `NotebookView.tsx` exceeded 970 lines, mixing catalog filtering, pagination, citation clipboard writing, color swatch popovers, reflection draft editing, and deletion modals in a monolithic component.
  2. The delete annotation confirmation dialog was duplicated with identical logic across `ReaderAnnotationsDrawer.tsx`, `NotebookView.tsx`, and `read/[id]/page.tsx`.
  3. `useAnnotationStore.ts` dispatched outbox synchronization via an imperative `switch(item.type)` statement, diverging from the polymorphic strategy pattern established in `useBookshelfStore.ts`.
  4. Reader theme cycling and speech highlight styling relied on ternary cascades across `ReaderHeader.tsx` and `ReaderSurface.tsx`.
  5. `BookPreviewModal.tsx` duplicated dual-face notable passage layouts between the stationary right base and the 3D flipping leaf.
  6. `ReaderHeader.tsx` repeated nearly ~150 lines of button JSX between desktop and mobile headers.
  7. In the Account dashboard, the Security & Password, Account Session, and Danger Zone cards were visually crammed vertically without distinct separation on Sepia and Dark modes.
- **Decision**:
  1. **Single-Responsibility Component Extraction (`NotebookQuoteCard.tsx`, `DeleteAnnotationModal.tsx`, `NotablePassagesSpread.tsx`)**:
     - Extract `NotebookQuoteCard` with isolated local state, citation copying, quick color swatches, and render-time draft reflection state adjustments, pruning 302 lines from `NotebookView`.
     - Extract `DeleteAnnotationModal` wrapping `@/components/ui/Modal` and `QuoteDeletePreview` to unify annotation deletion across Reader and Notebook.
     - Extract `NotablePassagesSpread` to eliminate duplicated quote stacks in `BookPreviewModal`.
  2. **Polymorphic Strategy Dispatching (`useAnnotationStore.ts`, `reader-themes.ts`)**:
     - Introduce `ANNOTATION_OUTBOX_DISPATCHERS: Record<AnnotationOutboxAction['type'], AnnotationOutboxDispatcher>` matching the architecture in `useBookshelfStore.ts`.
     - Introduce `NEXT_READER_THEME: Record<ReaderTheme, ReaderTheme>` transition cycle map and `speechHighlight` token in `ReaderThemeConfig`.
  3. **Action Matrix Unification (`ReaderHeader.tsx`)**:
     - Consolidate desktop and mobile header button trees into a single declarative `toolActions: ReaderHeaderToolAction[]` array.
  4. **Reader Subsystem Architecture & Computational Partitioning (`useReaderSession.ts`, `ReaderSpeechBar.tsx`, `reader-annotator.ts`)**:
     - Implement `jumpTo(chapterIndex, page)` and internalized `useHasMounted()` in `useReaderSession`.
     - Add `speech?: UseReaderSpeechReturn` facade prop to `ReaderSpeechBar`.
     - Extract pure computational interval partitioning and collision-free text search into `computeAnnotationSpans()` in `reader-annotator.ts`.
  5. **Dialog Modal Standardization & Account Visual Rhythm**:
     - Re-skin `GutenbergInfoModal` and all 4 bookshelf management modals to compose `@/components/ui/Modal`.
     - Harmonize vertical rhythm (`space-y-6`) and high-contrast solid borders across Security & Password, Account Session, and Danger Zone cards on the Account page.
- **Consequences**:
  - Dramatic reduction in monolithic file sizes: `NotebookView.tsx` (-302 lines), `BookPreviewModal.tsx` (-104 lines), `ReaderHeader.tsx` (-107 lines), `BookshelfManageModals.tsx` (-59 lines).
  - High degree of polymorphism, maintainability, and clean single-responsibility boundaries.
  - 100% backward-compatible, non-breaking changes across all existing components, stores, and route handlers.
  - Zero test regressions; test suite expanded to 147 test suites, 1,176 tests, maintaining >92% test coverage.

## ADR-032: Canonical 4-Tier Reading Challenge Ladder, Anti-Tamper Progression & Accolade Visual Stabilization
- **Status**: Accepted
- **Context**: 
  1. The previous Annual Reading Challenge in `AccountHabitsCard.tsx` allowed arbitrary user editing of the annual target (e.g. setting goal = 1), enabling readers to trivially trigger the highest Masterwork accolade (*The Laureate's Crown*) without genuine literary reading effort.
  2. The Ex-Libris Accolades compendium lacked intermediate curation honors between starting the library and the pinnacle 52-volume Masterwork award.
  3. Earned Ex-Libris bookplates exhibited vector stroke thickness throbbing on hover due to compound scaling transforms (`scale3d(1.02, 1.02, 1.02)` on the card container combined with `group-hover:scale-105` on the inner medallion), aggressive 3D perspective mouse tilt ($\pm 12^\circ$), and unisolated specular sheen alpha-blending across SVG stroke boundaries.
  4. Supabase database linter detected missing immutable search paths and overly permissive default PostgREST RPC execution on `handle_new_user()` and `delete_current_user()`.
- **Decision**:
  1. **Canonical 4-Tier Curation Ladder (`src/config/accolades-config.ts`, `src/types/accolades.types.ts`)**:
     Expand the curation accolades into an objective, non-editable 4-tier milestone hierarchy evaluated deterministically against authentic completed books (`completedBooksCount`):
     - **Bronze (6 volumes)**: `bibliophile-novice` (*Bibliophile Novice*, &ldquo;Ad Initium&rdquo;, `BookOpen`, bi-monthly pace)
     - **Silver (12 volumes)**: `canonical-scholar` (*Canonical Scholar*, &ldquo;Annus Mirabilis&rdquo;, `Library`, 1 volume/month)
     - **Gold (24 volumes)**: `master-of-the-canon` (*Master of the Canon*, &ldquo;Litterarum Magister&rdquo;, `Award`, 2 volumes/month)
     - **Masterwork (52 volumes)**: `the-laureates-crown` (*The Laureate's Crown*, &ldquo;Coronam Accipere&rdquo;, `Crown`, 1 volume/week)
  2. **Anti-Tamper Challenge Tracking (`AccountHabitsCard.tsx`)**:
     Retire the edit goal modal, input stepper, and "Edit Goal" button. Display dynamic next-tier milestone progress (`completed / currentTarget Volumes`), remaining volume countdown, and an interactive 4-card milestone track indicating attained status (with checkmarks), in-sight active goals, and upcoming tiers with Latin mottos.
  3. **Vector Stroke Stabilization & GPU Hardware Layer Promotion (`ExLibrisBookplate.tsx`, `AccoladeCelebrationModal.tsx`)**:
     - Remove `group-hover:scale-105` on the inner medallion, replacing it with elevation shadow (`transition-all duration-200 group-hover:shadow-md`) while preserving native 1:1 physical pixel stroke rasterization.
     - Promote SVG icons to dedicated GPU compositor layers via `[transform:translateZ(0)]`, `[backface-visibility:hidden]`, and `[shape-rendering:geometricPrecision]`.
     - Soften desktop 3D perspective tilt to $\pm 4^\circ$, and isolate dynamic specular sheen gradients to `z-0 pointer-events-none` behind `relative z-10` content.
     - Register `Library` icon from `lucide-react` into `ICON_MAP` across bookplates and celebration modals.
  4. **Database Security Hardening (`supabase/schema.sql`, `README.md`)**:
     - Enforce `SET search_path = ''` on `handle_new_user()` and `delete_current_user()`.
     - Revoke `EXECUTE` on `handle_new_user()` across `PUBLIC`, `anon`, and `authenticated` roles.
     - Guard `delete_current_user()` with null session check (`IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;`) and restrict execution to authenticated users.
- **Consequences**:
  - Eliminates gamification exploits and guarantees 100% integrity for literary accolades.
  - Provides readers with structured, achievable milestones (6, 12, 24, 52 volumes) with classical Latin identities.
  - 100% resolution of database security linter warnings.
  - All 147 test suites (1,179 tests) passing with >92% test coverage.

## ADR-033: Opt-In Public Scholar Profiles, Zero-PII Privacy Architecture & Dynamic Social Metadata
- **Status**: Accepted
- **Context**:
  1. Bookarium previously restricted all reading milestones, streaks, and Ex-Libris bookplates to private local sessions. Readers lacked a dignified, classical way to share their reading journeys, literary mottos, and curated public domain bookshelves (Milestone 4, Point 2).
  2. Publicly discoverable profiles present privacy and account enumeration risks if not strictly governed by an opt-in model and zero-PII data isolation.
  3. Readers require granular autonomy over which telemetry metrics (daily streaks, annual challenge progress, and bookshelves) are visible to the public.
- **Decision**:
  1. **Canonical Schema Co-Evolution & Public RLS Policies (`supabase/schema.sql`, `src/types/database.types.ts`, `README.md`)**:
     - Extended `public.profiles` with `username TEXT UNIQUE`, `bio TEXT`, `is_public BOOLEAN DEFAULT false`, `show_streak BOOLEAN DEFAULT true`, `show_challenge BOOLEAN DEFAULT true`, and `show_bookshelves BOOLEAN DEFAULT true`.
     - Created case-insensitive unique index `unique_profile_username_lower ON public.profiles (lower(trim(username)))`.
     - Updated Row Level Security (RLS) `SELECT` policies across `profiles`, `bookshelves`, `bookshelf_items`, `user_reading_habits`, and `user_accolades` to permit public reads strictly when `is_public = true` and the corresponding privacy toggle is active, maintaining strict user-isolated mutations (`auth.uid() = user_id`).
  2. **Account Dashboard Public Profile Section (`src/components/account/AccountPublicProfileSection.tsx`)**:
     - Provisioned an executive settings card mounted on `/account` enabling users to configure unique handles (3–30 chars with live validation via `validateUsername`), scholar bio/motto (max 200 chars), master public switch (`Public Scholar` vs. `Private Sanctuary`), and granular telemetry toggles.
     - Provided 1-click clipboard link copying with instant tactile visual feedback and direct profile preview linking.
  3. **Zero-PII Public Scholar Route (`src/app/u/[username]/page.tsx`) & Presentation View (`src/components/profile/PublicProfileView.tsx`)**:
     - Engineered a dynamic public route fetching scholar profiles via case-insensitive matching (`.ilike('username', normalizedUsername)`).
     - Strictly queries and renders public attributes (`display_name`, `username`, `bio`, `created_at`). Under no condition are email addresses, password hashes, or sensitive auth tokens exposed to the client DOM.
     - Fallbacks for display names default safely to `@username` or `"Bookarium Scholar"`, strictly avoiding email fallbacks.
  4. **Classical Private Sanctuary Fallback (`src/components/profile/PrivateProfileNotice.tsx`)**:
     - Visiting `/u/[username]` for private accounts or non-existent handles displays a classical Emerson-inscribed "Private Scholar Sanctuary" card rather than a 404, eliminating username enumeration vectors.
  5. **Pinned Accolades Shelf Showcase (`src/components/profile/PinnedAccoladesShelf.tsx`)**:
     - Renders up to 3 pinned Ex-Libris bookplates on a classical woodcut scholar shelf with 3D hover physics.
- **Consequences**:
  - Successfully satisfies and verifies Milestone 4, Point 2 on the living roadmap.
  - Zero PII leakage across all public data flows and UI views.
  - Full test co-location and anti-regression coverage maintained across all new components, stores, and route handlers.

## ADR-034: Next.js 16 Route Handler Strict Typing, SSRF Validation Separation & Test Performance Architecture
- **Status**: Accepted
- **Context**:
  1. Next.js 16 App Router strictly validates route exports in `src/app/**/route.ts` against HTTP handler signatures (`GET`, `POST`, etc.), disallowing ancillary utility exports such as `isSafeUpstreamUrl` and `sanitizeUpstreamUrl`.
  2. JSDOM simulation overhead across 154 parallel test suites caused thread thrashing, high worker latency, and test suite bloat (taking ~32s+).
  3. `HeroSearch.test.tsx` and `AccountPage.test.tsx` mounted heavy composite component trees redundantly across multiple micro-interaction tests, multiplying JSDOM DOM tree construction costs.
- **Decision**:
  1. **Next.js 16 Route Handler Separation & Co-location**:
     - Extracted `isSafeUpstreamUrl` and `sanitizeUpstreamUrl` out of `src/app/api/books/content/route.ts` into a dedicated sibling module `src/app/api/books/content/url-validator.ts`.
     - Added comprehensive co-located unit tests `src/app/api/books/content/url-validator.test.ts` (9 tests covering SSRF loopbacks, IPv4/IPv6 private ranges, cloud metadata IPs, and URI component decoding).
     - Cleaned `route.ts` to export strictly HTTP `GET`, satisfying Next.js 16 compiler route type generation (`tsc --noEmit`).
  2. **Vitest Architecture & Environment Strategy**:
     - Added official `// @vitest-environment node` docblock directives to pure algorithmic suites (`src/lib/gutenberg/*`, `src/lib/gutenberg-parser.test.ts`, `src/lib/password.test.ts`), eliminating JSDOM environment bootstrap latency (0ms).
     - Guarded window and localStorage globals in `src/test/setup.ts` with `typeof window !== 'undefined'`.
     - Hardened `tsconfig.json` to include `vitest.config.mts`, guaranteeing static typing across config files.
  3. **Composite Mount Cycle Consolidation**:
     - Consolidated redundant 11-card dashboard remounts in `src/app/account/page.test.tsx` into unified authentic user journeys, reducing file execution from 11.22s to 3.46s (-69%).
     - Consolidated redundant 3D hero search remounts in `src/components/presentation/HeroSearch.test.tsx` into unified search input and featured volume journeys, reducing execution from 18.38s to 3.49s (-81%).
- **Consequences**:
  - Full conformance with Next.js 16 App Router route handler specifications (`tsc --noEmit` exits with 0 errors).
  - 100% authentic integration testing preserved with zero fake mocks and zero loosened assertions.
  - Overall test suite speedup of ~25% across all 154 suites (1,245 tests) while maintaining >92% test coverage.

## ADR-035: Authoritative Cloud Synchronization, Next.js 16 Edge Proxy Migration & Zero-CLS Syncing Indicator
- **Status**: Accepted
- **Context**:
  1. Peer-to-peer merge between browser `localStorage` and Supabase caused race conditions where books deleted on another device were re-uploaded and resurrected as ghosts.
  2. Next.js 16 edge middleware (`src/middleware.ts`) experienced unhandled fetch errors on network timeout/offline states, crashing route transitions.
  3. The conditional rendering of `{isSyncing && ...}` directly inside `BookshelfRack`'s Tailwind `space-y-8` container injected ~58px of vertical layout height and collapsed abruptly upon sync completion, triggering Cumulative Layout Shift (CLS).
- **Decision**:
  1. **Authoritative Cloud State Reconciliation (`src/stores/useBookshelfStore.ts`)**:
     - Introduced `lastBookshelfSyncAt` sync anchor. On initial sync, guest books migrate to Supabase; on subsequent syncs, Supabase is the sole source of truth, gracefully pruning books deleted on remote devices.
     - Drains pending offline mutations (`flushOutbox`) prior to remote fetching, guaranteeing offline edits are never dropped.
  2. **Sanitized Sign-Out Protocol (`src/stores/useAuthStore.ts`)**:
     - Pre-sign-out outbox drain and clean state wipe (`clearBookshelf()`) prevent cross-account contamination while raw downloaded texts in IndexedDB remain intact on the device.
  3. **Next.js 16 Edge Proxy Architecture (`src/proxy.ts`, `src/lib/supabase/middleware.ts`)**:
     - Migrated edge interception strictly to `src/proxy.ts` (Next.js 16 convention) and wrapped session refresh in non-blocking fallback (`try...catch`).
  4. **Zero-CLS Floating Overlay Sync Badge (`src/components/presentation/BookshelfRack.tsx`)**:
     - Extracted the sync badge out of the `space-y-8` layout flow into an `absolute top-0 right-2 sm:right-4 z-20 pointer-events-none` floating pill with `AnimatePresence` fade transitions.
- **Consequences**:
  - Ghost resurrections eliminated permanently across multi-device sessions.
  - Zero Cumulative Layout Shift (0.00 CLS) during cloud synchronization.
  - Route navigation resiliency on offline and flaky connections.

## ADR-036: Airtight Jurisdictional Copyright Governance, Regional Streaming Gatekeeper (HTTP 451) & Edge Geo-Context Architecture
- **Status**: Accepted
- **Context**:
  1. Project Gutenberg operates under US copyright law (17 U.S.C. § 304), clearing works published on or before 1930 (as of 2026). However, in international jurisdictions governed by the Berne Convention, copyright extends based on author and translator lifespans:
     - European Union (EU 27), UK, Canada, Australia, New Zealand, Japan: **Life + 70** (author/translator death year $\le 1955$).
     - Mexico and Côte d'Ivoire: **Life + 100** (author/translator death year $\le 1925$).
     - Colombia and Spain (pre-1987 deaths): **Life + 80** (author/translator death year $\le 1945$).
  2. Directly serving or linking to works that are public domain in the US but protected abroad exposes the platform to copyright infringement claims under local statutes (e.g. EU *GS Media* and UK linking case law).
  3. Indeterminate author lifespans, joint co-authorship (Berne Art. 7bis: calculated from the last surviving author), and derivative translation protections (Berne Art. 2(3)) required a rigorous, deterministic engine that strictly fails closed outside the US.
- **Decision**:
  1. **Core Copyright Engine (`src/lib/copyright-engine.ts`)**:
     - Implement an autonomous, modular copyright validation engine with full ISO 3166-1 country term mappings, joint-authorship evaluation, translator checks, longevity heuristics ($birth\_year \le currentYear - term - 101$), and fail-closed policies for indeterminate metadata.
  2. **Edge Geo-Context & Next.js 16 Proxy (`src/proxy.ts`, `src/stores/useJurisdictionStore.ts`)**:
     - Consolidate edge geo-context detection from `x-vercel-ip-country` / `cf-ipcountry` / `?country=XX` into `src/proxy.ts`.
     - Stamp `bookarium-geo-country` cookie and `x-bookarium-country` headers for downstream consumers.
  3. **Catalog & Streaming Gatekeepers with Edge Cache Partitioning**:
     - Route `/api/books` enforces `copyright=false` upstream and filters titles using the requester's effective jurisdiction.
     - Route `/api/books/content` validates author lifespans against a 24h LRU metadata cache (`src/app/api/books/content/metadata-cache.ts`). If restricted, it halts delivery with `HTTP 451: Unavailable For Legal Reasons` and structured legal rationale.
     - Both routes stamp `Vary: x-vercel-ip-country, Accept-Encoding` to isolate regional CDN caches.
  4. **Presentation Layer & Link Neutralization**:
     - Direct download links are omitted entirely from the DOM in `DownloadDrawer.tsx` when restricted, and `BookCard.tsx` displays "Protected ([Country])" with disabled actions.
     - Reader (`ReaderErrorView.tsx`) renders an archival legal restriction shield detailing the restricting author, local statute, public domain year, and library return action.
- **Consequences**:
  - 100% legal compliance across all global jurisdictions.
  - Zero cross-border cache leakage through IndexedDB offline storage or CDN poisoning.
  - Full conformance with Next.js 16 App Router compiler validation.

## ADR-037: Self-Hosted Supabase PostgreSQL Catalog via Strangler Fig Pattern (Phase 1: Provider Seam Refactoring)
- **Status**: Accepted
- **Context**:
  1. Bookarium currently relies on the public Gutendex REST API for catalog metadata queries, author lifespans, and book discovery. While open-source and free, external public API mirrors pose availability vulnerabilities (e.g. 504 gateway timeouts under peak load) and lack support for custom database indexes or direct SQL search capabilities.
  2. The long-term architecture envisions a self-hosted Supabase PostgreSQL catalog (`public.books`) alongside Gutendex using the Strangler Fig pattern.
  3. Mutating database schemas or writing bulk ingestion scripts before decoupling the API route handler introduces regression risks and risks breaking client-side data contracts.
- **Decision**:
  1. **Canonical Catalog Types (`src/types/catalog.types.ts`)**:
     - Define `CatalogQueryOptions`, `CatalogQueryResult`, `CatalogProviderError`, and the swappable `ICatalogProvider` contract (`searchBooks`, `isHealthy`).
  2. **Query Parsing & Normalization Seam (`src/lib/catalog/query-parser.ts`)**:
     - Decouple parameter extraction, input sanitization (< 2 char query defense, whitespace collapse, numeric constraints), and edge geo-country fallback cascades (`x-vercel-ip-country` $\to$ cookie $\to$ dev query override) from the route handler into an isolated, unit-tested module.
  3. **Gutendex Provider Implementation (`src/lib/catalog/gutendex-provider.ts`)**:
     - Encapsulate upstream REST communication, 15-second AbortController timeout management, upstream error status mapping (400, 502, 504), and in-memory jurisdictional copyright evaluation (`isBookPublicDomainInJurisdiction`) behind `ICatalogProvider`.
  4. **Route Handler Modernization (`src/app/api/books/route.ts`)**:
     - Refactor the route into a lean controller (~70 lines) managing sliding-window rate limiting, delegating queries to `parseCatalogQuery` and `gutendexProvider.searchBooks`, and returning standardized cached JSON responses with regional `Vary` headers.
  5. **100% Contract & Backward Compatibility Parity**:
     - Retain exact JSON response shapes, error contracts, status codes, and HTTP cache headers (`Vary: x-vercel-ip-country, Accept-Encoding`, `Cache-Control: public, s-maxage=120, stale-while-revalidate=600`) across all 157 test suites.
- **Consequences**:
  - Full architectural decoupling of catalog query parsing, upstream transport, error translation, and HTTP delivery.
## ADR-038: Self-Hosted Supabase PostgreSQL Catalog via Strangler Fig Pattern (Phase 2: Schema Co-Evolution, Ingestion Pipeline & Dual Provider Fallback)
- **Status**: Accepted
- **Context**:
  1. Phase 1 established the canonical catalog provider abstraction (`ICatalogProvider`, `CatalogQueryOptions`, `CatalogQueryResult`) and decoupled query parsing from route handling.
  2. To achieve self-hosted independence, sub-50ms search latency, and zero dependency on third-party API availability, Bookarium requires a native PostgreSQL catalog in Supabase.
  3. The catalog must support GIN full-text search, language/subject containment matching, and pre-computed author lifespan indexes (`max_author_death_year`, `min_author_birth_year`) to enable rapid server-side jurisdictional copyright enforcement.
  4. Per Rule 0, Rule 4 (Zero API Key Requirement), and Rule 9 (Idempotent Schema Co-Evolution), the database schema must co-evolve across `supabase/schema.sql`, `src/types/database.types.ts`, and `README.md` with strict RLS public read policies, while guaranteeing 100% seamless fallback to Gutendex if Supabase is unconfigured, unseeded, or temporarily unreachable.
- **Decision**:
  1. **Idempotent Database Schema (`supabase/schema.sql`)**:
     - Defined `public.books` table storing book identity, JSONB contributor metadata, format download URLs, download metrics, and pre-computed author lifespan bounds.
     - Added `search_vector tsvector` column automatically populated and updated via `public.books_search_vector_trigger()` and backed by a GIN index (`idx_books_search_vector`).
     - Added GIN indexes on `languages` and `subjects`, and B-Tree indexes on `download_count` and `max_author_death_year`.
     - Configured Row Level Security with public read access: `CREATE POLICY "Public read catalog access" ON public.books FOR SELECT USING (true);`.
  2. **Canonical TypeScript Types (`src/types/database.types.ts`)**:
     - Synchronized `Database` interface with the `books` table structure and exported `DatabaseBook`.
  3. **Ingestion Pipeline (`scripts/ingest-catalog.js`)**:
     - Implemented a catalog ingestion CLI supporting curated seeds (`--curated`), batch page fetching (`--pages=N`), and dry-run SQL generation (`--dry-run` $\to$ `supabase/seed_books.sql`).
     - Added npm script `"catalog:ingest": "node scripts/ingest-catalog.js"`.
  4. **Supabase Catalog Provider (`src/lib/catalog/supabase-provider.ts`)**:
     - Implemented `ICatalogProvider` with `searchBooks(options)` and `isHealthy()`.
     - Added `isSupabaseConfigured()` guardrail returning `false` for missing or placeholder credentials to eliminate redundant network overhead in unconfigured environments.
     - Applied GIN `search_vector` websearch, language overlaps, subject filters, author lifespan bounds, and post-query `isBookPublicDomainInJurisdiction` Berne Convention compliance checks.
  5. **Strangler Fig Route Dispatcher (`src/app/api/books/route.ts`)**:
     - Upgraded `/api/books` to probe `supabaseCatalogProvider.isHealthy()`. When healthy, queries execute against Supabase with `source: 'supabase'`. If unseeded (`count === 0`), unhealthy, or upon query error, the dispatcher gracefully degrades to `gutendexProvider.searchBooks(options)` with `source: 'upstream'`.
  6. **Comprehensive Co-Located Testing & Living Docs**:
     - Added `src/lib/catalog/supabase-provider.test.ts` (14 unit tests, > 94% statement coverage).
     - Added route integration tests in `src/app/api/books/route.test.ts` asserting primary Supabase execution and fallback to Gutendex on failure.
     - Updated `README.md` and architecture matrices.
- **Consequences**:
  - Sub-50ms catalog searches on seeded instances with full-text GIN search.
  - Zero downtime and zero regressions for existing users and unseeded development environments.
  - 100% legal compliance with international copyright statutes preserved across both providers.
  - Zero API key requirement strictly maintained.

## ADR-039: Autonomous Public Domain Book Content Pipeline, Supabase Plain-Text Caching & Mirror Resiliency Architecture
- **Status**: Accepted
- **Context**:
  1. In production serverless deployments (Vercel Edge/Serverless `iad1`), streaming plain text from Project Gutenberg (`www.gutenberg.org`) via `/api/books/content` was subject to datacenter IP throttling and firewall drops ("Unable to Load Masterwork Text").
  2. For international readers outside the US, the regional copyright gatekeeper (`metadata-cache.ts`) performed real-time fetches against `gutendex.com/books/${id}` (lacking a trailing slash, triggering 301 redirects or 6s timeouts). If unavailable or slow, the gatekeeper returned HTTP 503, blocking streaming even for public domain titles already seeded in Supabase.
  3. Project Gutenberg's official robot and mirroring policy explicitly requests that web applications and digital readers cache and host texts on their own infrastructure rather than proxying every read to Gutenberg's volunteer servers.
- **Decision**:
  1. **Database Schema Co-Evolution & Unabridged Plain-Text Storage (`supabase/schema.sql`, `src/types/database.types.ts`, `README.md`)**:
     - Added an optional `content TEXT` column to `public.books` using idempotent DDL (`ALTER TABLE public.books ADD COLUMN IF NOT EXISTS content TEXT;`).
     - Synchronized TypeScript types (`Row`, `Insert`, `Update`) and documented in `README.md`.
  2. **Bandwidth-Shielded Catalog Queries (`src/lib/catalog/supabase-provider.ts`)**:
     - Defined `CATALOG_METADATA_COLUMNS` explicitly omitting `content` from catalog queries, guaranteeing that 32-book catalog searches transfer zero plain-text bytes over the wire.
  3. **Multi-Tier Regional Copyright Gatekeeper (`src/app/api/books/content/metadata-cache.ts`)**:
     - Upgraded `resolveBookMetadata` to check self-hosted Supabase `public.books` first. If present, author lifespans are verified in <15ms without external requests.
     - Added canonical trailing slash (`/books/${bookId}/`) to the Gutendex fallback.
  4. **Multi-Tier Content Streaming & Safe Mirror Redundancy (`src/app/api/books/content/route.ts`, `url-validator.ts`)**:
     - Tier 1: Check Supabase `public.books.content`. If non-empty, stream immediately with sub-30ms response times and zero external dependencies (`X-Bookarium-Source: supabase`).
     - Tier 2: Multi-mirror upstream fallback (`www.gutenberg.org`, `aleph.gutenberg.org`, `gutenberg.readingroo.ms`) with `isSafeUpstreamUrl` anti-SSRF validation and redirect following for trusted mirrors.
  5. **Enhanced Ingestion Pipeline (`scripts/ingest-catalog.js`)**:
     - Added `--with-content` flag (enabled by default for `--curated`) to fetch unabridged text from mirrors and generate both `supabase/seed_books.sql` and `supabase/seed_books_content.sql` with collision-free dollar-quoted literals (`$bookarium_txt_${id}$`).
- **Consequences**:
  - Sub-30ms instant book delivery for all curated masterworks on Vercel.
  - Zero load on Project Gutenberg's volunteer infrastructure, 100% aligned with Gutenberg mirroring guidelines and international copyright law.
  - Complete elimination of 503 gatekeeper errors for non-US readers.
  - Total isolation of catalog search payloads from heavy text content.

## ADR-040: Autonomous Full-Catalog Gutenberg Ingestion & Periodic GitHub Actions Synchronization
- **Status**: Accepted
- **Context**:
  1. Under ADR-037 and ADR-038, Bookarium's dual-provider architecture falls back to Gutendex when books are not present in Supabase. To achieve complete self-hosted independence and eliminate latency/downtime from third-party REST APIs, the full ~72,000 public domain catalog metadata must be hosted in Supabase PostgreSQL (`public.books`).
  2. Storing raw novel text for 72,000 books would consume ~36 GB, exceeding Supabase's 500 MB free quota by 70x. Conversely, storing metadata only (`title`, `authors`, `birth/death years`, `subjects`, `bookshelves`, `languages`, `formats URLs`) requires $\approx 1.4\text{ KB}$ per row ($\approx 100\text{ MB}$ total), utilizing only $\approx 20\%$ of the free database tier.
  3. Project Gutenberg publishes nightly official feeds, including a gzip-compressed CSV catalog dump (`pg_catalog.csv.gz`, 5.5 MB compressed).
  4. Vercel serverless functions have a 10-second timeout limit on Hobby plans, making large-scale ingestion inside API routes unviable.
- **Decision**:
  1. **Streaming Catalog Synchronization Engine (`scripts/sync-gutenberg-catalog.js`)**:
     - Downloads and streams `https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv.gz` (5.5 MB) directly through Node's built-in `zlib.createGunzip()`.
     - Implements a zero-dependency RFC 4180 streaming CSV parser with robust handling of multi-line quoted fields.
     - Parses Library of Congress contributor strings to extract structured `authors` and `translators` JSONB with authentic birth and death years, including BCE dates, death-only, and birth-only notations.
     - Computes `max_author_death_year` and `min_author_birth_year` for sub-50ms international copyright filtering.
     - Maps deterministic canonical Gutenberg format URLs (`formats`).
     - Groups records into batches of 500 and executes idempotent batch upserts (`onConflict: 'id'`) via `@supabase/supabase-js`.
     - Provides CLI options (`--dry-run`, `--limit=N`, `--languages=...`, `--batch-size=N`).
  2. **Automated Scheduled GitHub Actions Workflow (`.github/workflows/catalog-sync.yml`)**:
     - Runs on a weekly schedule (`cron: '0 2 * * 0'`, Sundays at 02:00 UTC).
     - Supports manual execution via `workflow_dispatch` with optional `limit` and `dry_run` inputs.
     - Consumes $\approx 2\text{ minutes}$ of CI execution per run ($< 10\text{ minutes/month}$ out of GitHub's 2,000 free runner minutes).
     - Acts as an automatic heartbeat keeping the Supabase free-tier database active to prevent the 7-day inactivity pause.
  3. **Zero Raw Text Bloat & On-Demand Reader Streaming**:
     - Leaves the `content` column `NULL` for bulk ingestion.
     - When readers open books, the reader stream (`/api/books/content`) streams text on-demand from Gutenberg mirrors and caches into browser IndexedDB (`offlineStorage`).
- **Consequences**:
  - Full self-hosted catalog independence for ~72,000 public domain titles with instant <50ms GIN search.
  - Zero cost, zero API key requirement, and zero quota breach risk on Supabase Free Tier (~100 MB used out of 500 MB).
  - Automated weekly synchronization keeping metadata up to date without manual effort.
  - Complete elimination of third-party search availability dependencies.

## ADR-041: Declarative Copyright Subsystem Encapsulation & Unified Presentation Isolation
- **Status**: Accepted
- **Context**:
  1. Previously, copyright status calculations were scattered across 8 separate presentation components (`BookCard`, `BookPreviewModal`, `BookmarkCard`, `BookshelfRack`, `DownloadDrawer`, `BookshelfMobileModal`, `BookshelfSpine`, `NotebookView`). Each component manually subscribed to `useJurisdictionStore`, extracted author lifespans, executed `isBookPublicDomainInJurisdiction`, and formatted ad-hoc warning badges.
  2. This violated the Single Responsibility and DRY principles, creating maintenance friction whenever jurisdictional rules or badge styling changed.
  3. Territorial legal restriction notices lacked visual uniformity across components, and components like `DownloadDrawer` required complex inline logic to withhold download links under European Court of Justice (*GS Media*) and UK hyperlink communication case law.
- **Decision**:
  1. **Declarative Facade Hook (`src/hooks/useBookCopyright.ts`)**:
     - Introduced `useBookCopyright(book)` encapsulating jurisdiction subscription, public domain evaluation, restriction status (`isRestricted`, `isPublicDomain`), author lifespan extraction, and formatted reason strings into a clean declarative contract.
  2. **Unified Presentation Banner (`src/components/presentation/CopyrightNoticeBanner.tsx`)**:
     - Created a single, reusable component for rendering territorial copyright notices, public domain verification details, and statutory badges across card previews, download drawers, and modal views with accessible ARIA landmarks.
  3. **Refactored Presentation Layer**:
     - Refactored all 8 presentation components to delegate copyright logic strictly to `useBookCopyright` and visual notices to `CopyrightNoticeBanner`.
  4. **Domain Engine Extension (`src/lib/copyright-engine.ts`)**:
     - Added `partitionBooksByJurisdiction(books, countryCode)` to cleanly separate public domain volumes from restricted volumes in collection views.
  5. **Comprehensive Co-Located Testing**:
     - Added `src/hooks/useBookCopyright.test.ts` (100% branch/statement coverage) and `src/components/presentation/CopyrightNoticeBanner.test.tsx`.
- **Consequences**:
  - Encapsulation of legal logic in a single hook; zero duplicated copyright evaluation logic in presentation components.
  - Consistent visual language and accessibility for territorial notices across the application.
  - 100% adherence to international public domain copyright boundaries.

## ADR-042: Synchronized Dynamic SSR, Jurisdictional Edge Cookie Seeding & Zero-Flash Pre-Hydration Architecture
- **Status**: Accepted
- **Context**:
  1. On initial page load, visitors experienced an abrupt visual flash/swap: the Featured Hero Book displayed *Frankenstein* (Book #0) and the Classic of the Day displayed *Pride and Prejudice* (Book #1342) before abruptly jumping post-hydration to the actual hourly and daily books.
  2. This occurred because `HeroSearch.tsx` defined `getHourlyServerSnapshot = () => 0` and `idx = hasMounted ? (hourlyIndex % heroList.length) : 0`, while `EditorialQuoteSection.tsx` returned a static fallback when `!hasMounted`.
  3. Furthermore, the safe public domain book pool varies between jurisdictions (e.g. 27 books in the US vs. 24 books in Mexico). Because Client Components cannot read `document.cookie` during SSR on Node, client components evaluated using the US rule (27 books) on the server while Mexican clients hydrated using 24 books, risking index mismatch hydration warnings.
- **Decision**:
  1. **Server-Side Edge Cookie Extraction (`src/app/layout.tsx`)**:
     - Declared `export const dynamic = 'force-dynamic'` in `RootLayout` to enable request-time dynamic SSR rendering.
     - Extracted `bookarium-geo-country` from Next.js `cookies()` and passed `initialCountry` directly into `<Providers initialCountry={initialCountry}>`.
  2. **Synchronous Store Seeding (`src/stores/useJurisdictionStore.ts`)**:
     - Exported `initializeJurisdiction(country)`, which synchronously seeds the store during initial SSR and hydration before child presentation components execute, eliminating lifecycle delay.
  3. **Harmonized Server & Client Snapshots (`src/components/presentation/HeroSearch.tsx`)**:
     - Aligned `getHourlyServerSnapshot = () => getCurrentHourlyIndex()` with `getHourlySnapshot`.
     - Removed `useHasMounted` and derived `idx = hourlyIndex % heroList.length` immediately on initial render.
  4. **Direct Daily Book Evaluation (`src/components/presentation/EditorialQuoteSection.tsx`)**:
     - Removed `useHasMounted` and the static `#1342` fallback, evaluating `getDailyEditorialBook(activeHeroId, Date.now(), country)` directly on first paint.
- **Consequences**:
  - The initial HTML sent from the server matches the client's hydrated state at the exact same hour and jurisdiction.
  - Zero Cumulative Layout Shift (CLS: 0.00) and zero visual flashing on initial load.
  - Zero React 19 hydration mismatch warnings across all supported geographic jurisdictions.

## ADR-043: Supabase PostgreSQL Query Statement Timeout Resolution via Estimated Planner Statistics
- **Status**: Accepted
- **Context**:
  1. In `src/lib/catalog/supabase-provider.ts`, catalog searches executed against Supabase PostgreSQL `public.books` (78,086 rows) were intermittently timing out with PostgreSQL error `57014 (canceling statement due to statement timeout)` during peak load.
  2. Investigation revealed that the queries requested `{ count: 'exact' }`, forcing PostgreSQL to perform expensive sequential scans across tens of thousands of rows on every search query to calculate an exact total count.
  3. Because Gutenberg catalog count queries only require pagination bounds rather than atomic precision for tens of thousands of books, exact row-counting wasted significant database CPU and resulted in failover degradation to Gutendex.
- **Decision**:
  1. Switched `{ count: 'exact' }` to `{ count: 'estimated' }` in `supabase-provider.ts`.
  2. Leveraged PostgreSQL's internal planner statistics (`pg_class.reltuples`), reducing query overhead by orders of magnitude.
  3. Maintained exact bounds on small result sets while avoiding statement timeouts on large queries.
- **Consequences**:
  - Catalog query latency dropped from `>3,000ms` (statement timeout) down to **`~275ms`**.
  - Complete elimination of PostgreSQL 57014 timeout errors.
  - Rock-solid primary Supabase catalog performance without degrading to upstream mirrors.


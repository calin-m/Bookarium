# Architecture Matrix & Living Technical Reference — Bookarium

> **Auto-Generated Living Architecture**: Programmatically compiled from Source AST via `scripts/lib/ast-parser.js` (Governance Rule 2).  
> **Last Synchronized**: `2026-11-28`  
> **Topology Health**: `268` Modules Analyzed • `1163` Static Linkages • `0` Circular Dependencies • `0` Layer Violations • `0` Orphaned Modules

---

## 🏛️ System Architecture & Data Flow

Bookarium delivers a **100% Free, End-User Zero-Key Public Domain Reader** backed by self-hosted Supabase PostgreSQL + private Cloudflare R2 storage (`books/<id>.txt.gz`, `covers/<id>.jpg`), bundled Curated Archive fallback (`curated-fallback.ts`), real-time telemetry, and offline-first deterministic state isolation.

### 1. End-to-End System Context & Data Flow

```mermaid
flowchart TD
    User["👤 Reader / Public Domain Scholar"]
    
    subgraph FrontendSPA ["Client SPA Layer (Next.js 16 App Router)"]
        Providers["providers.tsx\n(QueryClient, Auth Init, Cloud Sync, verifyActiveSessionValidity, IP/UA Reconciliation, GlobalTitleTooltip & Dynamic AuthModal)"]
        SWReg["ServiceWorkerRegister.tsx & public/sw.js\n(App Shell v7, Static Asset Warmup & Offline Fallback)"]
        AuthModalNode["AuthModal.tsx, EmailSentView.tsx & TurnstileWidget.tsx\n(Sign-In, Sign-Up, Turnstile CAPTCHA, Honeypot, OAuth, Magic Link & Reset)"]
        Nav["Navbar.tsx\n(Brand Reset, View Switcher, Single-Phase Gliding Active Underline Cradle, Theme Cycler)"]
        Hero["HeroSearch.tsx\n(Precision Viewport Fold Docking, 3D Rotating Spotlight & Search)"]
        Hero3D["HeroFeaturedBook3D.tsx\n(3D Open-Cover Hinge, Leaf-Flip Engine & Fluid Kinematics)"]
        Toolbar["StickyCatalogToolbar.tsx\n(Desktop/Tablet Sticky Sub-Header, Flush Bottom Docking & Universal Ambient Capsule Dock)"]
        FilterDrawer["AdvancedFilterDrawer.tsx\n(Universal Bottom Sliding Panel, Staged Filter Execution, Multi-Select Touch Chips)"]
        EditorialQuote["EditorialQuoteSection.tsx\n(Classic of the Day, Collision & isPoolSettled Guard)"]
        LiteraryQuotes["LiteraryQuotes.tsx\n(Words That Shaped Humanity, Safe Shuffling & isPoolSettled Guard)"]
        CopyrightBanner["CopyrightNoticeBanner.tsx\n(Declarative Territorial Restriction & Public Domain Notice)"]
        ContentAdvisory["ContentAdvisoryBanner.tsx\n(Non-blocking Mature/Historical Context Advisory)"]
        CollectionToolbarNode["CollectionToolbar.tsx\n(Responsive Workbench: Single-Row Mobile Layout, Search, Desktop Favorites Preset, Sort & View Mode Toggles)"]
        CollectionBottomDockNode["CollectionBottomDock.tsx • CollectionFloatingSearch.tsx • CollectionFilterDrawer.tsx\n(Universal Ambient Dock, Animated Light Aura, Floating Search & Bottom Sliding Drawer with Shelf, Monochrome Filter & Sort Controls)"]
        CollectionEmptyStateNode["CollectionEmptyState.tsx\n(Unified Collection Empty State Card: p-12 Editorial Card, Section Icon Badge, Explore Catalog & Iconless Sign-in Actions)"]
        PaginationNode["Pagination.tsx\n(Accessible Numeric Page Navigation)"]
        BookPreviewModalNode["BookPreviewModal.tsx & NotablePassagesSpread.tsx\n(3D Open-Book Preview Spread, Notable Passages & Jurisdictional Protection)"]
        BookshelfRackNode["BookshelfRack.tsx & BookshelfSpine.tsx\n(Dynamic 2-Shelf Capacity, Sequential Left-to-Right Fill, showShelfControls Isolation, 3D Hardwood Shelf, Kinetic Strip, <1024px Touch Sheet & >=1024px Spines)"]
        BookshelfMobileModalNode["BookshelfMobileModal.tsx\n(Mobile & Tablet <1024px Action & Curation Sheet)"]
        RemoveOfflineModalNode["RemoveOfflineBookModal.tsx • RemoveCollectionBookModal.tsx\n(Offline Cache & Collection Eviction Confirmations)"]
        CatalogOfflineNode["CatalogOfflineView.tsx\n(Offline Catalog Notice & Collection Quick-Links)"]
        SymposiumInviteModalNode["SymposiumInviteModal.tsx\n(1-on-1 Literary Symposium Companion Picker)"]
        AccoladesEngine["accolades-engine.ts • ExLibrisBookplate.tsx • AccoladeCelebrationModal.tsx"]
        PublicSanctuaryNodes["PublicProfileView.tsx • ProfileShareModal.tsx • PinnedAccoladesShelf.tsx • PrivateProfileNotice.tsx"]
        
        subgraph Views ["Primary Application Views (/ & Edge Rewrites)"]
            Grid["Catalog View (/)\n(Smooth Scroll Navigation, Adaptive Offline Downloaded Dataset, 2-Col Mobile Grid & 3D Hardwood Shelf)"]
            ShelfView["Bookshelf View (/bookshelf)\n(Curated Library, Dynamic 2-Shelf Capacity, Sequential Left-to-Right Shelf Fill, showShelfControls Isolation, Downloaded (N) Smart Shelf & Active-Shelf Clear)"]
            FavView["Favorites View (/favorites)\n(Dedicated Cover Grid, Star Ratings & Personal Curation)"]
            MarksView["Bookmarks View (/bookmarks)\n(Tactile Reading Ledger, 2-Col Archival Grid, Status Filter, Direction-Aware Sort & Dedicated Resume CTA)"]
            NoteView["Commonplace Notebook (/notebook)\n(Highlights, Reflections, Tags, 2-Col Archival Grid, Tactile Scroll Focus (<1024px) & View Mode Scrubber)"]
            AccView["Account Hub (/account)\n(4-Tab Scholar Profile-First Layout, AccountBottomDock & Cloud Sync)"]
            PrivacyView["Privacy Architecture (/privacy)\n(Zero-Tracker Manifesto, 3-Tier Data Erasure, COPPA & Geo-Cookies)"]
            CopyrightView["Copyright Governance (/copyright)\n(Public Domain Manifesto, Multi-Jurisdiction Rules & DMCA Channel)"]
            ProfileCard["AccountPublicProfileSection.tsx, HighlightBioPickerModal.tsx & AccountSymposiumSection.tsx\n(View/Edit Scholar Profile Indicators, Highlight Motto Picker, Footer Edit/Cancel/Save & Symposium Pacts)"]
            AccountDockNode["AccountBottomDock.tsx\n(Context-Aware Ambient Capsule: Section Jumps, Accolades Filter Popover & Theme Cycler)"]
            HabitsCard["AccountHabitsCard.tsx & AccountAccoladesCard.tsx\n(Reading Streaks, Annual Challenge, Showcase & Ex-Libris Bookplates)"]
            SecurityCard["AccountSecuritySection.tsx\n(Active Device Sessions, Duplicate-Origin Hints, Turnstile Recovery, Google Disconnect & Confirm-Guarded Sign-Out)"]
            PrefsCard["AccountPreferencesSection.tsx\n(Unified Appearance, AccountTypographySubPanel, AccountNarrationSubPanel & Custom Defaults)"]
            ProfilePage["Public Scholar Sanctuary (/u/[username])\n(Public Profile, Pinned Accolades & Fellowship CTA)"]
            ReaderPage["Focus Reader Page (/read/[id])\n(Continuous Pagination, Subtitles, AST)"]
        end
        
        subgraph ReaderDrawers ["Portaled Mutual-Exclusion Dialogs (z-10000)"]
            TocDrawer["ReaderTocDrawer\n(Rich Subtitles & Page Numbers)"]
            SearchDrawer["ReaderSearchDrawer\n(In-Volume Live Text Search)"]
            ControlsDrawer["ReaderControls\n(Typography, Speech & Themes)"]
            LangDrawer["ReaderLanguageDrawer\n(International Editions Handoff)"]
            AnnotDrawer["ReaderAnnotationsDrawer\n(In-Volume Highlights, Pinned Bookmark, Notes & Deep Links)"]
            DownDrawer["DownloadDrawer\n(Download Hub: Offline Cache, R2 .txt Export & Coming-Soon Formats)"]
        end
        
        subgraph StateStores ["Zustand Persistent State & Offline Engine"]
            StoreShelf[("⚡ useBookshelfStore\n(saved, likes, queue, history, shelves, clearCustomShelfBooks)")]
            StoreReader[("📖 useReaderStore\n(typography, progress map, coordinates)")]
            StoreTheme[("🎨 useThemeStore\n(day, sepia, obsidian)")]
            StoreAuth[("🔐 useAuthStore\n(session, cloud migration, profile)")]
            StorePref[("⚙️ usePreferencesStore\n(sticky scroll, layout choices, customDefaults)")]
            StoreAnnot[("🖍️ useAnnotationStore\n(7-color highlights, notes, boundary updates, tags)")]
            StoreHabits[("🔥 useHabitsStore\n(streak, 5m threshold, dual immersion, cloud)")]
            StoreAccolades[("🎖️ useAccoladesStore\n(accolades, showcase pinning, celebrations, cloud)")]
            StoreFellowship[("🤝 useFellowshipStore\n(reader circles, symposiums, companion progress, cloud)")]
            SyncCoordinator["🔄 sync-utils.ts & preferences-sync.ts\n(Unified 7-Store Outbox/LWW & 14-Key Preferences Cloud Sync Coordinator)"]
            BookshelfSyncEngine["🔄 Domain Cloud-Sync Engines\n(bookshelf-cloud-sync • annotation-cloud-sync • fellowship-cloud-sync • reader-cloud-sync)"]
            StoreJurisdiction[("🌐 useJurisdictionStore\n(country, rule, dev override, cookie sync)")]
            StoreOffline[("📦 IndexedDB Engine\n(unabridged offline volume cache)")]
        end
        
        subgraph ReaderEngine ["Reader Runtime & Web Speech Subsystem"]
            SessionHook["📖 useReaderSession & useReaderHabitTelemetry\n(Position Memory, Deep Links, Reflow Healing & Habit Telemetry)"]
            SpeechHook["🔊 useReaderSpeech\n(SpeechSynthesis, Boundary Sync, Auto-Flip)"]
            TimerHook["⏱️ useReadingTimer\n(Dual Immersion: 2-min Idle Guard + TTS Audio Bypass)"]
            WorkerHook["⚙️ useGutenbergParserWorker\n(Persistent Worker Chapter AST)"]
            LedgerHook["🔖 useContinueReadingLedger\n(Two-Way Hydration & 0ms Resume)"]
            AnnotatorEngine["🖍️ reader-annotator.ts & reader-bookmark-geometry.ts\n(Interval Partitioning, Span Boundary Snapping & Row Geometry)"]
        end
        
        HookCopyright["⚖️ useBookCopyright\n(Declarative Facade: Rules, Lifespans & Status)"]
        HookNetwork["📡 useNetworkStatus & useOfflineCatalogFallback\n(Reactive Online/Offline Store & Adaptive Offline Catalog)"]
        HookAutoHeal["🩺 useCollectionAutoHeal & useNotebookMetadataResolver\n(Author Lifespan & Marginalia Metadata Auto-Rehydration)"]
        HookCatalogFilters["🎛️ useCatalogFilters & useAccountSecurityActions\n(Catalog Filter Staging & OWASP Account Security Workflows)"]
        QueryBooks["🔄 useBooks, useFeaturedQuotes, useQuoteEnrichedBooks & usePrefetchNextPage\n(Windowed Sub-Pages, Primary Quotes JSONB, Live Enrichment & Predictive Prefetch)"]
        QueryContent["🔄 useBookContent(url, bookId)\n(Offline-Always IndexedDB Check to CDN Stream)"]
        QueryTranslate["🌐 useBookTranslations\n(International Editions Relational Handoff)"]
        Telemetry["📊 Vercel Telemetry\n(Analytics & Speed Insights)"]
    end

    subgraph ServerLayer ["Next.js Root Proxy & Edge Routing Layer"]
        RootProxy["Next.js 16 Root Proxy (src/proxy.ts)\n(Edge Geo-IP: x-vercel-ip-country, Dev ?country=XX, Fetch Metadata Guard & Public RSC Bypass)"]
        ProxyBooks["GET /api/books\n(Edge CDN: 12h Quote Pool • 24h Catalog • 7d Quote/Meta IDs • Vercel-Cache-Tag, Rate Limit, Seam Controller)"]
        CatalogSeam["Catalog Seam & Bundled Fallback (src/lib/catalog/)\n(supabase-provider.ts • curated-fallback.ts)"]
        ProxyContent["GET /api/books/content, /covers/[file], /og/books/[file]\n(24h Text [book-content] & OG Card • 30d R2 Cover Proxy [covers] • Strict Private R2)"]
        ProxyBookTranslations["GET /api/books/translations\n(7d Edge SWR Cache • s-maxage=604800 • Vary: x-vercel-ip-country • Vercel-Cache-Tag: translations • FRBR Work Mapping)"]
        AuthCallback["GET /auth/callback\n(PKCE & Token-Hash OTP, Strip Recovery, Sanitized UA Forwarding & IP Sync Cookie)"]
        LayoutServer["Server Layout & Page (/read/[id])\n(reader-layout-utils.ts • BookReaderClient • React.cache • 24h unstable_cache + HEAD Probe • OpenGraph & JSON-LD)"]
        ProfileLayoutServer["Server Layout (/u/[username])\n(profile-layout-utils.ts • server-rsc-nav.ts • 500-Entry 5m LRU • Zero-PII & Anti-Enumeration)"]
        ProxyProfileCard["GET /api/profiles/card\n(Stateless 1200x630 Scholar OG PNG • Visual ?s= Token • ADR-033 Neutral Fallback)"]
        StaticSeoRoutes["SSR Metadata & Crawler Gateways\n(/privacy & /copyright Layouts • /auth/confirm-deletion noindex • robots.ts • 5,000-Book Dynamic sitemap.ts)"]
    end

    subgraph LegalLayer ["Jurisdictional Copyright & Content Safety Engine"]
        EngineCore["isBookPublicDomainInJurisdiction\n(US 1930 Cutoff, Life+70, Life+100, Life+80)"]
        JointAuthors["Joint Authorship Guard (Berne Art. 7bis)"]
        Translators["Translator Protection (Berne Art. 2(3))"]
        ContributorFilter["Contributor Role Filter\n(Illustrator/Artist Non-Blocking Exclusion)"]
        ContentScanner["Content Advisory Engine (src/lib/content-advisory.ts)\n(LOC Subject & Bookshelf Lexical Scanner)"]
        CountryResolver["Country Resolver (src/lib/country-resolver.ts)\n(Edge Geo-IP, Cookie Sync, Timezone Inference)"]
        MetaCache["Metadata Lifespan Cache\n(metadata-cache.ts • 24h LRU)"]
    end

    subgraph UpstreamServices ["100% Public Domain & Cloud Infrastructure"]
        CuratedArchive["📚 Bundled Curated Archive\n(featured-books.ts • 27 Classics)"]
        CloudflareR2[("☁️ Cloudflare R2 Private Bucket\n(covers/{id}.jpg • books/{id}.txt.gz)")]
        GutenbergCDN["🌐 Official PG rsync & PGLAF Mirrors (CLI Only)\n(gutenberg.pglaf.org • aleph.gutenberg.org • rsync.ibiblio.org • gutenberg.readingroo.ms)"]
        WikidataSPARQL["🌐 Wikidata SPARQL (CC0 1.0)\n(P2034 Gutenberg ID & P407/P424 Language Clusters)"]
        SupabaseCloud[("⚡ Supabase Cloud (PostgreSQL)\n(public.books, book_translations, profiles, shelves, progress, habits, accolades)")]
        SyncEngine["🔄 Gutenberg Catalog Sync Engine\n(scripts/sync-gutenberg-catalog.js • .github/workflows/catalog-sync.yml)"]
        SyncR2["🔄 R2 Delta Asset Sync\n(scripts/sync-r2-assets.js • .github/workflows/r2-sync.yml)"]
        ScanR2["🔍 R2 Content Integrity Scan\n(scripts/scan-r2-content.js • .github/workflows/r2-content-scan.yml)"]
        SyncTranslations["🔄 Relational Translations Sync\n(scripts/ingest-translations.js • .github/workflows/translations-sync.yml)"]
        SyncQuotes["🔄 Featured Quotes Sync Engine\n(scripts/sync-featured-quotes.js • .github/workflows/quotes-sync.yml)"]
        PurgeVercel["🧹 Edge Cache Tag Purge CLI\n(scripts/purge-vercel-cache.js • .github/workflows/cache-purge.yml)"]
        CISecurity["🛡️ SHA-Pinned CI, CodeQL & Dependency Review\n(.github/workflows/ci.yml • codeql.yml • dependency-review.yml • release.yml)"]
        VercelEdge["⚡ Vercel Edge Platform\n(Edge CDN SWR, Cookie-less Analytics & Speed Insights)"]
    end

    User --> RootProxy
    User --> LayoutServer
    User --> ProfileLayoutServer
    User -->|"Legal, Privacy & Sitemap"| StaticSeoRoutes
    LayoutServer -->|"SSR Catalog/Hero Lookup (React.cache)"| SupabaseCloud
    ProfileLayoutServer -->|"Zero-PII Public Handle Check"| SupabaseCloud
    ProfileLayoutServer --> ProfilePage
    ProfilePage -.->|"SSR/Client Public Profile Query"| SupabaseCloud
    StaticSeoRoutes --> PrivacyView
    StaticSeoRoutes --> CopyrightView
    RootProxy --> CountryResolver
    CountryResolver --> StoreJurisdiction
    RootProxy --> Providers
    Providers --> SWReg
    Providers --> AuthModalNode
    Providers --> SyncCoordinator
    Providers -.-> Telemetry
    RootProxy --> Nav
    RootProxy --> Hero
    Hero --> Hero3D
    RootProxy --> Toolbar
    RootProxy --> AuthCallback
    AuthCallback -->|"Verified Session Exchange"| SupabaseCloud
    Toolbar --> FilterDrawer
    FilterDrawer --> HookCatalogFilters
    HookCatalogFilters --> QueryBooks
    Toolbar --> Grid
    Grid --> CopyrightBanner
    Grid --> ContentAdvisory
    Grid --> HookCopyright
    Grid --> HookNetwork
    Grid -->|"Zero Offline Books"| CatalogOfflineNode
    Nav --> HookNetwork
    Grid --> EditorialQuote
    Grid --> LiteraryQuotes
    Grid --> BookPreviewModalNode
    Grid --> BookshelfRackNode
    ShelfView --> BookshelfRackNode
    ShelfView --> CollectionEmptyStateNode
    FavView --> CollectionEmptyStateNode
    MarksView --> CollectionEmptyStateNode
    NoteView --> CollectionEmptyStateNode
    BookshelfRackNode --> CollectionEmptyStateNode
    BookshelfRackNode --> BookshelfMobileModalNode
    BookshelfRackNode --> BookPreviewModalNode
    ShelfView --> RemoveOfflineModalNode
    FavView --> RemoveOfflineModalNode
    MarksView --> RemoveOfflineModalNode
    BookPreviewModalNode --> SymposiumInviteModalNode
    Nav -->|"Route / Tab Switch"| Grid
    Nav --> ShelfView
    Nav --> FavView
    Nav --> MarksView
    Nav --> NoteView
    Nav --> AccView
    FavView --> HookAutoHeal
    ShelfView --> HookAutoHeal
    MarksView --> HookAutoHeal
    NoteView --> HookAutoHeal
    HookCopyright --> EngineCore
    ContentAdvisory --> ContentScanner
    DownDrawer --> ContentAdvisory
    AccView --> ProfileCard
    AccView --> AccountDockNode
    AccView --> HabitsCard
    HabitsCard --> AccoladesEngine
    AccView --> SecurityCard
    AccView --> PrefsCard
    ProfileCard --> StoreFellowship
    ProfilePage --> PublicSanctuaryNodes
    PublicSanctuaryNodes --> StoreFellowship
    ProfileLayoutServer -.->|"OpenGraph summary_large_image"| ProxyProfileCard
    ProxyProfileCard -->|"Live Public Summary (is_public=true)"| SupabaseCloud
    SyncCoordinator --> StoreShelf
    SyncCoordinator --> StoreReader
    SyncCoordinator --> StoreAnnot
    SyncCoordinator --> StoreHabits
    SyncCoordinator --> StoreAccolades
    SyncCoordinator --> StoreFellowship
    StoreShelf --> BookshelfSyncEngine
    BookshelfSyncEngine -->|"Cloud Sync via RLS"| SupabaseCloud
    StoreFellowship -->|"Circles & Symposium Sync"| SupabaseCloud
    StoreAnnot -->|"Marginalia & Symposium Sync"| SupabaseCloud
    StoreOffline -->|"Adaptive Offline Catalog"| Grid
    StoreOffline -->|"Offline Volumes & Smart Shelf"| ShelfView
    StoreOffline -->|"Offline Volumes Filter"| LedgerHook
    ShelfView --> CollectionToolbarNode
    FavView --> CollectionToolbarNode
    MarksView --> CollectionToolbarNode
    NoteView --> CollectionToolbarNode
    ShelfView --> CollectionBottomDockNode
    FavView --> CollectionBottomDockNode
    MarksView --> CollectionBottomDockNode
    NoteView --> CollectionBottomDockNode
    Grid --> PaginationNode
    ShelfView --> PaginationNode
    FavView --> PaginationNode
    MarksView --> PaginationNode
    NoteView --> PaginationNode
    
    Grid --> QueryBooks
    QueryBooks --> ProxyBooks
    ProxyBooks --> CatalogSeam
    CatalogSeam --> EngineCore
    CatalogSeam -->|"Primary: Planner/Estimated Fast Scan / 504 Timeout Shield"| SupabaseCloud
    CatalogSeam -.->|"Fallback when Supabase unconfigured"| CuratedArchive
    SyncEngine -->|"Weekly Cron Snapshot Diff & pg_catalog.csv.gz Stream"| SupabaseCloud
    CISecurity -.->|"Verifies Builds, Gates & SemVer Releases"| SyncEngine
    
    ReaderPage --> QueryContent
    ReaderPage --> TocDrawer
    ReaderPage --> SearchDrawer
    ReaderPage --> ControlsDrawer
    ReaderPage --> AnnotDrawer
    ReaderPage --> DownDrawer
    ReaderPage --> SessionHook
    ReaderPage --> SpeechHook
    ReaderPage --> WorkerHook
    ReaderPage --> LedgerHook
    ReaderPage --> TimerHook
    ReaderPage --> AnnotatorEngine
    AnnotatorEngine --> StoreAnnot
    SessionHook --> StoreReader
    LedgerHook --> StoreReader
    QueryContent --> ProxyContent
    ProxyContent --> MetaCache
    MetaCache -->|"1. Supabase public.books check"| SupabaseCloud
    MetaCache -.->|"2. Fallback to Bundled Featured Fixtures"| CuratedArchive
    MetaCache --> EngineCore
    EngineCore --> JointAuthors
    EngineCore --> Translators
    EngineCore --> ContributorFilter
    ProxyContent -->|"Tier 1: Strict R2 Covers & .txt.gz (404/503 Fail-Closed)"| CloudflareR2
    ReaderPage --> QueryTranslate
    LangDrawer --> QueryTranslate
    QueryTranslate -->|"Tier 1: Relational Work Mapping"| ProxyBookTranslations
    ProxyBookTranslations -->|"100% Precision Relational Query"| SupabaseCloud
    QueryTranslate -.->|"Tier 2: Internal /api/books Author Search"| ProxyBooks
    SyncTranslations -->|"Weekly & On-Demand Ingestion"| SupabaseCloud
    SyncTranslations -.->|"Wikidata P2034 Query & Fallback Snapshot"| WikidataSPARQL
    SyncR2 <-->|"ListObjectsV2 / PutObject / DeleteObject & Merged 90d State"| CloudflareR2
    ScanR2 -.->|"Read-Only ListObjectsV2 / .txt.gz Term Audit"| CloudflareR2
    SyncR2 -.->|"aleph ↔ ibiblio rsync --files-from / PGLAF HTTPS Fallback"| GutenbergCDN
    SyncQuotes -->|"Weekly Delta & On-Demand Two-Tier Quotes JSONB Upsert"| SupabaseCloud
    SyncQuotes -.->|"R2 books/{id}.txt.gz First (0s Delay) when R2 Configured"| CloudflareR2
    SyncQuotes -.->|"8.0s–16.0s Float-Paced 3-Mirror Fallback (pglaf,aleph,readingroo)"| GutenbergCDN
    SyncEngine -.->|"Live Run: Purge catalog,quotes,translations[,r2-tags]"| PurgeVercel
    SyncR2 -.->|"Delete/Force Overwrite: Conditional covers/book-content Purge"| PurgeVercel
    SyncTranslations -.->|"Manual Live Run: Purge translations"| PurgeVercel
    SyncQuotes -.->|"Manual Live Run: Purge quotes"| PurgeVercel
    PurgeVercel -.->|"POST /v1/edge-cache/dangerously-delete-by-tags"| VercelEdge
    
    Grid --> StoreShelf
    ShelfView --> StoreShelf
    FavView --> StoreShelf
    MarksView --> StoreReader
    NoteView --> StoreAnnot
    AccView --> StoreAuth
    PrefsCard --> StorePref
    PrefsCard --> StoreTheme
    HabitsCard --> StoreHabits
    HabitsCard --> StoreAccolades
    TimerHook --> StoreHabits
    StoreShelf -->|"Cloud Sync via RLS"| SupabaseCloud
    StoreReader -->|"Progress Sync"| SupabaseCloud
    StoreAuth -->|"Session Auth"| SupabaseCloud
    StoreHabits -->|"Habits Sync via RLS"| SupabaseCloud
    StoreAccolades -->|"Accolades Sync via RLS"| SupabaseCloud
    Telemetry -.->|"Anonymous Metrics"| VercelEdge
```

---

## 📚 Modular Subsystem Architecture Directory

Every subsystem matrix, temporal sequence flow, security boundary, and AST dependency catalog is compiled deterministically into focused documents under `docs/architecture/` while this entrypoint retains the global **Diagram 1** system overview:

| Subsystem Reference Document | Diagrams Included | Architectural Coverage |
| :--- | :--- | :--- |
| [**Focus Reader, Components, Zustand State & Domain Contracts**](architecture/reader-components-and-state.md) | Diagrams 2–3 | Focus Reader state & typography (`Diagram 2`), Bookmarks & Continue Reading ledger (`Diagram 3`), Babel-extracted Component Props Matrix, 10 Zustand stores, config tokens, and TypeScript models. |
| [**Event Bus, Reactive Signals & Runtime Execution Workflows**](architecture/event-bus-and-runtime-flows.md) | Diagrams 4–7 | Cross-store/Worker/DOM Event Bus (`Diagram 4`), reactive signals & account erasure matrices, and temporal `sequenceDiagram` flows for Cold Launch, Focus Reader/R2 Stream, and Offline Replay (`Diagrams 5–7`). |
| [**API Routes, App Router, Hooks, Domain Engines, SEO & Edge Proxy**](architecture/routes-hooks-and-engines.md) | Diagram 16 | Edge & Serverless API route handlers, App Router entrypoints, TanStack Query & Reader hooks, pure domain engines, Technical SEO & Structured Metadata routing (`Diagram 16`), Web Worker + PWA Service Worker runtime, and `src/proxy.ts`. |
| [**Background Data Pipelines, Database RLS & Query-to-Index Contracts**](architecture/database-and-pipelines.md) | Diagram 8 | GitHub Actions & Database Ingestion Topology (`Diagram 8`), CLI & workflow inventory, PostgreSQL RLS policies/functions/indexes, seed artifacts, and 78k-row anti-timeout query contracts. |
| [**Caching Strategy, External Integrations, Failure Modes & Edge Ops**](architecture/integrations-failure-and-ops.md) | Diagrams 10–13 | Multi-tier data pulling & caching strategy, External Integration Boundaries (`Diagram 10`), Failure Modes & Self-Healing (`Diagram 11`), Edge Routing & Weekly Cron (`Diagram 12`), 5-Layer CDN/R2 Caching (`Diagram 13`), and Performance Budgets. |
| [**Environment Bindings, Security Trust Zones & Fellowship Topology**](architecture/security-and-fellowship.md) | Diagrams 14–15 | AST-verified `.env.example` bindings, Trust-Zone request-taint topology, Auth/Recovery & Session Revocation (`Diagram 14`), and Reader Circles, Symposium & Trigger Guards (`Diagram 15`). |
| [**Testing Pipeline, Repository Topology, AST Call Graph & Node Tooling**](architecture/ast-topology-and-tooling.md) | Diagram 9 | Hermetic Testing & SAST Pipeline (`Diagram 9`), suite distribution, Repository & Living Docs map, cross-boundary & `src/`/`scripts/` AST topology matrices, Node.js dependency stack, CLI tools, and workspace manifests. |

---

## 🛡️ 7-Gateway Quality Engine Architecture

Bookarium enforces a deterministic 7-stage quality assurance pipeline (`scripts/verify-build.js` via `npm run verify`) gating all releases and commits:

| Gateway Pass | Stage Name | Target & Tooling | Enforcement & Governance |
| :--- | :--- | :--- | :--- |
| **Pass 0.5** | Secrets, File/Path, AST Env & Transitive Graph Scanner | Secret regex, JWT decoder, `.env.example` & Babel AST env/client-privilege/import-graph analyzers | Zero live keys/JWTs, forbidden files, undocumented bracket/destructured/aliased `process.env.*` vars, client `SUPABASE_SERVICE_ROLE_KEY`, or transitive client->server imports |
| **Pass 0.75** | 7-Pillar SAST, Lockfile, Workflow & Full AST Suite | Lockfile SRI/registry/GPL-AGPL license check, SHA-pinned/permissions workflow scanner, `npm audit`, 9-rule AST taint engine, SQL RLS, plus `sast-validators.js` Babel AST API/Redirect/Public-Domain/Rule-9/SW/Header auditors | Enforces lockfile SHA-512/registry integrity & offline GPL/AGPL copyleft ban, 40-char commit-SHA & `permissions:` GitHub Actions hardening, 0 High/Critical CVEs, standalone AST coverage across `src/`, `scripts/`, `public/sw.js`, & `next.config.ts` (with explicit `ast-parse-error` reporting), server + client `router.push()`/`replace()` taint, Pillar-3 XSS/eval deduplication, API route limiter/manual-redirect checks, PostgreSQL RLS + AST Rule-9 teardown parity, AST `public/sw.js` guards, and AST-verified `X-Frame-Options: DENY` / `object-src 'none'` CSP headers |
| **Pass 1** | TypeScript Strict Compilation | `tsc --noEmit` | Strict type safety across all components, stores, hooks, and types |
| **Pass 2** | MSW Server & React Query Validation | `vitest run src/hooks/queries src/app/api` | Validates edge proxy routes, rate limiters, and TanStack Query hooks against MSW |
| **Pass 3** | Unit & Integration Test Suites | `vitest run --coverage` | Tiered 95/95/92/85% coverage floor across all co-located suites |
| **Pass 4** | Living AST Documentation Sync | `docs:sync` toolchain | Auto-generates living `ARCHITECTURE.md` hub, `7` `docs/architecture/*.md` subsystem specs, `SECURITY.md` (`<!-- BEGIN:security-architecture -->`), `GUTENBERG_PARSER.md`, `SYSTEM_CONTRACTS.md`, `ROADMAP.md`, `CHANGELOG.md`, and `QUALITY_AUDIT_REPORT.md` |
| **Pass 5** | ADR, Schema, Inventory, Doc Parity & Test Co-Location | Markdown/SQL/TS AST & filesystem co-location verification | Validates contiguous ADR sequence & 4-field schema, 19 mandatory governance docs, bidirectional `docs/ARCHITECTURE.md`<->`docs/architecture/*.md` TOC & corpus parity, circular `SECURITY.md` symbol/table/feed parity (`auditSecurityDocumentationParity`), dynamic `/privacy`/`/copyright`/`AccountDeleteModal` technical & erasure parity (`auditLegalDocumentationParity`), 0 broken Mermaid diagrams (`validateMermaidDiagramsInMarkdown`), `@scope`/`@invariant`/`@adr` behavioral contracts across 105 Tier-1..Tier-4 protected modules + bidirectional `docs/SYSTEM_CONTRACTS.md` heading/count parity, semantic command/metric/workflow-count parity, dead-path & `17`-map orphaned generator lookup key checks, placeholder-prose guards, 1:1 `src/`<->architecture corpus inventory, 1:1 SQL<->TS schema parity, 0 circular/parse-error/layer-violation/orphan modules, and 100% 1:1 co-located `.test.ts(x)` suites across `src/` & CLI/AST scripts |
| **Pass 6** | Code Quality, Custom AST Security Lint & Dead Code Audit | `eslint . --max-warnings 0` (`bookarium-security`) & Knip | Zero ESLint errors or warnings across Next.js, TypeScript, and 9 custom AST/taint security rules (`src/`, `scripts/`, `public/sw.js`, `next.config.ts` audited via Pass 0.75); zero dead files/exports |
| **Pass 7** | Production Application Build & Live HTTP Smoke Probe | `next build` + `.next/routes-manifest.json` + loopback `next start` probe | Optimized production Next.js bundle compilation within byte budget, compiled security header parity (`X-Frame-Options: DENY`, `object-src 'none'`, `frame-ancestors 'none'`), and live runtime HTTP verification of headers, `400` SSRF/param blocking, and origin-locked `/auth/callback` redirects |

---

## 🔒 Verification & Compliance

This architecture document is verified deterministically by **Pass 4 of the 7-Gateway Quality Engine** (`npm run verify`).

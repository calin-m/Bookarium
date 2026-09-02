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




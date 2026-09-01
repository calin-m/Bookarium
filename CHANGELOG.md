# Changelog

All notable changes to Bookarium are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.7.0] - 2026-09-01
### *Modular Component Decomposition, Account Route Migration & Zero-Shift Header*

### Added
- Single-Source Route Registry (`src/config/routes.ts`): Type-safe centralized registry providing static paths (`ROUTES.HOME`, `ROUTES.ACCOUNT`, `ROUTES.CONFIRM_DELETION`, `ROUTES.BOOKSHELF`, `ROUTES.LIKES`) and dynamic builders (`ROUTES.READ(id)`, `ROUTES.VIEW(view)`).
- Site Branding & Storage Registry (`src/config/site-config.ts`): Consolidated canonical project links (`SITE_CONFIG`), upstream Gutenberg mirrors, and persistent storage keys (`STORAGE_KEYS`).
- Bookshelf Component Decomposition: Modularized `BookshelfRack.tsx` into single-responsibility sub-components (`BookshelfSpine.tsx`, `BookshelfMobileModal.tsx`, `BookshelfManageModals.tsx`) with 100% co-located tests.
- Account Settings Modularization & Route Migration: Migrated `/profile` to `/account` with modular sub-components in `src/components/account/` (`AccountIdentityCard.tsx`, `AccountLibraryStats.tsx`, `AccountSecuritySection.tsx`, `AccountPreferencesSection.tsx`, `AccountDeleteModal.tsx`) with 100% co-located tests.
- Order-Independent Dynamic Smart Search (`/lib/smart-search.ts`, `CollectionSearchBar.tsx`): Real-time, zero-network-latency client search engine for Bookshelf and Favorites supporting order-independent multi-token matching, diacritic insensitivity, instant clear button, keyboard shortcuts (`Esc`), and live counter badges.
- Dynamic Active Icon Fills & Zero-Shift Header Hydration: Clean dynamic SVG fills for Bookshelf (`fill-primary`) and Favorites (`fill-destructive`) when containing saved items, eliminating text clutter and delivering 100% stable layouts (CLS = 0).
- Test Suite Granularity & Expansion: Expanded test suite to 64 suites and 404 focused, single-responsibility tests with 100% co-located coverage.

### Changed
- Codebase Orchestration: Reduced `BookshelfRack.tsx` from 861 to 389 lines (-55%) and `src/app/account/page.tsx` from 787 to 328 lines (-58%).
- Link & Storage Adoption: Replaced all scattered hardcoded routes and storage key strings across Navbar, Footer, BookCard, Bookshelf, Account, Reader, and Zustand stores with centralized configuration singletons.
- Header Ergonomics: Updated user menu button to clean "Account" label and internal link to "Settings" with dedicated icon.

### Fixed
- Eliminated hardcoded route duplication and typo vulnerabilities across all presentation components and state stores.
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

# 🗺️ Bookarium Product & Engineering Roadmap

> **Deterministic AST-Verified Living Roadmap** — Synchronized programmatically with source code and tests (0% drift).

[![Current Release](https://img.shields.io/badge/Current%20Release-v2.8.1-teal?style=flat-square)](CHANGELOG.md)
[![Overall Progress](https://img.shields.io/badge/Roadmap%20Progress-88%25-brightgreen?style=flat-square)](ROADMAP.md)
[![Total Features](https://img.shields.io/badge/Features-29_of_33-blue?style=flat-square)](ROADMAP.md)
[![Drift](https://img.shields.io/badge/Drift-0%25%20Verified-blueviolet?style=flat-square)](ROADMAP.md)

---

## 📊 Overall Roadmap Completion

`[██████████████████░░]` **29/33 (88%)**

---

## 🏛️ Strategic Engineering Milestones

### Milestone 0: Core Architecture & Production Hardening (`v1.7.0 (Completed)`)
`[████████████████████]` **6/6 (100%)**

> Foundational Next.js 16 App Router architecture, tactile skeuomorphic bookshelves, 3D spine physics, edge caching, and security hardening.

- [x] **Paged Virtual Layout & Flip Transitions** `✅ VERIFIED`
  Virtual continuous pagination in `ReaderSurface.tsx` (Paginated vs Continuous Scroll modes), touch swipe, keyboard controls, and hardware-accelerated 180ms page-turn transitions (`animate-page-turn`).
- [x] **Exact Reading Progress & Auto-Resume Engine** `✅ VERIFIED`
  Precise coordinates persistence (`chapterIndex`, `chapterPage`, `globalPage`, `bookmarkRow`, `lastReadAt`) in `useReaderStore`, interactive in-page row-snapping bookmark tab (`ReaderSurface.tsx`), "Resumed at Chapter X" toast, and 1-click Restart.
- [x] **Vercel Edge Response Caching & Rate Limiting** `✅ VERIFIED`
  Edge headers (`stale-while-revalidate`), datacenter proximity pinning (`iad1` in `vercel.json`), and sliding-window rate limiters protecting upstream Project Gutenberg APIs.
- [x] **Polite Client-Side Prefetching** `✅ VERIFIED`
  Background prefetching of page N+1 during browser idle time (`requestIdleCallback`) routing through internal cached proxy routes.
- [x] **Multi-Category Custom Bookshelves** `✅ VERIFIED`
  Custom bookshelf creation, master General shelf, floating "Move to Shelf" selector dropdowns on desktop book spines, `<1024px` mobile & tablet curation action sheets (`BookshelfMobileModal.tsx`), active-shelf-aware clearing (`clearSavedBooks`, `clearCustomShelfBooks`), and safe shelf deletion auto-reassigning volumes.
- [x] **Bi-Directional Supabase Cloud Sync with RLS** `✅ VERIFIED`
  PostgreSQL cloud synchronization for custom bookshelves and reading collections using Row-Level Security (RLS) with 100% offline-first local storage fallback.

---

### Milestone 1: Reader Mastery & Accessibility (`v1.8.0 (Completed)`)
`[████████████████████]` **3/3 (100%)**

> Elevate the reading experience with instantaneous in-book phrase searching, zero-cost text-to-speech, and native standalone PWA installation.

- [x] **In-Book Full-Text Search Drawer** `✅ VERIFIED`
  Client-side phrase and dialogue search drawer (`ReaderSearchDrawer.tsx`) scanning active book text in memory with live snippet previews, match count, and direct jump to chapter and page.
- [x] **Native Web Speech Text-to-Speech (Read-Aloud)** `✅ VERIFIED`
  Incorporate browser `window.speechSynthesis` with sentence segmentation, natural voice prioritization, Play/Pause, speed tuning (0.85x–2.0x), and synchronized visual sentence highlights (`useReaderSpeech.ts`, `ReaderSpeechBar.tsx`).
- [x] **Progressive Web App (PWA) Manifest & Standalone App** `✅ VERIFIED`
  Native `src/app/manifest.ts` metadata, theme colors, and icons enabling 1-click "Add to Home Screen" installation on iOS, Android, and Desktop.

---

### Milestone 2: Scholar Annotations & Data Portability (`v1.9.0 (Completed)`)
`[████████████████████]` **4/4 (100%)**

> Transform Bookarium into a tactile literary notebook with colored quote highlights, personal annotations, and full library export/import.

- [x] **Text Highlighting & Annotations Drawer** `✅ VERIFIED`
  Interactive text selection popover in `ReaderSurface.tsx` supporting 4 editorial pastel colors (Yellow, Amber, Mint, Rose) and personal notes stored in `useAnnotationStore.ts`.
- [x] **Literary Commonplace Notebook & Reading Journal** `✅ VERIFIED`
  Dedicated commonplace journal (`/?view=notebook`) aggregating all preserved quotes and marginalia, searchable across text, notes, and authors, with By-Book vs Chronological grouping, tablet-optimized icon mode toggles, academic citation generation, and deletion protection.
- [x] **IndexedDB Offline Book Storage** `✅ VERIFIED`
  Zero-dependency local caching of downloaded and saved book texts using native IndexedDB (`BookariumOfflineDB`), cross-instance event broadcast (`OFFLINE_BOOKS_UPDATED_EVENT`), Adaptive Offline Catalog (`CatalogOfflineView.tsx` & downloaded catalog fallback), Red Offline Account Indicator (`useNetworkStatus.ts`), offline-first outbox reconciliation across all personal stores, restriction-parity dimming/badges on undownloaded offline volumes, Bookshelf `Downloaded (N)` smart shelf pill (`DOWNLOADED_SHELF_ID`) with active-shelf-aware clearing (`Clear Downloaded Shelf`), unified `Downloaded` collection search filter, and removal confirmation modals (`RemoveOfflineBookModal.tsx`), enabling unabridged reading on airplanes or offline.
- [x] **Library Portability: Export & Import** `✅ VERIFIED`
  Single-click JSON/CSV library backup and restore in Account Settings, giving users 100% portable ownership of their personal shelves, bookmarks, and reading history.

---

### Milestone 3: Habits, Goals & Library Curation (`v2.0.0 (Completed)`)
`[████████████████████]` **3/3 (100%)**

> Rich reader curation, Goodreads-style reading statuses, and daily habit tracking analytics.

- [x] **Bookmarks & Continue Reading Ledger (`/?view=bookmarks`)** `✅ VERIFIED`
  Dedicated reading ledger displaying all books in progress with tactile bookmark cards, top-anchored silk ribbon markers (`origin-top scale-y-110`), card-tap focus/activation across all viewports with desktop cursor-exit focus release (`onDeactivate`), last-read passage snippets, completion percentages, multi-attribute sorting and filtering (Recent, Progress, Title, Author, Downloaded), status tabs (In Progress, Completed, On Hold), and dedicated 1-click `Resume` / `Read Again` CTA navigation.
- [x] **1–5 Star Personal Ratings & Reading Statuses** `✅ VERIFIED`
  Assign 1–5 star ratings and reading statuses ("Want to Read", "Currently Reading", "Finished") to volumes across book cards and shelf management modals, with compact single-star mobile ratings (`compactOnMobile`) and anti-overlap status badges on 2-column mobile grids.
- [x] **Reading Streaks, Dual Immersion Telemetry & Annual Goal Tracking** `✅ VERIFIED`
  Track daily reading and listening timestamps with a 5-minute active streak threshold, idle detection, background TTS audio narration tracking, estimated hours read, and annual reading challenge goals in the Account dashboard.

---

### Milestone 4: Literary Accolades & Personal Honors (`v2.1.0 - v2.3.0 (Completed)`)
`[████████████████████]` **3/3 (100%)**

> Gamified ex-libris accolades, tactile bookplate achievements, 4-tier challenge compendium, and personal showcase pinning.

- [x] **Deterministic Literary Accolades & Badge Engine** `✅ VERIFIED`
  Ex-libris bookplate badges (Seven-Day Sage, Ancient Antiquarian, Century Voyager, Commonplace Scholar) unlocked via pure client-side reading telemetry with tactile unlock celebrations.
- [x] **Canonical 4-Tier Milestone Accolades Ladder** `✅ VERIFIED`
  Compendium ladder evaluated deterministically against completed volumes: Bibliophile Novice (Bronze), Canonical Scholar (Silver), Master of the Canon (Gold), and The Laureate's Crown (Masterwork).
- [x] **Ex-Libris Bookplate Cards & Showcase Pinning** `✅ VERIFIED`
  Tactile woodcut-bordered bookplates with desktop 3D perspective tilt, specular sheen gradients, spring physics, and personal 3-plate showcase pinning synchronized to `public.user_accolades`.

---

### Milestone 5: Autonomous Gutenberg Catalog & Self-Hosted Search Engine (`v2.5.0 (Completed)`)
`[████████████████████]` **4/4 (100%)**

> Self-hosted PostgreSQL book catalog hosting 78,000+ titles in Supabase with GIN full-text search, sub-50ms single-book lookups and ~1–2s catalog page queries, automated weekly synchronization, and multi-tier content streaming.

- [x] **Self-Hosted PostgreSQL Catalog (`public.books`) with GIN Search** `✅ VERIFIED`
  Dedicated database table storing 78,000+ public domain volumes with automated `search_vector` GIN indexing, author lifespan bounds for sub-50ms single-book international copyright filtering, and zero-egress catalog searches.
- [x] **Streaming Catalog Ingestion Engine (`scripts/sync-gutenberg-catalog.js`)** `✅ VERIFIED`
  Zero-dependency RFC 4180 streaming CSV gunzip pipeline streaming Project Gutenberg's official `pg_catalog.csv.gz` directly into Supabase with adaptive timeout division and idempotent batch upserts.
- [x] **Automated Scheduled Weekly Sync (`.github/workflows/catalog-sync.yml`)** `✅ VERIFIED`
  Scheduled GitHub Actions cron workflow updating newly added titles every Sunday at 02:00 UTC, acting as an automated keep-alive heartbeat for the Supabase database instance.
- [x] **Dual-Provider Catalog Seam & Strangler Fig Fallback** `✅ VERIFIED`
  Unified `ICatalogProvider` seam (`src/lib/catalog/`) probing Supabase PostgreSQL as primary provider (~1–2s catalog / <50ms single-book) with seamless fallback to Gutendex when unseeded, offline, or experiencing network errors.

---

### Milestone 6: Public Scholar Profiles & Social Portability (`v2.6.0 (Completed)`)
`[██████████░░░░░░░░░░]` **1/2 (50%)**

> Opt-in public scholar profile pages, reader biographies, and shareable reading cards for social platforms.

- [x] **Opt-In Public Scholar Profiles (`/u/[username]`)** `✅ VERIFIED`
  Dedicated public profile page showcasing reader biography, public bookshelves, reading challenge progress, and pinned accolade badges with strict privacy toggles (Public vs Private).
- [ ] **Shareable Reading Cards & OpenGraph Export** `⏳ PLANNED`
  Client-side canvas card generator exporting aesthetic, tactile summary images of annual reading goals and milestones for social sharing.

---

### Milestone 7: Reader Circles & Literary Symposiums (Dual Reading) (`v2.7.0 (Completed)`)
`[████████████████████]` **5/5 (100%)**

> Intimate scholarly fellowship, mutual Reader Circle connections, per-volume Literary Symposium pacts, resolution-independent shared marginalia, in-context source filtering, and companion reading progress.

- [x] **Reader Circles & Fellow Scholar Invitations (`public.reader_circles`)** `✅ VERIFIED`
  Persistent two-way fellowship connections ("Invite to Reader Circle" on `/u/[username]` and `/account`), accept/decline handshakes, companion identity RLS resolution across Private Sanctuaries (`is_public = false`), automatic profile identity sync (`handle_profile_identity_sync`), and zero-PII `@username` discovery backed by idempotent Supabase PostgreSQL RLS (`useFellowshipStore.ts`).
- [x] **Literary Symposium Sessions, Per-Volume Pacts & Two-Tier Account Hub (`public.symposium_sessions`)** `✅ VERIFIED`
  Per-book Symposium invitations ("Invite Fellow to Symposium"), active shared reading sessions scoped to specific volumes (`book_id`), and Two-Tier Account Sub-Tab management (`AccountSymposiumSection.tsx` & `SymposiumInviteModal.tsx`).
- [x] **Shared Symposium Marginalia, Source Filters & Spoiler Guard** `✅ VERIFIED`
  Resolution-independent rendering of Fellows' Marginalia in `ReaderSurface.tsx` (dashed archival underlines, monogram badges, and palette-matched overlap rings), unified overlapping marginalia cards (`You + @username`) in `All` mode, 1-click fellow passage saving (`TextHighlightPopover.tsx`, `ReaderAnnotationsDrawer.tsx`, `NotebookQuoteCard.tsx`), chapter-bound Spoiler Guard (Up to My Chapter vs. All Chapters), and `All | Mine | Fellows` source filters across `ReaderAnnotationsDrawer.tsx` and `NotebookView.tsx`.
- [x] **Companion Progress Telemetry & Chapter-Milestone Dispatches** `✅ VERIFIED`
  Synchronized per-volume reading coordinates between Symposium companions, featuring a toggleable companion progress micro-pill (`@username • X%`) and non-intrusive chapter-milestone sub-header dispatches in `ReaderSubHeaderRibbon.tsx`.
- [x] **Symposium Ex-Libris Accolade (`Societas Litterarum`)** `✅ VERIFIED`
  Deterministic Ex-Libris bookplate in `src/config/accolades-config.ts` (Symposium Companion — "Societas Litterarum") unlocked by participating in or completing a shared Literary Symposium volume.

---

### Milestone 8: Community Hub & Public Literary Agora (`Target: v2.9.0`)
`[░░░░░░░░░░░░░░░░░░░░]` **0/3 (0%)**

> Open literary agora, public volume discussions, community-wide reading challenges, and curated commonplace quote showcases.

- [ ] **Bookarium Community Hub (`/?view=community`)** `⏳ PLANNED`
  Curated literary agora showcasing public reading activity, active community reading challenges, and trending public-domain classics across the scholar network.
- [ ] **Public Volume Discussions & Shared Commonplace Quotes** `⏳ PLANNED`
  Reader commentary and scholarly reviews on individual book volumes with opt-in public publishing of highlighted excerpts from the Commonplace Notebook.
- [ ] **Community Reading Challenges & Seasonal Anthologies** `⏳ PLANNED`
  Collective seasonal reading events (e.g., Gothic Autumn, Antiquity Odyssey) with shared community progress meters and commemorative participation badges.

---

## 🛡️ Architectural Decisions & Out-of-Scope Rationale

| Proposed Vector | Status | Architectural Rationale |
|---|---|---|
| **Ephemeral Raw API JSON Cache** | 🚫 **Excluded (Architectural Decision ADR-038)** | Storing raw third-party JSON blobs in Postgres was rejected in favor of an authoritative, structured `public.books` PostgreSQL catalog with GIN indexing, precomputed author lifespans, and streaming bulk ingestion, backed by Vercel Edge caching (`s-maxage=120, stale-while-revalidate=600`). |
| **Proprietary Third-Party TTS** | 🚫 **Excluded (Keyless Policy)** | Paid cloud TTS APIs (ElevenLabs, Google Cloud TTS) violate **Rule 4 (Zero API Key Requirement)**. We strictly use native browser `window.speechSynthesis` for zero-cost, privacy-first read-aloud functionality. |

---

## 🔄 Automated Verification & Drift Prevention

This document is generated programmatically by `scripts/generate-roadmap.js` during **Pass 4 of the 7-Gateway Quality Engine** (`npm run verify` / `npm run docs:sync`). 

- **Single Source of Truth**: Features are marked `[x]` only when their source files, exports, and co-located unit tests exist in `src/`.
- **Zero Manual Edits**: Prevents stale documentation, phantom features, or milestone drift.

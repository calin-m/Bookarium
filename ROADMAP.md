# 🗺️ Bookarium Product & Engineering Roadmap

> **Deterministic AST-Verified Living Roadmap** — Synchronized programmatically with source code and tests (0% drift).

[![Current Release](https://img.shields.io/badge/Current%20Release-v2.5.1-teal?style=flat-square)](CHANGELOG.md)
[![Overall Progress](https://img.shields.io/badge/Roadmap%20Progress-86%25-brightgreen?style=flat-square)](ROADMAP.md)
[![Total Features](https://img.shields.io/badge/Features-24_of_28-blue?style=flat-square)](ROADMAP.md)
[![Drift](https://img.shields.io/badge/Drift-0%25%20Verified-blueviolet?style=flat-square)](ROADMAP.md)

---

## 📊 Overall Roadmap Completion

`[█████████████████░░░]` **24/28 (86%)**

---

## 🏛️ Strategic Engineering Milestones

### Milestone 0: Core Architecture & Production Hardening (`v1.7.0 (Completed)`)
`[████████████████████]` **6/6 (100%)**

> Foundational Next.js 16 App Router architecture, tactile skeuomorphic bookshelves, 3D spine physics, edge caching, and security hardening.

- [x] **Paged Virtual Layout & Flip Transitions** `✅ VERIFIED`
  Virtual continuous pagination in `ReaderSurface.tsx` (Paginated vs Continuous Scroll modes), touch swipe, keyboard controls, and hardware-accelerated 180ms page-turn transitions (`animate-page-turn`).
- [x] **Exact Reading Progress & Auto-Resume Engine** `✅ VERIFIED`
  Precise coordinates persistence (`chapterIndex`, `chapterPage`, `globalPage`, `lastReadAt`) in `useReaderStore`, with "Resumed at Chapter X" toast and 1-click Restart.
- [x] **Vercel Edge Response Caching & Rate Limiting** `✅ VERIFIED`
  Edge headers (`stale-while-revalidate`), datacenter proximity pinning (`iad1` in `vercel.json`), and sliding-window rate limiters protecting upstream Project Gutenberg APIs.
- [x] **Polite Client-Side Prefetching** `✅ VERIFIED`
  Background prefetching of page N+1 during browser idle time (`requestIdleCallback`) routing through internal cached proxy routes.
- [x] **Multi-Category Custom Bookshelves** `✅ VERIFIED`
  Custom bookshelf creation, master General shelf, floating "Move to Shelf" selector dropdowns on book spines, and safe deletion auto-reassigning volumes.
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
  Dedicated commonplace journal (`/?view=notebook`) aggregating all preserved quotes and marginalia, searchable across text, notes, and authors, with By-Book vs Chronological grouping, academic citation generation, and deletion protection.
- [x] **IndexedDB Offline Book Storage** `✅ VERIFIED`
  Ultra-lightweight local caching of downloaded and saved book texts using IndexedDB (`idb-keyval`), enabling unabridged reading on airplanes or offline.
- [x] **Library Portability: Export & Import** `✅ VERIFIED`
  Single-click JSON/CSV library backup and restore in Account Settings, giving users 100% portable ownership of their personal shelves, bookmarks, and reading history.

---

### Milestone 3: Habits, Goals & Library Curation (`v2.0.0 (Completed)`)
`[████████████████████]` **3/3 (100%)**

> Rich reader curation, Goodreads-style reading statuses, and daily habit tracking analytics.

- [x] **Bookmarks & Continue Reading Ledger (`/?view=bookmarks`)** `✅ VERIFIED`
  Dedicated reading ledger displaying all books in progress with tactile bookmark cards, last-read passage snippets, completion percentages, filtering (In Progress, Completed, On Hold), and 1-click chapter/page resume actions.
- [x] **1–5 Star Personal Ratings & Reading Statuses** `✅ VERIFIED`
  Assign 1–5 star ratings and reading statuses ("Want to Read", "Currently Reading", "Finished") to volumes across book cards and shelf management modals.
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

### Milestone 6: Public Scholar Profiles & Social Portability (`Target: v2.6.0`)
`[██████████░░░░░░░░░░]` **1/2 (50%)**

> Opt-in public scholar profile pages, reader biographies, and shareable reading cards for social platforms.

- [x] **Opt-In Public Scholar Profiles (`/u/[username]`)** `✅ VERIFIED`
  Dedicated public profile page showcasing reader biography, public bookshelves, reading challenge progress, and pinned accolade badges with strict privacy toggles (Public vs Private).
- [ ] **Shareable Reading Cards & OpenGraph Export** `⏳ PLANNED`
  Client-side canvas card generator exporting aesthetic, tactile summary images of annual reading goals and milestones for social sharing.

---

### Milestone 7: Community Hub & Collective Reading (`Target: v2.7.0`)
`[░░░░░░░░░░░░░░░░░░░░]` **0/3 (0%)**

> Shared literary agora, community volume reviews, public commonplace quote discussions, and reader circles.

- [ ] **Bookarium Community Hub (`/?view=community`)** `⏳ PLANNED`
  Curated literary agora showcasing public reading activity, active community reading challenges, and trending public-domain classics.
- [ ] **Public Book Discussions & Margin Notes** `⏳ PLANNED`
  Reader commentary and reviews on individual book volumes with opt-in publishing of quote highlights from the Commonplace Notebook.
- [ ] **Reader Circles & Social Activity Stream** `⏳ PLANNED`
  Follow fellow public readers, see what friends are currently reading in real-time, and celebrate shared milestone completions.

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

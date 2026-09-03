# 🗺️ Bookarium Product & Engineering Roadmap

> **Deterministic AST-Verified Living Roadmap** — Synchronized programmatically with source code and tests (0% drift).

[![Overall Progress](https://img.shields.io/badge/Roadmap%20Progress-80%25-brightgreen?style=flat-square)](ROADMAP.md)
[![Total Features](https://img.shields.io/badge/Features-12_of_15-blue?style=flat-square)](ROADMAP.md)
[![Drift](https://img.shields.io/badge/Drift-0%25%20Verified-blueviolet?style=flat-square)](ROADMAP.md)

---

## 📊 Overall Roadmap Completion

`[████████████████░░░░]` **12/15 (80%)**

---

## 🏛️ Strategic Engineering Milestones

### Milestone 0: Core Architecture & Production Hardening (`v1.7.0 (Current Stable)`)
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

### Milestone 1: Reader Mastery & Accessibility (`Target: v1.8.0`)
`[████████████████████]` **3/3 (100%)**

> Elevate the reading experience with instantaneous in-book phrase searching, zero-cost text-to-speech, and native standalone PWA installation.

- [x] **In-Book Full-Text Search Drawer** `✅ VERIFIED`
  Client-side phrase and dialogue search drawer (`ReaderSearchDrawer.tsx`) scanning active book text in memory with live snippet previews, match count, and direct jump to chapter and page.
- [x] **Native Web Speech Text-to-Speech (Read-Aloud)** `✅ VERIFIED`
  Incorporate browser `window.speechSynthesis` with sentence segmentation, natural voice prioritization, Play/Pause, speed tuning (0.85x–2.0x), and synchronized visual sentence highlights (`useReaderSpeech.ts`, `ReaderSpeechBar.tsx`).
- [x] **Progressive Web App (PWA) Manifest & Standalone App** `✅ VERIFIED`
  Native `src/app/manifest.ts` metadata, theme colors, and icons enabling 1-click "Add to Home Screen" installation on iOS, Android, and Desktop.

---

### Milestone 2: Scholar Annotations & Data Portability (`Target: v1.9.0`)
`[███████████████░░░░░]` **3/4 (75%)**

> Transform Bookarium into a tactile literary notebook with colored quote highlights, personal annotations, and full library export/import.

- [x] **Text Highlighting & Annotations Drawer** `✅ VERIFIED`
  Interactive text selection popover in `ReaderSurface.tsx` supporting 4 editorial pastel colors (Yellow, Amber, Mint, Rose) and personal notes stored in `useAnnotationStore.ts`.
- [x] **Literary Commonplace Notebook & Reading Journal** `✅ VERIFIED`
  Dedicated commonplace journal (`/?view=notebook`) aggregating all preserved quotes and marginalia, searchable across text, notes, and authors, with By-Book vs Chronological grouping, academic citation generation, and deletion protection.
- [x] **IndexedDB Offline Book Storage** `✅ VERIFIED`
  Ultra-lightweight local caching of downloaded and saved book texts using IndexedDB (`idb-keyval`), enabling unabridged reading on airplanes or offline.
- [ ] **Library Portability: Export & Import** `⏳ PLANNED`
  Single-click JSON/CSV library backup and restore in Account Settings, giving users 100% portable ownership of their personal shelves, bookmarks, and reading history.

---

### Milestone 3: Habits, Goals & Library Curation (`Target: v2.0.0`)
`[░░░░░░░░░░░░░░░░░░░░]` **0/2 (0%)**

> Rich reader curation, Goodreads-style reading statuses, and daily habit tracking analytics.

- [ ] **1–5 Star Personal Ratings & Reading Statuses** `⏳ PLANNED`
  Assign 1–5 star ratings and reading statuses ("Want to Read", "Currently Reading", "Finished") to volumes across book cards and shelf management modals.
- [ ] **Reading Streaks & Annual Goal Tracking** `⏳ PLANNED`
  Track daily reading activity timestamps to display consecutive reading streaks, estimated hours read, and annual reading challenge goals in the Account dashboard.

---

## 🛡️ Architectural Decisions & Out-of-Scope Rationale

| Proposed Vector | Status | Architectural Rationale |
|---|---|---|
| **Supabase `api_cache` Table** | 🚫 **Excluded (Redundant)** | Our **Vercel Edge Cache** (`stale-while-revalidate`) and in-memory rate limiter already deliver **15–40ms global cached responses** with zero database egress and zero schema migrations. Storing external API JSON in Postgres would introduce redundant queries and cloud costs. |
| **Proprietary Third-Party TTS** | 🚫 **Excluded (Keyless Policy)** | Paid cloud TTS APIs (ElevenLabs, Google Cloud TTS) violate **Rule 4 (Zero API Key Requirement)**. We strictly use native browser `window.speechSynthesis` for zero-cost, privacy-first read-aloud functionality. |

---

## 🔄 Automated Verification & Drift Prevention

This document is generated programmatically by `scripts/generate-roadmap.js` during **Pass 4 of the 7-Gateway Quality Engine** (`npm run verify` / `npm run docs:sync`). 

- **Single Source of Truth**: Features are marked `[x]` only when their source files, exports, and co-located unit tests exist in `src/`.
- **Zero Manual Edits**: Prevents stale documentation, phantom features, or milestone drift.

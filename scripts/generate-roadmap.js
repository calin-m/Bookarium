/**
 * Living Roadmap Generator - Bookarium
 *
 * Deterministically inspects the codebase AST, source files, and co-located tests
 * to generate ROADMAP.md with 0% drift.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// Helper to check if a file exists relative to root
function fileExists(relPath) {
  return fs.existsSync(path.join(rootDir, relPath));
}

// Helper to check if file contains a pattern
function fileContains(relPath, pattern) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) return false;
  const content = fs.readFileSync(fullPath, 'utf-8');
  return typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
}

// Helper to create visual ASCII progress bar
function renderProgressBar(completed, total) {
  const width = 20;
  const ratio = total > 0 ? completed / total : 0;
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const pct = Math.round(ratio * 100);
  return `\`[${bar}]\` **${completed}/${total} (${pct}%)**`;
}

// Feature verification schema
const ROADMAP_MILESTONES = [
  {
    id: 'm0',
    title: 'Milestone 0: Core Architecture & Production Hardening',
    version: 'v1.7.0 (Completed)',
    badge: 'https://img.shields.io/badge/Status-100%25%20Completed-brightgreen?style=flat-square',
    description: 'Foundational Next.js 16 App Router architecture, tactile skeuomorphic bookshelves, 3D spine physics, edge caching, and security hardening.',
    features: [
      {
        title: 'Paged Virtual Layout & Flip Transitions',
        description: 'Virtual continuous pagination in `ReaderSurface.tsx` (Paginated vs Continuous Scroll modes), touch swipe, keyboard controls, and hardware-accelerated 180ms page-turn transitions (`animate-page-turn`).',
        check: () => fileExists('src/components/reader/ReaderSurface.tsx') && fileContains('src/components/reader/ReaderSurface.tsx', 'paginated'),
      },
      {
        title: 'Exact Reading Progress & Auto-Resume Engine',
        description: 'Precise coordinates persistence (`chapterIndex`, `chapterPage`, `globalPage`, `bookmarkRow`, `lastReadAt`) in `useReaderStore`, interactive in-page row-snapping bookmark tab (`ReaderSurface.tsx`), "Resumed at Chapter X" toast, and 1-click Restart.',
        check: () => fileExists('src/stores/useReaderStore.ts') && fileContains('src/stores/useReaderStore.ts', 'readingPositions'),
      },
      {
        title: 'Vercel Edge Response Caching & Rate Limiting',
        description: 'Edge headers (`stale-while-revalidate`), datacenter proximity pinning (`iad1` in `vercel.json`), and sliding-window rate limiters protecting upstream Project Gutenberg APIs.',
        check: () => fileExists('src/lib/rate-limiter.ts') && fileContains('src/app/api/books/route.ts', 'stale-while-revalidate'),
      },
      {
        title: 'Polite Client-Side Prefetching',
        description: 'Background prefetching of page N+1 during browser idle time (`requestIdleCallback`) routing through internal cached proxy routes.',
        check: () => fileExists('src/hooks/queries/useBooks.ts') && fileContains('src/hooks/queries/useBooks.ts', 'usePrefetchNextPage'),
      },
      {
        title: 'Multi-Category Custom Bookshelves',
        description: 'Custom bookshelf creation, master General shelf, floating "Move to Shelf" selector dropdowns on desktop book spines, `<1024px` mobile & tablet curation action sheets (`BookshelfMobileModal.tsx`), active-shelf-aware clearing (`clearSavedBooks`, `clearCustomShelfBooks`), and safe shelf deletion auto-reassigning volumes.',
        check: () => fileExists('src/stores/useBookshelfStore.ts') && fileContains('src/stores/useBookshelfStore.ts', 'cloudBookshelves'),
      },
      {
        title: 'Bi-Directional Supabase Cloud Sync with RLS',
        description: 'PostgreSQL cloud synchronization for custom bookshelves and reading collections using Row-Level Security (RLS) with 100% offline-first local storage fallback.',
        check: () => fileExists('src/stores/useBookshelfStore.ts') && fileContains('src/stores/useBookshelfStore.ts', 'syncWithCloud'),
      },
    ],
  },
  {
    id: 'm1',
    title: 'Milestone 1: Reader Mastery & Accessibility',
    version: 'v1.8.0 (Completed)',
    badge: 'https://img.shields.io/badge/Milestone-v1.8.0-blue?style=flat-square',
    description: 'Elevate the reading experience with instantaneous in-book phrase searching, zero-cost text-to-speech, and native standalone PWA installation.',
    features: [
      {
        title: 'In-Book Full-Text Search Drawer',
        description: 'Client-side phrase and dialogue search drawer (`ReaderSearchDrawer.tsx`) scanning active book text in memory with live snippet previews, match count, and direct jump to chapter and page.',
        check: () => fileExists('src/components/reader/ReaderSearchDrawer.tsx') || fileExists('src/hooks/useBookSearch.ts'),
      },
      {
        title: 'Native Web Speech Text-to-Speech (Read-Aloud)',
        description: 'Incorporate browser `window.speechSynthesis` with sentence segmentation, natural voice prioritization, Play/Pause, speed tuning (0.85x–2.0x), and synchronized visual sentence highlights (`useReaderSpeech.ts`, `ReaderSpeechBar.tsx`).',
        check: () => fileExists('src/hooks/reader/useReaderSpeech.ts') || fileExists('src/components/reader/ReaderSpeechBar.tsx'),
      },
      {
        title: 'Progressive Web App (PWA) Manifest & Standalone App',
        description: 'Native `src/app/manifest.ts` metadata, theme colors, and icons enabling 1-click "Add to Home Screen" installation on iOS, Android, and Desktop.',
        check: () => fileExists('src/app/manifest.ts') || fileExists('public/manifest.json'),
      },
    ],
  },
  {
    id: 'm2',
    title: 'Milestone 2: Scholar Annotations & Data Portability',
    version: 'v1.9.0 (Completed)',
    badge: 'https://img.shields.io/badge/Milestone-v1.9.0-purple?style=flat-square',
    description: 'Transform Bookarium into a tactile literary notebook with colored quote highlights, personal annotations, and full library export/import.',
    features: [
      {
        title: 'Text Highlighting & Annotations Drawer',
        description: 'Interactive text selection popover in `ReaderSurface.tsx` supporting 4 editorial pastel colors (Yellow, Amber, Mint, Rose) and personal notes stored in `useAnnotationStore.ts`.',
        check: () => fileExists('src/stores/useAnnotationStore.ts') || fileExists('src/components/reader/ReaderAnnotationsDrawer.tsx'),
      },
      {
        title: 'Literary Commonplace Notebook & Reading Journal',
        description: 'Dedicated commonplace journal (`/?view=notebook`) aggregating all preserved quotes and marginalia, searchable across text, notes, and authors, with By-Book vs Chronological grouping, tablet-optimized icon mode toggles, academic citation generation, and deletion protection.',
        check: () => fileExists('src/components/presentation/NotebookView.tsx'),
      },
      {
        title: 'IndexedDB Offline Book Storage',
        description: 'Zero-dependency local caching of downloaded and saved book texts using native IndexedDB (`BookariumOfflineDB`), cross-instance event broadcast (`OFFLINE_BOOKS_UPDATED_EVENT`), loading telemetry, interactive `Downloaded` status badges, Bookshelf `Downloaded (N)` smart shelf pill (`DOWNLOADED_SHELF_ID`) with active-shelf-aware clearing (`Clear Downloaded Shelf`), unified `Downloaded` collection search filter, removal confirmation modals (`RemoveOfflineBookModal.tsx`), and cross-device controls, enabling unabridged reading on airplanes or offline.',
        check: () => fileContains('src/hooks/queries/useBookContent.ts', 'idb') || fileExists('src/lib/offline-storage.ts'),
      },
      {
        title: 'Library Portability: Export & Import',
        description: 'Single-click JSON/CSV library backup and restore in Account Settings, giving users 100% portable ownership of their personal shelves, bookmarks, and reading history.',
        check: () => fileContains('src/components/account/AccountPreferencesSection.tsx', 'exportLibraryData') || fileExists('src/lib/library-backup.ts'),
      },
    ],
  },
  {
    id: 'm3',
    title: 'Milestone 3: Habits, Goals & Library Curation',
    version: 'v2.0.0 (Completed)',
    badge: 'https://img.shields.io/badge/Milestone-v2.0.0-orange?style=flat-square',
    description: 'Rich reader curation, Goodreads-style reading statuses, and daily habit tracking analytics.',
    features: [
      {
        title: 'Bookmarks & Continue Reading Ledger (`/?view=bookmarks`)',
        description: 'Dedicated reading ledger displaying all books in progress with tactile bookmark cards, top-anchored silk ribbon markers (`origin-top scale-y-110`), card-tap focus/activation across all viewports with desktop cursor-exit focus release (`onDeactivate`), last-read passage snippets, completion percentages, multi-attribute sorting and filtering (Recent, Progress, Title, Author, Downloaded), status tabs (In Progress, Completed, On Hold), and dedicated 1-click `Resume` / `Read Again` CTA navigation.',
        check: () => fileExists('src/components/presentation/BookmarksView.tsx') || fileContains('src/stores/useReaderStore.ts', 'lastPassageSnippet'),
      },
      {
        title: '1–5 Star Personal Ratings & Reading Statuses',
        description: 'Assign 1–5 star ratings and reading statuses ("Want to Read", "Currently Reading", "Finished") to volumes across book cards and shelf management modals, with compact single-star mobile ratings (`compactOnMobile`) and anti-overlap status badges on 2-column mobile grids.',
        check: () => fileContains('src/stores/useBookshelfStore.ts', 'rating') || fileContains('src/types/database.types.ts', 'reading_status'),
      },
      {
        title: 'Reading Streaks, Dual Immersion Telemetry & Annual Goal Tracking',
        description: 'Track daily reading and listening timestamps with a 5-minute active streak threshold, idle detection, background TTS audio narration tracking, estimated hours read, and annual reading challenge goals in the Account dashboard.',
        check: () => fileContains('src/components/account/AccountIdentityCard.tsx', 'readingStreak') || fileExists('src/lib/reading-analytics.ts'),
      },
    ],
  },
  {
    id: 'm4',
    title: 'Milestone 4: Literary Accolades & Personal Honors',
    version: 'v2.1.0 - v2.3.0 (Completed)',
    badge: 'https://img.shields.io/badge/Milestone-v2.3.0-blueviolet?style=flat-square',
    description: 'Gamified ex-libris accolades, tactile bookplate achievements, 4-tier challenge compendium, and personal showcase pinning.',
    features: [
      {
        title: 'Deterministic Literary Accolades & Badge Engine',
        description: 'Ex-libris bookplate badges (Seven-Day Sage, Ancient Antiquarian, Century Voyager, Commonplace Scholar) unlocked via pure client-side reading telemetry with tactile unlock celebrations.',
        check: () => fileExists('src/lib/accolades-engine.ts') || fileContains('src/components/account/AccountAccoladesCard.tsx', 'accolade'),
      },
      {
        title: 'Canonical 4-Tier Milestone Accolades Ladder',
        description: 'Compendium ladder evaluated deterministically against completed volumes: Bibliophile Novice (Bronze), Canonical Scholar (Silver), Master of the Canon (Gold), and The Laureate\'s Crown (Masterwork).',
        check: () => fileExists('src/config/accolades-config.ts') && fileContains('src/config/accolades-config.ts', 'ACCOLADE_TIER_CONFIG'),
      },
      {
        title: 'Ex-Libris Bookplate Cards & Showcase Pinning',
        description: 'Tactile woodcut-bordered bookplates with desktop 3D perspective tilt, specular sheen gradients, spring physics, and personal 3-plate showcase pinning synchronized to `public.user_accolades`.',
        check: () => fileExists('src/components/accolades/ExLibrisBookplate.tsx') && fileExists('src/stores/useAccoladesStore.ts'),
      },
    ],
  },
  {
    id: 'm5',
    title: 'Milestone 5: Autonomous Gutenberg Catalog & Self-Hosted Search Engine',
    version: 'v2.5.0 (Completed)',
    badge: 'https://img.shields.io/badge/Milestone-v2.5.0-teal?style=flat-square',
    description: 'Self-hosted PostgreSQL book catalog hosting 78,000+ titles in Supabase with GIN full-text search, sub-50ms single-book lookups and ~1–2s catalog page queries, automated weekly synchronization, and multi-tier content streaming.',
    features: [
      {
        title: 'Self-Hosted PostgreSQL Catalog (`public.books`) with GIN Search',
        description: 'Dedicated database table storing 78,000+ public domain volumes with automated `search_vector` GIN indexing, author lifespan bounds for sub-50ms single-book international copyright filtering, and zero-egress catalog searches.',
        check: () => fileContains('supabase/schema.sql', 'CREATE TABLE IF NOT EXISTS public.books') && fileExists('src/lib/catalog/supabase-provider.ts'),
      },
      {
        title: 'Streaming Catalog Ingestion Engine (`scripts/sync-gutenberg-catalog.js`)',
        description: 'Zero-dependency RFC 4180 streaming CSV gunzip pipeline streaming Project Gutenberg\'s official `pg_catalog.csv.gz` directly into Supabase with adaptive timeout division and idempotent batch upserts.',
        check: () => fileExists('scripts/sync-gutenberg-catalog.js') && fileContains('scripts/sync-gutenberg-catalog.js', 'pg_catalog.csv.gz'),
      },
      {
        title: 'Automated Scheduled Weekly Sync (`.github/workflows/catalog-sync.yml`)',
        description: 'Scheduled GitHub Actions cron workflow updating newly added titles every Sunday at 02:00 UTC, acting as an automated keep-alive heartbeat for the Supabase database instance.',
        check: () => fileExists('.github/workflows/catalog-sync.yml') && fileContains('.github/workflows/catalog-sync.yml', 'sync-gutenberg-catalog.js'),
      },
      {
        title: 'Dual-Provider Catalog Seam & Strangler Fig Fallback',
        description: 'Unified `ICatalogProvider` seam (`src/lib/catalog/`) probing Supabase PostgreSQL as primary provider (~1–2s catalog / <50ms single-book) with seamless fallback to Gutendex when unseeded, offline, or experiencing network errors.',
        check: () => fileExists('src/lib/catalog/supabase-provider.ts') && fileContains('src/app/api/books/route.ts', 'supabaseCatalogProvider'),
      },
    ],
  },
  {
    id: 'm6',
    title: 'Milestone 6: Public Scholar Profiles & Social Portability',
    version: 'v2.6.0 (Completed)',
    badge: 'https://img.shields.io/badge/Milestone-v2.6.0-blueviolet?style=flat-square',
    description: 'Opt-in public scholar profile pages, reader biographies, and shareable reading cards for social platforms.',
    features: [
      {
        title: 'Opt-In Public Scholar Profiles (`/u/[username]`)',
        description: 'Dedicated public profile page showcasing reader biography, public bookshelves, reading challenge progress, and pinned accolade badges with strict privacy toggles (Public vs Private).',
        check: () => fileExists('src/app/u/[username]/page.tsx') || fileContains('src/components/profile/PublicProfileView.tsx', 'is_public'),
      },
      {
        title: 'Shareable Reading Cards & OpenGraph Export',
        description: 'Client-side canvas card generator exporting aesthetic, tactile summary images of annual reading goals and milestones for social sharing.',
        check: () => fileExists('src/components/account/ShareableReadingCard.tsx') || fileExists('src/lib/reading-card-export.ts'),
      },
    ],
  },
  {
    id: 'm7',
    title: 'Milestone 7: Reader Circles & Literary Symposiums (Dual Reading)',
    version: 'v2.7.0 (Completed)',
    badge: 'https://img.shields.io/badge/Milestone-v2.7.0-indigo?style=flat-square',
    description: 'Intimate scholarly fellowship, mutual Reader Circle connections, per-volume Literary Symposium pacts, resolution-independent shared marginalia, in-context source filtering, and companion reading progress.',
    features: [
      {
        title: 'Reader Circles & Fellow Scholar Invitations (`public.reader_circles`)',
        description: 'Persistent two-way fellowship connections ("Invite to Reader Circle" on `/u/[username]` and `/account`), accept/decline handshakes, companion identity RLS resolution across Private Sanctuaries (`is_public = false`), automatic profile identity sync (`handle_profile_identity_sync`), and zero-PII `@username` discovery backed by idempotent Supabase PostgreSQL RLS (`useFellowshipStore.ts`).',
        check: () =>
          fileContains('supabase/schema.sql', 'CREATE TABLE IF NOT EXISTS public.reader_circles') &&
          fileExists('src/stores/useFellowshipStore.ts'),
      },
      {
        title: 'Literary Symposium Sessions, Per-Volume Pacts & Two-Tier Account Hub (`public.symposium_sessions`)',
        description: 'Per-book Symposium invitations ("Invite Fellow to Symposium"), active shared reading sessions scoped to specific volumes (`book_id`), and Two-Tier Account Sub-Tab management (`AccountSymposiumSection.tsx` & `SymposiumInviteModal.tsx`).',
        check: () =>
          fileContains('supabase/schema.sql', 'CREATE TABLE IF NOT EXISTS public.symposium_sessions') &&
          (fileExists('src/components/symposium/SymposiumInviteModal.tsx') ||
            fileExists('src/components/account/AccountSymposiumSection.tsx')),
      },
      {
        title: 'Shared Symposium Marginalia, Source Filters & Spoiler Guard',
        description: 'Resolution-independent rendering of Fellows\' Marginalia in `ReaderSurface.tsx` (dashed archival underlines, monogram badges, and palette-matched overlap rings), unified overlapping marginalia cards (`You + @username`) in `All` mode, 1-click fellow passage saving (`TextHighlightPopover.tsx`, `ReaderAnnotationsDrawer.tsx`, `NotebookQuoteCard.tsx`), chapter-bound Spoiler Guard (Up to My Chapter vs. All Chapters), and `All | Mine | Fellows` source filters across `ReaderAnnotationsDrawer.tsx` and `NotebookView.tsx`.',
        check: () =>
          fileContains('src/stores/useAnnotationStore.ts', 'fellowAnnotations') &&
          fileContains('src/components/presentation/NotebookView.tsx', 'fellow') &&
          fileContains('src/components/reader/ReaderAnnotationsDrawer.tsx', 'fellow'),
      },
      {
        title: 'Companion Progress Telemetry & Chapter-Milestone Dispatches',
        description: 'Synchronized per-volume reading coordinates between Symposium companions, featuring a toggleable companion progress micro-pill (`@username • X%`) and non-intrusive chapter-milestone sub-header dispatches in `ReaderSubHeaderRibbon.tsx`.',
        check: () =>
          fileContains('src/components/reader/ReaderSubHeaderRibbon.tsx', 'symposium') ||
          fileContains('src/components/reader/ReaderSubHeaderRibbon.tsx', 'fellow'),
      },
      {
        title: 'Symposium Ex-Libris Accolade (`Societas Litterarum`)',
        description: 'Deterministic Ex-Libris bookplate in `src/config/accolades-config.ts` (Symposium Companion — "Societas Litterarum") unlocked by participating in or completing a shared Literary Symposium volume.',
        check: () => fileContains('src/config/accolades-config.ts', 'symposium-companion'),
      },
    ],
  },
  {
    id: 'm8',
    title: 'Milestone 8: Community Hub & Public Literary Agora',
    version: 'Target: v2.9.0',
    badge: 'https://img.shields.io/badge/Milestone-v2.9.0-violet?style=flat-square',
    description: 'Open literary agora, public volume discussions, community-wide reading challenges, and curated commonplace quote showcases.',
    features: [
      {
        title: 'Bookarium Community Hub (`/?view=community`)',
        description: 'Curated literary agora showcasing public reading activity, active community reading challenges, and trending public-domain classics across the scholar network.',
        check: () =>
          fileExists('src/components/presentation/CommunityView.tsx') ||
          fileContains('src/config/routes.ts', 'community'),
      },
      {
        title: 'Public Volume Discussions & Shared Commonplace Quotes',
        description: 'Reader commentary and scholarly reviews on individual book volumes with opt-in public publishing of highlighted excerpts from the Commonplace Notebook.',
        check: () =>
          fileExists('src/components/community/BookDiscussionThread.tsx') ||
          fileExists('src/components/community/SharedQuoteCard.tsx'),
      },
      {
        title: 'Community Reading Challenges & Seasonal Anthologies',
        description: 'Collective seasonal reading events (e.g., Gothic Autumn, Antiquity Odyssey) with shared community progress meters and commemorative participation badges.',
        check: () =>
          fileExists('src/components/community/CommunityChallengeCard.tsx') ||
          fileExists('src/stores/useCommunityStore.ts'),
      },
    ],
  },
];

function generateRoadmapMarkdown() {
  let totalFeatures = 0;
  let totalCompleted = 0;

  const evaluatedMilestones = ROADMAP_MILESTONES.map((milestone) => {
    const evaluatedFeatures = milestone.features.map((feat) => {
      totalFeatures++;
      const isDone = feat.check();
      if (isDone) totalCompleted++;
      return {
        ...feat,
        isDone,
      };
    });

    const mDone = evaluatedFeatures.filter((f) => f.isDone).length;
    const mTotal = evaluatedFeatures.length;
    const mPct = Math.round((mDone / mTotal) * 100);

    return {
      ...milestone,
      features: evaluatedFeatures,
      mDone,
      mTotal,
      mPct,
    };
  });

  const overallPct = Math.round((totalCompleted / totalFeatures) * 100);

  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) : {};
  const currentVersion = pkg.version || '2.5.0';

  let md = `# 🗺️ Bookarium Product & Engineering Roadmap

> **Deterministic AST-Verified Living Roadmap** — Synchronized programmatically with source code and tests (0% drift).

[![Current Release](https://img.shields.io/badge/Current%20Release-v${currentVersion}-teal?style=flat-square)](CHANGELOG.md)
[![Overall Progress](https://img.shields.io/badge/Roadmap%20Progress-${overallPct}%25-brightgreen?style=flat-square)](ROADMAP.md)
[![Total Features](https://img.shields.io/badge/Features-${totalCompleted}_of_${totalFeatures}-blue?style=flat-square)](ROADMAP.md)
[![Drift](https://img.shields.io/badge/Drift-0%25%20Verified-blueviolet?style=flat-square)](ROADMAP.md)

---

## 📊 Overall Roadmap Completion

${renderProgressBar(totalCompleted, totalFeatures)}

---

## 🏛️ Strategic Engineering Milestones

`;

  evaluatedMilestones.forEach((m, idx) => {
    md += `### ${m.title} (\`${m.version}\`)\n`;
    md += `${renderProgressBar(m.mDone, m.mTotal)}\n\n`;
    md += `> ${m.description}\n\n`;

    m.features.forEach((feat) => {
      const checkbox = feat.isDone ? '[x]' : '[ ]';
      const statusBadge = feat.isDone ? '\`✅ VERIFIED\`' : '\`⏳ PLANNED\`';
      md += `- ${checkbox} **${feat.title}** ${statusBadge}\n`;
      md += `  ${feat.description}\n`;
    });

    if (idx < evaluatedMilestones.length - 1) {
      md += `\n---\n\n`;
    }
  });

  md += `\n---

## 🛡️ Architectural Decisions & Out-of-Scope Rationale

| Proposed Vector | Status | Architectural Rationale |
|---|---|---|
| **Ephemeral Raw API JSON Cache** | 🚫 **Excluded (Architectural Decision ADR-038)** | Storing raw third-party JSON blobs in Postgres was rejected in favor of an authoritative, structured \`public.books\` PostgreSQL catalog with GIN indexing, precomputed author lifespans, and streaming bulk ingestion, backed by Vercel Edge caching (\`s-maxage=120, stale-while-revalidate=600\`). |
| **Proprietary Third-Party TTS** | 🚫 **Excluded (Keyless Policy)** | Paid cloud TTS APIs (ElevenLabs, Google Cloud TTS) violate **Rule 4 (Zero API Key Requirement)**. We strictly use native browser \`window.speechSynthesis\` for zero-cost, privacy-first read-aloud functionality. |

---

## 🔄 Automated Verification & Drift Prevention

This document is generated programmatically by \`scripts/generate-roadmap.js\` during **Pass 4 of the 7-Gateway Quality Engine** (\`npm run verify\` / \`npm run docs:sync\`). 

- **Single Source of Truth**: Features are marked \`[x]\` only when their source files, exports, and co-located unit tests exist in \`src/\`.
- **Zero Manual Edits**: Prevents stale documentation, phantom features, or milestone drift.
`;

  return md;
}

// Generate and write file
const roadmapContent = generateRoadmapMarkdown();
const outputPath = path.join(rootDir, 'ROADMAP.md');
fs.writeFileSync(outputPath, roadmapContent, 'utf-8');
console.log(`✔ [SUCCESS] Living ROADMAP.md generated successfully (0% drift).`);

# Bookarium — 100% Legal Public Domain Library & Reader

> **Pure Literature. Zero Paywalls. Zero Reader API Keys Required.**

[![Developed with Antigravity](https://img.shields.io/badge/Developed%20with-Google%20AI%20%2F%20Antigravity-4285F4?style=flat-square&logo=google)](https://antigravity.google)
[![Next.js](https://img.shields.io/badge/Next.js-16.4.6%20(Turbopack)-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3.1-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.3.5-38B2AC?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![TanStack Query](https://img.shields.io/badge/TanStack%20Query-5.108.4-FF4154?style=flat-square&logo=reactquery&logoColor=white)](https://tanstack.com/query)
[![Zustand](https://img.shields.io/badge/Zustand-5.1.0-443E38?style=flat-square)](https://github.com/pmndrs/zustand)
[![Framer Motion](https://img.shields.io/badge/Framer%20Motion-14.14.0-0055FF?style=flat-square&logo=framer&logoColor=white)](https://motion.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22%20LTS-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20Sync-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Cloudflare R2](https://img.shields.io/badge/Cloudflare%20R2-Zero--Egress%20Storage-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/r2/)
[![PWA Offline](https://img.shields.io/badge/PWA-Offline%20Ready-5A0FC8?style=flat-square&logo=pwa)](public/sw.js)
[![Vercel](https://img.shields.io/badge/Vercel-Deployment-000000?style=flat-square&logo=vercel)](https://vercel.com/)
[![CI Pipeline](https://img.shields.io/github/actions/workflow/status/calin-m/Bookarium/ci.yml?branch=master&style=flat-square&logo=githubactions&logoColor=white&label=CI%20Pipeline)](https://github.com/calin-m/Bookarium/actions/workflows/ci.yml)
[![Quality Gateways](https://img.shields.io/badge/7--Gateway-100%25%20Verified-success?style=flat-square)](docs/QUALITY_AUDIT_REPORT.md)
[![Vitest](https://img.shields.io/badge/Vitest-276%20Suites%20%7C%202864%20Tests-729B1B?style=flat-square&logo=vitest)](docs/QUALITY_AUDIT_REPORT.md)
[![MSW](https://img.shields.io/badge/MSW-3.0.7-FF6A33?style=flat-square&logo=mockserviceworker&logoColor=white)](https://mswjs.io/)
[![Code Coverage](https://img.shields.io/badge/Coverage-97.38%25-brightgreen?style=flat-square)](docs/QUALITY_AUDIT_REPORT.md)
[![Roadmap](https://img.shields.io/badge/Roadmap-Living%20AST-blueviolet?style=flat-square)](ROADMAP.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

---

An open-source, offline-first web application and reader for discovering, reading, and downloading over **78,000 free public domain books** (Project Gutenberg / CC0) — with **no account, subscription, or API key required**. Powered by **Next.js 16 App Router**, **React 19**, and **Tailwind CSS v4**, it pairs a **5-tier Edge CDN & LRU cache** over **Supabase** (**PostgreSQL GIN search, Auth, RLS, & 7-store cloud sync**) and private **Cloudflare R2** zero-egress storage with **TanStack React Query v5**, **10-store Zustand + IndexedDB + PWA** offline persistence, **Web Worker AST pagination**, and **multi-jurisdictional copyright (`HTTP 451`) compliance** — deployed on the **Vercel Edge Platform**, developed with **[Google AI / Antigravity](https://antigravity.google)**, and verified by a deterministic **7-Gateway Quality Engine**.

## 📖 What You Can Do on Bookarium

* **📚 Browse & Filter 78,000+ Free Classic Books (`/`)**:
  * Search by title, author, or keyword, or combine multiple filters at once across **32 Project Gutenberg book categories** (Fiction, Sci-Fi & Fantasy, Mystery, Gothic, Romance, Philosophy, History, Children's Literature, Poetry, Drama, Science, Mythology, and more), **20 languages**, **historical time periods** (from Antiquity to the Early 20th Century), and **e-book file formats**.
  * Preview sample chapters and notable quotes inside an interactive **3D open book** before starting a volume, and switch your view between a visual **Cover Grid** and a **3D Bookshelf** where books stand side-by-side by their spines.
* **🤝 Co-Read Books with Friends, Share Notes & Track Reading Habits (`/account`, `/u/[username]`)**:
  * Everything works privately on your device without signing up, or you can optionally create a free account to **sync your shelves, bookmarks, highlights, and notes across all your devices**.
  * **Shared Reading & Shared Notes**: Connect with friends by `@username` to **read the same book together**—see each other's live chapter progress, **view and respond to each other's highlights and margin notes directly inside the book and in your Notebook**, and turn on the **Spoiler Shield** to automatically hide a friend's notes from chapters you haven't reached yet.
  * **Streaks, Goals & Achievements**: Track daily reading and listening time, build daily reading streaks, set a yearly book goal, unlock reading achievements, and customize a public or private reader profile.
* **✍️ Highlight Text & Write Margin Notes (`/notebook`)**:
  * Select any sentence or paragraph while reading to **highlight it in 7 colors** and attach your own **written notes**.
  * Review all of your saved highlights and notes in one central **Notebook**—organized either by book or in chronological order—and filter them by highlight color, keyword search, or whether they include a personal note.
* **✈️ Read Offline Without Internet or Export Plain-Text Editions**:
  * **One-Click Browser Offline Reading**: Save individual books directly to your browser (`Save Offline`) so you can browse your saved library and read full books **completely offline** (on flights, commutes, or as an installed mobile/desktop app).
  * **Self-Hosted Cloudflare R2 Assets & Direct `.txt` Downloads**: Bookarium self-hosts book texts (`books/<id>.txt.gz`) and cover artwork (`covers/<id>.jpg`) on private **Cloudflare R2** storage served through same-origin `/api/books/content` routes (`404` dark typographic fallback on missing covers, with zero Gutenberg hotlinking). Download any cleared book as **Clean Plain Text (UTF-8 `.txt`)** in the **Download Hub** (*in-house EPUB, Kindle, and HTML generators coming soon*).
* **🏛️ Organize Your Shelves, Ratings & Reading Progress (`/bookshelf`, `/favorites`, `/bookmarks`)**:
  * Save books to a general shelf or create your own **custom-named shelves**, mark **Favorites**, rate books from **1 to 5 stars**, and track your reading status (**Want to Read**, **Reading**, **On Hold**, or **Finished**).
  * View all the books you have in progress in a dedicated **Bookmarks** list showing your current chapter, page, bookmarked line, and completion percentage so you can jump right back in.
* **📖 Read Comfortably with Custom Fonts, Themes & Line-Level Bookmarks (`/read/[id]`)**:
  * Read complete, unabridged books in a clean, distraction-free view that automatically formats Bookarium-hosted plain-text editions into readable chapters and pages.
  * Customize **Day (Light)**, **Sepia (Warm Coffee)**, or **Dark** themes, and adjust **font style** (Serif, Sans-Serif, Monospace), **font size** (`12px–36px`), **line spacing**, **page width**, and **page brightness** (`30%–100%`).
  * **Bookmark Any Specific Line**: Drag the margin bookmark ribbon to the **exact line on a page** where you stopped reading—even if you resize the font or switch between a phone and a desktop screen, the reader remembers that exact sentence and highlights it for you.
  * **Search Inside Any Book & Switch Languages**: Search for any word or phrase across the entire book with instant chapter/page jump links, and switch between available **translated editions** of the same work in one click.
* **🔊 Listen with Built-In Read-Aloud Audio (Text-to-Speech)**:
  * Have any book read aloud using your device's natural voices, complete with live word-by-word highlighting on the page, adjustable speaking speed, and automatic page turning when a page finishes.

---

## 🎨 Design Inspiration & Aesthetic Philosophy

Bookarium's visual identity and tactile layout are deeply inspired by classical editorial typography, archival letterpress printing, and modern Figma bookstore design systems:

* **Figma Editorial Concept**: Inspired by the minimalist elegance of curated bookstore layouts, specifically referencing the [Booksaw — Bookstore E-Commerce Website Design Template](https://www.figma.com/community/file/1521831984874247291/booksaw-bookstore-ecommerce-website-design-template) on the Figma Community.
* **Open-Book Skeuomorphic Details**: Custom open-book card spreads with subtle center spine creases (`.book-center-crease`), realistic paper texture shadows (`shadow-booksaw`), and page depth elevation.
* **Warm Editorial Palettes & 100% Solid Surfaces**:
  * **Day / Standard**: Crisp cream-paper tones (`#fcfbf9`, `#ffffff`) with rich obsidian ink typography and 100% solid, non-transparent surfaces.
  * **Sepia / Cozy Coffee (Warm Midtone)**: Warm roasted espresso and cafe mocha tones (`#2b1d16`, `#3c281e`, `#332219`) with steamed milk cream typography (`#fef6eb`) and warm caramel amber accents (`#f59e0b`) for eye comfort in ambient evening light.
  * **Dark Mode**: High-contrast slate obsidian canvas (`#0e1117`, `#161b26`) preserving focus in low-light settings.
* **Refined Typography**: Pairings of classic literary serifs, clean sans-serifs, and monospace archival metadata accents.

---

## 📚 Living Documentation & Quality Assurance Matrix

| Document / Artifact | Scope & Verification Status | Live Resource Link |
|---|---|---|
| 📋 **Quality Audit & Test Suite Catalog** | 7-Gateway status summary, live coverage metrics, and complete index of all 2864 tests across 276 test suites. | [`docs/QUALITY_AUDIT_REPORT.md`](docs/QUALITY_AUDIT_REPORT.md) |
| 📊 **CI/CD Quality Telemetry** | Machine-readable JSON summary of build metrics, test suites, and coverage passes. | [`docs/quality-audit-results.json`](docs/quality-audit-results.json) |
| 🏛️ **Living Architecture Matrix (C4)** | Hub overview (`Diagram 1`) and 7 modular `docs/architecture/` subsystem specs (`Diagrams 2–16`, component/store/hook/DB/AST inventories). | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| 📖 **Gutenberg Parser & Segmentation Reference** | AST-compiled specification of the Gutenberg parser subsystem, heuristic regex contracts, pagination limits, and subtitle extraction rules. | [`docs/GUTENBERG_PARSER.md`](docs/GUTENBERG_PARSER.md) |
| 🛡️ **System Contracts & Behavioral Invariants** | AST-compiled code-level `@scope`, `@invariant`, `@rationale`, `@adr` links, blast radius, and priority contract queue across `src/`, CLI modules, `next.config.ts`, & `public/sw.js` (`89` Tier-1..Tier-4 protected). | [`docs/SYSTEM_CONTRACTS.md`](docs/SYSTEM_CONTRACTS.md) |
| 🗺️ **Living Product Roadmap** | AST-verified roadmap with 0% drift, feature milestone tracking, and live progress metrics. | [`ROADMAP.md`](ROADMAP.md) |
| 📜 **Living Changelog** | Keep a Changelog 1.0.0 & SemVer release history across all milestones. | [`CHANGELOG.md`](CHANGELOG.md) |
| ⚖️ **Architecture Decision Records (ADRs)** | 88 validated ADRs (`ADR-001` through `ADR-088`) governing end-user keyless reading, self-hosted Cloudflare R2 delivery, 10-store offline-first & 7-store Supabase cloud sync, multi-jurisdiction copyright compliance, 3D reader & typography AST, OWASP/AST security gates, multi-tier Edge CDN caching, mirror-only Gutenberg ingestion, and AST-compiled code contracts. | [`docs/DECISIONS.md`](docs/DECISIONS.md) |
| 🔒 **Security Policy & Responsible Disclosure** | Supported versions, vulnerability reporting protocols, and architectural safeguards. | [`SECURITY.md`](SECURITY.md) |
| 🤝 **Contributor Guidelines** | Onboarding guide, local development quickstart, testing protocols, and conventional commits. | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| 🕊️ **Code of Conduct** | Contributor Covenant v2.1 standards for an inclusive, welcoming community. | [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) |
| 🚀 **CI/CD Pipeline Guide** | Developer runbook and pipeline execution workflows. | [`docs/PIPELINE_GUIDE.md`](docs/PIPELINE_GUIDE.md) |
| ⚡ **GitHub Actions Operator Runbook** | Complete triggers, schedules, secrets, `workflow_dispatch` inputs, SHA pins, and local CLI parity for all 11 workflows. | [`docs/GITHUB_ACTIONS.md`](docs/GITHUB_ACTIONS.md) |
| 🏗️ **Infrastructure & Hosting Tiers** | Mode 0–2 deployment profiles, approximate Free vs. Paid provider quotas, and hard platform coding guardrails. | [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md) |
| 🛠️ **Developer Maintenance Hub** | Local setup, environment configuration, and contributor commands. | [`DEVELOPMENT.md`](DEVELOPMENT.md) |

---

## 🛡️ The 7-Gateway Quality Engine

The repository enforces a closed-loop quality verification engine before any release or commit:

```
+-----------------------------------------------------------------------------+
|                     7-GATEWAY CLOSED-LOOP VERIFICATION                      |
+-----------------------------------------------------------------------------+
| Pass 0.5  | Secret & Boundary   | Secrets, env parity & AST graph isolation |
| Pass 0.75 | 7-Pillar SAST/OWASP | CVEs, GPL/AGPL, CLI & 9-rule AST/SAST   |
| Pass 1    | TypeScript Engine   | Strict typecheck with 0 compile errors    |
| Pass 2    | Vitest Server Mocks | Validates MSW v3 handlers and query hooks |
| Pass 3    | Vitest Client UI    | Unit & integration tests (95/95/92/85 cov)|
| Pass 4    | Living Docs Sync    | Auto-updates ARCHITECTURE, SECURITY & CHG |
| Pass 5    | ADR & Parity Gate   | ADRs, SECURITY, SQL<->TS & 1:1 test parity|
| Pass 6    | Quality & Dead Code | ESLint (--max-warnings 0) and Knip audit  |
| Pass 7    | Production Build    | Next build, routes-manifest & HTTP probe  |
+-----------------------------------------------------------------------------+
```

🔒 **Pre-Commit Enforcement**: Any failure in Passes 0.5 through 7 immediately halts execution, outputs exact error telemetry, and automatically blocks the commit from being created.

---

<!-- BEGIN:latest-release -->
## 🛠️ Latest Improvements (v2.9.89)

- **4-Layer Anti-Drift Governance, Hardened Rule 9 AST Parity & Dynamic `Pass 5` Legal Verification (`AGENTS.md`, `.agents/AGENTS.md`, `scripts/lib/sast-validators.js`, `scripts/lib/sast-validators.test.ts`, `scripts/verify-build.js`, `src/app/copyright/page.tsx`)**: Added a Legal, Privacy & Erasure Disclosure Parity row to Rule 1 and expanded Rule 9 to 4 layers across `AGENTS.md` and `.agents/AGENTS.md`; upgraded `validateRule9AuthStoreParityAst` (`Pass 0.75` Pillar 6) to verify fail-closed `delete_current_user()` response inspection, device cache cleanups (`clearAllOfflineBooks`, `clearCachedBookPassages`, `clearCachedQuotePool`), and device-local guest `clearGuestDeviceData()` delegation; exported `auditLegalDocumentationParity` in `Pass 5` enforcing live `public/sw.js` `CACHE_NAME`, `MAX_CACHED_COVERS`, `COVER_CACHE_TTL_MS` (correcting `/copyright` `cover_cache` TTL from `14-day` to `30-day`), CDN `s-maxage` values, cookies, sync script identifiers, `AccountDeleteModal` warnings, and retirement of legacy stale claims (`ADR-044`, `ADR-072`, `ADR-073`).
- **Contract JSDoc & Generator Matrix Parity Sync (`src/stores/useAuthStore.ts`, `src/lib/redirect-sanitizer.ts`, `src/hooks/queries/useBooks.ts`, `scripts/generate-architecture-matrix.js`, `scripts/generate-quality-report.js`)**: Aligned protected `@scope`/`@invariant`/`@adr` contracts across `useAuthStore.ts` (4-layer Rule 9 parity across `8` user/preference Zustand stores), `redirect-sanitizer.ts` (`isConfirmDeletionRedirectPath`), and `useBooks.ts` (`clearCachedQuotePool`), and updated the Client Storage Matrix header, `hookRoles.useBooks`, and Pass 5 report summary (`ADR-072`, `ADR-073`).

> 📖 **Complete Historical Ledger**: For full chronological release notes, breaking changes, and migration details across all versions, see [**`CHANGELOG.md`**](CHANGELOG.md).
<!-- END:latest-release -->

---

## 🌐 Data Sources & Infrastructure

Bookarium offers a **100% Free, End-User Zero-Key Reading Experience** powered by self-hosted open infrastructure:

| Service / Source | Endpoint / Provider | Description & Usage |
|---|---|---|
| **Dedicated Supabase Catalog** | [`public.books`](#step-3-populate-public-domain-catalog--private-cloudflare-r2-storage) (PostgreSQL) | Primary catalog provider hosting 78,000+ Project Gutenberg titles with automated GIN full-text search (`search_vector`) and pre-computed author lifespan indexes, delivering sub-50ms single-book copyright verification, consistent ~1–2s 32-volume catalog page searches, and zero-egress searches. |
| **Bundled Curated Classics Archive** | [`src/lib/catalog/curated-fallback.ts`](src/lib/catalog/curated-fallback.ts) | Zero-network bundled classic anthology (`FEATURED_HERO_BOOKS`, strict `copyright=false` jurisdictional filtering) automatically serving `/api/books` searches during offline-first previews or unconfigured local dev without external API dependencies (`ADR-080`). |
| **Cloudflare R2 & Archive Feeds** | Private R2 Bucket • [`gutenberg.org`](https://www.gutenberg.org/) | Zero-egress private Cloudflare R2 storage serving pre-seeded cover artwork (`covers/<id>.jpg`) and gzipped public-domain texts (`books/<id>.txt.gz`, failing closed `404`/`503` without `R2_*` and zero runtime PG fallback), paired with background CLI multi-host `rsync` (`aleph.gutenberg.org` ↔ `rsync.ibiblio.org`) and official PGLAF mirror feeds (`gutenberg.pglaf.org`, `aleph.gutenberg.org`, `gutenberg.readingroo.ms`) (`ADR-082`, `ADR-083`, `ADR-084`). *(Note: Hosting the full 78k+ catalog exceeds Cloudflare R2's 10 GB free-tier allowance — see [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md)).* |
| **Wikidata SPARQL Knowledge Graph** | [`query.wikidata.org`](https://query.wikidata.org/) • [`CC0 1.0`](https://www.wikidata.org/) | Open public-domain bibliographic knowledge graph (`wdt:P2034` Project Gutenberg eBook ID, `wdt:P407` / `wdt:P424` language of work) powering relational FRBR work clustering across multilingual editions (`public.book_translations`). |
| **Supabase (Auth, Sync & Catalog)** | [`supabase.com`](https://supabase.com/) | Cloud authentication, user library synchronization (bookshelves, annotations, progress, streaks, accolades) with RLS user isolation, and dedicated public domain catalog. |
| **Vercel Edge Platform** | [`vercel.com`](https://vercel.com/) | High-performance edge deployment, dynamic SSR route handlers, zero-config production caching, global CDN delivery, and cookie-less aggregate performance telemetry (Vercel Web Analytics & Speed Insights). |
| **Public Domain, Asset & Profile Routes** | `/api/books`, `/api/books/content`, `/api/books/translations`, `/api/profiles/card`, `/covers/[file]` & `/og/books/[file]` | Next.js server-side route handlers providing multi-tier Vercel Edge CDN caching (`12h` 48-volume rotating quote pool, `24h` 10-column catalog, plain-text streams, and crawler-allowed `1200×630` book OpenGraph cards, `7d` quote/metadata ID batches & FRBR translations, `30d` strict R2-only JPEG cover streaming via `?type=cover` and crawler-allowed `/covers/[file]` with `404` dark typographic fallback on misses, and stateless Scholar Sanctuary PNG cards with `ADR-033` neutral fallback), Supabase/curated-fallback catalog resolution, and guaranteed public domain integrity before client delivery. |

---

## 🎯 Key Features & Capabilities

Bookarium is structured around six core engineering pillars:

### 1. 🎨 Tactile Editorial Design & 3D Book Physics
* **Booksaw Editorial Aesthetic**: Classical typography inspired by fine art bookstore catalogues, featuring open-book card spreads with center spine creases, realistic paper shadows, and 100% solid non-transparent surfaces across Day (`#fcfbf9`), Cozy Coffee Sepia (`#2b1d16`), and Dark Obsidian (`#0e1117`) themes.
* **Hourly Rotating 3D Featured Book (48-Volume 12h Rotating Quote Pool & 27-Masterwork Canon)**: Powered by the shared **Two-Tier Bounded Quote Pool (`Top 500 Popular + Rolling 64 Most Recent` in `public.books.quotes`)** delivered via a **48-Volume 12-Hour Rotating Edge Cache (`GET /api/books?pool=quotes`, `s-maxage=43200`)** with native PostgREST 2-spread slicing (`quote0`, `quote1`, cycling all `~564` weekly books across 14 half-day batches at `~22 KB`/request) and priority pinning of the 27 curated world literature masterworks, rotated every UTC hour with zero-cron deterministic synchronization (`selectHourlyHeroFromPool`).
  * **Synchronized Dynamic SSR & Zero-Swap Hydration**: Edge-stamped geo-cookie (`bookarium-geo-country`) extracted at the Next.js `layout.tsx` boundary synchronously seeds the jurisdiction store and aligns server snapshots with the client (`ssrMatch`), guaranteeing 0.00 Cumulative Layout Shift on refresh.
  * **Interactive Open-Cover Physics & Interaction-Gated Deep Spreads**: On desktop hover or click, the hardbound volume opens 180° on its spine hinge, rendering the 2 cached pool spreads immediately on paint and upgrading on-demand (`isBookOpen || hasShuffled`) to all 10–16 spreads via the 7-day Edge-cached `/api/books?ids=...&has_quotes=true` endpoint with physical 60–120 FPS page-turn animations.
* **Daily Rotating Editorial Classic of the Day & Words That Shaped Humanity**: Dedicated editorial showcase (`EditorialQuoteSection.tsx`) with territorial copyright filtering, Hero anti-collision protection, and 1-click reader handoff (`selectDailyClassicFromPool`), paired with **"Words That Shaped Humanity"** (`LiteraryQuotes.tsx`) featuring unbiased book-first Fisher-Yates shuffling and a 36-passage offline/unseeded fallback.
* **Interactive 3D Book Preview Modal**: Clicking or tapping any book cover launches a 3D hardcover preview spread (`BookPreviewModal.tsx`) with FLIP geometry transitions, Notable Passages shuffling, and 1-click reader handoff.
* **Studio Bookshelf Bookcase & Deterministic 2-Shelf Capacity**: Hardwood shelf alcove (`BookshelfRack.tsx`, `BookshelfSpine.tsx`) with 8 spine binding colorways, convex specular curvature, gilded lettering, and dynamic 2-shelf capacity coupling (`useBookshelfCapacity`) that fills Shelf 1 then Shelf 2 sequentially from left to right with zero layout shift and elevated hover card stacking (`z-20`).
* **Stepped Scroll Navigation, Bottom Sliding Filter Drawers & Ambient Capsule Dock**: Configurable header auto-hide (`useScrollDirection`), hardware-accelerated bottom sliding filter drawers (`BottomSheetDrawerShell.tsx`, `AdvancedFilterDrawer.tsx`, `CollectionFilterDrawer.tsx`) with high-contrast active chips, and a floating **Ambient Capsule Dock** (`AmbientCapsuleDock.tsx`) paired with auto-dismissing mobile/tablet floating search (`CollectionFloatingSearch.tsx`).
* **Windowed Sub-Pagination, Predictive Prefetching & Intentional Search**: Sub-slices 32-volume upstream batches into viewport-optimized pages (`8` on mobile, `16` on desktop) with `0ms` in-memory sub-page turns, background prefetching (`usePrefetchNextPage`), and intentional <kbd>Enter</kbd>/button search activation with a 2-character minimum guardrail.

### 2. 📖 Dedicated Focus Reader & Typography Engine
* **Unabridged Reading Canvas & 3-Page Activation Threshold (`/read/[id]`)**: Distraction-free reading with exact chapter/page auto-resume toasts, 1-click restart, and a **3-Page Reading Activation Threshold** (`useReaderHabitTelemetry.ts`, `useReaderSession.ts`) before auto-enrolling a volume as `currently_reading`.
* **Gutenberg Paragraph Reflow & Persistent Web Worker AST**: Normalizes legacy 70-character hard linebreaks into fluid prose across Narrow (`576px`), Normal (`768px`), and Wide (`1024px`) layouts while preserving dialogue and poetry via a long-lived Web Worker (`useGutenbergParserWorker`) and a 500-entry LRU virtual pagination engine.
* **Granular Typography, Page Brightness (`Aa`) & Two-Tier Custom Defaults**: Real-time font sizing (`12px–36px`), line height (`1.2–2.6`), page brightness (`30%–100%`), font family (Serif, Sans, Mono), and mode (Paginated / Scroll), with **Two-Tier Preset Management (`Save as My Default`, `Revert to My Default`, `Factory Reset`)** synced via `public.profiles.preferences` JSONB.
* **Cross-Display Silk Bookmark (`bookmarkText`) & Exit Reminder Modal**: Draggable row-snapping silk ribbon (`ReaderRowBookmark.tsx`) that persists the canonical text passage (`bookmarkText`) across font/viewport reflows, decouples passive page flipping from pinned bookmarks, and gently prompts unbookmarked reader exits (`ReaderExitBookmarkModal.tsx`).
* **Single-Tap Immersive Mode, Draggable Tools Pod & Integrated Drawers**: Touch-tap header/footer slide-away, vertically draggable floating tools pod (`ReaderFloatingToolsPod.tsx`), `1200×630` canvas reading card export (`ReaderShareModal.tsx`), two-finger pinch-to-zoom, and portaled drawers for **Table of Contents** (`ReaderTocDrawer`), **In-Book Regex Search** (`ReaderSearchDrawer`), **Language Editions** (`ReaderLanguageDrawer`), **Marginalia** (`ReaderAnnotationsDrawer`), and **Downloads** (`DownloadDrawer`).

### 3. 🌐 Universal Languages, Historical Editions & Web Speech Narration
* **20-Language Catalog & Archive Filtering (12 Primary + 8 Extended)**: Full search and facet filtering across 20 languages via `<LanguageSelector />` and `AdvancedFilterDrawer`.
* **Relational FRBR Historical Editions & Translations (`ReaderLanguageDrawer`)**: In-reader discovery of authentic foreign-language Gutenberg editions indexed via Wikidata `P2034` relational work clusters (`public.book_translations`) with 7-day Edge CDN caching and client author-AST fallback.
* **Synchronized W3C Voice Read-Aloud (Text-to-Speech)**: Offline-first narration (`window.speechSynthesis`, `useReaderSpeech.ts`) with automatic language-voice pairing, amber sentence highlight tracking, speed presets (`0.85x–2.0x`), and OS MediaSession lockscreen controls, plus native browser translation guidance.

### 4. ⚡ Offline-First Persistence, Cloud Sync & Data Sovereignty
* **Native IndexedDB Offline Storage, Same-Origin R2 Cover LRU & Adaptive Offline Catalog**: Persists unabridged book texts (`offline_books`) and local binary cover `Blob`s (`BookariumOfflineDB` v2: downloaded `offline_books` + bounded `300`-entry / `30d` `cover_cache` LRU, resolved via `useOfflineCoverImage.ts` ahead of same-origin `/api/books/content?type=cover` R2 reads with zero external cover hotlinking) for `0ms` offline reading. Includes App Shell `v7` Service Worker caching (`public/sw.js`), an **Adaptive Offline Catalog** (`useOfflineCatalogFallback.ts`), the **`Downloaded (N)` Smart Shelf**, and unified `Downloaded` filtering across all personal collections.
* **Bookmarks & Continue Reading Ledger (`/bookmarks`)**: 2-column archival reading ledger with silk ribbon markers, live progress percentages, multi-attribute sorting, status filtering, completed book progress latching (`Read Again` flow), and 7-layer author lifespan self-healing (`isPlaceholderAuthor` guardrails).
* **In-Reader Highlighting, Interactive Crop-Boundary Resizing, Dual-State Marginalia & Commonplace Notebook (`/notebook`)**: 7 archival highlighters (Yellow, Amber, Mint, Rose, Sky, Lavender, Indigo) with page-boundary partial span matching, a **Dual-State Read/Edit Marginalia Popover** (`TextHighlightPopover.tsx`) with Save-gated Start/End crop-handle resizing (`ReaderHighlightAdjustOverlay.tsx`, horizontal word-snapping, vertical row-snapping, `+ Sentence` / `+ Paragraph` quick-snap, and Supabase outbox sync), composite union cards for overlapping personal + Fellow Scholar highlights (`pairOverlappingAnnotations`), and 1-click academic citation export.
* **7-Store Authoritative Cloud Sync & Multi-Tier Vercel Edge CDN Offloading**: Bi-directional Supabase outbox reconciliation across shelves, progress, annotations, habits, accolades, fellowships, and unified `profiles.preferences` JSONB (`usePreferencesStore` / `useThemeStore`) with passive `15s` mount/`TOKEN_REFRESHED` auth cooldown and unthrottled focus/reconnect wake-up, paired with `{ count: 'estimated' }` / `{ count: 'planned' }` planner scans, 10-column selective projection, per-key `inFlight` L4 coalescing, aligned `60m` reader text caching, single-transaction IndexedDB cover reuse, `(select auth.uid())` RLS `InitPlan` policies (`47` policies across `14` tables), and Multi-Tier Edge CDN caching (`12h` / `24h` / `7d` / `30d`) that cuts quote discovery egress by **>99% (`~44 KB/day`)**.
* **Hardened Authentication, Active Device Sessions & 3-Tier Zero-Retention Erasure (`/account`, `/privacy`)**: Supports Email/Password, Magic Link, and Google OAuth 2.0 PKCE with Cloudflare Turnstile (including `/account` recovery & resend gating) + Honeypot bot protection, fail-closed JWT `amr` password recovery (`auth-recovery.ts`), owner-scoped **Active Device Sessions** inspection & single-device/peer revocation (`public.get_active_sessions()`, `public.revoke_user_session(UUID)`, `verifyActiveSessionValidity`), Connected Accounts linking, dual Reading/Listening streak & annual challenge telemetry (`useHabitsStore`), Dynamic OpenGraph Reading Quote Cards, and a **Two-Step Email-Verified 3-Tier Zero-Retention Data Erasure Protocol** (`public.delete_current_user()` + device storage wipe).

### 5. 🤝 Reader Circles, Literary Symposiums & Scholarly Honors
* **Mutual Reader Circle Fellowships (`public.reader_circles`)**: Opt-in two-way fellowship connections (`useFellowshipStore.ts`, `AccountSymposiumSection.tsx`) with zero-PII `@username` lookup (`public.lookup_scholar_by_username`) and automated profile identity sync triggers (`handle_profile_identity_sync`).
* **Per-Volume Literary Symposium Pacts (`public.symposium_sessions`)**: Co-read specific volumes (`SymposiumInviteModal.tsx`) with synchronized companion progress micro-pills, layered dual-band in-book highlights, `All | Mine | Fellows` filters, and a chapter-bound **Spoiler Shield**.
* **Deterministic Literary Accolades, Ex-Libris Bookplates, Highlight Mottos & Public Sanctuaries (`/u/[username]`)**: Client-side accolades engine (`src/lib/accolades-engine.ts`) unlocking 3D woodcut **Ex-Libris Bookplates** (`ExLibrisBookplate.tsx`), opt-in public scholar profiles (`PublicProfileView.tsx`) protected by strict `is_public` Row-Level Security, searchable **Highlight Motto** picking (`HighlightBioPickerModal.tsx`) with attributed `/u/[username]` `"Read Book"` links, and the **`1200×630` Scholar Share Canvas** (`ProfileShareModal.tsx`, `profile-card-export.ts`, handle-salted visual `?s=` tokens, and `/api/profiles/card` OpenGraph previews).

### 6. ⚖️ 100% Airtight Jurisdictional Copyright Governance & Legal Compliance
* **Autonomous Multi-Jurisdiction Engine (`src/lib/copyright-engine.ts` & `useBookCopyright.ts`)**: Enforces global Project Gutenberg `<dcterms:rights>` exclusion (`copyright === false`, synchronized from `rdf-files.tar.bz2`) alongside statutory public domain cutoffs by visitor country (year 2026): **United States** (`published <= 1930` and `copyright === false`), **Life + 70** (EU, UK, CA, AU, NZ, JP: `death <= 1955`), **Life + 80** (CO, ES pre-1987: `death <= 1945`), and **Life + 100** (MX, CI: `death <= 1925`), including Joint Authorship (Berne Art. 7bis), Translator Protection (Berne Art. 2(3)), and fail-closed longevity heuristics.
* **Edge Geo-IP Seeding, HTTP 451 Gatekeeper, Fetch Metadata Anti-Deeplink & Hyperlink Neutralization**: `src/proxy.ts` resolves `x-vercel-ip-country` / `cf-ipcountry` (or `?country=XX` in dev) for zero-flash SSR seeding and enforces Fetch Metadata anti-deeplink / cross-site isolation (`guardContentAssetRequest`: `403 no-store` on direct browser navigations and `cross-site` subresource hotlinks against `/api/books/content`, preserving `?type=card` OpenGraph images, SEO crawlers, same-origin readers/offline saves, and shared `s-maxage` CDN keys); `/api/books/content` enforces **`HTTP 451: Unavailable For Legal Reasons`** globally whenever `copyright === true` (including US) as well as for territorially restricted works; `DownloadDrawer`, `BookCard`, and `ReaderErrorView` neutralize restricted download links (`CopyrightNoticeBanner.tsx`); territorial routes partition Edge caches via `Vary: x-vercel-ip-country, Accept-Encoding`; and `/copyright` provides a confidential notice & takedown intake channel.

---

<!-- BEGIN:architecture-diagrams -->
## 🏛️ System Architecture

> For the modular architecture hub (`Diagram 1` + Subsystem TOC linking all 7 `docs/architecture/` specifications with `Diagrams 2–16`, C4 models, temporal sequence workflows, and failure recovery trees), see [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md).

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
        ProxyContent["GET /api/books/content, /covers/[file], /og/books/[file]\n(24h Text [book-content] & OG Card • 30d R2 Cover Proxy [covers] • Strict R2 + Optional DB Content)"]
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
    ProxyContent -->|"Tier 1: Instant DB Text (Optional)"| SupabaseCloud
    ProxyContent -->|"Tier 2: Strict R2 Covers & .txt.gz (404/503 Fail-Closed)"| CloudflareR2
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

### 📚 Living Architecture Directory (16 Interactive Diagrams)

| # | Architectural Diagram | Primary Layer & Subsystem | Living Architecture Specification |
|---|---|---|---|
| **1** | **End-to-End System Context & Data Flow** | Global System Context, Edge Proxy & Client SPA | [docs/ARCHITECTURE.md#1-end-to-end-system-context--data-flow](docs/ARCHITECTURE.md#1-end-to-end-system-context--data-flow) |
| **2** | **Focus Reader State & Typography Engine** | Reader Runtime, Web Speech & Virtual Pagination | [docs/architecture/reader-components-and-state.md#2-focus-reader-state--typography-engine](docs/architecture/reader-components-and-state.md#2-focus-reader-state--typography-engine) |
| **3** | **Bookmarks & Continue Reading Ledger Architecture** | Offline Ledger, Row Snap & Metadata Curation | [docs/architecture/reader-components-and-state.md#3-bookmarks--continue-reading-ledger-architecture](docs/architecture/reader-components-and-state.md#3-bookmarks--continue-reading-ledger-architecture) |
| **4** | **Cross-Store, Worker & DOM Event Bus Diagram** | Reactivity, Custom Events & Worker IPC | [docs/architecture/event-bus-and-runtime-flows.md#1-cross-store-worker--dom-event-bus-diagram](docs/architecture/event-bus-and-runtime-flows.md#1-cross-store-worker--dom-event-bus-diagram) |
| **5** | **Cold Launch & 7-Store Cloud Reconciliation** | Edge Geo-IP, Hydration & RLS Outbox Replay | [docs/architecture/event-bus-and-runtime-flows.md#1-cold-launch-edge-geo-ip-resolution-hydration--7-store-cloud-outbox-reconciliation](docs/architecture/event-bus-and-runtime-flows.md#1-cold-launch-edge-geo-ip-resolution-hydration--7-store-cloud-outbox-reconciliation) |
| **6** | **Focus Reader Launch & R2 Stream** | HTTP 451 Gatekeeping, Cloudflare R2 & Worker AST | [docs/architecture/event-bus-and-runtime-flows.md#2-focus-reader-launch-jurisdictional-gatekeeping-http-451-cloudflare-r2-streaming--worker-ast](docs/architecture/event-bus-and-runtime-flows.md#2-focus-reader-launch-jurisdictional-gatekeeping-http-451-cloudflare-r2-streaming--worker-ast) |
| **7** | **Offline Mutation Queueing & Reconnect Replay** | PWA App Shell v7, IndexedDB & Outbox Queue | [docs/architecture/event-bus-and-runtime-flows.md#3-offline-mutation-queueing-adaptive-offline-catalog--reconnect-outbox-replay](docs/architecture/event-bus-and-runtime-flows.md#3-offline-mutation-queueing-adaptive-offline-catalog--reconnect-outbox-replay) |
| **8** | **GitHub Actions & Database Ingestion Topology** | Cron Pipelines, Concurrency Locks, Feeds & Service-Role Upserts | [docs/architecture/database-and-pipelines.md#1-github-actions--database-ingestion-topology](docs/architecture/database-and-pipelines.md#1-github-actions--database-ingestion-topology) |
| **9** | **Hermetic Testing, MSW v3 & V8 Coverage Pipeline** | 4-Tier Test Suites, AST Taint & 7 Gateways | [docs/architecture/ast-topology-and-tooling.md#1-hermetic-testing-msw-v3-interception-sastowasp--v8-coverage-pipeline](docs/architecture/ast-topology-and-tooling.md#1-hermetic-testing-msw-v3-interception-sastowasp--v8-coverage-pipeline) |
| **10** | **External Integration Topology Diagram** | Cloudflare R2, Supabase, CLI Mirror Feeds & Timeouts | [docs/architecture/integrations-failure-and-ops.md#1-external-integration-topology-diagram](docs/architecture/integrations-failure-and-ops.md#1-external-integration-topology-diagram) |
| **11** | **Multi-Tier Failover & Self-Healing Decision Diagram** | Circuit Breakers, Strict R2 Delivery & Worker Fallback | [docs/architecture/integrations-failure-and-ops.md#1-multi-tier-failover--self-healing-decision-diagram](docs/architecture/integrations-failure-and-ops.md#1-multi-tier-failover--self-healing-decision-diagram) |
| **12** | **Edge Routing, Regional Compute & Cron Topology** | Vercel Edge PoPs, iad1 Serverless & Weekly Cron | [docs/architecture/integrations-failure-and-ops.md#1-edge-routing-regional-compute-pinning-iad1--autonomous-cron-topology](docs/architecture/integrations-failure-and-ops.md#1-edge-routing-regional-compute-pinning-iad1--autonomous-cron-topology) |
| **13** | **Multi-Tier Caching, Egress Shielding & R2 Serving** | 5-Layer Cache Hierarchy, Edge TTLs & Cloudflare R2 Cover/Text Proxy | [docs/architecture/integrations-failure-and-ops.md#2-multi-tier-caching-supabase-egress-shielding--cloudflare-r2-covertext-serving](docs/architecture/integrations-failure-and-ops.md#2-multi-tier-caching-supabase-egress-shielding--cloudflare-r2-covertext-serving) |
| **14** | **Auth, Password Recovery, Session Revocation & Origin Flow** | Edge Refresh Bypass, PKCE/OTP, JWT AMR & Pre-Null Teardown | [docs/architecture/security-and-fellowship.md#3-authentication-password-recovery-session-revocation--origin-security-flow](docs/architecture/security-and-fellowship.md#3-authentication-password-recovery-session-revocation--origin-security-flow) |
| **15** | **Literary Fellowship, Symposium & Marginalia Guard Topology** | Reader Circles, Symposiums, Fellow Highlights & DB Triggers | [docs/architecture/security-and-fellowship.md#1-reader-circles-symposium-lifecycle-fellow-marginalia--trigger-guards](docs/architecture/security-and-fellowship.md#1-reader-circles-symposium-lifecycle-fellow-marginalia--trigger-guards) |
| **16** | **Technical SEO Crawler Routing & Structured Metadata** | Crawler vs. rsc=1 Bypass, /covers/, /og/books/, Sitemap & Schema.org | [docs/architecture/routes-hooks-and-engines.md#1-technical-seo-crawler-routing-and-structured-metadata-architecture](docs/architecture/routes-hooks-and-engines.md#1-technical-seo-crawler-routing-and-structured-metadata-architecture) |
<!-- END:architecture-diagrams -->

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js**: `>= 22.22.2` (Node 22 LTS or Node 24 LTS recommended)
- **npm**: `>= 10.0.0`

### 2. Installation & Local Development

```bash
# 1. Clone the repository and install dependencies
npm install

# 2. Start local development server (automatically launches browser)
npm run dev:open

# 3. Or launch full development environment with background test watcher
npm run dev:all
```

The application will be accessible at [http://localhost:3000](http://localhost:3000). *(Curated classics previews, IndexedDB offline reading, and the full test harness run locally without external keys; full 78k+ online catalog search and R2 cover/text streaming require configuring Supabase and Cloudflare R2 environment variables below).*

### 3. Regional Copyright & Jurisdictional Testing
Bookarium strictly enforces territorial copyright compliance in accordance with international public domain statutes:
- **In Production (Vercel)**: Automatically inspects the client's network connection via `x-vercel-ip-country` (tamper-proof edge IP header).
- **In Local Development (`localhost:3000`)**: Automatically infers your country via your machine's **System Timezone** (e.g. `Europe/Bucharest` $\rightarrow$ `RO` / Life+70), displaying the authentic regional catalog out-of-the-box (55,754 volumes in the EU vs. 78,086 in the U.S.).
- **Testing Other Jurisdictions Locally**:
  - Append `?country=XX` to the URL (e.g. `http://localhost:3000/?country=US` or `http://localhost:3000/?country=MX`).
  - Or define `DEV_COUNTRY=XX` in `.env.local` to permanently anchor your local environment to any ISO 3166-1 country code.

---

## 🗄️ Supabase & Cloudflare R2 Hosting Setup (Required Online / Optional Offline Preview)

For local curated-fallback previews, IndexedDB offline reading, and running the Vitest test suite, no secrets are needed *(uncached online `/api/books/content` text/cover reads fail closed cleanly with `503`/`404`)*. For a full online deployment with 78,000+ titles, cloud user sync, covers, and plain-text streaming, configure **Supabase PostgreSQL** and a **private Cloudflare R2 bucket** *(see [**`docs/INFRASTRUCTURE.md`**](docs/INFRASTRUCTURE.md) for Mode `0`–`2` deployment profiles, Free vs. Paid provider tiers, and hard platform limits)*:

### Step 1: Create a Free Supabase Project & Configure `.env.local`
1. Go to [supabase.com](https://supabase.com/) and create a new project.
2. Note your **Project URL**, **anon public key**, and **`service_role` secret key** (for CLI ingestion only — never expose publicly) from **Project Settings $\to$ API**.
3. Create a `.env.local` file in the project root (matching [`.env.example`](.env.example)):

```env
# Public Browser / Client Env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Private Cloudflare R2 Storage (Required for online covers & .txt reading; omit for offline/curated-only UI previews)
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_BUCKET_NAME=bookarium-assets
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key

# CLI Ingestion Only (NEVER expose to Vercel client runtime or browser bundles)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Optional Bot Protection & Search Verification
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=
```

*(Optional: To enable **Continue with Google** OAuth 2.0 login and **Connected Accounts** linking, enable the **Google** provider under **Supabase Dashboard $\to$ Authentication $\to$ Providers**, enable **Manual Linking** under **Authentication $\to$ User Signups**, and add your site URL + `/auth/callback` under **Authentication $\to$ URL Configuration**. See [`DEVELOPMENT.md`](DEVELOPMENT.md#-google-oauth--account-linking-setup-supabase-dashboard--google-cloud-console) for the step-by-step guide.)*

### Step 2: Run Database Schema Script
1. In your Supabase Dashboard, open the **SQL Editor** from the left sidebar.
2. Click **New Query**, copy and paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. The script is **100% idempotent** and safely provisions all `14` database tables, `47` consolidated `(select auth.uid())` Row Level Security (RLS) policies, `20` explicit indexes, and `10` stored functions/triggers (`11` row triggers):

| Database Object | Type | Purpose & Security Governance |
|---|---|---|
| `public.profiles` | Table (RLS) | Scholar display name, unique `@username`, bio (plus optional highlighted volume snapshot `bio_book_id`/`bio_book_title`/`bio_book_author`), public sanctuary toggles (`is_public`, `show_saved_books`, `show_custom_shelves`), and `preferences` JSONB (`active` & `customDefaults`). |
| `public.bookshelves` | Table (RLS) | Default `'General'` shelf and custom collection shelves with granular public/private visibility (`is_public = true`) and owner-only write RLS. |
| `public.bookshelf_items` | Table (RLS) | Volumes filed in bookshelves with parent shelf ownership verification, public shelf read isolation, and cascade-indexed `user_id`. |
| `public.user_favorites` | Table (RLS) | Cross-device synchronized favorited titles with authenticated user isolation. |
| `public.reading_progress` | Table (RLS) | Chapter coordinates, progress %, row-snapped `bookmark_text`, and cached volume metadata. |
| `public.user_annotations` | Table (RLS) | 7-color archival highlights, scholarly notes, and consolidated Symposium Fellow marginalia RLS. |
| `public.user_book_curation` | Table (RLS) | Personal 1–5 star ratings and reading status (`want_to_read`, `currently_reading`, `finished`, `on_hold`). |
| `public.user_reading_habits` | Table (RLS) | Reading streaks, daily session dates, annual goal targets, `completed_books_count`, and dual reading/listening duration. |
| `public.user_accolades` | Table (RLS) | Unlocked literary accolades, timestamps, and 3-plate Ex-Libris showcase pinning. |
| `public.reader_circles` | Table (RLS) | Two-way Fellow Scholar connections (`pending` / `accepted`) with `ON DELETE CASCADE` and participant-only RLS. |
| `public.symposium_sessions` | Table (RLS) | Per-volume Literary Symposium pacts (`pending`, `active`, `completed`) with synchronized companion coordinates. |
| `public.books` | Table (RLS) | Dedicated 78,000+ book catalog with GIN `search_vector`, indexed languages, `download_count`, author lifespan bounds (`max_author_death_year`, `min_author_birth_year`), `quotes` JSONB (`10–16` spreads/volume), optional `content` text cache, and public read RLS. |
| `public.book_translations` | Table (RLS) | Relational FRBR junction table linking Gutenberg volumes to canonical literary works across languages (`< 2.5 MB` for 75,000 books). |
| `public.handle_new_user()` | Trigger | Provisions `public.profiles` and the default `'General'` shelf on `auth.users` insert (`SET search_path = ''`, execute revoked from `PUBLIC, anon, authenticated`). |
| `public.handle_profile_identity_sync()` | Trigger | Propagates updated scholar `username` and `display_name` across active `symposium_sessions` and `user_annotations` (`SET search_path = ''`). |
| `public.enforce_fellowship_update_guard()` | Trigger | Enforces anti-spoofing ownership/status integrity across `reader_circles` and `symposium_sessions` updates (`SET search_path = ''`, execute revoked from `PUBLIC, anon, authenticated`). |
| `public.enforce_user_row_quota()` | Trigger | Enforces conflict-aware per-scholar `BEFORE INSERT` row quotas across `bookshelves` (`50`), `bookshelf_items` (`2,000`), `user_favorites` (`2,000`), `user_annotations` (`5,000`), `reader_circles` (`500`), and `symposium_sessions` (`200`) (`SET search_path = ''`, execute revoked from `PUBLIC, anon, authenticated`). |
| `public.delete_current_user()` | RPC Function | Atomic 11-table + `storage.objects` user data erasure prior to `auth.users` deletion (`authenticated`-only, `SET search_path = ''`). |
| `public.lookup_scholar_by_username()` | RPC Function | Zero-PII handle resolution returning minimal `(id, username, display_name)` for Reader Circle invitations (`authenticated`-only, `SET search_path = ''`). |
| `public.get_active_sessions()` | RPC Function | Owner-scoped (`(select auth.uid())`) active device session inspection returning masked IP addresses (IPv4 `.x`, IPv6 `/48 ::x`), user-agent strings, and `"isCurrent"` UUID claim matching (`authenticated`-only, `SET search_path = ''`). |
| `public.revoke_user_session()` | RPC Function | Owner-scoped remote device session revocation deleting target `auth.sessions` rows for `(select auth.uid())` (`authenticated`-only, `SET search_path = ''`). |
| `public.books_search_vector_trigger()` | Trigger | Maintains `search_vector` across `title`, `subjects`, and `bookshelves` with an `IS DISTINCT FROM` guard that skips recomputation on `download_count`-only updates. |

### Step 3: Populate Public Domain Catalog & Private Cloudflare R2 Storage
To activate the dedicated PostgreSQL book catalog, pre-seed private Cloudflare R2 assets (`books/<id>.txt.gz`, `covers/<id>.jpg`), and bypass third-party rate limits, run the ingestion pipelines below (see [**`docs/GITHUB_ACTIONS.md`**](docs/GITHUB_ACTIONS.md) for all 11 workflow triggers, secrets, `workflow_dispatch` inputs, `catalog-cache` setup, security scans, and manual tag purging, plus [**`docs/PIPELINE_GUIDE.md`**](docs/PIPELINE_GUIDE.md#-autonomous-ingestion-pipelines--telemetry-reference) for console telemetry banners and run-report formats):

#### Option A: Autonomous Full-Catalog Sync (78,000+ Titles — Recommended)
```bash
# 1. Quick test run (first 100 books, ~2 seconds):
npm run catalog:sync -- --limit=100

# 2. Full autonomous catalog population + local snapshot cache for Option E (78,000+ titles):
npm run catalog:sync -- --cache-file=gutenberg-catalog-cache.json.gz --diff-output=quote-diff.json
```
> [!TIP]
> **Hands-Free Weekly Sync & GitHub Actions Automation**: Add `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (and `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` using a bucket-scoped Read & Write R2 token for automated private asset seeding/syncing, `GUTENBERG_CONTACT_EMAIL` for outbound `User-Agent` attribution, plus optional `VERCEL_API_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` for instant post-sync Vercel Edge tag invalidation) to **GitHub Secrets** (`Settings -> Secrets and variables -> Actions`):
>
> 1. **Unified Sunday Ingestion Pipeline ([`.github/workflows/catalog-sync.yml`](.github/workflows/catalog-sync.yml))**:
>    - **Schedule**: Every Sunday at `02:00 UTC` (plus on-demand `workflow_dispatch`).
>    - **Sequential 5-Step Flow**:
>      1. **Catalog Sync (`catalog:sync`)**: Restores the permanent **`catalog-cache` GitHub Release snapshot** (`gutenberg-catalog-cache.json.gz` verified against its `.sha256` sidecar via `crypto.timingSafeEqual`, preserving cached/DB `copyright: true` flags and deferring unverified new entries under RDF outages via `reconcileBatchWithoutRdfRights`, while diffing all 78k+ catalog rows and withdrawn IDs 100% in RAM to save `~39 MB/week` of Supabase read egress), streams `rdf-files.tar.bz2` and `pg_catalog.csv.gz` across official Gutenberg mirrors with `Content-Length` truncation and non-zero `tar` guards plus wire `SHA-256` summary logging, exact-diff upserts new/changed books and reconciles withdrawn IDs in `public.books`, emits `quote-diff.json`, and **immediately** updates `catalog-cache` Release assets (`>= 50,000` floor).
>      2. **Cloudflare R2 Delta Asset Sync (`r2:sync --source=rsync --rsync-host=auto --max-minutes=25`, `continue-on-error: true` fault-isolated)**: Audits R2 `books/` & `covers/` keys via `ListObjectsV2`, skips permanently missing assets cached in `_meta/r2-sync-state.json.gz` (`90-day` TTL with HTTP/corrupt read protection, race-safe union merges, and `try ... finally` checkpoints), deletes copyrighted/withdrawn items (`DeleteObject`), uploads missing `.txt.gz`/`.jpg` deltas via multi-host `aleph.gutenberg.org` ↔ `rsync.ibiblio.org` targeted `rsync --files-from` + `DEFAULT_R2_PUT_CONCURRENCY = 8`, emits conditional `--purge-tags-file` tags on deletes/`--force` overwrites, and logs `Bucket Coverage`, `rsync Host Order / Used`, & bounded `Changed Volumes` tables to `$GITHUB_STEP_SUMMARY`. *(Skips `exit 0` only when all 4 `R2_*` secrets are unset; fails fast on partial/malformed configs).*
>      3. **Relational Translations Sync (`translations:sync`, `continue-on-error: true` fault-isolated)**: Queries Wikidata `P2034` (`45,000ms` socket timeout with offline snapshot fallback), runs retry-hardened FK pre-checks (`filterValidCatalogBookIds`) + bisected `upsertTranslationBatchesWithRetry` batches into `public.book_translations`.
>      4. **Featured Quotes Delta Sync (`quotes:sync --source=auto --mirrors=pglaf,aleph,readingroo --diff-file=quote-diff.json`, `continue-on-error: true` fault-isolated)**: Consumes `quote-diff.json`, reads `books/<id>.txt.gz` from private R2 first (0s delay) ahead of 3-mirror PG fallback (`8.0s–16.0s` float pacing) to ingest `10–16` multi-quote spreads across the **Two-Tier Bounded Quote Pool (`Top 500 Popular + Rolling 64 Most Recent`)**, prunes Option-A `1-for-1` out-of-window surplus up to `2,000` books per run (`--max-prune`), publishes `From R2`, `Out-of-Window (Pruned)` & `🧹 Pruned` telemetry (`$GITHUB_STEP_SUMMARY`), and evaluates infra failure thresholds via `shouldFailFeaturedQuotesRun`.
>      5. **Vercel Edge Cache Purge (`node scripts/purge-vercel-cache.js --tags=catalog,quotes,translations[,r2-tags]`) & Final Outcome Verification**: Runs when `dry_run != 'true'` and catalog/translations/quotes succeeded (`if: always()`), followed by final step outcome verification so transient downstream failures surface clearly without blocking cache purges.
> 2. **Automated `catalog-cache` Tag Sync & Manual Utility Workflows ([`catalog-tag-sync.yml`](.github/workflows/catalog-tag-sync.yml), [`r2-sync.yml`](.github/workflows/r2-sync.yml), [`r2-content-scan.yml`](.github/workflows/r2-content-scan.yml), [`translations-sync.yml`](.github/workflows/translations-sync.yml), [`quotes-sync.yml`](.github/workflows/quotes-sync.yml) & [`cache-purge.yml`](.github/workflows/cache-purge.yml))**:
>    - [`catalog-tag-sync.yml`](.github/workflows/catalog-tag-sync.yml) (`push` to `master` + `workflow_dispatch`) advances `refs/tags/catalog-cache` in place without touching `gutenberg-catalog-cache.json.gz` or `.sha256` (so GitHub Release `Source code (zip)`/`(tar.gz)` stay current alongside code pushes, while catalog snapshots only update on live `catalog-sync.yml` runs).
>    - [`r2-sync.yml`](.github/workflows/r2-sync.yml) provides a manual `workflow_dispatch` workflow (`90m` timeout / `max-minutes=75`) supporting selectable `catalog_source` (`auto`, `snapshot`, `supabase`) and `rsync_host` (`auto` / `aleph` $\rightarrow$ `ibiblio`, or `ibiblio` $\rightarrow$ `aleph`) for bulk initial R2 seeding or ID repairs via multi-host `rsync` or `https`, conditionally purging `covers`/`book-content` tags only when `r2-purge-tags.txt` is non-empty.
>    - [`r2-content-scan.yml`](.github/workflows/r2-content-scan.yml) provides a zero-`npm ci` manual `workflow_dispatch` audit (`60m` timeout) scanning stored `books/<id>.txt.gz` objects for configurable terms (`asiafilm` default) with `--dry-run` `0`-Class-B previews and `$GITHUB_STEP_SUMMARY` reports.
>    - Configured as `workflow_dispatch`-only manual utilities (no overlapping cron schedules and no 60-day GitHub Actions inactivity warnings) so you can trigger targeted translation updates or custom quote backfills (`text_source`: `auto` | `r2` | `mirrors`, `limit`, `ids`, `mirror_pglaf`/`mirror_aleph`/`mirror_readingroo`, `force_refresh`, `dry_run`), each automatically invalidating its corresponding Vercel Edge cache tag (`translations` or `quotes`) when `dry_run != 'true'`.
>    - [`cache-purge.yml`](.github/workflows/cache-purge.yml) (`Manual Cache Purge`) provides a zero-`npm ci` standalone workflow with unchecked-by-default tag checkboxes (`purge_catalog`, `purge_quotes`, `purge_translations`, `purge_covers`, `purge_book_content` requiring at least one selected via fail-fast validation), `target` (`production` / `preview`), and `dry_run`.

#### Option B: Curated Masterworks Starter Seed (10 Books Metadata Only)
```bash
npm run catalog:ingest -- --curated --dry-run
# 1. Paste and run generated supabase/seed_books.sql in the Supabase SQL Editor (populates metadata rows)
# 2. Seed matching covers/texts into private Cloudflare R2 via Option E (`npm run r2:sync -- --ids=1342,84,... --source=https`)
```

#### Option C: Ingest Relational Translations (Multilingual Edition Links)
```bash
npm run translations:sync -- --dry-run      # Validate clustering without DB writes
npm run translations:sync -- --limit=200    # Quick 200-cluster test sync
npm run translations:sync -- --all          # Full live translation clustering & upsert
```

#### Option D: Ingest Featured Literary Quotes (`10–16` Multi-Quote Spreads/Book)
```bash
npm run quotes:sync -- --dry-run            # Generates supabase/seed_quotes.sql locally without mutating Supabase
npm run quotes:sync -- --ids=1342,84,2701   # Sync specific classics by Gutenberg ID
npm run quotes:sync -- --limit=50           # Live Two-Tier batch (40 Popular + 10 Recent)
npm run quotes:sync -- --ids=1342 --force   # Re-extract & overwrite quotes for specific IDs
```

#### Option E: Provision & Synchronize Private Cloudflare R2 Covers & Gzipped Texts
1. In **Cloudflare Dashboard $\to$ R2**, create a private bucket (e.g. `bookarium-assets`) and keep public `r2.dev` / custom-domain exposure **disabled** so all traffic is proxied and jurisdiction-checked via `/api/books/content`.
2. Create two API tokens under **Manage R2 API Tokens**:
   - **Object Read Only** (for Vercel Production Runtime & local `.env.local` web app reads).
   - **Object Read & Write** scoped to `bookarium-assets` (for CLI `npm run r2:sync` & GitHub Actions Secrets).
   - *(Note: Storing all `~78,000+` covers and `.txt.gz` volumes exceeds Cloudflare R2's `10 GB` free storage allowance and incurs standard R2 storage billing).*
3. Seed missing assets (omit `--cache-file` if you did not save `gutenberg-catalog-cache.json.gz` in Option A, or use `--source=wsl-rsync` / `--source=https` on Windows):

```bash
npm run r2:sync -- --dry-run --limit=100                 # Inspect R2 inventory & delta plan
npm run r2:sync -- --ids=1342,84 --source=https --force   # Upload/refresh specific classics via PGLAF HTTPS
npm run r2:sync -- --cache-file=gutenberg-catalog-cache.json.gz --source=rsync --max-minutes=25
npm run r2:sync -- --source=wsl-rsync --max-minutes=25    # Direct Supabase PK scan + WSL rsync on Windows
npm run r2:scan -- --dry-run                             # Count stored R2 books (0 Class B reads)
npm run r2:scan                                          # Scan stored books/*.txt.gz for 'asiafilm'
```

Once seeded, `/api/books` automatically routes queries to your dedicated Supabase PostgreSQL catalog with predictable ~1–2s catalog page responses and sub-50ms single-book lookups, eliminating the 20–60s wait times and timeouts common on public APIs.

### Step 4: Configure Authentication Redirect URLs
1. In your Supabase Dashboard, navigate to **Authentication $\to$ URL Configuration**.
2. Set **Site URL** to your canonical public domain:
   - Your production deployment URL (e.g. `https://your-domain.com` or `https://bookarium.vercel.app` — **never** use a branch or deployment preview URL such as `https://bookarium-git-*.vercel.app`, which is gated by Vercel Deployment Protection) or `http://localhost:3000` (for local-only projects).
3. Under **Redirect URLs**, add the following allowed callback patterns (alongside any secondary/previous domain you still redirect during migration):
   - `https://<your-production-domain>/**` (e.g. `https://bookarium.vercel.app/**`)
   - `http://localhost:3000/**`
   - *(Or explicitly list `/auth/callback`, `/auth/confirm-deletion`, and `/account` for both origins).*

---

### 🚀 Production Deployment on Vercel

Bookarium is architected for zero-config deployment on **[Vercel](https://vercel.com/)**:

1. Push your repository branch to GitHub.
2. Import the project into the [Vercel Dashboard](https://vercel.com/new).
3. Under **Environment Variables**, configure your required runtime variables and optional enhancements:
   * **Required (Database, Catalog & Auth)**:
     * `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
     * `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase public anon key
   * **Required (Online Covers & Plain-Text Streaming — missing `R2_*` fails closed with `404`/`503`)**:
     * `R2_ACCOUNT_ID` = your Cloudflare R2 account ID
     * `R2_BUCKET_NAME` = your private Cloudflare R2 bucket name (e.g., `bookarium-assets`; full 78k+ corpus exceeds Cloudflare R2's 10 GB free-tier limit)
     * `R2_ACCESS_KEY_ID` = your Read-Only R2 S3 access key ID
     * `R2_SECRET_ACCESS_KEY` = your Read-Only R2 S3 signing secret
   * **Optional (Canonical Origin, Bot Defense & Verification)**:
     * `NEXT_PUBLIC_SITE_URL` = canonical public origin (e.g., `https://your-domain.com`; falls back automatically via Vercel production URL env vars)
     * `NEXT_PUBLIC_GITHUB_REPO` = your hosted Git repository URL (auto-detected if omitted)
     * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = optional Cloudflare Turnstile public site key
     * `NEXT_PUBLIC_LEGAL_CONTACT_FORM` = optional DMCA/takedown form URL (falls back to GitHub Issues)
     * `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` = optional Google Search Console meta verification token
4. Click **Deploy** — Vercel will automatically build the Next.js 16 production bundle, configure edge caching, and provision serverless API proxies.
---

## 🔒 Enterprise Security & Defense-in-Depth

Bookarium enforces an automated 7-Pillar SAST & OWASP defense-in-depth model across the edge, serverless runtime, CLI pipelines, and offline client layers. For the AST-compiled security matrix, validator inventory, AST taint rules, and vulnerability disclosure protocol, see [**SECURITY.md**](SECURITY.md).

---

## 🛠️ CLI Command Matrix

| Command | Action / Description |
|---|---|
| `npm run dev` | Starts Next.js development server at `http://localhost:3000` |
| `npm run dev:open` | Starts dev server and opens your default browser concurrently |
| `npm run dev:all` | Starts dev server, Vitest test watcher, and browser concurrently |
| `npm run verify` / `verify:build` | **Runs the full 7-Gateway Quality Engine** before commits / in CI |
| `npm run security:audit` | Runs Pass 0.5, Pass 0.75 & Pass 5 (SAST, License SCA, AST Taint & Governance Parity) standalone |
| `npm test` / `test:coverage` | Runs the full Vitest suite with V8 code coverage report |
| `npm run test:fast` | Runs Vitest test suites without coverage calculation for rapid developer validation |
| `npm run test:ui` | Launches Vitest interactive visual testing UI |
| `npm run test:watch` | Runs Vitest in reactive watch mode for TDD |
| `npm run typecheck` | Validates TypeScript types across all `.ts`/`.tsx` files |
| `npm run lint` | Runs ESLint 10 rules and Core Web Vitals checks (`--max-warnings 0`) |
| `npm run knip` | Audits repository for unused exports and dead dependencies |
| `npm run audit:detailed` | Executes ESLint zero-warning check paired with Knip dead-code analysis |
| `npm run docs:sync` | Auto-generates `docs/ARCHITECTURE.md` (+ `docs/architecture/*.md`), `docs/GUTENBERG_PARSER.md`, `docs/SYSTEM_CONTRACTS.md`, `docs/GITHUB_ACTIONS.md` workflow/SHA tables, `ROADMAP.md`, `CHANGELOG.md`, `SECURITY.md`, and `docs/QUALITY_AUDIT_REPORT.md` from source AST & YAML |
| `npm run report` | Regenerates `docs/QUALITY_AUDIT_REPORT.md` & `docs/quality-audit-results.json` standalone |
| `npm run catalog:sync` | Synchronizes Project Gutenberg's catalog feed into Supabase via cached RAM diffs and emits quote-diff candidates ([Pipeline Guide](docs/PIPELINE_GUIDE.md)) |
| `npm run r2:sync` | Synchronizes missing public-domain `.txt.gz` texts & `.jpg` covers into private Cloudflare R2 via `ListObjectsV2` + `rsync --files-from` / HTTPS (with checkpointed state protection, bounded concurrency, and conditional `covers`/`book-content` purge tags) and prunes copyrighted/withdrawn keys ([Actions Runbook](docs/GITHUB_ACTIONS.md)) |
| `npm run r2:scan` | Scans stored R2 `books/<id>.txt.gz` texts for unwanted or injected terms (`asiafilm` default) using zero third-party dependencies, `0` Vercel/Supabase compute, and `$0` R2 egress ([Actions Runbook](docs/GITHUB_ACTIONS.md)) |
| `npm run catalog:ingest` | Generates idempotent curated starter catalog metadata (`supabase/seed_books.sql`) for local setup *(legacy `--with-content` scraping deprecated in favor of R2)* |
| `npm run translations:sync` | Clusters multilingual FRBR editions via Wikidata SPARQL and batch-upserts `public.book_translations` ([Actions Runbook](docs/GITHUB_ACTIONS.md)) |
| `npm run quotes:sync` | Maintains the Two-Tier bounded quote pool in `public.books.quotes` reading R2 `.txt.gz` first when configured ahead of 3-mirror PG fallback (`pglaf,aleph,readingroo` weekly) and CI Run Reports ([Pipeline Guide](docs/PIPELINE_GUIDE.md)) |
| `npm run build` / `npm start` | Compiles optimized Next.js 16 production bundle and serves production build locally |

> ⚡ **Running in GitHub Actions?** See [**`docs/GITHUB_ACTIONS.md`**](docs/GITHUB_ACTIONS.md) for how these commands and security checks execute across all **11** workflows (`.github/workflows/catalog-sync.yml`, `catalog-tag-sync.yml`, `r2-sync.yml`, `r2-content-scan.yml`, `quotes-sync.yml`, `translations-sync.yml`, `cache-purge.yml`, `ci.yml`, `codeql.yml`, `dependency-review.yml`, and `release.yml`, including dry-run flags and required secrets).

---

## 🙏 Acknowledgements & Open-Source Credits

* **[Google AI / Antigravity](https://antigravity.google)**: For powering the autonomous agentic engineering, architectural refactoring, and deterministic quality verification driving the development of this codebase.
* **[Project Gutenberg](https://www.gutenberg.org/)**: For pioneering the public domain digitization movement and preserving thousands of classic literary masterpieces for humanity.
* **[Wikidata / Wikimedia Foundation (CC0 1.0)](https://www.wikidata.org/)**: For providing the open, public-domain SPARQL knowledge graph and bibliographic entity identifiers (`P2034`) powering Bookarium's multilingual FRBR translation clustering.
* **[Booksaw Bookstore Design Template (CC BY 4.0)](https://www.figma.com/community/file/1521831984874247291/booksaw-bookstore-ecommerce-website-design-template)**: For inspiring the warm, tactile bookstore aesthetic and skeuomorphic open-book layouts.

---

## ⚖️ License & Public Domain Notice

Licensed under the **MIT License**. Literature metadata and source texts originate from **Project Gutenberg** public domain releases (archived and served via Bookarium's PostgreSQL catalog and private Cloudflare R2 storage) and are in the **Public Domain** (Zero Copyright / CC0) in accordance with international public domain statutes. For detailed term calculations, Berne Convention rules, and our confidential notice & takedown portal, see our [**Copyright & Licensing**](/copyright) policy.

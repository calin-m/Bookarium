# Enterprise Master Governance & Agent Operations Protocol - Bookarium

This document establishes immutable engineering rules, governance procedures, operational guardrails, and a 6-layer system topology reference for all human developers and autonomous AI coding agents interacting with this repository.

---

## 1. Core Governance Rules

### Rule 0: Mandatory User Approval & Mutation Protocol
- **Approval-First Execution:** The AI agent must never modify existing files, create new files, perform destructive actions, apply architectural mutations, or install unexpected dependencies without explicit prior user approval and review.
- **Proposal & Review:** The AI agent must propose technical plans, explain trade-offs and diffs clearly, and obtain explicit user consent before proceeding with any code edits.
- **Deterministic Hook Enforcement:** All file mutations (`write_to_file`, `replace_file_content`) are gated by `.agents/hooks.json` and verified prior to release.
- **Human Developer Authority:** The human developer retains final authority over all codebase changes, architectural decisions, and terminal command executions.

### Rule 1: Automated Documentation & Generator Script Co-Evolution
All architecture diagrams (`docs/ARCHITECTURE.md`), decision records (`docs/DECISIONS.md`), quality reports (`docs/QUALITY_AUDIT_REPORT.md`, `docs/quality-audit-results.json`), parser specifications (`docs/GUTENBERG_PARSER.md`), roadmaps (`ROADMAP.md`), and change logs (`CHANGELOG.md`) must be kept in continuous synchronization with the source code.
- **Post-Change Audit Protocol:** Whenever routes, stores, queries, hooks, utilities, configurations, workers, database schemas, or components are added, modified, or deleted, the agent MUST verify and update:
  1. **Source-of-Truth Documentation:** `docs/DECISIONS.md` (ADRs) and `README.md` (if setup, architecture diagrams, or user-facing features changed).
  2. **Documentation Generator Scripts:** `scripts/lib/ast-parser.js` (Babel AST & repository scanner), `scripts/generate-architecture-matrix.js` (full-repository C4 topology, database/index/seed catalog & module descriptions), `scripts/generate-changelog.js` (release ledger & `README.md` latest release block), `scripts/generate-quality-report.js` (audit report, JSON telemetry & `README.md` badge/suite/ADR sync), `scripts/generate-roadmap.js`, and `scripts/generate-parser-docs.js` so that generated outputs never overwrite or drift from the latest changes.
- **Trigger:** Synchronize all living docs via `npm run docs:sync` after updating any generator scripts or source modules.
- **Enforcement:** `npm run verify` runs Pass 4 to automatically re-compile living documentation from source AST and generator scripts.

### Rule 2: Zero-Bloat & AST-Driven Single Source of Truth
Never manually craft static component matrices, route catalogs, or architectural dependency diagrams that can drift.
- All architectural matrices and component inventories must be generated programmatically by `scripts/lib/ast-parser.js` and `scripts/generate-architecture-matrix.js`.
- No mock data or dead prototypes in production code paths.

### Rule 3: Strict Testing, Coverage Co-location, Zero-Any & Anti-Regression Accuracy
- **Mandatory Co-Evolution:** Whenever UI copy, component interfaces, DOM hierarchy, state structures, or user flows are modified, the co-located `*.test.ts` or `*.test.tsx` files MUST be updated in the same changeset to reflect the exact new behavioral contract across components (`src/components/**`), pages/routes (`src/app/**`), hooks (`src/hooks/**`), stores (`src/stores/**`), domain utilities (`src/lib/**`), configs (`src/config/**`), Web Workers (`src/workers/**`), and CLI data pipelines (`scripts/*.test.ts`).
- **Zero Synthetic / Fake Tests (Anti-Tautology Protocol):** Tests must assert genuine user journeys, accessible roles (`getByRole`), state mutations, or router actions. Strictly prohibit tautological tests (e.g. `expect(true).toBe(true)`), shallow snapshot-only tests, or meaningless assertions designed solely to inflate coverage numbers.
- **No False Positives (Strict Verification):** Never loosen assertions (e.g. replacing a precise element check with an overly generic query or catch-all wildcard) just to force a failing test to pass. Tests must fail if the feature, label, accessibility contract, or state handler is broken.
- **No False Negatives (Deterministic Isolation):** Ensure component and hook tests use MSW v2 network isolation (`src/mocks/server.ts`, `src/mocks/handlers.ts`) and `@testing-library/react` without flaky timing, unhandled React `act(...)` warnings, or external network dependencies. Use root-relative asset paths (e.g. `/_next/static/...`) rather than unencrypted `http://` URLs when constructing DOM `<script>` / `<link>` elements in tests to satisfy CodeQL (`js/functionality-from-untrusted-source`).
- **Zero-Any & Zero-Warning Gate:** Strictly forbid explicit `any` (`@typescript-eslint/no-explicit-any: "error"`) and enforce zero ESLint warnings (`eslint . --max-warnings 0`).
- **Coverage Floor:** Test coverage must never drop below 85% on lines, functions, statements, or branches (target: >= 85%). Co-location is strictly enforced across all executable modules.

### Rule 4: Zero API Key Requirement, Multi-Jurisdictional Copyright & Project Gutenberg Compliance
- **Public Domain & Zero API Keys:** All book metadata and content fetching must strictly enforce `copyright=false` or verify public domain status (Zero-Copyright / CC0 / Project Gutenberg Public Domain). Never require end-user API keys or mandatory authentication for catalog browsing, reading, or downloading.
- **Multi-Jurisdictional Copyright & Author Lifespan Self-Healing:** Preserve multi-jurisdictional copyright gatekeeping (`src/lib/copyright-engine.ts`: `US 1930`, `Life+70`, `Life+80`, `Life+100`, joint authorship Art. 7bis, translator protection Art. 2(3)) and non-regressive author/lifespan merge guardrails (`isPlaceholderAuthor` checks across `useContinueReadingLedger.ts`, `offline-storage.ts`, `useOfflineBooks.ts`, `useReaderStore.ts`, and `useBookshelfStore.ts`) so offline or refreshed books never revert to `"Anonymous"` or trigger false `HTTP 451` errors.
- **Project Gutenberg Policy & Mirror-First Prioritization:** Strictly enforce individual-only volume downloads (never introduce batch shelf downloaders or automated mass scrapers), prioritize official Project Gutenberg mirrors (`aleph.gutenberg.org`, `gutenberg.pglaf.org`, `gutenberg.readingroo.ms`) ahead of `www.gutenberg.org`, preserve `SITE_CONFIG.USER_AGENT` on outbound server requests, and retain the Project Gutenberg license/colophon section in segmented texts.
- **Offline-First PWA Parity:** Maintain offline App Shell resilience (`public/sw.js` `bookarium-app-shell-v4`, `ServiceWorkerRegister.tsx`, `useNetworkStatus.ts`), adaptive offline Catalog fallback (serving IndexedDB downloaded volumes when cached books exist or `CatalogOfflineView.tsx` when empty), and `isUnavailableOffline` restriction parity (cover/spine dimming, `Not Downloaded` badges, and disabled read/download triggers for uncached volumes when offline).

### Rule 5: Conventional Commit Formatting & User-Driven Commit Execution Protocol
- **Agent Prohibition:** The AI agent is strictly prohibited from executing `git commit`, `git push`, `git merge`, or branch-modifying Git commands directly.
- **On-Demand Command Formulation Only:** The AI agent must only generate and provide Git commit commands when explicitly requested by the user (e.g. when the user asks "how do I commit this?", "generate commit command", or asks to commit a completed step). The agent must NOT automatically append git commands to general Q&A or intermediate discussion turns.
- **Diff Inspection & Structure:** When requested, the agent inspects staged changes via `git status --short` and `git diff` to formulate Conventional Commit commands with distinct multi-part `-m` flags for the user to review and execute (using Windows PowerShell backtick (`) line continuation):
  ```powershell
  git add .
  git commit `
    -m "feat(scope): concise imperative summary" `
    -m "[PHASE]: Implementation phase or milestone" `
    -m "[WHY]: Motivation and business/architectural justification" `
    -m "[WHAT]: Comprehensive bulleted list of modifications" `
    -m "[VERIFICATION]: 7-Gateway verification command and test results"
  ```
- **Living Documentation Auto-Staging:** Ensure auto-generated and synchronized documentation files (`docs/ARCHITECTURE.md`, `docs/GUTENBERG_PARSER.md`, `ROADMAP.md`, `CHANGELOG.md`, `README.md`, `docs/QUALITY_AUDIT_REPORT.md`, `docs/quality-audit-results.json`) are staged alongside the implementation.

### Rule 6: Verification Engine & Test Execution Protocol (On-Demand & Error-Gated)
- **User-Driven Test & Verification Execution:** The AI agent must only execute the test suite and 7-Gateway Quality Engine (`npm run verify`, `npm test`, or test commands) when explicitly requested by the user (e.g. when the user asks "run verify", "run tests", "verify build") or when actively investigating/debugging an encountered runtime, type, or lint error in code. The agent must not autonomously run full test passes on intermediate turns without cause or request.
- **Pre-Commit Verification:** Before committing changes, pushing branches, or opening pull requests, the full 7-Gateway Quality Engine must pass with zero errors:
  ```bash
  npm run verify
  ```
- **Blocking Guard:** Any failure in passes 0.5, 0.75 through 7 immediately blocks workflow progression and halts the pre-commit hook.

### Rule 7: Approval-First Architectural Governance (ADRs)
Major architectural modifications, dependency introductions, schema shifts, or design alterations must be proposed via an Architecture Decision Record (ADR) before execution:
```bash
npm run adr:new -- "Your Decision Title"
```
All ADRs in `docs/DECISIONS.md` must adhere to standard schema (Status, Context, Decision, Consequences).

### Rule 8: Repository Hygiene, Secret Prevention & 7-Pillar SAST/OWASP Governance
- **Zero Secrets & Boundary Policy (Pass 0.5):** Never commit API keys, RSA/EC/OpenSSH private keys, GitHub/Supabase PATs, webhook tokens, passwords, database URLs with embedded credentials, or `.env` files containing live secrets, and never import `SUPABASE_SERVICE_ROLE_KEY` into client-side modules.
- **7-Pillar SAST & OWASP Security Suite (Pass 0.75):** All code changes must satisfy the automated security invariants in `scripts/verify-build.js`:
  1. **Supply-Chain Audit:** 0 High or Critical CVEs (`npm audit --omit=dev`).
  2. **API Rate Limiting & Anti-SSRF:** Every `/api/books/**` route enforces `RateLimiter.check()` and `url-validator.ts` HTTPS domain allowlisting across redirect hops.
  3. **DOM XSS Prevention:** Zero unsafe DOM sinks (`dangerouslySetInnerHTML`, `.innerHTML`, `document.write`, string `eval`/`setTimeout`).
  4. **Open-Redirect Sanitization:** All auth callback and redirect flows route through `sanitizeRedirectPath` / `resolveCanonicalAuthOrigin` (`src/lib/redirect-sanitizer.ts`).
  5. **Public Domain & License Integrity:** MIT license and `copyright=false` query enforcement.
  6. **Database RLS & `SECURITY DEFINER` Hardening:** All 14 PostgreSQL tables enforce `ENABLE ROW LEVEL SECURITY` and all `SECURITY DEFINER` functions enforce `SET search_path = ''`.
  7. **OWASP HTTP Security Headers:** `next.config.ts` enforces all 7 headers (`Content-Security-Policy` with production `unsafe-eval` stripping, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`).

### Rule 9: Idempotent Database Schema Co-Evolution, RLS Governance & Live SQL Hand-Off
- **Canonical Schema Co-Evolution:** Any change, addition, or removal of tables, columns, indexes, triggers, or policies in Supabase must be simultaneously documented and synchronized in:
  1. `supabase/schema.sql` (the canonical database schema file).
  2. `src/types/database.types.ts` (TypeScript types representing the database rows, inserts, and updates).
  3. `scripts/generate-architecture-matrix.js` (`extractDatabaseCatalog` table/function/index metadata) and `README.md` (quickstart database setup instructions).
- **Strict Idempotency Requirement:** All DDL and DCL statements in `supabase/schema.sql` and manual migration scripts MUST be strictly idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`, `DROP POLICY IF EXISTS ... CREATE POLICY ...`). Running the schema migration script multiple times must never throw duplicate-key, duplicate-table, or duplicate-policy errors and must never cause destructive data loss.
- **Row-Level Security (RLS) Policy Enforcement:** Every table created in PostgreSQL must explicitly enable Row Level Security (`ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`) and have granular policies ensuring users can only read and mutate authorized rows (`auth.uid() = user_id` or fellowship participant policies).
- **Mandatory Live Deployment SQL Hand-Off:** Whenever `supabase/schema.sql` (or any database table, column, index, RPC function, trigger, or RLS policy) is modified, the AI agent MUST explicitly provide a standalone, copy-paste-ready idempotent SQL migration query directly in the chat response so the user can immediately execute the delta in the deployed **Supabase Dashboard -> SQL Editor** without missing production database changes.

---

## 2. System Topology & Architectural Quick-Reference

> **Complete Living Architecture Map**: For the full AST-generated C4 diagrams, component/store/hook/utility/config/type inventories, database tables/triggers/22 indexes, PWA asset catalog, and module dependency graph, see [`docs/ARCHITECTURE.md`](file:///docs/ARCHITECTURE.md).

1. **Layer 1 — Edge Proxy, Geo-IP & App Router (`src/proxy.ts` & `src/app/`)**:
   - `src/proxy.ts` extracts client jurisdiction (`x-vercel-ip-country`, `?country=XX` dev override, `bookarium-geo-country` cookie) and refreshes Supabase SSR sessions.
   - `next.config.ts` maps clean collection paths (`/bookshelf`, `/favorites`, `/notebook`, `/bookmarks`) to the unified SPA workspace (`src/app/page.tsx`) alongside dedicated routes for Focus Reader (`/read/[id]`), Account Hub (`/account`), Public Scholar Sanctuary (`/u/[username]`), Auth Callback (`/auth/callback`), Account Deletion (`/auth/confirm-deletion`), Privacy (`/privacy`), and Copyright (`/copyright`).
   - `src/app/providers.tsx` initializes TanStack `QueryClient`, Supabase auth listeners, 6-store cloud sync (`syncAllStoresWithCloud`), `online` outbox flushing, `ServiceWorkerRegister`, and dynamic `AuthModal`.
2. **Layer 2 — Dual-Provider Catalog Seam & Multi-Mirror Content Streaming (`src/lib/catalog/` & `src/app/api/books/`)**:
   - `/api/books` queries the primary self-hosted Supabase PostgreSQL catalog (`src/lib/catalog/supabase-provider.ts` on `public.books` with GIN `search_vector` and pre-computed `max_author_death_year`) and automatically fails over to upstream Gutendex (`src/lib/catalog/gutendex-provider.ts`) if Supabase is unconfigured or unreachable.
   - `/api/books/content` enforces 3-tier contributor lifespan caching (`metadata-cache.ts`), jurisdictional copyright gatekeeping (`HTTP 451`), and anti-SSRF validation (`url-validator.ts`), streaming plain text from Tier 1 (`public.books.plain_text`) or Tier 2 Project Gutenberg mirrors (`aleph.gutenberg.org`, `gutenberg.pglaf.org`, `gutenberg.readingroo.ms`, `www.gutenberg.org`).
   - `/api/books/translations` resolves multilingual editions via relational FRBR work clusters (`public.book_translations` seeded from Wikidata `P2034` / `P407`).
3. **Layer 3 — 10 Zustand Stores, IndexedDB Offline Cache & Bi-Directional Cloud Outbox (`src/stores/` & `src/lib/`)**:
   - **10 Zustand Stores**: `useBookshelfStore`, `useReaderStore`, `useAuthStore`, `useFellowshipStore`, `useAnnotationStore`, `useAccoladesStore`, `useHabitsStore`, `useJurisdictionStore`, `usePreferencesStore`, and `useThemeStore`.
   - **Offline Engine**: `src/lib/offline-storage.ts` and `src/hooks/useOfflineBooks.ts` store unabridged book texts and self-healed author metadata in browser IndexedDB; `src/hooks/queries/useBookContent.ts` uses `networkMode: 'always'` so cached volumes open instantaneously offline.
   - **Cloud Reconciliation**: `src/lib/sync-utils.ts` and `src/lib/bookshelf-cloud-sync.ts` coordinate bi-directional outbox queues and tombstone filtering across shelves, reading progress, annotations/fellow marginalia, habits, accolades, profiles, and symposiums.
4. **Layer 4 — Focus Reader, Web Worker AST, Row Bookmark & Web Speech TTS (`src/app/read/[id]/`, `src/lib/gutenberg/`, `src/workers/`)**:
   - `src/workers/gutenberg.worker.ts` and `src/lib/gutenberg/` (`segmentation.ts`, `reflow.ts`, `pagination.ts`, `metadata.ts`, `passages.ts`) parse raw Gutenberg plain text off-thread into reflowed chapters and virtual pages (`5,600` chars/page).
   - `ReaderSurface.tsx` renders fluid typography, an interactive left-margin row-snapping silk bookmark (`bookmarkRow` persisted in `readingPositions` and encoded fractionally in `scroll_offset`), layered dual-band personal + Symposium fellow highlights (`src/lib/reader-annotator.ts`), and Web Speech API sentence-boundary narration (`useReaderSpeech.ts`).
5. **Layer 5 — Supabase PostgreSQL Schema, Triggers, Indexes & Seeds (`supabase/`)**:
   - `supabase/schema.sql` defines **14 RLS-enabled tables** (`public.profiles`, `bookshelves`, `bookshelf_items`, `user_favorites`, `reading_progress`, `user_annotations`, `user_book_curation`, `user_reading_habits`, `user_accolades`, `books`, `book_translations`, `reader_circles`, `symposium_sessions`, and `supabase_migrations.schema_migrations`), **6 stored functions/triggers**, and **22 explicit GIN/B-Tree/unique indexes**, paired with `supabase/seed_books.sql` and `supabase/seed_translations.sql`.
6. **Layer 6 — Living AST Documentation & 7-Gateway Quality Engine (`scripts/` & `docs/`)**:
   - `npm run docs:sync` executes `generate-architecture-matrix.js`, `generate-parser-docs.js`, `generate-changelog.js`, `generate-quality-report.js`, and `generate-roadmap.js`.
   - `npm run verify` (`scripts/verify-build.js`) executes Passes `0.5`, `0.75`, and `1` through `7`.

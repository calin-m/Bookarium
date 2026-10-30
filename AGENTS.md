# Multi-Agent Development Standards - Bookarium

Welcome to **Bookarium**. When contributing or generating code for this repository, autonomous agents and developers must strictly follow these engineering protocols.

> **Canonical Protocol Specification & Full-Project Map**: For the complete enterprise governance rules and 6-layer system topology, see [`.agents/AGENTS.md`](file:///.agents/AGENTS.md) and [`docs/ARCHITECTURE.md`](file:///docs/ARCHITECTURE.md).

## Core Principles & Boundaries
1. **Rule 0 (User Approval)**: Never modify files, apply architectural shifts, or install dependencies without prior user approval and review.
2. **Public Domain Integrity, Multi-Jurisdictional Copyright & Gutenberg Compliance**: Do not introduce any closed-source, DRM-restricted, or copyright-infringing book sources. Ensure all queries pass `copyright=false`, enforce multi-jurisdictional public domain evaluation (`src/lib/copyright-engine.ts`: `US 1930`, `Life+70`, `Life+80`, `Life+100`), preserve authentic author lifespans/names across local stores and IndexedDB (`isPlaceholderAuthor` guardrails so offline books never revert to `"Anonymous"` or trigger false `HTTP 451`), and strictly honor Project Gutenberg policy (individual-only downloads, mirror-first prioritization across `aleph.gutenberg.org`, `gutenberg.pglaf.org`, and `gutenberg.readingroo.ms` ahead of `www.gutenberg.org`).
3. **Zero API Key Requirement & Offline-First PWA Parity**: The core user experience must work without any third-party paid keys, auth sign-in, or backend database setup, and must maintain offline-first PWA resilience (`public/sw.js` `bookarium-app-shell-v4`, `useNetworkStatus`, adaptive offline Catalog fallback, and `isUnavailableOffline` restriction parity for uncached volumes when offline).
4. **State & Offline Architecture**:
   - **Remote data**: TanStack React Query v5 (`useBooks`, `useBookContent` with `networkMode: 'always'`, `useBookTranslations`).
   - **Local persistent state (10 Zustand stores)**: `useBookshelfStore`, `useReaderStore`, `useAuthStore`, `useFellowshipStore`, `useAnnotationStore`, `useAccoladesStore`, `useHabitsStore`, `useJurisdictionStore`, `usePreferencesStore`, and `useThemeStore`.
   - **Offline volume cache & cloud sync**: IndexedDB unabridged book storage (`src/lib/offline-storage.ts`, `useOfflineBooks`) and 6-store bi-directional Supabase outbox reconciliation (`src/lib/sync-utils.ts`, `src/lib/bookshelf-cloud-sync.ts`).
5. **Co-located Testing, Zero-Any, Zero-Warning & Anti-Regression Accuracy**: Every component (`*.tsx`), hook (`*.ts`), store (`*.ts`), route handler (`route.ts`), domain utility (`src/lib/**`), config (`src/config/**`), Web Worker (`src/workers/**`), and CLI data pipeline (`scripts/*.test.ts`) must have a co-located `*.test.ts` or `*.test.tsx` testing authentic user journeys with `@testing-library/react` and MSW v2 (`187` suites). Zero synthetic/fake tests, no loose assertions, strict zero-`any` (`@typescript-eslint/no-explicit-any: "error"`), zero ESLint warnings (`--max-warnings 0`), CodeQL-safe relative asset URLs in tests, and mandatory co-evolution on every code change.
6. **Coverage Enforcement**: Never allow test coverage to drop below the configured V8 thresholds (`lines: 95%`, `statements: 95%`, `functions: 92%`, `branches: 85%`).
7. **Git Protocol (Human Execution Only)**: Provide in-depth structured conventional commit commands (`[PHASE]`, `[WHY]`, `[WHAT]`, `[VERIFICATION]`) only when explicitly requested by the user. AI agents must never execute `git commit` or `git push` directly.
8. **7-Gateway Quality & 7-Pillar SAST/OWASP Engine**: Run `npm run verify` (Pass 0.5 secret/boundary scanner, Pass 0.75 7-Pillar SAST/OWASP security suite, and Passes 1–7) only when explicitly requested by the user or when actively investigating/debugging an encountered error in code to guarantee zero errors across all passes.
9. **Rule 9 (Idempotent Database Schema Co-Evolution, RLS Governance & Live SQL Hand-Off)**: All database modifications must co-evolve `supabase/schema.sql`, `src/types/database.types.ts`, `scripts/generate-architecture-matrix.js`, and `README.md` using strictly idempotent SQL (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS`) with strict Row Level Security enabled across all 14 tables (`SET search_path = ''` on all `SECURITY DEFINER` functions). Whenever `supabase/schema.sql` is modified, the agent must output a standalone, copy-paste-ready idempotent SQL migration block directly in chat so the user can immediately execute it in the deployed Supabase SQL Editor.
10. **Rule 1 (Documentation & Generator Script Co-Evolution)**: After any codebase change, always check whether source-of-truth docs (`docs/DECISIONS.md`, `README.md`) or generator scripts (`scripts/lib/ast-parser.js`, `scripts/generate-architecture-matrix.js`, `scripts/generate-changelog.js`, `scripts/generate-quality-report.js`, `scripts/generate-roadmap.js`, `scripts/generate-parser-docs.js`) require adjustments, and run `npm run docs:sync` so generated outputs stay 100% synchronized.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

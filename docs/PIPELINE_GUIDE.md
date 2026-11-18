# Pipeline & Quality Governance Guide — Bookarium

This document outlines the automated governance, security analysis, linting, testing, and release gates configured for Bookarium.

---

## 🟢 Node.js Engine & Runtime Prerequisites

Bookarium executes and compiles on Node.js with strict engine boundaries defined in `package.json`:

- **Node.js Runtime**: `>= 22.0.0` (Node 22 LTS or Node 24 LTS recommended)
- **Package Manager**: npm `>= 10.0.0`
- **CI Environment**: Node.js 22 on Ubuntu Latest (`.github/workflows/ci.yml`)

---

## 🛡️ 7-Gateway Closed-Loop Quality Engine

The core verification workflow is executed deterministically via:
```bash
npm run verify
```

Every commit and pull request must pass all quality gateways with zero blockers:

| Pass | Gateway | Stage Name | Target & Tooling | Enforcement & Governance |
| :--- | :--- | :--- | :--- | :--- |
| **Pass 0.5** | Pre-Commit | Secret & Boundary Scanner | Secret regex, `.env.example`, & Babel AST boundary scan | Scans all repository files for private keys, fine-grained PATs, Supabase `service_role` JWTs & `sb_secret_` keys, AI/cloud/npm/Vercel/Stripe tokens, webhooks, Unicode Trojan Source bidirectional/zero-width characters (`CVE-2021-42574`), tracked `.env*` leaks, AST-verified `.env.example` & client `SUPABASE_SERVICE_ROLE_KEY` boundaries (`validateEnvAndPrivilegeBoundariesAst` handling bracket/destructured/aliased `process.env`), `5 MB` binary limits, and transitive client$\rightarrow$server AST graph isolation (`0 exposed secrets`). |
| **Pass 0.75** | Pre-Commit | 7-Pillar SAST, OWASP & AST Taint Suite | `npm audit`, `bookarium-security`, `sast-validators`, SQL RLS & AST auditors | Audits dependencies, lockfile SHA-512/HTTPS integrity, offline transitive `GPL`/`AGPL` copyleft licenses (`BANNED_PACKAGE_LICENSES`), `package.json` lifecycle scripts, and GitHub Actions workflows (40-char commit-SHA `uses:` pinning, explicit `permissions:`, anti-`pull_request_target` write & shell injection guards); enforces API rate limiting, manual redirect hops, `buildApiSecurityHeaders()` parity, mirror allowlist SSRF guards, and `sameSite`/HTTPS-`secure` cookie writes across function & arrow handlers (`validateApiRoutesSecurityAst`) plus `@/lib/server-rsc-nav`/`node:http(s)` boundary isolation; blocks DOM XSS sinks (`dangerouslySetInnerHTML`, `.innerHTML`, `setAttribute`, static/TS-cast/folded JSX `href`/`src` expressions incl. `data:text/html,`), Reverse Tabnabbing (`CWE-1022` `<a target="_blank">` & `window.open`), wildcard `postMessage('*')` (`CWE-345`), and regex/static `new RegExp()` ReDoS (`CWE-1333`) via Babel AST (`bookarium-security` Rules 4–5); validates origin-locked redirects (`validateRedirectRoutesAst`), MIT, AST public domain filtering (`validatePublicDomainFilterAst`) & 78k-row index query invariants; checks PostgreSQL RLS, idempotency, `(select auth.uid())` `InitPlan` wrapping (`0003_auth_rls_initplan`), single-permissive-policy consolidation (`0006_multiple_permissive_policies`), participant update guards, ceiling constraints, Rule 9 Account Deletion Parity & Local Store Teardown Parity (`validateRule9AuthStoreParityAst` call-graph AST across all `14` database tables [`13` `public.*` + `1` migration ledger] and `8` local user/preference Zustand stores with `SET search_path = ''`); verifies all 7 OWASP HTTP security headers (`X-Frame-Options: DENY`, CSP `object-src 'none'` & `frame-ancestors 'none'`) via Babel AST & Service Worker origin/bounded `CACHE_URLS` sanitization (`validateServiceWorkerSecurity` AST) via stateless validators in `scripts/lib/sast-validators.js` (adversarially tested by `scripts/lib/sast-validators.test.ts`); and executes the 9-rule `bookarium-security` AST & sink-scoped server, client (`router.push`/`replace` with static `/path` & `ROUTES.*` exemptions), and CLI `scripts/` (`https.get`/`http.get` protocol checks, `{ shell: true }` ban, `process.argv` shell/URL taint) engine across `src/`, `scripts/`, `public/sw.js`, & `next.config.ts` with explicit `ast-parse-error` diagnostics. |
| **Pass 1** | Compiler | TypeScript Engine Strict Verification | `tsc --noEmit` | Strict type safety across all components, stores, hooks, route handlers, and types (`0 compile errors`, `0 any`). |
| **Pass 2** | Network | MSW Server & React Query Validation | Vitest + MSW v2 | Validates Mock Service Worker v2 network interception, error fallbacks, and TanStack React Query hooks. |
| **Pass 3** | Test Suite | Vitest Unit Suite & Coverage Floor | `vitest run --coverage` | Asserts all `262` unit/integration test suites (`2,733` tests) pass with tiered `95/95/92/85` code coverage (`Lines >= 95%`, `Statements >= 95%`, `Functions >= 92%`, `Branches >= 85%`). |
| **Pass 4** | Living Docs | Living AST Documentation Sync | `docs:sync` toolchain | Programmatically recompiles `docs/ARCHITECTURE.md`, `SECURITY.md` (`<!-- BEGIN:security-architecture -->`), `CHANGELOG.md`, `ROADMAP.md`, `docs/GUTENBERG_PARSER.md`, `docs/SYSTEM_CONTRACTS.md`, and `docs/QUALITY_AUDIT_REPORT.md` from AST with zero drift. |
| **Pass 5** | Governance & Parity | ADR, Schema, Graph, SemVer & Test Co-Location | Markdown/SQL/TS AST verification | Validates contiguous numbering & schema in `docs/DECISIONS.md`, 18-file governance presence (including circular `SECURITY.md` symbol/table/feed parity via `auditSecurityDocumentationParity`, `docs/GITHUB_ACTIONS.md` + 1:1 workflow/cron parity, and `@scope`/`@invariant`/`@adr` behavioral contract integrity), 1:1 `supabase/schema.sql` $\leftrightarrow$ `src/types/database.types.ts` parity, 0 circular/parse-error/layer-violation/orphan modules, cross-boundary custom-signal & DB table caller parity, 7-file SemVer release parity + `<= 3 ADRs per release` anti-bloat cap + Roadmap `targetMinVersion` floor, and 100% 1:1 co-located test coverage across `src/` (including full `src/app/**`) and CLI ingestion/security scripts (`ingest-*.js`, `sync-*.js`, `ast-parser.js`, `sast-validators.js`, `bookarium-security.js`). |
| **Pass 6** | Quality Suite | Code Quality & Dead Code Audit | ESLint 10 (`--max-warnings 0`) & Knip | Zero ESLint warnings/errors (including the 9-rule `bookarium-security` plugin), zero unreferenced dead files/exports, and zero orphan dependencies. |
| **Pass 7** | Production Build | Next.js Production Build, Header Manifest & Live HTTP Probe | `next build` + `.next/routes-manifest.json` + `next start` probe | Optimized production Next.js bundle compilation within chunk budget, verified compiled security headers (`X-Frame-Options: DENY`, `object-src 'none'`, `frame-ancestors 'none'`), and loopback `127.0.0.1` HTTP runtime verification (`validateLiveHttpSecurityResponse`) of security headers, `400` SSRF/param blocking, and origin-locked `/auth/callback` redirects. |

---

## 🛠️ Node.js CLI & Automation Commands

Bookarium provides a comprehensive suite of Node.js scripts in `scripts/` to automate catalog synchronization, multilingual translation clustering, living architecture compilation, and quality auditing:

| Command | Script File | Architectural Purpose |
| :--- | :--- | :--- |
| `npm run verify` | [`scripts/verify-build.js`](../scripts/verify-build.js) | Full 7-Gateway Closed-Loop Quality Engine verification. |
| `npm run security:audit` | [`scripts/verify-build.js`](../scripts/verify-build.js) `--security-only` | Rapid standalone execution of Pass 0.5 (Secrets & Boundaries), Pass 0.75 (7-Pillar SAST, OWASP & 9-Rule AST Taint Suite), and Pass 5 (ADR, Schema & 1:1 Test Co-Location). |
| `npm run lint` | [`scripts/eslint-rules/bookarium-security.js`](../scripts/eslint-rules/bookarium-security.js) | Executes ESLint 10 (`--max-warnings 0`) including the custom 9-rule `bookarium-security` AST & intra-procedural request-taint plugin. |
| `npm run docs:sync` | Living Docs Toolchain | Programmatically re-compiles `docs/ARCHITECTURE.md`, `SECURITY.md` (`<!-- BEGIN:security-architecture -->`), `CHANGELOG.md`, `ROADMAP.md`, `docs/GUTENBERG_PARSER.md`, `docs/SYSTEM_CONTRACTS.md`, and `docs/QUALITY_AUDIT_REPORT.md`. |
| `npm run matrix:generate` | [`scripts/generate-architecture-matrix.js`](../scripts/generate-architecture-matrix.js) | Analyzes Babel AST of all `src/` modules and `scripts/` via [`scripts/lib/ast-parser.js`](../scripts/lib/ast-parser.js) to compile `docs/ARCHITECTURE.md` (including layer-boundary rules) and the AST-backed safeguard block in `SECURITY.md`. |
| `npm run changelog:generate` | [`scripts/generate-changelog.js`](../scripts/generate-changelog.js) | Compiles `CHANGELOG.md` and synchronizes `package.json`, `package-lock.json`, `SECURITY.md`, `.github/workflows/release.yml`, `.github/ISSUE_TEMPLATE/bug_report.yml`, `docs/GITHUB_ACTIONS.md`, and the `README.md` Latest Release block. |
| `npm run docs:parser` | [`scripts/generate-parser-docs.js`](../scripts/generate-parser-docs.js) | Analyzes `src/lib/gutenberg-parser.ts` AST to document reflow and segmentation rules. |
| `npm run docs:contracts` | [`scripts/generate-contracts-docs.js`](../scripts/generate-contracts-docs.js) | Compiles `@scope`, `@invariant`, `@rationale`, `@adr` JSDoc contracts, AST blast radius, and priority contract queue into `docs/SYSTEM_CONTRACTS.md`. |
| `npm run audit:quality` | [`scripts/generate-quality-report.js`](../scripts/generate-quality-report.js) | Generates `docs/QUALITY_AUDIT_REPORT.md` and `docs/quality-audit-results.json` (using AST test extraction from [`scripts/lib/ast-parser.js`](../scripts/lib/ast-parser.js)). |
| `npm run roadmap:generate` | [`scripts/generate-roadmap.js`](../scripts/generate-roadmap.js) | Generates living `ROADMAP.md` verifying features against source AST with 0% drift. |
| `npm run catalog:sync` | [`scripts/sync-gutenberg-catalog.js`](../scripts/sync-gutenberg-catalog.js) | Synchronizes Gutenberg catalog feeds via `--cache-file` RAM diffs (`quote-diff.json`), upserts new/changed `public.books` rows, and chains R2, translation & quote steps in [`.github/workflows/catalog-sync.yml`](../.github/workflows/catalog-sync.yml) (details below). |
| `npm run r2:sync` | [`scripts/sync-r2-assets.js`](../scripts/sync-r2-assets.js) | Synchronizes missing `books/<id>.txt.gz` and `covers/<id>.jpg` into private Cloudflare R2 via AWS SigV4 `ListObjectsV2` + `rsync --files-from` / PGLAF HTTPS, prunes copyrighted/withdrawn keys, and logs Bucket Coverage & Changed Volumes tables to `$GITHUB_STEP_SUMMARY`. |
| `npm run catalog:ingest` | [`scripts/ingest-catalog.js`](../scripts/ingest-catalog.js) | Generates idempotent curated classics SQL seed files (`supabase/seed_books.sql` and optional `--with-content` `seed_books_content.sql`) from `CURATED_CLASSICS`. |
| `npm run translations:sync` | [`scripts/ingest-translations.js`](../scripts/ingest-translations.js) | Queries Wikidata SPARQL for multilingual FRBR work clusters and populates `public.book_translations`. |
| `npm run quotes:sync` | [`scripts/sync-featured-quotes.js`](../scripts/sync-featured-quotes.js) | Maintains the Two-Tier Bounded Quote Pool (`Top Popular + Rolling Recent`) in `public.books.quotes` reading R2 `books/<id>.txt.gz` first when configured ahead of PGLAF mirror fallback, with `--diff-file` or partial-index pruning and `$GITHUB_STEP_SUMMARY` telemetry (details below). |
| `npm run gate:approve` | [`scripts/approval-gate.js`](../scripts/approval-gate.js) | Pre-commit mutation gate verifying `.agents/hooks.json` approval tokens. |
| `node scripts/generate-pwa-icons.js` | [`scripts/generate-pwa-icons.js`](../scripts/generate-pwa-icons.js) | Compiles standards-compliant 32-bit RGBA multi-resolution `.ico` and vector squircle PWA icons. |
| `npm run dev:open` | [`scripts/open-browser.js`](../scripts/open-browser.js) | Spawns local development server and automatically opens the browser at `http://localhost:3000`. |

> 📖 **Comprehensive Module Graph & Actions Operator Runbook**: For complete topological dependency graphs, Node.js package breakdowns, and database entity schemas, see [**`docs/ARCHITECTURE.md`**](ARCHITECTURE.md). For full triggers, secrets, `workflow_dispatch` inputs, SHA pins, and local CLI commands across all 10 GitHub Actions workflows, see [**`docs/GITHUB_ACTIONS.md`**](GITHUB_ACTIONS.md).

---

## 📦 Autonomous Ingestion Pipelines & Telemetry Reference

Bookarium maintains its 78,000+ volume catalog, private Cloudflare R2 asset bucket, multilingual FRBR translation clusters, and Two-Tier literary quote pool through a unified Sunday GitHub Actions pipeline and four on-demand manual utility workflows (full inputs, secrets, and operator steps documented in [**`docs/GITHUB_ACTIONS.md`**](GITHUB_ACTIONS.md)):

1. **Unified Sunday Ingestion Pipeline ([`.github/workflows/catalog-sync.yml`](../.github/workflows/catalog-sync.yml), `cron: '0 2 * * 0'` + `workflow_dispatch`)**:
   - **Step 1 — Catalog Sync (`scripts/sync-gutenberg-catalog.js`)**: Downloads the permanent **`catalog-cache` GitHub Release snapshot** (`gutenberg-catalog-cache.json.gz` + companion `.sha256` sidecar verified via `crypto.timingSafeEqual`), streams `rdf-files.tar.bz2` (`~121 MB` for live 30-day `download_count` and `<dcterms:rights>` copyright flags unless `--no-rdf` or `--limit` is passed) and `pg_catalog.csv.gz` (`~5.3 MB`) in PGLAF-first mirror order (`gutenberg.pglaf.org` -> `aleph.gutenberg.org` -> `www.gutenberg.org`, or pinned via `--feed-source`) with `isHtmlContentType` HTML outage rejection, strict `Content-Length` truncation verification, fail-closed non-zero `tar` exit handling, and wire `SHA-256` digest calculation/logging to `$GITHUB_STEP_SUMMARY`, diffs all 78,000+ books and withdrawn IDs 100% in RAM (`~39 MB/week` Supabase read egress saved), upserts only new/changed rows into `public.books`, and writes `quote-diff.json` (`--diff-output=quote-diff.json`).
   - **Step 2 — Cloudflare R2 Delta Asset Sync (`scripts/sync-r2-assets.js --source=rsync --max-minutes=25`, skipped gracefully if `R2_*` unset)**: Lists R2 `books/` & `covers/` objects via paginated `ListObjectsV2` (~157 calls), compares against local `gutenberg-catalog-cache.json.gz` **before** publishing the new release snapshot, skips permanent misses cached in `_meta/r2-sync-state.json.gz` (`90-day` TTL), deletes copyrighted/withdrawn keys (`DeleteObject`), prioritizes 27 classics then `download_count DESC`, transfers missing deltas via targeted `rsync --files-from`, and atomically updates `catalog-cache` Release (`>= 50,000` floor) upon success.
   - **Step 3 — Relational Translations Sync (`scripts/ingest-translations.js`)**: Queries Wikidata SPARQL (`wdt:P2034`) with snapshot fallback to cluster multilingual editions into `public.book_translations`.
   - **Step 4 — Featured Quotes Delta Sync (`scripts/sync-featured-quotes.js --diff-file=quote-diff.json`)**: Consumes `quote-diff.json`, reads `books/<id>.txt.gz` from private R2 first (0s mirror delay) when `R2_*` secrets exist before falling back to PGLAF mirrors, scans all quoted rows via partial index `idx_books_with_quotes_popular` (`fetchAllQuotedBookIds` + `resolveBookMetadataByIds`), ingests newly promoted `Top 500 Popular + Rolling 64 Most Recent` volumes, and applies Option-A `1-for-1` out-of-window pruning (`--max-prune`, default `2000`).
   - **Step 5 — Vercel Edge Cache Tag Purge (`scripts/purge-vercel-cache.js --tags=catalog,quotes,translations`)**: Runs when `dry_run != 'true'` using optional `VERCEL_API_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` secrets (`exit 0` skip when unconfigured) so Edge CDN responses reflect new data immediately.
2. **Automated `catalog-cache` Tag Sync & Manual Utility Workflows ([`catalog-tag-sync.yml`](../.github/workflows/catalog-tag-sync.yml), [`r2-sync.yml`](../.github/workflows/r2-sync.yml), [`translations-sync.yml`](../.github/workflows/translations-sync.yml), [`quotes-sync.yml`](../.github/workflows/quotes-sync.yml) & [`cache-purge.yml`](../.github/workflows/cache-purge.yml))**:
   - [`catalog-tag-sync.yml`](../.github/workflows/catalog-tag-sync.yml) (`push` to `master` + `workflow_dispatch`, zero `npm ci`) advances `refs/tags/catalog-cache` in place without disturbing `gutenberg-catalog-cache.json.gz`/`.sha256` snapshots, keeping `catalog-cache` GitHub Release `Source code (zip)`/`(tar.gz)` synced with `master`.
   - [`r2-sync.yml`](../.github/workflows/r2-sync.yml) (`workflow_dispatch`, `90m` timeout / `max-minutes=75`) supports bulk initial bucket seeding and targeted `--ids` repairs via `rsync` or `https` without running Supabase catalog/quote jobs.
   - Both `translations-sync.yml` and `quotes-sync.yml` purge their respective Vercel Edge cache tags (`--tags=translations` and `--tags=quotes`) upon live completion (`dry_run != 'true'`), and `quotes-sync.yml` reads private R2 texts first when `R2_*` secrets are present.
   - [`cache-purge.yml`](../.github/workflows/cache-purge.yml) (`Manual Cache Purge`) provides a zero-`npm ci` standalone workflow to selectively purge `purge_catalog` (`catalog`), `purge_quotes` (`quotes`), and/or `purge_translations` (`translations`)—all unchecked by default with a fail-fast guard requiring at least one checkbox selected—across `target` (`production` / `preview`) with optional `dry_run` preview.
3. **Pre-Batch Telemetry Banners & GitHub Step Summary Run Reports**:
   - Before R2 transfers begin, `sync-r2-assets.js` prints `📊 Cloudflare R2 Inventory Status` (`Active PD Books`, `Texts/Covers Cached vs Missing`, `Confirmed Coverless`, `Cleanup Candidates`, and `This Batch Queued`) and writes **Bucket Coverage**, **Execution Telemetry**, and **Changed Volumes** Markdown tables (strictly updated/pruned/failed rows—never listing unchanged `70,000+` cached books, capped at `50` preview rows past `100` changes) to `$GITHUB_STEP_SUMMARY`.
   - Before mirror downloads begin, `sync-featured-quotes.js` logs a pre-batch pool telemetry banner:
     ```text
     📊 Two-Tier Pool Status (Pre-Batch):
       • Top Popular:    125/500 ingested (375 remaining · 25.0%)
       • Rolling Recent:  64/64 ingested (0 remaining · 100.0%)
       • This Batch:     50 candidate(s) (50 Top · 0 Recent)
       • Note: Rolling Recent pool is fully ingested (100%); batch slots backfilled by Top Popular.
     ```
   - Every ingesting run (and every manual `--ids` run) publishes a Markdown **Run Report** to console (`• Purge Status:` / `• Out-of-Window:`) and `$GITHUB_STEP_SUMMARY` detailing tier progress (`Top Popular`, `Rolling Recent`, `Out-of-Window (Pruned)`, `Total`) and a per-book **Books Processed** ledger (`Tier`, `Source`, `Outcome` including `🧹 Pruned`, and `Quotes` before $\rightarrow$ after count).

---

## 🚀 CI/CD Workflow

The GitHub Actions CI pipeline in `.github/workflows/ci.yml` runs on every push and pull request against `main`, `master`, and `dev`:

```yaml
steps:
  - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
  - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0
    with:
      node-version: 22
      cache: 'npm'
  - run: npm ci
  - run: npm run verify:build
  - name: Enforce Deterministic Living Documentation Sync (Zero Unsynced PR Drift)
    run: |
      git diff --exit-code -- \
        docs/ARCHITECTURE.md \
        docs/GUTENBERG_PARSER.md \
        docs/SYSTEM_CONTRACTS.md \
        CHANGELOG.md \
        ROADMAP.md \
        package.json \
        package-lock.json \
        SECURITY.md \
        .github/workflows/release.yml \
        .github/ISSUE_TEMPLATE/bug_report.yml
```

> ⚡ **Complete Workflows Catalog**: See [**`docs/GITHUB_ACTIONS.md`**](GITHUB_ACTIONS.md) for all **9** workflows (`catalog-sync.yml`, `catalog-tag-sync.yml`, `quotes-sync.yml`, `translations-sync.yml`, `cache-purge.yml`, `ci.yml`, `codeql.yml`, `dependency-review.yml`, `release.yml`), [`.github/dependabot.yml`](../.github/dependabot.yml), secret setup checklists, and local CLI parity commands.

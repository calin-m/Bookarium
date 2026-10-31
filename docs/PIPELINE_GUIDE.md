# Pipeline & Quality Governance Guide — Bookarium

This document outlines the automated governance, security analysis, linting, testing, and release gates configured for Bookarium.

---

## 🟢 Node.js Engine & Runtime Prerequisites

Bookarium executes and compiles on Node.js with strict engine boundaries defined in `package.json`:

- **Node.js Runtime**: `>= 20.0.0` (Node 22 LTS recommended)
- **Package Manager**: npm `>= 10.0.0`
- **CI Environment**: Node.js 20 on Ubuntu Latest (`.github/workflows/ci.yml`)

---

## 🛡️ 7-Gateway Closed-Loop Quality Engine

The core verification workflow is executed deterministically via:
```bash
npm run verify
```

Every commit and pull request must pass all quality gateways with zero blockers:

| Pass | Gateway | Stage Name | Target & Tooling | Enforcement & Governance |
| :--- | :--- | :--- | :--- | :--- |
| **Pass 0.5** | Pre-Commit | Secret & Boundary Scanner | Regex & AST graph scan across all files | Scans all repository files for private keys, fine-grained PATs, Supabase `service_role` JWTs, webhooks, tracked `.env*` leaks, `.env.example` parity, `5 MB` binary limits, and transitive client$\rightarrow$server AST graph isolation (`0 exposed secrets`). |
| **Pass 0.75** | Pre-Commit | 7-Pillar SAST, OWASP & AST Taint Suite | `npm audit`, `bookarium-security`, SSRF/XSS/RLS/Headers | Audits dependencies, lockfile SHA-512/HTTPS integrity, and GitHub Actions workflows; enforces API rate limiting & mirror allowlist SSRF guards; blocks DOM XSS sinks; sanitizes redirects; verifies MIT & public domain integrity; checks PostgreSQL RLS & idempotency across all 14 tables (`SET search_path = ''`); verifies all 7 OWASP HTTP security headers; and executes the 9-rule `bookarium-security` AST & intra-procedural request-taint engine. |
| **Pass 1** | Compiler | TypeScript Engine Strict Verification | `tsc --noEmit` | Strict type safety across all components, stores, hooks, route handlers, and types (`0 compile errors`, `0 any`). |
| **Pass 2** | Network | MSW Server & React Query Validation | Vitest + MSW v2 | Validates Mock Service Worker v2 network interception, error fallbacks, and TanStack React Query hooks. |
| **Pass 3** | Test Suite | Vitest Unit Suite & Coverage Floor | `vitest run --coverage` | Asserts all `194` unit/integration test suites (`2,058` tests) pass with tiered `95/95/92/85` code coverage (`Lines >= 95%`, `Statements >= 95%`, `Functions >= 92%`, `Branches >= 85%`). |
| **Pass 4** | Living Docs | Living AST Documentation Sync | `docs:sync` toolchain | Programmatically recompiles `docs/ARCHITECTURE.md`, `CHANGELOG.md`, `ROADMAP.md`, `docs/GUTENBERG_PARSER.md`, and `docs/QUALITY_AUDIT_REPORT.md` from AST with zero drift. |
| **Pass 5** | Governance & Parity | ADR, Schema, Graph & Test Co-Location | Markdown/SQL/TS AST verification | Validates contiguous numbering & schema in `docs/DECISIONS.md`, 16-file governance presence, 1:1 `supabase/schema.sql` $\leftrightarrow$ `src/types/database.types.ts` parity, 0 circular/orphan modules, and 100% 1:1 co-located test coverage across all executable files. |
| **Pass 6** | Quality Suite | Code Quality & Dead Code Audit | ESLint 9 (`--max-warnings 0`) & Knip | Zero ESLint warnings/errors (including the 9-rule `bookarium-security` plugin), zero unreferenced dead files/exports, and zero orphan dependencies. |
| **Pass 7** | Production Build | Next.js Production Build & Chunk Budget | `next build --webpack` | Optimized production Next.js bundle compilation within performance chunk budget. |

---

## 🛠️ Node.js CLI & Automation Commands

Bookarium provides a comprehensive suite of Node.js scripts in `scripts/` to automate catalog synchronization, multilingual translation clustering, living architecture compilation, and quality auditing:

| Command | Script File | Architectural Purpose |
| :--- | :--- | :--- |
| `npm run verify` | [`scripts/verify-build.js`](../scripts/verify-build.js) | Full 7-Gateway Closed-Loop Quality Engine verification. |
| `npm run security:audit` | [`scripts/verify-build.js`](../scripts/verify-build.js) `--security-only` | Rapid standalone execution of Pass 0.5 (Secrets & Boundaries), Pass 0.75 (7-Pillar SAST, OWASP & 9-Rule AST Taint Suite), and Pass 5 (ADR, Schema & 1:1 Test Co-Location). |
| `npm run lint` | [`scripts/eslint-rules/bookarium-security.js`](../scripts/eslint-rules/bookarium-security.js) | Executes ESLint 9 (`--max-warnings 0`) including the custom 9-rule `bookarium-security` AST & intra-procedural request-taint plugin. |
| `npm run docs:sync` | Living Docs Toolchain | Programmatically re-compiles `docs/ARCHITECTURE.md`, `CHANGELOG.md`, `ROADMAP.md`, `docs/GUTENBERG_PARSER.md`, and `docs/QUALITY_AUDIT_REPORT.md`. |
| `npm run matrix:generate` | [`scripts/generate-architecture-matrix.js`](../scripts/generate-architecture-matrix.js) | Analyzes Babel AST of all `src/` modules and `scripts/` to compile the living architecture matrix. |
| `npm run changelog:generate` | [`scripts/generate-changelog.js`](../scripts/generate-changelog.js) | Compiles `CHANGELOG.md` and updates the `README.md` Latest Release block. |
| `npm run docs:parser` | [`scripts/generate-parser-docs.js`](../scripts/generate-parser-docs.js) | Analyzes `src/lib/gutenberg-parser.ts` AST to document reflow and segmentation rules. |
| `npm run audit:quality` | [`scripts/generate-quality-report.js`](../scripts/generate-quality-report.js) | Generates `docs/QUALITY_AUDIT_REPORT.md` and `docs/quality-audit-results.json`. |
| `npm run roadmap:generate` | [`scripts/generate-roadmap.js`](../scripts/generate-roadmap.js) | Generates living `ROADMAP.md` verifying features against source AST with 0% drift. |
| `npm run catalog:sync` | [`scripts/sync-gutenberg-catalog.js`](../scripts/sync-gutenberg-catalog.js) | Streams and decompresses `pg_catalog.csv.gz` from Project Gutenberg, syncing 78,000+ volumes into Supabase. |
| `npm run catalog:ingest` | [`scripts/ingest-catalog.js`](../scripts/ingest-catalog.js) | Direct CLI tool for batch ingesting local Gutenberg CSV/JSON metadata dumps into Supabase. |
| `npm run translations:sync` | [`scripts/ingest-translations.js`](../scripts/ingest-translations.js) | Queries Wikidata SPARQL for multilingual FRBR work clusters and populates `public.book_translations`. |
| `npm run adr:new -- "Title"` | [`scripts/new-adr.js`](../scripts/new-adr.js) | Scaffolds a new sequential Architectural Decision Record in `docs/DECISIONS.md`. |
| `npm run gate:approve` | [`scripts/approval-gate.js`](../scripts/approval-gate.js) | Pre-commit mutation gate verifying `.agents/hooks.json` approval tokens. |
| `node scripts/generate-pwa-icons.js` | [`scripts/generate-pwa-icons.js`](../scripts/generate-pwa-icons.js) | Compiles standards-compliant 32-bit RGBA multi-resolution `.ico` and vector squircle PWA icons. |
| `npm run dev:open` | [`scripts/open-browser.js`](../scripts/open-browser.js) | Spawns local development server and automatically opens the browser at `http://localhost:3000`. |

> 📖 **Comprehensive Module Graph**: For complete topological dependency graphs, Node.js package breakdowns, and database entity schemas, see [**`docs/ARCHITECTURE.md`**](ARCHITECTURE.md).

---

## 🚀 CI/CD Workflow

The GitHub Actions CI pipeline in `.github/workflows/ci.yml` runs on every push and pull request against `main`, `master`, and `dev`:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 20
      cache: 'npm'
  - run: npm ci
  - run: npm run lint
  - run: npm run typecheck
  - run: npm run test:coverage
  - run: npm run matrix:generate
  - run: npm run audit:quality
  - run: npm run verify:build
```

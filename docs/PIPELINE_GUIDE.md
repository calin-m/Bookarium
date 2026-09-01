# Pipeline & Quality Governance Guide - Bookarium

This document outlines the automated governance, linting, testing, and release gates configured for Bookarium.

## 7-Gateway Closed-Loop Quality Engine

The core verification workflow is executed via:
```bash
npm run verify
```

| Pass | Gateway | Action |
|---|---|---|
| Pass 0.5 | Secret Scanner | Scans all repository files for private keys, AWS/GCP tokens, or exposed API credentials |
| Pass 1 | TypeScript Engine | Verifies 0 compile errors via `tsc --noEmit` |
| Pass 2 | Vitest Server Mocks | Validates MSW v2 network interception and React Query hooks |
| Pass 3 | Vitest Unit Suite | Asserts all unit/integration tests pass with $\ge$ 80% code coverage |
| Pass 4 | Living Docs Sync | Programmatically recompiles `docs/ARCHITECTURE.md`, `CHANGELOG.md`, and `docs/QUALITY_AUDIT_REPORT.md` from AST |
| Pass 5 | ADR Validation | Validates sequential numbering and schema conformance in `docs/DECISIONS.md` |
| Pass 6 | Quality Suite | Validates 0 ESLint errors and 0 unused dependencies/exports via Knip |
| Pass 7 | Production Build | Compiles Next.js production bundle within performance chunk budget |

## CI Workflow

The CI workflow in `.github/workflows/ci.yml` runs on every push and pull request:
1. `npm ci`
2. `npm run verify`

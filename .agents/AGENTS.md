# Enterprise Master Governance & Agent Operations Protocol - Bookarium

This document establishes immutable engineering rules, governance procedures, and operational guardrails for all human developers and autonomous AI coding agents interacting with this repository.

---

## 1. Core Governance Rules

### Rule 0: Mandatory User Approval & Mutation Protocol
- **Approval-First Execution:** The AI agent must never modify existing files, create new files, perform destructive actions, apply architectural mutations, or install unexpected dependencies without explicit prior user approval and review.
- **Proposal & Review:** The AI agent must propose technical plans, explain trade-offs and diffs clearly, and obtain explicit user consent before proceeding with any code edits.
- **Deterministic Hook Enforcement:** All file mutations (`write_to_file`, `replace_file_content`) are gated by `.agents/hooks.json` and verified prior to release.
- **Human Developer Authority:** The human developer retains final authority over all codebase changes, architectural decisions, and terminal command executions.

### Rule 1: Automated Documentation Synchronization
All architecture diagrams (`docs/ARCHITECTURE.md`), quality reports (`docs/QUALITY_AUDIT_REPORT.md`), and change logs (`CHANGELOG.md`) must be kept in continuous synchronization with the source code.
- **Trigger:** Synchronize docs via `npm run docs:sync` whenever routes, stores, queries, or components are added, modified, or deleted.
- **Enforcement:** `npm run verify` runs Pass 4 to automatically re-compile living documentation from source AST.

### Rule 2: Zero-Bloat & AST-Driven Single Source of Truth
Never manually craft static component matrices, route catalogs, or architectural dependency diagrams that can drift.
- All architectural matrices and component inventories must be generated programmatically by `scripts/lib/ast-parser.js`.
- No mock data or dead prototypes in production code paths.

### Rule 3: Strict Testing, Coverage Co-location & Anti-Regression Accuracy
- **Mandatory Co-Evolution:** Whenever UI copy, component interfaces, DOM hierarchy, state structures, or user flows are modified, the co-located `*.test.ts` or `*.test.tsx` files MUST be updated in the same changeset to reflect the exact new behavioral contract.
- **Zero Synthetic / Fake Tests (Anti-Tautology Protocol):** Tests must assert genuine user journeys, accessible roles (`getByRole`), state mutations, or router actions. Strictly prohibit tautological tests (e.g. `expect(true).toBe(true)`), shallow snapshot-only tests, or meaningless assertions designed solely to inflate coverage numbers.
- **No False Positives (Strict Verification):** Never loosen assertions (e.g. replacing a precise element check with an overly generic query or catch-all wildcard) just to force a failing test to pass. Tests must fail if the feature, label, accessibility contract, or state handler is broken.
- **No False Negatives (Deterministic Isolation):** Ensure component tests use MSW network isolation and `@testing-library/react` without flaky timing or unhandled side-effects.
- **Coverage Floor:** Test coverage must never drop below 80% on lines, functions, statements, or branches (target: >= 85%). Co-location is strictly enforced for every component, hook, store, and route handler.

### Rule 4: Zero API Key Requirement & Public Domain Integrity
- All book metadata and content fetching must strictly enforce `copyright=false` or verify public domain status (Zero-Copyright / CC0 / Gutenberg Public Domain).
- Never require end-user API keys or proprietary authentication for catalog browsing, reading, or downloading.

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
- **Living Documentation Auto-Staging:** Ensure auto-generated files (`docs/ARCHITECTURE.md`, `CHANGELOG.md`, `docs/QUALITY_AUDIT_REPORT.md`, `docs/quality-audit-results.json`) are staged alongside the implementation.

### Rule 6: Verification Engine & Test Execution Protocol (On-Demand & Error-Gated)
- **User-Driven Test & Verification Execution:** The AI agent must only execute the test suite and 7-Gateway Quality Engine (`npm run verify`, `npm test`, or test commands) when explicitly requested by the user (e.g. when the user asks "run verify", "run tests", "verify build") or when actively investigating/debugging an encountered runtime, type, or lint error in code. The agent must not autonomously run full test passes on intermediate turns without cause or request.
- **Pre-Commit Verification:** Before committing changes, pushing branches, or opening pull requests, the full 7-Gateway Quality Engine must pass with zero errors:
  ```bash
  npm run verify
  ```
- **Blocking Guard:** Any failure in passes 0.5 through 7 immediately blocks workflow progression and halts the pre-commit hook.

### Rule 7: Approval-First Architectural Governance (ADRs)
Major architectural modifications, dependency introductions, schema shifts, or design alterations must be proposed via an Architecture Decision Record (ADR) before execution:
```bash
npm run adr:new -- "Your Decision Title"
```
All ADRs in `docs/DECISIONS.md` must adhere to standard schema (Status, Context, Decision, Consequences).

### Rule 8: Repository Hygiene & Secret Prevention Protocol
- **Zero Secrets Policy:** Never commit API keys, RSA/EC private keys, passwords, database URLs with embedded credentials, or `.env` files containing live secrets.
- **Pass 0.5 Scanner:** Scans all codebase files for exposed tokens or keys prior to commit.

### Rule 9: Idempotent Database Schema Co-Evolution & RLS Governance
- **Canonical Schema Co-Evolution:** Any change, addition, or removal of tables, columns, indexes, triggers, or policies in Supabase must be simultaneously documented and synchronized in:
  1. `supabase/schema.sql` (the canonical database schema file).
  2. `src/types/database.types.ts` (TypeScript types representing the database rows, inserts, and updates).
  3. `README.md` (quickstart database setup instructions).
- **Strict Idempotency Requirement:** All DDL and DCL statements in `supabase/schema.sql` and manual migration scripts MUST be strictly idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`, `DROP POLICY IF EXISTS ... CREATE POLICY ...`). Running the schema migration script multiple times must never throw duplicate-key, duplicate-table, or duplicate-policy errors and must never cause destructive data loss.
- **Row-Level Security (RLS) Policy Enforcement:** Every table created in PostgreSQL must explicitly enable Row Level Security (`ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`) and have granular, authenticated-only policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` ensuring users can only read and mutate their own rows (`auth.uid() = user_id`).


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
All architecture diagrams (`ARCHITECTURE.md`), quality reports (`docs/QUALITY_AUDIT_REPORT.md`), and change logs (`CHANGELOG.md`) must be kept in continuous synchronization with the source code.
- **Trigger:** Synchronize docs via `npm run docs:sync` whenever routes, stores, queries, or components are added, modified, or deleted.
- **Enforcement:** `npm run verify` runs Pass 4 to automatically re-compile living documentation from source AST.

### Rule 2: Zero-Bloat & AST-Driven Single Source of Truth
Never manually craft static component matrices, route catalogs, or architectural dependency diagrams that can drift.
- All architectural matrices and component inventories must be generated programmatically by `scripts/lib/ast-parser.js`.
- No mock data or dead prototypes in production code paths.

### Rule 3: Strict Testing & Coverage Co-location
- Every component (`*.tsx`), hook (`*.ts`), store (`*.ts`), and route handler (`route.ts`) must have a co-located `*.test.ts` or `*.test.tsx` file.
- Test coverage must never drop below 80% on lines, functions, statements, or branches (target: >= 85%).
- Component tests must use `@testing-library/react` and MSW network isolation.

### Rule 4: Zero API Key Requirement & Public Domain Integrity
- All book metadata and content fetching must strictly enforce `copyright=false` or verify public domain status (Zero-Copyright / CC0 / Gutenberg Public Domain).
- Never require end-user API keys or proprietary authentication for catalog browsing, reading, or downloading.

### Rule 5: Git Commit & Staging Protocol (Conventional Commits)
When the user asks for commit commands, diff reviews, or release instructions:
1. **Never commit blindly:** Ensure all verification passes succeed via `npm run verify`.
2. **Conventional Commit Standard:** Format commit messages following the standard specification:
   - `feat(reader): ...` for new features
   - `fix(catalog): ...` for bug fixes
   - `refactor(stores): ...` for code structure changes without feature alteration
   - `test(e2e): ...` for test additions or updates
   - `docs(adr): ...` for documentation updates
   - `chore(deps): ...` for dependency or build adjustments
3. **Atomic Staging Commands:** Output clear, copy-pasteable Git commands grouped cleanly:
   ```bash
   git add .
   git commit -m "feat(scope): descriptive summary in imperative mood"
   ```
4. **Living Documentation Auto-Staging:** Ensure auto-generated files (`ARCHITECTURE.md`, `CHANGELOG.md`, `docs/QUALITY_AUDIT_REPORT.md`, `docs/quality-audit-results.json`) are staged alongside the implementation.

### Rule 6: Automated Verification Engine Protocol
Before committing any changes, pushing branches, or opening pull requests, the full 7-Gateway Quality Engine must pass with zero errors:
```bash
npm run verify
```
Any failure in passes 0.5 through 7 immediately blocks workflow progression and halts the pre-commit hook.

### Rule 7: Approval-First Architectural Governance (ADRs)
Major architectural modifications, dependency introductions, schema shifts, or design alterations must be proposed via an Architecture Decision Record (ADR) before execution:
```bash
npm run adr:new -- "Your Decision Title"
```
All ADRs in `docs/DECISIONS.md` must adhere to standard schema (Status, Context, Decision, Consequences).

### Rule 8: Repository Hygiene & Secret Prevention Protocol
- **Zero Secrets Policy:** Never commit API keys, RSA/EC private keys, passwords, database URLs with embedded credentials, or `.env` files containing live secrets.
- **Pass 0.5 Scanner:** Scans all codebase files for exposed tokens or keys prior to commit.

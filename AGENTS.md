# Multi-Agent Development Standards - Bookarium

Welcome to **Bookarium**. When contributing or generating code for this repository, autonomous agents and developers must strictly follow these engineering protocols.

> **Canonical Protocol Specification**: For the complete enterprise governance rules, see [`.agents/AGENTS.md`](file:///.agents/AGENTS.md).

## Core Principles & Boundaries
1. **Rule 0 (User Approval)**: Never modify files, apply architectural shifts, or install dependencies without prior user approval and review.
2. **Public Domain Integrity**: Do not introduce any closed-source, DRM-restricted, or copyright-infringing book sources. Ensure all queries pass `copyright=false`.
3. **Zero API Key Requirement**: The core user experience must work without any third-party paid keys, auth sign-in, or backend database setup.
4. **State Architecture**:
   - Remote data: TanStack React Query (`useBooks`, `useBookContent`).
   - Local persistent state: Zustand (`useBookshelfStore`, `useReaderStore`).
5. **Co-located Testing & Anti-Regression Accuracy**: Every single component (`*.tsx`), hook (`*.ts`), store (`*.ts`), and route handler (`route.ts`) must have an adjacent `*.test.ts` or `*.test.tsx` testing authentic user journeys with `@testing-library/react` and MSW. Zero synthetic/fake tests, no loose assertions, and mandatory co-evolution on every code change.
6. **Coverage Enforcement**: Never allow test coverage to drop below 80% on lines, functions, statements, or branches (target: >= 85%).
7. **Git Protocol (Human Execution Only)**: Provide in-depth structured conventional commit commands (`[PHASE]`, `[WHY]`, `[WHAT]`, `[VERIFICATION]`) only when explicitly requested by the user. AI agents must never execute `git commit` or `git push` directly.
8. **7-Gateway Quality Engine**: Run `npm run verify` only when explicitly requested by the user or when actively investigating/debugging an encountered error in code to guarantee zero errors across all passes.
9. **Rule 9 (Idempotent Database Schema Co-Evolution & RLS Governance)**: All database modifications must co-evolve `supabase/schema.sql`, `src/types/database.types.ts`, and `README.md` using strictly idempotent SQL (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`) with strict Row Level Security enabled for user isolation.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

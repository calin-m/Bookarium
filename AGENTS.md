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
5. **Co-located Testing**: Every single component (`*.tsx`), hook (`*.ts`), store (`*.ts`), and route handler (`route.ts`) must have an adjacent `*.test.ts` or `*.test.tsx` testing its behavior with `@testing-library/react` and MSW.
6. **Coverage Enforcement**: Never allow test coverage to drop below 80% on lines, functions, statements, or branches.
7. **Git Commit Protocol**: Always provide conventional commit commands (`feat:`, `fix:`, etc.) and ensure living docs (`ARCHITECTURE.md`, `CHANGELOG.md`, `docs/QUALITY_AUDIT_REPORT.md`) are synced.
8. **7-Gateway Quality Engine**: Run `npm run verify` prior to commits to guarantee zero errors across all passes.

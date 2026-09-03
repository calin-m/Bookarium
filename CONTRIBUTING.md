# Contributing to Bookarium

Thank you for your interest in contributing to **Bookarium**! We welcome bug reports, UX enhancements, accessibility refinements, documentation improvements, and architectural contributions from developers worldwide.

Bookarium is built on three immutable engineering tenets:
1. **Public Domain Integrity**: 100% legal, open public domain literature (CC0 / Zero-Copyright / Project Gutenberg). All API queries strictly enforce `copyright=false`.
2. **Zero Paid Keys Requirement**: The complete user experience operates without third-party paid keys, credit cards, or mandatory account creation.
3. **Rigorous Quality Engine**: Zero regressions, 100% co-located testing with $\ge 80\%$ test coverage, and automated AST-driven documentation synchronization.

---

## Code of Conduct

All participants, contributors, and maintainers are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md) (Contributor Covenant v2.1).

---

## Security & Vulnerability Disclosure

If you discover a potential security vulnerability or sensitive data leak, please do **not** open a public issue. Follow our [Security Policy](SECURITY.md) to report it confidentially via GitHub's Private Vulnerability Advisories.

---

## Architecture at a Glance

Before opening a PR, familiarize yourself with Bookarium's state and rendering paradigms:

- **Framework**: Next.js 16 (App Router, Turbopack, standalone serverless output).
- **Remote Data Fetching**: TanStack React Query (`useBooks`, `useBookContent`, `useTranslations`).
- **Local-First State Management**: Zustand (`useBookshelfStore`, `useReaderStore`, `useAnnotationStore`, `useThemeStore`).
- **Background Threading**: Web Workers (`src/workers/gutenberg.worker.ts`, `useGutenbergParserWorker.ts`) offloading chapter regex splitting and pagination spread math.
- **Offline Persistence**: Dual-layer browser storage (localStorage for positions/preferences; IndexedDB for multi-megabyte unabridged book volumes) backed by an App Shell Service Worker (`public/sw.js`).
- **Styling**: Tailwind CSS with hardware-accelerated Framer Motion transitions.

---

## Local Development Setup

### 1. Prerequisites
- **Node.js**: `20.x` or higher (Node 20 LTS or Node 22 LTS recommended)
- **npm**: `10.x` or higher
- **Git**: Installed and configured

### 2. Fork & Clone
```bash
git clone https://github.com/calin-m/Bookarium.git
cd Bookarium
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. The application runs immediately without requiring any environment variables or backend databases.

---

## Testing & Verification Protocols

Bookarium enforces a **7-Gateway Quality Engine** that must pass with zero defects prior to merging:

### Daily Development Commands:
```bash
# Run unit and integration tests with coverage
npm test

# Run tests in watch mode during development
npm run test:watch

# Fast test run without coverage
npm run test:fast

# Static TypeScript type check
npm run typecheck

# ESLint analysis
npm run lint

# Synchronize AST documentation
npm run docs:sync
```

### Full Pre-Commit Verification:
```bash
npm run verify
```
This runs all 7 automated quality gateways:
1. **Pass 0.5**: Secret Prevention Scanner
2. **Pass 1**: TypeScript Strict Typecheck (`tsc --noEmit`)
3. **Pass 2**: ESLint Static Analysis (`eslint .`)
4. **Pass 3**: Vitest Coverage Suite ($\ge 80\%$ coverage floor)
5. **Pass 4**: Living Documentation AST Re-Compilation
6. **Pass 5**: ADR Decision Ledger Validation
7. **Pass 6**: Knip Dead Code & Orphan Dependency Audit
8. **Pass 7**: Next.js Production Build Verification

---

## Commit & Branching Conventions

Bookarium follows the **Conventional Commits** specification. Commits should be structured with distinct informational flags:

```bash
git commit \
  -m "feat(reader): concise imperative summary" \
  -m "[PHASE]: Implementation milestone or phase" \
  -m "[WHY]: Architectural justification and problem context" \
  -m "[WHAT]: Bulleted list of modified modules and components" \
  -m "[VERIFICATION]: Test results and 7-Gateway verification status"
```

### Branch Naming:
- `feat/feature-name` (e.g. `feat/epub-export-engine`)
- `fix/issue-description` (e.g. `fix/worker-stale-hash`)
- `docs/update-topic` (e.g. `docs/pipeline-guide`)

Target all pull requests to the **`master`** branch.

---

## Pull Request Guidelines

1. Ensure every new or modified component (`*.tsx`), hook (`*.ts`), or store (`*.ts`) includes an adjacent, co-located test (`*.test.tsx` or `*.test.ts`).
2. Adhere to the **Anti-Tautology Protocol**: assert genuine DOM interactions and user flows; never write synthetic tests solely to inflate coverage.
3. Keep test coverage above **80%** (target: $\ge 85\%$).
4. Run `npm run verify` locally before opening your PR.
5. Fill out the [Pull Request Template](.github/pull_request_template.md) completely.


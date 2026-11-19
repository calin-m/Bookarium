# Contributing to Bookarium

Thank you for your interest in contributing to **Bookarium**! We welcome bug reports, UX enhancements, accessibility refinements, documentation improvements, and architectural contributions from developers worldwide.

Bookarium is built on three immutable engineering tenets:
1. **Public Domain Integrity**: 100% legal, open public domain literature (CC0 / Zero-Copyright / Project Gutenberg). All API queries strictly enforce `copyright=false`.
2. **Zero Paid Keys for End Users**: Readers browse, read, and listen without third-party paid API keys, subscriptions, or mandatory account creation *(production self-hosting requires configuring Supabase + private Cloudflare R2 storage; local tests and offline UI previews run without external secrets)*.
3. **Rigorous Quality Engine**: Zero regressions, 100% 1:1 co-located testing with tiered `95/95/92/85` test coverage (`Lines >= 95%`, `Statements >= 95%`, `Functions >= 92%`, `Branches >= 85%`), and automated AST-driven documentation synchronization.

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
- **Remote Data Fetching**: TanStack React Query (`useBooks`, `useFeaturedQuotes`, `useQuoteEnrichedBooks`, `useBookContent`, `useBookTranslations`).
- **Local-First State Management**: 10 Zustand stores (`useBookshelfStore`, `useReaderStore`, `useAuthStore`, `useFellowshipStore`, `useAnnotationStore`, `useAccoladesStore`, `useHabitsStore`, `useJurisdictionStore`, `usePreferencesStore`, `useThemeStore`).
- **Background Threading**: Web Workers (`src/workers/gutenberg.worker.ts`, `useGutenbergParserWorker.ts`) offloading chapter regex splitting and pagination spread math.
- **Self-Hosted Asset Proxy**: Same-origin `/api/books/content` route streaming pre-seeded cover artwork (`covers/<id>.jpg`) and gzipped plain text (`books/<id>.txt.gz`) strictly from private **Cloudflare R2** storage via AWS SigV4 (`src/lib/r2-client.ts`, alongside optional Supabase `public.books.content`), failing closed (`404`/`503`) with zero runtime Project Gutenberg fallback or browser cover hotlinking.
- **Offline Persistence**: Dual-layer browser storage (localStorage for positions/preferences; IndexedDB for multi-megabyte unabridged book volumes and cover caches) backed by an App Shell Service Worker (`public/sw.js`).
- **Styling**: Tailwind CSS v4 (Oxide) with hardware-accelerated Framer Motion transitions.

---

## Local Development Setup

### 1. Prerequisites
- **Node.js**: `22.x` or higher (Node 22 LTS or Node 24 LTS recommended)
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
Open [http://localhost:3000](http://localhost:3000) in your browser. Local curated catalog previews, offline IndexedDB reading, and all unit/integration tests work immediately without external secrets *(full 78,000+ online catalog queries and R2 cover/text streaming require configuring Supabase and Cloudflare R2 credentials in `.env.local`)*.

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

# Standalone OWASP SAST & dependency security sweep
npm run security:audit

# Synchronize AST documentation
npm run docs:sync
```

### Full Pre-Commit Verification:
```bash
npm run verify
```
This runs all automated quality gateways:
1. **Pass 0.5**: Secret, Boundary, Tracked `.env*`, `.env.example` Parity & Transitive AST Graph Scanner
2. **Pass 0.75**: 7-Pillar SAST & OWASP Security Suite (Dependency CVEs, Lockfile SRI, Offline `GPL`/`AGPL` Copyleft Ban, Workflow Guard, Rate Limiting & Mirror SSRF, DOM XSS, Open Redirects, Public Domain Policy, PostgreSQL Idempotent RLS, `search_path` & Account Deletion Parity, OWASP HTTP Headers, `scripts/lib/sast-validators.js` AST Validators, and 9-Rule `bookarium-security` AST & Request-Taint Engine across `src/`, `scripts/`, `public/sw.js`, & `next.config.ts`)
3. **Pass 1**: TypeScript Strict Typecheck (`tsc --noEmit`)
4. **Pass 2 & 3**: Vitest MSW & UI Test Suites (`95/95/92/85` tiered coverage floor across `264` suites)
5. **Pass 4**: Living Documentation AST Re-Compilation (`npm run docs:sync`, including `SECURITY.md` `<!-- BEGIN:security-architecture -->`)
6. **Pass 5**: ADR Decision Ledger, 19-File Governance, Circular `SECURITY.md` Parity, 1:1 SQL$\leftrightarrow$TS Schema Parity, 0 Circular/Parse-Error/Layer-Violation/Orphan Modules & 100% 1:1 Co-Located Test Parity
7. **Pass 6**: ESLint (`--max-warnings 0`) & Knip Quality Audit
8. **Pass 7**: Next.js Production Build Verification, Compiled `.next/routes-manifest.json` Security Header Parity & Live `127.0.0.1` `next start` HTTP/Redirect Smoke Probe

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

1. Ensure every new or modified component (`*.tsx`), hook (`*.ts`), store (`*.ts`), route (`route.ts`), utility (`src/lib/**`), config (`src/config/**`), or worker (`src/workers/**`) includes an adjacent, 1:1 co-located test (`*.test.tsx` or `*.test.ts`).
2. Adhere to the **Anti-Tautology Protocol**: assert genuine DOM interactions and user flows; never write synthetic tests solely to inflate coverage.
3. Keep test coverage at or above the tiered thresholds (**Lines $\ge 95\%$**, **Statements $\ge 95\%$**, **Functions $\ge 92\%$**, **Branches $\ge 85\%$**).
4. Run `npm run verify` locally before opening your PR (all pull requests automatically execute `npm run verify:build` via [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — see [**`docs/GITHUB_ACTIONS.md`**](docs/GITHUB_ACTIONS.md#35-bookarium-ci-githubworkflowsciyml)).
5. Fill out the [Pull Request Template](.github/pull_request_template.md) completely.


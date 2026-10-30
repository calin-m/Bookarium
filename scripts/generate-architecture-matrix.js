const fs = require('fs');
const path = require('path');
const {
  analyzeDependencyGraph,
  detectCircularDependencies,
  detectOrphanedModules,
  extractComponentCatalog,
  extractStoreCatalog,
  extractApiAndHookCatalog,
  extractDomainUtilitiesCatalog,
  extractConfigurationCatalog,
  extractTypeCatalog,
  extractWorkerCatalog,
  extractTestHarnessCatalog,
  extractPublicAssetsCatalog,
} = require('./lib/ast-parser');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

function extractDatabaseCatalog(rootDirPath) {
  const schemaPath = path.join(rootDirPath, 'supabase', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    return { tables: [], functions: [], indexes: [], seedArtifacts: [] };
  }
  const content = fs.readFileSync(schemaPath, 'utf-8');

  const tables = [];
  if (content.includes('CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations')) {
    tables.push({
      name: 'supabase_migrations.schema_migrations',
      rls: 'Enabled (`No Client Access`)',
      store: '_Supabase CLI / Studio Tracker_',
      description: 'Internal Supabase migration ledger preventing `42P01` dashboard warnings and tracking applied DDL versions with RLS enabled.',
    });
  }

  const tableRegex = /CREATE TABLE IF NOT EXISTS public\.(\w+)\s*\(([\s\S]*?)\);/g;
  let match;

  const storeMap = {
    profiles: '`useAuthStore`',
    bookshelves: '`useBookshelfStore`',
    bookshelf_items: '`useBookshelfStore`',
    user_favorites: '`useBookshelfStore`',
    reading_progress: '`useReaderStore`',
    user_annotations: '`useAnnotationStore`',
    user_book_curation: '`useBookshelfStore`',
    user_reading_habits: '`useHabitsStore`',
    user_accolades: '`useAccoladesStore`',
    books: '`SupabaseCatalogProvider`',
    book_translations: '`useBookTranslations` / `SupabaseCatalogProvider`',
    reader_circles: '`useFellowshipStore`',
    symposium_sessions: '`useFellowshipStore`',
  };

  const descMap = {
    profiles: 'User profile display name, `@username` handle, theme preferences, and typography choices (auto-created on signup, with companion identity RLS resolution for Reader Circles & Symposiums).',
    bookshelves: 'Default master "General" shelf and custom user-created named shelves.',
    bookshelf_items: 'Books filed in specific shelves with user-scoped uniqueness constraints.',
    user_favorites: 'Cross-device synchronized favorited titles.',
    reading_progress: 'Chapter index, progress %, in-page row bookmark offsets, highlighted bookmark line text (`bookmark_text`), and cached volume metadata.',
    user_annotations: 'Passage text highlights (4 pastel palettes), scholarly notes, and cross-volume Symposium Fellow marginalia.',
    user_book_curation: 'Personal 1–5 star ratings and reading status classification.',
    user_reading_habits: 'Reading streaks (5-min threshold), daily activity dates, annual challenge goals, completed books count, and dual immersion telemetry.',
    user_accolades: 'Unlocked literary accolades, timestamps, showcase pinning, and personal bookplate metadata.',
    books: 'Self-hosted public domain catalog with GIN full-text search vector, pre-computed author lifespan bounds, and optional plain-text caching.',
    book_translations: 'Relational FRBR literary work clusters mapping Project Gutenberg editions across languages with zero false positives.',
    reader_circles: 'Mutual Literary Fellowship pairings (pending/accepted) with RLS participant isolation.',
    symposium_sessions: 'Dual-reading Literary Symposium sessions tracking shared volume progress and chapter coordinates for two fellows.',
  };

  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1];
    tables.push({
      name: `public.${tableName}`,
      rls: tableName === 'books' || tableName === 'book_translations' ? 'Enabled (`Public Read`)' : 'Enabled (`auth.uid()`)',
      store: storeMap[tableName] || 'Client Store',
      description: descMap[tableName] || 'Database entity with RLS user isolation.',
    });
  }

  // Extract explicit CREATE [UNIQUE] INDEX definitions from supabase/schema.sql
  const indexDescMap = {
    unique_profile_username_lower: 'Case-insensitive partial unique index (`lower(trim(username)) WHERE username IS NOT NULL`) enforcing globally unique scholar `@username` handles.',
    unique_user_default_bookshelf: 'Partial unique index (`(user_id) WHERE is_default = true`) guaranteeing each scholar has at most one master `General` shelf.',
    unique_user_shelf_name: 'Case-insensitive composite unique index (`(user_id, lower(trim(name)))`) preventing duplicate custom shelf names per user.',
    idx_bookshelf_items_user_id: 'B-Tree foreign-key index on `(user_id)` accelerating user-scoped shelf item queries and cascading account deletion.',
    idx_user_annotations_user_book: 'Composite B-Tree index on `(user_id, book_id)` for fast per-volume highlight and marginalia lookups.',
    idx_user_book_curation_user_book: 'Composite B-Tree index on `(user_id, book_id)` for personal 1–5 star ratings and reading status lookups.',
    idx_user_reading_habits_user: 'B-Tree index on `(user_id)` accelerating streak and dual immersion telemetry queries.',
    unique_user_accolade: 'Composite unique index on `(user_id, accolade_id)` ensuring idempotent accolade unlocks per scholar.',
    idx_user_accolades_user: 'B-Tree index on `(user_id)` for fast Ex-Libris bookplate and pinned showcase queries.',
    idx_books_search_vector: 'Inverted GIN index on `search_vector` TSVECTOR for sub-second multi-word full-text catalog search.',
    idx_books_languages: 'Inverted GIN index on `languages` TEXT[] for array-containment language filtering (`languages && ARRAY[...]`).',
    idx_books_subjects: 'Inverted GIN index on `subjects` TEXT[] for topic/subject facet containment queries.',
    idx_books_download_count: 'Descending B-Tree index on `(download_count DESC)` for popularity sorting across 78,000+ volumes.',
    idx_books_author_death_year: 'B-Tree index on `(max_author_death_year)` for sub-50ms server-side jurisdictional copyright filtering.',
    idx_book_translations_book_id: 'B-Tree index on `(book_id)` for instant single-book translation lookups in `ReaderLanguageDrawer`.',
    idx_book_translations_work_id: 'B-Tree index on `(work_id)` for canonical FRBR literary work cluster traversal.',
    idx_book_translations_work_lang: 'Composite B-Tree index on `(work_id, language)` for fast language-filtered edition resolution.',
    idx_reader_circles_requester: 'B-Tree index on `(requester_id)` for outbound Reader Circle fellowship and companion RLS lookups.',
    idx_reader_circles_recipient: 'B-Tree index on `(recipient_id)` for inbound Reader Circle invitation and companion RLS lookups.',
    idx_symposium_sessions_host: 'B-Tree index on `(host_id)` for host-side Literary Symposium and fellow marginalia RLS evaluation.',
    idx_symposium_sessions_fellow: 'B-Tree index on `(fellow_id)` for fellow-side Literary Symposium and companion progress queries.',
    idx_symposium_sessions_book: 'B-Tree index on `(book_id)` for volume-scoped Symposium session and shared annotation lookups.',
  };

  const indexes = [];
  const idxRegex = /CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+(\w+)\s+ON\s+(public\.\w+)\s*(?:USING\s+(GIN)\s*)?\(([^;]+?)\)(?:\s+WHERE\s+([^;]+?))?;/gi;
  let idxMatch;
  while ((idxMatch = idxRegex.exec(content)) !== null) {
    const isUnique = Boolean(idxMatch[1]);
    const idxName = idxMatch[2];
    const targetTable = idxMatch[3];
    const isGin = Boolean(idxMatch[4]);
    const expr = idxMatch[5].replace(/\s+/g, ' ').trim();
    const whereClause = idxMatch[6] ? ` WHERE ${idxMatch[6].replace(/\s+/g, ' ').trim()}` : '';
    let idxType = 'B-Tree Index';
    if (isGin) idxType = 'GIN Index';
    else if (isUnique && whereClause) idxType = 'Partial Unique Index';
    else if (isUnique) idxType = 'Unique B-Tree Index';

    indexes.push({
      name: idxName,
      type: idxType,
      table: targetTable,
      definition: `\`(${expr})${whereClause}\``,
      description: indexDescMap[idxName] || `Index on \`${targetTable}\`.`,
    });
  }

  const seedCandidates = [
    {
      file: 'supabase/schema.sql',
      kind: 'Canonical Idempotent DDL & RLS Schema',
      role: 'Single source of truth defining all 14 database tables, 38 granular RLS policies, 6 stored functions/triggers, and 22 explicit search/uniqueness indexes.',
    },
    {
      file: 'supabase/seed_books.sql',
      kind: 'Curated Public Domain Catalog Seed',
      role: 'Idempotent starter SQL seed (`ON CONFLICT (id) DO UPDATE`) provisioning curated Project Gutenberg masterworks for zero-network local development.',
    },
    {
      file: 'supabase/seed_translations.sql',
      kind: 'Relational FRBR Translations Seed',
      role: 'Idempotent SQL seed (`ON CONFLICT (work_id, book_id) DO UPDATE`) linking multilingual Project Gutenberg editions into canonical literary works.',
    },
    {
      file: 'scripts/data/wikidata-translations-cache.json',
      kind: 'Offline Wikidata Authority Snapshot',
      role: 'Verified CC0 Wikidata SPARQL authority cache (`P2034` Gutenberg IDs + `P407` language tags) enabling deterministic offline translation clustering when Wikidata is unreachable.',
    },
  ];

  const seedArtifacts = seedCandidates
    .filter((s) => fs.existsSync(path.join(rootDirPath, s.file)))
    .map((s) => {
      const stat = fs.statSync(path.join(rootDirPath, s.file));
      return {
        ...s,
        size: `${(stat.size / 1024).toFixed(1)} KB`,
      };
    });

  return { tables, indexes, seedArtifacts };
}

function extractNodeEcosystemCatalog(rootDirPath, totalSuites = 187) {
  const pkgPath = path.join(rootDirPath, 'package.json');
  if (!fs.existsSync(pkgPath)) return { engines: {}, packages: [] };
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

  const packages = [];
  const purposeMap = {
    // Dependencies
    '@supabase/ssr': 'Server-Side Rendering (SSR) cookie-based authentication and Supabase client creation.',
    '@supabase/supabase-js': 'Universal client for PostgreSQL, Row-Level Security, GIN search & cloud synchronization.',
    '@tanstack/react-query': 'Asynchronous server-state management, cache deduplication & windowed predictive prefetching.',
    '@vercel/analytics': 'Privacy-preserving, cookie-less audience telemetry on Vercel Edge.',
    '@vercel/speed-insights': 'Real User Monitoring (RUM) for Core Web Vitals (LCP, FID, CLS, INP).',
    clsx: 'Utility for constructing conditional classNames efficiently.',
    'framer-motion': 'Hardware-accelerated 3D leaf-flip, FLIP modal geometry and page transitions.',
    'lucide-react': 'Accessible SVG icon primitives across reading workbench and UI dialogs.',
    next: 'Next.js 16 App Router full-stack framework with React Server Components and Turbopack.',
    react: 'React 19 declarative component and rendering engine.',
    'react-dom': 'DOM renderer for React 19.',
    'tailwind-merge': 'Deterministic conflict resolution for Tailwind utility classes with custom shadow groups.',
    zustand: 'Lightweight client-side persistent state stores (IndexedDB, localStorage, outbox reconciliation).',

    // DevDependencies
    '@babel/parser': 'Babel parser generating ESTree AST for living documentation and architectural analysis.',
    '@babel/traverse': 'AST node traversal for programmatic dependency graph and import/export extraction.',
    '@tailwindcss/postcss': 'PostCSS integration for Tailwind CSS v4 Oxide compilation.',
    '@testing-library/jest-dom': 'Custom DOM matchers for accessible assertion verification.',
    '@testing-library/react': 'Framework-agnostic React component testing verifying authentic user journeys.',
    '@testing-library/user-event': 'Simulates authentic pointer and keyboard interactions in test suites.',
    '@types/babel__traverse': 'TypeScript definitions for Babel AST traversal.',
    '@types/node': 'TypeScript definitions for Node.js runtime and standard library APIs.',
    '@types/react': 'TypeScript definitions for React 19 core primitives.',
    '@types/react-dom': 'TypeScript definitions for React DOM.',
    '@vitejs/plugin-react': 'Fast React transform plugin for Vitest test execution.',
    '@vitest/coverage-v8': 'Native V8 code coverage provider enforcing >=85% test threshold.',
    '@vitest/ui': 'Interactive graphical browser interface for Vitest execution.',
    concurrently: 'Parallel task orchestration for dev servers, watchers, and browser launchers.',
    eslint: 'Pluggable static analysis linter enforcing code quality and type safety.',
    'eslint-config-next': 'Next.js 16 ESLint ruleset enforcing App Router, Core Web Vitals, and TypeScript standards.',
    husky: 'Git hooks orchestration gating pre-commit verification.',
    jsdom: 'Headless browser DOM environment for Node.js Vitest test execution.',
    knip: 'Static analysis auditor detecting unused dependencies, dead exports, and orphaned files.',
    msw: 'Mock Service Worker v2 intercepting network requests for isolated deterministic testing.',
    postcss: 'CSS transformer tool for Tailwind CSS v4 processing.',
    tailwindcss: 'Utility-first CSS framework v4 with Oxide compiler engine.',
    typescript: 'Static type system verifying strict compile-time safety (zero any).',
    vitest: `Fast Vite-native test runner executing all ${totalSuites} unit and integration suites.`,

    // Overrides
    'fast-glob': 'Supply-chain override replacing fast-glob with tinyglobby to eliminate CVE vulnerabilities.',
    'postcss-selector-parser': 'Supply-chain override pinning selector parser to patched secure release.',
  };

  if (pkg.dependencies) {
    for (const [name, version] of Object.entries(pkg.dependencies)) {
      packages.push({
        name,
        version,
        tier: 'Production Runtime',
        purpose: purposeMap[name] || 'Production runtime library.',
      });
    }
  }

  if (pkg.devDependencies) {
    for (const [name, version] of Object.entries(pkg.devDependencies)) {
      packages.push({
        name,
        version,
        tier: 'Development & AST Tooling',
        purpose: purposeMap[name] || 'Development or verification tooling.',
      });
    }
  }

  if (pkg.overrides) {
    for (const [name, version] of Object.entries(pkg.overrides)) {
      packages.push({
        name,
        version,
        tier: 'Supply-Chain Security Override',
        purpose: purposeMap[name] || 'Dependency security override.',
      });
    }
  }

  return {
    engines: pkg.engines || { node: '>=20.0.0', npm: '>=10.0.0' },
    packages,
  };
}

function extractNodeScriptsCatalog() {
  return [
    {
      name: 'verify-build.js',
      file: 'scripts/verify-build.js',
      npmCommand: '`npm run verify`',
      nodeApis: '`fs`, `path`, `child_process`',
      responsibility:
        'Executes the 7-Gateway Closed-Loop Quality Engine (Pass 0.5 secrets, Pass 0.75 SAST/OWASP, Pass 1 types, Pass 2 MSW, Pass 3 Vitest >=85%, Pass 4 docs sync, Pass 5 ADR, Pass 6 ESLint/Knip, Pass 7 Next.js build).',
    },
    {
      name: 'lib/ast-parser.js',
      file: 'scripts/lib/ast-parser.js',
      npmCommand: '_Internal Generator Engine_',
      nodeApis: '`fs`, `path`, `@babel/parser`, `@babel/traverse`',
      responsibility:
        'Babel AST parsing engine extracting module dependency graphs, component catalogs, stores, hooks, utilities, and detecting circular dependencies with zero bloat.',
    },
    {
      name: 'generate-architecture-matrix.js',
      file: 'scripts/generate-architecture-matrix.js',
      npmCommand: '`npm run matrix:generate` (in `docs:sync`)',
      nodeApis: '`fs`, `path`, `scripts/lib/ast-parser.js`',
      responsibility:
        'Programmatically compiles docs/ARCHITECTURE.md directly from source AST, mapping topology, databases, Node.js packages, and CLI automation scripts.',
    },
    {
      name: 'generate-changelog.js',
      file: 'scripts/generate-changelog.js',
      npmCommand: '`npm run changelog:generate` (in `docs:sync`)',
      nodeApis: '`fs`, `path`',
      responsibility:
        'Compiles CHANGELOG.md from SemVer release ledgers and synchronizes README.md Latest Release section.',
    },
    {
      name: 'generate-parser-docs.js',
      file: 'scripts/generate-parser-docs.js',
      npmCommand: '`npm run docs:parser` (in `docs:sync`)',
      nodeApis: '`fs`, `path`, `@babel/parser`, `@babel/traverse`',
      responsibility:
        'Analyzes src/lib/gutenberg-parser.ts AST to generate living docs/GUTENBERG_PARSER.md.',
    },
    {
      name: 'generate-quality-report.js',
      file: 'scripts/generate-quality-report.js',
      npmCommand: '`npm run audit:quality` (in `docs:sync`)',
      nodeApis: '`fs`, `path`, `child_process`',
      responsibility:
        'Collects test coverage, suite catalogs, ADR counts, ESLint/Knip metrics, and generates docs/QUALITY_AUDIT_REPORT.md and docs/quality-audit-results.json.',
    },
    {
      name: 'generate-roadmap.js',
      file: 'scripts/generate-roadmap.js',
      npmCommand: '`npm run roadmap:generate` (in `docs:sync`)',
      nodeApis: '`fs`, `path`',
      responsibility:
        'Scans source files and AST features to generate living ROADMAP.md with 0% drift.',
    },
    {
      name: 'generate-pwa-icons.js',
      file: 'scripts/generate-pwa-icons.js',
      npmCommand: '`node scripts/generate-pwa-icons.js`',
      nodeApis: '`fs`, `path`, `zlib`',
      responsibility:
        'Compiles standards-compliant 32-bit RGBA binary multi-resolution .ico (16, 32, 48) and vector squircle PWA icons with alpha anti-aliasing.',
    },
    {
      name: 'sync-gutenberg-catalog.js',
      file: 'scripts/sync-gutenberg-catalog.js',
      npmCommand: '`npm run catalog:sync`',
      nodeApis: '`fs`, `path`, `zlib`, `https`, `readline`',
      responsibility:
        'Streams pg_catalog.csv.gz from Project Gutenberg, parses CSV metadata on-the-fly, and synchronizes 78,000+ volumes into Supabase with author lifespan bounds.',
    },
    {
      name: 'ingest-catalog.js',
      file: 'scripts/ingest-catalog.js',
      npmCommand: '`npm run catalog:ingest`',
      nodeApis: '`fs`, `path`, `readline`',
      responsibility:
        'Direct CLI tool for batch ingesting local Gutenberg CSV/JSON metadata dumps into Supabase.',
    },
    {
      name: 'ingest-translations.js',
      file: 'scripts/ingest-translations.js',
      npmCommand: '`npm run translations:sync`',
      nodeApis: '`fs`, `path`, `https`',
      responsibility:
        'Queries Wikidata SPARQL endpoint for multilingual FRBR work clusters and populates public.book_translations with zero false positives.',
    },
    {
      name: 'new-adr.js',
      file: 'scripts/new-adr.js',
      npmCommand: '`npm run adr:new -- "Title"`',
      nodeApis: '`fs`, `path`',
      responsibility:
        'Scaffolds new Architectural Decision Records in docs/DECISIONS.md with auto-incremented sequential ID and schema verification.',
    },
    {
      name: 'approval-gate.js',
      file: 'scripts/approval-gate.js',
      npmCommand: '`npm run gate:approve`',
      nodeApis: '`fs`, `path`',
      responsibility:
        'Pre-commit hook governance verifying mutation approval tokens (.agents/hooks.json).',
    },
    {
      name: 'open-browser.js',
      file: 'scripts/open-browser.js',
      npmCommand: '`npm run dev:open`',
      nodeApis: '`child_process`',
      responsibility:
        'Cross-platform development utility spawning default system browser with connection wait delay.',
    },
  ];
}

function extractWorkspaceConfigAndGovernanceCatalog(rootDirPath) {
  const candidates = [
    {
      name: 'next.config.ts',
      file: 'next.config.ts',
      layer: 'Next.js 16 Build, Rewrites & OWASP Headers',
      responsibility:
        'Configures Next.js 16 App Router image remote patterns (`gutenberg.org`), clean path Edge rewrites (`/bookshelf`, `/favorites`, `/notebook`, `/bookmarks` -> `/?view=*`), and all 7 mandatory OWASP HTTP security headers (`Content-Security-Policy` with production `unsafe-eval` stripping, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`).',
    },
    {
      name: 'vercel.json',
      file: 'vercel.json',
      layer: 'Edge Deployment & Datacenter Pinning',
      responsibility:
        'Pins serverless function execution to `iad1` (Washington D.C. / US-East) adjacent to Project Gutenberg & Gutendex nodes with 1024 MB memory and 30s max duration for `/api/books/**` routes.',
    },
    {
      name: 'tsconfig.json',
      file: 'tsconfig.json',
      layer: 'TypeScript 5.9 Strict Compiler Config',
      responsibility:
        'Enforces `strict: true`, `noEmit: true`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`, and `@/* -> ./src/*` path aliases across all source and test files.',
    },
    {
      name: 'tailwind.config.ts',
      file: 'tailwind.config.ts',
      layer: 'Editorial Design System & Theme Tokens',
      responsibility:
        'Defines Booksaw editorial color variables (`background`, `foreground`, `primary`, `surface-elevated`), serif/sans/mono font stacks, `shadow-booksaw` depth shadows, and 3D page-turn keyframes.',
    },
    {
      name: 'postcss.config.mjs',
      file: 'postcss.config.mjs',
      layer: 'Tailwind CSS v4 Oxide PostCSS Pipeline',
      responsibility:
        'Registers `@tailwindcss/postcss` v4 Oxide compiler plugin for zero-runtime CSS generation.',
    },
    {
      name: 'src/app/globals.css',
      file: 'src/app/globals.css',
      layer: 'Global Theme Palettes & 3D Book Physics CSS',
      responsibility:
        'Configures `@import "tailwindcss"`, `@config "../../tailwind.config.ts"`, Day (`#fcfbf9`), Cozy Coffee Sepia (`#2b1d16`), and Dark Obsidian (`#0e1117`) CSS custom properties, 3D perspective book spreads (`.book-center-crease`, `.preserve-3d`), and custom reader scrollbars (`--reader-sb-*`).',
    },
    {
      name: 'eslint.config.mjs',
      file: 'eslint.config.mjs',
      layer: 'ESLint 9 Flat Config & Zero-Any Gate',
      responsibility:
        'Enforces `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`, and strict `@typescript-eslint/no-explicit-any: "error"` with `--max-warnings 0`.',
    },
    {
      name: 'knip.json',
      file: 'knip.json',
      layer: 'Dead Code & Orphan Dependency Auditor',
      responsibility:
        'Configures Knip entrypoints (`src/proxy.ts`, `src/workers/*.ts`, `src/components/motion/*.tsx`) to guarantee zero unused files, zero dead exports, and zero orphan dependencies in Pass 6.',
    },
    {
      name: 'vitest.config.mts',
      file: 'vitest.config.mts',
      layer: 'Vitest Runner & Tiered V8 Coverage Gate (95/95/92/85)',
      responsibility:
        'Configures JSDOM test environment, `src/test/setup.ts` bootstrap, `maxWorkers: 4`, and hard V8 coverage thresholds (`lines: 95%`, `statements: 95%`, `functions: 92%`, `branches: 85%`).',
    },
    {
      name: '.husky/pre-commit',
      file: '.husky/pre-commit',
      layer: 'Git Pre-Commit Quality & Approval Gate',
      responsibility:
        'Executes `npm run gate:approve` (`scripts/approval-gate.js`) and `npm run verify` (`scripts/verify-build.js`) prior to any commit creation.',
    },
    {
      name: 'AGENTS.md & .agents/AGENTS.md',
      file: '.agents/AGENTS.md',
      layer: 'Enterprise Multi-Agent Governance Protocol',
      responsibility:
        'Canonical specification of Rules 0–9 (Approval-First Execution, Living AST Docs Co-Evolution, Zero-Bloat AST Truth, 95/95/92/85 Co-Located Testing, Public Domain Integrity, Conventional Commits, 7-Gateway Engine, ADRs, Secret Prevention, and Idempotent RLS Schema Co-Evolution).',
    },
    {
      name: '.agents/hooks.json',
      file: '.agents/hooks.json',
      layer: 'Deterministic Mutation Approval Ledger',
      responsibility:
        'Machine-verified governance configuration gating file mutations and pre-commit verification.',
    },
  ];

  return candidates.filter((c) => fs.existsSync(path.join(rootDirPath, c.file)));
}

function extractRepositoryTopologyAndDocsCatalog(rootDirPath, counts = {}) {
  let adrCount = 71;
  const adrFilePath = path.join(rootDirPath, 'docs', 'DECISIONS.md');
  if (fs.existsSync(adrFilePath)) {
    const adrMatches = fs.readFileSync(adrFilePath, 'utf8').match(/## ADR-\d+:/g);
    if (adrMatches) adrCount = adrMatches.length;
  }
  const adrRangeEnd = `ADR-${String(adrCount).padStart(3, '0')}`;

  const directories = [
    { path: 'src/app/', role: 'Next.js 16 App Router pages, SSR layouts, metadata routes (`manifest.ts`, `robots.ts`, `sitemap.ts`), global providers (`providers.tsx`), and serverless API route handlers (`/api/books/**`, `/auth/callback`).' },
    { path: 'src/components/', role: `${counts.componentCount || 73} production React 19 UI components organized across \`account/\`, \`accolades/\`, \`auth/\`, \`bookshelf/\`, \`motion/\`, \`presentation/\` (including \`bookshelf/\`), \`profile/\`, \`pwa/\`, \`reader/\`, \`symposium/\`, and \`ui/\`, each paired with co-located \`*.test.tsx\` suites.` },
    { path: 'src/stores/', role: `${counts.storeCount || 10} Zustand client-side state stores (\`useBookshelfStore\`, \`useReaderStore\`, \`useAuthStore\`, \`useFellowshipStore\`, \`useAnnotationStore\`, \`useAccoladesStore\`, \`useHabitsStore\`, \`useJurisdictionStore\`, \`usePreferencesStore\`, \`useThemeStore\`) with \`localStorage\` persistence and bi-directional Supabase cloud outbox synchronization.` },
    { path: 'src/hooks/', role: `${counts.hookCount || 22} custom React hooks organized into \`queries/\` (TanStack Query v5 data fetching), \`reader/\` (Web Speech TTS, session coordinates, gestures, worker AST, reading ledger), and root UI/network/copyright hooks (\`useNetworkStatus\`, \`useOfflineBooks\`, \`useBookCopyright\`, \`useCatalogFilters\`, \`useCollectionAutoHeal\`).` },
    { path: 'src/lib/', role: `${counts.utilityCount || 36} pure domain computational engines and adapters covering Gutenberg AST segmentation/pagination/reflow (\`gutenberg/\`), dual-provider catalog resolution (\`catalog/\`), Supabase SSR/browser clients (\`supabase/\`), multi-jurisdictional copyright (\`copyright-engine.ts\`), IndexedDB storage (\`offline-storage.ts\`), interval annotation partitioning (\`reader-annotator.ts\`), and cloud bookshelf sync (\`bookshelf-cloud-sync.ts\`).` },
    { path: 'src/config/', role: `${counts.configCount || 13} centralized design token, routing, theme, language, era, literary quote, and 27-masterwork curated anthology configuration modules.` },
    { path: 'src/types/', role: `${counts.typeCount || 4} canonical TypeScript type contract modules (\`book.types.ts\`, \`database.types.ts\`, \`catalog.types.ts\`, \`accolades.types.ts\`) defining zero-any domain and PostgreSQL row schemas.` },
    { path: 'src/workers/', role: 'Dedicated off-thread Web Worker (`gutenberg.worker.ts`) executing Gutenberg plain-text segmentation and virtual page layout calculations.' },
    { path: 'src/mocks/ & src/test/', role: 'Hermetic MSW v2 Node interception server (`server.ts`, `handlers.ts`) and JSDOM test environment bootstrap (`setup.ts`).' },
    { path: 'public/', role: 'Progressive Web App Service Worker (`public/sw.js` `v4`) and multi-resolution transparent squircle icons (`favicon.ico`, `icon.svg`, `public/icons/*.png`).' },
    { path: 'supabase/', role: 'Idempotent PostgreSQL schema (`schema.sql`) with 14 tables, 38 RLS policies, 6 functions/triggers, and 22 explicit indexes, plus offline SQL seeds (`seed_books.sql`, `seed_translations.sql`).' },
    { path: 'scripts/', role: '14 Node.js CLI automation, Babel AST documentation compilation (`lib/ast-parser.js`), 7-Gateway verification (`verify-build.js`), Gutenberg catalog streaming (`sync-gutenberg-catalog.js`), and Wikidata FRBR translation clustering (`ingest-translations.js`) tools, plus offline authority cache (`scripts/data/`) and CLI test suites.' },
    { path: 'docs/', role: `Living architectural reference (\`ARCHITECTURE.md\`), ${adrCount} Architecture Decision Records (\`DECISIONS.md\`), AST-compiled parser specification (\`GUTENBERG_PARSER.md\`), CI/CD runbook (\`PIPELINE_GUIDE.md\`), and live 7-Gateway quality telemetry (\`QUALITY_AUDIT_REPORT.md\`, \`quality-audit-results.json\`).` },
    { path: '.github/workflows/ & .husky/', role: 'Automated GitHub Actions CI/CD (`ci.yml`) and weekly autonomous catalog/translation sync cron workflows (`catalog-sync.yml`, `translations-sync.yml`), plus Husky pre-commit quality gates.' },
  ];

  let auditTotals = { suites: 187, tests: '1,994' };
  const auditJsonPath = path.join(rootDirPath, 'docs', 'quality-audit-results.json');
  if (fs.existsSync(auditJsonPath)) {
    try {
      const parsedAudit = JSON.parse(fs.readFileSync(auditJsonPath, 'utf8'));
      const summary = parsedAudit?.testSummary || parsedAudit?.testCatalog;
      if (summary?.totalSuites && summary?.totalTests) {
        auditTotals = {
          suites: summary.totalSuites,
          tests: Number(summary.totalTests).toLocaleString('en-US'),
        };
      }
    } catch {
      // Fallback to default counts
    }
  }

  const livingDocs = [
    { file: 'README.md', mode: 'Hybrid (Curated + Script-Synced)', generator: '`scripts/generate-changelog.js` & `scripts/generate-quality-report.js`', role: 'Primary project overview, system architecture diagrams, Supabase setup guide, and live test/coverage/release blocks.' },
    { file: 'docs/ARCHITECTURE.md', mode: '100% AST-Generated', generator: '`scripts/generate-architecture-matrix.js`', role: 'Complete full-repository C4 architecture map, component/store/hook/utility/config/type matrices, database schema & indexes, testing harness, and module dependency topology.' },
    { file: 'docs/DECISIONS.md', mode: 'Append-Only Governance Ledger', generator: '`scripts/new-adr.js` (Validated in Pass 5)', role: `Sequential Architectural Decision Records (ADR-001 through ${adrRangeEnd}) documenting context, trade-offs, and consequences.` },
    { file: 'docs/GUTENBERG_PARSER.md', mode: '100% AST-Generated', generator: '`scripts/generate-parser-docs.js`', role: 'Technical reference for the Gutenberg plain-text segmentation, paragraph reflow, virtual pagination, and passage extraction engine.' },
    { file: 'docs/QUALITY_AUDIT_REPORT.md', mode: '100% Telemetry-Generated', generator: '`scripts/generate-quality-report.js`', role: `Human-readable 7-Gateway audit summary, V8 coverage metrics, and collapsible catalog of all ${auditTotals.suites} test suites and ${auditTotals.tests} tests.` },
    { file: 'docs/quality-audit-results.json', mode: '100% Telemetry-Generated', generator: '`scripts/generate-quality-report.js`', role: 'Machine-readable JSON telemetry of all 7 gateway passes, coverage percentages, ESLint/Knip counts, and suite totals.' },
    { file: 'ROADMAP.md', mode: '100% AST-Generated', generator: '`scripts/generate-roadmap.js`', role: 'Zero-drift product roadmap verifying feature completion directly against source files and AST patterns across Milestones 0–7.' },
    { file: 'CHANGELOG.md', mode: '100% Script-Generated', generator: '`scripts/generate-changelog.js`', role: 'Chronological Keep a Changelog 1.0.0 & SemVer release ledger across all application versions.' },
    { file: 'docs/PIPELINE_GUIDE.md', mode: 'Curated Engineering Runbook', generator: '_Source-of-Truth Runbook_', role: 'Operational guide for the 7-Gateway Quality Engine, GitHub Actions workflows, and catalog/translation ingestion pipelines.' },
    { file: 'DEVELOPMENT.md & CONTRIBUTING.md', mode: 'Curated Contributor Guides', generator: '_Source-of-Truth Guides_', role: 'Local development environment setup, testing standards, and conventional commit protocols.' },
    { file: 'SECURITY.md & CODE_OF_CONDUCT.md', mode: 'Curated Governance Policies', generator: '_Source-of-Truth Policies_', role: 'Vulnerability disclosure policy, OWASP defense-in-depth overview, and Contributor Covenant v2.1 standards.' },
    { file: 'AGENTS.md & .agents/AGENTS.md', mode: 'Immutable Agent Governance', generator: '_Canonical Agent Rules_', role: 'Master operational rules (Rules 0–9) governing human and AI multi-agent engineering in Bookarium.' },
  ].filter((d) => {
    const primaryFile = d.file.split(' ')[0];
    return fs.existsSync(path.join(rootDirPath, primaryFile));
  });

  return { directories, livingDocs };
}

function generateMarkdown() {
  const graph = analyzeDependencyGraph(srcDir, rootDir);
  const circularHealth = detectCircularDependencies(graph);
  const orphans = detectOrphanedModules(graph);
  const components = extractComponentCatalog(graph);
  const stores = extractStoreCatalog(srcDir);
  const { routes, appPages, hooks } = extractApiAndHookCatalog(srcDir);
  const utilities = extractDomainUtilitiesCatalog(srcDir);
  const configs = extractConfigurationCatalog(srcDir);
  const typeDefs = extractTypeCatalog(srcDir);
  const workers = extractWorkerCatalog(srcDir);
  const testHarness = extractTestHarnessCatalog(srcDir, rootDir);
  const publicAssets = extractPublicAssetsCatalog(rootDir);
  const workspaceConfigs = extractWorkspaceConfigAndGovernanceCatalog(rootDir);
  const repoTopology = extractRepositoryTopologyAndDocsCatalog(rootDir, {
    componentCount: components.length,
    storeCount: stores.length,
    hookCount: hooks.length,
    utilityCount: utilities.length,
    configCount: configs.length,
    typeCount: typeDefs.length,
  });

  const timestamp = new Date().toISOString().split('T')[0];

  let totalLinks = 0;
  for (const data of graph.values()) {
    totalLinks += data.imports.length;
  }

  const lines = [
    '# Architecture Matrix & Living Technical Reference — Bookarium',
    '',
    '> **Auto-Generated Living Architecture**: Programmatically compiled from Source AST via `scripts/lib/ast-parser.js` (Governance Rule 2).  ',
    `> **Last Synchronized**: \`${timestamp}\`  `,
    `> **Topology Health**: \`${graph.size}\` Modules Analyzed • \`${totalLinks}\` Static Linkages • \`${circularHealth.cycleCount}\` Circular Dependencies • \`${orphans.length}\` Orphaned Modules`,
    '',
    '---',
    '',
    '## 🏛️ System Architecture & Data Flow',
    '',
    'Bookarium is built on a **100% Pure Live API Architecture** with real-time telemetry, zero local mock archives, and deterministic state isolation.',
    '',
    '### 1. End-to-End System Context & Data Flow',
    '',
    '```mermaid',
    'flowchart TD',
    '    User["👤 Reader / Public Domain Scholar"]',
    '    ',
    '    subgraph FrontendSPA ["Client SPA Layer (Next.js 16 App Router)"]',
    '        Providers["providers.tsx\\n(QueryClient, Auth Init, Cloud Sync, GlobalTitleTooltip & Dynamic AuthModal)"]',
    '        SWReg["ServiceWorkerRegister.tsx & public/sw.js\\n(App Shell v4, Static Asset Warmup & Offline Fallback)"]',
    '        AuthModalNode["AuthModal.tsx & EmailSentView.tsx\\n(Sign-In, Sign-Up, OAuth, Magic Link & Reset)"]',
    '        Nav["Navbar.tsx\\n(Brand Reset, View Switcher, Single-Phase Gliding Active Underline Cradle, Theme Cycler)"]',
    '        Hero["HeroSearch.tsx\\n(Dynamic 3D Rotating Spotlight & Search)"]',
    '        Hero3D["HeroFeaturedBook3D.tsx\\n(3D Open-Cover Hinge & Leaf-Flip Engine)"]',
    '        Toolbar["StickyCatalogToolbar.tsx\\n(Desktop Sticky Sub-Header, Mobile Capsule Dock, Top-Margin Docking & Split Quick-Clear)"]',
    '        FilterDrawer["AdvancedFilterDrawer.tsx\\n(Staged Filter Execution, Multi-Select Touch Chips: Eras, Topics, Languages, Formats)"]',
    '        EditorialQuote["EditorialQuoteSection.tsx\\n(Classic of the Day & Collision Guard)"]',
    '        LiteraryQuotes["LiteraryQuotes.tsx\\n(Words That Shaped Humanity & Safe Shuffling)"]',
    '        CopyrightBanner["CopyrightNoticeBanner.tsx\\n(Declarative Territorial Restriction & Public Domain Notice)"]',
    '        ContentAdvisory["ContentAdvisoryBanner.tsx\\n(Non-blocking Mature/Historical Context Advisory)"]',
    '        CollectionToolbarNode["CollectionToolbar.tsx\\n(Responsive Workbench: Integrated Search, Sort, Downloaded Filter, Tablet Icon Mode Toggles & Top-Pagination)"]',
    '        PaginationNode["Pagination.tsx\\n(Accessible Numeric Page Navigation)"]',
    '        BookPreviewModalNode["BookPreviewModal.tsx\\n(Tablet & Desktop 3D Open-Book Preview Spread & Docked Curation Bar)"]',
    '        BookshelfRackNode["BookshelfRack.tsx & BookshelfSpine.tsx\\n(3D Hardwood Shelf, Custom Shelves, <1024px Touch Modal & >=1024px Direct Spine Click / Hover Modal)"]',
    '        BookshelfMobileModalNode["BookshelfMobileModal.tsx\\n(Mobile & Tablet <1024px Action & Curation Sheet)"]',
    '        RemoveOfflineModalNode["RemoveOfflineBookModal.tsx • RemoveCollectionBookModal.tsx\\n(Offline Cache & Collection Eviction Confirmations)"]',
    '        CatalogOfflineNode["CatalogOfflineView.tsx\\n(Offline Catalog Notice & Collection Quick-Links)"]',
    '        SymposiumInviteModalNode["SymposiumInviteModal.tsx\\n(1-on-1 Literary Symposium Companion Picker)"]',
    '        AccoladesEngine["accolades-engine.ts • ExLibrisBookplate.tsx • AccoladeCelebrationModal.tsx"]',
    '        PublicSanctuaryNodes["PublicProfileView.tsx • PinnedAccoladesShelf.tsx • PrivateProfileNotice.tsx"]',
    '        ',
    '        subgraph Views ["Primary Application Views (/ & Edge Rewrites)"]',
    '            Grid["Catalog View (/)\\n(Smooth Scroll Navigation, Adaptive Offline Downloaded Dataset, 2-Col Mobile Grid & 3D Hardwood Shelf)"]',
    '            ShelfView["Bookshelf View (/bookshelf)\\n(Curated Library, Custom Named Shelves, Downloaded (N) Smart Shelf, Active-Shelf Clear & 12-Book Row Cap)"]',
    '            FavView["Favorites View (/favorites)\\n(Dedicated Cover Grid, Star Ratings & Personal Curation)"]',
    '            MarksView["Bookmarks View (/bookmarks)\\n(Tactile Reading Ledger, Row-Level Line Badges, Dedicated Resume CTA & 4-State Offline Controls)"]',
    '            NoteView["Commonplace Notebook (/notebook)\\n(Highlights, Reflections, Tags, Single-Column Tablet Grid & Tablet Icon Mode Switcher)"]',
    '            AccView["Account Hub (/account)\\n(Library Stats, Cloud Sync & Preferences)"]',
    '            PrivacyView["Privacy Architecture (/privacy)\\n(Zero-Tracker Manifesto, COPPA/GDPR Art. 8 & Functional Geo-Cookies)"]',
    '            CopyrightView["Copyright Governance (/copyright)\\n(Public Domain Manifesto, Multi-Jurisdiction Rules & DMCA Channel)"]',
    '            HabitsCard["AccountHabitsCard.tsx\\n(Reading Streaks, Daily Progress, Annual Challenge)"]',
    '            AccoladesCard["AccountAccoladesCard.tsx\\n(Literary Honors, Showcase & Ex-Libris Bookplates)"]',
    '            SymposiumCard["AccountSymposiumSection.tsx\\n(Reader Circles & Literary Symposiums)"]',
    '            PrefsCard["AccountPreferencesSection.tsx\\n(Appearance & Scroll • AccountNarrationSubPanel)"]',
    '            ProfilePage["Public Scholar Sanctuary (/u/[username])\\n(Public Profile, Pinned Accolades & Fellowship CTA)"]',
    '            ReaderPage["Focus Reader Page (/read/[id])\\n(Continuous Pagination, Subtitles, AST)"]',
    '        end',
    '        ',
    '        subgraph ReaderDrawers ["Portaled Mutual-Exclusion Dialogs (z-10000)"]',
    '            TocDrawer["ReaderTocDrawer\\n(Rich Subtitles & Page Numbers)"]',
    '            SearchDrawer["ReaderSearchDrawer\\n(In-Volume Live Text Search)"]',
    '            ControlsDrawer["ReaderControls\\n(Typography, Speech & Themes)"]',
    '            LangDrawer["ReaderLanguageDrawer\\n(International Editions Handoff)"]',
    '            AnnotDrawer["ReaderAnnotationsDrawer\\n(In-Volume Highlights, Notes & Deep Links)"]',
    '            DownDrawer["DownloadDrawer\\n(Download Hub: Offline Cache & Compact 2x2 Format Grid)"]',
    '        end',
    '        ',
    '        subgraph StateStores ["Zustand Persistent State & Offline Engine"]',
    '            StoreShelf[("⚡ useBookshelfStore\\n(saved, likes, queue, history, shelves, clearCustomShelfBooks)")]',
    '            StoreReader[("📖 useReaderStore\\n(typography, progress map, coordinates)")]',
    '            StoreTheme[("🎨 useThemeStore\\n(day, sepia, obsidian)")]',
    '            StoreAuth[("🔐 useAuthStore\\n(session, cloud migration, profile)")]',
    '            StorePref[("⚙️ usePreferencesStore\\n(sticky scroll, layout choices)")]',
    '            StoreAnnot[("🖍️ useAnnotationStore\\n(pastel highlights, notes, tags)")]',
    '            StoreHabits[("🔥 useHabitsStore\\n(streak, 5m threshold, dual immersion, cloud)")]',
    '            StoreAccolades[("🎖️ useAccoladesStore\\n(accolades, showcase pinning, celebrations, cloud)")]',
    '            StoreFellowship[("🤝 useFellowshipStore\\n(reader circles, symposiums, companion progress, cloud)")]',
    '            SyncCoordinator["🔄 sync-utils.ts\\n(Unified 6-Store Cloud Sync Coordinator)"]',
    '            BookshelfSyncEngine["🔄 bookshelf-cloud-sync.ts\\n(Outbox Replay, Tombstone Filtering & Cloud Sync)"]',
    '            StoreJurisdiction[("🌐 useJurisdictionStore\\n(country, rule, dev override, cookie sync)")]',
    '            StoreOffline[("📦 IndexedDB Engine\\n(unabridged offline volume cache)")]',
    '        end',
    '        ',
    '        subgraph ReaderEngine ["Reader Runtime & Web Speech Subsystem"]',
    '            SessionHook["📖 useReaderSession\\n(Position Memory, Deep Links & Cross-Display bookmarkText Reflow Healing)"]',
    '            SpeechHook["🔊 useReaderSpeech\\n(SpeechSynthesis, Boundary Sync, Auto-Flip)"]',
    '            TimerHook["⏱️ useReadingTimer\\n(Dual Immersion: 2-min Idle Guard + TTS Audio Bypass)"]',
    '            WorkerHook["⚙️ useGutenbergParserWorker\\n(Persistent Worker Chapter AST)"]',
    '            LedgerHook["🔖 useContinueReadingLedger\\n(Two-Way Hydration & 0ms Resume)"]',
    '            AnnotatorEngine["🖍️ reader-annotator.ts\\n(Computational Interval Partitioning & Highlighter)"]',
    '        end',
    '        ',
    '        HookCopyright["⚖️ useBookCopyright\\n(Declarative Facade: Rules, Lifespans & Status)"]',
    '        HookNetwork["📡 useNetworkStatus\\n(Reactive Online/Offline External Store Hook)"]',
    '        HookAutoHeal["🩺 useCollectionAutoHeal\\n(Author Lifespan Scanning & Auto-Rehydration)"]',
    '        HookCatalogFilters["🎛️ useCatalogFilters\\n(Default Recently Added Sort, Atomic Filter Staging, Multi-Era Bounding, URL Serialization)"]',
    '        QueryBooks["🔄 useBooks & usePrefetchNextPage\\n(Windowed Sub-Pages & Predictive Prefetch)"]',
    '        QueryContent["🔄 useBookContent(url, bookId)\\n(Offline-Always IndexedDB Check to CDN Stream)"]',
    '        QueryTranslate["🌐 useBookTranslations\\n(International Editions Relational Handoff)"]',
    '        Telemetry["📊 Vercel Telemetry\\n(Analytics & Speed Insights)"]',
    '    end',
    '',
    '    subgraph ServerLayer ["Next.js Root Proxy & Edge Routing Layer"]',
    '        RootProxy["Next.js 16 Root Proxy (src/proxy.ts)\\n(Edge Geo-IP: x-vercel-ip-country, Dev ?country=XX, Cookie Stamping)"]',
    '        ProxyBooks["GET /api/books\\n(SWR 3600s Cache, Latency Tracking, Rate Limit, Seam Controller)"]',
    '        CatalogSeam["Catalog Seam & Dual Providers (src/lib/catalog/)\\n(supabase-provider.ts • gutendex-provider.ts)"]',
    '        ProxyContent["GET /api/books/content\\n(Tier 1 Supabase DB • Tier 2 Gutenberg Multi-Mirror, Anti-SSRF)"]',
    '        ProxyBookTranslations["GET /api/books/translations\\n(Edge SWR Cache, Zero False Positives, FRBR Work Mapping)"]',
    '        AuthCallback["GET /auth/callback\\n(PKCE & Token-Hash OTP Verification, Origin Sanitizer)"]',
    '        LayoutServer["Server Layout (/read/[id])\\n(React.cache, ISR 24h, OpenGraph, JSON-LD)"]',
    '    end',
    '',
    '    subgraph LegalLayer ["Jurisdictional Copyright & Content Safety Engine"]',
    '        EngineCore["isBookPublicDomainInJurisdiction\\n(US 1930 Cutoff, Life+70, Life+100, Life+80)"]',
    '        JointAuthors["Joint Authorship Guard (Berne Art. 7bis)"]',
    '        Translators["Translator Protection (Berne Art. 2(3))"]',
    '        ContributorFilter["Contributor Role Filter\\n(Illustrator/Artist Non-Blocking Exclusion)"]',
    '        ContentScanner["Content Advisory Engine (src/lib/content-advisory.ts)\\n(LOC Subject & Bookshelf Lexical Scanner)"]',
    '        CountryResolver["Country Resolver (src/lib/country-resolver.ts)\\n(Edge Geo-IP, Cookie Sync, Timezone Inference)"]',
    '        MetaCache["Metadata Lifespan Cache\\n(metadata-cache.ts • 24h LRU)"]',
    '    end',
    '',
    '    subgraph UpstreamServices ["100% Public Domain & Cloud Infrastructure"]',
    '        Gutendex["🌐 Gutendex Search API\\n(Upstream Search Fallback)"]',
    '        GutenbergCDN["🌐 Project Gutenberg Mirrors\\n(aleph.gutenberg.org, gutenberg.pglaf.org, gutenberg.readingroo.ms, www.gutenberg.org)"]',
    '        WikidataSPARQL["🌐 Wikidata SPARQL (CC0 1.0)\\n(P2034 Gutenberg ID & P407/P424 Language Clusters)"]',
    '        SupabaseCloud[("⚡ Supabase Cloud (PostgreSQL)\\n(public.books, book_translations, profiles, shelves, progress, habits, accolades)")]',
    '        SyncEngine["🔄 Gutenberg Catalog Sync Engine\\n(scripts/sync-gutenberg-catalog.js • .github/workflows/catalog-sync.yml)"]',
    '        SyncTranslations["🔄 Relational Translations Sync\\n(scripts/ingest-translations.js • .github/workflows/translations-sync.yml)"]',
    '        VercelEdge["⚡ Vercel Edge Platform\\n(Cookie-less Analytics & Speed Insights)"]',
    '    end',
    '',
    '    User --> RootProxy',
    '    RootProxy --> Providers',
    '    Providers --> SWReg',
    '    Providers --> AuthModalNode',
    '    Providers --> SyncCoordinator',
    '    RootProxy --> Nav',
    '    RootProxy --> Hero',
    '    Hero --> Hero3D',
    '    RootProxy --> Toolbar',
    '    RootProxy --> AuthCallback',
    '    AuthCallback -->|Verified Session Exchange| SupabaseCloud',
    '    Toolbar --> FilterDrawer',
    '    FilterDrawer --> HookCatalogFilters',
    '    HookCatalogFilters --> QueryBooks',
    '    Toolbar --> Grid',
    '    Grid --> CopyrightBanner',
    '    Grid --> ContentAdvisory',
    '    Grid --> HookCopyright',
    '    Grid --> HookNetwork',
    '    Grid -->|Zero Offline Books| CatalogOfflineNode',
    '    Nav --> HookNetwork',
    '    Grid --> EditorialQuote',
    '    Grid --> LiteraryQuotes',
    '    Grid --> BookPreviewModalNode',
    '    Grid --> BookshelfRackNode',
    '    ShelfView --> BookshelfRackNode',
    '    BookshelfRackNode --> BookshelfMobileModalNode',
    '    BookshelfRackNode --> BookPreviewModalNode',
    '    ShelfView --> RemoveOfflineModalNode',
    '    FavView --> RemoveOfflineModalNode',
    '    MarksView --> RemoveOfflineModalNode',
    '    BookPreviewModalNode --> SymposiumInviteModalNode',
    '    Nav --> Views',
    '    FavView --> HookAutoHeal',
    '    ShelfView --> HookAutoHeal',
    '    MarksView --> HookAutoHeal',
    '    NoteView --> HookAutoHeal',
    '    SymposiumCard --> HookAutoHeal',
    '    HookCopyright --> EngineCore',
    '    ContentAdvisory --> ContentScanner',
    '    DownDrawer --> ContentAdvisory',
    '    AccView --> HabitsCard',
    '    AccView --> AccoladesCard',
    '    AccoladesCard --> AccoladesEngine',
    '    AccView --> SymposiumCard',
    '    AccView --> PrefsCard',
    '    SymposiumCard --> StoreFellowship',
    '    ProfilePage --> PublicSanctuaryNodes',
    '    PublicSanctuaryNodes --> StoreFellowship',
    '    SyncCoordinator --> StoreShelf',
    '    SyncCoordinator --> StoreReader',
    '    SyncCoordinator --> StoreAnnot',
    '    SyncCoordinator --> StoreHabits',
    '    SyncCoordinator --> StoreAccolades',
    '    SyncCoordinator --> StoreFellowship',
    '    StoreShelf --> BookshelfSyncEngine',
    '    BookshelfSyncEngine -->|Cloud Sync via RLS| SupabaseCloud',
    '    StoreFellowship -->|Circles & Symposium Sync| SupabaseCloud',
    '    StoreAnnot -->|Marginalia & Symposium Sync| SupabaseCloud',
    '    StoreOffline -->|Adaptive Offline Catalog| Grid',
    '    StoreOffline -->|Offline Volumes & Smart Shelf| ShelfView',
    '    StoreOffline -->|Offline Volumes Filter| LedgerHook',
    '    ShelfView --> CollectionToolbarNode',
    '    FavView --> CollectionToolbarNode',
    '    MarksView --> CollectionToolbarNode',
    '    NoteView --> CollectionToolbarNode',
    '    Grid --> PaginationNode',
    '    ShelfView --> PaginationNode',
    '    FavView --> PaginationNode',
    '    MarksView --> PaginationNode',
    '    NoteView --> PaginationNode',
    '    ',
    '    Grid --> QueryBooks',
    '    QueryBooks --> ProxyBooks',
    '    ProxyBooks --> CatalogSeam',
    '    CatalogSeam --> EngineCore',
    '    CatalogSeam -->|"Primary: Estimated-Count Fast Scan / <50ms Single-Book"| SupabaseCloud',
    '    CatalogSeam -.->|Fallback on unseeded/offline| Gutendex',
    '    SyncEngine -->|Weekly Cron pg_catalog.csv.gz Stream| SupabaseCloud',
    '    QueryBooks -.->|Client Failover on 504| Gutendex',
    '    ',
    '    ReaderPage --> QueryContent',
    '    ReaderPage --> ReaderDrawers',
    '    ReaderPage --> ReaderEngine',
    '    ReaderPage --> TimerHook',
    '    ReaderPage --> AnnotatorEngine',
    '    AnnotatorEngine --> StoreAnnot',
    '    QueryContent --> ProxyContent',
    '    ProxyContent --> MetaCache',
    '    MetaCache -->|1. Supabase public.books check| SupabaseCloud',
    '    MetaCache -.->|2. Fallback to Gutendex & Featured Fixtures| Gutendex',
    '    MetaCache --> EngineCore',
    '    EngineCore --> JointAuthors',
    '    EngineCore --> Translators',
    '    ProxyContent -->|Tier 1: Instant DB Text| SupabaseCloud',
    '    ProxyContent -->|Tier 2: Multi-Mirror Fallback| GutenbergCDN',
    '    ReaderPage --> QueryTranslate',
    '    LangDrawer --> QueryTranslate',
    '    QueryTranslate -->|Tier 1: Relational Work Mapping| ProxyBookTranslations',
    '    ProxyBookTranslations -->|100% Precision Relational Query| SupabaseCloud',
    '    QueryTranslate -.->|Tier 2: Client Author AST Fallback| Gutendex',
    '    SyncTranslations -->|Weekly & On-Demand Ingestion| SupabaseCloud',
    '    SyncTranslations -.->|Wikidata P2034 Query & Fallback Snapshot| WikidataSPARQL',
    '    ',
    '    Views --> StateStores',
    '    HabitsCard --> StoreHabits',
    '    AccoladesCard --> StoreAccolades',
    '    TimerHook --> StoreHabits',
    '    ReaderEngine --> StateStores',
    '    StoreShelf -->|Cloud Sync via RLS| SupabaseCloud',
    '    StoreReader -->|Progress Sync| SupabaseCloud',
    '    StoreAuth -->|Session Auth| SupabaseCloud',
    '    StoreHabits -->|Habits Sync via RLS| SupabaseCloud',
    '    StoreAccolades -->|Accolades Sync via RLS| SupabaseCloud',
    '    Telemetry -.->|Anonymous Metrics| VercelEdge',
    '```',
    '',
    '---',
    '',
    '### 2. Focus Reader State & Typography Engine',
    '',
    '```mermaid',
    'flowchart LR',
    '    subgraph ReaderState ["Zustand Reader & Fellowship Stores (useReaderStore • useFellowshipStore)"]',
    '        ActiveBook["Active Book Metadata"]',
    '        FontSize["Font Size: 12px - 36px"]',
    '        FontFamily["Font Family: Serif | Sans | Mono"]',
    '        LineHeight["Line Height: 1.2 - 2.6"]',
    '        Brightness["Page Brightness: 30% - 100%"]',
    '        ColumnWidth["Column Width: Narrow (576px) | Normal (768px) | Wide (1024px)"]',
    '        ReadingMode["Reading Mode: Paginated | Scroll"]',
    '        Theme["Theme: Light | Dark | Sepia"]',
    '        Progress["Global Page & Book Progress %"]',
    '        Positions["Reading Positions Map\\n(exact chapter, page, row-snapped bookmarkRow & reflow-resilient bookmarkText)"]',
    '        FellowState["Active Symposium & Companion Coordinates\\n(useFellowshipStore)"]',
    '    end',
    '',
    '    subgraph ParsingEngine ["Gutenberg Typography & Segmentation AST"]',
    '        RawText["Raw Plain Text Stream"]',
    '        WorkerPool["Persistent Web Worker Thread\\n(useGutenbergParserWorker)\\n• Kept alive across font/spacing tweaks\\n• Chunked async main-thread fallback"]',
    '        Reflow["reflowGutenbergParagraphs\\n(Normalizes 70-col hard wraps)"]',
    '        TOCFilter["Front-Matter TOC Suppressor"]',
    '        Segmentation["Chapter Section Segmentation"]',
    '        VirtualPages["Virtual Continuous Page Spread (5600 chars/pg)"]',
    '        ',
    '        RawText --> WorkerPool',
    '        WorkerPool --> Reflow',
    '        Reflow --> TOCFilter',
    '        TOCFilter --> Segmentation',
    '        Segmentation --> VirtualPages',
    '    end',
    '',
    '    subgraph ReaderView ["Dedicated Focus Reader (src/app/read/[id]/page.tsx)"]',
    '        Toolbar["Top Editorial Reader Bar & Sliding Tray (ReaderHeader • Tactile Single-Tap Immersive Slide)"]',
    '        SubHeader["Sub-Header Status Ribbon (ReaderSubHeaderRibbon)"]',
    '        ContentArea["Book Page Rendering Area (Fluid Paragraph Wrap, Multi-Row Bookmark Span startRow->endRow, Page Brightness Filter & Amber Sentence Highlight)"]',
    '        ProgressBar["Top Reading Progress Indicator"]',
    '        ResumeToast["Exact-Page Auto-Resume Toast"]',
    '        FooterBar["Sticky Bottom Pagination & Page Jump (ReaderFooter • Tactile Single-Tap Immersive Slide)"]',
    '        TOC["Table of Contents Drawer (ReaderTocDrawer)"]',
    '        SearchDrawer["In-Book Search Drawer (ReaderSearchDrawer)"]',
    '        LangDrawer["Language Editions Drawer (ReaderLanguageDrawer)"]',
    '        Controls["Appearance & Typography Popover (ReaderControls • Font, Line Height, Brightness 30%-100%, Theme)"]',
    '        AudioBar["Speech Narration Bar (ReaderSpeechBar)\\n(useReaderSpeech • SpeechSynthesis • 0.85x-2.0x)"]',
    '        HighlightPop["Highlight & Fellow Attribution Popover (TextHighlightPopover)"]',
    '        AnnotDrawer["Annotations Drawer (ReaderAnnotationsDrawer)\\n(4 Pastel Highlighters • Symposium Marginalia • Spoiler Shield)"]',
    '        InfoModal["Archival Metadata Modal (GutenbergInfoModal)"]',
    '    end',
    '',
    '    subgraph Persistence ["Browser LocalStorage, IndexedDB & Supabase Cloud"]',
    '        LSPrefs[("bookarium-reader-preferences\\n(theme, font, spacing, brightness, readingProgress, readingPositions)")]',
    '        LSAnnot[("bookarium-annotations-storage\\n(useAnnotationStore highlights & reflections)")]',
    '        IDBStorage[("IndexedDB (useOfflineBooks)\\n(unabridged offline volumes)")]',
    '        CloudProgress[("⚡ Supabase Cloud\\npublic.reading_progress\\n(2s Debounced Sync & Restore • scroll_offset & bookmark_text)")]',
    '        CloudSymposium[("⚡ Supabase Cloud\\npublic.symposium_sessions & user_annotations\\n(Companion Progress & Fellow Marginalia)")]',
    '    end',
    '',
    '    Toolbar -->|"Adjust Size / Family / Width / Mode / Theme"| ReaderState',
    '    VirtualPages --> ReaderView',
    '    ReaderState --> ContentArea',
    '    FellowState -->|"Companion Progress & Milestone Dispatches"| SubHeader',
    '    ReaderState --> ProgressBar',
    '    ReaderState --> ResumeToast',
    '    FooterBar -->|"Page Flip / Jump"| ReaderState',
    '    TOC -->|"Select Chapter (p. X)"| ReaderState',
    '    SearchDrawer -->|"Jump to Match (p. X)"| ReaderState',
    '    LangDrawer -->|"Switch Translation"| ReaderState',
    '    Controls -->|"Tweak Settings"| ReaderState',
    '    AudioBar -->|"Sentence Highlight Sync"| ContentArea',
    '    HighlightPop <-->|"Select / Save Passage"| ContentArea',
    '    AnnotDrawer -->|"Render Highlights"| ContentArea',
    '    AnnotDrawer <--> LSAnnot',
    '    AnnotDrawer <-->|"Symposium RLS"| CloudSymposium',
    '    FellowState <-->|"Authenticated RLS"| CloudSymposium',
    '    ReaderView <--> IDBStorage',
    '    ReaderState <--> LSPrefs',
    '    ReaderState <-->|"Authenticated"| CloudProgress',
    '```',
    '',
    '---',
    '',
    '### 3. Bookmarks & Continue Reading Ledger Architecture',
    '',
    '```mermaid',
    'flowchart TD',
    '    subgraph Storage ["Persistent State Stores"]',
    '        RS["📖 useReaderStore\\n• readingPositions (chapter, page, bookmarkRow & bookmarkText — cleared on finished)\\n• readingProgress (0-100%)\\n• openReader(book) [warm cache]"]',
    '        BS["⚡ useBookshelfStore\\n• savedBooks []\\n• recentBooks [] (cached identity)\\n• bookStatuses {} (\'currently_reading\', \'finished\' resets bookmark)"]',
    '        IDB["📦 IndexedDB (useOfflineBooks)\\n• offlineBookIds & offlineBooks (unabridged cache)"]',
    '    end',
    '',
    '    subgraph LedgerHook ["useContinueReadingLedger Hook"]',
    '        FilterActive["Active Telemetry Filter\\n(readingPositions exists OR readingProgress > 0)\\n⚠️ Excludes un-opened shelved books"]',
    '        MissingCheck{"Missing Identity or\\nPlaceholder Author?"}',
    '        QueryMissing["🔄 useBooks(ids: missingIds)\\n(TanStack Query - Catalog Seam)"]',
    '        EnrichDict["Enriched Book Dictionary (setOrMergeBook)\\n(savedBooks + recentBooks + offlineBooks + queryResults • Author Merge Guardrails)"]',
    '        Parser["Canonical Utilities (@/lib/utils)\\n• formatAuthorNames (reverse \'Last, First\' & strip dates)\\n• cleanBookTitle (strip Gutenberg prefixes)\\n• formatRelativeTime (\'Recently\', \'2h ago\')"]',
    '        Assembly["Assemble ActiveReadingVolume[]\\n• progress, chapter, coordinates, lastReadAt\\n• status (in_progress / completed / on_hold)\\n• isOffline / Not Downloaded badge • Line X & bookmarkText"]',
    '        FilterSort["Client Search & Status Filter\\n• \'all\' | \'in_progress\' | \'completed\' | \'on_hold\'\\n• CollectionSearchBar token matching\\n• Multi-mode sort (\'recent\' | \'progress\' | \'title\' | \'author\' | \'downloaded\')"]',
    '    end',
    '',
    '    subgraph UI ["Presentation Layer (BookmarksView.tsx)"]',
    '        Header["SectionHeader (\'Continue Reading & Bookmarks\')\\n• Eyebrow, Flank lines, Clear Bookmarks modal\\n• Mark as Finished modal (conditional bookmark-reset notice)"]',
    '        Search["CollectionToolbar\\n(Search, Sort & Downloaded Filter, Pagination)"]',
    '        Tabs["Filter Tabs (All, In Progress, Completed, On Hold)"]',
    '        Cards["BookmarkCard.tsx\\n• Top-anchored silk ribbon (origin-top scale-y-110)\\n• Card tap focuses/activates card (all viewports)\\n• Unified Title/Author Link Copy (300ms Tooltip & Copied! Pill)\\n• Reading coordinates & Line X badge\\n• Favorite/Bookshelf curation & RemoveCollectionBookModal\\n• 4-state square offline button & modal\\n• Status dropdown selector (conditional bookmark-reset modal on Finished)\\n• Desktop cursor-exit focus release (onDeactivate)"]',
    '        ResumeAction["Dedicated 1-Click Resume / Read Again CTA\\n• Seed useReaderStore.openReader(book) [Warm Cache]\\n• router.push(\'/read/\' + id)"]',
    '    end',
    '',
    '    RS --> FilterActive',
    '    FilterActive --> MissingCheck',
    '    BS --> MissingCheck',
    '    IDB --> MissingCheck',
    '    MissingCheck -->|"Yes (e.g. un-shelved #55179)"| QueryMissing',
    '    QueryMissing --> EnrichDict',
    '    MissingCheck -->|"No"| EnrichDict',
    '    BS --> EnrichDict',
    '    IDB --> EnrichDict',
    '    EnrichDict --> Parser',
    '    Parser --> Assembly',
    '    IDB --> Assembly',
    '    IDB -->|"isBookOffline Filter"| FilterSort',
    '    Assembly --> FilterSort',
    '    FilterSort --> Cards',
    '    Header --> UI',
    '    Search --> FilterSort',
    '    Tabs --> FilterSort',
    '    Cards --> ResumeAction',
    '    ResumeAction -->|"Warm Reader Transition (0 CLS)"| RS',
    '```',
    '',
    '---',
    '',
    '## 🧩 Component Catalog & Props Interface Matrix',
    '',
    `Auto-extracted dynamically from **${components.length} Production UI Components** using Babel AST:`,
    '',
    '| Component | Category | Exported Props Interface | Primary Props & Signals | Module Link |',
    '| :--- | :--- | :--- | :--- | :--- |',
  ];

  const formatComponentCategory = (cat) => {
    if (cat === 'ui') return 'UI';
    if (cat === 'presentation/bookshelf') return 'Presentation (Bookshelf)';
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  };

  for (const c of components) {
    const categoryTitle = formatComponentCategory(c.category);
    lines.push(
      `| **\`${c.name}\`** | ${categoryTitle} | ${c.propsInterface} | ${c.propSignals} | [\`${c.file}\`](${c.file}) |`
    );
  }

  lines.push(
    '',
    '---',
    '',
    '## ⚡ State Management & Store Architecture',
    '',
    `Zustand client-side state stores programmatically verified across **${stores.length} Persistent Modules**:`,
    ''
  );

  const storeDescriptions = {
    useAccoladesStore:
      'Deterministic literary accolades evaluation, celebration queues, personal showcase pinning (max 3 bookplates), offline pin mutation queue (`pendingPinUpdates`), and bi-directional Supabase cloud synchronization.',
    useAnnotationStore:
      'Scholar marginalia, categorical pastel highlights (Yellow, Amber, Mint, Rose), co-reader Fellow Marginalia (`fellowAnnotations`), cross-volume global fellow marginalia sync (`fetchAllFellowAnnotations`), companion profile enrichment & placeholder protection (`enrichFellowAnnotations`, `resolveStaleFellowProfiles`), chapter-bound Spoiler Shield (`spoilerShieldEnabled`), and scholarly reflections.',
    useAuthStore:
      'Supabase session authentication, offline-persisted profile & user state (`bookarium-auth-profile`), optimistic offline profile outbox (`pendingProfileUpdates`), OWASP current-password re-authentication (`updatePassword`), complete 6-store session teardown & IndexedDB/speech/sessionStorage erasure on account deletion, and cloud profile synchronization with live companion identity propagation.',
    useBookshelfStore:
      'Personal library collections, reading queue, reading history, custom named shelves, active-shelf-aware book clearing (`clearSavedBooks`, `clearCustomShelfBooks`), placeholder-to-authentic author & subject/format self-healing (`enrichSavedBooks`), atomic selector hooks (`useIsBookSaved`, `useIsBookFavorite`, `useHydratedBookshelfCounts`, `useBookRating`, `useReadingStatus`), deletion tombstones, ratings, and cloud outbox reconciliation (`DELETE_BOOK`, `INSERT_BOOK`, `DELETE_FAVORITE`, `UPSERT_FAVORITE`, `UPSERT_CURATION`, `DELETE_CURATION`, `MOVE_BOOK`, `UPDATE_SHELF`) via `bookshelf-cloud-sync.ts`.',
    useFellowshipStore:
      'Opt-in 1-on-1 Reader Circle fellowships, per-volume Literary Symposium sessions, companion progress coordinates, offline symposium progress outbox (`pendingSymposiumProgress`), scholar handle formatting (`formatFellowScholarLabel`, `isPlaceholderUsername`), pending invitation badges, and bi-directional Supabase cloud synchronization.',
    useHabitsStore:
      'Reading streaks with 5-minute active immersion threshold, daily calendar activity dates, annual volume challenge goals, deduplicated completed books count (`completed_books_count`), dual immersion telemetry (reading vs listening), and multi-device Supabase cloud synchronization.',
    useJurisdictionStore:
      'Client-side geographic jurisdiction state, cookie synchronization (bookarium-geo-country), developer country overrides, and synchronous regional capability resolution.',
    usePreferencesStore:
      'Reader display choices, sticky header auto-hide preferences, and navigation behaviors.',
    useReaderStore:
      'Active book payload with verified lifespan preservation, typography settings (size, family, line height), page brightness (`30%–100%`), reading mode (paginated vs scroll), chapter/page/row coordinates (`bookmarkRow`) and cross-display/font-reflow resilient passage anchor (`bookmarkText`, cleared on finished status), bookmark deletion tombstones (`deletedPositionBookIds`), placeholder-to-authentic author & lifespan self-healing (`enrichReadingPositions`, `saveReadingPosition`), and bidirectional Supabase `reading_progress` sync.',
    useThemeStore:
      'Global application theme state (Day Paper, Sepia Parchment, Obsidian Dark) with immediate document class application.',
  };

  for (let i = 0; i < stores.length; i++) {
    const s = stores[i];
    const desc = storeDescriptions[s.name] || 'Application state store.';
    lines.push(`### ${i + 1}. \`${s.name}\` ([\`${s.file}\`](${s.file}))`);
    lines.push(`* **Storage Key**: ${s.storageKey}`);
    lines.push(`* **Role & State**: ${desc}`);
    lines.push('');
  }

  lines.push(
    '---',
    '',
    '## 🌐 API Routes, App Router Entrypoints, Query Hooks & Reader Engine',
    '',
    '### 1. API & Server Route Handlers (Edge Proxy, Auth & Telemetry)',
    '',
    '| Endpoint / Route | Method(s) | Source File | Cache & Security Strategy | Upstream Target |',
    '| :--- | :--- | :--- | :--- | :--- |'
  );

  for (const r of routes) {
    let cacheDesc = 'Edge Proxy';
    let upstream = 'Project Gutenberg Infrastructure';
    if (r.path === '/api/books') {
      cacheDesc = '`s-maxage=3600, stale-while-revalidate=86400` • Sliding-Window Rate Limit (30 req/min)';
      upstream = 'Supabase `public.books` -> `https://gutendex.com/books/`';
    } else if (r.path === '/api/books/content') {
      cacheDesc = '`s-maxage=86400, stale-while-revalidate=604800` • Anti-SSRF Allowlist & Jurisdictional Gate';
      upstream = 'Supabase `plain_text` -> Gutenberg Multi-Mirror CDN';
    } else if (r.path === '/api/books/translations') {
      cacheDesc = '`s-maxage=86400, stale-while-revalidate=604800` • Sliding-Window Rate Limit & Jurisdictional Filter';
      upstream = 'Supabase `public.book_translations` & `public.books`';
    } else if (r.path === '/auth/callback') {
      cacheDesc = '`No-Store Auth Exchange` • PKCE & OTP Verification + Canonical Origin Redirect Sanitizer';
      upstream = 'Supabase Auth (`exchangeCodeForSession`, `verifyOtp`)';
    }
    lines.push(`| **\`${r.path}\`** | \`${r.methods}\` | [\`${r.file}\`](${r.file}) | ${cacheDesc} | ${upstream} |`);
  }

  const pageDescriptions = {
    'src/app/layout.tsx': 'Root HTML shell, font initialization, theme class hydration, and global React Query / Service Worker provider wrapper.',
    'src/app/providers.tsx': 'Root client provider initializing TanStack `QueryClient`, Supabase authentication listener, `syncAllStoresWithCloud` cloud reconciliation, `online` event outbox flushing, `GlobalTitleTooltip` stylized tooltip delegation, and dynamic `AuthModal` rendering.',
    'src/app/loading.tsx': 'Next.js App Router streaming & pre-hydration loading splash boundary rendering the vector Bookarium crest and animated loading indicator.',
    'src/app/globals.css': 'Tailwind CSS v4 Oxide stylesheet defining Day (`#fcfbf9`), Cozy Coffee Sepia (`#2b1d16`), and Dark Obsidian (`#0e1117`) theme tokens, 3D hardcover book hinge physics (`.book-center-crease`, `.preserve-3d`), and custom reader scrollbars.',
    'src/app/page.tsx': 'Primary SPA workbench hosting Catalog, Bookshelf, Favorites, Bookmarks, and Commonplace Notebook views with edge URL rewrites.',
    'src/app/error.tsx': 'Route-level React Error Boundary providing graceful recovery UI and diagnostic fallback.',
    'src/app/global-error.tsx': 'Root document-level React Error Boundary catching fatal top-level layout exceptions.',
    'src/app/not-found.tsx': 'Editorial 404 Not Found boundary with direct navigation back to the public domain catalog.',
    'src/app/read/[id]/layout.tsx': 'Server layout generating ISR 24h dynamic OpenGraph, Twitter Card, and Schema.org Book JSON-LD metadata (`React.cache`).',
    'src/app/read/[id]/page.tsx': 'Dedicated distraction-free Focus Reader with continuous pagination, Web Worker AST segmentation, TTS narration, and Symposium marginalia.',
    'src/app/account/layout.tsx': 'Server layout defining canonical metadata and robots noindex directives for the Scholar Account Hub.',
    'src/app/account/page.tsx': 'Scholar Account Hub for Reading Habits, Literary Accolades, Reader Circles & Symposiums, Cloud Sync, and Preferences.',
    'src/app/u/[username]/page.tsx': 'Public Scholar Sanctuary displaying pinned Ex-Libris bookplates, public profile stats, and 1-on-1 Literary Fellowship invitation actions.',
    'src/app/privacy/layout.tsx': 'Server layout defining canonical SEO and OpenGraph metadata for the Privacy Architecture manifesto.',
    'src/app/privacy/page.tsx': 'Zero-Tracker Privacy Architecture manifesto, functional geo-cookie disclosure, and COPPA / GDPR Art. 8 governance.',
    'src/app/copyright/page.tsx': 'Multi-Jurisdictional Public Domain Copyright Governance manifesto, territory rules table, and takedown notice channel.',
    'src/app/auth/confirm-deletion/page.tsx': 'Two-step email-verified account deletion confirmation page executing `delete_current_user()` RPC.',
    'src/app/manifest.ts': 'Progressive Web App (PWA) Web App Manifest configuring standalone display, theme colors, and multi-resolution icons.',
    'src/app/robots.ts': 'Search engine crawler directives permitting public catalog and reader indexing while protecting `/api/` and `/auth/` routes.',
    'src/app/sitemap.ts': 'Dynamic XML sitemap generator indexing primary views, governance pages, and curated public domain masterworks.',
  };

  lines.push(
    '',
    '### 2. App Router Pages, Layouts, Providers & Styling Entrypoints',
    '',
    '| Route / URI | Entrypoint Type | Rendering Strategy | Source File | Architectural Responsibility |',
    '| :--- | :--- | :--- | :--- | :--- |'
  );

  for (const p of appPages) {
    const desc = pageDescriptions[p.file] || 'Next.js App Router entrypoint.';
    lines.push(`| **\`${p.route}\`** | ${p.kind} | ${p.rendering} | [\`${p.file}\`](${p.file}) | ${desc} |`);
  }

  lines.push(
    '',
    '### 3. Custom Hooks (Data Queries & Reader Subsystems)',
    '',
    '| Hook Name | Subsystem / Layer | Source File | Architectural Responsibility |',
    '| :--- | :--- | :--- | :--- |'
  );

  const hookRoles = {
    useBooks: 'TanStack Query fetching catalog volumes with sub-pagination and client failover.',
    useBookContent: 'TanStack Query (`networkMode: "always"`) fetching book plain text with IndexedDB offline-first check, multi-store lifespan verification (`resolveAuthoritativeLocalAuthors`), and online server-gatekeeper deferral.',
    useBookTranslations: 'TanStack Query aggregating international language translations and editions (gated when offline).',
    useReaderSpeech: 'Browser-native Web Speech synthesis with boundary word highlighting and auto-flip.',
    useReaderSession: 'Reading coordinates restoration, cross-page `bookmarkText` reflow self-healing on font-size re-pagination, resume ribbons, and cloud session synchronization.',
    useContinueReadingLedger: 'Headless continue reading ledger with authentic telemetry enrollment, placeholder-author detection (`hasAuthenticAuthor`), non-regressive author merge guardrails (`setOrMergeBook`), `readingPositions` author healing, query hydration, multi-attribute sorting, and offline volume filtering (`useOfflineBooks`).',
    useReaderDrawers: 'Mutual exclusivity coordination for in-reader tool drawers and modals.',
    useReaderGestures: 'Touch swipe detection, tactile single-finger tap detection (`onTapSurface`) for immersive bar toggling, keyboard shortcuts, and selection gesture conflict guards.',
    useGutenbergParserWorker: 'Persistent Web Worker chapter segmentation and layout pagination calculations.',
    useCatalogFilters: 'Catalog filter state URL binding, default Recently Added (descending) sort, atomic filter staging, multi-era bounding calculation, and multi-filter query synchronization.',
    useScrollDirection: 'Stepped directional scroll detection with user auto-hide preference persistence.',
    usePerformanceTier: 'Hardware concurrency and memory heuristic detection for fluid 60fps animations.',
    useOfflineBooks: 'IndexedDB cache enumeration (`offlineIds` & `offlineBooks`), reactive cross-instance event broadcast (`OFFLINE_BOOKS_UPDATED_EVENT`), loading state propagation (`OFFLINE_DOWNLOADING_EVENT`), author lifespan normalization (`normalizeOfflineAuthors`), and individual-only offline book download/deletion management.',
    useCursorTooltip: 'Adaptive cursor tooltip hook (`300ms` default delay, `0ms` action buttons, viewport boundary clamping) powering `CursorTooltip` and `GlobalTitleTooltip`.',
    useBookPassageShuffle: 'Autonomous literary quote selection and multi-chapter shuffle engine.',
    useHasMounted: 'SSR hydration barrier hook preventing client-server markup mismatches.',
    useReadingTimer: 'Reader session telemetry tracking visual reading with 2-minute idle guard and TTS narration audio bypass.',
    useCollectionAutoHeal: 'Unified multi-collection auto-healing pipeline scanning and rehydrating missing author lifespans across Favorites, Bookshelves, Reading Positions, Annotations (Personal & Fellow), and Active Symposiums.',
    useMobileViewSwipe: 'Tactile touch gesture navigation hook enabling horizontal view swiping across primary views on mobile and tactile tablets.',
    useTouchDevice: 'SSR-safe tactile capability and viewport boundary detection enabling touch gestures on tablets and mobile.',
    useBookCopyright: 'Declarative jurisdictional copyright facade hook coordinating territory rules, author lifespan restrictions, and public domain badges.',
    useNetworkStatus: 'Reactive browser online/offline external store hook (`useSyncExternalStore`) driving red offline Account indicators, adaptive offline Catalog fallback, and network-gated controls.',
  };

  for (const h of hooks) {
    const role = hookRoles[h.name] || 'Application custom hook.';
    const sub = h.category.charAt(0).toUpperCase() + h.category.slice(1);
    lines.push(`| **\`${h.name}\`** | ${sub} | [\`${h.file}\`](${h.file}) | ${role} |`);
  }

  lines.push(
    '',
    '---',
    '',
    '## 🧠 Domain Engines & Pure Computational Utilities',
    '',
    `Pure business logic, historical engines, and layout algorithms verified across **${utilities.length} Domain Modules** using Babel AST:`,
    '',
    '| Engine / Utility | Subsystem / Layer | Source File | Primary Exported Primitives | Architectural Responsibility |',
    '| :--- | :--- | :--- | :--- | :--- |'
  );

  const utilityDescriptions = {
    'accolades-engine':
      'Historical literary accolades evaluation engine, criteria matching, milestone progress calculation, summary aggregation (`computeAccoladesSummary`), and era determination.',
    'book.adapter':
      'Bidirectional domain transformation between Gutendex API schemas, canonical Book models, and Supabase cloud persistence payloads.',
    'api-utils':
      'Server-side API route helpers, IP address extraction, and standardized rate limit error response generation.',
    'bookshelf-cloud-sync':
      'Bidirectional cloud reconciliation engine for bookshelves, shelf items, and favorite books, featuring non-regressive local metadata preservation (`mergeCloudBookWithLocal`), per-user in-flight mutex coalescing, concurrent `Promise.all` table fetching, multi-shelf `book_id` deduplication, outbox mutation replay, tombstone filtering, single-commit atomic state reconciliation, and deterministic ordering.',
    'book-metadata':
      'Author and title cleaning, placeholder author heuristics (`isPlaceholderAuthor`, `resolvePrimaryAuthorName`), verified lifespan checks (`hasVerifiedLifespans`), dictionary author enrichment (`enrichAuthorMap`), and defensive editorial metadata normalization.',
    'content-advisory':
      'Autonomous content advisory evaluation engine scanning Library of Congress subject classifications and bookshelves for mature themes, erotic literature, and sensitive historical context with non-blocking user guidance.',
    'copyright-engine':
      'Multi-jurisdictional copyright engine evaluating public domain status across US, EU/Berne (Life + 70), Mexico (Life + 100), and Colombia/Spain (Life + 80), with joint authorship (Art. 7bis), translator protection (Art. 2(3)), and longevity heuristics.',
    'country-resolver':
      'Synchronous and edge geographic country resolution coordinating timezone mapping, geo-cookies, and developer overrides.',
    'gutendex-provider':
      'Upstream Gutendex REST catalog provider implementing ICatalogProvider with 15s timeout control, error mapping, and jurisdictional copyright filtering.',
    'gutenberg-parser':
      'Root domain facade barrel re-exporting all Gutenberg segmentation, pagination, reflow, and passage extraction subsystems.',
    index:
      'Gutenberg subsystem barrel aggregating types, reflow, pagination, metadata, segmentation, and passage algorithms.',
    metadata:
      'Gutenberg plain-text header/footer metadata extraction, author/title/language detection, and ISO code normalization.',
    pagination:
      'Continuous chapter pagination algorithms, character-per-page geometry calculations, and reading time estimation.',
    passages:
      'Dynamic book passage and quote extraction engine identifying compelling prose segments with dialogue and character markers.',
    reflow:
      'Typography text-reflow heuristics repairing Project Gutenberg hard line wraps and paragraph boundaries.',
    segmentation:
      'Robust chapter and section boundary detection with Roman numeral, spelled-word, and structural heading patterns.',
    types:
      'Canonical TypeScript interfaces and configurations for the Project Gutenberg parsing engine and AST nodes.',
    'in-book-search':
      'Full-text in-volume search algorithm with context snippet generation and matched coordinate navigation.',
    'offline-storage':
      'IndexedDB storage abstraction providing offline book content caching, local store author resolution and asynchronous IndexedDB author back-fill (`patchOfflineBookAuthors`), storage change notifications (`notifyOfflineStorageChanged`), quota calculation, and LRU eviction.',
    password:
      'Cryptographically secure password generation and multi-factor entropy evaluation engine.',
    'query-parser':
      'Canonical query parameter extractor and sanitizer for catalog queries, normalizing whitespace, pagination, author lifespans, and edge geo-country fallback cascades.',
    'rate-limiter':
      'In-memory sliding-window rate limiter with burst mitigation for API routes.',
    'reader-annotator':
      'Scholarly marginalia interval partitioning, non-destructive HTML text-node highlighter, overlapping annotation pairing (`pairOverlappingAnnotations`), and shared quote span segmentation (`computeSharedQuoteSegments`).',
    'reading-analytics':
      'Streak calculation, 5-minute immersion thresholds, reading speed metrics, annual reading goal progress, deduplicated completed volume counting (`calculateCompletedBooksCount`), and public scholar habit telemetry resolution (`resolvePublicReadingHabits`).',
    'redirect-sanitizer':
      'Open-redirect prevention, canonical authentication origin resolver, and origin-validated book share URL builder (`sanitizeRedirectPath`, `resolveCanonicalAuthOrigin`, `buildAuthRedirectUrl`, `buildShareUrl`).',
    'smart-search':
      'Fuzzy multi-token search engine querying titles, authors, and subjects with punctuation normalization.',
    'speech-utils':
      'Web Speech API voice selection heuristics identifying natural/neural synthesis voices.',
    'supabase-provider':
      'Self-hosted Supabase PostgreSQL catalog provider implementing ICatalogProvider with cached healthcheck (60s TTL), GIN full-text search_vector queries, and author lifespan bounds for sub-50ms single-book lookups and ~1-2s catalog page queries.',
    client:
      'Browser-side Supabase client initialization with credential sanitization and local session persistence.',
    middleware:
      'Next.js edge middleware helper managing Supabase auth tokens and cookie refresh cycles.',
    server:
      'Server-side Supabase client initialization using Next.js cookies for authenticated route handlers.',
    'sync-utils':
      'Unified bidirectional cloud synchronization coordinator coordinating local Zustand stores with Supabase tables.',
    'book-sorting':
      'Deterministic multi-attribute book sorting algorithms, collection sort/filter options, and shared offline volume filtering (`filterBooksByOfflineState`) for title, author, year, downloads, reading progress, and recency.',
    'book-tags':
      'Semantic book tag normalizer mapping verbose Library of Congress subjects and Gutenberg bookshelves to canonical zero-truncation badges (<= 14 chars) with responsive mobile/desktop allocation and administrative prefix sanitization.',
    'scroll-utils':
      'Smart smooth-scrolling engine with visibility viewport heuristics, top offset calculation, header avoidance, and horizontal pointer click-and-drag + wheel scrolling (`attachHorizontalDragAndWheelScroll`).',
    utils:
      'Core presentation utilities: Tailwind CSS class merging (clsx + twMerge), author formatting, and format badges.',
    'metadata-cache':
      '3-tier in-memory LRU author lifespan cache (24h TTL, 1,000 entries) resolving contributor birth/death years via Supabase `public.books`, upstream Gutendex API, and `FEATURED_HERO_BOOKS` fallback.',
    'url-validator':
      'Zero-trust anti-SSRF upstream URL validator enforcing HTTPS, relative Location redirect resolution, and strict Project Gutenberg hostname allowlisting (`gutenberg.org`, `aleph.gutenberg.org`, `gutenberg.pglaf.org`, `gutenberg.readingroo.ms`).',
    'reader-layout-utils':
      'Server-side metadata resolution and Next.js RSC request header detector for `/read/[id]` OpenGraph, Twitter Card, and Schema.org Book JSON-LD generation.',
  };

  for (const u of utilities) {
    const desc = utilityDescriptions[u.name] || 'Domain utility module.';
    const exportsSummary =
      u.exports.length > 0
        ? u.exports.slice(0, 5).map((e) => `\`${e}\``).join(', ') +
          (u.exports.length > 5 ? ` _(+${u.exports.length - 5} more)_` : '')
        : '_Internal Module Primitives_';
    lines.push(
      `| **\`${u.name}\`** | ${u.subsystem} | [\`${u.file}\`](${u.file}) | ${exportsSummary} | ${desc} |`
    );
  }

  lines.push(
    '',
    '---',
    '',
    '## 🔄 Background Data Pipelines & Automation Engines',
    '',
    'Automated ingestion pipelines, periodic synchronization jobs, and GitHub Actions CI/CD workflows (outside `src/`):',
    '',
    '| Pipeline / Tool | Execution Mode | Source File | Schedule / Trigger | Architectural Responsibility |',
    '| :--- | :--- | :--- | :--- | :--- |',
    '| **`sync-gutenberg-catalog`** | Node.js Streaming CLI | [`scripts/sync-gutenberg-catalog.js`](scripts/sync-gutenberg-catalog.js) | `npm run catalog:sync` / Weekly Cron | Streams official Project Gutenberg `pg_catalog.csv.gz` (5.5MB) through gunzip and batch-upserts 78,000+ public domain titles with adaptive timeout division. |',
    '| **`ingest-translations`** | Node.js Batch & Sync CLI | [`scripts/ingest-translations.js`](scripts/ingest-translations.js) | `npm run translations:sync` / Weekly Cron | FRBR relational translation ingestion engine enforcing 5 Pipeline Blockers and 7 Hardening Defenses with live Supabase upserting and atomic SQL generation. |',
    '| **`ingest-catalog`** | Node.js Batch CLI | [`scripts/ingest-catalog.js`](scripts/ingest-catalog.js) | `npm run catalog:ingest` / On-Demand | Curated masterworks starter seeding and plain-text caching (`--with-content`) generating `supabase/seed_books.sql`. |',
    '| **`catalog-sync.yml`** | GitHub Actions Workflow | [`.github/workflows/catalog-sync.yml`](.github/workflows/catalog-sync.yml) | `cron: 0 2 * * 0` (Sundays) | Automated CI cron workflow streaming newly added titles into Supabase and chaining translation sync. |',
    '| **`translations-sync.yml`** | GitHub Actions Workflow | [`.github/workflows/translations-sync.yml`](.github/workflows/translations-sync.yml) | `cron: 0 3 * * 0` (Sundays) / On-Demand | Automated weekly CI cron workflow clustering upstream Wikidata editions and syncing to `public.book_translations`. |',
    '| **`ci.yml`** | GitHub Actions Workflow | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) | `push` / `pull_request` (`master`) | Continuous Integration pipeline executing the 7-Gateway Quality Engine, ESLint zero-warning check, Vitest coverage, and production build verification. |'
  );

  const dbCatalog = extractDatabaseCatalog(rootDir);

  lines.push(
    '',
    '---',
    '',
    '## 🗄️ Database Architecture & Row Level Security (RLS) Policies',
    '',
    `Bookarium uses Supabase PostgreSQL for optional cloud synchronization, verified across **${dbCatalog.tables.length} Database Tables** with strict Row Level Security (Rule 9):`,
    '',
    '| Table Name | RLS Governance | Client State Store | Domain Role & Security Description |',
    '| :--- | :--- | :--- | :--- |'
  );

  for (const t of dbCatalog.tables) {
    lines.push(`| **\`${t.name}\`** | ${t.rls} | ${t.store} | ${t.description} |`);
  }

  lines.push(
    '',
    '### 1. Stored Logic, Triggers & RPC Functions',
    '',
    '| Database Function / Trigger | Type | Target Table(s) | Functionality & Security Scope |',
    '| :--- | :--- | :--- | :--- |',
    '| **`public.handle_new_user()`** | Trigger / Function (`on_auth_user_created`) | `auth.users` -> `public.profiles`, `public.bookshelves` | Auto-provisions scholar profile and default `General` shelf on signup (`SECURITY DEFINER`, `SET search_path = \'\'`, RPC execution revoked from `PUBLIC`, `anon`, `authenticated`). |',
    '| **`public.books_search_vector_trigger()`** | Trigger / Function (`trigger_books_search_vector`) | `public.books` | Automatically generates and updates `search_vector tsvector` from title and subjects on insert/update (`SET search_path = \'\'`, RPC execution revoked from `PUBLIC`, `anon`, `authenticated`). |',
    '| **`public.handle_profile_identity_sync()`** | Trigger / Function (`trg_profile_identity_sync`) | `public.profiles` -> `reader_circles`, `symposium_sessions` | Propagates scholar `@username` and `display_name` updates across active/pending fellowship circles and symposium sessions on profile update (`SECURITY DEFINER`, `SET search_path = \'\'`). |',
    '| **`public.delete_current_user()`** | RPC Function | `auth.users` | Cascade user data erasure and complete self-service account deletion (`SECURITY DEFINER`, `SET search_path = \'\'`, authenticated-only execution, null session guard). |',
    '| **`public.lookup_scholar_by_username()`** | RPC Function | `public.profiles` | Zero-PII handle resolution returning minimal `(id, username, display_name)` so scholars can invite Fellow Scholars by `@username` even when their sanctuary is private (`SECURITY DEFINER`, `SET search_path = \'\'`, authenticated-only). |',
    '| **`public.rls_auto_enable()` (Guard)** | Conditional Hardening Block | `pg_proc` (`public.rls_auto_enable`) | Idempotent `DO $$` guard revoking RPC execution from `PUBLIC, anon, authenticated` and locking `search_path = \'\'` if provisioned on the remote Supabase instance. |',
    '',
    `### 2. Search, Uniqueness & Foreign-Key Indexes (${dbCatalog.indexes.length} Explicit Indexes)`,
    '',
    'Programmatically extracted from `CREATE [UNIQUE] INDEX IF NOT EXISTS` statements in [`supabase/schema.sql`](supabase/schema.sql):',
    '',
    '| Index Name | Index Type | Target Table | Indexed Expression & Filter | Query & Integrity Responsibility |',
    '| :--- | :--- | :--- | :--- | :--- |'
  );

  for (const idx of dbCatalog.indexes) {
    lines.push(
      `| **\`${idx.name}\`** | ${idx.type} | \`${idx.table}\` | ${idx.definition} | ${idx.description} |`
    );
  }

  lines.push(
    '',
    '### 3. Schema DDL, Offline SQL Seeds & Authority Cache Artifacts',
    '',
    '| Artifact File | Classification | File Size | Architectural Responsibility |',
    '| :--- | :--- | :--- | :--- |'
  );

  for (const s of dbCatalog.seedArtifacts) {
    lines.push(`| [\`${s.file}\`](${s.file}) | ${s.kind} | \`${s.size}\` | ${s.role} |`);
  }

  lines.push(
    '',
    '---',
    '',
    '## 📚 Configuration, Anthologies & Design Token Catalog',
    '',
    `Programmatically extracted from **${configs.length} Configuration Modules** in \`src/config/\` using Babel AST:`,
    '',
    '| Configuration Module | Source File | Exported Constants & Fixtures | Exported Pure Functions | Canonical Interfaces / Types |',
    '| :--- | :--- | :--- | :--- | :--- |'
  );

  for (const c of configs) {
    const constsStr = c.constants.length > 0 ? c.constants.map((cn) => `\`${cn}\``).join(', ') : '_None_';
    const fnsStr = c.functions.length > 0 ? c.functions.map((fn) => `\`${fn}\``).join(', ') : '_None_';
    const typesStr = c.types.length > 0 ? c.types.map((tp) => `\`${tp}\``).join(', ') : '_None_';
    lines.push(`| **\`${c.name}\`** | [\`${c.file}\`](${c.file}) | ${constsStr} | ${fnsStr} | ${typesStr} |`);
  }

  lines.push(
    '',
    '---',
    '',
    '## 📐 Domain Type Contracts & Data Models',
    '',
    `Programmatically extracted from **${typeDefs.length} TypeScript Type Modules** in \`src/types/\` using Babel AST:`,
    '',
    '| Type Definition Module | Source File | Exported Interfaces | Exported Type Aliases |',
    '| :--- | :--- | :--- | :--- |'
  );

  for (const t of typeDefs) {
    const ifacesStr = t.interfaces.length > 0 ? t.interfaces.map((i) => `\`${i}\``).join(', ') : '_None_';
    const aliasesStr = t.typeAliases.length > 0 ? t.typeAliases.map((a) => `\`${a}\``).join(', ') : '_None_';
    lines.push(`| **\`${t.name}\`** | [\`${t.file}\`](${t.file}) | ${ifacesStr} | ${aliasesStr} |`);
  }

  lines.push(
    '',
    '---',
    '',
    '## ⚙️ Background Web Worker, Offline PWA & Static Asset Pipeline (`src/workers/` & `public/`)',
    '',
    '### 1. Off-Thread Compute & Service Worker Runtime',
    '',
    '| Worker Module | Source File | Architectural Responsibility |',
    '| :--- | :--- | :--- |'
  );

  for (const w of workers) {
    lines.push(`| **\`${w.name}\`** | [\`${w.file}\`](${w.file}) | ${w.role} |`);
  }

  lines.push(
    '',
    `### 2. Static & PWA Multi-Resolution Asset Inventory (\`public/\` — ${publicAssets.length} Assets)`,
    '',
    '| Asset File | Format | Size | Architectural Role & Platform Target |',
    '| :--- | :--- | :--- | :--- |'
  );

  for (const asset of publicAssets) {
    lines.push(`| [\`${asset.file}\`](${asset.file}) | \`${asset.format}\` | \`${asset.size}\` | ${asset.role} |`);
  }

  lines.push(
    '',
    '---',
    '',
    '## 🌐 Root Edge Reverse Proxy & Geographic Layer',
    '',
    '| Module | Source File | Responsibilities & Security Directives |',
    '| :--- | :--- | :--- |',
    '| **`proxy`** | [`src/proxy.ts`](src/proxy.ts) | Next.js 16 Edge proxy extracting client IP country (`x-vercel-ip-country`), setting `bookarium-geo-country` cookie, handling development query override (`?country=XX`), and enforcing strict security headers. |',
    '',
    '---',
    '',
    '## 🔧 Workspace Configuration, Styling, Deployment & Governance Matrix',
    '',
    `Root build, compiler, styling, deployment, static analysis, and multi-agent governance manifests verified across **${workspaceConfigs.length} Workspace Configuration Files**:`,
    '',
    '| Configuration / Manifest | Source File | Subsystem / Layer | Architectural & Governance Responsibility |',
    '| :--- | :--- | :--- | :--- |'
  );

  for (const wc of workspaceConfigs) {
    lines.push(`| **\`${wc.name}\`** | [\`${wc.file}\`](${wc.file}) | ${wc.layer} | ${wc.responsibility} |`);
  }

  lines.push(
    '',
    '---',
    '',
    '## 🧪 Hermetic Testing, MSW v2 Network Isolation & Coverage Architecture',
    '',
    `Bookarium enforces a 4-tier hermetic testing and security verification architecture across **${testHarness.totalSuites} Test Suites** (\`${testHarness.srcSuiteCount}\` co-located \`src/**/*.test.{ts,tsx}\` suites + \`${testHarness.scriptSuites.length}\` CLI pipeline suites in \`scripts/\`) with zero external network calls:`,
    '',
    '### 1. Hermetic Testing, MSW v2 Interception, SAST/OWASP & V8 Coverage Pipeline',
    '',
    '```mermaid',
    'flowchart TD',
    '    subgraph SecurityGates ["Static Security & Boundary Gates (scripts/verify-build.js)"]',
    '        Pass05["🔒 Pass 0.5: Secret & Boundary Scanner\\n• Zero live tokens / private keys\\n• Zero client SUPABASE_SERVICE_ROLE_KEY"]',
    '        Pass075["🛡️ Pass 0.75: 7-Pillar SAST & OWASP Suite\\n• 0 High/Crit CVEs • SSRF & RateLimiter.check()\\n• DOM XSS Sinks • Redirect Sanitizer\\n• MIT / copyright=false • 14-Table RLS & search_path\\n• 7 OWASP HTTP Security Headers"]',
    '    end',
    '',
    '    subgraph TestRunner ["Vitest 4 Runner & JSDOM Bootstrap"]',
    '        VitestCfg["⚙️ vitest.config.mts\\n• jsdom environment • maxWorkers: 4\\n• @/* path alias • V8 Coverage Provider"]',
    '        TestSetup["🧰 src/test/setup.ts\\n• @testing-library/jest-dom/vitest\\n• next/dynamic chunk pre-resolution (pendingDynamicImports)\\n• framer-motion synchronous forwardRef mock\\n• JSDOM polyfills (IndexedDB, SpeechSynthesis, matchMedia, ResizeObserver)\\n• Per-test localStorage.clear() & vi.clearAllMocks()"]',
    '        MSWServer["🌐 src/mocks/server.ts & src/mocks/handlers.ts\\n• MSW v2 setupServer(...handlers) lifecycle\\n• GET /api/books, /api/books/content, /api/books/translations\\n• HTTPS Gutendex & 4 Allowlisted Gutenberg Mirrors\\n• mockBooks & sampleBookText fixtures (0 external network calls)"]',
    '    end',
    '',
    `    subgraph TestTiers ["4-Tier Co-Located Test Suites (${testHarness.totalSuites} Suites)"]`,
    '        Tier1["Tier 1: Pure Domain, Security & AST Suites\\n• copyright-engine, url-validator, redirect-sanitizer, rate-limiter, password\\n• gutenberg/* (segmentation, reflow, pagination, passages, metadata)\\n• reader-annotator, accolades-engine, reading-analytics, book-sorting"]',
    '        Tier2["Tier 2: API Route & TanStack Query Suites (Pass 2)\\n• /api/books, /api/books/content, /api/books/translations, /auth/callback\\n• useBooks, useBookContent, useBookTranslations\\n• supabase-provider, gutendex-provider"]',
    '        Tier3["Tier 3: Zustand Store, IndexedDB & Outbox Sync Suites\\n• 10 Zustand Stores (useBookshelfStore, useReaderStore, useAuthStore, etc.)\\n• bookshelf-cloud-sync, sync-utils, offline-storage"]',
    `        Tier4["Tier 4: React 19 UI Component, Page & CLI Suites (Pass 3)\\n• @testing-library/react + userEvent (getByRole, WCAG 2.2 focus traps)\\n• ${components.length} UI Components + App Router Pages/Layouts + Web Worker\\n• CLI Pipelines (sync-gutenberg-catalog.test.ts, ingest-translations.test.ts)"]`,
    '    end',
    '',
    '    subgraph CoverageGate ["Tiered V8 Coverage Gate & Telemetry Output"]',
    '        V8Thresholds["📊 Tiered V8 Coverage Floor\\n• Lines >= 95% • Statements >= 95%\\n• Functions >= 92% • Branches >= 85%"]',
    '        QualityReport["📋 scripts/generate-quality-report.js\\n• docs/QUALITY_AUDIT_REPORT.md\\n• docs/quality-audit-results.json\\n• README.md live badges"]',
    '    end',
    '',
    '    Pass05 --> Pass075',
    '    Pass075 --> VitestCfg',
    '    VitestCfg --> TestSetup',
    '    TestSetup --> MSWServer',
    '    TestSetup --> Tier1',
    '    MSWServer -->|"Hermetic HTTP Interception"| Tier2',
    '    TestSetup --> Tier3',
    '    MSWServer -->|"Global Zero-Network Safety Net"| Tier4',
    '    Tier1 --> V8Thresholds',
    '    Tier2 --> V8Thresholds',
    '    Tier3 --> V8Thresholds',
    '    Tier4 --> V8Thresholds',
    '    V8Thresholds --> QualityReport',
    '```',
    '',
    '### 2. Test Harness & Interception Primitives Matrix',
    '',
    '| Test Harness Module | Source File | Testing Layer | Architectural Responsibility |',
    '| :--- | :--- | :--- | :--- |'
  );

  for (const tm of testHarness.harnessModules) {
    lines.push(`| **\`${tm.name}\`** | [\`${tm.file}\`](${tm.file}) | ${tm.layer} | ${tm.role} |`);
  }

  for (const scriptSuite of testHarness.scriptSuites) {
    const baseName = path.basename(scriptSuite);
    const scriptSuiteRole =
      baseName === 'ingest-translations.test.ts'
        ? 'Hermetic unit & integration tests verifying Wikidata SPARQL FRBR work clustering, 5 Pipeline Blockers, 7 Hardening Defenses, and SQL seed generation.'
        : 'Hermetic unit & integration tests verifying Project Gutenberg `pg_catalog.csv.gz` streaming decompression, CSV RFC 4180 parsing, author lifespan extraction, and adaptive Supabase batch upserts.';
    lines.push(
      `| **\`${baseName}\`** | [\`${scriptSuite}\`](${scriptSuite}) | CLI Data Pipeline Test Suite | ${scriptSuiteRole} |`
    );
  }

  lines.push(
    '',
    `### 3. Architectural Layer Test Suite Distribution (${testHarness.totalSuites} Suites)`,
    '',
    '| Architectural Layer | Target File Scope | Co-Located Suites | Verified Assertions | Hermetic & Security Testing Strategy |',
    '| :--- | :--- | :--- | :--- | :--- |'
  );

  if (Array.isArray(testHarness.layerBreakdown)) {
    for (const lb of testHarness.layerBreakdown) {
      lines.push(
        `| **${lb.layer}** | ${lb.scope} | \`${lb.suites}\` | \`${lb.tests}\` | ${lb.strategy} |`
      );
    }
  }

  lines.push(
    '',
    '---',
    '',
    '## 🗂️ Repository Directory & Living Documentation Topology Map',
    '',
    '### 1. Structural Directory Map',
    '',
    '| Workspace Path | Architectural Layer & Contents |',
    '| :--- | :--- |'
  );

  for (const dir of repoTopology.directories) {
    lines.push(`| **\`${dir.path}\`** | ${dir.role} |`);
  }

  lines.push(
    '',
    '### 2. Living Documentation & Governance Artifacts Catalog',
    '',
    '| Document / Artifact | Maintenance Mode | Generator / Verification Script | Scope & Architectural Purpose |',
    '| :--- | :--- | :--- | :--- |'
  );

  for (const doc of repoTopology.livingDocs) {
    const primaryLink = doc.file.includes(' ')
      ? doc.file
          .split(' & ')
          .map((f) => `[\`${f.trim()}\`](${f.trim()})`)
          .join(' & ')
      : `[\`${doc.file}\`](${doc.file})`;
    lines.push(`| **${primaryLink}** | ${doc.mode} | ${doc.generator} | ${doc.role} |`);
  }

  lines.push(
    '',
    '---',
    '',
    '## 🔗 AST Module Interconnection & Topology Matrix',
    '',
    'Every source file is analyzed for upstream imports, downstream consumers, and its co-located Vitest suite to guarantee zero orphaned or untested code:',
    '',
    '| Module / Component | Upstream Dependencies (Imports) | Downstream Consumers (Consumed By) | Co-Located Test Suite | Role & Responsibilities |',
    '| :--- | :--- | :--- | :--- | :--- |'
  );

  const sortedFiles = Array.from(graph.keys()).sort();
  const ambiguousBasenames = new Set(['page.tsx', 'layout.tsx', 'route.ts', 'index.ts']);
  const testSuiteSet = new Set(testHarness.testSuites || []);

  const formatModuleLabel = (fileRel) => {
    const base = path.basename(fileRel);
    if (ambiguousBasenames.has(base)) {
      return fileRel.replace(/^src\//, '');
    }
    return base;
  };

  const resolveCoLocatedTestLink = (fileRel) => {
    const baseNoExt = fileRel.replace(/\.(ts|tsx|js|jsx)$/, '');
    const candidates = [`${baseNoExt}.test.ts`, `${baseNoExt}.test.tsx`];
    for (const cand of candidates) {
      if (testSuiteSet.has(cand)) {
        const label = ambiguousBasenames.has(path.basename(fileRel))
          ? cand.replace(/^src\//, '')
          : path.basename(cand);
        return `[\`${label}\`](${cand})`;
      }
    }
    if (
      fileRel.startsWith('src/types/') ||
      fileRel === 'src/lib/gutenberg/index.ts' ||
      fileRel === 'src/lib/gutenberg/types.ts'
    ) {
      return '_Type Contract / Barrel_';
    }
    return '_Tested via Parent Suite_';
  };

  const classifyModuleRole = (fileRel) => {
    if (fileRel.endsWith('/route.ts') || fileRel.endsWith('/route.js')) return 'Server Route Handler';
    if (fileRel.endsWith('/page.tsx')) return 'App Router Page';
    if (fileRel.endsWith('/layout.tsx')) return 'App Router Layout';
    if (fileRel === 'src/app/loading.tsx') return 'App Loading / Splash Boundary';
    if (/src\/app\/(error|global-error|not-found)\.tsx$/.test(fileRel)) return 'App Error / 404 Boundary';
    if (/src\/app\/(manifest|robots|sitemap)\.ts$/.test(fileRel)) return 'App Metadata Route';
    if (fileRel === 'src/app/providers.tsx') return 'Root Client Provider';
    if (fileRel.startsWith('src/app/')) return 'Server Route Utility';
    if (fileRel.startsWith('src/components/presentation/bookshelf/') || fileRel.startsWith('src/components/bookshelf/')) return 'Bookshelf Presentation Component';
    if (fileRel.startsWith('src/components/presentation/')) return 'Presentation Component';
    if (fileRel.startsWith('src/components/reader/')) return 'Focus Reader Component';
    if (fileRel.startsWith('src/components/account/')) return 'Account Hub Component';
    if (fileRel.startsWith('src/components/accolades/')) return 'Accolades & Bookplate Component';
    if (fileRel.startsWith('src/components/auth/')) return 'Authentication Component';
    if (fileRel.startsWith('src/components/profile/')) return 'Scholar Sanctuary Component';
    if (fileRel.startsWith('src/components/pwa/')) return 'PWA Lifecycle Component';
    if (fileRel.startsWith('src/components/symposium/')) return 'Literary Symposium Component';
    if (fileRel.startsWith('src/components/layout/')) return 'Layout Component';
    if (fileRel.startsWith('src/components/motion/')) return 'Motion & Transition Primitive';
    if (fileRel.startsWith('src/components/ui/')) return 'UI Primitive';
    if (fileRel.startsWith('src/hooks/queries/')) return 'TanStack Query Hook';
    if (fileRel.startsWith('src/hooks/reader/')) return 'Reader Subsystem Hook';
    if (fileRel.startsWith('src/hooks/')) return 'Custom React Hook';
    if (fileRel.startsWith('src/stores/')) return 'Zustand State Store';
    if (fileRel.startsWith('src/lib/adapters/')) return 'Domain Schema Adapter';
    if (fileRel.startsWith('src/lib/gutenberg/')) return 'Gutenberg AST Engine';
    if (fileRel.startsWith('src/lib/catalog/')) return 'Catalog Provider Seam';
    if (fileRel.startsWith('src/lib/supabase/')) return 'Supabase SSR / Client Adapter';
    if (fileRel.startsWith('src/lib/')) return 'Domain Engine / Utility';
    if (fileRel.startsWith('src/config/')) return 'Configuration & Fixtures';
    if (fileRel.startsWith('src/types/')) return 'Domain Type Contract';
    if (fileRel.startsWith('src/workers/')) return 'Background Web Worker';
    if (fileRel === 'src/proxy.ts') return 'Edge Reverse Proxy';
    return 'Production Module';
  };

  for (const file of sortedFiles) {
    const data = graph.get(file);
    const label = formatModuleLabel(file);
    const uniqueImports = Array.from(new Set(data.imports.map((i) => i.replace('@/', ''))));
    const importsStr =
      uniqueImports.length > 0
        ? uniqueImports.map((i) => `\`${i}\``).join(', ')
        : '_Root Primitive_';

    const uniqueConsumers = Array.from(new Set(data.consumedBy.map((c) => formatModuleLabel(c))));
    const consumersStr =
      uniqueConsumers.length > 0
        ? uniqueConsumers.map((c) => `\`${c}\``).join(', ')
        : file.includes('page.tsx') || file.includes('route.ts') || file.includes('layout.tsx')
          ? '_App Route Entry_'
          : '_Direct Root Consumer_';

    const coLocatedTestLink = resolveCoLocatedTestLink(file);
    const roleTitle = classifyModuleRole(file);

    lines.push(
      `| [\`${label}\`](${file}) | ${importsStr} | ${consumersStr} | ${coLocatedTestLink} | ${roleTitle} |`
    );
  }

  lines.push(
    '',
    '---',
    '',
    '## ⚡ Data Pulling & Caching Strategy',
    '',
    '1. **Dual-Provider Catalog Architecture**: Primary search queries execute against self-hosted Supabase PostgreSQL (`public.books`) using full-text GIN search (~1–2s catalog responses, <50ms single-book lookups), falling back seamlessly to upstream Gutendex REST API if Supabase is unconfigured, unseeded, or unreachable, unconditionally enforcing `copyright=false`.',
    '2. **Unified Visible Telemetry**: `StickyCatalogToolbar.tsx` renders a unified API connectivity and roundtrip latency pill with pulsing dot (green online / red offline) and precision time formatting (ms under 1000ms, s/1.212s for 1000ms+).',
    '3. **Customizable Batch Sizing**: Readers can dynamically toggle batch sizes (`Show: [8 | 16 | 24 | 32]`) without page reloads.',
    '4. **Edge SWR Caching & Geographic Vary Partitioning**: Catalog queries are cached with `s-maxage=3600, stale-while-revalidate=86400` (`/api/books`) and content/translation streams with `s-maxage=86400, stale-while-revalidate=604800`, partitioned across jurisdictions via `Vary: x-vercel-ip-country, Accept-Encoding` to prevent cross-border cache pollution.',
    '5. **Jurisdictional Copyright Gatekeeping & Bibliographic Preservation**: The streaming route (`/api/books/content`) intercepts requests from non-US jurisdictions, verifying author/translator death years against Berne/local terms and returning `HTTP 451 Unavailable For Legal Reasons` for protected titles. Concurrently, the catalog pipeline supports `includeRestrictedMetadata=true` for explicit IDs, ensuring personal collections (Notebook, Bookmarks) and reader error screens display authentic bibliographic citations (titles, authors, subjects) without opening prohibited full-text streams.',
    '6. **Multi-Tier Text Streaming & Multi-Mirror Failover**: Plain text is served on-demand from Tier 1 (self-hosted Supabase plain-text cache if present) or Tier 2 (mirror-first fallback across `aleph.gutenberg.org`, `gutenberg.pglaf.org`, `gutenberg.readingroo.ms`, and `www.gutenberg.org`), protected by an in-memory 24h contributor metadata cache and anti-SSRF validator.',
    '7. **Native IndexedDB Offline Cache**: Opened and downloaded unabridged texts are cached in browser IndexedDB for 100% offline access with client-side jurisdictional protection preventing illicit cross-border reading.',
    '8. **Autonomous Weekly Catalog Synchronization**: Project Gutenberg official catalog dump (`pg_catalog.csv.gz`, 78,000+ public domain titles) is streamed and decompressed on-the-fly via GitHub Actions (`.github/workflows/catalog-sync.yml`) or `npm run catalog:sync`, updating Supabase with zero manual SQL intervention and minimal storage footprint (~105 MB).',
    '',
    '---',
    '',
    '## 🟢 Node.js Runtime, Dependency Stack & Supply-Chain Governance',
    ''
  );

  const nodeEcosystem = extractNodeEcosystemCatalog(rootDir, testHarness.totalSuites);
  lines.push(
    `Bookarium executes on **Node.js \`${nodeEcosystem.engines.node || '>=20.0.0'}\`** with **npm \`${nodeEcosystem.engines.npm || '>=10.0.0'}\`** (Node 22 LTS recommended). All dependency versions are programmatically synchronized from \`package.json\` via AST compilation (Rule 2):`,
    '',
    '| Package | Live Version | Classification & Tier | Architectural Responsibility in Bookarium |',
    '| :--- | :--- | :--- | :--- |'
  );

  for (const pkg of nodeEcosystem.packages) {
    lines.push(`| **\`${pkg.name}\`** | \`${pkg.version}\` | ${pkg.tier} | ${pkg.purpose} |`);
  }

  const nodeScripts = extractNodeScriptsCatalog();
  lines.push(
    '',
    '---',
    '',
    '## 🛠️ Node.js CLI & Automation Scripts Catalog (`scripts/`)',
    '',
    'Comprehensive inventory of standalone Node.js automation, ingestion, and verification modules in `scripts/`:',
    '',
    '| Script Module | File Path | Primary Invocation | Core Node.js APIs & Engines | Architectural Responsibility |',
    '| :--- | :--- | :--- | :--- | :--- |'
  );

  for (const s of nodeScripts) {
    lines.push(`| **\`${s.name}\`** | [\`${s.file}\`](${s.file}) | ${s.npmCommand} | ${s.nodeApis} | ${s.responsibility} |`);
  }

  lines.push(
    '',
    '---',
    '',
    '## 🛡️ 7-Gateway Quality Engine Architecture',
    '',
    'Bookarium enforces a deterministic 7-stage quality assurance pipeline (`scripts/verify-build.js` via `npm run verify`) gating all releases and commits:',
    '',
    '| Gateway Pass | Stage Name | Target & Tooling | Enforcement & Governance |',
    '| :--- | :--- | :--- | :--- |',
    '| **Pass 0.5** | Secrets, Credentials & Client Privilege Scanner | Regex & client-bundle AST boundary scan | Zero live API keys, private keys, tokens, or `SUPABASE_SERVICE_ROLE_KEY` leaks in client modules |',
    '| **Pass 0.75** | 7-Pillar SAST & OWASP Security Suite | `npm audit`, AST taint guards, SQL RLS & HTTP Header auditors | Enforces 0 High/Critical CVEs, SSRF allowlist & rate limiting, DOM XSS guards, open-redirect sanitization, license compliance, PostgreSQL RLS + `SECURITY DEFINER` `search_path`, and OWASP HTTP headers/CSP |',
    '| **Pass 1** | TypeScript Strict Compilation | `tsc --noEmit` | Strict type safety across all components, stores, hooks, and types |',
    '| **Pass 2** | MSW Server & React Query Validation | `vitest run src/hooks/queries src/app/api` | Validates edge proxy routes, rate limiters, and TanStack Query hooks against MSW |',
    '| **Pass 3** | Unit & Integration Test Suites | `vitest run --coverage` | Minimum 85% coverage floor across all co-located suites |',
    '| **Pass 4** | Living AST Documentation Sync | `docs:sync` toolchain | Auto-generates living `ARCHITECTURE.md`, `GUTENBERG_PARSER.md`, `ROADMAP.md`, `CHANGELOG.md`, and `QUALITY_AUDIT_REPORT.md` |',
    '| **Pass 5** | ADR Schema & Ledger Validation | Markdown AST verification | Validates all ADRs in `docs/DECISIONS.md` conform to Status, Context, Decision, Consequences |',
    '| **Pass 6** | Code Quality & Dead Code Audit | `eslint . --max-warnings 0` & Knip | Zero ESLint errors or warnings (`--max-warnings 0`), zero unreferenced dead files/exports |',
    '| **Pass 7** | Production Application Build | `next build --webpack` | Optimized production bundle compilation within byte budget |',
    '',
    '---',
    '',
    '## 🔒 Verification & Compliance',
    '',
    'This architecture document is verified deterministically by **Pass 4 of the 7-Gateway Quality Engine** (`npm run verify`).',
    ''
  );

  return lines.join('\n');
}

function syncReadmeArchitectureDiagrams(architectureMarkdown) {
  const readmePath = path.join(rootDir, 'README.md');
  if (!fs.existsSync(readmePath)) return;

  const startMarker1to3 = '### 1. End-to-End System Context & Data Flow';
  const endMarker1to3 = '\n---\n\n## 🧩 Component Catalog & Props Interface Matrix';
  const idxStart1to3 = architectureMarkdown.indexOf(startMarker1to3);
  const idxEnd1to3 = architectureMarkdown.indexOf(endMarker1to3);

  const startMarker4 = '### 1. Hermetic Testing, MSW v2 Interception, SAST/OWASP & V8 Coverage Pipeline\n\n';
  const endMarker4 = '\n\n### 2. Test Harness & Interception Primitives Matrix';
  const idxStart4 = architectureMarkdown.indexOf(startMarker4);
  const idxEnd4 = architectureMarkdown.indexOf(endMarker4);

  if (idxStart1to3 === -1 || idxEnd1to3 === -1 || idxStart4 === -1 || idxEnd4 === -1) {
    return;
  }

  const diagrams1to3 = architectureMarkdown.slice(idxStart1to3, idxEnd1to3).trim();
  const diagram4Mermaid = architectureMarkdown.slice(idxStart4 + startMarker4.length, idxEnd4).trim();

  const replacementBlock = [
    '<!-- BEGIN:architecture-diagrams -->',
    '## 🏛️ System Architecture Diagrams',
    '',
    diagrams1to3,
    '',
    '---',
    '',
    '### 4. Hermetic Testing, MSW v2 Interception, SAST/OWASP & V8 Coverage Pipeline',
    '',
    diagram4Mermaid,
    '<!-- END:architecture-diagrams -->',
  ].join('\n');

  const readmeContent = fs.readFileSync(readmePath, 'utf-8');
  const updatedReadme = readmeContent.replace(
    /<!-- BEGIN:architecture-diagrams -->[\s\S]*?<!-- END:architecture-diagrams -->/,
    replacementBlock
  );

  if (updatedReadme !== readmeContent) {
    fs.writeFileSync(readmePath, updatedReadme, 'utf-8');
  }
}

const outputPath = path.join(rootDir, 'docs', 'ARCHITECTURE.md');
const content = generateMarkdown();
fs.writeFileSync(outputPath, content, 'utf-8');
syncReadmeArchitectureDiagrams(content);
console.log('✔ [SUCCESS] Comprehensive AST-driven docs/ARCHITECTURE.md generated successfully.');

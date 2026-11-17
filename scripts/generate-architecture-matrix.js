const fs = require('fs');
const path = require('path');
const {
  resolveImportPath,
  getDeterministicTextOrBinaryBytes,
  analyzeDependencyGraph,
  detectCircularDependencies,
  detectLayerViolations,
  detectOrphanedModules,
  analyzeScriptsDependencyGraph,
  extractCrossBoundaryCouplingCatalog,
  extractComponentCatalog,
  extractStoreCatalog,
  extractApiAndHookCatalog,
  extractDomainUtilitiesCatalog,
  extractConfigurationCatalog,
  extractTypeCatalog,
  extractServiceWorkerMetadata,
  extractWorkerCatalog,
  extractSqlSchemaEntities,
  extractTestHarnessCatalog,
  extractTestHarnessAstDependencies,
  extractPublicAssetsCatalog,
  extractEnvironmentDependencyCatalog,
} = require('./lib/ast-parser');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

function extractDatabaseCatalog(rootDirPath) {
  const schemaPath = path.join(rootDirPath, 'supabase', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    return {
      tables: [],
      functions: [],
      triggers: [],
      policyCount: 0,
      checkConstraintCount: 0,
      indexes: [],
      seedArtifacts: [],
    };
  }
  const content = fs.readFileSync(schemaPath, 'utf-8');
  const sqlEntities = extractSqlSchemaEntities(content);

  const tables = [];
  if (sqlEntities.hasMigrationLedger) {
    tables.push({
      name: 'supabase_migrations.schema_migrations',
      rls: 'Enabled (`No Client Access`)',
      writeAuth: '`service_role` / Supabase Migration Runner',
      store: '_Supabase CLI / Studio Tracker_',
      description: 'Internal Supabase migration ledger preventing `42P01` dashboard warnings and tracking applied DDL versions with RLS enabled.',
    });
  }

  const storeMap = {
    profiles: '`useAuthStore` / `usePreferencesStore` / `useFellowshipStore` (`fellowship-cloud-sync.ts`) / `/u/[username]` (`page.tsx`, `profile-layout-utils.ts`)',
    bookshelves: '`useBookshelfStore` (`bookshelf-cloud-sync.ts`)',
    bookshelf_items: '`useBookshelfStore` (`bookshelf-cloud-sync.ts`)',
    user_favorites: '`useBookshelfStore` (`bookshelf-cloud-sync.ts`)',
    reading_progress: '`useReaderStore` (`reader-cloud-sync.ts`)',
    user_annotations: '`useAnnotationStore` (`annotation-cloud-sync.ts`)',
    user_book_curation: '`useBookshelfStore` (`bookshelf-cloud-sync.ts`)',
    user_reading_habits: '`useHabitsStore`',
    user_accolades: '`useAccoladesStore`',
    books: '`SupabaseCatalogProvider` / `useFeaturedQuotes` / `useQuoteEnrichedBooks` / `sync-gutenberg-catalog.js` / `sync-featured-quotes.js`',
    book_translations: '`useBookTranslations` / `SupabaseCatalogProvider` / `ingest-translations.js`',
    reader_circles: '`useFellowshipStore` (`fellowship-cloud-sync.ts`)',
    symposium_sessions: '`useFellowshipStore` (`fellowship-cloud-sync.ts`)',
  };

  const writeAuthMap = {
    books: '`TO service_role` Only (`catalog-sync.yml`, `quotes-sync.yml`, CLI)',
    book_translations: '`TO service_role` Only (`translations-sync.yml`, `catalog-sync.yml`, CLI)',
    reader_circles: '`auth.uid()` Participant (`requester_id` / `recipient_id`)',
    symposium_sessions: '`auth.uid()` Participant (`host_id` / `fellow_id`)',
  };

  const descMap = {
    profiles: 'User profile display name, `@username` handle, theme preferences, typography choices, and unified `preferences` JSONB (`active` & `customDefaults` presets, auto-created on signup, with opt-in `is_public` anonymous SSR/client reads for `/u/[username]` (`serverProfileCache` 5m LRU + SQL `ILIKE` wildcard post-filter) and companion identity RLS resolution for Reader Circles & Symposiums).',
    bookshelves: 'Default master "General" shelf and custom user-created named shelves.',
    bookshelf_items: 'Books filed in specific shelves with user-scoped uniqueness constraints.',
    user_favorites: 'Cross-device synchronized favorited titles.',
    reading_progress: 'Chapter index, progress %, in-page row bookmark offsets, highlighted bookmark line text (`bookmark_text`), and cached volume metadata.',
    user_annotations: 'Passage text highlights (4 pastel palettes), scholarly notes, and cross-volume Symposium Fellow marginalia.',
    user_book_curation: 'Personal 1–5 star ratings and reading status classification.',
    user_reading_habits: 'Reading streaks (5-min threshold), daily activity dates, annual challenge goals, completed books count, and dual immersion telemetry.',
    user_accolades: 'Unlocked literary accolades, timestamps, showcase pinning, and personal bookplate metadata.',
    books: 'Dedicated Supabase public domain catalog (`78,000+` rows) with GIN full-text search vector, pre-computed author lifespan bounds, primary `quotes` JSONB (`10–16` multi-quote spreads per volume across the `<= 564` Two-Tier Bounded Quote Pool), and optional plain-text caching.',
    book_translations: 'Relational FRBR literary work clusters (`4,500+` rows) mapping Project Gutenberg editions across languages with zero false positives.',
    reader_circles: 'Mutual Literary Fellowship pairings (pending/accepted) with RLS participant isolation.',
    symposium_sessions: 'Dual-reading Literary Symposium sessions tracking shared volume progress and chapter coordinates for two fellows.',
  };

  for (const tableName of sqlEntities.tableNames) {
    tables.push({
      name: `public.${tableName}`,
      rls: tableName === 'books' || tableName === 'book_translations' ? 'Enabled (`Public Read`)' : 'Enabled (`auth.uid()`)',
      writeAuth: writeAuthMap[tableName] || '`auth.uid() = user_id` (Authenticated Scholar)',
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
    idx_books_search_vector: 'Inverted GIN index on `search_vector` TSVECTOR for sub-second multi-word full-text and subject/bookshelf catalog search.',
    idx_books_languages: 'Inverted GIN index on `languages` TEXT[] for array-containment language filtering (`languages && ARRAY[...]`).',
    idx_books_download_count: 'Descending B-Tree index on `(download_count DESC)` for popularity sorting across 78,000+ volumes.',
    idx_books_with_quotes_popular: 'Partial descending B-Tree index on `(download_count DESC) WHERE quotes <> \'[]\'::jsonb` for sub-10ms lookups of quote-enriched volumes.',
    idx_books_author_death_year: 'B-Tree index on `(max_author_death_year)` for sub-50ms server-side jurisdictional copyright filtering.',
    idx_book_translations_book_id: 'B-Tree index on `(book_id)` for instant single-book translation lookups in `ReaderLanguageDrawer`.',
    idx_book_translations_work_lang: 'Composite B-Tree index on `(work_id, language)` for canonical FRBR literary work cluster traversal and language-filtered edition resolution (alongside `book_translations_pkey (work_id, book_id)`).',
    idx_reader_circles_requester: 'B-Tree index on `(requester_id)` for outbound Reader Circle fellowship and companion RLS lookups.',
    idx_reader_circles_recipient: 'B-Tree index on `(recipient_id)` for inbound Reader Circle invitation and companion RLS lookups.',
    idx_symposium_sessions_host: 'B-Tree index on `(host_id)` for host-side Literary Symposium and fellow marginalia RLS evaluation.',
    idx_symposium_sessions_fellow: 'B-Tree index on `(fellow_id)` for fellow-side Literary Symposium and companion progress queries.',
    idx_symposium_sessions_book: 'B-Tree index on `(book_id)` for volume-scoped Symposium session and shared annotation lookups.',
  };

  const indexes = sqlEntities.indexes.map((idx) => ({
    ...idx,
    description: indexDescMap[idx.name] || `Index on \`${idx.table}\`.`,
  }));

  const triggers = sqlEntities.triggers;
  const triggersByFunction = sqlEntities.triggersByFunction;

  // Extract stored functions / trigger procedures from CREATE OR REPLACE FUNCTION public.<name>
  const functionMetaMap = {
    handle_new_user: {
      targetTables: '`auth.users` -> `public.profiles`, `public.bookshelves`',
      description:
        'Auto-provisions scholar profile and default `General` shelf on signup (`SECURITY DEFINER`, `SET search_path = \'\'`, RPC execution revoked from `PUBLIC`, `anon`, `authenticated`).',
    },
    delete_current_user: {
      targetTables: '`auth.users`',
      description:
        'Atomic server-side 11-table + `storage.objects` user data erasure prior to `auth.users` account deletion (`SECURITY DEFINER`, `SET search_path = \'\'`, authenticated-only execution, null session guard).',
    },
    books_search_vector_trigger: {
      targetTables: '`public.books`',
      description:
        'Automatically generates and updates `search_vector tsvector` from `title`, `subjects`, and `bookshelves` on insert or when `title`, `subjects`, or `bookshelves` change (`IS DISTINCT FROM` guard skips `to_tsvector()` recomputation on `download_count`-only updates; `SET search_path = \'\'`, RPC execution revoked from `PUBLIC`, `anon`, `authenticated`).',
    },
    lookup_scholar_by_username: {
      targetTables: '`public.profiles`',
      description:
        'Zero-PII handle resolution returning minimal `(id, username, display_name)` so scholars can invite Fellow Scholars by `@username` even when their sanctuary is private (`SECURITY DEFINER`, `SET search_path = \'\'`, authenticated-only, `1..64` char input bounds guard).',
    },
    handle_profile_identity_sync: {
      targetTables: '`public.profiles` -> `reader_circles`, `symposium_sessions`',
      description:
        'Propagates scholar `@username` and `display_name` updates across active/pending fellowship circles and symposium sessions on profile update (`SECURITY DEFINER`, `SET search_path = \'\'`, RPC execution revoked from `PUBLIC`, `anon`, `authenticated`).',
    },
    enforce_fellowship_update_guard: {
      targetTables: '`public.reader_circles`, `public.symposium_sessions`',
      description:
        'Locks immutable keys, acceptance authority, and opposite-participant progress/identity columns against unauthorized modification (`SECURITY DEFINER`, `SET search_path = \'\'`, RPC execution revoked from `PUBLIC`, `anon`, `authenticated`).',
    },
    get_active_sessions: {
      targetTables: '`auth.sessions` (read-only)',
      description:
        'Lists the signed-in user\'s non-expired sessions from `auth.sessions` with `is_current` claim detection (`auth.jwt() ->> \'session_id\'`) and SQL-level IP masking (`127.0.0.1` / `::1` preserved, IPv4 `.x`, IPv6 `/48 ::x`; `SECURITY DEFINER`, `SET search_path = \'\'`, RPC execution revoked from `PUBLIC` and `anon`, granted strictly to `authenticated`).',
    },
    revoke_user_session: {
      targetTables: '`auth.sessions`',
      description:
        'Deletes a single session row in `auth.sessions` strictly owned by `(select auth.uid())` (`WHERE id = target_session_id AND user_id = auth.uid()`) for individual device revocation (`SECURITY DEFINER`, `SET search_path = \'\'`, RPC execution revoked from `PUBLIC` and `anon`, granted strictly to `authenticated`).',
    },
  };

  const functions = sqlEntities.functions.map(({ rawName, returnType }) => {
    const attachedTriggers = triggersByFunction.get(rawName) || [];
    const triggerNames = attachedTriggers.map((t) => `\`${t.name}\``).join(', ');
    const fnType =
      returnType === 'TRIGGER' || attachedTriggers.length > 0
        ? `Trigger / Function (${triggerNames || 'Row Trigger'})`
        : 'RPC Function';
    const meta = functionMetaMap[rawName];

    return {
      name: `public.${rawName}()`,
      rawName,
      type: fnType,
      targetTables:
        meta?.targetTables ||
        (attachedTriggers.length > 0
          ? attachedTriggers.map((t) => `\`${t.table}\``).join(', ')
          : '`public.*`'),
      description: meta?.description || 'Stored database function or trigger.',
    };
  });

  if (sqlEntities.hasRlsAutoEnable) {
    functions.push({
      name: 'public.rls_auto_enable() (Guard)',
      rawName: 'rls_auto_enable',
      type: 'Conditional Hardening Block',
      targetTables: '`pg_proc` (`public.rls_auto_enable`)',
      description:
        'Idempotent `DO $$` guard revoking RPC execution from `PUBLIC, anon, authenticated` and locking `search_path = \'\'` if provisioned on the remote Supabase instance.',
    });
  }

  const policyCount = sqlEntities.policyCount;
  const checkConstraintCount = sqlEntities.checkConstraintCount;

  const seedCandidates = [
    {
      file: 'supabase/schema.sql',
      kind: 'Canonical Idempotent DDL & RLS Schema',
      role: `Single source of truth defining all ${tables.length} database tables, ${policyCount} granular RLS policies (with \`(select auth.uid())\` \`InitPlan\` scalar subquery wrapping and single-permissive-policy-per-action consolidation), ${functions.length} stored functions/triggers (${triggers.length} row triggers), ${checkConstraintCount} payload ceiling CHECK constraints, and ${indexes.length} explicit search/uniqueness indexes.`,
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
      const byteSize = getDeterministicTextOrBinaryBytes(
        path.join(rootDirPath, s.file),
        s.file
      );
      return {
        ...s,
        size: `${(byteSize / 1024).toFixed(1)} KB`,
      };
    });

  return {
    tables,
    functions,
    triggers,
    policyCount,
    checkConstraintCount,
    indexes,
    seedArtifacts,
  };
}

function extractNodeEcosystemCatalog(rootDirPath, totalSuites = 194) {
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
    '@types/node': 'TypeScript definitions for Node.js runtime and standard library APIs.',
    '@types/react': 'TypeScript definitions for React 19 core primitives.',
    '@types/react-dom': 'TypeScript definitions for React DOM.',
    '@vitejs/plugin-react': 'Fast React transform plugin for Vitest test execution.',
    '@vitest/coverage-v8': 'Native V8 code coverage provider enforcing tiered 95/95/92/85% test thresholds.',
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
    '@typescript-eslint/typescript-estree':
      'Supply-chain override upgrading transitive minimatch in typescript-estree to >=11.0.1 to remediate glob pattern amplification (GHSA-g3hv-75wg-m249).',
    eslint:
      'Supply-chain override upgrading transitive minimatch in eslint to >=11.0.1 to remediate glob pattern amplification (GHSA-g3hv-75wg-m249).',
    '@eslint/config-array':
      'Supply-chain override upgrading transitive minimatch in @eslint/config-array to >=11.0.1 to remediate glob pattern amplification (GHSA-g3hv-75wg-m249).',
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
      const formattedVersion =
        version && typeof version === 'object'
          ? Object.entries(version)
              .map(([subPkg, subVer]) => `${subPkg}: ${subVer}`)
              .join(', ')
          : version;
      packages.push({
        name,
        version: formattedVersion,
        tier: 'Supply-Chain Security Override',
        purpose: purposeMap[name] || 'Dependency security override.',
      });
    }
  }

  return {
    engines: pkg.engines || { node: '>=22.0.0', npm: '>=10.0.0' },
    packages,
  };
}

function getSecurityPluginRuleCount() {
  try {
    const securityPlugin = require('./eslint-rules/bookarium-security');
    const rulesObj =
      (securityPlugin && (securityPlugin.rules || securityPlugin.bookariumSecurityPlugin?.rules)) || {};
    return Object.keys(rulesObj).length || 9;
  } catch {
    return 9;
  }
}

function extractNodeScriptsCatalog(rootDirPath = rootDir) {
  const securityRuleCount = getSecurityPluginRuleCount();
  const scriptMetaMap = {
    'scripts/verify-build.js': {
      name: 'verify-build.js',
      npmCommand: '`npm run verify`',
      nodeApis: '`fs`, `path`, `child_process`',
      responsibility:
        `Executes the 7-Gateway Closed-Loop Quality Engine (Pass 0.5 secrets/file-path/AST-env-parity across \`src/\` & \`scripts/\`/client-privilege-boundary/transitive-graph, Pass 0.75 lockfile/license/40-char-SHA & permissions workflow scanner/AST API-route, Pillar-3 XSS-eval deduplication, redirect, public-domain, Rule-9 auth-store parity, OWASP header, & Service Worker validators/${securityRuleCount}-rule-AST-taint, Pass 1 types, Pass 2 MSW, Pass 3 Vitest 95/95/92/85%, Pass 4 direct generator docs & \`SECURITY.md\` sync, Pass 5 ADR/checklist/circular-\`SECURITY.md\`-parity (\`auditSecurityDocumentationParity\`)/schema-parity/graph (\`hasCycles\`, \`getAstParseErrors\`, \`detectLayerViolations\`, cross-boundary custom-signal & DB-table caller parity, \`scripts/\` CommonJS parse check, placeholder guards)/1:1-test-co-location across \`src/app/**\` & CLI/AST scripts/SemVer-7-file-parity, Pass 6 ESLint/Knip, Pass 7 Next.js build + \`.next/routes-manifest.json\` security header audit + live \`next start\` loopback HTTP smoke probes).`,
    },
    'scripts/eslint-rules/bookarium-security.js': {
      name: 'eslint-rules/bookarium-security.js',
      npmCommand: '`npm run lint` & `npm run security:audit`',
      nodeApis: '`fs`, `path`, `@babel/parser`, `@babel/traverse`',
      responsibility:
        `In-repo custom ESLint & Babel AST security plugin enforcing ${securityRuleCount} rules across \`src/\`, \`scripts/\`, \`public/sw.js\`, and \`next.config.ts\` (with explicit \`ast-parse-error\` reporting): unsafe fetch & Node \`https.get\`/\`http.get\` checks, unvalidated redirects, \`@/lib/server-rsc-nav\` & client/server boundary isolation, dangerous execution + static \`new RegExp()\` ReDoS primitives + \`scripts/\` \`{ shell: true }\` ban, TS-cast/constant-folded DOM XSS injection, intra-procedural server + client \`router.push()\`/\`replace()\` + \`scripts/\` \`process.argv\` CLI shell/URL taint analysis (with zero-false-positive array/conditional sanitizer intersection, static prefix, & Prototype Pollution guards), arrow/function API handler secret/header/cookie guards, test anti-tautology checks, and Project Gutenberg & copyright policy enforcement.`,
    },
    'scripts/lib/ast-parser.js': {
      name: 'lib/ast-parser.js',
      npmCommand: '_Internal Generator Engine_',
      nodeApis: '`fs`, `path`, `@babel/parser`, `@babel/traverse`',
      responsibility:
        'Babel AST & SQL parsing engine extracting `src/` module graphs (runtime vs. `_(type)_` edges with OS-independent `compareCodepoint` ordering and `getDeterministicTextOrBinaryBytes` LF-normalized asset sizing), CommonJS `scripts/*.js` `require()` graphs (`analyzeScriptsDependencyGraph`), cross-boundary `.from()`/`.rpc()`/API/`CustomEvent`/`BroadcastChannel`/storage coupling (`extractCrossBoundaryCouplingCatalog`), behavioral `@scope`/`@invariant`/`@rationale`/`@adr` contract specs across `PROTECTED_CONTRACTED_MODULES` (`extractBehavioralContractsCatalog`), full `17`-map generator orphan lookup key checks (`findOrphanedGeneratorLookupKeys`), inherited component `Props` & intersections, `persist` store keys, route HTTP verbs, layer-boundary violations (`detectLayerViolations`), parse-error checks (`getAstParseErrors`), balanced SQL schema entities (`extractSqlSchemaEntities`), AST test titles (`extractTestsFromSourceAst`), and static circular dependencies (`hasCycles`).',
    },
    'scripts/lib/sast-validators.js': {
      name: 'lib/sast-validators.js',
      npmCommand: '_Internal SAST Validator Library_',
      nodeApis: '`fs`, `path`, `@babel/parser`, `@babel/traverse`',
      responsibility:
        'Stateless Tier-4 Babel AST, lockfile/license SCA, security-doc parity & live HTTP response validators: `validateNextConfigSecurityHeadersAst`, `validateNextBuildHeaderManifest`, `validatePackageLockAndLifecycle` (`BANNED_PACKAGE_LICENSES` offline GPL/AGPL ban), `validateGitHubWorkflowSecurity`, `validateServiceWorkerSecurity` (`public/sw.js` AST fetch/message/CACHE_URLS guards), `validateEnvAndPrivilegeBoundariesAst`, `validateApiRoutesSecurityAst`, `validateRedirectRoutesAst`, `validatePublicDomainFilterAst`, `validateRule9AuthStoreParityAst`, `validateLiveHttpSecurityResponse`, and `auditSecurityDocumentationParity`.',
    },
    'scripts/generate-architecture-matrix.js': {
      name: 'generate-architecture-matrix.js',
      npmCommand: '`npm run matrix:generate` (in `docs:sync`)',
      nodeApis: '`fs`, `path`, `scripts/lib/ast-parser.js`',
      responsibility:
        'Programmatically compiles content-idempotent docs/ARCHITECTURE.md, README.md executive diagrams, and SECURITY.md (`<!-- BEGIN:security-architecture -->`) directly from source AST, ESLint security rules, stateless SAST exports, SQL RLS schemas, databases, Node.js packages, dynamic workflow counts, and CLI automation scripts.',
    },
    'scripts/generate-changelog.js': {
      name: 'generate-changelog.js',
      npmCommand: '`npm run changelog:generate` (in `docs:sync`)',
      nodeApis: '`fs`, `path`',
      responsibility:
        'Compiles content-idempotent CHANGELOG.md from SemVer release ledgers and synchronizes package.json, package-lock.json, SECURITY.md, .github/workflows/release.yml, .github/ISSUE_TEMPLATE/bug_report.yml, docs/GITHUB_ACTIONS.md, and README.md Latest Release section.',
    },
    'scripts/generate-parser-docs.js': {
      name: 'generate-parser-docs.js',
      npmCommand: '`npm run docs:parser` (in `docs:sync`)',
      nodeApis: '`fs`, `path`, `@babel/parser`, `@babel/traverse`',
      responsibility:
        'Analyzes src/lib/gutenberg-parser.ts AST (excluding `@module`/`@scope` contract tags) to generate content-idempotent living docs/GUTENBERG_PARSER.md.',
    },
    'scripts/generate-contracts-docs.js': {
      name: 'generate-contracts-docs.js',
      npmCommand: '`npm run docs:contracts` (in `docs:sync`)',
      nodeApis: '`fs`, `path`, `scripts/lib/ast-parser.js`',
      responsibility:
        'Compiles content-idempotent docs/SYSTEM_CONTRACTS.md from Babel AST `@scope`, `@invariant`, `@rationale`, and `@adr` JSDoc annotations, Tier-1..Tier-4 protection badges, blast-radius callers, cross-boundary touchpoints, and co-located test contracts across all `src/` and `scripts/` modules.',
    },
    'scripts/generate-quality-report.js': {
      name: 'generate-quality-report.js',
      npmCommand: '`npm run audit:quality` (in `docs:sync`)',
      nodeApis: '`fs`, `path`, `child_process`',
      responsibility:
        'Collects test coverage, suite catalogs, ADR counts, and ESLint/Knip metrics, synchronizes README.md framework/engine version badges (`Next.js`, `React`, `TypeScript`, `Tailwind CSS`, `Node.js`) from `package.json`, and generates docs/QUALITY_AUDIT_REPORT.md and docs/quality-audit-results.json.',
    },
    'scripts/generate-roadmap.js': {
      name: 'generate-roadmap.js',
      npmCommand: '`npm run roadmap:generate` (in `docs:sync`)',
      nodeApis: '`fs`, `path`',
      responsibility:
        'Scans source files and AST features to generate content-idempotent living ROADMAP.md with 0% drift.',
    },
    'scripts/generate-pwa-icons.js': {
      name: 'generate-pwa-icons.js',
      npmCommand: '`node scripts/generate-pwa-icons.js`',
      nodeApis: '`fs`, `path`, `zlib`',
      responsibility:
        'Compiles standards-compliant 32-bit RGBA binary multi-resolution .ico (16, 32, 48) and vector squircle PWA icons with alpha anti-aliasing.',
    },
    'scripts/sync-gutenberg-catalog.js': {
      name: 'sync-gutenberg-catalog.js',
      npmCommand: '`npm run catalog:sync`',
      nodeApis: '`crypto`, `fs`, `path`, `zlib`, `https`, `child_process`',
      responsibility:
        'Streams Project Gutenberg\'s official `rdf-files.tar.bz2` archive (`streamGutenbergRdfCatalogSignals`, extracting both 30-day `<pgterms:downloads>` and `<dcterms:rights>` copyright flags via `parseRdfCatalogSignalsStream`) and `pg_catalog.csv.gz` feed in PGLAF-first mirror priority (`gutenberg.pglaf.org` -> `aleph.gutenberg.org` -> `www.gutenberg.org`, or pinned via `--feed-source`, with `isHtmlContentType` HTML outage rejection, strict `Content-Length` truncation verification, fail-closed non-zero `tar` exit handling, and wire `SHA-256` digest calculation/logging to `$GITHUB_STEP_SUMMARY`), resolves portable `Bookarium-Catalog-Sync/1.0` User-Agent headers (`resolveCatalogUserAgent`, `resolveRepositoryOrSiteUrl`, `resolveSiteOriginFallback`), diffs all 78,461 volumes in RAM against `--cache-file=gutenberg-catalog-cache.json.gz` (`catalog-cache` GitHub Release asset with companion `.sha256` `crypto.timingSafeEqual` verification and cold-start Primary-Key batch fallback) while preserving `quotes` and cached `copyright` flags during RDF outages or `--no-rdf`, upserts only new/changed rows with sticky dynamic write pacing (`[25, 100]`), reconciles and prunes withdrawn volumes (`reconcileWithdrawnCatalogBooks`), and emits `--diff-output=quote-diff.json` (`topPopularIds`, `recentIds`) for zero-scan downstream quote sync.',
    },
    'scripts/ingest-catalog.js': {
      name: 'ingest-catalog.js',
      npmCommand: '`npm run catalog:ingest`',
      nodeApis: '`fs`, `path`, `https`, `child_process`',
      responsibility:
        'Offline CLI seed generator (`require.main === module` guarded) compiling idempotent `supabase/seed_books.sql` (and optional `--with-content` plain-text `seed_books_content.sql` updates) from `CURATED_CLASSICS`, resolving portable origin/User-Agent headers (`resolveSiteOriginFallback`, `resolveRepositoryOrSiteUrl`, `resolveIngestUserAgent`) and exporting pure SQL/URL helpers verified by `ingest-catalog.test.ts`.',
    },
    'scripts/ingest-translations.js': {
      name: 'ingest-translations.js',
      npmCommand: '`npm run translations:sync`',
      nodeApis: '`fs`, `path`, `https`',
      responsibility:
        'Queries Wikidata SPARQL endpoint with portable `Bookarium-Gatekeeper/1.0` headers (`resolveUserAgent`, `resolveSiteOriginFallback`) for multilingual FRBR work clusters and populates `public.book_translations` while enforcing `copyright !== true` (`filterValidCatalogBookIds` & `WHERE b.copyright = false` SQL seeds) with zero false positives.',
    },
    'scripts/sync-featured-quotes.js': {
      name: 'sync-featured-quotes.js',
      npmCommand: '`npm run quotes:sync`',
      nodeApis: '`fs`, `path`',
      responsibility:
        'Maintains a Two-Tier Bounded Quote Pool (`Top 500 Popular` by `download_count DESC` + `Rolling 64 Most Recent` by `id DESC`) in `public.books.quotes` (excluding `copyright === true` across both automated pools and manual `--ids` runs), identifying outbound Gutenberg mirror fetches via portable origin/repo headers (`resolveSiteOriginFallback`, `resolveRepositoryUrl`, `buildDescriptiveUserAgent`), consuming `--diff-file=quote-diff.json` from `sync-gutenberg-catalog.js` (or `idx_books_download_count` + `books_pkey` on standalone runs), scanning all currently quoted rows via partial B-Tree index `idx_books_with_quotes_popular` (`fetchAllQuotedBookIds` + `resolveBookMetadataByIds` + `computeOutOfWindowPrunePlan`) to apply Option-A `1-for-1` sliding-window pruning across surplus demoted Popular & oldest > 64 Recent volumes up to `--max-prune=<N>` (`DEFAULT_MAX_PRUNE_PER_RUN = 2000` with `50ms` inter-chunk yield past `500` IDs), blending `40 Popular + 10 Recent` unpopulated English volumes per 50-book batch with cross-tier backfill across selectable PGLAF mirrors (`gutenberg.pglaf.org` default, `aleph.gutenberg.org`, `gutenberg.readingroo.ms`) with independent 8.0s–16.0s randomized float delays, single-line console progress (`formatConsoleSummary` with `• Purge Status:` / `• Out-of-Window:`), and Markdown job summary reporting (`formatRunReport` with `Out-of-Window (Pruned)`, `🚫 Copyrighted (skipped)`, and `🧹 Pruned` rows).',
    },
    'scripts/purge-vercel-cache.js': {
      name: 'purge-vercel-cache.js',
      npmCommand: 'CLI / CI Workflow Step',
      nodeApis: '`fs` (`$GITHUB_STEP_SUMMARY`)',
      responsibility:
        'Invalidates Vercel Edge Data/CDN cache tags (`POST https://api.vercel.com/v1/edge-cache/dangerously-delete-by-tags?projectIdOrName={projectId}[&teamId={teamId}]`) via `--tags=...` at the end of non-dry-run `catalog-sync.yml` (`catalog,quotes,translations`), `quotes-sync.yml` (`quotes`), and `translations-sync.yml` (`translations`) workflows—or selectively on demand via manual `cache-purge.yml` (`catalog`/`quotes`/`translations` checkboxes, `--target`, `--dry-run`)—with bounded `429`/`5xx`/network backoff retries, `Retry-After` support, clean `exit 0` skip when `VERCEL_API_TOKEN` or `VERCEL_PROJECT_ID` are unset, and `$GITHUB_STEP_SUMMARY` reporting.',
    },
    'scripts/approval-gate.js': {
      name: 'approval-gate.js',
      npmCommand: '`npm run gate:approve`',
      nodeApis: '`fs`, `path`',
      responsibility:
        'Pre-commit governance gate validating `.agents/hooks.json` command definitions against `package.json` scripts prior to commit.',
    },
    'scripts/open-browser.js': {
      name: 'open-browser.js',
      npmCommand: '`npm run dev:open`',
      nodeApis: '`child_process`, `http`, `https`',
      responsibility:
        'Cross-platform development utility validating local loopback URLs (`sanitizeLocalDevUrl`) and spawning the default system browser cleanly via shell-free `spawn` (`shell: false`) after server readiness.',
    },
  };

  const preferredOrder = Object.keys(scriptMetaMap);
  const discoveredFiles = new Set(['scripts/eslint-rules/bookarium-security.js', 'scripts/lib/ast-parser.js']);
  const scriptsDir = path.join(rootDirPath, 'scripts');
  if (fs.existsSync(scriptsDir)) {
    for (const entry of fs.readdirSync(scriptsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.js')) {
        discoveredFiles.add(`scripts/${entry.name}`);
      }
    }
  }

  const orderedFiles = Array.from(discoveredFiles)
    .filter((f) => fs.existsSync(path.join(rootDirPath, f)))
    .sort((a, b) => {
      const ia = preferredOrder.indexOf(a);
      const ib = preferredOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

  return orderedFiles.map((fileRel) => {
    const meta = scriptMetaMap[fileRel];
    if (meta) {
      return { file: fileRel, ...meta };
    }
    return {
      name: fileRel.replace(/^scripts\//, ''),
      file: fileRel,
      npmCommand: '_Node.js Script_',
      nodeApis: '`fs`, `path`',
      responsibility: 'Node.js automation or maintenance script.',
    };
  });
}

function extractWorkspaceConfigAndGovernanceCatalog(rootDirPath) {
  const candidates = [
    {
      name: 'next.config.ts',
      file: 'next.config.ts',
      layer: 'Next.js 16 Build, Rewrites & OWASP Headers',
      responsibility:
        'Configures Next.js 16 App Router image remote patterns and CSP `img-src` allowlists (`aleph.gutenberg.org`, `gutenberg.pglaf.org`, `gutenberg.readingroo.ms`, `www.gutenberg.org`, `gutenberg.org`), clean path Edge rewrites (`/bookshelf`, `/favorites`, `/notebook`, `/bookmarks` -> `/?view=*`), and all 7 mandatory OWASP HTTP security headers (`Content-Security-Policy` with `object-src \'none\'`, `frame-ancestors \'none\'`, and production `unsafe-eval` stripping, `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`).',
    },
    {
      name: 'vercel.json',
      file: 'vercel.json',
      layer: 'Edge Deployment & Datacenter Pinning',
      responsibility:
        'Pins serverless function execution to `iad1` (Washington D.C. / US-East) adjacent to Project Gutenberg origin mirrors with 1024 MB memory and 30s max duration for `/api/books/**` routes.',
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
      layer: 'Global Theme Palettes, View Slide & 3D Book Physics CSS',
      responsibility:
        'Configures `@import "tailwindcss"`, `@config "../../tailwind.config.ts"`, Day (`#fcfbf9`), Cozy Coffee Sepia (`#2b1d16`), and Dark Obsidian (`#0e1117`) CSS custom properties, 3D perspective book spreads (`.book-center-crease`, `.preserve-3d`), directional view-slide keyframes (`.animate-view-slide-left`, `.animate-view-slide-right` with `360ms` tactile slide & nested `.animate-page-turn` suppression inside `@media (max-width: 1366px), (pointer: coarse)` vs. `0ms` outer switch & preserved `180ms` inner `.animate-page-turn` on `> 1366px` non-tactile PCs), and custom reader scrollbars (`--reader-sb-*`).',
    },
    {
      name: 'eslint.config.mjs',
      file: 'eslint.config.mjs',
      layer: `ESLint 10 Flat Config, Zero-Any & ${getSecurityPluginRuleCount()}-Rule AST Security Gate`,
      responsibility:
        `Enforces \`eslint-config-next/core-web-vitals\`, \`eslint-config-next/typescript\`, strict \`@typescript-eslint/no-explicit-any: "error"\`, and the in-repo \`bookarium-security\` AST & intra-procedural taint plugin (${getSecurityPluginRuleCount()} rules) across both \`src/**\` and \`scripts/**\` (\`scripts/**/*.js\` scoped CJS \`require()\` allowance) with \`--max-warnings 0\`.`,
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
        'Executes `npm run gate:approve` (`scripts/approval-gate.js`) and `npm run verify` (`scripts/verify-build.js`), then stages all synchronized release/doc/governance outputs prior to commit creation.',
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
      layer: 'Deterministic Hook Manifest Ledger',
      responsibility:
        'Machine-verified governance hook manifest defining `pre_commit` and `post_doc_sync` npm command bindings validated by `scripts/approval-gate.js`.',
    },
    {
      name: 'LICENSE',
      file: 'LICENSE',
      layer: 'MIT Open-Source Licensing Mandate',
      responsibility:
        'Canonical MIT license governing all Bookarium source code and verified continuously by Pass 0.75 (Pillar 5) and Pass 5.',
    },
    {
      name: '.github/pull_request_template.md',
      file: '.github/pull_request_template.md',
      layer: 'GitHub Pull Request Verification Checklist',
      responsibility:
        'Structured PR review template enforcing architectural summary, co-located Vitest coverage (`>= 95%`), and 7-Gateway Pass verification.',
    },
    {
      name: '.github/dependabot.yml',
      file: '.github/dependabot.yml',
      layer: 'Automated Dependency Maintenance Config',
      responsibility:
        'Weekly Dependabot configuration monitoring npm packages and GitHub Actions versions for security patches and supply-chain freshness.',
    },
    {
      name: '.github/ISSUE_TEMPLATE/bug_report.yml',
      file: '.github/ISSUE_TEMPLATE/bug_report.yml',
      layer: 'Version-Synced Issue Intake Form (Bug Report)',
      responsibility:
        'Structured YAML issue form with quoted environment choices, `Affected Area / View`, platform-agnostic/orientation-agnostic defaults, and automatic `RELEASES[0].version` (`e.g. vX.Y.Z`) sync during `npm run docs:sync`.',
    },
    {
      name: '.github/ISSUE_TEMPLATE/feature_request.yml',
      file: '.github/ISSUE_TEMPLATE/feature_request.yml',
      layer: 'Public-Domain Aligned Feature Intake Form',
      responsibility:
        'Structured proposal form (`Proposal Category`, expanded domains including Global UI, `/account`, Collections, and CI/Docs) guarding zero-API-key, offline-first PWA, and Project Gutenberg boundaries.',
    },
    {
      name: '.github/ISSUE_TEMPLATE/good_first_issue.yml',
      file: '.github/ISSUE_TEMPLATE/good_first_issue.yml',
      layer: 'Contributor Onboarding Issue Template',
      responsibility:
        'Curated starter-task template spanning UI, state, Supabase/API routes, tests, and docs while enforcing the `95%` V8 coverage floor.',
    },
    {
      name: '.github/ISSUE_TEMPLATE/config.yml',
      file: '.github/ISSUE_TEMPLATE/config.yml',
      layer: 'GitHub Issue Chooser Configuration',
      responsibility:
        'Enforces structured intake (`blank_issues_enabled: false`) across all repository issue workflows.',
    },
    {
      name: '.github/FUNDING.yml',
      file: '.github/FUNDING.yml',
      layer: 'Open-Source Sponsorship Manifest',
      responsibility:
        'Declares optional maintainer patronage metadata without affecting Bookarium\'s 100% free, zero-API-key user experience.',
    },
    {
      name: '.github/assets/README.md',
      file: '.github/assets/README.md',
      layer: 'Documentation & Showcase Visual Index',
      responsibility:
        'Documents static showcase screenshots and brand banners referenced by root GitHub documentation.',
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
    { path: 'src/components/', role: `${counts.componentCount || 73} production React 19 UI components & motion config primitives organized across \`account/\`, \`accolades/\`, \`auth/\`, \`bookshelf/\`, \`motion/\`, \`presentation/\` (including \`bookshelf/\`), \`profile/\`, \`pwa/\`, \`reader/\`, \`symposium/\`, and \`ui/\`, each paired with co-located \`*.test.{ts,tsx}\` suites.` },
    { path: 'src/stores/', role: `${counts.storeCount || 10} Zustand client-side state stores (\`useBookshelfStore\`, \`useReaderStore\`, \`useAuthStore\`, \`useFellowshipStore\`, \`useAnnotationStore\`, \`useAccoladesStore\`, \`useHabitsStore\`, \`useJurisdictionStore\`, \`usePreferencesStore\`, \`useThemeStore\`) with \`localStorage\` persistence and bi-directional Supabase cloud outbox synchronization.` },
    { path: 'src/hooks/', role: `${counts.hookCount || 22} custom React hooks organized into \`queries/\` (TanStack Query v5 data fetching), \`reader/\` (Web Speech TTS, session coordinates, gestures, worker AST, reading ledger), and root UI/network/copyright hooks (\`useNetworkStatus\`, \`useOfflineBooks\`, \`useBookCopyright\`, \`useCatalogFilters\`, \`useCollectionAutoHeal\`).` },
    { path: 'src/lib/', role: `${counts.utilityCount || 36} domain computational engines, App Router route helpers, and adapters covering Gutenberg AST segmentation/pagination/reflow (\`gutenberg/\`), authoritative Supabase & bundled curated-fallback catalog resolution (\`catalog/\`), Supabase SSR/browser clients (\`supabase/\`), multi-jurisdictional copyright (\`copyright-engine.ts\`), IndexedDB storage (\`offline-storage.ts\`), interval annotation partitioning (\`reader-annotator.ts\`), cloud bookshelf sync (\`bookshelf-cloud-sync.ts\`), and co-located \`src/app/**\` server route utilities (\`metadata-cache.ts\`, \`url-validator.ts\`, \`reader-layout-utils.ts\`, \`profile-layout-utils.ts\`).` },
    { path: 'src/config/', role: `${counts.configCount || 13} centralized design token, routing, theme, language, era, literary quote, and 27-masterwork curated anthology configuration modules.` },
    { path: 'src/types/', role: `${counts.typeCount || 4} canonical TypeScript type contract modules (\`book.types.ts\`, \`database.types.ts\`, \`catalog.types.ts\`, \`accolades.types.ts\`) defining zero-any domain and PostgreSQL row schemas.` },
    { path: 'src/workers/', role: 'Dedicated off-thread Web Worker (`gutenberg.worker.ts`) executing Gutenberg plain-text segmentation and virtual page layout calculations.' },
    { path: 'src/mocks/ & src/test/', role: 'Hermetic MSW v2 Node interception server (`server.ts`, `handlers.ts`, `handlers.test.ts`, fail-closed `handleUnhandledMswRequest`) and JSDOM test environment bootstrap (`setup.ts`).' },
    { path: 'public/', role: `Progressive Web App Service Worker (\`public/sw.js\` \`${counts.swVersionLabel || 'v7'}\`) and multi-resolution soaring open book brand emblem icons (\`favicon.ico\`, \`icon.svg\`, \`public/icons/*.png\`).` },
    { path: 'supabase/', role: `Idempotent PostgreSQL schema (\`schema.sql\`) with ${counts.dbTableCount || 14} tables, ${counts.dbPolicyCount || 47} RLS policies, ${counts.dbFunctionCount || 9} functions/triggers, and ${counts.dbIndexCount || 21} explicit indexes, plus offline SQL seeds (\`seed_books.sql\`, \`seed_translations.sql\`).` },
    { path: 'scripts/', role: `${counts.nodeScriptCount || 17} Node.js CLI automation, Babel AST documentation compilation (\`lib/ast-parser.js\`), custom ESLint AST & request-taint security rules (\`eslint-rules/bookarium-security.js\`), 7-Gateway verification (\`verify-build.js\`), Gutenberg catalog streaming (\`sync-gutenberg-catalog.js\`), PGLAF mirror-first featured quotes extraction (\`sync-featured-quotes.js\`), and Wikidata FRBR translation clustering (\`ingest-translations.js\`) tools, plus offline authority cache (\`scripts/data/\`) and CLI test suites.` },
    { path: 'docs/', role: `Living architectural reference (\`ARCHITECTURE.md\`), ${adrCount} Architecture Decision Records (\`DECISIONS.md\`), AST-compiled parser & behavioral contract specifications (\`GUTENBERG_PARSER.md\`, \`SYSTEM_CONTRACTS.md\`), CI/CD runbook (\`PIPELINE_GUIDE.md\`), GitHub Actions operator runbook (\`GITHUB_ACTIONS.md\`), and live 7-Gateway quality telemetry (\`QUALITY_AUDIT_REPORT.md\`, \`quality-audit-results.json\`).` },
    { path: '.github/workflows/ & .husky/', role: 'Automated GitHub Actions CI/CD, security scanning & release publisher (`ci.yml`, `codeql.yml`, `dependency-review.yml`, `release.yml`, all 40-char commit-SHA pinned), unified Sunday sequential catalog/translation/quote ingestion (`catalog-sync.yml` with permanent `catalog-cache` GitHub Release snapshot & `quote-diff.json` handoff), on-demand manual maintenance & cache purge workflows (`translations-sync.yml`, `quotes-sync.yml`, `cache-purge.yml`), GitHub collaboration/automation templates (`ISSUE_TEMPLATE/*.yml`, `pull_request_template.md`, `dependabot.yml`, `FUNDING.yml`, `.github/assets/README.md`), plus Husky pre-commit quality gates.' },
  ];

  let auditTotals = { suites: counts.totalSuites || 258, tests: '2,645' };
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

  let maxMilestoneIdx = 11;
  try {
    const { ROADMAP_MILESTONES } = require('./generate-roadmap');
    if (Array.isArray(ROADMAP_MILESTONES) && ROADMAP_MILESTONES.length > 0) {
      maxMilestoneIdx = ROADMAP_MILESTONES.length - 1;
    }
  } catch {
    // Fallback to default milestone count
  }

  const livingDocs = [
    { file: 'README.md', mode: 'Hybrid (Curated + Script-Synced)', generator: '`scripts/generate-changelog.js` & `scripts/generate-quality-report.js`', role: 'Primary project overview, system architecture diagrams, Supabase setup guide, and live test/coverage/release blocks.' },
    { file: 'docs/ARCHITECTURE.md', mode: '100% AST-Generated', generator: '`scripts/generate-architecture-matrix.js`', role: 'Complete 360° full-repository C4 architecture map, event/state-flow bus, temporal sequence workflows, external integration boundaries, failure/retry topology, edge deployment & 5-layer caching hierarchy, AST-verified environment variable bindings, component/store/hook/utility/config/type matrices, database schema & indexes, testing harness, and module dependency topology.' },
    { file: 'docs/DECISIONS.md', mode: 'Append-Only Governance Ledger', generator: '`_Append-Only Ledger_ (Validated in Pass 5)`', role: `Sequential Architectural Decision Records (ADR-001 through ${adrRangeEnd}) documenting context, trade-offs, and consequences.` },
    { file: 'docs/GUTENBERG_PARSER.md', mode: '100% AST-Generated', generator: '`scripts/generate-parser-docs.js`', role: 'Technical reference for the Gutenberg plain-text segmentation, paragraph reflow, virtual pagination, and passage extraction engine.' },
    { file: 'docs/SYSTEM_CONTRACTS.md', mode: '100% AST-Generated', generator: '`scripts/generate-contracts-docs.js`', role: 'Code-level `@scope`, `@invariant`, `@rationale`, and `@adr` behavioral contracts, AST blast radius, cross-boundary touchpoints, and priority contract queue across all `src/` and `scripts/` modules.' },
    { file: 'docs/QUALITY_AUDIT_REPORT.md', mode: '100% Telemetry-Generated', generator: '`scripts/generate-quality-report.js`', role: `Human-readable 7-Gateway audit summary, V8 coverage metrics, and collapsible catalog of all ${auditTotals.suites} test suites and ${auditTotals.tests} tests.` },
    { file: 'docs/quality-audit-results.json', mode: '100% Telemetry-Generated', generator: '`scripts/generate-quality-report.js`', role: 'Machine-readable JSON telemetry of all 7 gateway passes, coverage percentages, ESLint/Knip counts, and suite totals.' },
    { file: 'ROADMAP.md', mode: '100% AST-Generated', generator: '`scripts/generate-roadmap.js`', role: `Zero-drift product roadmap verifying feature completion directly against source files and AST patterns across Milestones 0–${maxMilestoneIdx}.` },
    { file: 'CHANGELOG.md', mode: '100% Script-Generated', generator: '`scripts/generate-changelog.js`', role: 'Chronological Keep a Changelog 1.0.0 & SemVer release ledger across all application versions.' },
    { file: 'docs/PIPELINE_GUIDE.md', mode: 'Curated Engineering Runbook', generator: '_Source-of-Truth Runbook_', role: 'Operational guide for the 7-Gateway Quality Engine, GitHub Actions workflows, and catalog/translation ingestion pipelines.' },
    { file: 'docs/GITHUB_ACTIONS.md', mode: 'Curated Operator Runbook', generator: '_Source-of-Truth Runbook (Pass 5 Parity Verified)_', role: `Complete trigger, schedule, permission, secret, workflow_dispatch input, immutable SHA pin, CI command, and local CLI parity reference for all ${counts.workflowCount || 8} \`.github/workflows/*.yml\` pipelines and Dependabot.` },
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
  const layerViolations = detectLayerViolations(graph);
  const orphans = detectOrphanedModules(graph);
  const crossBoundary = extractCrossBoundaryCouplingCatalog(srcDir, rootDir);
  const scriptsGraph = analyzeScriptsDependencyGraph(rootDir);
  const components = extractComponentCatalog(graph);
  const stores = extractStoreCatalog(srcDir);
  const { routes, appPages, hooks } = extractApiAndHookCatalog(srcDir);
  const utilities = extractDomainUtilitiesCatalog(srcDir);
  const configs = extractConfigurationCatalog(srcDir);
  const typeDefs = extractTypeCatalog(srcDir);
  const swMeta = extractServiceWorkerMetadata(rootDir);
  const workers = extractWorkerCatalog(srcDir);
  const testHarness = extractTestHarnessCatalog(srcDir, rootDir);
  const harnessAstDeps = extractTestHarnessAstDependencies(rootDir, graph);
  const publicAssets = extractPublicAssetsCatalog(rootDir);
  const workspaceConfigs = extractWorkspaceConfigAndGovernanceCatalog(rootDir);
  const envCatalog = extractEnvironmentDependencyCatalog(rootDir, srcDir);
  const dbCatalog = extractDatabaseCatalog(rootDir);
  const nodeScripts = extractNodeScriptsCatalog(rootDir);
  const repoTopology = extractRepositoryTopologyAndDocsCatalog(rootDir, {
    componentCount: components.length,
    storeCount: stores.length,
    hookCount: hooks.length,
    utilityCount: utilities.length,
    configCount: configs.length,
    typeCount: typeDefs.length,
    swVersionLabel: swMeta.versionLabel,
    dbTableCount: dbCatalog.tables.length,
    dbPolicyCount: dbCatalog.policyCount,
    dbFunctionCount: dbCatalog.functions.length,
    dbIndexCount: dbCatalog.indexes.length,
    nodeScriptCount: nodeScripts.length,
    totalSuites: testHarness.totalSuites,
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
    `> **Topology Health**: \`${graph.size}\` Modules Analyzed • \`${totalLinks}\` Static Linkages • \`${circularHealth.cycleCount}\` Circular Dependencies • \`${layerViolations.length}\` Layer Violations • \`${orphans.length}\` Orphaned Modules`,
    '',
    '---',
    '',
    '## 🏛️ System Architecture & Data Flow',
    '',
    'Bookarium runs on a **Zero-API-Key Public Domain Architecture** powered by Supabase PostgreSQL, zero-network bundled Curated Archive fallback (`curated-fallback.ts`), real-time telemetry, and deterministic state isolation.',
    '',
    '### 1. End-to-End System Context & Data Flow',
    '',
    '```mermaid',
    'flowchart TD',
    '    User["👤 Reader / Public Domain Scholar"]',
    '    ',
    '    subgraph FrontendSPA ["Client SPA Layer (Next.js 16 App Router)"]',
    '        Providers["providers.tsx\\n(QueryClient, Auth Init, Cloud Sync, verifyActiveSessionValidity, IP/UA Reconciliation, GlobalTitleTooltip & Dynamic AuthModal)"]',
    `        SWReg["ServiceWorkerRegister.tsx & public/sw.js\\n(App Shell ${swMeta.versionLabel}, Static Asset Warmup & Offline Fallback)"]`,
    '        AuthModalNode["AuthModal.tsx, EmailSentView.tsx & TurnstileWidget.tsx\\n(Sign-In, Sign-Up, Turnstile CAPTCHA, Honeypot, OAuth, Magic Link & Reset)"]',
    '        Nav["Navbar.tsx\\n(Brand Reset, View Switcher, Single-Phase Gliding Active Underline Cradle, Theme Cycler)"]',
    '        Hero["HeroSearch.tsx\\n(Precision Viewport Fold Docking, 3D Rotating Spotlight & Search)"]',
    '        Hero3D["HeroFeaturedBook3D.tsx\\n(3D Open-Cover Hinge, Leaf-Flip Engine & Fluid Kinematics)"]',
    '        Toolbar["StickyCatalogToolbar.tsx\\n(Desktop/Tablet Sticky Sub-Header, Flush Bottom Docking & Universal Ambient Capsule Dock)"]',
    '        FilterDrawer["AdvancedFilterDrawer.tsx\\n(Universal Bottom Sliding Panel, Staged Filter Execution, Multi-Select Touch Chips)"]',
    '        EditorialQuote["EditorialQuoteSection.tsx\\n(Classic of the Day, Collision & isPoolSettled Guard)"]',
    '        LiteraryQuotes["LiteraryQuotes.tsx\\n(Words That Shaped Humanity, Safe Shuffling & isPoolSettled Guard)"]',
    '        CopyrightBanner["CopyrightNoticeBanner.tsx\\n(Declarative Territorial Restriction & Public Domain Notice)"]',
    '        ContentAdvisory["ContentAdvisoryBanner.tsx\\n(Non-blocking Mature/Historical Context Advisory)"]',
    '        CollectionToolbarNode["CollectionToolbar.tsx\\n(Responsive Workbench: Single-Row Mobile Layout, Search, Desktop Favorites Preset, Sort & View Mode Toggles)"]',
    '        CollectionBottomDockNode["CollectionBottomDock.tsx • CollectionFloatingSearch.tsx • CollectionFilterDrawer.tsx\\n(Universal Ambient Dock, Animated Light Aura, Floating Search & Bottom Sliding Drawer with Shelf, Monochrome Filter & Sort Controls)"]',
    '        CollectionEmptyStateNode["CollectionEmptyState.tsx\\n(Unified Collection Empty State Card: p-12 Editorial Card, Section Icon Badge, Explore Catalog & Iconless Sign-in Actions)"]',
    '        PaginationNode["Pagination.tsx\\n(Accessible Numeric Page Navigation)"]',
    '        BookPreviewModalNode["BookPreviewModal.tsx & NotablePassagesSpread.tsx\\n(3D Open-Book Preview Spread, Notable Passages & Jurisdictional Protection)"]',
    '        BookshelfRackNode["BookshelfRack.tsx & BookshelfSpine.tsx\\n(Dynamic 2-Shelf Capacity, Sequential Left-to-Right Fill, showShelfControls Isolation, 3D Hardwood Shelf, Kinetic Strip, <1024px Touch Sheet & >=1024px Spines)"]',
    '        BookshelfMobileModalNode["BookshelfMobileModal.tsx\\n(Mobile & Tablet <1024px Action & Curation Sheet)"]',
    '        RemoveOfflineModalNode["RemoveOfflineBookModal.tsx • RemoveCollectionBookModal.tsx\\n(Offline Cache & Collection Eviction Confirmations)"]',
    '        CatalogOfflineNode["CatalogOfflineView.tsx\\n(Offline Catalog Notice & Collection Quick-Links)"]',
    '        SymposiumInviteModalNode["SymposiumInviteModal.tsx\\n(1-on-1 Literary Symposium Companion Picker)"]',
    '        AccoladesEngine["accolades-engine.ts • ExLibrisBookplate.tsx • AccoladeCelebrationModal.tsx"]',
    '        PublicSanctuaryNodes["PublicProfileView.tsx • PinnedAccoladesShelf.tsx • PrivateProfileNotice.tsx"]',
    '        ',
        '        subgraph Views ["Primary Application Views (/ & Edge Rewrites)"]',
    '            Grid["Catalog View (/)\\n(Smooth Scroll Navigation, Adaptive Offline Downloaded Dataset, 2-Col Mobile Grid & 3D Hardwood Shelf)"]',
    '            ShelfView["Bookshelf View (/bookshelf)\\n(Curated Library, Dynamic 2-Shelf Capacity, Sequential Left-to-Right Shelf Fill, showShelfControls Isolation, Downloaded (N) Smart Shelf & Active-Shelf Clear)"]',
    '            FavView["Favorites View (/favorites)\\n(Dedicated Cover Grid, Star Ratings & Personal Curation)"]',
    '            MarksView["Bookmarks View (/bookmarks)\\n(Tactile Reading Ledger, 2-Col Archival Grid, Status Filter, Direction-Aware Sort & Dedicated Resume CTA)"]',
    '            NoteView["Commonplace Notebook (/notebook)\\n(Highlights, Reflections, Tags, 2-Col Archival Grid, Tactile Scroll Focus (<1024px) & View Mode Scrubber)"]',
    '            AccView["Account Hub (/account)\\n(Library Stats, Cloud Sync & Preferences)"]',
    '            PrivacyView["Privacy Architecture (/privacy)\\n(Zero-Tracker Manifesto, 3-Tier Data Erasure, COPPA & Geo-Cookies)"]',
    '            CopyrightView["Copyright Governance (/copyright)\\n(Public Domain Manifesto, Multi-Jurisdiction Rules & DMCA Channel)"]',
    '            HabitsCard["AccountHabitsCard.tsx\\n(Reading Streaks, Daily Progress, Annual Challenge)"]',
    '            AccoladesCard["AccountAccoladesCard.tsx\\n(Literary Honors, Showcase & Ex-Libris Bookplates)"]',
    '            SymposiumCard["AccountSymposiumSection.tsx\\n(Reader Circles & Literary Symposiums)"]',
    '            SecurityCard["AccountSecuritySection.tsx\\n(Active Device Sessions, Duplicate-Origin Hints, Turnstile Recovery, Google Disconnect & Confirm-Guarded Sign-Out)"]',
    '            PrefsCard["AccountPreferencesSection.tsx\\n(AccountTypographySubPanel • AccountNarrationSubPanel • Two-Tier Custom Defaults)"]',
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
    '            StorePref[("⚙️ usePreferencesStore\\n(sticky scroll, layout choices, customDefaults)")]',
    '            StoreAnnot[("🖍️ useAnnotationStore\\n(pastel highlights, notes, tags)")]',
    '            StoreHabits[("🔥 useHabitsStore\\n(streak, 5m threshold, dual immersion, cloud)")]',
    '            StoreAccolades[("🎖️ useAccoladesStore\\n(accolades, showcase pinning, celebrations, cloud)")]',
    '            StoreFellowship[("🤝 useFellowshipStore\\n(reader circles, symposiums, companion progress, cloud)")]',
    '            SyncCoordinator["🔄 sync-utils.ts & preferences-sync.ts\\n(Unified 7-Store Outbox/LWW & 13-Key Preferences Cloud Sync Coordinator)"]',
    '            BookshelfSyncEngine["🔄 Domain Cloud-Sync Engines\\n(bookshelf-cloud-sync • annotation-cloud-sync • fellowship-cloud-sync • reader-cloud-sync)"]',
    '            StoreJurisdiction[("🌐 useJurisdictionStore\\n(country, rule, dev override, cookie sync)")]',
    '            StoreOffline[("📦 IndexedDB Engine\\n(unabridged offline volume cache)")]',
    '        end',
    '        ',
    '        subgraph ReaderEngine ["Reader Runtime & Web Speech Subsystem"]',
    '            SessionHook["📖 useReaderSession & useReaderHabitTelemetry\\n(Position Memory, Deep Links, Reflow Healing & Habit Telemetry)"]',
    '            SpeechHook["🔊 useReaderSpeech\\n(SpeechSynthesis, Boundary Sync, Auto-Flip)"]',
    '            TimerHook["⏱️ useReadingTimer\\n(Dual Immersion: 2-min Idle Guard + TTS Audio Bypass)"]',
    '            WorkerHook["⚙️ useGutenbergParserWorker\\n(Persistent Worker Chapter AST)"]',
    '            LedgerHook["🔖 useContinueReadingLedger\\n(Two-Way Hydration & 0ms Resume)"]',
    '            AnnotatorEngine["🖍️ reader-annotator.ts & reader-bookmark-geometry.ts\\n(Interval Partitioning, Canonical Span Matcher & Row Geometry)"]',
    '        end',
    '        ',
    '        HookCopyright["⚖️ useBookCopyright\\n(Declarative Facade: Rules, Lifespans & Status)"]',
    '        HookNetwork["📡 useNetworkStatus & useOfflineCatalogFallback\\n(Reactive Online/Offline Store & Adaptive Offline Catalog)"]',
    '        HookAutoHeal["🩺 useCollectionAutoHeal & useNotebookMetadataResolver\\n(Author Lifespan & Marginalia Metadata Auto-Rehydration)"]',
    '        HookCatalogFilters["🎛️ useCatalogFilters & useAccountSecurityActions\\n(Catalog Filter Staging & OWASP Account Security Workflows)"]',
    '        QueryBooks["🔄 useBooks, useFeaturedQuotes, useQuoteEnrichedBooks & usePrefetchNextPage\\n(Windowed Sub-Pages, Primary Quotes JSONB, Live Enrichment & Predictive Prefetch)"]',
    '        QueryContent["🔄 useBookContent(url, bookId)\\n(Offline-Always IndexedDB Check to CDN Stream)"]',
    '        QueryTranslate["🌐 useBookTranslations\\n(International Editions Relational Handoff)"]',
    '        Telemetry["📊 Vercel Telemetry\\n(Analytics & Speed Insights)"]',
    '    end',
    '',
    '    subgraph ServerLayer ["Next.js Root Proxy & Edge Routing Layer"]',
    '        RootProxy["Next.js 16 Root Proxy (src/proxy.ts)\\n(Edge Geo-IP: x-vercel-ip-country, Dev ?country=XX, Public RSC Auth Bypass)"]',
    '        ProxyBooks["GET /api/books\\n(Edge CDN: 12h Quote Pool • 24h Catalog • 7d Quote/Meta IDs • Vercel-Cache-Tag, Rate Limit, Seam Controller)"]',
    '        CatalogSeam["Catalog Seam & Bundled Fallback (src/lib/catalog/)\\n(supabase-provider.ts • curated-fallback.ts)"]',
    '        ProxyContent["GET /api/books/content\\n(24h Text & OG Card • 7d Cover Image Proxy • Tier 1 DB / Tier 2 4-Mirror Waterfall)"]',
    '        ProxyBookTranslations["GET /api/books/translations\\n(7d Edge SWR Cache • s-maxage=604800 • Vary: x-vercel-ip-country • Vercel-Cache-Tag: translations • FRBR Work Mapping)"]',
    '        AuthCallback["GET /auth/callback\\n(PKCE & Token-Hash OTP, Strip Recovery, Sanitized UA Forwarding & IP Sync Cookie)"]',
    '        LayoutServer["Server Layout (/read/[id])\\n(reader-layout-utils.ts • server-rsc-nav.ts • React.cache • ISR 24h • OpenGraph & JSON-LD)"]',
    '        ProfileLayoutServer["Server Layout (/u/[username])\\n(profile-layout-utils.ts • server-rsc-nav.ts • 500-Entry 5m LRU • Zero-PII & Anti-Enumeration)"]',
    '        StaticSeoRoutes["SSR Metadata & Crawler Gateways\\n(/privacy & /copyright Layouts • /auth/confirm-deletion noindex • robots.ts • sitemap.ts)"]',
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
    '        CuratedArchive["📚 Bundled Curated Archive\\n(featured-books.ts • 27 Classics)"]',
    '        GutenbergCDN["🌐 Project Gutenberg Mirrors\\n(aleph.gutenberg.org, gutenberg.pglaf.org, gutenberg.readingroo.ms, www.gutenberg.org)"]',
    '        WikidataSPARQL["🌐 Wikidata SPARQL (CC0 1.0)\\n(P2034 Gutenberg ID & P407/P424 Language Clusters)"]',
    '        SupabaseCloud[("⚡ Supabase Cloud (PostgreSQL)\\n(public.books, book_translations, profiles, shelves, progress, habits, accolades)")]',
    '        SyncEngine["🔄 Gutenberg Catalog Sync Engine\\n(scripts/sync-gutenberg-catalog.js • .github/workflows/catalog-sync.yml)"]',
    '        SyncTranslations["🔄 Relational Translations Sync\\n(scripts/ingest-translations.js • .github/workflows/translations-sync.yml)"]',
    '        SyncQuotes["🔄 Featured Quotes Sync Engine\\n(scripts/sync-featured-quotes.js • .github/workflows/quotes-sync.yml)"]',
    '        PurgeVercel["🧹 Edge Cache Tag Purge CLI\\n(scripts/purge-vercel-cache.js • .github/workflows/cache-purge.yml)"]',
    '        CISecurity["🛡️ SHA-Pinned CI, CodeQL & Dependency Review\\n(.github/workflows/ci.yml • codeql.yml • dependency-review.yml • release.yml)"]',
    '        VercelEdge["⚡ Vercel Edge Platform\\n(Edge CDN SWR, Cookie-less Analytics & Speed Insights)"]',
    '    end',
    '',
    '    User --> RootProxy',
    '    User --> LayoutServer',
    '    User --> ProfileLayoutServer',
    '    User -->|"Legal, Privacy & Sitemap"| StaticSeoRoutes',
    '    LayoutServer -->|"SSR Catalog/Hero Lookup (React.cache)"| SupabaseCloud',
    '    ProfileLayoutServer -->|"Zero-PII Public Handle Check"| SupabaseCloud',
    '    ProfileLayoutServer --> ProfilePage',
    '    ProfilePage -.->|"SSR/Client Public Profile Query"| SupabaseCloud',
    '    StaticSeoRoutes --> PrivacyView',
    '    StaticSeoRoutes --> CopyrightView',
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
    '    ShelfView --> CollectionEmptyStateNode',
    '    FavView --> CollectionEmptyStateNode',
    '    MarksView --> CollectionEmptyStateNode',
    '    NoteView --> CollectionEmptyStateNode',
    '    BookshelfRackNode --> CollectionEmptyStateNode',
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
    '    AccView --> SecurityCard',
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
    '    CatalogSeam -.->|Fallback when Supabase unconfigured| CuratedArchive',
    '    SyncEngine -->|Weekly Cron Snapshot Diff & pg_catalog.csv.gz Stream| SupabaseCloud',
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
    '    MetaCache -.->|2. Fallback to Bundled Featured Fixtures| CuratedArchive',
    '    MetaCache --> EngineCore',
    '    EngineCore --> JointAuthors',
    '    EngineCore --> Translators',
    '    ProxyContent -->|Tier 1: Instant DB Text| SupabaseCloud',
    '    ProxyContent -->|Tier 2: Multi-Mirror Fallback| GutenbergCDN',
    '    ReaderPage --> QueryTranslate',
    '    LangDrawer --> QueryTranslate',
    '    QueryTranslate -->|Tier 1: Relational Work Mapping| ProxyBookTranslations',
    '    ProxyBookTranslations -->|100% Precision Relational Query| SupabaseCloud',
    '    QueryTranslate -.->|Tier 2: Internal /api/books Author Search| ProxyBooks',
    '    SyncTranslations -->|Weekly & On-Demand Ingestion| SupabaseCloud',
    '    SyncTranslations -.->|Wikidata P2034 Query & Fallback Snapshot| WikidataSPARQL',
    '    SyncQuotes -->|Weekly Delta & On-Demand Two-Tier Quotes JSONB Upsert| SupabaseCloud',
    '    SyncQuotes -.->|8.0s–16.0s Float-Paced PGLAF Mirror Stream| GutenbergCDN',
    '    SyncEngine -.->|"Live Run: Purge catalog,quotes,translations"| PurgeVercel',
    '    SyncTranslations -.->|"Manual Live Run: Purge translations"| PurgeVercel',
    '    SyncQuotes -.->|"Manual Live Run: Purge quotes"| PurgeVercel',
    '    PurgeVercel -.->|"POST /v1/edge-cache/dangerously-delete-by-tags"| VercelEdge',
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
    '        FontSize["Font Size: 12px - 36px (15px/17px/18px Device-Adaptive Default)"]',
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
    '    subgraph ReaderView ["Dedicated Focus Reader (src/app/read/[id]/page.tsx • useReaderHabitTelemetry)"]',
    '        Toolbar["Top Editorial Reader Bar & Sliding Tray (ReaderHeader • Share Action + Desktop lg: Tools • Tactile Slide)"]',
    '        SubHeader["Sub-Header Status Ribbon (ReaderSubHeaderRibbon)"]',
    '        ContentArea["Book Page Rendering Area (ReaderSurface • ReaderRowBookmark • reader-bookmark-geometry.ts • startRow->endRow Span)"]',
    '        ProgressBar["Top Reading Progress Indicator"]',
    '        ResumeToast["Exact-Page Auto-Resume Toast"]',
    '        FooterBar["Sticky Bottom Pagination, Page Jump & Unified Mobile/Tablet (<1024px) Tools Pod (ReaderFooter • Tactile Slide)"]',
    '        TOC["Table of Contents Drawer (ReaderTocDrawer)"]',
    '        SearchDrawer["In-Book Search Drawer (ReaderSearchDrawer)"]',
    '        LangDrawer["Language Editions Drawer (ReaderLanguageDrawer)"]',
    '        Controls["Appearance & Typography Popover (ReaderControls • Font, Line Height, Brightness 30%-100%, Theme, Custom Defaults)"]',
    '        AudioBar["Speech Narration Bar (ReaderSpeechBar)\\n(useReaderSpeech • SpeechSynthesis • 0.85x-2.0x)"]',
    '        HighlightPop["Highlight & Fellow Attribution Popover (TextHighlightPopover)"]',
    '        AnnotDrawer["Annotations Drawer (ReaderAnnotationsDrawer)\\n(4 Pastel Highlighters • Symposium Marginalia • Spoiler Shield)"]',
    '        InfoModal["Archival Metadata Modal (GutenbergInfoModal)"]',
    '        ShareModal["Social Share & Canvas Reading Card Modal (ReaderShareModal • reading-card-export.ts)"]',
    '    end',
    '',
    '    subgraph Persistence ["Browser LocalStorage, IndexedDB & Supabase Cloud"]',
    '        LSPrefs[("bookarium-reader-preferences & preferences-sync.ts\\n(theme, font, spacing, brightness, readingProgress, readingPositions, public.profiles.preferences JSONB)")]',
    '        LSAnnot[("bookarium-annotations-storage & annotation-cloud-sync.ts\\n(useAnnotationStore highlights & reflections)")]',
    '        IDBStorage[("IndexedDB (useOfflineBooks)\\n(unabridged offline volumes)")]',
    '        CloudProgress[("⚡ Supabase Cloud\\npublic.reading_progress & reader-cloud-sync.ts\\n(2s Debounced Sync, Authoritative Watermark & Restore • scroll_offset & bookmark_text)")]',
    '        CloudSymposium[("⚡ Supabase Cloud\\npublic.symposium_sessions, user_annotations & fellowship-cloud-sync.ts\\n(Companion Progress & Fellow Marginalia)")]',
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
    '        IDB["📦 IndexedDB (useOfflineBooks)\\n• Atomic offlineBookIds & offlineBooks (Promise.allSettled + syncEpochRef)"]',
    '    end',
    '',
    '    subgraph LedgerHook ["useContinueReadingLedger Hook"]',
    '        FilterActive["Active Telemetry Filter\\n(readingPositions exists OR readingProgress > 0)\\n⚠️ Excludes un-opened shelved books"]',
    '        MissingCheck{"Missing Identity or\\nPlaceholder Author?"}',
    '        QueryMissing["🔄 useBooks(ids: missingIds)\\n(TanStack Query - Catalog Seam)"]',
    '        EnrichDict["Enriched Book Dictionary (setOrMergeBook)\\n(savedBooks + recentBooks + offlineBooks + queryResults • Author Merge Guardrails)"]',
    '        Parser["Canonical Utilities (@/lib/utils)\\n• formatAuthorNames (reverse \'Last, First\' & strip dates)\\n• cleanBookTitle (strip Gutenberg prefixes)\\n• formatRelativeTime (\'Recently\', \'2h ago\')"]',
    '        Assembly["Assemble ActiveReadingVolume[]\\n• progress, chapter, coordinates, lastReadAt\\n• status (in_progress / completed / on_hold)\\n• isOffline / Not Downloaded badge • Line X & bookmarkText"]',
    '        FilterSort["Client Search & Status Filter\\n• \'all\' | \'in_progress\' | \'completed\' | \'on_hold\' | \'downloaded\'\\n• Integrated CollectionToolbar token matching\\n• Multi-mode sort (\'recent\' | \'title\' | \'author\' | \'progress\') + Direction Toggle (↑/↓)"]',
    '    end',
    '',
    '    subgraph UI ["Presentation Layer (BookmarksView.tsx)"]',
    '        Header["SectionHeader (\'Continue Reading & Bookmarks\')\\n• Eyebrow, Flank lines, Clear Bookmarks modal\\n• Mark as Finished modal (conditional bookmark-reset notice)"]',
    '        Search["CollectionToolbar\\n(Search, Sort & Status Filter)"]',
    '        Tabs["Status Filter Options (All, In Progress, Completed, On Hold, Downloaded)"]',
    '        Cards["BookmarkCard.tsx\\n• Top-anchored silk ribbon (origin-top scale-y-110)\\n• Default compact text-only status pill (no icons/truncation popovers)\\n• 2-column archival grid (~580px width) matching NotebookView\\n• Single-column tactile scroll focus zone (< 1024px)\\n• Unified Title/Author Link Copy (300ms Tooltip & Copied! Pill)\\n• Reading coordinates & Line X badge\\n• Favorite/Bookshelf curation & RemoveCollectionBookModal\\n• 4-state square offline button & modal\\n• Status dropdown selector (conditional bookmark-reset modal on Finished)\\n• Desktop cursor-exit focus release (onDeactivate)"]',
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
      'Deterministic literary accolades evaluation, celebration queues, personal showcase pinning (max 3 bookplates), offline pin mutation queue (`pendingPinUpdates`), per-user coalesced (`coalesceInFlightByUser`) Supabase cloud synchronization with dirty-rerun tracking, and opt-in `15,000ms` passive mount cooldown (`lastAccoladesSyncByUser`, `invalidateAccoladesSyncCooldown`).',
    useAnnotationStore:
      'Scholar marginalia, categorical pastel highlights (Yellow, Amber, Mint, Rose), co-reader Fellow Marginalia (`fellowAnnotations`), cross-volume global fellow marginalia sync (`fetchAllFellowAnnotations`), companion profile enrichment & placeholder protection (`enrichFellowAnnotations`, `resolveStaleFellowProfiles`), chapter-bound Spoiler Shield (`spoilerShieldEnabled`), per-user coalesced (`coalesceInFlightByUser`) cloud outbox synchronization with retry-loop-safe dirty tracking, and opt-in `15,000ms` passive mount/drawer cooldowns (`lastPassiveAnnotationSyncByUser`, `lastFellowBookSyncByKey`, `invalidateAnnotationSyncCooldown`) decoupled from persisted `lastAnnotationSyncAt` LWW tracking.',
    useAuthStore:
      'Supabase session authentication with module-scoped `inFlightInitialUserCheck` Strict-Mode deduplication and synchronous `INITIAL_SESSION` racing protection, Google OAuth PKCE (`signInWithOAuth`), connected identities linking/unlinking (`linkOAuthIdentity`, `unlinkOAuthIdentity`), anti-lockout protection (`hasPasswordIdentity`), transient reload error resilience (`sessionData.session.user` preservation), Cloudflare Turnstile `captchaToken` forwarding (`signInWithPassword`, `signUpWithPassword`, `signInWithOtp`, `resetPasswordForEmail`, `resendVerificationEmail`), fail-closed password recovery verification (`verifyPasswordRecoverySession`, `isPasswordRecovery` validated via Supabase JWT `amr` claims + `3600s` TTL and single-use `bookarium-consumed-recovery` markers via `markRecoveryConsumed` / `clearConsumedRecoveryMarker` in `src/lib/auth-recovery.ts`), anonymous local `getSession()` guard before `getUser()`, scoped sign-out (`signOut(scope = \'local\')` default preserving remote/sibling-origin sessions, plus `signOutOtherDevices()` with `{ scope: \'others\' }` verifying `verifyActiveSessionValidity({ force: true })` and explicit `{ scope: \'global\' }` in `deleteAccount()`), active session inspection and strict per-device revocation (`listActiveSessions`, `revokeSession` via `get_active_sessions`/`revoke_user_session` RPCs checking missing `isCurrent` and explicit boolean `false` already-ended results with graceful `PGRST202`/`42883` fallback), throttled coalesced remote session validation (`verifyActiveSessionValidity` enforcing pre-commit local store teardown via coalesced `resetClientAuthState` on `400/401/403 session_not_found` while preserving transient offline/`5xx` errors), durable reload-safe teardown recovery (`bookarium-pending-store-cleanup` via `STORAGE_KEYS.PENDING_STORE_CLEANUP` stamped synchronously across `resetClientAuthState` and `onAuthStateChange` and flushed cleanly inside `initializeAuth` when interrupted mid-reload), non-blocking server-origin IP/UA reconciliation (`reconcileClientSessionOrigin` consuming `bookarium-client-ip-sync`), pre-sync active JWT session verification (`hasSupabaseAuthCookie`, `shouldVerifyCloudSession`, `verifyActiveCloudSession`) invoking full coalesced `resetClientAuthState` (`wipeDeviceStorage: false`) when cookies are cleared (`bookarium-auth-hint=guest`), offline-persisted profile & user state (`bookarium-auth-profile`), optimistic offline profile outbox (`pendingProfileUpdates`), shared `coalesceInFlightByUser` profile coalescing, OWASP current-password re-authentication (`updatePassword`), complete 10-store session teardown & IndexedDB/speech/sessionStorage erasure on account deletion (`clearLocalUserStores`), and cloud profile synchronization with live companion identity propagation.',
    useBookshelfStore:
      'Personal library collections, reading queue, reading history, custom named shelves, active-shelf-aware book clearing (`clearSavedBooks`, `clearCustomShelfBooks`), placeholder-to-authentic author & subject/format self-healing (`enrichSavedBooks`), atomic selector hooks (`useIsBookSaved`, `useIsBookFavorite`, `useHydratedBookshelfCounts`, `useBookRating`, `useReadingStatus`), deletion tombstones, ratings, opt-in `15,000ms` passive mount cooldown (`invalidateBookshelfSyncCooldown`), and cloud outbox reconciliation (`DELETE_BOOK`, `INSERT_BOOK`, `DELETE_FAVORITE`, `UPSERT_FAVORITE`, `UPSERT_CURATION`, `DELETE_CURATION`, `MOVE_BOOK`, `UPDATE_SHELF`) via `bookshelf-cloud-sync.ts`.',
    useFellowshipStore:
      'Opt-in 1-on-1 Reader Circle fellowships, per-volume Literary Symposium sessions, companion progress coordinates, offline symposium progress outbox (`pendingSymposiumProgress`), scholar handle formatting (`formatFellowScholarLabel`, `isPlaceholderUsername`), pending invitation badges, `verifyActiveCloudSession` session guard + per-user coalesced (`coalesceInFlightByUser`) Supabase cloud synchronization, and opt-in `15,000ms` passive mount cooldowns (`lastFellowshipSyncByUser`) automatically invalidated across membership/symposium mutations.',
    useHabitsStore:
      'Reading streaks with 5-minute active immersion threshold, daily calendar activity dates, annual volume challenge goals, deduplicated completed books count (`completed_books_count`), dual immersion telemetry (reading vs listening), strict `isRemoteAlreadyConverged` no-op upsert skipping, per-user coalesced (`coalesceInFlightByUser`) Supabase cloud synchronization, and opt-in `15,000ms` passive mount cooldown (`lastHabitsSyncByUser`, `invalidateHabitsSyncCooldown`) bypassed while debounce timers or dirty flags are pending.',
    useJurisdictionStore:
      'Client-side geographic jurisdiction state, cookie synchronization (bookarium-geo-country), developer country overrides, and synchronous regional capability resolution.',
    usePreferencesStore:
      'Reader display choices, sticky header auto-hide preferences, Web Speech API narration configuration (`speechRate`, `speechVoiceURI`, `speechAutoPageAdvance`, `speechHighlightEnabled`), saved personal default preset (`customDefaults`), and cloud sync timestamp (`preferencesUpdatedAt`).',
    useReaderStore:
      'Active book payload with verified lifespan preservation, typography settings (size, family, line height), page brightness (`30%–100%`), persistent reading mode (`paginated` vs `scroll`) and column width (`narrow` / `normal` / `wide`), chapter/page/row coordinates (`bookmarkRow`) and cross-display/font-reflow resilient passage anchor (`bookmarkText`, cleared on finished status), bookmark deletion tombstones (`deletedPositionBookIds`), persisted dirty edit tracking (`dirtyPositionBookIds` cleared via snapshot-guarded `clearUploadedDirtyPositions` with `0%` Page-1 ghost dirty-flag scrubbing & stale debounce timer cancellation across `saveReadingPosition`, `syncReadingPositionToCloud` `!row`, and `syncWithCloud`), upload-verified monotonic sync watermark (`lastReaderSyncAt` anchored via `Math.max(syncSnapshotStartedAtMs, maxRemoteTimeMs)` for authoritative cross-device remote deletion pruning without clobbering standalone `Finished` curation), placeholder-to-authentic author & lifespan self-healing (`enrichReadingPositions`, `saveReadingPosition`), opt-in `15,000ms` passive mount cooldown (`lastReaderSyncByUser`, `invalidateReaderSyncCooldown`), and per-user coalesced (`coalesceInFlightByUser`) bidirectional Supabase `reading_progress` sync with `2,000ms` single-book debouncing, batched multi-book `Promise<boolean>` upserts (`buildReadingProgressCloudRow`, `upsertReadingProgressBatch`), `SELECT`-gated legacy orphan `.delete()` (`isGhostCloudRow`), and full `resetReaderSession()` teardown parity.',
    useThemeStore:
      'Global application theme state (Day Paper, Sepia Parchment, Obsidian Dark) with immediate document class application and synchronous cookie synchronization (`bookarium-theme-preference`) for Zero-Flash SSR hydration.',
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
    '## 🔄 Event Bus, Cross-Store Reactivity & State-Flow Topology',
    '',
    'Bookarium coordinates state transitions across 10 Zustand stores, IndexedDB, off-thread Web Workers, the PWA Service Worker, and Supabase Cloud via a deterministic reactive event bus:',
    '',
    '### 1. Cross-Store, Worker & DOM Event Bus Diagram',
    '',
    '```mermaid',
    'flowchart TD',
    '    subgraph BrowserEvents ["Browser, DOM & Auth Event Emitters"]',
    '        EvtAuth["🔐 supabase.auth.onAuthStateChange\\n(SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT)"]',
    '        EvtOnline["📡 window online / offline Events\\n(useNetworkStatus • useSyncExternalStore)"]',
    '        EvtIDB["📦 CustomEvent: bookarium:offline-updated\\n& bookarium:offline-downloading"]',
    '        EvtCopyLink["📋 CustomEvent: bookarium:book-link-copied\\n(CursorTooltip Copy Feedback Sync)"]',
    '        EvtSessionSync["🔄 BroadcastChannel: bookarium-sessions-sync\\n& CustomEvent: bookarium:auth-token-refreshed"]',
    '        EvtVis["👁️ document.visibilitychange & window focus/blur\\n(2-Minute Active Immersion Guard & Visible Poll)"]',
    '        EvtSpeech["🔊 speechSynthesis.onvoiceschanged & boundary\\n(Web Speech Neural Voice & Word Sync)"]',
    '    end',
    '',
    '    subgraph Coordinators ["Cross-Store Coordinators & Bridges"]',
    '        SyncCoord["🔄 syncAllStoresWithCloud (src/lib/sync-utils.ts)\\n• Per-user in-flight mutex coalescing (coalesceInFlightByUser)\\n• Render-pure 15s cooldown (Providers lastSyncTimeRef)\\n• Outbox flush -> Parallel Select -> LWW Merge"]',
    '        SessionGuard["🛡️ verifyActiveSessionValidity & reconcileClientSessionOrigin\\n• online / visiblechange / 60s visible poll (10s cooldown)\\n• Teardown on 400/401/403 session_not_found"]',
    '        PrefsBridge["⚙️ Scholar Preferences Bridge (src/lib/preferences-sync.ts)\\n• 13-key snapshot • Custom Defaults • Factory Reset\\n• 2s debounced public.profiles.preferences JSONB sync"]',
    '        AutoHeal["🩺 useCollectionAutoHeal & isPlaceholderAuthor Guards\\n• Scans Saved, Favorites, Positions, Annotations, Symposiums\\n• Non-regressive author lifespan enrichment"]',
    '        Teardown["🧹 Account Erasure & Session Teardown\\n• public.delete_current_user() RPC\\n• resetClientAuthState & clearLocalUserStores"]',
    '    end',
    '',
    '    subgraph StoreCascades ["Reactive Cross-Store State Cascades"]',
    '        SAuth[("useAuthStore")]',
    '        SShelf[("useBookshelfStore")]',
    '        SReader[("useReaderStore")]',
    '        SHabits[("useHabitsStore")]',
    '        SAccolades[("useAccoladesStore")]',
    '        SFellow[("useFellowshipStore")]',
    '        SAnnot[("useAnnotationStore")]',
    '        SPrefs[("usePreferencesStore")]',
    '        STheme[("useThemeStore")]',
    '    end',
    '',
    '    subgraph WorkerIPC ["Off-Thread Worker & PWA Service Worker IPC"]',
    '        ParserWorker["⚙️ gutenberg.worker.ts\\npostMessage: PARSE_BOOK -> PARSE_SUCCESS / PARSE_ERROR"]',
    `        SWChannel["🛡️ public/sw.js (${swMeta.cacheName})\\npostMessage: CACHE_URLS -> App Shell & Chunk Warmup"]`,
    '    end',
    '',
    '    EvtAuth --> SAuth',
    '    SAuth -->|"Authenticated Session"| SyncCoord',
    '    SAuth -->|"TOKEN_REFRESHED / Sessions Changed"| EvtSessionSync',
    '    SAuth -->|"Sign-Out / Account Delete"| Teardown',
    '    EvtOnline -->|"Reconnect Flush"| SyncCoord',
    '    EvtOnline -->|"Reconnect Session Check"| SessionGuard',
    '    EvtOnline -->|"Flush Pending Profile Edits"| SAuth',
    '    EvtVis -->|"Visible Tab / 60s Check"| SessionGuard',
    '    SessionGuard -->|"Revoked -> scope: local"| Teardown',
    '    SessionGuard -->|"Reconcile IP/UA Origin"| SAuth',
    '    EvtSessionSync -->|"Bypass Cooldown & Refresh Security List"| SyncCoord',
    '    SyncCoord --> SShelf',
    '    SyncCoord --> SReader',
    '    SyncCoord --> SAnnot',
    '    SyncCoord --> SHabits',
    '    SyncCoord --> SAccolades',
    '    SyncCoord --> SFellow',
    '    SyncCoord --> PrefsBridge',
    '    PrefsBridge <--> SPrefs',
    '    PrefsBridge <--> SReader',
    '    PrefsBridge <--> STheme',
    '    SShelf -->|"setReadingStatus(id, finished)\\nResets bookmarkRow=0 & bookmarkText"| SReader',
    '    SShelf -->|"Finished Volume Telemetry"| SHabits',
    '    SHabits -->|"Streak & Immersion Milestones"| SAccolades',
    '    SFellow -->|"removeFellow / endSymposium\\nPrunes fellowAnnotations"| SAnnot',
    '    EvtIDB -->|"Broadcast Cache Delta"| SShelf',
    '    EvtVis -->|"Active / Idle Tick"| SHabits',
    '    EvtSpeech -->|"TTS Immersion Bypass"| SHabits',
    '    AutoHeal --> SShelf',
    '    AutoHeal --> SReader',
    '    AutoHeal --> SAnnot',
    '    AutoHeal --> SFellow',
    '```',
    '',
    '### 2. Reactive Signals, Custom Events & Worker IPC Matrix',
    '',
    '| Event / Signal Channel | Emitter Module | Subscriber Module(s) | Payload Contract | Architectural Side-Effect |',
    '| :--- | :--- | :--- | :--- | :--- |',
  );

  const signalMetaMap = {
    'CustomEvent:bookarium:offline-updated': {
      payload: '`CustomEvent<void>`',
      effect:
        'Re-enumerates IndexedDB keys/metadata (`useOfflineBooks`) and updates `Downloaded (N)` smart shelf & offline badges across mounted components.',
    },
    'CustomEvent:bookarium:offline-downloading': {
      payload: '`CustomEvent<{ bookId: number | null }>`',
      effect:
        'Synchronizes active download progress indicators across BookCard, BookmarkCard, BookshelfSpine, and DownloadDrawer.',
    },
    'CustomEvent:bookarium:auth-token-refreshed': {
      payload: '`CustomEvent<{ userId: string }>`',
      effect:
        'Bypasses the `15,000ms` sync cooldown to re-trigger `syncAllStoresWithCloud()` immediately after background JWT `TOKEN_REFRESHED` recovery and refreshes active session IP/UA metadata when the Account Security tab is open.',
    },
    'CustomEvent:bookarium:book-link-copied': {
      payload: '`CustomEvent<{ bookId: string; url: string }>`',
      effect:
        'Synchronizes `Copied!` inline indicators and floating `CursorTooltip` feedback (`1,800ms`) across concurrent `[data-copy-book-id]` surfaces.',
    },
    'BroadcastChannel:bookarium-sessions-sync': {
      payload: '`{ type: "sessions-changed", userId, senderId }`',
      effect:
        'Synchronizes the Active Device Sessions list across open same-origin sibling tabs (filtering own `senderId` echoes) immediately after single-device revocation or Sign Out Other Devices.',
    },
  };

  for (const sig of crossBoundary.signalChannels) {
    if (!sig.isCustomSignal) continue;
    const key = `${sig.kind}:${sig.name}`;
    const meta = signalMetaMap[key];
    const emittersCell =
      sig.emitters.length > 0
        ? sig.emitters.map((e) => `[\`${e}\`](${e})`).join(', ')
        : '_Dynamic Runtime Emitter_';
    const subscribersCell =
      sig.subscribers.length > 0
        ? sig.subscribers.map((s) => `[\`${s}\`](${s})`).join(', ')
        : '_Broadcast Receiver_';
    const displayName =
      sig.kind === 'BroadcastChannel' ? `BroadcastChannel: ${sig.name}` : sig.name;
    const payloadStr =
      meta?.payload ||
      (sig.detailKeys.length > 0
        ? `\`${sig.kind}<{ ${sig.detailKeys.join(', ')} }>\``
        : `\`${sig.kind}<void>\``);
    const effectStr = meta?.effect || 'Cross-boundary runtime signal channel.';
    lines.push(
      `| **\`${displayName}\`** | ${emittersCell} | ${subscribersCell} | ${payloadStr} | ${effectStr} |`
    );
  }

  lines.push(
    '| **`window` `online` / `offline`** | Browser Network Stack | [`src/hooks/useNetworkStatus.ts`](src/hooks/useNetworkStatus.ts), [`src/app/providers.tsx`](src/app/providers.tsx) | `Event` (`navigator.onLine`) | Switches UI to offline restriction parity (`isUnavailableOffline`), activates IndexedDB catalog fallback, and flushes all 7 cloud-synced store outboxes upon reconnect. |',
    '| **`supabase.auth.onAuthStateChange`** | [`src/app/providers.tsx`](src/app/providers.tsx) | [`src/stores/useAuthStore.ts`](src/stores/useAuthStore.ts), [`src/lib/sync-utils.ts`](src/lib/sync-utils.ts) | `(event, session)` | Hydrates scholar profile, verifies active JWT session (`verifyActiveCloudSession`), triggers `syncAllStoresWithCloud`, and reconciles `public.profiles.preferences` JSONB. |',
    '| **`setReadingStatus(id, "finished")`** | [`src/stores/useBookshelfStore.ts`](src/stores/useBookshelfStore.ts) | [`src/stores/useReaderStore.ts`](src/stores/useReaderStore.ts), [`src/stores/useHabitsStore.ts`](src/stores/useHabitsStore.ts), [`src/stores/useAccoladesStore.ts`](src/stores/useAccoladesStore.ts) | `(bookId: number, status: ReadingStatus)` | Clears `bookmarkRow` (`0`) and `bookmarkText` (`undefined`), updates `completed_books_count`, and evaluates Ex-Libris accolades. |',
    '| **`removeFellow` / `endSymposium`** | [`src/stores/useFellowshipStore.ts`](src/stores/useFellowshipStore.ts) | [`src/stores/useAnnotationStore.ts`](src/stores/useAnnotationStore.ts) | `(fellowId: string)` / `(sessionId: string)` | Invokes `pruneFellowAnnotationsByFellow` / `pruneFellowAnnotationsForSymposium` to evict stale co-reader marginalia immediately. |',
    '| **`schedulePreferencesCloudSync`** | [`src/lib/preferences-sync.ts`](src/lib/preferences-sync.ts) | [`src/stores/usePreferencesStore.ts`](src/stores/usePreferencesStore.ts), [`src/stores/useReaderStore.ts`](src/stores/useReaderStore.ts), [`src/stores/useThemeStore.ts`](src/stores/useThemeStore.ts) | `ProfilePreferencesPayload` (`active`, `customDefaults`, `updatedAt`) | Coalesces 13 typography, theme, layout, spoiler-shield, and speech settings into a 2,000ms debounced LWW cloud upsert. |',
    '| **`Worker: PARSE_BOOK`** | [`src/hooks/reader/useGutenbergParserWorker.ts`](src/hooks/reader/useGutenbergParserWorker.ts) | [`src/workers/gutenberg.worker.ts`](src/workers/gutenberg.worker.ts) | `{ type: "PARSE_BOOK", requestId, text, charsPerPage }` | Executes off-thread paragraph reflow, TOC suppression, chapter segmentation, and virtual page slicing; replies with `PARSE_SUCCESS` or `PARSE_ERROR`. |',
    `| **\`ServiceWorker: CACHE_URLS\`** | [\`src/components/pwa/ServiceWorkerRegister.tsx\`](src/components/pwa/ServiceWorkerRegister.tsx) | [\`public/sw.js\`](public/sw.js) | \`{ type: "CACHE_URLS", urls: string[] }\` | Warms \`${swMeta.cacheName}\` CacheStorage with \`/\`, \`/account\`, \`/read/1342\`, and discovered \`/_next/static/\` JS/CSS chunks. |`,
    '',
    '### 3. Client Storage, Conflict-Resolution & Account Erasure Parity Matrix (Rule 9 / GDPR Art. 17)',
    '',
    '| Storage Domain / Store | Local Storage Key & Medium | Cloud PostgreSQL Table(s) | Sync & Conflict-Resolution Strategy | 3-Layer Account Erasure Parity (`deleteAccount`) |',
    '| :--- | :--- | :--- | :--- | :--- |',
    '| **`useBookshelfStore`** | `bookarium-bookshelf-storage` (`localStorage`) | `public.bookshelves`, `public.bookshelf_items`, `public.user_favorites`, `public.user_book_curation` | Sequential Outbox Replay (`outbox[]`) + Deletion Tombstones (`deletedBookIds`, `deletedFavoriteIds`) + Non-Regressive Metadata Merge (`mergeCloudBookWithLocal`) | 1. `delete_current_user()` RPC + `ON DELETE CASCADE`<br>2. Client `.delete()` fallback<br>3. `clearBookshelf()` (`savedBooks`, `favoriteBooks`, `outbox`, `cloudBookshelves`) |',
    '| **`useReaderStore`** | `bookarium-reader-preferences` (`localStorage`) | `public.reading_progress` | 2,000ms Debounced Single-Book Upsert + Batched Multi-Book Upsert (`upsertReadingProgressBatch`, `Promise<boolean>` upload verification) + `SELECT`-Gated Ghost Cleanup (`isGhostCloudRow`) & Ghost Dirty-Flag Scrubbing + Authoritative Non-Dirty Deletion Pruning (`lastReaderSyncAt` monotonic anchor, `dirtyPositionBookIds`, `clearUploadedDirtyPositions`, `dirtyReaderSyncUsers` rerun) + `coalesceInFlightByUser` + Timestamp Last-Write-Wins (`lastReadAt >= remoteTime`) + Tombstones (`deletedPositionBookIds`) + Fractional `scroll_offset` (`page + row/1000`) | 1. `delete_current_user()` RPC + `ON DELETE CASCADE`<br>2. Client `.delete()` fallback<br>3. `resetReaderSession()` + `clearReadingPositions()` + `resetReaderAppearanceToDefaults()` |',
    '| **`useAnnotationStore`** | `bookarium-annotations-storage` (`localStorage`) | `public.user_annotations` | Outbox Replay (`outbox[]`) + Tombstones (`deletedIds`) + LWW Timestamp (`updatedAt`) + Passive `15s` Mount Cooldown (`lastPassiveAnnotationSyncByUser`) + Symposium RLS (`reconcileFellowAnnotationsWithSymposiums`) | 1. `delete_current_user()` RPC + `ON DELETE CASCADE`<br>2. Client `.delete()` fallback<br>3. `clearAnnotations()` (wipes personal & fellow marginalia + outbox) |',
    '| **`useFellowshipStore`** | `bookarium-fellowship-storage` (`localStorage`) | `public.reader_circles`, `public.symposium_sessions` | Outbox Queue (`pendingSymposiumProgress`) + Passive `15s` Mount Cooldown & Mutation Invalidation (`lastFellowshipSyncByUser`) + Participant RLS (`requester_id`/`recipient_id`, `host_id`/`fellow_id`) + Trigger Identity Propagation | 1. `delete_current_user()` RPC + `ON DELETE CASCADE`<br>2. Client `.or(...)` `.delete()` fallback<br>3. `clearFellowship()` |',
    '| **`useHabitsStore`** | `bookarium-reading-habits` (`localStorage`) | `public.user_reading_habits` | Union Merge of `activityDates[]` + Max Streak/Minutes/Completed Books Reconciliation | 1. `delete_current_user()` RPC + `ON DELETE CASCADE`<br>2. Client `.delete()` fallback<br>3. `clearHabits()` |',
    '| **`useAccoladesStore`** | `bookarium-accolades-storage` (`localStorage`) | `public.user_accolades` | Pending Pin Mutation Queue (`pendingPinUpdates`) + Idempotent `(user_id, accolade_id)` Upsert | 1. `delete_current_user()` RPC + `ON DELETE CASCADE`<br>2. Client `.delete()` fallback<br>3. `clearAccolades()` |',
    '| **`useAuthStore`** | `bookarium-auth-profile`, `bookarium-pending-store-cleanup` (`localStorage`), `bookarium-consumed-recovery` (`sessionStorage`) | `public.profiles`, `auth.users`, `auth.sessions`, `storage.objects` | Optimistic Offline Profile Outbox (`pendingProfileUpdates`) + Pre-Sync Active JWT Guard (`verifyActiveCloudSession` delegating cookie-clearance teardowns to `resetClientAuthState`), Durable Interrupted-Reload Teardown Marker (`bookarium-pending-store-cleanup` flushed in `initializeAuth`), Fail-Closed JWT AMR & Single-Use Recovery Verification (`verifyPasswordRecoverySession`, `clearConsumedRecoveryMarker`), Throttled Remote Revocation Check (`verifyActiveSessionValidity`), Browser IP/UA Reconciliation (`reconcileClientSessionOrigin`), & Owner-Scoped Device Session Inspection/Revocation (`get_active_sessions`, `revoke_user_session`) | 1. `delete_current_user()` purges 11 tables, `storage.objects`, and `auth.users` alongside `{ scope: \'global\' }` sign-out<br>2. Standard `signOut()`, `verifyActiveCloudSession` resets, and `verifyActiveSessionValidity` teardowns share coalesced `resetClientAuthState` (`scope: \'local\'`) clearing all local user stores before setting `user: null`, removing `bookarium-pending-store-cleanup`, preserving IndexedDB `offline_books`, and clearing current-origin cookies without terminating peer devices |',
    '| **`usePreferencesStore` & `useThemeStore`** | `bookarium-preferences-storage`, `bookarium-theme-storage` (`localStorage`) | `public.profiles.preferences` (`JSONB`) | 2,000ms Debounced LWW Timestamp (`preferencesUpdatedAt`) across `active` & `customDefaults` 13-key snapshots | Reset to `FACTORY_PREFERENCES` (`theme: "light"`, `stickyScroll: true`, default TTS) via `clearLocalUserStores({ wipeDeviceStorage: true })` |',
    '| **Quote Pool & Passage LRU Caches** | `bookarium-quote-enriched-books-v1`, `bookarium-extracted-passages-v1` (`localStorage`) | `public.books.quotes` (`JSONB`, Read-Only) | `12h` TTL 48-volume (`DEFAULT_QUOTE_POOL_LIMIT = 48`) 2-spread rotating pool (`useBooks.ts`) + `30-day` TTL / `100`-book LRU dynamically extracted passages (`useBookPassageShuffle.ts`) | Public domain literary quote caches (zero user PII); `bookarium-extracted-passages-v1` cleared via `clearCachedBookPassages()` |',
    '| **`offline-storage` (IndexedDB)** | `BookariumOfflineDB` (`v2`: `offline_books` + `cover_cache`) | _Device-Local Unabridged Cache_ | Offline-First Read (`networkMode: "always"`) + Asynchronous Author Lifespan Back-Fill (`patchOfflineBookAuthors`) + Mirror-Agnostic Cover Cache (`300` LRU / `30d` TTL) | Wiped completely via `clearAllOfflineBooks()` during `clearLocalUserStores({ wipeDeviceStorage: true })` |',
    '| **Reader Scroll, Recovery Guard & SSR Hydration Cookies** | `bookarium-reader-scroll-*` & `bookarium-consumed-recovery` (`sessionStorage`), `bookarium-geo-country`, `bookarium-theme-preference`, `bookarium-auth-hint`, `bookarium-client-ip-sync` (`maxAge=120`), `sb-*-auth-token` (`Cookie`) | _Ephemeral / Edge SSR Session_ | Synchronous Edge Geo-IP Stamping (`src/proxy.ts`), Zero-Flash SSR Theme/Auth Hint Hydration (`src/app/layout.tsx`), Post-Server-Login/Refresh IP Sync (`reconcileClientSessionOrigin`), Single-Use Recovery Consumption Guard (`auth-recovery.ts`), & Per-Tab Scroll Offset Restoration | `sessionStorage` scroll & consumed-recovery keys purged on sign-out / account deletion (`clearConsumedRecoveryMarker`); `bookarium-auth-hint` reset to `guest`; `bookarium-client-ip-sync` expired (`max-age=0`); `bookarium-theme-preference` reset to `light`; `sb-*-auth-token` session cookies cleared |',
    '',
    '---',
    '',
    '## ⏱️ Runtime Execution Workflows (Temporal Sequence Diagrams)',
    '',
    '### 1. Cold Launch, Edge Geo-IP Resolution, Hydration & 7-Store Cloud Outbox Reconciliation',
    '',
    '```mermaid',
    'sequenceDiagram',
    '    autonumber',
    '    actor Reader as 👤 Reader Browser',
    '    participant Proxy as 🌐 src/proxy.ts (Edge)',
    '    participant Providers as ⚛️ src/app/providers.tsx',
    '    participant Local as 💾 localStorage & IndexedDB',
    '    participant Sync as 🔄 sync-utils.ts & preferences-sync.ts',
    '    participant Supabase as ⚡ Supabase Cloud (RLS)',
    '',
    '    Reader->>Proxy: GET / (or /bookshelf, /read/[id])',
    '    Proxy->>Proxy: Resolve country (x-vercel-ip-country -> ?country -> cookie)',
    '    Proxy->>Supabase: Refresh SSR Auth Session Cookie (updateSession • skipped when no sb-* cookie, on /api/books*, or public rsc=1)',
    '    Proxy-->>Reader: HTML Shell + Set-Cookie (bookarium-geo-country) + 7 OWASP Headers',
    '    Reader->>Providers: Mount RootLayout & Providers',
    '    Providers->>Local: Hydrate 10 Zustand Stores & Atomic IndexedDB IDs + Metas (0ms)',
    '    Providers->>Supabase: checkInitialUser() Flush PENDING_STORE_CLEANUP -> getSession() & onAuthStateChange',
    '    alt Active Authenticated JWT Session (verifyActiveCloudSession) & Navigator Online',
    '        Providers->>Sync: syncAllStoresWithCloud() (15s Cooldown + coalesceInFlightByUser)',
    '        Sync->>Supabase: 1. Flush Pending Outboxes (Bookshelf, Annotations, Pins, Symposiums, Profile)',
    '        Sync->>Supabase: 2. Parallel Promise.all Select across 11 User-Scoped Tables',
    '        Supabase-->>Sync: Cloud Rows (Scoped by auth.uid() & Symposium RLS)',
    '        Sync->>Local: 3. Filter Tombstones + LWW Merge + Authoritative Non-Dirty Deletion Pruning + Non-Regressive Author Merge',
    '        Sync->>Local: 4. Single-Commit Atomic Store Updates & Reconcile 13-Key Preferences JSONB',
    '    else Cleared Auth Cookie on Signed-In State (!session && !hasSupabaseAuthCookie)',
    '        Providers->>Local: resetClientAuthState (Coalesced Pre-Null Clear via PENDING_STORE_CLEANUP, Preserve offline_books)',
    '    else Genuine Guest Mode or Offline',
    '        Providers->>Local: Operate 100% from LocalStorage & IndexedDB with Zero API Keys (0 RLS Errors)',
    '    end',
    '```',
    '',
    '### 2. Focus Reader Launch, Jurisdictional Gatekeeping (`HTTP 451`), Multi-Mirror Streaming & Worker AST',
    '',
    '```mermaid',
    'sequenceDiagram',
    '    autonumber',
    '    actor Reader as 👤 Reader Browser',
    '    participant Hook as 📖 useBookContent & WorkerHook',
    '    participant IDB as 📦 IndexedDB (offline-storage.ts)',
    '    participant API as 🛡️ GET /api/books/content',
    '    participant Gate as ⚖️ metadata-cache & copyright-engine',
    '    participant Upstream as 🌐 Supabase DB / 4 Gutenberg Mirrors',
    '    participant Worker as ⚙️ gutenberg.worker.ts',
    '',
    '    Reader->>Hook: Navigate to /read/[id] (Warm Metadata from useReaderStore)',
    '    Hook->>IDB: getOfflineBook(bookId) (networkMode: always)',
    '    alt Cached in IndexedDB & Verified Public Domain in Jurisdiction',
    '        IDB-->>Hook: Return Unabridged Text Instantaneously (0ms, 100% Offline)',
    '    else Not Cached Locally (Online Fetch)',
    '        Hook->>API: GET /api/books/content?id=[id]',
    '        API->>API: Strict Query Allowlist, activeRateLimiter.check() (30 text / 60 cover / 20 card) & url-validator.ts',
    '        API->>Gate: resolveBookMetadata(id) (1. 24h LRU -> 2. Supabase -> 3. Bundled Featured Classics)',
    '        Gate->>Gate: isBookPublicDomainInJurisdiction(authors, translators, country)',
    '        alt Restricted in Client Jurisdiction (e.g. Life+70 / Life+100)',
    '            Gate-->>API: Protected Status + Public Domain Unlock Year',
    '            API-->>Hook: HTTP 451 Unavailable For Legal Reasons',
    '            Hook-->>Reader: Render ReaderErrorView with Declarative CopyrightNoticeBanner',
    '        else Public Domain Verified',
    '            API->>Upstream: Fetch Text (20-Book Server LRU -> Tier 1: Supabase plain_text -> Tier 2: Coalesced 4-Mirror Waterfall)',
    '            Upstream-->>API: Plain-Text Stream (UTF-8)',
    '            API-->>Hook: 200 OK (s-maxage=86400, Vary: x-vercel-ip-country)',
    '            Hook->>IDB: Auto-Cache Volume & Verified Author Lifespans in IndexedDB',
    '        end',
    '    end',
    '    Hook->>Worker: postMessage({ type: PARSE_BOOK, text, charsPerPage })',
    '    Worker->>Worker: reflowGutenbergParagraphs -> TOC Suppressor -> parseGutenbergChapters -> paginateChapterContent',
    '    Worker-->>Hook: PARSE_SUCCESS (Chapters AST & Virtual Page Spreads)',
    '    Hook-->>Reader: Render ReaderSurface & Scroll to Canonical bookmarkText DOM Range',
    '```',
    '',
    '### 3. Offline Mutation Queueing, Adaptive Offline Catalog & Reconnect Outbox Replay',
    '',
    '```mermaid',
    'sequenceDiagram',
    '    autonumber',
    '    actor Reader as 👤 Reader Browser',
    `    participant Net as 📡 useNetworkStatus & sw.js (${swMeta.versionLabel})`,
    '    participant Catalog as 📚 Adaptive Offline Catalog',
    '    participant Stores as ⚡ Zustand Stores & Local Outboxes',
    '    participant Sync as 🔄 Bookshelf & 7-Store Sync Engine',
    '    participant Cloud as ⚡ Supabase Cloud',
    '',
    '    Reader->>Net: Device Loses Connectivity (window offline event)',
    '    Net-->>Reader: Navbar Red Offline Indicator (data-testid=navbar-offline-dot)',
    '    Reader->>Catalog: Browse / or /read/[id]',
    `    Net-->>Catalog: Serve Cached App Shell (sw.js ${swMeta.versionLabel}) + IndexedDB Volumes (useOfflineCatalogFallback)`,
    '    Catalog-->>Reader: Dim Uncached Books (isUnavailableOffline) with Not Downloaded Badges',
    '    Reader->>Stores: Mutate Library Offline (Save Book, Move Shelf, Pin Accolade, Read & Bookmark)',
    '    Stores->>Stores: Apply Optimistic State + Append Action to Persistent localStorage Outbox',
    '    Reader->>Net: Device Regains Connectivity (window online event)',
    '    Net->>Sync: Trigger syncAllStoresWithCloud() & flushPendingProfileUpdates()',
    '    Sync->>Sync: Acquire Per-User In-Flight Mutex (inFlightOutboxFlushes)',
    '    Sync->>Cloud: Replay Outbox Actions Sequentially & Upsert Latest Reading/Habit Coordinates',
    '    Cloud-->>Sync: 200 OK Confirmed',
    '    Sync->>Stores: Clear Replayed Outbox Entries & Reconcile Canonical Cloud State',
    '```',
    '',
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
      cacheDesc = '`s-maxage=86400` (Catalog, `Vercel-Cache-Tag: catalog` or `catalog,quotes` when `has_quotes=true`, `MAX_CATALOG_PAGE=5000` / `MAX_CATALOG_OFFSET=160_000`) / `s-maxage=43200` (`?pool=quotes`, `Vercel-Cache-Tag: quotes`, 12h rotating `DEFAULT_QUOTE_POOL_LIMIT=48`) / `s-maxage=604800` (`?ids=...&has_quotes=true` [`Vercel-Cache-Tag: catalog,quotes`] & `include_restricted_metadata=true` [`Vercel-Cache-Tag: catalog`]) • Query Allowlist (`400 no-store`), `CORP: same-origin` & `nosniff` • `globalThis` `booksApiRateLimiter` (`60 req/min`) • `503 no-store` DB-down guard';
      upstream = 'Supabase `public.books` (`searchBooks` / `fetchQuoteEnrichedPool`) -> `curated-fallback.ts` (unconfigured search fallback, omits `Vercel-Cache-Tag`)';
    } else if (r.path === '/api/books/content') {
      cacheDesc = '`max-age=86400, s-maxage=86400, stale-while-revalidate=604800` (text `CORP: same-origin`; `type=card` OpenGraph PNG `CORP: cross-origin` with dynamic `SITE_CONFIG.SITE_HOST` footer) / `max-age=604800, s-maxage=604800, stale-while-revalidate=2592000` (`type=cover`, `CORP: same-origin`, metadata check bypassed) • Strict Query Allowlist (`s` gated to `type=card`), Mode-Scoped `globalThis` Limiters (`30` text / `60` cover / `20` card req/min), 20-Book LRU (`bookContentLruCache`), In-Flight Mirror Coalescing, Anti-SSRF Allowlist & Unified US (`copyright === true`) + Non-US `HTTP 451` Gate';
      upstream = 'Supabase `plain_text` -> Gutenberg Multi-Mirror CDN & `next/og` `ImageResponse`';
    } else if (r.path === '/api/books/translations') {
      cacheDesc = '`max-age=86400, s-maxage=604800, stale-while-revalidate=2592000`, `Vercel-Cache-Tag: translations` (`200` responses) • Query Allowlist, Strict ID (`1..10_000_000`), `CORP: same-origin` & `nosniff` • `globalThis` `booksApiRateLimiter` (`60 req/min`) & Jurisdictional Filter';
      upstream = 'Supabase `public.book_translations` & `public.books`';
    } else if (r.path === '/auth/callback') {
      cacheDesc =
        '`No-Store Auth Exchange` • PKCE (`redirectType=recovery`) & OTP Recovery Scoping, Cross-Device Recovery Notice Routing, Sanitized `User-Agent` Forwarding, Non-Recovery `bookarium-client-ip-sync` Cookie Stamping + Canonical Origin Redirect Sanitizer';
      upstream = 'Supabase Auth (`exchangeCodeForSession`, `verifyOtp`)';
    }
    lines.push(`| **\`${r.path}\`** | \`${r.methods}\` | [\`${r.file}\`](${r.file}) | ${cacheDesc} | ${upstream} |`);
  }

  const pageDescriptions = {
    'src/app/layout.tsx': 'Root HTML shell, canonical `SITE_CONFIG.NAME` (`Bookarium`) tab/OpenGraph title, font initialization, theme class hydration, SSR hourly/daily featured book seeds (`getHourlyFeaturedBook`, `getDailyClassicBook`), and global React Query / Service Worker provider wrapper.',
    'src/app/providers.tsx': 'Root client provider initializing TanStack `QueryClient`, Strict-Mode-coalesced Supabase authentication (`initializeAuth`, `onAuthStateChange`, unthrottled `bookarium:auth-token-refreshed`), non-blocking browser IP/UA reconciliation (`reconcileClientSessionOrigin`), visible-tab (`60,000ms`), `visibilitychange`, and `online` remote session revocation detection (`verifyActiveSessionValidity`), auth callback notice handling (`email_verified` and cross-device PKCE `recovery_cross_device` routing into `AuthModal`), `15,000ms` render-pure `lastSyncTimeRef` cooldown guarding `syncAllStoresWithCloud` reconciliation and `online` / `visibilitychange` flushes, `GlobalTitleTooltip` stylized tooltip delegation, and dynamic `AuthModal` rendering.',
    'src/app/loading.tsx': 'Next.js App Router streaming & pre-hydration loading splash boundary rendering the vector Bookarium crest and animated loading indicator.',
    'src/app/globals.css': 'Tailwind CSS v4 Oxide stylesheet defining Day (`#fcfbf9`), Cozy Coffee Sepia (`#2b1d16`), and Dark Obsidian (`#0e1117`) theme tokens, 3D hardcover book hinge physics (`.book-center-crease`, `.preserve-3d`), directional view-slide keyframes (`.animate-view-slide-left`, `.animate-view-slide-right` with `360ms` tactile slide & nested `.animate-page-turn` suppression inside `@media (max-width: 1366px), (pointer: coarse)` vs. `0ms` outer switch & preserved `180ms` inner `.animate-page-turn` on `> 1366px` non-tactile PCs), and custom reader scrollbars.',
    'src/app/page.tsx': 'Primary SPA workbench hosting Catalog, Bookshelf, Favorites, Bookmarks, and Commonplace Notebook views with edge URL rewrites, sort-aware unfiltered Catalog headings (`CATALOG_SORT_TITLES` resolving `Recent Books`, `Popular Books`, and `Oldest Books` via `VIEW_CONTENT_CONFIG.catalog.getTitle({ search, topic, era, sort })` while preserving `Search Catalog` precedence when filters or search terms are active), asymmetric directional collection transitions (`NAVBAR_TRANSITION_ORDER` slide into/between collections on both tactile swipes and `Navbar` tab clicks/taps + instantaneous `0ms` return to `catalog` so repeated `Catalog` -> `Bookshelf` transitions replay reliably), 12-hour sliding-cache hero/editorial boundary guards (`selectHourlyHeroFromPool`, `selectDailyClassicFromPool`), and dynamic `NAVBAR_VIEW_CONFIG` tab title synchronization (`Bookarium` / `Bookarium | <View>`).',
    'src/app/error.tsx': 'Route-level React Error Boundary providing graceful recovery UI and diagnostic fallback.',
    'src/app/global-error.tsx': 'Root document-level React Error Boundary catching fatal top-level layout exceptions.',
    'src/app/not-found.tsx': 'Editorial 404 Not Found boundary with direct navigation back to the public domain catalog.',
    'src/app/read/[id]/layout.tsx': 'Server layout generating ISR 24h dynamic `Bookarium | Reader | <Title> — <Author>` (`SITE_CONFIG.READER_NAME`), featured `openingLine` + tag/translator-enriched `<meta name="keywords">`, OpenGraph `book:author`/`book:tag`, Twitter Card, Schema.org Book JSON-LD (`identifier`, `bookFormat`, `MediaObject` `encoding`, `birthDate`/`deathDate` contributors, `sameAs`, `genre`, `keywords`), companion `BreadcrumbList` JSON-LD, and timeout-safe invalid/confirmed-missing `noindex` via `React.cache` and `buildReaderSeoMetadataPayload`, verifying signed `x-bookarium-share-token` (`decodeReadingCardShareToken`) to bind `/api/books/content?id=<id>&type=card&s=<token>` (`1200×630`) as the primary social preview image.',
    'src/app/read/[id]/page.tsx': 'Dedicated distraction-free Focus Reader with warm `currentBook` metadata reuse (`hasCompleteCurrentBook`), continuous pagination, Web Worker AST segmentation, TTS narration, and Symposium marginalia.',
    'src/app/account/layout.tsx': 'Server layout defining canonical metadata and robots noindex directives for the Scholar Account Hub.',
    'src/app/account/page.tsx': 'Scholar Account Hub for Reading Habits, Literary Accolades, Reader Circles & Symposiums, Active Device Sessions & Fail-Closed JWT AMR Password Recovery Verification (`verifyPasswordRecoverySession`), Security Confirmations, Cloud Sync, and Preferences.',
    'src/app/u/[username]/layout.tsx': 'Server layout emitting dynamic OpenGraph `profile`, Twitter cards, canonical `/u/<username>`, and `ProfilePage` JSON-LD for opt-in public scholars via `isClientSideNavigation()` fast-path and `fetchPublicScholarProfileSummary`, collapsing private and nonexistent handles to identical `noindex` fallback.',
    'src/app/u/[username]/page.tsx': 'Public Scholar Sanctuary displaying pinned Ex-Libris bookplates, public profile stats, and 1-on-1 Literary Fellowship invitation actions.',
    'src/app/privacy/layout.tsx': 'Server layout defining `SITE_CONFIG.SITE_URL` canonical SEO, OpenGraph, and Twitter summary metadata for the Privacy Architecture manifesto.',
    'src/app/privacy/page.tsx': 'Zero-Tracker Privacy Architecture manifesto, functional geo-cookie & Supabase masked-IP session metadata disclosures, COPPA / GDPR Art. 8 governance, and 3-Tier Zero-Retention Erasure Protocol.',
    'src/app/copyright/layout.tsx': 'Server layout defining canonical SEO, OpenGraph, and Twitter summary metadata for Copyright & Public Domain Governance.',
    'src/app/copyright/page.tsx': 'Multi-Jurisdictional Public Domain Copyright Governance manifesto covering global RDF `<dcterms:rights>` exclusion, US + international `HTTP 451` enforcement, territory rules table, dynamic email-free `SITE_CONFIG.PUBLIC_USER_AGENT` disclosure, and takedown notice channel.',
    'src/app/auth/confirm-deletion/layout.tsx': 'Server layout enforcing `robots: { index: false, follow: false }` metadata on the account deletion confirmation route.',
    'src/app/auth/confirm-deletion/page.tsx': 'Two-step email-verified account deletion confirmation page executing `delete_current_user()` RPC.',
    'src/app/manifest.ts': 'Progressive Web App (PWA) Web App Manifest configuring standalone display, theme colors, and multi-resolution icons.',
    'src/app/robots.ts': 'Search engine crawler directives allowing canonical routes (`/`, `/privacy`, `/copyright`, `/read/`, `/u/`) while blocking catalog filter query permutations (`search`, `topic`, `languages`, `sort`, `era`, `format`, `mime_type`, `page`, `size`, `view`), `/api/*`, `/auth/*`, and `/account` (preserving `?s=` Reading Card share tokens).',
    'src/app/sitemap.ts': 'Synchronous zero-DB XML sitemap generator indexing primary views, `/privacy`, `/copyright`, and curated classics combining `FEATURED_CLASSIC_BOOK_IDS` and `FEATURED_HERO_BOOKS`.',
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
    useBooks: 'TanStack Query fetching catalog volumes (`useBooks` keyed by `["books", params, effectiveCountry]` with client-side round-trip `performance.now()` latency telemetry and strict HTTP error propagation), featured book quotes (`useFeaturedQuotes` with local `readCachedQuoteEnrichedBooks` cache-first lookup and 7-day Edge-cached `/api/books?ids=...&has_quotes=true` routing), and the shared `48`-volume (`DEFAULT_QUOTE_POOL_LIMIT = 48`) 12h Edge-cached rotating quote pool (`useQuoteEnrichedBooks` via `/api/books?pool=quotes`, 2-spread quota trimming, 12-hour `!isCacheFresh` gating, zero-swap `ssrMatch` hydration, and an `isPoolSettled` signal with `QUOTE_POOL_SETTLE_TIMEOUT_MS` safety net so consumers reveal quotes exactly once) powering Hero (Full Pool), Classic of the Day (Classics Filter), and Words That Shaped Humanity (3-Distinct-Book Fisher-Yates Rotation) with deterministic sub-pagination.',
    useBookContent: 'TanStack Query (`networkMode: "always"`) fetching book plain text with canonical `/api/books/content?id=<bookId>` cache keys, IndexedDB offline-first check, multi-store lifespan verification (`resolveAuthoritativeLocalAuthors`), and online server-gatekeeper deferral.',
    useBookTranslations: 'Sequential Two-Tier TanStack Query resolving international language translations and editions (`Tier 1` `/api/books/translations?id=<id>` relational lookup -> `Tier 2` `/api/books?search=...` AST fallback gated on `!isDbLoading && !hasDbEditions` and `!isOffline`).',
    useReaderSpeech: 'Browser-native Web Speech synthesis with boundary word highlighting and auto-flip.',
    useReaderSession: 'Reading coordinates restoration, decoupled `pinnedBookmark` (`PinnedBookmarkCoordinate`) persistence across passive page turns, 3-page activation threshold, cross-page `bookmarkText` reflow self-healing on font-size re-pagination, resume ribbons, and cloud session synchronization.',
    useContinueReadingLedger: 'Headless continue reading ledger with authentic telemetry enrollment, placeholder-author detection (`hasAuthenticAuthor`), non-regressive author merge guardrails (`setOrMergeBook`), `readingPositions` author healing, query hydration, multi-attribute sorting, and offline volume filtering (`useOfflineBooks`).',
    useReaderDrawers: 'Mutual exclusivity coordination for in-reader tool drawers and modals.',
    useReaderGestures: 'Touch swipe detection, tactile single-finger tap detection (`onTapSurface`) for immersive bar toggling, keyboard shortcuts, selection gesture conflict guards, and damped 2-finger pinch-to-zoom (`14px` deadzone `PINCH_DEADZONE_PX` + `24px`/step `PINCH_PIXELS_PER_STEP`) with non-passive touch/WebKit gesture cancellation.',
    useGutenbergParserWorker: 'Persistent Web Worker chapter segmentation and layout pagination calculations.',
    useCatalogFilters: 'Hydration-safe catalog filter & pagination URL state binding (`parseFiltersFromUrl`), `!prevHasMounted && hasMounted` SSR-to-mobile page preservation, default Recently Added (descending) sort, atomic filter staging, multi-era bounding calculation, and multi-filter query synchronization.',
    useScrollDirection: 'Stepped directional scroll detection with hero dock tracking (`isDocked`), 3-state navigation visibility (`isHeaderVisible`, `isToolbarVisible`), and user auto-hide preference persistence.',
    usePerformanceTier: 'Hardware concurrency and memory heuristic detection for fluid 60fps animations.',
    useOfflineBooks: 'Atomic IndexedDB cache enumeration via `Promise.allSettled` (`readOfflineIdsAndMetas`, `applyOfflineSnapshot`, `syncEpochRef`, `isMountedRef` for `offlineIds`, `offlineBooks`, and `isLoaded`) with synchronous non-blocking quota updates, reactive cross-instance event broadcast (`OFFLINE_BOOKS_UPDATED_EVENT`), loading state propagation (`OFFLINE_DOWNLOADING_EVENT`), author lifespan normalization (`normalizeOfflineAuthors`), idle missing cover backfill, and individual-only offline book download/deletion management with local cover Blob persistence.',
    useCursorTooltip: 'Adaptive cursor tooltip hook (`300ms` default delay, `0ms` action buttons, viewport boundary clamping) powering `CursorTooltip` and `GlobalTitleTooltip`.',
    useBookPassageShuffle: 'Autonomous 3-tier literary quote selection (`book.quotes` -> 30-day / 100-entry `localStorage` LRU cache `bookarium-extracted-passages-v1` / dynamic passages -> curated fallback), jurisdictional protection suppression (`isRestricted` gating), and multi-chapter shuffle engine (`readCachedBookPassages`, `writeCachedBookPassages`, `clearCachedBookPassages`).',
    useHasMounted: 'SSR hydration barrier hook preventing client-server markup mismatches.',
    useReadingTimer: 'Reader session telemetry tracking visual reading with 2-minute idle guard and TTS narration audio bypass.',
    useCollectionAutoHeal: 'Unified multi-collection auto-healing pipeline scanning and rehydrating missing author lifespans across Favorites, Bookshelves, Reading Positions, Annotations (Personal & Fellow), and Active Symposiums.',
    useMobileViewSwipe: 'Tactile touch gesture navigation hook enabling horizontal view swiping across primary views strictly on mobile and tactile tablets (`isSwipeEnabled = (isMobile || isTouchDevice) && !isAnyModalActive`; disabled on `> 1366px` non-tactile desktop PCs).',
    useTouchDevice: 'SSR-safe tactile capability and viewport boundary detection (`(pointer: coarse)` or `maxTouchPoints > 0` within `<= 1366px`) gating horizontal view swiping on tablets and mobile while excluding `> 1366px` desktop viewports.',
    useBookCopyright: 'Declarative jurisdictional copyright facade hook coordinating territory rules, author lifespan restrictions, and public domain badges.',
    useNetworkStatus: 'Reactive browser online/offline external store hook (`useSyncExternalStore`) driving red offline Account indicators, adaptive offline Catalog fallback, and network-gated controls.',
    useCopyFeedback: 'Transient clipboard copy state hook with automatic timer cleanup (`copy`, `isCopied`, `copiedKey`) for share URLs and scholar handles.',
    useNotebookMetadataResolver: 'Multi-source volume metadata resolver (`resolveVolumeMeta`, `missingBookIds`, `isMetadataLoading`) healing missing titles, authors, and languages across Personal and Fellow Marginalia.',
    useReaderHabitTelemetry: 'Reader session lifecycle, book identity self-healing, `Bookarium | Reader | <Title> — <Author>` client tab title synchronization (`SITE_CONFIG.READER_NAME`), 3-page reading activation threshold (`currently_reading` / `finished`), Literary Symposium companion progress sync, and idle-aware habit telemetry coordinator.',
    useAccountSecurityActions: 'Account Hub security, Active Device Sessions inspection/revocation (`get_active_sessions`, `revoke_user_session`), cross-tab `BroadcastChannel("bookarium-sessions-sync")` & `bookarium:auth-token-refreshed` live Security list synchronization, automatic zombie-row refresh when `revokeSession` reports an already-ended session, `ConfirmActionModal`-guarded Google disconnect, session revocation, and scoped sign-out (`local` / `others` / `global`), profile display name, email verification resend cooldown with optional Turnstile `captchaToken` forwarding, password strength/generation/recovery, and account deletion workflow hook.',
    useOfflineCatalogFallback: 'Local IndexedDB offline catalog filtering, topic/language/author-lifespan matching, sorting, and sub-page slicing hook when offline.',
    useVisualViewportKeyboard: 'Mobile software virtual keyboard elevation hook leveraging the Visual Viewport API (`window.visualViewport`) to dynamically elevate floating inputs above tactile on-screen keyboards.',
    useBookshelfCapacity: 'Hydration-safe physical shelf spine capacity hook (`useSyncExternalStore`) dynamically coupling Bookshelf page size (2 shelves x capacity) and row limits across mobile (6), tablet (10), laptop (14), and desktop (18).',
    useAmbientDockScrollState: 'Shared scroll-idle dimming (`opacity-30`), top-threshold (`isAtTop`), and pointer wake (`onPointerEnter` / `onPointerLeave`) state machine for floating bottom capsule docks (`CatalogMobileBottomDock`, `CollectionBottomDock`).',
    useMobileViewportCardFocus: 'Shared single-column (`< 1024px`) viewport scroll focus band (`0.22–0.62` viewport ratio) and outside-tap dismissal hook for `BookmarkCard` and `NotebookQuoteCard`.',
    useOfflineCoverImage: 'Shared local-first cover cache & Gutenberg mirror fallback hook (`getMemoryCachedCoverUrl` -> IndexedDB `offline_books`/`cover_cache` -> `resolveGutenbergCoverCandidates`: `aleph.gutenberg.org` -> `gutenberg.pglaf.org` -> `gutenberg.readingroo.ms` -> `www.gutenberg.org`), with background `warmCoverCache` persistence on load (`onLoad`) and owned `URL.revokeObjectURL` unmount cleanup (`BookCard`, `BookmarkCard`, `BookPreviewModal`).',
    usePersonalCollectionsController:
      'Centralized controller hook for Bookshelf and Favorites filtering (`!is_default` drawer shelf deduplication, unified top-bar `Favorites` dropdown preset + orthogonal monochrome drawer `shelfFavoritesOnly` switch composable with sort & direction, and contextual empty states), bidirectional sorting, custom shelf resolution, pagination reset, and clear-confirmation modal state (`src/app/page.tsx`).',
    useReaderAnnotationActions: 'Encapsulated Focus Reader text-selection popover state, overlapping fellow/own annotation matching (`matchedPopoverAnnotations`), and highlight/note CRUD handlers (`src/app/read/[id]/page.tsx`).',
    useReaderExitBookmark: 'Encapsulated reader exit interception, cross-device `findCanonicalTextSpan` bookmark-ahead reflow resolution (`hasBookmarkAhead`), layered drawer-first & `Escape` key dismissal, 3-page activation threshold modal gating, and line-1 bookmark placement (`src/app/read/[id]/page.tsx`).',
    useDialogFocusTrap: 'Shared accessible overlay focus-trap, Escape-key dismissal, and trigger-element focus-restoration hook (`autoFocus?: boolean`, `{ preventScroll: true }`) used across `Modal`, `AuthModal`, `BottomSheetDrawerShell`, and `AccoladeCelebrationModal`.',
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
      'Bidirectional domain transformation between internal catalog DTO schemas (`GutendexBook` / `GutendexResponse`), canonical Book models, and Supabase cloud persistence payloads.',
    'api-utils':
      'Server-side API route helpers, IP address extraction (`resolveClientIp`), HTTPS proxy/URL detection (`isHttpsRequest`) for protocol-aware `Secure` cookies, `ApiCorpPolicy` / `buildApiSecurityHeaders` (`Cross-Origin-Resource-Policy` & `nosniff`), strict query allowlisting (`hasUnexpectedQueryParams`), `createNoStoreErrorResponse`, and `no-store` `same-origin` `429` rate-limit responses.',
    'bookshelf-cloud-sync':
      'Bidirectional cloud reconciliation engine for bookshelves, shelf items, and favorite books, featuring non-regressive local metadata preservation (`mergeCloudBookWithLocal`), per-user in-flight mutex & `coalesceInFlightByUser` outbox flushing (`executeFlushOutbox`, `dirtyOutboxFlushUsers`, `markBookshelfOutboxDirty`), opt-in `15,000ms` passive mount cooldown (`invalidateBookshelfSyncCooldown`), concurrent `Promise.all` table fetching, multi-shelf `book_id` deduplication, outbox mutation replay, tombstone filtering, single-commit atomic state reconciliation, and deterministic ordering.',
    'book-metadata':
      'Author and title cleaning, placeholder author heuristics (`isPlaceholderAuthor`, `resolvePrimaryAuthorName`), verified lifespan checks (`hasVerifiedLifespans`), dictionary author enrichment (`enrichAuthorMap`), and defensive editorial metadata normalization (including `subjects` and `bookshelves` on `ResolvedBookIdentity`).',
    'content-advisory':
      'Autonomous content advisory evaluation engine scanning Library of Congress subject classifications and bookshelves for mature themes, erotic literature, and sensitive historical context with non-blocking user guidance.',
    'copyright-engine':
      'Multi-jurisdictional copyright engine evaluating public domain status across US, EU/Berne (Life + 70), Mexico (Life + 100), and Colombia/Spain (Life + 80), with joint authorship (Art. 7bis), translator protection (Art. 2(3)), and longevity heuristics.',
    'country-resolver':
      'Synchronous and edge geographic country resolution coordinating timezone mapping, geo-cookies, and developer overrides.',
    'curated-fallback':
      'Zero-dependency bundled curated classics catalog provider (`searchCuratedCatalogFallback`) serving jurisdictional public-domain search, filtering, sorting, and pagination from `FEATURED_HERO_BOOKS` (`source: "cache"`) whenever Supabase is unconfigured or unseeded without external REST calls.',
    'gutenberg-parser':
      'Root domain facade barrel re-exporting all Gutenberg segmentation, pagination, reflow, and passage extraction subsystems.',
    index:
      'Gutenberg subsystem barrel aggregating types, reflow, pagination, metadata, segmentation, and passage algorithms.',
    metadata:
      'Gutenberg plain-text header/footer metadata extraction, author/title/language detection, and ISO code normalization.',
    pagination:
      'Continuous chapter pagination algorithms with UTF-8 curly-quote/guillemet sentence boundary snapping, character-per-page geometry calculations, and reading time estimation.',
    passages:
      'Dynamic book passage and quote extraction engine identifying compelling prose segments with dialogue and character markers.',
    reflow:
      'Typography text-reflow heuristics (`reflowGutenbergParagraphs`, `formatGutenbergTypography`) repairing Project Gutenberg hard line wraps while preserving alternating-indent verse, short stanzas, and scene breaks, and normalizing `--` -> `—` and `_italic_` wrappers.',
    segmentation:
      'Robust chapter and section boundary detection (`parseGutenbergChapters`, `stripDuplicateLeadingChapterHeading`) with Roman numeral, Strategy 1B spelled-word / Stave / Letter divisions, TOC deduplication, and zero-offset-shift display heading deduplication.',
    types:
      'Canonical TypeScript interfaces and configurations for the Project Gutenberg parsing engine and AST nodes.',
    'in-book-search':
      'Full-text in-volume search algorithm with canonical typography matching (`--` <-> `—`, curly/straight quotes), diacritic fallback, context snippet generation, and matched coordinate navigation.',
    'offline-storage':
      'IndexedDB (`BookariumOfflineDB` v2) storage abstraction providing offline book content caching (`offline_books`), mirror-agnostic `cover_cache` LRU (`MAX_CACHED_COVERS = 300`, `30d` TTL), synchronous in-memory `coverObjectUrlCache` (`getMemoryCachedCoverUrl`), concurrency-bounded background warming (`warmCoverCache`), multi-tab `onversionchange` safety, local store author resolution and asynchronous IndexedDB author back-fill (`patchOfflineBookAuthors`), storage change notifications (`notifyOfflineStorageChanged`), quota calculation, LRU eviction, and dual-store cleanup (`clearAllOfflineBooks`).',
    'safe-storage':
      'Universal SSR-safe storage adapter (`safeLocalStorage`) for Zustand `persist` middleware, eliminating Node 22 experimental localStorage warnings and providing safe no-op setItem execution during server rendering with browser try/catch boundaries.',
    password:
      'Cryptographically secure password generation and multi-factor entropy evaluation engine.',
    'query-parser':
      'Canonical query parameter extractor and sanitizer for catalog queries (`parseCatalogQuery`), normalizing whitespace, pagination (`limit <= 100` standard up to `MAX_CATALOG_PAGE = 5000`, or `DEFAULT_QUOTE_POOL_LIMIT = 48` (default and ceiling) when `pool=quotes`), query/batch/language/MIME/era bounds (`MAX_SEARCH_LENGTH = 120`, `MAX_TOPIC_LENGTH = 120`, `MAX_IDS_BATCH = 100`, `MAX_LANGUAGES = 5`, `MAX_MIME_TYPE_LENGTH = 64`), author lifespans, and edge geo-country fallback cascades.',
    'rate-limiter':
      'Zero-dependency `globalThis`-anchored sliding-window rate limiters (`booksApiRateLimiter` 60/min, `bookContentRateLimiter` 30/min, `bookCardRateLimiter` 20/min, `bookCoverRateLimiter` 60/min) with automatic 30s GC and warm-instance persistence.',
    'reader-annotator':
      'Scholarly marginalia interval partitioning, character-index-mapped canonical span matching (`findCanonicalTextSpan`, `findAllCanonicalTextSpans`), overlapping annotation pairing (`pairOverlappingAnnotations`), and shared quote span segmentation (`computeSharedQuoteSegments`).',
    'reading-analytics':
      'Streak calculation, 5-minute immersion thresholds, reading speed metrics, annual reading goal progress, deduplicated completed volume counting (`calculateCompletedBooksCount`), and public scholar habit telemetry resolution (`resolvePublicReadingHabits`).',
    'auth-recovery':
      'Supabase JWT `amr` claim verification (`isRecoverySessionAmrVerified`) and per-user single-use consumed recovery tracking (`readConsumedRecoverySentAt`, `markRecoveryConsumed`, `clearConsumedRecoveryMarker`) enforcing `3600s` TTL and blocking URL/session replay of `?recovery=true`.',
    'redirect-sanitizer':
      'Open-redirect prevention, canonical authentication & share origin resolvers (`resolveCanonicalAuthOrigin`, `resolveCanonicalShareOrigin` normalizing ephemeral preview hosts to `SITE_CONFIG.SITE_URL`), password-recovery query inspection/stripping (`isRecoveryRedirectPath`, `stripRecoveryFromRedirectPath`), and origin-validated book share URL builders (`sanitizeRedirectPath`, `buildAuthRedirectUrl`, `buildBookShareUrl`).',
    'smart-search':
      'Fuzzy multi-token search engine querying titles, authors, and subjects with punctuation normalization.',
    'speech-utils':
      'Web Speech API voice selection heuristics identifying natural/neural/cloud synthesis voices, BCP-47 locale normalization, book-language voice compatibility filtering, and quality score sorting (`getVoiceQualityScore`, `sortVoicesByQuality`, `resolveBestVoice`).',
    'supabase-provider':
      'Dedicated Supabase PostgreSQL catalog provider implementing ICatalogProvider with passively warmed cached healthcheck (60s TTL), `globalThis`-anchored 5m / 64-query catalog response cache (`__bookariumCatalogQueryCache`, isolated per mock client, cleared via `resetHealthCache`) + passive `__bookariumMetadataCache` pre-warming, 11-column `CATALOG_METADATA_COLUMNS` projection, GIN full-text search_vector queries across title/subjects/bookshelves, MIME charset prefix matching, author lifespan bounds, `MAX_CATALOG_OFFSET = 160_000` empty-page short-circuiting before `getSupabase()` / `buildSearchQuery()`, exact `limit + 1` SQL probing with bounded dynamic backfill (`MAX_BACKFILL_ITERATIONS = 5`), and Primary-Key-Scoped 48-volume (`DEFAULT_QUOTE_POOL_LIMIT = 48`) 12h rotating 2-spread Quote Pool assembly (`fetchQuoteEnrichedPool`, `selectRotatingQuotePoolCandidateIds`) for sub-50ms single-book lookups and ~1-2s catalog page queries.',
    client:
      'Browser-side Supabase client initialization with credential sanitization (`sanitizeSupabaseUrl`), Edge/SSR-safe forwarded header cleanup (`sanitizeForwardedUserAgent`: CR/LF stripping and 512-char clamping without `next/headers`), and local session persistence.',
    middleware:
      'Next.js edge middleware helper managing Supabase auth tokens and cookie refresh cycles, forwarding `sanitizeForwardedUserAgent(request.headers.get("user-agent"))` from `./client` to avoid Vercel egress `"Browser session"` attribution, stamping short-lived `bookarium-client-ip-sync` when rotated `sb-*-auth-token` cookies are issued, and short-circuiting anonymous requests without `sb-*` cookies.',
    server:
      'Server-side Supabase client initialization (`createClient(options?)`) using Next.js cookies for authenticated App Router route handlers and forwarding optional sanitized `userAgent` headers via `sanitizeForwardedUserAgent`.',
    'sync-utils':
      'Unified bidirectional cloud synchronization coordinator (`syncAllStoresWithCloud`, `clearLocalUserStores`, re-exported `coalesceInFlightByUser`) returning active per-user in-flight Promises directly (`p1 === p2`), enforcing pre-sync active JWT session verification (`hasSupabaseAuthCookie`, `shouldVerifyCloudSession`, `verifyActiveCloudSession`), and coordinating 10-store local teardown parity.',
    'book-sorting':
      'Deterministic multi-attribute book sorting algorithms, Bookshelf & Favorites sort/preset filter options (`BOOKSHELF_BASE_SORT_OPTIONS` & `BOOKSHELF_DRAWER_SORT_OPTIONS`), and shared offline volume filtering (`filterBooksByOfflineState`) for title, author, year, downloads, reading progress, and recency.',
    'book-tags':
      'Semantic book tag normalizer mapping verbose Library of Congress subjects and Gutenberg bookshelves to canonical zero-truncation badges (<= 14 chars) with responsive mobile/desktop allocation and administrative prefix sanitization.',
    'scroll-utils':
      'Smart smooth-scrolling engine with visibility viewport heuristics, top offset calculation, header avoidance, horizontal pointer click-and-drag + wheel scrolling (`attachHorizontalDragAndWheelScroll`), live touch-swipe / mouse-drag tab scrubbing, and zero-drift scroll preservation (`runPreservingScrollPosition`).',
    utils:
      'Core presentation utilities: Tailwind CSS class merging (clsx + twMerge), author formatting, format badges, and strict HTTPS/optional-blob format URL sanitization (`sanitizeBookFormatUrl` / `extractBookFormats`).',
    'metadata-cache':
      '2-tier external-API-free `globalThis`-anchored in-memory LRU author lifespan cache (`__bookariumMetadataCache`, 24h TTL, 1,000 entries) resolving contributor birth/death years via Supabase `public.books` and bundled `FEATURED_HERO_BOOKS` fallback, paired with a `globalThis`-anchored 20-book plain-text LRU cache (`bookContentLruCache` / `__bookariumContentLruCache`, `getCachedBookContent`, `setCachedBookContent`, `clearBookContentCache`, 24h TTL, <= 1.8M chars) shielding Project Gutenberg mirrors across `Vary: x-vercel-ip-country` edge misses.',
    'url-validator':
      'Zero-trust anti-SSRF upstream URL validator enforcing HTTPS, relative Location redirect resolution, and strict Project Gutenberg hostname allowlisting (`gutenberg.org`, `aleph.gutenberg.org`, `gutenberg.pglaf.org`, `gutenberg.readingroo.ms`).',
    'server-rsc-nav':
      'Server-only Next.js App Router RSC navigation and prefetch header detector (`isClientSideNavigation`) isolated from client bundles.',
    'profile-layout-utils':
      'Zero-PII Public Scholar metadata resolver (`fetchPublicScholarProfileSummary`), 5-minute / 500-entry LRU cache (`hasCachedScholarProfile`), SQL `ILIKE` `_`-wildcard neutralization, and anti-enumeration `private_or_missing` collapsing for `/u/[username]`.',
    'reader-layout-utils':
      '2-tier server-side metadata resolution (`fetchBookData`: `Supabase public.books` -> bundled `FEATURED_HERO_BOOKS` with zero external HTTP calls), confirmed-missing ID tracking (`isConfirmedMissingBook`), re-exported `isClientSideNavigation`, and non-visual SEO payload builder (`buildReaderSeoMetadataPayload` with featured `openingLine` hooks, lifespan contributors, and encoding MIME formats) for `/read/[id]` OpenGraph, Twitter Card, and Schema.org JSON-LD generation.',
    'reader-bookmark-geometry':
      'DOM text-node walker (`collectContentTextSegments`), character range measurement (`measureCharRect`), ratio-weighted passage matching (`findBestTextMatch`), and binary-searched row text/span resolution (`extractRowTextFromElement`, `resolveTextRowSpanInElement`).',
    'annotation-cloud-sync':
      'Scholarly annotation and fellow marginalia cloud synchronization helpers, RFC 4122 v4 UUID generator (`generateValidAnnotationUuid`), non-regressive scholar handle resolution (`setOrUpdateFellowMapEntry`, `buildFellowScholarsMap`), and outbox payload mappers.',
    'fellowship-cloud-sync':
      'Fellowship scholar handle validation (`isPlaceholderUsername`), label formatting (`formatFellowScholarLabel`), profile identity healing (`healProfileIdentity`), and Supabase `public.profiles` batch lookup (`fetchScholarProfilesMap`).',
    'reader-cloud-sync':
      'Reading position cloud synchronization helpers, ghost-row filtering (`isGhostReadingPosition`, `isGhostCloudRow`), fractional row-bookmark decoding (`decodeRemoteReadingPosition`), and lifespan-preserving author extraction (`extractVerifiedAuthors`).',
    'preferences-sync':
      'Unified 13-key scholar preferences snapshot coordinator (`ScholarPreferencesSnapshot`, `FACTORY_PREFERENCES`, `getFactoryPreferences` with device-adaptive `15px`/`17px`/`18px` font size), two-tier custom default preset & factory reset actions (`saveCurrentAsCustomDefaults`, `revertToCustomDefaults`, `resetAllPreferencesToFactoryDefaults`, `resetReaderAppearanceToDefaults`), and debounced Last-Write-Wins Supabase `public.profiles.preferences` JSONB cloud synchronization (`schedulePreferencesCloudSync`, `reconcileCloudPreferencesWithLocal`).',
    'reading-card-export':
      'Client-side HTML5 2D `<canvas>` reading card generator (`renderReadingCardToCanvas` defaulting card footer host to `SITE_CONFIG.SITE_HOST`, `exportReadingCardBlob`, `wrapCanvasText`, `CARD_PALETTES`), book-bound FNV-1a signed Base64URL share token codec (`encodeReadingCardShareToken`, `decodeReadingCardShareToken`, `buildReadingCardShareUrl`, `computeShareTokenSignature`), and zero-key social Web Intent URL builder (`buildReadingShareText`, `buildSocialShareUrls`) across X, Reddit, WhatsApp, Telegram, Bluesky, Facebook, LinkedIn, and Email.',
    'notebook-sorting':
      'Pure sorting, filtering, volume grouping (`filterAndGroupNotebookEntries`, `parseNotebookSortValue`), and sort-key decomposition engine for the Commonplace Literary Notebook (`NotebookView`).',
    'session-device-parser':
      'Zero-regex CWE-1333-safe user-agent device/OS/browser classifier (`parseSessionDevice` recognizing `edga/`, `vivaldi/`, and `duckduckgo/` alongside Safari/Chrome/Edge/Firefox/Opera/Samsung Internet), dual-layer masked IP formatter (`formatSessionIpAddress`: IPv4 `.x`, IPv6 `/48 ::x`, localhost labels), and timestamp formatter (`formatSessionTimestamp`) for Account Security active session inspection.',
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

  const workflowResponsibilityMap = {
    'catalog-sync.yml':
      'Unified weekly Sunday CI cron workflow (`concurrency: gutenberg-catalog-sync`, `permissions: contents: write`) restoring `gutenberg-catalog-cache.json.gz` + `.sha256` sidecar from the permanent `catalog-cache` GitHub Release, streaming `rdf-files.tar.bz2` (extracting `download_count` & `<dcterms:rights>` copyright flags) and `pg_catalog.csv.gz` in PGLAF-first mirror priority (`gutenberg.pglaf.org` -> `aleph.gutenberg.org` -> `www.gutenberg.org`, or pinned via manual `feed_source` dropdown, enforcing `Content-Length` truncation, fail-closed `tar` exit, and wire `SHA-256` logging) into `public.books` via 100% in-RAM `.sha256`-verified diffing (`filterChangedOrNewBooks` & `reconcileWithdrawnCatalogBooks` preserving `quotes`), publishing the updated snapshot + `.sha256` sidecar (`--clobber`), sequentially chaining `ingest-translations.js` and `sync-featured-quotes.js --diff-file=quote-diff.json` (with full out-of-window Option-A pruning), and invalidating Vercel Edge `catalog,quotes,translations` tags via `scripts/purge-vercel-cache.js` when `dry_run != \'true\'`.',
    'translations-sync.yml':
      'On-demand (`workflow_dispatch`) GitHub Actions workflow (`concurrency: gutenberg-translations-sync`) clustering upstream Wikidata `P2034`/`P407` editions and syncing to `public.book_translations` via `idx_book_translations_cluster`, followed by Vercel Edge `translations` cache tag invalidation via `scripts/purge-vercel-cache.js` when `dry_run != \'true\'` (scheduled Sunday execution is unified inside `catalog-sync.yml`).',
    'quotes-sync.yml':
      'On-demand (`workflow_dispatch`) GitHub Actions workflow (`concurrency: featured-quotes-sync`) populating `10–16` multi-quote spreads per book across the Two-Tier Bounded Quote Pool (`500 Popular + 64 Recent`) or specific `--ids` via selectable PGLAF mirrors, applying full partial-index Option-A out-of-window pruning (`--max-prune`, default `2000`), and invalidating Vercel Edge `quotes` cache tags via `scripts/purge-vercel-cache.js` when `dry_run != \'true\'` (scheduled Sunday execution is unified inside `catalog-sync.yml` via `quote-diff.json`).',
    'cache-purge.yml':
      'Manual-only (`workflow_dispatch`, zero `npm ci`) GitHub Actions utility workflow (`concurrency: cache-purge`, `permissions: contents: read`) allowing operators to selectively invalidate Vercel Edge CDN cache tags (`purge_catalog`, `purge_quotes`, `purge_translations` defaulting unchecked with a fail-fast guard requiring at least one checkbox selected), choose `target` (`production` / `preview`), and run `dry_run` diagnostics via `scripts/purge-vercel-cache.js`.',
    'ci.yml':
      'Continuous Integration pipeline (SHA-pinned actions, `permissions: contents: read`) executing the 7-Gateway Quality Engine, ESLint zero-warning check, Vitest coverage, production build verification, and deterministic `git diff --exit-code` living-documentation sync enforcement on Node 22.',
    'codeql.yml':
      'Automated CodeQL SAST workflow (`run-name: CodeQL SAST (<event> on <branch>)`, `push`/`pull_request` on `main`/`master`/`dev` + `cron: 30 1 * * 1`, SHA-pinned actions, `security-events: write`) scanning `javascript-typescript` and `actions` targets into GitHub Security alerts.',
    'dependency-review.yml':
      'Pull Request supply-chain gate (`run-name: Dependency & License Review (PR #<n>)`, `pull_request` on `main`/`master`/`dev`, SHA-pinned actions, `permissions: contents: read`) running `actions/dependency-review-action` with `fail-on-severity: high` and `GPL`/`AGPL` license exclusions.',
    'release.yml':
      'Automated GitHub Release publisher triggered on `v*` tags or manual `workflow_dispatch`, executing the full 7-Gateway Quality Engine and extracting release notes from `CHANGELOG.md`.',
  };

  const workflowsDir = path.join(rootDir, '.github', 'workflows');
  const dynamicWorkflowRows = [];
  let workflowCount = 0;
  if (fs.existsSync(workflowsDir)) {
    const wfOrder = [
      'catalog-sync.yml',
      'translations-sync.yml',
      'quotes-sync.yml',
      'cache-purge.yml',
      'ci.yml',
      'codeql.yml',
      'dependency-review.yml',
      'release.yml',
    ];
    const wfFiles = fs
      .readdirSync(workflowsDir)
      .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
      .sort((a, b) => {
        const ia = wfOrder.indexOf(a);
        const ib = wfOrder.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
      });
    workflowCount = wfFiles.length;

    for (const wfFile of wfFiles) {
      const wfText = fs.readFileSync(path.join(workflowsDir, wfFile), 'utf-8');
      const cronMatch = wfText.match(/cron:\s*['"]([^'"]+)['"]/);
      let triggerDesc = '`push` / `pull_request` (`master`)';
      if (wfFile === 'codeql.yml') {
        triggerDesc = `\`push\` / \`pull_request\` + \`cron: ${cronMatch ? cronMatch[1].trim() : '30 1 * * 1'}\` (Mondays)`;
      } else if (wfFile === 'dependency-review.yml') {
        triggerDesc = '`pull_request` (`main`, `master`, `dev`)';
      } else if (cronMatch && cronMatch[1]) {
        const cronExpr = cronMatch[1].trim();
        const isWeeklySundayCron = /^\S+\s+\S+\s+\*\s+\*\s+(?:0|7|SUN)$/i.test(cronExpr);
        triggerDesc = isWeeklySundayCron
          ? `\`cron: ${cronExpr}\` (Sundays) / On-Demand`
          : `\`cron: ${cronExpr}\` / On-Demand`;
      } else if (wfFile === 'release.yml') {
        triggerDesc = '`push` (`tags: v*`) / On-Demand (`workflow_dispatch`)';
      } else if (wfFile === 'cache-purge.yml') {
        triggerDesc = 'On-Demand (`workflow_dispatch`) • Standalone Manual Cache Purge';
      } else if (wfText.includes('workflow_dispatch')) {
        triggerDesc = 'On-Demand (`workflow_dispatch`) • Chained in `catalog-sync.yml`';
      }
      const resp =
        workflowResponsibilityMap[wfFile] ||
        'Automated GitHub Actions CI/CD workflow.';
      dynamicWorkflowRows.push(
        `| **\`${wfFile}\`** | GitHub Actions Workflow | [\`.github/workflows/${wfFile}\`](.github/workflows/${wfFile}) | ${triggerDesc} | ${resp} |`
      );
    }
  }

  lines.push(
    '',
    '---',
    '',
    '## 🔄 Background Data Pipelines & Automation Engines',
    '',
    'Automated ingestion pipelines, periodic synchronization jobs, and GitHub Actions CI/CD workflows (outside `src/`):',
    '',
    '### 1. GitHub Actions & Database Ingestion Topology',
    '',
    '```mermaid',
    'flowchart TD',
    '    subgraph Triggers ["GitHub Actions Triggers & Concurrency Locks"]',
    '        CatTrigger["🕒 catalog-sync.yml (Unified Sunday Pipeline)\\n• cron: 0 2 * * 0 (Sundays 02:00 UTC) / workflow_dispatch\\n• concurrency: gutenberg-catalog-sync • contents: write"]',
    '        TransTrigger["🎛️ translations-sync.yml (Manual Override)\\n• On-Demand (workflow_dispatch)\\n• concurrency: gutenberg-translations-sync"]',
    '        QuotesTrigger["🎛️ quotes-sync.yml (Manual Override)\\n• On-Demand (workflow_dispatch)\\n• concurrency: featured-quotes-sync"]',
    '        PurgeTrigger["🧹 cache-purge.yml (Manual Cache Purge)\\n• On-Demand (workflow_dispatch • Unchecked Defaults)\\n• concurrency: cache-purge"]',
    '        CITrigger["✅ ci.yml, codeql.yml, dependency-review.yml & release.yml\\n• SHA-Pinned Actions • CodeQL (cron: 30 1 * * 1) & Dependency Review\\n• Node 22 + 7-Gateway Quality Engine"]',
    '    end',
    '',
    '    subgraph UpstreamFeeds ["External Public Domain Feeds & Release Snapshot Cache"]',
    '        ReleaseCache[("📦 GitHub Release Tag: catalog-cache\\ngutenberg-catalog-cache.json.gz + .sha256 (~4.5 MB)\\nPermanent Verified Snapshot (--clobber)")]',
    '        FeedCSV["📦 Project Gutenberg Feeds (3 Mirrors)\\nrdf-files.tar.bz2 (121MB) + pg_catalog.csv.gz (5.3MB)"]',
    '        FeedWikidata["🌐 Wikidata SPARQL + Offline Cache\\nP2034 Gutenberg ID & P407 Language"]',
    '        FeedMirrors["🏛️ Official PGLAF Mirrors (8.0s–16.0s Float Delay)\\ngutenberg.pglaf.org • aleph.gutenberg.org • gutenberg.readingroo.ms"]',
    '    end',
    '',
    '    subgraph NodePipelines ["Sequential Node.js CLI Engines (scripts/ • SUPABASE_SERVICE_ROLE_KEY)"]',
    '        ScriptCatalog["⚙️ Step 1: scripts/sync-gutenberg-catalog.js\\n• Verifies .sha256 Sidecar & Streams PGLAF-First Feeds (Content-Length + tar fail-closed)\\n• Extracts <dcterms:rights> + download_count & Diffs 78k Books in RAM\\n• Writes quote-diff.json, .sha256 Sidecar & Summary Digests (--clobber)"]',
    '        ScriptTrans["⚙️ Step 2: scripts/ingest-translations.js\\n• 5 Pipeline Blockers & 7 Hardening Defenses\\n• Deterministic FRBR Cluster Upsert"]',
    '        ScriptQuotes["⚙️ Step 3: scripts/sync-featured-quotes.js\\n• Consumes quote-diff.json & Scans idx_books_with_quotes_popular\\n• Quotes Promoted/Unquoted Pool Books (40 Popular + 10 Recent)\\n• Option-A 1-for-1 Out-of-Window Prune (max 2,000/run)"]',
    '        ScriptPurge["🧹 Step 4: scripts/purge-vercel-cache.js\\n• Invalidates Vercel-Cache-Tag (catalog, quotes, translations)\\n• Clean exit 0 skip when Vercel Secrets unset"]',
    '    end',
    '',
    '    subgraph SupabaseTables ["Supabase PostgreSQL Catalog Tables (Read-Only for Anon / Written by Service Role)"]',
    '        TableBooks[("🗄️ public.books (78,000+ Rows)\\n• books_pkey (id)\\n• idx_books_download_count (download_count DESC)\\n• idx_books_with_quotes_popular (partial WHERE quotes <> [] )\\n• idx_books_search_vector (GIN TSVECTOR)")]',
    '        TableTrans[("🗄️ public.book_translations (4,500+ Rows)\\n• book_translations_pkey (work_id, book_id)\\n• idx_book_translations_book_id\\n• idx_book_translations_work_lang")]',
    '    end',
    '',
    '    CatTrigger --> ScriptCatalog',
    '    ReleaseCache <-->|"gh release download / upload --clobber"| ScriptCatalog',
    '    FeedCSV --> ScriptCatalog',
    '    ScriptCatalog -->|"Upsert Delta Rows Only (0 Read Egress)"| TableBooks',
    '    ScriptCatalog -->|"Chains Step 2 on Success"| ScriptTrans',
    '    ScriptCatalog -->|"Passes quote-diff.json on Disk"| ScriptQuotes',
    '    TransTrigger -.->|"Manual Dispatch"| ScriptTrans',
    '    FeedWikidata --> ScriptTrans',
    '    ScriptTrans -->|"Upsert FRBR Edition Clusters"| TableTrans',
    '    ScriptTrans -->|"Chains Step 3 on Success"| ScriptQuotes',
    '    ScriptTrans -.->|"Purge translations tag (manual live)"| ScriptPurge',
    '    QuotesTrigger -.->|"Manual Dispatch"| ScriptQuotes',
    '    FeedMirrors --> ScriptQuotes',
    '    TableBooks -->|"idx_books_with_quotes_popular + PK Lookup"| ScriptQuotes',
    '    ScriptQuotes -->|"Upsert 10–16 Quotes/Book & Option-A Prune"| TableBooks',
    '    ScriptQuotes -->|"Purge catalog,quotes,translations / quotes tags"| ScriptPurge',
    '    PurgeTrigger -.->|"Manual Dispatch (Selected Tags + Target)"| ScriptPurge',
    '```',
    '',
    '### 2. CLI Pipelines & GitHub Actions Workflows Inventory',
    '',
    `> **Operator Runbook**: For complete trigger schedules, \`workflow_dispatch\` inputs, required/optional GitHub Secrets, \`catalog-cache\` release bootstrap behavior, and copy-paste local CLI commands across all ${workflowCount} workflows, see [\`docs/GITHUB_ACTIONS.md\`](docs/GITHUB_ACTIONS.md).`,
    '',
    '| Pipeline / Tool | Execution Mode | Source File | Schedule / Trigger | Architectural Responsibility & Database Index Contract |',
    '| :--- | :--- | :--- | :--- | :--- |',
    '| **`sync-gutenberg-catalog`** | Node.js Streaming CLI | [`scripts/sync-gutenberg-catalog.js`](scripts/sync-gutenberg-catalog.js) | `npm run catalog:sync` / Sunday Cron (`0 2 * * 0`) | Restores `gutenberg-catalog-cache.json.gz` (`--cache-file`), resolves portable `Bookarium-Catalog-Sync/1.0` headers (`resolveCatalogUserAgent`, `resolveSiteOriginFallback`), streams official Project Gutenberg `rdf-files.tar.bz2` (121MB, `<pgterms:downloads>` + `<dcterms:rights>` copyright flags) and `pg_catalog.csv.gz` (5.3MB) in PGLAF-first mirror order (`gutenberg.pglaf.org` -> `aleph.gutenberg.org` -> `www.gutenberg.org`, or `--feed-source` host pin, with `isHtmlContentType` outage rejection), diffs all 78,461 books and withdrawn IDs 100% in RAM (`filterChangedOrNewBooks` & `reconcileWithdrawnCatalogBooks` preserving `quotes` and cached `copyright` flags during outages), upserts only new/changed rows, writes `quote-diff.json` (`--diff-output`), and updates the `catalog-cache` release asset (`>= 50,000` safety floor). |',
    '| **`ingest-translations`** | Node.js Batch & Sync CLI | [`scripts/ingest-translations.js`](scripts/ingest-translations.js) | `npm run translations:sync` / Chained Sunday Step 2 | FRBR relational translation ingestion engine with portable `Bookarium-Gatekeeper/1.0` headers (`resolveUserAgent`, `resolveSiteOriginFallback`) enforcing 5 Pipeline Blockers, 7 Hardening Defenses, and `copyright !== true` catalog verification (`filterValidCatalogBookIds` & `WHERE b.copyright = false` SQL seeds) with live Supabase upserting (`idx_book_translations_cluster`). |',
    '| **`sync-featured-quotes`** | Node.js Multi-Worker CLI | [`scripts/sync-featured-quotes.js`](scripts/sync-featured-quotes.js) | `npm run quotes:sync` / Chained Sunday Step 3 | Consumes `quote-diff.json` (`--diff-file`) from Step 1 (or falls back to index scans on standalone runs) with portable origin/User-Agent headers (`resolveSiteOriginFallback`) to maintain the Two-Tier Bounded Quote Pool (`Top 500 Popular + Rolling 64 Most Recent`) in `public.books.quotes`, excludes `copyright === true` across both automated pools and manual `--ids` overrides, scans all currently quoted rows via `idx_books_with_quotes_popular` (`fetchAllQuotedBookIds` + `resolveBookMetadataByIds` + `computeOutOfWindowPrunePlan`), prioritizes `promotedIds`, applies Option-A `1-for-1` out-of-window pruning up to `2,000` (`--max-prune`), and writes `Out-of-Window (Pruned)` & `🧹 Pruned` rows in `formatRunReport` to `$GITHUB_STEP_SUMMARY`. |',
    '| **`purge-vercel-cache`** | Node.js CI Cache CLI | [`scripts/purge-vercel-cache.js`](scripts/purge-vercel-cache.js) | Chained CI Step (`dry_run != true`) & `cache-purge.yml` | Calls Vercel `POST https://api.vercel.com/v1/edge-cache/dangerously-delete-by-tags?projectIdOrName={projectId}[&teamId={teamId}]` for `--tags=...` (`catalog,quotes,translations`, or selective manual subsets via `cache-purge.yml` with `--target` & `--dry-run`) with bounded retry backoff, `$GITHUB_STEP_SUMMARY` reporting, and clean `exit 0` skip when `VERCEL_API_TOKEN` / `VERCEL_PROJECT_ID` are unset. |',
    '| **`ingest-catalog`** | Node.js Batch CLI | [`scripts/ingest-catalog.js`](scripts/ingest-catalog.js) | `npm run catalog:ingest` / On-Demand | Curated masterworks starter seeding, portable origin/User-Agent resolution (`resolveSiteOriginFallback`), and plain-text caching (`--with-content`) generating `supabase/seed_books.sql`. |',
    ...dynamicWorkflowRows
  );

  lines.push(
    '',
    '---',
    '',
    '## 🗄️ Database Architecture & Row Level Security (RLS) Policies',
    '',
    `Bookarium uses Supabase PostgreSQL for optional cloud synchronization and dedicated database catalog serving, verified across **${dbCatalog.tables.length} Database Tables** (${dbCatalog.policyCount} RLS policies & ${dbCatalog.checkConstraintCount} payload ceiling CHECK constraints) with strict Row Level Security (Rule 9):`,
    '',
    '| Table Name | Read Access / RLS | Write Authority & Mutating Actors | Runtime Consumers (Stores, Providers & CLI) | Domain Role & Security Description |',
    '| :--- | :--- | :--- | :--- | :--- |'
  );

  for (const t of dbCatalog.tables) {
    lines.push(`| **\`${t.name}\`** | ${t.rls} | ${t.writeAuth} | ${t.store} | ${t.description} |`);
  }

  lines.push(
    '',
    `### 1. Stored Logic, Triggers & RPC Functions (${dbCatalog.functions.length} Functions / Guards)`,
    '',
    'Programmatically extracted from `CREATE OR REPLACE FUNCTION` and `CREATE TRIGGER` statements in [`supabase/schema.sql`](supabase/schema.sql):',
    '',
    '| Database Function / Trigger | Type | Target Table(s) | Functionality & Security Scope |',
    '| :--- | :--- | :--- | :--- |'
  );

  for (const fn of dbCatalog.functions) {
    lines.push(
      `| **\`${fn.name}\`** | ${fn.type} | ${fn.targetTables} | ${fn.description} |`
    );
  }

  lines.push(
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
    '### 4. Query-to-Index Execution Plan & 78k-Row Anti-Timeout Contracts',
    '',
    'Because `public.books` stores `78,000+` volumes (with `77,500+` rows having `download_count = 0` and optional wide `content TEXT` / `quotes JSONB` TOAST columns) under Supabase PostgREST\'s `8s` `statement_timeout`, every runtime and CLI query adheres to a strict index-alignment contract:',
    '',
    '| Query Caller & Module | PostgREST / SQL Query Shape | Target PostgreSQL Index | Chunk / Limit Bound | Enforced Anti-Timeout Invariants (Forbidden Anti-Patterns) |',
    '| :--- | :--- | :--- | :--- | :--- |',
    '| **Catalog Search & Browse** ([`src/lib/catalog/supabase-provider.ts`](src/lib/catalog/supabase-provider.ts)) | `SELECT <CATALOG_METADATA_COLUMNS> ... ORDER BY download_count DESC` (or `id ASC/DESC`) + optional `textSearch(search_vector)`, `overlaps(languages)`, `lte(max_author_death_year)` | `idx_books_download_count`, `idx_books_search_vector` (GIN), `idx_books_languages` (GIN), `idx_books_author_death_year`, `books_pkey` | `range(from, to)` (`<= 100` rows; short-circuited when `from >= MAX_CATALOG_OFFSET = 160_000` / `MAX_CATALOG_PAGE = 5000`) + `count: "estimated"` | **Never** select `content` or unrequested `quotes` in catalog list queries (`CATALOG_METADATA_COLUMNS` omits `quotes`; only selected via `CATALOG_WITH_QUOTES_COLUMNS` when `hasQuotes=true`); **never** chain `.order(\'id\', { ascending: true })` onto single-column `idx_books_download_count` or execute deep-offset scans beyond `160_000`. |',
    '| **Single-Book & Batch ID Lookup** ([`src/lib/catalog/supabase-provider.ts`](src/lib/catalog/supabase-provider.ts), [`src/hooks/queries/useBooks.ts`](src/hooks/queries/useBooks.ts)) | `SELECT ... FROM public.books WHERE id = $1` or `.in(\'id\', normalizedIds)` via 7-day Edge-cached `/api/books?ids=...&has_quotes=true` (`useFeaturedQuotes` when `cachedSpreads.length < 3` and book is opened/shuffled) | `books_pkey` (`INTEGER PRIMARY KEY`) | `1` to `100` IDs per query | Direct B-Tree Primary Key lookup (`< 2ms`); cached 7d on Vercel Edge (`s-maxage=604800`); backfills all 16 spreads on demand when the 2-spread pool is cached. |',
    '| **Quote-Enriched Books Discovery** ([`src/lib/catalog/supabase-provider.ts`](src/lib/catalog/supabase-provider.ts) `fetchQuoteEnrichedPool` via `/api/books?pool=quotes` & [`src/hooks/queries/useBooks.ts`](src/hooks/queries/useBooks.ts) `fetchQuoteEnrichedBooks`) | Step 1: `FEATURED_HERO_BOOKS` + `LITERARY_QUOTES` IDs + `select(\'id\').order(\'download_count\', DESC).limit(500)` + `order(\'id\', DESC).limit(64)`; Step 2: `selectRotatingQuotePoolCandidateIds` 12h window slice -> `.in(\'id\', selectedCandidateIds).neq(\'quotes\', \'[]\').order(\'download_count\', DESC).limit(48)` (`DEFAULT_QUOTE_POOL_LIMIT = 48`) with native PostgREST 2-spread projection (`quote0:quotes->0, quote1:quotes->1`) | `idx_books_download_count` + `books_pkey` (`.in(\'id\', selectedCandidateIds)`) | `~564` candidate IDs -> `limit = 48` default (`DEFAULT_QUOTE_POOL_LIMIT = 48`, Edge CDN `s-maxage=43200`, browser `max-age=3600`, `~22 KB` wire transfer) | **Never** execute an unbounded `.neq(\'quotes\', \'[]\').order(\'download_count\', DESC)` without `.in(\'id\', ...)` (prevents 78,000-row index walk); 14 weekly 12h batches (`672` slots/week) cycle all 564 books at `~44 KB/day`. |',
    '| **Featured Quotes Sync Pipeline** ([`scripts/sync-featured-quotes.js`](scripts/sync-featured-quotes.js), `catalog-sync.yml` Step 3 & `quotes-sync.yml`) | Step 1: Consumes `quote-diff.json` (`--diff-file`) from `sync-gutenberg-catalog.js` (or `ORDER BY download_count DESC LIMIT 1000` + `.in(\'id\', PRIORITY_HERO_BOOK_IDS)` + `ORDER BY id DESC LIMIT 320` on standalone manual runs); Step 2: `fetchAllQuotedBookIds` across partial index `idx_books_with_quotes_popular` (`1,000`/page up to `MAX_PAGES = 20` / `20,000` rows max) + `resolveBookMetadataByIds` via `books_pkey`; Step 3: `.in(\'id\', selectedIds)` for `content, quotes` + post-batch `computeOutOfWindowPrunePlan` Option-A `1-for-1` pruning (`<= 2,000`/run) | `books_pkey` & `idx_books_with_quotes_popular` (+ `idx_books_download_count` on standalone fallback) | `1,000` IDs/page (`fetchAllQuotedBookIds`); `200` IDs/chunk (`resolveBookMetadataByIds` / `fetchQuotedBookIds`); `25` IDs/chunk (`pruneOutOfWindowBookQuotes`, `50ms` yield past `500` IDs, `DEFAULT_MAX_PRUNE_PER_RUN = 2000`) | **Zero full-table scans (`< 15ms` per page)**: `idx_books_with_quotes_popular` restricts discovery strictly to quoted rows (`WHERE quotes <> \'[]\'::jsonb`), `quote-diff.json` eliminates unquoted pool scans on Sunday runs, and `content` is hydrated only for selected batch IDs. |',
    '| **Gutenberg Catalog Sync Pipeline** ([`scripts/sync-gutenberg-catalog.js`](scripts/sync-gutenberg-catalog.js) & `catalog-sync.yml` Step 1) | Step 1: In-RAM diff via `gutenberg-catalog-cache.json.gz` (`--cache-file`) in `filterChangedOrNewBooks` (cold-start fallback: `.select(CATALOG_DIFF_SELECT_COLUMNS).in(\'id\', batchIds)`); Step 2: `upsert(toUpsert, { onConflict: \'id\', ignoreDuplicates: false })` on new/changed rows only via sticky dynamic write chunks (`[25, 100]`); Step 3: In-RAM withdrawn-book detection via `cachedBookIds` in `reconcileWithdrawnCatalogBooks` (cold-start fallback: keyset `select(\'id\').gt(\'id\', lastId).order(\'id\', ASC).limit(1000)`) | `books_pkey` (`ON CONFLICT (id)` & cold-start keyset scan) | `0` DB reads for unchanged rows when snapshot cached (`200` rows/batch on cold start); sticky dynamic write chunks (`100 -> 50 -> 25` on `57014`); `50,000` min-catalog & `500` max-prune circuit breakers | **Zero read egress on unchanged rows, zero `quotes` overwrite & zero GIN dirtying on `download_count` updates**: `gutenberg-catalog-cache.json.gz` (`catalog-cache` GitHub Release) diffs 78,461 books in RAM (~39 MB/week egress saved) and writes `quote-diff.json`. |',
    '| **FRBR Translations Sync & Lookup** ([`scripts/ingest-translations.js`](scripts/ingest-translations.js), `/api/books/translations`) | `SELECT ... FROM public.book_translations WHERE book_id = $1` -> `WHERE work_id = $2` | `idx_book_translations_book_id`, `book_translations_pkey (work_id, book_id)`, `idx_book_translations_work_lang` | `500` rows/upsert batch (halving on `57014`) | 2-hop indexed B-Tree join resolves all multilingual editions of a work in `< 5ms` with zero full-table scans. |',
    '| **7-Store Scholar Cloud Outbox Sync** ([`src/lib/sync-utils.ts`](src/lib/sync-utils.ts), `bookshelf-cloud-sync.ts`, `reader-cloud-sync.ts`, `annotation-cloud-sync.ts`, `fellowship-cloud-sync.ts`, `preferences-sync.ts`) | Pre-sync active JWT session check (`verifyActiveCloudSession`) + user-scoped `.eq(\'user_id\', user.id)` / `.or(\'requester_id.eq...,recipient_id.eq...\')` with per-user in-flight Promise coalescing (`coalesceInFlightByUser`) & batched multi-book `reading_progress` upsert (`upsertReadingProgressBatch`) | `idx_bookshelf_items_user_id`, `idx_user_annotations_user_book`, `idx_user_book_curation_user_book`, `idx_user_reading_habits_user`, `idx_user_accolades_user`, `idx_reader_circles_*`, `idx_symposium_sessions_*` | Per-user rows (`2,000ms` debounce on single-book `reading_progress` & `profiles.preferences`; single batched array upsert on multi-book healing) | Every `WHERE user_id = (select auth.uid())` RLS policy is backed by a dedicated B-Tree index on `user_id` / participant ID and guarded against unauthenticated `42501` writes. |'
  );

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
    '| **`proxy`** | [`src/proxy.ts`](src/proxy.ts) & [`src/lib/supabase/middleware.ts`](src/lib/supabase/middleware.ts) | Next.js 16 Edge proxy extracting client IP country (`x-vercel-ip-country`), forwarding `x-bookarium-country` on non-`/api/books/content*` routes and setting `bookarium-geo-country` cookie on page routes (delegating SSR refreshes to `updateSession` while skipping `/api/books*`, `/auth/*`, `/sw.js`, `/manifest.webmanifest`, Next.js `<Link>` prefetches, `x-bookarium-sw-precache: 1` warm requests, and public client-side RSC navigations `rsc: 1` outside `/account*` to preserve Vercel Edge CDN `s-maxage` caching and eliminate redundant Supabase Auth `GET /user` bursts; forwarding Edge-safe `sanitizeForwardedUserAgent` from `src/lib/supabase/client.ts` without `next/headers` leaks and stamping `bookarium-client-ip-sync` on rotated auth cookies), returning bare `NextResponse.next()` on unshared `/api/books/content*` requests (`!validShareToken`) so `x-middleware-override-headers` is omitted while forwarding validated `?s=<token>` share parameters via `x-bookarium-share-token` to Server Component layouts, handling development query override (`?country=XX`), and enforcing strict security headers. |',
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
    '    subgraph SecurityGates ["Static Security, AST Taint & Boundary Gates (scripts/verify-build.js & eslint.config.mjs)"]',
    '        Pass05["🔒 Pass 0.5: Secret, File/Path, AST Env & Graph Scanner\\n• Zero live tokens / private keys / service_role JWTs\\n• File/Path & 5 MB ceiling • AST .env.example & client privilege parity\\n• Transitive Client->Server AST Graph Isolation"]',
    `        Pass075["🛡️ Pass 0.75: 7-Pillar SAST, Lockfile & Full AST Suite\\n• Lockfile SHA-512 & HTTPS npm registry + 0 High/Crit CVEs\\n• ${getSecurityPluginRuleCount()}-Rule AST Taint + AST API/Redirect/Filter/Rule-9/SW Guards\\n• MIT / copyright=false • 14-Table RLS, Write-Policy & search_path\\n• 7 OWASP HTTP Security Headers & AST Service Worker Guard"]`,
    '    end',
    '',
    '    subgraph TestRunner ["Vitest 4 Runner & JSDOM Bootstrap"]',
    '        VitestCfg["⚙️ vitest.config.mts\\n• jsdom environment • maxWorkers: 4\\n• @/* path alias • V8 Coverage Provider"]',
    '        TestSetup["🧰 src/test/setup.ts\\n• @testing-library/jest-dom/vitest & fail-closed handleUnhandledMswRequest\\n• next/dynamic chunk pre-resolution (pendingDynamicImports)\\n• framer-motion synchronous forwardRef mock\\n• JSDOM polyfills (IndexedDB, SpeechSynthesis, matchMedia, ResizeObserver)\\n• Per-test localStorage.clear() & vi.clearAllMocks()"]',
    '        MSWServer["🌐 src/mocks/server.ts & src/mocks/handlers.ts\\n• MSW v2 setupServer(...handlers) lifecycle + fail-closed guard\\n• GET /api/books, /api/books/content, /api/books/translations\\n• 4 Gutenberg Mirrors & Supabase/*.co/:54321 503 catch-all\\n• mockBooks & sampleBookText fixtures (0 external network calls)"]',
    '    end',
    '',
    `    subgraph TestTiers ["4-Tier Co-Located Test Suites (${testHarness.totalSuites} Suites)"]`,
    '        Tier1["Tier 1: Pure Domain, Security & AST Suites\\n• copyright-engine, url-validator, redirect-sanitizer, rate-limiter, password\\n• gutenberg/* (segmentation, reflow, pagination, passages, metadata)\\n• reader-annotator, accolades-engine, reading-analytics, book-sorting"]',
    '        Tier2["Tier 2: API Route & TanStack Query Suites (Pass 2)\\n• /api/books, /api/books/content, /api/books/translations, /auth/callback\\n• useBooks, useBookContent, useBookTranslations\\n• supabase-provider, curated-fallback"]',
    '        Tier3["Tier 3: Zustand Store, IndexedDB & Outbox Sync Suites\\n• 10 Zustand Stores (useBookshelfStore, useReaderStore, useAuthStore, etc.)\\n• bookshelf-cloud-sync, sync-utils, offline-storage"]',
    `        Tier4["Tier 4: React 19 UI Component, Page & CLI Suites (Pass 3)\\n• @testing-library/react + userEvent (getByRole, WCAG 2.2 focus traps)\\n• ${components.length} UI Components + App Router Pages/Layouts + Web Worker\\n• CLI, AST & Security Pipelines (ingest-catalog.test.ts, sync-gutenberg-catalog.test.ts, ingest-translations.test.ts, sync-featured-quotes.test.ts, purge-vercel-cache.test.ts, ast-parser.test.ts, sast-validators.test.ts, bookarium-security.test.ts)"]`,
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

  const scriptSuiteMetaMap = {
    'ingest-catalog.test.ts': {
      layer: 'CLI Data Pipeline Test Suite',
      role: 'Hermetic unit tests verifying `ingest-catalog.js` URL/User-Agent resolvers, `CURATED_CLASSICS` SQL seed generation, `computeLifespanBounds`, and incremental content update SQL without running the CLI entrypoint.',
    },
    'ingest-translations.test.ts': {
      layer: 'CLI Data Pipeline Test Suite',
      role: 'Hermetic unit & integration tests verifying Wikidata SPARQL FRBR work clustering, 5 Pipeline Blockers, 7 Hardening Defenses, and SQL seed generation.',
    },
    'sync-featured-quotes.test.ts': {
      layer: 'CLI Data Pipeline Test Suite',
      role: 'Hermetic unit & integration tests verifying Two-Tier Bounded Quote Pool blending (`Top 500 Popular + Rolling 64 Most Recent`, `40 + 10` split with backfill), `--diff-file=quote-diff.json` zero-scan pool consumption, partial-index out-of-window discovery (`fetchAllQuotedBookIds`), Option-A `1-for-1` pruning up to `2,000` (`computeOutOfWindowPrunePlan`, `--max-prune`, `50ms` inter-chunk yield), single-line console progress (`formatConsoleSummary` with `• Purge Status:` / `• Out-of-Window:`) and Markdown summary reporting (`formatRunReport` with `Out-of-Window (Pruned)` & `🧹 Pruned`), per-mirror PGLAF workers (`gutenberg.pglaf.org`, `aleph.gutenberg.org`, `gutenberg.readingroo.ms`), and `public.books.quotes` JSONB upserts.',
    },
    'purge-vercel-cache.test.ts': {
      layer: 'CLI Data Pipeline Test Suite',
      role: 'Hermetic unit tests verifying Vercel Edge cache tag purging (`parsePurgeCliArgs`, `buildVercelCachePurgeUrl`, `appendPurgeStepSummary`, `purgeVercelEdgeCache`), `VERCEL_API_TOKEN` / `VERCEL_PROJECT_ID` / optional `VERCEL_TEAM_ID` handling, clean skip behavior (`exit 0`), `429`/`Retry-After`/`5xx` retry backoff, and `$GITHUB_STEP_SUMMARY` reporting.',
    },
    'sync-gutenberg-catalog.test.ts': {
      layer: 'CLI Data Pipeline Test Suite',
      role: 'Hermetic unit & integration tests verifying PGLAF-first `rdf-files.tar.bz2` and `pg_catalog.csv.gz` streaming decompression, `--feed-source` host pinning, `isHtmlContentType` outage rejection, wire `SHA-256` digest computation + `Content-Length`/non-zero `tar` truncation fail-closed checks, RDF `<dcterms:rights>` copyright tagging (`isRdfCopyrightedNotice`, `parseRdfCatalogSignalsStream`), CSV RFC 4180 parsing, author lifespan extraction, `.sha256`-verified (`crypto.timingSafeEqual`) in-RAM `--cache-file=gutenberg-catalog-cache.json.gz` snapshot diffing and `--diff-output=quote-diff.json` emission (`hasCatalogMetadataChanged`, `filterChangedOrNewBooks` preserving `quotes` & cached `copyright`), withdrawn-book reconciliation (`reconcileWithdrawnCatalogBooks`), `$GITHUB_STEP_SUMMARY` digest logging, and sticky dynamic Supabase batch upserts.',
    },
    'ast-parser.test.ts': {
      layer: 'AST & SQL Analysis Engine Suite',
      role: 'Hermetic fixture & live-repo tests verifying Babel AST dependency graphs, `hasCycles` static circular detection, fail-closed `getAstParseErrors`, architectural `detectLayerViolations`, inherited/intersected `Props` extraction, AST `persist` key & HTTP verb resolution, balanced `extractSqlSchemaEntities` parsing, and un-truncated `extractTestsFromSourceAst`.',
    },
    'sast-validators.test.ts': {
      layer: 'Stateless SAST Validator Suite',
      role: 'Positive live-repo, refactor-resilience, and adversarial negative AST/SCA fixture suites exercising `validateNextConfigSecurityHeadersAst`, `validateNextBuildHeaderManifest`, `validatePackageLockAndLifecycle` (`BANNED_PACKAGE_LICENSES`), `validateGitHubWorkflowSecurity`, `validateServiceWorkerSecurity`, `validateEnvAndPrivilegeBoundariesAst`, `validateApiRoutesSecurityAst`, `validateRedirectRoutesAst`, `validatePublicDomainFilterAst`, `validateRule9AuthStoreParityAst`, and `validateLiveHttpSecurityResponse` (`scripts/lib/sast-validators.js`).',
    },
    'bookarium-security.test.ts': {
      layer: 'AST & Request-Taint Security Suite',
      role: `Unit & codebase-wide AST verification tests for all ${getSecurityPluginRuleCount()} \`bookarium-security\` ESLint rules and intra-procedural request + CLI \`process.argv\` taint analysis (\`Sources -> Sanitizers -> Sinks\`, Node \`https.get\`/\`http.get\`, and \`scripts/\` \`{ shell: true }\` guards).`,
    },
  };

  for (const scriptSuite of testHarness.scriptSuites) {
    const baseName = path.basename(scriptSuite);
    const meta = scriptSuiteMetaMap[baseName];
    const scriptSuiteLayer = meta ? meta.layer : 'CLI Data Pipeline Test Suite';
    const scriptSuiteRole = meta ? meta.role : 'Standalone CLI or verification test suite.';
    lines.push(
      `| **\`${baseName}\`** | [\`${scriptSuite}\`](${scriptSuite}) | ${scriptSuiteLayer} | ${scriptSuiteRole} |`
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
    'Every source file is analyzed for upstream imports, downstream consumers, Babel AST parse integrity (`getAstParseErrors`), static circular dependencies (`hasCycles`), enforced architectural layer boundaries (`detectLayerViolations`: `src/components/ui/**` isolated from `stores/`, `app/`, and feature component folders; `src/lib/**` isolated from `components/`, `hooks/`, and `app/`, with `import type` exempted), runtime cross-boundary callers, and its co-located Vitest suite to guarantee zero broken, circular, boundary-violating, orphaned, or untested code:',
    '',
    '### 1. Client & SSR ↔ Internal API Route Callers (AST-Extracted)',
    '',
    '| Endpoint Route | Route Handler | AST-Verified Client / SSR Callers |',
    '| :--- | :--- | :--- |',
  );

  const routeFileByPath = new Map(routes.map((rt) => [rt.path, rt.file]));
  for (const apiItem of crossBoundary.apiRouteCallers) {
    const handlerFile = routeFileByPath.get(apiItem.route);
    const handlerCell = handlerFile ? `[\`${handlerFile}\`](${handlerFile})` : '_Handler_';
    const callersCell = apiItem.callers.map((c) => `[\`${c}\`](${c})`).join(', ');
    lines.push(`| **\`${apiItem.route}\`** | ${handlerCell} | ${callersCell} |`);
  }

  lines.push(
    '',
    '### 2. Supabase PostgreSQL Tables & RPC Caller Topology (AST-Extracted)',
    '',
    '| Database Entity / RPC | Kind | AST-Verified `src/` & `scripts/*.js` Callers |',
    '| :--- | :--- | :--- |'
  );

  for (const tp of crossBoundary.dbTouchpoints) {
    const callersCell = tp.callers.map((c) => `[\`${c}\`](${c})`).join(', ');
    lines.push(`| **\`${tp.table}\`** | PostgreSQL Table | ${callersCell} |`);
  }
  for (const rpc of crossBoundary.rpcCallers) {
    const callersCell = rpc.callers.map((c) => `[\`${c}\`](${c})`).join(', ');
    lines.push(`| **\`${rpc.rpc}\`** | \`SECURITY DEFINER\` RPC | ${callersCell} |`);
  }

  lines.push(
    '',
    '### 3. Cross-Layer Storage Keys, Caches & SSR Cookies (AST-Extracted)',
    '',
    '| Storage Key / Cookie / DB | Zustand Persist Store | AST-Verified Writers | AST-Verified Readers |',
    '| :--- | :--- | :--- | :--- |'
  );

  for (const st of crossBoundary.storageKeyBindings) {
    const persistCell =
      st.persistedBy.length > 0
        ? st.persistedBy.map((f) => `[\`${f}\`](${f})`).join(', ')
        : '_None_';
    const fallbackIoLabel =
      st.persistedBy.length > 0 ? '_Managed by Persist Middleware_' : '_None_';
    const writersCell =
      st.writers.length > 0 ? st.writers.map((f) => `[\`${f}\`](${f})`).join(', ') : fallbackIoLabel;
    const readersCell =
      st.readers.length > 0 ? st.readers.map((f) => `[\`${f}\`](${f})`).join(', ') : fallbackIoLabel;
    lines.push(`| **\`${st.key}\`** | ${persistCell} | ${writersCell} | ${readersCell} |`);
  }

  lines.push(
    '',
    '### 4. CLI, AST & Security Script Dependency Matrix (`scripts/`)',
    '',
    '| Script Module | Internal `scripts/` Requires | Downstream Script Consumers | DB Tables (`.from()`) |',
    '| :--- | :--- | :--- | :--- |'
  );

  for (const sNode of scriptsGraph.nodes) {
    const sLabel = sNode.file.replace(/^scripts\//, '');
    const reqCell =
      sNode.requires.length > 0
        ? sNode.requires.map((r) => `[\`${r.replace(/^scripts\//, '')}\`](${r})`).join(', ')
        : '_Standalone_';
    const consCell =
      sNode.consumedBy.length > 0
        ? sNode.consumedBy.map((c) => `[\`${c.replace(/^scripts\//, '')}\`](${c})`).join(', ')
        : '_CLI / Workflow Entrypoint_';
    const dbCell =
      sNode.dbTables.length > 0 ? sNode.dbTables.map((t) => `\`${t}\``).join(', ') : '_None_';
    lines.push(`| [\`${sLabel}\`](${sNode.file}) | ${reqCell} | ${consCell} | ${dbCell} |`);
  }

  lines.push(
    '',
    '### 5. Source Module AST Topology Matrix (`src/`)',
    '',
    '| Module / Component | Upstream Dependencies (`_(type)_` = type-only) | Downstream Consumers (`_(type)_` = type-only) | Co-Located Test Suite | Role & Responsibilities |',
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
    const candidates = [
      `${baseNoExt}.test.ts`,
      `${baseNoExt}.test.tsx`,
      `${baseNoExt}.security.test.ts`,
      `${baseNoExt}.security.test.tsx`,
    ];
    const matchedLinks = [];
    for (const cand of candidates) {
      if (testSuiteSet.has(cand)) {
        const label = ambiguousBasenames.has(path.basename(fileRel))
          ? cand.replace(/^src\//, '')
          : path.basename(cand);
        matchedLinks.push(`[\`${label}\`](${cand})`);
      }
    }
    if (matchedLinks.length > 0) {
      return matchedLinks.join(', ');
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

  const srcFileSet = new Set(graph.keys());
  for (const file of sortedFiles) {
    const data = graph.get(file);
    const label = formatModuleLabel(file);
    const typeOnlyResolvedSet = new Set(data.typeOnlyImports || []);
    const uniqueImportsMap = new Map();
    for (const rawImp of data.imports) {
      const display = rawImp.replace(/^@\//, '');
      const resolved = resolveImportPath(rawImp, file, srcFileSet);
      const isTypeOnly = Boolean(resolved && typeOnlyResolvedSet.has(resolved));
      if (!uniqueImportsMap.has(display)) {
        uniqueImportsMap.set(display, isTypeOnly);
      } else if (!isTypeOnly) {
        uniqueImportsMap.set(display, false);
      }
    }
    const importsStr =
      uniqueImportsMap.size > 0
        ? Array.from(uniqueImportsMap.entries())
            .map(([disp, isTypeOnly]) => (isTypeOnly ? `\`${disp}\` _(type)_` : `\`${disp}\``))
            .join(', ')
        : '_Root Primitive_';

    const typeOnlyConsumerSet = new Set(data.typeOnlyConsumedBy || []);
    const uniqueConsumersMap = new Map();
    for (const consumerRel of data.consumedBy) {
      const cLabel = formatModuleLabel(consumerRel);
      const isTypeOnly = typeOnlyConsumerSet.has(consumerRel);
      if (!uniqueConsumersMap.has(cLabel)) {
        uniqueConsumersMap.set(cLabel, isTypeOnly);
      } else if (!isTypeOnly) {
        uniqueConsumersMap.set(cLabel, false);
      }
    }
    const consumersStr =
      uniqueConsumersMap.size > 0
        ? Array.from(uniqueConsumersMap.entries())
            .map(([cLabel, isTypeOnly]) =>
              isTypeOnly ? `\`${cLabel}\` _(type)_` : `\`${cLabel}\``
            )
            .join(', ')
        : file.includes('page.tsx') || file.includes('route.ts') || file.includes('layout.tsx')
          ? '_App Route Entry_'
          : '_Direct Root Consumer_';

    const coLocatedTestLink = resolveCoLocatedTestLink(file);
    const roleTitle = classifyModuleRole(file);

    lines.push(
      `| [\`${label}\`](${file}) | ${importsStr} | ${consumersStr} | ${coLocatedTestLink} | ${roleTitle} |`
    );
  }

  for (const harnessNode of harnessAstDeps) {
    const hLabel = harnessNode.file.replace(/^src\//, '');
    const hImports = Array.from(new Set(harnessNode.imports.map((i) => i.replace('@/', ''))));
    const hImportsStr =
      hImports.length > 0 ? hImports.map((i) => `\`${i}\``).join(', ') : '_Root MSW Fixtures_';
    const hConsumers = Array.from(new Set(harnessNode.consumedBy.map((c) => formatModuleLabel(c))));
    const hConsumersStr =
      harnessNode.file === 'src/test/setup.ts'
        ? '_Global Vitest Bootstrap (`vitest.config.mts`)_'
        : hConsumers.length > 0
          ? hConsumers.map((c) => `\`${c}\``).join(', ')
          : '_Test Suite Bootstrap_';
    const hTestLink =
      harnessNode.file === 'src/mocks/handlers.ts'
        ? resolveCoLocatedTestLink(harnessNode.file)
        : harnessNode.file === 'src/mocks/server.ts' && testSuiteSet.has('src/mocks/handlers.test.ts')
          ? '[`handlers.test.ts`](src/mocks/handlers.test.ts)'
          : '_Bootstraps All Vitest Suites_';
    const hRoleTitle =
      harnessNode.file === 'src/mocks/handlers.ts'
        ? 'MSW v2 Mock Handlers & Fixtures'
        : harnessNode.file === 'src/mocks/server.ts'
          ? 'MSW v2 Node Server Instance'
          : 'Vitest JSDOM & MSW Bootstrap';

    lines.push(
      `| [\`${hLabel}\`](${harnessNode.file}) | ${hImportsStr} | ${hConsumersStr} | ${hTestLink} | ${hRoleTitle} |`
    );
  }

  lines.push(
    '',
    '---',
    '',
    '## ⚡ Data Pulling & Caching Strategy',
    '',
    '1. **Authoritative Supabase Catalog & Bundled Curated Fallback**: Primary search queries execute against dedicated Supabase PostgreSQL (`public.books`) using full-text GIN search (~1–2s catalog responses, <50ms single-book lookups), falling back cleanly to the bundled Curated Archive (`src/lib/catalog/curated-fallback.ts`) when Supabase is unconfigured without external third-party catalog REST dependencies, unconditionally enforcing `copyright=false`.',
    '2. **Unified Visible Telemetry & Zero-CLS Radar**: `StickyCatalogToolbar.tsx` (`CatalogTelemetryBadge.tsx`) renders a unified Zero-CLS API connectivity, latency, and archive query radar pill with locked geometry (`min-w-[72px] sm:min-w-[78px]`) supporting 4 states (Online Idle, Active Querying with micro-spinner and pulse `•••`, Pending Measure, and Offline), paired with a collision-aware diagnostic popover card that automatically flips upwards when docked at the hero fold or downwards when stuck at the top, complete with touch tap-toggle interaction and provider telemetry across Bookarium Catalog (`supabase`) and Curated Archive Cache (`cache`).',
    '3. **Customizable Batch Sizing**: Readers can dynamically toggle batch sizes (`Show: [8 | 16 | 24 | 32]`) without page reloads.',
    '4. **Multi-Tier Vercel Edge CDN Caching, Geographic Vary Partitioning, Tag Invalidation & Gutenberg Cover Proxy**: Public API routes offload >99% of repeat traffic to the Vercel Global Edge CDN with route-specific TTLs, minimal `Vary` keys, and instant post-ingestion or manual `Vercel-Cache-Tag` purging (`scripts/purge-vercel-cache.js` calling `POST https://api.vercel.com/v1/edge-cache/dangerously-delete-by-tags` at the end of live CI syncs or selectively via `.github/workflows/cache-purge.yml`): `/api/books?pool=quotes` caches the 48-volume 2-spread rotating quote pool for `12h` (`max-age=3600, s-maxage=43200, swr=604800, Vary: Accept-Encoding`, `Vercel-Cache-Tag: quotes`); `/api/books` caches 11-column catalog searches for `24h` (`max-age=300, s-maxage=86400, swr=604800, Vary: x-vercel-ip-country, cf-ipcountry, x-bookarium-country, Accept-Encoding`, `Vercel-Cache-Tag: catalog` or `catalog,quotes`); `/api/books?ids=...&has_quotes=true` (`Vercel-Cache-Tag: catalog,quotes`) & `include_restricted_metadata=true` (`Vercel-Cache-Tag: catalog`) cache explicit quote/metadata batches for `7d` (`max-age=86400, s-maxage=604800, swr=2592000, Vary: Accept-Encoding`); `/api/books/translations` caches FRBR work clusters for `7d` (`max-age=86400, s-maxage=604800, swr=2592000, Vary: x-vercel-ip-country`, `Vercel-Cache-Tag: translations`); and `/api/books/content` caches plain-text & `type=card` OG PNGs for `24h` (`max-age=86400, s-maxage=86400, swr=604800`) and `?type=cover` Project Gutenberg mirror cover images for `7d` (`max-age=604800, s-maxage=604800, swr=2592000`).',
    '5. **Jurisdictional Copyright Gatekeeping & Bibliographic Preservation**: The streaming route (`/api/books/content`) intercepts requests from non-US jurisdictions, verifying author/translator death years against Berne/local terms and returning `HTTP 451 Unavailable For Legal Reasons` for protected titles. Concurrently, the catalog pipeline supports `includeRestrictedMetadata=true` for explicit IDs, ensuring personal collections (Notebook, Bookmarks) and reader error screens display authentic bibliographic citations (titles, authors, subjects) without opening prohibited full-text streams.',
    '6. **Multi-Tier Text Streaming, In-Memory LRU & Multi-Mirror Failover**: Plain text is served on-demand from Tier 0 (`bookContentLruCache`: 24h TTL / 20-book in-memory LRU cache preventing cross-jurisdiction upstream re-fetches), Tier 1 (dedicated Supabase plain-text cache if present), or Tier 2 (mirror-first fallback across `aleph.gutenberg.org`, `gutenberg.pglaf.org`, `gutenberg.readingroo.ms`, and `www.gutenberg.org` with in-flight promise coalescing `inFlightMirrorFetches`), protected by an in-memory 24h contributor metadata cache and anti-SSRF validator.',
    '7. **Native IndexedDB Offline Cache**: Opened and downloaded unabridged texts are cached in browser IndexedDB for 100% offline access with client-side jurisdictional protection preventing illicit cross-border reading.',
    '8. **Autonomous Weekly Catalog Synchronization & In-RAM Snapshot Diffing**: Project Gutenberg\'s official `rdf-files.tar.bz2` and `pg_catalog.csv.gz` feeds (`78,000+` public domain titles) are streamed and decompressed on-the-fly across 3 official Gutenberg mirrors (`www.gutenberg.org`, `aleph.gutenberg.org`, `gutenberg.pglaf.org`) via GitHub Actions (`.github/workflows/catalog-sync.yml`) or `npm run catalog:sync`, diffing all 78,461 rows in RAM against the `gutenberg-catalog-cache.json.gz` (`catalog-cache` release asset) to eliminate unchanged-row read egress (~39 MB/week saved), emitting `quote-diff.json` for downstream quote sync, and updating changed metadata and 30-day `download_count` in Supabase with minimal storage footprint (~105 MB).',
    '',
    '---',
    '',
    '## 🌍 External Integration & Boundary Contracts Map',
    '',
    'Bookarium enforces strict boundary isolation, anti-SSRF hostname validation, and Content-Security-Policy (`connect-src`, `img-src`, `style-src`, `font-src`) across every outbound and inbound external integration:',
    '',
    '### 1. External Integration Topology Diagram',
    '',
    '```mermaid',
    'flowchart LR',
    '    subgraph BookariumRuntime ["Bookarium Execution Tiers"]',
    `        BrowserTier["🖥️ Browser Client\\n(React 19 SPA, Service Worker ${swMeta.versionLabel}, IndexedDB)"]`,
    '        EdgeTier["⚡ Vercel Edge & Serverless (iad1)\\n(src/proxy.ts, /api/books/**, /auth/callback)"]',
    '        CLITier["🛠️ GitHub Actions & Node.js CLI\\n(catalog-sync.yml, translations-sync.yml, quotes-sync.yml, cache-purge.yml)"]',
    '    end',
    '',
    '    subgraph ExternalSystems ["External Public Domain & Cloud Infrastructure"]',
    '        SupaDB[("⚡ Supabase PostgreSQL & PostgREST\\n(https://*.supabase.co/rest/v1/*)")]',
    '        SupaAuth["🔐 Supabase Auth & Cloudflare Turnstile\\n(https://*.supabase.co/auth/v1/* • challenges.cloudflare.com)"]',
    '        GutenbergMirrors["📚 4 Allowlisted Gutenberg Mirrors\\n1. aleph.gutenberg.org\\n2. gutenberg.pglaf.org\\n3. gutenberg.readingroo.ms\\n4. www.gutenberg.org"]',
    '        GutenbergFeeds["📦 Gutenberg Catalog Feeds (3 Mirrors)\\n(rdf-files.tar.bz2 & pg_catalog.csv.gz)"]',
    '        WikidataAPI["🌍 Wikidata SPARQL Endpoint\\n(https://query.wikidata.org/sparql)"]',
    '        VercelCacheAPI["🧹 Vercel Edge Cache Purge API\\n(api.vercel.com/v1/edge-cache/dangerously-delete-by-tags)"]',
    '        VercelRUM["📊 Vercel Edge Telemetry & Google Fonts\\n(vitals.vercel-insights.com • fonts.googleapis.com)"]',
    '    end',
    '',
    '    BrowserTier -->|"Anon JWT + RLS (7-Store Sync)"| SupaDB',
    '    BrowserTier -->|"Session / OAuth / Password Auth"| SupaAuth',
    '    BrowserTier -.->|"Cover Art (img-src HTTPS)"| GutenbergMirrors',
    '    BrowserTier -.->|"Cookie-less Web Vitals"| VercelRUM',
    '    EdgeTier -->|"Primary Catalog & FRBR Lookups"| SupaDB',
    '    EdgeTier -->|"PKCE / OTP Code Exchange"| SupaAuth',
    '    EdgeTier -->|"Anti-SSRF Validated Text Stream"| GutenbergMirrors',
    '    CLITier -->|"Bulk Upsert (Service Role / Anon)"| SupaDB',
    '    CLITier -->|"Weekly RDF + CSV Stream"| GutenbergFeeds',
    '    CLITier -->|"Weekly P2034/P407 FRBR Query"| WikidataAPI',
    '    CLITier -.->|"Post-Sync & Manual Tag Invalidation (VERCEL_API_TOKEN)"| VercelCacheAPI',
    '```',
    '',
    '### 2. External Integration Contracts, Timeouts & Security Matrix',
    '',
    '| External System / Endpoint | Initiating Layer | Protocol & Auth Mechanism | Timeout & Rate-Limit Policy | Security, Anti-SSRF & Policy Guardrails | Primary Adapter Module |',
    '| :--- | :--- | :--- | :--- | :--- | :--- |',
    '| **Supabase PostgREST (`https://*.supabase.co/rest/v1`)** | Browser Client, Edge Routes & CLI | HTTPS REST • `NEXT_PUBLIC_SUPABASE_ANON_KEY` (RLS JWT) or CLI `SUPABASE_SERVICE_ROLE_KEY` | 60s healthcheck TTL (`supabase-provider.ts`); CLI adaptive batch halving on `57014` | All 14 tables enforce `ENABLE ROW LEVEL SECURITY`; CSP `connect-src https://*.supabase.co`; `sanitizeSupabaseUrl` | [`src/lib/catalog/supabase-provider.ts`](src/lib/catalog/supabase-provider.ts), [`src/lib/supabase/client.ts`](src/lib/supabase/client.ts) |',
    '| **Supabase Auth & Turnstile (`https://*.supabase.co/auth/v1`, `challenges.cloudflare.com`)** | Browser Client, `src/proxy.ts` & `/auth/callback` | HTTPS PKCE Code Exchange, Token-Hash OTP & Turnstile `captchaToken` (`exchangeCodeForSession`, `verifyOtp`) | Document & `/account*` Edge SSR cookie refresh (`updateSession` with sanitized `User-Agent` forwarding & `bookarium-client-ip-sync` stamping on rotated tokens, bypassing public `rsc=1` & prefetch routes) + client `checkInitialUser` / `fetchProfile` coalescing + visible-tab (`60s`), `visibilitychange`, & `online` `verifyActiveSessionValidity` revocation checks; 60s email resend cooldown | Open-redirect sanitization (`sanitizeRedirectPath`, `resolveCanonicalAuthOrigin`, `stripRecoveryFromRedirectPath`); fail-closed JWT `amr` & single-use recovery verification (`verifyPasswordRecoverySession`, `isRecoverySessionAmrVerified`) + cross-device `recovery_cross_device` routing; browser IP/UA origin reconciliation (`reconcileClientSessionOrigin`); shared `TurnstileWidget` CAPTCHA (`AuthModal`, `EmailSentView` & `/account` recovery/resend) & Honeypot bot guard; OWASP current-password re-auth | [`src/app/auth/callback/route.ts`](src/app/auth/callback/route.ts), [`src/lib/auth-recovery.ts`](src/lib/auth-recovery.ts), [`src/components/auth/AuthModal.tsx`](src/components/auth/AuthModal.tsx), [`src/components/auth/TurnstileWidget.tsx`](src/components/auth/TurnstileWidget.tsx), [`src/lib/supabase/middleware.ts`](src/lib/supabase/middleware.ts), [`src/lib/supabase/server.ts`](src/lib/supabase/server.ts) |',
    '| **Project Gutenberg Mirrors (`aleph`, `pglaf`, `readingroo.ms`, `www.gutenberg.org`)** | `/api/books/content` | HTTPS GET Plain-Text & Binary Cover Stream (Mirror-First Prioritization ahead of `www.gutenberg.org`) | `8s–12s` per-mirror timeout; mode-scoped `globalThis` sliding-window limits (`bookContentRateLimiter` `30/min` text, `bookCoverRateLimiter` `60/min` cover, `bookCardRateLimiter` `20/min` OG card) | Zero-trust `url-validator.ts` (HTTPS-only, 4 allowlisted hostnames, max 3 redirect hops validated per hop, individual-only downloads) | [`src/app/api/books/content/route.ts`](src/app/api/books/content/route.ts), [`src/app/api/books/content/url-validator.ts`](src/app/api/books/content/url-validator.ts) |',
    '| **Gutenberg Catalog Archives (`rdf-files.tar.bz2` & `pg_catalog.csv.gz`)** | Node.js CLI & GitHub Actions (`catalog-sync.yml`) | HTTPS GET Streaming Bzip2/Gzip (`tar -xOjf -` + `zlib.createGunzip`, PGLAF-first across 3 allowlisted mirrors or pinned `--feed-source`) | Weekly Sunday `02:00 UTC` schedule + manual `feed_source`; 3-source failover + HTML outage rejection + `Content-Length`/non-zero `tar` truncation fail-closed guards | Allowlisted feed URLs (`isAllowedRdfFeedUrl`, `isAllowedCsvFeedUrl`, `resolveFeedMirrors`), wire `SHA-256` digest computation + `$GITHUB_STEP_SUMMARY` logging, `.sha256`-verified (`timingSafeEqual`) in-RAM `gutenberg-catalog-cache.json.gz` diffing, filters `Text` type only, extracts `<dcterms:rights>` (`copyright: true` for copyrighted PG notices) & 30-day `download_count`, computes `max_author_death_year`, and emits `quote-diff.json` | [`scripts/sync-gutenberg-catalog.js`](scripts/sync-gutenberg-catalog.js) |',
    '| **Wikidata SPARQL (`https://query.wikidata.org/sparql`)** | Node.js CLI & GitHub Actions (`catalog-sync.yml` Step 2 & on-demand `translations-sync.yml`) | HTTPS GET SPARQL JSON (`P2034` Gutenberg ID + `P407` Language) | Weekly Sunday `02:00 UTC` sequential pipeline (`catalog-sync.yml`) + manual `workflow_dispatch`; `30s` query timeout | 5 Pipeline Blockers & 7 Hardening Defenses; offline snapshot fallback (`scripts/data/wikidata-translations-cache.json`) | [`scripts/ingest-translations.js`](scripts/ingest-translations.js) |',
    '| **Vercel Edge Cache Purge API (`https://api.vercel.com/v1/edge-cache/dangerously-delete-by-tags`)** | GitHub Actions & Node.js CLI (`catalog-sync.yml`, `translations-sync.yml`, `quotes-sync.yml`, `cache-purge.yml`) | HTTPS POST JSON (`{ tags, target }`) • Bearer `VERCEL_API_TOKEN`, `?projectIdOrName=VERCEL_PROJECT_ID`, optional `&teamId=VERCEL_TEAM_ID` | Bounded retries (`0..5`, default `2`) on `429`/`5xx`/network faults honoring `Retry-After`; clean `exit 0` skip when secrets unset | Validated purge target (`production`/`preview`), trimmed deduplicated tags, secret-safe redacted error reporting, `$GITHUB_STEP_SUMMARY` ledger | [`scripts/purge-vercel-cache.js`](scripts/purge-vercel-cache.js) |',
    '| **Google Fonts & Vercel Edge Telemetry** | Root Layout (`src/app/layout.tsx`) | HTTPS Static CSS/WOFF2 & Cookie-Less Beacon (`@vercel/analytics`, `@vercel/speed-insights`) | Browser HTTP cache; non-blocking async beacon | Strictly scoped in `next.config.ts` CSP (`style-src`, `font-src`); zero tracking cookies (GDPR/COPPA compliant) | [`src/app/layout.tsx`](src/app/layout.tsx), [`next.config.ts`](next.config.ts) |',
    '',
    '---',
    '',
    '## 🛡️ Failure Modes, Circuit Breakers & Retry Topology',
    '',
    'Every network, storage, compute, and database dependency in Bookarium is protected by a multi-tier circuit breaker, fallback provider, or self-healing mechanism so the reading experience never crashes:',
    '',
    '### 1. Multi-Tier Failover & Self-Healing Decision Diagram',
    '',
    '```mermaid',
    'flowchart TD',
    '    subgraph CatalogResilience ["1. Catalog Search Resilience Cascade"]',
    '        CatReq["Catalog Query (/api/books)"] --> SupaHealth{"Supabase Configured &\\n60s Healthcheck OK?"}',
    '        SupaHealth -->|"Yes"| SupaQuery["Query public.books (GIN + B-Tree)"]',
    '        SupaHealth -->|"No / Unconfigured"| CuratedServer["Bundled Curated Fallback\\n(curated-fallback.ts • 27 Classics)"]',
    '        SupaQuery -->|"Transient DB Error"| DbError503["HTTP 503 No-Store Error Telemetry"]',
    '        DbError503 -->|"Navigator Offline"| OfflineCat["Adaptive Offline Catalog (useOfflineCatalogFallback.ts)\\nServes IndexedDB Volumes or CatalogOfflineView.tsx"]',
    '        CuratedServer -->|"Navigator Offline"| OfflineCat',
    '    end',
    '',
    '    subgraph ContentResilience ["2. Book Content Streaming Resilience Cascade"]',
    '        TxtReq["Open Volume (/read/[id])"] --> IDBCheck{"Cached in Browser\\nIndexedDB?"}',
    '        IDBCheck -->|"Hit (0ms)"| RenderReader["Render Instantaneously Offline"]',
    '        IDBCheck -->|"Miss"| Tier1Supa{"Tier 1: public.books.content\\nPresent in Supabase?"}',
    '        Tier1Supa -->|"Hit"| RenderReader',
    '        Tier1Supa -->|"Miss"| Mirror1["Tier 2A: aleph.gutenberg.org"]',
    '        Mirror1 -->|"Timeout / 404 / 5xx"| Mirror2["Tier 2B: gutenberg.pglaf.org"]',
    '        Mirror2 -->|"Timeout / 404 / 5xx"| Mirror3["Tier 2C: gutenberg.readingroo.ms"]',
    '        Mirror3 -->|"Timeout / 404 / 5xx"| Mirror4["Tier 2D: www.gutenberg.org"]',
    '        Mirror4 -->|"Success"| RenderReader',
    '    end',
    '',
    '    subgraph ComputeAndSync ["3. Worker Compute & Cloud Outbox Resilience"]',
    '        WorkerTask["Parse Gutenberg Plain Text"] --> WorkerAlive{"Web Worker Thread\\nAvailable?"}',
    '        WorkerAlive -->|"Yes"| OffThread["Off-Thread AST Segmentation (gutenberg.worker.ts)"]',
    '        WorkerAlive -->|"Crash / Unsupported"| MainThread["Chunked Async Main-Thread Fallback (setTimeout 0)"]',
    '    end',
    '',
    '    subgraph AuthResilience ["4. Password Recovery & Session Revocation Resilience"]',
    '        RecLink["Open Reset Link or /account?recovery=true"] --> PkceCheck{"Same-Device PKCE\\nVerifier Present?"}',
    '        PkceCheck -->|"Mismatch"| CrossNotice["/?auth_notice=recovery_cross_device\\nOpens AuthModal forgot_password"]',
    '        PkceCheck -->|"Session Verified"| AmrCheck{"verifyPasswordRecoverySession\\nSigned AMR + 3600s TTL + Unused?"}',
    '        AmrCheck -->|"Spoofed / Expired / Consumed"| StripRec["clearRecoveryParamInUrl &\\nEnforce Current Password"]',
    '        SessCheck["Visible Tab, Focus, Sync & Boot\\n(verifyActiveSessionValidity / verifyActiveCloudSession)"] --> SessState{"400/401/403 Revoked or\\nCleared Auth Cookie?"}',
    '        SessState -->|"Yes (Revoked or Cookie Cleared)"| LocalWipe["resetClientAuthState (PENDING_STORE_CLEANUP\\nPre-Null Store Wipe, Preserve offline_books)"]',
    '        SessState -->|"Offline or 5xx"| KeepSess["Preserve Local Session Until Online"]',
    '    end',
    '```',
    '',
    '### 2. Comprehensive Failure Mode, Degraded-State & Self-Healing Matrix',
    '',
    '| Failure Scenario / Fault Domain | Detection Mechanism | Circuit-Breaker / Retry Policy | Automatic Fallback / Self-Healing Action | User-Facing Experience |',
    '| :--- | :--- | :--- | :--- | :--- |',
    '| **1. Supabase Unconfigured or Temporarily Unhealthy** | `isSupabaseConfigured()` & 60s healthcheck in [`src/lib/catalog/supabase-provider.ts`](src/lib/catalog/supabase-provider.ts) | `60,000ms` healthcheck circuit-breaker TTL avoids repeated failing DB probes | Routes unconfigured `/api/books` searches cleanly to bundled [`src/lib/catalog/curated-fallback.ts`](src/lib/catalog/curated-fallback.ts) (`source: "cache"`, `no-store`) and fails closed with `HTTP 503` on transient configured DB outages | Zero-key environments browse curated classics without external dependencies; live outages report honest recoverable states. |',
    '| **2. `/api/books` Gateway Timeout or Transient `503`/`504`** | Abort/HTTP status telemetry in [`src/hooks/queries/useBooks.ts`](src/hooks/queries/useBooks.ts) | Bounded `15,000ms` `AbortController` + TanStack Query retry & `CatalogTelemetryBadge` error radar | Surfaces recoverable Retry state cleanly in `BookGrid` and degrades to IndexedDB volumes (`useOfflineCatalogFallback.ts`) when offline | Eliminates stale upstream errors, third-party outages, and silent data corruption while keeping cached reading uninterrupted. |',
    '| **3. Primary Gutenberg Mirror Down or Throttled** | Per-mirror `AbortController` timeout or non-200 status in [`src/app/api/books/content/route.ts`](src/app/api/books/content/route.ts) | Sequential 4-mirror cascade (`aleph` -> `pglaf` -> `readingroo.ms` -> `www.gutenberg.org`) | Validates each candidate & redirect hop via [`src/app/api/books/content/url-validator.ts`](src/app/api/books/content/url-validator.ts) until a clean `200 OK` text stream resolves | Book opens reliably even when individual Gutenberg mirrors undergo maintenance. |',
    '| **4. Missing or `"Anonymous"` Author Lifespans** | `isPlaceholderAuthor()` & `!hasVerifiedLifespans()` in [`src/lib/book-metadata.ts`](src/lib/book-metadata.ts) | 2-Tier server LRU ([`src/app/api/books/content/metadata-cache.ts`](src/app/api/books/content/metadata-cache.ts)) + client [`src/hooks/useCollectionAutoHeal.ts`](src/hooks/useCollectionAutoHeal.ts) | Resolves lifespans via Supabase -> `FEATURED_HERO_BOOKS` and back-fills IndexedDB (`patchOfflineBookAuthors`) & Zustand stores | Prevents false `HTTP 451` blocks and heals legacy saved/offline volumes automatically without external API calls. |',
    '| **5. Global & Jurisdictional Copyright Restriction (`HTTP 451`)** | `isBookPublicDomainInJurisdiction()` in [`src/lib/copyright-engine.ts`](src/lib/copyright-engine.ts) | Global `copyright === true` gate (US + non-US) plus deterministic Berne (`Life+70`, `Life+80`, `Life+100`, Art. 7bis, Art. 2(3)) evaluation | Blocks streaming and card/text delivery (`HTTP 451`), excludes `copyright: true` from catalog/quotes/translations, and renders `CopyrightNoticeBanner` on saved restricted works | Clear global/territorial legal notice with public-domain unlock year where applicable; personal collection citations keep titles/authors. |',
    `| **6. Complete Device Offline State (\`navigator.onLine = false\`)** | \`useSyncExternalStore\` in [\`src/hooks/useNetworkStatus.ts\`](src/hooks/useNetworkStatus.ts) & [\`public/sw.js\`](public/sw.js) | Instantaneous 0ms transition; Service Worker \`${swMeta.versionLabel}\` intercepts \`/read/*\` & App Shell routes | [\`src/hooks/useOfflineCatalogFallback.ts\`](src/hooks/useOfflineCatalogFallback.ts) serves IndexedDB volumes in Catalog; uncached books dim with \`Not Downloaded\` badges | Downloaded volumes read & search 100% offline; uncached triggers cleanly disable with clear offline guidance. |`,
    '| **7. Web Worker Initialization or Parse Error** | `worker.onerror` or `Worker === undefined` in [`src/hooks/reader/useGutenbergParserWorker.ts`](src/hooks/reader/useGutenbergParserWorker.ts) | Automatic fallback on worker construction failure or `PARSE_ERROR` message | Executes `parseGutenbergChapters` & `paginateChapterContent` asynchronously on main thread via `setTimeout(..., 0)` | Focus Reader segments chapters and renders pages smoothly even in restricted WebViews. |',
    '| **8. Font-Size or Viewport Reflow Shifting Bookmark Line** | `isBookmarkLayoutReady` & `resolveTextRowSpanInElement` in [`src/lib/reader-bookmark-geometry.ts`](src/lib/reader-bookmark-geometry.ts) | Canonical text-span matching (`findCanonicalTextSpan`) + binary-searched DOM `Range` client rects | Re-anchors `bookmarkRow` to the exact sentence (`bookmarkText`) across font sizes (`12px–36px`) and column widths | Reader silk bookmark and scroll position stay locked to the exact passage across devices and display tweaks. |',
    '| **9. Concurrent Multi-Tab, Strict-Mode Mount or Offline Cloud Sync Mutations** | `inFlightInitialUserCheck` + `coalesceInFlightByUser` (across `useAuthStore`, `sync-utils.ts`, and all individual store syncs) alongside `inFlightOutboxFlushes` & `inFlightCloudSyncs` in [`src/lib/bookshelf-cloud-sync.ts`](src/lib/bookshelf-cloud-sync.ts) | Per-user active Promise identity reuse (`p1 === p2`), mid-flight `dirty*Users` follow-up re-run tracking (retry-loop-safe), `lastSyncTimeRef` `15s` cooldown (`providers.tsx`), & `2,000ms` debounced LWW sync (`preferences-sync.ts`) | Deduplicates overlapping mounts/syncs, queues mutations in persistent `localStorage` outboxes with deletion tombstones, & replays cleanly on `online` | Zero duplicate Supabase `/user` or PostgREST bursts, zero duplicate shelf items, zero resurrected deleted books, and zero race-condition state flicker. |',
    '| **10. PostgreSQL Statement Timeout (`57014`) in CLI Sync** | Error code inspection in [`scripts/sync-gutenberg-catalog.js`](scripts/sync-gutenberg-catalog.js) & [`scripts/ingest-translations.js`](scripts/ingest-translations.js) | Sticky dynamic write chunk sizing (`100 -> 50 -> 25` rows) + recursive batch halving + exponential retry backoff (`1s, 2s, 4s`) | Verifies pre-retry DB state (`filterChangedOrNewBooks`), splits timed-out upsert batches in half, and falls back to `scripts/data/wikidata-translations-cache.json` if Wikidata is down | Weekly 78,000-book catalog and translation sync completes reliably on free-tier database instances. |',
    '| **11. Edge Quote Pool Gateway Unavailable (`GET /api/books?pool=quotes` -> `HTTP 503`)** | `!result` when `queryOptions.pool === "quotes"` in [`src/app/api/books/route.ts`](src/app/api/books/route.ts) & [`src/hooks/queries/useBooks.ts`](src/hooks/queries/useBooks.ts) | Returns `503` with `Cache-Control: no-store, max-age=0` (never falling back to unquoted fallback data or poisoning Edge CDN cache) | `fetchQuoteEnrichedBooks` cascades from Edge `/api/books?pool=quotes` -> Direct Client Supabase -> `localStorage` (`bookarium-quote-enriched-books-v1`) -> Static Curated Anthology (`FEATURED_HERO_BOOKS` & `LITERARY_QUOTES`) | 3D Hero Book, Classic of the Day, and Words That Shaped Humanity render authentic literary quotes with zero empty states or text swaps. |',
    '| **12. Cross-Device PKCE Reset Link or Spoofed / Expired / Replayed `?recovery=true`** | PKCE exchange error with `isRecoveryRedirectPath(next)` in [`src/app/auth/callback/route.ts`](src/app/auth/callback/route.ts) & [`src/lib/auth-recovery.ts`](src/lib/auth-recovery.ts) (`isRecoverySessionAmrVerified`, `readConsumedRecoverySentAt`) | Strict `3600s` recovery TTL + `10s` clock skew; single-use `bookarium-consumed-recovery` (`sessionStorage` + memory) check before honoring `recovery` | Routes PKCE misses to `/?auth_notice=recovery_cross_device` (opening `AuthModal` in `forgot_password`); `verifyPasswordRecoverySession()` refreshes `getUser()` and invokes `clearRecoveryParamInUrl` when unverified, expired, or consumed | Cross-device resets provide clear same-browser/resubmit guidance, while spoofed or stale `/account?recovery=true` tabs fail closed to `Current Password` re-auth. |',
    '| **13. Remotely Revoked Session, Cleared Auth Cookie, Interrupted Reload Cleanup, or AWS `18.x` IP Attribution** | [`src/stores/useAuthStore.ts`](src/stores/useAuthStore.ts) (`verifyActiveSessionValidity`, `verifyActiveCloudSession`, `resetClientAuthState` & `reconcileClientSessionOrigin`) + `STORAGE_KEYS.PENDING_STORE_CLEANUP` wired in [`src/app/providers.tsx`](src/app/providers.tsx), [`src/lib/sync-utils.ts`](src/lib/sync-utils.ts) & [`src/lib/supabase/middleware.ts`](src/lib/supabase/middleware.ts) | Coalesced `10,000ms` cooldown on `online`/`visible` focus and `60,000ms` visible-only interval (`verifyActiveSessionValidity`), pre-sync cookie check (`verifyActiveCloudSession`), & boot marker scan (`initializeAuth`) | Tears down local state atomically via coalesced `resetClientAuthState` (`scope: "local"`, finishing `clearLocalUserStores({ wipeDeviceStorage: false })` before committing `user: null`) on `400/401/403 session_not_found` or cleared cookies (`!session && !hasSupabaseAuthCookie()`), stamps/flushes `bookarium-pending-store-cleanup` on reload (preserving guest & offline `offline_books`), and reconciles `bookarium-client-ip-sync` (`maxAge=120`) + `sanitizeForwardedUserAgent` | Revoked sessions and expired/cleared auth cookies reset cleanly with zero stranded bookshelf/favorites/notes behind `user: null`, surviving offline drops & reloads while attributing real browser IP/UA cleanly. |',
    '| **14. Post-Sync Vercel Edge Cache Purge Transient Fault or Unset Secrets** | `parsePurgeCliArgs` & `purgeVercelEdgeCache` in [`scripts/purge-vercel-cache.js`](scripts/purge-vercel-cache.js) across `catalog-sync.yml`, `quotes-sync.yml`, `translations-sync.yml` & `cache-purge.yml` | Bounded retry backoff (`maxRetries: 2` default, `0..5`) on `429` (`Retry-After`), `5xx`, and network faults; secret-safe redacted error logging | Exits cleanly (`exit 0`) with a skip notice when `VERCEL_API_TOKEN` or `VERCEL_PROJECT_ID` are unset; writes summary tables to `$GITHUB_STEP_SUMMARY`; recovers selectively via manual `.github/workflows/cache-purge.yml` | Forks and keyless CI runs complete without errors, while live deployments invalidate stale Edge cache tags automatically or on demand. |',
    '',
    '---',
    '',
    '## 🚀 Deployment, Edge Caching & Operational Topology',
    '',
    '### 1. Edge Routing, Regional Compute Pinning (`iad1`) & Autonomous Cron Topology',
    '',
    '```mermaid',
    'flowchart TD',
    '    subgraph GlobalClients ["Global Reader Devices"]',
    '        Client["🌍 Browser / Installed PWA\\n(Desktop, Tablet, Mobile)"]',
    '    end',
    '',
    '    subgraph VercelEdgeNetwork ["Vercel Global Edge Network (PoPs Worldwide)"]',
    '        EdgeProxy["🛡️ src/proxy.ts & next.config.ts\\n• Geo-IP Extraction (x-vercel-ip-country)\\n• Clean Path Rewrites (/bookshelf, /favorites, /notebook, /bookmarks -> /)\\n• 7 Mandatory OWASP Security Headers & Production CSP"]',
    '        EdgeCDN["⚡ Vercel Edge CDN SWR Cache (Vercel-Cache-Tag: catalog, quotes, translations)\\n• /api/books?pool=quotes: max-age=3600, s-maxage=43200 (12h), swr=604800\\n• /api/books & /content (text/card): s-maxage=86400 (24h), swr=604800\\n• /api/books (ids), /translations & /content (cover): s-maxage=604800 (7d), swr=2592000"]',
    '    end',
    '',
    '    subgraph USCompute ["Pinned US-East Compute & Data Region (Washington D.C. — iad1)"]',
    '        Serverless["⚙️ Next.js Serverless Functions (vercel.json: iad1, maxDuration: 30s)\\n• /api/books, /api/books/content, /api/books/translations, /auth/callback\\n• In-Memory 24h Metadata LRU (1,000 entries), 20-Book Text LRU & Rate Limiters"]',
    `        SupabaseUS[("🗄️ Supabase PostgreSQL (Co-Located US-East)\\n• ${dbCatalog.tables.length} RLS Tables • ${dbCatalog.indexes.length} B-Tree/GIN Indexes • ${dbCatalog.functions.length} Stored Functions")]`,
    '        GutenbergUS["🏛️ Project Gutenberg Mirror Nodes (US-East Adjacent)"]',
    '    end',
    '',
    '    subgraph GitHubOps ["GitHub Actions Autonomous CI/CD & Data Operations"]',
    '        CIWorkflow["✅ .github/workflows/ci.yml\\n(Push / PR -> SHA-Pinned Node 22 -> 7-Gateway Quality Engine)"]',
    '        CodeQLWorkflow["🔎 .github/workflows/codeql.yml\\n(Push / PR / Mon 01:30 UTC -> JS/TS & Actions SARIF)"]',
    '        DepReviewWorkflow["🛡️ .github/workflows/dependency-review.yml\\n(PR -> High CVE & License Gate)"]',
    '        ReleaseWorkflow["🏷️ .github/workflows/release.yml\\n(Tag v* -> Verified GitHub Release)"]',
    '        CatalogCron["🕒 .github/workflows/catalog-sync.yml\\n(Sundays 02:00 UTC -> Catalog + Release Snapshot + Translations + Quotes + Edge Tag Purge)"]',
    '        TransCron["🎛️ .github/workflows/translations-sync.yml\\n(On-Demand workflow_dispatch -> ingest-translations.js + Edge Tag Purge)"]',
    '        QuotesCron["🎛️ .github/workflows/quotes-sync.yml\\n(On-Demand workflow_dispatch -> sync-featured-quotes.js + Edge Tag Purge)"]',
    '        PurgeManual["🧹 .github/workflows/cache-purge.yml\\n(Manual-Only workflow_dispatch -> Selective Tag Purge + Target)"]',
    '    end',
    '',
    '    Client --> EdgeProxy',
    '    EdgeProxy --> EdgeCDN',
    '    EdgeCDN -->|"Cache Miss / Revalidate"| Serverless',
    '    Serverless <-->|"<50ms Co-Located Query"| SupabaseUS',
    '    Serverless <-->|"Mirror Stream / Failover"| GutenbergUS',
    '    CatalogCron -->|"Upsert 78k+ Volumes, FRBR Clusters & Two-Tier Quotes"| SupabaseUS',
    '    CatalogCron -.->|"Purge Tags: catalog,quotes,translations"| EdgeCDN',
    '    TransCron -.->|"Manual workflow_dispatch Override"| SupabaseUS',
    '    TransCron -.->|"Purge Tag: translations"| EdgeCDN',
    '    QuotesCron -.->|"Manual workflow_dispatch Override"| SupabaseUS',
    '    QuotesCron -.->|"Purge Tag: quotes"| EdgeCDN',
    '    PurgeManual -.->|"Selective Purge (catalog / quotes / translations)"| EdgeCDN',
    '```',
    '',
    '### 2. Multi-Tier Caching, Supabase Egress Shielding & Gutenberg Mirror Cover/Text Waterfall',
    '',
    '```mermaid',
    'flowchart TD',
    '    subgraph L1_L2_Client ["L1 & L2: Browser Memory, LocalStorage & IndexedDB"]',
    '        L1Query["L1: TanStack Query & Virtual Page LRU\\n• Windowed Sub-Pages (8/16 books in 0ms)\\n• 500-Entry Paginated Chapter Slice Cache"]',
    '        L2Local["L2A: localStorage Persistent Caches\\n• bookarium-quote-enriched-books-v1 (48-book 2-spread pool • 12h TTL)\\n• bookarium-extracted-passages-v1 (100-book dynamic quotes • 30d LRU)"]',
    `        L2IDB["L2B: IndexedDB (BookariumOfflineDB v2) & SW (${swMeta.cacheName})\\n• offline_books + cover_cache LRU (300 covers / 30d TTL)\\n• 0ms SPA Memory Cache + Local SSD Cover Lookup Before Mirrors"]`,
    '    end',
    '',
    '    subgraph L3_VercelEdge ["L3: Vercel Global Edge CDN & Image Optimizer"]',
    '        EdgeQuotePool["GET /api/books?pool=quotes\\n• max-age=3600, s-maxage=43200 (12h), swr=604800\\n• Vercel-Cache-Tag: quotes (purged on sync)\\n• Vary: Accept-Encoding (Global Shared) • ~44 KB/day Egress"]',
    '        EdgeCatalog["GET /api/books (11-Col Catalog)\\n• max-age=300, s-maxage=86400 (24h), swr=604800\\n• Vercel-Cache-Tag: catalog or catalog,quotes\\n• Vary: x-vercel-ip-country, cf-ipcountry, x-bookarium-country, Accept-Encoding"]',
    '        EdgeDeepQuotes["GET /api/books?ids=...&has_quotes=true\\n• max-age=86400, s-maxage=604800 (7d), swr=2592000\\n• Vercel-Cache-Tag: catalog,quotes • Vary: Accept-Encoding • ~99% Edge Hit Rate"]',
    '        EdgeTranslations["GET /api/books/translations\\n• max-age=86400, s-maxage=604800 (7d), swr=2592000\\n• Vercel-Cache-Tag: translations • Vary: x-vercel-ip-country"]',
    '        EdgeTextCard["GET /api/books/content (Text & type=card OG)\\n• max-age=86400, s-maxage=86400 (24h), swr=604800\\n• Vary: x-vercel-ip-country, Accept-Encoding"]',
    '        EdgeCoverProxy["GET /api/books/content?type=cover & Next.js <Image>\\n• max-age=604800, s-maxage=604800 (7d), swr=2592000\\n• Vary: Accept-Encoding (Global Shared) • Metadata lookup bypassed"]',
    '    end',
    '',
    '    subgraph L4_Serverless ["L4: Pinned US-East (iad1) Serverless / globalThis Caches"]',
    '        MetaLRU["metadata-cache.ts (globalThis LRU)\\n• 24h TTL / 1,000-Book Lifespan LRU (pre-warmed on catalog reads)\\n• Jurisdictional HTTP 451 Gatekeeper (text & type=card)"]',
    '        TextLRU["bookContentLruCache & inFlightMirrorFetches (globalThis)\\n• 24h TTL / 20-Book Text LRU (<= 1.8M chars)\\n• Concurrent Mirror Promise Coalescing"]',
    '        HealthCache["supabase-provider.ts (globalThis Query & Health Cache)\\n• 5m / 64-Query Catalog Response Cache + 60s Healthcheck\\n• HTTP 503 no-store anti-poisoning guard"]',
    '        SsrRouteCaches["SSR Layout Route Caches (reader-layout & profile-layout utils)\\n• confirmedNotFoundIds (500-Entry LRU for safe Reader noindex)\\n• serverProfileCache (5m TTL / 500-Entry Public Handle LRU)"]',
    '    end',
    '',
    '    subgraph L5_Origins ["L5: Primary Origins (Supabase PostgreSQL & 4 Gutenberg Mirrors)"]',
    `        SupaOrigin[("🗄️ Supabase PostgreSQL (public.books & book_translations)\\n• (select auth.uid()) InitPlan RLS & ${dbCatalog.indexes.length} B-Tree/GIN Indexes\\n• PostgREST quote0:quotes->0, quote1:quotes->1 Slicing")]`,
    '        MirrorOrigin["🏛️ 4 Allowlisted Project Gutenberg Mirrors\\n1. aleph.gutenberg.org • 2. gutenberg.pglaf.org\\n3. gutenberg.readingroo.ms • 4. www.gutenberg.org"]',
    '    end',
    '',
    '    L1Query -->|"Miss"| L2Local',
    '    L1Query -->|"Offline / Saved"| L2IDB',
    '    L2Local -->|"12h Expired"| EdgeQuotePool',
    '    L1Query -->|"Catalog Search"| EdgeCatalog',
    '    L1Query -->|"Open 3D Book / Preview"| EdgeDeepQuotes',
    '    L1Query -->|"Language / Editions"| EdgeTranslations',
    '    L1Query -.->|"SSR Route Nav (/read/[id], /u/[username])"| SsrRouteCaches',
    '    SsrRouteCaches -->|"ISR 24h / Profile Cache Miss"| SupaOrigin',
    '    L2IDB -->|"Uncached Text"| EdgeTextCard',
    '    L2IDB -->|"Uncached Cover"| EdgeCoverProxy',
    '    EdgeQuotePool -->|"Miss (2x/day Global)"| HealthCache',
    '    EdgeCatalog -->|"Miss (24h per Query)"| HealthCache',
    '    EdgeDeepQuotes -->|"Miss (7d per Book)"| HealthCache',
    '    EdgeTranslations -->|"Miss (7d per Work)"| HealthCache',
    '    HealthCache --> SupaOrigin',
    '    EdgeTextCard -->|"Miss"| MetaLRU',
    '    MetaLRU --> TextLRU',
    '    TextLRU -->|"Tier 1: public.books.content"| SupaOrigin',
    '    TextLRU -->|"Tier 2: 4-Mirror Waterfall"| MirrorOrigin',
    '    EdgeCoverProxy -->|"Miss (7d per Cover)"| MirrorOrigin',
    '```',
    '',
    '### 3. 5-Layer Caching & TTL Hierarchy Matrix',
    '',
    '| Cache Layer | Storage / Execution Location | Cached Artifacts & Scope | TTL & Eviction Policy | Partitioning & Consistency Key |',
    '| :--- | :--- | :--- | :--- | :--- |',
    '| **L1: Browser In-Memory** | TanStack React Query v5 (`QueryClient`) & `pagination.ts` | Windowed catalog sub-pages, predictive next-page prefetches, translations, and paginated chapter slices | Session memory (`staleTime` + `clearPaginationCache()`) | Query keys scoped by `[search, topic, language, era, sort, page, country]` |',
    `| **L2: Browser Persistent** | \`localStorage\` (10 stores + \`bookarium-quote-enriched-books-v1\` + \`bookarium-extracted-passages-v1\`), \`IndexedDB\` (\`BookariumOfflineDB\` v2: \`offline_books\` + \`cover_cache\`), \`CacheStorage\` (\`${swMeta.cacheName}\`) | User collections/outboxes, 48-volume (\`DEFAULT_QUOTE_POOL_LIMIT = 48\`) rotating quote pool (\`12h\` fresh), 30-day LRU extracted book passages (\`100\` books max), unabridged offline book texts + mirror-agnostic cover LRU (\`300\` covers max, \`30d\` TTL via \`offline-storage.ts\`), and PWA App Shell (\`${swMeta.cacheName}\`) | Persistent across restarts; \`30d\` TTL / \`100\` passage & \`300\` cover LRU bounds; SW \`activate\` prunes old caches | Origin-locked; IndexedDB texts verified against active jurisdiction on read |`,
    '| **L3: Vercel Edge CDN** | Global Edge PoP HTTP Cache (`Cache-Control` & `Vercel-Cache-Tag`) | `GET /api/books` (`max-age=300, s-maxage=86400, swr=604800`, tag `catalog`/`catalog,quotes`; `max-age=3600, s-maxage=43200, swr=604800` `?pool=quotes`, tag `quotes`; `max-age=86400, s-maxage=604800, swr=2592000` `?ids=...&has_quotes=true` tag `catalog,quotes` & `include_restricted_metadata=true` tag `catalog`); `GET /api/books/content` (`max-age=86400, s-maxage=86400` text/`type=card`; `max-age=604800, s-maxage=604800` `type=cover`) & `/translations` (`max-age=86400, s-maxage=604800, swr=2592000`, tag `translations`) | 12h fresh (Quote Pool); 24h fresh / 7d SWR (Catalog & Content); 7d browser+Edge / 30d SWR (Covers, Quote IDs & Translations); instant CI `dangerously-delete-by-tags` purge | `Vary: Accept-Encoding` (Global Quote Pool, Restricted-Metadata & `type=cover` Lookups) / `Vary: x-vercel-ip-country` (`/translations`) / `Vary: x-vercel-ip-country, cf-ipcountry, x-bookarium-country, Accept-Encoding` (Catalog) / `Vary: x-vercel-ip-country, Accept-Encoding` (`/content` text & OG cards) |',
    '| **L4: Serverless & `globalThis` Caches** | Node.js Serverless Instance (`iad1`) | Contributor lifespans ([`src/app/api/books/content/metadata-cache.ts`](src/app/api/books/content/metadata-cache.ts), pre-warmed by `supabase-provider.ts`), 20-book text LRU & in-flight mirror coalescing ([`src/app/api/books/content/route.ts`](src/app/api/books/content/route.ts)), 5m / 64-query catalog response cache & 60s healthcheck (`supabase-provider.ts`), `/read/[id]` ISR metadata & `confirmedNotFoundIds` ([`src/app/read/[id]/reader-layout-utils.ts`](src/app/read/[id]/reader-layout-utils.ts)), and `/u/[username]` public handle `serverProfileCache` ([`src/app/u/[username]/profile-layout-utils.ts`](src/app/u/[username]/profile-layout-utils.ts)) | `5m` / `64` queries (Catalog Query Cache); `5m` / `500` max entries (`serverProfileCache`); `500` max entries LRU (`confirmedNotFoundIds`); `24h` / `1,000` max entries (Metadata LRU); `24h` / `20` max books `<= 1.8M` chars (`bookContentLruCache`); `60s` TTL (Healthcheck); `24h` ISR (`/read/[id]`) | Keyed by normalized query options, Gutenberg `bookId`, or normalized lowercase `@username` |',
    `| **L5: Database & Repo Seeds** | Supabase PostgreSQL & \`supabase/seed_*.sql\` | \`78,000+\` catalog rows (\`public.books\`), Two-Tier Bounded Quote Pool (\`<= 564\` books in \`public.books.quotes\`), FRBR clusters (\`public.book_translations\`), and offline Wikidata cache | Updated weekly/periodically by GitHub Actions cron workflows | Indexed by ${dbCatalog.indexes.length} explicit B-Tree & GIN \`search_vector\` indexes |`,
    '',
    '### 4. Runtime Performance Budgets, Thresholds & Hardware-Tier Adaptation Matrix',
    '',
    '| Subsystem / Parameter | Configured Threshold / Budget | Governing Module | Architectural Rationale |',
    '| :--- | :--- | :--- | :--- |',
    '| **Hardware Performance Tiers (`high` / `medium` / `low`)** | `high`: >=8 cores & >=8GB RAM; `low`: `prefers-reduced-motion` or <=2 cores | [`src/hooks/usePerformanceTier.ts`](src/hooks/usePerformanceTier.ts) | Scales 3D cover animations, navbar underline physics, and transition complexity to guarantee 60fps across devices. |',
    '| **Virtual Page Density** | `5,600 chars/page` (scaled dynamically by `fontSize` & `lineHeight`) | [`src/lib/gutenberg/pagination.ts`](src/lib/gutenberg/pagination.ts) | Prevents DOM bloat on 1,200-page masterworks by rendering only the active virtual page spread in `Paginated` mode. |',
    '| **Reading Streak & Idle Immersion Guard** | `5 minutes` daily threshold • `120,000ms` (2-min) visual idle cutoff (bypassed during active TTS) | [`src/hooks/useReadingTimer.ts`](src/hooks/useReadingTimer.ts), [`src/hooks/reader/useReaderHabitTelemetry.ts`](src/hooks/reader/useReaderHabitTelemetry.ts), [`src/lib/reading-analytics.ts`](src/lib/reading-analytics.ts) | Ensures reading streaks reflect genuine literary immersion while accurately crediting hands-free Read-Aloud listening. |',
    '| **Tactile Spine Tap Choreography** | `120ms` micro-lead elevation (`translate-y-0 scale-105 origin-bottom`) before modal mount | [`src/components/presentation/BookshelfRack.tsx`](src/components/presentation/BookshelfRack.tsx), [`src/components/presentation/bookshelf/BookshelfSpine.tsx`](src/components/presentation/bookshelf/BookshelfSpine.tsx) | Allows the user to visually witness the volume drawing forward from the wooden shelf rail on touch devices with 1:1 hover parity. |',
    '| **Universal Ambient Dock Inactivity Idle Dimming** | `1,600ms` scroll/touch idle timeout -> `opacity-30 hover:opacity-100 focus-within:opacity-100` (<`180ms` wake) | [`src/components/presentation/CollectionBottomDock.tsx`](src/components/presentation/CollectionBottomDock.tsx), [`src/components/presentation/StickyCatalogToolbar.tsx`](src/components/presentation/StickyCatalogToolbar.tsx) | Keeps navigation controls 1 tap away across all screen sizes and page heights while resting unobtrusively without blocking reading real estate. |',
    '| **Catalog Filter Bar Flush Viewport Docking** | Exact `123px` (`7.6875rem`) clearance: `65px` (Navbar) + `(100dvh - 123px)` (Hero) + `58px` (Toolbar) = `100dvh` | [`src/components/presentation/HeroSearch.tsx`](src/components/presentation/HeroSearch.tsx), [`src/components/presentation/StickyCatalogToolbar.tsx`](src/components/presentation/StickyCatalogToolbar.tsx) | Guarantees the catalog filter bar sits 100% flush on the bottom viewport fold without clipping or detached gaps across desktop and tablet viewports. |',
    '| **Tactile Multi-Touch Zoom Prevention** | Non-passive `{ passive: false }` 2-finger `touchmove` & WebKit `gesturestart` `preventDefault()` | [`src/hooks/reader/useReaderGestures.ts`](src/hooks/reader/useReaderGestures.ts), [`src/components/reader/ReaderSurface.tsx`](src/components/reader/ReaderSurface.tsx) | Disambiguates in-app tactile typography zoom gestures from native browser canvas magnification on tactile screens. |',
    '| **Global Stylized Cursor Tooltip Delay** | `300ms` hover delay (`0ms` instant on Favorite/Bookshelf action buttons) | [`src/hooks/useCursorTooltip.ts`](src/hooks/useCursorTooltip.ts), [`src/components/ui/CursorTooltip.tsx`](src/components/ui/CursorTooltip.tsx) | Eliminates accidental tooltip flicker during normal mouse traversal while providing instant feedback on primary actions. |',
    '| **Debounced Cloud Sync Coalescing** | `2,000ms` debounce window (`reading_progress` & `profiles.preferences` JSONB) | [`src/stores/useReaderStore.ts`](src/stores/useReaderStore.ts), [`src/lib/preferences-sync.ts`](src/lib/preferences-sync.ts) | Prevents rapid page flips or slider drags from flooding Supabase PostgREST while preserving Last-Write-Wins accuracy. |',
    '| **API Sliding-Window Rate Limiters (`globalThis`)** | `booksApiRateLimiter`: `60 req/min` (`/api/books`, `/api/books/translations`) • `bookContentRateLimiter`: `30 req/min` (text) • `bookCardRateLimiter`: `20 req/min` (`type=card`) • `bookCoverRateLimiter`: `60 req/min` (`type=cover`) + companion Vercel WAF IP rules | [`src/lib/rate-limiter.ts`](src/lib/rate-limiter.ts), [`src/app/api/books/content/route.ts`](src/app/api/books/content/route.ts) | Mode-scoped `globalThis` buckets protect serverless compute and Project Gutenberg mirrors from scraping or OG compute abuse without starving text readers during cover/card bursts (keeping Vercel Attack Challenge Mode off). |',
    '',
    '---',
    '',
    '## 🔐 Environment Variable, Config & Security Trust-Zone Dependency Map',
    '',
    '### 1. AST-Extracted Environment Variable Binding Matrix (`.env.example` <-> Codebase AST)',
    '',
    'Programmatically extracted from [`.env.example`](.env.example) (variable names only — zero secret values) and cross-referenced via Babel AST against all consuming modules in `src/`, `next.config.ts`, `scripts/`, and `.github/workflows/`:',
    '',
    '| Environment Variable | Exposure & Security Scope | Unconfigured / Zero-API-Key Fallback Behavior | Architectural Purpose | AST-Verified Consuming Modules |',
    '| :--- | :--- | :--- | :--- | :--- |'
  );

  for (const envItem of envCatalog) {
    const consumersFormatted =
      envItem.consumers.length > 0
        ? envItem.consumers.map((c) => `[\`${c}\`](${c})`).join(', ')
        : '_Template / Runtime Environment_';
    lines.push(
      `| **\`${envItem.name}\`** | ${envItem.scope} | ${envItem.fallback} | ${envItem.purpose} | ${consumersFormatted} |`
    );
  }

  lines.push(
    '',
    '### 2. Security Trust Zones & Intra-Procedural Request-Taint Topology (`Sources -> Sanitizers -> Sinks`)',
    '',
    'Enforced continuously by [`scripts/eslint-rules/bookarium-security.js`](scripts/eslint-rules/bookarium-security.js) (`Pass 0.75` & `Pass 6`) and [`scripts/verify-build.js`](scripts/verify-build.js) (`Pass 0.5`):',
    '',
    '| Untrusted Input Source (Taint Origin) | Trust Boundary Transition | Canonical Sanitizer / Validator Module | Enforced Security Invariants | Protected Downstream Sink |',
    '| :--- | :--- | :--- | :--- | :--- |',
    '| **Public API Query Params, Format URLs & Service Worker `CACHE_URLS`** | Browser / Edge -> `/api/books/**` & `public/sw.js` | [`src/lib/api-utils.ts`](src/lib/api-utils.ts) (`hasUnexpectedQueryParams`, `buildApiSecurityHeaders`, `isHttpsRequest`), [`src/lib/catalog/query-parser.ts`](src/lib/catalog/query-parser.ts) (`parseCatalogQuery`), [`src/lib/utils.ts`](src/lib/utils.ts) (`sanitizeBookFormatUrl`) & [`public/sw.js`](public/sw.js) (`sanitizePrecacheUrl`) | Strict per-route allowlists (`400 no-store`), `https:`-only format links (optional `blob:` on `coverImage`), same-origin non-`/auth/`/non-`/api/` bounded `CACHE_URLS` (`<= 100`), `CORP` & `copyright=false` | `SupabaseCatalogProvider`, `DownloadDrawer`, `CACHE_NAME` & `next/og` |',
    '| **Upstream Mirror URL & Redirect Hops (`?url=`, `Location` header)** | `/api/books/content` -> External Mirror | [`src/app/api/books/content/url-validator.ts`](src/app/api/books/content/url-validator.ts) (`isSafeUpstreamUrl`, `sanitizeUpstreamUrl`) | Strictly `https:` protocol, zero credentials/ports, 4 allowlisted Gutenberg domains, re-validated on every `301`/`302` redirect hop (max 3) | Server `fetch()` in `/api/books/content` |',
    '| **Auth Callback & Client Navigation Redirect (`?next=`, `origin`, `x-forwarded-host`, `?recovery=`, `document.referrer`)** | External OAuth / Magic Link / Recovery / Client Query -> `/auth/callback`, `/account` & `router.push`/`replace` | [`src/lib/redirect-sanitizer.ts`](src/lib/redirect-sanitizer.ts) (`sanitizeRedirectPath`, `resolveCanonicalAuthOrigin`, `isRecoveryRedirectPath`, `stripRecoveryFromRedirectPath`), [`src/lib/auth-recovery.ts`](src/lib/auth-recovery.ts) (`isRecoverySessionAmrVerified`) & [`scripts/eslint-rules/bookarium-security.js`](scripts/eslint-rules/bookarium-security.js) (`no-tainted-request-sink`) | Rejects `//`, `http:`, `javascript:`, backslash tricks, and foreign hosts; locks non-local redirect origins to `SITE_CONFIG.SITE_URL` (`NEXT_PUBLIC_SITE_URL` -> normalized `VERCEL_PROJECT_PRODUCTION_URL` fallback); tracks client `useSearchParams()` / `document.referrer` into `router.push()`/`replace()` (exempting static `/path` & `ROUTES.*` prefixes); strips `?recovery=true` on non-recovery flows and enforces JWT `amr` + `3600s` TTL + single-use consumption | `NextResponse.redirect()` in `/auth/callback`, client `useRouter()` navigation, & `AccountSecuritySection` password update mode |',
    '| **Forwarded Browser `User-Agent` Header (`req.headers.get("user-agent")`)** | Incoming HTTP Request -> SSR Auth Client & Edge Refresh | [`src/lib/supabase/client.ts`](src/lib/supabase/client.ts) (`sanitizeForwardedUserAgent`) | Strips CR/LF/control header-injection characters, trims whitespace, and clamps strings to `512` chars (`undefined` if empty) without importing `next/headers` into Edge middleware | Outbound `User-Agent` headers in `src/lib/supabase/server.ts`, `middleware.ts`, & `/auth/callback` |',
    '| **Persisted Cloud Preferences & Dynamic Object Keys (`profiles.preferences`)** | Cloud / Local Storage -> Client State Hydration | [`src/lib/preferences-sync.ts`](src/lib/preferences-sync.ts) (`normalizePreferencesSnapshot`) & [`scripts/eslint-rules/bookarium-security.js`](scripts/eslint-rules/bookarium-security.js) (`no-tainted-request-sink`) | Strict 13-key schema normalization, finite range clamping, and prototype-pollution key rejection (`__proto__`, `constructor`, `prototype`) | Zustand Stores (`usePreferencesStore`, `useReaderStore`, `useThemeStore`) |',
    '| **Privileged Server Credentials (`SUPABASE_SERVICE_ROLE_KEY`)** | Node.js CLI / CI -> Client Bundle Guard | [`scripts/verify-build.js`](scripts/verify-build.js) (`Pass 0.5`) & `no-client-server-boundary-violation` | Transitive Babel AST import graph verifies zero `src/lib/supabase/server` or `SUPABASE_SERVICE_ROLE_KEY` references in `"use client"` graph | Isolated strictly to `scripts/*.js` CLI pipelines |',
    '| **Fellowship Participant Mutations & Handle Lookup (`reader_circles`, `symposium_sessions`)** | Direct Client PostgREST -> Supabase DB | [`supabase/schema.sql`](supabase/schema.sql) (`enforce_fellowship_update_guard`, `lookup_scholar_by_username`, payload `CHECK` constraints) | Locks relational keys, acceptance authority, and opposite-participant progress/identity columns; revokes trigger RPC execution; bounds `@username` lookups to `1..64` chars and clamps text/array lengths | `public.reader_circles`, `public.symposium_sessions`, `public.profiles` |',
    '',
    '### 3. Authentication, Password Recovery, Session Revocation & Origin Security Flow',
    '',
    '```mermaid',
    'flowchart TD',
    '    subgraph EdgeAuthGate ["1. Edge Proxy & SSR Refresh Isolation (src/proxy.ts • middleware.ts)"]',
    '        AuthProxy["🛡️ src/proxy.ts (shouldSkipSessionRefresh)\\n• Skips /api/books*, /auth/*, /sw.js & Router Prefetches\\n• Bypasses Public rsc: 1 Navigations Outside /account*"]',
    '        AuthUpdate["🔄 updateSession (src/lib/supabase/middleware.ts)\\n• Blocks Raced Empty Cookie Deletions (Max-Age=0 Guard)\\n• Forwards Sanitized UA & Stamps bookarium-client-ip-sync (120s)"]',
    '    end',
    '',
    '    subgraph CallbackAndRecovery ["2. Auth Callback, Bot Defense & Fail-Closed Recovery"]',
    '        AuthBot["🤖 AuthModal, EmailSentView & Account\\n• Managed TurnstileWidget (single-use captchaToken)\\n• Off-Screen website_url Honeypot Field"]',
    '        AuthCallback["🔑 GET /auth/callback/route.ts\\n• verifyOtp / exchangeCodeForSession\\n• resolveCanonicalAuthOrigin + sanitizeRedirectPath\\n• Strips ?recovery=true on Non-Recovery Logins\\n• Stamps AUTH_HINT + Conditional CLIENT_IP_SYNC"]',
    '        AuthRecovery["🔒 src/lib/auth-recovery.ts (Fail-Closed)\\n• isRecoverySessionAmrVerified (Signed JWT amr + 3600s TTL)\\n• bookarium-consumed-recovery Single-Use Marker\\n• Cross-Device PKCE -> recovery_cross_device / email_verified\\n• Unverified Fallback -> clearRecoveryParamInUrl + Current Password"]',
    '    end',
    '',
    '    subgraph SessionLifecycle ["3. Active Session Verification, Revocation & Crash-Safe Teardown"]',
    '        AuthSessionGuard["⚡ useAuthStore & providers.tsx\\n• verifyActiveSessionValidity (60s Visible Poll / 10s Cooldown)\\n• verifyActiveCloudSession Pre-Sync Auth Cookie Guard\\n• reconcileClientSessionOrigin (Re-attributes AWS 18.x IP/UA)"]',
    '        AuthDeviceSync["📡 useAccountSecurityActions & Supabase RPCs\\n• public.get_active_sessions() & revoke_user_session()\\n• BroadcastChannel: bookarium-sessions-sync\\n• CustomEvent: bookarium:auth-token-refreshed"]',
    '        AuthTeardown["🧹 Atomic Teardown & Rule 9 Account Deletion\\n• resetClientAuthState (PENDING_STORE_CLEANUP Pre-Null Wipe)\\n• Standard Sign-Out / Revoke -> Scope local, Keeps offline_books\\n• delete_current_user() -> 11 Tables + storage.objects + Full Wipe"]',
    '    end',
    '',
    '    AuthProxy -->|"Document & /account Requests With sb-*"| AuthUpdate',
    '    AuthBot -->|"Sign-In / Sign-Up / Reset / Resend"| AuthCallback',
    '    AuthUpdate -->|"Rotated Cookie + 120s IP Sync"| AuthSessionGuard',
    '    AuthCallback -->|"Recovery OTP / PKCE"| AuthRecovery',
    '    AuthCallback -->|"Authenticated Session"| AuthSessionGuard',
    '    AuthRecovery -.->|"Strips Spoofed/Expired Recovery"| AuthSessionGuard',
    '    AuthSessionGuard <-->|"Inspect / Revoke Device Sessions"| AuthDeviceSync',
    '    AuthSessionGuard -->|"400/401/403 Revoked or Cleared Cookie"| AuthTeardown',
    '    AuthDeviceSync -->|"Sibling Tab Revocation / Token Refresh"| AuthSessionGuard',
    '```',
    '',
    '---',
    '',
    '## 🤝 Literary Fellowship, Symposium Pacts & Marginalia Guard Topology',
    '',
    '### 1. Reader Circles, Symposium Lifecycle, Fellow Marginalia & Trigger Guards',
    '',
    '```mermaid',
    'flowchart TD',
    '    subgraph FellowshipDiscovery ["1. Discovery, Invitations & Private-Profile Anti-Enumeration"]',
    '        FelUI["🏛️ AccountSymposiumSection & AccountPublicProfileSection\\n• FellowshipInvitations, ReaderCircle & SymposiumPacts SubTabs\\n• Handle Invites + Public Sanctuary Visibility Toggle"]',
    '        FelLookup["🔎 public.lookup_scholar_by_username() RPC\\n• Authenticated-Only Security Definer (SET search_path = \'\')\\n• 1..64 Char Input Bounds -> id, username, display_name"]',
    '        FelProfileLRU["🌐 /u/[username] (profile-layout-utils.ts)\\n• 5m TTL / 500-Entry serverProfileCache LRU + ILIKE Escape\\n• Collapses Private & Missing Handles -> private_or_missing"]',
    '    end',
    '',
    '    subgraph DualStoreOrchestration ["2. Dual-Store Identity Healing & Marginalia Reconciliation"]',
    '        FelStores["🤝 useFellowshipStore & fellowship-cloud-sync.ts\\n• circles, symposiums & pendingSymposiumProgress Outbox\\n• isPlaceholderUsername & healProfileIdentity Guards\\n• 15,000ms Cooldown + coalesceInFlightByUser"]',
    '        FelAnnot["🔖 useAnnotationStore & annotation-cloud-sync.ts\\n• buildFellowScholarsMap & resolveFellowIdentityMap\\n• reconcileFellowAnnotationsWithSymposiums & Prune\\n• ReaderAnnotationsDrawer + Spoiler Shield Isolation"]',
    '    end',
    '',
    '    subgraph DatabaseGuards ["3. PostgreSQL Row Triggers & Scoped Marginalia RLS"]',
    '        FelTriggers["🛡️ BEFORE UPDATE Triggers & Sync (supabase/schema.sql)\\n• handle_profile_identity_sync -> Cascades Handle Updates\\n• enforce_fellowship_update_guard -> Locks Immutable Keys,\\n  Recipient-Only Accept & Opposing Progress/Book Title\\n• Permits Nested Trigger Sync (pg_trigger_depth > 1)"]',
    '        FelRLS[("🗄️ RLS Tables & Erasure Cascade\\n• reader_circles & symposium_sessions (Participant Policy)\\n• user_annotations SELECT Policy (active / completed Match)\\n• delete_current_user() + ON DELETE CASCADE Purge")]',
    '    end',
    '',
    '    FelUI -->|"Invite by Handle"| FelLookup',
    '    FelUI -->|"Public Sanctuary Toggle"| FelProfileLRU',
    '    FelLookup -->|"Verified Minimal Identity"| FelStores',
    '    FelStores <-->|"Upsert Progress & Identity Sync"| FelTriggers',
    '    FelTriggers -->|"Enforced Mutations"| FelRLS',
    '    FelStores -->|"Symposium Active / Ended Events"| FelAnnot',
    '    FelAnnot <-->|"Scoped Fellow Highlight SELECT"| FelRLS',
    '```',
    '',
    '---',
    '',
    '## 🟢 Node.js Runtime, Dependency Stack & Supply-Chain Governance',
    ''
  );

  const nodeEcosystem = extractNodeEcosystemCatalog(rootDir, testHarness.totalSuites);
  lines.push(
    `Bookarium executes on **Node.js \`${nodeEcosystem.engines.node || '>=22.0.0'}\`** with **npm \`${nodeEcosystem.engines.npm || '>=10.0.0'}\`** (Node 22 LTS / Node 24 LTS recommended). All dependency versions are programmatically synchronized from \`package.json\` via AST compilation (Rule 2):`,
    '',
    '| Package | Live Version | Classification & Tier | Architectural Responsibility in Bookarium |',
    '| :--- | :--- | :--- | :--- |'
  );

  for (const pkg of nodeEcosystem.packages) {
    lines.push(`| **\`${pkg.name}\`** | \`${pkg.version}\` | ${pkg.tier} | ${pkg.purpose} |`);
  }

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
    '| **Pass 0.5** | Secrets, File/Path, AST Env & Transitive Graph Scanner | Secret regex, JWT decoder, `.env.example` & Babel AST env/client-privilege/import-graph analyzers | Zero live keys/JWTs, forbidden files, undocumented bracket/destructured/aliased `process.env.*` vars, client `SUPABASE_SERVICE_ROLE_KEY`, or transitive client->server imports |',
    `| **Pass 0.75** | 7-Pillar SAST, Lockfile, Workflow & Full AST Suite | Lockfile SRI/registry/GPL-AGPL license check, SHA-pinned/permissions workflow scanner, \`npm audit\`, ${getSecurityPluginRuleCount()}-rule AST taint engine, SQL RLS, plus \`sast-validators.js\` Babel AST API/Redirect/Public-Domain/Rule-9/SW/Header auditors | Enforces lockfile SHA-512/registry integrity & offline GPL/AGPL copyleft ban, 40-char commit-SHA & \`permissions:\` GitHub Actions hardening, 0 High/Critical CVEs, standalone AST coverage across \`src/\`, \`scripts/\`, \`public/sw.js\`, & \`next.config.ts\` (with explicit \`ast-parse-error\` reporting), server + client \`router.push()\`/\`replace()\` taint, Pillar-3 XSS/eval deduplication, API route limiter/manual-redirect checks, PostgreSQL RLS + AST Rule-9 teardown parity, AST \`public/sw.js\` guards, and AST-verified \`X-Frame-Options: DENY\` / \`object-src 'none'\` CSP headers |`,
    '| **Pass 1** | TypeScript Strict Compilation | `tsc --noEmit` | Strict type safety across all components, stores, hooks, and types |',
    '| **Pass 2** | MSW Server & React Query Validation | `vitest run src/hooks/queries src/app/api` | Validates edge proxy routes, rate limiters, and TanStack Query hooks against MSW |',
    '| **Pass 3** | Unit & Integration Test Suites | `vitest run --coverage` | Tiered 95/95/92/85% coverage floor across all co-located suites |',
    '| **Pass 4** | Living AST Documentation Sync | `docs:sync` toolchain | Auto-generates living `ARCHITECTURE.md`, `SECURITY.md` (`<!-- BEGIN:security-architecture -->`), `GUTENBERG_PARSER.md`, `SYSTEM_CONTRACTS.md`, `ROADMAP.md`, `CHANGELOG.md`, and `QUALITY_AUDIT_REPORT.md` |',
    '| **Pass 5** | ADR, Schema, Inventory, Doc Parity & Test Co-Location | Markdown/SQL/TS AST & filesystem co-location verification | Validates contiguous ADR sequence & 4-field schema, 18 mandatory governance docs, circular `SECURITY.md` symbol/table/feed parity (`auditSecurityDocumentationParity`), `@scope`/`@invariant`/`@adr` behavioral contracts across Tier-1..Tier-4 protected modules, semantic command/metric/workflow-count parity, dead-path & `17`-map orphaned generator lookup key checks, placeholder-prose guards, 1:1 `src/`<->`ARCHITECTURE.md` inventory, 1:1 SQL<->TS schema parity, 0 circular/parse-error/layer-violation/orphan modules, and 100% 1:1 co-located `.test.ts(x)` suites across `src/` & CLI/AST scripts |',
    `| **Pass 6** | Code Quality, Custom AST Security Lint & Dead Code Audit | \`eslint . --max-warnings 0\` (\`bookarium-security\`) & Knip | Zero ESLint errors or warnings across Next.js, TypeScript, and ${getSecurityPluginRuleCount()} custom AST/taint security rules (\`src/\`, \`scripts/\`, \`public/sw.js\`, \`next.config.ts\` audited via Pass 0.75); zero dead files/exports |`,
    '| **Pass 7** | Production Application Build & Live HTTP Smoke Probe | `next build` + `.next/routes-manifest.json` + loopback `next start` probe | Optimized production Next.js bundle compilation within byte budget, compiled security header parity (`X-Frame-Options: DENY`, `object-src \'none\'`, `frame-ancestors \'none\'`), and live runtime HTTP verification of headers, `400` SSRF/param blocking, and origin-locked `/auth/callback` redirects |',
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

  // Extract Diagram 1 (End-to-End System Context & Data Flow)
  const startMarker = '### 1. End-to-End System Context & Data Flow';
  const startIdx = architectureMarkdown.indexOf(startMarker);
  let diagram1Block = '';
  if (startIdx !== -1) {
    const mermaidStart = architectureMarkdown.indexOf('```mermaid', startIdx);
    const mermaidEnd = architectureMarkdown.indexOf('```', mermaidStart + 10);
    if (mermaidStart !== -1 && mermaidEnd !== -1) {
      diagram1Block = architectureMarkdown.slice(mermaidStart, mermaidEnd + 3);
    }
  }

  // Count total diagrams in docs/ARCHITECTURE.md
  const totalArchDiagrams = (architectureMarkdown.match(/```mermaid/g) || []).length;

  const swMeta = extractServiceWorkerMetadata(rootDir);
  const directoryRows = [
    '| # | Architectural Diagram | Primary Layer & Subsystem | Living Architecture Specification |',
    '|---|---|---|---|',
    '| **1** | **End-to-End System Context & Data Flow** | Global System Context, Edge Proxy & Client SPA | [docs/ARCHITECTURE.md#1-end-to-end-system-context--data-flow](docs/ARCHITECTURE.md) |',
    '| **2** | **Focus Reader State & Typography Engine** | Reader Runtime, Web Speech & Virtual Pagination | [docs/ARCHITECTURE.md#2-focus-reader-state--typography-engine](docs/ARCHITECTURE.md) |',
    '| **3** | **Bookmarks & Continue Reading Ledger Architecture** | Offline Ledger, Row Snap & Metadata Curation | [docs/ARCHITECTURE.md#3-bookmarks--continue-reading-ledger-architecture](docs/ARCHITECTURE.md) |',
    '| **4** | **Cross-Store, Worker & DOM Event Bus Diagram** | Reactivity, Custom Events & Worker IPC | [docs/ARCHITECTURE.md#1-cross-store-worker--dom-event-bus-diagram](docs/ARCHITECTURE.md) |',
    '| **5** | **Cold Launch & 7-Store Cloud Reconciliation** | Edge Geo-IP, Hydration & RLS Outbox Replay | [docs/ARCHITECTURE.md#1-cold-launch-edge-geo-ip-resolution-hydration--7-store-cloud-outbox-reconciliation](docs/ARCHITECTURE.md) |',
    '| **6** | **Focus Reader Launch & Multi-Mirror Stream** | HTTP 451 Gatekeeping, 4 Gutenberg Mirrors & Worker AST | [docs/ARCHITECTURE.md#2-focus-reader-launch-jurisdictional-gatekeeping-http-451-multi-mirror-streaming--worker-ast](docs/ARCHITECTURE.md) |',
    `| **7** | **Offline Mutation Queueing & Reconnect Replay** | PWA App Shell ${swMeta.versionLabel}, IndexedDB & Outbox Queue | [docs/ARCHITECTURE.md#3-offline-mutation-queueing-adaptive-offline-catalog--reconnect-outbox-replay](docs/ARCHITECTURE.md) |`,
    '| **8** | **GitHub Actions & Database Ingestion Topology** | Cron Pipelines, Concurrency Locks, Feeds & Service-Role Upserts | [docs/ARCHITECTURE.md#1-github-actions--database-ingestion-topology](docs/ARCHITECTURE.md) |',
    '| **9** | **Hermetic Testing, MSW v2 & V8 Coverage Pipeline** | 4-Tier Test Suites, AST Taint & 7 Gateways | [docs/ARCHITECTURE.md#1-hermetic-testing-msw-v2-interception-sastowasp--v8-coverage-pipeline](docs/ARCHITECTURE.md) |',
    '| **10** | **External Integration Topology Diagram** | Boundary Contracts, Allowlisted Mirrors & Timeouts | [docs/ARCHITECTURE.md#1-external-integration-topology-diagram](docs/ARCHITECTURE.md) |',
    '| **11** | **Multi-Tier Failover & Self-Healing Decision Diagram** | Circuit Breakers, Mirror Cascades & Worker Fallback | [docs/ARCHITECTURE.md#1-multi-tier-failover--self-healing-decision-diagram](docs/ARCHITECTURE.md) |',
    '| **12** | **Edge Routing, Regional Compute & Cron Topology** | Vercel Edge PoPs, iad1 Serverless & Weekly Cron | [docs/ARCHITECTURE.md#1-edge-routing-regional-compute-pinning-iad1--autonomous-cron-topology](docs/ARCHITECTURE.md) |',
    '| **13** | **Multi-Tier Caching, Egress Shielding & Cover/Text Waterfall** | 5-Layer Cache Hierarchy, Edge TTLs & Gutenberg Cover/Text Proxy | [docs/ARCHITECTURE.md#2-multi-tier-caching-supabase-egress-shielding--gutenberg-mirror-covertext-waterfall](docs/ARCHITECTURE.md) |',
    '| **14** | **Auth, Password Recovery, Session Revocation & Origin Flow** | Edge Refresh Bypass, PKCE/OTP, JWT AMR & Pre-Null Teardown | [docs/ARCHITECTURE.md#3-authentication-password-recovery-session-revocation--origin-security-flow](docs/ARCHITECTURE.md) |',
    '| **15** | **Literary Fellowship, Symposium & Marginalia Guard Topology** | Reader Circles, Symposiums, Fellow Highlights & DB Triggers | [docs/ARCHITECTURE.md#1-reader-circles-symposium-lifecycle-fellow-marginalia--trigger-guards](docs/ARCHITECTURE.md) |',
  ];

  const replacementBlock = [
    '<!-- BEGIN:architecture-diagrams -->',
    '## 🏛️ System Architecture',
    '',
    '> For the complete living specification, comprehensive C4 models, temporal sequence workflows, and failure recovery trees, see [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md).',
    '',
    '### 1. End-to-End System Context & Data Flow',
    '',
    diagram1Block,
    '',
    '---',
    '',
    `### 📚 Living Architecture Directory (${totalArchDiagrams} Interactive Diagrams)`,
    '',
    directoryRows.join('\n'),
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

function syncSecurityArchitectureDocument() {
  const securityPath = path.join(rootDir, 'SECURITY.md');
  if (!fs.existsSync(securityPath)) return;

  let eslintRuleNames = [];
  try {
    const securityPlugin = require('./eslint-rules/bookarium-security');
    const rulesObj =
      (securityPlugin && (securityPlugin.rules || securityPlugin.bookariumSecurityPlugin?.rules)) || {};
    eslintRuleNames = Object.keys(rulesObj);
  } catch {
    eslintRuleNames = [];
  }

  const sastModule = require('./lib/sast-validators');
  const sastExports = Object.keys(sastModule);
  const sastConstants = sastExports.filter((name) => /^[A-Z0-9_]+$/.test(name));
  const sastValidators = sastExports.filter((name) => !/^[A-Z0-9_]+$/.test(name));

  const schemaPath = path.join(rootDir, 'supabase', 'schema.sql');
  const schemaText = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, 'utf-8') : '';
  const sqlEntities = extractSqlSchemaEntities(schemaText);
  const publicTableList = sqlEntities.tableNames.map((name) => `\`public.${name}\``);
  if (sqlEntities.hasMigrationLedger) {
    publicTableList.push('`supabase_migrations.schema_migrations`');
  }
  const publicTableCount = sqlEntities.tableNames.length;
  const totalDbTableCount = publicTableCount + (sqlEntities.hasMigrationLedger ? 1 : 0);

  const formattedRules = eslintRuleNames.map((rule) => `\`${rule}\``).join(', ');
  const formattedValidators = sastValidators.map((fn) => `\`${fn}\``).join(', ');
  const formattedConstants = sastConstants.map((c) => `\`${c}\``).join(', ');
  const requiredHeadersList = Array.isArray(sastModule.REQUIRED_SECURITY_HEADERS)
    ? sastModule.REQUIRED_SECURITY_HEADERS.map((h) => `\`${h}\``).join(', ')
    : '';

  const blockLines = [
    '<!-- BEGIN:security-architecture -->',
    '## Security Architecture & Core Safeguards',
    '',
    'Bookarium incorporates multi-layered security controls designed into its architecture and synchronized deterministically from live source AST (`scripts/generate-architecture-matrix.js` via `npm run docs:sync`) and enforced in `Pass 5` (`auditSecurityDocumentationParity`):',
    '',
    '1. **Zero Secret Footprint, Trojan Source Defense, Env Parity & Transitive Boundary Isolation (Pass 0.5 Scanner)**:',
    '   - Automated pre-commit scanning (`scripts/verify-build.js`) prevents accidental commits of API keys, RSA/EC/OpenSSH private keys, fine-grained GitHub PATs (`github_pat_`), Supabase tokens (`sbp_`, `sbs_`, `sb_secret_`), OpenAI/Anthropic (`sk-proj-`, `sk-ant-`), Google Cloud/Gemini (`AIza`), npm (`npm_`), Vercel (`vercel_`), and Stripe (`sk_live_`, `rk_live_`) tokens, Base64URL-decoded Supabase `service_role` JWTs, Slack/Discord webhooks, PostgreSQL connection strings with embedded credentials, Unicode Trojan Source bidirectional overrides (`CVE-2021-42574`) and hidden zero-width control characters, tracked `.env*`/`.pem`/`.key` files, oversized binaries (`> 5 MB`), undocumented `NEXT_PUBLIC_*` variables (`validateEnvAndPrivilegeBoundariesAst` against `.env.example`, including bracket/destructured/aliased `process.env` reads), or direct/transitive client$\\to$server AST dependency leaks (`src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`, `next/headers`, `fs`, `child_process`, `zlib`, `net`, `tls`).',
    `2. **7-Pillar OWASP Pre-Commit SAST, Supply-Chain License SCA & ${eslintRuleNames.length}-Rule AST Taint Suite (Pass 0.75 & Pass 7)**:`,
    `   - Automated pre-commit gates (\`npm run security:audit\`, \`scripts/lib/sast-validators.js\`, and \`scripts/eslint-rules/bookarium-security.js\`) enforce seven security pillars alongside a custom ${eslintRuleNames.length}-rule ESLint & Babel AST engine (${eslintRuleNames.length - 2} security/taint rules + 2 engineering/policy governance rules, reported distinctly from \`Pass 5\` documentation/governance checks):`,
    '     1. **Supply-Chain Lockfile Sanity, Offline Copyleft License SCA, Lifecycle Guard, Archive Integrity & CVE Audit**: Enforces `package-lock.json` `lockfileVersion >= 3`, `sha512-` SRI integrity digests, `https://registry.npmjs.org/` resolution origins, `package.json` specifier synchronization, offline `BANNED_PACKAGE_LICENSES` (`GPL`/`AGPL` copyleft detection matching PR `dependency-review.yml`), and blocks unauthorized `preinstall`/`install`/`postinstall` lifecycle scripts (`validatePackageLockAndLifecycle`); scans `.github/workflows/*.yml` for explicit `permissions:`, 40-char immutable commit-SHA `uses:` pinning, anti-`pull_request_target` write safety, and `run:` shell interpolation safety (`validateGitHubWorkflowSecurity`); runs `npm audit --omit=dev --audit-level=high` (`0` High/Critical CVEs); and hardens Project Gutenberg ingestion feeds (`scripts/sync-gutenberg-catalog.js`) with `Content-Length` truncation rejection, fail-closed non-zero `tar` exit codes, wire `SHA-256` digests, and companion `.sha256` (`crypto.timingSafeEqual`) verification on `catalog-cache`.',
    '     2. **API Route Rate Limiting, Security Header Parity, Boundary Isolation & Redirect-Hop SSRF Guard (`no-unsafe-fetch`, `no-client-server-boundary-violation`, `no-secret-env-or-public-route-leak`)**: Verifies `RateLimiter.check()`, `buildApiSecurityHeaders()`, `sameSite`/`secure` cookie flags across both function-declaration and `export const GET|POST|...` arrow route handlers (`validateApiRoutesSecurityAst`), `@/lib/server-rsc-nav` / `node:http(s)` client isolation, and manual redirect-hop validation (`redirect: \'manual\'`, `isSafeUpstreamUrl()`) across `/api/books/content`, `/api/books`, and `/api/books/translations`, confining upstream requests strictly to the approved Project Gutenberg mirror allowlist (`aleph.gutenberg.org`, `gutenberg.pglaf.org`, `gutenberg.readingroo.ms`, `www.gutenberg.org`, `gutenberg.org`) with AST enforcement blocking external `gutendex.com` runtime calls (`ADR-080`).',
    '     3. **DOM XSS, Reverse Tabnabbing, ReDoS & CLI Execution Guard (`no-dangerous-execution`, `no-unsafe-dom-injection`)**: Blocks `eval()`, `new Function()`, string-based `setTimeout`/`setInterval`, `{ shell: true }` and raw shell spawns in `src/` and `scripts/` (requiring shell-free `spawn(..., { shell: false })` + `sanitizeLocalDevUrl` in `scripts/open-browser.js`), catastrophic backtracking ReDoS regex literals and static `new RegExp()` literals (`CWE-1333`), `dangerouslySetInnerHTML`, `.innerHTML =`, `.outerHTML =`, `iframe.srcdoc`, `.setAttribute(\'srcdoc\'|\'href\'|\'src\', ...)`, `document.write()`, `.insertAdjacentHTML()`, `.createContextualFragment()`, static, TS-cast/constant-folded, and dynamic JSX `href`/`src` URI scheme expressions (`javascript:`/`vbscript:`/`data:text/html,`), `<a target="_blank">` / `window.open(..., \'_blank\')` missing `noopener`/`noreferrer` (`CWE-1022`), and wildcard `postMessage(data, \'*\')` (`CWE-345`), while `sanitizeBookFormatUrl()` constrains client format URLs (`extractBookFormats`) to `https:` (plus opt-in `blob:` exclusively for offline cover previews).',
    '     4. **Open Redirect Sanitization, Categorized Sanitizers & Server/Client/CLI Request Taint Analysis (`no-unvalidated-redirect`, `no-tainted-request-sink`)**: Enforces `sanitizeRedirectPath` and `resolveCanonicalAuthOrigin` (`src/lib/redirect-sanitizer.ts`, `validateRedirectRoutesAst`) on all redirects and performs flow-sensitive AST taint tracking across server request sources (`request params`, `searchParams.get()`, `headers.get()`, `cookies.get()`, `request.json()`), client navigation sources (`useSearchParams().get()`, `document.referrer` -> `router.push()`/`replace()` exempting static non-protocol-relative `/path` and `ROUTES.*` prefixes), and CLI `scripts/` `process.argv` inputs (to `shell`, `fetch`, Node `https.get`/`http.get`, `redirect`, PostgREST `.or()`/`.filter()` filter strings `CWE-943`, dynamic `new RegExp()` `CWE-1333`, file system access, external URLs, and Prototype Pollution computed writes) using categorized sanitizer sets with array/conditional sanitizer intersection (`getNodeSanitizedSinks`).',
    '     5. **MIT License, Public Domain (`copyright=false`), Gutenberg Mirror Policy & 78k-Row Index Query AST Guard (`enforce-gutenberg-and-copyright-policy`)**: Verifies `package.json` MIT licensing, validates `copyright !== true` filtering via AST (`validatePublicDomainFilterAst`), blocks `copyright=true` in query strings or `URLSearchParams`, forbids direct `fetch(\'https://www.gutenberg.org/...\')` calls that bypass official mirror prioritization, and enforces 78k-row `public.books` index query invariants (forbidding secondary SQL `.order(\'id\')` chained onto `.order(\'download_count\')` and requiring a Primary Key `.in(\'id\', chunk)` bound whenever `.neq(\'quotes\', \'[]\')` is combined with `.order(\'download_count\')`).',
    `     6. **PostgreSQL Row Level Security (RLS), \`InitPlan\` Policy Optimization, Trigger RPC Isolation, Fellowship Column Guards, Owner-Scoped Session RPCs & Store Teardown Parity**: Statically verifies \`ENABLE ROW LEVEL SECURITY\` across all ${totalDbTableCount} database tables (${publicTableCount} public tables + \`supabase_migrations.schema_migrations\`), 100% DDL/policy/trigger idempotency (\`CREATE TABLE IF NOT EXISTS\`, \`CREATE INDEX IF NOT EXISTS\`, \`DROP POLICY IF EXISTS\`, \`DROP TRIGGER IF EXISTS\`), \`(select auth.uid())\` \`InitPlan\` scalar subquery wrapping (\`0003_auth_rls_initplan\`) and single-permissive-policy-per-action consolidation (\`0006_multiple_permissive_policies\`), scoped write-RLS isolation, \`SET search_path = ''\` and \`REVOKE EXECUTE ... FROM PUBLIC, anon\` across all \`SECURITY DEFINER\` functions (including owner-scoped session inspection/revocation RPCs \`public.get_active_sessions()\` with SQL-level IP masking and \`public.revoke_user_session(UUID)\`), full PostgREST RPC revocation (\`REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated\`) across all \`RETURNS TRIGGER\` functions in \`supabase/schema.sql\`, participant column-lock trigger \`public.enforce_fellowship_update_guard()\` on \`public.reader_circles\` and \`public.symposium_sessions\`, payload/array ceiling \`CHECK\` constraints, AST call-graph Rule 9 teardown parity (\`validateRule9AuthStoreParityAst\`), and 1:1 table/column parity with \`src/types/database.types.ts\` (\`Pass 5\`).`,
    `     7. **OWASP HTTP Security Headers, Compiled Manifest Parity, Live Loopback HTTP Probe & Service Worker AST Guard**: Verifies all ${Array.isArray(sastModule.REQUIRED_SECURITY_HEADERS) ? sastModule.REQUIRED_SECURITY_HEADERS.length : 7} hardened security headers (${requiredHeadersList}) with CSP \`object-src 'none'\`, \`frame-ancestors 'none'\`, \`form-action 'self'\`, \`base-uri 'self'\`, \`isDev\`-gated \`unsafe-eval\` stripping, \`!isDev\` HSTS, and \`X-Frame-Options: DENY\` in \`next.config.ts\` via Babel AST (\`validateNextConfigSecurityHeadersAst\`), compiled \`.next/routes-manifest.json\` parity (\`validateNextBuildHeaderManifest\` in \`Pass 7\`), live loopback \`127.0.0.1\` \`next start\` response probing (\`validateLiveHttpSecurityResponse\` verifying runtime OWASP headers, \`400\` SSRF/param rejections, and origin-locked \`/auth/callback\` redirects), and Babel AST verification of \`public/sw.js\` (\`validateServiceWorkerSecurity\`: strict cross-origin pass-through, bounded \`CACHE_URLS\` same-origin sanitization \`<= 100\` excluding \`/auth/\` and \`/api/\`, non-GET bypass, zero \`importScripts()\`/\`eval()\`).`,
    '3. **Continuous Cloud Code Scanning & PR Supply-Chain Review (GitHub CodeQL & Dependency Review)**:',
    '   - [`.github/workflows/codeql.yml`](.github/workflows/codeql.yml) (`push`/`pull_request` on `main`/`master`/`dev` + `cron: 30 1 * * 1`) continuously analyzes `javascript-typescript` and `actions` workflows into GitHub Security SARIF alerts, while [`.github/workflows/dependency-review.yml`](.github/workflows/dependency-review.yml) gates PRs against high/critical dependency CVEs and incompatible copyleft (`GPL`/`AGPL`) licenses.',
    '4. **PostgreSQL Row Level Security (RLS)**:',
    `   - Cloud synchronization utilizes Supabase PostgreSQL with strict RLS policies (\`(select auth.uid()) = user_id\`, participant isolation, and read-only public catalog policies) across all ${totalDbTableCount} database tables: ${publicTableList.join(', ')}. Users cannot read, mutate, or delete private records belonging to other accounts.`,
    '5. **Public Domain Integrity & Safe Ingestion**:',
    '   - All catalog queries strictly enforce `copyright=false`. Ingested Gutenberg texts are parsed through isolated Web Workers and sanitized reflow algorithms to guard against script injection (XSS), while weekly catalog ingestion (`scripts/sync-gutenberg-catalog.js`) verifies feed `Content-Length`, fail-closed `tar` exit status, wire `SHA-256` digests, and companion `.sha256` sidecars (`crypto.timingSafeEqual`).',
    '6. **Offline-First Data Isolation**:',
    '   - Stored books, notes, and reading positions reside in client-side browser storage (`localStorage` and `IndexedDB`) and are never exposed to untrusted third-party trackers or ad networks.',
    '7. **Automated Validator, Policy & Custom ESLint Rule Inventory (AST-Synced)**:',
    `   - **${eslintRuleNames.length} Custom ESLint & Babel AST Rules (\`scripts/eslint-rules/bookarium-security.js\`)**: ${formattedRules}.`,
    `   - **${sastValidators.length} Stateless SAST / Parity Validators (\`scripts/lib/sast-validators.js\`)**: ${formattedValidators}.`,
    `   - **${sastConstants.length} Enforced Security Policy Constants**: ${formattedConstants}.`,
    '',
    '---',
    '',
    '## 🛡️ Enterprise Defense-in-Depth & Resiliency Matrix',
    '',
    'Bookarium implements a comprehensive defense-in-depth model across the edge, serverless runtime, CI/CLI ingestion pipelines, and offline client layers:',
    '',
    '| Security Vector | Implementation & File Path | Protection Mechanism |',
    '|---|---|---|',
    '| **Sliding-Window Rate Limiting** | [`src/lib/rate-limiter.ts`](src/lib/rate-limiter.ts) & [`src/lib/api-utils.ts`](src/lib/api-utils.ts) | Zero-dependency `globalThis`-anchored sliding-window rate limiters isolating compute and upstream Project Gutenberg mirrors by endpoint mode (`booksApiRateLimiter`: 60 req/min on `/api/books` and `/api/books/translations`; `bookContentRateLimiter`: 30 req/min on `/api/books/content` text; `bookCardRateLimiter`: 20 req/min on `type=card` `next/og`; `bookCoverRateLimiter`: 60 req/min on `type=cover`), with automatic 30s GC, anti-spoofing rightmost-hop IP extraction, `429 Too Many Requests` (`Cache-Control: no-store, max-age=0` + `Retry-After`), and companion Vercel Dashboard Firewall / WAF IP rate limits (keeping Attack Challenge Mode off so PWA SW updates and OpenGraph unfurlers stay unblocked). |',
    `| **${eslintRuleNames.length}-Rule ESLint & Babel AST Request-Taint Engine** | [\`scripts/eslint-rules/bookarium-security.js\`](scripts/eslint-rules/bookarium-security.js) & [\`scripts/verify-build.js\`](scripts/verify-build.js) | Dual-engine static security analyzer running continuously in ESLint 10 (\`npm run lint\`) and standalone Babel AST verification across \`src/\`, \`scripts/\`, \`public/sw.js\`, and \`next.config.ts\` (\`npm run security:audit\`, with explicit \`ast-parse-error\` reporting), enforcing all ${eslintRuleNames.length} custom rules (${formattedRules}) across server, client (\`useSearchParams()\`/\`document.referrer\` -> \`router.push\`/\`replace\`), and CLI (\`process.argv\`, \`{ shell: true }\`, Node \`https.get\`/\`http.get\`) paths with array/conditional sanitizer intersection. |`,
    '| **Stateless Babel AST Validators, Offline Copyleft SCA & Circular Security Doc Parity** | [`scripts/lib/sast-validators.js`](scripts/lib/sast-validators.js) & [`scripts/lib/sast-validators.test.ts`](scripts/lib/sast-validators.test.ts) | Isolated pure validators tested adversarially in Vitest enforcing offline `package-lock.json` `GPL`/`AGPL` copyleft detection (`BANNED_PACKAGE_LICENSES`), AST env/API/redirect/public-domain/Rule-9/SW/header checks, `Pass 7` compiled routes-manifest & live `127.0.0.1` `next start` HTTP/redirect probe verification (`validateLiveHttpSecurityResponse`), and fail-closed `Pass 5` circular parity across `SECURITY.md` (`auditSecurityDocumentationParity`). |',
    '| **Catalog Feed Stream Guards & Release Snapshot `.sha256` Integrity** | [`scripts/sync-gutenberg-catalog.js`](scripts/sync-gutenberg-catalog.js) & [`.github/workflows/catalog-sync.yml`](.github/workflows/catalog-sync.yml) | Rejects truncated Gutenberg mirror streams via `Content-Length` byte verification, fails closed on any non-zero `tar` exit code so damaged `.tar.bz2` archives trigger mirror failover, logs live wire `SHA-256` digests to `$GITHUB_STEP_SUMMARY`, and protects `catalog-cache` GitHub Release snapshots with atomic `.sha256` sidecar generation and `crypto.timingSafeEqual` verification. |',
    '| **Authoritative Catalog & Cloud Outage Immunity** | [`src/lib/catalog/`](src/lib/catalog/), [`src/stores/useBookshelfStore.ts`](src/stores/useBookshelfStore.ts) & [`src/lib/bookshelf-cloud-sync.ts`](src/lib/bookshelf-cloud-sync.ts) | Primary Supabase PostgreSQL catalog (`public.books`) with zero-key bundled curated archive fallback (`src/lib/catalog/curated-fallback.ts`) when unconfigured, fail-closed `HTTP 503` protection against degraded CDN caching, and mirror-first Project Gutenberg content delivery (`aleph.gutenberg.org`, `gutenberg.pglaf.org`, `gutenberg.readingroo.ms`) ahead of `www.gutenberg.org`. Reading positions, bookmarks, audio telemetry, account profiles, annotations, and downloaded texts remain 100% functional offline via IndexedDB and local Zustand storage, with automatic `online` event reconciliation (`flushOutbox`). |',
    '| **HTTP Security Headers** | [`next.config.ts`](next.config.ts) | Enforces Content-Security-Policy (`default-src \'self\'`, `object-src \'none\'`, `frame-ancestors \'none\'`, `https://challenges.cloudflare.com` allowlisted in `script-src` & `frame-src`), Cross-Origin-Opener-Policy (`same-origin`), HSTS (`max-age=63072000; includeSubDomains; preload`), Clickjacking defense (`X-Frame-Options: DENY` aligned with `frame-ancestors \'none\'`), MIME-type sniffing prevention (`X-Content-Type-Options: nosniff`), Referrer Policy (`strict-origin-when-cross-origin`), and Permissions Policy (`camera=(), microphone=(), geolocation=()`). |',
    '| **Public Auth Bot & Abuse Defense (Turnstile & Honeypot)** | [`src/components/auth/TurnstileWidget.tsx`](src/components/auth/TurnstileWidget.tsx), [`src/components/auth/AuthModal.tsx`](src/components/auth/AuthModal.tsx), [`src/components/auth/EmailSentView.tsx`](src/components/auth/EmailSentView.tsx), [`src/components/account/AccountSecuritySection.tsx`](src/components/account/AccountSecuritySection.tsx), [`src/components/account/AccountIdentityCard.tsx`](src/components/account/AccountIdentityCard.tsx) & [`src/stores/useAuthStore.ts`](src/stores/useAuthStore.ts) | Shared zero-dependency lazy-loaded Cloudflare Turnstile Managed CAPTCHA widget (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `render=explicit`, automatic single-use token reset on submission/view change, zero scripts/UI rendered when blank) protecting `AuthModal`, `EmailSentView` resends, and reveal-on-click `/account` password reset & verification resend while forwarding `captchaToken` verification across all 5 public Supabase GoTrue endpoints (`signInWithPassword`, `signUpWithPassword`, `signInWithOtp`, `resetPasswordForEmail`, `resendVerificationEmail`), paired with an off-screen `website_url` Honeypot input (`tabIndex={-1}`, `aria-hidden="true"`) in `AuthModal` that silently blocks automated form-filling bots. |',
    '| **SSRF & Upstream Stream Bounding** | [`src/app/api/books/content/route.ts`](src/app/api/books/content/route.ts) & [`src/app/api/books/content/url-validator.ts`](src/app/api/books/content/url-validator.ts) | Upstream URL whitelisting (`isSafeUpstreamUrl`) restricting fetches strictly to approved Project Gutenberg harvest mirrors and domains (`aleph.gutenberg.org`, `gutenberg.pglaf.org`, `gutenberg.readingroo.ms`, `www.gutenberg.org`, `gutenberg.org`), strict numeric ID regex verification (`^\\d{1,8}$`), `redirect: \'manual\'` with relative `Location` origin resolution preventing open redirect hops, and a 15MB payload streaming threshold preventing memory exhaustion DoS. |',
    '| **API Query Allowlisting, Bounds & CORP Isolation** | [`src/lib/api-utils.ts`](src/lib/api-utils.ts), [`src/lib/catalog/query-parser.ts`](src/lib/catalog/query-parser.ts) & [`src/lib/catalog/supabase-provider.ts`](src/lib/catalog/supabase-provider.ts) | Strict per-route query parameter allowlists (`hasUnexpectedQueryParams`, rejecting unknown params and production `?country=` with `400 no-store`), numeric/length caps (`DEFAULT_QUOTE_POOL_LIMIT = 48`, `MAX_CATALOG_PAGE = 5000`, `MAX_CATALOG_OFFSET = 160_000`, `MAX_SEARCH_LENGTH = 120`, `MAX_TOPIC_LENGTH = 120`, `MAX_IDS_BATCH = 100`, `MAX_LANGUAGES = 5`, `MAX_MIME_TYPE_LENGTH = 64`, `MIN_ERA_YEAR = -4000`, `MAX_ERA_YEAR = 3000`, translation `id <= 10_000_000`), `nosniff`, and `Cross-Origin-Resource-Policy` (`cross-origin` exclusively for `type=card` OpenGraph PNGs; `same-origin` across catalog JSON, translations JSON, text streams, cover proxies, and error responses). |',
    '| **Open Redirect & Canonical Auth Origin Defense** | [`src/app/auth/callback/route.ts`](src/app/auth/callback/route.ts) & [`src/lib/redirect-sanitizer.ts`](src/lib/redirect-sanitizer.ts) | Path sanitization (`sanitizeRedirectPath`) guaranteeing OAuth and magic-link redirect paths strictly originate from trusted relative roots (`/^\\/[^\\/\\\\]/`), paired with canonical origin normalization (`resolveCanonicalAuthOrigin`, `buildAuthRedirectUrl`) so protected Vercel preview URLs never leak into outgoing confirmation emails and cross-device email verification (`token_hash` OTP and PKCE fallback) lands cleanly on the public domain. |',
    '| **Next.js Edge Session Proxy & Protocol-Aware Cookies** | [`src/proxy.ts`](src/proxy.ts), [`src/lib/supabase/middleware.ts`](src/lib/supabase/middleware.ts), [`src/lib/api-utils.ts`](src/lib/api-utils.ts) & [`src/lib/supabase/client.ts`](src/lib/supabase/client.ts) | Lightweight edge proxy invoking `@supabase/ssr` `updateSession` with Edge-safe sanitized `User-Agent` header forwarding (`sanitizeForwardedUserAgent`) and `sameSite: \'lax\'` + protocol-aware `secure: isHttpsRequest(request)` flags across `bookarium-auth-hint`, `bookarium-client-ip-sync`, and geo cookies (`Secure` enforced on HTTPS without breaking local HTTP development). |',
    '| **ReDoS & Main Thread Protection** | [`src/lib/gutenberg-parser.ts`](src/lib/gutenberg-parser.ts) | Non-backtracking regular expressions (`[^\\n]{0,80}`) and bounded passage analysis window (capped at 120,000 characters) eliminating regular expression denial of service (ReDoS) and event loop freezing on massive multi-megabyte classical tomes. |',
    '| **Relational Data Purge, Remote Session Revocation & Account Deletion** | [`src/stores/useAuthStore.ts`](src/stores/useAuthStore.ts) & [`src/app/providers.tsx`](src/app/providers.tsx) | Comprehensive cascading cleanup across all 11 user-linked PostgreSQL tables (`symposium_sessions`, `reader_circles`, `user_accolades`, `user_annotations`, `reading_progress`, `user_favorites`, `user_book_curation`, `user_reading_habits`, `bookshelf_items`, `bookshelves`, `profiles`) with `delete_current_user` RPC execution (`auth.users` cascade), explicit `{ scope: \'global\' }` session revocation (distinct from single-browser default `signOut(\'local\')`, `{ scope: \'others\' }` peer revocation, owner-scoped `public.get_active_sessions()`/`public.revoke_user_session(UUID)` controls, and automatic visible-tab/focus/reconnect `verifyActiveSessionValidity` teardown on `403 session_not_found`), and complete erasure of all 8 local user/preference Zustand stores (`useBookshelfStore`, `useAnnotationStore`, `useHabitsStore`, `useAccoladesStore`, `useFellowshipStore`, `useReaderStore`, `usePreferencesStore`, `useThemeStore`) plus IndexedDB offline volumes. |',
    '| **Anti-Enumeration Scholar Sanctuaries** | [`src/components/profile/PrivateProfileNotice.tsx`](src/components/profile/PrivateProfileNotice.tsx) & [`src/app/u/[username]/page.tsx`](src/app/u/[username]/page.tsx) | Strict opt-in privacy default (`is_public = false`), unified "Scholar Sanctuary Not Found" state preventing user enumeration across private and non-existent profiles, and zero-PII exposure ensuring emails and auth credentials are never queried or rendered. |',
    '| **Jurisdictional Copyright & Geo-IP Resolution** | [`src/lib/country-resolver.ts`](src/lib/country-resolver.ts) & [`src/lib/copyright-engine.ts`](src/lib/copyright-engine.ts) | Strict territorial copyright compliance enforcing U.S. 17 U.S.C. § 304, Life+70 (EU/UK/CA/AU), Life+80 (CO/ES), and Life+100 (MX) rules with fail-closed author longevity heuristics. In production, Vercel edge IP headers (`x-vercel-ip-country`) strictly gate catalog filtering and return `HTTP 451 Unavailable For Legal Reasons` for protected text streams. In local development, automatically infers developer\'s physical country via System Timezone (`Europe/Bucharest` $\\rightarrow$ `RO` / Life+70) with optional `.env.local` (`DEV_COUNTRY=XX`) and browser query override (`?country=XX`) support. |',
    '<!-- END:security-architecture -->',
  ].join('\n');

  const securityContent = fs.readFileSync(securityPath, 'utf-8');
  const markerRegex = /<!-- BEGIN:security-architecture -->[\s\S]*?<!-- END:security-architecture -->/;
  if (!markerRegex.test(securityContent)) {
    throw new Error(
      'SECURITY.md is missing "<!-- BEGIN:security-architecture -->" / "<!-- END:security-architecture -->" markers.'
    );
  }
  const updatedSecurity = securityContent.replace(markerRegex, () => blockLines);
  const normalizeEol = (s) => String(s || '').replace(/\r\n/g, '\n');
  if (normalizeEol(updatedSecurity) === normalizeEol(securityContent)) {
    console.log('✔ [IDEMPOTENT] SECURITY.md security architecture unchanged. Preserving existing file.');
  } else {
    fs.writeFileSync(securityPath, updatedSecurity, 'utf-8');
    console.log('✔ [SUCCESS] AST-synced SECURITY.md security architecture updated successfully.');
  }
}

const outputPath = path.join(rootDir, 'docs', 'ARCHITECTURE.md');
const content = generateMarkdown();
const normalizeArchDoc = (text) =>
  String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/^>\s*\*\*Last Synchronized\*\*:\s*`?\d{4}-\d{2}-\d{2}`?.*$/m, '')
    .trim();
const existingArch = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf-8') : '';
if (existingArch && normalizeArchDoc(content) === normalizeArchDoc(existingArch)) {
  syncReadmeArchitectureDiagrams(existingArch);
  syncSecurityArchitectureDocument();
  console.log('✔ [IDEMPOTENT] docs/ARCHITECTURE.md AST unchanged. Preserving existing matrix.');
} else {
  fs.writeFileSync(outputPath, content, 'utf-8');
  syncReadmeArchitectureDiagrams(content);
  syncSecurityArchitectureDocument();
  console.log('✔ [SUCCESS] Comprehensive AST-driven docs/ARCHITECTURE.md generated successfully.');
}

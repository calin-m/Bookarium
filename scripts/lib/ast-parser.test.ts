import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

interface AstModuleNode {
  file: string;
  parseError: string | null;
  resolvedImports: string[];
  resolvedStaticImports: string[];
  resolvedRuntimeImports: string[];
  typeOnlyImports: string[];
  consumedBy: string[];
  runtimeConsumedBy: string[];
  typeOnlyConsumedBy: string[];
}

interface ScriptsGraphNode {
  file: string;
  requires: string[];
  consumedBy: string[];
  dbTables: string[];
  parseError: string | null;
}

interface ScriptsDependencyGraph {
  nodes: ScriptsGraphNode[];
  nodesMap: Map<string, ScriptsGraphNode>;
  parseErrors: Array<{ file: string; error: string }>;
}

interface CrossBoundaryCouplingCatalog {
  dbTouchpoints: Array<{ table: string; callers: string[] }>;
  rpcCallers: Array<{ rpc: string; callers: string[] }>;
  apiRouteCallers: Array<{ route: string; callers: string[] }>;
  signalChannels: Array<{
    kind: string;
    name: string;
    isCustomSignal: boolean;
    emitters: string[];
    subscribers: string[];
    detailKeys: string[];
  }>;
  storageKeyBindings: Array<{
    key: string;
    persistedBy: string[];
    writers: string[];
    readers: string[];
  }>;
  parseErrors: Array<{ file: string; error: string }>;
}

interface CircularHealth {
  hasCycles: boolean;
  cycleCount: number;
  cycles: string[][];
}

interface LayerViolation {
  file: string;
  target: string;
  rule: string;
}

interface ComponentCatalogEntry {
  name: string;
  propsInterface: string;
  propSignals: string;
}

interface StoreCatalogEntry {
  name: string;
  storageKey: string;
}

interface RouteCatalogEntry {
  path: string;
  file: string;
  methods: string;
}

interface SqlSchemaEntities {
  hasMigrationLedger: boolean;
  tableNames: string[];
  userScopedTables: string[];
  indexes: Array<{ name: string; type: string; table: string; definition: string }>;
  triggers: Array<{ name: string; table: string; functionName: string }>;
  functions: Array<{ rawName: string; returnType: string }>;
  hasRlsAutoEnable: boolean;
  policyCount: number;
  checkConstraintCount: number;
}

interface RuntimeSpecConstants {
  engines: { node: string; npm: string; nodeMajor: string };
  vercel: { region: string; apiMaxDurationSec: number };
  coverageThresholds: { lines: number; statements: number; functions: number; branches: number };
  performanceTier: {
    lowMaxCores: number;
    lowMaxMemoryGb: number;
    mediumMaxCores: number;
    mediumMaxMemoryGb: number;
  };
  routeCache: {
    booksQuotePool: { raw: string; maxAge: number | null; sMaxAge: number | null; swr: number | null };
    booksLookup: { raw: string; maxAge: number | null; sMaxAge: number | null; swr: number | null };
    booksSearch: { raw: string; maxAge: number | null; sMaxAge: number | null; swr: number | null };
    contentText: { raw: string; maxAge: number | null; sMaxAge: number | null; swr: number | null };
    contentCover: { raw: string; maxAge: number | null; sMaxAge: number | null; swr: number | null };
    translations: {
      raw: string;
      maxAge: number | null;
      sMaxAge: number | null;
      swr: number | null;
      vary: string;
    };
  };
  featuredHeroBookCount: number;
  rateLimits: { booksApi: number; bookContent: number; bookCard: number; bookCover: number };
  queryLimits: {
    defaultQuotePoolLimit: number;
    maxCatalogPage: number;
    maxCatalogOffset: number;
    maxSearchLength: number;
    maxTopicLength: number;
    maxIdsBatch: number;
    maxLanguages: number;
    maxMimeTypeLength: number;
    minEraYear: number;
    maxEraYear: number;
    maxTranslationBookId: number;
    catalogCacheTtlMs: number;
    maxCatalogCacheEntries: number;
    quotePoolCacheTtlMs: number;
    maxBackfillIterations: number;
  };
  caches: {
    metadataCacheTtlMs: number;
    maxMetadataCacheEntries: number;
    maxCachedBooks: number;
    maxCacheableBookChars: number;
    maxCachedCovers: number;
    coverCacheTtlDays: number;
    offlineDbName: string;
    offlineDbVersion: number;
    maxPaginationCacheEntries: number;
    maxServerMetadataEntries: number;
    maxProfileCacheEntries: number;
    profileCacheTtlMin: number;
    maxExtractedPassages: number;
    extractedPassagesTtlDays: number;
    bookContentCacheTtlMin: number;
  };
  stores: {
    maxPinnedAccolades: number;
    preferencesKeyCount: number;
  };
  r2: {
    maxBookBytes: number;
    maxBookMb: number;
    maxCoverBytes: number;
    maxCoverMb: number;
    defaultTimeoutMs: number;
    defaultPutConcurrency: number;
  };
  parser: {
    charsPerPageBase: number;
    passageScanBytes: number;
    estimatedWordsPerMinute: number;
  };
  hooks: {
    quotePoolSettleTimeoutMs: number;
    readingIdleTimeoutMs: number;
    dockIdleTimeoutMs: number;
    mobileFocusBandRatio: number;
    tooltipDelayMs: number;
    passiveSyncCooldownMs: number;
  };
  cli: {
    catalogMinActiveForPrune: number;
    catalogMaxWithdrawnPrune: number;
    catalogMinWriteChunk: number;
    catalogMaxWriteChunk: number;
    quotePopularPoolSize: number;
    quoteRecentPoolSize: number;
    quoteMaxPrunePerRun: number;
    quoteMirrorKeys: string[];
    r2MissingRecheckDays: number;
    r2MinActiveForPrune: number;
    r2MaxPrunePerRun: number;
    r2RsyncPrimaryHost: string;
    r2RsyncSecondaryHost: string;
    scanDefaultConcurrency: number;
    scanDefaultTerms: string[];
    wikidataSparqlTimeoutMs: number;
  };
}

interface ContractBlock {
  scope: string;
  invariants: string[];
  rationales: string[];
  adrs: string[];
}

interface SymbolContractEntry extends ContractBlock {
  name: string;
  kind: string;
  signature: string;
  exported: boolean;
}

interface BehavioralModuleEntry {
  file: string;
  layer: string;
  isTier1Protected: boolean;
  isTier2Protected: boolean;
  isTier3Protected: boolean;
  isTier4Protected: boolean;
  hasContract: boolean;
  moduleContract: ContractBlock | null;
  symbolContracts: SymbolContractEntry[];
  exportsList: string[];
  emptyTagIssues: string[];
  parseError: string | null;
}

interface BehavioralContractsCatalog {
  modules: BehavioralModuleEntry[];
  tier1ProtectedModules: string[];
  tier2ProtectedModules: string[];
  tier3ProtectedModules: string[];
  tier4ProtectedModules: string[];
  protectedModules: string[];
  parseErrors: Array<{ file: string; error: string }>;
  validationIssues: Array<{ file: string; message: string }>;
  summary: {
    totalModules: number;
    contractedModules: number;
    uncontractedModules: number;
    totalModuleInvariants: number;
    totalSymbolContracts: number;
    coveragePct: number;
    byLayer: Array<{ layer: string; total: number; contracted: number; pending: number }>;
  };
}

interface EnvDependencyEntry {
  name: string;
  scope: string;
  fallback: string;
  purpose: string;
  consumers: string[];
}

interface WorkflowSpecEntry {
  file: string;
  filename: string;
  name: string;
  cron: string | null;
  hasWorkflowDispatch: boolean;
  pushBranches: string[];
  pushTags: string[];
  pullRequestBranches: string[];
  dispatchInputs: Array<{ name: string; defaultValue: string | null }>;
  topPermissions: string[];
  jobPermissions: string[];
  concurrencyGroup: string | null;
  concurrencyCancelInProgress: string | null;
  timeoutMinutes: number | null;
  nodeVersion: string | null;
  usesNpmCache: boolean;
  usesNpmCi: boolean;
  usesFetchDepthZero: boolean;
  secrets: string[];
  actions: Array<{ repo: string; sha: string; versionTag: string | null }>;
}

interface WorkflowSpecCatalog {
  workflows: WorkflowSpecEntry[];
  dependabotUpdates: Array<{
    ecosystem: string;
    interval: string | null;
    targetBranch: string | null;
    openPullRequestsLimit: number | null;
    prefix: string | null;
  }>;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const astParser = require('./ast-parser.js') as {
  analyzeDependencyGraph: (srcDir: string, rootDir: string) => Map<string, AstModuleNode>;
  detectCircularDependencies: (graph: Map<string, AstModuleNode>) => CircularHealth;
  getAstParseErrors: (graph: Map<string, AstModuleNode>) => Array<{ file: string; error: string }>;
  detectLayerViolations: (graph: Map<string, AstModuleNode>) => LayerViolation[];
  detectOrphanedModules: (graph: Map<string, AstModuleNode>) => string[];
  analyzeScriptsDependencyGraph: (rootDir: string) => ScriptsDependencyGraph;
  extractCrossBoundaryCouplingCatalog: (
    srcDir: string,
    rootDir: string
  ) => CrossBoundaryCouplingCatalog;
  TIER_1_CONTRACTED_MODULES: string[];
  TIER_2_CONTRACTED_MODULES: string[];
  TIER_3_CONTRACTED_MODULES: string[];
  TIER_4_CONTRACTED_MODULES: string[];
  PROTECTED_CONTRACTED_MODULES: string[];
  REQUIRED_GOVERNANCE_DOCS: string[];
  GENERATOR_LOOKUP_MAP_COUNT: number;
  parseJsDocContractTags: (commentValue: string) => {
    hasAnyContractTag: boolean;
    hasModuleHint: boolean;
    scope: string;
    invariants: string[];
    rationales: string[];
    adrs: string[];
    emptyTagIssues: string[];
  };
  extractBehavioralContractsCatalog: (
    srcDir: string,
    rootDir: string
  ) => BehavioralContractsCatalog;
  findOrphanedGeneratorLookupKeys: (
    rootDir: string,
    srcDir: string
  ) => Array<{ mapName: string; file: string; key: string; reason: string }>;
  extractComponentCatalog: (graph: Map<string, AstModuleNode>) => ComponentCatalogEntry[];
  extractStoreCatalog: (srcDir: string) => StoreCatalogEntry[];
  extractApiAndHookCatalog: (srcDir: string) => { routes: RouteCatalogEntry[] };
  extractSqlSchemaEntities: (schemaSql: string) => SqlSchemaEntities;
  extractWorkflowTriggerBranches: (wfText: string) => string[];
  extractWorkflowSpecCatalog: (rootDirPath: string) => WorkflowSpecCatalog;
  extractRuntimeSpecConstants: (rootDirPath: string) => RuntimeSpecConstants;
  extractTestsFromSourceAst: (content: string) => string[];
  extractEnvironmentDependencyCatalog: (rootDir: string, srcDir: string) => EnvDependencyEntry[];
  getDeterministicTextOrBinaryBytes: (absPath: string, relPath: string) => number;
  validateMermaidDiagramsInMarkdown: (markdownText: string, relPath?: string) => string[];
};

const tempDirs: string[] = [];

function createTempProject(files: Record<string, string>): { rootDir: string; srcDir: string } {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookarium-ast-'));
  tempDirs.push(rootDir);

  for (const [relPath, fileContent] of Object.entries(files)) {
    const absPath = path.join(rootDir, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, fileContent, 'utf-8');
  }

  return { rootDir, srcDir: path.join(rootDir, 'src') };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('ast-parser architectural & SQL verification engine', () => {
  it('detects static circular dependencies with hasCycles while ignoring type-only import cycles', () => {
    const { rootDir, srcDir } = createTempProject({
      'src/lib/a.ts': `import { b } from './b';\nexport const a = () => b();`,
      'src/lib/b.ts': `import { a } from './a';\nexport const b = () => a();`,
      'src/lib/typeA.ts': `import type { TypeB } from './typeB';\nexport interface TypeA { b?: TypeB; }`,
      'src/lib/typeB.ts': `import type { TypeA } from './typeA';\nexport interface TypeB { a?: TypeA; }`,
    });

    const graph = astParser.analyzeDependencyGraph(srcDir, rootDir);
    const circularHealth = astParser.detectCircularDependencies(graph);

    expect(circularHealth.hasCycles).toBe(true);
    expect(circularHealth.cycleCount).toBe(1);
    expect(circularHealth.cycles[0]).toEqual(['src/lib/a.ts', 'src/lib/b.ts', 'src/lib/a.ts']);
  });

  it('records parse errors explicitly instead of silently ignoring malformed TypeScript files', () => {
    const { rootDir, srcDir } = createTempProject({
      'src/lib/broken.ts': `export const broken = ( ;;;`,
      'src/lib/valid.ts': `export const ok = 42;`,
    });

    const graph = astParser.analyzeDependencyGraph(srcDir, rootDir);
    const parseErrors = astParser.getAstParseErrors(graph);

    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0].file).toBe('src/lib/broken.ts');
    expect(parseErrors[0].error.length).toBeGreaterThan(0);
  });

  it('flags static architectural layer violations while allowing type-only references', () => {
    const { rootDir, srcDir } = createTempProject({
      'src/stores/useAuthStore.ts': `export const useAuthStore = () => ({ user: null });`,
      'src/components/presentation/FeatureWidget.tsx': `export const FeatureWidget = () => null;`,
      'src/components/ui/BadButton.tsx': `import { useAuthStore } from '@/stores/useAuthStore';\nexport const BadButton = () => useAuthStore();`,
      'src/components/ui/BadCard.tsx': `import { FeatureWidget } from '@/components/presentation/FeatureWidget';\nexport const BadCard = () => FeatureWidget();`,
      'src/lib/BadDomain.ts': `import { BadButton } from '@/components/ui/BadButton';\nexport const run = () => BadButton();`,
      'src/lib/GoodDomain.ts': `import type { SortOption } from '@/components/presentation/FeatureWidget';\nexport const ok = (x: SortOption) => x;`,
    });

    const graph = astParser.analyzeDependencyGraph(srcDir, rootDir);
    const violations = astParser.detectLayerViolations(graph);

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          file: 'src/components/ui/BadButton.tsx',
          target: 'src/stores/useAuthStore.ts',
        }),
        expect.objectContaining({
          file: 'src/components/ui/BadCard.tsx',
          target: 'src/components/presentation/FeatureWidget.tsx',
        }),
        expect.objectContaining({
          file: 'src/lib/BadDomain.ts',
          target: 'src/components/ui/BadButton.tsx',
        }),
      ])
    );
    expect(violations.some((v) => v.file === 'src/lib/GoodDomain.ts')).toBe(false);
  });

  it('extracts inherited and intersected component Props, persist keys via AST, and all route HTTP methods', () => {
    const { rootDir, srcDir } = createTempProject({
      'src/components/ui/BaseShell.tsx': `export interface BaseShellProps { id: string; }\nexport const BaseShell = () => null;`,
      'src/components/presentation/RichCard.tsx': `import type { BaseShellProps } from '@/components/ui/BaseShell';\nexport interface RichCardProps extends BaseShellProps { title: string; }\nexport const RichCard = () => null;`,
      'src/components/presentation/IntersectCard.tsx': `export type IntersectCardProps = { label: string } & { count?: number };\nexport const IntersectCard = () => null;`,
      'src/stores/useSampleStore.ts': `const STORAGE_KEYS = { SAMPLE: 'bookarium-sample' };\nexport const useSampleStore = persist((set) => ({ n: 1 }), { name: STORAGE_KEYS.SAMPLE });`,
      'src/app/api/ping/route.ts': `export const GET = async () => new Response('ok');\nexport async function PATCH() { return new Response('patched'); }\nexport async function OPTIONS() { return new Response(null); }`,
    });

    const graph = astParser.analyzeDependencyGraph(srcDir, rootDir);
    const components = astParser.extractComponentCatalog(graph);
    const richCard = components.find((c) => c.name === 'RichCard');
    const intersectCard = components.find((c) => c.name === 'IntersectCard');

    expect(richCard?.propsInterface).toBe('`RichCardProps`');
    expect(richCard?.propSignals).toContain('`id`');
    expect(richCard?.propSignals).toContain('`title`');

    expect(intersectCard?.propsInterface).toBe('`IntersectCardProps`');
    expect(intersectCard?.propSignals).toContain('`label`');
    expect(intersectCard?.propSignals).toContain('`count`');

    const stores = astParser.extractStoreCatalog(srcDir);
    expect(stores).toEqual([
      expect.objectContaining({
        name: 'useSampleStore',
        storageKey: '`STORAGE_KEYS.SAMPLE` (localStorage)',
      }),
    ]);

    const { routes } = astParser.extractApiAndHookCatalog(srcDir);
    expect(routes).toEqual([
      {
        path: '/api/ping',
        file: 'src/app/api/ping/route.ts',
        methods: 'GET, PATCH, OPTIONS',
      },
    ]);
  });

  it('extracts SQL tables, functions with nested parentheses, triggers, and full quoted test titles', () => {
    const sampleSql = `
      CREATE TABLE IF NOT EXISTS public.reading_metrics (
        id UUID PRIMARY KEY,
        score NUMERIC(10, 2) CHECK (score >= 0)
      );

      CREATE INDEX IF NOT EXISTS idx_metrics_score ON public.reading_metrics (score DESC) WHERE score > 0;

      CREATE OR REPLACE FUNCTION public.compute_score(
        p_weight NUMERIC(10, 2) DEFAULT (1.5),
        p_since TIMESTAMPTZ DEFAULT now()
      )
      RETURNS TABLE(id UUID, weighted NUMERIC)
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN;
      END;
      $$;

      CREATE TRIGGER trg_metrics_update
        AFTER UPDATE ON public.reading_metrics
        FOR EACH ROW EXECUTE FUNCTION public.compute_score( );
    `;

    const sqlEntities = astParser.extractSqlSchemaEntities(sampleSql);
    expect(sqlEntities.tableNames).toEqual(['reading_metrics']);
    expect(sqlEntities.indexes).toEqual([
      {
        name: 'idx_metrics_score',
        type: 'Partial B-Tree Index',
        table: 'public.reading_metrics',
        definition: '`(score DESC) WHERE score > 0`',
      },
    ]);
    expect(sqlEntities.functions).toEqual([
      {
        rawName: 'compute_score',
        returnType: 'TABLE(ID UUID, WEIGHTED NUMERIC)',
      },
    ]);
    expect(sqlEntities.triggers).toEqual([
      {
        name: 'trg_metrics_update',
        table: 'public.reading_metrics',
        functionName: 'compute_score',
      },
    ]);

    const testSource = `
      it('suppresses history.replaceState when [data-scrubbing="true"] is active', () => {
        expect(1).toBe(1);
      });
      test("preserves sort order for 'recent'", () => {
        expect(2).toBe(2);
      });
    `;
    expect(astParser.extractTestsFromSourceAst(testSource)).toEqual([
      'suppresses history.replaceState when [data-scrubbing="true"] is active',
      "preserves sort order for 'recent'",
    ]);
  });

  it('verifies live src/ repository graph has zero cycles, zero parse errors, zero orphans, and zero layer violations', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const repoSrc = path.join(repoRoot, 'src');

    const graph = astParser.analyzeDependencyGraph(repoSrc, repoRoot);
    const circularHealth = astParser.detectCircularDependencies(graph);
    const parseErrors = astParser.getAstParseErrors(graph);
    const layerViolations = astParser.detectLayerViolations(graph);
    const orphans = astParser.detectOrphanedModules(graph);

    expect(parseErrors).toEqual([]);
    expect(circularHealth.hasCycles).toBe(false);
    expect(circularHealth.cycleCount).toBe(0);
    expect(layerViolations).toEqual([]);
    expect(orphans).toEqual([]);
  }, 45_000);

  it('separates runtime edges from inline and declaration type-only imports in the dependency graph', () => {
    const { rootDir, srcDir } = createTempProject({
      'src/types/shared.ts': `export interface BookDto { id: number; }`,
      'src/lib/runtimeHelper.ts': `export type HelperMode = 'fast';\nexport const compute = () => 1;`,
      'src/hooks/useSample.ts': `import type { BookDto } from '@/types/shared';\nimport { type HelperMode } from '@/lib/runtimeHelper';\nexport const useSample = (b: BookDto, m: HelperMode) => ({ b, m });`,
      'src/components/SampleView.tsx': `import { useSample } from '@/hooks/useSample';\nimport { compute } from '@/lib/runtimeHelper';\nexport const SampleView = () => ({ useSample, val: compute() });`,
    });

    const graph = astParser.analyzeDependencyGraph(srcDir, rootDir);
    const hookNode = graph.get('src/hooks/useSample.ts');
    const helperNode = graph.get('src/lib/runtimeHelper.ts');

    expect(hookNode?.resolvedRuntimeImports).toEqual([]);
    expect(hookNode?.typeOnlyImports).toEqual(['src/types/shared.ts', 'src/lib/runtimeHelper.ts']);
    expect(helperNode?.runtimeConsumedBy).toEqual(['src/components/SampleView.tsx']);
    expect(helperNode?.typeOnlyConsumedBy).toEqual(['src/hooks/useSample.ts']);
  });

  it('extracts cross-boundary Supabase tables/RPCs, API callers, signals, storage keys, and scripts CommonJS graph', () => {
    const { rootDir, srcDir } = createTempProject({
      'src/config/site-config.ts': `export const STORAGE_KEYS = { THEME: 'bookarium-theme-preference' } as const;`,
      'src/config/api-endpoints.ts': `export const API_ENDPOINTS = { INTERNAL_API_CONTENT: '/api/books/content' } as const;`,
      'src/hooks/useSampleEvents.ts': `
        import { STORAGE_KEYS } from '@/config/site-config';
        import { API_ENDPOINTS } from '@/config/api-endpoints';
        export const SAMPLE_UPDATED_EVENT = 'bookarium:sample-updated';
        export async function loadSample(supabase: { from: (t: string) => unknown; rpc: (r: string) => unknown }) {
          const items = Array.from(new Set([1, 2]));
          supabase.from('bookshelf_items');
          supabase.rpc('revoke_user_session');
          const url = API_ENDPOINTS.INTERNAL_API_CONTENT;
          await fetch(\`\${url}?id=1&type=cover\`);
          window.localStorage.setItem(STORAGE_KEYS.THEME, 'dark');
          window.dispatchEvent(new CustomEvent(SAMPLE_UPDATED_EVENT, { detail: { count: items.length } }));
          window.addEventListener(SAMPLE_UPDATED_EVENT, () => {});
          const bc = new BroadcastChannel('bookarium-sessions-sync');
          bc.postMessage({ type: 'changed' });
        }
      `,
      'src/app/layout.tsx': `
        import { STORAGE_KEYS } from '@/config/site-config';
        export function readTheme(cookies: { get: (k: string) => string | undefined }) {
          return cookies.get(STORAGE_KEYS.THEME);
        }
      `,
      'scripts/lib/helper.js': `module.exports = { run: (sb) => sb.from('books') };`,
      'scripts/runner.js': `const { run } = require('./lib/helper');\nmodule.exports = { run };`,
    });

    const crossBoundary = astParser.extractCrossBoundaryCouplingCatalog(srcDir, rootDir);
    const scriptsGraph = astParser.analyzeScriptsDependencyGraph(rootDir);

    expect(crossBoundary.parseErrors).toEqual([]);
    expect(scriptsGraph.parseErrors).toEqual([]);

    expect(crossBoundary.dbTouchpoints).toEqual(
      expect.arrayContaining([
        { table: 'public.bookshelf_items', callers: ['src/hooks/useSampleEvents.ts'] },
        { table: 'public.books', callers: ['scripts/lib/helper.js'] },
      ])
    );
    expect(crossBoundary.rpcCallers).toEqual([
      { rpc: 'public.revoke_user_session()', callers: ['src/hooks/useSampleEvents.ts'] },
    ]);
    expect(crossBoundary.apiRouteCallers).toEqual([
      { route: '/api/books/content', callers: ['src/hooks/useSampleEvents.ts'] },
    ]);
    expect(crossBoundary.signalChannels).toEqual(
      expect.arrayContaining([
        {
          kind: 'CustomEvent',
          name: 'bookarium:sample-updated',
          isCustomSignal: true,
          emitters: ['src/hooks/useSampleEvents.ts'],
          subscribers: ['src/hooks/useSampleEvents.ts'],
          detailKeys: ['count'],
        },
        {
          kind: 'BroadcastChannel',
          name: 'bookarium-sessions-sync',
          isCustomSignal: true,
          emitters: ['src/hooks/useSampleEvents.ts'],
          subscribers: [],
          detailKeys: [],
        },
      ])
    );
    expect(crossBoundary.storageKeyBindings).toEqual([
      {
        key: 'bookarium-theme-preference',
        persistedBy: [],
        writers: ['src/hooks/useSampleEvents.ts'],
        readers: ['src/app/layout.tsx'],
      },
    ]);

    expect(scriptsGraph.nodesMap.get('scripts/runner.js')?.requires).toEqual([
      'scripts/lib/helper.js',
    ]);
    expect(scriptsGraph.nodesMap.get('scripts/lib/helper.js')?.consumedBy).toEqual([
      'scripts/runner.js',
    ]);
  });

  it('orders cross-boundary catalogs with OS-independent UTF-16 codepoint ordering', () => {
    const { rootDir, srcDir } = createTempProject({
      'src/lib/multi.ts': `
        export function run(supabase: any) {
          localStorage.setItem('bookarium-a', '1');
          localStorage.setItem('bookarium-Z', '2');
          window.dispatchEvent(new CustomEvent('bookarium:a'));
          window.dispatchEvent(new CustomEvent('bookarium:Z'));
          return [supabase.from('a_table'), supabase.from('a1_table')];
        }
      `,
    });
    const catalog = astParser.extractCrossBoundaryCouplingCatalog(srcDir, rootDir);
    expect(catalog.dbTouchpoints.map((d) => d.table)).toEqual(['public.a1_table', 'public.a_table']);
    expect(catalog.storageKeyBindings.map((s) => s.key)).toEqual(['bookarium-Z', 'bookarium-a']);
    expect(catalog.signalChannels.map((c) => c.name)).toEqual(['bookarium:Z', 'bookarium:a']);
  });

  it('verifies live repository cross-boundary signals, API/RPC callers, and scripts graph cleanly', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const repoSrc = path.join(repoRoot, 'src');

    const crossBoundary = astParser.extractCrossBoundaryCouplingCatalog(repoSrc, repoRoot);
    const scriptsGraph = astParser.analyzeScriptsDependencyGraph(repoRoot);

    expect(crossBoundary.parseErrors).toEqual([]);
    expect(scriptsGraph.parseErrors).toEqual([]);

    expect(crossBoundary.rpcCallers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rpc: 'public.delete_current_user()',
          callers: ['src/stores/useAuthStore.ts'],
        }),
        expect.objectContaining({
          rpc: 'public.revoke_user_session()',
          callers: ['src/stores/useAuthStore.ts'],
        }),
      ])
    );
    expect(crossBoundary.apiRouteCallers.map((entry) => entry.route)).toEqual(
      expect.arrayContaining([
        '/api/books',
        '/api/books/content',
        '/api/books/translations',
        '/auth/callback',
      ])
    );
    expect(
      crossBoundary.signalChannels.filter((sig) => sig.isCustomSignal).map((sig) => sig.name)
    ).toEqual(
      expect.arrayContaining([
        'bookarium:offline-updated',
        'bookarium:offline-downloading',
        'bookarium:auth-token-refreshed',
        'bookarium:book-link-copied',
        'bookarium-sessions-sync',
      ])
    );
    expect(scriptsGraph.nodesMap.get('scripts/verify-build.js')?.requires).toEqual(
      expect.arrayContaining([
        'scripts/lib/ast-parser.js',
        'scripts/generate-architecture-matrix.js',
        'scripts/generate-contracts-docs.js',
      ])
    );
  }, 45_000);

  it('extracts module-level and symbol-level @scope/@invariant/@rationale/@adr tags across TS and CommonJS without misattribution', () => {
    const { rootDir, srcDir } = createTempProject({
      'src/lib/domain-engine.ts': [
        '/**',
        ' * @scope Pure sorting and copyright filtering.',
        ' * @invariant Never mutate the input array across multi-line',
        ' *   filter evaluation passes.',
        ' * @why Ensures React Strict-Mode render purity.',
        ' * @adr ADR-080, ADR-081',
        ' */',
        "import type { GutendexBook } from '@/types/book.types';",
        '',
        '/**',
        ' * @scope Filters only allowed titles.',
        ' * @invariant Must return empty array for blank inputs.',
        ' */',
        'export function filterTitles(list: string[]) {',
        '  return list.filter(Boolean);',
        '}',
      ].join('\n'),
      'src/lib/no-imports-symbol.ts': [
        '/**',
        ' * @scope Formats dates only.',
        ' * @invariant Must stay pure.',
        ' */',
        'export function formatIsoDate(value: string): string {',
        '  return value.trim();',
        '}',
      ].join('\n'),
      'src/lib/stub-invalid.ts': [
        '/**',
        ' * @scope TODO',
        ' * @invariant ',
        ' */',
        'import { filterTitles } from "./domain-engine";',
        'export const proxyFilter = filterTitles;',
      ].join('\n'),
      'scripts/worker-sync.js': [
        '#!/usr/bin/env node',
        '/**',
        ' * @scope Synchronizes background metadata batches.',
        ' * @invariant Rate-limit requests between 8s and 16s.',
        ' * @rationale Avoids upstream mirror bans.',
        ' * @adr ADR-074',
        ' */',
        "const fs = require('fs');",
        '',
        'function runWorker() { return fs !== null; }',
        'module.exports = { runWorker };',
      ].join('\n'),
    });

    const catalog = astParser.extractBehavioralContractsCatalog(srcDir, rootDir);
    expect(catalog.parseErrors).toEqual([]);

    const byFile = new Map(catalog.modules.map((m) => [m.file, m]));

    const domain = byFile.get('src/lib/domain-engine.ts');
    expect(domain?.hasContract).toBe(true);
    expect(domain?.moduleContract).toEqual({
      scope: 'Pure sorting and copyright filtering.',
      invariants: ['Never mutate the input array across multi-line filter evaluation passes.'],
      rationales: ['Ensures React Strict-Mode render purity.'],
      adrs: ['ADR-080', 'ADR-081'],
    });
    expect(domain?.symbolContracts).toEqual([
      {
        name: 'filterTitles',
        kind: 'function',
        signature: '(list)',
        exported: true,
        scope: 'Filters only allowed titles.',
        invariants: ['Must return empty array for blank inputs.'],
        rationales: [],
        adrs: [],
      },
    ]);

    // When a file has no imports and the comment sits immediately above an export with no @module or blank line,
    // it attaches cleanly to the symbol rather than claiming module scope.
    const noImports = byFile.get('src/lib/no-imports-symbol.ts');
    expect(noImports?.moduleContract).toBeNull();
    expect(noImports?.symbolContracts).toHaveLength(1);
    expect(noImports?.symbolContracts[0].name).toBe('formatIsoDate');

    const cjsScript = byFile.get('scripts/worker-sync.js');
    expect(cjsScript?.layer).toBe('CLI Pipelines & Governance');
    expect(cjsScript?.moduleContract).toEqual({
      scope: 'Synchronizes background metadata batches.',
      invariants: ['Rate-limit requests between 8s and 16s.'],
      rationales: ['Avoids upstream mirror bans.'],
      adrs: ['ADR-074'],
    });

    expect(catalog.validationIssues).toEqual(
      expect.arrayContaining([
        { file: 'src/lib/stub-invalid.ts', message: 'Empty or placeholder @scope tag' },
        { file: 'src/lib/stub-invalid.ts', message: 'Empty or placeholder @invariant tag' },
      ])
    );

    const rootEdgeFixture = createTempProject({
      'next.config.ts': `
        /**
         * @module next.config
         * @scope Security headers.
         * @invariant Enforce CSP object-src 'none'.
         * @rationale Hardening.
         * @adr ADR-073
         */
        export default {};
      `,
      'public/sw.js': `
        /**
         * @module public/sw
         * @scope Offline worker.
         * @invariant Enforce same-origin cache allowlists.
         * @rationale Security.
         * @adr ADR-020
         */
        self.addEventListener('fetch', () => {});
      `,
      'src/lib/leaf.ts': 'export const ok = true;',
    });
    const rootCatalog = astParser.extractBehavioralContractsCatalog(
      rootEdgeFixture.srcDir,
      rootEdgeFixture.rootDir
    );
    expect(rootCatalog.parseErrors).toEqual([]);
    const nextCfg = rootCatalog.modules.find((m) => m.file === 'next.config.ts');
    const swFile = rootCatalog.modules.find((m) => m.file === 'public/sw.js');
    expect(nextCfg?.hasContract).toBe(true);
    expect(nextCfg?.layer).toBe('Config & Type Contracts');
    expect(swFile?.hasContract).toBe(true);
    expect(swFile?.layer).toBe('Web Workers');
  });

  it('verifies all Tier-1, Tier-2, Tier-3, and Tier-4 protected modules in the live repository maintain valid @scope/@invariant contracts', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const repoSrc = path.join(repoRoot, 'src');

    const catalog = astParser.extractBehavioralContractsCatalog(repoSrc, repoRoot);
    expect(catalog.parseErrors).toEqual([]);
    expect(catalog.validationIssues).toEqual([]);
    expect(astParser.TIER_1_CONTRACTED_MODULES.length).toBe(19);
    expect(astParser.TIER_2_CONTRACTED_MODULES.length).toBe(20);
    expect(astParser.TIER_3_CONTRACTED_MODULES.length).toBe(23);
    expect(astParser.TIER_4_CONTRACTED_MODULES.length).toBe(20);
    expect(astParser.PROTECTED_CONTRACTED_MODULES.length).toBe(82);

    const byFile = new Map(catalog.modules.map((m) => [m.file, m]));
    expect(byFile.get('next.config.ts')?.isTier1Protected).toBe(true);
    expect(byFile.get('public/sw.js')?.isTier1Protected).toBe(true);
    const tier1Set = new Set(astParser.TIER_1_CONTRACTED_MODULES);
    const tier2Set = new Set(astParser.TIER_2_CONTRACTED_MODULES);
    const tier3Set = new Set(astParser.TIER_3_CONTRACTED_MODULES);
    for (const protectedFile of astParser.PROTECTED_CONTRACTED_MODULES) {
      const mod = byFile.get(protectedFile);
      const isProtectedForTier = tier1Set.has(protectedFile)
        ? mod?.isTier1Protected
        : tier2Set.has(protectedFile)
          ? mod?.isTier2Protected
          : tier3Set.has(protectedFile)
            ? mod?.isTier3Protected
            : mod?.isTier4Protected;
      expect(Boolean(isProtectedForTier), `${protectedFile} should be marked protected`).toBe(true);
      expect(mod?.hasContract, `${protectedFile} must declare a contract`).toBe(true);
      expect(mod?.moduleContract?.scope.length).toBeGreaterThan(10);
      expect(mod?.moduleContract?.invariants.length).toBeGreaterThanOrEqual(1);
      expect(mod?.moduleContract?.rationales.length).toBeGreaterThanOrEqual(1);
      expect(mod?.moduleContract?.adrs.length).toBeGreaterThanOrEqual(1);
    }

    const syncUtils = byFile.get('src/lib/sync-utils.ts');
    expect(syncUtils?.symbolContracts.some((s) => s.name === 'syncAllStoresWithCloud')).toBe(true);
  }, 45_000);

  it('verifies zero orphaned lookup keys exist across all 17 live generator registries', () => {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const repoSrc = path.join(repoRoot, 'src');

    expect(astParser.findOrphanedGeneratorLookupKeys(repoRoot, repoSrc)).toEqual([]);
  }, 45_000);

  it('detects orphaned lookup keys across all generator registries when modules, deps, workflows, SQL entities, signals, workers, or env vars are removed', () => {
    const { rootDir, srcDir } = createTempProject({
      '.env.example': 'NEXT_PUBLIC_SITE_URL=https://example.org\n',
      'package.json': JSON.stringify({
        name: 'fixture',
        dependencies: { next: '16.0.0' },
        devDependencies: { vitest: '4.0.0' },
      }),
      'supabase/schema.sql': [
        'CREATE TABLE IF NOT EXISTS public.books (',
        '  id BIGINT PRIMARY KEY',
        ');',
        'CREATE INDEX IF NOT EXISTS idx_books_live ON public.books (id);',
        'CREATE OR REPLACE FUNCTION public.live_rpc() RETURNS void LANGUAGE plpgsql AS $$ BEGIN END; $$;',
      ].join('\n'),
      '.github/workflows/ci.yml': 'name: CI\n',
      'public/sw.js': 'const CACHE_NAME = "v1";\n',
      'src/app/page.tsx': 'export default function Home() { return null; }\n',
      'src/stores/useLiveStore.ts':
        "import { create } from 'zustand'; export const useLiveStore = create(() => ({}));\n",
      'src/hooks/useLiveHook.ts':
        "export function useLiveHook() { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bookarium:live-evt')); return true; }\n",
      'src/lib/live-util.ts': 'export function liveFn() { return 1; }\n',
      'src/workers/live.worker.ts': 'export const ok = true;\n',
      'scripts/live-runner.js': 'module.exports = {};\n',
      'scripts/live-runner.test.ts': "it('ok', () => expect(1).toBe(1));\n",
      'scripts/generate-architecture-matrix.js': [
        'const scriptMetaMap = {',
        "  'scripts/live-runner.js': {},",
        "  'scripts/deleted-runner.js': {},",
        '};',
        'const pageDescriptions = {',
        "  'src/app/page.tsx': 'ok',",
        "  'src/app/retired/page.tsx': 'dead',",
        '};',
        'const storeDescriptions = {',
        "  useLiveStore: 'ok',",
        "  useRemovedStore: 'dead',",
        '};',
        'const hookRoles = {',
        "  useLiveHook: 'ok',",
        "  useRemovedHook: 'dead',",
        '};',
        'const utilityDescriptions = {',
        "  'live-util': 'ok',",
        "  'removed-util': 'dead',",
        '};',
        'const purposeMap = {',
        "  next: 'ok',",
        "  'removed-pkg': 'dead',",
        '};',
        'const storeMap = { books: "ok", retired_table: "dead" };',
        'const writeAuthMap = { books: "ok", retired_write: "dead" };',
        'const descMap = { books: "ok", retired_desc: "dead" };',
        'const indexDescMap = { idx_books_live: "ok", idx_removed: "dead" };',
        'const functionMetaMap = { live_rpc: {}, removed_rpc: {} };',
        'const signalMetaMap = {',
        "  'CustomEvent:bookarium:live-evt': {},",
        "  'CustomEvent:bookarium:dead-evt': {},",
        '};',
        'const workflowResponsibilityMap = {',
        "  'ci.yml': 'ok',",
        "  'deleted-wf.yml': 'dead',",
        '};',
        'const scriptSuiteMetaMap = {',
        "  'live-runner.test.ts': {},",
        "  'deleted-suite.test.ts': {},",
        '};',
      ].join('\n'),
      'scripts/lib/ast-parser.js': [
        'const varMetaMap = {',
        '  NEXT_PUBLIC_SITE_URL: {},',
        '  RETIRED_ENV_VAR: {},',
        '  NODE_ENV: {},',
        '};',
        'const workerRoleMap = {',
        "  'live.worker': 'ok',",
        "  'removed.worker': 'dead',",
        '};',
        'const roleMap = {',
        "  'public/sw.js': 'ok',",
        "  'public/missing-asset.png': 'dead',",
        '};',
      ].join('\n'),
    });

    const orphans = astParser.findOrphanedGeneratorLookupKeys(rootDir, srcDir);
    expect(orphans.map((o) => `${o.mapName}:${o.key}`)).toEqual([
      'descMap:retired_desc',
      'functionMetaMap:removed_rpc',
      'hookRoles:useRemovedHook',
      'indexDescMap:idx_removed',
      'pageDescriptions:src/app/retired/page.tsx',
      'purposeMap:removed-pkg',
      'roleMap:public/missing-asset.png',
      'scriptMetaMap:scripts/deleted-runner.js',
      'scriptSuiteMetaMap:deleted-suite.test.ts',
      'signalMetaMap:CustomEvent:bookarium:dead-evt',
      'storeDescriptions:useRemovedStore',
      'storeMap:retired_table',
      'utilityDescriptions:removed-util',
      'varMetaMap:RETIRED_ENV_VAR',
      'workerRoleMap:removed.worker',
      'workflowResponsibilityMap:deleted-wf.yml',
      'writeAuthMap:retired_write',
    ]);
  });

  it('produces deterministic codepoint-sorted consumer lists and LF-normalized text asset sizes regardless of CRLF', () => {
    const { rootDir, srcDir } = createTempProject({
      'src/shared/Button.tsx': 'export function Button() { return null; }',
      'src/components/presentation/BookPreviewModal.tsx':
        "import { Button } from '@/shared/Button'; export const A = Button;",
      'src/components/presentation/BookmarkCard.tsx':
        "import { Button } from '@/shared/Button'; export const B = Button;",
      'src/components/presentation/notebook/NotebookFilterStrip.tsx':
        "import type { Button as BtnType } from '@/shared/Button'; export type T = typeof BtnType;",
      'src/components/presentation/NotebookQuoteCard.tsx':
        "import { Button } from '@/shared/Button'; export const C = Button;",
      'public/sw.js': 'const CACHE_NAME = "v1";\r\nconsole.log(CACHE_NAME);\r\n',
    });

    const graph = astParser.analyzeDependencyGraph(srcDir, rootDir);
    const buttonNode = graph.get('src/shared/Button.tsx');
    expect(buttonNode?.consumedBy).toEqual([
      'src/components/presentation/BookPreviewModal.tsx',
      'src/components/presentation/BookmarkCard.tsx',
      'src/components/presentation/NotebookQuoteCard.tsx',
      'src/components/presentation/notebook/NotebookFilterStrip.tsx',
    ]);
    expect(buttonNode?.runtimeConsumedBy).toEqual([
      'src/components/presentation/BookPreviewModal.tsx',
      'src/components/presentation/BookmarkCard.tsx',
      'src/components/presentation/NotebookQuoteCard.tsx',
    ]);
    expect(buttonNode?.typeOnlyConsumedBy).toEqual([
      'src/components/presentation/notebook/NotebookFilterStrip.tsx',
    ]);

    const swAbs = path.join(rootDir, 'public', 'sw.js');
    const crlfBytes = fs.statSync(swAbs).size;
    const lfBytes = astParser.getDeterministicTextOrBinaryBytes(swAbs, 'public/sw.js');
    expect(crlfBytes).toBe(lfBytes + 2);

    fs.writeFileSync(swAbs, 'const CACHE_NAME = "v1";\nconsole.log(CACHE_NAME);\n', 'utf-8');
    expect(astParser.getDeterministicTextOrBinaryBytes(swAbs, 'public/sw.js')).toBe(lfBytes);
  });

  it('validates live Mermaid diagrams in docs/ARCHITECTURE.md, README.md, docs/GUTENBERG_PARSER.md, and docs/INFRASTRUCTURE.md with zero violations', () => {
    const repoRoot = path.resolve(__dirname, '../..');
    for (const relDoc of ['docs/ARCHITECTURE.md', 'README.md', 'docs/GUTENBERG_PARSER.md', 'docs/INFRASTRUCTURE.md']) {
      const content = fs.readFileSync(path.join(repoRoot, relDoc), 'utf-8');
      expect(astParser.validateMermaidDiagramsInMarkdown(content, relDoc)).toEqual([]);
    }
  });

  it('rejects parent-child subgraph cycles, compound cycles, unquoted edge parens, HTML-tag swallowing, and orphan nodes in Mermaid diagrams', () => {
    const brokenMarkdown = [
      '# Broken Diagrams',
      '',
      '```mermaid',
      'flowchart TD',
      '    subgraph UI ["Presentation"]',
      '        Header["Header"]',
      '        Body["Body (with HTML <id> and <>)"]',
      '    end',
      '    subgraph Backend ["Server"]',
      '        Db["DB"]',
      '    end',
      '    Orphan["Disconnected"]',
      '    Header --> UI',
      '    Body -->|Tier 1 (Optional)| Db',
      '    Db --> Body',
      '    Backend --> UI',
      '```',
      '',
      '```mermaid',
      'sequenceDiagram',
      '    actor User',
      '    User->>GhostActor: Missing participant',
      '```',
    ].join('\n');

    const issues = astParser.validateMermaidDiagramsInMarkdown(brokenMarkdown, 'broken.md');
    expect(issues.some((msg: string) => msg.includes('Fatal parent-child subgraph cycle'))).toBe(true);
    expect(issues.some((msg: string) => msg.includes('Unquoted Mermaid edge label |Tier 1 (Optional)|'))).toBe(true);
    expect(issues.some((msg: string) => msg.includes('HTML-like tag <id>'))).toBe(true);
    expect(issues.some((msg: string) => msg.includes('Empty "<>" operator'))).toBe(true);
    expect(issues.some((msg: string) => msg.includes('Compound subgraph cycle between "Backend" and "UI"'))).toBe(true);
    expect(issues.some((msg: string) => msg.includes('Disconnected orphan node "Orphan"'))).toBe(true);
    expect(issues.some((msg: string) => msg.includes('Undeclared sequence actor "GhostActor"'))).toBe(true);
  });

  it('validates chained Mermaid flowchart arrows, inline quoted arrow labels, and standalone nodes containing arrows cleanly', () => {
    const validChainedMarkdown = [
      '```mermaid',
      'flowchart LR',
      '    Solo["Proxy --> Origin"]',
      '    ChainB["Step B"]',
      '    ChainC["Step C"]',
      '    ChainD["Step D"]',
      '    ChainE["Step E"]',
      '    ChainA["Client"] -->|"request | ok"| ChainB <--> ChainC <-.-> ChainD -.-> ChainE ==> Solo',
      '```',
    ].join('\n');

    expect(astParser.validateMermaidDiagramsInMarkdown(validChainedMarkdown, 'chained.md')).toEqual([]);

    const invalidChainedMarkdown = [
      '```mermaid',
      'flowchart TD',
      '    end["Reserved"] --> NodeB["With <script>"] --> Ghost',
      '```',
    ].join('\n');

    const chainIssues = astParser.validateMermaidDiagramsInMarkdown(invalidChainedMarkdown, 'bad-chain.md');
    expect(chainIssues.some((msg: string) => msg.includes('Reserved Mermaid keyword "end"'))).toBe(true);
    expect(chainIssues.some((msg: string) => msg.includes('HTML-like tag <script>'))).toBe(true);
  });

  it('extracts .env.example consumers across default-param env, local loadEnv bindings, and scripts/lib modules without false positives', () => {
    const { rootDir, srcDir } = createTempProject({
      '.env.example': 'R2_ACCOUNT_ID=\nSUPABASE_SERVICE_ROLE_KEY=\n',
      'src/lib/r2-client.ts': `
        export function getR2Config(env: Record<string, string | undefined> = process.env) {
          return (env.R2_ACCOUNT_ID || '').trim();
        }
        export function ignorePlainObjects() {
          const env = { R2_ACCOUNT_ID: 'literal-fixture' };
          return env.R2_ACCOUNT_ID;
        }
      `,
      'scripts/lib/r2-sigv4.js': `
        function getConfig(env = process.env) {
          return (env.R2_ACCOUNT_ID || '').trim();
        }
        module.exports = { getConfig };
      `,
      'scripts/sync-catalog.js': `
        function main(deps = {}) {
          const env = deps.env || loadEnv();
          return env.SUPABASE_SERVICE_ROLE_KEY;
        }
        module.exports = { main };
      `,
    });

    const entries = astParser.extractEnvironmentDependencyCatalog(rootDir, srcDir);
    const byName = new Map(entries.map((e) => [e.name, e.consumers]));

    expect(byName.get('R2_ACCOUNT_ID')).toEqual([
      'scripts/lib/r2-sigv4.js',
      'src/lib/r2-client.ts',
    ]);
    expect(byName.get('SUPABASE_SERVICE_ROLE_KEY')).toEqual(['scripts/sync-catalog.js']);
  });

  it('discovers R2 and Supabase service-role code consumers on the live repository via extractEnvironmentDependencyCatalog', () => {
    const repoRoot = path.resolve(__dirname, '../..');
    const repoSrc = path.join(repoRoot, 'src');
    const entries = astParser.extractEnvironmentDependencyCatalog(repoRoot, repoSrc);
    const byName = new Map(entries.map((e) => [e.name, e.consumers]));

    expect(byName.get('R2_ACCOUNT_ID')).toEqual(
      expect.arrayContaining(['scripts/lib/r2-sigv4.js', 'src/lib/r2-client.ts'])
    );
    expect(byName.get('SUPABASE_SERVICE_ROLE_KEY')).toEqual(
      expect.arrayContaining([
        'scripts/ingest-translations.js',
        'scripts/sync-featured-quotes.js',
        'scripts/sync-gutenberg-catalog.js',
        'scripts/sync-r2-assets.js',
      ])
    );
  });

  it('extracts workflow YAML branch triggers across inline brackets, indented block lists, and missing blocks', () => {
    expect(astParser.extractWorkflowTriggerBranches('on:\n  push:\n    branches: [master]\n')).toEqual([
      'master',
    ]);
    expect(
      astParser.extractWorkflowTriggerBranches(
        "on:\n  pull_request:\n    branches:\n      - 'main'\n      - master\n      - dev # dev branch\npermissions:\n  contents: read\n"
      )
    ).toEqual(['main', 'master', 'dev']);
    expect(astParser.extractWorkflowTriggerBranches('on:\n  workflow_dispatch:\n')).toEqual([]);
  });

  it('extracts SQL userScopedTables from delete_current_user() and runtime specs from synthetic fixtures without falling back to defaults', () => {
    const syntheticSql = [
      'CREATE OR REPLACE FUNCTION public.delete_current_user()',
      'RETURNS VOID LANGUAGE plpgsql AS $$',
      'BEGIN',
      '  DELETE FROM public.symposium_sessions WHERE host_id = target_uid;',
      '  DELETE FROM public.profiles WHERE id = target_uid;',
      'END;',
      '$$;',
    ].join('\n');
    expect(astParser.extractSqlSchemaEntities(syntheticSql).userScopedTables).toEqual([
      'symposium_sessions',
      'profiles',
    ]);

    const { rootDir } = createTempProject({
      'vercel.json': JSON.stringify({
        regions: ['fra1'],
        functions: { 'src/app/api/**/*.ts': { maxDuration: 45 } },
      }),
      'vitest.config.mts': `export default defineConfig({ test: { coverage: { thresholds: { lines: 91, statements: 92, functions: 93, branches: 88 } } } });`,
      'src/config/featured-books.ts': `export const FEATURED_HERO_BOOKS = [{ id: 1 }, { id: 2 }, { id: 3 }];`,
      'src/lib/rate-limiter.ts': `
        export const booksApiRateLimiter = new InMemoryRateLimiter({ windowMs: 60000, maxRequests: 120 });
        export const bookContentRateLimiter = new InMemoryRateLimiter({ windowMs: 60000, maxRequests: 45 });
        export const bookCardRateLimiter = new InMemoryRateLimiter({ windowMs: 60000, maxRequests: 15 });
        export const bookCoverRateLimiter = new InMemoryRateLimiter({ windowMs: 60000, maxRequests: 90 });
      `,
      'src/hooks/usePerformanceTier.ts': `
        export function getClientSnapshot() {
          let tier = 'high';
          if (cores <= 1 || memory <= 1) { tier = 'low'; }
          else if (cores <= 6 || memory <= 6) { tier = 'medium'; }
          return tier;
        }
      `,
      'src/lib/r2-client.ts': `
        export const MAX_R2_BOOK_BYTES = 20 * 1024 * 1024;
        export const MAX_R2_COVER_BYTES = 4 * 1024 * 1024;
        export const R2_DEFAULT_TIMEOUT_MS = 12_000;
      `,
      'package.json': JSON.stringify({
        name: 'fixture',
        engines: { node: '>=24.0.0', npm: '>=11.0.0' },
      }),
      'src/lib/offline-storage.ts': `
        const DB_NAME = 'FixtureOfflineDB';
        const DB_VERSION = 7;
      `,
      'src/app/read/[id]/reader-layout-utils.ts': `
        const MAX_SERVER_METADATA_CACHE_ENTRIES = 750;
      `,
      'src/app/u/[username]/profile-layout-utils.ts': `
        const MAX_PROFILE_CACHE_ENTRIES = 250;
        const PROFILE_CACHE_TTL_MS = 10 * 60 * 1000;
      `,
      'src/hooks/useBookPassageShuffle.ts': `
        const MAX_EXTRACTED_PASSAGES_ENTRIES = 150;
        const EXTRACTED_PASSAGES_TTL_MS = 14 * 24 * 60 * 60 * 1000;
      `,
      'src/stores/useAccoladesStore.ts': `
        export const MAX_PINNED_ACCOLADES = 5;
      `,
      'src/lib/preferences-sync.ts': `
        export const FACTORY_PREFERENCES = {
          theme: 'light',
          fontSize: 18,
          speechRate: 1.0,
        };
      `,
      'src/hooks/useCursorTooltip.ts': `
        const DEFAULT_TOOLTIP_DELAY_MS = 420;
      `,
      'src/hooks/queries/useBookContent.ts': `
        export const BOOK_CONTENT_CACHE_TTL_MS = 45 * 60 * 1000;
      `,
      'src/lib/sync-utils.ts': `
        export const PASSIVE_SYNC_COOLDOWN_MS = 22_500;
      `,
    });

    const spec = astParser.extractRuntimeSpecConstants(rootDir);
    expect(spec.engines).toEqual({ node: '>=24.0.0', npm: '>=11.0.0', nodeMajor: '24' });
    expect(spec.vercel).toEqual({ region: 'fra1', apiMaxDurationSec: 45 });
    expect(spec.coverageThresholds).toEqual({
      lines: 91,
      statements: 92,
      functions: 93,
      branches: 88,
    });
    expect(spec.featuredHeroBookCount).toBe(3);
    expect(spec.rateLimits).toEqual({
      booksApi: 120,
      bookContent: 45,
      bookCard: 15,
      bookCover: 90,
    });
    expect(spec.performanceTier).toEqual({
      lowMaxCores: 1,
      lowMaxMemoryGb: 1,
      mediumMaxCores: 6,
      mediumMaxMemoryGb: 6,
    });
    expect(spec.caches.offlineDbName).toBe('FixtureOfflineDB');
    expect(spec.caches.offlineDbVersion).toBe(7);
    expect(spec.caches.maxServerMetadataEntries).toBe(750);
    expect(spec.caches.maxProfileCacheEntries).toBe(250);
    expect(spec.caches.profileCacheTtlMin).toBe(10);
    expect(spec.caches.maxExtractedPassages).toBe(150);
    expect(spec.caches.extractedPassagesTtlDays).toBe(14);
    expect(spec.caches.bookContentCacheTtlMin).toBe(45);
    expect(spec.stores).toEqual({ maxPinnedAccolades: 5, preferencesKeyCount: 3 });
    expect(spec.hooks.tooltipDelayMs).toBe(420);
    expect(spec.hooks.passiveSyncCooldownMs).toBe(22500);
    expect(spec.r2.maxBookMb).toBe(20);
    expect(spec.r2.maxCoverMb).toBe(4);
    expect(spec.r2.defaultTimeoutMs).toBe(12000);
  });

  it('extracts GitHub Actions workflows and Dependabot config from synthetic YAML fixtures', () => {
    const { rootDir } = createTempProject({
      '.github/workflows/nightly.yml': [
        'name: Nightly Fixture Audit',
        'on:',
        '  schedule:',
        "    - cron: '15 4 * * 2'",
        '  push:',
        '    branches: [main, master]',
        '  pull_request:',
        '    branches: [main, master]',
        '  workflow_dispatch:',
        '    inputs:',
        '      dry_run:',
        '        default: true',
        'permissions:',
        '  contents: read',
        'concurrency:',
        '  group: nightly-${{ github.ref }}',
        '  cancel-in-progress: ${{ github.event_name == \'pull_request\' }}',
        'jobs:',
        '  audit:',
        '    timeout-minutes: 15',
        '    permissions:',
        '      security-events: write',
        '    steps:',
        '      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0',
        '        with:',
        '          fetch-depth: 0',
        '      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0',
        '        with:',
        "          node-version: '22'",
        '          cache: npm',
        '      - run: npm ci',
        '        env:',
        '          API_TOKEN: ${{ secrets.FIXTURE_TOKEN }}',
      ].join('\n'),
      '.github/dependabot.yml': [
        'version: 2',
        'updates:',
        '  - package-ecosystem: "npm"',
        '    schedule:',
        '      interval: "weekly"',
        '    target-branch: "main"',
        '    open-pull-requests-limit: 4',
        '    commit-message:',
        '      prefix: "chore(deps)"',
        '  - package-ecosystem: "github-actions"',
        '    schedule:',
        '      interval: "monthly"',
        '    open-pull-requests-limit: 2',
        '    commit-message:',
        '      prefix: "chore(ci)"',
      ].join('\n'),
    });

    const specCatalog = astParser.extractWorkflowSpecCatalog(rootDir);
    expect(specCatalog.workflows).toHaveLength(1);
    const wf = specCatalog.workflows[0];
    expect(wf.filename).toBe('nightly.yml');
    expect(wf.name).toBe('Nightly Fixture Audit');
    expect(wf.cron).toBe('15 4 * * 2');
    expect(wf.pushBranches).toEqual(['main', 'master']);
    expect(wf.pullRequestBranches).toEqual(['main', 'master']);
    expect(wf.hasWorkflowDispatch).toBe(true);
    expect(wf.dispatchInputs).toEqual([{ name: 'dry_run', defaultValue: 'true' }]);
    expect(wf.topPermissions).toEqual(['contents: read']);
    expect(wf.jobPermissions).toEqual(['security-events: write']);
    expect(wf.concurrencyGroup).toBe('nightly-${{ github.ref }}');
    expect(wf.timeoutMinutes).toBe(15);
    expect(wf.nodeVersion).toBe('22');
    expect(wf.usesNpmCache).toBe(true);
    expect(wf.usesNpmCi).toBe(true);
    expect(wf.usesFetchDepthZero).toBe(true);
    expect(wf.secrets).toEqual(['FIXTURE_TOKEN']);
    expect(wf.actions).toHaveLength(2);
    expect(wf.actions[0]).toEqual({
      repo: 'actions/checkout',
      sha: '11d5960a326750d5838078e36cf38b85af677262',
      versionTag: 'v4.4.0',
    });

    expect(specCatalog.dependabotUpdates).toHaveLength(2);
    expect(specCatalog.dependabotUpdates[0]).toEqual({
      ecosystem: 'npm',
      interval: 'weekly',
      targetBranch: 'main',
      openPullRequestsLimit: 4,
      prefix: 'chore(deps)',
    });
  });

  it('extracts live repository runtime specs, governance constants, and workflow catalog consistently', () => {
    const repoRoot = path.resolve(__dirname, '../..');
    const schemaText = fs.readFileSync(path.join(repoRoot, 'supabase', 'schema.sql'), 'utf-8');
    const sqlEntities = astParser.extractSqlSchemaEntities(schemaText);
    const liveSpec = astParser.extractRuntimeSpecConstants(repoRoot);
    const liveWorkflows = astParser.extractWorkflowSpecCatalog(repoRoot);
    const depReviewYaml = fs.readFileSync(
      path.join(repoRoot, '.github', 'workflows', 'dependency-review.yml'),
      'utf-8'
    );

    expect(astParser.REQUIRED_GOVERNANCE_DOCS).toHaveLength(19);
    expect(astParser.REQUIRED_GOVERNANCE_DOCS).toEqual(
      expect.arrayContaining(['README.md', 'SECURITY.md', 'docs/ARCHITECTURE.md', 'docs/GITHUB_ACTIONS.md'])
    );
    expect(astParser.GENERATOR_LOOKUP_MAP_COUNT).toBe(17);

    expect(sqlEntities.userScopedTables.length).toBe(11);
    expect(sqlEntities.userScopedTables).toEqual(
      expect.arrayContaining(['symposium_sessions', 'reader_circles', 'profiles'])
    );
    expect(astParser.extractWorkflowTriggerBranches(depReviewYaml)).toEqual([
      'main',
      'master',
      'dev',
    ]);
    expect(liveSpec.engines.nodeMajor).toBe('22');
    expect(liveSpec.vercel).toEqual({ region: 'iad1', apiMaxDurationSec: 30 });
    expect(liveSpec.coverageThresholds).toEqual({
      lines: 95,
      statements: 95,
      functions: 92,
      branches: 85,
    });
    expect(liveSpec.featuredHeroBookCount).toBe(27);
    expect(liveSpec.rateLimits).toEqual({
      booksApi: 60,
      bookContent: 30,
      bookCard: 20,
      bookCover: 60,
    });
    expect(liveSpec.performanceTier).toEqual({
      lowMaxCores: 2,
      lowMaxMemoryGb: 2,
      mediumMaxCores: 4,
      mediumMaxMemoryGb: 4,
    });
    expect(liveSpec.caches.offlineDbName).toBe('BookariumOfflineDB');
    expect(liveSpec.caches.offlineDbVersion).toBe(2);
    expect(liveSpec.caches.maxServerMetadataEntries).toBe(500);
    expect(liveSpec.caches.maxProfileCacheEntries).toBe(500);
    expect(liveSpec.caches.profileCacheTtlMin).toBe(5);
    expect(liveSpec.caches.maxExtractedPassages).toBe(100);
    expect(liveSpec.caches.extractedPassagesTtlDays).toBe(30);
    expect(liveSpec.caches.bookContentCacheTtlMin).toBe(60);
    expect(liveSpec.stores).toEqual({ maxPinnedAccolades: 3, preferencesKeyCount: 14 });
    expect(liveSpec.hooks.tooltipDelayMs).toBe(300);
    expect(liveSpec.hooks.passiveSyncCooldownMs).toBe(15000);
    expect(liveSpec.routeCache.booksQuotePool.sMaxAge).toBe(43200);
    expect(liveSpec.routeCache.contentCover.sMaxAge).toBe(604800);
    expect(liveSpec.cli.r2MinActiveForPrune).toBe(50000);
    expect(liveSpec.cli.wikidataSparqlTimeoutMs).toBe(45000);

    expect(liveWorkflows.workflows.length).toBeGreaterThanOrEqual(11);
    const releaseWf = liveWorkflows.workflows.find((w) => w.filename === 'release.yml');
    expect(releaseWf?.pushTags).toEqual(['v*']);
    expect(releaseWf?.usesFetchDepthZero).toBe(true);
    expect(releaseWf?.actions.every((a) => /^[0-9a-f]{40}$/.test(a.sha))).toBe(true);
    expect(liveWorkflows.dependabotUpdates.map((d) => d.ecosystem)).toEqual([
      'npm',
      'github-actions',
    ]);
  });
});

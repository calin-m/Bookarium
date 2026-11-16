const fs = require('fs');
const path = require('path');
const {
  CONTRACT_LAYER_ORDER,
  analyzeDependencyGraph,
  analyzeScriptsDependencyGraph,
  extractCrossBoundaryCouplingCatalog,
  extractEnvironmentDependencyCatalog,
  extractTestsFromSourceAst,
  extractBehavioralContractsCatalog,
} = require('./lib/ast-parser');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const outputPath = path.join(rootDir, 'docs', 'SYSTEM_CONTRACTS.md');

/**
 * Escapes Markdown table pipe characters and collapses newlines for single-line cells.
 */
function escapeCell(value) {
  return String(value || '')
    .split('|')
    .join('&#124;')
    .replace(/\r?\n/g, ' ')
    .trim();
}

/**
 * Resolves exact co-located primary and security test files plus AST test counts.
 */
function resolveCoLocatedTestMetrics(relPath) {
  const baseNoExt = relPath.replace(/\.(ts|tsx|js|jsx)$/, '');
  const primaryCandidates = relPath.endsWith('.js')
    ? [`${baseNoExt}.test.ts`]
    : [`${baseNoExt}.test.ts`, `${baseNoExt}.test.tsx`];

  let primaryTest = null;
  let primaryCount = 0;
  for (const cand of primaryCandidates) {
    const abs = path.join(rootDir, cand);
    if (fs.existsSync(abs)) {
      primaryTest = cand;
      const content = fs.readFileSync(abs, 'utf-8');
      primaryCount = extractTestsFromSourceAst(content).length;
      break;
    }
  }

  let securityTest = null;
  let securityCount = 0;
  const secCand = `${baseNoExt}.security.test.ts`;
  const secAbs = path.join(rootDir, secCand);
  if (fs.existsSync(secAbs)) {
    securityTest = secCand;
    securityCount = extractTestsFromSourceAst(fs.readFileSync(secAbs, 'utf-8')).length;
  }

  return {
    primaryTest,
    primaryCount,
    securityTest,
    securityCount,
    totalTests: primaryCount + securityCount,
  };
}

/**
 * Indexes per-file AST blast radius, cross-boundary touchpoints, and env bindings.
 */
function buildModuleContextIndex() {
  const depGraph = analyzeDependencyGraph(srcDir, rootDir);
  const scriptsGraph = analyzeScriptsDependencyGraph(rootDir);
  const crossBoundary = extractCrossBoundaryCouplingCatalog(srcDir, rootDir);
  const envVars = extractEnvironmentDependencyCatalog(rootDir, srcDir);

  const contextByFile = new Map();
  const ensureCtx = (fileRel) => {
    if (!contextByFile.has(fileRel)) {
      contextByFile.set(fileRel, {
        runtimeCallers: [],
        typeOnlyCallers: [],
        runtimeDeps: [],
        typeOnlyDeps: [],
        dbTables: new Set(),
        rpcs: new Set(),
        apiRoutes: new Set(),
        signalsEmitted: new Set(),
        signalsSubscribed: new Set(),
        storagePersisted: new Set(),
        storageWritten: new Set(),
        storageRead: new Set(),
        envVars: new Set(),
      });
    }
    return contextByFile.get(fileRel);
  };

  for (const [fileRel, node] of depGraph.entries()) {
    const ctx = ensureCtx(fileRel);
    ctx.runtimeCallers = [...(node.runtimeConsumedBy || [])];
    ctx.typeOnlyCallers = [...(node.typeOnlyConsumedBy || [])];
    ctx.runtimeDeps = [...(node.resolvedRuntimeImports || [])];
    ctx.typeOnlyDeps = [...(node.typeOnlyImports || [])];
  }

  for (const sNode of scriptsGraph.nodes) {
    const ctx = ensureCtx(sNode.file);
    ctx.runtimeCallers = [...(sNode.consumedBy || [])];
    ctx.runtimeDeps = [...(sNode.requires || [])];
  }

  for (const item of crossBoundary.dbTouchpoints) {
    for (const caller of item.callers) {
      ensureCtx(caller).dbTables.add(item.table);
    }
  }
  for (const item of crossBoundary.rpcCallers) {
    for (const caller of item.callers) {
      ensureCtx(caller).rpcs.add(item.rpc);
    }
  }
  for (const item of crossBoundary.apiRouteCallers) {
    for (const caller of item.callers) {
      ensureCtx(caller).apiRoutes.add(item.route);
    }
  }
  for (const sig of crossBoundary.signalChannels) {
    const label = `${sig.kind}:${sig.name}`;
    for (const em of sig.emitters) {
      ensureCtx(em).signalsEmitted.add(label);
    }
    for (const sub of sig.subscribers) {
      ensureCtx(sub).signalsSubscribed.add(label);
    }
  }
  for (const st of crossBoundary.storageKeyBindings) {
    for (const p of st.persistedBy) ensureCtx(p).storagePersisted.add(st.key);
    for (const w of st.writers) ensureCtx(w).storageWritten.add(st.key);
    for (const r of st.readers) ensureCtx(r).storageRead.add(st.key);
  }
  for (const envEntry of envVars) {
    for (const consumer of envEntry.consumers) {
      if (consumer.startsWith('src/') || consumer.startsWith('scripts/')) {
        ensureCtx(consumer).envVars.add(envEntry.name);
      }
    }
  }

  return contextByFile;
}

/**
 * Formats a compact, readable summary of cross-boundary touchpoints for a module.
 */
function formatTouchpointsList(ctx) {
  const parts = [];
  if (ctx.dbTables.size > 0) {
    parts.push(`DB Tables: ${Array.from(ctx.dbTables).sort().map((t) => `\`${t}\``).join(', ')}`);
  }
  if (ctx.rpcs.size > 0) {
    parts.push(`RPCs: ${Array.from(ctx.rpcs).sort().map((r) => `\`${r.endsWith('()') ? r : `${r}()`}\``).join(', ')}`);
  }
  if (ctx.apiRoutes.size > 0) {
    parts.push(`API Calls: ${Array.from(ctx.apiRoutes).sort().map((a) => `\`${a}\``).join(', ')}`);
  }
  if (ctx.signalsEmitted.size > 0 || ctx.signalsSubscribed.size > 0) {
    const sigItems = [];
    if (ctx.signalsEmitted.size > 0) {
      sigItems.push(`emits ${Array.from(ctx.signalsEmitted).sort().map((s) => `\`${s}\``).join(', ')}`);
    }
    if (ctx.signalsSubscribed.size > 0) {
      sigItems.push(`listens ${Array.from(ctx.signalsSubscribed).sort().map((s) => `\`${s}\``).join(', ')}`);
    }
    parts.push(`Signals: ${sigItems.join('; ')}`);
  }
  const storageKeys = new Set([
    ...ctx.storagePersisted,
    ...ctx.storageWritten,
    ...ctx.storageRead,
  ]);
  if (storageKeys.size > 0) {
    parts.push(`Storage/Cookies: ${Array.from(storageKeys).sort().map((k) => `\`${k}\``).join(', ')}`);
  }
  if (ctx.envVars.size > 0) {
    parts.push(`Env Vars: ${Array.from(ctx.envVars).sort().map((v) => `\`${v}\``).join(', ')}`);
  }
  return parts;
}

/**
 * Scores unannotated modules by AST fan-in blast radius and cross-boundary exposure.
 */
function computePriorityScore(mod, ctx) {
  const boundaryCount =
    ctx.dbTables.size +
    ctx.rpcs.size +
    ctx.apiRoutes.size +
    ctx.signalsEmitted.size +
    ctx.signalsSubscribed.size +
    ctx.storagePersisted.size +
    ctx.storageWritten.size +
    ctx.storageRead.size +
    ctx.envVars.size;

  let layerWeight = 0;
  if (
    mod.layer === 'Edge Proxy & API Routes' ||
    mod.layer === 'State Stores (Zustand)' ||
    mod.layer === 'Domain Engines & Adapters'
  ) {
    layerWeight = 4;
  } else if (
    mod.layer === 'React Hooks & Queries' ||
    mod.layer === 'Web Workers' ||
    mod.layer === 'CLI Pipelines & Governance'
  ) {
    layerWeight = 3;
  } else if (mod.layer === 'App Router Pages & Layouts') {
    layerWeight = 2;
  }

  return boundaryCount * 4 + ctx.runtimeCallers.length * 2 + ctx.typeOnlyCallers.length + layerWeight;
}

/**
 * Generates the living docs/SYSTEM_CONTRACTS.md specification from Babel AST.
 */
function generateContractsMarkdown() {
  const contracts = extractBehavioralContractsCatalog(srcDir, rootDir);
  const contextByFile = buildModuleContextIndex();
  const lines = [];

  lines.push(
    '# Bookarium System Contracts & Behavioral Invariants (AST-Compiled)',
    '',
    '> **Auto-Generated Living Specification**: This document is 100% compiled by [`scripts/generate-contracts-docs.js`](../scripts/generate-contracts-docs.js) using [`scripts/lib/ast-parser.js`](../scripts/lib/ast-parser.js). Never edit this file directly — author `@scope`, `@invariant`, `@rationale` (`@why`), and `@adr` JSDoc tags in source files and run `npm run docs:contracts` (or `npm run docs:sync`).',
    '',
    'While [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) maps structural topology and [`docs/DECISIONS.md`](DECISIONS.md) records historical architectural decisions, **`SYSTEM_CONTRACTS.md`** documents **code-level intent**: what each module owns, which invariants must never be broken, why non-obvious constraints exist, its live caller blast radius, and its co-located test contract.',
    '',
    '---',
    '',
    '## 📐 Writing Contract JSDoc Annotations',
    '',
    'Annotate a module header (above imports or tagged `@module`) or an exported function/class/type directly in `src/` or `scripts/*.js`:',
    '',
    '```ts',
    '/**',
    ' * @scope Intended ownership boundary and responsibilities for this module or symbol.',
    ' * @invariant Hard rule, ordering constraint, or security guarantee that must never regress.',
    ' * @invariant Additional repeatable @invariant tags become separate enforceable bullets.',
    ' * @rationale Why the code is shaped this exact way (database index behavior, SSR races, browser quirks).',
    ' * @adr ADR-070, ADR-080',
    ' */',
    '```',
    '',
    '---',
    '',
    '## 📊 Contract Coverage Telemetry (Across All Executable Modules)',
    '',
    `- **Total Scanned Executable Modules**: \`${contracts.summary.totalModules}\` (\`src/**\` + \`scripts/*.js\`)`,
    `- **Annotated Contract Modules**: \`${contracts.summary.contractedModules}\` (**${contracts.summary.coveragePct}%** coverage; \`${contracts.tier1ProtectedModules.length}\` Tier-1 + \`${contracts.tier2ProtectedModules.length}\` Tier-2 + \`${contracts.tier3ProtectedModules.length}\` Tier-3 + \`${contracts.tier4ProtectedModules.length}\` Tier-4 = \`${contracts.protectedModules.length}\` Protected)`,
    `- **Extracted Module Invariants**: \`${contracts.summary.totalModuleInvariants}\``,
    `- **Symbol-Level Contracts**: \`${contracts.summary.totalSymbolContracts}\``,
    `- **Pending Annotation Queue**: \`${contracts.summary.uncontractedModules}\` *(auto-ranked below by AST blast radius & external boundary exposure)*`,
    '',
    '| Architectural Layer | Total Modules | Contracted | Pending | Coverage |',
    '| :--- | :---: | :---: | :---: | :---: |'
  );

  for (const row of contracts.summary.byLayer) {
    const pct = row.total > 0 ? ((row.contracted / row.total) * 100).toFixed(1) : '0.0';
    lines.push(
      `| **${row.layer}** | \`${row.total}\` | \`${row.contracted}\` | \`${row.pending}\` | ${pct}% |`
    );
  }

  lines.push(
    '',
    '---',
    '',
    '## 🛡️ Active Behavioral Contracts & Invariants'
  );

  const contractedModules = contracts.modules.filter((m) => m.hasContract);
  const byLayer = new Map(CONTRACT_LAYER_ORDER.map((l) => [l, []]));
  for (const mod of contractedModules) {
    if (!byLayer.has(mod.layer)) byLayer.set(mod.layer, []);
    byLayer.get(mod.layer).push(mod);
  }

  for (const layerName of CONTRACT_LAYER_ORDER) {
    const items = byLayer.get(layerName) || [];
    if (items.length === 0) continue;

    lines.push('', `### Layer: ${layerName} (${items.length} Contracted)`, '');

    for (const mod of items) {
      const ctx = contextByFile.get(mod.file) || {
        runtimeCallers: [],
        typeOnlyCallers: [],
        runtimeDeps: [],
        typeOnlyDeps: [],
        dbTables: new Set(),
        rpcs: new Set(),
        apiRoutes: new Set(),
        signalsEmitted: new Set(),
        signalsSubscribed: new Set(),
        storagePersisted: new Set(),
        storageWritten: new Set(),
        storageRead: new Set(),
        envVars: new Set(),
      };
      const testMetrics = resolveCoLocatedTestMetrics(mod.file);
      const tierBadge = mod.isTier1Protected
        ? ' *(Tier-1 Protected)*'
        : mod.isTier2Protected
          ? ' *(Tier-2 Protected)*'
          : mod.isTier3Protected
            ? ' *(Tier-3 Protected)*'
            : mod.isTier4Protected
              ? ' *(Tier-4 Protected)*'
              : '';
      const mc = mod.moduleContract;

      lines.push(`#### [\`${mod.file}\`](../${mod.file})${tierBadge}`, '');

      if (mc) {
        if (mc.scope) {
          lines.push(`- **Intended Scope (` + '`@scope`' + `)**: ${mc.scope}`);
        }
        if (mc.invariants.length > 0) {
          lines.push(`- **Behavioral Invariants (` + '`@invariant`' + `)**:`);
          for (const inv of mc.invariants) {
            lines.push(`  - ${inv}`);
          }
        }
        if (mc.rationales.length > 0) {
          lines.push(`- **Design Rationale (` + '`@rationale`' + `)**:`);
          for (const rat of mc.rationales) {
            lines.push(`  - ${rat}`);
          }
        }
        if (mc.adrs.length > 0) {
          const adrLinks = mc.adrs.map((adr) => `[${adr}](DECISIONS.md)`).join(', ');
          lines.push(`- **Governing Decisions (` + '`@adr`' + `)**: ${adrLinks}`);
        }
      }

      const callersSummary =
        ctx.runtimeCallers.length === 0 && ctx.typeOnlyCallers.length === 0
          ? 'Entrypoint / zero static importers'
          : `${ctx.runtimeCallers.length} runtime, ${ctx.typeOnlyCallers.length} type-only (${[
              ...ctx.runtimeCallers.slice(0, 4).map((c) => `[\`${c}\`](../${c})`),
              ...ctx.typeOnlyCallers.slice(0, 2).map((c) => `[\`${c}\`](../${c}) *(type)*`),
            ].join(', ')}${ctx.runtimeCallers.length + ctx.typeOnlyCallers.length > 6 ? ', …' : ''})`;
      lines.push(`- **AST Blast Radius**: ${callersSummary}`);

      const touchpoints = formatTouchpointsList(ctx);
      lines.push(
        `- **Cross-Boundary Coupling**: ${touchpoints.length > 0 ? touchpoints.join(' · ') : 'Self-contained / pure domain computation'}`
      );

      if (testMetrics.primaryTest) {
        const secPart = testMetrics.securityTest
          ? ` + [\`${testMetrics.securityTest}\`](../${testMetrics.securityTest}) (${testMetrics.securityCount})`
          : '';
        lines.push(
          `- **Test Contract**: [\`${testMetrics.primaryTest}\`](../${testMetrics.primaryTest}) (${testMetrics.primaryCount} tests)${secPart}`
        );
      } else {
        lines.push('- **Test Contract**: _Covered via runtime/verification harness_');
      }

      if (mod.symbolContracts.length > 0) {
        lines.push('', '**Exported & Symbol-Level Contracts:**', '');
        lines.push('| Symbol | Signature | Scope / Invariants / Rationale |');
        lines.push('| :--- | :--- | :--- |');
        for (const sym of mod.symbolContracts) {
          const descParts = [];
          if (sym.scope) descParts.push(`**Scope**: ${sym.scope}`);
          if (sym.invariants.length > 0) {
            descParts.push(`**Invariants**: ${sym.invariants.join(' • ')}`);
          }
          if (sym.rationales.length > 0) {
            descParts.push(`**Why**: ${sym.rationales.join(' • ')}`);
          }
          if (sym.adrs.length > 0) {
            descParts.push(`*(${sym.adrs.join(', ')})*`);
          }
          const visTag = sym.exported ? '' : ' *(internal)*';
          lines.push(
            `| \`${escapeCell(sym.name)}\`${visTag} | \`${escapeCell(sym.signature)}\` | ${escapeCell(descParts.join(' '))} |`
          );
        }
      }

      lines.push('');
    }
  }

  // Pending Priority Queue across remaining unannotated modules
  const uncontracted = contracts.modules
    .filter((m) => !m.hasContract)
    .map((mod) => {
      const ctx = contextByFile.get(mod.file) || {
        runtimeCallers: [],
        typeOnlyCallers: [],
        runtimeDeps: [],
        typeOnlyDeps: [],
        dbTables: new Set(),
        rpcs: new Set(),
        apiRoutes: new Set(),
        signalsEmitted: new Set(),
        signalsSubscribed: new Set(),
        storagePersisted: new Set(),
        storageWritten: new Set(),
        storageRead: new Set(),
        envVars: new Set(),
      };
      return {
        mod,
        ctx,
        score: computePriorityScore(mod, ctx),
        touchpoints: formatTouchpointsList(ctx),
      };
    })
    .sort((a, b) => b.score - a.score || a.mod.file.localeCompare(b.mod.file));

  lines.push(
    '---',
    '',
    `## 📋 AST-Prioritized Pending Contract Queue (${uncontracted.length} Modules)`,
    '',
    'Unannotated modules ranked automatically by AST **fan-in blast radius** and **cross-boundary exposure** (`Supabase DB`, `RPC`, `/api/*`, `CustomEvent`/`BroadcastChannel`, `localStorage`/Cookies, `process.env.*`):',
    ''
  );

  const highPriority = uncontracted.filter((item) => item.score >= 8);
  const standardPriority = uncontracted.filter((item) => item.score < 8);

  const renderPriorityRows = (items, emptyLabel) => {
    const out = [
      '| Priority Score | Module | Layer | Callers (Runtime / Type) | Cross-Boundary Touchpoints |',
      '| :---: | :--- | :--- | :---: | :--- |',
    ];
    for (const item of items) {
      const tpSummary =
        item.touchpoints.length > 0 ? escapeCell(item.touchpoints.join(' · ')) : emptyLabel;
      out.push(
        `| \`${item.score}\` | [\`${item.mod.file}\`](../${item.mod.file}) | ${item.mod.layer} | \`${item.ctx.runtimeCallers.length}\` / \`${item.ctx.typeOnlyCallers.length}\` | ${tpSummary} |`
      );
    }
    return out;
  };

  if (highPriority.length > 0) {
    lines.push(
      `### High-Coupling Priority Candidates (${highPriority.length} Modules, Score >= 8)`,
      '',
      ...renderPriorityRows(highPriority.slice(0, 50), 'Pure / internal')
    );
    if (highPriority.length > 50) {
      lines.push(
        '',
        `<details><summary>Remaining ${highPriority.length - 50} high-coupling candidates</summary>`,
        '',
        ...renderPriorityRows(highPriority.slice(50), 'Pure / internal'),
        '',
        '</details>'
      );
    }
    lines.push('');
  }

  if (standardPriority.length > 0) {
    lines.push(
      `<details><summary>Standard & Leaf Modules Pending Optional Annotation (${standardPriority.length} Modules)</summary>`,
      '',
      ...renderPriorityRows(standardPriority, 'Leaf / pure'),
      '',
      '</details>',
      ''
    );
  }

  lines.push(
    '---',
    '',
    '## 🔒 Verification & Compliance',
    '',
    'This living contract reference is compiled in **Pass 4** and validated in **Pass 5 of the 7-Gateway Quality Engine** (`npm run verify`, `npm run security:audit`) alongside Tier-1 protected module preservation and `ADR-XXX` cross-reference checks (`ADR-081`).',
    ''
  );

  return lines.join('\n');
}

const content = generateContractsMarkdown();
const normalizeLineEndings = (text) => String(text || '').replace(/\r\n/g, '\n').trim();
const existing = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf-8') : '';
if (existing && normalizeLineEndings(content) === normalizeLineEndings(existing)) {
  console.log('✔ [IDEMPOTENT] docs/SYSTEM_CONTRACTS.md contracts unchanged. Preserving existing specification.');
} else {
  fs.writeFileSync(outputPath, content, 'utf-8');
  console.log('✔ [SUCCESS] Living docs/SYSTEM_CONTRACTS.md generated successfully from AST.');
}

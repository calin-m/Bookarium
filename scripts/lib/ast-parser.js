/**
 * AST Parser Engine - Bookarium (Governance Rule 2)
 *
 * Programmatically inspects source code AST via Babel to provide a single
 * source of truth for architecture matrices, component catalogs, store schemas,
 * and dependency topologies with mathematical zero-drift.
 *
 * @module scripts/lib/ast-parser
 * @scope Central Babel 8 AST & SQL static analysis engine compiling module dependency graphs, cross-boundary coupling catalogs, `@scope`/`@invariant` contracts, SQL<->TS entities, `17`-map generator orphan checks, and Markdown Mermaid diagram syntax/cycle validation.
 * @invariant Separate runtime edges from `_(type)_` edges cleanly (`analyzeDependencyGraph`) with OS-independent codepoint sorting (`compareCodepoint`), detect import cycles (`hasCycles` strictly matches `cycles.length > 0`), normalize LF byte counts for text assets (`getDeterministicTextOrBinaryBytes`), and surface Babel syntax parse failures (`getAstParseErrors`) rather than silently swallowing broken modules.
 * @invariant Audit all `14` `generate-architecture-matrix.js` lookup registries plus `varMetaMap`, `workerRoleMap`, and `roleMap` (`findOrphanedGeneratorLookupKeys`), reject fatal Mermaid subgraph cycles, unquoted special-char edge labels, HTML-swallowed tags, undeclared endpoints, and strictly orphan nodes (`validateMermaidDiagramsInMarkdown`), enforce placeholder guards in JSDoc contract tags (`parseJsDocContractTags`), and expose `PROTECTED_CONTRACTED_MODULES` (`TIER_1`..`TIER_4`).
 * @rationale Providing one shared AST engine across `docs:sync` generators and `Pass 5` guarantees that architecture diagrams, contract docs, schema parity, and CI verification never diverge on different parsers or regexes.
 * @adr ADR-078, ADR-079, ADR-081
 */

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverseModule = require('@babel/traverse');
const traverse = traverseModule.default || traverseModule;

/**
 * OS-independent UTF-16 codepoint string comparator ensuring identical ordering
 * across Windows NTFS and Linux ext4/overlay filesystems regardless of locale.
 */
function compareCodepoint(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Computes LF-normalized UTF-8 byte length for text files (preventing CRLF vs LF
 * byte drift across Windows and Linux CI checkouts) while using raw byte size for binaries.
 */
function getDeterministicTextOrBinaryBytes(absPath, relPath) {
  if (/\.(sql|json|js|ts|tsx|mjs|cjs|css|md|svg|webmanifest|yml|yaml|txt)$/i.test(relPath)) {
    return Buffer.byteLength(fs.readFileSync(absPath, 'utf-8').replace(/\r\n/g, '\n'), 'utf-8');
  }
  return fs.statSync(absPath).size;
}

/**
 * Recursively retrieves all TypeScript/TSX source files, excluding test and mock suites.
 */
function getAllSourceFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir).sort(compareCodepoint);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'test' && file !== 'mocks' && file !== '__tests__') {
        getAllSourceFiles(filePath, fileList);
      }
    } else if (
      (file.endsWith('.ts') || file.endsWith('.tsx')) &&
      !file.endsWith('.test.ts') &&
      !file.endsWith('.test.tsx') &&
      !file.endsWith('.spec.ts') &&
      !file.endsWith('.spec.tsx')
    ) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

/**
 * Resolves an import source string to a relative project file key (e.g. 'src/components/foo.tsx').
 */
function resolveImportPath(importSource, currentFileRel, allFilesSet) {
  let candidate = '';
  if (importSource.startsWith('@/')) {
    candidate = importSource.replace(/^@\//, 'src/');
  } else if (importSource.startsWith('.')) {
    const currentDir = path.dirname(currentFileRel);
    candidate = path.join(currentDir, importSource).replace(/\\/g, '/');
  } else {
    return null; // External package
  }

  // Exact match
  if (allFilesSet.has(candidate)) return candidate;
  // With extension
  if (allFilesSet.has(`${candidate}.ts`)) return `${candidate}.ts`;
  if (allFilesSet.has(`${candidate}.tsx`)) return `${candidate}.tsx`;
  // Index file
  if (allFilesSet.has(`${candidate}/index.ts`)) return `${candidate}/index.ts`;
  if (allFilesSet.has(`${candidate}/index.tsx`)) return `${candidate}/index.tsx`;

  return null;
}

/**
 * Builds the complete dependency graph from source AST.
 */
function analyzeDependencyGraph(srcDir, rootDir) {
  const sourceFiles = getAllSourceFiles(srcDir);
  const allFilesSet = new Set(
    sourceFiles.map((f) => path.relative(rootDir, f).replace(/\\/g, '/'))
  );

  const graph = new Map();

  for (const file of sourceFiles) {
    const relativePath = path.relative(rootDir, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf-8');
    const rawImports = [];
    const internalImports = [];
    const staticImports = [];
    const runtimeImports = [];
    const exportedProps = [];
    const exportedInterfaces = [];
    const localInterfaces = new Map();
    let parseError = null;

    const isTypeOnlyImportNode = (node) =>
      node.importKind === 'type' ||
      (Array.isArray(node.specifiers) &&
        node.specifiers.length > 0 &&
        node.specifiers.every((spec) => spec.importKind === 'type'));

    const isTypeOnlyExportNode = (node) =>
      node.exportKind === 'type' ||
      (Array.isArray(node.specifiers) &&
        node.specifiers.length > 0 &&
        node.specifiers.every((spec) => spec.exportKind === 'type'));

    const extractMemberNames = (members = []) =>
      members
        .map((m) => (m.key && (m.key.name || m.key.value)) || null)
        .filter(Boolean);

    const extractTypeAnnotationMembers = (typeNode) => {
      if (!typeNode) return [];
      if (typeNode.type === 'TSTypeLiteral') {
        return extractMemberNames(typeNode.members);
      }
      if (typeNode.type === 'TSIntersectionType' && Array.isArray(typeNode.types)) {
        const merged = [];
        for (const memberType of typeNode.types) {
          merged.push(...extractTypeAnnotationMembers(memberType));
        }
        return Array.from(new Set(merged));
      }
      return [];
    };

    try {
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });

      traverse(ast, {
        ImportDeclaration({ node }) {
          const importSource = node.source.value;
          rawImports.push(importSource);
          if (importSource.startsWith('@/') || importSource.startsWith('.')) {
            internalImports.push(importSource);
            if (!isTypeOnlyImportNode(node)) {
              staticImports.push(importSource);
              runtimeImports.push(importSource);
            }
          }
        },
        ExportAllDeclaration({ node }) {
          if (node.source && node.source.value) {
            const importSource = node.source.value;
            rawImports.push(importSource);
            if (importSource.startsWith('@/') || importSource.startsWith('.')) {
              internalImports.push(importSource);
              if (node.exportKind !== 'type') {
                staticImports.push(importSource);
                runtimeImports.push(importSource);
              }
            }
          }
        },
        ExportNamedDeclaration({ node }) {
          if (node.source && node.source.value) {
            const importSource = node.source.value;
            rawImports.push(importSource);
            if (importSource.startsWith('@/') || importSource.startsWith('.')) {
              internalImports.push(importSource);
              if (!isTypeOnlyExportNode(node)) {
                staticImports.push(importSource);
                runtimeImports.push(importSource);
              }
            }
          }
        },
        CallExpression({ node }) {
          if (node.callee && node.callee.type === 'Import') {
            const arg = node.arguments && node.arguments[0];
            if (arg && (arg.type === 'StringLiteral' || arg.type === 'Literal') && arg.value) {
              const importSource = arg.value;
              rawImports.push(importSource);
              if (importSource.startsWith('@/') || importSource.startsWith('.')) {
                internalImports.push(importSource);
                runtimeImports.push(importSource);
              }
            }
          }
        },
        ImportExpression({ node }) {
          const arg = node.source;
          if (arg && (arg.type === 'StringLiteral' || arg.type === 'Literal') && arg.value) {
            const importSource = arg.value;
            rawImports.push(importSource);
            if (importSource.startsWith('@/') || importSource.startsWith('.')) {
              internalImports.push(importSource);
              runtimeImports.push(importSource);
            }
          }
        },
        TSInterfaceDeclaration({ node }) {
          if (node.id && node.id.name) {
            const propNames = extractMemberNames(node.body && node.body.body);
            const extendsNames = (node.extends || [])
              .map((ext) => (ext.expression && ext.expression.type === 'Identifier' ? ext.expression.name : null))
              .filter(Boolean);
            const iface = {
              name: node.id.name,
              props: propNames,
              extendsNames,
            };
            localInterfaces.set(node.id.name, iface);
            exportedInterfaces.push(iface);
            if (node.id.name.endsWith('Props')) {
              exportedProps.push(iface);
            }
          }
        },
        TSTypeAliasDeclaration({ node }) {
          if (node.id && node.id.name && node.typeAnnotation) {
            const isStructuredType =
              node.typeAnnotation.type === 'TSTypeLiteral' || node.typeAnnotation.type === 'TSIntersectionType';
            if (isStructuredType) {
              const propNames = extractTypeAnnotationMembers(node.typeAnnotation);
              const extendsRefs =
                node.typeAnnotation.type === 'TSIntersectionType' && Array.isArray(node.typeAnnotation.types)
                  ? node.typeAnnotation.types
                      .map((t) =>
                        t.type === 'TSTypeReference' && t.typeName && t.typeName.type === 'Identifier'
                          ? t.typeName.name
                          : null
                      )
                      .filter(Boolean)
                  : [];
              const typeInfo = {
                name: node.id.name,
                props: propNames,
                extendsNames: extendsRefs,
              };
              localInterfaces.set(node.id.name, typeInfo);
              exportedInterfaces.push(typeInfo);
              if (node.id.name.endsWith('Props')) {
                exportedProps.push(typeInfo);
              }
            }
          }
        },
      });
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
      // Regex fallback for unparseable chunks
      const importRegex = /(?:import|export\s+.*?from|import\s*\()\s*['"](@\/.*?|\..*?)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        internalImports.push(match[1]);
      }
    }

    // Capture Web Worker references via new URL(..., import.meta.url)
    const workerMatch = content.match(/new\s+(?:window\.)?Worker\s*\(\s*new\s+URL\s*\(\s*['"]([^'"]+)['"]/);
    if (workerMatch && workerMatch[1]) {
      internalImports.push(workerMatch[1]);
      runtimeImports.push(workerMatch[1]);
    }

    graph.set(relativePath, {
      file: relativePath,
      absolutePath: file,
      imports: Array.from(new Set(internalImports)),
      staticImports: Array.from(new Set(staticImports)),
      runtimeImports: Array.from(new Set(runtimeImports)),
      rawImports: Array.from(new Set(rawImports)),
      exportedProps,
      exportedInterfaces,
      localInterfaces,
      parseError,
      resolvedImports: [],
      resolvedStaticImports: [],
      resolvedRuntimeImports: [],
      typeOnlyImports: [],
      consumedBy: [],
      runtimeConsumedBy: [],
      typeOnlyConsumedBy: [],
    });
  }

  // Global interface index for cross-file interface inheritance resolution
  const globalInterfaceRegistry = new Map();
  for (const data of graph.values()) {
    for (const iface of data.exportedInterfaces) {
      if (!globalInterfaceRegistry.has(iface.name)) {
        globalInterfaceRegistry.set(iface.name, iface);
      }
    }
  }

  const resolveInheritedProps = (iface, localMap, visited = new Set()) => {
    if (!iface || visited.has(iface.name)) return [];
    visited.add(iface.name);
    const collected = [...(iface.props || [])];
    for (const baseName of iface.extendsNames || []) {
      const baseIface = localMap.get(baseName) || globalInterfaceRegistry.get(baseName);
      if (baseIface) {
        collected.push(...resolveInheritedProps(baseIface, localMap, visited));
      }
    }
    return Array.from(new Set(collected));
  };

  for (const data of graph.values()) {
    for (const iface of data.exportedInterfaces) {
      if (iface.extendsNames && iface.extendsNames.length > 0) {
        iface.props = resolveInheritedProps(iface, data.localInterfaces);
      }
    }
  }

  // Resolve internal linkage and downstream consumers (separating runtime vs type-only edges)
  for (const [fileRel, data] of graph.entries()) {
    for (const imp of data.imports) {
      const resolved = resolveImportPath(imp, fileRel, allFilesSet);
      if (resolved && graph.has(resolved)) {
        if (!data.resolvedImports.includes(resolved)) {
          data.resolvedImports.push(resolved);
        }
        const targetData = graph.get(resolved);
        if (!targetData.consumedBy.includes(fileRel)) {
          targetData.consumedBy.push(fileRel);
        }
      }
    }
    for (const imp of data.staticImports) {
      const resolved = resolveImportPath(imp, fileRel, allFilesSet);
      if (resolved && graph.has(resolved) && !data.resolvedStaticImports.includes(resolved)) {
        data.resolvedStaticImports.push(resolved);
      }
    }
    for (const imp of data.runtimeImports) {
      const resolved = resolveImportPath(imp, fileRel, allFilesSet);
      if (resolved && graph.has(resolved)) {
        if (!data.resolvedRuntimeImports.includes(resolved)) {
          data.resolvedRuntimeImports.push(resolved);
        }
        const targetData = graph.get(resolved);
        if (!targetData.runtimeConsumedBy.includes(fileRel)) {
          targetData.runtimeConsumedBy.push(fileRel);
        }
      }
    }
    for (const resolved of data.resolvedImports) {
      if (!data.resolvedRuntimeImports.includes(resolved)) {
        data.typeOnlyImports.push(resolved);
      }
    }
  }

  for (const data of graph.values()) {
    data.typeOnlyConsumedBy = data.consumedBy.filter(
      (consumer) => !data.runtimeConsumedBy.includes(consumer)
    );
    data.consumedBy.sort(compareCodepoint);
    data.runtimeConsumedBy.sort(compareCodepoint);
    data.typeOnlyConsumedBy.sort(compareCodepoint);
  }

  return graph;
}

/**
 * Executes Tarjan's / DFS cycle detection on the dependency graph to mathematically
 * verify the presence or absence of circular dependencies.
 */
function detectCircularDependencies(graph) {
  const visited = new Set();
  const recStack = new Set();
  const cycles = [];

  function dfs(node, pathStack = []) {
    visited.add(node);
    recStack.add(node);
    pathStack.push(node);

    const nodeData = graph.get(node);
    if (nodeData) {
      const neighbors = nodeData.resolvedStaticImports || nodeData.resolvedImports;
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...pathStack]);
        } else if (recStack.has(neighbor)) {
          const cycleStart = pathStack.indexOf(neighbor);
          if (cycleStart !== -1) {
            cycles.push([...pathStack.slice(cycleStart), neighbor]);
          }
        }
      }
    }

    recStack.delete(node);
  }

  for (const file of graph.keys()) {
    if (!visited.has(file)) {
      dfs(file, []);
    }
  }

  return {
    hasCycles: cycles.length > 0,
    cycleCount: cycles.length,
    cycles,
  };
}

/**
 * Collects files in the dependency graph where Babel AST parsing failed cleanly
 * so verification gates fail loudly instead of silently degrading graph visibility.
 */
function getAstParseErrors(graph) {
  const errors = [];
  for (const data of graph.values()) {
    if (data.parseError) {
      errors.push({ file: data.file, error: data.parseError });
    }
  }
  return errors;
}

/**
 * Enforces directional architectural layer boundaries across static runtime imports
 * (excluding type-only `import type` references) to prevent inverted coupling.
 */
function detectLayerViolations(graph) {
  const violations = [];
  const forbiddenUiTargets = [
    /^src\/stores\//,
    /^src\/app\//,
    /^src\/components\/(?:presentation|reader|account|auth|symposium|profile|accolades)\//,
  ];
  const forbiddenLibTargets = [/^src\/components\//, /^src\/hooks\//, /^src\/app\//];

  for (const [file, data] of graph.entries()) {
    const targets = data.resolvedStaticImports || [];
    if (file.startsWith('src/components/ui/')) {
      for (const target of targets) {
        if (forbiddenUiTargets.some((re) => re.test(target))) {
          violations.push({
            file,
            target,
            rule: 'UI primitive (`src/components/ui/**`) must not statically import domain stores, App Router modules, or feature components.',
          });
        }
      }
    } else if (file.startsWith('src/lib/')) {
      for (const target of targets) {
        if (forbiddenLibTargets.some((re) => re.test(target))) {
          violations.push({
            file,
            target,
            rule: 'Domain module (`src/lib/**`) must not statically import UI components, React hooks, or App Router modules.',
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Identifies orphaned modules that have zero consumers and are not legitimate framework entrypoints.
 */
function detectOrphanedModules(graph) {
  const entrypointPatterns = [
    /src\/app\/.*page\.tsx$/,
    /src\/app\/.*layout\.tsx$/,
    /src\/app\/.*route\.ts$/,
    /src\/app\/.*error\.tsx$/,
    /src\/app\/.*loading\.tsx$/,
    /src\/app\/.*not-found\.tsx$/,
    /src\/app\/manifest\.ts$/,
    /src\/app\/robots\.ts$/,
    /src\/app\/sitemap\.ts$/,
    /src\/app\/providers\.tsx$/,
    /src\/app\/globals\.css$/,
    /src\/proxy\.ts$/,
    /src\/components\/motion\/.*\.tsx$/,
  ];

  const orphans = [];
  for (const [file, data] of graph.entries()) {
    if (data.consumedBy.length === 0) {
      const isEntry = entrypointPatterns.some((p) => p.test(file));
      if (!isEntry) {
        orphans.push(file);
      }
    }
  }
  return orphans;
}

/**
 * Extracts a complete catalog of all UI components in src/components/ with their interface props.
 */
function extractComponentCatalog(graph) {
  const components = [];

  for (const [file, data] of graph.entries()) {
    if (!file.startsWith('src/components/')) continue;

    const parts = file.split('/');
    const category = parts.slice(2, -1).join('/') || 'general';
    const filename = parts[parts.length - 1];
    const componentName = filename.replace(/\.(tsx|ts)$/, '');

    // Skip index or barrel files if any
    if (componentName === 'index') continue;

    let propsInterface = '_Autonomous_';
    let propSignals = 'None (Self-Contained)';

    // Find the most appropriate props interface
    const matchingProps =
      data.exportedProps.find((p) => p.name === `${componentName}Props`) ||
      data.exportedProps[0] ||
      data.exportedInterfaces.find((i) => i.name.endsWith('Props'));

    if (matchingProps) {
      propsInterface = `\`${matchingProps.name}\``;
      propSignals =
        matchingProps.props.length > 0
          ? matchingProps.props.map((p) => `\`${p}\``).join(', ')
          : 'None (Void Props)';
    }

    components.push({
      name: componentName,
      category,
      file,
      propsInterface,
      propSignals,
      consumerCount: data.consumedBy.length,
      importCount: data.imports.length,
    });
  }

  return components.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

/**
 * Extracts store architecture details from src/stores/.
 */
function extractStoreCatalog(srcDir) {
  const storesDir = path.join(srcDir, 'stores');
  if (!fs.existsSync(storesDir)) return [];

  const storeFiles = fs
    .readdirSync(storesDir)
    .filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));

  const stores = [];

  for (const file of storeFiles) {
    const filePath = path.join(storesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const storeName = file.replace(/\.(ts|tsx)$/, '');

    // Extract storage key if persisted using Babel AST (with regex fallback)
    let storageKey = 'In-Memory (Ephemeral)';
    let extractedViaAst = false;
    try {
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });
      traverse(ast, {
        CallExpression({ node }) {
          if (node.callee && node.callee.type === 'Identifier' && node.callee.name === 'persist') {
            const configArg = node.arguments && node.arguments[1];
            if (configArg && configArg.type === 'ObjectExpression') {
              for (const prop of configArg.properties || []) {
                if (
                  prop.type === 'ObjectProperty' &&
                  prop.key &&
                  ((prop.key.type === 'Identifier' && prop.key.name === 'name') ||
                    (prop.key.type === 'StringLiteral' && prop.key.value === 'name'))
                ) {
                  if (prop.value.type === 'StringLiteral') {
                    storageKey = `\`${prop.value.value}\` (localStorage)`;
                    extractedViaAst = true;
                  } else if (
                    prop.value.type === 'MemberExpression' &&
                    prop.value.object &&
                    prop.value.object.type === 'Identifier' &&
                    prop.value.object.name === 'STORAGE_KEYS' &&
                    prop.value.property &&
                    prop.value.property.type === 'Identifier'
                  ) {
                    storageKey = `\`STORAGE_KEYS.${prop.value.property.name}\` (localStorage)`;
                    extractedViaAst = true;
                  }
                }
              }
            }
          }
        },
      });
    } catch (_err) {
      // Fall back to regex inspection below
    }

    if (!extractedViaAst) {
      const storageKeyMatch = content.match(/name:\s*['"]([^'"]+)['"]/);
      if (storageKeyMatch) {
        storageKey = `\`${storageKeyMatch[1]}\` (localStorage)`;
      } else if (content.includes('STORAGE_KEYS.')) {
        const constMatch = content.match(/STORAGE_KEYS\.([A-Z_]+)/);
        if (constMatch) {
          storageKey = `\`STORAGE_KEYS.${constMatch[1]}\` (localStorage)`;
        }
      }
    }

    stores.push({
      name: storeName,
      file: `src/stores/${file}`,
      storageKey,
      content,
    });
  }

  return stores.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Extracts API/server routes, App Router entrypoints, and custom hooks across the application.
 */
function extractApiAndHookCatalog(srcDir) {
  const appDir = path.join(srcDir, 'app');
  const routes = [];
  const appPages = [];

  function scanApp(dir, routePath = '') {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanApp(full, `${routePath}/${entry.name}`);
      } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
        const content = fs.readFileSync(full, 'utf-8');
        const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
        const methods = httpMethods.filter((method) =>
          new RegExp(
            `export\\s+(?:async\\s+function\\s+${method}\\b|const\\s+${method}\\s*=)`
          ).test(content)
        );

        routes.push({
          path: routePath || '/',
          file: path.relative(path.resolve(srcDir, '..'), full).replace(/\\/g, '/'),
          methods: methods.length > 0 ? methods.join(', ') : 'GET',
        });
      } else if (
        entry.name === 'page.tsx' ||
        entry.name === 'layout.tsx' ||
        entry.name === 'providers.tsx' ||
        entry.name === 'globals.css' ||
        entry.name === 'error.tsx' ||
        entry.name === 'global-error.tsx' ||
        entry.name === 'loading.tsx' ||
        entry.name === 'not-found.tsx' ||
        entry.name === 'manifest.ts' ||
        entry.name === 'robots.ts' ||
        entry.name === 'sitemap.ts'
      ) {
        const fileRel = path.relative(path.resolve(srcDir, '..'), full).replace(/\\/g, '/');
        const content = fs.readFileSync(full, 'utf-8');
        const isClient = content.includes("'use client'") || content.includes('"use client"');
        let routeUri = routePath || '/';
        let kind = 'App Page';
        let rendering = isClient ? 'Client Interactive (`"use client"`)' : 'React Server Component (SSR / Static)';
        if (entry.name === 'layout.tsx') {
          kind = routeUri === '/' ? 'Root Layout' : 'Route Layout & SSR Metadata';
        } else if (entry.name === 'providers.tsx') {
          routeUri = '/ (Root Provider)';
          kind = 'Root Client Provider & Auth/Sync Orchestrator';
        } else if (entry.name === 'globals.css') {
          routeUri = '/ (Global CSS)';
          kind = 'Tailwind CSS v4 Oxide Theme & 3D Book Surface Stylesheet';
          rendering = 'PostCSS / Tailwind CSS v4 Oxide Bundle';
        } else if (entry.name === 'error.tsx' || entry.name === 'global-error.tsx') {
          kind = 'App Error Boundary';
        } else if (entry.name === 'loading.tsx') {
          kind = 'App Streaming & Pre-Hydration Splash Boundary';
        } else if (entry.name === 'not-found.tsx') {
          kind = 'App 404 Boundary';
        } else if (entry.name === 'manifest.ts') {
          routeUri = '/manifest.webmanifest';
          kind = 'PWA Metadata Route';
        } else if (entry.name === 'robots.ts') {
          routeUri = '/robots.txt';
          kind = 'SEO Metadata Route';
        } else if (entry.name === 'sitemap.ts') {
          routeUri = '/sitemap.xml';
          kind = 'SEO Metadata Route';
        }

        appPages.push({
          route: routeUri,
          kind,
          rendering,
          file: fileRel,
        });
      }
    }
  }

  scanApp(appDir);

  const hooksDir = path.join(srcDir, 'hooks');
  const hooks = [];

  function scanHooks(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanHooks(full);
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.test.tsx') &&
        entry.name.startsWith('use')
      ) {
        hooks.push({
          name: entry.name.replace(/\.(ts|tsx)$/, ''),
          file: path.relative(path.resolve(srcDir, '..'), full).replace(/\\/g, '/'),
          category: path.basename(dir),
        });
      }
    }
  }

  scanHooks(hooksDir);

  return {
    routes: routes.sort((a, b) => a.path.localeCompare(b.path)),
    appPages: appPages.sort((a, b) => a.file.localeCompare(b.file)),
    hooks: hooks.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
  };
}

/**
 * Extracts domain utilities and computational engines from src/lib/ and route-co-located server utilities in src/app/.
 */
function extractDomainUtilitiesCatalog(srcDir) {
  const libDir = path.join(srcDir, 'lib');
  const appDir = path.join(srcDir, 'app');
  const utilities = [];

  function parseFileExports(full) {
    const content = fs.readFileSync(full, 'utf-8');
    const exportedItems = [];

    try {
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });

      traverse(ast, {
        ExportNamedDeclaration({ node }) {
          if (node.declaration) {
            if (node.declaration.declarations) {
              for (const dec of node.declaration.declarations) {
                if (dec.id && dec.id.name) exportedItems.push(dec.id.name);
              }
            } else if (node.declaration.id && node.declaration.id.name) {
              exportedItems.push(node.declaration.id.name);
            }
          }
          if (node.specifiers) {
            for (const spec of node.specifiers) {
              if (spec.exported && spec.exported.name) exportedItems.push(spec.exported.name);
            }
          }
        },
        ExportDefaultDeclaration({ node }) {
          if (node.declaration && node.declaration.id && node.declaration.id.name) {
            exportedItems.push(node.declaration.id.name);
          } else {
            exportedItems.push('default');
          }
        },
        ExportAllDeclaration({ node }) {
          if (node.source && node.source.value) {
            exportedItems.push(`* (${node.source.value})`);
          }
        },
      });
    } catch (_err) {
      const exportRegex = /export\s+(?:async\s+)?(?:function|const|class|type|interface)\s+([A-Za-z0-9_]+)/g;
      let match;
      while ((match = exportRegex.exec(content)) !== null) {
        exportedItems.push(match[1]);
      }
      const starRegex = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;
      while ((match = starRegex.exec(content)) !== null) {
        exportedItems.push(`* (${match[1]})`);
      }
    }

    return Array.from(new Set(exportedItems));
  }

  function scanLib(dir, relPath = 'src/lib') {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'mocks' && entry.name !== 'test') {
          scanLib(full, `${relPath}/${entry.name}`);
        }
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.test.tsx') &&
        !entry.name.endsWith('.d.ts')
      ) {
        const fileRel = `${relPath}/${entry.name}`;
        const utilityName = entry.name.replace(/\.(ts|tsx)$/, '');
        const subfolder = path.basename(dir) === 'lib' ? 'Core Domain' : path.basename(dir);

        utilities.push({
          name: utilityName,
          filename: entry.name,
          file: fileRel,
          subsystem: subfolder.charAt(0).toUpperCase() + subfolder.slice(1),
          exports: parseFileExports(full),
        });
      }
    }
  }

  function scanAppUtilities(dir, relPath = 'src/app') {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const reservedAppFiles = new Set(['route.ts', 'route.js', 'page.tsx', 'layout.tsx', 'manifest.ts', 'robots.ts', 'sitemap.ts']);
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanAppUtilities(full, `${relPath}/${entry.name}`);
      } else if (
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.d.ts') &&
        !reservedAppFiles.has(entry.name)
      ) {
        const fileRel = `${relPath}/${entry.name}`;
        const utilityName = entry.name.replace(/\.ts$/, '');
        const subsystem = fileRel.includes('src/app/api/') ? 'Edge Route Engine' : 'SSR Route Engine';

        utilities.push({
          name: utilityName,
          filename: entry.name,
          file: fileRel,
          subsystem,
          exports: parseFileExports(full),
        });
      }
    }
  }

  scanLib(libDir);
  scanAppUtilities(appDir);
  return utilities.sort((a, b) => a.file.localeCompare(b.file));
}

/**
 * Extracts configuration fixtures, tokens, and routing constants from src/config/.
 */
function extractConfigurationCatalog(srcDir) {
  const configDir = path.join(srcDir, 'config');
  if (!fs.existsSync(configDir)) return [];

  const files = fs
    .readdirSync(configDir)
    .filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));

  const configs = [];

  for (const file of files) {
    const full = path.join(configDir, file);
    const content = fs.readFileSync(full, 'utf-8');
    const exportedConstants = [];
    const exportedFunctions = [];
    const exportedTypes = [];

    try {
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });

      traverse(ast, {
        ExportNamedDeclaration({ node }) {
          if (node.declaration) {
            if (node.declaration.declarations) {
              for (const dec of node.declaration.declarations) {
                if (dec.id && dec.id.name) {
                  let extra = '';
                  if (dec.init && dec.init.type === 'ArrayExpression') {
                    extra = ` (${dec.init.elements.length} items)`;
                  }
                  exportedConstants.push(`${dec.id.name}${extra}`);
                }
              }
            } else if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
              exportedFunctions.push(node.declaration.id.name);
            } else if (
              (node.declaration.type === 'TSInterfaceDeclaration' ||
                node.declaration.type === 'TSTypeAliasDeclaration') &&
              node.declaration.id
            ) {
              exportedTypes.push(node.declaration.id.name);
            }
          }
          if (node.specifiers) {
            for (const spec of node.specifiers) {
              if (spec.exported && spec.exported.name) {
                exportedConstants.push(spec.exported.name);
              }
            }
          }
        },
      });
    } catch (_err) {
      const constMatches = content.matchAll(/export\s+const\s+([A-Za-z0-9_]+)/g);
      for (const m of constMatches) exportedConstants.push(m[1]);
      const fnMatches = content.matchAll(/export\s+function\s+([A-Za-z0-9_]+)/g);
      for (const m of fnMatches) exportedFunctions.push(m[1]);
    }

    const configName = file.replace(/\.(ts|tsx)$/, '');
    configs.push({
      name: configName,
      file: `src/config/${file}`,
      constants: Array.from(new Set(exportedConstants)),
      functions: Array.from(new Set(exportedFunctions)),
      types: Array.from(new Set(exportedTypes)),
    });
  }

  return configs.sort((a, b) => a.file.localeCompare(b.file));
}

/**
 * Extracts canonical domain type contracts and database row models from src/types/.
 */
function extractTypeCatalog(srcDir) {
  const typesDir = path.join(srcDir, 'types');
  if (!fs.existsSync(typesDir)) return [];

  const files = fs
    .readdirSync(typesDir)
    .filter((f) => (f.endsWith('.ts') || f.endsWith('.d.ts')) && !f.endsWith('.test.ts'));

  const typeModules = [];

  for (const file of files) {
    const full = path.join(typesDir, file);
    const content = fs.readFileSync(full, 'utf-8');
    const interfaces = [];
    const typeAliases = [];

    try {
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: ['typescript'],
      });

      traverse(ast, {
        ExportNamedDeclaration({ node }) {
          if (node.declaration) {
            if (node.declaration.type === 'TSInterfaceDeclaration' && node.declaration.id) {
              interfaces.push(node.declaration.id.name);
            } else if (node.declaration.type === 'TSTypeAliasDeclaration' && node.declaration.id) {
              typeAliases.push(node.declaration.id.name);
            }
          }
        },
      });
    } catch (_err) {
      const ifaceMatches = content.matchAll(/export\s+interface\s+([A-Za-z0-9_]+)/g);
      for (const m of ifaceMatches) interfaces.push(m[1]);
      const typeMatches = content.matchAll(/export\s+type\s+([A-Za-z0-9_]+)/g);
      for (const m of typeMatches) typeAliases.push(m[1]);
    }

    typeModules.push({
      name: file.replace(/\.(ts|d\.ts)$/, ''),
      file: `src/types/${file}`,
      interfaces: Array.from(new Set(interfaces)),
      typeAliases: Array.from(new Set(typeAliases)),
    });
  }

  return typeModules.sort((a, b) => a.file.localeCompare(b.file));
}

/**
 * Programmatically extracts the live Service Worker CACHE_NAME and version tag from public/sw.js.
 */
function extractServiceWorkerMetadata(rootDir) {
  const swPath = path.join(rootDir, 'public', 'sw.js');
  let cacheName = 'bookarium-app-shell-v7';
  let versionLabel = 'v7';

  if (fs.existsSync(swPath)) {
    const content = fs.readFileSync(swPath, 'utf-8');
    const match = content.match(/const\s+CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
    if (match && match[1]) {
      cacheName = match[1];
      const verMatch = cacheName.match(/-(v\d+)$/i);
      if (verMatch && verMatch[1]) {
        versionLabel = verMatch[1];
      }
    }
  }

  return { cacheName, versionLabel };
}

/**
 * Extracts Web Worker and PWA Service Worker architecture modules from src/workers/ and public/.
 */
function extractWorkerCatalog(srcDir) {
  const workersDir = path.join(srcDir, 'workers');
  const workers = [];
  const workerRoleMap = {
    'gutenberg.worker':
      'Dedicated off-thread Web Worker parsing raw Project Gutenberg plain-text AST, calculating chapter segmentation boundaries, and computing fluid paginated layouts without blocking the UI thread.',
  };

  if (fs.existsSync(workersDir)) {
    const files = fs
      .readdirSync(workersDir)
      .filter((f) => (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.test.ts') && !f.endsWith('.test.js'));

    for (const file of files) {
      const workerName = file.replace(/\.(ts|js)$/, '');
      workers.push({
        name: workerName,
        file: `src/workers/${file}`,
        role: workerRoleMap[workerName] || 'Background Web Worker script.',
      });
    }
  }

  const rootDir = path.resolve(srcDir, '..');
  const swPath = path.join(rootDir, 'public', 'sw.js');
  if (fs.existsSync(swPath)) {
    const swMeta = extractServiceWorkerMetadata(rootDir);
    workers.push({
      name: 'sw',
      file: 'public/sw.js',
      role: `Progressive Web App (PWA) Service Worker (\`${swMeta.cacheName}\`) providing offline App Shell caching (\`/\` + \`/account\` + \`/read/1342\`), bounded same-origin \`CACHE_URLS\` sanitization (\`<= 100\`, excluding \`/auth/\` and \`/api/\`), HTML-embedded \`/_next/static/\` chunk extraction, \`_rsc\` Flight isolation, cross-origin pass-through, and \`/read/*\` navigation fallback for 100% offline reading.`,
    });
  }

  return workers;
}

/**
 * Extracts Vitest / RTL test case titles from a test file via Babel AST
 * (preserving embedded quotes cleanly without regex quote clipping).
 */
function extractTestsFromSourceAst(content) {
  const titles = [];
  const testCallNames = new Set(['it', 'test']);
  const testModifiers = new Set(['only', 'skip']);

  try {
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
    traverse(ast, {
      CallExpression({ node }) {
        const callee = node.callee;
        let isTestCall = false;
        if (callee && callee.type === 'Identifier' && testCallNames.has(callee.name)) {
          isTestCall = true;
        } else if (
          callee &&
          callee.type === 'MemberExpression' &&
          callee.object &&
          callee.object.type === 'Identifier' &&
          testCallNames.has(callee.object.name) &&
          callee.property &&
          callee.property.type === 'Identifier' &&
          testModifiers.has(callee.property.name)
        ) {
          isTestCall = true;
        }
        if (!isTestCall) return;

        const firstArg = node.arguments && node.arguments[0];
        if (!firstArg) return;
        if (firstArg.type === 'StringLiteral' && firstArg.value) {
          titles.push(firstArg.value);
        } else if (firstArg.type === 'TemplateLiteral' && Array.isArray(firstArg.quasis)) {
          const rawTitle = firstArg.quasis.map((q) => q.value && q.value.raw).join('${...}');
          if (rawTitle) titles.push(rawTitle);
        }
      },
    });
    return titles;
  } catch (_err) {
    const matches = [...content.matchAll(/(?:it|test)(?:\.skip|\.only)?\s*\(\s*(['"`])([\s\S]*?)\1/g)];
    return matches.map((m) => m[2]);
  }
}

/**
 * Extracts canonical SQL table names, indexes, triggers, and stored functions
 * from idempotent `supabase/schema.sql` DDL using balanced parameter scanning.
 */
function extractSqlSchemaEntities(schemaSql) {
  const content = String(schemaSql || '');
  const hasMigrationLedger = content.includes(
    'CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations'
  );

  const tableNames = [];
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.(\w+)\s*\([\s\S]*?\r?\n[ \t]*\);/gi;
  let tableMatch;
  while ((tableMatch = tableRegex.exec(content)) !== null) {
    tableNames.push(tableMatch[1]);
  }

  const indexes = [];
  const idxRegex =
    /CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+(\w+)\s+ON\s+(public\.\w+)\s*(?:USING\s+(GIN)\s*)?\(([^;]+?)\)(?:\s+WHERE\s+([^;]+?))?;/gi;
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
    else if (whereClause) idxType = 'Partial B-Tree Index';

    indexes.push({
      name: idxName,
      type: idxType,
      table: targetTable,
      definition: `\`(${expr})${whereClause}\``,
    });
  }

  const triggers = [];
  const triggersByFunction = new Map();
  const triggerRegex =
    /CREATE\s+TRIGGER\s+(\w+)\s+[\s\S]*?ON\s+([\w.]+)\s+FOR\s+EACH\s+ROW\s+EXECUTE\s+FUNCTION\s+public\.(\w+)\s*\([^)]*\)\s*;/gi;
  let trgMatch;
  while ((trgMatch = triggerRegex.exec(content)) !== null) {
    const trgName = trgMatch[1];
    const trgTable = trgMatch[2];
    const fnName = trgMatch[3];
    triggers.push({ name: trgName, table: trgTable, functionName: fnName });
    if (!triggersByFunction.has(fnName)) {
      triggersByFunction.set(fnName, []);
    }
    triggersByFunction.get(fnName).push({ name: trgName, table: trgTable });
  }

  // Balanced parenthesis scan on CREATE OR REPLACE FUNCTION so defaults/types like numeric(10, 2) or DEFAULT now() never clip
  const functions = [];
  const fnHeaderRegex = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.(\w+)\s*\(/gi;
  let fnHeaderMatch;
  while ((fnHeaderMatch = fnHeaderRegex.exec(content)) !== null) {
    const fnName = fnHeaderMatch[1];
    let cursor = fnHeaderRegex.lastIndex;
    let depth = 1;
    let inSingleQuote = false;
    while (cursor < content.length && depth > 0) {
      const ch = content[cursor];
      if (ch === "'" && content[cursor - 1] !== '\\') {
        inSingleQuote = !inSingleQuote;
      } else if (!inSingleQuote) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
      }
      cursor++;
    }
    if (depth !== 0) continue;
    const afterArgs = content.slice(cursor, cursor + 1500);
    const returnsMatch = afterArgs.match(/^\s*RETURNS\s+([\s\S]+?)\s+LANGUAGE\b/i);
    if (!returnsMatch) continue;
    const returnType = returnsMatch[1].replace(/\s+/g, ' ').trim().toUpperCase();
    functions.push({
      rawName: fnName,
      returnType,
    });
  }

  const hasRlsAutoEnable = content.includes("p.proname = 'rls_auto_enable'");
  const policyCount = (content.match(/CREATE\s+POLICY\s+/gi) || []).length;
  const checkConstraintCount = (content.match(/ADD\s+CONSTRAINT\s+chk_\w+/gi) || []).length;

  return {
    hasMigrationLedger,
    tableNames,
    indexes,
    triggers,
    triggersByFunction,
    functions,
    hasRlsAutoEnable,
    policyCount,
    checkConstraintCount,
  };
}
function extractTestHarnessCatalog(srcDir, rootDir) {
  const harnessModules = [];

  const candidates = [
    {
      name: 'setup',
      file: 'src/test/setup.ts',
      layer: 'JSDOM & Browser API Test Bootstrap',
      role: 'Global Vitest setup bootstrapping `@testing-library/jest-dom/vitest`, fail-closed MSW v2 server lifecycle (`handleUnhandledMswRequest`, `resetHandlers`, `close`), pre-test `next/dynamic` chunk resolution (`pendingDynamicImports`), `localStorage` sanitization, and deterministic JSDOM polyfills (`matchMedia`, `ResizeObserver`, `IntersectionObserver`, `scrollTo`, `SpeechSynthesis`, `IndexedDB`).',
    },
    {
      name: 'handlers',
      file: 'src/mocks/handlers.ts',
      layer: 'MSW v2 HTTP Interception Handlers',
      role: 'Canonical Mock Service Worker v2 HTTP request handlers, fail-closed `handleUnhandledMswRequest` guard (blocking unmocked external/PG/Supabase URLs and same-origin `/api/*` calls), hosted `*.supabase.co` & local `:54321` `(rest|auth|storage|realtime|functions|graphql)/v1` 503 catch-alls, and `mockBooks` fixtures intercepting `/api/books`, `/api/books/content`, and `/api/books/translations` for zero-network deterministic testing.',
    },
    {
      name: 'server',
      file: 'src/mocks/server.ts',
      layer: 'MSW v2 Node Server Instance',
      role: 'Node.js `setupServer(...handlers)` singleton providing hermetic request interception across all unit and integration test suites.',
    },
    {
      name: 'vitest.config.mts',
      file: 'vitest.config.mts',
      layer: 'Vitest Runner & Tiered V8 Coverage Engine (95/95/92/85)',
      role: 'Vite-native test runner configuration (`jsdom`, `maxWorkers: 4`, `@` path alias) enforcing the hard tiered V8 coverage floor (`lines: 95%`, `statements: 95%`, `functions: 92%`, `branches: 85%`) while excluding non-executable type contracts and barrels.',
    },
  ];

  for (const c of candidates) {
    const full = path.join(rootDir, c.file);
    if (fs.existsSync(full)) {
      harnessModules.push(c);
    }
  }

  const testSuites = [];
  function scanTests(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== 'coverage') {
          scanTests(full);
        }
      } else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
        const rel = path.relative(rootDir, full).replace(/\\/g, '/');
        testSuites.push(rel);
      }
    }
  }

  scanTests(srcDir);
  scanTests(path.join(rootDir, 'scripts'));

  const srcSuiteCount = testSuites.filter((f) => f.startsWith('src/')).length;
  const scriptSuites = testSuites.filter((f) => f.startsWith('scripts/'));

  const layerDefs = [
    {
      id: 'app',
      layer: 'App Router Pages, Layouts & API Routes',
      scope: '`src/app/**/*.test.{ts,tsx}`',
      match: (f) => f.startsWith('src/app/'),
      strategy: 'NextRequest/NextResponse edge route verification, fail-closed R2/DB outage testing, SSR metadata, and full-page user journeys.',
    },
    {
      id: 'components',
      layer: 'React 19 UI & Presentation Components',
      scope: '`src/components/**/*.test.tsx`',
      match: (f) => f.startsWith('src/components/'),
      strategy: '`@testing-library/react` + `userEvent` accessible role assertions (`getByRole`), WCAG 2.2 focus trapping, confirmation modals, and viewport interaction parity.',
    },
    {
      id: 'stores',
      layer: 'Zustand Persistent State Stores',
      scope: '`src/stores/*.test.ts`',
      match: (f) => f.startsWith('src/stores/'),
      strategy: 'Local storage hydration, optimistic outbox mutations, tombstone filtering, LWW conflict resolution, per-user in-flight coalescing (`coalesceInFlightByUser`), pre-sync active JWT session verification (`verifyActiveCloudSession`), batched multi-book `reading_progress` upserts, and 10-store session teardown.',
    },
    {
      id: 'hooks',
      layer: 'Custom Hooks & TanStack Queries',
      scope: '`src/hooks/**/*.test.{ts,tsx}`',
      match: (f) => f.startsWith('src/hooks/'),
      strategy: '`renderHook` with `QueryClientProvider` + MSW v2 network interception, IndexedDB offline-first reads, Web Speech TTS, and reading ledger hydration.',
    },
    {
      id: 'lib',
      layer: 'Domain Engines, Security Primitives & Gutenberg AST',
      scope: '`src/lib/**/*.test.ts`',
      match: (f) => f.startsWith('src/lib/'),
      strategy: 'Pure computational & security verification (multi-jurisdictional copyright, R2 SigV4 endpoint & SSRF guards, open-redirect sanitizer, rate limiter, Gutenberg AST segmentation/reflow/pagination, interval annotator).',
    },
    {
      id: 'config',
      layer: 'Configuration, Anthologies & Design Tokens',
      scope: '`src/config/*.test.ts`',
      match: (f) => f.startsWith('src/config/'),
      strategy: 'Schema integrity, curated 27-masterwork anthology lifespan validation, 12-hour sliding-cache hero/editorial boundary guards (`FEATURED_HERO_ID_SET`, `toFallbackHeroWithRawBook`), and theme/accolade token invariants.',
    },
    {
      id: 'worker_proxy',
      layer: 'Background Web Worker & Edge Reverse Proxy',
      scope: '`src/workers/*.test.ts` & `src/proxy.test.ts`',
      match: (f) => f.startsWith('src/workers/') || f === 'src/proxy.test.ts',
      strategy: 'Off-thread Web Worker message lifecycle (`PARSE_BOOK`) and Edge Geo-IP / cookie / Supabase session refresh proxy tests.',
    },
    {
      id: 'mocks',
      layer: 'Hermetic Network Mocks & Test Interception',
      scope: '`src/mocks/*.test.ts`',
      match: (f) => f.startsWith('src/mocks/'),
      strategy: 'Fail-closed MSW v2 request/response handler unit contracts, internal route fixtures, and Supabase 503 safety-net verification (`src/mocks/handlers.test.ts`).',
    },
    {
      id: 'scripts',
      layer: 'CLI Data Ingestion Pipelines & AST Security Rules',
      scope: '`scripts/**/*.test.ts`',
      match: (f) => f.startsWith('scripts/'),
      strategy: 'Hermetic `pg_catalog.csv.gz` & `rdf-files.tar.bz2` streaming decompression (PGLAF-first failover, `--feed-source` pinning, `<dcterms:rights>` extraction & HTML outage rejection), RFC 4180 CSV parsing, in-RAM `gutenberg-catalog-cache.json.gz` snapshot diffing, Cloudflare R2 `ListObjectsV2` / `rsync --files-from` / PGLAF HTTPS delta asset sync (`_meta/r2-sync-state.json.gz`, copyright/withdrawn pruning, bounded `$GITHUB_STEP_SUMMARY` tables), `quote-diff.json` hand-off, R2-first + PGLAF mirror-first featured quotes extraction, Wikidata SPARQL FRBR translation clustering, Babel AST / SQL contract & layer-boundary checks (`ast-parser.test.ts`), stateless SAST validator checks (`sast-validators.test.ts`), and 9-rule ESLint AST & request-taint security verification.',
    },
  ];

  const layerBreakdown = layerDefs.map((def) => {
    const matchedFiles = testSuites.filter(def.match);
    let testCount = 0;
    for (const rel of matchedFiles) {
      const fullPath = path.join(rootDir, rel);
      const content = fs.readFileSync(fullPath, 'utf-8');
      testCount += extractTestsFromSourceAst(content).length;
    }
    return {
      layer: def.layer,
      scope: def.scope,
      suites: matchedFiles.length,
      tests: testCount,
      strategy: def.strategy,
    };
  });

  return {
    harnessModules,
    totalSuites: testSuites.length,
    srcSuiteCount,
    scriptSuites,
    testSuites,
    layerBreakdown,
  };
}

/**
 * Extracts AST upstream imports and downstream consumers for non-runtime test harness modules
 * (`src/mocks/handlers.ts`, `src/mocks/server.ts`, `src/test/setup.ts`) without mutating
 * the main `src/` runtime graph used for orphan and cycle checks.
 */
function extractTestHarnessAstDependencies(rootDir, graph) {
  const harnessPaths = [
    ['src', 'mocks', 'handlers.ts'],
    ['src', 'mocks', 'server.ts'],
    ['src', 'test', 'setup.ts'],
  ];

  const harnessRelPaths = harnessPaths.map((segments) => segments.join('/'));
  const combinedFileSet = new Set([...graph.keys(), ...harnessRelPaths]);
  const harnessNodes = new Map();

  for (const segments of harnessPaths) {
    const fileRel = segments.join('/');
    const absPath = path.join(rootDir, ...segments);
    if (!fs.existsSync(absPath)) continue;

    const content = fs.readFileSync(absPath, 'utf-8');
    const internalImports = [];

    try {
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });
      traverse(ast, {
        ImportDeclaration({ node }) {
          const importSource = node.source.value;
          if (importSource.startsWith('@/') || importSource.startsWith('.')) {
            internalImports.push(importSource);
          }
        },
        ExportNamedDeclaration({ node }) {
          if (node.source && node.source.value) {
            const importSource = node.source.value;
            if (importSource.startsWith('@/') || importSource.startsWith('.')) {
              internalImports.push(importSource);
            }
          }
        },
      });
    } catch (_err) {
      // Fallback: ignore parse failure on non-runtime harness helper
    }

    harnessNodes.set(fileRel, {
      file: fileRel,
      imports: Array.from(new Set(internalImports)),
      consumedBy: [],
    });
  }

  for (const [fileRel, nodeData] of harnessNodes.entries()) {
    const normalizedImports = [];
    for (const imp of nodeData.imports) {
      const resolved = resolveImportPath(imp, fileRel, combinedFileSet);
      if (resolved) {
        normalizedImports.push(resolved.replace(/^src\//, ''));
        if (harnessNodes.has(resolved)) {
          const target = harnessNodes.get(resolved);
          if (!target.consumedBy.includes(fileRel)) {
            target.consumedBy.push(fileRel);
          }
        }
      } else {
        normalizedImports.push(imp);
      }
    }
    nodeData.imports = Array.from(new Set(normalizedImports));
  }

  for (const [runtimeFile, runtimeData] of graph.entries()) {
    for (const imp of runtimeData.imports || []) {
      const resolved = resolveImportPath(imp, runtimeFile, combinedFileSet);
      if (resolved && harnessNodes.has(resolved)) {
        const target = harnessNodes.get(resolved);
        if (!target.consumedBy.includes(runtimeFile)) {
          target.consumedBy.push(runtimeFile);
        }
      }
    }
  }

  return Array.from(harnessNodes.values());
}

/**
 * Extracts static and PWA asset files from public/ and Next.js App Router file-based metadata icons in src/app/.
 */
function extractPublicAssetsCatalog(rootDir) {
  const publicDir = path.join(rootDir, 'public');
  if (!fs.existsSync(publicDir)) return [];

  const swMeta = extractServiceWorkerMetadata(rootDir);
  const assets = [];
  const roleMap = {
    'public/sw.js': `PWA Service Worker (\`${swMeta.cacheName}\`) managing bounded same-origin \`CACHE_URLS\` App Shell precaching, static asset discovery, and offline route navigation fallback.`,
    'public/favicon.ico': 'Multi-resolution 32-bit RGBA binary icon container (`16×16`, `32×32`, `48×48`) with soaring book brand emblem for browser tabs.',
    'public/icon.svg': 'Scalable vector soaring book brand emblem with 3-tiered page depths, sunlit amber peaks, core terracotta arches, and deep burnt outer wings.',
    'public/icons/apple-touch-icon.png': 'High-DPI iOS / iPadOS Home Screen Web Clip icon (`512×512` PNG).',
    'public/icons/icon-192.png': 'Standard PWA Web App Manifest home screen icon (`192×192` PNG, `purpose: "any"`).',
    'public/icons/icon-512.png': 'High-DPI PWA splash screen and desktop application icon (`512×512` PNG, `purpose: "any"`).',
    'public/icons/icon-1024.png': 'Ultra-High-DPI tablet PWA splash screen and application icon (`1024×1024` PNG, `purpose: "any"`).',
    'public/icons/icon-maskable-192.png': 'Android adaptive launcher maskable icon with safe-zone padding (`192×192` PNG, `purpose: "maskable"`).',
    'public/icons/icon-maskable-512.png': 'High-DPI Android adaptive launcher maskable icon (`512×512` PNG, `purpose: "maskable"`).',
  };

  function scanPublic(dir) {
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => compareCodepoint(a.name, b.name));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanPublic(full);
      } else {
        const rel = path.relative(rootDir, full).replace(/\\/g, '/');
        const sizeBytes = getDeterministicTextOrBinaryBytes(full, rel);
        const sizeKb = (sizeBytes / 1024).toFixed(1) + ' KB';
        const ext = path.extname(entry.name).replace('.', '').toUpperCase() || 'ASSET';
        assets.push({
          name: entry.name,
          file: rel,
          format: ext,
          size: sizeKb,
          role: roleMap[rel] || 'Static public asset served at root edge path.',
        });
      }
    }
  }

  scanPublic(publicDir);

  return assets.sort((a, b) => compareCodepoint(a.file, b.file));
}

/**
 * Extracts environment variable definitions from .env.example (never reading .env or secret values)
 * and AST-scans src/**, next.config.ts, scripts/**, and .github/workflows/*.yml for consuming modules.
 */
function extractEnvironmentDependencyCatalog(rootDir, srcDir) {
  const envExamplePath = path.join(rootDir, '.env.example');
  const envVarNames = [];

  if (fs.existsSync(envExamplePath)) {
    const rawLines = fs.readFileSync(envExamplePath, 'utf-8').split(/\r?\n/);
    for (const line of rawLines) {
      const trimmed = line.trim();
      const match = trimmed.match(/^(?:#\s*)?([A-Z][A-Z0-9_]+)=/);
      if (match && !envVarNames.includes(match[1])) {
        envVarNames.push(match[1]);
      }
    }
  }

  if (!envVarNames.includes('NODE_ENV')) {
    envVarNames.push('NODE_ENV');
  }

  const varMetaMap = {
    NEXT_PUBLIC_SITE_URL: {
      scope: 'Public Browser & Edge SSR (`NEXT_PUBLIC_*`)',
      fallback: 'Normalized fallback chain: `NEXT_PUBLIC_SITE_URL` -> `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL` -> SSR-only `VERCEL_PROJECT_PRODUCTION_URL` -> `https://bookarium.vercel.app` (`SITE_CONFIG.SITE_URL` / `SITE_CONFIG.SITE_HOST`).',
      purpose: 'Canonical origin for OpenGraph metadata, `sitemap.xml`, `robots.txt`, shareable book links, reading card host footers, and PKCE auth callback validation.',
    },
    NEXT_PUBLIC_SUPABASE_URL: {
      scope: 'Public Browser & Edge SSR (`NEXT_PUBLIC_*`)',
      fallback: 'Offline-First Guest Preview & Tests: Catalog degrades safely to the bundled Curated Archive fallback (`curated-fallback.ts`); offline books and personal collections persist locally in `localStorage` & `IndexedDB` (full 78k+ online catalog & cloud sync require a Supabase project).',
      purpose: 'Supabase project URL for PostgreSQL catalog queries (`public.books`), FRBR translations, SSR auth cookies, and 7-store cloud sync.',
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      scope: 'Public Browser & Edge SSR (`NEXT_PUBLIC_*`)',
      fallback: 'Offline-First Guest Preview & Tests: Cloud sync and auth modals gracefully disable live network calls when unconfigured.',
      purpose: 'Public anonymous JWT key scoped strictly by PostgreSQL Row-Level Security (`ENABLE ROW LEVEL SECURITY` across all 14 tables).',
    },
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: {
      scope: 'Public Browser & Edge SSR (`NEXT_PUBLIC_*`)',
      fallback: 'Optional: `TurnstileWidget` renders nothing (zero external scripts or UI) and `AuthModal`, `EmailSentView`, and `/account` recovery/verification flows submit directly when unconfigured in local development or offline setups.',
      purpose: 'Public Cloudflare Turnstile site key mounting a shared Managed bot-protection widget (`TurnstileWidget.tsx`) across `AuthModal`, `EmailSentView` resends, and reveal-on-click `/account` password reset & verification resend flows, forwarding single-use `captchaToken` verification to Supabase Auth.',
    },
    NEXT_PUBLIC_LEGAL_CONTACT_FORM: {
      scope: 'Public Browser & Edge SSR (`NEXT_PUBLIC_*`)',
      fallback: 'Falls back to the repository GitHub Issue Tracker (`SITE_CONFIG.GITHUB_ISSUES_URL`) on `/copyright`.',
      purpose: 'Optional external intake URL for confidential territorial copyright or DMCA inquiries.',
    },
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION: {
      scope: 'Public Browser & Edge SSR (`NEXT_PUBLIC_*`)',
      fallback: 'Optional: Omit or leave blank to skip emitting the Google site verification `<meta>` tag (`resolveGoogleSiteVerification`).',
      purpose: 'Google Search Console ownership verification token resolved via `src/config/site-config.ts` and emitted into root layout metadata.',
    },
    NEXT_PUBLIC_GITHUB_REPO: {
      scope: 'Public Browser & Edge SSR (`NEXT_PUBLIC_*`)',
      fallback: 'Auto-detected from local Git config, `GITHUB_REPOSITORY` (CI), or `VERCEL_GIT_REPO_*` (Vercel).',
      purpose: 'Public repository URL displayed in the Navbar GitHub button, Footer links, and DMCA issue intake.',
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      scope: 'CLI & CI Secret Only (`Client-Forbidden` via Pass 0.5 & AST Rule)',
      fallback: 'CLI ingestion scripts fall back to `NEXT_PUBLIC_SUPABASE_ANON_KEY` or emit offline SQL seed artifacts (`supabase/seed_*.sql`).',
      purpose: 'Privileged service-role credential used exclusively by offline Node.js CLI pipelines (`catalog:sync`, `translations:sync`, `quotes:sync`, `catalog:ingest`) for bulk upserts.',
    },
    DEV_COUNTRY: {
      scope: 'Edge Proxy & Server Route Development Override',
      fallback: 'Production uses Vercel Edge `x-vercel-ip-country` header -> `bookarium-geo-country` cookie -> IANA timezone inference -> `US` default.',
      purpose: 'ISO 3166-1 alpha-2 country override (`US`, `GB`, `DE`, `MX`, `ES`) for local testing of multi-jurisdictional copyright rules (`Life+70`, `Life+80`, `Life+100`).',
    },
    GUTENBERG_CONTACT_EMAIL: {
      scope: 'Server-Side Fetcher & CLI Pipelines (Optional)',
      fallback: 'Omitted: Automated `User-Agent` headers cleanly identify via the public repository URL without exposing private emails.',
      purpose: 'Optional contact email address appended to `User-Agent` headers across Project Gutenberg mirrors and Wikidata SPARQL queries.',
    },
    BOOKARIUM_REPO_URL: {
      scope: 'Server-Side Fetcher, CLI Pipelines & Config (Optional)',
      fallback: 'Auto-detected from `GITHUB_REPOSITORY` (CI/cron), `VERCEL_GIT_REPO_*` (Vercel), or `NEXT_PUBLIC_SITE_URL`.',
      purpose: 'Explicit repository URL override used for open-source attribution and `User-Agent` contact headers.',
    },
    VERCEL_API_TOKEN: {
      scope: 'GitHub Actions Cache Purge CLI (Optional CI)',
      fallback: 'None (when unset, `scripts/purge-vercel-cache.js` cleanly skips Edge cache invalidation with exit code 0).',
      purpose: 'Authenticates `POST https://api.vercel.com/v1/edge-cache/dangerously-delete-by-tags?projectIdOrName={projectId}` at the end of catalog, quote, and translation CI workflows and via standalone manual `.github/workflows/cache-purge.yml` runs to purge stale `Vercel-Cache-Tag` entries.',
    },
    VERCEL_PROJECT_ID: {
      scope: 'GitHub Actions Cache Purge CLI (Optional CI)',
      fallback: 'None (required together with `VERCEL_API_TOKEN` for Edge tag invalidation; skips gracefully when omitted).',
      purpose: 'Identifies the target Vercel project (`prj_...` or project name) for Edge Data/CDN cache tag invalidation in `scripts/purge-vercel-cache.js`.',
    },
    VERCEL_TEAM_ID: {
      scope: 'GitHub Actions Cache Purge CLI (Optional CI)',
      fallback: 'Omitted when targeting a non-team personal scope; include when deploying under a Vercel team or Hobby personal team.',
      purpose: 'Appends `&teamId=...` to the Vercel tag-purge API request in `scripts/purge-vercel-cache.js` when targeting a team-owned Vercel project.',
    },
    R2_ACCOUNT_ID: {
      scope: 'Server-Only & CI Runtime Environment Variable (Vercel, GitHub Actions Secrets & `.env.local`)',
      fallback: 'Required in production for online covers and plain-text books. When any `R2_*` variable is omitted locally or in tests, `/api/books/content?type=cover` returns `404` (`dark typographic cover` fallback), uncached plain text fails closed with `HTTP 503` (zero runtime PG fallback), CI R2 sync skips cleanly (`exit 0`), and `quotes:sync` uses PGLAF mirror fallback. *Operator note: Full 78k+ R2 storage exceeds Cloudflare R2 10 GB free-tier allowance.*',
      purpose: 'Cloudflare account identifier building the private R2 S3 endpoint `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` inside `src/lib/r2-client.ts` and `scripts/sync-r2-assets.js`.',
    },
    R2_BUCKET_NAME: {
      scope: 'Server-Only & CI Runtime Environment Variable (Vercel, GitHub Actions Secrets & `.env.local`)',
      fallback: 'Omitted in local UI/test runs (`isR2Configured() === false`); online cover/text endpoints fail closed (`404`/`503`) until R2 is configured.',
      purpose: 'Private Cloudflare R2 bucket name (`bookarium-assets`) storing `covers/<id>.jpg`, `books/<id>.txt.gz`, and `_meta/r2-sync-state.json.gz`.',
    },
    R2_ACCESS_KEY_ID: {
      scope: 'Server-Only & CI R2 S3 Credential (Vercel Read-Only Recommended, GitHub Secrets Read/Write & `.env.local`)',
      fallback: 'Omitted in local UI/test runs (`isR2Configured() === false`); online cover/text endpoints fail closed (`404`/`503`) until R2 is configured.',
      purpose: 'S3 API access key ID used strictly server-side and in CI/CLI pipelines for AWS SigV4 signed `GET` (`r2-client.ts`, `sync-featured-quotes.js`) and `ListObjectsV2`/`PutObject`/`DeleteObject` (`sync-r2-assets.js`).',
    },
    R2_SECRET_ACCESS_KEY: {
      scope: 'Server-Only & CI Signing Secret (Vercel Read-Only Recommended, GitHub Secrets Read/Write & `.env.local`)',
      fallback: 'Omitted in local UI/test runs (`isR2Configured() === false`); online cover/text endpoints fail closed (`404`/`503`) until R2 is configured.',
      purpose: 'HMAC-SHA256 secret signing AWS Signature V4 requests to private Cloudflare R2 storage inside `src/lib/r2-client.ts` and `scripts/sync-r2-assets.js`.',
    },
    NODE_ENV: {
      scope: 'Framework & Build-Time Runtime Constant',
      fallback: 'Set automatically by Next.js / Node.js (`development`, `production`, `test`).',
      purpose: 'Strips `unsafe-eval` from production Content-Security-Policy, enables `Strict-Transport-Security` (`next.config.ts`), activates `public/sw.js` registration, and gates dev overrides.',
    },
  };

  // Collect all candidate files to scan for process.env.<VAR> usage
  const scanTargets = [];
  for (const srcFile of getAllSourceFiles(srcDir)) {
    scanTargets.push({
      abs: srcFile,
      rel: path.relative(rootDir, srcFile).replace(/\\/g, '/'),
      kind: 'code',
    });
  }

  const nextConfigPath = path.join(rootDir, 'next.config.ts');
  if (fs.existsSync(nextConfigPath)) {
    scanTargets.push({ abs: nextConfigPath, rel: 'next.config.ts', kind: 'code' });
  }

  const scriptsDir = path.join(rootDir, 'scripts');
  if (fs.existsSync(scriptsDir)) {
    for (const entry of fs
      .readdirSync(scriptsDir, { withFileTypes: true })
      .sort((a, b) => compareCodepoint(a.name, b.name))) {
      if (entry.isFile() && entry.name.endsWith('.js')) {
        scanTargets.push({
          abs: path.join(scriptsDir, entry.name),
          rel: `scripts/${entry.name}`,
          kind: 'code',
        });
      }
    }
  }

  const workflowsDir = path.join(rootDir, '.github', 'workflows');
  if (fs.existsSync(workflowsDir)) {
    for (const entry of fs
      .readdirSync(workflowsDir, { withFileTypes: true })
      .sort((a, b) => compareCodepoint(a.name, b.name))) {
      if (entry.isFile() && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))) {
        scanTargets.push({
          abs: path.join(workflowsDir, entry.name),
          rel: `.github/workflows/${entry.name}`,
          kind: 'yaml',
        });
      }
    }
  }

  const consumersMap = new Map(envVarNames.map((v) => [v, []]));

  for (const target of scanTargets) {
    const content = fs.readFileSync(target.abs, 'utf-8');
    const foundVars = new Set();

    if (target.kind === 'code') {
      try {
        const ast = parser.parse(content, {
          sourceType: 'unambiguous',
          allowReturnOutsideFunction: true,
          plugins: ['typescript', 'jsx'],
        });
        traverse(ast, {
          MemberExpression(astPath) {
            const { node } = astPath;
            if (!node.property || node.property.type !== 'Identifier') return;
            const varName = node.property.name;
            if (!consumersMap.has(varName)) return;

            const isDirectProcessEnv =
              node.object &&
              node.object.type === 'MemberExpression' &&
              node.object.object &&
              node.object.object.type === 'Identifier' &&
              node.object.object.name === 'process' &&
              node.object.property &&
              node.object.property.type === 'Identifier' &&
              node.object.property.name === 'env';

            let isInjectedEnvParam = false;
            if (!isDirectProcessEnv && node.object && node.object.type === 'Identifier' && node.object.name === 'env') {
              const binding = astPath.scope.getBinding('env');
              const assignParent = binding?.path?.parentPath;
              if (binding?.kind === 'param' && assignParent?.isAssignmentPattern()) {
                const defaultExpr = assignParent.node.right;
                const isDefaultProcessEnv =
                  defaultExpr?.type === 'MemberExpression' &&
                  defaultExpr.object?.type === 'Identifier' &&
                  defaultExpr.object.name === 'process' &&
                  defaultExpr.property?.type === 'Identifier' &&
                  defaultExpr.property.name === 'env';
                const isDefaultLoadEnv =
                  defaultExpr?.type === 'CallExpression' &&
                  defaultExpr.callee?.type === 'Identifier' &&
                  defaultExpr.callee.name === 'loadEnv';
                isInjectedEnvParam = isDefaultProcessEnv || isDefaultLoadEnv;
              }
            }

            if (isDirectProcessEnv || isInjectedEnvParam) {
              foundVars.add(varName);
            }
          },
        });
      } catch (_err) {
        for (const v of envVarNames) {
          if (new RegExp(`process\\.env\\.${v}\\b`).test(content)) {
            foundVars.add(v);
          }
        }
      }
    } else {
      for (const v of envVarNames) {
        if (new RegExp(`\\b${v}\\b`).test(content)) {
          foundVars.add(v);
        }
      }
    }

    for (const v of foundVars) {
      consumersMap.get(v).push(target.rel);
    }
  }

  return envVarNames.map((name) => {
    const meta = varMetaMap[name] || {
      scope: name.startsWith('NEXT_PUBLIC_') ? 'Public Browser & Edge SSR (`NEXT_PUBLIC_*`)' : 'Server / CLI Environment Variable',
      fallback: 'Optional runtime configuration override.',
      purpose: 'Application environment configuration parameter.',
    };
    const consumers = (consumersMap.get(name) || []).slice().sort(compareCodepoint);
    return {
      name,
      scope: meta.scope,
      fallback: meta.fallback,
      purpose: meta.purpose,
      consumers,
    };
  });
}

function unwrapAstExpression(node) {
  let current = node;
  while (
    current &&
    (current.type === 'TSAsExpression' ||
      current.type === 'TSTypeAssertion' ||
      current.type === 'TypeCastExpression' ||
      current.type === 'TSSatisfiesExpression' ||
      current.type === 'ParenthesizedExpression')
  ) {
    current = current.expression;
  }
  return current;
}

function resolveAstStringExpression(node, localConsts, globalConsts, globalMemberConsts) {
  const expr = unwrapAstExpression(node);
  if (!expr) return null;
  if (expr.type === 'StringLiteral') return expr.value;
  if (expr.type === 'Identifier') {
    return localConsts.get(expr.name) || globalConsts.get(expr.name) || null;
  }
  if (
    expr.type === 'MemberExpression' &&
    !expr.computed &&
    expr.object &&
    expr.object.type === 'Identifier' &&
    expr.property &&
    expr.property.type === 'Identifier'
  ) {
    const memberKey = `${expr.object.name}.${expr.property.name}`;
    return localConsts.get(memberKey) || globalMemberConsts.get(memberKey) || null;
  }
  if (expr.type === 'TemplateLiteral' && Array.isArray(expr.quasis)) {
    let assembled = '';
    for (let i = 0; i < expr.quasis.length; i++) {
      assembled += expr.quasis[i].value.cooked ?? expr.quasis[i].value.raw ?? '';
      if (i < expr.expressions.length) {
        const inner = resolveAstStringExpression(
          expr.expressions[i],
          localConsts,
          globalConsts,
          globalMemberConsts
        );
        assembled += inner !== null ? inner : '${*}';
      }
    }
    return assembled;
  }
  return null;
}

function canonicalizeInternalApiRoute(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return null;
  if (urlStr.includes('/api/books/translations')) return '/api/books/translations';
  if (urlStr.includes('/api/books/content')) return '/api/books/content';
  if (/(?:^|[^a-zA-Z0-9_-])\/api\/books(?:$|[?#&])/.test(urlStr)) return '/api/books';
  if (urlStr.includes('/auth/callback')) return '/auth/callback';
  return null;
}

function classifyStorageAccessMode(astPath) {
  let cur = astPath.parentPath;
  while (cur) {
    const n = cur.node;
    if (
      n.type === 'CallExpression' &&
      n.callee &&
      n.callee.type === 'MemberExpression' &&
      n.callee.property &&
      n.callee.property.type === 'Identifier'
    ) {
      const method = n.callee.property.name;
      if (method === 'setItem' || method === 'set') return 'write';
      if (method === 'removeItem' || method === 'delete') return 'clear';
      if (method === 'getItem' || method === 'get' || method === 'getCookieValue') return 'read';
    }
    if (
      n.type === 'CallExpression' &&
      n.callee &&
      n.callee.type === 'Identifier' &&
      n.callee.name === 'getCookieValue'
    ) {
      return 'read';
    }
    if (
      n.type === 'AssignmentExpression' &&
      n.left &&
      n.left.type === 'MemberExpression' &&
      n.left.property &&
      n.left.property.name === 'cookie'
    ) {
      return 'write';
    }
    if (
      n.type === 'ObjectProperty' &&
      n.key &&
      n.key.type === 'Identifier' &&
      n.key.name === 'name'
    ) {
      return 'persist';
    }
    cur = cur.parentPath;
  }
  return 'use';
}

function collectScriptFiles(rootDir) {
  const results = [];
  const subdirs = [
    path.join(rootDir, 'scripts'),
    path.join(rootDir, 'scripts', 'lib'),
    path.join(rootDir, 'scripts', 'eslint-rules'),
  ];
  for (const dir of subdirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => compareCodepoint(a.name, b.name))) {
      if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
        const abs = path.join(dir, entry.name);
        results.push({
          abs,
          rel: path.relative(rootDir, abs).replace(/\\/g, '/'),
        });
      }
    }
  }
  return results.sort((a, b) => compareCodepoint(a.rel, b.rel));
}

function resolveScriptRequirePath(specifier, fromRel, scriptRelSet) {
  if (!specifier || !specifier.startsWith('.')) return null;
  const normalized = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), specifier));
  const candidates = [normalized, `${normalized}.js`, `${normalized}/index.js`];
  for (const cand of candidates) {
    if (scriptRelSet.has(cand)) return cand;
  }
  return null;
}

/**
 * Builds the CommonJS dependency graph and DB `.from()` touchpoints across scripts/*.js.
 */
function analyzeScriptsDependencyGraph(rootDir) {
  const files = collectScriptFiles(rootDir);
  const scriptRelSet = new Set(files.map((f) => f.rel));
  const nodesMap = new Map();
  const parseErrors = [];
  const nonDbFrom = new Set(['Array', 'Buffer', 'Set', 'Object', 'Uint8Array']);

  for (const fileInfo of files) {
    const content = fs.readFileSync(fileInfo.abs, 'utf-8');
    const rawRequires = [];
    const internalRequires = [];
    const externalRequires = [];
    const dbTables = [];
    let parseError = null;

    try {
      const ast = parser.parse(content, {
        sourceType: 'unambiguous',
        allowReturnOutsideFunction: true,
        plugins: ['typescript', 'jsx'],
      });
      traverse(ast, {
        CallExpression({ node }) {
          if (
            node.callee &&
            node.callee.type === 'Identifier' &&
            node.callee.name === 'require' &&
            node.arguments &&
            node.arguments[0] &&
            node.arguments[0].type === 'StringLiteral'
          ) {
            const spec = node.arguments[0].value;
            rawRequires.push(spec);
            if (spec.startsWith('.')) {
              const resolved = resolveScriptRequirePath(spec, fileInfo.rel, scriptRelSet);
              if (resolved) internalRequires.push(resolved);
            } else {
              externalRequires.push(spec);
            }
          }
          if (
            node.callee &&
            node.callee.type === 'MemberExpression' &&
            node.callee.property &&
            node.callee.property.type === 'Identifier' &&
            node.callee.property.name === 'from' &&
            node.arguments &&
            node.arguments[0] &&
            node.arguments[0].type === 'StringLiteral'
          ) {
            const objName =
              node.callee.object && node.callee.object.type === 'Identifier'
                ? node.callee.object.name
                : '';
            if (!nonDbFrom.has(objName) && /^[a-z][a-z0-9_]*$/.test(node.arguments[0].value)) {
              dbTables.push(`public.${node.arguments[0].value}`);
            }
          }
        },
      });
    } catch (err) {
      parseError = err instanceof Error ? err.message : String(err);
      parseErrors.push({ file: fileInfo.rel, error: parseError });
    }

    nodesMap.set(fileInfo.rel, {
      file: fileInfo.rel,
      requires: Array.from(new Set(internalRequires)).sort(),
      externalRequires: Array.from(new Set(externalRequires)).sort(),
      consumedBy: [],
      dbTables: Array.from(new Set(dbTables)).sort(),
      parseError,
    });
  }

  for (const [rel, data] of nodesMap.entries()) {
    for (const target of data.requires) {
      const targetNode = nodesMap.get(target);
      if (targetNode && !targetNode.consumedBy.includes(rel)) {
        targetNode.consumedBy.push(rel);
      }
    }
  }
  for (const data of nodesMap.values()) {
    data.consumedBy.sort(compareCodepoint);
  }

  return {
    nodes: Array.from(nodesMap.values()).sort((a, b) => compareCodepoint(a.file, b.file)),
    nodesMap,
    parseErrors,
  };
}

/**
 * Extracts runtime cross-boundary coupling across src/ and scripts/:
 * - Supabase .from('table') and .rpc('fn') callers
 * - Internal /api/* & /auth/callback callers (fetch, API_ENDPOINTS, ROUTES, card URLs)
 * - DOM CustomEvent & BroadcastChannel emitters/subscribers (resolving exported constants)
 * - Cross-module STORAGE_KEYS, localStorage/sessionStorage, IndexedDB & Cookie bindings
 */
function extractCrossBoundaryCouplingCatalog(srcDir, rootDir) {
  const sourceFiles = getAllSourceFiles(srcDir);
  const parsedSrcFiles = [];
  const parseErrors = [];
  const globalConsts = new Map();
  const globalMemberConsts = new Map();

  for (const abs of sourceFiles) {
    const rel = path.relative(rootDir, abs).replace(/\\/g, '/');
    const content = fs.readFileSync(abs, 'utf-8');
    let ast = null;
    try {
      ast = parser.parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      parseErrors.push({ file: rel, error: msg });
      continue;
    }

    // Pass 1: Harvest exported string constants and flat config objects (as const)
    traverse(ast, {
      ExportNamedDeclaration({ node }) {
        if (!node.declaration || node.declaration.type !== 'VariableDeclaration') return;
        for (const dec of node.declaration.declarations || []) {
          if (!dec.id || dec.id.type !== 'Identifier' || !dec.init) continue;
          const init = unwrapAstExpression(dec.init);
          if (init && init.type === 'StringLiteral') {
            globalConsts.set(dec.id.name, init.value);
          } else if (init && init.type === 'ObjectExpression') {
            for (const prop of init.properties || []) {
              if (
                prop.type === 'ObjectProperty' &&
                prop.key &&
                (prop.key.type === 'Identifier' || prop.key.type === 'StringLiteral')
              ) {
                const keyName = prop.key.name || prop.key.value;
                const valNode = unwrapAstExpression(prop.value);
                if (valNode && valNode.type === 'StringLiteral') {
                  globalMemberConsts.set(`${dec.id.name}.${keyName}`, valNode.value);
                }
              }
            }
          }
        }
      },
    });

    parsedSrcFiles.push({ rel, ast });
  }

  const dbTableMap = new Map();
  const rpcMap = new Map();
  const apiCallerMap = new Map();
  const signalMap = new Map();
  const storageMap = new Map();

  const addSetEntry = (map, key, value) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(value);
  };

  const ensureSignal = (kind, name) => {
    const key = `${kind}:${name}`;
    if (!signalMap.has(key)) {
      signalMap.set(key, {
        kind,
        name,
        emitters: new Set(),
        subscribers: new Set(),
        detailKeys: new Set(),
        isCustomSignal: kind === 'BroadcastChannel' || name.startsWith('bookarium'),
      });
    }
    return signalMap.get(key);
  };

  const ensureStorage = (keyName) => {
    if (!storageMap.has(keyName)) {
      storageMap.set(keyName, {
        key: keyName,
        writers: new Set(),
        readers: new Set(),
        persistedBy: new Set(),
      });
    }
    return storageMap.get(keyName);
  };

  const nonDbFromObjects = new Set([
    'Array',
    'Buffer',
    'Set',
    'Map',
    'Object',
    'Uint8Array',
    'Int8Array',
    'Uint16Array',
    'Uint32Array',
    'Float32Array',
    'Float64Array',
  ]);
  const apiSelfAndPaginationExclusions = new Set([
    'src/config/api-endpoints.ts',
    'src/config/routes.ts',
    'src/lib/catalog/curated-fallback.ts',
    'src/lib/catalog/supabase-provider.ts',
    'src/lib/redirect-sanitizer.ts',
    'src/app/robots.ts',
    'src/proxy.ts',
  ]);

  // Pass 2: Traverse every parsed src/ module for cross-boundary call & signal edges
  for (const { rel, ast } of parsedSrcFiles) {
    const localConsts = new Map();

    // Collect local variable string bindings first so `const endpoint = ...; fetch(endpoint)` resolves reliably
    traverse(ast, {
      VariableDeclarator({ node }) {
        if (!node.id || node.id.type !== 'Identifier' || !node.init) return;
        const resolved = resolveAstStringExpression(
          node.init,
          localConsts,
          globalConsts,
          globalMemberConsts
        );
        if (resolved !== null) {
          localConsts.set(node.id.name, resolved);
        }
      },
    });

    const isRouteHandlerFile = rel.startsWith('src/app/api/') || rel === 'src/app/auth/callback/route.ts';
    const isExcludedApiCallerFile = isRouteHandlerFile || apiSelfAndPaginationExclusions.has(rel);

    const fileBroadcastOps = { channels: new Set(), hasPostMessage: false, hasMessageListener: false };

    traverse(ast, {
      CallExpression(astPath) {
        const { node } = astPath;
        const callee = node.callee;

        // 1. Direct fetch(...) and buildAuthRedirectUrl(...) callers -> internal API route
        if (!isExcludedApiCallerFile && callee && callee.type === 'Identifier') {
          if ((callee.name === 'fetch' || callee.name === 'buildAuthRedirectUrl') && node.arguments[0]) {
            const urlStr = resolveAstStringExpression(
              node.arguments[0],
              localConsts,
              globalConsts,
              globalMemberConsts
            );
            const routeKey = canonicalizeInternalApiRoute(urlStr);
            if (routeKey) addSetEntry(apiCallerMap, routeKey, rel);
          }
        }

        if (!callee || callee.type !== 'MemberExpression' || !callee.property || callee.property.type !== 'Identifier') {
          return;
        }
        const propName = callee.property.name;

        // 2. Supabase .from('table') & .rpc('fn')
        if (propName === 'from' && node.arguments[0]) {
          const objName = callee.object && callee.object.type === 'Identifier' ? callee.object.name : '';
          if (!nonDbFromObjects.has(objName)) {
            const tableName = resolveAstStringExpression(
              node.arguments[0],
              localConsts,
              globalConsts,
              globalMemberConsts
            );
            if (tableName && /^[a-z][a-z0-9_]*$/.test(tableName)) {
              addSetEntry(dbTableMap, `public.${tableName}`, rel);
            }
          }
        } else if (propName === 'rpc' && node.arguments[0]) {
          const rpcName = resolveAstStringExpression(
            node.arguments[0],
            localConsts,
            globalConsts,
            globalMemberConsts
          );
          if (rpcName && /^[a-z][a-z0-9_]*$/.test(rpcName)) {
            addSetEntry(rpcMap, `public.${rpcName}()`, rel);
          }
        }

        // 3. DOM CustomEvent / BroadcastChannel listeners
        if (propName === 'addEventListener' && node.arguments[0]) {
          const evtName = resolveAstStringExpression(
            node.arguments[0],
            localConsts,
            globalConsts,
            globalMemberConsts
          );
          if (evtName === 'message') {
            fileBroadcastOps.hasMessageListener = true;
          } else if (evtName && evtName.startsWith('bookarium')) {
            ensureSignal('CustomEvent', evtName).subscribers.add(rel);
          }
        } else if (propName === 'postMessage') {
          fileBroadcastOps.hasPostMessage = true;
        }

        // 4. localStorage / sessionStorage / indexedDB.open string keys
        if (
          (propName === 'getItem' || propName === 'setItem' || propName === 'removeItem' || propName === 'open') &&
          node.arguments[0]
        ) {
          const objName = callee.object && callee.object.type === 'Identifier' ? callee.object.name : '';
          if (
            propName === 'open' &&
            objName !== 'indexedDB' &&
            !(
              callee.object &&
              callee.object.type === 'MemberExpression' &&
              callee.object.property &&
              callee.object.property.name === 'indexedDB'
            )
          ) {
            return;
          }
          const keyStr = resolveAstStringExpression(
            node.arguments[0],
            localConsts,
            globalConsts,
            globalMemberConsts
          );
          if (keyStr && (keyStr.startsWith('bookarium') || keyStr === 'BookariumOfflineDB')) {
            const entry = ensureStorage(keyStr);
            if (propName === 'open') {
              entry.writers.add(rel);
              entry.readers.add(rel);
            } else if (propName === 'setItem' || propName === 'removeItem') {
              entry.writers.add(rel);
            } else {
              entry.readers.add(rel);
            }
          }
        }
      },

      NewExpression({ node }) {
        if (!node.callee || node.callee.type !== 'Identifier' || !node.arguments[0]) return;
        const ctor = node.callee.name;
        const signalName = resolveAstStringExpression(
          node.arguments[0],
          localConsts,
          globalConsts,
          globalMemberConsts
        );
        if (!signalName) return;

        if (ctor === 'CustomEvent') {
          const sig = ensureSignal('CustomEvent', signalName);
          sig.emitters.add(rel);
          const opts = unwrapAstExpression(node.arguments[1]);
          if (opts && opts.type === 'ObjectExpression') {
            for (const p of opts.properties || []) {
              if (
                p.type === 'ObjectProperty' &&
                p.key &&
                (p.key.name || p.key.value) === 'detail'
              ) {
                const detailObj = unwrapAstExpression(p.value);
                if (detailObj && detailObj.type === 'ObjectExpression') {
                  for (const dp of detailObj.properties || []) {
                    const dk = dp.key && (dp.key.name || dp.key.value);
                    if (dk) sig.detailKeys.add(dk);
                  }
                }
              }
            }
          }
        } else if (ctor === 'BroadcastChannel') {
          fileBroadcastOps.channels.add(signalName);
          ensureSignal('BroadcastChannel', signalName);
        }
      },

      MemberExpression(astPath) {
        const { node } = astPath;
        if (
          node.object &&
          node.object.type === 'Identifier' &&
          node.object.name === 'STORAGE_KEYS' &&
          node.property &&
          node.property.type === 'Identifier' &&
          rel !== 'src/config/site-config.ts'
        ) {
          const keyStr = globalMemberConsts.get(`STORAGE_KEYS.${node.property.name}`);
          if (keyStr) {
            const entry = ensureStorage(keyStr);
            const mode = classifyStorageAccessMode(astPath);
            if (mode === 'persist') entry.persistedBy.add(rel);
            else if (mode === 'write' || mode === 'clear') entry.writers.add(rel);
            else entry.readers.add(rel);
          }
        }

        // Catch URL-constructing expressions using API_ENDPOINTS.INTERNAL_API_* or ROUTES.API_* (e.g. coverUrl / cardImageUrl)
        if (
          !isExcludedApiCallerFile &&
          node.object &&
          node.object.type === 'Identifier' &&
          (node.object.name === 'API_ENDPOINTS' || node.object.name === 'ROUTES') &&
          node.property &&
          node.property.type === 'Identifier'
        ) {
          const val = globalMemberConsts.get(`${node.object.name}.${node.property.name}`);
          const routeKey = canonicalizeInternalApiRoute(val);
          if (routeKey) addSetEntry(apiCallerMap, routeKey, rel);
        }
      },

      TemplateLiteral({ node }) {
        if (isExcludedApiCallerFile) return;
        const resolvedTpl = resolveAstStringExpression(
          node,
          localConsts,
          globalConsts,
          globalMemberConsts
        );
        const routeKey = canonicalizeInternalApiRoute(resolvedTpl);
        if (routeKey) addSetEntry(apiCallerMap, routeKey, rel);
      },
    });

    for (const chName of fileBroadcastOps.channels) {
      const sig = ensureSignal('BroadcastChannel', chName);
      if (fileBroadcastOps.hasPostMessage) sig.emitters.add(rel);
      if (fileBroadcastOps.hasMessageListener) sig.subscribers.add(rel);
    }
  }

  // Merge CLI scripts/*.js DB table touchpoints into dbTableMap
  const scriptsGraph = analyzeScriptsDependencyGraph(rootDir);
  for (const pErr of scriptsGraph.parseErrors) {
    parseErrors.push(pErr);
  }
  for (const sNode of scriptsGraph.nodes) {
    for (const tbl of sNode.dbTables) {
      addSetEntry(dbTableMap, tbl, sNode.file);
    }
  }

  // Known Zustand persist string keys (in stores where persist name isn't STORAGE_KEYS.*)
  const storeCatalog = extractStoreCatalog(srcDir);
  for (const st of storeCatalog) {
    const cleanKey = st.storageKey.replace(/\s*\(localStorage\)$/, '').replace(/`/g, '');
    if (cleanKey.startsWith('bookarium')) {
      ensureStorage(cleanKey).persistedBy.add(st.file);
    } else if (cleanKey.startsWith('STORAGE_KEYS.')) {
      const resolvedKey = globalMemberConsts.get(cleanKey);
      if (resolvedKey) ensureStorage(resolvedKey).persistedBy.add(st.file);
    }
  }

  const serializeSetMap = (map, labelKey) =>
    Array.from(map.entries())
      .map(([k, setVal]) => ({
        [labelKey]: k,
        callers: Array.from(setVal).sort(),
      }))
      .sort((a, b) => a[labelKey].localeCompare(b[labelKey]));

  const signalChannels = Array.from(signalMap.values())
    .map((sig) => ({
      kind: sig.kind,
      name: sig.name,
      isCustomSignal: sig.isCustomSignal,
      emitters: Array.from(sig.emitters).sort(),
      subscribers: Array.from(sig.subscribers).sort(),
      detailKeys: Array.from(sig.detailKeys).sort(),
    }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));

  const storageKeyBindings = Array.from(storageMap.values())
    .map((item) => ({
      key: item.key,
      persistedBy: Array.from(item.persistedBy).sort(),
      writers: Array.from(item.writers).sort(),
      readers: Array.from(item.readers).sort(),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  return {
    dbTouchpoints: serializeSetMap(dbTableMap, 'table'),
    rpcCallers: serializeSetMap(rpcMap, 'rpc'),
    apiRouteCallers: serializeSetMap(apiCallerMap, 'route'),
    signalChannels,
    storageKeyBindings,
    parseErrors,
  };
}

const TIER_1_CONTRACTED_MODULES = [
  'src/proxy.ts',
  'src/app/api/books/route.ts',
  'src/app/api/books/content/route.ts',
  'src/lib/r2-client.ts',
  'src/lib/copyright-engine.ts',
  'src/lib/catalog/supabase-provider.ts',
  'src/lib/book-sorting.ts',
  'src/lib/offline-storage.ts',
  'src/lib/sync-utils.ts',
  'src/stores/useAuthStore.ts',
  'src/stores/useReaderStore.ts',
  'scripts/sync-gutenberg-catalog.js',
  'scripts/sync-r2-assets.js',
  'scripts/sync-featured-quotes.js',
];

const TIER_2_CONTRACTED_MODULES = [
  'src/stores/useBookshelfStore.ts',
  'src/stores/useFellowshipStore.ts',
  'src/stores/useAnnotationStore.ts',
  'src/stores/useHabitsStore.ts',
  'src/stores/useAccoladesStore.ts',
  'src/stores/useJurisdictionStore.ts',
  'src/stores/usePreferencesStore.ts',
  'src/stores/useThemeStore.ts',
  'src/lib/bookshelf-cloud-sync.ts',
  'src/lib/annotation-cloud-sync.ts',
  'src/lib/fellowship-cloud-sync.ts',
  'src/lib/reader-cloud-sync.ts',
  'src/lib/preferences-sync.ts',
  'src/lib/auth-recovery.ts',
  'src/lib/redirect-sanitizer.ts',
  'src/lib/rate-limiter.ts',
];

const TIER_3_CONTRACTED_MODULES = [
  'src/hooks/useOfflineBooks.ts',
  'src/hooks/queries/useBooks.ts',
  'src/hooks/queries/useBookContent.ts',
  'src/hooks/queries/useBookTranslations.ts',
  'src/hooks/useAccountSecurityActions.ts',
  'src/hooks/useNetworkStatus.ts',
  'src/hooks/useBookPassageShuffle.ts',
  'src/hooks/useCollectionAutoHeal.ts',
  'src/hooks/useOfflineCoverImage.ts',
  'src/lib/supabase/client.ts',
  'src/lib/supabase/server.ts',
  'src/lib/supabase/middleware.ts',
  'src/app/auth/callback/route.ts',
  'src/app/api/books/translations/route.ts',
  'src/app/api/books/content/metadata-cache.ts',
  'src/lib/country-resolver.ts',
  'src/lib/safe-storage.ts',
  'src/lib/book-metadata.ts',
];

const TIER_4_CONTRACTED_MODULES = [
  'src/lib/gutenberg-parser.ts',
  'src/lib/gutenberg/segmentation.ts',
  'src/lib/gutenberg/pagination.ts',
  'src/lib/gutenberg/passages.ts',
  'src/lib/gutenberg/reflow.ts',
  'src/workers/gutenberg.worker.ts',
  'src/lib/reader-annotator.ts',
  'src/lib/reader-bookmark-geometry.ts',
  'src/hooks/reader/useReaderSession.ts',
  'src/hooks/reader/useContinueReadingLedger.ts',
  'scripts/ingest-catalog.js',
  'scripts/ingest-translations.js',
  'scripts/purge-vercel-cache.js',
  'scripts/eslint-rules/bookarium-security.js',
  'scripts/lib/ast-parser.js',
  'scripts/lib/sast-validators.js',
];

const PROTECTED_CONTRACTED_MODULES = [
  ...TIER_1_CONTRACTED_MODULES,
  ...TIER_2_CONTRACTED_MODULES,
  ...TIER_3_CONTRACTED_MODULES,
  ...TIER_4_CONTRACTED_MODULES,
];

const CONTRACT_LAYER_ORDER = [
  'Edge Proxy & API Routes',
  'Domain Engines & Adapters',
  'State Stores (Zustand)',
  'React Hooks & Queries',
  'Web Workers',
  'App Router Pages & Layouts',
  'UI & Feature Components',
  'Config & Type Contracts',
  'CLI Pipelines & Governance',
];

/**
 * Classifies a repository file path into its architectural contract layer.
 */
function classifyContractLayer(relPath) {
  if (relPath.startsWith('scripts/')) return 'CLI Pipelines & Governance';
  if (relPath === 'src/proxy.ts' || relPath.startsWith('src/app/api/')) {
    return 'Edge Proxy & API Routes';
  }
  if (relPath.startsWith('src/app/')) return 'App Router Pages & Layouts';
  if (relPath.startsWith('src/stores/')) return 'State Stores (Zustand)';
  if (relPath.startsWith('src/lib/')) return 'Domain Engines & Adapters';
  if (relPath.startsWith('src/hooks/')) return 'React Hooks & Queries';
  if (relPath.startsWith('src/workers/')) return 'Web Workers';
  if (relPath.startsWith('src/components/')) return 'UI & Feature Components';
  return 'Config & Type Contracts';
}

const PLACEHOLDER_CONTRACT_VALUE_RE = /^(?:tbd|todo|placeholder|none|n\/a|\.\.\.|-+)$/i;

/**
 * Parses @scope, @invariant, @rationale/@why, and @adr tags from a JSDoc comment body.
 */
function parseJsDocContractTags(commentValue) {
  const lines = String(commentValue || '').split(/\r?\n/);
  const scopeParts = [];
  const invariants = [];
  const rationales = [];
  const adrs = [];
  const emptyTagIssues = [];

  let activeTag = null;
  let activeIndex = -1;
  let hasAnyContractTag = false;
  let hasModuleHint = false;
  let insideFence = false;

  const commitIfEmpty = () => {
    if (activeTag === 'scope' && scopeParts[activeIndex] !== undefined) {
      const val = scopeParts[activeIndex].trim();
      if (!val || PLACEHOLDER_CONTRACT_VALUE_RE.test(val)) {
        emptyTagIssues.push('Empty or placeholder @scope tag');
      }
    } else if (activeTag === 'invariant' && invariants[activeIndex] !== undefined) {
      const val = invariants[activeIndex].trim();
      if (!val || PLACEHOLDER_CONTRACT_VALUE_RE.test(val)) {
        emptyTagIssues.push('Empty or placeholder @invariant tag');
      }
    } else if (activeTag === 'rationale' && rationales[activeIndex] !== undefined) {
      const val = rationales[activeIndex].trim();
      if (!val || PLACEHOLDER_CONTRACT_VALUE_RE.test(val)) {
        emptyTagIssues.push('Empty or placeholder @rationale/@why tag');
      }
    } else if (activeTag === 'adr' && adrs.length === 0) {
      emptyTagIssues.push('Empty or invalid @adr tag (expected ADR-XXX)');
    }
  };

  const extractAdrTokens = (rawText) => {
    const found = String(rawText || '').match(/\bADR-\d{3}\b/g);
    if (!found) return [];
    return found;
  };

  for (const rawLine of lines) {
    const cleaned = rawLine.replace(/^\s*\* ?/, '').trim();
    if (cleaned.startsWith('```')) {
      insideFence = !insideFence;
      continue;
    }
    if (insideFence) continue;

    if (!cleaned) {
      commitIfEmpty();
      activeTag = null;
      activeIndex = -1;
      continue;
    }

    const tagMatch = cleaned.match(/^@([a-zA-Z0-9_-]+)(?:\s+(.*))?$/);
    if (tagMatch) {
      commitIfEmpty();
      const tag = tagMatch[1].toLowerCase();
      const remainder = (tagMatch[2] || '').trim();

      if (tag === 'module' || tag === 'file' || tag === 'fileoverview') {
        hasModuleHint = true;
        activeTag = null;
        activeIndex = -1;
        continue;
      }

      if (tag === 'scope') {
        hasAnyContractTag = true;
        scopeParts.push(remainder);
        activeTag = 'scope';
        activeIndex = scopeParts.length - 1;
      } else if (tag === 'invariant') {
        hasAnyContractTag = true;
        invariants.push(remainder);
        activeTag = 'invariant';
        activeIndex = invariants.length - 1;
      } else if (tag === 'rationale' || tag === 'why') {
        hasAnyContractTag = true;
        rationales.push(remainder);
        activeTag = 'rationale';
        activeIndex = rationales.length - 1;
      } else if (tag === 'adr') {
        hasAnyContractTag = true;
        const parsedAdrs = extractAdrTokens(remainder);
        adrs.push(...parsedAdrs);
        activeTag = parsedAdrs.length === 0 ? 'adr' : 'adr-has-tokens';
        activeIndex = adrs.length - 1;
      } else {
        activeTag = null;
        activeIndex = -1;
      }
      continue;
    }

    if (!activeTag) continue;

    if (activeTag === 'scope') {
      scopeParts[activeIndex] = `${scopeParts[activeIndex]} ${cleaned}`.trim();
    } else if (activeTag === 'invariant') {
      invariants[activeIndex] = `${invariants[activeIndex]} ${cleaned}`.trim();
    } else if (activeTag === 'rationale') {
      rationales[activeIndex] = `${rationales[activeIndex]} ${cleaned}`.trim();
    } else if (activeTag === 'adr' || activeTag === 'adr-has-tokens') {
      const parsedAdrs = extractAdrTokens(cleaned);
      if (parsedAdrs.length > 0) {
        adrs.push(...parsedAdrs);
        activeTag = 'adr-has-tokens';
      }
    }
  }

  commitIfEmpty();

  const normalizedScope = scopeParts.map((s) => s.trim()).filter(Boolean).join(' ');
  return {
    hasAnyContractTag,
    hasModuleHint,
    scope: normalizedScope,
    invariants: invariants.map((s) => s.trim()).filter(Boolean),
    rationales: rationales.map((s) => s.trim()).filter(Boolean),
    adrs: Array.from(new Set(adrs)),
    emptyTagIssues: Array.from(new Set(emptyTagIssues)),
  };
}

/**
 * Formats a concise AST parameter list for exported functions/callables.
 */
function formatCallableParamList(params = []) {
  return params
    .map((param) => {
      if (!param) return 'arg';
      if (param.type === 'Identifier') return param.name;
      if (param.type === 'AssignmentPattern' && param.left?.type === 'Identifier') {
        return `${param.left.name}?`;
      }
      if (param.type === 'ObjectPattern') return '{ ... }';
      if (param.type === 'ArrayPattern') return '[ ... ]';
      if (param.type === 'RestElement' && param.argument?.type === 'Identifier') {
        return `...${param.argument.name}`;
      }
      return 'arg';
    })
    .join(', ');
}

/**
 * Returns true if a top-level statement is strictly a CommonJS require binding.
 */
function isCommonJsRequireStatement(stmt) {
  if (!stmt || stmt.type !== 'VariableDeclaration') return false;
  return (
    Array.isArray(stmt.declarations) &&
    stmt.declarations.length > 0 &&
    stmt.declarations.every(
      (decl) =>
        decl.init &&
        ((decl.init.type === 'CallExpression' && decl.init.callee?.name === 'require') ||
          (decl.init.type === 'MemberExpression' &&
            decl.init.object?.type === 'CallExpression' &&
            decl.init.object.callee?.name === 'require'))
    )
  );
}

/**
 * Extracts symbol metadata (name, kind, signature, exported) for a declaration node.
 */
function describeDeclarationSymbol(node, cjsExportsSet) {
  if (!node) return null;
  let exported = false;
  let inner = node;

  if (node.type === 'ExportNamedDeclaration') {
    exported = true;
    inner = node.declaration;
  } else if (node.type === 'ExportDefaultDeclaration') {
    exported = true;
    inner = node.declaration;
  }

  if (!inner) return null;

  if (inner.type === 'FunctionDeclaration') {
    const name = inner.id?.name || 'default';
    return {
      name,
      kind: 'function',
      signature: `${inner.async ? 'async ' : ''}(${formatCallableParamList(inner.params)})`,
      exported: exported || cjsExportsSet.has(name),
    };
  }
  if (inner.type === 'ClassDeclaration') {
    const name = inner.id?.name || 'default';
    return {
      name,
      kind: 'class',
      signature: `class ${name}`,
      exported: exported || cjsExportsSet.has(name),
    };
  }
  if (inner.type === 'TSInterfaceDeclaration') {
    const name = inner.id?.name || 'Interface';
    return {
      name,
      kind: 'interface',
      signature: `interface ${name}`,
      exported,
    };
  }
  if (inner.type === 'TSTypeAliasDeclaration') {
    const name = inner.id?.name || 'Type';
    return {
      name,
      kind: 'type',
      signature: `type ${name}`,
      exported,
    };
  }
  if (inner.type === 'VariableDeclaration' && inner.declarations?.length > 0) {
    const decl = inner.declarations[0];
    const name = decl.id?.name || 'constant';
    let signature = 'const';
    if (decl.init?.type === 'ArrowFunctionExpression' || decl.init?.type === 'FunctionExpression') {
      signature = `${decl.init.async ? 'async ' : ''}(${formatCallableParamList(decl.init.params)})`;
    }
    return {
      name,
      kind: 'const',
      signature,
      exported: exported || cjsExportsSet.has(name),
    };
  }
  return null;
}

/**
 * Collects exported symbol names across TypeScript ES modules and CommonJS scripts.
 */
function collectFileExportNames(ast) {
  const names = new Set();
  const cjsExports = new Set();

  traverse(ast, {
    ExportNamedDeclaration({ node }) {
      if (node.declaration) {
        if (node.declaration.declarations) {
          for (const d of node.declaration.declarations) {
            if (d.id?.name) names.add(d.id.name);
          }
        } else if (node.declaration.id?.name) {
          names.add(node.declaration.id.name);
        }
      }
      if (node.specifiers) {
        for (const s of node.specifiers) {
          if (s.exported?.name) names.add(s.exported.name);
        }
      }
    },
    ExportDefaultDeclaration({ node }) {
      names.add(node.declaration?.id?.name || 'default');
    },
    AssignmentExpression({ node }) {
      if (
        node.left?.type === 'MemberExpression' &&
        node.left.object?.type === 'Identifier' &&
        node.left.object.name === 'module' &&
        node.left.property?.name === 'exports' &&
        node.right?.type === 'ObjectExpression'
      ) {
        for (const prop of node.right.properties) {
          if (prop.type === 'ObjectProperty' && prop.key?.name) {
            names.add(prop.key.name);
            cjsExports.add(prop.key.name);
          }
        }
      }
    },
  });

  return {
    exportsList: Array.from(names),
    cjsExportsSet: cjsExports,
  };
}

/**
 * Extracts structured @scope / @invariant / @rationale / @adr contracts from a single file AST.
 */
function parseSingleFileContract(relPath, absPath) {
  const code = fs.readFileSync(absPath, 'utf-8');
  const isScript = relPath.endsWith('.js');
  const layer = classifyContractLayer(relPath);
  const tier1Set = new Set(TIER_1_CONTRACTED_MODULES);
  const tier2Set = new Set(TIER_2_CONTRACTED_MODULES);
  const tier3Set = new Set(TIER_3_CONTRACTED_MODULES);
  const tier4Set = new Set(TIER_4_CONTRACTED_MODULES);

  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: isScript ? 'unambiguous' : 'module',
      allowReturnOutsideFunction: isScript,
      plugins: isScript ? ['jsx'] : ['typescript', 'jsx'],
    });
  } catch (err) {
    return {
      file: relPath,
      layer,
      isTier1Protected: tier1Set.has(relPath),
      isTier2Protected: tier2Set.has(relPath),
      isTier3Protected: tier3Set.has(relPath),
      isTier4Protected: tier4Set.has(relPath),
      hasContract: false,
      moduleContract: null,
      symbolContracts: [],
      exportsList: [],
      emptyTagIssues: [],
      parseError: err instanceof Error ? err.message : String(err),
    };
  }

  const { exportsList, cjsExportsSet } = collectFileExportNames(ast);
  const body = Array.isArray(ast.program?.body) ? ast.program.body : [];
  const firstStatement = body[0] || null;
  const firstExecutableStmt =
    body.find((s) => s.type !== 'ImportDeclaration' && !isCommonJsRequireStatement(s)) || null;

  // Map comment start position -> immediately attached top-level or nested symbol info
  const attachedDeclByCommentStart = new Map();
  const registerLeadingComments = (declNode) => {
    if (isCommonJsRequireStatement(declNode)) return;
    const sym = describeDeclarationSymbol(declNode, cjsExportsSet);
    if (!sym || !Array.isArray(declNode.leadingComments)) return;
    for (const c of declNode.leadingComments) {
      if (c && typeof c.start === 'number') {
        attachedDeclByCommentStart.set(c.start, { sym, node: declNode });
      }
    }
  };

  for (const stmt of body) {
    registerLeadingComments(stmt);
  }

  // Also check nested function declarations attached to leading comments (e.g. CommonJS helpers)
  traverse(ast, {
    FunctionDeclaration({ node }) {
      if (Array.isArray(node.leadingComments)) {
        for (const c of node.leadingComments) {
          if (c && typeof c.start === 'number' && !attachedDeclByCommentStart.has(c.start)) {
            attachedDeclByCommentStart.set(c.start, {
              sym: {
                name: node.id?.name || 'anonymous',
                kind: 'function',
                signature: `${node.async ? 'async ' : ''}(${formatCallableParamList(node.params)})`,
                exported: cjsExportsSet.has(node.id?.name || ''),
              },
              node,
            });
          }
        }
      }
    },
  });

  let moduleContract = null;
  const symbolContracts = [];
  const allEmptyIssues = [];

  const comments = Array.isArray(ast.comments) ? ast.comments : [];
  for (const c of comments) {
    if (!c || c.type !== 'CommentBlock' || !String(c.value || '').startsWith('*')) continue;
    const parsed = parseJsDocContractTags(c.value);
    if (!parsed.hasAnyContractTag) continue;

    for (const issue of parsed.emptyTagIssues) {
      allEmptyIssues.push(issue);
    }

    const attachment = attachedDeclByCommentStart.get(c.start);
    const attachedNode = attachment?.node || null;
    const isBeforeExecutableCode =
      !firstExecutableStmt || c.end < firstExecutableStmt.start;
    const hasBlankLineBeforeAttached =
      Boolean(attachedNode?.loc && c.loc) &&
      attachedNode.loc.start.line - c.loc.end.line >= 2;

    const isModuleHeader =
      parsed.hasModuleHint ||
      (!attachment && isBeforeExecutableCode) ||
      Boolean(attachment && attachedNode === firstStatement && hasBlankLineBeforeAttached);

    if (isModuleHeader) {
      if (!moduleContract) {
        moduleContract = {
          scope: parsed.scope,
          invariants: [...parsed.invariants],
          rationales: [...parsed.rationales],
          adrs: [...parsed.adrs],
        };
      } else {
        if (parsed.scope) {
          moduleContract.scope = moduleContract.scope
            ? `${moduleContract.scope} ${parsed.scope}`
            : parsed.scope;
        }
        moduleContract.invariants.push(...parsed.invariants);
        moduleContract.rationales.push(...parsed.rationales);
        moduleContract.adrs = Array.from(new Set([...moduleContract.adrs, ...parsed.adrs]));
      }
    } else if (attachment?.sym) {
      symbolContracts.push({
        name: attachment.sym.name,
        kind: attachment.sym.kind,
        signature: attachment.sym.signature,
        exported: attachment.sym.exported,
        scope: parsed.scope,
        invariants: parsed.invariants,
        rationales: parsed.rationales,
        adrs: parsed.adrs,
      });
    } else {
      // Unattached block inside file: preserve cleanly at module scope rather than dropping
      if (!moduleContract) {
        moduleContract = {
          scope: parsed.scope,
          invariants: [...parsed.invariants],
          rationales: [...parsed.rationales],
          adrs: [...parsed.adrs],
        };
      } else {
        moduleContract.invariants.push(...parsed.invariants);
        moduleContract.rationales.push(...parsed.rationales);
        moduleContract.adrs = Array.from(new Set([...moduleContract.adrs, ...parsed.adrs]));
      }
    }
  }

  const hasContract = Boolean(moduleContract || symbolContracts.length > 0);
  return {
    file: relPath,
    layer,
    isTier1Protected: tier1Set.has(relPath),
    isTier2Protected: tier2Set.has(relPath),
    isTier3Protected: tier3Set.has(relPath),
    isTier4Protected: tier4Set.has(relPath),
    hasContract,
    moduleContract,
    symbolContracts,
    exportsList,
    emptyTagIssues: Array.from(new Set(allEmptyIssues)),
    parseError: null,
  };
}

/**
 * Scans all executable src/ and scripts/ modules via Babel AST to compile
 * behavioral @scope / @invariant / @rationale / @adr contracts and coverage metrics.
 */
function extractBehavioralContractsCatalog(srcDir, rootDir) {
  const srcFiles = getAllSourceFiles(srcDir).map((abs) => ({
    abs,
    rel: path.relative(rootDir, abs).replace(/\\/g, '/'),
  }));
  const scriptFiles = collectScriptFiles(rootDir);
  const allTargets = [...srcFiles, ...scriptFiles].sort((a, b) => compareCodepoint(a.rel, b.rel));

  const modules = [];
  const parseErrors = [];
  const validationIssues = [];

  for (const target of allTargets) {
    const entry = parseSingleFileContract(target.rel, target.abs);
    modules.push(entry);
    if (entry.parseError) {
      parseErrors.push({ file: entry.file, error: entry.parseError });
    }
    for (const issue of entry.emptyTagIssues) {
      validationIssues.push({ file: entry.file, message: issue });
    }
  }

  const byLayerMap = new Map(
    CONTRACT_LAYER_ORDER.map((layer) => [
      layer,
      { layer, total: 0, contracted: 0, pending: 0 },
    ])
  );

  let totalModuleInvariants = 0;
  let totalSymbolContracts = 0;
  let contractedModules = 0;

  for (const mod of modules) {
    const bucket = byLayerMap.get(mod.layer);
    if (bucket) {
      bucket.total += 1;
      if (mod.hasContract) bucket.contracted += 1;
      else bucket.pending += 1;
    }
    if (mod.hasContract) contractedModules += 1;
    if (mod.moduleContract) {
      totalModuleInvariants += mod.moduleContract.invariants.length;
    }
    totalSymbolContracts += mod.symbolContracts.length;
  }

  const totalModules = modules.length;
  const coveragePct =
    totalModules > 0 ? Number(((contractedModules / totalModules) * 100).toFixed(1)) : 0;

  return {
    modules,
    tier1ProtectedModules: [...TIER_1_CONTRACTED_MODULES],
    tier2ProtectedModules: [...TIER_2_CONTRACTED_MODULES],
    tier3ProtectedModules: [...TIER_3_CONTRACTED_MODULES],
    tier4ProtectedModules: [...TIER_4_CONTRACTED_MODULES],
    protectedModules: [...PROTECTED_CONTRACTED_MODULES],
    parseErrors,
    validationIssues,
    summary: {
      totalModules,
      contractedModules,
      uncontractedModules: totalModules - contractedModules,
      totalModuleInvariants,
      totalSymbolContracts,
      coveragePct,
      byLayer: Array.from(byLayerMap.values()),
    },
  };
}

/**
 * Extracts ObjectExpression literal keys from matching top-level or nested const/let/var initializers.
 */
function extractObjectLiteralKeysByVariable(filePath, targetNames) {
  const result = new Map(targetNames.map((n) => [n, []]));
  if (!fs.existsSync(filePath)) return { keysByVar: result, parseError: null };

  const code = fs.readFileSync(filePath, 'utf-8');
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'unambiguous',
      allowReturnOutsideFunction: true,
      plugins: ['jsx'],
    });
  } catch (err) {
    return {
      keysByVar: result,
      parseError: err instanceof Error ? err.message : String(err),
    };
  }

  const targetSet = new Set(targetNames);
  traverse(ast, {
    VariableDeclarator({ node }) {
      if (
        node.id?.type === 'Identifier' &&
        targetSet.has(node.id.name) &&
        node.init?.type === 'ObjectExpression'
      ) {
        const list = [];
        for (const prop of node.init.properties) {
          if (prop.type !== 'ObjectProperty') continue;
          const k =
            prop.key.type === 'Identifier'
              ? prop.key.name
              : prop.key.type === 'StringLiteral'
                ? prop.key.value
                : null;
          if (k) list.push(k);
        }
        result.set(node.id.name, list);
      }
    },
  });

  return { keysByVar: result, parseError: null };
}

/**
 * Audits generator lookup maps across generate-architecture-matrix.js and ast-parser.js
 * to detect stale keys whose modules, scripts, dependencies, workflows, SQL entities,
 * signals, workers, public assets, or environment variables were removed or renamed.
 */
function findOrphanedGeneratorLookupKeys(rootDir, srcDir, options = {}) {
  const orphans = [];

  const checkAgainstSet = (mapName, file, keys, validSet, reason) => {
    for (const k of keys || []) {
      if (!validSet.has(k)) {
        orphans.push({ mapName, file, key: k, reason });
      }
    }
  };

  const checkAgainstDisk = (mapName, file, keys, reason) => {
    for (const k of keys || []) {
      if (!fs.existsSync(path.join(rootDir, k))) {
        orphans.push({ mapName, file, key: k, reason });
      }
    }
  };

  const matrixRel = 'scripts/generate-architecture-matrix.js';
  const matrixAbs = path.join(rootDir, matrixRel);
  if (fs.existsSync(matrixAbs)) {
    const { keysByVar, parseError } = extractObjectLiteralKeysByVariable(matrixAbs, [
      'scriptMetaMap',
      'pageDescriptions',
      'storeDescriptions',
      'hookRoles',
      'utilityDescriptions',
      'purposeMap',
      'storeMap',
      'writeAuthMap',
      'descMap',
      'indexDescMap',
      'functionMetaMap',
      'signalMetaMap',
      'workflowResponsibilityMap',
      'scriptSuiteMetaMap',
    ]);
    if (parseError) {
      orphans.push({
        mapName: 'AST_PARSE',
        file: matrixRel,
        key: matrixRel,
        reason: `Failed to parse generator lookup maps: ${parseError}`,
      });
    } else {
      const apiAndHooks = extractApiAndHookCatalog(srcDir);
      const appPagesSet = new Set(apiAndHooks.appPages.map((p) => p.file));
      const hooksSet = new Set(apiAndHooks.hooks.map((h) => h.name));
      const storesSet = new Set(extractStoreCatalog(srcDir).map((s) => s.name));
      const utilitiesSet = new Set(extractDomainUtilitiesCatalog(srcDir).map((u) => u.name));

      checkAgainstDisk(
        'scriptMetaMap',
        matrixRel,
        keysByVar.get('scriptMetaMap'),
        'Script file no longer exists on disk.'
      );
      checkAgainstSet(
        'pageDescriptions',
        matrixRel,
        keysByVar.get('pageDescriptions'),
        appPagesSet,
        'App Router entrypoint no longer exists in src/app/.'
      );
      checkAgainstSet(
        'storeDescriptions',
        matrixRel,
        keysByVar.get('storeDescriptions'),
        storesSet,
        'Zustand store no longer exists in src/stores/.'
      );
      checkAgainstSet(
        'hookRoles',
        matrixRel,
        keysByVar.get('hookRoles'),
        hooksSet,
        'Custom hook no longer exists in src/hooks/.'
      );
      checkAgainstSet(
        'utilityDescriptions',
        matrixRel,
        keysByVar.get('utilityDescriptions'),
        utilitiesSet,
        'Domain utility no longer exists in src/lib/ or src/app/.'
      );

      const pkgPath = path.join(rootDir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const depsSet = new Set([
          ...Object.keys(pkg.dependencies || {}),
          ...Object.keys(pkg.devDependencies || {}),
          ...Object.keys(pkg.overrides || {}),
        ]);
        checkAgainstSet(
          'purposeMap',
          matrixRel,
          keysByVar.get('purposeMap'),
          depsSet,
          'Package is no longer listed in package.json dependencies, devDependencies, or overrides.'
        );
      }

      const schemaPath = path.join(rootDir, 'supabase', 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const sqlEntities = extractSqlSchemaEntities(fs.readFileSync(schemaPath, 'utf-8'));
        const tablesSet = new Set(sqlEntities.tableNames);
        const indexesSet = new Set(sqlEntities.indexes.map((i) => i.name));
        const functionsSet = new Set(sqlEntities.functions.map((f) => f.rawName));

        checkAgainstSet(
          'storeMap',
          matrixRel,
          keysByVar.get('storeMap'),
          tablesSet,
          'SQL table no longer exists in supabase/schema.sql.'
        );
        checkAgainstSet(
          'writeAuthMap',
          matrixRel,
          keysByVar.get('writeAuthMap'),
          tablesSet,
          'SQL table no longer exists in supabase/schema.sql.'
        );
        checkAgainstSet(
          'descMap',
          matrixRel,
          keysByVar.get('descMap'),
          tablesSet,
          'SQL table no longer exists in supabase/schema.sql.'
        );
        checkAgainstSet(
          'indexDescMap',
          matrixRel,
          keysByVar.get('indexDescMap'),
          indexesSet,
          'SQL index no longer exists in supabase/schema.sql.'
        );
        checkAgainstSet(
          'functionMetaMap',
          matrixRel,
          keysByVar.get('functionMetaMap'),
          functionsSet,
          'SQL stored function no longer exists in supabase/schema.sql.'
        );
      }

      const signalKeys = keysByVar.get('signalMetaMap') || [];
      if (signalKeys.length > 0) {
        const crossBoundary =
          options?.crossBoundaryCatalog ||
          extractCrossBoundaryCouplingCatalog(srcDir, rootDir);
        const liveSignalsSet = new Set(
          crossBoundary.signalChannels.map((s) => `${s.kind}:${s.name}`)
        );
        checkAgainstSet(
          'signalMetaMap',
          matrixRel,
          signalKeys,
          liveSignalsSet,
          'Cross-boundary signal channel is no longer emitted or subscribed in src/.'
        );
      }

      const workflowsDir = path.join(rootDir, '.github', 'workflows');
      if (fs.existsSync(workflowsDir)) {
        const wfFilesSet = new Set(
          fs
            .readdirSync(workflowsDir)
            .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
        );
        checkAgainstSet(
          'workflowResponsibilityMap',
          matrixRel,
          keysByVar.get('workflowResponsibilityMap'),
          wfFilesSet,
          'GitHub Actions workflow file no longer exists in .github/workflows/.'
        );
      }

      const suiteKeys = keysByVar.get('scriptSuiteMetaMap') || [];
      if (suiteKeys.length > 0) {
        const scriptSuiteNames = new Set(
          extractTestHarnessCatalog(srcDir, rootDir).scriptSuites.map((f) => path.basename(f))
        );
        checkAgainstSet(
          'scriptSuiteMetaMap',
          matrixRel,
          suiteKeys,
          scriptSuiteNames,
          'CLI pipeline test suite no longer exists in scripts/.'
        );
      }
    }
  }

  const astParserRel = 'scripts/lib/ast-parser.js';
  const astParserAbs = path.join(rootDir, astParserRel);
  if (fs.existsSync(astParserAbs)) {
    const envSet = new Set([
      ...extractEnvironmentDependencyCatalog(rootDir, srcDir).map((e) => e.name),
      'NODE_ENV',
    ]);
    const { keysByVar, parseError } = extractObjectLiteralKeysByVariable(astParserAbs, [
      'varMetaMap',
      'workerRoleMap',
      'roleMap',
    ]);
    if (parseError) {
      orphans.push({
        mapName: 'AST_PARSE',
        file: astParserRel,
        key: astParserRel,
        reason: `Failed to parse AST lookup maps: ${parseError}`,
      });
    } else {
      checkAgainstSet(
        'varMetaMap',
        astParserRel,
        keysByVar.get('varMetaMap'),
        envSet,
        'Environment variable is absent from .env.example and active consumers.'
      );
      const workersSet = new Set(
        extractWorkerCatalog(srcDir)
          .filter((w) => w.file.startsWith('src/workers/'))
          .map((w) => w.name)
      );
      checkAgainstSet(
        'workerRoleMap',
        astParserRel,
        keysByVar.get('workerRoleMap'),
        workersSet,
        'Web Worker file no longer exists in src/workers/.'
      );
      checkAgainstDisk(
        'roleMap',
        astParserRel,
        keysByVar.get('roleMap'),
        'Public/icon asset file no longer exists on disk.'
      );
    }
  }

  return orphans.sort(
    (a, b) => compareCodepoint(a.mapName, b.mapName) || compareCodepoint(a.key, b.key)
  );
}

const MERMAID_RESERVED_NODE_IDS = new Set([
  'end',
  'subgraph',
  'graph',
  'flowchart',
  'direction',
  'classDef',
  'class',
  'style',
  'linkStyle',
  'click',
  'call',
  'default',
]);

/**
 * Validates fenced ```mermaid diagrams in Markdown for render-breaking syntax,
 * HTML-tag swallowing hazards, parent/compound subgraph cycles, undeclared nodes/actors,
 * and strictly disconnected orphan nodes.
 */
function validateMermaidDiagramsInMarkdown(markdownText, relPath = 'markdown') {
  const violations = [];
  if (typeof markdownText !== 'string' || markdownText.length === 0) {
    return violations;
  }

  const lines = markdownText.split(/\r?\n/);
  let inBlock = false;
  let blockStart = 0;
  let blockLines = [];
  let blockIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBlock && /^```mermaid\s*$/.test(line)) {
      inBlock = true;
      blockStart = i + 1;
      blockLines = [];
      blockIdx++;
      continue;
    }
    if (inBlock && /^```\s*$/.test(line)) {
      inBlock = false;
      inspectMermaidBlock(relPath, blockIdx, blockStart, blockLines, violations);
      continue;
    }
    if (inBlock) {
      blockLines.push({ lineNo: i + 1, text: line });
    }
  }

  if (inBlock) {
    violations.push(`${relPath}:${blockStart} Unclosed \`\`\`mermaid code fence.`);
  }

  return violations;
}

function inspectMermaidLabelText(relPath, blockIdx, lineNo, context, rawText, violations) {
  if (!rawText) return;
  const htmlTags = rawText.match(/<[a-zA-Z][a-zA-Z0-9:_-]*>/g);
  if (htmlTags) {
    violations.push(
      `${relPath}:${lineNo} (Diagram #${blockIdx}) HTML-like tag ${htmlTags.join(', ')} in ${context} will be stripped under htmlLabels:true (escape with &lt;...&gt; or use {name}/*.ext).`
    );
  }
  if (/<>/.test(rawText)) {
    violations.push(
      `${relPath}:${lineNo} (Diagram #${blockIdx}) Empty "<>" operator in ${context} under htmlLabels:true (use "!=" or "≠").`
    );
  }
  const quoteCount = (rawText.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    violations.push(
      `${relPath}:${lineNo} (Diagram #${blockIdx}) Unbalanced double quotes in ${context}.`
    );
  }
}

function inspectMermaidBlock(relPath, blockIdx, startLine, rows, violations) {
  const firstNonEmpty = rows.find((r) => r.text.trim() && !r.text.trim().startsWith('%%'));
  if (!firstNonEmpty) {
    violations.push(`${relPath}:${startLine} (Diagram #${blockIdx}) Empty Mermaid diagram block.`);
    return;
  }

  const header = firstNonEmpty.text.trim();
  const isFlow = /^(?:flowchart|graph)\s+(?:TD|TB|BT|RL|LR)\s*$/.test(header);
  const isSeq = /^sequenceDiagram\s*$/.test(header);
  const isOtherValid = /^(?:stateDiagram(?:-v2)?|classDiagram|erDiagram|xychart-beta)\s*$/.test(header);

  if (!isFlow && !isSeq && !isOtherValid) {
    violations.push(
      `${relPath}:${firstNonEmpty.lineNo} (Diagram #${blockIdx}) Invalid Mermaid diagram header "${header}".`
    );
    return;
  }

  if (isFlow) {
    const sgStack = [];
    const subgraphs = new Map();
    const nodes = new Map();
    const edges = [];

    for (const { lineNo, text } of rows) {
      if (lineNo === firstNonEmpty.lineNo) continue;
      const t = text.trim();
      if (!t || t.startsWith('%%')) continue;

      const sgMatch = t.match(/^subgraph\s+([A-Za-z0-9_]+)(?:\s+\[(.*)\])?\s*$/);
      if (sgMatch) {
        const sgId = sgMatch[1];
        if (MERMAID_RESERVED_NODE_IDS.has(sgId)) {
          violations.push(`${relPath}:${lineNo} (Diagram #${blockIdx}) Reserved Mermaid keyword "${sgId}" used as subgraph ID.`);
        }
        if (subgraphs.has(sgId) || nodes.has(sgId)) {
          violations.push(`${relPath}:${lineNo} (Diagram #${blockIdx}) Duplicate Mermaid identifier "${sgId}".`);
        }
        subgraphs.set(sgId, { parent: sgStack.length ? sgStack[sgStack.length - 1] : null, lineNo });
        sgStack.push(sgId);
        if (sgMatch[2]) {
          inspectMermaidLabelText(relPath, blockIdx, lineNo, `subgraph "${sgId}"`, sgMatch[2], violations);
        }
        continue;
      }

      if (/^end$/.test(t)) {
        if (!sgStack.length) {
          violations.push(`${relPath}:${lineNo} (Diagram #${blockIdx}) Unexpected "end" outside any subgraph.`);
        } else {
          sgStack.pop();
        }
        continue;
      }

      if (/^(?:direction|classDef|class|style|linkStyle|click)\s/.test(t)) continue;

      const edgeMatch = t.match(
        /^([A-Za-z0-9_]+)\s*(<-->|-->|<-\.->|-\.->|==>|---|-\.-)(?:\|([^|]*)\|)?\s*([A-Za-z0-9_]+)\s*$/
      );
      if (edgeMatch) {
        const [, from, arrow, edgeLabel, to] = edgeMatch;
        edges.push({ lineNo, from, arrow, to });
        if (edgeLabel !== undefined) {
          const trimmedLbl = edgeLabel.trim();
          const isQuoted = trimmedLbl.startsWith('"') && trimmedLbl.endsWith('"');
          if (!isQuoted && /[()[\]{}<>]/.test(trimmedLbl)) {
            violations.push(
              `${relPath}:${lineNo} (Diagram #${blockIdx}) Unquoted Mermaid edge label |${trimmedLbl}| contains parentheses/brackets/angle-brackets; wrap in |"..."| quotes.`
            );
          }
          inspectMermaidLabelText(relPath, blockIdx, lineNo, `edge ${from} ${arrow} ${to}`, trimmedLbl, violations);
        }
        continue;
      }

      if (/(?:<-->|-->|<-\.->|-\.->|==>)/.test(t)) {
        const parts = t.split(/\s*(?:<-->|-->|<-\.->|-\.->|==>)(?:\|(?:"[^"]*"|[^|]*)\|)?\s*/);
        const ids = [];
        for (const p of parts) {
          const nm = p.trim().match(/^([A-Za-z0-9_]+)(.*)$/);
          if (nm) {
            ids.push(nm[1]);
            if (MERMAID_RESERVED_NODE_IDS.has(nm[1])) {
              violations.push(`${relPath}:${lineNo} (Diagram #${blockIdx}) Reserved Mermaid keyword "${nm[1]}" used as node ID.`);
            }
            if (nm[2] && !nodes.has(nm[1])) {
              nodes.set(nm[1], { subgraph: sgStack.length ? sgStack[sgStack.length - 1] : null, lineNo });
              inspectMermaidLabelText(relPath, blockIdx, lineNo, `node "${nm[1]}"`, nm[2], violations);
            }
          }
        }
        for (let k = 0; k < ids.length - 1; k++) {
          edges.push({ lineNo, from: ids[k], arrow: '-->', to: ids[k + 1] });
        }
        continue;
      }

      const nodeMatch = t.match(/^([A-Za-z0-9_]+)\s*(\[.*|\(.*|\{.*)$/);
      if (nodeMatch) {
        const id = nodeMatch[1];
        const rawLabel = nodeMatch[2];
        if (MERMAID_RESERVED_NODE_IDS.has(id)) {
          violations.push(`${relPath}:${lineNo} (Diagram #${blockIdx}) Reserved Mermaid keyword "${id}" used as node ID.`);
        }
        if (subgraphs.has(id)) {
          violations.push(`${relPath}:${lineNo} (Diagram #${blockIdx}) Node ID "${id}" collides with subgraph ID.`);
        }
        if (nodes.has(id)) {
          violations.push(
            `${relPath}:${lineNo} (Diagram #${blockIdx}) Duplicate node declaration "${id}" (previously at L${nodes.get(id).lineNo}).`
          );
        }
        nodes.set(id, { subgraph: sgStack.length ? sgStack[sgStack.length - 1] : null, lineNo });
        inspectMermaidLabelText(relPath, blockIdx, lineNo, `node "${id}"`, rawLabel, violations);
        continue;
      }

      violations.push(`${relPath}:${lineNo} (Diagram #${blockIdx}) Unrecognized Mermaid flowchart line: "${t}".`);
    }

    if (sgStack.length) {
      violations.push(`${relPath}:${startLine} (Diagram #${blockIdx}) Unclosed subgraph(s): ${sgStack.join(', ')}.`);
    }

    const isDescendantOf = (entityId, targetSg) => {
      let cur = nodes.has(entityId)
        ? nodes.get(entityId).subgraph
        : subgraphs.has(entityId)
          ? subgraphs.get(entityId).parent
          : null;
      while (cur) {
        if (cur === targetSg) return true;
        cur = subgraphs.has(cur) ? subgraphs.get(cur).parent : null;
      }
      return false;
    };

    const getContainingChain = (entityId) => {
      const chain = [];
      let cur = subgraphs.has(entityId)
        ? entityId
        : nodes.has(entityId)
          ? nodes.get(entityId).subgraph
          : null;
      while (cur) {
        chain.push(cur);
        cur = subgraphs.has(cur) ? subgraphs.get(cur).parent : null;
      }
      return chain;
    };

    const directlyConnected = new Set();
    const sgEdgePairs = new Set();

    for (const e of edges) {
      directlyConnected.add(e.from);
      directlyConnected.add(e.to);

      if (!nodes.has(e.from) && !subgraphs.has(e.from)) {
        violations.push(`${relPath}:${e.lineNo} (Diagram #${blockIdx}) Undeclared edge source "${e.from}".`);
      }
      if (!nodes.has(e.to) && !subgraphs.has(e.to)) {
        violations.push(`${relPath}:${e.lineNo} (Diagram #${blockIdx}) Undeclared edge target "${e.to}".`);
      }

      if (subgraphs.has(e.to) && isDescendantOf(e.from, e.to)) {
        violations.push(
          `${relPath}:${e.lineNo} (Diagram #${blockIdx}) Fatal parent-child subgraph cycle: "${e.from}" is nested inside "${e.to}" (${e.from} ${e.arrow} ${e.to}).`
        );
      } else if (subgraphs.has(e.from) && isDescendantOf(e.to, e.from)) {
        violations.push(
          `${relPath}:${e.lineNo} (Diagram #${blockIdx}) Fatal parent-child subgraph cycle: "${e.to}" is nested inside "${e.from}" (${e.from} ${e.arrow} ${e.to}).`
        );
      } else if (e.from === e.to && subgraphs.has(e.from)) {
        violations.push(
          `${relPath}:${e.lineNo} (Diagram #${blockIdx}) Subgraph self-loop "${e.from} ${e.arrow} ${e.to}".`
        );
      }

      if (subgraphs.has(e.from) || subgraphs.has(e.to)) {
        const fromChain = getContainingChain(e.from);
        const toChain = getContainingChain(e.to);
        for (const a of fromChain) {
          for (const b of toChain) {
            if (a !== b && !isDescendantOf(a, b) && !isDescendantOf(b, a)) {
              sgEdgePairs.add(`${a}->${b}`);
              if (e.arrow === '<-->' || e.arrow === '<-.->') {
                sgEdgePairs.add(`${b}->${a}`);
              }
            }
          }
        }
      }
    }

    // Also record child-to-child inter-subgraph edges to catch opposing compound subgraph cycles
    for (const e of edges) {
      if (!subgraphs.has(e.from) && !subgraphs.has(e.to)) {
        const fromChain = getContainingChain(e.from);
        const toChain = getContainingChain(e.to);
        for (const a of fromChain) {
          for (const b of toChain) {
            if (a !== b && !isDescendantOf(a, b) && !isDescendantOf(b, a)) {
              if (sgEdgePairs.has(`${b}->${a}`)) {
                const [pairA, pairB] = [a, b].sort(compareCodepoint);
                violations.push(
                  `${relPath}:${e.lineNo} (Diagram #${blockIdx}) Compound subgraph cycle between "${pairA}" and "${pairB}" (mix of subgraph-level and child-level opposing edges).`
                );
              }
            }
          }
        }
      } else {
        const fromChain = getContainingChain(e.from);
        const toChain = getContainingChain(e.to);
        for (const a of fromChain) {
          for (const b of toChain) {
            if (a !== b && sgEdgePairs.has(`${a}->${b}`) && sgEdgePairs.has(`${b}->${a}`)) {
              const [pairA, pairB] = [a, b].sort(compareCodepoint);
              violations.push(
                `${relPath}:${e.lineNo} (Diagram #${blockIdx}) Bidirectional subgraph-level compound cycle between "${pairA}" and "${pairB}".`
              );
            }
          }
        }
      }
    }

    const hasConnectedSubgraph = (sgId) => {
      let cur = sgId;
      while (cur) {
        if (directlyConnected.has(cur)) return true;
        cur = subgraphs.has(cur) ? subgraphs.get(cur).parent : null;
      }
      return false;
    };

    for (const [id, info] of nodes.entries()) {
      if (!directlyConnected.has(id) && !hasConnectedSubgraph(info.subgraph)) {
        violations.push(
          `${relPath}:${info.lineNo} (Diagram #${blockIdx}) Disconnected orphan node "${id}" with 0 edges and no connected parent subgraph.`
        );
      }
    }
  } else if (isSeq) {
    const actors = new Set();
    let altDepth = 0;
    for (const { lineNo, text } of rows) {
      if (lineNo === firstNonEmpty.lineNo) continue;
      const t = text.trim();
      if (!t || t.startsWith('%%') || t === 'autonumber') continue;

      const pm = t.match(/^(?:actor|participant)\s+([A-Za-z0-9_]+)(?:\s+as\s+(.*))?$/);
      if (pm) {
        if (actors.has(pm[1])) {
          violations.push(`${relPath}:${lineNo} (Diagram #${blockIdx}) Duplicate sequence participant "${pm[1]}".`);
        }
        actors.add(pm[1]);
        if (pm[2]) {
          inspectMermaidLabelText(relPath, blockIdx, lineNo, `participant "${pm[1]}"`, pm[2], violations);
        }
        continue;
      }

      if (/^(?:alt|opt|loop|par|critical|break)\b/.test(t)) {
        altDepth++;
        continue;
      }
      if (/^(?:else|and)\b/.test(t)) {
        if (altDepth === 0) {
          violations.push(`${relPath}:${lineNo} (Diagram #${blockIdx}) Unexpected "${t}" outside alt/opt/par block.`);
        }
        continue;
      }
      if (/^end$/.test(t)) {
        if (altDepth === 0) {
          violations.push(`${relPath}:${lineNo} (Diagram #${blockIdx}) Extra "end" in sequenceDiagram.`);
        } else {
          altDepth--;
        }
        continue;
      }

      const mm = t.match(/^([A-Za-z0-9_]+)\s*-+>{1,2}[+-]?\s*([A-Za-z0-9_]+)\s*:\s*(.*)$/);
      if (mm) {
        if (!actors.has(mm[1])) {
          violations.push(`${relPath}:${lineNo} (Diagram #${blockIdx}) Undeclared sequence actor "${mm[1]}".`);
        }
        if (!actors.has(mm[2])) {
          violations.push(`${relPath}:${lineNo} (Diagram #${blockIdx}) Undeclared sequence actor "${mm[2]}".`);
        }
        inspectMermaidLabelText(relPath, blockIdx, lineNo, `sequence message ${mm[1]}->${mm[2]}`, mm[3], violations);
        continue;
      }

      violations.push(`${relPath}:${lineNo} (Diagram #${blockIdx}) Unrecognized sequenceDiagram line: "${t}".`);
    }

    if (altDepth !== 0) {
      violations.push(`${relPath}:${startLine} (Diagram #${blockIdx}) Unclosed sequenceDiagram alt/opt block.`);
    }
  }
}

module.exports = {
  compareCodepoint,
  getDeterministicTextOrBinaryBytes,
  getAllSourceFiles,
  resolveImportPath,
  analyzeDependencyGraph,
  detectCircularDependencies,
  getAstParseErrors,
  detectLayerViolations,
  detectOrphanedModules,
  analyzeScriptsDependencyGraph,
  extractCrossBoundaryCouplingCatalog,
  TIER_1_CONTRACTED_MODULES,
  TIER_2_CONTRACTED_MODULES,
  TIER_3_CONTRACTED_MODULES,
  TIER_4_CONTRACTED_MODULES,
  PROTECTED_CONTRACTED_MODULES,
  CONTRACT_LAYER_ORDER,
  parseJsDocContractTags,
  extractBehavioralContractsCatalog,
  extractObjectLiteralKeysByVariable,
  findOrphanedGeneratorLookupKeys,
  validateMermaidDiagramsInMarkdown,
  extractComponentCatalog,
  extractStoreCatalog,
  extractApiAndHookCatalog,
  extractDomainUtilitiesCatalog,
  extractConfigurationCatalog,
  extractTypeCatalog,
  extractServiceWorkerMetadata,
  extractWorkerCatalog,
  extractTestsFromSourceAst,
  extractSqlSchemaEntities,
  extractTestHarnessCatalog,
  extractTestHarnessAstDependencies,
  extractPublicAssetsCatalog,
  extractEnvironmentDependencyCatalog,
};


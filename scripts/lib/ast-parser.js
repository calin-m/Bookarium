/**
 * AST Parser Engine - Bookarium (Governance Rule 2)
 *
 * Programmatically inspects source code AST via Babel to provide a single
 * source of truth for architecture matrices, component catalogs, store schemas,
 * and dependency topologies with mathematical zero-drift.
 */

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

/**
 * Recursively retrieves all TypeScript/TSX source files, excluding test and mock suites.
 */
function getAllSourceFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
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
    const exportedProps = [];
    const exportedInterfaces = [];

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
          }
        },
        ExportAllDeclaration({ node }) {
          if (node.source && node.source.value) {
            const importSource = node.source.value;
            rawImports.push(importSource);
            if (importSource.startsWith('@/') || importSource.startsWith('.')) {
              internalImports.push(importSource);
            }
          }
        },
        ExportNamedDeclaration({ node }) {
          if (node.source && node.source.value) {
            const importSource = node.source.value;
            rawImports.push(importSource);
            if (importSource.startsWith('@/') || importSource.startsWith('.')) {
              internalImports.push(importSource);
            }
          }
        },
        TSInterfaceDeclaration({ node }) {
          if (node.id && node.id.name) {
            const propNames = (node.body.body || [])
              .filter((m) => m.key && m.key.name)
              .map((m) => m.key.name);
            const iface = {
              name: node.id.name,
              props: propNames,
            };
            exportedInterfaces.push(iface);
            if (node.id.name.endsWith('Props')) {
              exportedProps.push(iface);
            }
          }
        },
        TSTypeAliasDeclaration({ node }) {
          if (node.id && node.id.name && node.typeAnnotation && node.typeAnnotation.type === 'TSTypeLiteral') {
            const propNames = (node.typeAnnotation.members || [])
              .filter((m) => m.key && m.key.name)
              .map((m) => m.key.name);
            const typeInfo = {
              name: node.id.name,
              props: propNames,
            };
            exportedInterfaces.push(typeInfo);
            if (node.id.name.endsWith('Props')) {
              exportedProps.push(typeInfo);
            }
          }
        },
      });
    } catch (_err) {
      // Regex fallback for unparseable chunks
      const importRegex = /(?:import|export\s+.*?from)\s+['"](@\/.*?|\..*?)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        internalImports.push(match[1]);
      }
    }

    // Capture Web Worker references via new URL(..., import.meta.url)
    const workerMatch = content.match(/new\s+(?:window\.)?Worker\s*\(\s*new\s+URL\s*\(\s*['"]([^'"]+)['"]/);
    if (workerMatch && workerMatch[1]) {
      internalImports.push(workerMatch[1]);
    }

    graph.set(relativePath, {
      file: relativePath,
      absolutePath: file,
      imports: internalImports,
      rawImports,
      exportedProps,
      exportedInterfaces,
      resolvedImports: [],
      consumedBy: [],
    });
  }

  // Resolve internal linkage and downstream consumers
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
      for (const neighbor of nodeData.resolvedImports) {
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
    cycleCount: cycles.length,
    cycles,
  };
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
    const category = parts[2] || 'general';
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

    // Extract storage key if persisted
    let storageKey = 'In-Memory (Ephemeral)';
    const storageKeyMatch = content.match(/name:\s*['"]([^'"]+)['"]/);
    if (storageKeyMatch) {
      storageKey = `\`${storageKeyMatch[1]}\` (localStorage)`;
    } else if (content.includes('STORAGE_KEYS.')) {
      const constMatch = content.match(/STORAGE_KEYS\.([A-Z_]+)/);
      if (constMatch) {
        storageKey = `\`STORAGE_KEYS.${constMatch[1]}\` (localStorage)`;
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
 * Extracts API routes and custom hooks across the application.
 */
function extractApiAndHookCatalog(srcDir) {
  const apiDir = path.join(srcDir, 'app', 'api');
  const routes = [];

  function scanApi(dir, routePath = '/api') {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanApi(full, `${routePath}/${entry.name}`);
      } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
        const content = fs.readFileSync(full, 'utf-8');
        const methods = [];
        if (/export\s+async\s+function\s+GET\b/.test(content)) methods.push('GET');
        if (/export\s+async\s+function\s+POST\b/.test(content)) methods.push('POST');
        if (/export\s+async\s+function\s+PUT\b/.test(content)) methods.push('PUT');
        if (/export\s+async\s+function\s+DELETE\b/.test(content)) methods.push('DELETE');

        routes.push({
          path: routePath,
          file: path.relative(path.resolve(srcDir, '..'), full).replace(/\\/g, '/'),
          methods: methods.length > 0 ? methods.join(', ') : 'GET',
        });
      }
    }
  }

  scanApi(apiDir);

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
    hooks: hooks.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
  };
}

module.exports = {
  getAllSourceFiles,
  resolveImportPath,
  analyzeDependencyGraph,
  detectCircularDependencies,
  detectOrphanedModules,
  extractComponentCatalog,
  extractStoreCatalog,
  extractApiAndHookCatalog,
};


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
const traverseModule = require('@babel/traverse');
const traverse = traverseModule.default || traverseModule;

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
    const staticImports = [];
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
            if (node.importKind !== 'type') {
              staticImports.push(importSource);
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
              if (node.exportKind !== 'type') {
                staticImports.push(importSource);
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
    }

    graph.set(relativePath, {
      file: relativePath,
      absolutePath: file,
      imports: Array.from(new Set(internalImports)),
      staticImports: Array.from(new Set(staticImports)),
      rawImports: Array.from(new Set(rawImports)),
      exportedProps,
      exportedInterfaces,
      resolvedImports: [],
      resolvedStaticImports: [],
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
    for (const imp of data.staticImports) {
      const resolved = resolveImportPath(imp, fileRel, allFilesSet);
      if (resolved && graph.has(resolved) && !data.resolvedStaticImports.includes(resolved)) {
        data.resolvedStaticImports.push(resolved);
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
        const methods = [];
        if (/export\s+async\s+function\s+GET\b/.test(content)) methods.push('GET');
        if (/export\s+async\s+function\s+POST\b/.test(content)) methods.push('POST');
        if (/export\s+async\s+function\s+PUT\b/.test(content)) methods.push('PUT');
        if (/export\s+async\s+function\s+DELETE\b/.test(content)) methods.push('DELETE');

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
 * Extracts Web Worker and PWA Service Worker architecture modules from src/workers/ and public/.
 */
function extractWorkerCatalog(srcDir) {
  const workersDir = path.join(srcDir, 'workers');
  const workers = [];

  if (fs.existsSync(workersDir)) {
    const files = fs
      .readdirSync(workersDir)
      .filter((f) => (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.test.ts') && !f.endsWith('.test.js'));

    for (const file of files) {
      workers.push({
        name: file.replace(/\.(ts|js)$/, ''),
        file: `src/workers/${file}`,
        role: 'Dedicated off-thread Web Worker parsing raw Project Gutenberg plain-text AST, calculating chapter segmentation boundaries, and computing fluid paginated layouts without blocking the UI thread.',
      });
    }
  }

  const swPath = path.join(srcDir, '..', 'public', 'sw.js');
  if (fs.existsSync(swPath)) {
    workers.push({
      name: 'sw',
      file: 'public/sw.js',
      role: 'Progressive Web App (PWA) Service Worker (`bookarium-app-shell-v4`) providing offline App Shell caching (`/` + `/account` + `/read/1342`), HTML-embedded `/_next/static/` chunk extraction, `_rsc` Flight isolation, and `/read/*` navigation fallback for 100% offline reading.',
    });
  }

  return workers;
}

/**
 * Extracts Hermetic Testing, MSW v2 Network Isolation & Coverage Harness metadata from src/test/, src/mocks/, vitest.config.mts, and test suites.
 */
function extractTestHarnessCatalog(srcDir, rootDir) {
  const harnessModules = [];

  const candidates = [
    {
      name: 'setup',
      file: 'src/test/setup.ts',
      layer: 'JSDOM & Browser API Test Bootstrap',
      role: 'Global Vitest setup bootstrapping `@testing-library/jest-dom/vitest`, MSW v2 server lifecycle (`listen`, `resetHandlers`, `close`), pre-test `next/dynamic` chunk resolution (`pendingDynamicImports`), `localStorage` sanitization, and deterministic JSDOM polyfills (`matchMedia`, `ResizeObserver`, `IntersectionObserver`, `scrollTo`, `SpeechSynthesis`, `IndexedDB`).',
    },
    {
      name: 'handlers',
      file: 'src/mocks/handlers.ts',
      layer: 'MSW v2 HTTP Interception Handlers',
      role: 'Canonical Mock Service Worker v2 HTTP request handlers and `mockBooks` public domain fixtures intercepting `/api/books`, `/api/books/content`, `/api/books/translations`, Gutendex API, and allowlisted HTTPS Project Gutenberg mirror streams (`aleph`, `pglaf`, `readingroo.ms`, `www.gutenberg.org`) for zero-network deterministic testing.',
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
      strategy: 'NextRequest/NextResponse edge route verification, MSW v2 upstream failover, SSR metadata, and full-page user journeys.',
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
      strategy: 'Local storage hydration, optimistic outbox mutations, tombstone filtering, LWW conflict resolution, and 6-store session teardown.',
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
      strategy: 'Pure computational & security verification (multi-jurisdictional copyright, SSRF/redirect sanitizers, rate limiter, Gutenberg AST segmentation/reflow/pagination, interval annotator).',
    },
    {
      id: 'config',
      layer: 'Configuration, Anthologies & Design Tokens',
      scope: '`src/config/*.test.ts`',
      match: (f) => f.startsWith('src/config/'),
      strategy: 'Schema integrity, curated 27-masterwork anthology lifespan validation, and theme/accolade token invariants.',
    },
    {
      id: 'worker_proxy',
      layer: 'Background Web Worker & Edge Reverse Proxy',
      scope: '`src/workers/*.test.ts` & `src/proxy.test.ts`',
      match: (f) => f.startsWith('src/workers/') || f === 'src/proxy.test.ts',
      strategy: 'Off-thread Web Worker message lifecycle (`PARSE_BOOK`) and Edge Geo-IP / cookie / Supabase session refresh proxy tests.',
    },
    {
      id: 'scripts',
      layer: 'CLI Data Ingestion Pipelines & AST Security Rules',
      scope: '`scripts/**/*.test.ts`',
      match: (f) => f.startsWith('scripts/'),
      strategy: 'Hermetic `pg_catalog.csv.gz` streaming decompression, RFC 4180 CSV parsing, PGLAF mirror-first featured quotes extraction, Wikidata SPARQL FRBR translation clustering, and 9-rule ESLint AST & request-taint security verification.',
    },
  ];

  const layerBreakdown = layerDefs.map((def) => {
    const matchedFiles = testSuites.filter(def.match);
    let testCount = 0;
    for (const rel of matchedFiles) {
      const fullPath = path.join(rootDir, rel);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const matches = [...content.matchAll(/(?:it|test)(?:\.skip|\.only)?\s*\(\s*['"`]/g)];
      testCount += matches.length;
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
 * Extracts static and PWA asset files from public/ and Next.js App Router file-based metadata icons in src/app/.
 */
function extractPublicAssetsCatalog(rootDir) {
  const publicDir = path.join(rootDir, 'public');
  if (!fs.existsSync(publicDir)) return [];

  const assets = [];
  const roleMap = {
    'public/sw.js': 'PWA Service Worker (`bookarium-app-shell-v6`) managing App Shell caching, static asset discovery, and offline route navigation fallback.',
    'public/favicon.ico': 'Multi-resolution 32-bit RGBA binary icon container (`16×16`, `32×32`, `48×48`) with soaring book brand emblem for browser tabs.',
    'public/icon.svg': 'Scalable vector soaring book brand emblem with 3-tiered page depths, sunlit amber peaks, core terracotta arches, and deep burnt outer wings.',
    'public/icons/apple-touch-icon.png': 'High-DPI iOS / iPadOS Home Screen Web Clip icon (`512×512` PNG).',
    'public/icons/icon-192.png': 'Standard PWA Web App Manifest home screen icon (`192×192` PNG, `purpose: "any"`).',
    'public/icons/icon-512.png': 'High-DPI PWA splash screen and desktop application icon (`512×512` PNG, `purpose: "any"`).',
    'public/icons/icon-1024.png': 'Ultra-High-DPI tablet PWA splash screen and application icon (`1024×1024` PNG, `purpose: "any"`).',
    'public/icons/icon-maskable-192.png': 'Android adaptive launcher maskable icon with safe-zone padding (`192×192` PNG, `purpose: "maskable"`).',
    'public/icons/icon-maskable-512.png': 'High-DPI Android adaptive launcher maskable icon (`512×512` PNG, `purpose: "maskable"`).',
    'src/app/favicon.ico': 'Next.js App Router root `favicon.ico` metadata convention (`16×16`, `32×32`, `48×48` 32-bit RGBA `.ico`).',
    'src/app/icon.svg': 'Next.js App Router scalable vector `icon.svg` metadata convention rendered in modern browser tabs.',
    'src/app/apple-icon.png': 'Next.js App Router `apple-icon.png` metadata convention (`180×180` PNG) automatically linked as `apple-touch-icon`.',
  };

  function scanPublic(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanPublic(full);
      } else {
        const rel = path.relative(rootDir, full).replace(/\\/g, '/');
        const stat = fs.statSync(full);
        const sizeKb = (stat.size / 1024).toFixed(1) + ' KB';
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

  const appIconCandidates = ['src/app/favicon.ico', 'src/app/icon.svg', 'src/app/apple-icon.png'];
  for (const rel of appIconCandidates) {
    const full = path.join(rootDir, rel);
    if (fs.existsSync(full)) {
      const stat = fs.statSync(full);
      const sizeKb = (stat.size / 1024).toFixed(1) + ' KB';
      const ext = path.extname(rel).replace('.', '').toUpperCase() || 'ASSET';
      assets.push({
        name: path.basename(rel),
        file: rel,
        format: ext,
        size: sizeKb,
        role: roleMap[rel] || 'Next.js App Router metadata icon asset.',
      });
    }
  }

  return assets.sort((a, b) => a.file.localeCompare(b.file));
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
      fallback: 'Defaults to `https://bookarium.vercel.app` (`SITE_CONFIG.URL`) or request origin header.',
      purpose: 'Canonical origin for OpenGraph metadata, `sitemap.xml`, `robots.txt`, shareable book links, and PKCE auth callback validation.',
    },
    NEXT_PUBLIC_SUPABASE_URL: {
      scope: 'Public Browser & Edge SSR (`NEXT_PUBLIC_*`)',
      fallback: '100% Zero-API-Key Guest Mode: Catalog fails over to Gutendex REST API; collections persist in `localStorage` & `IndexedDB`.',
      purpose: 'Supabase project URL for PostgreSQL catalog queries (`public.books`), FRBR translations, SSR auth cookies, and 6-store cloud sync.',
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      scope: 'Public Browser & Edge SSR (`NEXT_PUBLIC_*`)',
      fallback: '100% Zero-API-Key Guest Mode: Cloud sync and auth modals gracefully disable live network calls when unconfigured.',
      purpose: 'Public anonymous JWT key scoped strictly by PostgreSQL Row-Level Security (`ENABLE ROW LEVEL SECURITY` across all 14 tables).',
    },
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: {
      scope: 'Public Browser & Edge SSR (`NEXT_PUBLIC_*`)',
      fallback: 'Optional: `AuthModal` omits the Turnstile widget and submits directly when unconfigured in local development or offline setups.',
      purpose: 'Public Cloudflare Turnstile site key mounting a Managed bot-protection challenge in `AuthModal` and passing single-use `captchaToken` verification to Supabase Auth.',
    },
    NEXT_PUBLIC_LEGAL_CONTACT_FORM: {
      scope: 'Public Browser & Edge SSR (`NEXT_PUBLIC_*`)',
      fallback: 'Falls back to the repository GitHub Issue Tracker (`SITE_CONFIG.GITHUB_ISSUES_URL`) on `/copyright`.',
      purpose: 'Optional external intake URL for confidential territorial copyright or DMCA inquiries.',
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
    GUTENDEX_API_URL: {
      scope: 'Edge / Server Route & Config Override',
      fallback: 'Defaults to `https://gutendex.com/books` (`API_ENDPOINTS.GUTENDEX_BASE`).',
      purpose: 'Upstream Gutendex public domain catalog endpoint for failover search and metadata resolution.',
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
    for (const entry of fs.readdirSync(scriptsDir, { withFileTypes: true })) {
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
    for (const entry of fs.readdirSync(workflowsDir, { withFileTypes: true })) {
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
          plugins: ['typescript', 'jsx'],
        });
        traverse(ast, {
          MemberExpression({ node }) {
            if (
              node.object &&
              node.object.type === 'MemberExpression' &&
              node.object.object &&
              node.object.object.type === 'Identifier' &&
              node.object.object.name === 'process' &&
              node.object.property &&
              node.object.property.type === 'Identifier' &&
              node.object.property.name === 'env' &&
              node.property &&
              node.property.type === 'Identifier'
            ) {
              const varName = node.property.name;
              if (consumersMap.has(varName)) {
                foundVars.add(varName);
              }
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
    const consumers = consumersMap.get(name) || [];
    return {
      name,
      scope: meta.scope,
      fallback: meta.fallback,
      purpose: meta.purpose,
      consumers,
    };
  });
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
  extractDomainUtilitiesCatalog,
  extractConfigurationCatalog,
  extractTypeCatalog,
  extractWorkerCatalog,
  extractTestHarnessCatalog,
  extractPublicAssetsCatalog,
  extractEnvironmentDependencyCatalog,
};


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
        entry.name === 'error.tsx' ||
        entry.name === 'global-error.tsx' ||
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
        if (entry.name === 'layout.tsx') {
          kind = routeUri === '/' ? 'Root Layout' : 'Route Layout & SSR Metadata';
        } else if (entry.name === 'error.tsx' || entry.name === 'global-error.tsx') {
          kind = 'App Error Boundary';
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
          rendering: isClient ? 'Client Interactive (`"use client"`)' : 'React Server Component (SSR / Static)',
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
      role: 'Progressive Web App (PWA) Service Worker (`bookarium-app-shell-v2`) providing offline App Shell caching, static asset resilience, and `/read/*` RSC navigation fallback for 100% offline reading.',
    });
  }

  return workers;
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
};


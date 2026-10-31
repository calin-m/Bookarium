/**
 * Bookarium Custom ESLint & AST Security Plugin (`bookarium-security`)
 *
 * Enforces AST-level security invariants, intra-procedural request taint analysis,
 * client/server boundary isolation, project-level environment variable rules,
 * and test suite anti-tautology standards across both the IDE (VS Code ESLint)
 * and CI/Pre-Commit pipelines (`npm run lint`, `npm run security:audit`, `npm run verify`).
 */

const fs = require('fs');
const path = require('path');

const SERVER_ONLY_IMPORT_PATTERNS = [
  /^@\/lib\/supabase\/server$/,
  /^@\/lib\/supabase\/middleware$/,
  /^\.\.?\/.*supabase\/server$/,
  /^\.\.?\/.*supabase\/middleware$/,
  /^next\/headers$/,
  /^(?:node:)?(?:fs|fs\/promises|child_process|net|tls|dgram|cluster|worker_threads|zlib|dns)$/,
  /^(?:@\/|\.\.?\/).*scripts\//,
];

const SECRET_NEXT_PUBLIC_PATTERN =
  /^NEXT_PUBLIC_.*(?:SECRET|PRIVATE|SERVICE_ROLE|PASSWORD|TOKEN|PAT)(?:_|$)/i;

const SANITIZER_FUNCTION_NAMES = new Set([
  'isSafeUpstreamUrl',
  'sanitizeRedirectPath',
  'resolveCanonicalAuthOrigin',
  'buildAuthRedirectUrl',
  'buildShareUrl',
  'parseCatalogQuery',
  'parseCatalogQueryParams',
  'resolveClientCountry',
  'sanitizeSupabaseUrl',
  'parseInt',
  'parseFloat',
  'Number',
  'Boolean',
  'encodeURIComponent',
]);

const SANITIZER_MEMBER_METHODS = new Set([
  'trunc',
  'floor',
  'ceil',
  'round',
  'isInteger',
  'isFinite',
]);

const DB_WRITE_METHODS = new Set(['insert', 'upsert', 'update', 'rpc']);
const SHELL_EXEC_FUNCTIONS = new Set([
  'exec',
  'execSync',
  'spawn',
  'spawnSync',
  'execFile',
  'execFileSync',
]);

function isShellExecCall(callNode) {
  if (!callNode || !callNode.callee) return false;
  const { objectName, methodName } = getCalleeName(callNode);
  if (!methodName || !SHELL_EXEC_FUNCTIONS.has(methodName)) return false;
  if (methodName === 'exec') {
    if (callNode.callee.type === 'Identifier') {
      return true;
    }
    return objectName === 'child_process' || objectName === 'cp';
  }
  return true;
}
const FS_ACCESS_METHODS = new Set([
  'readFile',
  'readFileSync',
  'writeFile',
  'writeFileSync',
  'appendFile',
  'appendFileSync',
  'unlink',
  'unlinkSync',
  'rm',
  'rmSync',
]);

function normalizeFilename(context) {
  const raw =
    (typeof context.getFilename === 'function' ? context.getFilename() : context.filename) || '';
  return raw.replace(/\\/g, '/');
}

function isTestOrMockFile(filename) {
  return (
    filename.endsWith('.test.ts') ||
    filename.endsWith('.test.tsx') ||
    filename.endsWith('.spec.ts') ||
    filename.endsWith('.spec.tsx') ||
    filename.includes('/src/mocks/') ||
    filename.includes('/src/test/')
  );
}

function isApiRouteFile(filename) {
  return /\/src\/app\/api\/.*\/route\.ts$/.test(filename) || /^src\/app\/api\/.*\/route\.ts$/.test(filename);
}

function hasUseClientDirective(programNode) {
  if (!programNode || !Array.isArray(programNode.body)) return false;
  for (const stmt of programNode.body) {
    if (stmt.type === 'ExpressionStatement') {
      if (
        stmt.directive === 'use client' ||
        (stmt.expression &&
          stmt.expression.type === 'Literal' &&
          stmt.expression.value === 'use client') ||
        (stmt.expression &&
          stmt.expression.type === 'StringLiteral' &&
          stmt.expression.value === 'use client')
      ) {
        return true;
      }
    } else {
      break;
    }
  }
  return false;
}

function isClientReachableFile(filename, programNode) {
  if (isTestOrMockFile(filename)) return false;
  if (hasUseClientDirective(programNode)) return true;
  return (
    /(?:^|\/)src\/(?:components|hooks|stores)\//.test(filename)
  );
}

function getPropertyName(memberNode) {
  if (!memberNode || !memberNode.property) return null;
  if (!memberNode.computed && memberNode.property.type === 'Identifier') {
    return memberNode.property.name;
  }
  if (
    memberNode.computed &&
    (memberNode.property.type === 'Literal' || memberNode.property.type === 'StringLiteral') &&
    typeof memberNode.property.value === 'string'
  ) {
    return memberNode.property.value;
  }
  return null;
}

function isProcessEnvObject(node) {
  if (!node) return false;
  return (
    node.type === 'MemberExpression' &&
    node.object &&
    node.object.type === 'Identifier' &&
    node.object.name === 'process' &&
    getPropertyName(node) === 'env'
  );
}

function getCalleeName(callNode) {
  if (!callNode || !callNode.callee) return { objectName: null, methodName: null, fullName: '' };
  const callee = callNode.callee;
  if (callee.type === 'Identifier') {
    return { objectName: null, methodName: callee.name, fullName: callee.name };
  }
  if (callee.type === 'MemberExpression') {
    const prop = getPropertyName(callee);
    if (callee.object && callee.object.type === 'Identifier') {
      return {
        objectName: callee.object.name,
        methodName: prop,
        fullName: prop ? `${callee.object.name}.${prop}` : callee.object.name,
      };
    }
    if (callee.object && callee.object.type === 'MemberExpression') {
      const innerProp = getPropertyName(callee.object);
      const rootId =
        callee.object.object && callee.object.object.type === 'Identifier'
          ? callee.object.object.name
          : null;
      return {
        objectName: innerProp,
        methodName: prop,
        fullName: [rootId, innerProp, prop].filter(Boolean).join('.'),
      };
    }
    return { objectName: null, methodName: prop, fullName: prop || '' };
  }
  return { objectName: null, methodName: null, fullName: '' };
}

/**
 * Checks whether an AST expression is a direct taint source from an incoming request:
 * - request params (`params.*`, `(await context.params).*`)
 * - URL search params (`searchParams.get(...)`, `req.nextUrl.searchParams.get(...)`, `req.url`)
 * - headers (`req.headers.get(...)`, `headers().get(...)`)
 * - cookies (`req.cookies.get(...)`, `cookies().get(...)`, `cookieStore.get(...)`)
 * - user-submitted body data (`await req.json()`, `await req.formData()`, `await req.text()`)
 */
function detectDirectTaintSource(node) {
  if (!node) return null;

  if (
    node.type === 'AwaitExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSAsExpression' ||
    node.type === 'TSTypeAssertion' ||
    node.type === 'ParenthesizedExpression' ||
    node.type === 'ChainExpression'
  ) {
    return detectDirectTaintSource(node.argument || node.expression);
  }

  if (node.type === 'CallExpression') {
    const { objectName, methodName, fullName } = getCalleeName(node);

    // searchParams.get(...) / req.nextUrl.searchParams.get(...) / new URL(...).searchParams.get(...)
    if (
      methodName === 'get' &&
      (objectName === 'searchParams' ||
        fullName.endsWith('.searchParams.get') ||
        (node.callee.type === 'MemberExpression' &&
          node.callee.object &&
          node.callee.object.type === 'MemberExpression' &&
          getPropertyName(node.callee.object) === 'searchParams'))
    ) {
      return 'URL searchParams.get()';
    }

    // headers.get(...) / req.headers.get(...) / (await headers()).get(...)
    if (
      methodName === 'get' &&
      (objectName === 'headers' ||
        objectName === 'reqHeaders' ||
        objectName === 'requestHeaders' ||
        fullName === 'req.headers.get' ||
        fullName === 'request.headers.get' ||
        (node.callee.type === 'MemberExpression' &&
          node.callee.object &&
          node.callee.object.type === 'CallExpression' &&
          getCalleeName(node.callee.object).methodName === 'headers'))
    ) {
      // Note: response.headers.get(...) is an upstream HTTP response header, only treat req/request/headers() or location header as tainted
      const arg0 = node.arguments && node.arguments[0];
      const headerKey =
        arg0 && (arg0.type === 'Literal' || arg0.type === 'StringLiteral')
          ? String(arg0.value).toLowerCase()
          : '';
      if (objectName === 'response' && headerKey !== 'location') {
        return null;
      }
      return 'request headers.get()';
    }

    // cookies.get(...) / req.cookies.get(...) / cookieStore.get(...)
    if (
      methodName === 'get' &&
      (objectName === 'cookies' ||
        objectName === 'cookieStore' ||
        fullName === 'req.cookies.get' ||
        fullName === 'request.cookies.get' ||
        (node.callee.type === 'MemberExpression' &&
          node.callee.object &&
          node.callee.object.type === 'CallExpression' &&
          getCalleeName(node.callee.object).methodName === 'cookies'))
    ) {
      return 'request cookies.get()';
    }

    // req.json() / req.formData() / req.text()
    if (
      (objectName === 'req' || objectName === 'request') &&
      (methodName === 'json' || methodName === 'formData' || methodName === 'text')
    ) {
      return `user-submitted request.${methodName}()`;
    }
  }

  if (node.type === 'MemberExpression') {
    const prop = getPropertyName(node);
    const objName =
      node.object && node.object.type === 'Identifier' ? node.object.name : null;

    // req.url / request.url
    if ((objName === 'req' || objName === 'request') && (prop === 'url' || prop === 'nextUrl')) {
      return `request.${prop}`;
    }

    // params.<key> / context.params.<key>
    if (objName === 'params' && prop) {
      return `request params.${prop}`;
    }
    if (
      node.object &&
      node.object.type === 'MemberExpression' &&
      getPropertyName(node.object) === 'params' &&
      prop
    ) {
      return `request params.${prop}`;
    }
  }

  return null;
}

/**
 * Checks whether an AST expression passes through a recognized sanitizer or numeric primitive conversion.
 */
function isSanitizedNode(node) {
  if (!node) return false;

  if (
    node.type === 'AwaitExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSAsExpression' ||
    node.type === 'TSTypeAssertion' ||
    node.type === 'ParenthesizedExpression'
  ) {
    return isSanitizedNode(node.argument || node.expression);
  }

  if (node.type === 'CallExpression') {
    const { objectName, methodName } = getCalleeName(node);
    if (methodName && SANITIZER_FUNCTION_NAMES.has(methodName)) {
      return true;
    }
    if (
      (objectName === 'Math' || objectName === 'Number') &&
      methodName &&
      SANITIZER_MEMBER_METHODS.has(methodName)
    ) {
      return true;
    }
    // Strict digit regex extraction: something.match(/^(\d{1,8})$/)
    if (methodName === 'match' && node.arguments && node.arguments[0]) {
      const regexArg = node.arguments[0];
      const rawRegex =
        regexArg.raw ||
        (regexArg.regex && regexArg.regex.pattern) ||
        '';
      if (rawRegex.includes('\\d')) {
        return true;
      }
    }
    // String(Math.trunc(...)) or .toString() on a sanitized expression
    if (methodName === 'String' && node.arguments && node.arguments[0]) {
      return isSanitizedNode(node.arguments[0]);
    }
    if (
      methodName === 'toString' &&
      node.callee.type === 'MemberExpression' &&
      isSanitizedNode(node.callee.object)
    ) {
      return true;
    }
  }

  // Member access on a strict numeric regex match `idParam.match(/^(\d{1,8})$/)?.[1]`
  if (
    (node.type === 'MemberExpression' || node.type === 'ChainExpression') &&
    node.object &&
    isSanitizedNode(node.object)
  ) {
    return true;
  }
  if (node.type === 'ChainExpression') {
    return isSanitizedNode(node.expression);
  }

  // Logical OR / Nullish coalescing where all branches are sanitized or static literals
  if (node.type === 'LogicalExpression') {
    const leftClean =
      isSanitizedNode(node.left) ||
      node.left.type === 'Literal' ||
      node.left.type === 'StringLiteral';
    const rightClean =
      isSanitizedNode(node.right) ||
      node.right.type === 'Literal' ||
      node.right.type === 'StringLiteral';
    if (leftClean && rightClean) return true;
  }

  return false;
}

/**
 * Evaluates whether an expression node carries unsanitized taint given the current scope's `taintedVars`.
 */
function evaluateNodeTaint(node, taintedVars, sanitizedVars) {
  if (!node) return null;
  if (isSanitizedNode(node)) return null;

  const direct = detectDirectTaintSource(node);
  if (direct) return direct;

  switch (node.type) {
    case 'Identifier': {
      if (sanitizedVars && sanitizedVars.has(node.name)) return null;
      return taintedVars.get(node.name) || null;
    }
    case 'AwaitExpression':
    case 'ChainExpression':
    case 'TSNonNullExpression':
    case 'TSAsExpression':
    case 'TSTypeAssertion':
    case 'ParenthesizedExpression':
      return evaluateNodeTaint(
        node.argument || node.expression,
        taintedVars,
        sanitizedVars
      );
    case 'TemplateLiteral': {
      for (const expr of node.expressions || []) {
        const taint = evaluateNodeTaint(expr, taintedVars, sanitizedVars);
        if (taint) return taint;
      }
      return null;
    }
    case 'BinaryExpression': {
      if (node.operator === '+') {
        return (
          evaluateNodeTaint(node.left, taintedVars, sanitizedVars) ||
          evaluateNodeTaint(node.right, taintedVars, sanitizedVars)
        );
      }
      return null;
    }
    case 'LogicalExpression': {
      return (
        evaluateNodeTaint(node.left, taintedVars, sanitizedVars) ||
        evaluateNodeTaint(node.right, taintedVars, sanitizedVars)
      );
    }
    case 'ConditionalExpression': {
      return (
        evaluateNodeTaint(node.consequent, taintedVars, sanitizedVars) ||
        evaluateNodeTaint(node.alternate, taintedVars, sanitizedVars)
      );
    }
    case 'MemberExpression': {
      const prop = getPropertyName(node);
      if (prop === 'length') return null;
      if (node.object && node.object.type === 'Identifier') {
        if (sanitizedVars && sanitizedVars.has(node.object.name)) return null;
        if (taintedVars.has(node.object.name)) {
          return taintedVars.get(node.object.name);
        }
      }
      return null;
    }
    case 'CallExpression': {
      const { methodName } = getCalleeName(node);
      // String methods like .trim(), .slice(), .toString() preserve taint unless on a sanitized base
      if (
        methodName &&
        ['trim', 'toLowerCase', 'toUpperCase', 'slice', 'substring', 'replace', 'toString'].includes(
          methodName
        ) &&
        node.callee.type === 'MemberExpression'
      ) {
        return evaluateNodeTaint(node.callee.object, taintedVars, sanitizedVars);
      }
      return null;
    }
    case 'NewExpression': {
      // new URL(pathArg, baseArg): tainted if either pathArg or baseArg is tainted
      if (
        node.callee &&
        node.callee.type === 'Identifier' &&
        node.callee.name === 'URL'
      ) {
        for (const arg of node.arguments || []) {
          const taint = evaluateNodeTaint(arg, taintedVars, sanitizedVars);
          if (taint) return taint;
        }
      }
      return null;
    }
    case 'ObjectExpression': {
      for (const prop of node.properties || []) {
        const val = prop.value || prop.argument;
        const taint = evaluateNodeTaint(val, taintedVars, sanitizedVars);
        if (taint) return taint;
      }
      return null;
    }
    case 'ArrayExpression': {
      for (const el of node.elements || []) {
        const taint = evaluateNodeTaint(el, taintedVars, sanitizedVars);
        if (taint) return taint;
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Extracts identifier names guarded by `isSafeUpstreamUrl(id)` inside an IfStatement test.
 */
function extractUrlValidatorGuardedVars(testNode) {
  const positiveGuarded = [];
  const negativeGuarded = [];

  function visit(n, negated = false) {
    if (!n) return;
    if (n.type === 'UnaryExpression' && n.operator === '!') {
      visit(n.argument, !negated);
      return;
    }
    if (n.type === 'LogicalExpression') {
      visit(n.left, negated);
      visit(n.right, negated);
      return;
    }
    if (n.type === 'CallExpression') {
      const { methodName } = getCalleeName(n);
      if (
        methodName === 'isSafeUpstreamUrl' ||
        methodName === 'isInteger' ||
        methodName === 'isFinite'
      ) {
        const arg0 = n.arguments && n.arguments[0];
        if (arg0 && arg0.type === 'Identifier') {
          if (negated) {
            negativeGuarded.push(arg0.name);
          } else {
            positiveGuarded.push(arg0.name);
          }
        }
      }
    }
  }

  visit(testNode, false);
  return { positiveGuarded, negativeGuarded };
}

function blockAlwaysReturnsOrThrows(stmtNode) {
  if (!stmtNode) return false;
  if (stmtNode.type === 'ReturnStatement' || stmtNode.type === 'ThrowStatement') {
    return true;
  }
  if (stmtNode.type === 'BlockStatement' && Array.isArray(stmtNode.body)) {
    return stmtNode.body.some(
      (s) => s.type === 'ReturnStatement' || s.type === 'ThrowStatement'
    );
  }
  return false;
}

// ============================================================================
// RULE DEFINITIONS
// ============================================================================

const rules = {
  /**
   * 1. `bookarium-security/no-unsafe-fetch`
   * Flags `fetch()` calls with unencrypted `http://` URLs or direct unvalidated request parameters.
   */
  'no-unsafe-fetch': {
    meta: {
      type: 'problem',
      docs: {
        description:
          'Disallow unsafe fetch() calls using unencrypted http:// URLs or direct unvalidated request parameters.',
      },
      schema: [],
    },
    create(context) {
      const filename = normalizeFilename(context);
      if (isTestOrMockFile(filename)) return {};

      return {
        CallExpression(node) {
          const { objectName, methodName } = getCalleeName(node);
          const isFetch =
            (objectName === null && methodName === 'fetch') ||
            ((objectName === 'globalThis' || objectName === 'window') && methodName === 'fetch');
          if (!isFetch) return;

          const urlArg = node.arguments && node.arguments[0];
          if (!urlArg) return;

          // Flag unencrypted http:// literals in production fetch calls
          if (
            (urlArg.type === 'Literal' || urlArg.type === 'StringLiteral') &&
            typeof urlArg.value === 'string' &&
            urlArg.value.startsWith('http://')
          ) {
            context.report({
              node: urlArg,
              message:
                'Unencrypted http:// URL in fetch() is forbidden. Use HTTPS or root-relative paths.',
            });
            return;
          }

          if (
            urlArg.type === 'TemplateLiteral' &&
            urlArg.quasis &&
            urlArg.quasis[0] &&
            urlArg.quasis[0].value &&
            String(urlArg.quasis[0].value.raw || '').startsWith('http://')
          ) {
            context.report({
              node: urlArg,
              message:
                'Unencrypted http:// template URL in fetch() is forbidden. Use HTTPS or root-relative paths.',
            });
            return;
          }

          // Flag direct inline request taint source passed straight into fetch(...)
          const directTaint = detectDirectTaintSource(urlArg);
          if (directTaint) {
            context.report({
              node: urlArg,
              message: `Unsafe fetch() call with direct untrusted input from ${directTaint}. Validate URL via isSafeUpstreamUrl() first.`,
            });
          }
        },
      };
    },
  },

  /**
   * 2. `bookarium-security/no-unvalidated-redirect`
   * Flags `NextResponse.redirect()`, `Response.redirect()`, or `redirect()` calls whose target
   * is not a static internal path or sanitized via `sanitizeRedirectPath` / `resolveCanonicalAuthOrigin` / `buildAuthRedirectUrl`.
   */
  'no-unvalidated-redirect': {
    meta: {
      type: 'problem',
      docs: {
        description:
          'Require all server/auth redirect calls to validate paths and origins via redirect-sanitizer.ts.',
      },
      schema: [],
    },
    create(context) {
      const filename = normalizeFilename(context);
      if (isTestOrMockFile(filename)) return {};

      const sanitizedIdentifiers = new Set();

      function checkInitSanitized(idNode, initNode) {
        if (!idNode || idNode.type !== 'Identifier' || !initNode) return;
        if (isSanitizedNode(initNode)) {
          sanitizedIdentifiers.add(idNode.name);
          return;
        }
        if (
          initNode.type === 'Literal' ||
          initNode.type === 'StringLiteral'
        ) {
          if (
            typeof initNode.value === 'string' &&
            initNode.value.startsWith('/') &&
            !initNode.value.startsWith('//')
          ) {
            sanitizedIdentifiers.add(idNode.name);
          }
        }
        if (
          initNode.type === 'NewExpression' &&
          initNode.callee &&
          initNode.callee.type === 'Identifier' &&
          initNode.callee.name === 'URL'
        ) {
          const [pathArg, originArg] = initNode.arguments || [];
          if (
            isSafeRedirectPart(pathArg) &&
            (!originArg || isSafeRedirectPart(originArg))
          ) {
            sanitizedIdentifiers.add(idNode.name);
          }
        }
      }

      function isSafeRedirectPart(argNode) {
        if (!argNode) return false;
        if (
          (argNode.type === 'Literal' || argNode.type === 'StringLiteral') &&
          typeof argNode.value === 'string'
        ) {
          // Internal relative path (single leading slash) or explicit HTTPS static constant
          return (
            (argNode.value.startsWith('/') && !argNode.value.startsWith('//')) ||
            argNode.value.startsWith('https://')
          );
        }
        if (isSanitizedNode(argNode)) return true;
        if (argNode.type === 'Identifier' && sanitizedIdentifiers.has(argNode.name)) {
          return true;
        }
        if (
          argNode.type === 'NewExpression' &&
          argNode.callee &&
          argNode.callee.type === 'Identifier' &&
          argNode.callee.name === 'URL'
        ) {
          const [pathArg, originArg] = argNode.arguments || [];
          return (
            isSafeRedirectPart(pathArg) &&
            (!originArg || isSafeRedirectPart(originArg))
          );
        }
        return false;
      }

      return {
        VariableDeclarator(node) {
          checkInitSanitized(node.id, node.init);
        },
        AssignmentExpression(node) {
          checkInitSanitized(node.left, node.right);
        },
        CallExpression(node) {
          const { objectName, methodName } = getCalleeName(node);
          const isRedirectCall =
            ((objectName === 'NextResponse' || objectName === 'Response') &&
              methodName === 'redirect') ||
            (objectName === null && methodName === 'redirect');

          if (!isRedirectCall) return;

          const targetArg = node.arguments && node.arguments[0];
          if (!targetArg || !isSafeRedirectPart(targetArg)) {
            context.report({
              node: targetArg || node,
              message:
                'Unvalidated redirect target. Route redirect paths through sanitizeRedirectPath() and origins through resolveCanonicalAuthOrigin() or buildAuthRedirectUrl().',
            });
          }
        },
      };
    },
  },

  /**
   * 3. `bookarium-security/no-client-server-boundary-violation`
   * Blocks server-only module imports and non-NEXT_PUBLIC_ `process.env` access in client-reachable files.
   */
  'no-client-server-boundary-violation': {
    meta: {
      type: 'problem',
      docs: {
        description:
          'Prevent client-reachable modules from importing server-only modules or accessing secret process.env variables.',
      },
      schema: [],
    },
    create(context) {
      const filename = normalizeFilename(context);
      let isClientFile = false;

      function checkImportSource(sourceNode, importValue) {
        if (!isClientFile || typeof importValue !== 'string') return;
        for (const pattern of SERVER_ONLY_IMPORT_PATTERNS) {
          if (pattern.test(importValue)) {
            context.report({
              node: sourceNode,
              message: `Client/server boundary violation: "${importValue}" is a server-only module and must not be imported in client-reachable code.`,
            });
            return;
          }
        }
      }

      return {
        Program(node) {
          isClientFile = isClientReachableFile(filename, node);
        },
        ImportDeclaration(node) {
          if (node.importKind === 'type') return;
          if (node.source && typeof node.source.value === 'string') {
            checkImportSource(node.source, node.source.value);
          }
        },
        CallExpression(node) {
          if (!isClientFile) return;
          if (
            node.callee &&
            (node.callee.type === 'Import' ||
              (node.callee.type === 'Identifier' && node.callee.name === 'require'))
          ) {
            const arg0 = node.arguments && node.arguments[0];
            if (
              arg0 &&
              (arg0.type === 'Literal' || arg0.type === 'StringLiteral') &&
              typeof arg0.value === 'string'
            ) {
              checkImportSource(arg0, arg0.value);
            }
          }
        },
        MemberExpression(node) {
          if (!isClientFile) return;
          if (isProcessEnvObject(node.object)) {
            const envVarName = getPropertyName(node);
            if (!envVarName) {
              context.report({
                node,
                message:
                  'Dynamic process.env[key] access is forbidden in client code. Use explicit process.env.NEXT_PUBLIC_* properties.',
              });
              return;
            }
            if (envVarName !== 'NODE_ENV' && !envVarName.startsWith('NEXT_PUBLIC_')) {
              context.report({
                node,
                message: `Secret/server environment variable "process.env.${envVarName}" accessed in client-reachable module. Only NODE_ENV and NEXT_PUBLIC_* are permitted in browser code.`,
              });
            }
          }
        },
        VariableDeclarator(node) {
          if (!isClientFile || !node.init || !isProcessEnvObject(node.init)) return;
          if (node.id.type === 'ObjectPattern') {
            for (const prop of node.id.properties || []) {
              const keyName =
                prop.key &&
                (prop.key.name ||
                  (typeof prop.key.value === 'string' ? prop.key.value : null));
              if (
                keyName &&
                keyName !== 'NODE_ENV' &&
                !keyName.startsWith('NEXT_PUBLIC_')
              ) {
                context.report({
                  node: prop,
                  message: `Secret/server environment variable "${keyName}" destructured from process.env in client-reachable module.`,
                });
              }
            }
          } else if (node.id.type === 'Identifier') {
            context.report({
              node: node.id,
              message:
                'Aliasing process.env to a variable in client code is forbidden. Access process.env.NEXT_PUBLIC_* directly.',
            });
          }
        },
      };
    },
  },

  /**
   * 4. `bookarium-security/no-dangerous-execution`
   * Flags eval(), new Function(), string-argument setTimeout/setInterval, and child_process in src/.
   */
  'no-dangerous-execution': {
    meta: {
      type: 'problem',
      docs: {
        description:
          'Disallow dangerous code execution primitives (eval, new Function, string timers, shell execution in src/).',
      },
      schema: [],
    },
    create(context) {
      const filename = normalizeFilename(context);
      if (isTestOrMockFile(filename)) return {};

      return {
        CallExpression(node) {
          const { objectName, methodName } = getCalleeName(node);

          if (
            methodName === 'eval' &&
            (objectName === null ||
              objectName === 'window' ||
              objectName === 'globalThis' ||
              objectName === 'global')
          ) {
            context.report({
              node,
              message: 'Dangerous execution primitive eval() is strictly forbidden.',
            });
            return;
          }

          if (
            methodName === 'Function' &&
            (objectName === null ||
              objectName === 'window' ||
              objectName === 'globalThis')
          ) {
            context.report({
              node,
              message: 'Dynamic Function() constructor call is strictly forbidden.',
            });
            return;
          }

          if (
            (methodName === 'setTimeout' || methodName === 'setInterval') &&
            (objectName === null ||
              objectName === 'window' ||
              objectName === 'globalThis')
          ) {
            const firstArg = node.arguments && node.arguments[0];
            if (
              firstArg &&
              (firstArg.type === 'Literal' ||
                firstArg.type === 'StringLiteral' ||
                firstArg.type === 'TemplateLiteral')
            ) {
              context.report({
                node: firstArg,
                message: `Passing a string literal or template to ${methodName}() acts as eval() and is forbidden. Pass a function reference instead.`,
              });
            }
            return;
          }

          if (isShellExecCall(node)) {
            context.report({
              node,
              message: `Shell execution primitive "${methodName}()" is forbidden inside application source code.`,
            });
          }
        },
        NewExpression(node) {
          const { objectName, methodName } = getCalleeName(node);
          if (
            methodName === 'Function' &&
            (objectName === null ||
              objectName === 'window' ||
              objectName === 'globalThis')
          ) {
            context.report({
              node,
              message: 'Dynamic new Function() constructor is strictly forbidden.',
            });
          }
        },
      };
    },
  },

  /**
   * 5. `bookarium-security/no-unsafe-dom-injection`
   * Flags dangerouslySetInnerHTML, .innerHTML, .outerHTML, iframe.srcdoc, document.write, insertAdjacentHTML, createContextualFragment.
   */
  'no-unsafe-dom-injection': {
    meta: {
      type: 'problem',
      docs: {
        description: 'Disallow DOM XSS injection sinks across React and DOM APIs.',
      },
      schema: [],
    },
    create(context) {
      const filename = normalizeFilename(context);
      if (isTestOrMockFile(filename)) return {};

      return {
        JSXAttribute(node) {
          if (
            node.name &&
            node.name.type === 'JSXIdentifier' &&
            node.name.name === 'dangerouslySetInnerHTML'
          ) {
            context.report({
              node,
              message:
                'DOM XSS sink "dangerouslySetInnerHTML" is forbidden. Render structured React elements instead.',
            });
          }
        },
        AssignmentExpression(node) {
          if (node.left && node.left.type === 'MemberExpression') {
            const prop = getPropertyName(node.left);
            if (prop === 'innerHTML' || prop === 'outerHTML' || prop === 'srcdoc') {
              context.report({
                node: node.left,
                message: `Unsafe DOM injection sink ".${prop} =" is forbidden.`,
              });
            }
          }
        },
        CallExpression(node) {
          const { objectName, methodName } = getCalleeName(node);
          if (
            (methodName === 'write' || methodName === 'writeln') &&
            (objectName === 'document' || objectName === 'window')
          ) {
            context.report({
              node,
              message: `Unsafe DOM sink "document.${methodName}()" is forbidden.`,
            });
            return;
          }
          if (
            methodName === 'insertAdjacentHTML' ||
            methodName === 'createContextualFragment'
          ) {
            context.report({
              node,
              message: `Unsafe HTML parsing sink ".${methodName}()" is forbidden.`,
            });
          }
        },
      };
    },
  },

  /**
   * 6. `bookarium-security/no-tainted-request-sink`
   * Intra-procedural taint analysis tracking request-driven data (request params, searchParams,
   * headers, cookies, body) and flagging when unsanitized data reaches fetch, redirect, DB writes,
   * shell commands, file access, or external URLs.
   */
  'no-tainted-request-sink': {
    meta: {
      type: 'problem',
      docs: {
        description:
          'Track request-originating taint and flag when unsanitized values reach sensitive sinks.',
      },
      schema: [],
    },
    create(context) {
      const filename = normalizeFilename(context);
      if (isTestOrMockFile(filename)) return {};

      const scopeStack = [];

      function currentScope() {
        return scopeStack[scopeStack.length - 1] || null;
      }

      function enterFunctionScope(fnNode) {
        const taintedVars = new Map();
        const sanitizedVars = new Set();

        // Check if route handler parameters destructure `{ params }`
        if (Array.isArray(fnNode.params)) {
          for (const param of fnNode.params) {
            if (param.type === 'ObjectPattern') {
              for (const prop of param.properties || []) {
                const keyName = prop.key && prop.key.name;
                if (keyName === 'params') {
                  if (prop.value && prop.value.type === 'Identifier') {
                    taintedVars.set(prop.value.name, 'request params');
                  } else if (prop.value && prop.value.type === 'ObjectPattern') {
                    for (const nested of prop.value.properties || []) {
                      if (nested.value && nested.value.type === 'Identifier') {
                        taintedVars.set(nested.value.name, 'request params');
                      }
                    }
                  }
                }
              }
            }
          }
        }

        scopeStack.push({ taintedVars, sanitizedVars });
      }

      function exitFunctionScope() {
        scopeStack.pop();
      }

      function recordBindingFromInit(idNode, initNode) {
        const scope = currentScope();
        if (!scope || !idNode || !initNode) return;

        if (isSanitizedNode(initNode)) {
          if (idNode.type === 'Identifier') {
            scope.sanitizedVars.add(idNode.name);
            scope.taintedVars.delete(idNode.name);
          }
          return;
        }

        // `const { searchParams } = new URL(request.url)` or `request.nextUrl`
        if (idNode.type === 'ObjectPattern') {
          const initTaint = evaluateNodeTaint(
            initNode,
            scope.taintedVars,
            scope.sanitizedVars
          );
          for (const prop of idNode.properties || []) {
            const targetId =
              prop.value && prop.value.type === 'Identifier'
                ? prop.value.name
                : prop.key && prop.key.type === 'Identifier'
                  ? prop.key.name
                  : null;
            if (!targetId) continue;
            if (targetId === 'searchParams') {
              // searchParams object itself is handled when `.get(...)` is called
              continue;
            }
            if (initTaint) {
              scope.taintedVars.set(targetId, initTaint);
            }
          }
          return;
        }

        if (idNode.type === 'Identifier') {
          const taintSource = evaluateNodeTaint(
            initNode,
            scope.taintedVars,
            scope.sanitizedVars
          );
          if (taintSource) {
            scope.taintedVars.set(idNode.name, taintSource);
          } else {
            scope.taintedVars.delete(idNode.name);
          }
        }
      }

      return {
        FunctionDeclaration: enterFunctionScope,
        'FunctionDeclaration:exit': exitFunctionScope,
        FunctionExpression: enterFunctionScope,
        'FunctionExpression:exit': exitFunctionScope,
        ArrowFunctionExpression: enterFunctionScope,
        'ArrowFunctionExpression:exit': exitFunctionScope,

        VariableDeclarator(node) {
          recordBindingFromInit(node.id, node.init);
        },

        AssignmentExpression(node) {
          const scope = currentScope();
          if (!scope) return;

          // Check external URL assignment sink & Prototype Pollution computed key sink
          if (node.left && node.left.type === 'MemberExpression') {
            if (node.left.computed && node.left.property) {
              const keyTaint = evaluateNodeTaint(
                node.left.property,
                scope.taintedVars,
                scope.sanitizedVars
              );
              if (keyTaint) {
                context.report({
                  node: node.left.property,
                  message: `Tainted key from ${keyTaint} used in dynamic computed property assignment (Prototype Pollution risk). Validate key against an explicit allowlist or use a Map.`,
                });
                return;
              }
            }

            const prop = getPropertyName(node.left);
            const objName =
              node.left.object && node.left.object.type === 'Identifier'
                ? node.left.object.name
                : node.left.object &&
                    node.left.object.type === 'MemberExpression'
                  ? getPropertyName(node.left.object)
                  : null;

            if (objName === 'location' && (prop === 'href' || prop === 'search')) {
              const taint = evaluateNodeTaint(
                node.right,
                scope.taintedVars,
                scope.sanitizedVars
              );
              if (taint) {
                context.report({
                  node: node.right,
                  message: `Tainted data from ${taint} reaches external URL sink (location.${prop}) without sanitization.`,
                });
              }
              return;
            }
          }

          recordBindingFromInit(node.left, node.right);
        },

        IfStatement(node) {
          const scope = currentScope();
          if (!scope) return;
          const { positiveGuarded, negativeGuarded } = extractUrlValidatorGuardedVars(
            node.test
          );
          // Positive guard: `if (isSafeUpstreamUrl(x)) { ... }` -> mark sanitized inside consequent
          for (const name of positiveGuarded) {
            scope.sanitizedVars.add(name);
            scope.taintedVars.delete(name);
          }
          // Early-return negative guard: `if (!isSafeUpstreamUrl(x)) { return ... }` -> mark sanitized for rest of scope
          if (
            negativeGuarded.length > 0 &&
            blockAlwaysReturnsOrThrows(node.consequent)
          ) {
            for (const name of negativeGuarded) {
              scope.sanitizedVars.add(name);
              scope.taintedVars.delete(name);
            }
          }
        },

        CallExpression(node) {
          const scope = currentScope();
          if (!scope) return;

          const { objectName, methodName } = getCalleeName(node);
          const arg0 = node.arguments && node.arguments[0];
          const arg1 = node.arguments && node.arguments[1];

          // 1. SINK: fetch(urlArg)
          if (
            (objectName === null && methodName === 'fetch') ||
            ((objectName === 'globalThis' || objectName === 'window') &&
              methodName === 'fetch')
          ) {
            const taint = evaluateNodeTaint(
              arg0,
              scope.taintedVars,
              scope.sanitizedVars
            );
            if (taint) {
              context.report({
                node: arg0,
                message: `Tainted data from ${taint} reaches fetch() sink without sanitization (SSRF risk). Validate with isSafeUpstreamUrl() or numeric/origin sanitization first.`,
              });
            }
            return;
          }

          // 2. SINK: NextResponse.redirect / Response.redirect / redirect
          if (
            ((objectName === 'NextResponse' || objectName === 'Response') &&
              methodName === 'redirect') ||
            (objectName === null && methodName === 'redirect')
          ) {
            const taint = evaluateNodeTaint(
              arg0,
              scope.taintedVars,
              scope.sanitizedVars
            );
            if (taint) {
              context.report({
                node: arg0,
                message: `Tainted data from ${taint} reaches redirect() sink without sanitization (Open Redirect risk). Use sanitizeRedirectPath() and resolveCanonicalAuthOrigin().`,
              });
            }
            return;
          }

          // 3. SINK: Database writes (.insert, .upsert, .update, .rpc)
          if (
            methodName &&
            DB_WRITE_METHODS.has(methodName) &&
            node.callee.type === 'MemberExpression'
          ) {
            const payloadArg = methodName === 'rpc' ? arg1 || arg0 : arg0;
            const taint = evaluateNodeTaint(
              payloadArg,
              scope.taintedVars,
              scope.sanitizedVars
            );
            if (taint) {
              context.report({
                node: payloadArg || node,
                message: `Tainted data from ${taint} reaches database write sink (.${methodName}()) without validation or sanitization.`,
              });
            }
            return;
          }

          // 4. SINK: Shell commands (exec, execSync, spawn, etc.)
          if (isShellExecCall(node)) {
            for (const arg of node.arguments || []) {
              const taint = evaluateNodeTaint(
                arg,
                scope.taintedVars,
                scope.sanitizedVars
              );
              if (taint) {
                context.report({
                  node: arg,
                  message: `Tainted data from ${taint} reaches shell command sink (${methodName}()) (Command Injection risk).`,
                });
              }
            }
            return;
          }

          // 5. SINK: File system access (fs.readFile*, fs.writeFile*, fs.unlink*, etc.)
          if (methodName && FS_ACCESS_METHODS.has(methodName)) {
            const taint = evaluateNodeTaint(
              arg0,
              scope.taintedVars,
              scope.sanitizedVars
            );
            if (taint) {
              context.report({
                node: arg0,
                message: `Tainted data from ${taint} reaches file system sink (${methodName}()) (Path Traversal risk).`,
              });
            }
            return;
          }

          // 6. SINK: External URL navigation (window.open, location.assign, location.replace)
          if (
            (objectName === 'window' && methodName === 'open') ||
            (objectName === 'location' &&
              (methodName === 'assign' || methodName === 'replace'))
          ) {
            const taint = evaluateNodeTaint(
              arg0,
              scope.taintedVars,
              scope.sanitizedVars
            );
            if (taint) {
              context.report({
                node: arg0,
                message: `Tainted data from ${taint} reaches external URL navigation sink (${objectName}.${methodName}()) without sanitization.`,
              });
            }
          }
        },
      };
    },
  },

  /**
   * 7. `bookarium-security/no-secret-env-or-public-route-leak`
   * Project-level security rules:
   * - No NEXT_PUBLIC_* variables for secret material
   * - No hardcoded JWT/secret tokens in Supabase client creation or credential assignments
   * - Public API routes (`src/app/api/**\/route.ts`) must not use SUPABASE_SERVICE_ROLE_KEY,
   *   must not serialize `process.env` into responses, and must invoke `RateLimiter.check()`.
   */
  'no-secret-env-or-public-route-leak': {
    meta: {
      type: 'problem',
      docs: {
        description:
          'Enforce project-level secret env naming, credential literal guards, and public API route security invariants.',
      },
      schema: [],
    },
    create(context) {
      const filename = normalizeFilename(context);
      if (isTestOrMockFile(filename)) return {};

      const isPublicApiRoute = isApiRouteFile(filename);
      let hasHttpHandlerExport = false;
      let hasRateLimiterCheck = false;
      let exportedHandlerNode = null;

      return {
        ExportNamedDeclaration(node) {
          if (!isPublicApiRoute || !node.declaration) return;
          if (
            node.declaration.type === 'FunctionDeclaration' &&
            node.declaration.id &&
            ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(
              node.declaration.id.name
            )
          ) {
            hasHttpHandlerExport = true;
            exportedHandlerNode = node.declaration;
          }
        },

        MemberExpression(node) {
          if (!isProcessEnvObject(node.object)) return;
          const envName = getPropertyName(node);
          if (!envName) return;

          // Project Rule 3: No NEXT_PUBLIC_* variables for secret material
          if (SECRET_NEXT_PUBLIC_PATTERN.test(envName)) {
            context.report({
              node,
              message: `Environment variable "${envName}" violates Project Security Rule: never prefix secret/private/token/service_role variables with NEXT_PUBLIC_.`,
            });
          }

          // Project Rule 5a: Public API routes must not use SUPABASE_SERVICE_ROLE_KEY
          if (isPublicApiRoute && envName === 'SUPABASE_SERVICE_ROLE_KEY') {
            context.report({
              node,
              message:
                'Public API route must not reference SUPABASE_SERVICE_ROLE_KEY. Service role privilege is restricted strictly to offline CLI scripts.',
            });
          }
        },

        CallExpression(node) {
          const { objectName, methodName } = getCalleeName(node);

          // Track RateLimiter.check() in public API routes
          if (
            isPublicApiRoute &&
            methodName === 'check' &&
            objectName &&
            objectName.toLowerCase().includes('ratelimiter')
          ) {
            hasRateLimiterCheck = true;
          }

          // Project Rule 2: No hardcoded JWT / secret keys passed to createClient / createBrowserClient / createServerClient
          if (
            methodName === 'createClient' ||
            methodName === 'createBrowserClient' ||
            methodName === 'createServerClient'
          ) {
            const keyArg = node.arguments && node.arguments[1];
            if (
              keyArg &&
              (keyArg.type === 'Literal' || keyArg.type === 'StringLiteral') &&
              typeof keyArg.value === 'string' &&
              (/^eyJ[A-Za-z0-9_-]{10,}\./.test(keyArg.value) ||
                /^sbp_[A-Za-z0-9]{15,}/.test(keyArg.value) ||
                /^sb_secret_[A-Za-z0-9]{10,}/.test(keyArg.value))
            ) {
              context.report({
                node: keyArg,
                message:
                  'Hardcoded Supabase JWT or secret token in client initializer is forbidden.',
              });
            }
          }

          // Project Rule 5b: Never serialize `process.env` into NextResponse.json() or Response()
          if (
            (objectName === 'NextResponse' && methodName === 'json') ||
            (objectName === 'Response' && methodName === 'json')
          ) {
            const bodyArg = node.arguments && node.arguments[0];
            if (bodyArg && isProcessEnvObject(bodyArg)) {
              context.report({
                node: bodyArg,
                message:
                  'Exposing raw process.env in an HTTP JSON response is strictly forbidden.',
              });
            }
          }
        },

        'Program:exit'() {
          if (isPublicApiRoute && hasHttpHandlerExport && !hasRateLimiterCheck) {
            context.report({
              node: exportedHandlerNode,
              message:
                'Public API route handler must enforce rate limiting via RateLimiter.check() before processing requests.',
            });
          }
        },
      };
    },
  },

  /**
   * 8. `bookarium-security/no-focused-or-tautological-tests`
   * Enforces Rule 3 test integrity: no `.only` focused tests and no `expect(true).toBe(true)` tautologies.
   */
  'no-focused-or-tautological-tests': {
    meta: {
      type: 'problem',
      docs: {
        description:
          'Forbid focused (.only) tests and tautological assertions (e.g. expect(true).toBe(true)) in test suites.',
      },
      schema: [],
    },
    create(context) {
      const filename = normalizeFilename(context);
      if (!isTestOrMockFile(filename)) return {};

      return {
        MemberExpression(node) {
          const prop = getPropertyName(node);
          if (
            prop === 'only' &&
            node.object &&
            node.object.type === 'Identifier' &&
            ['describe', 'it', 'test', 'suite'].includes(node.object.name)
          ) {
            context.report({
              node,
              message: `Focused test "${node.object.name}.only" is forbidden in committed test suites.`,
            });
          }
        },
        CallExpression(node) {
          // Detect expect(<literal>).toBe(<same literal>)
          if (
            node.callee &&
            node.callee.type === 'MemberExpression' &&
            ['toBe', 'toEqual', 'toStrictEqual'].includes(
              getPropertyName(node.callee)
            ) &&
            node.callee.object &&
            node.callee.object.type === 'CallExpression' &&
            node.callee.object.callee &&
            node.callee.object.callee.type === 'Identifier' &&
            node.callee.object.callee.name === 'expect'
          ) {
            const actualArg =
              node.callee.object.arguments && node.callee.object.arguments[0];
            const expectedArg = node.arguments && node.arguments[0];
            if (
              actualArg &&
              expectedArg &&
              (actualArg.type === 'Literal' ||
                actualArg.type === 'BooleanLiteral' ||
                actualArg.type === 'NumericLiteral' ||
                actualArg.type === 'StringLiteral') &&
              (expectedArg.type === 'Literal' ||
                expectedArg.type === 'BooleanLiteral' ||
                expectedArg.type === 'NumericLiteral' ||
                expectedArg.type === 'StringLiteral') &&
              actualArg.value === expectedArg.value
            ) {
              context.report({
                node,
                message: `Tautological assertion "expect(${JSON.stringify(actualArg.value)}).${getPropertyName(node.callee)}(${JSON.stringify(expectedArg.value)})" violates Rule 3 (Anti-Tautology Protocol). Assert genuine application state or DOM behavior.`,
              });
            }
          }
        },
      };
    },
  },

  /**
   * 9. `bookarium-security/enforce-gutenberg-and-copyright-policy`
   * Enforces Rule 2 & Rule 4 (Public Domain Integrity & Project Gutenberg Mirror Compliance):
   * - Forbids `copyright=true` in query strings or URLSearchParams.set('copyright', 'true')
   * - Forbids direct fetch('https://www.gutenberg.org/...') calls that bypass the official mirror priority list
   */
  'enforce-gutenberg-and-copyright-policy': {
    meta: {
      type: 'problem',
      docs: {
        description:
          'Enforce Project Gutenberg mirror prioritization and strict copyright=false public domain queries.',
      },
      schema: [],
    },
    create(context) {
      const filename = normalizeFilename(context);
      if (isTestOrMockFile(filename)) return {};

      function checkStringForCopyrightTrue(node, strValue) {
        if (typeof strValue === 'string' && /(?:[?&]|^)copyright=true(?:&|$)/i.test(strValue)) {
          context.report({
            node,
            message:
              'Public Domain violation (Rule 2/4): "copyright=true" is forbidden in catalog queries. Strictly enforce "copyright=false".',
          });
        }
      }

      return {
        Literal(node) {
          if (typeof node.value === 'string') {
            checkStringForCopyrightTrue(node, node.value);
          }
        },
        StringLiteral(node) {
          if (typeof node.value === 'string') {
            checkStringForCopyrightTrue(node, node.value);
          }
        },
        TemplateLiteral(node) {
          const combinedRaw = (node.quasis || [])
            .map((q) => (q.value && (q.value.cooked || q.value.raw)) || '')
            .join('');
          checkStringForCopyrightTrue(node, combinedRaw);
        },
        CallExpression(node) {
          const { objectName, methodName } = getCalleeName(node);

          // Check URLSearchParams.set('copyright', 'true') / .append('copyright', 'true')
          if (methodName === 'set' || methodName === 'append') {
            const [keyArg, valArg] = node.arguments || [];
            if (
              keyArg &&
              (keyArg.type === 'Literal' || keyArg.type === 'StringLiteral') &&
              keyArg.value === 'copyright' &&
              valArg &&
              ((valArg.type === 'Literal' || valArg.type === 'StringLiteral') &&
                (valArg.value === 'true' || valArg.value === true))
            ) {
              context.report({
                node: valArg,
                message:
                  'Public Domain violation (Rule 2/4): setting "copyright" parameter to "true" is forbidden. Always enforce "copyright=false".',
              });
              return;
            }
          }

          // Check direct fetch('https://www.gutenberg.org/...') bypassing mirror rotation
          const isFetch =
            (objectName === null && methodName === 'fetch') ||
            ((objectName === 'globalThis' || objectName === 'window') && methodName === 'fetch');
          if (isFetch) {
            const urlArg = node.arguments && node.arguments[0];
            if (!urlArg) return;
            const rawUrl =
              (urlArg.type === 'Literal' || urlArg.type === 'StringLiteral') &&
              typeof urlArg.value === 'string'
                ? urlArg.value
                : urlArg.type === 'TemplateLiteral' &&
                    urlArg.quasis &&
                    urlArg.quasis[0] &&
                    urlArg.quasis[0].value
                  ? String(urlArg.quasis[0].value.raw || '')
                  : '';

            if (/^https?:\/\/(?:www\.)?gutenberg\.org\b/i.test(rawUrl)) {
              context.report({
                node: urlArg,
                message:
                  'Project Gutenberg policy violation (Rule 2/4): direct fetch() to www.gutenberg.org is forbidden. Prioritize official mirrors (aleph.gutenberg.org, gutenberg.pglaf.org, gutenberg.readingroo.ms) first.',
              });
            }
          }
        },
      };
    },
  },
};

/**
 * Standalone Babel AST runner used by `scripts/verify-build.js` (`Pass 0.75`) so
 * `npm run security:audit` executes the exact same 9 AST & taint rules even outside ESLint CLI.
 */
function runStandaloneAstSecurityAudit(rootDir) {
  const parser = require('@babel/parser');
  const traverse = require('@babel/traverse').default;

  const srcDir = path.join(rootDir, 'src');
  const violations = [];

  function collectFiles(dir, list = []) {
    if (!fs.existsSync(dir)) return list;
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (entry !== 'node_modules' && entry !== '.next') {
          collectFiles(fullPath, list);
        }
      } else if (/\.(ts|tsx|js|mjs)$/.test(entry) && !entry.endsWith('.d.ts')) {
        list.push(fullPath);
      }
    }
    return list;
  }

  const files = collectFiles(srcDir);

  for (const filePath of files) {
    const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const code = fs.readFileSync(filePath, 'utf-8');
    let ast;
    try {
      ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });
    } catch (_err) {
      continue;
    }

    const activeListeners = [];
    for (const [ruleName, ruleDef] of Object.entries(rules)) {
      const context = {
        filename: relPath,
        getFilename: () => relPath,
        report({ node, message }) {
          const line = node && node.loc && node.loc.start ? node.loc.start.line : 1;
          violations.push({
            file: relPath,
            line,
            ruleId: `bookarium-security/${ruleName}`,
            message,
          });
        },
      };
      activeListeners.push(ruleDef.create(context));
    }

    traverse(ast, {
      enter(pathNode) {
        const type = pathNode.node.type;
        for (const listener of activeListeners) {
          if (typeof listener[type] === 'function') {
            listener[type](pathNode.node);
          }
        }
      },
      exit(pathNode) {
        const exitKey = `${pathNode.node.type}:exit`;
        for (const listener of activeListeners) {
          if (typeof listener[exitKey] === 'function') {
            listener[exitKey](pathNode.node);
          }
        }
      },
    });
  }

  return violations;
}

const plugin = {
  meta: {
    name: 'eslint-plugin-bookarium-security',
    version: '1.0.0',
  },
  rules,
  runStandaloneAstSecurityAudit,
};

module.exports = plugin;


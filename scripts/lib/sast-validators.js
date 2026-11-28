/**
 * Pure Stateless SAST, Workflow, Supply-Chain & Header Security Validators
 *
 * Extracted from `scripts/verify-build.js` so every static AST/manifest/workflow/lockfile/SW
 * security rule can be verified deterministically with both positive and adversarial negative
 * fixtures inside Vitest without circular execution of the 7-Gateway runner.
 *
 * @module scripts/lib/sast-validators
 * @scope Stateless Babel AST header, compiled Next routes manifest, npm lockfile/lifecycle/license SCA, GitHub Actions YAML security, Service Worker, env/privilege boundary, API route, redirect, public-domain filter, 4-layer Rule 9 auth-store/guest-wipe parity, circular `SECURITY.md` parity, dynamic legal/privacy/deletion disclosure parity, and live HTTP response validators.
 * @invariant Enforce `REQUIRED_SECURITY_HEADERS` (`X-Frame-Options: DENY`, `nosniff`, `same-origin` COOP, conditional `!isDev` HSTS, CSP directives without ungated `unsafe-eval`), immutable 40-char commit-SHA `uses:` pinning and zero-checkout `gh` `--repo`/`GH_REPO` scoping (`validateGitHubWorkflowSecurity`), banned `BANNED_LIFECYCLE_HOOKS` & `BANNED_PACKAGE_LICENSES` (`GPL`/`AGPL`), `validateLiveHttpSecurityResponse` runtime response contracts, `auditSecurityDocumentationParity` (`SECURITY.md` marker/ESLint-rule/SAST-export/RLS-count/feed-integrity checks), `auditLegalDocumentationParity` (`privacy/page.tsx`, `copyright/page.tsx`, and `AccountDeleteModal.tsx` sync/cookie/cache/TTL and PGLAF non-affiliation parity), and fail-closed Babel AST validation across `validateServiceWorkerSecurity`, `validateEnvAndPrivilegeBoundariesAst`, `validateApiRoutesSecurityAst`, `validateRedirectRoutesAst`, `validatePublicDomainFilterAst`, and `validateRule9AuthStoreParityAst` (`deleteAccount()` RPC error capture, non-store cache resets, and device-local `clearGuestDeviceData()`) without executing external shells.
 * @rationale Isolating pure validators away from top-level CLI runners allows direct unit testing against intentionally vulnerable fixtures while keeping `Pass 0.75` and `Pass 7` fast and deterministic.
 * @adr ADR-073, ADR-080, ADR-081, ADR-082, ADR-084
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_SECURITY_HEADERS = [
  'Content-Security-Policy',
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Cross-Origin-Opener-Policy',
];

const BANNED_LIFECYCLE_HOOKS = [
  'preinstall',
  'install',
  'postinstall',
  'prepublish',
  'prepack',
  'postpack',
];

const BANNED_PACKAGE_LICENSES = [
  'GPL-2.0',
  'GPL-3.0',
  'AGPL-3.0',
  'GPL-2.0-only',
  'GPL-2.0-or-later',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
];

const BANNED_COPYLEFT_TOKEN_REGEX =
  /(?:^|[^A-Z0-9-])(A?GPL(?:-\d+(?:\.\d+)?)?(?:-(?:only|or-later))?)(?=$|[^A-Z0-9-])/i;

function findBannedPackageLicense(pkgMeta) {
  if (!pkgMeta || typeof pkgMeta !== 'object') return null;
  const candidates = [];
  if (typeof pkgMeta.license === 'string') {
    candidates.push(pkgMeta.license);
  } else if (pkgMeta.license && typeof pkgMeta.license.type === 'string') {
    candidates.push(pkgMeta.license.type);
  }
  if (Array.isArray(pkgMeta.licenses)) {
    for (const entry of pkgMeta.licenses) {
      if (typeof entry === 'string') candidates.push(entry);
      else if (entry && typeof entry.type === 'string') candidates.push(entry.type);
    }
  }
  for (const rawLicense of candidates) {
    const match = String(rawLicense).match(BANNED_COPYLEFT_TOKEN_REGEX);
    if (match && match[1]) {
      return rawLicense.trim();
    }
  }
  return null;
}

const NON_AST_METADATA_KEYS = new Set([
  'type',
  'start',
  'end',
  'loc',
  'extra',
  'comments',
  'leadingComments',
  'trailingComments',
  'innerComments',
  'errors',
]);

/**
 * Parses JS/TS/JSX module or script source with Babel AST without modifying behavior.
 */
function parseSecurityModuleAst(code, options = {}) {
  if (typeof code !== 'string') {
    return { ast: null, error: new Error('Source input must be a string.') };
  }
  try {
    const parser = require('@babel/parser');
    const ast = parser.parse(code, {
      sourceType: options.sourceType || 'unambiguous',
      allowReturnOutsideFunction: Boolean(options.allowReturnOutsideFunction),
      plugins: Array.isArray(options.plugins)
        ? options.plugins
        : ['typescript', 'jsx', 'decorators-legacy'],
    });
    return { ast, error: null };
  } catch (err) {
    return { ast: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

function unwrapTsExpressions(node) {
  let curr = node;
  while (
    curr &&
    (curr.type === 'TSAsExpression' ||
      curr.type === 'TSTypeAssertion' ||
      curr.type === 'TSNonNullExpression' ||
      curr.type === 'TSSatisfiesExpression' ||
      curr.type === 'TSTypeCastExpression' ||
      curr.type === 'ParenthesizedExpression')
  ) {
    curr = curr.expression;
  }
  return curr;
}

function getAstStringLiteralValue(node) {
  const unwrapped = unwrapTsExpressions(node);
  if (!unwrapped) return null;
  if (
    (unwrapped.type === 'StringLiteral' || unwrapped.type === 'Literal') &&
    typeof unwrapped.value === 'string'
  ) {
    return unwrapped.value;
  }
  if (
    unwrapped.type === 'TemplateLiteral' &&
    Array.isArray(unwrapped.quasis) &&
    unwrapped.expressions.length === 0
  ) {
    return unwrapped.quasis.map((q) => String(q.value.cooked ?? q.value.raw ?? '')).join('');
  }
  if (unwrapped.type === 'BinaryExpression' && unwrapped.operator === '+') {
    const leftVal = getAstStringLiteralValue(unwrapped.left);
    const rightVal = getAstStringLiteralValue(unwrapped.right);
    if (leftVal !== null && rightVal !== null) {
      return `${leftVal}${rightVal}`;
    }
  }
  if (
    unwrapped.type === 'TemplateLiteral' &&
    Array.isArray(unwrapped.quasis) &&
    unwrapped.expressions.length > 0
  ) {
    let out = '';
    for (let i = 0; i < unwrapped.quasis.length; i++) {
      out += String(unwrapped.quasis[i].value.cooked ?? unwrapped.quasis[i].value.raw ?? '');
      if (i < unwrapped.expressions.length) {
        const exprVal = getAstStringLiteralValue(unwrapped.expressions[i]);
        if (exprVal === null) return null;
        out += exprVal;
      }
    }
    return out;
  }
  return null;
}

function getAstPropertyName(propNode, computed = false) {
  if (!propNode) return null;
  if (!computed) {
    if (propNode.type === 'Identifier') return propNode.name;
    if (propNode.type === 'StringLiteral' || propNode.type === 'Literal') {
      return typeof propNode.value === 'string' ? propNode.value : null;
    }
  }
  return getAstStringLiteralValue(propNode);
}

function getMemberPropertyName(memberNode) {
  if (!memberNode || memberNode.type !== 'MemberExpression') return null;
  return getAstPropertyName(memberNode.property, Boolean(memberNode.computed));
}

function getCallCalleeParts(callNode) {
  if (!callNode || !callNode.callee) return { objectNode: null, objectName: null, methodName: null };
  const callee = unwrapTsExpressions(callNode.callee);
  if (!callee) return { objectNode: null, objectName: null, methodName: null };
  if (callee.type === 'Identifier') {
    return { objectNode: null, objectName: null, methodName: callee.name };
  }
  if (callee.type === 'MemberExpression') {
    const obj = unwrapTsExpressions(callee.object);
    const methodName = getMemberPropertyName(callee);
    const objectName = obj && obj.type === 'Identifier' ? obj.name : null;
    return { objectNode: obj, objectName, methodName };
  }
  return { objectNode: null, objectName: null, methodName: null };
}

function visitAstNodes(rootNode, callback, parent = null) {
  if (!rootNode || typeof rootNode !== 'object') return;
  if (Array.isArray(rootNode)) {
    for (const item of rootNode) {
      visitAstNodes(item, callback, parent);
    }
    return;
  }
  if (typeof rootNode.type === 'string') {
    const shouldDescend = callback(rootNode, parent);
    if (shouldDescend === false) return;
  }
  for (const key of Object.keys(rootNode)) {
    if (NON_AST_METADATA_KEYS.has(key)) continue;
    const child = rootNode[key];
    if (child && typeof child === 'object') {
      visitAstNodes(child, callback, typeof rootNode.type === 'string' ? rootNode : parent);
    }
  }
}

function isAstFunctionNode(node) {
  return Boolean(
    node &&
      (node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression' ||
        node.type === 'ObjectMethod')
  );
}

function collectModuleFunctionsMap(ast) {
  const fnMap = new Map();
  visitAstNodes(ast, (node) => {
    if (node.type === 'FunctionDeclaration' && node.id && node.id.name) {
      fnMap.set(node.id.name, node);
    } else if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier') {
      const init = unwrapTsExpressions(node.init);
      if (isAstFunctionNode(init)) {
        fnMap.set(node.id.name, init);
      }
    }
  });
  return fnMap;
}

function collectReachableFunctionNodes(entryNodes, fnMap) {
  const visitedFns = new Set();
  const queue = [];
  for (const entry of entryNodes) {
    if (entry && !visitedFns.has(entry)) {
      visitedFns.add(entry);
      queue.push(entry);
    }
  }
  while (queue.length > 0) {
    const fnNode = queue.shift();
    visitAstNodes(fnNode, (node) => {
      if (node.type === 'CallExpression') {
        const callee = unwrapTsExpressions(node.callee);
        if (callee && callee.type === 'Identifier' && fnMap.has(callee.name)) {
          const target = fnMap.get(callee.name);
          if (!visitedFns.has(target)) {
            visitedFns.add(target);
            queue.push(target);
          }
        }
        for (const arg of node.arguments || []) {
          const unwrappedArg = unwrapTsExpressions(arg);
          if (unwrappedArg && unwrappedArg.type === 'Identifier' && fnMap.has(unwrappedArg.name)) {
            const target = fnMap.get(unwrappedArg.name);
            if (!visitedFns.has(target)) {
              visitedFns.add(target);
              queue.push(target);
            }
          }
        }
      }
    });
  }
  return Array.from(visitedFns);
}

/**
 * Audits `next.config.ts` via Babel AST for OWASP HTTP security headers and strict CSP directives.
 */
function validateNextConfigSecurityHeadersAst(nextConfigCode) {
  const violations = [];
  let ast;
  try {
    const parser = require('@babel/parser');
    ast = parser.parse(nextConfigCode, {
      sourceType: 'module',
      plugins: ['typescript'],
    });
  } catch (err) {
    violations.push(`Failed to parse next.config.ts AST for Pillar 7 header verification: ${err.message}`);
    return violations;
  }

  const traverse = require('@babel/traverse').default;
  let foundHeadersMethod = false;
  let hasGlobalCatchAllSource = false;
  let cspStaticJoined = '';
  let hasUngatedUnsafeEval = false;
  const headerEntries = new Map();

  function recordHeaderPair(objNode, isConditionalNonDev = false) {
    if (!objNode || objNode.type !== 'ObjectExpression') return;
    let hdrKey = null;
    let hdrValNode = null;
    for (const prop of objNode.properties) {
      if (prop.type !== 'ObjectProperty' || !prop.key) continue;
      const propName = prop.key.name || prop.key.value;
      if (propName === 'key') {
        hdrKey = getAstStringLiteralValue(prop.value);
      } else if (propName === 'value') {
        hdrValNode = prop.value;
      }
    }
    if (!hdrKey) return;
    const hdrValStr = getAstStringLiteralValue(hdrValNode);
    const hdrIdentifier = hdrValNode && hdrValNode.type === 'Identifier' ? hdrValNode.name : null;
    headerEntries.set(hdrKey, {
      value: hdrValStr,
      identifier: hdrIdentifier,
      isConditionalNonDev,
    });
  }

  function inspectCspTemplateNode(node) {
    if (!node) return;
    if (node.type === 'TemplateLiteral') {
      cspStaticJoined = node.quasis
        .map((q) => String(q.value.cooked ?? q.value.raw ?? ''))
        .join(' ');
      for (const expr of node.expressions || []) {
        if (expr.type === 'ConditionalExpression') {
          const testIsDev =
            expr.test && expr.test.type === 'Identifier' && expr.test.name === 'isDev';
          const consVal = getAstStringLiteralValue(expr.consequent) || '';
          const altVal = getAstStringLiteralValue(expr.alternate) || '';
          if ((consVal.includes("'unsafe-eval'") || altVal.includes("'unsafe-eval'")) && (!testIsDev || altVal.includes("'unsafe-eval'"))) {
            hasUngatedUnsafeEval = true;
          }
        } else {
          const exprText = getAstStringLiteralValue(expr) || '';
          if (exprText.includes("'unsafe-eval'")) {
            hasUngatedUnsafeEval = true;
          }
        }
      }
      if (cspStaticJoined.includes("'unsafe-eval'")) {
        hasUngatedUnsafeEval = true;
      }
    }
  }

  traverse(ast, {
    ObjectMethod(pathNode) {
      if (pathNode.node.key && (pathNode.node.key.name || pathNode.node.key.value) === 'headers') {
        foundHeadersMethod = true;
        pathNode.traverse({
          VariableDeclarator(varPath) {
            if (varPath.node.id && varPath.node.id.name === 'cspHeader') {
              let init = varPath.node.init;
              while (init && init.type === 'CallExpression' && init.callee && init.callee.type === 'MemberExpression') {
                init = init.callee.object;
              }
              inspectCspTemplateNode(init);
            }
          },
          ObjectExpression(objPath) {
            for (const prop of objPath.node.properties) {
              if (prop.type === 'ObjectProperty' && prop.key && (prop.key.name || prop.key.value) === 'source') {
                if (getAstStringLiteralValue(prop.value) === '/(.*)') {
                  hasGlobalCatchAllSource = true;
                }
              }
            }
            const inNonDevIf = Boolean(
              objPath.findParent(
                (p) =>
                  p.isIfStatement() &&
                  p.node.test &&
                  p.node.test.type === 'UnaryExpression' &&
                  p.node.test.operator === '!' &&
                  p.node.test.argument &&
                  p.node.test.argument.name === 'isDev'
              )
            );
            recordHeaderPair(objPath.node, inNonDevIf);
          },
        });
      }
    },
  });

  if (!foundHeadersMethod) {
    violations.push('next.config.ts must export async headers() returning OWASP HTTP security headers.');
    return violations;
  }
  if (!hasGlobalCatchAllSource) {
    violations.push('next.config.ts headers() must apply global security headers to wildcard source "/(.*)".');
  }

  for (const hdr of REQUIRED_SECURITY_HEADERS) {
    if (!headerEntries.has(hdr)) {
      violations.push(`Missing mandatory OWASP HTTP security header: ${hdr}`);
    }
  }

  const xFrame = headerEntries.get('X-Frame-Options');
  if (xFrame && xFrame.value !== 'DENY') {
    violations.push(
      `Clickjacking policy violation: X-Frame-Options must be "DENY" to match frame-ancestors 'none' (found "${xFrame.value || 'dynamic'}").`
    );
  }
  const nosniff = headerEntries.get('X-Content-Type-Options');
  if (nosniff && nosniff.value !== 'nosniff') {
    violations.push(`X-Content-Type-Options must be "nosniff" (found "${nosniff.value || 'dynamic'}").`);
  }
  const coop = headerEntries.get('Cross-Origin-Opener-Policy');
  if (coop && coop.value !== 'same-origin') {
    violations.push(`Cross-Origin-Opener-Policy must be "same-origin" (found "${coop.value || 'dynamic'}").`);
  }
  const hsts = headerEntries.get('Strict-Transport-Security');
  if (hsts && (!hsts.isConditionalNonDev || !String(hsts.value || '').includes('max-age=63072000'))) {
    violations.push('Strict-Transport-Security must enforce max-age=63072000; includeSubDomains; preload inside (!isDev).');
  }

  if (
    !cspStaticJoined.includes("default-src 'self'") ||
    !cspStaticJoined.includes("object-src 'none'") ||
    !cspStaticJoined.includes("frame-ancestors 'none'") ||
    !cspStaticJoined.includes("form-action 'self'") ||
    !cspStaticJoined.includes("base-uri 'self'")
  ) {
    violations.push(
      "CSP header must enforce \"default-src 'self'\", \"object-src 'none'\", \"frame-ancestors 'none'\", \"form-action 'self'\", and \"base-uri 'self'\"."
    );
  }
  if (hasUngatedUnsafeEval) {
    violations.push("CSP 'unsafe-eval' must be strictly gated behind isDev (never active in production).");
  }

  return violations;
}

function auditProductionSecurityHeaderMap(headerMap, prefixLabel, options = {}) {
  const requirePrivacyHeaders = Boolean(options.requirePrivacyHeaders);
  const violations = [];

  if (headerMap.get('x-frame-options') !== 'DENY') {
    violations.push(
      `${prefixLabel} X-Frame-Options must be "DENY" (got "${headerMap.get('x-frame-options') || 'missing'}").`
    );
  }
  if (headerMap.get('x-content-type-options') !== 'nosniff') {
    violations.push(`${prefixLabel} X-Content-Type-Options must be "nosniff".`);
  }
  if (headerMap.get('cross-origin-opener-policy') !== 'same-origin') {
    violations.push(`${prefixLabel} Cross-Origin-Opener-Policy must be "same-origin".`);
  }
  if (!String(headerMap.get('strict-transport-security') || '').includes('max-age=63072000')) {
    violations.push(
      `${prefixLabel} must include production Strict-Transport-Security (max-age=63072000).`
    );
  }
  if (requirePrivacyHeaders) {
    if (!headerMap.get('referrer-policy')) {
      violations.push(`${prefixLabel}: missing Referrer-Policy header.`);
    }
    if (!headerMap.get('permissions-policy')) {
      violations.push(`${prefixLabel}: missing Permissions-Policy header.`);
    }
  }
  const csp = String(headerMap.get('content-security-policy') || '');
  if (
    !csp.includes("default-src 'self'") ||
    !csp.includes("object-src 'none'") ||
    !csp.includes("frame-ancestors 'none'") ||
    !csp.includes("form-action 'self'") ||
    !csp.includes("base-uri 'self'")
  ) {
    violations.push(
      `${prefixLabel} CSP is missing required default-src/object-src/frame-ancestors/form-action/base-uri directives.`
    );
  }
  if (csp.includes("'unsafe-eval'")) {
    violations.push(`${prefixLabel} production CSP must not contain 'unsafe-eval'.`);
  }

  return violations;
}

/**
 * Verifies compiled `.next/routes-manifest.json` preserves production HTTP security headers.
 */
function validateNextBuildHeaderManifest(manifestPath, rootDir = path.resolve(__dirname, '../..')) {
  const violations = [];
  if (!fs.existsSync(manifestPath)) {
    violations.push(`Missing compiled Next.js routes manifest at ${path.relative(rootDir, manifestPath)}.`);
    return violations;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (err) {
    violations.push(`Failed to parse ${path.relative(rootDir, manifestPath)}: ${err.message}`);
    return violations;
  }

  const catchAllRule = Array.isArray(manifest.headers)
    ? manifest.headers.find((entry) => entry && entry.source === '/(.*)')
    : null;
  if (!catchAllRule || !Array.isArray(catchAllRule.headers)) {
    violations.push('Compiled .next/routes-manifest.json is missing global source "/(.*)" security headers rule.');
    return violations;
  }

  const headerMap = new Map();
  for (const h of catchAllRule.headers) {
    if (h && typeof h.key === 'string') {
      headerMap.set(h.key.toLowerCase(), String(h.value || ''));
    }
  }

  return auditProductionSecurityHeaderMap(headerMap, 'Compiled manifest', {
    requirePrivacyHeaders: false,
  });
}

/**
 * Audits `package-lock.json` and `package.json` for SHA-512 SRI integrity, HTTPS npm registry
 * origins, specifier synchronization, and forbidden lifecycle execution hooks.
 */
function validatePackageLockAndLifecycle(lockData, pkgData) {
  const lockViolations = [];
  if (!lockData || typeof lockData !== 'object') {
    lockViolations.push('Missing or invalid package-lock.json payload.');
    return lockViolations;
  }
  if (!pkgData || typeof pkgData !== 'object') {
    lockViolations.push('Missing or invalid package.json payload.');
    return lockViolations;
  }

  if (typeof lockData.lockfileVersion !== 'number' || lockData.lockfileVersion < 3) {
    lockViolations.push(`package-lock.json lockfileVersion must be >= 3 (found ${lockData.lockfileVersion}).`);
  }

  for (const hookName of BANNED_LIFECYCLE_HOOKS) {
    if (pkgData.scripts && pkgData.scripts[hookName]) {
      lockViolations.push(
        `Unauthorized npm lifecycle script "${hookName}" in package.json (Supply-chain execution risk). Only "prepare": "husky" is permitted.`
      );
    }
  }
  if (pkgData.scripts && pkgData.scripts.prepare && pkgData.scripts.prepare !== 'husky') {
    lockViolations.push(
      `Unexpected "prepare" script in package.json: "${pkgData.scripts.prepare}" (expected "husky").`
    );
  }

  const packagesMap = lockData.packages || {};
  const rootLockEntry = packagesMap[''] || {};
  const expectedDeps = {
    ...(pkgData.dependencies || {}),
    ...(pkgData.devDependencies || {}),
  };
  const lockedRootDeps = {
    ...(rootLockEntry.dependencies || {}),
    ...(rootLockEntry.devDependencies || {}),
  };

  for (const [depName, spec] of Object.entries(expectedDeps)) {
    if (lockedRootDeps[depName] !== spec) {
      lockViolations.push(
        `package.json specifier for "${depName}" (${spec}) is out of sync with package-lock.json (${lockedRootDeps[depName] || 'missing'}).`
      );
    }
  }

  for (const [pkgKey, pkgMeta] of Object.entries(packagesMap)) {
    if (pkgKey === '' || !pkgMeta || typeof pkgMeta !== 'object') continue;
    const deniedLicense = findBannedPackageLicense(pkgMeta);
    if (deniedLicense) {
      lockViolations.push(
        `Package "${pkgKey}" uses denied copyleft license "${deniedLicense}" (denied policy: GPL/AGPL).`
      );
    }
    if (pkgMeta.resolved) {
      if (!String(pkgMeta.resolved).startsWith('https://registry.npmjs.org/')) {
        lockViolations.push(
          `Package "${pkgKey}" resolves from untrusted or non-HTTPS registry: ${pkgMeta.resolved}`
        );
      }
      if (!pkgMeta.integrity || !String(pkgMeta.integrity).startsWith('sha512-')) {
        lockViolations.push(
          `Package "${pkgKey}" is missing a valid SHA-512 SRI integrity digest.`
        );
      }
    }
  }

  return lockViolations;
}

/**
 * Audits `.github/workflows/*.yml` definitions for explicit `permissions:`, anti-`pull_request_target`
 * escalation, immutable 40-char commit-SHA `uses:` pins, and safe shell input handling.
 */
function validateGitHubWorkflowSecurity(workflowsDir, rootDir = path.resolve(__dirname, '../..')) {
  const workflowViolations = [];
  if (!fs.existsSync(workflowsDir)) {
    return workflowViolations;
  }

  for (const wfEntry of fs.readdirSync(workflowsDir)) {
    if (!/\.ya?ml$/i.test(wfEntry)) continue;
    const wfPath = path.join(workflowsDir, wfEntry);
    const relWf = path.relative(rootDir, wfPath).replace(/\\/g, '/');
    const wfContent = fs.readFileSync(wfPath, 'utf-8');

    if (!/^\s*permissions\s*:/m.test(wfContent)) {
      workflowViolations.push(
        `${relWf}: Missing explicit top-level "permissions:" block (least-privilege GitHub token scope required).`
      );
    }
    if (/\bpull_request_target\b/.test(wfContent) && /contents:\s*write\b/i.test(wfContent)) {
      workflowViolations.push(
        `${relWf}: Combining "pull_request_target" with "contents: write" risks untrusted fork write escalation.`
      );
    }

    const hasCheckout = /\buses\s*:\s*actions\/checkout@/i.test(wfContent);
    if (!hasCheckout) {
      const ghContextCmdMatch = wfContent.match(/\bgh\s+(release|issue|pr|run|workflow|cache)\b/i);
      if (
        ghContextCmdMatch &&
        !/\bGH_REPO\s*:/.test(wfContent) &&
        !/(?:^|\s)(?:--repo|-R)(?:\s|=)/m.test(wfContent)
      ) {
        workflowViolations.push(
          `${relWf}: Zero-checkout workflow runs "gh ${ghContextCmdMatch[1]}" without "GH_REPO:" or "--repo"/"-R" (fails outside a .git workspace).`
        );
      }
    }

    const usesMatches = [...wfContent.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)];
    for (const m of usesMatches) {
      const actionRef = m[1];
      if (actionRef.startsWith('./') || actionRef.startsWith('.\\')) continue;
      if (!/@[0-9a-f]{40}$/i.test(actionRef)) {
        workflowViolations.push(
          `${relWf}: Unpinned mutable GitHub Action reference "${actionRef}" in uses:. Pin to an immutable 40-character commit SHA.`
        );
      }
    }

    const lines = wfContent.split(/\r?\n/);
    let inRunBlock = false;
    let runIndent = 0;
    const untrustedContextPattern =
      /\$\{\{\s*github\.(?:event\.(?:inputs|issue|pull_request|comment|discussion|commits|head_commit)|head_ref)\b/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const runMatch = line.match(/^(\s*)(?:-\s*)?run:\s*(.*)$/);
      if (runMatch) {
        const inlineRun = runMatch[2].trim();
        if (inlineRun === '|' || inlineRun === '>') {
          inRunBlock = true;
          runIndent = runMatch[1].length;
          continue;
        }
        inRunBlock = false;
        if (untrustedContextPattern.test(inlineRun)) {
          workflowViolations.push(
            `${relWf}:${i + 1}: Direct untrusted GitHub context expression inside "run:" command (Shell Injection risk). Bind to "env:" first.`
          );
        }
      } else if (inRunBlock) {
        const currentIndentMatch = line.match(/^(\s*)\S/);
        if (currentIndentMatch && currentIndentMatch[1].length <= runIndent) {
          inRunBlock = false;
        } else if (untrustedContextPattern.test(line)) {
          workflowViolations.push(
            `${relWf}:${i + 1}: Direct untrusted GitHub context expression inside "run:" script block (Shell Injection risk). Bind to "env:" first.`
          );
        }
      }
    }
  }

  return workflowViolations;
}

function statementContainsEarlyReturn(stmt) {
  let hasReturn = false;
  let hasRespondWith = false;
  visitAstNodes(stmt, (node) => {
    if (node.type === 'ReturnStatement') {
      hasReturn = true;
    } else if (node.type === 'CallExpression') {
      const { methodName } = getCallCalleeParts(node);
      if (methodName === 'respondWith') {
        hasRespondWith = true;
      }
    }
  });
  return hasReturn && !hasRespondWith;
}

function expressionContainsSubnode(expr, predicate) {
  let matched = false;
  visitAstNodes(expr, (node) => {
    if (predicate(node)) {
      matched = true;
      return false;
    }
  });
  return matched;
}

function isOriginEqualityOrInequality(node, expectNegation = true) {
  if (!node || node.type !== 'BinaryExpression') return false;
  const op = node.operator;
  const isNeq = op === '!==' || op === '!=';
  const isEq = op === '===' || op === '==';
  if (expectNegation ? !isNeq : !(isNeq || isEq)) return false;

  const isMemberNamed = (n, propName) => {
    const u = unwrapTsExpressions(n);
    return u && u.type === 'MemberExpression' && getMemberPropertyName(u) === propName;
  };
  const isLocationOrigin = (n) => {
    const u = unwrapTsExpressions(n);
    if (!u || u.type !== 'MemberExpression' || getMemberPropertyName(u) !== 'origin') return false;
    const obj = unwrapTsExpressions(u.object);
    if (!obj) return false;
    if (obj.type === 'Identifier' && obj.name === 'location') return true;
    if (obj.type === 'MemberExpression' && getMemberPropertyName(obj) === 'location') {
      const root = unwrapTsExpressions(obj.object);
      return Boolean(root && root.type === 'Identifier' && root.name === 'self');
    }
    return false;
  };

  return (
    (isMemberNamed(node.left, 'origin') && isLocationOrigin(node.right)) ||
    (isMemberNamed(node.right, 'origin') && isLocationOrigin(node.left))
  );
}

function isGetMethodGuardTest(testNode) {
  return expressionContainsSubnode(testNode, (node) => {
    if (
      node.type === 'BinaryExpression' &&
      (node.operator === '!==' || node.operator === '!=')
    ) {
      const checkPair = (memberSide, strSide) => {
        const m = unwrapTsExpressions(memberSide);
        return (
          m &&
          m.type === 'MemberExpression' &&
          getMemberPropertyName(m) === 'method' &&
          getAstStringLiteralValue(strSide) === 'GET'
        );
      };
      return checkPair(node.left, node.right) || checkPair(node.right, node.left);
    }
    if (node.type === 'UnaryExpression' && node.operator === '!') {
      const arg = unwrapTsExpressions(node.argument);
      if (
        arg &&
        arg.type === 'BinaryExpression' &&
        (arg.operator === '===' || arg.operator === '==')
      ) {
        const checkPair = (memberSide, strSide) => {
          const m = unwrapTsExpressions(memberSide);
          return (
            m &&
            m.type === 'MemberExpression' &&
            getMemberPropertyName(m) === 'method' &&
            getAstStringLiteralValue(strSide) === 'GET'
          );
        };
        return checkPair(arg.left, arg.right) || checkPair(arg.right, arg.left);
      }
    }
    return false;
  });
}

function isPathnameStartsWithTest(testNode, prefix) {
  return expressionContainsSubnode(testNode, (node) => {
    if (node.type !== 'CallExpression') return false;
    const { objectNode, methodName } = getCallCalleeParts(node);
    if (methodName !== 'startsWith' || !objectNode || objectNode.type !== 'MemberExpression') {
      return false;
    }
    if (getMemberPropertyName(objectNode) !== 'pathname') return false;
    return getAstStringLiteralValue(node.arguments && node.arguments[0]) === prefix;
  });
}

/**
 * Audits `public/sw.js` via Babel AST for mandatory GET-only interception, `/auth/callback`
 * isolation, cross-origin pass-through, bounded `CACHE_URLS` sanitization, and dangerous primitive bans.
 */
function validateServiceWorkerSecurity(swCode) {
  const swViolations = [];
  if (typeof swCode !== 'string') {
    swViolations.push('Service Worker (public/sw.js) source must be a string.');
    return swViolations;
  }

  const { ast, error } = parseSecurityModuleAst(swCode, {
    sourceType: 'unambiguous',
    plugins: [],
  });
  if (error || !ast) {
    swViolations.push(
      `Failed to parse Service Worker (public/sw.js) AST: ${error ? error.message : 'Unknown error'}`
    );
    return swViolations;
  }

  const moduleFns = collectModuleFunctionsMap(ast);
  const numericConsts = new Map();
  const fetchHandlers = [];
  const messageHandlers = [];

  visitAstNodes(ast, (node) => {
    if (
      node.type === 'VariableDeclarator' &&
      node.id &&
      node.id.type === 'Identifier' &&
      node.init &&
      node.init.type === 'NumericLiteral'
    ) {
      numericConsts.set(node.id.name, node.init.value);
    }

    if (node.type === 'CallExpression') {
      const { objectName, methodName } = getCallCalleeParts(node);
      if (
        methodName === 'addEventListener' &&
        (objectName === null || objectName === 'self' || objectName === 'globalThis') &&
        Array.isArray(node.arguments) &&
        node.arguments.length >= 2
      ) {
        const eventType = getAstStringLiteralValue(node.arguments[0]);
        const handler = unwrapTsExpressions(node.arguments[1]);
        const resolvedHandler =
          isAstFunctionNode(handler)
            ? handler
            : handler && handler.type === 'Identifier'
              ? moduleFns.get(handler.name)
              : null;

        if (eventType === 'fetch' && resolvedHandler) {
          fetchHandlers.push(resolvedHandler);
        } else if (eventType === 'message' && resolvedHandler) {
          messageHandlers.push(resolvedHandler);
        }
      }
    }
  });

  const reachableFetchNodes = collectReachableFunctionNodes(fetchHandlers, moduleFns);
  let hasGetBypassGuard = false;
  let hasCrossOriginBypassGuard = false;
  let hasAuthPathBypassGuard = false;

  for (const fnNode of reachableFetchNodes) {
    visitAstNodes(fnNode, (node) => {
      if (node.type === 'IfStatement' && statementContainsEarlyReturn(node.consequent)) {
        if (isGetMethodGuardTest(node.test)) {
          hasGetBypassGuard = true;
        }
        if (expressionContainsSubnode(node.test, (n) => isOriginEqualityOrInequality(n, true))) {
          hasCrossOriginBypassGuard = true;
        }
        if (isPathnameStartsWithTest(node.test, '/auth/')) {
          hasAuthPathBypassGuard = true;
        }
      }
    });
  }

  let hasAuthCallbackCacheRisk = false;
  visitAstNodes(ast, (node, parent) => {
    if (node.type === 'StringLiteral' || node.type === 'TemplateLiteral' || node.type === 'BinaryExpression') {
      const strVal = getAstStringLiteralValue(node);
      if (typeof strVal === 'string' && strVal.includes('/auth/callback')) {
        const isSafeStartsWithArg =
          parent &&
          parent.type === 'CallExpression' &&
          getCallCalleeParts(parent).methodName === 'startsWith';
        if (!isSafeStartsWithArg) {
          hasAuthCallbackCacheRisk = true;
        }
      }
    }
  });
  if (fetchHandlers.length > 0 && !hasAuthPathBypassGuard) {
    hasAuthCallbackCacheRisk = true;
  }

  const reachableMessageNodes = collectReachableFunctionNodes(messageHandlers, moduleFns);
  let hasCacheUrlsTypeBranch = false;
  let hasBoundedMessageSlice = false;
  let hasMessageOriginGuard = false;
  let hasMessageAuthExclude = false;
  let hasMessageApiExclude = false;

  for (const fnNode of reachableMessageNodes) {
    visitAstNodes(fnNode, (node) => {
      if (
        node.type === 'StringLiteral' ||
        node.type === 'Literal' ||
        node.type === 'TemplateLiteral'
      ) {
        if (getAstStringLiteralValue(node) === 'CACHE_URLS') {
          hasCacheUrlsTypeBranch = true;
        }
      }
      if (node.type === 'CallExpression') {
        const { methodName } = getCallCalleeParts(node);
        if (methodName === 'slice' && Array.isArray(node.arguments) && node.arguments.length >= 2) {
          const boundArg = unwrapTsExpressions(node.arguments[1]);
          if (boundArg && boundArg.type === 'Identifier' && boundArg.name === 'MAX_MESSAGE_PRECACHE_URLS') {
            hasBoundedMessageSlice = true;
          } else if (
            boundArg &&
            boundArg.type === 'Identifier' &&
            numericConsts.has(boundArg.name) &&
            numericConsts.get(boundArg.name) <= 100
          ) {
            hasBoundedMessageSlice = true;
          } else if (boundArg && boundArg.type === 'NumericLiteral' && boundArg.value > 0 && boundArg.value <= 100) {
            hasBoundedMessageSlice = true;
          }
        }
      }
      if (isOriginEqualityOrInequality(node, false)) {
        hasMessageOriginGuard = true;
      }
      if (isPathnameStartsWithTest(node, '/auth/')) {
        hasMessageAuthExclude = true;
      }
      if (isPathnameStartsWithTest(node, '/api/')) {
        hasMessageApiExclude = true;
      }
    });
  }

  let hasDangerousPrimitive = false;
  visitAstNodes(ast, (node) => {
    if (node.type === 'CallExpression') {
      const { objectName, methodName } = getCallCalleeParts(node);
      if (
        (methodName === 'importScripts' && (objectName === null || objectName === 'self' || objectName === 'globalThis')) ||
        (methodName === 'eval' && (objectName === null || objectName === 'self' || objectName === 'window' || objectName === 'globalThis')) ||
        (methodName === 'Function' && (objectName === null || objectName === 'self' || objectName === 'window' || objectName === 'globalThis'))
      ) {
        hasDangerousPrimitive = true;
      }
      if (
        (methodName === 'setTimeout' || methodName === 'setInterval') &&
        (objectName === null || objectName === 'self' || objectName === 'window' || objectName === 'globalThis') &&
        node.arguments &&
        getAstStringLiteralValue(node.arguments[0]) !== null
      ) {
        hasDangerousPrimitive = true;
      }
    } else if (node.type === 'NewExpression') {
      const { objectName, methodName } = getCallCalleeParts(node);
      if (
        methodName === 'Function' &&
        (objectName === null || objectName === 'self' || objectName === 'window' || objectName === 'globalThis')
      ) {
        hasDangerousPrimitive = true;
      }
    }
  });

  if (!hasGetBypassGuard) {
    swViolations.push('Service Worker (public/sw.js) must bypass non-GET requests.');
  }
  if (hasAuthCallbackCacheRisk) {
    swViolations.push('Service Worker (public/sw.js) must never cache /auth/callback endpoints.');
  }
  if (!hasCrossOriginBypassGuard) {
    swViolations.push(
      'Service Worker (public/sw.js) must enforce strict cross-origin pass-through (url.origin !== self.location.origin).'
    );
  }
  if (
    !hasCacheUrlsTypeBranch ||
    !hasBoundedMessageSlice ||
    !hasMessageOriginGuard ||
    !hasMessageAuthExclude ||
    !hasMessageApiExclude
  ) {
    swViolations.push(
      'Service Worker (public/sw.js) CACHE_URLS handler must sanitize URLs to bounded same-origin non-/auth/ non-/api/ paths.'
    );
  }
  if (hasDangerousPrimitive) {
    swViolations.push('Service Worker (public/sw.js) must never invoke importScripts() or eval().');
  }

  return swViolations;
}

const SECRET_NEXT_PUBLIC_ENV_REGEX =
  /^NEXT_PUBLIC_.*(?:SECRET|PRIVATE|SERVICE_ROLE|PASSWORD|TOKEN|PAT|ACCESS_KEY_ID|ACCESS_KEY|R2_ACCOUNT_ID|R2_BUCKET_NAME|R2_ACCESS_KEY|R2_SECRET)(?:_|$)/i;
const CLIENT_FORBIDDEN_SECRET_ENV_VARS = new Set([
  'SUPABASE_SERVICE_ROLE_KEY',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
]);

function isProcessEnvMemberExpr(node) {
  const n = unwrapTsExpressions(node);
  if (!n || (n.type !== 'MemberExpression' && n.type !== 'OptionalMemberExpression')) return false;
  if (getMemberPropertyName(n) !== 'env') return false;
  const obj = unwrapTsExpressions(n.object);
  if (!obj) return false;
  if (obj.type === 'Identifier' && obj.name === 'process') return true;
  if (
    (obj.type === 'MemberExpression' || obj.type === 'OptionalMemberExpression') &&
    getMemberPropertyName(obj) === 'process'
  ) {
    const root = unwrapTsExpressions(obj.object);
    return Boolean(root && root.type === 'Identifier' && (root.name === 'globalThis' || root.name === 'global'));
  }
  return false;
}

function unwrapEnvContainerExpr(node) {
  let curr = unwrapTsExpressions(node);
  while (
    curr &&
    curr.type === 'LogicalExpression' &&
    (curr.operator === '??' || curr.operator === '||')
  ) {
    if (isProcessEnvMemberExpr(curr.left)) return curr.left;
    curr = unwrapTsExpressions(curr.left);
  }
  return curr;
}

/**
 * Audits JS/TS modules via Babel AST for `.env.example` documentation parity, forbidden
 * `NEXT_PUBLIC_*` secret env names, and client-bundle `SUPABASE_SERVICE_ROLE_KEY` leakage.
 */
function validateEnvAndPrivilegeBoundariesAst(code, options = {}) {
  const relPath = String(options.filePath || '').replace(/\\/g, '/');
  const violations = [];
  const { ast, error } = parseSecurityModuleAst(code, {
    sourceType: 'unambiguous',
    allowReturnOutsideFunction: relPath.startsWith('scripts/') || /\.(js|cjs)$/i.test(relPath),
    plugins: ['typescript', 'jsx', 'decorators-legacy'],
  });
  if (error || !ast) {
    violations.push({
      file: relPath,
      issue: `Failed to parse module AST for env/privilege check: ${error ? error.message : 'Unknown error'}`,
    });
    return violations;
  }

  const documentedEnvVars = options.documentedEnvVars || new Set();
  const runtimePlatformEnvVars = options.runtimePlatformEnvVars || new Set();
  const auditEnvVars = options.auditEnvVars !== false;
  const checkClientServiceRole = options.checkClientServiceRole !== false;

  const hasUseClientDirective = Boolean(
    ast.program &&
      Array.isArray(ast.program.directives) &&
      ast.program.directives.some((d) => d.value && d.value.value === 'use client')
  );
  const isClientTree =
    typeof options.isClientTree === 'boolean'
      ? options.isClientTree
      : hasUseClientDirective ||
        relPath.startsWith('src/components/') ||
        relPath.startsWith('src/hooks/') ||
        relPath.startsWith('src/stores/');

  const referencedEnvVars = new Set();
  const envAliasNames = new Set();
  const detectedClientSecrets = new Set();

  // First pass: identify variables/params aliased directly to process.env (e.g. env = process.env)
  visitAstNodes(ast, (node) => {
    if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier') {
      const rhs = unwrapEnvContainerExpr(node.init);
      if (isProcessEnvMemberExpr(rhs)) {
        envAliasNames.add(node.id.name);
      }
    } else if (node.type === 'AssignmentPattern' && node.left && node.left.type === 'Identifier') {
      const rhs = unwrapEnvContainerExpr(node.right);
      if (isProcessEnvMemberExpr(rhs)) {
        envAliasNames.add(node.left.name);
      }
    }
  });

  // Second pass: extract all process.env reads (dot, bracket, destructured, aliased) and client key exposure
  visitAstNodes(ast, (node) => {
    if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
      const obj = unwrapTsExpressions(node.object);
      const isEnvObject =
        isProcessEnvMemberExpr(obj) ||
        Boolean(obj && obj.type === 'Identifier' && envAliasNames.has(obj.name));

      if (isEnvObject) {
        const varName = node.computed
          ? getAstStringLiteralValue(node.property)
          : node.property && node.property.type === 'Identifier'
            ? node.property.name
            : null;
        if (varName && /^[A-Z][A-Z0-9_]+$/.test(varName)) {
          referencedEnvVars.add(varName);
        }
      }
    } else if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'ObjectPattern') {
      const rhs = unwrapEnvContainerExpr(node.init);
      const rhsIsEnv =
        isProcessEnvMemberExpr(rhs) ||
        Boolean(rhs && rhs.type === 'Identifier' && envAliasNames.has(rhs.name));
      if (rhsIsEnv) {
        for (const prop of node.id.properties || []) {
          if (prop.type !== 'ObjectProperty') continue;
          const varName = getAstPropertyName(prop.key, Boolean(prop.computed));
          if (varName && /^[A-Z][A-Z0-9_]+$/.test(varName)) {
            referencedEnvVars.add(varName);
          }
        }
      }
    } else if (node.type === 'AssignmentPattern' && node.left && node.left.type === 'ObjectPattern') {
      const rhs = unwrapEnvContainerExpr(node.right);
      if (isProcessEnvMemberExpr(rhs)) {
        for (const prop of node.left.properties || []) {
          if (prop.type !== 'ObjectProperty') continue;
          const varName = getAstPropertyName(prop.key, Boolean(prop.computed));
          if (varName && /^[A-Z][A-Z0-9_]+$/.test(varName)) {
            referencedEnvVars.add(varName);
          }
        }
      }
    }

    if (checkClientServiceRole && isClientTree) {
      if (node.type === 'Identifier' && CLIENT_FORBIDDEN_SECRET_ENV_VARS.has(node.name)) {
        detectedClientSecrets.add(node.name);
      } else if (
        node.type === 'StringLiteral' ||
        node.type === 'Literal' ||
        node.type === 'TemplateLiteral' ||
        node.type === 'BinaryExpression'
      ) {
        const resolvedStr = getAstStringLiteralValue(node);
        if (resolvedStr && CLIENT_FORBIDDEN_SECRET_ENV_VARS.has(resolvedStr)) {
          detectedClientSecrets.add(resolvedStr);
        }
      }
    }
  });

  if (auditEnvVars) {
    for (const varName of referencedEnvVars) {
      if (varName.endsWith('_')) continue;
      if (SECRET_NEXT_PUBLIC_ENV_REGEX.test(varName)) {
        violations.push({
          file: relPath,
          issue: `Forbidden secret variable name "${varName}" prefixed with NEXT_PUBLIC_.`,
        });
      }
      if (
        documentedEnvVars.size > 0 &&
        !runtimePlatformEnvVars.has(varName) &&
        !documentedEnvVars.has(varName)
      ) {
        violations.push({
          file: relPath,
          issue: `Undocumented environment variable "${varName}" (must be documented in .env.example).`,
        });
      }
    }
  }

  if (checkClientServiceRole && isClientTree) {
    for (const secretVar of CLIENT_FORBIDDEN_SECRET_ENV_VARS) {
      if (detectedClientSecrets.has(secretVar) || referencedEnvVars.has(secretVar)) {
        violations.push({
          file: relPath,
          issue:
            secretVar === 'SUPABASE_SERVICE_ROLE_KEY'
              ? 'Forbidden SUPABASE_SERVICE_ROLE_KEY reference in client-side module (RLS bypass risk).'
              : `Forbidden server-only secret "${secretVar}" reference in client-side module.`,
        });
      }
    }
  }

  return violations;
}

function collectExprIdentifierNames(node) {
  const names = [];
  visitAstNodes(node, (n) => {
    if (n.type === 'Identifier') {
      names.push(n.name);
    }
  });
  return names;
}

/**
 * Audits Next.js API route handlers (`src/app/api/<...>/route.ts`) via Babel AST for rate
 * limiter invocation, tainted `fetch()` SSRF protection, and `content/route.ts` manual-redirect hardening.
 */
function validateApiRoutesSecurityAst(code, relRoute = '') {
  const normalizedRoute = String(relRoute).replace(/\\/g, '/');
  const violations = [];
  const { ast, error } = parseSecurityModuleAst(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
  if (error || !ast) {
    violations.push({
      file: normalizedRoute,
      issue: `Failed to parse API route AST: ${error ? error.message : 'Unknown error'}`,
    });
    return violations;
  }

  const rateLimiterNames = new Set();
  const safeSanitizedIds = new Set();
  const directTaintedIds = new Set();
  const optionsObjectsByVar = new Map();
  const httpHandlers = [];
  const moduleFns = collectModuleFunctionsMap(ast);

  // Track rate limiters imported from @/lib/rate-limiter or matching *RateLimiter*
  visitAstNodes(ast, (node) => {
    if (node.type === 'ImportDeclaration') {
      const importSource = getAstStringLiteralValue(node.source) || '';
      const isLimiterModule = importSource.includes('rate-limiter');
      for (const spec of node.specifiers || []) {
        if (spec.local && spec.local.type === 'Identifier') {
          if (isLimiterModule || /rateLimiter/i.test(spec.local.name)) {
            rateLimiterNames.add(spec.local.name);
          }
        }
      }
    }
    if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier') {
      const varName = node.id.name;
      const init = unwrapTsExpressions(node.init);
      if (init && init.type === 'ObjectExpression') {
        optionsObjectsByVar.set(varName, init);
      }
      if (/rateLimiter/i.test(varName)) {
        rateLimiterNames.add(varName);
      } else if (init) {
        const referencedIds = collectExprIdentifierNames(init);
        if (referencedIds.some((id) => rateLimiterNames.has(id) || /rateLimiter/i.test(id))) {
          rateLimiterNames.add(varName);
        }
      }
    }
    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      const decl = node.declaration;
      const httpMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);
      if (decl.type === 'FunctionDeclaration' && decl.id && httpMethods.has(decl.id.name)) {
        httpHandlers.push(decl);
      } else if (decl.type === 'VariableDeclaration') {
        for (const d of decl.declarations || []) {
          if (d.id && d.id.type === 'Identifier' && httpMethods.has(d.id.name)) {
            const init = unwrapTsExpressions(d.init);
            if (isAstFunctionNode(init)) httpHandlers.push(init);
          }
        }
      }
    }
    if (node.type === 'CallExpression') {
      const { methodName } = getCallCalleeParts(node);
      if (methodName === 'isAllowedR2EndpointUrl' || methodName === 'parseInt') {
        for (const arg of node.arguments || []) {
          for (const idName of collectExprIdentifierNames(arg)) {
            safeSanitizedIds.add(idName);
          }
        }
      }
    }
  });

  // Track raw request-derived URL variables
  visitAstNodes(ast, (node) => {
    if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier' && node.init) {
      const name = node.id.name;
      if (safeSanitizedIds.has(name)) return;
      const init = unwrapTsExpressions(node.init);
      if (!init) return;
      let looksTainted = false;
      visitAstNodes(init, (sub) => {
        if (sub.type === 'CallExpression') {
          const { objectName, methodName } = getCallCalleeParts(sub);
          if (
            methodName === 'get' &&
            objectName &&
            (objectName === 'searchParams' || /searchParams/i.test(objectName))
          ) {
            looksTainted = true;
          }
          if ((methodName === 'json' || methodName === 'text') && (objectName === 'req' || objectName === 'request')) {
            looksTainted = true;
          }
        } else if (sub.type === 'Identifier' && (sub.name === 'urlParam' || sub.name === 'rawUrl')) {
          looksTainted = true;
        }
      });
      if (looksTainted) {
        directTaintedIds.add(name);
      }
    }
  });

  const targetInspectionNodes =
    httpHandlers.length > 0 ? collectReachableFunctionNodes(httpHandlers, moduleFns) : [ast];

  let hasRateLimiterCheck = false;
  let hasTaintedFetch = false;
  let hasDirectFetchCall = false;
  let hasManualRedirectViolation = false;
  let hasIsAllowedR2EndpointCall = false;
  let hasGutenbergUpstreamHostLiteral = false;
  const isContentProxyRoute = normalizedRoute.endsWith('api/books/content/route.ts');

  const isTaintedFetchTargetExpr = (expr) => {
    const unwrapped = unwrapTsExpressions(expr);
    if (!unwrapped) return false;
    if (unwrapped.type === 'Identifier') {
      if ((unwrapped.name === 'urlParam' || unwrapped.name === 'rawUrl') && !safeSanitizedIds.has(unwrapped.name)) {
        return true;
      }
      return directTaintedIds.has(unwrapped.name) && !safeSanitizedIds.has(unwrapped.name);
    }
    if (unwrapped.type === 'MemberExpression') {
      const ids = collectExprIdentifierNames(unwrapped);
      return ids.includes('req') || ids.includes('request');
    }
    if (unwrapped.type === 'CallExpression') {
      const { objectName, methodName } = getCallCalleeParts(unwrapped);
      if (
        methodName === 'get' &&
        (objectName === 'searchParams' || collectExprIdentifierNames(unwrapped.callee).includes('searchParams'))
      ) {
        return true;
      }
      return false;
    }
    if (unwrapped.type === 'TemplateLiteral') {
      return (unwrapped.expressions || []).some((subExpr) => {
        const ids = collectExprIdentifierNames(subExpr);
        return (
          ids.includes('req') ||
          ids.includes('request') ||
          ids.includes('searchParams') ||
          ids.some((id) => directTaintedIds.has(id) && !safeSanitizedIds.has(id))
        );
      });
    }
    return false;
  };

  for (const fnNode of targetInspectionNodes) {
    visitAstNodes(fnNode, (node) => {
      if (node.type === 'CallExpression') {
        const { objectNode, objectName, methodName } = getCallCalleeParts(node);
        if (methodName === 'check') {
          const objIds = collectExprIdentifierNames(objectNode);
          if (
            (objectName && (rateLimiterNames.has(objectName) || /rateLimiter/i.test(objectName))) ||
            objIds.some((id) => rateLimiterNames.has(id) || /rateLimiter/i.test(id))
          ) {
            hasRateLimiterCheck = true;
          }
        }
        if (methodName === 'isAllowedR2EndpointUrl') {
          hasIsAllowedR2EndpointCall = true;
        }
        if (methodName === 'fetch' && objectName === null && Array.isArray(node.arguments) && node.arguments.length >= 1) {
          hasDirectFetchCall = true;
          const targetArg = node.arguments[0];
          if (isTaintedFetchTargetExpr(targetArg)) {
            hasTaintedFetch = true;
          }
          if (isContentProxyRoute) {
            const initArg = unwrapTsExpressions(node.arguments[1]);
            const resolvedOpts =
              initArg && initArg.type === 'ObjectExpression'
                ? initArg
                : initArg && initArg.type === 'Identifier'
                  ? optionsObjectsByVar.get(initArg.name)
                  : null;
            let hasManualRedirectOption = false;
            if (resolvedOpts && Array.isArray(resolvedOpts.properties)) {
              for (const prop of resolvedOpts.properties) {
                if (
                  prop.type === 'ObjectProperty' &&
                  getAstPropertyName(prop.key, Boolean(prop.computed)) === 'redirect' &&
                  getAstStringLiteralValue(prop.value) === 'manual'
                ) {
                  hasManualRedirectOption = true;
                }
              }
            }
            if (!hasManualRedirectOption) {
              hasManualRedirectViolation = true;
            }
          }
        }
      }
      if (isContentProxyRoute) {
        const strVal =
          (node.type === 'StringLiteral' || node.type === 'Literal') && typeof node.value === 'string'
            ? node.value
            : node.type === 'TemplateElement' && node.value
              ? String(node.value.cooked || node.value.raw || '')
              : '';
        if (strVal && /^https?:\/\/(?:[a-z0-9-]+\.)?(?:gutenberg\.org|pglaf\.org|readingroo\.ms)\b/i.test(strVal)) {
          hasGutenbergUpstreamHostLiteral = true;
        }
      }
    });
  }

  if (hasTaintedFetch) {
    violations.push({
      file: normalizedRoute,
      issue: 'Tainted user parameter passed to fetch() without strict constant anchoring.',
    });
  }
  if (!hasRateLimiterCheck) {
    violations.push({
      file: normalizedRoute,
      issue: 'Public API route handler is missing mandatory RateLimiter.check() protection.',
    });
  }
  if (isContentProxyRoute && hasDirectFetchCall && hasGutenbergUpstreamHostLiteral) {
    violations.push({
      file: normalizedRoute,
      issue: 'Content route must serve assets strictly from private Cloudflare R2 without runtime Project Gutenberg or mirror fallback.',
    });
  }
  if (isContentProxyRoute && hasDirectFetchCall && (hasManualRedirectViolation || !hasIsAllowedR2EndpointCall)) {
    violations.push({
      file: normalizedRoute,
      issue: 'Content proxy route must enforce redirect: "manual" and isAllowedR2EndpointUrl() on upstream R2 hops.',
    });
  }

  return violations;
}

/**
 * Audits Next.js App Router files (`src/app/**`) via Babel AST for hardcoded external `redirect('http...')`
 * links and dynamic `NextResponse.redirect()` flows accessing `searchParams` without `sanitizeRedirectPath`
 * and `resolveCanonicalAuthOrigin`.
 */
function validateRedirectRoutesAst(code, relFile = '') {
  const normalizedFile = String(relFile).replace(/\\/g, '/');
  const violations = [];
  const { ast, error } = parseSecurityModuleAst(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
  if (error || !ast) {
    violations.push({
      file: normalizedFile,
      issue: `Failed to parse App Router AST for redirect guard: ${error ? error.message : 'Unknown error'}`,
    });
    return violations;
  }

  let hasHardcodedExternalRedirect = false;
  let hasNextResponseRedirect = false;
  let readsSearchParams = false;
  let callsSanitizeRedirectPath = false;
  let callsResolveCanonicalAuthOrigin = false;

  visitAstNodes(ast, (node) => {
    if (node.type === 'MemberExpression' && getMemberPropertyName(node) === 'searchParams') {
      readsSearchParams = true;
    } else if (node.type === 'Identifier' && (node.name === 'searchParams' || node.name === 'URLSearchParams')) {
      readsSearchParams = true;
    }

    if (node.type === 'CallExpression') {
      const { objectName, methodName } = getCallCalleeParts(node);
      if (methodName === 'redirect' && (objectName === null || objectName === 'navigation')) {
        const arg0 = node.arguments && node.arguments[0];
        const staticTarget = getAstStringLiteralValue(arg0);
        if (staticTarget !== null && /^http/i.test(staticTarget.trim())) {
          hasHardcodedExternalRedirect = true;
        } else if (arg0) {
          const unwrapped = unwrapTsExpressions(arg0);
          if (unwrapped && unwrapped.type === 'TemplateLiteral' && Array.isArray(unwrapped.quasis) && unwrapped.quasis[0]) {
            const head = String(unwrapped.quasis[0].value.cooked ?? unwrapped.quasis[0].value.raw ?? '');
            if (/^https?:\/\//i.test(head.trim())) {
              hasHardcodedExternalRedirect = true;
            }
          }
        }
      } else if (methodName === 'redirect' && objectName === 'NextResponse') {
        hasNextResponseRedirect = true;
      } else if (methodName === 'sanitizeRedirectPath' && objectName === null) {
        callsSanitizeRedirectPath = true;
      } else if (methodName === 'resolveCanonicalAuthOrigin' && objectName === null) {
        callsResolveCanonicalAuthOrigin = true;
      }
    }
  });

  if (hasHardcodedExternalRedirect) {
    violations.push({
      file: normalizedFile,
      issue: 'Hardcoded external HTTP redirect detected.',
    });
  }
  if (
    hasNextResponseRedirect &&
    readsSearchParams &&
    (!callsSanitizeRedirectPath || !callsResolveCanonicalAuthOrigin)
  ) {
    violations.push({
      file: normalizedFile,
      issue: 'Dynamic NextResponse.redirect() using searchParams must enforce sanitizeRedirectPath and resolveCanonicalAuthOrigin.',
    });
  }

  return violations;
}

/**
 * Audits `src/hooks/queries/useBooks.ts` via Babel AST to ensure catalog fetches and client-side
 * filtering strictly enforce `copyright !== true` / `copyright === false` regardless of parameter naming.
 */
function validatePublicDomainFilterAst(useBooksCode) {
  const violations = [];
  const { ast, error } = parseSecurityModuleAst(useBooksCode, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
  if (error || !ast) {
    violations.push(
      `Failed to parse useBooks AST for Pillar 5 public domain check: ${error ? error.message : 'Unknown error'}`
    );
    return violations;
  }

  let hasCopyrightFilterPredicate = false;

  visitAstNodes(ast, (node) => {
    if (node.type === 'CallExpression' && getCallCalleeParts(node).methodName === 'filter') {
      const cb = unwrapTsExpressions(node.arguments && node.arguments[0]);
      if (!isAstFunctionNode(cb)) return;
      visitAstNodes(cb, (sub) => {
        if (sub.type === 'BinaryExpression') {
          const isCopyrightMember = (side) => {
            const u = unwrapTsExpressions(side);
            return Boolean(u && u.type === 'MemberExpression' && getMemberPropertyName(u) === 'copyright');
          };
          const isBooleanTrue = (side) => {
            const u = unwrapTsExpressions(side);
            return Boolean(u && u.type === 'BooleanLiteral' && u.value === true);
          };
          const isBooleanFalse = (side) => {
            const u = unwrapTsExpressions(side);
            return Boolean(u && u.type === 'BooleanLiteral' && u.value === false);
          };

          if (
            (sub.operator === '!==' || sub.operator === '!=') &&
            ((isCopyrightMember(sub.left) && isBooleanTrue(sub.right)) ||
              (isCopyrightMember(sub.right) && isBooleanTrue(sub.left)))
          ) {
            hasCopyrightFilterPredicate = true;
          } else if (
            (sub.operator === '===' || sub.operator === '==') &&
            ((isCopyrightMember(sub.left) && isBooleanFalse(sub.right)) ||
              (isCopyrightMember(sub.right) && isBooleanFalse(sub.left)))
          ) {
            hasCopyrightFilterPredicate = true;
          }
        }
      });
    }
  });

  if (!hasCopyrightFilterPredicate) {
    violations.push('useBooks.ts does not enforce public domain filter (b.copyright !== true).');
  }

  return violations;
}

/**
 * Audits `src/stores/useAuthStore.ts` via Babel AST for Rule 9 parity: every user-scoped table
 * referencing `auth.users(id)` must be purged inside `deleteAccount()`, and every non-exempt local
 * store must be imported and reset inside the reachable call graph of `clearLocalUserStores()`.
 */
function validateRule9AuthStoreParityAst(authStoreCode, options = {}) {
  const userScopedTables = Array.isArray(options.userScopedTables) ? options.userScopedTables : [];
  const storeNames = Array.isArray(options.storeNames) ? options.storeNames : [];
  const requiredDeviceCleanupCalls = Array.isArray(options.requiredDeviceCleanupCalls)
    ? options.requiredDeviceCleanupCalls
    : [];
  const enforceFailClosedDelete = Boolean(options.enforceFailClosedDelete);
  const requireGuestDeviceWipe = Boolean(options.requireGuestDeviceWipe);
  const violations = [];

  const { ast, error } = parseSecurityModuleAst(authStoreCode, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  if (error || !ast) {
    violations.push(
      `Failed to parse src/stores/useAuthStore.ts AST for Rule 9 parity: ${error ? error.message : 'Unknown error'}`
    );
    return violations;
  }

  const moduleFns = collectModuleFunctionsMap(ast);
  const stringArrayConsts = new Map();
  let deleteAccountFnNode = null;
  let clearGuestFnNode = null;

  visitAstNodes(ast, (node) => {
    if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier') {
      const init = unwrapTsExpressions(node.init);
      if (init && init.type === 'ArrayExpression') {
        const items = [];
        for (const el of init.elements || []) {
          const val = getAstStringLiteralValue(el);
          if (val !== null) items.push(val);
        }
        if (items.length > 0) stringArrayConsts.set(node.id.name, items);
      }
    }
    if (node.type === 'ObjectProperty' || node.type === 'ObjectMethod') {
      const propName = getAstPropertyName(node.key, Boolean(node.computed));
      if (propName === 'deleteAccount' || propName === 'clearGuestDeviceData') {
        let resolvedFn = null;
        if (node.type === 'ObjectMethod') {
          resolvedFn = node;
        } else {
          const val = unwrapTsExpressions(node.value);
          if (isAstFunctionNode(val)) resolvedFn = val;
        }
        if (resolvedFn) {
          if (propName === 'deleteAccount') deleteAccountFnNode = resolvedFn;
          else clearGuestFnNode = resolvedFn;
        }
      }
    }
  });

  const isDeleteUserRpcCall = (node) =>
    Boolean(
      node &&
        node.type === 'CallExpression' &&
        getCallCalleeParts(node).methodName === 'rpc' &&
        getAstStringLiteralValue(node.arguments && node.arguments[0]) === 'delete_current_user'
    );

  // 1. Account deletion DB table parity & fail-closed RPC inspection inside deleteAccount() call graph
  const deletedTables = new Set();
  let hasDeleteUserRpcCall = false;
  let hasDiscardedDeleteRpcCall = false;
  let hasInspectedDeleteRpcCall = false;
  let hasEmptyCatchAroundDeleteRpc = false;
  const discardedRpcNodes = new Set();

  if (deleteAccountFnNode) {
    const deleteReachableFns = collectReachableFunctionNodes([deleteAccountFnNode], moduleFns);
    const loopVarToTables = new Map();
    for (const fnNode of deleteReachableFns) {
      visitAstNodes(fnNode, (node) => {
        if (node.type === 'TryStatement' && node.handler && node.handler.body) {
          const handlerStmts = Array.isArray(node.handler.body.body) ? node.handler.body.body : [];
          if (handlerStmts.length === 0) {
            let wrapsDeleteRpc = false;
            visitAstNodes(node.block, (inner) => {
              if (isDeleteUserRpcCall(inner)) wrapsDeleteRpc = true;
            });
            if (wrapsDeleteRpc) hasEmptyCatchAroundDeleteRpc = true;
          }
        }
        if (node.type === 'ExpressionStatement') {
          let innerExpr = unwrapTsExpressions(node.expression);
          if (innerExpr && innerExpr.type === 'AwaitExpression') {
            innerExpr = unwrapTsExpressions(innerExpr.argument);
          }
          if (isDeleteUserRpcCall(innerExpr)) {
            hasDiscardedDeleteRpcCall = true;
            discardedRpcNodes.add(innerExpr);
          }
        }
        if (isDeleteUserRpcCall(node)) {
          hasDeleteUserRpcCall = true;
          if (!discardedRpcNodes.has(node)) {
            hasInspectedDeleteRpcCall = true;
          }
        }
        if (node.type === 'ForOfStatement' && node.left && node.right) {
          const rightUnwrapped = unwrapTsExpressions(node.right);
          const loopItems = [];
          if (rightUnwrapped && rightUnwrapped.type === 'ArrayExpression') {
            for (const el of rightUnwrapped.elements || []) {
              const s = getAstStringLiteralValue(el);
              if (s !== null) loopItems.push(s);
            }
          } else if (
            rightUnwrapped &&
            rightUnwrapped.type === 'Identifier' &&
            stringArrayConsts.has(rightUnwrapped.name)
          ) {
            loopItems.push(...stringArrayConsts.get(rightUnwrapped.name));
          }
          if (loopItems.length > 0 && node.left.type === 'VariableDeclaration') {
            for (const decl of node.left.declarations || []) {
              if (decl.id && decl.id.type === 'Identifier') {
                loopVarToTables.set(decl.id.name, loopItems);
              }
            }
          }
        }
        if (node.type === 'CallExpression' && getCallCalleeParts(node).methodName === 'delete') {
          let curr = unwrapTsExpressions(node.callee && node.callee.object);
          while (curr && curr.type === 'CallExpression') {
            if (getCallCalleeParts(curr).methodName === 'from') {
              const tblArg = curr.arguments && curr.arguments[0];
              const litTbl = getAstStringLiteralValue(tblArg);
              if (litTbl) {
                deletedTables.add(litTbl);
              } else {
                const unwrappedArg = unwrapTsExpressions(tblArg);
                if (unwrappedArg && unwrappedArg.type === 'Identifier') {
                  if (stringArrayConsts.has(unwrappedArg.name)) {
                    for (const arrTbl of stringArrayConsts.get(unwrappedArg.name)) {
                      deletedTables.add(arrTbl);
                    }
                  } else if (loopVarToTables.has(unwrappedArg.name)) {
                    for (const arrTbl of loopVarToTables.get(unwrappedArg.name)) {
                      deletedTables.add(arrTbl);
                    }
                  }
                }
              }
              break;
            }
            curr = unwrapTsExpressions(curr.callee && curr.callee.object);
          }
        }
      });
    }
  }

  for (const tblName of userScopedTables) {
    if (!deletedTables.has(tblName)) {
      violations.push(
        `Rule 9 Account Deletion Parity: User-scoped table "public.${tblName}" is missing explicit .from('${tblName}').delete() in useAuthStore.deleteAccount() (src/stores/useAuthStore.ts).`
      );
    }
  }

  if (enforceFailClosedDelete) {
    if (
      !hasDeleteUserRpcCall ||
      hasDiscardedDeleteRpcCall ||
      !hasInspectedDeleteRpcCall ||
      hasEmptyCatchAroundDeleteRpc
    ) {
      violations.push(
        "Rule 9 Account Deletion Fail-Closed Parity: useAuthStore.deleteAccount() must capture/inspect the response of supabase.rpc('delete_current_user') fail-closed without silent catch blocks (src/stores/useAuthStore.ts)."
      );
    }
  }

  // 2. Local store & device cache teardown parity inside clearLocalUserStores() reachable call graph
  const clearLocalFn = moduleFns.get('clearLocalUserStores');
  const clearedStores = new Set();
  const calledDeviceHelpers = new Set();
  if (clearLocalFn) {
    const cleanupReachableFns = collectReachableFunctionNodes([clearLocalFn], moduleFns);
    const importedStoresInGraph = new Set();

    // Also include top-level static imports from '@/stores/use...'
    visitAstNodes(ast, (node) => {
      if (node.type === 'ImportDeclaration') {
        const src = getAstStringLiteralValue(node.source) || '';
        const match = src.match(/^@\/stores\/(use[A-Z][a-zA-Z0-9]*Store)$/);
        if (match) {
          for (const spec of node.specifiers || []) {
            if (spec.local && spec.local.type === 'Identifier') {
              importedStoresInGraph.add(spec.local.name);
            }
          }
        }
      }
    });

    for (const fnNode of cleanupReachableFns) {
      visitAstNodes(fnNode, (node) => {
        if (node.type === 'ImportExpression') {
          const importPath = getAstStringLiteralValue(node.source) || '';
          const match = importPath.match(/^@\/stores\/(use[A-Z][a-zA-Z0-9]*Store)$/);
          if (match) importedStoresInGraph.add(match[1]);
        } else if (node.type === 'CallExpression' && node.callee && node.callee.type === 'Import') {
          const importPath = getAstStringLiteralValue(node.arguments && node.arguments[0]) || '';
          const match = importPath.match(/^@\/stores\/(use[A-Z][a-zA-Z0-9]*Store)$/);
          if (match) importedStoresInGraph.add(match[1]);
        }

        // Match `<StoreName>.getState().<resetMethod>()`, `<StoreName>.setState(...)`, or direct cleanup calls
        if (node.type === 'CallExpression') {
          const { objectNode, objectName, methodName } = getCallCalleeParts(node);
          if (methodName) {
            calledDeviceHelpers.add(methodName);
          }
          if (
            methodName === 'setState' &&
            objectName &&
            /^use[A-Z][a-zA-Z0-9]*Store$/.test(objectName) &&
            importedStoresInGraph.has(objectName)
          ) {
            clearedStores.add(objectName);
          } else if (objectNode && objectNode.type === 'CallExpression') {
            const inner = getCallCalleeParts(objectNode);
            if (
              inner.methodName === 'getState' &&
              inner.objectName &&
              /^use[A-Z][a-zA-Z0-9]*Store$/.test(inner.objectName) &&
              importedStoresInGraph.has(inner.objectName) &&
              methodName
            ) {
              clearedStores.add(inner.objectName);
            }
          }
        }
      });
    }
  }

  for (const storeName of storeNames) {
    if (!clearedStores.has(storeName)) {
      violations.push(
        `Rule 9 Local Store Teardown Parity: Store "${storeName}" is missing cleanup inside clearLocalUserStores() in src/stores/useAuthStore.ts.`
      );
    }
  }

  for (const helperName of requiredDeviceCleanupCalls) {
    if (!calledDeviceHelpers.has(helperName)) {
      violations.push(
        `Rule 9 Device Cache Teardown Parity: Device cleanup helper "${helperName}()" is missing inside clearLocalUserStores() in src/stores/useAuthStore.ts.`
      );
    }
  }

  // 3. Guest device-wipe parity inside clearGuestDeviceData()
  if (requireGuestDeviceWipe) {
    if (!clearGuestFnNode) {
      violations.push(
        'Rule 9 Guest Erasure Parity: Missing clearGuestDeviceData() action in useAuthStore (src/stores/useAuthStore.ts).'
      );
    } else {
      const guestReachableFns = collectReachableFunctionNodes([clearGuestFnNode], moduleFns);
      let callsWipeDeviceReset = false;
      let hasCloudDbCall = false;
      for (const fnNode of guestReachableFns) {
        visitAstNodes(fnNode, (node) => {
          if (node.type === 'CallExpression') {
            const { methodName } = getCallCalleeParts(node);
            if (methodName === 'from' || methodName === 'rpc') {
              hasCloudDbCall = true;
            }
            if (methodName === 'resetClientAuthState' || methodName === 'clearLocalUserStores') {
              for (const rawArg of node.arguments || []) {
                const objArg = unwrapTsExpressions(rawArg);
                if (objArg && objArg.type === 'ObjectExpression') {
                  for (const prop of objArg.properties || []) {
                    if (
                      prop.type === 'ObjectProperty' &&
                      getAstPropertyName(prop.key, Boolean(prop.computed)) === 'wipeDeviceStorage'
                    ) {
                      const val = unwrapTsExpressions(prop.value);
                      if (val && val.type === 'BooleanLiteral' && val.value === true) {
                        callsWipeDeviceReset = true;
                      }
                    }
                  }
                }
              }
            }
          }
        });
      }
      if (hasCloudDbCall) {
        violations.push(
          'Rule 9 Guest Erasure Parity: clearGuestDeviceData() must remain strictly device-local without calling Supabase .from()/.rpc() (src/stores/useAuthStore.ts).'
        );
      }
      if (!callsWipeDeviceReset) {
        violations.push(
          'Rule 9 Guest Erasure Parity: clearGuestDeviceData() must invoke resetClientAuthState/clearLocalUserStores with { wipeDeviceStorage: true } (src/stores/useAuthStore.ts).'
        );
      }
    }
  }

  return violations;
}

/**
 * Validates a live HTTP response collected from compiled `next start` smoke probes against OWASP
 * security headers, API error caching/CORP isolation, SSRF rejection status, and origin-locked redirects.
 */
function validateLiveHttpSecurityResponse(probeSpec, responseSnapshot) {
  const spec = probeSpec || {};
  const label = spec.path || 'live HTTP probe';
  const res = responseSnapshot || {};
  const violations = [];

  const headerMap = new Map();
  if (res.headers && typeof res.headers === 'object') {
    for (const [k, v] of Object.entries(res.headers)) {
      if (v === undefined || v === null) continue;
      headerMap.set(k.toLowerCase(), Array.isArray(v) ? v.join(', ') : String(v));
    }
  }

  const status = typeof res.status === 'number' ? res.status : 0;
  if (typeof spec.expectedStatus === 'number' && status !== spec.expectedStatus) {
    violations.push(`Live probe ${label}: expected HTTP ${spec.expectedStatus}, received ${status}.`);
  } else if (Array.isArray(spec.expectedStatuses) && !spec.expectedStatuses.includes(status)) {
    violations.push(
      `Live probe ${label}: expected HTTP [${spec.expectedStatuses.join(', ')}], received ${status}.`
    );
  }

  if (spec.expectSecurityHeaders) {
    violations.push(
      ...auditProductionSecurityHeaderMap(headerMap, `Live probe ${label}`, {
        requirePrivacyHeaders: true,
      })
    );
  }

  if (spec.expectNoStoreCache) {
    const cacheControl = String(headerMap.get('cache-control') || '').toLowerCase();
    if (!cacheControl.includes('no-store')) {
      violations.push(
        `Live probe ${label}: error/API response must include Cache-Control: no-store (got "${cacheControl || 'missing'}").`
      );
    }
  }

  if (spec.expectCrossOriginResourcePolicy) {
    const corp = headerMap.get('cross-origin-resource-policy');
    if (corp !== spec.expectCrossOriginResourcePolicy) {
      violations.push(
        `Live probe ${label}: Cross-Origin-Resource-Policy must be "${spec.expectCrossOriginResourcePolicy}" (got "${corp || 'missing'}").`
      );
    }
  }

  if (spec.forbidStackTraces && typeof res.body === 'string') {
    if (
      /at Object\.<anonymous>|UnhandledRuntimeError|\n\s+at\s+\S+\s+\([^)]+:\d+:\d+\)/.test(res.body)
    ) {
      violations.push(`Live probe ${label}: response body leaked internal stack trace details.`);
    }
  }

  const rawAllowedOrigins = Array.isArray(spec.allowedRedirectOrigins)
    ? spec.allowedRedirectOrigins.filter(Boolean)
    : spec.expectedRedirectOrigin
      ? [spec.expectedRedirectOrigin]
      : [];

  if (rawAllowedOrigins.length > 0) {
    const location = headerMap.get('location');
    if (status < 300 || status >= 400 || !location) {
      violations.push(
        `Live probe ${label}: expected 3xx redirect with Location header (got status ${status}).`
      );
    } else {
      try {
        const expectedOrigins = rawAllowedOrigins.map((origin) => new URL(origin).origin);
        const primaryOrigin = expectedOrigins[0];
        const resolved = new URL(location, primaryOrigin);
        if (!expectedOrigins.includes(resolved.origin)) {
          violations.push(
            `Live probe ${label}: open redirect escaped expected origin ${expectedOrigins.join(' | ')} to ${resolved.origin} (Location: "${location}").`
          );
        }
        const forbiddenHosts = Array.isArray(spec.forbiddenRedirectHosts)
          ? spec.forbiddenRedirectHosts
          : [];
        for (const host of forbiddenHosts) {
          if (resolved.hostname.toLowerCase() === host.toLowerCase() || location.toLowerCase().includes(host.toLowerCase())) {
            violations.push(
              `Live probe ${label}: redirect Location "${location}" leaked forbidden external host "${host}".`
            );
          }
        }
      } catch (err) {
        violations.push(
          `Live probe ${label}: invalid redirect Location "${location}" (${err instanceof Error ? err.message : String(err)}).`
        );
      }
    }
  }

  return violations;
}

/**
 * Validates circular symbol, PostgreSQL RLS table count, and feed-integrity
 * parity inside `SECURITY.md` against live ESLint/SAST/SQL exports.
 */
function auditSecurityDocumentationParity({
  securityMarkdown,
  eslintRuleNames = [],
  sastValidatorExports = [],
  expectedDbTableCount = 0,
  syncCatalogText = '',
} = {}) {
  const violations = [];
  if (typeof securityMarkdown !== 'string' || securityMarkdown.trim().length === 0) {
    return ['SECURITY.md is missing or empty.'];
  }

  const beginMarker = '<!-- BEGIN:security-architecture -->';
  const endMarker = '<!-- END:security-architecture -->';
  const beginIdx = securityMarkdown.indexOf(beginMarker);
  const endIdx = securityMarkdown.indexOf(endMarker);
  if (beginIdx === -1 || endIdx === -1 || endIdx <= beginIdx) {
    violations.push(
      'SECURITY.md is missing valid "<!-- BEGIN:security-architecture -->" / "<!-- END:security-architecture -->" compiled markers (run "npm run docs:sync").'
    );
  } else {
    const compiledSlice = securityMarkdown.slice(beginIdx + beginMarker.length, endIdx).trim();
    if (compiledSlice.length === 0) {
      violations.push(
        'SECURITY.md security-architecture compiled block is empty (run "npm run docs:sync").'
      );
    }
  }

  for (const ruleName of eslintRuleNames) {
    if (ruleName && !securityMarkdown.includes(ruleName)) {
      violations.push(
        `Security documentation drift in SECURITY.md: active ESLint rule "${ruleName}" is undocumented (run "npm run docs:sync").`
      );
    }
  }

  for (const exportName of sastValidatorExports) {
    if (exportName && !securityMarkdown.includes(exportName)) {
      violations.push(
        `Security documentation drift in SECURITY.md: exported SAST symbol "${exportName}" is undocumented (run "npm run docs:sync").`
      );
    }
  }

  if (typeof expectedDbTableCount === 'number' && expectedDbTableCount > 0) {
    const tableCountMatched =
      securityMarkdown.includes(`all ${expectedDbTableCount} database tables`) ||
      securityMarkdown.includes(`all ${expectedDbTableCount} PostgreSQL tables`) ||
      securityMarkdown.includes(`${expectedDbTableCount} RLS-enabled PostgreSQL tables`);
    if (!tableCountMatched) {
      violations.push(
        `Security documentation drift in SECURITY.md: expected RLS table count matching ${expectedDbTableCount} schema tables (run "npm run docs:sync").`
      );
    }
  }

  if (
    typeof syncCatalogText === 'string' &&
    /sha256/i.test(syncCatalogText) &&
    /content-length/i.test(syncCatalogText)
  ) {
    for (const token of ['sync-gutenberg-catalog.js', '.sha256', 'Content-Length']) {
      if (!securityMarkdown.includes(token)) {
        violations.push(
          `Security documentation drift in SECURITY.md: feed/snapshot integrity safeguard "${token}" missing (run "npm run docs:sync").`
        );
      }
    }
  }

  return violations;
}

/**
 * Validates dynamic technical/legal parity across `/privacy`, `/copyright`, and `AccountDeleteModal`
 * against live Service Worker, IndexedDB cache, Edge CDN TTL, cookie, and sync script specs.
 */
function auditLegalDocumentationParity({
  privacySource = '',
  copyrightSource = '',
  deleteModalSource = '',
  swCacheName = '',
  maxCachedCovers = 0,
  coverCacheTtlDays = 0,
  cdnTextSeconds = 0,
  cdnCoverSeconds = 0,
  requiredCookies = [
    'bookarium-geo-country',
    'bookarium-theme-preference',
    'bookarium-auth-hint',
    'bookarium-client-ip-sync',
    'sb-*-auth-token',
  ],
  forbiddenLegacyPatterns = [
    { label: 'until at least 2026', regex: /until at least 2026/i },
    { label: 'Standard Ebooks', regex: /Standard Ebooks/i },
    { label: 'Open Cultural Preservation Partners', regex: /Open Cultural Preservation Partners/i },
    { label: 'gutenberg.readingroo.ms', regex: /gutenberg\.readingroo\.ms/i },
    { label: 'fallback HTTP mirrors', regex: /fallback HTTP mirrors/i },
  ],
} = {}) {
  const violations = [];

  if (typeof privacySource !== 'string' || privacySource.trim().length === 0) {
    violations.push('src/app/privacy/page.tsx is missing or empty.');
  } else {
    if (swCacheName && !privacySource.includes(swCacheName)) {
      violations.push(
        `Privacy documentation drift in src/app/privacy/page.tsx: missing active Service Worker cache name "${swCacheName}".`
      );
    }
    if (maxCachedCovers > 0 && !privacySource.includes(String(maxCachedCovers))) {
      violations.push(
        `Privacy documentation drift in src/app/privacy/page.tsx: expected cover_cache bound "${maxCachedCovers}" matching MAX_CACHED_COVERS.`
      );
    }
    if (coverCacheTtlDays > 0 && !privacySource.includes(`${coverCacheTtlDays}-day`)) {
      violations.push(
        `Privacy documentation drift in src/app/privacy/page.tsx: expected "${coverCacheTtlDays}-day" cover_cache TTL matching COVER_CACHE_TTL_MS.`
      );
    }
    for (const cookieName of requiredCookies) {
      if (cookieName && !privacySource.includes(cookieName)) {
        violations.push(
          `Privacy documentation drift in src/app/privacy/page.tsx: active cookie "${cookieName}" is undocumented.`
        );
      }
    }
    for (const requiredToken of [
      'Vercel Web Analytics',
      'offline_books',
      'cover_cache',
      'Clear All Local Data',
    ]) {
      if (!privacySource.includes(requiredToken)) {
        violations.push(
          `Privacy documentation drift in src/app/privacy/page.tsx: missing required disclosure "${requiredToken}".`
        );
      }
    }
    if (/Infrastructure Partners/i.test(privacySource)) {
      violations.push(
        'Privacy documentation drift in src/app/privacy/page.tsx: found retired/implied endorsement claim "Infrastructure Partners".'
      );
    }
  }

  if (typeof copyrightSource !== 'string' || copyrightSource.trim().length === 0) {
    violations.push('src/app/copyright/page.tsx is missing or empty.');
  } else {
    if (cdnTextSeconds > 0 && !copyrightSource.includes(String(cdnTextSeconds))) {
      violations.push(
        `Copyright documentation drift in src/app/copyright/page.tsx: missing Edge CDN text TTL "${cdnTextSeconds}".`
      );
    }
    if (cdnCoverSeconds > 0 && !copyrightSource.includes(String(cdnCoverSeconds))) {
      violations.push(
        `Copyright documentation drift in src/app/copyright/page.tsx: missing Edge CDN cover TTL "${cdnCoverSeconds}".`
      );
    }
    if (maxCachedCovers > 0 && !copyrightSource.includes(String(maxCachedCovers))) {
      violations.push(
        `Copyright documentation drift in src/app/copyright/page.tsx: expected cover_cache bound "${maxCachedCovers}".`
      );
    }
    if (coverCacheTtlDays > 0 && !copyrightSource.includes(`${coverCacheTtlDays}-day`)) {
      violations.push(
        `Copyright documentation drift in src/app/copyright/page.tsx: expected "${coverCacheTtlDays}-day" cover_cache TTL.`
      );
    }
    for (const requiredToken of [
      'offline_books',
      'cover_cache',
      'bookarium-geo-country',
      'rsync.ibiblio.org',
      'gutenberg.pglaf.org',
      'Bookarium-Catalog-Sync',
      '/og/books/[file]',
      'Project Gutenberg Literary Archive Foundation',
      'not officially affiliated',
    ]) {
      if (!copyrightSource.includes(requiredToken)) {
        violations.push(
          `Copyright documentation drift in src/app/copyright/page.tsx: missing required compliance detail "${requiredToken}".`
        );
      }
    }
    for (const legacy of forbiddenLegacyPatterns) {
      if (legacy?.regex && legacy.regex.test(copyrightSource)) {
        violations.push(
          `Copyright documentation drift in src/app/copyright/page.tsx: found retired/stale claim "${legacy.label}".`
        );
      }
    }
  }

  if (typeof deleteModalSource !== 'string' || deleteModalSource.trim().length === 0) {
    violations.push('src/components/account/AccountDeleteModal.tsx is missing or empty.');
  } else {
    for (const token of ['same browser', 'offline downloads']) {
      if (!deleteModalSource.toLowerCase().includes(token.toLowerCase())) {
        violations.push(
          `Deletion modal drift in src/components/account/AccountDeleteModal.tsx: missing user safeguard "${token}".`
        );
      }
    }
  }

  return violations;
}

module.exports = {
  REQUIRED_SECURITY_HEADERS,
  BANNED_LIFECYCLE_HOOKS,
  BANNED_PACKAGE_LICENSES,
  validateNextConfigSecurityHeadersAst,
  validateNextBuildHeaderManifest,
  validatePackageLockAndLifecycle,
  validateGitHubWorkflowSecurity,
  validateServiceWorkerSecurity,
  validateEnvAndPrivilegeBoundariesAst,
  validateApiRoutesSecurityAst,
  validateRedirectRoutesAst,
  validatePublicDomainFilterAst,
  validateRule9AuthStoreParityAst,
  validateLiveHttpSecurityResponse,
  auditSecurityDocumentationParity,
  auditLegalDocumentationParity,
};

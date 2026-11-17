/**
 * Pure Stateless SAST, Workflow, Supply-Chain & Header Security Validators
 *
 * Extracted from `scripts/verify-build.js` so every static AST/manifest/workflow/lockfile/SW
 * security rule can be verified deterministically with both positive and adversarial negative
 * fixtures inside Vitest without circular execution of the 7-Gateway runner.
 *
 * @module scripts/lib/sast-validators
 * @scope Stateless Babel AST header, compiled Next routes manifest, npm lockfile/lifecycle, GitHub Actions YAML security, and Service Worker invariant validators.
 * @invariant Enforce `REQUIRED_SECURITY_HEADERS` (`X-Frame-Options: DENY`, `nosniff`, `same-origin` COOP, conditional `!isDev` HSTS, CSP directives without ungated `unsafe-eval`), immutable 40-char commit-SHA `uses:` pinning, banned `BANNED_LIFECYCLE_HOOKS`, and strict `public/sw.js` same-origin `CACHE_URLS` guards without executing external shells.
 * @rationale Isolating pure validators away from top-level CLI runners allows direct unit testing against intentionally vulnerable fixtures while keeping `Pass 0.75` and `Pass 7` fast and deterministic.
 * @adr ADR-073, ADR-080, ADR-081
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

function getAstStringLiteralValue(node) {
  if (!node) return null;
  if ((node.type === 'StringLiteral' || node.type === 'Literal') && typeof node.value === 'string') {
    return node.value;
  }
  if (node.type === 'TemplateLiteral' && Array.isArray(node.quasis) && node.expressions.length === 0) {
    return node.quasis.map((q) => String(q.value.cooked ?? q.value.raw ?? '')).join('');
  }
  return null;
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

  if (headerMap.get('x-frame-options') !== 'DENY') {
    violations.push(`Compiled manifest X-Frame-Options must be "DENY" (got "${headerMap.get('x-frame-options') || 'missing'}").`);
  }
  if (headerMap.get('x-content-type-options') !== 'nosniff') {
    violations.push('Compiled manifest X-Content-Type-Options must be "nosniff".');
  }
  if (headerMap.get('cross-origin-opener-policy') !== 'same-origin') {
    violations.push('Compiled manifest Cross-Origin-Opener-Policy must be "same-origin".');
  }
  if (!String(headerMap.get('strict-transport-security') || '').includes('max-age=63072000')) {
    violations.push('Compiled manifest must include production Strict-Transport-Security (max-age=63072000).');
  }
  const csp = String(headerMap.get('content-security-policy') || '');
  if (
    !csp.includes("default-src 'self'") ||
    !csp.includes("object-src 'none'") ||
    !csp.includes("frame-ancestors 'none'") ||
    !csp.includes("form-action 'self'") ||
    !csp.includes("base-uri 'self'")
  ) {
    violations.push("Compiled manifest CSP is missing required default-src/object-src/frame-ancestors/form-action/base-uri directives.");
  }
  if (csp.includes("'unsafe-eval'")) {
    violations.push("Compiled production manifest CSP must not contain 'unsafe-eval'.");
  }

  return violations;
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

/**
 * Audits `public/sw.js` source for mandatory GET-only interception, `/auth/callback` isolation,
 * cross-origin pass-through, bounded `CACHE_URLS` sanitization, and dangerous primitive bans.
 */
function validateServiceWorkerSecurity(swCode) {
  const swViolations = [];
  if (typeof swCode !== 'string') {
    swViolations.push('Service Worker (public/sw.js) source must be a string.');
    return swViolations;
  }

  if (!swCode.includes("request.method !== 'GET'")) {
    swViolations.push('Service Worker (public/sw.js) must bypass non-GET requests.');
  }
  if (swCode.includes('/auth/callback')) {
    swViolations.push('Service Worker (public/sw.js) must never cache /auth/callback endpoints.');
  }
  if (!swCode.includes('url.origin !== self.location.origin')) {
    swViolations.push(
      'Service Worker (public/sw.js) must enforce strict cross-origin pass-through (url.origin !== self.location.origin).'
    );
  }
  if (
    !swCode.includes('MAX_MESSAGE_PRECACHE_URLS') ||
    !swCode.includes('parsed.origin !== self.location.origin') ||
    !swCode.includes("parsed.pathname.startsWith('/auth/')") ||
    !swCode.includes("parsed.pathname.startsWith('/api/')")
  ) {
    swViolations.push(
      'Service Worker (public/sw.js) CACHE_URLS handler must sanitize URLs to bounded same-origin non-/auth/ non-/api/ paths.'
    );
  }
  if (/\b(?:importScripts|eval)\s*\(/.test(swCode)) {
    swViolations.push('Service Worker (public/sw.js) must never invoke importScripts() or eval().');
  }

  return swViolations;
}

module.exports = {
  REQUIRED_SECURITY_HEADERS,
  BANNED_LIFECYCLE_HOOKS,
  validateNextConfigSecurityHeadersAst,
  validateNextBuildHeaderManifest,
  validatePackageLockAndLifecycle,
  validateGitHubWorkflowSecurity,
  validateServiceWorkerSecurity,
};

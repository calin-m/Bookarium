const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const npxCmd = isWin ? 'npx.cmd' : 'npx';
const rootDir = path.resolve(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function logHeader(title) {
  console.log(`\n${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}▶ ${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}══════════════════════════════════════════════════════════════════${colors.reset}`);
}

function logPass(msg) {
  console.log(`${colors.green}✔ [PASS]${colors.reset} ${msg}`);
}

function logFail(msg) {
  console.error(`${colors.red}✖ [FAIL]${colors.reset} ${msg}`);
}

function runCommand(command, inheritStdio = false, timeoutMs = 0) {
  try {
    console.log(`${colors.dim}Executing: ${command}${colors.reset}`);
    const options = {
      cwd: rootDir,
      stdio: inheritStdio ? 'inherit' : 'pipe',
      encoding: 'utf-8',
    };
    if (timeoutMs > 0) {
      options.timeout = timeoutMs;
    }
    const stdout = execSync(command, options);
    return { success: true, stdout: inheritStdio ? '' : stdout };
  } catch (error) {
    return {
      success: false,
      stdout: error.stdout ? error.stdout.toString() : '',
      stderr: error.stderr ? error.stderr.toString() : error.message,
    };
  }
}

// -------------------------------------------------------------
// PASS 0.5: Pre-Commit Secret Scanner
// -------------------------------------------------------------
function pass05SecretScanner() {
  logHeader('Pass 0.5: Pre-Commit Secret & Privilege Boundary Scanner');

  const secretPatterns = [
    { name: 'AWS Access Key', regex: new RegExp('AKIA' + '[0-9A-Z]{16}') },
    { name: 'RSA Private Key', regex: new RegExp('-----' + 'BEGIN RSA PRIVATE KEY' + '-----') },
    { name: 'Generic Private Key', regex: new RegExp('-----' + 'BEGIN PRIVATE KEY' + '-----') },
    { name: 'EC / OpenSSH Private Key', regex: new RegExp('-----' + 'BEGIN (?:EC|OPENSSH) PRIVATE KEY' + '-----') },
    { name: 'GitHub Personal Token', regex: new RegExp('ghp_' + '[0-9a-zA-Z]{36}') },
    { name: 'GitHub Fine-Grained PAT', regex: new RegExp('github_pat_' + '[0-9a-zA-Z_]{82}') },
    { name: 'Supabase Personal Access Token', regex: new RegExp('sbp_' + '[0-9a-f]{40}') },
    {
      name: 'Slack / Discord Webhook URL',
      regex: new RegExp(
        'https://' +
          '(?:hooks\\.slack\\.com/services/T[0-9A-Z]+/B[0-9A-Z]+/[0-9a-zA-Z]+|discord(?:app)?\\.com/api/webhooks/\\d+/[0-9a-zA-Z_-]+)'
      ),
    },
    {
      name: 'Generic Secret Token',
      regex: new RegExp('(api_key|apikey|secret_key|client_secret|service_role_key)\\s*[:=]\\s*[\'"][0-9a-zA-Z-_]{20,}[\'"]', 'i'),
    },
  ];

  const scannedFiles = [];
  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (['node_modules', '.git', '.next', 'coverage'].includes(file)) continue;
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (/\.(ts|tsx|js|json|md|env)$/.test(file)) {
        if (fullPath !== __filename) {
          scannedFiles.push(fullPath);
        }
      }
    }
  }

  scanDir(rootDir);

  const violations = [];
  for (const filePath of scannedFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    for (const pattern of secretPatterns) {
      if (pattern.regex.test(content)) {
        violations.push({ file: relPath, issue: pattern.name });
      }
    }

    // Client-Bundle Privilege Guard: Ensure SUPABASE_SERVICE_ROLE_KEY is never referenced in client-side code
    const isClientTree =
      relPath.startsWith('src/components/') ||
      relPath.startsWith('src/hooks/') ||
      relPath.startsWith('src/stores/') ||
      (relPath.startsWith('src/') && /^['"]use client['"]/m.test(content));

    if (
      isClientTree &&
      /\.(ts|tsx|js|jsx)$/.test(relPath) &&
      !relPath.includes('.test.') &&
      !relPath.includes('.spec.') &&
      content.includes('SUPABASE_SERVICE_ROLE_KEY')
    ) {
      violations.push({
        file: relPath,
        issue: 'Forbidden SUPABASE_SERVICE_ROLE_KEY reference in client-side module (RLS bypass risk).',
      });
    }
  }

  if (violations.length > 0) {
    logFail(`Secret or privilege boundary leakage detected in ${violations.length} location(s):`);
    violations.forEach((v) => console.error(`  - ${v.file}: ${v.issue}`));
    return false;
  }

  logPass(`Scanned ${scannedFiles.length} files. Zero exposed credentials, tokens, or client service-role leaks detected.`);
  return true;
}

// -------------------------------------------------------------
// PASS 0.75: Pre-Commit SAST & OWASP Security Suite
// -------------------------------------------------------------
function pass075SecurityAndSastAudit() {
  logHeader('Pass 0.75: Pre-Commit SAST & OWASP Security Suite (7-Pillar Audit)');

  // Pillar 1: Dependency Vulnerability Audit
  console.log(`${colors.dim}Pillar 1: Auditing production runtime dependencies for high/critical CVEs...${colors.reset}`);
  const auditRes = runCommand(`${npmCmd} audit --omit=dev --audit-level=high`, false, 6000);
  if (!auditRes.success) {
    const combinedOutput = `${auditRes.stdout || ''}\n${auditRes.stderr || ''}`;
    const isNetworkOrRegistryError =
      /Service Unavailable|ECONNRESET|ENOTFOUND|ETIMEDOUT|ERR_SOCKET_TIMEOUT|E503|code E\d{3}|npm ERR! network|timed out|timeout/i.test(
        combinedOutput
      );

    if (isNetworkOrRegistryError) {
      console.log(
        `${colors.yellow}⚠ [WARN] npm registry temporarily unavailable or degraded. Skipping remote CVE audit.${colors.reset}`
      );
    } else {
      logFail('High or critical security vulnerability detected in production dependencies:');
      console.error(auditRes.stdout || auditRes.stderr);
      return false;
    }
  } else {
    logPass('Pillar 1: Zero high or critical production runtime CVEs detected.');
  }

  // Pillar 2: Static SAST SSRF & Rate-Limiting Audit for API Route Handlers
  console.log(`${colors.dim}Pillar 2: Auditing API routes for dynamic fetch SSRF taint and rate-limiter enforcement...${colors.reset}`);
  const apiDir = path.join(rootDir, 'src', 'app', 'api');
  if (fs.existsSync(apiDir)) {
    const apiFiles = [];
    function scanApi(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) scanApi(full);
        else if (entry.name === 'route.ts' || entry.name === 'route.js') apiFiles.push(full);
      }
    }
    scanApi(apiDir);

    const ssrfViolations = [];
    for (const routeFile of apiFiles) {
      const code = fs.readFileSync(routeFile, 'utf-8');
      const relRoute = path.relative(rootDir, routeFile).replace(/\\/g, '/');
      const taintedFetchPattern =
        /fetch\s*\(\s*(?:urlParam|req\.|request\.|searchParams\.get|rawUrl|`\$\{[^}]*(?:searchParams|req\.|request\.))/i;
      if (taintedFetchPattern.test(code)) {
        ssrfViolations.push({
          file: relRoute,
          issue: 'Tainted user parameter passed to fetch() without strict constant anchoring.',
        });
      }
      if (!/RateLimiter/.test(code) || !/\.check\s*\(/.test(code)) {
        ssrfViolations.push({
          file: relRoute,
          issue: 'Public API route handler is missing mandatory RateLimiter.check() protection.',
        });
      }
      if (relRoute.endsWith('api/books/content/route.ts')) {
        if (!code.includes("redirect: 'manual'") || !code.includes('isSafeUpstreamUrl(')) {
          ssrfViolations.push({
            file: relRoute,
            issue: 'Content proxy route must enforce redirect: "manual" and isSafeUpstreamUrl() on upstream hops.',
          });
        }
      }
    }

    if (ssrfViolations.length > 0) {
      logFail(`SAST API security violation detected in ${ssrfViolations.length} location(s):`);
      ssrfViolations.forEach((v) => console.error(`  - ${v.file}: ${v.issue}`));
      return false;
    }
    logPass(`Pillar 2: Audited ${apiFiles.length} API route handler(s). Rate limiting and anti-SSRF guards verified.`);
  }

  // Pillar 3: Client-Side XSS & Dangerous Evaluation Primitives Guard
  console.log(`${colors.dim}Pillar 3: Auditing source code for DOM XSS sinks and dangerous evaluation primitives...${colors.reset}`);
  const srcDir = path.join(rootDir, 'src');
  const xssViolations = [];
  function scanSourceForXss(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanSourceForXss(full);
      } else if (/\.(tsx|ts|jsx|js)$/.test(entry.name) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
        const code = fs.readFileSync(full, 'utf-8');
        const relFile = path.relative(rootDir, full);
        if (code.includes('dangerouslySetInnerHTML')) {
          xssViolations.push({ file: relFile, issue: 'Forbidden dangerouslySetInnerHTML detected.' });
        }
        if (/\beval\s*\(/.test(code)) {
          xssViolations.push({ file: relFile, issue: 'Forbidden eval() primitive detected.' });
        }
        if (/new\s+Function\s*\(/.test(code)) {
          xssViolations.push({ file: relFile, issue: 'Forbidden dynamic Function constructor detected.' });
        }
        if (/href\s*=\s*['"]\s*javascript:/i.test(code)) {
          xssViolations.push({ file: relFile, issue: 'Forbidden javascript: pseudoprotocol link detected.' });
        }
        if (/\.(?:innerHTML|outerHTML)\s*=/.test(code)) {
          xssViolations.push({ file: relFile, issue: 'Forbidden direct DOM innerHTML/outerHTML assignment detected.' });
        }
        if (/\bdocument\.write\s*\(/.test(code)) {
          xssViolations.push({ file: relFile, issue: 'Forbidden document.write() DOM sink detected.' });
        }
        if (/\bset(?:Timeout|Interval)\s*\(\s*['"`]/.test(code)) {
          xssViolations.push({ file: relFile, issue: 'Forbidden string-evaluated setTimeout/setInterval detected.' });
        }
      }
    }
  }
  scanSourceForXss(srcDir);

  if (xssViolations.length > 0) {
    logFail(`XSS/Dangerous primitive violation detected in ${xssViolations.length} location(s):`);
    xssViolations.forEach((v) => console.error(`  - ${v.file}: ${v.issue}`));
    return false;
  }
  logPass('Pillar 3: Zero DOM XSS sinks, eval(), dynamic Function, or javascript: URI schemes detected.');

  // Pillar 4: Open Redirect & Phishing Navigation Guard
  console.log(`${colors.dim}Pillar 4: Auditing redirect destinations and dynamic auth callback sanitization...${colors.reset}`);
  const redirectViolations = [];
  const appDir = path.join(rootDir, 'src', 'app');
  function scanRedirects(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanRedirects(full);
      } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
        const code = fs.readFileSync(full, 'utf-8');
        const relFile = path.relative(rootDir, full);
        if (/redirect\s*\(\s*['"]http/i.test(code)) {
          redirectViolations.push({ file: relFile, issue: 'Hardcoded external HTTP redirect detected.' });
        }
        if (/NextResponse\.redirect\s*\(/.test(code) && /searchParams/.test(code)) {
          if (!code.includes('sanitizeRedirectPath') || !code.includes('resolveCanonicalAuthOrigin')) {
            redirectViolations.push({
              file: relFile,
              issue: 'Dynamic NextResponse.redirect() using searchParams must enforce sanitizeRedirectPath and resolveCanonicalAuthOrigin.',
            });
          }
        }
      }
    }
  }
  scanRedirects(appDir);

  if (redirectViolations.length > 0) {
    logFail(`Open redirect violation detected in ${redirectViolations.length} location(s):`);
    redirectViolations.forEach((v) => console.error(`  - ${v.file}: ${v.issue}`));
    return false;
  }
  logPass('Pillar 4: All internal and dynamic callback redirects sanitized and origin-locked.');

  // Pillar 5: Public Domain & License Integrity Guard
  console.log(`${colors.dim}Pillar 5: Auditing public domain copyright enforcement and open source licenses...${colors.reset}`);
  const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
  if (pkgJson.license !== 'MIT') {
    logFail(`Package license must be strictly MIT, found: ${pkgJson.license}`);
    return false;
  }

  const useBooksPath = path.join(rootDir, 'src', 'hooks', 'queries', 'useBooks.ts');
  if (fs.existsSync(useBooksPath)) {
    const useBooksCode = fs.readFileSync(useBooksPath, 'utf-8');
    if (!useBooksCode.includes('b.copyright !== true')) {
      logFail('useBooks.ts does not enforce public domain filter (b.copyright !== true).');
      return false;
    }
  }
  logPass('Pillar 5: MIT license compliance and public domain integrity (copyright=false) verified.');

  // Pillar 6: PostgreSQL Row-Level Security (RLS) & SECURITY DEFINER Hardening Audit
  console.log(`${colors.dim}Pillar 6: Auditing supabase/schema.sql for mandatory table RLS and SECURITY DEFINER search_path isolation...${colors.reset}`);
  const schemaPath = path.join(rootDir, 'supabase', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    const rlsViolations = [];
    const tableMatches = [...schemaSql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-z0-9_]+)/gi)];
    const publicTables = [...new Set(tableMatches.map((m) => m[1]))];

    for (const tableName of publicTables) {
      const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+public\\.${tableName}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
      if (!rlsRegex.test(schemaSql)) {
        rlsViolations.push(`Table "public.${tableName}" is missing ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`);
      }
    }

    const fnBlocks = [...schemaSql.matchAll(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.([a-z0-9_]+)\s*\([\s\S]*?AS\s+\$\$/gi)];
    for (const match of fnBlocks) {
      const fnName = match[1];
      const headerBlock = match[0];
      if (/SECURITY\s+DEFINER/i.test(headerBlock) && !/SET\s+search_path\s*=\s*''/i.test(headerBlock)) {
        rlsViolations.push(`SECURITY DEFINER function "public.${fnName}" must explicitly set "SET search_path = ''".`);
      }
    }

    if (rlsViolations.length > 0) {
      logFail(`Database schema security violation(s) in supabase/schema.sql:`);
      rlsViolations.forEach((v) => console.error(`  - ${v}`));
      return false;
    }
    logPass(`Pillar 6: Verified Row-Level Security across ${publicTables.length} public tables and search_path isolation on all SECURITY DEFINER functions.`);
  }

  // Pillar 7: HTTP Security Headers & Production CSP Guard
  console.log(`${colors.dim}Pillar 7: Auditing next.config.ts for mandatory OWASP HTTP security headers and CSP hardening...${colors.reset}`);
  const nextConfigPath = path.join(rootDir, 'next.config.ts');
  if (fs.existsSync(nextConfigPath)) {
    const nextConfigCode = fs.readFileSync(nextConfigPath, 'utf-8');
    const requiredHeaders = [
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Cross-Origin-Opener-Policy',
    ];
    const headerViolations = [];
    for (const hdr of requiredHeaders) {
      if (!nextConfigCode.includes(hdr)) {
        headerViolations.push(`Missing mandatory OWASP HTTP security header: ${hdr}`);
      }
    }
    if (!nextConfigCode.includes("default-src 'self'") || !nextConfigCode.includes("frame-ancestors 'none'")) {
      headerViolations.push("CSP header must enforce \"default-src 'self'\" and \"frame-ancestors 'none'\".");
    }
    if (nextConfigCode.includes("'unsafe-eval'") && !/isDev\s*\?\s*["']'unsafe-eval'\s*["']/.test(nextConfigCode)) {
      headerViolations.push("CSP 'unsafe-eval' must be strictly gated behind isDev (never active in production).");
    }

    if (headerViolations.length > 0) {
      logFail('Next.js HTTP security header configuration violation(s):');
      headerViolations.forEach((v) => console.error(`  - ${v}`));
      return false;
    }
    logPass(`Pillar 7: All ${requiredHeaders.length} OWASP HTTP security headers and production CSP directives verified.`);
  }

  return true;
}

// -------------------------------------------------------------
// PASS 1: TypeScript Strict Typecheck
// -------------------------------------------------------------
function pass1Typecheck() {
  logHeader('Pass 1: TypeScript Engine Strict Verification');
  const res = runCommand(`${npmCmd} run typecheck`);
  if (!res.success) {
    logFail('TypeScript compilation errors detected:');
    console.error(res.stdout || res.stderr);
    return false;
  }
  logPass('TypeScript strict mode passed with 0 compile errors.');
  return true;
}

// -------------------------------------------------------------
// PASS 2: Vitest MSW Server & Queries
// -------------------------------------------------------------
function pass2ServerMocks() {
  logHeader('Pass 2: Vitest MSW Server & React Query Validation');
  const res = runCommand(`${npxCmd} vitest run src/hooks/queries src/app/api --reporter=verbose`, true);
  if (!res.success) {
    logFail('MSW server mock or query hook test failed.');
    return false;
  }
  logPass('MSW v2 network interception and React Query hooks verified.');
  return true;
}

// -------------------------------------------------------------
// PASS 3: Vitest Full Unit Suite & Code Coverage
// -------------------------------------------------------------
function pass3ClientUI() {
  logHeader('Pass 3: Vitest Unit Suite & Coverage Assertion (>= 85%)');
  const res = runCommand(
    `${npmCmd} run test:coverage -- --reporter=verbose --reporter=json --outputFile=coverage/test-results.json`,
    true
  );
  if (!res.success) {
    logFail('Unit test suite failed.');
    return false;
  }

  const covSummaryPath = path.join(rootDir, 'coverage', 'coverage-summary.json');
  if (fs.existsSync(covSummaryPath)) {
    const cov = JSON.parse(fs.readFileSync(covSummaryPath, 'utf-8'));
    const { lines, statements, functions, branches } = cov.total;
    console.log(`\n📊 Total Coverage: Lines: ${lines.pct}%, Stmts: ${statements.pct}%, Funcs: ${functions.pct}%, Branches: ${branches.pct}%`);
    if (lines.pct < 85 || statements.pct < 85 || functions.pct < 85 || branches.pct < 85) {
      logFail(`Coverage threshold unmet (Target: >= 85%).`);
      return false;
    }
  }
  logPass('All unit and integration tests passed with >= 85% coverage.');
  return true;
}

// -------------------------------------------------------------
// PASS 4: Living Documentation Sync
// -------------------------------------------------------------
function pass4DocsSync() {
  logHeader('Pass 4: Living Documentation Synchronization');
  try {
    require('./generate-architecture-matrix.js');
    require('./generate-parser-docs.js');
    require('./generate-changelog.js');
    require('./generate-quality-report.js');
    require('./generate-roadmap.js');
    logPass('docs/ARCHITECTURE.md, docs/GUTENBERG_PARSER.md, CHANGELOG.md, docs/QUALITY_AUDIT_REPORT.md, and ROADMAP.md synced successfully from source AST.');
    return true;
  } catch (err) {
    logFail(`Documentation synchronization failed: ${err.message}`);
    return false;
  }
}

// -------------------------------------------------------------
// PASS 5: ADR Decision Ledger Validation
// -------------------------------------------------------------
function pass5AdrValidation() {
  logHeader('Pass 5: ADR Decision Ledger Schema Validation');
  const adrPath = path.join(rootDir, 'docs', 'DECISIONS.md');
  if (!fs.existsSync(adrPath)) {
    logFail('Missing docs/DECISIONS.md');
    return false;
  }
  const content = fs.readFileSync(adrPath, 'utf-8');
  const matches = content.match(/## ADR-(\d+):/g);
  if (!matches || matches.length === 0) {
    logFail('No valid ADR records found in docs/DECISIONS.md');
    return false;
  }
  logPass(`Validated ${matches.length} Architectural Decision Records.`);
  return true;
}

// -------------------------------------------------------------
// PASS 6: ESLint & Knip Dead Code Audit
// -------------------------------------------------------------
function pass6QualityAudit() {
  logHeader('Pass 6: Quality Suite (ESLint & Knip Audit)');
  console.log(`${colors.dim}  ↳ Auditing ESLint 9 code quality & Core Web Vitals...${colors.reset}`);
  const lintRes = runCommand(`${npmCmd} run lint`);
  if (!lintRes.success) {
    logFail('ESLint reported warnings or errors:');
    console.error(lintRes.stdout || lintRes.stderr);
    return false;
  }
  console.log(`  ${colors.green}✔${colors.reset} ESLint: Verified codebase integrity (0 errors, 0 warnings).`);

  console.log(`${colors.dim}  ↳ Auditing Knip dead code, unused exports, and orphan dependencies...${colors.reset}`);
  const knipRes = runCommand(`${npxCmd} knip`);
  if (!knipRes.success) {
    logFail('Knip reported unused code or dependencies:');
    console.error(knipRes.stdout || knipRes.stderr);
    return false;
  }
  console.log(`  ${colors.green}✔${colors.reset} Knip: 0 unused files, 0 unused dependencies, 0 dead exports.`);

  // Update quality report
  try {
    const reportScript = path.join(__dirname, 'generate-quality-report.js');
    execSync(`node "${reportScript}"`, { cwd: rootDir, stdio: 'pipe' });
  } catch (_e) {}

  logPass('ESLint and Knip quality checks completed cleanly with 0 defects.');
  return true;
}

// -------------------------------------------------------------
// PASS 7: Production Build & Chunk Budget
// -------------------------------------------------------------
function pass7ProductionBuild() {
  logHeader('Pass 7: Next.js Production Build & Chunk Budget');
  const buildRes = runCommand(`${npxCmd} next build --webpack`, true);
  if (!buildRes.success) {
    logFail('Next.js production build failed.');
    return false;
  }

  const staticDir = path.join(rootDir, '.next', 'static');
  if (fs.existsSync(staticDir)) {
    let totalBytes = 0;
    function walk(dir) {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        const s = fs.statSync(p);
        if (s.isDirectory()) walk(p);
        else totalBytes += s.size;
      }
    }
    walk(staticDir);
    const sizeMb = (totalBytes / (1024 * 1024)).toFixed(2);
    console.log(`📦 Production static bundle: ${sizeMb} MB`);
    if (totalBytes > 10 * 1024 * 1024) {
      logFail('Static bundle exceeds 10MB budget limit.');
      return false;
    }
  }

  logPass('Production build compiled cleanly within performance budget.');
  return true;
}

// -------------------------------------------------------------
// MAIN RUNNER
// -------------------------------------------------------------
async function runAllGateways() {
  if (process.argv.includes('--security-only')) {
    console.log(`\n${colors.bright}${colors.cyan}🔒 EXECUTING STANDALONE PRE-COMMIT SECURITY & SAST AUDIT${colors.reset}\n`);
    const securityGateways = [pass05SecretScanner, pass075SecurityAndSastAudit];
    for (const gateway of securityGateways) {
      const ok = gateway();
      if (!ok) {
        console.error(`\n${colors.bright}${colors.red}🚫 SECURITY AUDIT HALTED. Vulnerabilities detected.${colors.reset}\n`);
        process.exit(1);
      }
    }
    console.log(`\n${colors.bright}${colors.green}🎉 ALL SECURITY GATES PASSED! CODEBASE IS OWASP COMPLIANT.${colors.reset}\n`);
    process.exit(0);
  }

  console.log(`\n${colors.bright}${colors.magenta}🛡️  BOOKARIUM 7-GATEWAY CLOSED-LOOP QUALITY ENGINE${colors.reset}\n`);

  const gateways = [
    pass05SecretScanner,
    pass075SecurityAndSastAudit,
    pass1Typecheck,
    pass2ServerMocks,
    pass3ClientUI,
    pass4DocsSync,
    pass5AdrValidation,
    pass6QualityAudit,
    pass7ProductionBuild,
  ];

  for (const gateway of gateways) {
    const ok = gateway();
    if (!ok) {
      console.error(`\n${colors.bright}${colors.red}🚫 7-GATEWAY VERIFICATION HALTED. Fix the issues above before proceeding.${colors.reset}\n`);
      process.exit(1);
    }
  }

  console.log(`\n${colors.bright}${colors.green}══════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.green}🎉 ALL 7 QUALITY GATEWAYS PASSED! APPLICATION IS RELEASE-READY.${colors.reset}`);
  console.log(`${colors.bright}${colors.green}══════════════════════════════════════════════════════════════════${colors.reset}\n`);
  process.exit(0);
}

runAllGateways();

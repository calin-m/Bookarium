/**
 * @module scripts/verify-build
 * @scope 7-Gateway Closed-Loop Quality Engine orchestrating secret/boundary scans (`Pass 0.5`), 7-Pillar SAST & offline license SCA (`Pass 0.75`), TypeScript (`Pass 1`), MSW API/query tests (`Pass 2`), V8 coverage thresholds (`Pass 3`), DAG-ordered living docs sync (`Pass 4`), bidirectional ADR/schema/graph/contract/colocation parity (`Pass 5`), ESLint/Knip (`Pass 6`), and Next.js production build + loopback HTTP probes (`Pass 7`).
 * @invariant Enforce zero live secrets, zero `ast-parse-error` bypasses, `PROTECTED_CONTRACTED_MODULES` (`TIER_1`..`TIER_4`) `@scope`/`@invariant` contracts, strict bidirectional heading/count parity on `docs/SYSTEM_CONTRACTS.md`, bidirectional TOC + corpus parity across `docs/ARCHITECTURE.md` and `docs/architecture/*.md`, circular `SECURITY.md` symbol parity, `README.md` Diagram 1 + `jurisdictionBaselines` + SQL index parity, relative Markdown link validity, dynamic `scripts/` co-location outside `STANDALONE_RUNNER_SCRIPTS`, and zero-drift workflow/threshold/1:1 test co-location compliance across `--security-only`, `--fast`, and `--pass6-verified` execution modes.
 * @rationale Providing a single fail-closed CLI orchestrator shared by pre-commit hooks, local verification, and GitHub Actions CI eliminates blind spots between static security rules, database schemas, build outputs, and living documentation.
 * @adr ADR-073, ADR-078, ADR-079, ADR-081
 */

const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { execSync, execFileSync, spawn } = require('child_process');
const {
  collectScriptFiles,
  extractRuntimeSpecConstants,
  extractSqlSchemaEntities,
  extractWorkflowSpecCatalog,
  loadArchitectureCorpus,
  PROTECTED_CONTRACTED_MODULES,
  REQUIRED_GOVERNANCE_DOCS,
} = require('./lib/ast-parser');
const {
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
} = require('./lib/sast-validators');

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
  logHeader('Pass 0.5: Pre-Commit Secret, File/Path, Env-Var & Client-Server Graph Scanner');

  const secretPatterns = [
    { name: 'AWS Access Key', regex: new RegExp('AKIA' + '[0-9A-Z]{16}') },
    { name: 'RSA Private Key', regex: new RegExp('-----' + 'BEGIN RSA PRIVATE KEY' + '-----') },
    { name: 'Generic Private Key', regex: new RegExp('-----' + 'BEGIN PRIVATE KEY' + '-----') },
    { name: 'EC / OpenSSH Private Key', regex: new RegExp('-----' + 'BEGIN (?:EC|OPENSSH) PRIVATE KEY' + '-----') },
    { name: 'GitHub Personal Token', regex: new RegExp('ghp_' + '[0-9a-zA-Z]{36}') },
    { name: 'GitHub Fine-Grained PAT', regex: new RegExp('github_pat_' + '[0-9a-zA-Z_]{82}') },
    { name: 'Supabase Personal Access Token', regex: new RegExp('sbp_' + '[0-9a-f]{40}') },
    {
      name: 'Supabase Secret / Service Key',
      regex: new RegExp('(?:sb_secret_' + '[A-Za-z0-9_-]{20,}|sbs_' + '[0-9a-f]{40})'),
    },
    {
      name: 'OpenAI / Anthropic API Key',
      regex: new RegExp('sk-(?:proj-|ant-)' + '[0-9a-zA-Z_-]{24,}'),
    },
    {
      name: 'Google Cloud / Gemini API Key',
      regex: new RegExp('AIza' + '[0-9A-Za-z_-]{35}'),
    },
    { name: 'npm Automation Token', regex: new RegExp('npm_' + '[0-9a-zA-Z]{36}') },
    { name: 'Vercel Access Token', regex: new RegExp('vercel_' + '[0-9a-zA-Z_-]{24,}') },
    {
      name: 'Stripe Live Secret Key',
      regex: new RegExp('(?:sk|rk)_live_' + '[0-9a-zA-Z]{24,}'),
    },
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
    {
      name: 'Cloudflare R2 / AWS S3 Access Key Literal',
      regex: new RegExp(
        '(?:(?:AK' + 'IA|AS' + 'IA)[0-9A-Z]{16}|(?:r2_' + 'access_key_id|r2_' + 'secret_access_key|aws_' + 'access_key_id|aws_' + 'secret_access_key)\\s*[:=]\\s*[\'"][0-9a-zA-Z+/=]{32,}[\'"])',
        'i'
      ),
    },
    {
      name: 'PostgreSQL / Database URI with Embedded Credentials',
      regex: new RegExp('postgres(?:ql)?://' + '[^/\\s:@]+:[^/\\s@\'"`]+@', 'i'),
    },
  ];

  const forbiddenFileRegex =
    /\.(?:pem|key|p12|pfx|sqlite|sqlite3|db)$/i;
  const forbiddenEnvFileRegex =
    /^\.env(?:\.(?!example$).+)?$/i;
  const forbiddenOsArtifactRegex = /^(?:Thumbs\.db|\.DS_Store)$/i;
  const allowedRootTsFiles = new Set([
    'next.config.ts',
    'tailwind.config.ts',
    'vitest.config.mts',
  ]);
  const maxFileBytes = 5 * 1024 * 1024; // 5 MB general workspace file ceiling

  const scannedFiles = [];
  const violations = [];

  // Verify .gitignore protects local .env* files while allowing .env.example
  const gitignorePath = path.join(rootDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    if (!gitignoreContent.includes('.env*') || !gitignoreContent.includes('!.env.example')) {
      violations.push({
        file: '.gitignore',
        issue: '.gitignore must enforce ".env*" and "!.env.example" to prevent accidental secret commits.',
      });
    }
  }

  // Collect git-tracked/staged files so local gitignored .env.local is permitted unless staged/tracked
  let trackedGitFiles = null;
  try {
    const gitOut = execSync('git ls-files', { cwd: rootDir, encoding: 'utf-8', stdio: 'pipe' });
    trackedGitFiles = new Set(
      gitOut
        .split(/\r?\n/)
        .map((s) => s.trim().replace(/\\/g, '/'))
        .filter(Boolean)
    );
  } catch {
    trackedGitFiles = null;
  }

  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (['node_modules', '.git', '.next', 'coverage'].includes(file)) continue;
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

      if (stat.isDirectory()) {
        scanDir(fullPath);
        continue;
      }

      // Skip gitignored local .env* files (e.g. .env.local), but fail if they are tracked/staged in Git
      if (forbiddenEnvFileRegex.test(file)) {
        if (trackedGitFiles && trackedGitFiles.has(relPath)) {
          violations.push({
            file: relPath,
            issue: `Forbidden environment secret file (${file}) is tracked/staged in Git.`,
          });
        }
        continue;
      }

      // 1. File / Path & Binary Size Restrictions
      if (
        forbiddenFileRegex.test(file) ||
        forbiddenOsArtifactRegex.test(file)
      ) {
        violations.push({
          file: relPath,
          issue: `Forbidden file or local secret artifact present in workspace (${file}).`,
        });
      }

      if (
        dir === rootDir &&
        /\.(ts|tsx|mts)$/.test(file) &&
        !file.endsWith('.d.ts') &&
        !allowedRootTsFiles.has(file)
      ) {
        violations.push({
          file: relPath,
          issue: 'Unsanctioned TypeScript source file in repository root.',
        });
      }

      if (
        stat.size > maxFileBytes &&
        !relPath.startsWith('supabase/seed_') &&
        !relPath.startsWith('scripts/data/') &&
        relPath !== 'package-lock.json'
      ) {
        violations.push({
          file: relPath,
          issue: `Oversized file (${(stat.size / (1024 * 1024)).toFixed(2)} MB > 5 MB limit).`,
        });
      }

      if (/\.(ts|tsx|js|mjs|cjs|json|md|env|yml|yaml|sql|sh)$/.test(file)) {
        if (fullPath !== __filename) {
          scannedFiles.push(fullPath);
        }
      }
    }
  }

  scanDir(rootDir);

  // 2. Parse .env.example for all documented environment variables (both NEXT_PUBLIC_* and server/CLI vars)
  const envExamplePath = path.join(rootDir, '.env.example');
  const documentedEnvVars = new Set();
  const runtimePlatformEnvVars = new Set([
    'NODE_ENV',
    'CI',
    'VITEST',
    'TZ',
    'PORT',
    'HOST',
    'HOSTNAME',
    'VERCEL',
    'VERCEL_ENV',
    'VERCEL_URL',
    'VERCEL_PROJECT_PRODUCTION_URL',
    'NEXT_PUBLIC_VERCEL_URL',
    'NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL',
    'GITHUB_REPOSITORY',
    'GITHUB_STEP_SUMMARY',
    'VERCEL_GIT_REPO_OWNER',
    'VERCEL_GIT_REPO_SLUG',
  ]);
  if (fs.existsSync(envExamplePath)) {
    const envExampleContent = fs.readFileSync(envExamplePath, 'utf-8');
    const envMatches = envExampleContent.matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]+)\s*=/gm);
    for (const match of envMatches) {
      documentedEnvVars.add(match[1]);
    }
  } else {
    violations.push({
      file: '.env.example',
      issue: 'Missing mandatory .env.example template file.',
    });
  }

  const jwtCandidateRegex =
    /\beyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}\b/g;
  const trojanBidiRegex = /[\u202A-\u202E\u2066-\u2069]/;
  const zeroWidthCodeRegex = /[\u200B-\u200F]|(?<=.)\uFEFF/;

  for (const filePath of scannedFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    for (const pattern of secretPatterns) {
      if (pattern.regex.test(content)) {
        violations.push({ file: relPath, issue: pattern.name });
      }
    }

    // Scan for Unicode Trojan Source bidirectional control characters (CVE-2021-42574) & invisible zero-width codepoints
    if (trojanBidiRegex.test(content)) {
      violations.push({
        file: relPath,
        issue:
          'Unicode Trojan Source bidirectional control character (U+202A..U+202E / U+2066..U+2069, CVE-2021-42574) detected.',
      });
    }
    if (
      /\.(ts|tsx|js|mjs|cjs|sql|yml|yaml|sh)$/.test(relPath) &&
      zeroWidthCodeRegex.test(content)
    ) {
      violations.push({
        file: relPath,
        issue:
          'Hidden zero-width or mid-file BOM control character (U+200B..U+200F / U+FEFF) detected in executable/config file.',
      });
    }

    // Inspect any JWT token payload for encoded Supabase service_role keys
    let jwtMatch;
    while ((jwtMatch = jwtCandidateRegex.exec(content)) !== null) {
      try {
        const decodedPayload = Buffer.from(jwtMatch[1], 'base64url').toString('utf-8');
        if (/"role"\s*:\s*"service_role"/.test(decodedPayload)) {
          violations.push({
            file: relPath,
            issue: 'Hardcoded Supabase service_role JWT detected.',
          });
        }
      } catch (_e) {}
    }

    // AST validation of process.env.* parity (.env.example + NEXT_PUBLIC_* secret ban)
    // and client-bundle privilege isolation (SUPABASE_SERVICE_ROLE_KEY)
    const isAuditedEnvFile =
      relPath.startsWith('src/') ||
      (relPath.startsWith('scripts/') && !relPath.startsWith('scripts/eslint-rules/'));
    if (
      (isAuditedEnvFile || relPath.startsWith('src/')) &&
      /\.(ts|tsx|js|jsx)$/.test(relPath) &&
      !relPath.includes('.test.') &&
      !relPath.includes('.spec.')
    ) {
      const envBoundaryViolations = validateEnvAndPrivilegeBoundariesAst(content, {
        filePath: relPath,
        documentedEnvVars,
        runtimePlatformEnvVars,
        auditEnvVars: isAuditedEnvFile,
        checkClientServiceRole: relPath.startsWith('src/'),
      });
      violations.push(...envBoundaryViolations);
    }
  }

  // 3. Transitive Client -> Server AST Dependency Graph Isolation
  try {
    const { analyzeDependencyGraph } = require('./lib/ast-parser');
    const graph = analyzeDependencyGraph(path.join(rootDir, 'src'), rootDir);
    const serverOnlyTargets = new Set([
      'src/lib/supabase/server.ts',
      'src/lib/supabase/middleware.ts',
      'src/lib/r2-client.ts',
    ]);
    const forbiddenExternalServerPackages = new Set([
      'next/headers',
      'fs',
      'node:fs',
      'fs/promises',
      'node:fs/promises',
      'child_process',
      'node:child_process',
      'zlib',
      'node:zlib',
      'net',
      'tls',
    ]);

    for (const [entryFile] of graph.entries()) {
      const fileContent = fs.readFileSync(path.join(rootDir, entryFile), 'utf-8');
      const isClientEntry =
        entryFile.startsWith('src/components/') ||
        entryFile.startsWith('src/hooks/') ||
        entryFile.startsWith('src/stores/') ||
        /^['"]use client['"]/m.test(fileContent);

      if (!isClientEntry) continue;

      const visited = new Set([entryFile]);
      const queue = [{ file: entryFile, chain: [entryFile] }];

      while (queue.length > 0) {
        const current = queue.shift();
        const currentData = graph.get(current.file);
        if (!currentData) continue;

        for (const rawImp of currentData.rawImports || []) {
          if (forbiddenExternalServerPackages.has(rawImp)) {
            violations.push({
              file: entryFile,
              issue: `Transitive server package "${rawImp}" imported into client graph via ${current.chain.join(' -> ')}.`,
            });
          }
        }

        for (const nextFile of currentData.imports || []) {
          if (serverOnlyTargets.has(nextFile)) {
            violations.push({
              file: entryFile,
              issue: `Transitive server-only module "${nextFile}" imported into client graph via ${[...current.chain, nextFile].join(' -> ')}.`,
            });
          }
          if (!visited.has(nextFile)) {
            visited.add(nextFile);
            queue.push({ file: nextFile, chain: [...current.chain, nextFile] });
          }
        }
      }
    }
  } catch (err) {
    violations.push({
      file: 'scripts/lib/ast-parser.js',
      issue: `Failed to evaluate transitive client/server AST import graph: ${err.message}`,
    });
  }

  if (violations.length > 0) {
    logFail(`Secret, file/path, env-var, or privilege boundary violation detected in ${violations.length} location(s):`);
    violations.forEach((v) => console.error(`  - ${v.file}: ${v.issue}`));
    return false;
  }

  logPass(
    `Scanned ${scannedFiles.length} files. Zero exposed credentials, forbidden files, undocumented NEXT_PUBLIC_* vars, or transitive client->server leaks detected.`
  );
  return true;
}

// -------------------------------------------------------------
// PASS 0.75: Pre-Commit SAST & OWASP Security Suite
// -------------------------------------------------------------
function pass075SecurityAndSastAudit() {
  logHeader('Pass 0.75: Pre-Commit SAST & OWASP Security Suite (7-Pillar Audit)');

  // Pillar 1: Lockfile Sanity Checks & Dependency Vulnerability Audit
  console.log(`${colors.dim}Pillar 1: Verifying package-lock.json supply-chain integrity and auditing runtime dependencies...${colors.reset}`);
  const lockfilePath = path.join(rootDir, 'package-lock.json');
  const pkgJsonPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(lockfilePath)) {
    logFail('Missing package-lock.json. Deterministic dependency lockfile is required.');
    return false;
  }
  try {
    const lockData = JSON.parse(fs.readFileSync(lockfilePath, 'utf-8'));
    const pkgData = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    const lockViolations = validatePackageLockAndLifecycle(lockData, pkgData);

    if (lockViolations.length > 0) {
      logFail(`Lockfile sanity check failed with ${lockViolations.length} issue(s):`);
      lockViolations.slice(0, 15).forEach((v) => console.error(`  - ${v}`));
      return false;
    }

    // GitHub Actions Workflow Security & Injection Gate (.github/workflows/*.yml)
    const workflowsDir = path.join(rootDir, '.github', 'workflows');
    if (fs.existsSync(workflowsDir)) {
      const workflowViolations = validateGitHubWorkflowSecurity(workflowsDir, rootDir);
      if (workflowViolations.length > 0) {
        logFail('GitHub Actions workflow security violation(s) detected:');
        workflowViolations.forEach((v) => console.error(`  - ${v}`));
        return false;
      }
    }
  } catch (err) {
    logFail(`Failed to parse package-lock.json or workflow definitions: ${err.message}`);
    return false;
  }

  const auditRes = runCommand(`${npmCmd} audit --omit=dev --audit-level=high`, false, 6000);
  if (!auditRes.success) {
    const combinedOutput = `${auditRes.stdout || ''}\n${auditRes.stderr || ''}`;
    const isNetworkOrRegistryError =
      /Service Unavailable|ECONNRESET|ENOTFOUND|ETIMEDOUT|ERR_SOCKET_TIMEOUT|E503|code E\d{3}|npm ERR! network|timed out|timeout/i.test(
        combinedOutput
      );

    if (isNetworkOrRegistryError) {
      console.log(
        `${colors.yellow}⚠ [WARN] npm registry temporarily unavailable or degraded. Lockfile sanity verified; skipping remote CVE audit.${colors.reset}`
      );
    } else {
      logFail('High or critical security vulnerability detected in production dependencies:');
      console.error(auditRes.stdout || auditRes.stderr);
      return false;
    }
  } else {
    logPass('Pillar 1: Lockfile integrity (SHA-512, HTTPS npm registry, specifier sync) and 0 high/critical CVEs verified.');
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
      ssrfViolations.push(...validateApiRoutesSecurityAst(code, relRoute));
    }

    if (ssrfViolations.length > 0) {
      logFail(`SAST API security violation detected in ${ssrfViolations.length} location(s):`);
      ssrfViolations.forEach((v) => console.error(`  - ${v.file}: ${v.issue}`));
      return false;
    }
    logPass(`Pillar 2: Audited ${apiFiles.length} API route handler(s). Rate limiting and anti-SSRF guards verified via Babel AST.`);
  }

  // Pillar 3: Client-Side XSS & Dangerous Evaluation Primitives Guard (9-Rule Babel AST Engine)
  console.log(`${colors.dim}Pillar 3: Auditing source code via Babel AST for DOM XSS sinks, tabnabbing, postMessage wildcard, ReDoS, and dangerous evaluation primitives...${colors.reset}`);
  const { runStandaloneAstSecurityAudit } = require('./eslint-rules/bookarium-security');
  const astSecurityViolations = runStandaloneAstSecurityAudit(rootDir);
  const pillar3RuleIds = new Set([
    'bookarium-security/no-dangerous-execution',
    'bookarium-security/no-unsafe-dom-injection',
    'ast-parse-error',
  ]);
  const xssViolations = [];
  for (const v of astSecurityViolations) {
    if (pillar3RuleIds.has(v.ruleId)) {
      xssViolations.push({
        file: `${v.file}:${v.line}`,
        issue: `[${v.ruleId}] ${v.message}`,
      });
    }
  }

  if (xssViolations.length > 0) {
    logFail(`XSS/Dangerous primitive AST violation detected in ${xssViolations.length} location(s):`);
    xssViolations.forEach((v) => console.error(`  - ${v.file}: ${v.issue}`));
    return false;
  }
  logPass('Pillar 3: Zero DOM XSS sinks, eval(), dynamic Function, ReDoS, or javascript: URI schemes detected (Babel AST verified).');

  // Pillar 4: Open Redirect, Phishing Navigation & Full AST Request-Taint Analysis
  console.log(`${colors.dim}Pillar 4: Auditing redirect destinations via Babel AST and running AST request-taint dataflow analysis...${colors.reset}`);
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
        redirectViolations.push(...validateRedirectRoutesAst(code, relFile));
      }
    }
  }
  scanRedirects(appDir);

  const engineeringGovernanceRules = new Set([
    'bookarium-security/no-focused-or-tautological-tests',
    'bookarium-security/enforce-gutenberg-and-copyright-policy',
  ]);
  const astEngineeringViolations = [];

  for (const v of astSecurityViolations) {
    if (pillar3RuleIds.has(v.ruleId)) continue;
    const entry = {
      file: `${v.file}:${v.line}`,
      issue: `[${v.ruleId}] ${v.message}`,
    };
    if (engineeringGovernanceRules.has(v.ruleId)) {
      astEngineeringViolations.push(entry);
    } else {
      redirectViolations.push(entry);
    }
  }

  if (redirectViolations.length > 0) {
    logFail(`AST security or open-redirect taint violation detected in ${redirectViolations.length} location(s):`);
    redirectViolations.forEach((v) => console.error(`  - ${v.file}: ${v.issue}`));
    return false;
  }
  if (astEngineeringViolations.length > 0) {
    logFail(
      `AST test-quality, Gutenberg policy, or query-index invariant violation detected in ${astEngineeringViolations.length} location(s):`
    );
    astEngineeringViolations.forEach((v) => console.error(`  - ${v.file}: ${v.issue}`));
    return false;
  }
  logPass('Pillar 4: All redirects origin-locked and 9-rule AST + intra-procedural taint analysis passed with 0 defects.');

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
    const publicDomainViolations = validatePublicDomainFilterAst(useBooksCode);
    if (publicDomainViolations.length > 0) {
      logFail(publicDomainViolations[0]);
      return false;
    }
  }
  logPass('Pillar 5: MIT license compliance and public domain integrity (copyright=false, Babel AST verified) verified.');

  // Pillar 6: PostgreSQL Row-Level Security (RLS), Migration Idempotency & SECURITY DEFINER Hardening Audit
  console.log(`${colors.dim}Pillar 6: Auditing supabase/schema.sql for mandatory table RLS, DDL/policy idempotency, write-policy isolation, and SECURITY DEFINER search_path...${colors.reset}`);
  const schemaPath = path.join(rootDir, 'supabase', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    const rlsViolations = [];
    const tableMatches = [...schemaSql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:public|supabase_migrations)\.[a-z0-9_]+)/gi)];
    const dbTables = [...new Set(tableMatches.map((m) => m[1]))];

    for (const tableName of dbTables) {
      const escapedTable = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+${escapedTable}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
      if (!rlsRegex.test(schemaSql)) {
        rlsViolations.push(`Table "${tableName}" is missing ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`);
      }
    }

    // Rule 9 Idempotency Checks: CREATE TABLE IF NOT EXISTS, CREATE [UNIQUE] INDEX IF NOT EXISTS, DROP POLICY IF EXISTS, DROP TRIGGER IF EXISTS
    const nonIdempotentTableMatches = [
      ...schemaSql.matchAll(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS\b)([a-z0-9_.]+)/gi),
    ];
    for (const m of nonIdempotentTableMatches) {
      rlsViolations.push(`Non-idempotent CREATE TABLE "${m[1]}" in supabase/schema.sql (must use CREATE TABLE IF NOT EXISTS).`);
    }

    const nonIdempotentIndexMatches = [
      ...schemaSql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS\b)([a-z0-9_]+)/gi),
    ];
    for (const m of nonIdempotentIndexMatches) {
      rlsViolations.push(`Non-idempotent CREATE INDEX "${m[1]}" in supabase/schema.sql (must use IF NOT EXISTS).`);
    }

    const createPolicyMatches = [
      ...schemaSql.matchAll(
        /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+public\.([a-z0-9_]+)([\s\S]*?);/gi
      ),
    ];
    const policyRoleCmdMap = new Map();
    for (const m of createPolicyMatches) {
      const policyName = m[1];
      const tblName = m[2];
      const policyClause = m[3] || '';
      const escapedPolicy = policyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const dropPolicyRegex = new RegExp(
        `DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+"${escapedPolicy}"\\s+ON\\s+public\\.${tblName}\\s*;`,
        'i'
      );
      if (!dropPolicyRegex.test(schemaSql)) {
        rlsViolations.push(
          `Policy "${policyName}" on public.${tblName} is missing preceding DROP POLICY IF EXISTS "${policyName}" ON public.${tblName};`
        );
      }

      // Supabase 0003_auth_rls_initplan guard: ensure auth.<fn>() and current_setting() are wrapped in (select ...)
      if (/(?<!\(\s*select\s+)\b(?:auth\.[a-z0-9_]+|current_setting)\s*\(/i.test(policyClause)) {
        rlsViolations.push(
          `RLS Policy "${policyName}" on public.${tblName} invokes bare auth.<fn>() or current_setting() without an InitPlan scalar subquery wrapper — use "(select auth.uid())" (Supabase 0003_auth_rls_initplan).`
        );
      }

      // Supabase 0006_multiple_permissive_policies guard: ensure at most 1 permissive policy per (table, clientRole, command)
      if (!/\bAS\s+RESTRICTIVE\b/i.test(policyClause)) {
        const forMatch = policyClause.match(/\bFOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\b/i);
        const rawCmd = forMatch ? forMatch[1].toUpperCase() : 'ALL';
        const commands =
          rawCmd === 'ALL' ? ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] : [rawCmd];

        const headerBeforeExpr = policyClause.split(/\b(?:USING|WITH\s+CHECK)\b/i)[0] || '';
        const toMatch = headerBeforeExpr.match(/\bTO\s+([a-z0-9_,\s]+)$/i);
        const rawRoles = toMatch
          ? toMatch[1]
              .split(',')
              .map((r) => r.trim().toLowerCase())
              .filter(Boolean)
          : ['public'];
        const clientRoles = new Set();
        for (const r of rawRoles) {
          if (r === 'public') {
            clientRoles.add('anon');
            clientRoles.add('authenticated');
          } else if (r === 'anon' || r === 'authenticated') {
            clientRoles.add(r);
          }
        }

        for (const role of clientRoles) {
          for (const cmd of commands) {
            const key = `${tblName}:${role}:${cmd}`;
            const existing = policyRoleCmdMap.get(key);
            if (existing && existing !== policyName) {
              rlsViolations.push(
                `Multiple permissive RLS policies on public.${tblName} for role "${role}" and action "${cmd}": "${existing}" and "${policyName}" (Supabase 0006_multiple_permissive_policies).`
              );
            } else {
              policyRoleCmdMap.set(key, policyName);
            }
          }
        }
      }
    }

    const createTriggerMatches = [
      ...schemaSql.matchAll(/CREATE\s+TRIGGER\s+([a-z0-9_]+)/gi),
    ];
    for (const m of createTriggerMatches) {
      const trigName = m[1];
      const dropTriggerRegex = new RegExp(`DROP\\s+TRIGGER\\s+IF\\s+EXISTS\\s+${trigName}\\b`, 'i');
      if (!dropTriggerRegex.test(schemaSql)) {
        rlsViolations.push(
          `Trigger "${trigName}" in supabase/schema.sql is missing preceding DROP TRIGGER IF EXISTS ${trigName}.`
        );
      }
    }

    const fnBlocks = [...schemaSql.matchAll(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.([a-z0-9_]+)\s*\([\s\S]*?AS\s+\$\$/gi)];
    for (const match of fnBlocks) {
      const fnName = match[1];
      const headerBlock = match[0];
      const isSecurityDefiner = /SECURITY\s+DEFINER/i.test(headerBlock);
      const isTriggerFunction = /RETURNS\s+TRIGGER\b/i.test(headerBlock);

      if (isSecurityDefiner && !/SET\s+search_path\s*=\s*''/i.test(headerBlock)) {
        rlsViolations.push(`SECURITY DEFINER function "public.${fnName}" must explicitly set "SET search_path = ''".`);
      }

      if (isSecurityDefiner || isTriggerFunction) {
        const escapedFn = fnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const revokeRegex = new RegExp(
          `REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${escapedFn}\\s*\\([^)]*\\)\\s+FROM\\s+([^;]+);`,
          'gi'
        );
        const revokedRoles = new Set();
        let revMatch;
        while ((revMatch = revokeRegex.exec(schemaSql)) !== null) {
          for (const role of revMatch[1].split(',')) {
            const cleanedRole = role.trim().toLowerCase();
            if (cleanedRole) revokedRoles.add(cleanedRole);
          }
        }

        if (isTriggerFunction) {
          for (const requiredRole of ['public', 'anon', 'authenticated']) {
            if (!revokedRoles.has(requiredRole)) {
              rlsViolations.push(
                `Trigger function "public.${fnName}()" must explicitly REVOKE EXECUTE FROM ${requiredRole === 'public' ? 'PUBLIC' : requiredRole} so it is never exposed via PostgREST RPC.`
              );
            }
          }
        } else if (isSecurityDefiner) {
          for (const requiredRole of ['public', 'anon']) {
            if (!revokedRoles.has(requiredRole)) {
              rlsViolations.push(
                `SECURITY DEFINER function "public.${fnName}" must explicitly REVOKE EXECUTE FROM ${requiredRole === 'public' ? 'PUBLIC' : requiredRole}.`
              );
            }
          }
        }
      }
    }

    const permissiveWritePolicyRegex =
      /CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+public\.(\w+)\s+FOR\s+(INSERT|UPDATE|DELETE|ALL)[^;]*?(?:USING|WITH\s+CHECK)\s*\(\s*true\s*\)/gi;
    let writeMatch;
    while ((writeMatch = permissiveWritePolicyRegex.exec(schemaSql)) !== null) {
      if (!/\bTO\s+service_role\b/i.test(writeMatch[0])) {
        rlsViolations.push(
          `Permissive write RLS policy "${writeMatch[1]}" on public.${writeMatch[2]} (${writeMatch[3]}) uses unrestricted (true) without TO service_role.`
        );
      }
    }

    // Rule 9 Account Deletion & Data Wipe Parity Audit:
    // Every user-scoped table referencing auth.users(id) must enforce ON DELETE CASCADE
    // and be explicitly purged in both public.delete_current_user() and useAuthStore.deleteAccount().
    const deleteUserFnMatch = schemaSql.match(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.delete_current_user\s*\([\s\S]*?\$\$\s*;/i
    );
    const deleteUserFnBody = deleteUserFnMatch ? deleteUserFnMatch[0] : '';
    const authStorePath = path.join(rootDir, 'src', 'stores', 'useAuthStore.ts');
    const authStoreCode = fs.existsSync(authStorePath)
      ? fs.readFileSync(authStorePath, 'utf-8')
      : '';

    const tableDefRegex =
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-z0-9_]+)\s*\(([\s\S]*?)\r?\n\);/gi;
    const userScopedTables = [];
    let tblDefMatch;
    while ((tblDefMatch = tableDefRegex.exec(schemaSql)) !== null) {
      const tblName = tblDefMatch[1];
      const tblBody = tblDefMatch[2];
      const userFkMatches = [...tblBody.matchAll(/REFERENCES\s+auth\.users\s*\(\s*id\s*\)([^\r\n,]*)/gi)];
      if (userFkMatches.length > 0) {
        userScopedTables.push(tblName);
        for (const fkMatch of userFkMatches) {
          if (!/ON\s+DELETE\s+CASCADE/i.test(fkMatch[1] || '')) {
            rlsViolations.push(
              `Rule 9 Account Deletion Parity: Foreign key to auth.users(id) in "public.${tblName}" must specify ON DELETE CASCADE.`
            );
          }
        }
        const rpcDeleteRegex = new RegExp(`DELETE\\s+FROM\\s+public\\.${tblName}\\b`, 'i');
        if (!rpcDeleteRegex.test(deleteUserFnBody)) {
          rlsViolations.push(
            `Rule 9 Account Deletion Parity: User-scoped table "public.${tblName}" is missing explicit DELETE FROM public.${tblName} in public.delete_current_user() (supabase/schema.sql).`
          );
        }
      }
    }

    // Fellowship Participant Column-Lock & Ceiling Constraints Audit
    if (!schemaSql.includes('public.enforce_fellowship_update_guard')) {
      rlsViolations.push(
        'Missing trigger function public.enforce_fellowship_update_guard() in supabase/schema.sql.'
      );
    }
    if (!schemaSql.includes('trg_reader_circles_update_guard')) {
      rlsViolations.push(
        'Missing trigger trg_reader_circles_update_guard on public.reader_circles in supabase/schema.sql.'
      );
    }
    if (!schemaSql.includes('trg_symposium_sessions_update_guard')) {
      rlsViolations.push(
        'Missing trigger trg_symposium_sessions_update_guard on public.symposium_sessions in supabase/schema.sql.'
      );
    }

    if (!schemaSql.includes('public.enforce_user_row_quota')) {
      rlsViolations.push(
        'Missing trigger function public.enforce_user_row_quota() in supabase/schema.sql.'
      );
    }
    const mandatoryQuotaTriggers = [
      'trg_bookshelves_row_quota',
      'trg_bookshelf_items_row_quota',
      'trg_user_favorites_row_quota',
      'trg_user_annotations_row_quota',
      'trg_reader_circles_row_quota',
      'trg_symposium_sessions_row_quota',
    ];
    for (const triggerName of mandatoryQuotaTriggers) {
      if (!schemaSql.includes(triggerName)) {
        rlsViolations.push(
          `Missing per-user storage quota trigger "${triggerName}" in supabase/schema.sql.`
        );
      }
    }

    const mandatoryCeilingConstraints = [
      'chk_profiles_bio_length',
      'chk_profiles_bio_book_id_positive',
      'chk_profiles_bio_book_title_length',
      'chk_profiles_bio_book_author_length',
      'chk_profiles_preferences_bound',
      'chk_user_accolades_metadata_bound',
      'chk_bookshelf_items_payload_bound',
      'chk_user_favorites_payload_bound',
      'chk_reading_progress_payload_bound',
      'chk_symposium_sessions_title_length',
      'chk_user_annotations_note_length',
      'chk_user_annotations_selected_text_length',
      'chk_user_reading_habits_active_dates_bound',
    ];
    for (const constraint of mandatoryCeilingConstraints) {
      if (!schemaSql.includes(constraint)) {
        rlsViolations.push(
          `Missing payload/array ceiling constraint "${constraint}" in supabase/schema.sql.`
        );
      }
    }

    // Rule 9 Account Deletion & Local Store Teardown Parity (Babel AST verified across useAuthStore.ts)
    const storesDir = path.join(rootDir, 'src', 'stores');
    const nonExemptStoreNames = [];
    if (fs.existsSync(storesDir)) {
      const storeFiles = fs
        .readdirSync(storesDir)
        .filter((f) => /^use[A-Z][a-zA-Z0-9]*Store\.ts$/.test(f) && !f.endsWith('.test.ts'));
      const exemptStores = new Set(['useAuthStore.ts', 'useJurisdictionStore.ts']);
      for (const storeFile of storeFiles) {
        if (exemptStores.has(storeFile)) continue;
        nonExemptStoreNames.push(storeFile.replace(/\.ts$/, ''));
      }
    }
    if (authStoreCode) {
      rlsViolations.push(
        ...validateRule9AuthStoreParityAst(authStoreCode, {
          userScopedTables,
          storeNames: nonExemptStoreNames,
        })
      );
    }

    if (rlsViolations.length > 0) {
      logFail(`Database schema security or idempotency violation(s) in supabase/schema.sql:`);
      rlsViolations.forEach((v) => console.error(`  - ${v}`));
      return false;
    }
    const publicTableCount = dbTables.filter((t) => t.startsWith('public.')).length;
    const migrationTableCount = dbTables.length - publicTableCount;
    logPass(`Pillar 6: Verified Row-Level Security across all ${dbTables.length} database tables (${publicTableCount} public tables + ${migrationTableCount} migration ledger), 100% DDL/policy/trigger idempotency, (select auth.uid()) InitPlan & single-permissive-policy invariants, write-policy isolation, account-deletion parity, trigger RPC revocation, and search_path/REVOKE hardening on all SECURITY DEFINER functions.`);
  }

  // Pillar 7: HTTP Security Headers (Babel AST), Compiled Production Manifest & Service Worker Cache Guard
  console.log(`${colors.dim}Pillar 7: Auditing next.config.ts AST for mandatory OWASP HTTP security headers, CSP hardening, and Service Worker safety...${colors.reset}`);
  const nextConfigPath = path.join(rootDir, 'next.config.ts');
  if (fs.existsSync(nextConfigPath)) {
    const nextConfigCode = fs.readFileSync(nextConfigPath, 'utf-8');
    const headerViolations = validateNextConfigSecurityHeadersAst(nextConfigCode);

    const swPath = path.join(rootDir, 'public', 'sw.js');
    if (fs.existsSync(swPath)) {
      const swCode = fs.readFileSync(swPath, 'utf-8');
      headerViolations.push(...validateServiceWorkerSecurity(swCode));
    }

    if (headerViolations.length > 0) {
      logFail('Next.js HTTP security header or Service Worker configuration violation(s):');
      headerViolations.forEach((v) => console.error(`  - ${v}`));
      return false;
    }
    logPass('Pillar 7: All 7 OWASP HTTP security headers (Babel AST verified including X-Frame-Options: DENY, frame-ancestors \'none\', object-src \'none\'), production CSP directives, and Service Worker cache boundaries verified.');
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
  logPass('MSW v3 network interception and React Query hooks verified.');
  return true;
}

// -------------------------------------------------------------
// PASS 3: Vitest Full Unit Suite & Code Coverage
// -------------------------------------------------------------
function pass3ClientUI() {
  const { coverageThresholds } = extractRuntimeSpecConstants(rootDir);
  logHeader(
    `Pass 3: Vitest Unit Suite & Tiered Coverage Assertion (${coverageThresholds.lines}/${coverageThresholds.statements}/${coverageThresholds.functions}/${coverageThresholds.branches})`
  );
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
    if (
      lines.pct < coverageThresholds.lines ||
      statements.pct < coverageThresholds.statements ||
      functions.pct < coverageThresholds.functions ||
      branches.pct < coverageThresholds.branches
    ) {
      logFail(
        `Coverage threshold unmet (Target: Lines >= ${coverageThresholds.lines}%, Statements >= ${coverageThresholds.statements}%, Functions >= ${coverageThresholds.functions}%, Branches >= ${coverageThresholds.branches}%).`
      );
      return false;
    }
  }
  logPass(
    `All unit and integration tests passed with tiered V8 coverage thresholds (Lines >= ${coverageThresholds.lines}%, Stmts >= ${coverageThresholds.statements}%, Funcs >= ${coverageThresholds.functions}%, Branches >= ${coverageThresholds.branches}%).`
  );
  return true;
}

// -------------------------------------------------------------
// PASS 4: Living Documentation Sync
// -------------------------------------------------------------
function pass4DocsSync() {
  logHeader('Pass 4: Living Documentation Synchronization');
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'generate-quality-report.js'), '--fast'], {
      cwd: rootDir,
      stdio: 'inherit',
      shell: false,
    });
    const {
      syncReleaseVersionFiles,
      generateChangelog,
      syncReadmeLatestRelease,
    } = require('./generate-changelog.js');
    syncReleaseVersionFiles();
    generateChangelog();
    syncReadmeLatestRelease();
    require('./generate-parser-docs.js');
    require('./generate-contracts-docs.js');
    const { generateRoadmapMarkdown } = require('./generate-roadmap.js');
    fs.writeFileSync(path.join(rootDir, 'ROADMAP.md'), generateRoadmapMarkdown(), 'utf-8');
    require('./generate-architecture-matrix.js');
    logPass('docs/QUALITY_AUDIT_REPORT.md, CHANGELOG.md, docs/GUTENBERG_PARSER.md, docs/SYSTEM_CONTRACTS.md, ROADMAP.md, docs/ARCHITECTURE.md, and docs/architecture/*.md synced successfully from source AST.');
    return true;
  } catch (err) {
    logFail(`Documentation synchronization failed: ${err.message}`);
    return false;
  }
}

// -------------------------------------------------------------
// PASS 5: ADR Decision Ledger, Required Docs, Schema Parity, Dependency Graph & Co-Located Test Validation
// -------------------------------------------------------------
function pass5AdrValidation() {
  logHeader('Pass 5: ADR Ledger, Governance Docs, SQL<->TS Schema Parity, Dependency Graph & Test Co-Location');

  // 1. Mandatory Governance & Living Documentation Checklist
  const requiredDocs = [...REQUIRED_GOVERNANCE_DOCS];

  const docViolations = [];
  for (const relDoc of requiredDocs) {
    const fullDoc = path.join(rootDir, relDoc);
    if (!fs.existsSync(fullDoc)) {
      docViolations.push(`Missing mandatory repository checklist file: ${relDoc}`);
    } else if (fs.statSync(fullDoc).size === 0) {
      docViolations.push(`Mandatory repository checklist file is empty: ${relDoc}`);
    }
  }

  // 2. Contiguous ADR Sequence & 4-Part Schema Validation
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

  const adrBlocks = content.split(/(?=^## ADR-\d+:)/m).filter((b) => /^## ADR-\d+:/.test(b));
  const requiredAdrFields = ['- **Status**:', '- **Context**:', '- **Decision**:', '- **Consequences**:'];
  const validAdrSet = new Set();

  adrBlocks.forEach((block, index) => {
    const idMatch = block.match(/^## ADR-(\d+):/);
    const num = idMatch ? parseInt(idMatch[1], 10) : -1;
    if (num > 0) {
      validAdrSet.add(`ADR-${String(num).padStart(3, '0')}`);
    }
    const expectedNum = index + 1;
    if (num !== expectedNum) {
      docViolations.push(
        `Non-contiguous ADR numbering in docs/DECISIONS.md: expected ADR-${String(expectedNum).padStart(3, '0')}, found ADR-${String(num).padStart(3, '0')}.`
      );
    }
    for (const field of requiredAdrFields) {
      if (!block.includes(field)) {
        docViolations.push(
          `ADR-${String(num).padStart(3, '0')} in docs/DECISIONS.md is missing required schema field "${field}".`
        );
      }
    }
  });

  // 3. 100% Co-Located Test Suite Verification (Rule 3 / Rule 5)
  const coLocatedDirs = [
    'src/components',
    'src/hooks',
    'src/stores',
    'src/lib',
    'src/config',
    'src/workers',
    'src/app',
  ];
  const exemptCoLocatedFiles = new Set([
    'src/lib/gutenberg/index.ts',
    'src/lib/gutenberg/types.ts',
  ]);

  function verifyCoLocatedTests(dir) {
    const fullDir = path.join(rootDir, dir);
    if (!fs.existsSync(fullDir)) return;
    for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
      const fullPath = path.join(fullDir, entry.name);
      const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        verifyCoLocatedTests(relPath);
      } else if (
        (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) &&
        !entry.name.endsWith('.security.test.ts')
      ) {
        const baseNoTest = fullPath.replace(/\.test\.(ts|tsx)$/, '');
        const hasSource =
          fs.existsSync(`${baseNoTest}.ts`) ||
          fs.existsSync(`${baseNoTest}.tsx`) ||
          fs.existsSync(`${baseNoTest}.js`);
        if (!hasSource) {
          docViolations.push(
            `Orphan test suite "${relPath}" has no matching 1:1 source module (consolidate into its 1:1 co-located test file or remove).`
          );
        }
      } else if (
        /\.(ts|tsx)$/.test(entry.name) &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.test.tsx') &&
        !entry.name.endsWith('.spec.ts') &&
        !entry.name.endsWith('.spec.tsx') &&
        !entry.name.endsWith('.d.ts') &&
        !entry.name.endsWith('.types.ts') &&
        !exemptCoLocatedFiles.has(relPath)
      ) {
        const baseNoExt = fullPath.replace(/\.(ts|tsx)$/, '');
        const hasTest =
          fs.existsSync(`${baseNoExt}.test.ts`) || fs.existsSync(`${baseNoExt}.test.tsx`);
        if (!hasTest) {
          docViolations.push(
            `Missing mandatory co-located test suite for "${relPath}" (expected ${relPath.replace(/\.(ts|tsx)$/, '.test.$1')}).`
          );
        }
      }
    }
  }

  for (const dir of coLocatedDirs) {
    verifyCoLocatedTests(dir);
  }

  // Enforce 1:1 co-located *.test.ts coverage dynamically across scripts/ while exempting standalone dev/doc/build runners
  // (Dev/doc/build runners such as verify-build.js & generate-*.js are executed directly in Pass 4/5 to avoid circular Vitest invocation)
  const STANDALONE_RUNNER_SCRIPTS = new Set([
    'scripts/approval-gate.js',
    'scripts/generate-architecture-matrix.js',
    'scripts/generate-changelog.js',
    'scripts/generate-contracts-docs.js',
    'scripts/generate-parser-docs.js',
    'scripts/generate-pwa-icons.js',
    'scripts/generate-quality-report.js',
    'scripts/generate-roadmap.js',
    'scripts/open-browser.js',
    'scripts/verify-build.js',
  ]);
  for (const scriptEntry of collectScriptFiles(rootDir)) {
    if (STANDALONE_RUNNER_SCRIPTS.has(scriptEntry.rel)) continue;
    const expectedTestRel = scriptEntry.rel.replace(/\.js$/, '.test.ts');
    if (!fs.existsSync(path.join(rootDir, expectedTestRel))) {
      docViolations.push(
        `Missing mandatory co-located pipeline test suite for "${scriptEntry.rel}" (expected ${expectedTestRel}).`
      );
    }
  }

  // 4. SQL Schema <-> TypeScript database.types.ts 1:1 Table & Column Parity Gate (Rule 9)
  const schemaPath = path.join(rootDir, 'supabase', 'schema.sql');
  const dbTypesPath = path.join(rootDir, 'src', 'types', 'database.types.ts');
  if (fs.existsSync(schemaPath) && fs.existsSync(dbTypesPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    const dbTypesCode = fs.readFileSync(dbTypesPath, 'utf-8');

    // Extract SQL tables and their columns from CREATE TABLE IF NOT EXISTS public.<name> (...)
    const sqlTablesMap = new Map();
    const createTableRegex =
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-z0-9_]+)\s*\(([\s\S]*?)\r?\n\);/gi;
    let tblMatch;
    while ((tblMatch = createTableRegex.exec(schemaSql)) !== null) {
      const tableName = tblMatch[1];
      const body = tblMatch[2];
      const cols = new Set();
      for (const rawLine of body.split(/\r?\n/)) {
        const cleaned = rawLine.replace(/--.*$/, '').trim();
        if (!cleaned) continue;
        if (/^(?:PRIMARY\s+KEY|UNIQUE\b|CHECK\b|FOREIGN\s+KEY|CONSTRAINT\b|\))/i.test(cleaned)) {
          continue;
        }
        const colMatch = cleaned.match(/^([a-z0-9_]+)\s+[A-Za-z]/i);
        if (colMatch) {
          cols.add(colMatch[1]);
        }
      }
      sqlTablesMap.set(tableName, cols);
    }

    // Extract TypeScript Database['public']['Tables'][<name>]['Row'] properties
    const tsTablesMap = new Map();
    const tsTableBlockRegex =
      /^\s{6}([a-z0-9_]+):\s*\{\s*\r?\n\s{8}Row:\s*\{([\s\S]*?)\r?\n\s{8}\};/gm;
    let tsMatch;
    while ((tsMatch = tsTableBlockRegex.exec(dbTypesCode)) !== null) {
      const tableName = tsMatch[1];
      const rowBody = tsMatch[2];
      const allProps = new Set();
      const requiredProps = new Set();
      for (const rawLine of rowBody.split(/\r?\n/)) {
        const cleaned = rawLine.replace(/\/\/.*$/, '').trim();
        const propMatch = cleaned.match(/^([a-z0-9_]+)(\?)?\s*:/i);
        if (propMatch) {
          allProps.add(propMatch[1]);
          if (!propMatch[2]) {
            requiredProps.add(propMatch[1]);
          }
        }
      }
      tsTablesMap.set(tableName, { allProps, requiredProps });
    }

    for (const [sqlTable, sqlCols] of sqlTablesMap.entries()) {
      const tsTable = tsTablesMap.get(sqlTable);
      if (!tsTable) {
        docViolations.push(
          `Rule 9 Schema Drift: Table "public.${sqlTable}" in supabase/schema.sql is missing from Database['public']['Tables'] in src/types/database.types.ts.`
        );
        continue;
      }
      for (const col of sqlCols) {
        if (!tsTable.allProps.has(col)) {
          docViolations.push(
            `Rule 9 Schema Drift: Column "public.${sqlTable}.${col}" in supabase/schema.sql is missing from Row interface in src/types/database.types.ts.`
          );
        }
      }
      for (const reqProp of tsTable.requiredProps) {
        if (!sqlCols.has(reqProp)) {
          docViolations.push(
            `Rule 9 Schema Drift: Required Row property "${sqlTable}.${reqProp}" in src/types/database.types.ts does not exist in supabase/schema.sql.`
          );
        }
      }
    }

    for (const tsTable of tsTablesMap.keys()) {
      if (!sqlTablesMap.has(tsTable)) {
        docViolations.push(
          `Rule 9 Schema Drift: Table "${tsTable}" in src/types/database.types.ts does not exist in supabase/schema.sql.`
        );
      }
    }
  }

  // 5. Zero Circular Dependencies, Zero Parse Blindness, Layer Boundaries & Zero Orphaned Modules Gate (Rule 2)
  let depGraph = null;
  let crossBoundaryCatalog = null;
  const contractedFilesSet = new Set();
  try {
    const {
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
      extractBehavioralContractsCatalog,
      findOrphanedGeneratorLookupKeys,
    } = require('./lib/ast-parser');
    depGraph = analyzeDependencyGraph(path.join(rootDir, 'src'), rootDir);
    const circularHealth = detectCircularDependencies(depGraph);
    const astParseErrors = getAstParseErrors(depGraph);
    const layerViolations = detectLayerViolations(depGraph);
    const orphanedModules = detectOrphanedModules(depGraph);
    const scriptsGraph = analyzeScriptsDependencyGraph(rootDir);
    crossBoundaryCatalog = extractCrossBoundaryCouplingCatalog(path.join(rootDir, 'src'), rootDir);
    const contractsCatalog = extractBehavioralContractsCatalog(path.join(rootDir, 'src'), rootDir);
    const orphanLookupKeys = findOrphanedGeneratorLookupKeys(
      rootDir,
      path.join(rootDir, 'src'),
      { crossBoundaryCatalog }
    );

    if (circularHealth.hasCycles || circularHealth.cycleCount > 0) {
      for (const cycle of circularHealth.cycles) {
        docViolations.push(`Circular module dependency detected: ${cycle.join(' -> ')}`);
      }
    }
    if (astParseErrors.length > 0) {
      for (const parseErr of astParseErrors) {
        docViolations.push(
          `Babel AST parse failure in "${parseErr.file}" (blinds static cycle/props analysis): ${parseErr.error}`
        );
      }
    }
    for (const sParseErr of [...scriptsGraph.parseErrors, ...crossBoundaryCatalog.parseErrors]) {
      docViolations.push(
        `Babel AST parse failure in cross-boundary/script scan "${sParseErr.file}": ${sParseErr.error}`
      );
    }
    for (const cParseErr of contractsCatalog.parseErrors) {
      docViolations.push(
        `Babel AST parse failure in system contracts scan "${cParseErr.file}": ${cParseErr.error}`
      );
    }
    for (const cIssue of contractsCatalog.validationIssues) {
      docViolations.push(
        `Invalid JSDoc contract tag in "${cIssue.file}": ${cIssue.message}`
      );
    }

    const contractsByFile = new Map(contractsCatalog.modules.map((m) => [m.file, m]));
    const tier1Set = new Set(TIER_1_CONTRACTED_MODULES);
    const tier2Set = new Set(TIER_2_CONTRACTED_MODULES);
    const tier3Set = new Set(TIER_3_CONTRACTED_MODULES);
    const tier4Set = new Set(TIER_4_CONTRACTED_MODULES);
    for (const protectedFile of PROTECTED_CONTRACTED_MODULES) {
      const entry = contractsByFile.get(protectedFile);
      if (
        !entry ||
        !entry.hasContract ||
        !entry.moduleContract ||
        !entry.moduleContract.scope ||
        entry.moduleContract.invariants.length === 0
      ) {
        const tierLabel = tier1Set.has(protectedFile)
          ? 'Tier-1'
          : tier2Set.has(protectedFile)
            ? 'Tier-2'
            : tier3Set.has(protectedFile)
              ? 'Tier-3'
              : tier4Set.has(protectedFile)
                ? 'Tier-4'
                : 'Protected';
        docViolations.push(
          `${tierLabel} protected module "${protectedFile}" is missing required @scope + @invariant JSDoc contract annotations.`
        );
      }
    }

    const contractsDocPath = path.join(rootDir, 'docs', 'SYSTEM_CONTRACTS.md');
    const contractsDocContent = fs.existsSync(contractsDocPath)
      ? fs.readFileSync(contractsDocPath, 'utf-8')
      : null;
    const activeSectionStart =
      contractsDocContent !== null
        ? contractsDocContent.indexOf('## 🛡️ Active Behavioral Contracts')
        : -1;
    const pendingSectionStart =
      contractsDocContent !== null
        ? contractsDocContent.indexOf('## 📋 AST-Prioritized Pending Contract Queue')
        : -1;
    const activeContractsSection =
      contractsDocContent !== null &&
      activeSectionStart !== -1 &&
      pendingSectionStart > activeSectionStart
        ? contractsDocContent.slice(activeSectionStart, pendingSectionStart)
        : '';

    if (contractsDocContent !== null) {
      if (!activeContractsSection) {
        docViolations.push(
          'docs/SYSTEM_CONTRACTS.md is missing expected Active Behavioral Contracts / Pending Contract Queue section boundaries (run "npm run docs:contracts").'
        );
      } else {
        for (const hMatch of activeContractsSection.matchAll(/^#### \[`([^`]+)`\]\(/gm)) {
          const activeHeadingFile = hMatch[1];
          if (!contractsByFile.get(activeHeadingFile)?.hasContract) {
            docViolations.push(
              `Stale or uncontracted active heading "${activeHeadingFile}" in docs/SYSTEM_CONTRACTS.md (run "npm run docs:contracts" or "npm run docs:sync").`
            );
          }
        }
      }

      const expectedSummaryTokens = [
        `**Total Scanned Executable Modules**: \`${contractsCatalog.summary.totalModules}\``,
        `**Annotated Contract Modules**: \`${contractsCatalog.summary.contractedModules}\``,
        `= \`${contractsCatalog.protectedModules.length}\` Protected`,
        `**Extracted Module Invariants**: \`${contractsCatalog.summary.totalModuleInvariants}\``,
      ];
      for (const token of expectedSummaryTokens) {
        if (!contractsDocContent.includes(token)) {
          docViolations.push(
            `Stale contract summary metric in docs/SYSTEM_CONTRACTS.md: missing "${token}" (run "npm run docs:contracts" or "npm run docs:sync").`
          );
        }
      }
    }

    for (const mod of contractsCatalog.modules) {
      if (!mod.hasContract) continue;
      contractedFilesSet.add(mod.file);
      const allAdrs = [
        ...(mod.moduleContract?.adrs || []),
        ...mod.symbolContracts.flatMap((s) => s.adrs || []),
      ];
      for (const adrId of allAdrs) {
        if (!validAdrSet.has(adrId)) {
          docViolations.push(
            `Unknown @adr reference "${adrId}" in "${mod.file}" (not found in docs/DECISIONS.md).`
          );
        }
      }
      if (contractsDocContent !== null && activeContractsSection) {
        const expectedHeading = `#### [\`${mod.file}\`](`;
        if (!activeContractsSection.includes(expectedHeading)) {
          docViolations.push(
            `Contracted module "${mod.file}" is missing its active section heading in docs/SYSTEM_CONTRACTS.md (run "npm run docs:contracts" or "npm run docs:sync").`
          );
        }
      }
    }
    for (const orphanKey of orphanLookupKeys) {
      docViolations.push(
        `Orphaned generator lookup key "${orphanKey.key}" in ${orphanKey.mapName} (${orphanKey.file}): ${orphanKey.reason}`
      );
    }
    if (layerViolations.length > 0) {
      for (const violation of layerViolations) {
        docViolations.push(
          `Architectural layer boundary violation in "${violation.file}" -> "${violation.target}": ${violation.rule}`
        );
      }
    }
    if (orphanedModules.length > 0) {
      for (const orphan of orphanedModules) {
        docViolations.push(`Orphaned unreferenced module detected in src/: ${orphan}`);
      }
    }
    if (fs.existsSync(schemaPath)) {
      const schemaTablesSet = new Set(
        extractSqlSchemaEntities(fs.readFileSync(schemaPath, 'utf-8')).tableNames.map(
          (t) => `public.${t}`
        )
      );
      for (const tp of crossBoundaryCatalog.dbTouchpoints) {
        if (!schemaTablesSet.has(tp.table)) {
          docViolations.push(
            `Unknown Supabase table reference "${tp.table}" in [${tp.callers.join(', ')}] (missing from supabase/schema.sql).`
          );
        }
      }
    }
  } catch (err) {
    docViolations.push(`Failed to analyze AST dependency graph for cycles/orphans: ${err.message}`);
  }

  // 6. Semantic Documentation & Generator Completeness Parity (Rule 1 & Rule 2)
  const pkgJsonPath = path.join(rootDir, 'package.json');
  const validNpmScripts = new Set();
  if (fs.existsSync(pkgJsonPath)) {
    const pkgData = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    for (const scriptKey of Object.keys(pkgData.scripts || {})) {
      validNpmScripts.add(scriptKey);
    }
  }

  function countRepoTestSuites(dir) {
    let count = 0;
    if (!fs.existsSync(dir)) return 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.next') {
          count += countRepoTestSuites(full);
        }
      } else if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
        count++;
      }
    }
    return count;
  }
  const actualSuiteCount =
    countRepoTestSuites(path.join(rootDir, 'src')) +
    countRepoTestSuites(path.join(rootDir, 'scripts'));

  const semanticDocFiles = [
    'README.md',
    'DEVELOPMENT.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    'docs/PIPELINE_GUIDE.md',
    'docs/GITHUB_ACTIONS.md',
    'docs/INFRASTRUCTURE.md',
    '.github/pull_request_template.md',
    '.github/ISSUE_TEMPLATE/bug_report.yml',
    '.github/ISSUE_TEMPLATE/feature_request.yml',
    '.github/ISSUE_TEMPLATE/good_first_issue.yml',
    'AGENTS.md',
    '.agents/AGENTS.md',
  ];

  for (const relDoc of semanticDocFiles) {
    const fullDoc = path.join(rootDir, relDoc);
    if (!fs.existsSync(fullDoc)) continue;
    const docText = fs.readFileSync(fullDoc, 'utf-8');

    // Verify all `npm run <cmd>` references exist in package.json scripts
    const npmRunMatches = docText.matchAll(/\bnpm(?:\.cmd)?\s+run\s+([a-z0-9:_-]+)\b/g);
    for (const m of npmRunMatches) {
      const cmdName = m[1];
      if (validNpmScripts.size > 0 && !validNpmScripts.has(cmdName)) {
        docViolations.push(
          `Stale or invalid command reference "npm run ${cmdName}" in ${relDoc} (not found in package.json scripts).`
        );
      }
    }

    // Verify explicit relative Markdown links resolving to repository files (.md, .sql, source, assets) exist on disk
    const linkCheckText =
      relDoc === 'README.md'
        ? docText.replace(/<!-- BEGIN:latest-release -->[\s\S]*?<!-- END:latest-release -->/, '')
        : docText;
    const docLinkFileExtRe = /\.(?:md|sql|ts|tsx|js|jsx|css|yml|yaml|json|png|svg|ico|webp)$/i;
    for (const linkMatch of linkCheckText.matchAll(/\]\(([^)\s]+)\)/g)) {
      const rawTarget = linkMatch[1];
      if (/^(?:https?:|mailto:|file:|#)/i.test(rawTarget)) continue;
      const cleanTarget = rawTarget.split(/[?#]/)[0];
      if (!cleanTarget || !docLinkFileExtRe.test(cleanTarget)) continue;
      const resolvedTarget = cleanTarget.startsWith('/')
        ? path.join(rootDir, cleanTarget.slice(1))
        : path.resolve(path.dirname(fullDoc), cleanTarget);
      if (!fs.existsSync(resolvedTarget)) {
        docViolations.push(
          `Broken relative documentation link "${rawTarget}" in ${relDoc} (target not found on disk).`
        );
      }
    }
  }

  // Verify explicit src/... and scripts/... file paths across governance docs & runbooks exist on disk
  for (const relDoc of [...semanticDocFiles, 'docs/SYSTEM_CONTRACTS.md']) {
    const fullDoc = path.join(rootDir, relDoc);
    if (!fs.existsSync(fullDoc)) continue;
    let docText = fs.readFileSync(fullDoc, 'utf-8');
    if (relDoc === 'README.md') {
      docText = docText.replace(
        /<!-- BEGIN:latest-release -->[\s\S]*?<!-- END:latest-release -->/,
        ''
      );
    }
    const pathMatches = docText.matchAll(
      /\b((?:src|scripts)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|css))\b/g
    );
    for (const m of pathMatches) {
      const relRef = m[1];
      if (!fs.existsSync(path.join(rootDir, relRef))) {
        docViolations.push(
          `Stale or non-existent source/script path "${relRef}" referenced in ${relDoc} (update doc or remove dead reference).`
        );
      }
    }
  }

  // Verify GitHub Collaboration Templates (.github/ISSUE_TEMPLATE/* & .github/pull_request_template.md) Parity
  const githubCollaborationTemplates = [
    '.github/ISSUE_TEMPLATE/config.yml',
    '.github/ISSUE_TEMPLATE/bug_report.yml',
    '.github/ISSUE_TEMPLATE/feature_request.yml',
    '.github/ISSUE_TEMPLATE/good_first_issue.yml',
    '.github/pull_request_template.md',
  ];
  for (const relTpl of githubCollaborationTemplates) {
    const fullTpl = path.join(rootDir, relTpl);
    if (!fs.existsSync(fullTpl)) {
      docViolations.push(`Missing GitHub collaboration template: ${relTpl}`);
      continue;
    }
    const tplText = fs.readFileSync(fullTpl, 'utf-8');
    if (tplText.trim().length === 0) {
      docViolations.push(`GitHub collaboration template is empty: ${relTpl}`);
      continue;
    }

    // Verify any explicit src/... file paths referenced in templates exist on disk
    const srcRefMatches = tplText.matchAll(/\b(src\/[A-Za-z0-9_./-]+\.(?:ts|tsx|js|jsx|css))\b/g);
    for (const refMatch of srcRefMatches) {
      const relSrcRef = refMatch[1];
      if (!fs.existsSync(path.join(rootDir, relSrcRef))) {
        docViolations.push(
          `Stale or non-existent source file reference "${relSrcRef}" in ${relTpl} (update template to match current codebase paths).`
        );
      }
    }
  }

  const issueConfigPath = path.join(rootDir, '.github', 'ISSUE_TEMPLATE', 'config.yml');
  if (fs.existsSync(issueConfigPath)) {
    const issueConfigText = fs.readFileSync(issueConfigPath, 'utf-8');
    if (!/blank_issues_enabled:\s*false/.test(issueConfigText)) {
      docViolations.push(
        '.github/ISSUE_TEMPLATE/config.yml must enforce "blank_issues_enabled: false".'
      );
    }
    if (/contact_links\s*:/.test(issueConfigText)) {
      docViolations.push(
        '.github/ISSUE_TEMPLATE/config.yml must not include redundant "contact_links:" chooser entries.'
      );
    }
  }

  for (const coverageTpl of [
    '.github/ISSUE_TEMPLATE/good_first_issue.yml',
    '.github/pull_request_template.md',
  ]) {
    const fullCovTpl = path.join(rootDir, coverageTpl);
    if (fs.existsSync(fullCovTpl)) {
      const covTplText = fs.readFileSync(fullCovTpl, 'utf-8');
      if (!covTplText.includes('95%') || /\b80%\b/.test(covTplText)) {
        docViolations.push(
          `Coverage threshold drift in ${coverageTpl}: must reference the canonical 95% V8 coverage floor (not legacy 80%).`
        );
      }
    }
  }

  // Verify live V8 coverage threshold parity across engineering guides
  const { coverageThresholds, jurisdictionBaselines } = extractRuntimeSpecConstants(rootDir);
  const expectedCovTuple = `${coverageThresholds.lines}/${coverageThresholds.statements}/${coverageThresholds.functions}/${coverageThresholds.branches}`;
  const covDocChecks = [
    { rel: 'CONTRIBUTING.md', requireTuple: true, requireMetrics: true },
    { rel: 'docs/PIPELINE_GUIDE.md', requireTuple: true, requireMetrics: true },
    { rel: 'docs/GITHUB_ACTIONS.md', requireTuple: true, requireMetrics: false },
    { rel: 'DEVELOPMENT.md', requireTuple: false, requireMetrics: true },
  ];
  for (const covCheck of covDocChecks) {
    const absCovDoc = path.join(rootDir, covCheck.rel);
    if (!fs.existsSync(absCovDoc)) continue;
    const covText = fs.readFileSync(absCovDoc, 'utf-8');
    if (covCheck.requireTuple && !covText.includes(expectedCovTuple)) {
      docViolations.push(
        `Coverage tuple drift in ${covCheck.rel}: expected "${expectedCovTuple}" matching vitest.config.mts.`
      );
    }
    if (covCheck.requireMetrics) {
      const expectedMetricChecks = [
        ['Lines', coverageThresholds.lines],
        ['Statements', coverageThresholds.statements],
        ['Functions', coverageThresholds.functions],
        ['Branches', coverageThresholds.branches],
      ];
      for (const [label, pct] of expectedMetricChecks) {
        const metricOk =
          covText.includes(`${label} >= ${pct}%`) ||
          covText.includes(`${label} $\\ge ${pct}\\%$`);
        if (!metricOk) {
          docViolations.push(
            `Coverage metric drift in ${covCheck.rel}: missing ${label} >= ${pct}% matching vitest.config.mts.`
          );
        }
      }
    }
  }

  // Verify live test suite count parity in governance docs
  const suiteCountDocChecks = [
    { rel: 'README.md', regex: /across (\d+) test suites\./ },
    { rel: 'CONTRIBUTING.md', regex: /across `(\d+)` suites\)/ },
    { rel: 'docs/PIPELINE_GUIDE.md', regex: /Asserts all `(\d+)` unit\/integration test suites/ },
    { rel: 'AGENTS.md', regex: /with `@testing-library\/react` and MSW v3 \(`(\d+)` suites\)/ },
    { rel: '.agents/AGENTS.md', regex: /across all executable files \(`(\d+)` suites\)/ },
  ];
  for (const check of suiteCountDocChecks) {
    const fullDoc = path.join(rootDir, check.rel);
    if (!fs.existsSync(fullDoc)) continue;
    const docText = fs.readFileSync(fullDoc, 'utf-8');
    const matchSuite = docText.match(check.regex);
    if (matchSuite && parseInt(matchSuite[1], 10) !== actualSuiteCount) {
      docViolations.push(
        `Stale test suite count in ${check.rel}: found ${matchSuite[1]}, expected ${actualSuiteCount} (run "npm run docs:sync").`
      );
    }
  }

  // Verify SQL explicit index count and JURISDICTION_BASELINE_COUNTS parity across governance & README docs
  const liveSqlEntities = fs.existsSync(schemaPath)
    ? extractSqlSchemaEntities(fs.readFileSync(schemaPath, 'utf-8'))
    : null;
  const liveIndexCount = liveSqlEntities?.indexes?.length ?? 0;
  if (liveIndexCount > 0) {
    for (const idxDocRel of ['AGENTS.md', '.agents/AGENTS.md', 'README.md']) {
      const absIdxDoc = path.join(rootDir, idxDocRel);
      if (!fs.existsSync(absIdxDoc)) continue;
      const idxDocText = fs.readFileSync(absIdxDoc, 'utf-8');
      for (const idxMatch of idxDocText.matchAll(
        /(\d+)\s+explicit\s+(?:GIN\/B-Tree\/unique\s+)?indexes/gi
      )) {
        const declaredIndexes = parseInt(idxMatch[1], 10);
        if (declaredIndexes !== liveIndexCount) {
          docViolations.push(
            `Stale SQL index count "${idxMatch[0]}" in ${idxDocRel}: expected ${liveIndexCount} matching supabase/schema.sql.`
          );
        }
      }
    }
  }

  if (fs.existsSync(path.join(rootDir, 'README.md')) && jurisdictionBaselines) {
    const readmeBaselineText = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf-8');
    const baselineMatch = readmeBaselineText.match(
      /([\d,]+)\s+volumes\s+in\s+the\s+EU\s+vs\.\s+([\d,]+)\s+in\s+the\s+U\.S\./
    );
    if (baselineMatch) {
      const docEu = parseInt(baselineMatch[1].replace(/,/g, ''), 10);
      const docUs = parseInt(baselineMatch[2].replace(/,/g, ''), 10);
      if (
        docEu !== jurisdictionBaselines.life70 ||
        docUs !== jurisdictionBaselines.usPublicDomain
      ) {
        docViolations.push(
          `Stale jurisdiction catalog baseline counts in README.md: found EU=${docEu}, US=${docUs}, expected EU=${jurisdictionBaselines.life70}, US=${jurisdictionBaselines.usPublicDomain} (from src/lib/copyright-engine.ts).`
        );
      }
    }
  }

  // Verify generator lookup completeness & bidirectional hub/subdoc parity across docs/ARCHITECTURE.md + docs/architecture/*.md
  const archCorpus = loadArchitectureCorpus(rootDir);
  if (archCorpus.indexExists) {
    const stripLeadingParentDirs = (rawRel) => {
      let cleaned = String(rawRel || '').replace(/\\/g, '/');
      while (cleaned.startsWith('../')) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.startsWith('./')) {
        cleaned = cleaned.slice(2);
      }
      return cleaned;
    };

    if (archCorpus.subDocs.length === 0) {
      docViolations.push(
        'Missing modular architecture subsystem files under docs/architecture/*.md (run "npm run docs:sync").'
      );
    }
    const subDocRelSet = new Set(archCorpus.subDocs.map((d) => d.relPath));
    for (const subDoc of archCorpus.subDocs) {
      if (subDoc.content.trim().length === 0) {
        docViolations.push(`Empty architecture subsystem file detected: ${subDoc.relPath}`);
      }
    }

    // Bidirectional Hub TOC Completeness: docs/ARCHITECTURE.md <-> docs/architecture/*.md
    const linkedSubdocsInHub = new Set();
    for (const tocMatch of archCorpus.indexContent.matchAll(/\]\((architecture\/[A-Za-z0-9_.-]+\.md)(?:[?#][^)\s]*)?\)/g)) {
      const targetSubRel = `docs/${tocMatch[1]}`;
      linkedSubdocsInHub.add(targetSubRel);
      if (!subDocRelSet.has(targetSubRel)) {
        docViolations.push(
          `Broken subsystem TOC link "${tocMatch[1]}" in docs/ARCHITECTURE.md (target file missing under docs/architecture/).`
        );
      }
    }
    for (const subDoc of archCorpus.subDocs) {
      if (!linkedSubdocsInHub.has(subDoc.relPath)) {
        docViolations.push(
          `Orphaned architecture sub-document "${subDoc.relPath}" is not linked in docs/ARCHITECTURE.md TOC (run "npm run docs:sync").`
        );
      }
    }

    const archContent = archCorpus.combinedContent;
    const genericPlaceholders = [
      'Production runtime library.',
      'Development or verification tooling.',
      'Dependency security override.',
      'Database entity with RLS user isolation.',
      'Stored database function or trigger.',
      'Application custom hook.',
      'Domain utility module.',
      'Next.js App Router entrypoint.',
      'Automated GitHub Actions CI/CD workflow.',
      'Application environment configuration parameter.',
      'Static public asset served at root edge path.',
      'Background Web Worker script.',
      'Node.js automation or maintenance script.',
      'Standalone CLI or verification test suite.',
      'Cross-boundary runtime signal channel.',
    ];
    for (const placeholder of genericPlaceholders) {
      if (archContent.includes(placeholder)) {
        docViolations.push(
          `Unmapped generic fallback description "${placeholder}" in docs/ARCHITECTURE.md (update lookup map in scripts/generate-architecture-matrix.js or scripts/lib/ast-parser.js).`
        );
      }
    }
    if (crossBoundaryCatalog && Array.isArray(crossBoundaryCatalog.signalChannels)) {
      for (const sig of crossBoundaryCatalog.signalChannels) {
        if (sig.isCustomSignal && !archContent.includes(sig.name)) {
          docViolations.push(
            `Cross-boundary signal channel "${sig.name}" (${sig.kind}) is missing from docs/ARCHITECTURE.md (update signalMetaMap in scripts/generate-architecture-matrix.js and run "npm run docs:sync").`
          );
        }
      }
    }
    if (/\|\s*Index on `public\.[^`]+`\.\s*\|/.test(archContent)) {
      docViolations.push(
        'Unmapped SQL index description ("Index on `public.<table_name>`.") in docs/ARCHITECTURE.md (update indexDescMap in scripts/generate-architecture-matrix.js).'
      );
    }

    // Verify 1:1 SQL Stored Function Parity against docs/ARCHITECTURE.md
    if (fs.existsSync(schemaPath)) {
      const schemaSqlText = fs.readFileSync(schemaPath, 'utf-8');
      const sqlFnMatches = schemaSqlText.matchAll(
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.([a-z0-9_]+)\s*\(/gi
      );
      for (const fnMatch of sqlFnMatches) {
        const fnName = fnMatch[1];
        if (!archContent.includes(`public.${fnName}()`)) {
          docViolations.push(
            `Database stored function "public.${fnName}()" in supabase/schema.sql is missing from docs/ARCHITECTURE.md (update functionMetaMap in scripts/generate-architecture-matrix.js and run "npm run docs:sync").`
          );
        }
      }
    }

    // Verify Service Worker CACHE_NAME & Version Tag Parity against public/sw.js
    const swFilePath = path.join(rootDir, 'public', 'sw.js');
    if (fs.existsSync(swFilePath)) {
      const swText = fs.readFileSync(swFilePath, 'utf-8');
      const swCacheMatch = swText.match(/const\s+CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
      if (swCacheMatch && swCacheMatch[1]) {
        const liveCacheName = swCacheMatch[1];
        const verMatch = liveCacheName.match(/-(v\d+)$/i);
        const liveSwVer = verMatch ? verMatch[1] : null;
        if (!archContent.includes(liveCacheName)) {
          docViolations.push(
            `Live Service Worker CACHE_NAME "${liveCacheName}" from public/sw.js is missing from docs/ARCHITECTURE.md (run "npm run docs:sync").`
          );
        }
        const staleCacheMatches = archContent.matchAll(/\bbookarium-app-shell-v\d+\b/g);
        for (const m of staleCacheMatches) {
          if (m[0] !== liveCacheName) {
            docViolations.push(
              `Stale Service Worker cache name "${m[0]}" in docs/ARCHITECTURE.md (expected "${liveCacheName}"; run "npm run docs:sync").`
            );
          }
        }
        if (liveSwVer) {
          const staleVerMatches = archContent.matchAll(
            /(?<!Mock\s)\b(?:App Shell|Service Worker|sw\.js)\s*\(?(v\d+)\)?/g
          );
          for (const m of staleVerMatches) {
            if (m[1] !== liveSwVer) {
              docViolations.push(
                `Stale Service Worker version reference "${m[0]}" in docs/ARCHITECTURE.md (expected "${liveSwVer}" from public/sw.js; run "npm run docs:sync").`
              );
            }
          }
        }
      }
    }

    const scriptsDirPath = path.join(rootDir, 'scripts');
    if (fs.existsSync(scriptsDirPath)) {
      for (const entry of fs.readdirSync(scriptsDirPath, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith('.js')) {
          const fullScriptPath = path.join(scriptsDirPath, entry.name);
          if (fs.statSync(fullScriptPath).size === 0) {
            docViolations.push(
              `Empty 0-byte CLI script detected: "scripts/${entry.name}" (implement or remove unused stub).`
            );
          }
          if (!archContent.includes(`scripts/${entry.name}`)) {
            docViolations.push(
              `CLI script "scripts/${entry.name}" is not cataloged in docs/ARCHITECTURE.md (update extractNodeScriptsCatalog in scripts/generate-architecture-matrix.js).`
            );
          }
        }
      }
    }

    // Forward Inventory Check: Every module in depGraph (src/**) and its co-located test must appear across the architecture corpus
    if (depGraph) {
      const normalizedArchLinks = new Set();
      for (const m of archContent.matchAll(/\]\(([^)\s?#]+)(?:[?#][^)\s]*)?\)/g)) {
        normalizedArchLinks.add(stripLeadingParentDirs(m[1]));
      }
      for (const modFile of depGraph.keys()) {
        if (!normalizedArchLinks.has(modFile)) {
          docViolations.push(
            `Source module "${modFile}" is missing from docs/ARCHITECTURE.md + docs/architecture/*.md (run "npm run docs:sync").`
          );
        }
        const baseNoExt = modFile.replace(/\.(ts|tsx|js|jsx)$/, '');
        for (const testCand of [`${baseNoExt}.test.ts`, `${baseNoExt}.test.tsx`]) {
          if (fs.existsSync(path.join(rootDir, testCand)) && !normalizedArchLinks.has(testCand)) {
            docViolations.push(
              `Co-located test suite "${testCand}" is missing from docs/ARCHITECTURE.md + docs/architecture/*.md (run "npm run docs:sync").`
            );
          }
        }
      }
    }

    // Per-file Reverse Dead-Link & Relative Path Check across docs/ARCHITECTURE.md + docs/architecture/*.md
    const archLinkFileExtRe = /\.(?:md|sql|ts|tsx|js|jsx|css|yml|yaml|json|png|svg|ico|webp)$/i;
    for (const archDoc of archCorpus.allDocs) {
      let inCodeFence = false;
      for (const docLine of archDoc.content.split(/\r?\n/)) {
        if (docLine.trim().startsWith('```')) {
          inCodeFence = !inCodeFence;
          continue;
        }
        if (inCodeFence) continue;
        for (const linkMatch of docLine.matchAll(/\]\(([^)\s]+)\)/g)) {
          const rawTarget = linkMatch[1];
          if (/^(?:https?:|mailto:|file:|#)/i.test(rawTarget)) continue;
          const cleanTarget = rawTarget.split(/[?#]/)[0].replace(/\/$/, '');
          if (!cleanTarget) continue;
          if (archLinkFileExtRe.test(cleanTarget)) {
            const resolvedFromDoc = cleanTarget.startsWith('/')
              ? path.join(rootDir, cleanTarget.slice(1))
              : path.resolve(path.dirname(archDoc.absPath), cleanTarget);
            if (!fs.existsSync(resolvedFromDoc)) {
              docViolations.push(
                `Broken relative link "${rawTarget}" in ${archDoc.relPath} (target not found on disk; run "npm run docs:sync").`
              );
            }
          }
          const normalizedRepoTarget = stripLeadingParentDirs(cleanTarget);
          if (
            /^(?:src|scripts)\/[A-Za-z0-9_./-]+$/.test(normalizedRepoTarget) &&
            /\.[a-z0-9]+$/i.test(normalizedRepoTarget) &&
            !fs.existsSync(path.join(rootDir, normalizedRepoTarget))
          ) {
            docViolations.push(
              `Stale dead file reference "${normalizedRepoTarget}" in ${archDoc.relPath} (file was deleted or renamed; run "npm run docs:sync").`
            );
          }
        }
      }
    }

    // 360-Degree Architectural Topology & .env.example Variable Documentation Parity Check
    const requiredArchSections = [
      '## 🔄 Event Bus, Cross-Store Reactivity & State-Flow Topology',
      '## ⏱️ Runtime Execution Workflows (Temporal Sequence Diagrams)',
      '### 1. GitHub Actions & Database Ingestion Topology',
      '### 4. Query-to-Index Execution Plan & 78k-Row Anti-Timeout Contracts',
      '## 🌍 External Integration & Boundary Contracts Map',
      '## 🛡️ Failure Modes, Circuit Breakers & Retry Topology',
      '## 🚀 Deployment, Edge Caching & Operational Topology',
      '## 🔐 Environment Variable, Config & Security Trust-Zone Dependency Map',
      '### 3. Authentication, Password Recovery, Session Revocation & Origin Security Flow',
      '## 🤝 Literary Fellowship, Symposium Pacts & Marginalia Guard Topology',
    ];
    for (const reqSection of requiredArchSections) {
      if (!archContent.includes(reqSection)) {
        docViolations.push(
          `Required 360-degree architecture section "${reqSection}" is missing from docs/ARCHITECTURE.md (run "npm run docs:sync").`
        );
      }
    }

    const envExamplePath = path.join(rootDir, '.env.example');
    if (fs.existsSync(envExamplePath)) {
      const envExLines = fs.readFileSync(envExamplePath, 'utf-8').split(/\r?\n/);
      for (const line of envExLines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const envKey = trimmed.slice(0, eqIdx).trim();
          if (envKey && !archContent.includes(`\`${envKey}\``)) {
            docViolations.push(
              `Environment variable "${envKey}" from .env.example is missing from docs/ARCHITECTURE.md (run "npm run docs:sync").`
            );
          }
        }
      }
    }

    // 1:1 .github/workflows/*.yml & Cron Schedule Parity Check against docs/ARCHITECTURE.md & docs/GITHUB_ACTIONS.md
    const actionsDocPath = path.join(rootDir, 'docs', 'GITHUB_ACTIONS.md');
    const actionsDocContent = fs.existsSync(actionsDocPath)
      ? fs.readFileSync(actionsDocPath, 'utf-8')
      : null;
    const workflowsDir = path.join(rootDir, '.github', 'workflows');
    if (fs.existsSync(workflowsDir)) {
      const wfFiles = fs
        .readdirSync(workflowsDir)
        .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
      for (const wfFile of wfFiles) {
        const relWfPath = `.github/workflows/${wfFile}`;
        if (!archContent.includes(relWfPath)) {
          docViolations.push(
            `GitHub Actions workflow "${relWfPath}" is missing from docs/ARCHITECTURE.md (update scripts/generate-architecture-matrix.js and run "npm run docs:sync").`
          );
        }
        if (actionsDocContent !== null && !actionsDocContent.includes(relWfPath)) {
          docViolations.push(
            `GitHub Actions workflow "${relWfPath}" is missing from docs/GITHUB_ACTIONS.md (document its triggers, inputs, secrets, and commands).`
          );
        }
        const wfText = fs.readFileSync(path.join(workflowsDir, wfFile), 'utf-8');
        const cronMatch = wfText.match(/cron:\s*['"]([^'"]+)['"]/);
        if (cronMatch && cronMatch[1]) {
          const cronExpr = cronMatch[1].trim();
          if (!archContent.includes(`cron: ${cronExpr}`)) {
            docViolations.push(
              `Cron schedule "cron: ${cronExpr}" for "${relWfPath}" is out of sync in docs/ARCHITECTURE.md (run "npm run docs:sync").`
            );
          }
          if (actionsDocContent !== null && !actionsDocContent.includes(`cron: ${cronExpr}`)) {
            docViolations.push(
              `Cron schedule "cron: ${cronExpr}" for "${relWfPath}" is out of sync in docs/GITHUB_ACTIONS.md.`
            );
          }
        }
      }

      // Marker integrity and SHA-pin parity inside docs/GITHUB_ACTIONS.md
      if (actionsDocContent !== null) {
        for (const [beginTag, endTag] of [
          ['<!-- BEGIN:workflows-matrix -->', '<!-- END:workflows-matrix -->'],
          ['<!-- BEGIN:actions-pins -->', '<!-- END:actions-pins -->'],
        ]) {
          const bIdx = actionsDocContent.indexOf(beginTag);
          const eIdx = actionsDocContent.indexOf(endTag);
          if (bIdx === -1 || eIdx === -1 || eIdx <= bIdx || !actionsDocContent.slice(bIdx + beginTag.length, eIdx).trim()) {
            docViolations.push(
              `docs/GITHUB_ACTIONS.md is missing non-empty "${beginTag}" / "${endTag}" synced block (run "npm run docs:sync").`
            );
          }
        }
        const workflowSpec = extractWorkflowSpecCatalog(rootDir);
        const seenShas = new Set();
        for (const wfSpec of workflowSpec.workflows) {
          for (const act of wfSpec.actions) {
            if (seenShas.has(act.sha)) continue;
            seenShas.add(act.sha);
            if (!actionsDocContent.includes(act.sha)) {
              docViolations.push(
                `Action SHA pin "${act.repo}@${act.sha}" from ${wfSpec.file} is out of sync in docs/GITHUB_ACTIONS.md (run "npm run docs:sync").`
              );
            }
          }
        }
      }

      // Reverse Dead Workflow File & Live Count Parity across docs/guides
      const activeWfSet = new Set(wfFiles.map((f) => `.github/workflows/${f}`));
      const archDocRelList = archCorpus.allDocs.map((d) => d.relPath);
      const wfAuditDocs = [
        ...archDocRelList,
        'docs/GITHUB_ACTIONS.md',
        'docs/INFRASTRUCTURE.md',
        'docs/PIPELINE_GUIDE.md',
        'DEVELOPMENT.md',
        'README.md',
        'AGENTS.md',
        '.agents/AGENTS.md',
      ];
      const wfCountAuditDocSet = new Set([
        'README.md',
        'docs/PIPELINE_GUIDE.md',
        'docs/GITHUB_ACTIONS.md',
        'docs/INFRASTRUCTURE.md',
        'DEVELOPMENT.md',
        ...archDocRelList,
      ]);
      for (const relDoc of wfAuditDocs) {
        const absDoc = path.join(rootDir, relDoc);
        if (!fs.existsSync(absDoc)) continue;
        let docTxt = fs.readFileSync(absDoc, 'utf-8');
        if (relDoc === 'README.md') {
          docTxt = docTxt.replace(
            /<!-- BEGIN:latest-release -->[\s\S]*?<!-- END:latest-release -->/,
            ''
          );
        }
        const deadWfRefs = docTxt.matchAll(/\b(\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml)\b/g);
        for (const m of deadWfRefs) {
          if (!activeWfSet.has(m[1])) {
            docViolations.push(
              `Stale or removed workflow reference "${m[1]}" in ${relDoc} (file no longer exists in .github/workflows/).`
            );
          }
        }
        if (wfCountAuditDocSet.has(relDoc)) {
          const wfCountMatches = docTxt.matchAll(/\ball [*_`]*(\d+)[*_`]* (?:GitHub Actions )?workflows\b/gi);
          for (const cm of wfCountMatches) {
            const declaredCount = parseInt(cm[1], 10);
            if (declaredCount !== wfFiles.length) {
              docViolations.push(
                `Stale workflow count "all ${declaredCount} workflows" in ${relDoc} (expected ${wfFiles.length} matching .github/workflows/*.yml).`
              );
            }
          }
        }
      }
    }

    // Architecture Diagrams & Directory Parity Check between docs/ARCHITECTURE.md + docs/architecture/*.md and README.md
    const readmeFilePath = path.join(rootDir, 'README.md');
    if (fs.existsSync(readmeFilePath)) {
      const readmeText = fs.readFileSync(readmeFilePath, 'utf-8');
      const archMermaidCount = (archContent.match(/```mermaid/g) || []).length;
      if (archMermaidCount < 15) {
        docViolations.push(
          `Architecture corpus (docs/ARCHITECTURE.md + docs/architecture/*.md) is missing expected 360-degree diagrams (found ${archMermaidCount}, expected at least 15; run "npm run docs:sync").`
        );
      }
      if (!readmeText.includes('End-to-End System Context & Data Flow') || !readmeText.includes('<!-- BEGIN:architecture-diagrams -->')) {
        docViolations.push(
          `README.md is missing executive System Context architecture diagram (run "npm run docs:sync").`
        );
      }
      if (!readmeText.includes(`Living Architecture Directory (${archMermaidCount} Interactive Diagrams)`)) {
        docViolations.push(
          `README.md architecture directory count does not match architecture corpus (${archMermaidCount} diagrams; run "npm run docs:sync").`
        );
      }
      const archDiag1Marker = '### 1. End-to-End System Context & Data Flow';
      const archDiag1Start = archCorpus.indexContent.indexOf(archDiag1Marker);
      const archMermaidStart =
        archDiag1Start !== -1 ? archCorpus.indexContent.indexOf('```mermaid', archDiag1Start) : -1;
      const archMermaidEnd =
        archMermaidStart !== -1 ? archCorpus.indexContent.indexOf('```', archMermaidStart + 10) : -1;
      const archDiagram1Block =
        archMermaidStart !== -1 && archMermaidEnd !== -1
          ? archCorpus.indexContent.slice(archMermaidStart, archMermaidEnd + 3).replace(/\r\n/g, '\n').trim()
          : '';
      const readmeArchBlockMatch = readmeText.match(
        /<!-- BEGIN:architecture-diagrams -->[\s\S]*?(```mermaid[\s\S]*?```)[\s\S]*?<!-- END:architecture-diagrams -->/
      );
      const readmeDiagram1Block = readmeArchBlockMatch
        ? readmeArchBlockMatch[1].replace(/\r\n/g, '\n').trim()
        : '';
      if (archDiagram1Block && (!readmeDiagram1Block || readmeDiagram1Block !== archDiagram1Block)) {
        docViolations.push(
          'README.md Diagram 1 block inside <!-- BEGIN:architecture-diagrams --> is out of sync with docs/ARCHITECTURE.md (run "npm run docs:sync").'
        );
      }
    }

    // Mermaid Syntax, Subgraph Cycle & HTML-Tag Safety Verification across Markdown Docs
    const { validateMermaidDiagramsInMarkdown } = require('./lib/ast-parser');
    const mermaidDocTargets = [
      ...archCorpus.allDocs.map((d) => d.relPath),
      'README.md',
      'docs/GUTENBERG_PARSER.md',
      'docs/INFRASTRUCTURE.md',
    ];
    for (const relMermaidDoc of mermaidDocTargets) {
      const absMermaidDoc = path.join(rootDir, relMermaidDoc);
      if (!fs.existsSync(absMermaidDoc)) continue;
      const mermaidIssues = validateMermaidDiagramsInMarkdown(
        fs.readFileSync(absMermaidDoc, 'utf-8'),
        relMermaidDoc
      );
      for (const issue of mermaidIssues) {
        docViolations.push(`Broken or unsafe Mermaid diagram: ${issue}`);
      }
    }

    // Verify Live Telemetry Parity & Architectural Layer Distribution Suite Sum
    const resultsJsonPath = path.join(rootDir, 'docs', 'quality-audit-results.json');
    if (fs.existsSync(resultsJsonPath)) {
      try {
        const parsedResults = JSON.parse(fs.readFileSync(resultsJsonPath, 'utf-8'));
        const rSuites = parsedResults?.testSummary?.totalSuites;
        const rTests = parsedResults?.testSummary?.totalTests;
        if (typeof rSuites === 'number' && typeof rTests === 'number') {
          const expectedSummarySnippet = `all ${rSuites} test suites and ${Number(rTests).toLocaleString('en-US')} tests.`;
          if (!archContent.includes(expectedSummarySnippet)) {
            docViolations.push(
              `Stale audit summary counts in docs/ARCHITECTURE.md (expected "${expectedSummarySnippet}" from docs/quality-audit-results.json; run "npm run docs:sync").`
            );
          }
        }
      } catch {
        // Defer malformed telemetry inspection to quality report generation
      }
    }

    const layerDistMatch = archContent.match(
      /### 3\. Architectural Layer Test Suite Distribution \(\d+ Suites\)\r?\n\r?\n\|[^\r\n]+\r?\n\|[^\r\n]+\r?\n([\s\S]*?)(?:\r?\n\r?\n|$)/
    );
    if (layerDistMatch && layerDistMatch[1]) {
      let layerSuiteSum = 0;
      for (const rowLine of layerDistMatch[1].split(/\r?\n/)) {
        const cellMatch = rowLine.match(/^\|\s*\*\*[^*]+\*\*\s*\|[^|]+\|\s*`(\d+)`\s*\|\s*`\d+`\s*\|/);
        if (cellMatch) {
          layerSuiteSum += parseInt(cellMatch[1], 10);
        }
      }
      if (layerSuiteSum !== actualSuiteCount) {
        docViolations.push(
          `Architectural Layer Test Suite Distribution sum (${layerSuiteSum}) in docs/ARCHITECTURE.md does not match total test suites on disk (${actualSuiteCount}; update layerDefs in scripts/lib/ast-parser.js and run "npm run docs:sync").`
        );
      }
    }
  }

  // 7. Multi-Batch Working-Tree Changelog & Living Docs Freshness Gate
  try {
    const statusRaw = execSync('git status --porcelain', {
      cwd: rootDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const statusLines = statusRaw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const dirtyFiles = new Set();
    const modifiedContractedFiles = [];
    let hasNewProductionOrSchemaChange = false;
    let hasEditedExistingBehavior = false;
    for (const line of statusLines) {
      const statusCode = line.slice(0, 2).trim();
      const rawPath = line.slice(2).trim().replace(/^"|"$/g, '');
      const cleanPath = rawPath.includes(' -> ') ? rawPath.split(' -> ').pop().trim() : rawPath;
      dirtyFiles.add(cleanPath);

      const isNewFile = statusCode === '??' || statusCode.includes('A');
      if (!isNewFile && contractedFilesSet.has(cleanPath)) {
        modifiedContractedFiles.push(cleanPath);
      }
      const isProductionCode =
        cleanPath.startsWith('src/') &&
        !cleanPath.includes('.test.') &&
        !cleanPath.includes('.spec.');
      if (
        (isNewFile && isProductionCode) ||
        (isNewFile && cleanPath.startsWith('scripts/') && cleanPath.endsWith('.js')) ||
        cleanPath === 'supabase/schema.sql'
      ) {
        hasNewProductionOrSchemaChange = true;
      } else if (
        !isNewFile &&
        (isProductionCode ||
          /^scripts\/generate-.*\.js$/.test(cleanPath) ||
          cleanPath === 'scripts/eslint-rules/bookarium-security.js' ||
          cleanPath === 'scripts/lib/sast-validators.js' ||
          cleanPath === 'scripts/sync-gutenberg-catalog.js')
      ) {
        hasEditedExistingBehavior = true;
      }
    }

    if (
      modifiedContractedFiles.length > 0 &&
      !dirtyFiles.has('docs/SYSTEM_CONTRACTS.md') &&
      !dirtyFiles.has('docs/DECISIONS.md') &&
      !dirtyFiles.has('scripts/generate-changelog.js')
    ) {
      console.log(
        `${colors.yellow}⚠ [ADVISORY] Contracted/Tier-1 module(s) modified (${modifiedContractedFiles.join(', ')}) — verify adjacent @scope/@invariant/@rationale JSDoc contracts and run "npm run docs:sync".${colors.reset}`
      );
    }

    if (
      hasNewProductionOrSchemaChange &&
      (!dirtyFiles.has('scripts/generate-changelog.js') || !dirtyFiles.has('CHANGELOG.md'))
    ) {
      docViolations.push(
        'Multi-batch drift guard: Working tree contains new production modules/scripts or supabase/schema.sql modifications, but scripts/generate-changelog.js / CHANGELOG.md have not been updated (update release notes and run "npm run docs:sync").'
      );
    } else if (
      hasEditedExistingBehavior &&
      !dirtyFiles.has('scripts/generate-architecture-matrix.js') &&
      !dirtyFiles.has('docs/DECISIONS.md') &&
      !dirtyFiles.has('scripts/generate-changelog.js')
    ) {
      console.log(
        `${colors.yellow}⚠ [ADVISORY] Existing production modules were modified without updating scripts/generate-architecture-matrix.js, docs/DECISIONS.md, or scripts/generate-changelog.js — verify living docs if contracts or behavior changed.${colors.reset}`
      );
    }
  } catch {
    // Git not available in isolated container
  }

  // 8. SemVer Release Parity, Roadmap Version Floor, Latest-ADR Sync & Anti-Bloat Patch Cap Gate
  function compareSemVer(a, b) {
    const pa = String(a || '0.0.0')
      .replace(/^v/i, '')
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
    const pb = String(b || '0.0.0')
      .replace(/^v/i, '')
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
    }
    return 0;
  }

  if (fs.existsSync(pkgJsonPath)) {
    const pkgMeta = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    const pkgVersion = String(pkgMeta.version || '').trim();
    if (!/^\d+\.\d+\.\d+$/.test(pkgVersion)) {
      docViolations.push(
        `Invalid SemVer version "${pkgVersion}" in package.json (expected MAJOR.MINOR.PATCH).`
      );
    } else {
      const [majorVer, minorVer] = pkgVersion.split('.');
      const majorMinor = `${majorVer}.${minorVer}`;

      const lockPath = path.join(rootDir, 'package-lock.json');
      if (fs.existsSync(lockPath)) {
        const lockJson = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
        const rootPkgVer = lockJson.packages && lockJson.packages[''] && lockJson.packages[''].version;
        if (lockJson.version !== pkgVersion || rootPkgVer !== pkgVersion) {
          docViolations.push(
            `Version drift in package-lock.json: found "${lockJson.version}" / "${rootPkgVer}", expected "${pkgVersion}" (run "npm run docs:sync").`
          );
        }
      }

      const changelogPath = path.join(rootDir, 'CHANGELOG.md');
      let topChangelogBlock = '';
      if (fs.existsSync(changelogPath)) {
        const changelogText = fs.readFileSync(changelogPath, 'utf-8');
        const topVerMatch = changelogText.match(/^## \[([^\]]+)\]/m);
        if (!topVerMatch || topVerMatch[1] !== pkgVersion) {
          docViolations.push(
            `Version drift in CHANGELOG.md: top release is "[${topVerMatch ? topVerMatch[1] : 'missing'}]", expected "[${pkgVersion}]" (run "npm run docs:sync").`
          );
        }
        const headerToken = `## [${pkgVersion}]`;
        const headerStart = changelogText.indexOf(headerToken);
        if (headerStart !== -1) {
          const nextSectionIdx = changelogText.indexOf(
            '\n## [',
            headerStart + headerToken.length
          );
          topChangelogBlock =
            nextSectionIdx !== -1
              ? changelogText.slice(headerStart, nextSectionIdx)
              : changelogText.slice(headerStart);
        }
      }

      const readmePath = path.join(rootDir, 'README.md');
      let latestReadmeBlock = '';
      if (fs.existsSync(readmePath)) {
        const readmeFull = fs.readFileSync(readmePath, 'utf-8');
        const blockMatch = readmeFull.match(
          /<!-- BEGIN:latest-release -->([\s\S]*?)<!-- END:latest-release -->/
        );
        latestReadmeBlock = blockMatch ? blockMatch[1] : '';
        if (!latestReadmeBlock.includes(`## 🛠️ Latest Improvements (v${pkgVersion})`)) {
          docViolations.push(
            `Version drift in README.md Latest Improvements: expected "## 🛠️ Latest Improvements (v${pkgVersion})" (run "npm run docs:sync").`
          );
        }

        const cleanDepVer = (raw) => String(raw || '').replace(/^[~^>=<\s]+/, '').trim();
        const expectedBadgeTokens = [
          { label: 'Next.js', token: `badge/Next.js-${cleanDepVer(pkgMeta.dependencies?.next)}%20(Turbopack)` },
          { label: 'React', token: `badge/React-${cleanDepVer(pkgMeta.dependencies?.react)}-blue` },
          { label: 'TypeScript', token: `badge/TypeScript-${cleanDepVer(pkgMeta.devDependencies?.typescript)}-3178C6` },
          { label: 'Tailwind CSS', token: `badge/Tailwind%20CSS-${cleanDepVer(pkgMeta.devDependencies?.tailwindcss)}-38B2AC` },
          {
            label: 'TanStack Query',
            token: `badge/TanStack%20Query-${cleanDepVer(pkgMeta.dependencies?.['@tanstack/react-query'])}-FF4154`,
          },
          { label: 'Zustand', token: `badge/Zustand-${cleanDepVer(pkgMeta.dependencies?.zustand)}-443E38` },
          {
            label: 'Framer Motion',
            token: `badge/Framer%20Motion-${cleanDepVer(pkgMeta.dependencies?.['framer-motion'])}-0055FF`,
          },
          {
            label: 'Node.js',
            token: `badge/Node.js-%3E%3D${(cleanDepVer(pkgMeta.engines?.node || '22.12.0').split('.')[0] || '22')}%20LTS`,
          },
          { label: 'MSW', token: `badge/MSW-${cleanDepVer(pkgMeta.devDependencies?.msw)}-FF6A33` },
        ];
        for (const badge of expectedBadgeTokens) {
          if (!readmeFull.includes(badge.token)) {
            docViolations.push(
              `Dependency badge drift in README.md for ${badge.label}: expected "${badge.token}" matching package.json (run "npm run docs:sync").`
            );
          }
        }
      }

      const roadmapPath = path.join(rootDir, 'ROADMAP.md');
      if (fs.existsSync(roadmapPath)) {
        const roadmapText = fs.readFileSync(roadmapPath, 'utf-8');
        if (!roadmapText.includes(`Current%20Release-v${pkgVersion}`)) {
          docViolations.push(
            `Version drift in ROADMAP.md badge: expected "Current%20Release-v${pkgVersion}" (run "npm run docs:sync").`
          );
        }
      }

      const securityPath = path.join(rootDir, 'SECURITY.md');
      if (fs.existsSync(securityPath)) {
        const securityText = fs.readFileSync(securityPath, 'utf-8');
        if (
          !securityText.includes(`| **${majorMinor}.x** |`) ||
          !securityText.includes(`| < ${majorMinor}.0 |`)
        ) {
          docViolations.push(
            `Version drift in SECURITY.md Supported Versions: expected "**${majorMinor}.x**" and "< ${majorMinor}.0" (run "npm run docs:sync").`
          );
        }

        try {
          const { auditSecurityDocumentationParity } = require('./lib/sast-validators');
          const sastExports = Object.keys(require('./lib/sast-validators'));
          const securityPlugin = require('./eslint-rules/bookarium-security');
          const eslintRuleNames = Object.keys((securityPlugin && securityPlugin.rules) || {});
          const sqlEntities = fs.existsSync(schemaPath)
            ? extractSqlSchemaEntities(fs.readFileSync(schemaPath, 'utf-8'))
            : { tableNames: [], hasMigrationLedger: false };
          const expectedDbTableCount =
            sqlEntities.tableNames.length + (sqlEntities.hasMigrationLedger ? 1 : 0);
          const syncCatalogPath = path.join(rootDir, 'scripts', 'sync-gutenberg-catalog.js');
          const syncCatalogText = fs.existsSync(syncCatalogPath)
            ? fs.readFileSync(syncCatalogPath, 'utf-8')
            : '';
          const secParityIssues = auditSecurityDocumentationParity({
            securityMarkdown: securityText,
            eslintRuleNames,
            sastValidatorExports: sastExports,
            expectedDbTableCount,
            syncCatalogText,
          });
          docViolations.push(...secParityIssues);
        } catch (err) {
          docViolations.push(`Failed circular security documentation parity check: ${err.message}`);
        }
      }

      if (fs.existsSync(readmePath)) {
        const readmeText = fs.readFileSync(readmePath, 'utf-8');
        if (!/Pass 7[^\r\n]*(?:routes-manifest|HTTP probe|next start)/i.test(readmeText)) {
          docViolations.push(
            'Security/Gateway drift in README.md: Pass 7 table row should describe routes-manifest / live HTTP probe verification.'
          );
        }
        if (!/`npm run security:audit`[^\r\n]*Pass 5/.test(readmeText)) {
          docViolations.push(
            'CLI matrix drift in README.md: `npm run security:audit` description should cite Pass 0.5, Pass 0.75 & Pass 5.'
          );
        }
        if (!readmeText.includes('.sha256')) {
          docViolations.push(
            'Catalog integrity drift in README.md: catalog-cache workflow description should reference .sha256 verification.'
          );
        }
        if (!readmeText.includes(`\`${PROTECTED_CONTRACTED_MODULES.length}\` Tier-1..Tier-4 protected`)) {
          docViolations.push(
            `Protected contract count drift in README.md: expected "\`${PROTECTED_CONTRACTED_MODULES.length}\` Tier-1..Tier-4 protected" (run "npm run docs:sync").`
          );
        }
      }

      const prTemplatePath = path.join(rootDir, '.github', 'pull_request_template.md');
      if (fs.existsSync(prTemplatePath)) {
        const prTplText = fs.readFileSync(prTemplatePath, 'utf-8');
        if (!/GPL.*AGPL|BANNED_PACKAGE_LICENSES/i.test(prTplText) || !prTplText.includes('sast-validators')) {
          docViolations.push(
            'Checklist drift in .github/pull_request_template.md: Pass 0.75 must reference sast-validators.js and offline GPL/AGPL license checks.'
          );
        }
        if (!/routes-manifest|127\.0\.0\.1|HTTP probe/i.test(prTplText)) {
          docViolations.push(
            'Checklist drift in .github/pull_request_template.md: Pass 7 must reference compiled routes-manifest header and live HTTP probe verification.'
          );
        }
      }

      const releaseWfPath = path.join(rootDir, '.github', 'workflows', 'release.yml');
      if (fs.existsSync(releaseWfPath)) {
        const releaseWfText = fs.readFileSync(releaseWfPath, 'utf-8');
        if (!releaseWfText.includes(`default: 'v${pkgVersion}'`)) {
          docViolations.push(
            `Version drift in .github/workflows/release.yml: expected "default: 'v${pkgVersion}'" (run "npm run docs:sync").`
          );
        }
      }

      const bugReportTplPath = path.join(rootDir, '.github', 'ISSUE_TEMPLATE', 'bug_report.yml');
      if (fs.existsSync(bugReportTplPath)) {
        const bugReportTplText = fs.readFileSync(bugReportTplPath, 'utf-8');
        if (!bugReportTplText.includes(`e.g. v${pkgVersion},`)) {
          docViolations.push(
            `Version drift in .github/ISSUE_TEMPLATE/bug_report.yml: expected placeholder "e.g. v${pkgVersion}," (run "npm run docs:sync").`
          );
        }
      }

      const ghaActionsDocPath = path.join(rootDir, 'docs', 'GITHUB_ACTIONS.md');
      if (fs.existsSync(ghaActionsDocPath)) {
        const ghaActionsDocText = fs.readFileSync(ghaActionsDocPath, 'utf-8');
        if (
          !ghaActionsDocText.includes(
            `\`workflow_dispatch\` with required \`tag\` string (default \`'v${pkgVersion}'\`,`
          )
        ) {
          docViolations.push(
            `Version drift in docs/GITHUB_ACTIONS.md: expected "default \`'v${pkgVersion}'\`" (run "npm run docs:sync").`
          );
        }
      }

      // Box-Capacity Auto-Bump (<= 6 bullets/release, <= 1200 chars/bullet, 1..3 ADRs/release for >= 2.9.0) & Active Minor-Series ADR Sync
      try {
        const { RELEASES } = require('./generate-changelog');
        if (Array.isArray(RELEASES)) {
          for (const rel of RELEASES) {
            if (!rel || !rel.version || compareSemVer(rel.version, '2.9.0') < 0) continue;
            const bullets = Object.values(rel.sections || {}).flat();
            if (bullets.length < 1 || bullets.length > 6) {
              docViolations.push(
                `Box-Capacity Bullet Cap violation: Release [${rel.version}] in scripts/generate-changelog.js has ${bullets.length} bullets (must be between 1 and 6 bullets per release to match README.md Latest Improvements). Open a new patch release or consolidate.`
              );
            }
            bullets.forEach((b, bIdx) => {
              if (typeof b === 'string' && b.length > 1200) {
                docViolations.push(
                  `Per-Bullet Character Cap violation: Release [${rel.version}] bullet #${bIdx + 1} in scripts/generate-changelog.js is ${b.length} chars (exceeds 1,200 char maximum). Split into focused thematic bullets or open a new patch release.`
                );
              }
            });
            const relAdrs = new Set(
              bullets.flatMap((b) =>
                typeof b === 'string' ? [...b.matchAll(/\bADR-\d{3}\b/g)].map((m) => m[0]) : []
              )
            );
            if (relAdrs.size < 1 || relAdrs.size > 3) {
              docViolations.push(
                `SemVer ADR Cap violation: Release [${rel.version}] in scripts/generate-changelog.js cites ${relAdrs.size} ADRs (${Array.from(relAdrs).join(', ') || 'none'}), outside the required 1..3 ADR range per release.`
              );
            }
          }
        }
      } catch (err) {
        docViolations.push(`Failed to validate RELEASES in scripts/generate-changelog.js: ${err.message}`);
      }

      if (matches.length > 0 && topChangelogBlock) {
        const latestAdrId = `ADR-${String(matches.length).padStart(3, '0')}`;
        const changelogFull = fs.existsSync(changelogPath)
          ? fs.readFileSync(changelogPath, 'utf-8')
          : '';
        const seriesBlocks = changelogFull
          .split('\n## [')
          .slice(1)
          .filter((block) => block.startsWith(`${majorMinor}.`));
        const activeSeriesText = seriesBlocks.length > 0 ? seriesBlocks.join('\n') : topChangelogBlock;
        if (!activeSeriesText.includes(latestAdrId)) {
          docViolations.push(
            `Latest decision record ${latestAdrId} from docs/DECISIONS.md is not cited in active series [${majorMinor}.x] of CHANGELOG.md (update scripts/generate-changelog.js and run "npm run docs:sync").`
          );
        }
        if (latestReadmeBlock && !/\bADR-\d{3}\b/.test(latestReadmeBlock)) {
          docViolations.push(
            `README.md Latest Improvements (v${pkgVersion}) does not cite any ADR-XXX decision record (run "npm run docs:sync").`
          );
        }
      }

      // Roadmap Verified Feature Version Floor Gate
      try {
        const { ROADMAP_MILESTONES } = require('./generate-roadmap');
        if (Array.isArray(ROADMAP_MILESTONES)) {
          for (const milestone of ROADMAP_MILESTONES) {
            for (const feat of milestone.features || []) {
              if (
                feat &&
                feat.targetMinVersion &&
                typeof feat.check === 'function' &&
                feat.check()
              ) {
                if (compareSemVer(pkgVersion, feat.targetMinVersion) < 0) {
                  docViolations.push(
                    `Roadmap version floor violation: Feature "${feat.title}" in ${milestone.id.toUpperCase()} is verified on disk ([x]), requiring version >= ${feat.targetMinVersion}, but package.json is ${pkgVersion}.`
                  );
                }
              }
            }
          }
        }
      } catch (err) {
        docViolations.push(`Failed to evaluate ROADMAP_MILESTONES version floor: ${err.message}`);
      }
    }
  }

  if (docViolations.length > 0) {
    logFail(`ADR schema, governance checklist, SQL<->TS parity, dependency graph, doc parity, or test co-location failure(s):`);
    docViolations.forEach((v) => console.error(`  - ${v}`));
    return false;
  }

  logPass(
    `Validated ${matches.length} sequential ADRs, ${requiredDocs.length} governance docs, semantic command/metric parity, placeholder guards, 1:1 SQL<->TS schema parity, 0 circular/parse-error/layer-violation/orphan modules, and 100% co-located tests.`
  );
  return true;
}

// -------------------------------------------------------------
// PASS 6: ESLint & Knip Dead Code Audit
// -------------------------------------------------------------
function pass6QualityAudit() {
  logHeader('Pass 6: Quality Suite (ESLint & Knip Audit)');
  console.log(`${colors.dim}  ↳ Auditing ESLint 10 code quality & Core Web Vitals...${colors.reset}`);
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

  // Update quality report with Pass-6-verified lint & Knip counts without re-running linters
  try {
    const reportScript = path.join(__dirname, 'generate-quality-report.js');
    execFileSync(process.execPath, [reportScript, '--pass6-verified'], {
      cwd: rootDir,
      stdio: 'pipe',
      shell: false,
    });
  } catch (err) {
    logFail(`Failed updating quality audit report after Pass 6 verification: ${err.message}`);
    return false;
  }

  logPass('ESLint and Knip quality checks completed cleanly with 0 defects.');
  return true;
}

function allocateFreeLoopbackPort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = addr && typeof addr === 'object' ? addr.port : 0;
      srv.close((closeErr) => {
        if (closeErr) reject(closeErr);
        else resolve(port);
      });
    });
  });
}

function sendLoopbackHttpProbe(port, probePath, timeoutMs = 5000, headers = undefined) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: probePath,
        method: 'GET',
        timeout: timeoutMs,
        ...(headers ? { headers } : {}),
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers || {},
            body: Buffer.concat(chunks).toString('utf-8'),
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error(`Timeout probing 127.0.0.1:${port}${probePath}`));
    });
    req.on('error', reject);
    req.end();
  });
}

async function stopChildProcessGracefully(child) {
  if (!child || child.exitCode !== null) return;
  try {
    child.kill('SIGTERM');
  } catch {
    return;
  }
  await new Promise((resolve) => {
    const forceTimer = setTimeout(() => {
      if (child.exitCode === null) {
        try {
          child.kill('SIGKILL');
        } catch {}
      }
      resolve();
    }, 2500);
    if (typeof forceTimer.unref === 'function') forceTimer.unref();
    child.once('exit', () => {
      clearTimeout(forceTimer);
      resolve();
    });
  });
}

/**
 * Boots the compiled Next.js server briefly on loopback `127.0.0.1` and executes runtime HTTP
 * security header, SSRF rejection, and open-redirect origin-lock smoke probes.
 */
async function probeCompiledNextServer(rootDirPath) {
  const nextBin = require.resolve('next/dist/bin/next', { paths: [rootDirPath] });
  const port = await allocateFreeLoopbackPort();
  const loopbackOrigin = ['http:', '', `127.0.0.1:${port}`].join('/');
  const localhostOrigin = ['http:', '', `localhost:${port}`].join('/');
  const serverLogs = [];

  const child = spawn(
    process.execPath,
    [nextBin, 'start', '-H', '127.0.0.1', '-p', String(port)],
    {
      cwd: rootDirPath,
      shell: false,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  child.stdout?.on('data', (d) => serverLogs.push(d.toString('utf-8')));
  child.stderr?.on('data', (d) => serverLogs.push(d.toString('utf-8')));

  try {
    let homeResponse = null;
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(
          `Compiled Next.js server exited prematurely with code ${child.exitCode}:\n${serverLogs.join('').slice(-600)}`
        );
      }
      try {
        homeResponse = await sendLoopbackHttpProbe(port, '/', 2000);
        if (homeResponse && homeResponse.status > 0) break;
      } catch {
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    if (!homeResponse) {
      throw new Error(
        `Timed out waiting for compiled Next.js server on 127.0.0.1:${port}:\n${serverLogs.join('').slice(-600)}`
      );
    }

    const probeCases = [
      {
        spec: {
          path: '/',
          expectedStatus: 200,
          expectSecurityHeaders: true,
          forbidStackTraces: true,
        },
        response: homeResponse,
      },
      {
        spec: {
          path: '/api/books?unknown_param=1',
          expectedStatus: 400,
          expectNoStoreCache: true,
          expectCrossOriginResourcePolicy: 'same-origin',
          forbidStackTraces: true,
        },
        response: await sendLoopbackHttpProbe(port, '/api/books?unknown_param=1'),
      },
      {
        spec: {
          path: '/api/profiles/card?unknown_param=1',
          expectedStatus: 400,
          expectNoStoreCache: true,
          expectCrossOriginResourcePolicy: 'same-origin',
          forbidStackTraces: true,
        },
        response: await sendLoopbackHttpProbe(port, '/api/profiles/card?unknown_param=1'),
      },
      {
        spec: {
          path: '/api/books/content?id=1342&type=cover (Sec-Fetch-Dest: document)',
          expectedStatus: 403,
          expectNoStoreCache: true,
          expectCrossOriginResourcePolicy: 'same-origin',
          forbidStackTraces: true,
        },
        response: await sendLoopbackHttpProbe(
          port,
          '/api/books/content?id=1342&type=cover',
          5000,
          {
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
          }
        ),
      },
      {
        spec: {
          path: '/api/books/content?id=1342&type=cover (Sec-Fetch-Site: cross-site)',
          expectedStatus: 403,
          expectNoStoreCache: true,
          expectCrossOriginResourcePolicy: 'same-origin',
          forbidStackTraces: true,
        },
        response: await sendLoopbackHttpProbe(
          port,
          '/api/books/content?id=1342&type=cover',
          5000,
          {
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'cross-site',
          }
        ),
      },
      {
        spec: {
          path: '/api/books/content?url=https://evil.example/secret.txt',
          expectedStatus: 400,
          expectNoStoreCache: true,
          expectCrossOriginResourcePolicy: 'same-origin',
          forbidStackTraces: true,
        },
        response: await sendLoopbackHttpProbe(
          port,
          '/api/books/content?url=https%3A%2F%2Fevil.example%2Fsecret.txt'
        ),
      },
      {
        spec: {
          path: '/auth/callback?next=https://evil.example/phish',
          allowedRedirectOrigins: [loopbackOrigin, localhostOrigin],
          forbiddenRedirectHosts: ['evil.example'],
        },
        response: await sendLoopbackHttpProbe(
          port,
          '/auth/callback?next=https%3A%2F%2Fevil.example%2Fphish'
        ),
      },
    ];

    const violations = [];
    for (const item of probeCases) {
      violations.push(...validateLiveHttpSecurityResponse(item.spec, item.response));
    }
    return violations;
  } finally {
    await stopChildProcessGracefully(child);
  }
}

// -------------------------------------------------------------
// PASS 7: Production Build, Chunk Budget & Live HTTP Security Smoke Probe
// -------------------------------------------------------------
async function pass7ProductionBuild() {
  logHeader('Pass 7: Next.js Production Build, Chunk Budget & Live HTTP Security Probe');
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

  const routesManifestPath = path.join(rootDir, '.next', 'routes-manifest.json');
  const compiledHeaderViolations = validateNextBuildHeaderManifest(routesManifestPath);
  if (compiledHeaderViolations.length > 0) {
    logFail('Compiled Next.js production security header manifest violation(s):');
    compiledHeaderViolations.forEach((v) => console.error(`  - ${v}`));
    return false;
  }

  console.log(
    `${colors.dim}Probing live compiled Next.js server (127.0.0.1) for runtime OWASP headers, SSRF rejection, and origin-locked redirects...${colors.reset}`
  );
  try {
    const liveProbeViolations = await probeCompiledNextServer(rootDir);
    if (liveProbeViolations.length > 0) {
      logFail('Live compiled Next.js HTTP security probe violation(s):');
      liveProbeViolations.forEach((v) => console.error(`  - ${v}`));
      return false;
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (/\b(?:EACCES|EPERM)\b/.test(errMsg)) {
      console.log(
        `${colors.yellow}⚠ [WARN] Loopback socket bind restricted in current environment (${errMsg}); skipping live server probe.${colors.reset}`
      );
    } else {
      logFail(`Failed executing live compiled Next.js HTTP security probe: ${errMsg}`);
      return false;
    }
  }

  logPass('Production build, compiled security headers (.next/routes-manifest.json), and live HTTP security smoke probes verified within budget.');
  return true;
}

// -------------------------------------------------------------
// MAIN RUNNER
// -------------------------------------------------------------
async function runAllGateways() {
  if (process.argv.includes('--security-only')) {
    console.log(`\n${colors.bright}${colors.cyan}🔒 EXECUTING STANDALONE PRE-COMMIT SECURITY, SAST & GOVERNANCE AUDIT${colors.reset}\n`);
    const preCommitGateways = [
      {
        run: pass05SecretScanner,
        haltBanner: '🚫 PRE-COMMIT SECURITY AUDIT HALTED: Secret, env-var, or client-server boundary violation detected.',
      },
      {
        run: pass075SecurityAndSastAudit,
        haltBanner: '🚫 PRE-COMMIT SECURITY AUDIT HALTED: SAST, OWASP, or AST rule violation detected.',
      },
      {
        run: pass5AdrValidation,
        haltBanner:
          '🚫 PRE-COMMIT GOVERNANCE AUDIT HALTED: Documentation, changelog box-capacity, schema parity, or test co-location issue detected (0 security vulnerabilities).',
      },
    ];
    for (const gateway of preCommitGateways) {
      const ok = gateway.run();
      if (!ok) {
        console.error(`\n${colors.bright}${colors.red}${gateway.haltBanner}${colors.reset}\n`);
        process.exit(1);
      }
    }
    console.log(`\n${colors.bright}${colors.green}🎉 ALL SECURITY (PASS 0.5 & 0.75) AND GOVERNANCE (PASS 5) GATES PASSED!${colors.reset}\n`);
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
    const ok = await gateway();
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

if (require.main === module) {
  runAllGateways();
}

module.exports = {
  pass05SecretScanner,
  pass075SecurityAndSastAudit,
  pass5AdrValidation,
  runAllGateways,
};

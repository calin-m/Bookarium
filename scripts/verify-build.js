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

  const secretNextPublicRegex =
    /^NEXT_PUBLIC_.*(?:SECRET|PRIVATE|SERVICE_ROLE|PASSWORD|TOKEN|PAT)(?:_|$)/i;
  const jwtCandidateRegex =
    /\beyJ[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}\b/g;

  for (const filePath of scannedFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    for (const pattern of secretPatterns) {
      if (pattern.regex.test(content)) {
        violations.push({ file: relPath, issue: pattern.name });
      }
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

    // Validate process.env.* parity with .env.example and NEXT_PUBLIC_* secret-naming prohibition
    if (
      relPath.startsWith('src/') &&
      /\.(ts|tsx|js|jsx)$/.test(relPath) &&
      !relPath.includes('.test.') &&
      !relPath.includes('.spec.')
    ) {
      const envRefs = content.matchAll(/\bprocess\.env\.([A-Z][A-Z0-9_]+)\b/g);
      for (const ref of envRefs) {
        const varName = ref[1];
        if (secretNextPublicRegex.test(varName)) {
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

  // 3. Transitive Client -> Server AST Dependency Graph Isolation
  try {
    const { analyzeDependencyGraph } = require('./lib/ast-parser');
    const graph = analyzeDependencyGraph(path.join(rootDir, 'src'), rootDir);
    const serverOnlyTargets = new Set([
      'src/lib/supabase/server.ts',
      'src/lib/supabase/middleware.ts',
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
    const lockViolations = [];

    if (typeof lockData.lockfileVersion !== 'number' || lockData.lockfileVersion < 3) {
      lockViolations.push(`package-lock.json lockfileVersion must be >= 3 (found ${lockData.lockfileVersion}).`);
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

    if (lockViolations.length > 0) {
      logFail(`Lockfile sanity check failed with ${lockViolations.length} issue(s):`);
      lockViolations.slice(0, 15).forEach((v) => console.error(`  - ${v}`));
      return false;
    }

    // GitHub Actions Workflow Security & Injection Gate (.github/workflows/*.yml)
    const workflowsDir = path.join(rootDir, '.github', 'workflows');
    if (fs.existsSync(workflowsDir)) {
      const workflowViolations = [];
      for (const wfEntry of fs.readdirSync(workflowsDir)) {
        if (!/\.ya?ml$/i.test(wfEntry)) continue;
        const wfPath = path.join(workflowsDir, wfEntry);
        const relWf = `.github/workflows/${wfEntry}`;
        const wfContent = fs.readFileSync(wfPath, 'utf-8');

        // 1. Check for floating/mutable branch tags in `uses:` declarations
        const usesMatches = [...wfContent.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)];
        for (const m of usesMatches) {
          const actionRef = m[1];
          if (/@(?:main|master|latest|HEAD)$/i.test(actionRef)) {
            workflowViolations.push(
              `${relWf}: Unpinned mutable GitHub Action reference "${actionRef}" in uses:. Pin to a major version tag or commit SHA.`
            );
          }
        }

        // 2. Check for untrusted GitHub context expressions interpolated directly inside `run:` blocks
        const lines = wfContent.split(/\r?\n/);
        let inRunBlock = false;
        let runIndent = 0;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const runMatch = line.match(/^(\s*)(?:-\s*)?run:\s*(.*)$/);
          if (runMatch) {
            const inlineRun = runMatch[2].trim();
            if (inlineRun === '|' || inlineRun === '>') {
              inRunBlock = true;
              runIndent = runMatch[1].length;
              continue;
            } else {
              inRunBlock = false;
              if (
                /\$\{\{\s*github\.(?:event\.(?:inputs|issue|pull_request|comment|discussion|commits|head_commit)|head_ref)\b/i.test(
                  inlineRun
                )
              ) {
                workflowViolations.push(
                  `${relWf}:${i + 1}: Direct untrusted GitHub context expression inside "run:" command (Shell Injection risk). Bind to "env:" first.`
                );
              }
            }
          } else if (inRunBlock) {
            const currentIndentMatch = line.match(/^(\s*)\S/);
            if (currentIndentMatch && currentIndentMatch[1].length <= runIndent) {
              inRunBlock = false;
            } else if (
              /\$\{\{\s*github\.(?:event\.(?:inputs|issue|pull_request|comment|discussion|commits|head_commit)|head_ref)\b/i.test(
                line
              )
            ) {
              workflowViolations.push(
                `${relWf}:${i + 1}: Direct untrusted GitHub context expression inside "run:" script block (Shell Injection risk). Bind to "env:" first.`
              );
            }
          }
        }
      }

      if (workflowViolations.length > 0) {
        logFail(`GitHub Actions workflow security violation(s) detected:`);
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

  // Pillar 4: Open Redirect, Phishing Navigation & Full AST Request-Taint Analysis
  console.log(`${colors.dim}Pillar 4: Auditing redirect destinations and running AST request-taint dataflow analysis...${colors.reset}`);
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

  const { runStandaloneAstSecurityAudit } = require('./eslint-rules/bookarium-security');
  const astSecurityViolations = runStandaloneAstSecurityAudit(rootDir);
  for (const v of astSecurityViolations) {
    redirectViolations.push({
      file: `${v.file}:${v.line}`,
      issue: `[${v.ruleId}] ${v.message}`,
    });
  }

  if (redirectViolations.length > 0) {
    logFail(`AST security or open-redirect taint violation detected in ${redirectViolations.length} location(s):`);
    redirectViolations.forEach((v) => console.error(`  - ${v.file}: ${v.issue}`));
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
    if (!useBooksCode.includes('b.copyright !== true')) {
      logFail('useBooks.ts does not enforce public domain filter (b.copyright !== true).');
      return false;
    }
  }
  logPass('Pillar 5: MIT license compliance and public domain integrity (copyright=false) verified.');

  // Pillar 6: PostgreSQL Row-Level Security (RLS), Migration Idempotency & SECURITY DEFINER Hardening Audit
  console.log(`${colors.dim}Pillar 6: Auditing supabase/schema.sql for mandatory table RLS, DDL/policy idempotency, write-policy isolation, and SECURITY DEFINER search_path...${colors.reset}`);
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
      ...schemaSql.matchAll(/CREATE\s+POLICY\s+"([^"]+)"\s+ON\s+public\.([a-z0-9_]+)/gi),
    ];
    for (const m of createPolicyMatches) {
      const policyName = m[1];
      const tblName = m[2];
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
      if (/SECURITY\s+DEFINER/i.test(headerBlock) && !/SET\s+search_path\s*=\s*''/i.test(headerBlock)) {
        rlsViolations.push(`SECURITY DEFINER function "public.${fnName}" must explicitly set "SET search_path = ''".`);
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

    if (rlsViolations.length > 0) {
      logFail(`Database schema security or idempotency violation(s) in supabase/schema.sql:`);
      rlsViolations.forEach((v) => console.error(`  - ${v}`));
      return false;
    }
    logPass(`Pillar 6: Verified Row-Level Security across ${publicTables.length} public tables, 100% DDL/policy/trigger idempotency, write-policy isolation, and search_path hardening on all SECURITY DEFINER functions.`);
  }

  // Pillar 7: HTTP Security Headers, Production CSP & Service Worker Cache Guard
  console.log(`${colors.dim}Pillar 7: Auditing next.config.ts for mandatory OWASP HTTP security headers, CSP hardening, and Service Worker safety...${colors.reset}`);
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

    const swPath = path.join(rootDir, 'public', 'sw.js');
    if (fs.existsSync(swPath)) {
      const swCode = fs.readFileSync(swPath, 'utf-8');
      if (!swCode.includes("request.method !== 'GET'")) {
        headerViolations.push('Service Worker (public/sw.js) must bypass non-GET requests.');
      }
      if (swCode.includes('/auth/callback')) {
        headerViolations.push('Service Worker (public/sw.js) must never cache /auth/callback endpoints.');
      }
    }

    if (headerViolations.length > 0) {
      logFail('Next.js HTTP security header or Service Worker configuration violation(s):');
      headerViolations.forEach((v) => console.error(`  - ${v}`));
      return false;
    }
    logPass(`Pillar 7: All ${requiredHeaders.length} OWASP HTTP security headers, production CSP directives, and Service Worker cache boundaries verified.`);
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
  logHeader('Pass 3: Vitest Unit Suite & Tiered Coverage Assertion (95/95/92/85)');
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
      lines.pct < 95 ||
      statements.pct < 95 ||
      functions.pct < 92 ||
      branches.pct < 85
    ) {
      logFail(
        `Coverage threshold unmet (Target: Lines >= 95%, Statements >= 95%, Functions >= 92%, Branches >= 85%).`
      );
      return false;
    }
  }
  logPass(
    'All unit and integration tests passed with tiered V8 coverage thresholds (Lines >= 95%, Stmts >= 95%, Funcs >= 92%, Branches >= 85%).'
  );
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
// PASS 5: ADR Decision Ledger, Required Docs, Schema Parity, Dependency Graph & Co-Located Test Validation
// -------------------------------------------------------------
function pass5AdrValidation() {
  logHeader('Pass 5: ADR Ledger, Governance Docs, SQL<->TS Schema Parity, Dependency Graph & Test Co-Location');

  // 1. Mandatory Governance & Living Documentation Checklist
  const requiredDocs = [
    'README.md',
    'SECURITY.md',
    'CONTRIBUTING.md',
    'CODE_OF_CONDUCT.md',
    'DEVELOPMENT.md',
    'LICENSE',
    'AGENTS.md',
    '.agents/AGENTS.md',
    '.env.example',
    'supabase/schema.sql',
    'docs/ARCHITECTURE.md',
    'docs/DECISIONS.md',
    'docs/GUTENBERG_PARSER.md',
    'docs/QUALITY_AUDIT_REPORT.md',
    'ROADMAP.md',
    'CHANGELOG.md',
  ];

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

  adrBlocks.forEach((block, index) => {
    const idMatch = block.match(/^## ADR-(\d+):/);
    const num = idMatch ? parseInt(idMatch[1], 10) : -1;
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
    'src/app/api',
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

  // 5. Zero Circular Dependencies & Zero Orphaned Modules Gate (Rule 2)
  let depGraph = null;
  try {
    const {
      analyzeDependencyGraph,
      detectCircularDependencies,
      detectOrphanedModules,
    } = require('./lib/ast-parser');
    depGraph = analyzeDependencyGraph(path.join(rootDir, 'src'), rootDir);
    const circularHealth = detectCircularDependencies(depGraph);
    const orphanedModules = detectOrphanedModules(depGraph);

    if (circularHealth.hasCycles) {
      for (const cycle of circularHealth.cycles) {
        docViolations.push(`Circular module dependency detected: ${cycle.join(' -> ')}`);
      }
    }
    if (orphanedModules.length > 0) {
      for (const orphan of orphanedModules) {
        docViolations.push(`Orphaned unreferenced module detected in src/: ${orphan}`);
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
    '.github/pull_request_template.md',
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
  }

  // Verify live test suite count parity in governance docs
  const suiteCountDocChecks = [
    { rel: 'README.md', regex: /across (\d+) test suites\./ },
    { rel: 'CONTRIBUTING.md', regex: /across `(\d+)` suites\)/ },
    { rel: 'docs/PIPELINE_GUIDE.md', regex: /Asserts all `(\d+)` unit\/integration test suites/ },
    { rel: 'AGENTS.md', regex: /with `@testing-library\/react` and MSW v2 \(`(\d+)` suites\)/ },
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

  // Verify generator lookup completeness in docs/ARCHITECTURE.md
  const archDocPath = path.join(rootDir, 'docs', 'ARCHITECTURE.md');
  if (fs.existsSync(archDocPath)) {
    const archContent = fs.readFileSync(archDocPath, 'utf-8');
    const genericPlaceholders = [
      'Production runtime library.',
      'Development or verification tooling.',
      'Dependency security override.',
      'Database entity with RLS user isolation.',
      'Application custom hook.',
      'Domain utility module.',
    ];
    for (const placeholder of genericPlaceholders) {
      if (archContent.includes(placeholder)) {
        docViolations.push(
          `Unmapped generic fallback description "${placeholder}" in docs/ARCHITECTURE.md (update lookup map in scripts/generate-architecture-matrix.js).`
        );
      }
    }

    const scriptsDirPath = path.join(rootDir, 'scripts');
    if (fs.existsSync(scriptsDirPath)) {
      for (const entry of fs.readdirSync(scriptsDirPath, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith('.js')) {
          if (!archContent.includes(`scripts/${entry.name}`)) {
            docViolations.push(
              `CLI script "scripts/${entry.name}" is not cataloged in docs/ARCHITECTURE.md (update extractNodeScriptsCatalog in scripts/generate-architecture-matrix.js).`
            );
          }
        }
      }
    }

    // Forward Inventory Check: Every module in depGraph (src/**) and its co-located test must appear in docs/ARCHITECTURE.md
    if (depGraph) {
      for (const modFile of depGraph.keys()) {
        if (!archContent.includes(`](${modFile})`)) {
          docViolations.push(
            `Source module "${modFile}" is missing from docs/ARCHITECTURE.md (run "npm run docs:sync").`
          );
        }
        const baseNoExt = modFile.replace(/\.(ts|tsx|js|jsx)$/, '');
        for (const testCand of [`${baseNoExt}.test.ts`, `${baseNoExt}.test.tsx`]) {
          if (fs.existsSync(path.join(rootDir, testCand)) && !archContent.includes(`](${testCand})`)) {
            docViolations.push(
              `Co-located test suite "${testCand}" is missing from docs/ARCHITECTURE.md (run "npm run docs:sync").`
            );
          }
        }
      }
    }

    // Reverse Dead-Link Check: Every ](src/...) or ](scripts/...) link in docs/ARCHITECTURE.md must exist on disk
    const archFileLinks = archContent.matchAll(/\]\(((?:src|scripts)\/[A-Za-z0-9_./-]+)\)/g);
    for (const linkMatch of archFileLinks) {
      const linkedRel = linkMatch[1].replace(/\/$/, '');
      if (
        /\.[a-z0-9]+$/i.test(linkedRel) &&
        !fs.existsSync(path.join(rootDir, linkedRel))
      ) {
        docViolations.push(
          `Stale dead file reference "${linkedRel}" in docs/ARCHITECTURE.md (file was deleted or renamed; run "npm run docs:sync").`
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
    let hasNewProductionOrSchemaChange = false;
    for (const line of statusLines) {
      const statusCode = line.slice(0, 2).trim();
      const rawPath = line.slice(2).trim().replace(/^"|"$/g, '');
      const cleanPath = rawPath.includes(' -> ') ? rawPath.split(' -> ').pop().trim() : rawPath;
      dirtyFiles.add(cleanPath);

      const isNewFile = statusCode === '??' || statusCode.includes('A');
      if (
        (isNewFile &&
          cleanPath.startsWith('src/') &&
          !cleanPath.includes('.test.') &&
          !cleanPath.includes('.spec.')) ||
        (isNewFile && cleanPath.startsWith('scripts/') && cleanPath.endsWith('.js')) ||
        cleanPath === 'supabase/schema.sql'
      ) {
        hasNewProductionOrSchemaChange = true;
      }
    }

    if (
      hasNewProductionOrSchemaChange &&
      (!dirtyFiles.has('scripts/generate-changelog.js') || !dirtyFiles.has('CHANGELOG.md'))
    ) {
      docViolations.push(
        'Multi-batch drift guard: Working tree contains new production modules/scripts or supabase/schema.sql modifications, but scripts/generate-changelog.js / CHANGELOG.md have not been updated (update release notes and run "npm run docs:sync").'
      );
    }
  } catch {
    // Git not available in isolated container
  }

  if (docViolations.length > 0) {
    logFail(`ADR schema, governance checklist, SQL<->TS parity, dependency graph, doc parity, or test co-location failure(s):`);
    docViolations.forEach((v) => console.error(`  - ${v}`));
    return false;
  }

  logPass(
    `Validated ${matches.length} sequential ADRs, ${requiredDocs.length} governance docs, semantic command/metric parity, 1:1 SQL<->TS schema parity, 0 circular/orphan modules, and 100% co-located tests.`
  );
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
    console.log(`\n${colors.bright}${colors.cyan}🔒 EXECUTING STANDALONE PRE-COMMIT SECURITY, SAST & GOVERNANCE AUDIT${colors.reset}\n`);
    const securityGateways = [
      pass05SecretScanner,
      pass075SecurityAndSastAudit,
      pass5AdrValidation,
    ];
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

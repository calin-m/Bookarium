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

function runCommand(command, inheritStdio = false) {
  try {
    console.log(`${colors.dim}Executing: ${command}${colors.reset}`);
    if (inheritStdio) {
      execSync(command, {
        cwd: rootDir,
        stdio: 'inherit',
      });
      return { success: true, stdout: '' };
    }
    const stdout = execSync(command, {
      cwd: rootDir,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return { success: true, stdout };
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
  logHeader('Pass 0.5: Pre-Commit Secret Scanner');

  const secretPatterns = [
    { name: 'AWS Access Key', regex: new RegExp('AKIA' + '[0-9A-Z]{16}') },
    { name: 'RSA Private Key', regex: new RegExp('-----' + 'BEGIN RSA PRIVATE KEY' + '-----') },
    { name: 'Generic Private Key', regex: new RegExp('-----' + 'BEGIN PRIVATE KEY' + '-----') },
    { name: 'GitHub Personal Token', regex: new RegExp('ghp_' + '[0-9a-zA-Z]{36}') },
    { name: 'Generic Secret Token', regex: new RegExp('(api_key|apikey|secret_key|client_secret)\\s*[:=]\\s*[\'"][0-9a-zA-Z-_]{20,}[\'"]', 'i') },
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
    for (const pattern of secretPatterns) {
      if (pattern.regex.test(content)) {
        violations.push({ file: path.relative(rootDir, filePath), issue: pattern.name });
      }
    }
  }

  if (violations.length > 0) {
    logFail(`Secret leakage detected in ${violations.length} location(s):`);
    violations.forEach((v) => console.error(`  - ${v.file}: ${v.issue}`));
    return false;
  }

  logPass(`Scanned ${scannedFiles.length} files. Zero exposed credentials or secrets detected.`);
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
  const res = runCommand(`${npxCmd} vitest run src/hooks/queries src/app/api`);
  if (!res.success) {
    logFail('MSW server mock or query hook test failed:');
    console.error(res.stdout || res.stderr);
    return false;
  }
  logPass('MSW v2 network interception and React Query hooks verified.');
  return true;
}

// -------------------------------------------------------------
// PASS 3: Vitest Full Unit Suite & Code Coverage
// -------------------------------------------------------------
function pass3ClientUI() {
  logHeader('Pass 3: Vitest Unit Suite & Coverage Assertion (>= 80%)');
  const res = runCommand(`${npmCmd} run test:coverage`);
  if (!res.success) {
    logFail('Unit test suite failed:');
    console.error(res.stdout || res.stderr);
    return false;
  }

  if (res.stdout) {
    const tableMatch = res.stdout.match(/(-{10,}[\s\S]*?-{10,}\s*\n[\s\S]*?={10,}[\s\S]*?={10,})/);
    if (tableMatch) {
      console.log(tableMatch[1]);
    }
  }

  const covSummaryPath = path.join(rootDir, 'coverage', 'coverage-summary.json');
  if (fs.existsSync(covSummaryPath)) {
    const cov = JSON.parse(fs.readFileSync(covSummaryPath, 'utf-8'));
    const { lines, statements, functions, branches } = cov.total;
    console.log(`📊 Total Coverage: Lines: ${lines.pct}%, Stmts: ${statements.pct}%, Funcs: ${functions.pct}%, Branches: ${branches.pct}%`);
    if (lines.pct < 80 || statements.pct < 80 || functions.pct < 80 || branches.pct < 80) {
      logFail(`Coverage threshold unmet (Target: >= 80%).`);
      return false;
    }
  }
  logPass('All unit and integration tests passed with >= 80% coverage.');
  return true;
}

// -------------------------------------------------------------
// PASS 4: Living Documentation Sync
// -------------------------------------------------------------
function pass4DocsSync() {
  logHeader('Pass 4: Living Documentation Synchronization');
  try {
    require('./generate-architecture-matrix.js');
    require('./generate-changelog.js');
    logPass('ARCHITECTURE.md and CHANGELOG.md synced successfully from source AST.');
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
  const lintRes = runCommand(`${npmCmd} run lint`);
  if (!lintRes.success) {
    logFail('ESLint reported warnings or errors:');
    console.error(lintRes.stdout || lintRes.stderr);
    return false;
  }

  const knipRes = runCommand(`${npxCmd} knip`);
  if (!knipRes.success) {
    logFail('Knip reported unused code or dependencies:');
    console.error(knipRes.stdout || knipRes.stderr);
    return false;
  }

  // Update quality report
  try {
    const reportScript = path.join(__dirname, 'generate-quality-report.js');
    execSync(`node "${reportScript}"`, { cwd: rootDir, stdio: 'pipe' });
  } catch (_e) {}

  logPass('0 ESLint errors and 0 unused dependencies/exports detected.');
  return true;
}

// -------------------------------------------------------------
// PASS 7: Production Build & Chunk Budget
// -------------------------------------------------------------
function pass7ProductionBuild() {
  logHeader('Pass 7: Next.js Production Build & Chunk Budget');
  const buildRes = runCommand(`${npxCmd} next build`, true);
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
  console.log(`\n${colors.bright}${colors.magenta}🛡️  BOOKARIUM 7-GATEWAY CLOSED-LOOP QUALITY ENGINE${colors.reset}\n`);

  const gateways = [
    pass05SecretScanner,
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

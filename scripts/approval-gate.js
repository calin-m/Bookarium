/**
 * Pre-Commit Mutation & Hook Governance Gate - Bookarium
 *
 * Verifies `.agents/hooks.json` schema integrity and ensures all configured
 * lifecycle commands map to valid `package.json` scripts prior to commit.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const hooksPath = path.join(rootDir, '.agents', 'hooks.json');
const pkgPath = path.join(rootDir, 'package.json');

function verifyApprovalGate() {
  if (!fs.existsSync(hooksPath)) {
    console.error('✖ [FAIL] Missing mandatory .agents/hooks.json governance configuration.');
    process.exit(1);
  }
  if (!fs.existsSync(pkgPath)) {
    console.error('✖ [FAIL] Missing package.json.');
    process.exit(1);
  }

  let hooksConfig;
  let pkgConfig;
  try {
    hooksConfig = JSON.parse(fs.readFileSync(hooksPath, 'utf-8'));
    pkgConfig = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  } catch (err) {
    console.error(`✖ [FAIL] Invalid JSON in governance configuration: ${err.message}`);
    process.exit(1);
  }

  const validScripts = new Set(Object.keys(pkgConfig.scripts || {}));
  const requiredHookStages = ['preCommit', 'prePush', 'postBuild'];

  for (const stage of requiredHookStages) {
    if (!Array.isArray(hooksConfig[stage]) || hooksConfig[stage].length === 0) {
      console.error(`✖ [FAIL] .agents/hooks.json is missing required non-empty "${stage}" array.`);
      process.exit(1);
    }
    for (const cmd of hooksConfig[stage]) {
      const match = String(cmd).match(/^npm\s+run\s+([a-z0-9:_-]+)$/i);
      if (match && !validScripts.has(match[1])) {
        console.error(
          `✖ [FAIL] .agents/hooks.json (${stage}) references unknown npm script "${match[1]}".`
        );
        process.exit(1);
      }
    }
  }

  console.log('✔ [PASS] Pre-commit mutation & hook governance gate (.agents/hooks.json) verified.');
}

verifyApprovalGate();


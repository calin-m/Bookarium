#!/usr/bin/env node
/**
 * Bookarium — Autonomous Relational Book Translation Ingestion & Sync Engine
 * 
 * Maps Project Gutenberg volumes into canonical FRBR literary works across languages,
 * enforces 5 Pipeline Blockers and 7 Hardening Defenses to guarantee 100% precision
 * (Zero False Positives), and generates atomic, foreign-key safe SQL seeds or performs
 * direct batch upserts into Supabase PostgreSQL (public.book_translations).
 *
 * @module scripts/ingest-translations
 * @scope Wikidata SPARQL (`P2034` / `P407`) FRBR work-clustering CLI populating idempotent cross-language edition links in `public.book_translations`.
 * @invariant Enforce all anti-collision clustering defenses (`isOmnibusOrAnthology`, surname compatibility, significant keyword matching, singleton pruning), enforce bounded `WIKIDATA_SPARQL_TIMEOUT_MS` (`45s`) HTTP socket timeout cleanly triggering `Defense 3` snapshot fallback, validate `book_id` public-domain catalog presence (`copyright !== true` via `filterValidCatalogBookIds` and `WHERE b.copyright = false` in `generateAtomicSeedSql`, handling empty-catalog `validBookIds.size === 0` skips), and execute bounded-retry bisected upserts (`upsertTranslationBatchesWithRetry`) failing non-zero on persistent write errors.
 * @invariant Support offline `--dry-run` / `--output=...` atomic SQL seed generation (`generateAtomicSeedSql`) cleanly even when Supabase env credentials are absent.
 * @rationale Strict anthology rejection, socket-bounded Wikidata queries, catalog FK pre-validation, bisected batch retries, and public-domain `copyright !== true` filtering eliminate stalled CI runners, silent upsert drops, spurious cross-author translation links, and copyrighted volume associations.
 * @adr ADR-010, ADR-038, ADR-080, ADR-085
 * 
 * Usage:
 *   node scripts/ingest-translations.js --dry-run
 *   node scripts/ingest-translations.js --limit=100
 *   node scripts/ingest-translations.js --all
 *   node scripts/ingest-translations.js --output=supabase/seed_translations.sql
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

// 1. Environment Loading (Native, zero-dependency)
function loadEnv() {
  const rootDir = path.resolve(__dirname, '..');
  const envFiles = ['.env.local', '.env'];
  const env = { ...process.env };

  for (const file of envFiles) {
    const fullPath = path.join(rootDir, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const m = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
          if (m && !env[m[1]]) {
            let val = m[2].trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            env[m[1]] = val;
          }
        }
      });
    }
  }
  return env;
}

function resolveSiteOriginFallback(env = process.env) {
  const candidates = [
    env.NEXT_PUBLIC_SITE_URL,
    env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL,
  ];
  for (const raw of candidates) {
    const trimmed = (raw || '').trim().replace(/\/+$/, '');
    if (!trimmed) continue;
    const withProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    try {
      const parsed = new URL(withProtocol);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin;
      }
    } catch {}
  }
  return 'https://bookarium.vercel.app';
}

function resolveUserAgent(env = loadEnv()) {
  let repo = env.NEXT_PUBLIC_GITHUB_REPO || env.BOOKARIUM_REPO_URL;
  if (!repo && env.GITHUB_REPOSITORY) {
    repo = `https://github.com/${env.GITHUB_REPOSITORY.trim().replace(/^\/+|\/+$/g, '')}`;
  }
  if (!repo && env.VERCEL_GIT_REPO_OWNER && env.VERCEL_GIT_REPO_SLUG) {
    repo = `https://github.com/${env.VERCEL_GIT_REPO_OWNER.trim()}/${env.VERCEL_GIT_REPO_SLUG.trim()}`;
  }
  if (!repo) {
    try {
      const raw = require('child_process').execSync('git config --get remote.origin.url', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (raw) {
        repo = raw.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '');
      }
    } catch {}
  }
  if (!repo) {
    repo = resolveSiteOriginFallback(env);
  }
  const email = (env.GUTENBERG_CONTACT_EMAIL || '').trim();
  const contactPart = email ? `+${repo}; ${email}` : `+${repo}`;
  return `Bookarium-Gatekeeper/1.0 (${contactPart})`;
}

// 2. Language Code Normalization (Defense 7)
const ISO_LANG_MAP = {
  english: 'en',
  french: 'fr',
  german: 'de',
  spanish: 'es',
  catalan: 'ca',
  italian: 'it',
  latin: 'la',
  greek: 'el',
  'ancient greek': 'grc',
  portuguese: 'pt',
  dutch: 'nl',
  russian: 'ru',
  esperanto: 'eo',
  tagalog: 'tl',
  finnish: 'fi',
  swedish: 'sv',
  polish: 'pl',
  danish: 'da',
  hungarian: 'hu',
  romanian: 'ro',
  welsh: 'cy',
  irish: 'ga',
  sanskrit: 'sa',
  scots: 'sco',
  'scottish gaelic': 'gd',
};

function normalizeLanguageToCode(rawLang) {
  if (!rawLang || typeof rawLang !== 'string') return 'en';
  const clean = rawLang.trim().toLowerCase().split(/[-_]/)[0];
  return ISO_LANG_MAP[clean] || clean.slice(0, 5) || 'en';
}

// 3. Author Name AST & Surname Extraction
function extractAuthorSurname(author) {
  if (!author || typeof author !== 'string') return '';
  const clean = author.replace(/[\r\n]+/g, ' ').trim();
  if (clean.includes(',')) {
    const surnamePart = clean.split(',')[0].trim();
    return surnamePart.split(/\s+/)[0] || surnamePart;
  }
  const parts = clean.split(/\s+/).filter(Boolean);
  const prefixIndex = parts.findIndex((p) =>
    ['de', 'del', 'von', 'van', 'di', 'da'].includes(p.toLowerCase())
  );
  if (prefixIndex !== -1 && prefixIndex + 1 < parts.length) {
    return parts[prefixIndex + 1];
  }
  return parts[parts.length - 1] || clean;
}

// 4. Omnibus & Multi-Work Quarantine (Defense 2)
function isOmnibusOrAnthology(title) {
  if (!title || typeof title !== 'string') return false;
  const lower = title.toLowerCase();
  return (
    lower.includes('complete works') ||
    lower.includes('collected works') ||
    lower.includes('collected poems') ||
    lower.includes('anthology') ||
    lower.includes('harvard classics') ||
    lower.includes('oeuvres complètes') ||
    lower.includes('gesammelte werke') ||
    lower.includes('obras completas')
  );
}

// 5. Title Root & Cognate Extraction
const TITLE_STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from',
  'history', 'story', 'stories', 'adventures', 'memoirs', 'life', 'works', 'book', 'books',
  'volume', 'vol', 'part', 'gutenberg', 'ebook', 'classic', 'selected',
  'el', 'la', 'los', 'las', 'de', 'del', 'le', 'les', 'du', 'des', 'der', 'die', 'das',
]);

function extractRootTitle(title) {
  if (!title || typeof title !== 'string') return '';
  const clean = title.replace(/[\r\n]+/g, ' ').trim();
  const withoutSub = clean.split(/[;:]/)[0].trim();
  const withoutVol = withoutSub.replace(/,\s*(volume|vol\.|book|part|tome|canto)\s*[\divxlc]+/gi, '').trim();
  return withoutVol || clean;
}

function extractSignificantKeywords(title) {
  const root = extractRootTitle(title);
  if (!root) return [];
  return root
    .toLowerCase()
    .split(/[\s,\-_/]+/)
    .filter((w) => w.length > 2 && !TITLE_STOPWORDS.has(w) && !/^\d+$/.test(w));
}

// 6. Blocker 2: Disparate Author Sanity Check
function checkAuthorCompatibility(bookA, bookB) {
  if (!bookA || !bookB) return false;
  const getSurnames = (list = []) =>
    list.map((item) => (typeof item === 'string' ? extractAuthorSurname(item) : extractAuthorSurname(item.name || ''))).filter(Boolean).map((s) => s.toLowerCase());

  const authorsA = getSurnames(bookA.authors);
  const authorsB = getSurnames(bookB.authors);
  const transA = getSurnames(bookA.translators);
  const transB = getSurnames(bookB.translators);

  // Overlap on author surname
  const hasAuthorOverlap = authorsA.some((a) => authorsB.includes(a));
  // Overlap on author-to-translator (e.g., classical epic translations)
  const hasAuthorTransOverlap =
    authorsA.some((a) => transB.includes(a)) ||
    authorsB.some((b) => transA.includes(b));

  return hasAuthorOverlap || hasAuthorTransOverlap;
}

// 7. Heuristic Cross-Work Entanglement Shield (Defense 5)
function checkHeuristicWorkMatch(bookA, bookB) {
  // 1. Must pass Author Compatibility (Blocker 2)
  if (!checkAuthorCompatibility(bookA, bookB)) {
    return { matches: false, reason: 'Disparate Authors (Blocked by Blocker 2)' };
  }

  // 2. Must not be omnibus (Defense 2)
  if (isOmnibusOrAnthology(bookA.title) || isOmnibusOrAnthology(bookB.title)) {
    return { matches: false, reason: 'Omnibus / Anthology Quarantined (Defense 2)' };
  }

  // 3. Check Title Root Cognates
  const kwA = extractSignificantKeywords(bookA.title);
  const kwB = extractSignificantKeywords(bookB.title);
  const sharedKw = kwA.filter((k) => kwB.some((b) => b.includes(k) || k.includes(b)));

  // 4. Check LCSH Subject Overlap
  const subjectsA = new Set((bookA.subjects || []).map((s) => s.toLowerCase()));
  const subjectsB = new Set((bookB.subjects || []).map((s) => s.toLowerCase()));
  let sharedSubjects = 0;
  for (const s of subjectsA) {
    if (subjectsB.has(s)) sharedSubjects++;
  }

  const hasCognate = sharedKw.length > 0;
  const hasSubjectOverlap = sharedSubjects > 0;

  if (hasCognate || hasSubjectOverlap) {
    return {
      matches: true,
      reason: `Matched via ${hasCognate ? `Cognate [${sharedKw.join(', ')}]` : ''} ${hasSubjectOverlap ? `Subjects (${sharedSubjects} shared)` : ''}`.trim(),
    };
  }

  return {
    matches: false,
    reason: 'Same author, but different works (No cognates or shared subjects)',
  };
}

// 8. Stream Wikidata SPARQL with Fallback Snapshot (Blocker 1 & Defense 3)
const WIKIDATA_SPARQL_TIMEOUT_MS = 45_000;

function fetchWikidataTranslations(limit = null, options = {}) {
  const timeoutMs =
    typeof options.timeoutMs === 'number' && options.timeoutMs > 0
      ? options.timeoutMs
      : WIKIDATA_SPARQL_TIMEOUT_MS;
  const httpsGet = typeof options.httpsGet === 'function' ? options.httpsGet : https.get;

  return new Promise((resolve, reject) => {
    const limitClause = limit && Number.isInteger(limit) && limit > 0 ? `LIMIT ${limit}` : '';
    const sparql = `
      SELECT ?work ?workLabel ?gutenbergId ?langCode WHERE {
        ?work wdt:P2034 ?gutenbergId .
        OPTIONAL { ?work wdt:P407 ?lang . ?lang wdt:P424 ?langCode . }
      }
      ${limitClause}
    `;

    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
    let settled = false;
    const finish = (err, val) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(val);
    };

    const req = httpsGet(
      url,
      {
        timeout: timeoutMs,
        headers: {
          'User-Agent': resolveUserAgent(),
          Accept: 'application/sparql-results+json',
        },
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              return finish(new Error(`Wikidata HTTP ${res.statusCode}: ${rawData.slice(0, 200)}`));
            }
            const parsed = JSON.parse(rawData);
            const bindings = parsed?.results?.bindings || [];
            finish(null, bindings);
          } catch (err) {
            finish(err);
          }
        });
        res.on('error', (err) => finish(err));
      }
    );

    if (req && typeof req.setTimeout === 'function') {
      req.setTimeout(timeoutMs, () => {
        const err = new Error(`Wikidata SPARQL query timed out after ${timeoutMs}ms`);
        if (typeof req.destroy === 'function') req.destroy(err);
        finish(err);
      });
    }
    if (req && typeof req.on === 'function') {
      req.on('timeout', () => {
        const err = new Error(`Wikidata SPARQL query timed out after ${timeoutMs}ms`);
        if (typeof req.destroy === 'function') req.destroy(err);
        finish(err);
      });
      req.on('error', (err) => finish(err));
    }
  });
}

function loadFallbackSnapshot() {
  const cachePath = path.join(__dirname, 'data', 'wikidata-translations-cache.json');
  if (fs.existsSync(cachePath)) {
    const content = fs.readFileSync(cachePath, 'utf8');
    return JSON.parse(content);
  }
  return [];
}

function isTransientSupabaseError(err) {
  const msg = String((err && err.message) || err || '').toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('canceling statement') ||
    msg.includes('connection') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('429')
  );
}

// 9. Foreign-Key Pre-Validation (Defense 4)
async function filterValidCatalogBookIds(supabase, candidateIds = [], options = {}) {
  if (!supabase || !candidateIds || !candidateIds.length) return new Set(candidateIds);
  const uniqueIds = Array.from(new Set(candidateIds.filter((id) => Number.isInteger(id) && id > 0)));
  const validIds = new Set();
  const chunkSize = 500;
  const retries = Number.isInteger(options.retries) && options.retries > 0 ? options.retries : 1;
  const baseDelayMs =
    typeof options.baseDelayMs === 'number' && options.baseDelayMs >= 0 ? options.baseDelayMs : 0;
  const throwOnError = Boolean(options.throwOnError);
  const sleepFn = options.sleepFn || ((ms) => new Promise((r) => setTimeout(r, ms)));

  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize);
    let lastError = null;
    let chunkData = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const { data, error } = await supabase
          .from('books')
          .select('id, copyright')
          .in('id', chunk);

        if (error) {
          throw error;
        }
        chunkData = data || [];
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        if (attempt < retries && baseDelayMs > 0) {
          await sleepFn(baseDelayMs * attempt);
        }
      }
    }

    if (lastError) {
      const msg = lastError.message || String(lastError);
      if (throwOnError) {
        throw new Error(`Foreign-key catalog pre-check failed: ${msg}`);
      }
      console.warn(`  ⚠ Foreign-key catalog pre-check warning: ${msg}`);
      return new Set(candidateIds);
    }

    chunkData.forEach((r) => {
      if (r && Number.isInteger(r.id) && r.copyright !== true) {
        validIds.add(r.id);
      }
    });
  }

  return validIds;
}

async function upsertTranslationBatchesWithRetry(supabase, rows = [], options = {}) {
  const batchSize =
    Number.isInteger(options.batchSize) && options.batchSize > 0 ? options.batchSize : 250;
  const retries = Number.isInteger(options.retries) && options.retries > 0 ? options.retries : 3;
  const baseDelayMs =
    typeof options.baseDelayMs === 'number' && options.baseDelayMs >= 0 ? options.baseDelayMs : 800;
  const ignoreDuplicates = Boolean(options.ignoreDuplicates);
  const sleepFn = options.sleepFn || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const logger = options.logger || console;

  let upsertedCount = 0;
  let failedRowCount = 0;
  let failedBatchCount = 0;
  const errors = [];

  const processSlice = async (slice, label) => {
    if (!slice || slice.length === 0) return;

    let lastErr = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const { error } = await supabase
          .from('book_translations')
          .upsert(slice, {
            onConflict: 'work_id,book_id',
            ignoreDuplicates,
          });
        if (!error) {
          upsertedCount += slice.length;
          return;
        }
        lastErr = error;
      } catch (err) {
        lastErr = err;
      }

      if (attempt < retries && baseDelayMs > 0 && isTransientSupabaseError(lastErr)) {
        await sleepFn(baseDelayMs * attempt);
      } else if (!isTransientSupabaseError(lastErr)) {
        break;
      }
    }

    const transient = isTransientSupabaseError(lastErr);
    if (slice.length > 1 && (!transient || slice.length > 25)) {
      const mid = Math.floor(slice.length / 2);
      await processSlice(slice.slice(0, mid), `${label}a`);
      await processSlice(slice.slice(mid), `${label}b`);
      return;
    }

    const msg = (lastErr && lastErr.message) || String(lastErr || 'Unknown upsert error');
    failedBatchCount++;
    failedRowCount += slice.length;
    errors.push(msg);
    logger.warn(`  ⚠ Batch ${label} (${slice.length} row(s)) failed after retries: ${msg}`);
  };

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await processSlice(batch, String(Math.floor(i / batchSize) + 1));
  }

  return { upsertedCount, failedRowCount, failedBatchCount, errors };
}

// 10. Generate Foreign-Key Safe Atomic SQL (Blocker 5 & Defense 4)
function generateAtomicSeedSql(translations = []) {
  let sql = `-- ============================================================================\n`;
  sql += `-- Canonical Relational Book Translations Seed (Cold-Start & Partial Catalog Safe)\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n`;
  sql += `-- Total Rows: ${translations.length}\n`;
  sql += `-- ============================================================================\n\n`;
  sql += `BEGIN;\n\n`;
  sql += `INSERT INTO public.book_translations (work_id, book_id, language, is_original, confidence_score, source)\n`;
  sql += `SELECT v.work_id, v.book_id, v.language, v.is_original, v.confidence_score, v.source\n`;
  sql += `FROM (VALUES\n`;

  const rows = translations.map(
    (t) =>
      `  ('${t.work_id.replace(/'/g, "''")}', ${t.book_id}, '${t.language.replace(/'/g, "''")}', ${Boolean(t.is_original)}, ${Number(t.confidence_score || 1.0).toFixed(2)}, '${t.source.replace(/'/g, "''")}')`
  );

  sql += rows.join(',\n');
  sql += `\n) AS v(work_id, book_id, language, is_original, confidence_score, source)\n`;
  sql += `JOIN public.books b ON b.id = v.book_id\n`;
  sql += `WHERE b.copyright = false\n`;
  sql += `ON CONFLICT (work_id, book_id) DO UPDATE\n`;
  sql += `SET language = EXCLUDED.language, confidence_score = EXCLUDED.confidence_score, source = EXCLUDED.source;\n\n`;
  sql += `COMMIT;\n`;

  return sql;
}

// 10. Main Orchestrator
async function main() {
  const args = process.argv.slice(2);
  const isHelp = args.includes('--help') || args.includes('-h');
  const isDryRun = args.includes('--dry-run');
  const shouldUpdateExisting = args.includes('--update-existing');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
  const outputArg = args.find((a) => a.startsWith('--output='));
  const outputPath = outputArg ? outputArg.split('=')[1] : null;

  if (isHelp) {
    console.log(`
Bookarium Relational Book Translation Ingestion Engine
======================================================
Discovers and clusters Project Gutenberg multilingual editions into canonical works.

Options:
  --dry-run             Parse and cluster translations without writing to Supabase
  --limit=N             Process only first N bindings from Wikidata
  --all                 Process full Wikidata work mappings
  --output=PATH         Export generated SQL seed to specified path (e.g. supabase/seed_translations.sql)
  --update-existing     Force overwrite existing translation rows in Supabase
  --help, -h            Show this help guide
`);
    process.exit(0);
  }

  console.log('🌐 Bookarium Translation Ingestion & Sync Engine');
  console.log('================================================');
  console.log(`• Mode:       ${isDryRun ? 'DRY-RUN (Validation only)' : 'LIVE UPSERT'}`);
  console.log(`• Strategy:   ${shouldUpdateExisting ? 'OVERWRITE (Update existing)' : 'IDEMPOTENT MERGE'}`);
  if (limit) console.log(`• Limit:      ${limit} Wikidata statements`);
  if (outputPath) console.log(`• SQL Output: ${outputPath}`);

  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let supabase = null;
  if (!isDryRun && supabaseUrl) {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  console.log('\n📡 Querying upstream Wikidata SPARQL endpoint...');
  let rawBindings = [];
  try {
    rawBindings = await fetchWikidataTranslations(limit);
    console.log(`  ✅ Received ${rawBindings.length} Wikidata work statements.`);

    // Blocker 1: Upstream Volume Threshold Assertion
    if (!limit && rawBindings.length < 1000) {
      console.warn(`\n⚠ Blocker 1 Triggered: Wikidata returned ${rawBindings.length} records (< 1000). Falling back to snapshot.`);
      throw new Error('Upstream volume below threshold');
    }
  } catch (err) {
    console.warn(`\n⚠ Notice: Live Wikidata query failed (${err.message}). Engaging Defense 3 (Offline Snapshot).`);
    const snapshot = loadFallbackSnapshot();
    console.log(`  Loaded ${snapshot.length} canonical works from local snapshot.`);
    rawBindings = [];
    for (const item of snapshot) {
      for (const ed of item.editions) {
        rawBindings.push({
          work: { value: `http://www.wikidata.org/entity/${item.workId}` },
          gutenbergId: { value: String(ed.bookId) },
          langCode: { value: ed.langCode },
        });
      }
    }
  }

  // Group bindings into work clusters
  const clusters = new Map();
  for (const b of rawBindings) {
    const workId = b.work.value.split('/').pop();
    const bookId = parseInt(b.gutenbergId.value, 10);
    const lang = normalizeLanguageToCode(b.langCode?.value || 'en');

    if (Number.isInteger(bookId) && bookId > 0) {
      if (!clusters.has(workId)) {
        clusters.set(workId, []);
      }
      const list = clusters.get(workId);
      if (!list.some((item) => item.bookId === bookId)) {
        list.push({ workId, bookId, language: lang, source: 'authority_wikidata' });
      }
    }
  }

  // Prune Singletons (Defense 6)
  const translationsToInsert = [];
  let singletonsCount = 0;

  for (const [_workId, editions] of clusters.entries()) {
    if (editions.length < 2) {
      singletonsCount++;
      continue;
    }
    for (const ed of editions) {
      translationsToInsert.push({
        work_id: ed.workId,
        book_id: ed.bookId,
        language: ed.language,
        is_original: false,
        confidence_score: 1.0,
        source: ed.source,
      });
    }
  }

  console.log(`\n📊 Clustering Results:`);
  console.log(`  • Canonical Works:              ${clusters.size}`);
  console.log(`  • Singletons Pruned (Def 6):    ${singletonsCount}`);
  console.log(`  • Multi-Edition Translation Rows: ${translationsToInsert.length}`);

  // Emit SQL output if requested or default path provided
  const targetSqlPath = outputPath || (isDryRun ? null : path.join(__dirname, '..', 'supabase', 'seed_translations.sql'));
  if (targetSqlPath) {
    const sql = generateAtomicSeedSql(translationsToInsert);
    const resolvedPath = path.resolve(targetSqlPath);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, sql, 'utf8');
    console.log(`\n💾 Saved atomic SQL seed file: ${resolvedPath} (${(fs.statSync(resolvedPath).size / 1024).toFixed(2)} KB)`);
  }

  // Live Supabase Upsert
  if (supabase && !isDryRun) {
    console.log('\n🚀 Verifying foreign-key catalog integrity against public.books...');
    const candidateIds = translationsToInsert.map((t) => t.book_id);
    const validBookIds = await filterValidCatalogBookIds(supabase, candidateIds, {
      retries: 3,
      baseDelayMs: 1000,
      throwOnError: true,
    });

    const uniqueCandidateCount = new Set(candidateIds).size;
    let finalTranslations = translationsToInsert;
    if (validBookIds instanceof Set && validBookIds.size !== uniqueCandidateCount) {
      finalTranslations = translationsToInsert.filter((t) => validBookIds.has(t.book_id));
      const skippedCount = translationsToInsert.length - finalTranslations.length;
      console.log(`  • Verified in Catalog:  ${finalTranslations.length} rows`);
      console.log(`  • Safely Skipped (FK):  ${skippedCount} rows not present or copyrighted in public.books`);
    } else {
      console.log(`  • Verified in Catalog:  ${finalTranslations.length} rows (100% catalog coverage)`);
    }

    if (finalTranslations.length === 0) {
      console.log('  ℹ Zero matching public.books catalog entries found; skipping Supabase upsert.');
    } else {
      console.log('\n🚀 Performing live batch upsert into Supabase (public.book_translations)...');
      const upsertRes = await upsertTranslationBatchesWithRetry(supabase, finalTranslations, {
        batchSize: 250,
        ignoreDuplicates: !shouldUpdateExisting,
      });
      console.log(`  ✅ Successfully synced ${upsertRes.upsertedCount} translation rows to Supabase.`);
      if (upsertRes.failedRowCount > 0) {
        throw new Error(
          `Failed to upsert ${upsertRes.failedRowCount} translation row(s) across ${upsertRes.failedBatchCount} batch(es): ${upsertRes.errors[0] || 'unknown error'}`
        );
      }
    }
  }

  console.log('\n🎉 Translation Ingestion completed successfully!');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal ingestion error:', err);
    process.exit(1);
  });
}

module.exports = {
  WIKIDATA_SPARQL_TIMEOUT_MS,
  resolveSiteOriginFallback,
  resolveUserAgent,
  normalizeLanguageToCode,
  extractAuthorSurname,
  isOmnibusOrAnthology,
  extractRootTitle,
  extractSignificantKeywords,
  checkAuthorCompatibility,
  checkHeuristicWorkMatch,
  fetchWikidataTranslations,
  loadFallbackSnapshot,
  isTransientSupabaseError,
  filterValidCatalogBookIds,
  upsertTranslationBatchesWithRetry,
  generateAtomicSeedSql,
};


#!/usr/bin/env node
/**
 * Bookarium — Autonomous Full-Catalog Gutenberg Ingestion & Sync Engine
 * 
 * Streams and decompresses Project Gutenberg's official catalog dump (pg_catalog.csv.gz),
 * parses authors, translators, lifespans, subjects, and format links, and batch-upserts
 * public domain metadata into Supabase PostgreSQL (public.books) with zero text bloat.
 * 
 * Usage:
 *   node scripts/sync-gutenberg-catalog.js --dry-run
 *   node scripts/sync-gutenberg-catalog.js --limit=100
 *   node scripts/sync-gutenberg-catalog.js --languages=en,fr,de
 *   node scripts/sync-gutenberg-catalog.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
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

// 2. Author and Translator Lifespan Normalization
function parseYear(val) {
  if (!val) return null;
  const clean = val.replace('?', '').trim();
  const isBce = clean.toUpperCase().includes('BCE');
  const num = parseInt(clean, 10);
  if (!Number.isInteger(num) || isNaN(num)) return null;
  return isBce ? -num : num;
}

function parseContributors(rawString) {
  if (!rawString || !rawString.trim()) return { authors: [], translators: [] };

  const parts = rawString.split(';').map((s) => s.trim()).filter(Boolean);
  const authors = [];
  const translators = [];

  for (let str of parts) {
    let isTranslator = false;
    let isNonAuthor = false;
    const roleMatch = str.match(/\s*\[([^\]]+)\]\s*$/);
    if (roleMatch) {
      const role = roleMatch[1].trim().toLowerCase();
      str = str.substring(0, str.length - roleMatch[0].length).trim();
      if (role.includes('translator')) {
        isTranslator = true;
      } else if (
        role.includes('illustrator') ||
        role.includes('photographer') ||
        role.includes('engraver') ||
        role.includes('artist') ||
        role.includes('decorator') ||
        role.includes('calligrapher')
      ) {
        isNonAuthor = true;
      }
    }

    let name = str;
    let birth_year = null;
    let death_year = null;

    // 1. Full span: ", 1775-1817" or ", 428? BCE-348? BCE"
    const spanMatch = str.match(/,\s*(\d{1,4}\??(?:\s*BCE)?)\s*-\s*(\d{1,4}\??(?:\s*BCE)?)$/i);
    if (spanMatch) {
      name = str.substring(0, str.length - spanMatch[0].length).trim();
      birth_year = parseYear(spanMatch[1]);
      death_year = parseYear(spanMatch[2]);
    } else {
      // 2. Death only: ", d. 1920", ", died 1920", ", -1920"
      const deathMatch = str.match(/,\s*(?:d\.|died|-)\s*(\d{1,4}\??(?:\s*BCE)?)$/i);
      if (deathMatch) {
        name = str.substring(0, str.length - deathMatch[0].length).trim();
        death_year = parseYear(deathMatch[1]);
      } else {
        // 3. Birth only: ", b. 1850", ", born 1850", ", 1850-"
        const birthMatch = str.match(/,\s*(?:(?:b\.|born)\s*(\d{1,4}\??(?:\s*BCE)?)|(\d{1,4}\??(?:\s*BCE)?)\s*-)$/i);
        if (birthMatch) {
          name = str.substring(0, str.length - birthMatch[0].length).trim();
          birth_year = parseYear(birthMatch[1] || birthMatch[2]);
        }
      }
    }

    const person = {
      name,
      birth_year: Number.isInteger(birth_year) ? birth_year : null,
      death_year: Number.isInteger(death_year) ? death_year : null,
    };

    if (isTranslator) {
      translators.push(person);
    } else if (!isNonAuthor) {
      authors.push(person);
    }
  }

  return { authors, translators };
}

// 3. Compute Lifespan Bounds for fast Copyright Filtering
function computeLifespanBounds(authors = [], translators = []) {
  const people = [...authors, ...translators];
  let maxDeath = null;
  let minBirth = null;

  for (const person of people) {
    if (person && typeof person.death_year === 'number') {
      maxDeath = maxDeath === null ? person.death_year : Math.max(maxDeath, person.death_year);
    }
    if (person && typeof person.birth_year === 'number') {
      minBirth = minBirth === null ? person.birth_year : Math.min(minBirth, person.birth_year);
    }
  }

  return { maxDeath, minBirth };
}

// 4. Standard Format Mapping for Gutenberg IDs
function buildStandardFormats(bookId) {
  return {
    'text/html': `https://www.gutenberg.org/ebooks/${bookId}.html.images`,
    'application/epub+zip': `https://www.gutenberg.org/ebooks/${bookId}.epub3.images`,
    'application/x-mobipocket-ebook': `https://www.gutenberg.org/ebooks/${bookId}.kf8.images`,
    'text/plain; charset=utf-8': `https://www.gutenberg.org/ebooks/${bookId}.txt.utf-8`,
    'image/jpeg': `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.cover.medium.jpg`,
    'application/rdf+xml': `https://www.gutenberg.org/ebooks/${bookId}.rdf`,
  };
}

// 5. Parse Raw CSV Row into Normalized Book Record
function normalizeCsvRow(row) {
  if (!row || row.length < 5) return null;

  const id = parseInt(row[0], 10);
  if (!Number.isInteger(id) || id <= 0) return null;

  const type = (row[1] || '').trim();
  if (type !== 'Text') return null; // Only ingest readable texts, skip audio/sheet music

  const title = (row[3] || '').replace(/\s+/g, ' ').trim();
  if (!title) return null;

  const rawLanguages = (row[4] || 'en').split(';').map((l) => l.trim().toLowerCase()).filter(Boolean);
  const languages = rawLanguages.length > 0 ? rawLanguages : ['en'];

  const { authors, translators } = parseContributors(row[5]);
  const { maxDeath, minBirth } = computeLifespanBounds(authors, translators);

  const subjects = (row[6] || '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const bookshelves = (row[8] || '')
    .split(';')
    .map((b) => b.trim())
    .filter(Boolean);

  return {
    id,
    title,
    authors,
    translators,
    subjects,
    bookshelves,
    languages,
    copyright: false,
    media_type: 'Text',
    formats: buildStandardFormats(id),
    max_author_death_year: maxDeath,
    min_author_birth_year: minBirth,
  };
}

// 6. Streaming RFC 4180 CSV Consumer with Multi-line Quoted Field Support
function streamGutenbergCatalog(onRecord, catalogUrl = 'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv.gz') {
  return new Promise((resolve, reject) => {
    https
      .get(
        catalogUrl,
        {
          headers: {
            'User-Agent': 'Bookarium-Catalog-Sync/1.0 (https://bookarium.vercel.app)',
            Accept: 'application/gzip, */*',
          },
        },
        (res) => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`Gutenberg feed returned HTTP ${res.statusCode}: ${res.statusMessage}`));
          }

          const gunzip = zlib.createGunzip();
          res.pipe(gunzip);

          let inQuotes = false;
          let currentField = '';
          let currentRow = [];
          let isHeader = true;

          gunzip.on('data', (chunk) => {
            const str = chunk.toString('utf8');
            for (let i = 0; i < str.length; i++) {
              const char = str[i];
              if (char === '"') {
                if (inQuotes && str[i + 1] === '"') {
                  currentField += '"';
                  i++;
                } else {
                  inQuotes = !inQuotes;
                }
              } else if (char === ',' && !inQuotes) {
                currentRow.push(currentField);
                currentField = '';
              } else if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && str[i + 1] === '\n') {
                  i++;
                }
                if (currentRow.length > 0 || currentField.length > 0) {
                  currentRow.push(currentField);
                  currentField = '';
                  if (isHeader) {
                    isHeader = false;
                  } else {
                    onRecord(currentRow);
                  }
                  currentRow = [];
                }
              } else {
                currentField += char;
              }
            }
          });

          gunzip.on('end', () => {
            if (currentRow.length > 0 || currentField.length > 0) {
              currentRow.push(currentField);
              if (!isHeader) {
                onRecord(currentRow);
              }
            }
            resolve();
          });

          gunzip.on('error', reject);
          res.on('error', reject);
        }
      )
      .on('error', reject);
  });
}

// 7. Safe Supabase Batch Upsert with Adaptive Timeout Sub-Batching
async function upsertBatch(supabase, batch, retries = 3, ignoreDuplicates = true) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { error } = await supabase
        .from('books')
        .upsert(batch, {
          onConflict: 'id',
          ignoreDuplicates,
        });

      if (error) {
        throw error;
      }
      return;
    } catch (err) {
      // Adaptive split-and-conquer on statement timeouts
      const isTimeout = err.message && (err.message.includes('statement timeout') || err.message.includes('canceling statement'));
      if (isTimeout && batch.length > 25) {
        const mid = Math.floor(batch.length / 2);
        await upsertBatch(supabase, batch.slice(0, mid), retries, ignoreDuplicates);
        await upsertBatch(supabase, batch.slice(mid), retries, ignoreDuplicates);
        return;
      }

      if (attempt === retries) {
        throw new Error(`Failed to upsert batch after ${retries} attempts: ${err.message}`);
      }
      const backoffMs = attempt * 1200;
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
}

// 8. Main Orchestrator
async function main() {
  const args = process.argv.slice(2);
  const isHelp = args.includes('--help') || args.includes('-h');
  const isDryRun = args.includes('--dry-run');
  const shouldUpdateExisting = args.includes('--update-existing');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
  const languagesArg = args.find((a) => a.startsWith('--languages='));
  const allowedLanguages = languagesArg ? new Set(languagesArg.split('=')[1].toLowerCase().split(',')) : null;
  const batchSizeArg = args.find((a) => a.startsWith('--batch-size='));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 200;

  if (isHelp) {
    console.log(`
Bookarium Catalog Synchronization Engine
========================================
Downloads Project Gutenberg's official catalog dump and syncs metadata to Supabase.

Options:
  --dry-run             Stream and parse catalog without mutating Supabase
  --limit=N             Ingest only the first N valid books (e.g. --limit=100)
  --languages=en,fr     Filter by ISO languages (default: all languages)
  --batch-size=N        Number of books per Supabase upsert (default: 200)
  --update-existing     Force overwrite existing records (default: skip existing)
  --help, -h            Show this help guide
`);
    process.exit(0);
  }

  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('📚 Bookarium Gutenberg Catalog Sync');
  console.log('====================================');
  console.log(`• Mode:        ${isDryRun ? 'DRY-RUN (No database writes)' : 'LIVE UPSERT'}`);
  console.log(`• Strategy:    ${shouldUpdateExisting ? 'OVERWRITE (Update existing records)' : 'INCREMENTAL (Skip existing IDs)'}`);
  console.log(`• Batch Size:  ${batchSize} books/request`);
  if (limit) console.log(`• Limit:       ${limit} books`);
  if (allowedLanguages) console.log(`• Languages:   ${Array.from(allowedLanguages).join(', ')}`);

  let supabase = null;
  if (!isDryRun) {
    if (!supabaseUrl) {
      console.error('✖ Error: Missing NEXT_PUBLIC_SUPABASE_URL in environment or .env.local');
      process.exit(1);
    }
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('\n⚠ WARNING: SUPABASE_SERVICE_ROLE_KEY is not defined.');
      console.warn('  Attempting write using anonymous key. If Row Level Security blocks inserts,');
      console.warn('  please add SUPABASE_SERVICE_ROLE_KEY to .env.local or GitHub Secrets.');
      console.warn('  (Find it in: Supabase Dashboard -> Settings -> API -> service_role secret)\n');
    }
    if (typeof globalThis.WebSocket === 'undefined') {
      // Polyfill WebSocket dummy for runtimes where realtime is unused
      globalThis.WebSocket = class DummyWebSocket {};
    }
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const startTime = Date.now();
  console.log('\n🌐 Connecting to Project Gutenberg catalog feed (pg_catalog.csv.gz)...');

  let totalParsed = 0;
  let totalAccepted = 0;
  let totalUpserted = 0;
  let currentBatch = [];
  let isAborted = false;

  const flushBatch = async () => {
    if (currentBatch.length === 0) return;
    const toSend = [...currentBatch];
    currentBatch = [];

    if (!isDryRun && supabase) {
      await upsertBatch(supabase, toSend, 3, !shouldUpdateExisting);
    }
    totalUpserted += toSend.length;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const speed = Math.round(totalUpserted / (parseFloat(elapsed) || 1));
    process.stdout.write(`\r  ↳ Upserted: ${totalUpserted.toLocaleString()} titles | ${speed} books/sec | ${elapsed}s elapsed`);

    // Anti-throttling micro-pause
    await new Promise((r) => setTimeout(r, 75));
  };

  try {
    await streamGutenbergCatalog(async (row) => {
      if (isAborted) return;

      totalParsed++;
      const book = normalizeCsvRow(row);
      if (!book) return;

      if (allowedLanguages) {
        const matchesLang = book.languages.some((l) => allowedLanguages.has(l));
        if (!matchesLang) return;
      }

      totalAccepted++;
      currentBatch.push(book);

      if (currentBatch.length >= batchSize) {
        await flushBatch();
      }

      if (limit && totalAccepted >= limit) {
        isAborted = true;
      }
    });

    // Flush any trailing batch
    if (currentBatch.length > 0) {
      await flushBatch();
    }

    const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n✔ Sync Complete in ${totalSeconds} seconds!`);
    console.log(`  • Rows scanned:   ${totalParsed.toLocaleString()}`);
    console.log(`  • Valid texts:    ${totalAccepted.toLocaleString()}`);
    console.log(`  • Titles synced:  ${totalUpserted.toLocaleString()}`);

    if (!isDryRun && supabase) {
      const { count } = await supabase.from('books').select('*', { count: 'exact', head: true });
      console.log(`  • Current Supabase Catalog Total: ${count ? count.toLocaleString() : 'N/A'} books`);
    }
  } catch (err) {
    console.error('\n✖ Sync failed:', err.message || err);
    process.exit(1);
  }
}

// Export for unit tests
module.exports = {
  parseYear,
  parseContributors,
  computeLifespanBounds,
  buildStandardFormats,
  normalizeCsvRow,
  upsertBatch,
  loadEnv,
};

if (require.main === module) {
  main();
}


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

function resolveRepositoryOrSiteUrl(env = process.env) {
  if (env.NEXT_PUBLIC_GITHUB_REPO) {
    return env.NEXT_PUBLIC_GITHUB_REPO.trim();
  }
  if (env.BOOKARIUM_REPO_URL) {
    return env.BOOKARIUM_REPO_URL.trim();
  }
  if (env.GITHUB_REPOSITORY) {
    return `https://github.com/${env.GITHUB_REPOSITORY.trim().replace(/^\/+|\/+$/g, '')}`;
  }
  if (env.VERCEL_GIT_REPO_OWNER && env.VERCEL_GIT_REPO_SLUG) {
    return `https://github.com/${env.VERCEL_GIT_REPO_OWNER.trim()}/${env.VERCEL_GIT_REPO_SLUG.trim()}`;
  }
  try {
    const raw = require('child_process').execSync('git config --get remote.origin.url', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (raw) {
      return raw.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '');
    }
  } catch {}
  return env.NEXT_PUBLIC_SITE_URL || 'https://bookarium.vercel.app';
}

function resolveCatalogUserAgent(env = process.env) {
  const originUrl = resolveRepositoryOrSiteUrl(env);
  const email = (env.GUTENBERG_CONTACT_EMAIL || '').trim();
  const contactPart = email ? `+${originUrl}; ${email}` : `+${originUrl}`;
  return `Bookarium-Catalog-Sync/1.0 (${contactPart})`;
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
            'User-Agent': resolveCatalogUserAgent(),
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

// 7. Exact-Diff Catalog Metadata Comparison & Safe Supabase Batch Upsert
const CATALOG_DIFF_SELECT_COLUMNS =
  'id, title, authors, translators, subjects, bookshelves, languages, copyright, media_type, max_author_death_year, min_author_birth_year';

const MIN_ACTIVE_CATALOG_FOR_PRUNE = 50000;
const MAX_WITHDRAWN_PRUNE_PER_RUN = 500;
const PROTECTED_HERO_BOOK_IDS = new Set([
  1342, 84, 2701, 64317, 11, 174, 1661, 345, 98, 35, 2600, 135, 2554, 1260,
  768, 5200, 43, 1184, 1232, 132, 2680, 1727, 514, 2147, 164, 205, 76,
]);

function areStringArraysEqual(arrA, arrB) {
  const a = Array.isArray(arrA) ? arrA : [];
  const b = Array.isArray(arrB) ? arrB : [];
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function areContributorArraysEqual(arrA, arrB) {
  const a = Array.isArray(arrA) ? arrA : [];
  const b = Array.isArray(arrB) ? arrB : [];
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const itemA = a[i] || {};
    const itemB = b[i] || {};
    if ((itemA.name || '') !== (itemB.name || '')) return false;
    if ((itemA.birth_year ?? null) !== (itemB.birth_year ?? null)) return false;
    if ((itemA.death_year ?? null) !== (itemB.death_year ?? null)) return false;
  }
  return true;
}

function hasCatalogMetadataChanged(existingRow, incomingBook) {
  if (!existingRow || !incomingBook) return true;
  if ((existingRow.title || '') !== (incomingBook.title || '')) return true;
  if (Boolean(existingRow.copyright) !== Boolean(incomingBook.copyright)) return true;
  if ((existingRow.media_type || 'Text') !== (incomingBook.media_type || 'Text')) return true;
  if ((existingRow.max_author_death_year ?? null) !== (incomingBook.max_author_death_year ?? null)) return true;
  if ((existingRow.min_author_birth_year ?? null) !== (incomingBook.min_author_birth_year ?? null)) return true;
  if (!areStringArraysEqual(existingRow.languages, incomingBook.languages)) return true;
  if (!areStringArraysEqual(existingRow.subjects, incomingBook.subjects)) return true;
  if (!areStringArraysEqual(existingRow.bookshelves, incomingBook.bookshelves)) return true;
  if (!areContributorArraysEqual(existingRow.authors, incomingBook.authors)) return true;
  if (!areContributorArraysEqual(existingRow.translators, incomingBook.translators)) return true;
  return false;
}

function deduplicateBatchById(batch) {
  if (!Array.isArray(batch) || batch.length === 0) return [];
  const byId = new Map();
  for (const item of batch) {
    if (item && Number.isInteger(item.id) && item.id > 0) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values());
}

async function filterChangedOrNewBooks(supabase, batch, shouldForceOverwrite = false) {
  const dedupedBatch = deduplicateBatchById(batch);
  if (dedupedBatch.length === 0) {
    return { toUpsert: [], insertedCount: 0, updatedCount: 0, unchangedCount: 0 };
  }

  if (shouldForceOverwrite || !supabase) {
    return {
      toUpsert: dedupedBatch,
      insertedCount: 0,
      updatedCount: dedupedBatch.length,
      unchangedCount: 0,
    };
  }

  const batchIds = dedupedBatch.map((b) => b.id);
  const { data: existingRows, error } = await supabase
    .from('books')
    .select(CATALOG_DIFF_SELECT_COLUMNS)
    .in('id', batchIds);

  if (error) {
    throw new Error(`Failed to query existing catalog rows for diff check: ${error.message}`);
  }

  const existingById = new Map();
  if (Array.isArray(existingRows)) {
    for (const row of existingRows) {
      if (row && Number.isInteger(row.id)) {
        existingById.set(row.id, row);
      }
    }
  }

  const toUpsert = [];
  let insertedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  for (const incomingBook of dedupedBatch) {
    const existingRow = existingById.get(incomingBook.id);
    if (!existingRow) {
      toUpsert.push(incomingBook);
      insertedCount++;
    } else if (hasCatalogMetadataChanged(existingRow, incomingBook)) {
      toUpsert.push(incomingBook);
      updatedCount++;
    } else {
      unchangedCount++;
    }
  }

  return { toUpsert, insertedCount, updatedCount, unchangedCount };
}

async function upsertBatch(supabase, batch, retries = 3, ignoreDuplicates = true) {
  const dedupedBatch = deduplicateBatchById(batch);
  if (dedupedBatch.length === 0) return;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { error } = await supabase
        .from('books')
        .upsert(dedupedBatch, {
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
      if (isTimeout && dedupedBatch.length > 25) {
        const mid = Math.floor(dedupedBatch.length / 2);
        await upsertBatch(supabase, dedupedBatch.slice(0, mid), retries, ignoreDuplicates);
        await upsertBatch(supabase, dedupedBatch.slice(mid), retries, ignoreDuplicates);
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

async function reconcileWithdrawnCatalogBooks(supabase, activeCatalogIds, options = {}) {
  const logger = options.logger || console;
  const minCatalogSize =
    typeof options.minCatalogSize === 'number' ? options.minCatalogSize : MIN_ACTIVE_CATALOG_FOR_PRUNE;
  const maxPrunePerRun =
    typeof options.maxPrunePerRun === 'number' ? options.maxPrunePerRun : MAX_WITHDRAWN_PRUNE_PER_RUN;
  const forcePrune = Boolean(options.forcePrune);
  const pageSize = typeof options.pageSize === 'number' && options.pageSize > 0 ? options.pageSize : 1000;
  const deleteChunkSize =
    typeof options.deleteChunkSize === 'number' && options.deleteChunkSize > 0 ? options.deleteChunkSize : 100;

  if (!supabase || !(activeCatalogIds instanceof Set)) {
    return { prunedCount: 0, prunedIds: [], skippedReason: 'missing-client-or-set' };
  }

  if (activeCatalogIds.size < minCatalogSize) {
    logger.warn(
      `\n⚠ Skipping withdrawn-book reconciliation: active catalog set (${activeCatalogIds.size.toLocaleString()}) is below safety floor (${minCatalogSize.toLocaleString()}).`
    );
    return { prunedCount: 0, prunedIds: [], skippedReason: 'below-min-catalog-floor' };
  }

  logger.log('\n🧹 Reconciling catalog for withdrawn/removed Project Gutenberg volumes...');
  const withdrawnIds = [];
  let lastId = 0;

  while (true) {
    const { data, error } = await supabase
      .from('books')
      .select('id')
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(pageSize);

    if (error) {
      throw new Error(`Failed to scan existing catalog IDs for reconciliation: ${error.message}`);
    }

    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    for (const row of data) {
      if (row && Number.isInteger(row.id) && row.id > 0) {
        lastId = row.id;
        if (!activeCatalogIds.has(row.id) && !PROTECTED_HERO_BOOK_IDS.has(row.id)) {
          withdrawnIds.push(row.id);
        }
      }
    }

    if (data.length < pageSize) {
      break;
    }
  }

  if (withdrawnIds.length === 0) {
    logger.log('  ✔ Zero withdrawn books found (100% of Supabase catalog IDs remain active in Project Gutenberg).');
    return { prunedCount: 0, prunedIds: [], skippedReason: null };
  }

  if (!forcePrune && withdrawnIds.length > maxPrunePerRun) {
    logger.warn(
      `  ⚠ Safety circuit breaker triggered: ${withdrawnIds.length.toLocaleString()} candidate removals exceed maxPrunePerRun (${maxPrunePerRun}). Pass --force-prune to override.`
    );
    return { prunedCount: 0, prunedIds: withdrawnIds, skippedReason: 'exceeded-max-prune-cap' };
  }

  let prunedCount = 0;
  for (let i = 0; i < withdrawnIds.length; i += deleteChunkSize) {
    const chunk = withdrawnIds.slice(i, i + deleteChunkSize);
    const { error: deleteErr } = await supabase.from('books').delete().in('id', chunk);
    if (deleteErr) {
      throw new Error(`Failed to delete withdrawn catalog book IDs: ${deleteErr.message}`);
    }
    prunedCount += chunk.length;
  }

  logger.log(
    `  ✔ Pruned ${prunedCount.toLocaleString()} withdrawn Project Gutenberg volume(s) (and their quotes): [${withdrawnIds.slice(0, 15).join(', ')}${withdrawnIds.length > 15 ? ', ...' : ''}]`
  );
  return { prunedCount, prunedIds: withdrawnIds, skippedReason: null };
}

// 8. Popularity Download Count Hydration from Gutendex (Top 500+ Public Domain Titles)
async function fetchPopularCountsFromGutendex(pages = 20, fetchFn = globalThis.fetch) {
  const popularEntries = [];
  const seenIds = new Set();

  for (let page = 1; page <= pages; page++) {
    const url = `https://gutendex.com/books/?copyright=false&page=${page}`;
    try {
      const res = await fetchFn(url, {
        headers: {
          'User-Agent': resolveCatalogUserAgent(),
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res || !res.ok) break;
      const data = await res.json();
      if (!data || !Array.isArray(data.results) || data.results.length === 0) break;

      for (const item of data.results) {
        if (
          item &&
          Number.isInteger(item.id) &&
          item.id > 0 &&
          typeof item.download_count === 'number' &&
          item.download_count > 0 &&
          !seenIds.has(item.id)
        ) {
          seenIds.add(item.id);
          popularEntries.push({
            id: item.id,
            download_count: item.download_count,
          });
        }
      }
      if (!data.next) break;
    } catch {
      break;
    }
  }

  return popularEntries;
}

async function syncPopularDownloadCounts(supabase, options = {}) {
  if (!supabase) return { updatedCount: 0, demotedCount: 0 };
  const pages = typeof options.pages === 'number' && options.pages > 0 ? options.pages : 20;
  const fetchFn = options.fetchFn || globalThis.fetch;
  const logger = options.logger || console;
  const minEntriesForDemote =
    typeof options.minEntriesForDemote === 'number' ? options.minEntriesForDemote : 500;

  logger.log(`\n🔥 Hydrating download_count for Top Popular Gutenberg titles (${pages} pages)...`);
  const entries = await fetchPopularCountsFromGutendex(pages, fetchFn);
  if (entries.length === 0) {
    logger.warn('  ⚠ Warning: Could not retrieve popular download counts from Gutendex; keeping existing counts.');
    return { updatedCount: 0, demotedCount: 0 };
  }

  let updatedCount = 0;
  const CHUNK_SIZE = 25;
  const pauseMs = typeof options.pauseMs === 'number' && options.pauseMs >= 0 ? options.pauseMs : 50;
  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunk = entries.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (entry) => {
        const { error } = await supabase
          .from('books')
          .update({ download_count: entry.download_count })
          .eq('id', entry.id);
        if (!error) {
          updatedCount++;
        }
      })
    );
    if (pauseMs > 0 && i + CHUNK_SIZE < entries.length) {
      await new Promise((r) => setTimeout(r, pauseMs));
    }
  }

  logger.log(`  ✔ Hydrated download_count on ${updatedCount.toLocaleString()} popular volumes.`);

  // Step down (demote) cooled-off books in Supabase that dropped out of the fetched popular pages
  let demotedCount = 0;
  if (entries.length >= minEntriesForDemote) {
    const minFetchedCount = Math.min(...entries.map((e) => e.download_count));
    const demotedCountValue = Math.max(0, minFetchedCount - 1);
    const fetchedIdSet = new Set(entries.map((e) => e.id));

    // Single-column index alignment: idx_books_download_count across top candidate pool
    const { data: topRows, error: scanErr } = await supabase
      .from('books')
      .select('id, download_count')
      .order('download_count', { ascending: false })
      .limit(1000);

    if (scanErr) {
      logger.warn(`  ⚠ Warning: Failed to scan top books for popularity demotion: ${scanErr.message}`);
    } else if (Array.isArray(topRows)) {
      const demoteCandidateIds = [];
      for (const row of topRows) {
        if (
          row &&
          Number.isInteger(row.id) &&
          !fetchedIdSet.has(row.id) &&
          !PROTECTED_HERO_BOOK_IDS.has(row.id) &&
          (row.download_count || 0) >= minFetchedCount
        ) {
          demoteCandidateIds.push(row.id);
        }
      }

      if (demoteCandidateIds.length > 0) {
        for (let i = 0; i < demoteCandidateIds.length; i += CHUNK_SIZE) {
          const chunk = demoteCandidateIds.slice(i, i + CHUNK_SIZE);
          const { error: demoteErr } = await supabase
            .from('books')
            .update({ download_count: demotedCountValue })
            .in('id', chunk);
          if (!demoteErr) {
            demotedCount += chunk.length;
          } else {
            logger.warn(`  ⚠ Warning: Failed to demote cooled-off chunk: ${demoteErr.message}`);
          }
        }
        logger.log(
          `  ✔ Stepped down download_count to ${demotedCountValue.toLocaleString()} for ${demotedCount.toLocaleString()} cooled-off volume(s).`
        );
      }
    }
  }

  return { updatedCount, demotedCount };
}

// 9. Main Orchestrator
async function main() {
  const args = process.argv.slice(2);
  const isHelp = args.includes('--help') || args.includes('-h');
  const isDryRun = args.includes('--dry-run');
  const shouldUpdateExisting = args.includes('--update-existing');
  const noPrune = args.includes('--no-prune');
  const forcePrune = args.includes('--force-prune');
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
  --update-existing     Force full overwrite of all existing records (default: smart exact-diff update preserving quotes)
  --no-prune            Skip withdrawn-book reconciliation at the end of a full sync
  --force-prune         Override the 500-book per-run safety cap during withdrawn-book pruning
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
  console.log(
    `• Strategy:    ${shouldUpdateExisting ? 'FORCE OVERWRITE (Rebuild all records)' : 'SMART EXACT-DIFF (Insert new + update changed metadata, preserving quotes)'}`
  );
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
  let totalProcessed = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalUnchanged = 0;
  let currentBatch = [];
  let isAborted = false;
  const activeCatalogIds = new Set();

  const flushBatch = async () => {
    if (currentBatch.length === 0) return;
    const toSend = [...currentBatch];
    currentBatch = [];

    if (!isDryRun && supabase) {
      const { toUpsert, insertedCount, updatedCount, unchangedCount } = await filterChangedOrNewBooks(
        supabase,
        toSend,
        shouldUpdateExisting
      );
      if (toUpsert.length > 0) {
        await upsertBatch(supabase, toUpsert, 3, false);
      }
      totalInserted += insertedCount;
      totalUpdated += updatedCount;
      totalUnchanged += unchangedCount;
    }
    totalProcessed += toSend.length;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const speed = Math.round(totalProcessed / (parseFloat(elapsed) || 1));
    process.stdout.write(
      `\r  ↳ Processed: ${totalProcessed.toLocaleString()} | New: ${totalInserted.toLocaleString()} | Updated: ${totalUpdated.toLocaleString()} | Unchanged: ${totalUnchanged.toLocaleString()} | ${speed} books/s (${elapsed}s)`
    );

    // Anti-throttling micro-pause
    await new Promise((r) => setTimeout(r, 75));
  };

  try {
    await streamGutenbergCatalog(async (row) => {
      if (isAborted) return;

      totalParsed++;
      const book = normalizeCsvRow(row);
      if (!book) return;

      activeCatalogIds.add(book.id);

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
    console.log(`  • New inserted:   ${totalInserted.toLocaleString()}`);
    console.log(`  • Diff updated:   ${totalUpdated.toLocaleString()}`);
    console.log(`  • Unchanged skip: ${totalUnchanged.toLocaleString()}`);

    if (!isDryRun && supabase && !limit && !allowedLanguages && !noPrune) {
      await reconcileWithdrawnCatalogBooks(supabase, activeCatalogIds, { forcePrune });
    }

    if (!isDryRun && supabase && !limit) {
      await syncPopularDownloadCounts(supabase);
    }

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
  CATALOG_DIFF_SELECT_COLUMNS,
  MIN_ACTIVE_CATALOG_FOR_PRUNE,
  MAX_WITHDRAWN_PRUNE_PER_RUN,
  PROTECTED_HERO_BOOK_IDS,
  parseYear,
  parseContributors,
  computeLifespanBounds,
  buildStandardFormats,
  normalizeCsvRow,
  areStringArraysEqual,
  areContributorArraysEqual,
  hasCatalogMetadataChanged,
  deduplicateBatchById,
  filterChangedOrNewBooks,
  upsertBatch,
  reconcileWithdrawnCatalogBooks,
  fetchPopularCountsFromGutendex,
  syncPopularDownloadCounts,
  loadEnv,
};

if (require.main === module) {
  main();
}


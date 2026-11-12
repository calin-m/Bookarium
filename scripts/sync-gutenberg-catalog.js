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
const { spawn } = require('child_process');
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
  if (people.length === 0) return { maxDeath: null, minBirth: null };

  let hasUnverifiedContributor = false;
  let maxDeath = null;
  let minBirth = null;

  for (const person of people) {
    if (!person) continue;
    const death = typeof person.death_year === 'number' ? person.death_year : null;
    const birth = typeof person.birth_year === 'number' ? person.birth_year : null;

    if (death === null && birth === null) {
      hasUnverifiedContributor = true;
    }

    if (death !== null) {
      maxDeath = maxDeath === null ? death : Math.max(maxDeath, death);
    } else if (birth !== null) {
      // Conservative human longevity heuristic (birth + 100)
      const estimatedDeath = birth + 100;
      maxDeath = maxDeath === null ? estimatedDeath : Math.max(maxDeath, estimatedDeath);
    }

    if (birth !== null) {
      minBirth = minBirth === null ? birth : Math.min(minBirth, birth);
    }
  }

  // Under Berne Convention Art. 7bis, joint authorship copyright is measured from the
  // death of the last surviving author. If any contributor's lifespan is completely unlisted,
  // the volume cannot be verified as public domain in Life+70/80/100, so maxDeath is indeterminate (null).
  if (hasUnverifiedContributor) {
    maxDeath = null;
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
function normalizeCsvRow(row, downloadCountsMap = null) {
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

  const record = {
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

  if (downloadCountsMap instanceof Map && downloadCountsMap.size > 0) {
    const rawCount = downloadCountsMap.get(id);
    record.download_count = typeof rawCount === 'number' && rawCount >= 0 ? rawCount : 0;
  }

  return record;
}

// 5b. Streaming RDF Archive Consumer for Full-Catalog Download Counts (rdf-files.tar.bz2)
const GUTENBERG_RDF_FEED_MIRRORS = [
  'https://www.gutenberg.org/cache/epub/feeds/rdf-files.tar.bz2',
  'https://aleph.gutenberg.org/cache/epub/feeds/rdf-files.tar.bz2',
  'https://gutenberg.pglaf.org/cache/epub/feeds/rdf-files.tar.bz2',
];

const GUTENBERG_CSV_FEED_MIRRORS = [
  'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv.gz',
  'https://aleph.gutenberg.org/cache/epub/feeds/pg_catalog.csv.gz',
  'https://gutenberg.pglaf.org/cache/epub/feeds/pg_catalog.csv.gz',
];

const ALLOWED_RDF_FEED_HOSTS = new Set([
  'gutenberg.pglaf.org',
  'aleph.gutenberg.org',
  'gutenberg.readingroo.ms',
  'www.gutenberg.org',
  'gutenberg.org',
]);

function isAllowedRdfFeedUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === 'https:' &&
      ALLOWED_RDF_FEED_HOSTS.has(parsed.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function isAllowedCsvFeedUrl(rawUrl) {
  return isAllowedRdfFeedUrl(rawUrl);
}

function parseRdfDownloadCountsStream(readableStream, onProgress = null) {
  return new Promise((resolve, reject) => {
    const countsMap = new Map();
    let currentBookId = null;
    let remainder = '';

    const ebookTagRegex = /<pgterms:ebook\s+rdf:about="ebooks\/(\d+)"/i;
    const downloadsTagRegex = /<pgterms:downloads[^>]*>(\d+)<\/pgterms:downloads>/i;

    const processLine = (line) => {
      const ebookMatch = line.match(ebookTagRegex);
      if (ebookMatch) {
        const parsedId = parseInt(ebookMatch[1], 10);
        currentBookId = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;
      }

      if (currentBookId !== null) {
        const dlMatch = line.match(downloadsTagRegex);
        if (dlMatch) {
          const parsedCount = parseInt(dlMatch[1], 10);
          if (Number.isInteger(parsedCount) && parsedCount >= 0) {
            countsMap.set(currentBookId, parsedCount);
            if (typeof onProgress === 'function' && countsMap.size % 500 === 0) {
              onProgress(countsMap.size);
            }
          }
        }
      }

      if (line.includes('</pgterms:ebook>')) {
        currentBookId = null;
      }
    };

    readableStream.on('data', (chunk) => {
      const text = remainder + chunk.toString('utf8');
      const lines = text.split('\n');
      remainder = lines.pop() || '';
      for (let i = 0; i < lines.length; i++) {
        processLine(lines[i]);
      }
    });

    readableStream.on('end', () => {
      if (remainder) {
        processLine(remainder);
        remainder = '';
      }
      resolve(countsMap);
    });

    readableStream.on('error', reject);
  });
}

function streamRdfMirrorOnce(feedUrl, options = {}, redirectHop = 0) {
  return new Promise((resolve, reject) => {
    if (!isAllowedRdfFeedUrl(feedUrl)) {
      return reject(new Error(`Disallowed RDF feed mirror URL: ${feedUrl}`));
    }
    if (redirectHop > 3) {
      return reject(new Error(`Exceeded maximum redirect hops for RDF feed: ${feedUrl}`));
    }

    const req = https.get(
      feedUrl,
      {
        headers: {
          'User-Agent': resolveCatalogUserAgent(),
          Accept: 'application/x-bzip2, application/octet-stream, */*',
        },
        timeout: 30000,
      },
      (res) => {
        if (
          res.statusCode &&
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          res.resume();
          try {
            const nextUrl = new URL(res.headers.location, feedUrl).toString();
            streamRdfMirrorOnce(nextUrl, options, redirectHop + 1)
              .then(resolve)
              .catch(reject);
          } catch (err) {
            reject(err);
          }
          return;
        }

        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          return reject(
            new Error(`RDF feed mirror returned HTTP ${res.statusCode}: ${res.statusMessage}`)
          );
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10) || 0;
        let downloadedBytes = 0;
        let parsedBookCount = 0;
        let lastReportMs = 0;

        const emitProgress = (force = false) => {
          if (typeof options.onProgress !== 'function') return;
          const now = Date.now();
          if (force || now - lastReportMs >= 250) {
            lastReportMs = now;
            options.onProgress(parsedBookCount, downloadedBytes, totalBytes);
          }
        };

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          emitProgress(false);
        });

        const tarProc = spawn('tar', ['-xOjf', '-'], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let tarStderr = '';
        tarProc.stderr.on('data', (d) => {
          if (tarStderr.length < 1024) {
            tarStderr += d.toString('utf8');
          }
        });

        res.pipe(tarProc.stdin);
        tarProc.stdin.on('error', () => {});

        parseRdfDownloadCountsStream(tarProc.stdout, (count) => {
          parsedBookCount = count;
          emitProgress(false);
        })
          .then((countsMap) => {
            parsedBookCount = countsMap.size;
            emitProgress(true);
            tarProc.on('close', (code) => {
              if (code !== 0 && countsMap.size === 0) {
                reject(
                  new Error(`tar exited with code ${code}: ${tarStderr.trim() || 'unknown error'}`)
                );
              } else {
                resolve(countsMap);
              }
            });
          })
          .catch((err) => {
            tarProc.kill();
            reject(err);
          });

        tarProc.on('error', (err) => {
          res.destroy();
          reject(err);
        });
        res.on('error', (err) => {
          tarProc.kill();
          reject(err);
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error(`Timeout connecting to RDF feed mirror: ${feedUrl}`));
    });
    req.on('error', reject);
  });
}

async function streamGutenbergRdfDownloadCounts(options = {}) {
  const rawMirrors = Array.isArray(options.mirrors) && options.mirrors.length > 0
    ? options.mirrors
    : GUTENBERG_RDF_FEED_MIRRORS;
  const validMirrors = rawMirrors.filter(isAllowedRdfFeedUrl);
  const logger = options.logger || console;
  const streamMirrorFn = options.streamMirrorFn || streamRdfMirrorOnce;

  for (let idx = 0; idx < validMirrors.length; idx++) {
    const mirrorUrl = validMirrors[idx];
    const host = new URL(mirrorUrl).hostname;
    try {
      const startMs = Date.now();
      logger.log(
        `\n📦 Streaming full-catalog download counts [Mirror ${idx + 1}/${validMirrors.length}: ${host}] (${mirrorUrl})...`
      );
      const countsMap = await streamMirrorFn(mirrorUrl, {
        onProgress: (count, downloadedBytes = 0, totalBytes = 0) => {
          if (process.stdout && typeof process.stdout.write === 'function' && logger === console) {
            const elapsedSec = Math.max(0.1, (Date.now() - startMs) / 1000);
            const dlMb = (downloadedBytes / (1024 * 1024)).toFixed(1);
            const speedMb = (downloadedBytes / (1024 * 1024) / elapsedSec).toFixed(1);
            const sizePart =
              totalBytes > 0
                ? `${dlMb}/${(totalBytes / (1024 * 1024)).toFixed(1)} MB (${((downloadedBytes / totalBytes) * 100).toFixed(1)}%) @ ${speedMb} MB/s`
                : downloadedBytes > 0
                  ? `${dlMb} MB @ ${speedMb} MB/s`
                  : 'connecting...';
            process.stdout.write(
              `\r  ↳ RDF: ${sizePart} | ${(count || 0).toLocaleString()} books (${elapsedSec.toFixed(1)}s)   `
            );
          }
        },
      });
      if (countsMap instanceof Map && countsMap.size > 0) {
        const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
        logger.log(
          `\n  ✔ Extracted 30-day download_count for ${countsMap.size.toLocaleString()} books from ${host} (${elapsed}s).`
        );
        return countsMap;
      }
    } catch (err) {
      logger.warn(
        `  ⚠ Warning: RDF feed mirror [${idx + 1}/${validMirrors.length}: ${host}] failed (${err.message || err}); trying next mirror...`
      );
    }
  }

  logger.warn(
    '  ⚠ Warning: All RDF feed mirrors failed; will fall back to Gutendex Top Popular hydration.'
  );
  return new Map();
}

// 6. Streaming RFC 4180 CSV Consumer with Multi-line Quoted Field Support, Mirror Failover & Download Progress
function streamCatalogMirrorOnce(onRecord, catalogUrl, options = {}, redirectHop = 0) {
  return new Promise((resolve, reject) => {
    if (!isAllowedCsvFeedUrl(catalogUrl)) {
      return reject(new Error(`Disallowed CSV feed mirror URL: ${catalogUrl}`));
    }
    if (redirectHop > 3) {
      return reject(new Error(`Exceeded maximum redirect hops for CSV feed: ${catalogUrl}`));
    }

    const startMs = Date.now();
    const req = https.get(
      catalogUrl,
      {
        headers: {
          'User-Agent': resolveCatalogUserAgent(),
          Accept: 'application/gzip, */*',
        },
        timeout: 30000,
      },
      (res) => {
        if (
          res.statusCode &&
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          res.resume();
          try {
            const nextUrl = new URL(res.headers.location, catalogUrl).toString();
            streamCatalogMirrorOnce(onRecord, nextUrl, options, redirectHop + 1)
              .then(resolve)
              .catch(reject);
          } catch (err) {
            reject(err);
          }
          return;
        }

        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          return reject(
            new Error(`Gutenberg feed returned HTTP ${res.statusCode}: ${res.statusMessage}`)
          );
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10) || 0;
        let downloadedBytes = 0;

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (typeof options.onDownloadProgress === 'function') {
            const elapsedSec = Math.max(0.1, (Date.now() - startMs) / 1000);
            options.onDownloadProgress({
              downloadedBytes,
              totalBytes,
              speedMBps: downloadedBytes / (1024 * 1024) / elapsedSec,
              elapsedSec,
              mirrorHost: new URL(catalogUrl).hostname,
            });
          }
        });

        const gunzip = zlib.createGunzip();
        res.pipe(gunzip);

        let inQuotes = false;
        let currentField = '';
        let currentRow = [];
        let isHeader = true;
        const parsedRows = [];
        let settled = false;

        const safeReject = (err) => {
          if (settled) return;
          settled = true;
          gunzip.destroy();
          res.destroy();
          reject(err);
        };

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
                  parsedRows.push(currentRow);
                }
                currentRow = [];
              }
            } else {
              currentField += char;
            }
          }
        });

        gunzip.on('end', async () => {
          if (currentRow.length > 0 || currentField.length > 0) {
            currentRow.push(currentField);
            if (!isHeader) {
              parsedRows.push(currentRow);
            }
          }
          try {
            for (let i = 0; i < parsedRows.length; i++) {
              const row = parsedRows[i];
              parsedRows[i] = null;
              await onRecord(row);
            }
            if (!settled) {
              settled = true;
              resolve();
            }
          } catch (err) {
            safeReject(err);
          }
        });

        gunzip.on('error', safeReject);
        res.on('error', safeReject);
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error(`Timeout connecting to CSV feed mirror: ${catalogUrl}`));
    });
    req.on('error', reject);
  });
}

async function streamGutenbergCatalog(
  onRecord,
  catalogUrlOrOptions = GUTENBERG_CSV_FEED_MIRRORS[0]
) {
  const options =
    typeof catalogUrlOrOptions === 'string'
      ? { mirrors: [catalogUrlOrOptions] }
      : catalogUrlOrOptions || {};
  const rawMirrors =
    Array.isArray(options.mirrors) && options.mirrors.length > 0
      ? options.mirrors
      : GUTENBERG_CSV_FEED_MIRRORS;
  const validMirrors = rawMirrors.filter(isAllowedCsvFeedUrl);
  const logger = options.logger || null;
  const streamMirrorFn = options.streamMirrorFn || streamCatalogMirrorOnce;

  let recordsEmitted = 0;
  let lastError = null;

  for (let idx = 0; idx < validMirrors.length; idx++) {
    const mirrorUrl = validMirrors[idx];
    const host = new URL(mirrorUrl).hostname;
    try {
      if (logger && typeof logger.log === 'function') {
        logger.log(
          `\n🌐 Streaming Project Gutenberg catalog [Mirror ${idx + 1}/${validMirrors.length}: ${host}] (${mirrorUrl})...`
        );
      }
      await streamMirrorFn(
        (row) => {
          recordsEmitted++;
          return onRecord(row);
        },
        mirrorUrl,
        options
      );
      return;
    } catch (err) {
      lastError = err;
      if (recordsEmitted > 0 || idx === validMirrors.length - 1) {
        throw err;
      }
      if (logger && typeof logger.warn === 'function') {
        logger.warn(
          `  ⚠ Warning: CSV catalog mirror [${idx + 1}/${validMirrors.length}: ${host}] failed (${err.message || err}); trying next mirror...`
        );
      }
    }
  }

  if (lastError) {
    throw lastError;
  }
}

// 7. Exact-Diff Catalog Metadata Comparison & Safe Supabase Batch Upsert
const CATALOG_DIFF_SELECT_COLUMNS =
  'id, title, authors, translators, subjects, bookshelves, languages, copyright, media_type, max_author_death_year, min_author_birth_year, download_count';

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
  if (
    typeof incomingBook.download_count === 'number' &&
    (existingRow.download_count ?? 0) !== incomingBook.download_count
  ) {
    return true;
  }
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

function isTransientDatabaseTimeout(err) {
  const msg = String((err && err.message) || err || '').toLowerCase();
  return (
    msg.includes('statement timeout') ||
    msg.includes('canceling statement') ||
    msg.includes('timed out acquiring connection') ||
    msg.includes('connection pool') ||
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504')
  );
}

async function fetchExistingRowsWithRetry(supabase, batchIds, options = {}) {
  if (!Array.isArray(batchIds) || batchIds.length === 0) return [];
  const retries = typeof options.retries === 'number' && options.retries > 0 ? options.retries : 4;
  const baseDelayMs =
    typeof options.baseDelayMs === 'number' && options.baseDelayMs >= 0 ? options.baseDelayMs : 1200;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data: existingRows, error } = await supabase
        .from('books')
        .select(CATALOG_DIFF_SELECT_COLUMNS)
        .in('id', batchIds);

      if (error) {
        throw error;
      }
      return Array.isArray(existingRows) ? existingRows : [];
    } catch (err) {
      if (isTransientDatabaseTimeout(err) && batchIds.length > 25) {
        if (baseDelayMs > 0) {
          await new Promise((r) => setTimeout(r, baseDelayMs));
        }
        const mid = Math.floor(batchIds.length / 2);
        const leftRows = await fetchExistingRowsWithRetry(supabase, batchIds.slice(0, mid), options);
        const rightRows = await fetchExistingRowsWithRetry(supabase, batchIds.slice(mid), options);
        return [...leftRows, ...rightRows];
      }

      if (attempt === retries) {
        throw new Error(`Failed to query existing catalog rows for diff check: ${err.message || err}`);
      }
      if (baseDelayMs > 0) {
        await new Promise((r) => setTimeout(r, attempt * baseDelayMs));
      }
    }
  }
  return [];
}

async function filterChangedOrNewBooks(supabase, batch, shouldForceOverwrite = false, options = {}) {
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
  const existingById = new Map();
  if (options.cachedBooksById instanceof Map && options.cachedBooksById.size > 0) {
    for (const id of batchIds) {
      const cachedRow = options.cachedBooksById.get(id);
      if (cachedRow) {
        existingById.set(id, cachedRow);
      }
    }
  } else {
    const existingRows = await fetchExistingRowsWithRetry(supabase, batchIds, options);
    if (Array.isArray(existingRows)) {
      for (const row of existingRows) {
        if (row && Number.isInteger(row.id)) {
          existingById.set(row.id, row);
        }
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

// Sticky dynamic write chunk sizing & latency governor so statement timeouts never repeat across batches
const MIN_DYNAMIC_WRITE_CHUNK_SIZE = 25;
const MAX_DYNAMIC_WRITE_CHUNK_SIZE = 100;
let dynamicWriteChunkSize = MAX_DYNAMIC_WRITE_CHUNK_SIZE;
let consecutiveFastWrites = 0;

function getDynamicWriteChunkSize() {
  return dynamicWriteChunkSize;
}

function resetDynamicWriteChunkSize(size = MAX_DYNAMIC_WRITE_CHUNK_SIZE) {
  dynamicWriteChunkSize = Math.max(
    MIN_DYNAMIC_WRITE_CHUNK_SIZE,
    Math.min(MAX_DYNAMIC_WRITE_CHUNK_SIZE, size)
  );
  consecutiveFastWrites = 0;
}

async function upsertSingleWriteChunk(
  supabase,
  chunk,
  retries = 3,
  ignoreDuplicates = true,
  options = {}
) {
  let remainingBatch = deduplicateBatchById(chunk);
  if (remainingBatch.length === 0) return;
  const baseDelayMs =
    typeof options.baseDelayMs === 'number' && options.baseDelayMs >= 0 ? options.baseDelayMs : 1200;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const writeStartMs = Date.now();
    try {
      const { error } = await supabase
        .from('books')
        .upsert(remainingBatch, {
          onConflict: 'id',
          ignoreDuplicates,
        });

      if (error) {
        throw error;
      }

      const writeElapsedMs = Date.now() - writeStartMs;
      if (writeElapsedMs > 3500) {
        dynamicWriteChunkSize = Math.max(
          MIN_DYNAMIC_WRITE_CHUNK_SIZE,
          Math.floor(dynamicWriteChunkSize / 2)
        );
        consecutiveFastWrites = 0;
      } else if (writeElapsedMs < 800) {
        consecutiveFastWrites++;
        if (consecutiveFastWrites >= 5 && dynamicWriteChunkSize < MAX_DYNAMIC_WRITE_CHUNK_SIZE) {
          dynamicWriteChunkSize = Math.min(
            MAX_DYNAMIC_WRITE_CHUNK_SIZE,
            dynamicWriteChunkSize + 25
          );
          consecutiveFastWrites = 0;
        }
      }
      return;
    } catch (err) {
      // If a timeout/pool error occurred during a diff-upsert, check which books in the batch
      // were already committed properly before retrying or splitting the remainder.
      if (!ignoreDuplicates && supabase && typeof supabase.from === 'function') {
        try {
          const tableRef = supabase.from('books');
          if (tableRef && typeof tableRef.select === 'function') {
            const recheck = await filterChangedOrNewBooks(supabase, remainingBatch, false, {
              retries: 2,
              baseDelayMs: Math.min(baseDelayMs, 500),
            });
            remainingBatch = recheck.toUpsert;
            if (remainingBatch.length === 0) {
              return;
            }
          }
        } catch {
          // Non-blocking fallback: continue retrying the full remainingBatch
        }
      }

      // Adaptive split-and-conquer on statement or connection-pool timeouts
      const isTimeout = isTransientDatabaseTimeout(err);
      if (isTimeout) {
        dynamicWriteChunkSize = Math.max(
          MIN_DYNAMIC_WRITE_CHUNK_SIZE,
          Math.min(dynamicWriteChunkSize, Math.floor(remainingBatch.length / 2) || MIN_DYNAMIC_WRITE_CHUNK_SIZE)
        );
        consecutiveFastWrites = 0;
      }
      if (isTimeout && remainingBatch.length > MIN_DYNAMIC_WRITE_CHUNK_SIZE) {
        const mid = Math.floor(remainingBatch.length / 2);
        await upsertSingleWriteChunk(
          supabase,
          remainingBatch.slice(0, mid),
          retries,
          ignoreDuplicates,
          options
        );
        await upsertSingleWriteChunk(
          supabase,
          remainingBatch.slice(mid),
          retries,
          ignoreDuplicates,
          options
        );
        return;
      }

      if (attempt === retries) {
        throw new Error(`Failed to upsert batch after ${retries} attempts: ${err.message}`);
      }
      if (baseDelayMs > 0) {
        await new Promise((r) => setTimeout(r, attempt * baseDelayMs));
      }
    }
  }
}

async function upsertBatch(supabase, batch, retries = 3, ignoreDuplicates = true, options = {}) {
  const deduped = deduplicateBatchById(batch);
  if (deduped.length === 0) return;

  const maxChunk =
    typeof options.maxWriteChunkSize === 'number' && options.maxWriteChunkSize > 0
      ? options.maxWriteChunkSize
      : dynamicWriteChunkSize;

  if (deduped.length <= maxChunk) {
    await upsertSingleWriteChunk(supabase, deduped, retries, ignoreDuplicates, options);
    return;
  }

  let cursor = 0;
  while (cursor < deduped.length) {
    const activeStep =
      typeof options.maxWriteChunkSize === 'number' && options.maxWriteChunkSize > 0
        ? options.maxWriteChunkSize
        : dynamicWriteChunkSize;
    const slice = deduped.slice(cursor, cursor + activeStep);
    cursor += slice.length;
    await upsertSingleWriteChunk(supabase, slice, retries, ignoreDuplicates, options);
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
  const retries = typeof options.retries === 'number' && options.retries > 0 ? options.retries : 4;
  const baseDelayMs =
    typeof options.baseDelayMs === 'number' && options.baseDelayMs >= 0 ? options.baseDelayMs : 1200;

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
  let scannedCount = 0;
  const reconcileStartMs = Date.now();
  const expectedTotal = Math.max(1, activeCatalogIds.size);

  const cachedIdSource =
    options.cachedBookIds instanceof Set
      ? Array.from(options.cachedBookIds)
      : Array.isArray(options.cachedBookIds)
        ? options.cachedBookIds
        : null;

  if (cachedIdSource && cachedIdSource.length >= minCatalogSize) {
    for (const rawId of cachedIdSource) {
      if (Number.isInteger(rawId) && rawId > 0) {
        scannedCount++;
        if (!activeCatalogIds.has(rawId) && !PROTECTED_HERO_BOOK_IDS.has(rawId)) {
          withdrawnIds.push(rawId);
        }
      }
    }
  } else {
    while (true) {
      let data = null;
      for (let attempt = 1; attempt <= retries; attempt++) {
        const res = await supabase
          .from('books')
          .select('id')
          .gt('id', lastId)
          .order('id', { ascending: true })
          .limit(pageSize);

        if (!res.error) {
          data = res.data;
          break;
        }
        if (attempt === retries) {
          throw new Error(`Failed to scan existing catalog IDs for reconciliation: ${res.error.message}`);
        }
        if (baseDelayMs > 0) {
          await new Promise((r) => setTimeout(r, attempt * baseDelayMs));
        }
      }

      if (!Array.isArray(data) || data.length === 0) {
        break;
      }

      for (const row of data) {
        if (row && Number.isInteger(row.id) && row.id > 0) {
          lastId = row.id;
          scannedCount++;
          if (!activeCatalogIds.has(row.id) && !PROTECTED_HERO_BOOK_IDS.has(row.id)) {
            withdrawnIds.push(row.id);
          }
        }
      }

      if (process.stdout && typeof process.stdout.write === 'function' && logger === console) {
        const elapsedSec = ((Date.now() - reconcileStartMs) / 1000).toFixed(1);
        const pct = Math.min(100, (scannedCount / expectedTotal) * 100).toFixed(1);
        process.stdout.write(
          `\r  ↳ Scanned: ${scannedCount.toLocaleString()} / ${activeCatalogIds.size.toLocaleString()} (${pct}%) | Withdrawn: ${withdrawnIds.length} (${elapsedSec}s)   `
        );
      }

      if (data.length < pageSize) {
        break;
      }
    }

    if (process.stdout && typeof process.stdout.write === 'function' && logger === console && scannedCount > 0) {
      process.stdout.write('\n');
    }
  }

  if (withdrawnIds.length === 0) {
    logger.log('  ✔ Zero withdrawn books found (100% of Supabase catalog IDs remain active in Project Gutenberg).');
    return {
      prunedCount: 0,
      prunedIds: [],
      scannedCount,
      remainingCount: scannedCount,
      skippedReason: null,
    };
  }

  if (!forcePrune && withdrawnIds.length > maxPrunePerRun) {
    logger.warn(
      `  ⚠ Safety circuit breaker triggered: ${withdrawnIds.length.toLocaleString()} candidate removals exceed maxPrunePerRun (${maxPrunePerRun}). Pass --force-prune to override.`
    );
    return {
      prunedCount: 0,
      prunedIds: withdrawnIds,
      scannedCount,
      remainingCount: scannedCount,
      skippedReason: 'exceeded-max-prune-cap',
    };
  }

  let prunedCount = 0;
  for (let i = 0; i < withdrawnIds.length; i += deleteChunkSize) {
    const chunk = withdrawnIds.slice(i, i + deleteChunkSize);
    for (let attempt = 1; attempt <= retries; attempt++) {
      const { error: deleteErr } = await supabase.from('books').delete().in('id', chunk);
      if (!deleteErr) break;
      if (attempt === retries) {
        throw new Error(`Failed to delete withdrawn catalog book IDs: ${deleteErr.message}`);
      }
      if (baseDelayMs > 0) {
        await new Promise((r) => setTimeout(r, attempt * baseDelayMs));
      }
    }
    prunedCount += chunk.length;
  }

  logger.log(
    `  ✔ Pruned ${prunedCount.toLocaleString()} withdrawn Project Gutenberg volume(s) (and their quotes): [${withdrawnIds.slice(0, 15).join(', ')}${withdrawnIds.length > 15 ? ', ...' : ''}]`
  );
  return {
    prunedCount,
    prunedIds: withdrawnIds,
    scannedCount,
    remainingCount: Math.max(0, scannedCount - prunedCount),
    skippedReason: null,
  };
}

// 8. Popularity Download Count Hydration from Gutendex (Top 500+ Public Domain Titles)
async function fetchPopularCountsFromGutendex(pages = 21, fetchFn = globalThis.fetch, options = {}) {
  const popularEntries = [];
  const seenIds = new Set();
  const maxRetries = typeof options.retries === 'number' && options.retries >= 0 ? options.retries : 4;
  const baseDelayMs =
    typeof options.baseDelayMs === 'number' && options.baseDelayMs >= 0 ? options.baseDelayMs : 1200;
  const timeoutMs =
    typeof options.timeoutMs === 'number' && options.timeoutMs > 0 ? options.timeoutMs : 25000;
  const logger = options.logger || null;

  for (let page = 1; page <= pages; page++) {
    // Query index-backed /books/?page=N (avoiding unindexed WHERE copyright=false full-table scans on Gutendex)
    // and enforce public-domain copyright filtering in memory below.
    const url = `https://gutendex.com/books/?page=${page}`;
    let pageData = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const res = await fetchFn(url, {
          headers: {
            'User-Agent': resolveCatalogUserAgent(),
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res || !res.ok) {
          const status = res ? res.status : 'NO_RESPONSE';
          throw new Error(`Gutendex HTTP ${status} on page ${page}`);
        }
        const data = await res.json();
        if (!data || !Array.isArray(data.results) || data.results.length === 0) {
          break;
        }
        pageData = data;
        break;
      } catch (err) {
        if (attempt <= maxRetries) {
          if (logger && typeof logger.warn === 'function') {
            logger.warn(
              `  ⚠ Warning: Popularity page ${page}/${pages} attempt ${attempt}/${maxRetries} failed (${err.message || err}); retrying...`
            );
          }
          if (baseDelayMs > 0) {
            await new Promise((r) => setTimeout(r, attempt * baseDelayMs));
          }
        }
      }
    }

    if (!pageData || !Array.isArray(pageData.results) || pageData.results.length === 0) {
      break;
    }

    for (const item of pageData.results) {
      if (
        item &&
        item.copyright !== true &&
        item.copyright !== null &&
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

    if (logger && typeof logger.log === 'function') {
      logger.log(
        `  ↳ Fetched popularity page ${page}/${pages} (${popularEntries.length.toLocaleString()} public-domain books)...`
      );
    }

    if (!pageData.next) break;
  }

  return popularEntries;
}

async function syncPopularDownloadCounts(supabase, options = {}) {
  if (!supabase) return { updatedCount: 0, demotedCount: 0 };
  const pages = typeof options.pages === 'number' && options.pages > 0 ? options.pages : 21;
  const fetchFn = options.fetchFn || globalThis.fetch;
  const logger = options.logger || console;
  const minEntriesForDemote =
    typeof options.minEntriesForDemote === 'number' ? options.minEntriesForDemote : 500;
  const maxRetries = typeof options.retries === 'number' && options.retries >= 0 ? options.retries : 3;
  const baseDelayMs =
    typeof options.baseDelayMs === 'number' && options.baseDelayMs >= 0 ? options.baseDelayMs : 1000;

  logger.log(`\n🔥 Hydrating download_count for Top Popular Gutenberg titles (${pages} pages)...`);
  const entries = await fetchPopularCountsFromGutendex(pages, fetchFn, {
    retries: options.pageRetries,
    baseDelayMs: options.pageBaseDelayMs,
    timeoutMs: options.pageTimeoutMs,
    logger,
  });
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
        for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
          const { error } = await supabase
            .from('books')
            .update({ download_count: entry.download_count })
            .eq('id', entry.id);
          if (!error) {
            updatedCount++;
            break;
          }
          if (attempt <= maxRetries && baseDelayMs > 0) {
            await new Promise((r) => setTimeout(r, attempt * baseDelayMs));
          }
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
    let topRows = null;
    let scanErr = null;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const res = await supabase
        .from('books')
        .select('id, download_count')
        .order('download_count', { ascending: false })
        .limit(1000);
      if (!res.error) {
        topRows = res.data;
        scanErr = null;
        break;
      }
      scanErr = res.error;
      if (attempt <= maxRetries && baseDelayMs > 0) {
        await new Promise((r) => setTimeout(r, attempt * baseDelayMs));
      }
    }

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
          let demoteErr = null;
          for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
            const res = await supabase
              .from('books')
              .update({ download_count: demotedCountValue })
              .in('id', chunk);
            if (!res.error) {
              demoteErr = null;
              break;
            }
            demoteErr = res.error;
            if (attempt <= maxRetries && baseDelayMs > 0) {
              await new Promise((r) => setTimeout(r, attempt * baseDelayMs));
            }
          }
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

// 8B. Permanent Snapshot Cache & Two-Tier Quote Pool Diff Engine
const DEFAULT_QUOTE_POPULAR_POOL_SIZE = 500;
const DEFAULT_QUOTE_RECENT_POOL_SIZE = 64;

function extractCacheableBookRecord(book) {
  if (!book || !Number.isInteger(book.id) || book.id <= 0) return null;
  return {
    id: book.id,
    title: book.title || '',
    authors: Array.isArray(book.authors) ? book.authors : [],
    translators: Array.isArray(book.translators) ? book.translators : [],
    subjects: Array.isArray(book.subjects) ? book.subjects : [],
    bookshelves: Array.isArray(book.bookshelves) ? book.bookshelves : [],
    languages: Array.isArray(book.languages) ? book.languages : [],
    copyright: Boolean(book.copyright),
    media_type: book.media_type || 'Text',
    download_count: typeof book.download_count === 'number' ? book.download_count : 0,
    max_author_death_year: book.max_author_death_year ?? null,
    min_author_birth_year: book.min_author_birth_year ?? null,
  };
}

function loadCatalogSnapshotCache(cacheFilePath, options = {}) {
  const fsImpl = options.fsImpl || fs;
  const logger = options.logger || null;
  const emptyResult = {
    loaded: false,
    booksById: new Map(),
    candidatePoolIds: new Set(),
  };

  if (!cacheFilePath || !fsImpl.existsSync(cacheFilePath)) {
    return emptyResult;
  }

  try {
    const rawBuf = fsImpl.readFileSync(cacheFilePath);
    const jsonStr = cacheFilePath.endsWith('.gz')
      ? zlib.gunzipSync(rawBuf).toString('utf8')
      : rawBuf.toString('utf8');
    const parsed = JSON.parse(jsonStr);
    const rawBooks = Array.isArray(parsed)
      ? parsed
      : parsed && Array.isArray(parsed.books)
        ? parsed.books
        : [];
    const booksById = new Map();
    for (const item of rawBooks) {
      const normalized = extractCacheableBookRecord(item);
      if (normalized) {
        booksById.set(normalized.id, normalized);
      }
    }
    const candidatePoolIds = new Set(
      parsed && Array.isArray(parsed.candidatePoolIds)
        ? parsed.candidatePoolIds.filter((id) => Number.isInteger(id) && id > 0)
        : []
    );

    if (booksById.size === 0) {
      return emptyResult;
    }

    if (logger) {
      logger.log(
        `  ✔ Restored catalog snapshot cache (${booksById.size.toLocaleString()} books, ${candidatePoolIds.size} prior quote pool IDs) from ${cacheFilePath}.`
      );
    }

    return {
      loaded: true,
      booksById,
      candidatePoolIds,
    };
  } catch (err) {
    if (logger) {
      logger.warn(
        `  ⚠ Warning: Could not load catalog snapshot cache from ${cacheFilePath} (${err.message || err}); falling back to live Supabase diff queries.`
      );
    }
    return emptyResult;
  }
}

function saveCatalogSnapshotCache(cacheFilePath, booksById, candidatePoolIds = [], options = {}) {
  const fsImpl = options.fsImpl || fs;
  const logger = options.logger || null;
  const minCatalogSize =
    typeof options.minCatalogSize === 'number' ? options.minCatalogSize : MIN_ACTIVE_CATALOG_FOR_PRUNE;

  if (!cacheFilePath || !(booksById instanceof Map)) {
    return { saved: false, skippedReason: 'missing-path-or-map', count: 0 };
  }

  if (booksById.size < minCatalogSize) {
    if (logger) {
      logger.warn(
        `  ⚠ Skipping snapshot cache write: catalog count (${booksById.size.toLocaleString()}) is below safety floor (${minCatalogSize.toLocaleString()}).`
      );
    }
    return { saved: false, skippedReason: 'below-min-catalog-floor', count: booksById.size };
  }

  const booksArray = [];
  for (const book of booksById.values()) {
    const clean = extractCacheableBookRecord(book);
    if (clean) booksArray.push(clean);
  }
  booksArray.sort((a, b) => a.id - b.id);

  const poolArray = Array.from(candidatePoolIds instanceof Set ? candidatePoolIds : candidatePoolIds || [])
    .filter((id) => Number.isInteger(id) && id > 0);

  const payload = JSON.stringify({
    version: 1,
    updatedAt: new Date().toISOString(),
    candidatePoolIds: poolArray,
    books: booksArray,
  });

  const outBuffer = cacheFilePath.endsWith('.gz')
    ? zlib.gzipSync(Buffer.from(payload, 'utf8'))
    : Buffer.from(payload, 'utf8');

  const tmpPath = `${cacheFilePath}.tmp`;
  fsImpl.writeFileSync(tmpPath, outBuffer);
  fsImpl.renameSync(tmpPath, cacheFilePath);

  if (logger) {
    const sizeMb = (outBuffer.length / (1024 * 1024)).toFixed(2);
    logger.log(
      `  ✔ Saved catalog snapshot cache (${booksArray.length.toLocaleString()} books, ${sizeMb} MB) to ${cacheFilePath}.`
    );
  }

  return { saved: true, skippedReason: null, count: booksArray.length };
}

function computeCatalogQuotePoolDiff(booksById, previousCandidatePoolIds = new Set(), options = {}) {
  const fsImpl = options.fsImpl || fs;
  const logger = options.logger || null;
  const popularPoolLimit =
    typeof options.popularPool === 'number' && options.popularPool > 0
      ? options.popularPool
      : DEFAULT_QUOTE_POPULAR_POOL_SIZE;
  const recentPoolLimit =
    typeof options.recentPool === 'number' && options.recentPool >= 0
      ? options.recentPool
      : DEFAULT_QUOTE_RECENT_POOL_SIZE;

  const isEligibleCatalogBook = (row) =>
    row &&
    Number.isInteger(row.id) &&
    row.copyright !== true &&
    (!row.media_type || row.media_type === 'Text');

  const isEligibleEnglishBook = (row) =>
    isEligibleCatalogBook(row) &&
    (!Array.isArray(row.languages) || row.languages.length === 0 || row.languages.includes('en'));

  const allBooks = booksById instanceof Map ? Array.from(booksById.values()) : Array.isArray(booksById) ? booksById : [];

  const popularData = allBooks
    .filter(isEligibleEnglishBook)
    .sort((a, b) => {
      const aHero = PROTECTED_HERO_BOOK_IDS.has(a.id) ? 1 : 0;
      const bHero = PROTECTED_HERO_BOOK_IDS.has(b.id) ? 1 : 0;
      if (aHero !== bHero) return bHero - aHero;
      return (b.download_count || 0) - (a.download_count || 0) || a.id - b.id;
    })
    .slice(0, popularPoolLimit)
    .map(extractCacheableBookRecord)
    .filter(Boolean);

  let recentData = [];
  let minRecentHorizonId = null;
  if (recentPoolLimit > 0) {
    const recentScanLimit = Math.max(recentPoolLimit * 5, 320);
    const sortedByIdDesc = [...allBooks]
      .filter((r) => r && Number.isInteger(r.id) && r.id > 0)
      .sort((a, b) => b.id - a.id);
    const recentScanSlice = sortedByIdDesc.slice(0, recentScanLimit);
    const validRecentScanIds = recentScanSlice.map((r) => r.id);
    if (validRecentScanIds.length > 0) {
      const maxRecentId = Math.max(...validRecentScanIds);
      minRecentHorizonId = Math.max(1, Math.min(Math.min(...validRecentScanIds), maxRecentId - 5000));
    }
    recentData = recentScanSlice
      .filter(isEligibleCatalogBook)
      .slice(0, recentPoolLimit)
      .map(extractCacheableBookRecord)
      .filter(Boolean);
  }

  const popularPoolIds = popularData.map((r) => r.id);
  const recentPoolIds = recentData.map((r) => r.id);
  const candidatePoolSet = new Set([...popularPoolIds, ...recentPoolIds]);
  const candidatePoolIds = Array.from(candidatePoolSet);

  const prevSet =
    previousCandidatePoolIds instanceof Set
      ? previousCandidatePoolIds
      : new Set(Array.isArray(previousCandidatePoolIds) ? previousCandidatePoolIds : []);

  const promotedIds =
    prevSet.size > 0
      ? candidatePoolIds.filter((id) => !prevSet.has(id))
      : [...candidatePoolIds];
  const demotedIds =
    prevSet.size > 0
      ? Array.from(prevSet).filter((id) => Number.isInteger(id) && id > 0 && !candidatePoolSet.has(id))
      : [];

  const diffPayload = {
    updatedAt: new Date().toISOString(),
    candidatePoolIds,
    popularPoolIds,
    recentPoolIds,
    promotedIds,
    demotedIds,
    minRecentHorizonId,
    popularData,
    recentData,
  };

  if (options.diffOutputPath) {
    fsImpl.writeFileSync(options.diffOutputPath, JSON.stringify(diffPayload, null, 2), 'utf8');
    if (logger) {
      logger.log(
        `  ✔ Wrote Two-Tier quote pool diff (${candidatePoolIds.length} pool IDs, ${promotedIds.length} promoted, ${demotedIds.length} demoted) to ${options.diffOutputPath}.`
      );
    }
  }

  return diffPayload;
}

// 9. Main Orchestrator
async function main() {
  const args = process.argv.slice(2);
  const isHelp = args.includes('--help') || args.includes('-h');
  const isDryRun = args.includes('--dry-run');
  const shouldUpdateExisting = args.includes('--update-existing');
  const noPrune = args.includes('--no-prune');
  const forcePrune = args.includes('--force-prune');
  const popularOnly = args.includes('--popular-only');
  const noRdf = args.includes('--no-rdf');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
  const languagesArg = args.find((a) => a.startsWith('--languages='));
  const allowedLanguages = languagesArg ? new Set(languagesArg.split('=')[1].toLowerCase().split(',')) : null;
  const batchSizeArg = args.find((a) => a.startsWith('--batch-size='));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 200;
  const cacheFileArg = args.find((a) => a.startsWith('--cache-file='));
  const cacheFilePath = cacheFileArg ? cacheFileArg.slice('--cache-file='.length).trim() : null;
  const diffOutputArg = args.find((a) => a.startsWith('--diff-output='));
  const diffOutputPath = diffOutputArg ? diffOutputArg.slice('--diff-output='.length).trim() : null;

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
  --cache-file=PATH     Load/save compressed catalog snapshot cache (.json.gz) for in-RAM diffing
  --diff-output=PATH    Write Two-Tier quote pool diff JSON (quote-diff.json) for sync-featured-quotes.js
  --update-existing     Force full overwrite of all existing records (default: smart exact-diff update preserving quotes)
  --no-prune            Skip withdrawn-book reconciliation at the end of a full sync
  --force-prune         Override the 500-book per-run safety cap during withdrawn-book pruning
  --no-rdf              Skip streaming rdf-files.tar.bz2 full-catalog download counts (falls back to Gutendex Top Popular)
  --popular-only        Refresh Top-500 popular download_count and cooled-off demotion only
  --help, -h            Show this help guide
`);
    process.exit(0);
  }

  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('📚 Bookarium Gutenberg Catalog Sync');
  console.log('====================================');
  console.log(`• Mode:        ${isDryRun ? 'DRY-RUN (No database writes)' : popularOnly ? 'POPULARITY HYDRATION ONLY' : 'LIVE UPSERT'}`);
  console.log(
    `• Strategy:    ${shouldUpdateExisting ? 'FORCE OVERWRITE (Rebuild all records)' : 'SMART EXACT-DIFF (Insert new + update changed metadata & download_count, preserving quotes)'}`
  );
  console.log(`• Batch Size:  ${batchSize} books/request`);
  if (cacheFilePath) console.log(`• Cache File:  ${cacheFilePath}`);
  if (diffOutputPath) console.log(`• Diff Output: ${diffOutputPath}`);
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

  if (popularOnly) {
    if (!isDryRun && supabase) {
      await syncPopularDownloadCounts(supabase);
    }
    return;
  }

  const cachedSnapshot =
    cacheFilePath && !shouldUpdateExisting
      ? loadCatalogSnapshotCache(cacheFilePath, { logger: console })
      : { loaded: false, booksById: new Map(), candidatePoolIds: new Set() };

  let rdfDownloadCounts = new Map();
  if (!noRdf && !limit) {
    rdfDownloadCounts = await streamGutenbergRdfDownloadCounts({ logger: console });
  }

  const startTime = Date.now();

  let totalParsed = 0;
  let totalAccepted = 0;
  let totalProcessed = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalUnchanged = 0;
  let hasPrintedCsvSummary = false;
  let lastCsvDownloadLogMs = 0;
  let currentBatch = [];
  let isAborted = false;
  const activeCatalogIds = new Set();
  const nextSnapshotBooksById = new Map();

  const flushBatch = async () => {
    if (currentBatch.length === 0) return;
    const toSend = [...currentBatch];
    currentBatch = [];

    if (!hasPrintedCsvSummary) {
      hasPrintedCsvSummary = true;
      process.stdout.write('\n');
    }

    let wroteRows = 0;
    if (!isDryRun && supabase) {
      const { toUpsert, insertedCount, updatedCount, unchangedCount } = await filterChangedOrNewBooks(
        supabase,
        toSend,
        shouldUpdateExisting,
        {
          cachedBooksById: cachedSnapshot.loaded ? cachedSnapshot.booksById : null,
        }
      );
      if (toUpsert.length > 0) {
        wroteRows = toUpsert.length;
        await upsertBatch(supabase, toUpsert, 3, false);
      }
      totalInserted += insertedCount;
      totalUpdated += updatedCount;
      totalUnchanged += unchangedCount;
    }
    for (const b of toSend) {
      const cacheEntry = extractCacheableBookRecord(b);
      if (cacheEntry) {
        nextSnapshotBooksById.set(cacheEntry.id, cacheEntry);
      }
    }
    totalProcessed += toSend.length;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const speed = Math.round(totalProcessed / (parseFloat(elapsed) || 1));
    process.stdout.write(
      `\r  ↳ Processed: ${totalProcessed.toLocaleString()} | New: ${totalInserted.toLocaleString()} | Updated: ${totalUpdated.toLocaleString()} | Unchanged: ${totalUnchanged.toLocaleString()} | ${speed} books/s (${elapsed}s)   `
    );

    // Dynamic anti-throttling pause: 0ms when diffed purely in RAM with 0 writes, 50ms when DB-queried, scaled when writing
    const pauseMs =
      wroteRows === 0
        ? cachedSnapshot.loaded
          ? 0
          : 50
        : dynamicWriteChunkSize < MAX_DYNAMIC_WRITE_CHUNK_SIZE
          ? 200
          : 100;
    if (pauseMs > 0) {
      await new Promise((r) => setTimeout(r, pauseMs));
    }
  };

  try {
    await streamGutenbergCatalog(
      async (row) => {
        if (isAborted) return;

        totalParsed++;
        const book = normalizeCsvRow(row, rdfDownloadCounts);
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
      },
      {
        logger: console,
        onDownloadProgress: ({ downloadedBytes, totalBytes, speedMBps, elapsedSec }) => {
          if (hasPrintedCsvSummary) return;
          const now = Date.now();
          if (
            (totalBytes > 0 && downloadedBytes >= totalBytes) ||
            now - lastCsvDownloadLogMs >= 200
          ) {
            lastCsvDownloadLogMs = now;
            const dlMb = (downloadedBytes / (1024 * 1024)).toFixed(1);
            const sizePart =
              totalBytes > 0
                ? `${dlMb}/${(totalBytes / (1024 * 1024)).toFixed(1)} MB (${((downloadedBytes / totalBytes) * 100).toFixed(1)}%) @ ${speedMBps.toFixed(1)} MB/s`
                : `${dlMb} MB @ ${speedMBps.toFixed(1)} MB/s`;
            process.stdout.write(
              `\r  ↳ CSV: ${sizePart} (${elapsedSec.toFixed(1)}s)   `
            );
          }
        },
      }
    );

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

    let reconcileResult = null;
    if (!isDryRun && supabase && !limit && !allowedLanguages && !noPrune) {
      reconcileResult = await reconcileWithdrawnCatalogBooks(supabase, activeCatalogIds, {
        forcePrune,
        cachedBookIds: cachedSnapshot.loaded ? new Set(cachedSnapshot.booksById.keys()) : null,
      });
    }

    // Only fall back to Gutendex Top Popular hydration if the RDF archive was skipped or unreachable
    if (!isDryRun && supabase && !limit && rdfDownloadCounts.size === 0) {
      await syncPopularDownloadCounts(supabase);
    }

    let quotePoolDiff = null;
    if ((diffOutputPath || cacheFilePath) && !limit && !allowedLanguages && nextSnapshotBooksById.size > 0) {
      quotePoolDiff = computeCatalogQuotePoolDiff(
        nextSnapshotBooksById,
        cachedSnapshot.candidatePoolIds,
        {
          diffOutputPath,
          logger: console,
        }
      );
    }

    if (cacheFilePath && !isDryRun && !limit && !allowedLanguages) {
      saveCatalogSnapshotCache(
        cacheFilePath,
        nextSnapshotBooksById,
        quotePoolDiff ? quotePoolDiff.candidatePoolIds : [],
        { logger: console }
      );
    }

    if (!isDryRun && supabase) {
      let catalogTotal =
        reconcileResult && typeof reconcileResult.remainingCount === 'number' && reconcileResult.remainingCount > 0
          ? reconcileResult.remainingCount
          : null;
      if (!catalogTotal) {
        const { count } = await supabase
          .from('books')
          .select('id', { count: 'estimated', head: true });
        catalogTotal = count || activeCatalogIds.size || null;
      }
      console.log(`  • Current Supabase Catalog Total: ${catalogTotal ? catalogTotal.toLocaleString() : 'N/A'} books`);
    }
  } catch (err) {
    console.error('\n✖ Sync failed:', err.message || err);
    process.exit(1);
  }
}

// Export for unit tests
module.exports = {
  CATALOG_DIFF_SELECT_COLUMNS,
  GUTENBERG_RDF_FEED_MIRRORS,
  GUTENBERG_CSV_FEED_MIRRORS,
  MIN_ACTIVE_CATALOG_FOR_PRUNE,
  MAX_WITHDRAWN_PRUNE_PER_RUN,
  PROTECTED_HERO_BOOK_IDS,
  parseYear,
  parseContributors,
  computeLifespanBounds,
  buildStandardFormats,
  normalizeCsvRow,
  isAllowedRdfFeedUrl,
  isAllowedCsvFeedUrl,
  parseRdfDownloadCountsStream,
  streamGutenbergRdfDownloadCounts,
  streamGutenbergCatalog,
  areStringArraysEqual,
  areContributorArraysEqual,
  hasCatalogMetadataChanged,
  deduplicateBatchById,
  isTransientDatabaseTimeout,
  fetchExistingRowsWithRetry,
  filterChangedOrNewBooks,
  getDynamicWriteChunkSize,
  resetDynamicWriteChunkSize,
  upsertBatch,
  reconcileWithdrawnCatalogBooks,
  fetchPopularCountsFromGutendex,
  syncPopularDownloadCounts,
  extractCacheableBookRecord,
  loadCatalogSnapshotCache,
  saveCatalogSnapshotCache,
  computeCatalogQuotePoolDiff,
  loadEnv,
};

if (require.main === module) {
  main();
}


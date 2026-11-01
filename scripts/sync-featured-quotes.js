#!/usr/bin/env node
/**
 * Bookarium — PGLAF Mirror-First Featured Quotes Extraction & Sync Pipeline
 *
 * Sequentially resolves unabridged plain-text volumes (checking `public.books.content` first,
 * then official PGLAF bulk mirrors `aleph.gutenberg.org`, `gutenberg.pglaf.org`, and
 * `gutenberg.readingroo.ms` with an 8.0s–16.0s randomized float delay between books),
 * extracts 10–16 multi-quote spreads per volume, and updates `public.books.quotes` JSONB.
 *
 * Usage:
 *   node scripts/sync-featured-quotes.js --dry-run
 *   node scripts/sync-featured-quotes.js --limit=25 --min-delay=8 --max-delay=16
 *   node scripts/sync-featured-quotes.js --ids=1342,84,2701 --force
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const USER_AGENT =
  'Bookarium/1.0 (+https://github.com/Synaptix1999/Bookarium; Public Domain Literary Sanctuary)';

const GUTENBERG_MIRRORS = [
  'https://aleph.gutenberg.org',
  'https://gutenberg.pglaf.org',
  'https://gutenberg.readingroo.ms',
];

const CURATED_QUOTE_BOOKS = [
  {
    id: 1342,
    title: 'Pride and Prejudice',
    authors: [{ name: 'Jane Austen', birth_year: 1775, death_year: 1817 }],
    translators: [],
    subjects: ['Classic Romance & Social Satire'],
    languages: ['en'],
  },
  {
    id: 84,
    title: 'Frankenstein',
    authors: [{ name: 'Mary Wollstonecraft Shelley', birth_year: 1797, death_year: 1851 }],
    translators: [],
    subjects: ['Gothic Science Fiction & Horror'],
    languages: ['en'],
  },
  {
    id: 2701,
    title: 'Moby Dick',
    authors: [{ name: 'Herman Melville', birth_year: 1819, death_year: 1891 }],
    translators: [],
    subjects: ['Maritime Epic & Adventure'],
    languages: ['en'],
  },
  {
    id: 64317,
    title: 'The Great Gatsby',
    authors: [{ name: 'F. Scott Fitzgerald', birth_year: 1896, death_year: 1940 }],
    translators: [],
    subjects: ['Jazz Age & American Tragedy'],
    languages: ['en'],
  },
  {
    id: 11,
    title: "Alice's Adventures in Wonderland",
    authors: [{ name: 'Lewis Carroll', birth_year: 1832, death_year: 1898 }],
    translators: [],
    subjects: ['Literary Nonsense & Fantasy'],
    languages: ['en'],
  },
  {
    id: 174,
    title: 'The Picture of Dorian Gray',
    authors: [{ name: 'Oscar Wilde', birth_year: 1854, death_year: 1900 }],
    translators: [],
    subjects: ['Philosophical Fiction & Gothic'],
    languages: ['en'],
  },
  {
    id: 1661,
    title: 'The Adventures of Sherlock Holmes',
    authors: [{ name: 'Arthur Conan Doyle', birth_year: 1859, death_year: 1930 }],
    translators: [],
    subjects: ['Detective Mystery & Deduction'],
    languages: ['en'],
  },
  {
    id: 345,
    title: 'Dracula',
    authors: [{ name: 'Bram Stoker', birth_year: 1847, death_year: 1912 }],
    translators: [],
    subjects: ['Epistolary Gothic Horror'],
    languages: ['en'],
  },
  {
    id: 2554,
    title: 'Crime and Punishment',
    authors: [{ name: 'Fyodor Dostoevsky', birth_year: 1821, death_year: 1881 }],
    translators: [{ name: 'Constance Garnett', birth_year: 1861, death_year: 1946 }],
    subjects: ['Psychological & Philosophical Realism'],
    languages: ['en'],
  },
  {
    id: 2600,
    title: 'War and Peace',
    authors: [{ name: 'Leo Tolstoy', birth_year: 1828, death_year: 1910 }],
    translators: [
      { name: 'Aylmer Maude', birth_year: 1858, death_year: 1938 },
      { name: 'Louise Maude', birth_year: 1855, death_year: 1939 },
    ],
    subjects: ['Historical Epic & Philosophy'],
    languages: ['en'],
  },
  {
    id: 1727,
    title: 'The Odyssey',
    authors: [{ name: 'Homer', birth_year: -800, death_year: -750 }],
    translators: [{ name: 'Samuel Butler', birth_year: 1835, death_year: 1902 }],
    subjects: ['Classical Epic Mythology'],
    languages: ['en'],
  },
  {
    id: 135,
    title: 'Les Misérables',
    authors: [{ name: 'Victor Hugo', birth_year: 1802, death_year: 1885 }],
    translators: [{ name: 'Isabel Florence Hapgood', birth_year: 1850, death_year: 1928 }],
    subjects: ['French Historical Epic & Redemption'],
    languages: ['en'],
  },
  {
    id: 768,
    title: 'Wuthering Heights',
    authors: [{ name: 'Emily Brontë', birth_year: 1818, death_year: 1848 }],
    translators: [],
    subjects: ['Yorkshire Gothic & Tragic Romance'],
    languages: ['en'],
  },
  {
    id: 5200,
    title: 'Metamorphosis',
    authors: [{ name: 'Franz Kafka', birth_year: 1883, death_year: 1924 }],
    translators: [{ name: 'David Wyllie', birth_year: null, death_year: null }],
    subjects: ['Existentialism & Absurdist Fiction'],
    languages: ['en'],
  },
  {
    id: 2680,
    title: 'Meditations',
    authors: [{ name: 'Marcus Aurelius', birth_year: 121, death_year: 180 }],
    translators: [{ name: 'George Long', birth_year: 1800, death_year: 1879 }],
    subjects: ['Stoic Philosophy & Ethics'],
    languages: ['en'],
  },
  {
    id: 164,
    title: 'Twenty Thousand Leagues Under the Sea',
    authors: [{ name: 'Jules Verne', birth_year: 1828, death_year: 1905 }],
    translators: [{ name: 'Lewis Mercier', birth_year: 1800, death_year: 1875 }],
    subjects: ['Submarine Adventure & Speculative Science'],
    languages: ['en'],
  },
  {
    id: 43,
    title: 'The Strange Case of Dr. Jekyll and Mr. Hyde',
    authors: [{ name: 'Robert Louis Stevenson', birth_year: 1850, death_year: 1894 }],
    translators: [],
    subjects: ['Psychological Mystery & Dualism'],
    languages: ['en'],
  },
  {
    id: 8800,
    title: 'The Divine Comedy',
    authors: [{ name: 'Dante Alighieri', birth_year: 1265, death_year: 1321 }],
    translators: [{ name: 'Henry Francis Cary', birth_year: 1772, death_year: 1844 }],
    subjects: ['Medieval Epic Poetry & Afterlife'],
    languages: ['en'],
  },
  {
    id: 996,
    title: 'Don Quixote',
    authors: [{ name: 'Miguel de Cervantes Saavedra', birth_year: 1547, death_year: 1616 }],
    translators: [{ name: 'John Ormsby', birth_year: 1829, death_year: 1895 }],
    subjects: ['Chivalric Satire & World Literature'],
    languages: ['en'],
  },
  {
    id: 76,
    title: 'Adventures of Huckleberry Finn',
    authors: [{ name: 'Mark Twain', birth_year: 1835, death_year: 1910 }],
    translators: [],
    subjects: ['Mississippi Satire & American Realism'],
    languages: ['en'],
  },
  {
    id: 98,
    title: 'A Tale of Two Cities',
    authors: [{ name: 'Charles Dickens', birth_year: 1812, death_year: 1870 }],
    translators: [],
    subjects: ['Historical Novel & French Revolution'],
    languages: ['en'],
  },
  {
    id: 1260,
    title: 'Jane Eyre',
    authors: [{ name: 'Charlotte Brontë', birth_year: 1816, death_year: 1855 }],
    translators: [],
    subjects: ['Victorian Romance & Bildungsroman'],
    languages: ['en'],
  },
  {
    id: 1184,
    title: 'The Count of Monte Cristo',
    authors: [{ name: 'Alexandre Dumas', birth_year: 1802, death_year: 1870 }],
    translators: [],
    subjects: ['Revenge Epic & Historical Adventure'],
    languages: ['en'],
  },
  {
    id: 132,
    title: 'The Art of War',
    authors: [{ name: 'Sun Tzu', birth_year: -544, death_year: -496 }],
    translators: [{ name: 'Lionel Giles', birth_year: 1875, death_year: 1958 }],
    subjects: ['Military Strategy & Philosophy'],
    languages: ['en'],
  },
  {
    id: 1232,
    title: 'The Prince',
    authors: [{ name: 'Niccolò Machiavelli', birth_year: 1469, death_year: 1527 }],
    translators: [{ name: 'W. K. Marriott', birth_year: null, death_year: 1927 }],
    subjects: ['Political Statecraft & Renaissance Philosophy'],
    languages: ['en'],
  },
];

function loadEnv(rootDir = path.resolve(__dirname, '..')) {
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
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
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

function parseCliArgs(argv = process.argv.slice(2)) {
  const options = {
    dryRun: false,
    force: false,
    limit: 25,
    minDelaySec: 8,
    maxDelaySec: 16,
    mirrorCooldownMs: 30000,
    targetCount: 14,
    ids: null,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg.startsWith('--limit=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (Number.isInteger(val) && val > 0) options.limit = val;
    } else if (arg.startsWith('--min-delay=')) {
      const val = parseFloat(arg.split('=')[1]);
      if (Number.isFinite(val) && val >= 0) options.minDelaySec = val;
    } else if (arg.startsWith('--max-delay=')) {
      const val = parseFloat(arg.split('=')[1]);
      if (Number.isFinite(val) && val >= 0) options.maxDelaySec = val;
    } else if (arg.startsWith('--target-count=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (Number.isInteger(val) && val >= 10 && val <= 16) options.targetCount = val;
    } else if (arg.startsWith('--ids=')) {
      const rawIds = arg
        .split('=')[1]
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isInteger(n) && n > 0);
      if (rawIds.length > 0) options.ids = rawIds;
    }
  }

  if (options.maxDelaySec < options.minDelaySec) {
    options.maxDelaySec = options.minDelaySec;
  }

  return options;
}

/**
 * Computes a randomized floating-point delay in milliseconds between [minSec, maxSec]
 * (default 8.0s to 16.0s) so mirror requests never exhibit fixed robotic intervals.
 */
function computeRandomDelayMs(minSec = 8, maxSec = 16, rng = Math.random) {
  const low = Math.max(0, Math.min(minSec, maxSec));
  const high = Math.max(low, Math.max(minSec, maxSec));
  const randomSeconds = low + rng() * (high - low);
  return Math.round(randomSeconds * 1000);
}

/**
 * Builds the canonical Project Gutenberg mirror directory path for a given book ID.
 * E.g. 8 -> "0/8", 84 -> "8/84", 1342 -> "1/3/4/1342", 64317 -> "6/4/3/1/64317"
 */
function buildGutenbergPathDir(bookId) {
  const str = String(bookId).trim();
  if (str.length <= 1) {
    return `0/${str}`;
  }
  const prefixDirs = str.slice(0, -1).split('').join('/');
  return `${prefixDirs}/${str}`;
}

/**
 * Builds candidate HTTPS plain-text URLs for a single PGLAF bulk mirror.
 */
function buildSingleMirrorCandidateUrls(bookId, mirrorBaseUrl) {
  const dir = buildGutenbergPathDir(bookId);
  const base = String(mirrorBaseUrl || '').replace(/\/+$/, '');
  const filenames = [`${bookId}-0.txt`, `${bookId}.txt`, `${bookId}-8.txt`];
  return filenames.map((fname) => `${base}/${dir}/${fname}`);
}

/**
 * Builds candidate HTTPS plain-text URLs strictly across official PGLAF bulk mirrors.
 * Never includes www.gutenberg.org.
 */
function buildMirrorCandidateUrls(bookId, mirrors = GUTENBERG_MIRRORS) {
  const urls = [];
  for (const mirror of mirrors) {
    urls.push(...buildSingleMirrorCandidateUrls(bookId, mirror));
  }
  return urls;
}

/**
 * Attempts to fetch plain text for a book from a single assigned PGLAF mirror.
 * Distinguishes between 404 file-variant misses and mirror-level errors (429/403/5xx/timeout).
 */
async function fetchBookTextFromSingleMirror(
  bookId,
  mirrorBaseUrl,
  fetchFn = globalThis.fetch
) {
  const candidateUrls = buildSingleMirrorCandidateUrls(bookId, mirrorBaseUrl);

  for (const url of candidateUrls) {
    try {
      const response = await fetchFn(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/plain,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(25000),
      });

      if (response && response.ok) {
        const text = await response.text();
        if (text && text.trim().length >= 500 && !/<!DOCTYPE html/i.test(text.slice(0, 300))) {
          return {
            ok: true,
            text,
            mirrorUrl: url,
            isMirrorLevelError: false,
          };
        }
      } else if (response && typeof response.status === 'number') {
        if (response.status === 429 || response.status === 403 || response.status >= 500) {
          return {
            ok: false,
            isMirrorLevelError: true,
            status: response.status,
            error: `HTTP ${response.status} on ${mirrorBaseUrl}`,
          };
        }
      }
    } catch (err) {
      return {
        ok: false,
        isMirrorLevelError: true,
        status: 0,
        error: err.message || `Network error on ${mirrorBaseUrl}`,
      };
    }
  }

  return {
    ok: false,
    isMirrorLevelError: false,
    status: 404,
    error: `Volume #${bookId} not found on ${mirrorBaseUrl}`,
  };
}

/**
 * Sequentially attempts PGLAF bulk mirrors until a valid plain-text body is retrieved.
 */
async function fetchBookTextFromMirrors(bookId, fetchFn = globalThis.fetch) {
  let lastError = null;
  for (const mirror of GUTENBERG_MIRRORS) {
    const res = await fetchBookTextFromSingleMirror(bookId, mirror, fetchFn);
    if (res.ok) {
      return { text: res.text, mirrorUrl: res.mirrorUrl };
    }
    lastError = new Error(res.error);
  }

  throw new Error(
    `Failed to fetch plain text for book #${bookId} across PGLAF mirrors${
      lastError ? `: ${lastError.message}` : ''
    }`
  );
}

/**
 * Strips Project Gutenberg boilerplate headers/footers and extracts clean narrative paragraphs.
 */
function stripBoilerplateAndSplitParagraphs(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  let body = rawText.replace(/\r\n/g, '\n');
  const startMatch = body.match(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\n/i);
  if (startMatch && typeof startMatch.index === 'number') {
    body = body.slice(startMatch.index + startMatch[0].length);
  }
  const endMatch = body.match(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i);
  if (endMatch && typeof endMatch.index === 'number') {
    body = body.slice(0, endMatch.index);
  }

  return body
    .split(/\n\s*\n+/)
    .map((p) =>
      p
        .replace(
          /^\s*(?:(?:CHAPTER|Chapter|BOOK|Book|ACT|Act|SCENE|Scene|CANTO|Canto|PART|Part|LETTER|Letter|STAVE|Stave)\s+(?:[IVXLCDM\d]+|[A-Za-z]+)\b(?::\s*[^\n.!?]{1,60})?\s*)/i,
          ''
        )
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((p) => {
      if (p.length < 75 || p.length > 750) return false;
      if (/^(?:chapter|book|canto|act|scene|part|volume|contents|illustration)\b/i.test(p)) {
        return false;
      }
      if (
        /\b(?:distributed proofreading|transcriber(?:'s)? note|pgdp\.net|produced by|project gutenberg|all rights reserved|copyright)\b/i.test(
          p
        )
      ) {
        return false;
      }
      if (/[-_=*~]{4,}/.test(p)) return false;
      const letters = p.match(/[\p{L}]/gu) || [];
      if (letters.length < 40) return false;
      const nonSpace = p.replace(/\s+/g, '');
      return nonSpace.length > 0 && letters.length / nonSpace.length >= 0.65;
    });
}

function wrapCleanQuote(text, maxLen = 260) {
  const cleaned = String(text || '')
    .replace(/^[“"'\s*\-_~=\.#\/\\|:;+]+|[”"'\s*\-_~=\.#\/\\|:;+]+$/g, '')
    .trim();
  if (!cleaned) return '';
  const body =
    cleaned.length > maxLen - 2 ? `${cleaned.slice(0, maxLen - 3).trim()}…` : cleaned;
  return `“${body}”`;
}

/**
 * Extracts 10–16 distinct multi-quote spreads (`BookPassage[]`) from raw book text.
 */
function extractBookQuoteSpreads(rawText, book, targetCount = 14) {
  const desiredCount = Math.min(16, Math.max(10, targetCount));
  const paragraphs = stripBoilerplateAndSplitParagraphs(rawText);
  if (paragraphs.length < 4) return [];

  const spreads = [];
  const usedOpeningSet = new Set();
  const maxSpreads = Math.min(desiredCount, Math.max(1, Math.floor(paragraphs.length / 4)));

  for (let i = 0; i < maxSpreads; i++) {
    const startIdx = Math.floor((i * Math.max(0, paragraphs.length - 4)) / Math.max(1, maxSpreads - 1));
    const windowParas = paragraphs.slice(startIdx, startIdx + 8);
    const distinctWindow = windowParas.filter(
      (p) => !usedOpeningSet.has(p.slice(0, 60).toLowerCase())
    );
    const pool = distinctWindow.length >= 4 ? distinctWindow : windowParas;
    if (pool.length < 2) continue;

    usedOpeningSet.add(pool[0].slice(0, 60).toLowerCase());
    const romanLabels = [
      'I',
      'II',
      'III',
      'IV',
      'V',
      'VI',
      'VII',
      'VIII',
      'IX',
      'X',
      'XI',
      'XII',
      'XIII',
      'XIV',
      'XV',
      'XVI',
    ];
    const numeral = romanLabels[i] || String(i + 1);

    spreads.push({
      chapterLabel: `Passage ${numeral} • ${book.title}`,
      openingLine: wrapCleanQuote(pool[0], 280),
      secondaryQuote: pool[1] ? wrapCleanQuote(pool[1], 210) : undefined,
      leftPageQuote2: pool[2] ? wrapCleanQuote(pool[2], 190) : undefined,
      quoteExcerpt: wrapCleanQuote(pool[3] || pool[1] || pool[0], 260),
      rightPageQuote2: pool[4] ? wrapCleanQuote(pool[4], 200) : undefined,
      tertiaryQuote: pool[5] ? wrapCleanQuote(pool[5], 160) : undefined,
      commentary: `Extracted from the unabridged Project Gutenberg edition (Vol. #${book.id}).`,
    });
  }

  return spreads;
}

/**
 * Upsert-only merge: preserves existing valid spreads and appends newly discovered spreads up to `maxCount`.
 */
function mergeDistinctQuoteSpreads(existingQuotes, newSpreads, maxCount = 16) {
  const existingValid = Array.isArray(existingQuotes)
    ? existingQuotes.filter(
        (q) =>
          q &&
          typeof q === 'object' &&
          typeof q.openingLine === 'string' &&
          typeof q.quoteExcerpt === 'string'
      )
    : [];

  const seenKeys = new Set(
    existingValid.map((q) =>
      `${q.openingLine.slice(0, 50).toLowerCase()}|${q.quoteExcerpt.slice(0, 50).toLowerCase()}`
    )
  );

  const merged = [...existingValid];
  for (const spread of newSpreads || []) {
    if (merged.length >= maxCount) break;
    const key = `${String(spread.openingLine || '')
      .slice(0, 50)
      .toLowerCase()}|${String(spread.quoteExcerpt || '')
      .slice(0, 50)
      .toLowerCase()}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      merged.push(spread);
    }
  }

  return merged.slice(0, maxCount);
}

/**
 * Generates an idempotent SQL seed statement for updating `public.books.quotes`.
 */
function buildSqlQuoteSeedStatement(bookId, quotesArray) {
  const safeId = Number(bookId);
  const jsonLiteral = JSON.stringify(quotesArray || []).replace(/'/g, "''");
  return `UPDATE public.books SET quotes = '${jsonLiteral}'::jsonb, updated_at = NOW() WHERE id = ${safeId};`;
}

/**
 * Executes the sequential featured quotes sync pipeline.
 */
async function runFeaturedQuotesSync(customOptions = {}, deps = {}) {
  const env = deps.env || loadEnv();
  const options = { ...parseCliArgs([]), ...customOptions };
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const fetchFn = deps.fetchFn || globalThis.fetch;
  const sleepFn =
    deps.sleepFn || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const logger = deps.logger || console;

  const supabase =
    deps.supabaseClient ||
    (!options.dryRun && supabaseUrl && supabaseServiceKey
      ? createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false },
        })
      : null);

  if (!options.dryRun && !supabase) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Use --dry-run or configure credentials.'
    );
  }

  const candidateBooks = options.ids
    ? CURATED_QUOTE_BOOKS.filter((b) => options.ids.includes(b.id))
    : CURATED_QUOTE_BOOKS;
  const booksToProcess = candidateBooks.slice(0, options.limit);

  const summary = {
    processed: 0,
    updated: 0,
    skippedExisting: 0,
    fromSupabaseContent: 0,
    fromMirrors: 0,
    failed: 0,
    mirrorBreakdown: {},
    sqlStatements: [],
  };

  async function persistExtractedBookQuotes(book, existingRow, existingQuotes, rawText) {
    const extracted = extractBookQuoteSpreads(rawText, book, options.targetCount);
    const mergedQuotes = mergeDistinctQuoteSpreads(existingQuotes, extracted, 16);

    if (mergedQuotes.length === 0) {
      summary.failed++;
      return false;
    }

    summary.sqlStatements.push(buildSqlQuoteSeedStatement(book.id, mergedQuotes));

    if (!options.dryRun && supabase) {
      if (existingRow) {
        const { error: updateErr } = await supabase
          .from('books')
          .update({
            quotes: mergedQuotes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', book.id);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        const deathYears = book.authors
          .map((a) => a.death_year)
          .filter((y) => typeof y === 'number');
        const birthYears = book.authors
          .map((a) => a.birth_year)
          .filter((y) => typeof y === 'number');
        const { error: insertErr } = await supabase.from('books').insert({
          id: book.id,
          title: book.title,
          authors: book.authors,
          translators: book.translators || [],
          subjects: book.subjects || [],
          bookshelves: [],
          languages: book.languages || ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 50000,
          max_author_death_year: deathYears.length > 0 ? Math.max(...deathYears) : null,
          min_author_birth_year: birthYears.length > 0 ? Math.min(...birthYears) : null,
          quotes: mergedQuotes,
          updated_at: new Date().toISOString(),
        });
        if (insertErr) throw new Error(insertErr.message);
      }
    }

    summary.updated++;
    return true;
  }

  const mirrorWorkQueue = [];

  for (const book of booksToProcess) {
    summary.processed++;
    try {
      let existingRow = null;
      if (supabase) {
        const { data } = await supabase
          .from('books')
          .select('id, quotes, content')
          .eq('id', book.id)
          .maybeSingle();
        existingRow = data || null;
      }

      const existingQuotes = Array.isArray(existingRow?.quotes) ? existingRow.quotes : [];
      if (existingQuotes.length >= 10 && !options.force) {
        summary.skippedExisting++;
        logger.log(
          `[Skip] #${book.id} "${book.title}" already has ${existingQuotes.length} quotes.`
        );
        continue;
      }

      if (existingRow?.content && existingRow.content.trim().length >= 500) {
        summary.fromSupabaseContent++;
        logger.log(`[Supabase Content] Using stored text for #${book.id} "${book.title}".`);
        await persistExtractedBookQuotes(book, existingRow, existingQuotes, existingRow.content);
      } else {
        mirrorWorkQueue.push({
          book,
          existingRow,
          existingQuotes,
          attemptedMirrors: new Set(),
        });
      }
    } catch (err) {
      summary.failed++;
      logger.error(`[Error] #${book.id} "${book.title}": ${err.message}`);
    }
  }

  if (mirrorWorkQueue.length > 0) {
    const mirrors = deps.mirrors || GUTENBERG_MIRRORS;
    const activeMirrors = new Set(mirrors);
    let inFlightCount = 0;
    const queueWaiters = [];
    const notifyQueueChange = () => {
      while (queueWaiters.length > 0) {
        const wake = queueWaiters.shift();
        wake();
      }
    };

    const runMirrorWorker = async (mirrorBaseUrl) => {
      let workerDownloads = 0;
      let consecutiveMirrorErrors = 0;

      while (activeMirrors.has(mirrorBaseUrl)) {
        const candidateIdx = mirrorWorkQueue.findIndex(
          (item) => !item.attemptedMirrors.has(mirrorBaseUrl)
        );
        if (candidateIdx === -1) {
          if (inFlightCount === 0) {
            break;
          }
          await new Promise((resolve) => queueWaiters.push(resolve));
          continue;
        }

        const [workItem] = mirrorWorkQueue.splice(candidateIdx, 1);
        workItem.attemptedMirrors.add(mirrorBaseUrl);
        inFlightCount++;

        if (workerDownloads > 0) {
          const delayMs = computeRandomDelayMs(
            options.minDelaySec,
            options.maxDelaySec,
            deps.rng
          );
          logger.log(
            `[Mirror Worker ${mirrorBaseUrl}] Sleeping ${(delayMs / 1000).toFixed(
              2
            )}s before fetching #${workItem.book.id}...`
          );
          await sleepFn(delayMs);
        }

        workerDownloads++;
        const fetchRes = await fetchBookTextFromSingleMirror(
          workItem.book.id,
          mirrorBaseUrl,
          fetchFn
        );

        if (fetchRes.ok) {
          consecutiveMirrorErrors = 0;
          summary.fromMirrors++;
          summary.mirrorBreakdown[mirrorBaseUrl] =
            (summary.mirrorBreakdown[mirrorBaseUrl] || 0) + 1;
          logger.log(
            `[Mirror Worker ${mirrorBaseUrl}] Downloaded #${workItem.book.id} "${workItem.book.title}" from ${fetchRes.mirrorUrl}.`
          );
          try {
            await persistExtractedBookQuotes(
              workItem.book,
              workItem.existingRow,
              workItem.existingQuotes,
              fetchRes.text
            );
          } catch (err) {
            summary.failed++;
            logger.error(
              `[Error] #${workItem.book.id} "${workItem.book.title}": ${err.message}`
            );
          }
          inFlightCount--;
          notifyQueueChange();
        } else {
          if (fetchRes.isMirrorLevelError) {
            consecutiveMirrorErrors++;
            logger.error(
              `[Mirror Worker ${mirrorBaseUrl}] Mirror error on #${workItem.book.id}: ${fetchRes.error}`
            );
            if (consecutiveMirrorErrors >= 2) {
              activeMirrors.delete(mirrorBaseUrl);
              logger.error(
                `[Mirror Worker ${mirrorBaseUrl}] Halting worker after ${consecutiveMirrorErrors} consecutive mirror errors.`
              );
            }
          }

          const remainingHealthyMirrors = Array.from(activeMirrors).filter(
            (m) => !workItem.attemptedMirrors.has(m)
          );
          if (remainingHealthyMirrors.length > 0) {
            mirrorWorkQueue.push(workItem);
          } else {
            summary.failed++;
            logger.error(
              `[Error] #${workItem.book.id} "${workItem.book.title}": Exhausted all healthy PGLAF mirrors.`
            );
          }

          inFlightCount--;
          notifyQueueChange();

          if (fetchRes.isMirrorLevelError && activeMirrors.has(mirrorBaseUrl)) {
            await sleepFn(options.mirrorCooldownMs);
          }
        }
      }
    };

    await Promise.all(mirrors.map((mirrorUrl) => runMirrorWorker(mirrorUrl)));
  }

  if (options.dryRun && summary.sqlStatements.length > 0 && deps.writeSeedFile !== false) {
    const seedPath = path.resolve(__dirname, '..', 'supabase', 'seed_quotes.sql');
    const header = [
      '-- Bookarium Idempotent Featured Quotes Seed (Generated by scripts/sync-featured-quotes.js --dry-run)',
      'ALTER TABLE public.books ADD COLUMN IF NOT EXISTS quotes JSONB NOT NULL DEFAULT \'[]\'::jsonb;',
      '',
      ...summary.sqlStatements,
      '',
    ].join('\n');
    fs.writeFileSync(seedPath, header, 'utf8');
  }

  return summary;
}

/* v8 ignore start */
if (require.main === module) {
  const cliOptions = parseCliArgs(process.argv.slice(2));
  runFeaturedQuotesSync(cliOptions)
    .then((res) => {
      console.log(
        `Featured Quotes Sync complete: ${res.updated} updated, ${res.skippedExisting} skipped, ${res.failed} failed.`
      );
      process.exit(res.failed > 0 && res.updated === 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error(`Fatal error in sync-featured-quotes: ${err.message}`);
      process.exit(1);
    });
}
/* v8 ignore stop */

module.exports = {
  USER_AGENT,
  GUTENBERG_MIRRORS,
  CURATED_QUOTE_BOOKS,
  loadEnv,
  parseCliArgs,
  computeRandomDelayMs,
  buildGutenbergPathDir,
  buildSingleMirrorCandidateUrls,
  buildMirrorCandidateUrls,
  fetchBookTextFromSingleMirror,
  fetchBookTextFromMirrors,
  stripBoilerplateAndSplitParagraphs,
  wrapCleanQuote,
  extractBookQuoteSpreads,
  mergeDistinctQuoteSpreads,
  buildSqlQuoteSeedStatement,
  runFeaturedQuotesSync,
};


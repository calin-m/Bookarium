#!/usr/bin/env node
/**
 * Bookarium — Self-Hosted Gutenberg Catalog Ingestion & Seeding Engine
 * 
 * Usage:
 *   node scripts/ingest-catalog.js --dry-run              # Generate supabase/seed_books.sql
 *   node scripts/ingest-catalog.js --curated              # Ingest/generate top curated classics
 *   node scripts/ingest-catalog.js --pages=5              # Fetch top 5 pages from Gutenberg feed
 *   node scripts/ingest-catalog.js --help                 # View help
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const rootDir = path.resolve(__dirname, '..');
const seedSqlPath = path.join(rootDir, 'supabase', 'seed_books.sql');

// Parse CLI arguments
const args = process.argv.slice(2);
const isHelp = args.includes('--help') || args.includes('-h');
const isDryRun = args.includes('--dry-run');
const isCuratedOnly = args.includes('--curated');
const pagesArg = args.find((a) => a.startsWith('--pages='));
const pagesToFetch = pagesArg ? Math.max(1, parseInt(pagesArg.split('=')[1], 10) || 1) : 3;

if (isHelp) {
  console.log(`
Bookarium Catalog Ingestion Engine
===================================
Options:
  --dry-run      Do not connect to remote Supabase; write SQL to supabase/seed_books.sql
  --curated      Ingest curated hero classic masterpieces (Frankenstein, Austen, etc.)
  --pages=N      Fetch N pages (32 books/page) of top public domain titles (default: 3)
  --help         Show this help guide
`);
  process.exit(0);
}

// 1. Curated Classic Masterpieces Starter Dataset
const CURATED_CLASSICS = [
  {
    id: 1342,
    title: 'Pride and Prejudice',
    authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
    translators: [],
    subjects: ['Courtship -- Fiction', 'Domestic fiction', 'England -- Fiction', 'Love stories', 'Sisters -- Fiction', 'Social classes -- Fiction', 'Young women -- Fiction'],
    bookshelves: ['Best Books Ever', 'Harvard Classics'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    download_count: 55420,
    max_author_death_year: 1817,
    min_author_birth_year: 1775,
  },
  {
    id: 84,
    title: 'Frankenstein; Or, The Modern Prometheus',
    authors: [{ name: 'Shelley, Mary Wollstonecraft', birth_year: 1797, death_year: 1851 }],
    translators: [],
    subjects: ['Frankenstein (Fictitious character) -- Fiction', 'Frankenstein\'s monster (Fictitious character) -- Fiction', 'Gothic fiction', 'Horror tales', 'Monsters -- Fiction', 'Science fiction', 'Scientists -- Fiction'],
    bookshelves: ['Gothic Fiction', 'Precursors of Science Fiction'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    download_count: 85210,
    max_author_death_year: 1851,
    min_author_birth_year: 1797,
  },
  {
    id: 2701,
    title: 'Moby Dick; Or, The Whale',
    authors: [{ name: 'Melville, Herman', birth_year: 1819, death_year: 1891 }],
    translators: [],
    subjects: ['Adventure stories', 'Ahab, Captain (Fictitious character) -- Fiction', 'Mentally ill -- Fiction', 'Sea stories', 'Whales -- Fiction', 'Whaling -- Fiction', 'Whaling ships -- Fiction'],
    bookshelves: ['Best Books Ever'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    download_count: 42150,
    max_author_death_year: 1891,
    min_author_birth_year: 1819,
  },
  {
    id: 64317,
    title: 'The Great Gatsby',
    authors: [{ name: 'Fitzgerald, F. Scott (Francis Scott)', birth_year: 1896, death_year: 1940 }],
    translators: [],
    subjects: ['First person narrative', 'Long Island (N.Y.) -- Fiction', 'Married women -- Fiction', 'Psychological fiction', 'Rich people -- Fiction'],
    bookshelves: ['Best Books Ever'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    download_count: 41200,
    max_author_death_year: 1940,
    min_author_birth_year: 1896,
  },
  {
    id: 11,
    title: 'Alice\'s Adventures in Wonderland',
    authors: [{ name: 'Carroll, Lewis', birth_year: 1832, death_year: 1898 }],
    translators: [],
    subjects: ['Alice (Fictitious character from Carroll) -- Juvenile fiction', 'Children\'s stories', 'Fantasy fiction', 'Imaginary places -- Juvenile fiction'],
    bookshelves: ['Children\'s Literature'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    download_count: 31200,
    max_author_death_year: 1898,
    min_author_birth_year: 1832,
  },
  {
    id: 1661,
    title: 'The Adventures of Sherlock Holmes',
    authors: [{ name: 'Doyle, Arthur Conan', birth_year: 1859, death_year: 1930 }],
    translators: [],
    subjects: ['Detective and mystery stories, English', 'Holmes, Sherlock (Fictitious character) -- Fiction', 'Private investigators -- England -- Fiction'],
    bookshelves: ['Detective Fiction'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    download_count: 36400,
    max_author_death_year: 1930,
    min_author_birth_year: 1859,
  },
  {
    id: 345,
    title: 'Dracula',
    authors: [{ name: 'Stoker, Bram', birth_year: 1847, death_year: 1912 }],
    translators: [],
    subjects: ['Dracula, Count (Fictitious character) -- Fiction', 'Epistolary fiction', 'Gothic fiction', 'Horror tales', 'Transylvania (Romania) -- Fiction', 'Vampires -- Fiction'],
    bookshelves: ['Gothic Fiction', 'Horror'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    download_count: 29800,
    max_author_death_year: 1912,
    min_author_birth_year: 1847,
  },
  {
    id: 2600,
    title: 'War and Peace',
    authors: [{ name: 'Tolstoy, Leo, graf', birth_year: 1828, death_year: 1910 }],
    translators: [{ name: 'Maude, Aylmer', birth_year: 1858, death_year: 1938 }, { name: 'Maude, Louise', birth_year: 1855, death_year: 1939 }],
    subjects: ['Aristocracy (Social class) -- Russia -- Fiction', 'Historical fiction', 'Napoleonic Wars, 1800-1815 -- Campaigns -- Russia -- Fiction', 'Russia -- History -- Alexander I, 1801-1825 -- Fiction', 'War stories'],
    bookshelves: ['Historical Fiction'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    download_count: 22400,
    max_author_death_year: 1939,
    min_author_birth_year: 1828,
  },
  {
    id: 2554,
    title: 'Crime and Punishment',
    authors: [{ name: 'Dostoyevsky, Fyodor', birth_year: 1821, death_year: 1881 }],
    translators: [{ name: 'Garnett, Constance', birth_year: 1861, death_year: 1946 }],
    subjects: ['Crime -- Psychological aspects -- Fiction', 'Detective and mystery stories', 'Murder -- Fiction', 'Poor -- Russia -- Saint Petersburg -- Fiction', 'Psychological fiction', 'Saint Petersburg (Russia) -- Fiction'],
    bookshelves: ['Crime Fiction'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    download_count: 26500,
    max_author_death_year: 1946,
    min_author_birth_year: 1821,
  },
  {
    id: 98,
    title: 'A Tale of Two Cities',
    authors: [{ name: 'Dickens, Charles', birth_year: 1812, death_year: 1870 }],
    translators: [],
    subjects: ['Executions and executioners -- Fiction', 'France -- History -- Revolution, 1789-1799 -- Fiction', 'French -- England -- London -- Fiction', 'Historical fiction', 'London (England) -- History -- 18th century -- Fiction', 'Look-alikes -- Fiction', 'Paris (France) -- History -- 1789-1799 -- Fiction'],
    bookshelves: ['Historical Fiction'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    download_count: 21900,
    max_author_death_year: 1870,
    min_author_birth_year: 1812,
  },
];

// Helper: build standard Gutenberg formats map
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

// Helper: compute lifespan bounds from authors and translators
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

// Helper: fetch JSON from URL
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'Bookarium-Catalog-Seeder/1.0',
            Accept: 'application/json',
          },
        },
        (res) => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
          let rawData = '';
          res.on('data', (chunk) => (rawData += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(rawData));
            } catch (err) {
              reject(err);
            }
          });
        }
      )
      .on('error', reject);
  });
}

// Helper to build safe jsonb_build_object expressions for formats
function formatFormatsJson(formats) {
  const entries = Object.entries(formats);
  if (entries.length === 0) return "'{}'::jsonb";
  const pairs = entries.map(([k, v]) => `      '${k}', '${v}'`).join(',\n');
  return `jsonb_build_object(\n${pairs}\n    )`;
}

// Generate SQL statement for books
function generateSql(books) {
  const lines = [
    '--',
    '-- Bookarium — Idempotent Gutenberg Book Catalog Seed',
    `-- Generated: ${new Date().toISOString()}`,
    `-- Total Volumes: ${books.length}`,
    '--',
    '',
    'INSERT INTO public.books (',
    '  id, title, authors, translators, subjects, bookshelves, languages,',
    '  copyright, media_type, formats, download_count, max_author_death_year, min_author_birth_year',
    ') VALUES',
  ];

  const values = books.map((b) => {
    const formats = b.formats || buildStandardFormats(b.id);
    const escapedTitle = b.title.replace(/'/g, "''");
    const authorsJson = JSON.stringify(b.authors || []).replace(/'/g, "''");
    const translatorsJson = JSON.stringify(b.translators || []).replace(/'/g, "''");
    const formatsSql = formatFormatsJson(formats);
    
    // Format text[] literals
    const subjectsArray = `ARRAY[${(b.subjects || []).map((s) => `'${s.replace(/'/g, "''")}'`).join(', ')}]::text[]`;
    const bookshelvesArray = `ARRAY[${(b.bookshelves || []).map((s) => `'${s.replace(/'/g, "''")}'`).join(', ')}]::text[]`;
    const languagesArray = `ARRAY[${(b.languages || ['en']).map((l) => `'${l.replace(/'/g, "''")}'`).join(', ')}]::text[]`;

    const maxDeath = b.max_author_death_year !== null && b.max_author_death_year !== undefined ? b.max_author_death_year : 'NULL';
    const minBirth = b.min_author_birth_year !== null && b.min_author_birth_year !== undefined ? b.min_author_birth_year : 'NULL';

    return `  -- Volume #${b.id}: ${escapedTitle}
  (
    ${b.id},
    '${escapedTitle}',
    '${authorsJson}'::jsonb,
    '${translatorsJson}'::jsonb,
    ${subjectsArray},
    ${bookshelvesArray},
    ${languagesArray},
    ${Boolean(b.copyright)},
    '${b.media_type || 'Text'}',
    ${formatsSql},
    ${b.download_count || 0},
    ${maxDeath},
    ${minBirth}
  )`;
  });

  lines.push(values.join(',\n\n'));
  lines.push('ON CONFLICT (id) DO UPDATE SET');
  lines.push('  title = EXCLUDED.title,');
  lines.push('  authors = EXCLUDED.authors,');
  lines.push('  translators = EXCLUDED.translators,');
  lines.push('  subjects = EXCLUDED.subjects,');
  lines.push('  bookshelves = EXCLUDED.bookshelves,');
  lines.push('  languages = EXCLUDED.languages,');
  lines.push('  copyright = EXCLUDED.copyright,');
  lines.push('  media_type = EXCLUDED.media_type,');
  lines.push('  formats = EXCLUDED.formats,');
  lines.push('  download_count = EXCLUDED.download_count,');
  lines.push('  max_author_death_year = EXCLUDED.max_author_death_year,');
  lines.push('  min_author_birth_year = EXCLUDED.min_author_birth_year,');
  lines.push('  updated_at = NOW();');
  lines.push('');

  return lines.join('\n');
}

async function main() {
  console.log('📚 Bookarium Catalog Ingestion Engine');
  console.log('====================================');

  let books = [];

  if (isCuratedOnly) {
    console.log(`📦 Preparing ${CURATED_CLASSICS.length} curated masterworks...`);
    books = CURATED_CLASSICS.map((b) => ({
      ...b,
      formats: buildStandardFormats(b.id),
    }));
  } else {
    console.log(`🌐 Fetching ${pagesToFetch} pages of popular public domain titles from Gutendex...`);
    const seenIds = new Set();

    // Start with curated classics to ensure iconic titles are always included
    for (const c of CURATED_CLASSICS) {
      books.push({ ...c, formats: buildStandardFormats(c.id) });
      seenIds.add(c.id);
    }

    for (let page = 1; page <= pagesToFetch; page++) {
      try {
        console.log(`  ↳ Fetching page ${page}/${pagesToFetch}...`);
        const url = `https://gutendex.com/books/?page=${page}&copyright=false`;
        const data = await fetchJson(url);

        if (Array.isArray(data.results)) {
          for (const item of data.results) {
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id);
              const { maxDeath, minBirth } = computeLifespanBounds(item.authors, item.translators);
              books.push({
                id: item.id,
                title: item.title,
                authors: item.authors || [],
                translators: item.translators || [],
                subjects: item.subjects || [],
                bookshelves: item.bookshelves || [],
                languages: item.languages || ['en'],
                copyright: false,
                media_type: item.media_type || 'Text',
                formats: item.formats || buildStandardFormats(item.id),
                download_count: item.download_count || 0,
                max_author_death_year: maxDeath,
                min_author_birth_year: minBirth,
              });
            }
          }
        }
      } catch (err) {
        console.warn(`  ⚠ Warning: Failed to fetch page ${page}: ${err.message}. Continuing with accumulated titles.`);
        break;
      }
    }
  }

  console.log(`✔ Successfully compiled metadata for ${books.length} volumes.`);

  // Generate SQL file
  const sql = generateSql(books);
  fs.writeFileSync(seedSqlPath, sql, 'utf-8');
  console.log(`💾 Idempotent seed SQL written to: ${path.relative(rootDir, seedSqlPath)} (${(Buffer.byteLength(sql) / 1024).toFixed(1)} KB)`);

  console.log('\n✨ Ingestion complete!');
  console.log('Next Steps:');
  console.log('1. Open your Supabase Dashboard -> SQL Editor.');
  console.log(`2. Paste and run supabase/seed_books.sql to populate public.books in your project.`);
}

main().catch((err) => {
  console.error('✖ Ingestion failed:', err);
  process.exit(1);
});


#!/usr/bin/env node
/**
 * Bookarium — Curated Gutenberg Starter Seed Generator
 *
 * @module scripts/ingest-catalog
 * @scope Offline SQL starter seed generator compiling idempotent `supabase/seed_books.sql` from `CURATED_CLASSICS` (with `--with-content` live Gutenberg mirror scraping retired under ADR-084).
 * @invariant Retire legacy `--pages=N` Gutendex pagination and `--with-content` Project Gutenberg HTTP text scraping safely while emitting idempotent PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` seed scripts without requiring network credentials for `--dry-run`.
 * @invariant Construct dynamic User-Agent headers via `resolveIngestUserAgent` honoring `NEXT_PUBLIC_GITHUB_REPO`, `BOOKARIUM_REPO_URL`, `GITHUB_REPOSITORY`, or site origin fallbacks alongside optional `GUTENBERG_CONTACT_EMAIL`, and emit lean metadata-only `INSERT ... ON CONFLICT DO UPDATE` SQL omitting retired `formats`, `content`, and `media_type` columns.
 * @rationale Gives local developers and fresh Supabase installs clean curated catalog metadata SQL seeds aligned with `public.books` lifespan bounds while keeping online text storage strictly on Cloudflare R2 (`npm run r2:sync`).
 * @adr ADR-038, ADR-080, ADR-084, ADR-087
 *
 * Usage:
 *   node scripts/ingest-catalog.js --dry-run              # Generate supabase/seed_books.sql
 *   node scripts/ingest-catalog.js --curated              # Ingest/generate curated hero classics
 *   node scripts/ingest-catalog.js --help                 # View help
 *
 * Note: For full 78,000+ catalog ingestion, run `npm run catalog:sync` (pg_catalog.csv.gz + rdf-files.tar.bz2).
 * Note: For unabridged book texts & covers, sync Cloudflare R2 assets via `npm run r2:sync`.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const pkgVersion = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')).version || '2.0';
  } catch {
    return '2.0';
  }
})();
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

function resolveRepositoryOrSiteUrl() {
  if (process.env.NEXT_PUBLIC_GITHUB_REPO) {
    return process.env.NEXT_PUBLIC_GITHUB_REPO.trim();
  }
  if (process.env.BOOKARIUM_REPO_URL) {
    return process.env.BOOKARIUM_REPO_URL.trim();
  }
  if (process.env.GITHUB_REPOSITORY) {
    return `https://github.com/${process.env.GITHUB_REPOSITORY.trim().replace(/^\/+|\/+$/g, '')}`;
  }
  if (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG) {
    return `https://github.com/${process.env.VERCEL_GIT_REPO_OWNER.trim()}/${process.env.VERCEL_GIT_REPO_SLUG.trim()}`;
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
  return resolveSiteOriginFallback(process.env);
}

function resolveIngestUserAgent(version) {
  const originUrl = resolveRepositoryOrSiteUrl();
  const email = (process.env.GUTENBERG_CONTACT_EMAIL || '').trim();
  const contactPart = email ? `+${originUrl}; ${email}` : `+${originUrl}`;
  return `Bookarium/${version} (${contactPart})`;
}

const _INGEST_USER_AGENT = resolveIngestUserAgent(pkgVersion);
const seedSqlPath = path.join(rootDir, 'supabase', 'seed_books.sql');

// Parse CLI arguments
const args = process.argv.slice(2);
const isHelp = args.includes('--help') || args.includes('-h');
const _isDryRun = args.includes('--dry-run');
const isWithContent = args.includes('--with-content');
const hasPagesFlag = args.some((a) => a.startsWith('--pages='));

if (isHelp && require.main === module) {
  console.log(`
Bookarium Curated Starter Seed Generator
========================================
Generates idempotent metadata SQL seed files from Bookarium's curated masterworks dataset.
For full 78,000+ catalog synchronization, run: npm run catalog:sync
For unabridged book texts & covers, upload to Cloudflare R2 via: npm run r2:sync

Options:
  --dry-run        Do not connect to remote Supabase; write SQL to supabase/seed_books.sql
  --curated        Generate curated hero classic metadata (default)
  --help           Show this help guide
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
    download_count: 21900,
    max_author_death_year: 1870,
    min_author_birth_year: 1812,
  },
];

// Helper: compute lifespan bounds from authors and translators
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

// Generate SQL statement for books
function generateSql(books) {
  const columns = [
    '  id, title, authors, translators, subjects, bookshelves, languages,',
    '  copyright, download_count, max_author_death_year, min_author_birth_year',
  ];

  const lines = [
    '--',
    '-- Bookarium — Idempotent Gutenberg Book Catalog Seed',
    `-- Generated: ${new Date().toISOString()}`,
    `-- Total Volumes: ${books.length}`,
    '--',
    '',
    'INSERT INTO public.books (',
    ...columns,
    ') VALUES',
  ];

  const values = books.map((b) => {
    const escapedTitle = b.title.replace(/'/g, "''");
    const authorsJson = JSON.stringify(b.authors || []).replace(/'/g, "''");
    const translatorsJson = JSON.stringify(b.translators || []).replace(/'/g, "''");

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

  if (hasPagesFlag) {
    console.log(
      'ℹ Note: --pages=N (Gutendex REST pagination) has been retired; seeding CURATED_CLASSICS instead. Run `npm run catalog:sync` for the full 78k+ Project Gutenberg catalog.'
    );
  }

  console.log(`📦 Preparing ${CURATED_CLASSICS.length} curated masterworks...`);
  const books = CURATED_CLASSICS.map((b) => ({ ...b }));

  console.log(`✔ Successfully compiled metadata for ${books.length} volumes.`);

  if (isWithContent) {
    console.log(
      'ℹ Note: --with-content (live Project Gutenberg mirror scraping into SQL) has been deprecated (ADR-084). Store book texts in Cloudflare R2 via `npm run r2:sync`; generating metadata-only supabase/seed_books.sql instead.'
    );
  }

  // Generate SQL file
  const sql = generateSql(books);
  fs.writeFileSync(seedSqlPath, sql, 'utf-8');
  console.log(`\n💾 Idempotent seed SQL written to: ${path.relative(rootDir, seedSqlPath)} (${(Buffer.byteLength(sql) / 1024).toFixed(1)} KB)`);

  console.log('\n✨ Ingestion complete!');
  console.log('Next Steps:');
  console.log('1. Open your Supabase Dashboard -> SQL Editor.');
  console.log('2. Paste and run supabase/seed_books.sql to populate public.books in your project.');
  console.log('3. Populate book texts & covers in private Cloudflare R2 via `npm run r2:sync`.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('✖ Ingestion failed:', err);
    process.exit(1);
  });
}

module.exports = {
  resolveSiteOriginFallback,
  resolveRepositoryOrSiteUrl,
  resolveIngestUserAgent,
  CURATED_CLASSICS,
  computeLifespanBounds,
  generateSql,
};


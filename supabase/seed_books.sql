--
-- Bookarium — Idempotent Gutenberg Book Catalog Seed
-- Generated: 2026-09-11T12:46:39.460Z
-- Total Volumes: 10
--

INSERT INTO public.books (
  id, title, authors, translators, subjects, bookshelves, languages,
  copyright, media_type, formats, download_count, max_author_death_year, min_author_birth_year
) VALUES
  -- Volume #1342: Pride and Prejudice
  (
    1342,
    'Pride and Prejudice',
    '[{"name":"Austen, Jane","birth_year":1775,"death_year":1817}]'::jsonb,
    '[]'::jsonb,
    ARRAY['Courtship -- Fiction', 'Domestic fiction', 'England -- Fiction', 'Love stories', 'Sisters -- Fiction', 'Social classes -- Fiction', 'Young women -- Fiction']::text[],
    ARRAY['Best Books Ever', 'Harvard Classics']::text[],
    ARRAY['en']::text[],
    false,
    'Text',
    jsonb_build_object(
      'text/html', 'https://www.gutenberg.org/ebooks/1342.html.images',
      'application/epub+zip', 'https://www.gutenberg.org/ebooks/1342.epub3.images',
      'application/x-mobipocket-ebook', 'https://www.gutenberg.org/ebooks/1342.kf8.images',
      'text/plain; charset=utf-8', 'https://www.gutenberg.org/ebooks/1342.txt.utf-8',
      'image/jpeg', 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg',
      'application/rdf+xml', 'https://www.gutenberg.org/ebooks/1342.rdf'
    ),
    55420,
    1817,
    1775
  ),

  -- Volume #84: Frankenstein; Or, The Modern Prometheus
  (
    84,
    'Frankenstein; Or, The Modern Prometheus',
    '[{"name":"Shelley, Mary Wollstonecraft","birth_year":1797,"death_year":1851}]'::jsonb,
    '[]'::jsonb,
    ARRAY['Frankenstein (Fictitious character) -- Fiction', 'Frankenstein''s monster (Fictitious character) -- Fiction', 'Gothic fiction', 'Horror tales', 'Monsters -- Fiction', 'Science fiction', 'Scientists -- Fiction']::text[],
    ARRAY['Gothic Fiction', 'Precursors of Science Fiction']::text[],
    ARRAY['en']::text[],
    false,
    'Text',
    jsonb_build_object(
      'text/html', 'https://www.gutenberg.org/ebooks/84.html.images',
      'application/epub+zip', 'https://www.gutenberg.org/ebooks/84.epub3.images',
      'application/x-mobipocket-ebook', 'https://www.gutenberg.org/ebooks/84.kf8.images',
      'text/plain; charset=utf-8', 'https://www.gutenberg.org/ebooks/84.txt.utf-8',
      'image/jpeg', 'https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg',
      'application/rdf+xml', 'https://www.gutenberg.org/ebooks/84.rdf'
    ),
    85210,
    1851,
    1797
  ),

  -- Volume #2701: Moby Dick; Or, The Whale
  (
    2701,
    'Moby Dick; Or, The Whale',
    '[{"name":"Melville, Herman","birth_year":1819,"death_year":1891}]'::jsonb,
    '[]'::jsonb,
    ARRAY['Adventure stories', 'Ahab, Captain (Fictitious character) -- Fiction', 'Mentally ill -- Fiction', 'Sea stories', 'Whales -- Fiction', 'Whaling -- Fiction', 'Whaling ships -- Fiction']::text[],
    ARRAY['Best Books Ever']::text[],
    ARRAY['en']::text[],
    false,
    'Text',
    jsonb_build_object(
      'text/html', 'https://www.gutenberg.org/ebooks/2701.html.images',
      'application/epub+zip', 'https://www.gutenberg.org/ebooks/2701.epub3.images',
      'application/x-mobipocket-ebook', 'https://www.gutenberg.org/ebooks/2701.kf8.images',
      'text/plain; charset=utf-8', 'https://www.gutenberg.org/ebooks/2701.txt.utf-8',
      'image/jpeg', 'https://www.gutenberg.org/cache/epub/2701/pg2701.cover.medium.jpg',
      'application/rdf+xml', 'https://www.gutenberg.org/ebooks/2701.rdf'
    ),
    42150,
    1891,
    1819
  ),

  -- Volume #64317: The Great Gatsby
  (
    64317,
    'The Great Gatsby',
    '[{"name":"Fitzgerald, F. Scott (Francis Scott)","birth_year":1896,"death_year":1940}]'::jsonb,
    '[]'::jsonb,
    ARRAY['First person narrative', 'Long Island (N.Y.) -- Fiction', 'Married women -- Fiction', 'Psychological fiction', 'Rich people -- Fiction']::text[],
    ARRAY['Best Books Ever']::text[],
    ARRAY['en']::text[],
    false,
    'Text',
    jsonb_build_object(
      'text/html', 'https://www.gutenberg.org/ebooks/64317.html.images',
      'application/epub+zip', 'https://www.gutenberg.org/ebooks/64317.epub3.images',
      'application/x-mobipocket-ebook', 'https://www.gutenberg.org/ebooks/64317.kf8.images',
      'text/plain; charset=utf-8', 'https://www.gutenberg.org/ebooks/64317.txt.utf-8',
      'image/jpeg', 'https://www.gutenberg.org/cache/epub/64317/pg64317.cover.medium.jpg',
      'application/rdf+xml', 'https://www.gutenberg.org/ebooks/64317.rdf'
    ),
    41200,
    1940,
    1896
  ),

  -- Volume #11: Alice''s Adventures in Wonderland
  (
    11,
    'Alice''s Adventures in Wonderland',
    '[{"name":"Carroll, Lewis","birth_year":1832,"death_year":1898}]'::jsonb,
    '[]'::jsonb,
    ARRAY['Alice (Fictitious character from Carroll) -- Juvenile fiction', 'Children''s stories', 'Fantasy fiction', 'Imaginary places -- Juvenile fiction']::text[],
    ARRAY['Children''s Literature']::text[],
    ARRAY['en']::text[],
    false,
    'Text',
    jsonb_build_object(
      'text/html', 'https://www.gutenberg.org/ebooks/11.html.images',
      'application/epub+zip', 'https://www.gutenberg.org/ebooks/11.epub3.images',
      'application/x-mobipocket-ebook', 'https://www.gutenberg.org/ebooks/11.kf8.images',
      'text/plain; charset=utf-8', 'https://www.gutenberg.org/ebooks/11.txt.utf-8',
      'image/jpeg', 'https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg',
      'application/rdf+xml', 'https://www.gutenberg.org/ebooks/11.rdf'
    ),
    31200,
    1898,
    1832
  ),

  -- Volume #1661: The Adventures of Sherlock Holmes
  (
    1661,
    'The Adventures of Sherlock Holmes',
    '[{"name":"Doyle, Arthur Conan","birth_year":1859,"death_year":1930}]'::jsonb,
    '[]'::jsonb,
    ARRAY['Detective and mystery stories, English', 'Holmes, Sherlock (Fictitious character) -- Fiction', 'Private investigators -- England -- Fiction']::text[],
    ARRAY['Detective Fiction']::text[],
    ARRAY['en']::text[],
    false,
    'Text',
    jsonb_build_object(
      'text/html', 'https://www.gutenberg.org/ebooks/1661.html.images',
      'application/epub+zip', 'https://www.gutenberg.org/ebooks/1661.epub3.images',
      'application/x-mobipocket-ebook', 'https://www.gutenberg.org/ebooks/1661.kf8.images',
      'text/plain; charset=utf-8', 'https://www.gutenberg.org/ebooks/1661.txt.utf-8',
      'image/jpeg', 'https://www.gutenberg.org/cache/epub/1661/pg1661.cover.medium.jpg',
      'application/rdf+xml', 'https://www.gutenberg.org/ebooks/1661.rdf'
    ),
    36400,
    1930,
    1859
  ),

  -- Volume #345: Dracula
  (
    345,
    'Dracula',
    '[{"name":"Stoker, Bram","birth_year":1847,"death_year":1912}]'::jsonb,
    '[]'::jsonb,
    ARRAY['Dracula, Count (Fictitious character) -- Fiction', 'Epistolary fiction', 'Gothic fiction', 'Horror tales', 'Transylvania (Romania) -- Fiction', 'Vampires -- Fiction']::text[],
    ARRAY['Gothic Fiction', 'Horror']::text[],
    ARRAY['en']::text[],
    false,
    'Text',
    jsonb_build_object(
      'text/html', 'https://www.gutenberg.org/ebooks/345.html.images',
      'application/epub+zip', 'https://www.gutenberg.org/ebooks/345.epub3.images',
      'application/x-mobipocket-ebook', 'https://www.gutenberg.org/ebooks/345.kf8.images',
      'text/plain; charset=utf-8', 'https://www.gutenberg.org/ebooks/345.txt.utf-8',
      'image/jpeg', 'https://www.gutenberg.org/cache/epub/345/pg345.cover.medium.jpg',
      'application/rdf+xml', 'https://www.gutenberg.org/ebooks/345.rdf'
    ),
    29800,
    1912,
    1847
  ),

  -- Volume #2600: War and Peace
  (
    2600,
    'War and Peace',
    '[{"name":"Tolstoy, Leo, graf","birth_year":1828,"death_year":1910}]'::jsonb,
    '[{"name":"Maude, Aylmer","birth_year":1858,"death_year":1938},{"name":"Maude, Louise","birth_year":1855,"death_year":1939}]'::jsonb,
    ARRAY['Aristocracy (Social class) -- Russia -- Fiction', 'Historical fiction', 'Napoleonic Wars, 1800-1815 -- Campaigns -- Russia -- Fiction', 'Russia -- History -- Alexander I, 1801-1825 -- Fiction', 'War stories']::text[],
    ARRAY['Historical Fiction']::text[],
    ARRAY['en']::text[],
    false,
    'Text',
    jsonb_build_object(
      'text/html', 'https://www.gutenberg.org/ebooks/2600.html.images',
      'application/epub+zip', 'https://www.gutenberg.org/ebooks/2600.epub3.images',
      'application/x-mobipocket-ebook', 'https://www.gutenberg.org/ebooks/2600.kf8.images',
      'text/plain; charset=utf-8', 'https://www.gutenberg.org/ebooks/2600.txt.utf-8',
      'image/jpeg', 'https://www.gutenberg.org/cache/epub/2600/pg2600.cover.medium.jpg',
      'application/rdf+xml', 'https://www.gutenberg.org/ebooks/2600.rdf'
    ),
    22400,
    1939,
    1828
  ),

  -- Volume #2554: Crime and Punishment
  (
    2554,
    'Crime and Punishment',
    '[{"name":"Dostoyevsky, Fyodor","birth_year":1821,"death_year":1881}]'::jsonb,
    '[{"name":"Garnett, Constance","birth_year":1861,"death_year":1946}]'::jsonb,
    ARRAY['Crime -- Psychological aspects -- Fiction', 'Detective and mystery stories', 'Murder -- Fiction', 'Poor -- Russia -- Saint Petersburg -- Fiction', 'Psychological fiction', 'Saint Petersburg (Russia) -- Fiction']::text[],
    ARRAY['Crime Fiction']::text[],
    ARRAY['en']::text[],
    false,
    'Text',
    jsonb_build_object(
      'text/html', 'https://www.gutenberg.org/ebooks/2554.html.images',
      'application/epub+zip', 'https://www.gutenberg.org/ebooks/2554.epub3.images',
      'application/x-mobipocket-ebook', 'https://www.gutenberg.org/ebooks/2554.kf8.images',
      'text/plain; charset=utf-8', 'https://www.gutenberg.org/ebooks/2554.txt.utf-8',
      'image/jpeg', 'https://www.gutenberg.org/cache/epub/2554/pg2554.cover.medium.jpg',
      'application/rdf+xml', 'https://www.gutenberg.org/ebooks/2554.rdf'
    ),
    26500,
    1946,
    1821
  ),

  -- Volume #98: A Tale of Two Cities
  (
    98,
    'A Tale of Two Cities',
    '[{"name":"Dickens, Charles","birth_year":1812,"death_year":1870}]'::jsonb,
    '[]'::jsonb,
    ARRAY['Executions and executioners -- Fiction', 'France -- History -- Revolution, 1789-1799 -- Fiction', 'French -- England -- London -- Fiction', 'Historical fiction', 'London (England) -- History -- 18th century -- Fiction', 'Look-alikes -- Fiction', 'Paris (France) -- History -- 1789-1799 -- Fiction']::text[],
    ARRAY['Historical Fiction']::text[],
    ARRAY['en']::text[],
    false,
    'Text',
    jsonb_build_object(
      'text/html', 'https://www.gutenberg.org/ebooks/98.html.images',
      'application/epub+zip', 'https://www.gutenberg.org/ebooks/98.epub3.images',
      'application/x-mobipocket-ebook', 'https://www.gutenberg.org/ebooks/98.kf8.images',
      'text/plain; charset=utf-8', 'https://www.gutenberg.org/ebooks/98.txt.utf-8',
      'image/jpeg', 'https://www.gutenberg.org/cache/epub/98/pg98.cover.medium.jpg',
      'application/rdf+xml', 'https://www.gutenberg.org/ebooks/98.rdf'
    ),
    21900,
    1870,
    1812
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  authors = EXCLUDED.authors,
  translators = EXCLUDED.translators,
  subjects = EXCLUDED.subjects,
  bookshelves = EXCLUDED.bookshelves,
  languages = EXCLUDED.languages,
  copyright = EXCLUDED.copyright,
  media_type = EXCLUDED.media_type,
  formats = EXCLUDED.formats,
  download_count = EXCLUDED.download_count,
  max_author_death_year = EXCLUDED.max_author_death_year,
  min_author_birth_year = EXCLUDED.min_author_birth_year,
  updated_at = NOW();

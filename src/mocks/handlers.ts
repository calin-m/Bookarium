import { http, HttpResponse } from 'msw';
import type { GutendexBook, GutendexResponse } from '@/types/book.types';

export type { GutendexBook, GutendexResponse };

export const mockBooks: GutendexBook[] = [
  {
    id: 1342,
    title: 'Pride and Prejudice',
    authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
    translators: [],
    subjects: [
      'Courtship -- Fiction',
      'Domestic fiction',
      'England -- Social life and customs -- 19th century -- Fiction',
      'Love stories',
      'Sisters -- Fiction',
      'Young women -- Fiction',
    ],
    bookshelves: ['Best Books Ever Listings', 'Classic Literature', 'Romantic Fiction'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    formats: {
      'application/epub+zip': 'https://www.gutenberg.org/ebooks/1342.epub3.images',
      'text/html; charset=utf-8': 'https://www.gutenberg.org/files/1342/1342-h/1342-h.htm',
      'text/plain; charset=utf-8': 'https://www.gutenberg.org/ebooks/1342.txt.utf-8',
      'application/x-mobipocket-ebook': 'https://www.gutenberg.org/ebooks/1342.kindle.images',
      'image/jpeg': 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg',
    },
    download_count: 65420,
  },
  {
    id: 84,
    title: 'Frankenstein; Or, The Modern Prometheus',
    authors: [{ name: 'Shelley, Mary Wollstonecraft', birth_year: 1797, death_year: 1851 }],
    translators: [],
    subjects: [
      'Frankenstein (Fictitious character) -- Fiction',
      'Frankenstein\'s monster (Fictitious character) -- Fiction',
      'Gothic fiction',
      'Horror tales',
      'Monsters -- Fiction',
      'Science fiction',
      'Scientists -- Fiction',
    ],
    bookshelves: ['Gothic Fiction', 'Science Fiction', 'Precursors of Science Fiction'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    formats: {
      'application/epub+zip': 'https://www.gutenberg.org/ebooks/84.epub3.images',
      'text/html; charset=utf-8': 'https://www.gutenberg.org/files/84/84-h/84-h.htm',
      'text/plain; charset=utf-8': 'https://www.gutenberg.org/ebooks/84.txt.utf-8',
      'application/x-mobipocket-ebook': 'https://www.gutenberg.org/ebooks/84.kindle.images',
      'image/jpeg': 'https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg',
    },
    download_count: 54100,
  },
  {
    id: 1497,
    title: 'The Republic',
    authors: [{ name: 'Plato', birth_year: -428, death_year: -348 }],
    translators: [{ name: 'Jowett, Benjamin', birth_year: 1817, death_year: 1893 }],
    subjects: [
      'Classical literature',
      'Justice -- Early works to 1800',
      'Philosophy, Ancient',
      'Political science -- Early works to 1800',
      'Utopias -- Early works to 1800',
    ],
    bookshelves: ['Philosophy', 'Politics', 'Classics'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    formats: {
      'application/epub+zip': 'https://www.gutenberg.org/ebooks/1497.epub3.images',
      'text/html; charset=utf-8': 'https://www.gutenberg.org/files/1497/1497-h/1497-h.htm',
      'text/plain; charset=utf-8': 'https://www.gutenberg.org/ebooks/1497.txt.utf-8',
      'application/x-mobipocket-ebook': 'https://www.gutenberg.org/ebooks/1497.kindle.images',
      'image/jpeg': 'https://www.gutenberg.org/cache/epub/1497/pg1497.cover.medium.jpg',
    },
    download_count: 32800,
  },
  {
    id: 35,
    title: 'The Time Machine',
    authors: [{ name: 'Wells, H. G. (Herbert George)', birth_year: 1866, death_year: 1946 }],
    translators: [],
    subjects: [
      'Dystopias -- Fiction',
      'Science fiction',
      'Time travel -- Fiction',
    ],
    bookshelves: ['Science Fiction', 'Movie Books'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    formats: {
      'application/epub+zip': 'https://www.gutenberg.org/ebooks/35.epub3.images',
      'text/html; charset=utf-8': 'https://www.gutenberg.org/files/35/35-h/35-h.htm',
      'text/plain; charset=utf-8': 'https://www.gutenberg.org/ebooks/35.txt.utf-8',
      'application/x-mobipocket-ebook': 'https://www.gutenberg.org/ebooks/35.kindle.images',
      'image/jpeg': 'https://www.gutenberg.org/cache/epub/35/pg35.cover.medium.jpg',
    },
    download_count: 28900,
  },
  {
    id: 11,
    title: "Alice's Adventures in Wonderland",
    authors: [{ name: 'Carroll, Lewis', birth_year: 1832, death_year: 1898 }],
    translators: [],
    subjects: [
      'Alice (Fictitious character from Carroll) -- Juvenile fiction',
      'Children\'s stories',
      'Fantasy fiction',
      'Imaginary places -- Juvenile fiction',
    ],
    bookshelves: ['Children\'s Literature', 'Classic Literature'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    formats: {
      'application/epub+zip': 'https://www.gutenberg.org/ebooks/11.epub3.images',
      'text/html; charset=utf-8': 'https://www.gutenberg.org/files/11/11-h/11-h.htm',
      'text/plain; charset=utf-8': 'https://www.gutenberg.org/ebooks/11.txt.utf-8',
      'application/x-mobipocket-ebook': 'https://www.gutenberg.org/ebooks/11.kindle.images',
      'image/jpeg': 'https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg',
    },
    download_count: 42100,
  },
  {
    id: 55179,
    title: 'The King in Yellow',
    authors: [{ name: 'Chambers, Robert W. (Robert William)', birth_year: 1865, death_year: 1933 }],
    translators: [],
    subjects: ['Short stories, American', 'Gothic fiction'],
    bookshelves: ['Horror Fiction'],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    formats: {
      'image/jpeg': 'https://www.gutenberg.org/cache/epub/55179/pg55179.cover.medium.jpg',
      'application/epub+zip': 'https://www.gutenberg.org/ebooks/55179.epub3.images',
    },
    download_count: 12500,
  },
];

export const sampleBookText = `The Project Gutenberg eBook of Pride and Prejudice, by Jane Austen

Chapter 1

It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.

However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.

"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"

Mr. Bennet replied that he had not.

"But it is," returned she; "for Mrs. Long has just been here, and she told me all about it."

Mr. Bennet made no answer.

"Do you not want to know who has taken it?" cried his wife impatiently.

"You want to tell me, and I have no objection to hearing it."

This was invitation enough.

"Why, my dear, you must know, Mrs. Long says that Netherfield is taken by a young man of large fortune from the north of England; that he came down on Monday in a chaise and four to see the place, and was so much delighted with it, that he agreed with Mr. Morris immediately; that he is to take possession before Michaelmas, and some of his servants are to be in the house by the end of next week."

"What is his name?"

"Bingley."

"Is he married or single?"

"Oh! Single, my dear, to be sure! A single man of large fortune; four or five thousand a year. What a fine thing for our girls!"

"How so? How can it affect them?"

"My dear Mr. Bennet," replied his wife, "how can you be so tiresome! You must know that I am thinking of his marrying one of them."
`;

export const handlers = [
  // Direct Gutendex API handler
  http.get('https://gutendex.com/books', ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase() || '';
    const topic = url.searchParams.get('topic')?.toLowerCase() || '';
    const languages = url.searchParams.get('languages')?.toLowerCase() || '';
    const ids = url.searchParams.get('ids');

    let filtered = [...mockBooks];

    if (ids) {
      const idList = ids.split(',').map((id) => parseInt(id.trim(), 10)).filter((n) => !isNaN(n));
      if (idList.length > 0) {
        filtered = filtered.filter((b) => idList.includes(b.id));
      }
    }

    if (search) {
      filtered = filtered.filter(
        (b) =>
          b.title.toLowerCase().includes(search) ||
          b.authors.some((a) => a.name.toLowerCase().includes(search)) ||
          b.subjects.some((s) => s.toLowerCase().includes(search))
      );
    }

    if (topic) {
      filtered = filtered.filter(
        (b) =>
          b.subjects.some((s) => s.toLowerCase().includes(topic)) ||
          b.bookshelves.some((bs) => bs.toLowerCase().includes(topic))
      );
    }

    if (languages) {
      const langs = languages.split(',');
      filtered = filtered.filter((b) => b.languages.some((l) => langs.includes(l.toLowerCase())));
    }

    return HttpResponse.json({
      count: filtered.length,
      next: null,
      previous: null,
      results: filtered,
    });
  }),

  // Next.js internal API proxy handler
  http.get('/api/books', ({ request }) => {
    const url = new URL(request.url, 'http://localhost:3000');
    const search = url.searchParams.get('search')?.toLowerCase() || '';
    const topic = url.searchParams.get('topic')?.toLowerCase() || '';
    const languages = url.searchParams.get('languages')?.toLowerCase() || '';
    const ids = url.searchParams.get('ids');

    let filtered = [...mockBooks];

    if (ids) {
      const idList = ids.split(',').map((id) => parseInt(id.trim(), 10)).filter((n) => !isNaN(n));
      if (idList.length > 0) {
        filtered = filtered.filter((b) => idList.includes(b.id));
      }
    }

    if (search) {
      filtered = filtered.filter(
        (b) =>
          b.title.toLowerCase().includes(search) ||
          b.authors.some((a) => a.name.toLowerCase().includes(search))
      );
    }

    if (topic) {
      filtered = filtered.filter(
        (b) =>
          b.subjects.some((s) => s.toLowerCase().includes(topic)) ||
          b.bookshelves.some((bs) => bs.toLowerCase().includes(topic))
      );
    }

    if (languages) {
      const langs = languages.split(',');
      filtered = filtered.filter((b) => b.languages.some((l) => langs.includes(l.toLowerCase())));
    }

    return HttpResponse.json({
      count: filtered.length,
      next: null,
      previous: null,
      results: filtered,
    });
  }),

  // Book content text mock
  http.get('https://www.gutenberg.org/ebooks/:id.txt.utf-8', () => {
    return new HttpResponse(sampleBookText, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }),

  // Book content internal proxy handler
  http.get('/api/books/content', () => {
    return new HttpResponse(sampleBookText, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }),
];


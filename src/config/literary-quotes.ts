/**
 * Classic Literary Quotes & Passages from Project Gutenberg Masterworks
 * Single source of truth for the alternating Literary Quotes section.
 */

export interface LiteraryQuote {
  id: number;
  bookId: number;
  category: string;
  year: string;
  bookTitle: string;
  author: string;
  quote: string;
  citation: string;
}

export const LITERARY_QUOTES: LiteraryQuote[] = [
  {
    id: 1,
    bookId: 1342,
    category: 'ROMANTIC CLASSIC',
    year: '1813',
    bookTitle: 'Pride and Prejudice',
    author: 'Jane Austen',
    quote:
      'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
    citation: 'Chapter 1, Opening line',
  },
  {
    id: 2,
    bookId: 2701,
    category: 'EPIC ADVENTURE',
    year: '1851',
    bookTitle: 'Moby Dick; Or, The Whale',
    author: 'Herman Melville',
    quote:
      'Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.',
    citation: 'Chapter 1: Loomings',
  },
  {
    id: 3,
    bookId: 84,
    category: 'GOTHIC HORROR',
    year: '1818',
    bookTitle: 'Frankenstein',
    author: 'Mary Shelley',
    quote:
      'Beware; for I am fearless, and therefore powerful. I will watch with the wiliness of a snake, that I may sting with its venom.',
    citation: 'Chapter 20',
  },
  {
    id: 4,
    bookId: 98,
    category: 'HISTORICAL NOVEL',
    year: '1859',
    bookTitle: 'A Tale of Two Cities',
    author: 'Charles Dickens',
    quote:
      'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity...',
    citation: 'Book 1, Chapter 1',
  },
  {
    id: 5,
    bookId: 174,
    category: 'PHILOSOPHICAL FICTION',
    year: '1890',
    bookTitle: 'The Picture of Dorian Gray',
    author: 'Oscar Wilde',
    quote:
      'The only way to get rid of a temptation is to yield to it. Resist it, and your soul grows sick with longing for the things it has forbidden to itself.',
    citation: 'Chapter 2',
  },
  {
    id: 6,
    bookId: 1661,
    category: 'DETECTIVE MYSTERY',
    year: '1892',
    bookTitle: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    quote:
      'It has long been an axiom of mine that the little things are infinitely the most important.',
    citation: 'A Case of Identity',
  },
  {
    id: 7,
    bookId: 11,
    category: 'FANTASY & NONSENSE',
    year: '1865',
    bookTitle: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    quote:
      '“Begin at the beginning,” the King said, very gravely, “and go on till you come to the end: then stop.”',
    citation: 'Chapter 12: Alice’s Evidence',
  },
  {
    id: 8,
    bookId: 345,
    category: 'VAMPIRE CLASSIC',
    year: '1897',
    bookTitle: 'Dracula',
    author: 'Bram Stoker',
    quote:
      'Listen to them—the children of the night. What music they make!',
    citation: 'Chapter 2: Jonathan Harker’s Journal',
  },
  {
    id: 9,
    bookId: 1260,
    category: 'VICTORIAN ROMANCE',
    year: '1847',
    bookTitle: 'Jane Eyre',
    author: 'Charlotte Brontë',
    quote:
      'I am no bird; and no net ensnares me; I am a free human being with an independent will, which I now exert to leave you.',
    citation: 'Chapter 23',
  },
  {
    id: 10,
    bookId: 5200,
    category: 'EXISTENTIAL FICTION',
    year: '1915',
    bookTitle: 'The Metamorphosis',
    author: 'Franz Kafka',
    quote:
      'As Gregor Samsa awoke one morning from uneasy dreams he found himself transformed in his bed into a gigantic insect.',
    citation: 'Opening line',
  },
  {
    id: 11,
    bookId: 2554,
    category: 'PSYCHOLOGICAL DRAMA',
    year: '1866',
    bookTitle: 'Crime and Punishment',
    author: 'Fyodor Dostoevsky',
    quote:
      'Pain and suffering are always inevitable for a large intelligence and a deep heart. The really great men must, I think, have great sadness on earth.',
    citation: 'Part 3, Chapter 5',
  },
  {
    id: 12,
    bookId: 64317,
    category: 'JAZZ AGE CLASSIC',
    year: '1925',
    bookTitle: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    quote:
      'So we beat on, boats against the current, borne back ceaselessly into the past.',
    citation: 'Final line',
  },
];


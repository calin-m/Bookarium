/**
 * Classic Literary Quotes & Passages from Project Gutenberg Masterworks
 * Single source of truth for the alternating Literary Quotes section.
 */

import { isBookPublicDomainInJurisdiction } from '@/lib/copyright-engine';

export interface LiteraryQuote {
  id: number;
  bookId: number;
  category: string;
  year: string;
  bookTitle: string;
  author: string;
  authorBirthYear?: number;
  authorDeathYear?: number;
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
    authorBirthYear: 1775,
    authorDeathYear: 1817,
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
    authorBirthYear: 1819,
    authorDeathYear: 1891,
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
    authorBirthYear: 1797,
    authorDeathYear: 1851,
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
    authorBirthYear: 1812,
    authorDeathYear: 1870,
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
    authorBirthYear: 1854,
    authorDeathYear: 1900,
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
    authorBirthYear: 1859,
    authorDeathYear: 1930,
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
    authorBirthYear: 1832,
    authorDeathYear: 1898,
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
    authorBirthYear: 1847,
    authorDeathYear: 1912,
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
    authorBirthYear: 1816,
    authorDeathYear: 1855,
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
    authorBirthYear: 1883,
    authorDeathYear: 1924,
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
    authorBirthYear: 1821,
    authorDeathYear: 1881,
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
    authorBirthYear: 1896,
    authorDeathYear: 1940,
    quote:
      'So we beat on, boats against the current, borne back ceaselessly into the past.',
    citation: 'Final line',
  },
  {
    id: 13,
    bookId: 2600,
    category: 'RUSSIAN EPIC',
    year: '1869',
    bookTitle: 'War and Peace',
    author: 'Leo Tolstoy',
    authorBirthYear: 1828,
    authorDeathYear: 1910,
    quote:
      'We can know only that we know nothing. And that is the highest degree of human wisdom.',
    citation: 'Book 9, Chapter 1',
  },
  {
    id: 14,
    bookId: 135,
    category: 'FRENCH EPIC',
    year: '1862',
    bookTitle: 'Les Misérables',
    author: 'Victor Hugo',
    authorBirthYear: 1802,
    authorDeathYear: 1885,
    quote:
      'Even the darkest night will end and the sun will rise. To love or have loved, that is enough. Ask nothing further.',
    citation: 'Part 5: Jean Valjean',
  },
  {
    id: 15,
    bookId: 768,
    category: 'TRAGIC ROMANCE',
    year: '1847',
    bookTitle: 'Wuthering Heights',
    author: 'Emily Brontë',
    authorBirthYear: 1818,
    authorDeathYear: 1848,
    quote:
      'Whatever our souls are made of, his and mine are the same; and Linton’s is as different as a moonbeam from lightning, or frost from fire.',
    citation: 'Chapter 9',
  },
  {
    id: 16,
    bookId: 1184,
    category: 'REVENGE EPIC',
    year: '1844',
    bookTitle: 'The Count of Monte Cristo',
    author: 'Alexandre Dumas',
    authorBirthYear: 1802,
    authorDeathYear: 1870,
    quote:
      'All human wisdom is contained in these two words,—Wait and Hope.',
    citation: 'Chapter 117: The Fifth of October',
  },
  {
    id: 17,
    bookId: 132,
    category: 'MILITARY STRATEGY',
    year: '5th C. BC',
    bookTitle: 'The Art of War',
    author: 'Sun Tzu',
    authorBirthYear: -544,
    authorDeathYear: -496,
    quote:
      'The supreme art of war is to subdue the enemy without fighting. In the midst of chaos, there is also opportunity.',
    citation: 'Chapter 3: Attack by Stratagem',
  },
  {
    id: 18,
    bookId: 2680,
    category: 'STOIC PHILOSOPHY',
    year: '180 AD',
    bookTitle: 'Meditations',
    author: 'Marcus Aurelius',
    authorBirthYear: 121,
    authorDeathYear: 180,
    quote:
      'You have power over your mind—not outside events. Realize this, and you will find strength.',
    citation: 'Book IV',
  },
  {
    id: 19,
    bookId: 1727,
    category: 'GREEK EPIC',
    year: '8th C. BC',
    bookTitle: 'The Odyssey',
    author: 'Homer',
    authorBirthYear: -800,
    authorDeathYear: -750,
    quote:
      'There is nothing more admirable than when two people who see eye to eye keep house as man and wife, confounding their enemies and delighting their friends.',
    citation: 'Book VI',
  },
  {
    id: 20,
    bookId: 1232,
    category: 'POLITICAL STATECRAFT',
    year: '1532',
    bookTitle: 'The Prince',
    author: 'Niccolò Machiavelli',
    authorBirthYear: 1469,
    authorDeathYear: 1527,
    quote:
      'It is much safer to be feared than loved because love is preserved by the link of obligation which, owing to the baseness of men, is broken at every opportunity.',
    citation: 'Chapter 17',
  },
  {
    id: 21,
    bookId: 514,
    category: 'AMERICAN CLASSIC',
    year: '1868',
    bookTitle: 'Little Women',
    author: 'Louisa May Alcott',
    authorBirthYear: 1832,
    authorDeathYear: 1888,
    quote:
      'I am not afraid of storms, for I am learning how to sail my ship.',
    citation: 'Chapter 44: My Lord and Lady',
  },
  {
    id: 22,
    bookId: 2147,
    category: 'GOTHIC POETRY',
    year: '1845',
    bookTitle: 'The Works of Edgar Allan Poe',
    author: 'Edgar Allan Poe',
    authorBirthYear: 1809,
    authorDeathYear: 1849,
    quote:
      'Deep into that darkness peering, long I stood there wondering, fearing, doubting, dreaming dreams no mortal ever dared to dream before.',
    citation: 'The Raven, Stanza 5',
  },
  {
    id: 23,
    bookId: 164,
    category: 'SPECULATIVE FICTION',
    year: '1870',
    bookTitle: 'Twenty Thousand Leagues Under the Sea',
    author: 'Jules Verne',
    authorBirthYear: 1828,
    authorDeathYear: 1905,
    quote:
      'The sea is everything. It covers seven tenths of the terrestrial globe. Its breath is pure and healthy. It is an immense desert, where man is never lonely.',
    citation: 'Part 1, Chapter 10',
  },
  {
    id: 24,
    bookId: 205,
    category: 'TRANSCENDENTALISM',
    year: '1854',
    bookTitle: 'Walden',
    author: 'Henry David Thoreau',
    authorBirthYear: 1817,
    authorDeathYear: 1862,
    quote:
      'I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach.',
    citation: 'Where I Lived, and What I Lived For',
  },
  {
    id: 25,
    bookId: 76,
    category: 'AMERICAN REALISM',
    year: '1884',
    bookTitle: 'The Adventures of Huckleberry Finn',
    author: 'Mark Twain',
    authorBirthYear: 1835,
    authorDeathYear: 1910,
    quote:
      'All right, then, I’ll go to hell. It was awful thoughts and awful words, but they was said. And I let them stay said; and never thought no more about reforming.',
    citation: 'Chapter 31',
  },
  {
    id: 26,
    bookId: 43,
    category: 'PSYCHOLOGICAL THRILLER',
    year: '1886',
    bookTitle: 'The Strange Case of Dr. Jekyll and Mr. Hyde',
    author: 'Robert Louis Stevenson',
    authorBirthYear: 1850,
    authorDeathYear: 1894,
    quote:
      'With every day, and from both sides of my intelligence, the moral and the intellectual, I thus drew steadily nearer to that truth: that man is not truly one, but truly two.',
    citation: 'Henry Jekyll’s Full Statement of the Case',
  },
  {
    id: 27,
    bookId: 33,
    category: 'EARLY AMERICAN DRAMA',
    year: '1850',
    bookTitle: 'The Scarlet Letter',
    author: 'Nathaniel Hawthorne',
    authorBirthYear: 1804,
    authorDeathYear: 1864,
    quote:
      'No man, for any considerable period, can wear one face to himself, and another to the multitude, without finally getting bewildered as to which may be the true.',
    citation: 'Chapter 20: The Minister in a Maze',
  },
  {
    id: 28,
    bookId: 1952,
    category: 'FEMINIST PSYCHOLOGY',
    year: '1892',
    bookTitle: 'The Yellow Wallpaper',
    author: 'Charlotte Perkins Gilman',
    authorBirthYear: 1860,
    authorDeathYear: 1935,
    quote:
      'It is so discouraging not to have any advice and companionship about my work. When I get really well, John says we will ask Cousin Henry and Julia down for a long visit.',
    citation: 'Section 4',
  },
  {
    id: 29,
    bookId: 23,
    category: 'MEMOIR & FREEDOM',
    year: '1845',
    bookTitle: 'Narrative of the Life of Frederick Douglass',
    author: 'Frederick Douglass',
    authorBirthYear: 1818,
    authorDeathYear: 1895,
    quote:
      'Once you learn to read, you will be forever free. Knowledge makes a man unfit to be a slave.',
    citation: 'Chapter 6',
  },
  {
    id: 30,
    bookId: 1399,
    category: 'ESSAY & NATURE',
    year: '1841',
    bookTitle: 'Essays: First Series',
    author: 'Ralph Waldo Emerson',
    authorBirthYear: 1803,
    authorDeathYear: 1882,
    quote:
      'To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.',
    citation: 'Self-Reliance',
  },
  {
    id: 31,
    bookId: 1322,
    category: 'AMERICAN POETRY',
    year: '1855',
    bookTitle: 'Leaves of Grass',
    author: 'Walt Whitman',
    authorBirthYear: 1819,
    authorDeathYear: 1892,
    quote:
      'Do I contradict myself? Very well then I contradict myself, (I am large, I contain multitudes.)',
    citation: 'Song of Myself, Section 51',
  },
  {
    id: 32,
    bookId: 145,
    category: 'SATIRICAL FICTION',
    year: '1871',
    bookTitle: 'Middlemarch',
    author: 'George Eliot',
    authorBirthYear: 1819,
    authorDeathYear: 1880,
    quote:
      'For the growing good of the world is partly dependent on unhistoric acts; and that things are not so ill with you and me as they might have been, is half owing to the number who lived faithfully a hidden life.',
    citation: 'Finale',
  },
  {
    id: 33,
    bookId: 829,
    category: 'SATIRE & FANTASY',
    year: '1726',
    bookTitle: "Gulliver's Travels",
    author: 'Jonathan Swift',
    authorBirthYear: 1667,
    authorDeathYear: 1745,
    quote:
      'Every man desires to live long, but no man would be old.',
    citation: 'Part III, Chapter 10',
  },
  {
    id: 34,
    bookId: 996,
    category: 'ITALIAN EPIC',
    year: '1320',
    bookTitle: 'The Divine Comedy',
    author: 'Dante Alighieri',
    authorBirthYear: 1265,
    authorDeathYear: 1321,
    quote:
      'The darkest places in hell are reserved for those who maintain their neutrality in times of moral crisis.',
    citation: 'Inferno, Canto III',
  },
  {
    id: 35,
    bookId: 996,
    category: 'SPANISH MASTERWORK',
    year: '1605',
    bookTitle: 'Don Quixote',
    author: 'Miguel de Cervantes',
    authorBirthYear: 1547,
    authorDeathYear: 1616,
    quote:
      'When life itself seems lunatic, who knows where madness lies? To surrender dreams—this may be madness. Too much sanity may be madness.',
    citation: 'Part 1, Chapter 1',
  },
  {
    id: 36,
    bookId: 120,
    category: 'TREASURE & PIRACY',
    year: '1883',
    bookTitle: 'Treasure Island',
    author: 'Robert Louis Stevenson',
    authorBirthYear: 1850,
    authorDeathYear: 1894,
    quote:
      'Fifteen men on the dead man’s chest—Yo-ho-ho, and a bottle of rum! Drink and the devil had done for the rest—Yo-ho-ho, and a bottle of rum!',
    citation: 'Chapter 1: The Old Sea-dog at the Admiral Benbow',
  },
];

/**
 * Returns literary quotes that are 100% public domain in the specified jurisdiction.
 * Excludes authors whose works remain protected under Life+70, Life+80, or Life+100 rules.
 */
export function getJurisdictionSafeLiteraryQuotes(countryCode: string = 'US'): LiteraryQuote[] {
  return LITERARY_QUOTES.filter((quote) => {
    const evaluation = isBookPublicDomainInJurisdiction(
      {
        id: quote.bookId,
        title: quote.bookTitle,
        authors: [
          {
            name: quote.author,
            birth_year: quote.authorBirthYear ?? null,
            death_year: quote.authorDeathYear ?? null,
          },
        ],
        copyright: false,
      },
      countryCode
    );
    return evaluation.isAllowed;
  });
}

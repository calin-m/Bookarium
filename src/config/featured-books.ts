/**
 * Featured Classic Books Fixtures for Bookarium
 * Centralized metadata for Hero spotlights and featured book cards.
 */

export interface FeaturedHeroBook {
  id: number;
  volumeNumber: string;
  title: string;
  author: string;
  year: string;
  quoteExcerpt: string;
  openingLine: string;
  license: string;
  primarySubject: string;
}

export const FEATURED_HERO_BOOKS: FeaturedHeroBook[] = [
  {
    id: 1342,
    volumeNumber: 'Vol. 1342',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    year: '1813',
    openingLine:
      'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.',
    quoteExcerpt:
      'I declare after all there is no enjoyment like reading! How much sooner one tires of any thing than of a book! When I have a house of my own, I shall be miserable if I have not an excellent library. There is a stubbornness about me that never can bear to be frightened at the will of others.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Classic Romance & Social Satire',
  },
  {
    id: 84,
    volumeNumber: 'Vol. 84',
    title: 'Frankenstein',
    author: 'Mary Wollstonecraft Shelley',
    year: '1818',
    openingLine:
      'You will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such evil forebodings. I arrived here yesterday, and my first task is to assure my dear sister of my welfare and increasing confidence in the success of my undertaking.',
    quoteExcerpt:
      'Life and death appeared to me ideal bounds, which I should first break through, and pour a torrent of light into our dark world. A new species would bless me as its creator and source; many happy and excellent natures would owe their being to me. Beware; for I am fearless, and therefore powerful.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Gothic Science Fiction & Horror',
  },
  {
    id: 2701,
    volumeNumber: 'Vol. 2701',
    title: 'Moby Dick',
    author: 'Herman Melville',
    year: '1851',
    openingLine:
      'Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen and regulating the circulation.',
    quoteExcerpt:
      'Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; then, I account it high time to get to sea as soon as I can. There is, one knows not what sweet mystery about this sea, whose gently awful stirrings seem to speak of some hidden soul beneath.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Maritime Epic & Adventure',
  },
  {
    id: 64317,
    volumeNumber: 'Vol. 64317',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    year: '1925',
    openingLine:
      'In my younger and more vulnerable years my father gave me some advice that I’ve been turning over in my mind ever since. "Whenever you feel like criticizing anyone," he told me, "just remember that all the people in this world haven’t had the advantages that you’ve had."',
    quoteExcerpt:
      'Gatsby believed in the green light, the orgastic future that year by year recedes before us. It eluded us then, but that’s no matter—tomorrow we will run faster, stretch out our arms farther. And one fine morning—So we beat on, boats against the current, borne back ceaselessly into the past.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Jazz Age & American Tragedy',
  },
  {
    id: 11,
    volumeNumber: 'Vol. 11',
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    year: '1865',
    openingLine:
      'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, "and what is the use of a book," thought Alice "without pictures or conversation?"',
    quoteExcerpt:
      '“Curiouser and curiouser!” cried Alice (she was so much surprised, that for the moment she quite forgot how to speak good English). "It’s no use going back to yesterday, because I was a different person then. Why, sometimes I’ve believed as many as six impossible things before breakfast."',
    license: 'CC0 / Public Domain',
    primarySubject: 'Literary Nonsense & Fantasy',
  },
  {
    id: 174,
    volumeNumber: 'Vol. 174',
    title: 'The Picture of Dorian Gray',
    author: 'Oscar Wilde',
    year: '1890',
    openingLine:
      'The artist is the creator of beautiful things. To reveal art and conceal the artist is art’s aim. The critic is he who can translate into another manner or a new material his impression of beautiful things. There is no such thing as a moral or an immoral book. Books are well written, or badly written. That is all.',
    quoteExcerpt:
      'The only way to get rid of a temptation is to yield to it. Resist it, and your soul grows sick with longing for the things it has forbidden to itself, with desire for what its monstrous laws have made monstrous and unlawful. The books that the world calls immoral are books that show the world its own shame.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Philosophical & Aesthetic Fiction',
  },
  {
    id: 1661,
    volumeNumber: 'Vol. 1661',
    title: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    year: '1892',
    openingLine:
      'To Sherlock Holmes she is always THE woman. I have seldom heard him mention her under any other name. In his eyes she eclipses and predominates the whole of her sex. It was not that he felt any emotion akin to love for Irene Adler. All emotions were abhorrent to his cold, precise but admirably balanced mind.',
    quoteExcerpt:
      'It is a capital mistake to theorize before one has data. Insensibly one begins to twist facts to suit theories, instead of theories to suit facts. To a great mind, nothing is little. You see, but you do not observe. The distinction is clear, my dear Watson.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Detective Fiction & Mystery',
  },
  {
    id: 345,
    volumeNumber: 'Vol. 345',
    title: 'Dracula',
    author: 'Bram Stoker',
    year: '1897',
    openingLine:
      '3 May. Bistritz.—Left Munich at 8:35 P.M., on 1st May, arriving at Vienna early next morning. The impression I had was that we were leaving the West and entering the East; the most western of splendid bridges over the Danube taking us among the traditions of Turkish rule.',
    quoteExcerpt:
      'Welcome to my house! Enter freely and of your own will! Come freely. Go safely; and leave something of the happiness you bring! Listen to them, the children of the night. What music they make! We learn from failure, not from success!',
    license: 'CC0 / Public Domain',
    primarySubject: 'Gothic Horror & Vampire Fiction',
  },
  {
    id: 98,
    volumeNumber: 'Vol. 98',
    title: 'A Tale of Two Cities',
    author: 'Charles Dickens',
    year: '1859',
    openingLine:
      'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of light, it was the season of darkness, it was the spring of hope, it was the winter of despair.',
    quoteExcerpt:
      'It is a far, far better thing that I do, than I have ever done; it is a far, far better rest that I go to than I have ever known. There is a prodigious strength in sorrow and despair. Crushed under mills that ground millions, they could not look up.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Historical Fiction & Revolution',
  },
  {
    id: 35,
    volumeNumber: 'Vol. 35',
    title: 'The Time Machine',
    author: 'H. G. Wells',
    year: '1895',
    openingLine:
      'The Time Traveller (for so it will be convenient to speak of him) was expounding a recondite matter to us. His grey eyes shone and twinkled, and his usually pale face was flushed and animated. The fire burnt brightly, and the soft radiance of the incandescent lights in the lilies of silver caught the bubbles.',
    quoteExcerpt:
      'We are always getting away from the present moment. Our mental existences, which are immaterial and have no dimensions, are passing along the Time-Dimension with a uniform velocity from the cradle to the grave. Nature never appeals to intelligence until habit and instinct are useless.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Time Travel & Science Fiction',
  },
];

export const FEATURED_HERO_BOOK: FeaturedHeroBook = FEATURED_HERO_BOOKS[0];

export interface BookPassage {
  chapterLabel: string;
  openingLine: string;
  quoteExcerpt: string;
}

export function getBookPassages(book: {
  id: number;
  title: string;
  authors?: { name: string }[];
  subjects?: string[];
}): BookPassage[] {
  const featured = FEATURED_HERO_BOOKS.find(
    (f) => f.id === book.id || f.title.toLowerCase() === book.title.toLowerCase()
  );

  const author =
    book.authors?.[0]?.name.split(',').reverse().join(' ').trim() || 'the author';
  const subject = book.subjects?.[0]?.split('--')[0].trim() || 'timeless literature';

  if (featured) {
    return [
      {
        chapterLabel: 'Chapter I • The Beginning',
        openingLine: featured.openingLine,
        quoteExcerpt: featured.quoteExcerpt,
      },
      {
        chapterLabel: 'Notable Soliloquy',
        openingLine: `In the unfolding tapestry of ${featured.title}, ${featured.author} explores profound human truths across ${featured.primarySubject.toLowerCase()}.`,
        quoteExcerpt: featured.quoteExcerpt,
      },
      {
        chapterLabel: 'Public Domain Colophon',
        openingLine: `This edition of ${featured.title} is preserved in the worldwide public domain, free of copyright restrictions for all readers.`,
        quoteExcerpt: `“To read without reflecting is like eating without digesting.” A preserved masterpiece by ${featured.author} (${featured.year}).`,
      },
    ];
  }

  return [
    {
      chapterLabel: 'Chapter I • Opening Excerpt',
      openingLine: `“Here begins the timeless account of ${book.title}, a celebrated work by ${author} touching upon the enduring themes of ${subject.toLowerCase()}.”`,
      quoteExcerpt: `“A room without books is like a body without a soul.” Discover the complete unabridged text preserved freely in the public domain.`,
    },
    {
      chapterLabel: 'Literary Context & Themes',
      openingLine: `Preserved within the Project Gutenberg archive as ID #${book.id}, this work stands as a testament to historical scholarship and human creativity in ${subject.toLowerCase()}.`,
      quoteExcerpt: `“There is no friend as loyal as a book.” Dive into the world crafted by ${author} across this complete digital edition.`,
    },
    {
      chapterLabel: 'Public Domain Colophon',
      openingLine: `Transcribed from original physical editions into open UTF-8 format, freely readable and downloadable under the Zero-Copyright CC0 public domain dedication.`,
      quoteExcerpt: `“Books are the quietest and most constant of friends; they are the most accessible and wisest of counselors, and the most patient of teachers.”`,
    },
  ];
}


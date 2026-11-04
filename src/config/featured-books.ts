/**
 * Featured Classic Books Fixtures for Bookarium
 * Centralized metadata for Hero spotlights and featured book cards.
 */

import { formatAuthorNames, formatPrimarySubject } from '@/lib/utils';
import { isBookPublicDomainInJurisdiction, type Author } from '@/lib/copyright-engine';
import type { BookPassage, GutendexBook } from '@/types/book.types';
export type { BookPassage };

export interface FeaturedHeroBook {
  id: number;
  volumeNumber: string;
  title: string;
  author: string;
  authorBirthYear?: number | null;
  authorDeathYear?: number | null;
  translators?: Author[];
  year: string;
  quoteExcerpt: string;
  openingLine: string;
  license: string;
  primarySubject: string;
  quotes?: BookPassage[];
}

export const FEATURED_HERO_BOOKS: FeaturedHeroBook[] = [
  {
    id: 1342,
    volumeNumber: 'Vol. 1342',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    authorBirthYear: 1775,
    authorDeathYear: 1817,
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
    authorBirthYear: 1797,
    authorDeathYear: 1851,
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
    authorBirthYear: 1819,
    authorDeathYear: 1891,
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
    authorBirthYear: 1896,
    authorDeathYear: 1940,
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
    authorBirthYear: 1832,
    authorDeathYear: 1898,
    year: '1865',
    openingLine:
      'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, "and what is the use of a book," thought Alice "without pictures or conversation?"',
    quoteExcerpt:
      'Curiouser and curiouser!” cried Alice (she was so much surprised, that for the moment she quite forgot how to speak good English). "It’s no use going back to yesterday, because I was a different person then. Why, sometimes I’ve believed as many as six impossible things before breakfast."',
    license: 'CC0 / Public Domain',
    primarySubject: 'Literary Nonsense & Fantasy',
  },
  {
    id: 174,
    volumeNumber: 'Vol. 174',
    title: 'The Picture of Dorian Gray',
    author: 'Oscar Wilde',
    authorBirthYear: 1854,
    authorDeathYear: 1900,
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
    authorBirthYear: 1859,
    authorDeathYear: 1930,
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
    authorBirthYear: 1847,
    authorDeathYear: 1912,
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
    authorBirthYear: 1812,
    authorDeathYear: 1870,
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
    authorBirthYear: 1866,
    authorDeathYear: 1946,
    year: '1895',
    openingLine:
      'The Time Traveller (for so it will be convenient to speak of him) was expounding a recondite matter to us. His grey eyes shone and twinkled, and his usually pale face was flushed and animated. The fire burnt brightly, and the soft radiance of the incandescent lights in the lilies of silver caught the bubbles.',
    quoteExcerpt:
      'We are always getting away from the present moment. Our mental existences, which are immaterial and have no dimensions, are passing along the Time-Dimension with a uniform velocity from the cradle to the grave. Nature never appeals to intelligence until habit and instinct are useless.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Time Travel & Science Fiction',
  },
  {
    id: 2600,
    volumeNumber: 'Vol. 2600',
    title: 'War and Peace',
    author: 'Leo Tolstoy',
    authorBirthYear: 1828,
    authorDeathYear: 1910,
    translators: [
      { name: 'Aylmer Maude', birth_year: 1858, death_year: 1938 },
      { name: 'Louise Maude', birth_year: 1855, death_year: 1939 },
    ],
    year: '1869',
    openingLine:
      '“Well, Prince, so Genoa and Lucca are now just family estates of the Buonapartes. But I warn you, if you don’t tell me that this means war, if you still try to defend the infamies and horrors perpetrated by that Antichrist—I will have nothing more to do with you.”',
    quoteExcerpt:
      'We can know only that we know nothing. And that is the highest degree of human wisdom. If everyone fought for their own convictions there would be no war. Seize the moments of happiness, love and be loved! That is the only reality in the world.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Russian Epic & Historical Fiction',
  },
  {
    id: 135,
    volumeNumber: 'Vol. 135',
    title: 'Les Misérables',
    author: 'Victor Hugo',
    authorBirthYear: 1802,
    authorDeathYear: 1885,
    translators: [{ name: 'Isabel Florence Hapgood', birth_year: 1850, death_year: 1928 }],
    year: '1862',
    openingLine:
      'So long as there shall exist, by reason of law and custom, a social condemnation, which, in the face of civilization, artificially creates hells on earth, and complicates a destiny that is divine with human fatality; books like this cannot be useless.',
    quoteExcerpt:
      'Even the darkest night will end and the sun will rise. To love or have loved, that is enough. Ask nothing further. There is no other pearl to be found in the dark folds of life. It is nothing to die; it is dreadful not to live.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Social Justice & French Epic',
  },
  {
    id: 2554,
    volumeNumber: 'Vol. 2554',
    title: 'Crime and Punishment',
    author: 'Fyodor Dostoevsky',
    authorBirthYear: 1821,
    authorDeathYear: 1881,
    translators: [{ name: 'Constance Garnett', birth_year: 1861, death_year: 1946 }],
    year: '1866',
    openingLine:
      'On an exceptionally hot evening early in July a young man came out of the garret in which he lodged in S. Place and walked slowly, as though in hesitation, towards K. bridge. He had successfully avoided meeting his landlady on the stairs.',
    quoteExcerpt:
      'Pain and suffering are always inevitable for a large intelligence and a deep heart. The really great men must, I think, have great sadness on earth. It takes something more than intelligence to act intelligently.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Psychological Drama & Redemption',
  },
  {
    id: 1260,
    volumeNumber: 'Vol. 1260',
    title: 'Jane Eyre',
    author: 'Charlotte Brontë',
    authorBirthYear: 1816,
    authorDeathYear: 1855,
    year: '1847',
    openingLine:
      'There was no possibility of taking a walk that day. We had been wandering, indeed, in the leafless shrubbery an hour in the morning; but since dinner the cold winter wind had brought with it clouds so sombre, and a rain so penetrating, that further outdoor exercise was now out of the question.',
    quoteExcerpt:
      'I am no bird; and no net ensnares me; I am a free human being with an independent will, which I now exert to leave you. I would always rather be happy than dignified. I care for myself. The more solitary, the more friendless, the more unsustained I am, the more I will respect myself.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Victorian Gothic Romance & Autonomy',
  },
  {
    id: 768,
    volumeNumber: 'Vol. 768',
    title: 'Wuthering Heights',
    author: 'Emily Brontë',
    authorBirthYear: 1818,
    authorDeathYear: 1848,
    year: '1847',
    openingLine:
      '1801.—I have just returned from a visit to my landlord—the solitary neighbour that I shall be troubled with. This is certainly a beautiful country! In all England, I do not believe that I could have fixed on a situation so completely removed from the stir of society.',
    quoteExcerpt:
      'Whatever our souls are made of, his and mine are the same. If all else perished, and he remained, I should still continue to be; and if all else remained, and he were annihilated, the universe would turn to a mighty stranger. He’s more myself than I am.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Tragic Romance & Yorkshire Moors',
  },
  {
    id: 5200,
    volumeNumber: 'Vol. 5200',
    title: 'The Metamorphosis',
    author: 'Franz Kafka',
    authorBirthYear: 1883,
    authorDeathYear: 1924,
    translators: [{ name: 'David Wyllie', birth_year: null, death_year: null }],
    year: '1915',
    openingLine:
      'One morning, when Gregor Samsa woke from troubled dreams, he found himself transformed in his bed into a horrible vermin. He lay on his armour-like back, and if he lifted his head a little he could see his brown belly, slightly domed and divided by arches into stiff sections.',
    quoteExcerpt:
      'I cannot make you understand. I cannot make anyone understand what is happening inside me. I cannot even explain it to myself. What about if I sleep a little bit longer and forget all this nonsense?',
    license: 'CC0 / Public Domain',
    primarySubject: 'Existential & Modernist Allegory',
  },
  {
    id: 43,
    volumeNumber: 'Vol. 43',
    title: 'The Strange Case of Dr. Jekyll and Mr. Hyde',
    author: 'Robert Louis Stevenson',
    authorBirthYear: 1850,
    authorDeathYear: 1894,
    year: '1886',
    openingLine:
      'Mr. Utterson the lawyer was a man of a rugged countenance that was never lighted by a smile; cold, scanty and embarrassed in discourse; backward in sentiment; lean, long, dusty, dreary and yet somehow lovable.',
    quoteExcerpt:
      'With every day, and from both sides of my intelligence, the moral and the intellectual, I thus drew steadily nearer to that truth: that man is not truly one, but truly two. Quiet minds cannot be perplexed or frightened.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Psychological Horror & Duality',
  },
  {
    id: 1184,
    volumeNumber: 'Vol. 1184',
    title: 'The Count of Monte Cristo',
    author: 'Alexandre Dumas',
    authorBirthYear: 1802,
    authorDeathYear: 1870,
    year: '1844',
    openingLine:
      'On the 24th of February, 1815, the look-out at Notre-Dame de la Garde signalled the three-master, the Pharaon, from Smyrna, Trieste, and Naples. As usual, a pilot put off immediately, and rounding the Chateau d’If, got on board the vessel between Cape Morgion and Rion island.',
    quoteExcerpt:
      'All human wisdom is contained in these two words,—Wait and Hope. Moral wounds have this peculiarity—they may be hidden, but they never close; always painful, always ready to bleed when touched, they remain fresh and open in the heart.',
    license: 'CC0 / Public Domain',
    primarySubject: 'French Swashbuckler & Revenge Epic',
  },
  {
    id: 1232,
    volumeNumber: 'Vol. 1232',
    title: 'The Prince',
    author: 'Niccolò Machiavelli',
    authorBirthYear: 1469,
    authorDeathYear: 1527,
    translators: [{ name: 'W. K. Marriott', birth_year: null, death_year: 1927 }],
    year: '1532',
    openingLine:
      'All states, all powers, that have held and hold rule over men have been and are either republics or principalities. Principalities are either hereditary, in which the family has been long established; or they are new.',
    quoteExcerpt:
      'It is much safer to be feared than loved because love is preserved by the link of obligation which, owing to the baseness of men, is broken at every opportunity for their advantage; but fear preserves you by a dread of punishment which never fails.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Political Philosophy & Renaissance Statecraft',
  },
  {
    id: 132,
    volumeNumber: 'Vol. 132',
    title: 'The Art of War',
    author: 'Sun Tzu',
    authorBirthYear: -544,
    authorDeathYear: -496,
    translators: [{ name: 'Lionel Giles', birth_year: 1875, death_year: 1958 }],
    year: '5th C. BC',
    openingLine:
      'Sun Tzu said: The art of war is of vital importance to the State. It is a matter of life and death, a road either to safety or to ruin. Hence it is a subject of inquiry which can on no account be neglected.',
    quoteExcerpt:
      'The supreme art of war is to subdue the enemy without fighting. If you know the enemy and know yourself, you need not fear the result of a hundred battles. In the midst of chaos, there is also opportunity.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Ancient Military Strategy & Philosophy',
  },
  {
    id: 2680,
    volumeNumber: 'Vol. 2680',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    authorBirthYear: 121,
    authorDeathYear: 180,
    year: '180 AD',
    openingLine:
      'From my grandfather Verus I learned good morals and the government of my temper. From the reputation and remembrance of my father, modesty and a manly character. From my mother, piety and beneficence, and abstinence, not only from evil deeds, but even from evil thoughts.',
    quoteExcerpt:
      'You have power over your mind—not outside events. Realize this, and you will find strength. The happiness of your life depends upon the quality of your thoughts. Very little is needed to make a happy life; it is all within yourself.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Stoic Philosophy & Self-Mastery',
  },
  {
    id: 1727,
    volumeNumber: 'Vol. 1727',
    title: 'The Odyssey',
    author: 'Homer',
    authorBirthYear: -800,
    authorDeathYear: -750,
    translators: [{ name: 'Samuel Butler', birth_year: 1835, death_year: 1902 }],
    year: '8th C. BC',
    openingLine:
      'Tell me, O muse, of that ingenious hero who travelled far and wide after he had sacked the famous town of Troy. Many cities did he visit, and many were the nations with whose manners and customs he was acquainted; moreover he suffered much by sea.',
    quoteExcerpt:
      'There is nothing more admirable than when two people who see eye to eye keep house as man and wife, confounding their enemies and delighting their friends. Bear up, my heart, a heavier stroke than this you have had the courage to endure.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Ancient Greek Epic & Myth',
  },
  {
    id: 514,
    volumeNumber: 'Vol. 514',
    title: 'Little Women',
    author: 'Louisa May Alcott',
    authorBirthYear: 1832,
    authorDeathYear: 1888,
    year: '1868',
    openingLine:
      '“Christmas won’t be Christmas without any presents,” grumbled Jo, lying on the rug. “It’s so dreadful to be poor!” sighed Meg, looking down at her old dress. “I don’t think it’s fair for some girls to have plenty of pretty things, and other girls nothing at all,” added little Amy.',
    quoteExcerpt:
      'I am not afraid of storms, for I am learning how to sail my ship. I like good strong words that mean something. Love is the only thing that we can carry with us when we go, and it makes the end so easy.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Coming-of-Age & American Family',
  },
  {
    id: 2147,
    volumeNumber: 'Vol. 2147',
    title: 'The Works of Edgar Allan Poe',
    author: 'Edgar Allan Poe',
    authorBirthYear: 1809,
    authorDeathYear: 1849,
    year: '1845',
    openingLine:
      'Once upon a midnight dreary, while I pondered, weak and weary, Over many a quaint and curious volume of forgotten lore—While I nodded, nearly napping, suddenly there came a tapping, As of some one gently rapping, rapping at my chamber door.',
    quoteExcerpt:
      'Those who dream by day are cognizant of many things which escape those who dream only by night. Deep into that darkness peering, long I stood there wondering, fearing, doubting, dreaming dreams no mortal ever dared to dream before.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Gothic Poetry & Psychological Mystery',
  },
  {
    id: 164,
    volumeNumber: 'Vol. 164',
    title: 'Twenty Thousand Leagues Under the Sea',
    author: 'Jules Verne',
    authorBirthYear: 1828,
    authorDeathYear: 1905,
    year: '1870',
    openingLine:
      'The year 1866 was signalised by a remarkable incident, a mysterious and puzzling phenomenon, which doubtless no one has yet forgotten. Not to mention rumours which agitated the maritime population and excited the public mind, men of business were in an uproar.',
    quoteExcerpt:
      'The sea is everything. It covers seven tenths of the terrestrial globe. Its breath is pure and healthy. It is an immense desert, where man is never lonely, for he feels life stirring on all sides. The sea is only the embodiment of a supernatural and wonderful existence.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Submarine Adventure & Early Sci-Fi',
  },
  {
    id: 205,
    volumeNumber: 'Vol. 205',
    title: 'Walden',
    author: 'Henry David Thoreau',
    authorBirthYear: 1817,
    authorDeathYear: 1862,
    year: '1854',
    openingLine:
      'When I wrote the following pages, or rather the bulk of them, I lived alone, in the woods, a mile from any neighbor, in a house which I had built myself, on the shore of Walden Pond, in Concord, Massachusetts, and earned my living by the labor of my hands only.',
    quoteExcerpt:
      'I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived. Simplicity, simplicity, simplicity!',
    license: 'CC0 / Public Domain',
    primarySubject: 'Transcendentalist Nature & Solitude',
  },
  {
    id: 76,
    volumeNumber: 'Vol. 76',
    title: 'The Adventures of Huckleberry Finn',
    author: 'Mark Twain',
    authorBirthYear: 1835,
    authorDeathYear: 1910,
    year: '1884',
    openingLine:
      'You don’t know about me without you have read a book by the name of The Adventures of Tom Sawyer; but that ain’t no matter. That book was made by Mr. Mark Twain, and he told the truth, mainly. There was things which he stretched, but mainly he told the truth.',
    quoteExcerpt:
      'All right, then, I’ll go to hell. It was awful thoughts and awful words, but they was said. And I let them stay said; and never thought no more about reforming. Human beings can be awful cruel to one another.',
    license: 'CC0 / Public Domain',
    primarySubject: 'Mississippi Satire & American Realism',
  },
];

export const FEATURED_HERO_BOOK: FeaturedHeroBook = FEATURED_HERO_BOOKS[0];

export function getBookPassages(book: {
  id: number;
  title: string;
  authors?: { name: string }[];
  subjects?: string[];
  quotes?: BookPassage[];
}): BookPassage[] {
  if (Array.isArray(book.quotes) && book.quotes.length >= 2) {
    return book.quotes;
  }

  const featured = FEATURED_HERO_BOOKS.find(
    (f) => f.id === book.id || f.title.toLowerCase() === book.title.toLowerCase()
  );

  const author = formatAuthorNames(book.authors) || 'the author';
  const subject = formatPrimarySubject(book.subjects);

  if (featured) {
    if (Array.isArray(featured.quotes) && featured.quotes.length >= 2) {
      return featured.quotes;
    }

    return [
      {
        chapterLabel: 'Chapter I • The Opening Incipit',
        openingLine: featured.openingLine,
        secondaryQuote: `“In the unfolding story of ${featured.title}, ${featured.author} explores timeless truths across ${featured.primarySubject.toLowerCase()}.”`,
        quoteExcerpt: featured.quoteExcerpt,
        commentary: `Preserved in complete unabridged form in the worldwide public domain (${featured.year}).`,
      },
    ];
  }

  return [
    {
      chapterLabel: 'Volume Information • Project Gutenberg Archive',
      openingLine: `“${book.title}” is an authentic public domain volume preserved in the Project Gutenberg archive (ID #${book.id}).`,
      secondaryQuote: author !== 'the author' ? `Preserved work by ${author}.` : undefined,
      quoteExcerpt: `Extracting authentic passages from this volume… Streaming unabridged text from Project Gutenberg touching upon ${subject.toLowerCase()} to parse narrative chapters, dialogue, and notable quotes.`,
      commentary: `Preserved within the worldwide public domain archive as Gutenberg ID #${book.id}.`,
    },
  ];
}

/**
 * Checks whether a volume has authentic hand-curated multi-quote spreads
 * or should strictly prioritize dynamic passage extraction from its unabridged text.
 */
export function hasCuratedBookPassages(bookId: number, title?: string): boolean {
  if (!bookId) return false;
  return FEATURED_HERO_BOOKS.some(
    (f) => f.id === bookId || (Boolean(title) && f.title.toLowerCase() === title!.toLowerCase())
  );
}

/**
 * Returns featured classics that are 100% in the public domain in the specified jurisdiction.
 * For Life + 100 countries (e.g. Mexico), titles like Gatsby or Sherlock Holmes are filtered out.
 */
export function getJurisdictionSafeFeaturedBooks(countryCode: string = 'US'): FeaturedHeroBook[] {
  return FEATURED_HERO_BOOKS.filter((book) => {
    const evaluation = isBookPublicDomainInJurisdiction(
      {
        id: book.id,
        title: book.title,
        authors: [
          {
            name: book.author,
            birth_year: book.authorBirthYear,
            death_year: book.authorDeathYear,
          },
        ],
        translators: book.translators,
        copyright: false,
      },
      countryCode
    );
    return evaluation.isAllowed;
  });
}

/**
 * Deterministically returns the hourly spotlighted hero book from FEATURED_HERO_BOOKS.
 * Changes every hour (3,600,000 ms), filtered safely for the user's jurisdiction.
 */
export function getHourlyHeroBook(
  timestamp: number = Date.now(),
  countryCode: string = 'US'
): FeaturedHeroBook {
  const safeList = getJurisdictionSafeFeaturedBooks(countryCode);
  const list = safeList.length > 0 ? safeList : FEATURED_HERO_BOOKS;
  const hourlyIndex = Math.floor(timestamp / (1000 * 60 * 60));
  const normalizedIndex = ((hourlyIndex % list.length) + list.length) % list.length;
  return list[normalizedIndex] || list[0];
}

/**
 * Deterministically returns the daily editorial classic from FEATURED_HERO_BOOKS.
 * Rotates once per calendar day (86,400,000 ms), filtered safely for the user's jurisdiction.
 * If the candidate matches the spotlighted heroBookId, it automatically advances
 * to the next book in the circular list to guarantee zero duplication on the page.
 */
export function getDailyEditorialBook(
  heroBookId?: number,
  timestamp: number = Date.now(),
  countryCode: string = 'US'
): FeaturedHeroBook {
  const safeList = getJurisdictionSafeFeaturedBooks(countryCode);
  const list = safeList.length > 0 ? safeList : FEATURED_HERO_BOOKS;
  const dayIndex = Math.floor(timestamp / (1000 * 60 * 60 * 24));
  let candidateIndex = ((dayIndex % list.length) + list.length) % list.length;

  if (heroBookId !== undefined && list[candidateIndex]?.id === heroBookId && list.length > 1) {
    candidateIndex = (candidateIndex + 1) % list.length;
  }

  return list[candidateIndex] || list[0];
}

const CLASSIC_TAXONOMY_PATTERN =
  /\b(classic|classics|antiquity|ancient|epic|tragedy|philosophy|renaissance|enlightenment|gothic|victorian|historical fiction|poetry|drama|mythology)\b/i;

/**
 * Evaluates whether a database catalog volume qualifies as a Classic for "Classic of the Day":
 * 1. Canonical ID in FEATURED_HERO_BOOKS, OR
 * 2. Any contributor with a verified death_year <= 1900 (Antiquity through 19th-Century Classics), OR
 * 3. Subject or bookshelf matching canonical Classical / Historical / Philosophical taxonomy.
 */
export function isClassicCatalogBook(book: {
  id: number;
  authors?: { birth_year?: number | null; death_year?: number | null }[];
  subjects?: string[];
  bookshelves?: string[];
}): boolean {
  if (!book || typeof book.id !== 'number') return false;
  if (FEATURED_HERO_BOOKS.some((f) => f.id === book.id)) {
    return true;
  }
  const hasClassicEraAuthor = (book.authors || []).some(
    (a) => typeof a?.death_year === 'number' && a.death_year <= 1900
  );
  if (hasClassicEraAuthor) {
    return true;
  }
  const combinedTaxonomy = [...(book.subjects || []), ...(book.bookshelves || [])].join(' ');
  return CLASSIC_TAXONOMY_PATTERN.test(combinedTaxonomy);
}

/**
 * Maps a quote-enriched GutendexBook from Supabase into a FeaturedHeroBook
 * using exclusively its database `quotes` array (never prepending static spreads).
 */
export function gutendexBookToFeaturedHeroBook(
  book: GutendexBook
): FeaturedHeroBook & { rawBook: GutendexBook } {
  const validQuotes = Array.isArray(book.quotes) ? book.quotes : [];
  const firstPassage = validQuotes[0];
  const featuredMeta = FEATURED_HERO_BOOKS.find((f) => f.id === book.id);
  const firstAuthor = book.authors?.[0];
  const derivedYear =
    featuredMeta?.year ||
    (firstAuthor?.birth_year && firstAuthor?.death_year
      ? `${firstAuthor.birth_year}–${firstAuthor.death_year}`
      : 'Public Domain');

  const mergedQuotes =
    featuredMeta && validQuotes.length > 0
      ? [
          {
            chapterLabel: 'Chapter I • The Opening Incipit',
            openingLine: featuredMeta.openingLine,
            secondaryQuote:
              firstPassage?.secondaryQuote ||
              `“In the unfolding story of ${featuredMeta.title}, ${featuredMeta.author} explores timeless truths across ${featuredMeta.primarySubject.toLowerCase()}.”`,
            quoteExcerpt: featuredMeta.quoteExcerpt,
            rightPageQuote2: firstPassage?.rightPageQuote2,
            commentary:
              firstPassage?.commentary ||
              `Preserved in complete unabridged form in the worldwide public domain (${featuredMeta.year}).`,
          },
          ...validQuotes,
        ]
      : validQuotes;

  return {
    id: book.id,
    volumeNumber: featuredMeta?.volumeNumber || `Vol. #${book.id}`,
    title: featuredMeta?.title || book.title,
    author: featuredMeta?.author || formatAuthorNames(book.authors) || 'Anonymous',
    authorBirthYear: firstAuthor?.birth_year ?? featuredMeta?.authorBirthYear ?? null,
    authorDeathYear: firstAuthor?.death_year ?? featuredMeta?.authorDeathYear ?? null,
    translators: book.translators || featuredMeta?.translators || [],
    year: derivedYear,
    primarySubject:
      featuredMeta?.primarySubject ||
      (book.subjects && book.subjects.length > 0
        ? formatPrimarySubject(book.subjects)
        : 'Classic Literature'),
    license: featuredMeta?.license || 'CC0 / Public Domain',
    quoteExcerpt:
      featuredMeta?.quoteExcerpt ||
      firstPassage?.quoteExcerpt ||
      firstPassage?.openingLine ||
      'Preserved in the public domain for all readers.',
    openingLine:
      featuredMeta?.openingLine ||
      firstPassage?.openingLine ||
      firstPassage?.quoteExcerpt ||
      'Preserved in the public domain for all readers.',
    quotes: mergedQuotes,
    rawBook: book,
  };
}

/**
 * Selects the hourly Featured Book primarily from the database pool of books with quotes
 * (`quoteEnrichedBooks`), respecting jurisdiction. Optional topic/language `options` are supported
 * but intentionally not passed by `HeroSearch`: the editorial spotlight is decoupled from catalog filters.
 * Falls back to static `FEATURED_HERO_BOOKS` only when `quoteEnrichedBooks` has no valid matches.
 */
export function selectHourlyHeroFromPool(
  quoteEnrichedBooks: GutendexBook[] | undefined,
  timestamp: number = Date.now(),
  countryCode: string = 'US',
  options?: { topic?: string; language?: string }
): FeaturedHeroBook & { rawBook?: GutendexBook } {
  const hourlyIndex = Math.max(0, Math.floor(timestamp / (1000 * 60 * 60)));

  const safeDbPool = (quoteEnrichedBooks || []).filter(
    (b) =>
      b &&
      Array.isArray(b.quotes) &&
      b.quotes.length > 0 &&
      isBookPublicDomainInJurisdiction(b, countryCode).isAllowed
  );

  const fallback = getHourlyHeroBook(timestamp, countryCode);

  if (safeDbPool.length > 0) {
    const cleanTopic = options?.topic?.trim().toLowerCase() || '';
    const cleanLang = options?.language?.trim().toLowerCase() || '';

    if (!cleanTopic && !cleanLang) {
      const ssrMatch = safeDbPool.find((b) => b.id === fallback.id);
      if (ssrMatch) {
        return gutendexBookToFeaturedHeroBook(ssrMatch);
      }
    }

    let filteredPool = safeDbPool;
    if (cleanTopic || cleanLang) {
      const candidateFiltered = safeDbPool.filter((b) => {
        const matchesTopic =
          !cleanTopic ||
          [...(b.subjects || []), ...(b.bookshelves || [])].some((s) =>
            s.toLowerCase().includes(cleanTopic)
          );
        const matchesLang =
          !cleanLang || (b.languages || []).some((l) => l.toLowerCase() === cleanLang);
        return matchesTopic && matchesLang;
      });
      if (candidateFiltered.length > 0) {
        filteredPool = candidateFiltered;
      }
    }

    const selected = filteredPool[hourlyIndex % filteredPool.length];
    return gutendexBookToFeaturedHeroBook(selected);
  }

  return {
    ...fallback,
    rawBook: {
      id: fallback.id,
      title: fallback.title,
      authors: [
        {
          name: fallback.author,
          birth_year: fallback.authorBirthYear ?? null,
          death_year: fallback.authorDeathYear ?? null,
        },
      ],
      translators: fallback.translators || [],
      subjects: [fallback.primarySubject],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 50000,
      quotes: fallback.quotes,
    },
  };
}

/**
 * Selects the daily Classic of the Day strictly from Classics in the database pool of books with quotes
 * (`quoteEnrichedBooks` filtered by `isClassicCatalogBook`), avoiding collision with `heroBookId`.
 * Falls back to static `getDailyEditorialBook` only when the database pool is empty.
 */
export function selectDailyClassicFromPool(
  quoteEnrichedBooks: GutendexBook[] | undefined,
  heroBookId?: number,
  timestamp: number = Date.now(),
  countryCode: string = 'US'
): FeaturedHeroBook & { rawBook?: GutendexBook } {
  const dayIndex = Math.max(0, Math.floor(timestamp / (1000 * 60 * 60 * 24)));

  const safeDbPool = (quoteEnrichedBooks || []).filter(
    (b) =>
      b &&
      Array.isArray(b.quotes) &&
      b.quotes.length > 0 &&
      isBookPublicDomainInJurisdiction(b, countryCode).isAllowed
  );

  const classicDbPool = safeDbPool.filter((b) => isClassicCatalogBook(b));
  const activePool = classicDbPool.length > 0 ? classicDbPool : safeDbPool;
  const fallback = getDailyEditorialBook(heroBookId, timestamp, countryCode);

  if (activePool.length > 0) {
    const ssrMatch = activePool.find(
      (b) => b.id === fallback.id && (heroBookId === undefined || b.id !== heroBookId)
    );
    if (ssrMatch) {
      return gutendexBookToFeaturedHeroBook(ssrMatch);
    }

    let candidateIndex = dayIndex % activePool.length;
    if (
      heroBookId !== undefined &&
      activePool[candidateIndex]?.id === heroBookId &&
      activePool.length > 1
    ) {
      candidateIndex = (candidateIndex + 1) % activePool.length;
    }
    return gutendexBookToFeaturedHeroBook(activePool[candidateIndex]);
  }

  return fallback;
}

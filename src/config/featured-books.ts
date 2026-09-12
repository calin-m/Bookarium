/**
 * Featured Classic Books Fixtures for Bookarium
 * Centralized metadata for Hero spotlights and featured book cards.
 */

import { formatAuthorNames, formatPrimarySubject } from '@/lib/utils';
import { isBookPublicDomainInJurisdiction } from '@/lib/copyright-engine';

export interface FeaturedHeroBook {
  id: number;
  volumeNumber: string;
  title: string;
  author: string;
  authorBirthYear?: number;
  authorDeathYear?: number;
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

export interface BookPassage {
  chapterLabel: string;
  openingLine: string;
  secondaryQuote?: string;
  leftPageQuote2?: string;
  quoteExcerpt: string;
  rightPageQuote2?: string;
  tertiaryQuote?: string;
  commentary?: string;
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

  const author = formatAuthorNames(book.authors) || 'the author';
  const subject = formatPrimarySubject(book.subjects);

  if (featured) {
    if (featured.id === 1342) {
      return [
        {
          chapterLabel: 'Chapter I • The Opening Truth',
          openingLine: featured.openingLine,
          secondaryQuote: '“I declare after all there is no enjoyment like reading! How much sooner one tires of any thing than of a book! When I have a house of my own, I shall be miserable if I have not an excellent library.”',
          leftPageQuote2: '“There is a stubbornness about me that never can bear to be frightened at the will of others. My courage always rises with every attempt to intimidate me.”',
          quoteExcerpt: '“In vain have I struggled. It will not do. My feelings will not be repressed. You must allow me to tell you how ardently I admire and love you.”',
          rightPageQuote2: '“You have bewitched me, body and soul, and I love, I love, I love you. I never wish to be parted from you from this day on.”',
          tertiaryQuote: '“Till this moment I never knew myself.”',
          commentary: 'Volume I, Chapter XI — Elizabeth Bennet on intellectual independence.',
        },
        {
          chapterLabel: 'Chapter XXXIV • Darcy’s Confession',
          openingLine: '“There are few people whom I really love, and still fewer of whom I think well. The more I see of the world, the more am I dissatisfied with it; and every day confirms my belief of the inconsistency of all human characters.”',
          secondaryQuote: '“The distance is nothing when one has a motive.”',
          leftPageQuote2: '“I am only resolved to act in that manner, which will, in my own opinion, constitute my happiness, without reference to you, or to any person so wholly unconnected with me.”',
          quoteExcerpt: '“I could easily forgive his pride, if he had not mortified mine.”',
          rightPageQuote2: '“My good opinion once lost, is lost forever.”',
          tertiaryQuote: '“Angry people are not always wise.”',
          commentary: 'The climactic transformation of pride into genuine understanding.',
        },
        {
          chapterLabel: 'Chapter LVI • Defiance of Convention',
          openingLine: '“You may ask questions which I shall not choose to answer. The world is not to dictate to me where I should find my happiness or bestow my regard.”',
          secondaryQuote: '“Do anything rather than marry without affection.”',
          leftPageQuote2: '“We are all fools in love, but none so foolish as those who believe themselves immune.”',
          quoteExcerpt: '“It is particularly incumbent on those who never change their opinion, to be secure of judging properly at first.”',
          rightPageQuote2: '“I must learn to be content with being happier than I deserve.”',
          tertiaryQuote: '“Think only of the past as its remembrance gives you pleasure.”',
          commentary: 'A defining triumph of feminine autonomy in 19th-century literature.',
        },
      ];
    }

    if (featured.id === 84) {
      return [
        {
          chapterLabel: 'Letter I • The Arctic Expedition',
          openingLine: featured.openingLine,
          secondaryQuote: '“Life and death appeared to me ideal bounds, which I should first break through, and pour a torrent of light into our dark world. A new species would bless me as its creator.”',
          leftPageQuote2: '“There is something at work in my soul which I do not understand.”',
          quoteExcerpt: '“I was benevolent and good; misery made me a fiend. Make me happy, and I shall again be virtuous.”',
          rightPageQuote2: '“All men hate the wretched; how, then, must I be hated, who am miserable beyond all living things! Yet you, my creator, detest and spurn me, thy creature.”',
          tertiaryQuote: '“Beware; for I am fearless, and therefore powerful.”',
          commentary: 'Volume I — The vaulting ambition of Victor Frankenstein.',
        },
        {
          chapterLabel: 'Chapter X • Encounter on the Glacier',
          openingLine: '“Learn from me, if not by my precepts, at least by my example, how dangerous is the acquirement of knowledge and how much happier that man is who believes his native town to be the world.”',
          secondaryQuote: '“Seek happiness in tranquility and avoid ambition, even if it be only the apparently innocent one of distinguishing yourself in science and discoveries.”',
          leftPageQuote2: '“Nothing is so painful to the human mind as a great and sudden change.”',
          quoteExcerpt: '“If I cannot inspire love, I will cause fear! And chiefly towards you, my arch-enemy, because my creator, do I swear inextinguishable hatred.”',
          rightPageQuote2: '“I had desired it with an ardour that far exceeded moderation; but now that I had finished, the beauty of the dream vanished, and breathless horror and disgust filled my heart.”',
          tertiaryQuote: '“I shall die, and what I now feel be no longer felt.”',
          commentary: 'The Creature’s profound plea for empathy and moral responsibility.',
        },
      ];
    }

    if (featured.id === 2701) {
      return [
        {
          chapterLabel: 'Chapter I • Loomings',
          openingLine: featured.openingLine,
          secondaryQuote: '“Whenever I find myself growing grim about the mouth; whenever it is a damp, drizzly November in my soul; then, I account it high time to get to sea as soon as I can.”',
          leftPageQuote2: '“There is, one knows not what sweet mystery about this sea, whose gently awful stirrings seem to speak of some hidden soul beneath.”',
          quoteExcerpt: '“All visible objects, man, are but as pasteboard masks. But in each event—there, some unknown but still reasoning thing puts forth the mouldings of its features from behind the unreasoning mask.”',
          rightPageQuote2: '“Talk not to me of blasphemy, man; I’d strike the sun if it insulted me.”',
          tertiaryQuote: '“Towards thee I roll, thou all-destroying but unconquering whale; to the last I grapple with thee!”',
          commentary: 'The legendary opening voyage of human contemplation.',
        },
        {
          chapterLabel: 'Chapter XXXVI • The Quarter-Deck',
          openingLine: '“It is not down in any map; true places never are.”',
          secondaryQuote: '“Better sleep with a sober cannibal than a drunken Christian.”',
          leftPageQuote2: '“I know not all that may be coming, but be it what it will, I’ll go to it laughing.”',
          quoteExcerpt: '“There are certain queer times and occasions in this strange mixed affair we call life when a man takes this whole universe for a vast practical joke.”',
          rightPageQuote2: '“As for me, I am tormented with an everlasting itch for things remote. I love to sail forbidden seas, and land on barbarous coasts.”',
          tertiaryQuote: '“And the great shroud of the sea rolled on as it rolled five thousand years ago.”',
          commentary: 'Captain Ahab’s cosmic defiance against fate.',
        },
      ];
    }

    if (featured.id === 64317) {
      return [
        {
          chapterLabel: 'Chapter I • The Green Light',
          openingLine: featured.openingLine,
          secondaryQuote: '“Reserving judgments is a matter of infinite hope. I am still a little afraid of missing something if I forget that a sense of the fundamental decencies is parcelled out unequally at birth.”',
          leftPageQuote2: '“He looked at her the way all women want to be looked at by a man.”',
          quoteExcerpt: '“Gatsby believed in the green light, the orgastic future that year by year recedes before us. It eluded us then, but that’s no matter—tomorrow we will run faster, stretch out our arms farther. And one fine morning—”',
          rightPageQuote2: '“So we beat on, boats against the current, borne back ceaselessly into the past.”',
          tertiaryQuote: '“There must have been moments even that afternoon when Daisy tumbled short of his dreams—because of the colossal vitality of his illusion.”',
          commentary: 'F. Scott Fitzgerald’s lyrical meditation on the American dream.',
        },
      ];
    }

    if (featured.id === 11) {
      return [
        {
          chapterLabel: 'Chapter I • Down the Rabbit-Hole',
          openingLine: featured.openingLine,
          secondaryQuote: '“Curiouser and curiouser!” cried Alice (she was so much surprised, that for the moment she quite forgot how to speak good English).',
          leftPageQuote2: '“It’s no use going back to yesterday, because I was a different person then.”',
          quoteExcerpt: '“Why, sometimes I’ve believed as many as six impossible things before breakfast.”',
          rightPageQuote2: '“We’re all mad here. I’m mad. You’re mad. How do you know I’m mad? said Alice. You must be, said the Cat, or you wouldn’t have come here.”',
          tertiaryQuote: '“Begin at the beginning, the King said gravely, and go on till you come to the end: then stop.”',
          commentary: 'Lewis Carroll’s timeless masterpiece of whimsical logic.',
        },
      ];
    }

    if (featured.id === 174) {
      return [
        {
          chapterLabel: 'Preface • The Aesthetic Creed',
          openingLine: featured.openingLine,
          secondaryQuote: '“The only way to get rid of a temptation is to yield to it. Resist it, and your soul grows sick with longing for the things it has forbidden to itself.”',
          leftPageQuote2: '“Those who find beautiful meanings in beautiful things are the cultivated. For these there is hope.”',
          quoteExcerpt: '“The books that the world calls immoral are books that show the world its own shame.”',
          rightPageQuote2: '“I don’t want to be at the mercy of my emotions. I want to use them, to enjoy them, and to dominate them.”',
          tertiaryQuote: '“Behind every exquisite thing that existed, there was something tragic.”',
          commentary: 'Oscar Wilde’s penetrating exploration of art, vanity, and the soul.',
        },
      ];
    }

    if (featured.id === 1661) {
      return [
        {
          chapterLabel: 'A Scandal in Bohemia',
          openingLine: featured.openingLine,
          secondaryQuote: '“It is a capital mistake to theorize before one has data. Insensibly one begins to twist facts to suit theories, instead of theories to suit facts.”',
          leftPageQuote2: '“You see, but you do not observe. The distinction is clear, my dear Watson.”',
          quoteExcerpt: '“When you have eliminated the impossible, whatever remains, however improbable, must be the truth.”',
          rightPageQuote2: '“There is nothing more deceptive than an obvious fact.”',
          tertiaryQuote: '“To a great mind, nothing is little.”',
          commentary: 'Arthur Conan Doyle’s quintessential masterclass in deductive logic.',
        },
      ];
    }

    if (featured.id === 345) {
      return [
        {
          chapterLabel: 'Chapter II • Castle Dracula',
          openingLine: featured.openingLine,
          secondaryQuote: '“Welcome to my house! Enter freely and of your own will! Come freely. Go safely; and leave something of the happiness you bring!”',
          leftPageQuote2: '“Listen to them, the children of the night. What music they make!”',
          quoteExcerpt: '“There are darknesses in life and there are lights, and you are one of the lights, the light of all lights.”',
          rightPageQuote2: '“We learn from failure, not from success!”',
          tertiaryQuote: '“There is a reason why all things are as they are.”',
          commentary: 'Bram Stoker’s legendary gothic terror and epistolary romance.',
        },
      ];
    }

    if (featured.id === 98) {
      return [
        {
          chapterLabel: 'Book I • The Period',
          openingLine: featured.openingLine,
          secondaryQuote: '“It is a far, far better thing that I do, than I have ever done; it is a far, far better rest that I go to than I have ever known.”',
          leftPageQuote2: '“A wonderful fact to reflect upon, that every human creature is constituted to be that profound secret and mystery to every other.”',
          quoteExcerpt: '“There is a prodigious strength in sorrow and despair. Crushed under mills that ground millions, they could not look up.”',
          rightPageQuote2: '“I wish you to know that you have been the last dream of my soul.”',
          tertiaryQuote: '“Liberty, equality, fraternity, or death; the last, much the easiest to bestow.”',
          commentary: 'Charles Dickens’ epic tapestry of sacrifice and resurrection in revolutionary Paris.',
        },
      ];
    }

    if (featured.id === 35) {
      return [
        {
          chapterLabel: 'Chapter I • The Fourth Dimension',
          openingLine: featured.openingLine,
          secondaryQuote: '“We are always getting away from the present moment. Our mental existences are passing along the Time-Dimension with a uniform velocity from the cradle to the grave.”',
          leftPageQuote2: '“Nature never appeals to intelligence until habit and instinct are useless.”',
          quoteExcerpt: '“It is a law of nature we overlook, that intellectual versatility is the compensation for change, danger, and trouble.”',
          rightPageQuote2: '“Face this world. Learn its ways, watch it, be careful of too hasty guesses at its meaning.”',
          tertiaryQuote: '“We must live and learn, and the world is wide.”',
          commentary: 'H.G. Wells’ visionary founding text of speculative science fiction.',
        },
      ];
    }

    return [
      {
        chapterLabel: 'Chapter I • The Opening Incipit',
        openingLine: featured.openingLine,
        secondaryQuote: `“In the unfolding story of ${featured.title}, ${featured.author} explores timeless truths across ${featured.primarySubject.toLowerCase()}.”`,
        leftPageQuote2: '“A classic is a book that has never finished saying what it has to say.”',
        quoteExcerpt: featured.quoteExcerpt,
        rightPageQuote2: '“Books are the quietest and most constant of friends; they are the most accessible and wisest of counselors.”',
        tertiaryQuote: '“To read without reflecting is like eating without digesting.”',
        commentary: `Preserved in complete unabridged form in the worldwide public domain (${featured.year}).`,
      },
      {
        chapterLabel: 'Act II • Notable Dialogue & Passages',
        openingLine: `“Here the narrative of ${featured.title} deepens into reflection, capturing the unique literary voice of ${featured.author}.”`,
        secondaryQuote: '“The reading of all good books is like conversation with the finest minds of past centuries.”',
        leftPageQuote2: '“There is no friend as loyal as a book.”',
        quoteExcerpt: '“Books are a uniquely portable magic, carrying thought and imagination across centuries without decay.”',
        rightPageQuote2: '“A room without books is like a body without a soul.”',
        tertiaryQuote: '“Once you learn to read, you will be forever free.”',
        commentary: `Historical preservation under open public domain licensing (${featured.year}).`,
      },
      {
        chapterLabel: 'Act III • Climactic Reflections',
        openingLine: `“As the masterwork reaches its conclusion, ${featured.author} reflects on the enduring questions of human nature.”`,
        secondaryQuote: '“To acquire the habit of reading is to construct for yourself a refuge from almost all the miseries of life.”',
        leftPageQuote2: '“I have always imagined that Paradise will be a kind of library.”',
        quoteExcerpt: '“Reading furnishes the mind only with materials of knowledge; it is thinking that makes what we read ours.”',
        rightPageQuote2: '“A great book should leave you with many experiences, and slightly exhausted at the end.”',
        tertiaryQuote: '“Knowledge is the common property of all mankind.”',
        commentary: 'Dedicated to open scholarship and universal literary access.',
      },
    ];
  }

  return [
    {
      chapterLabel: 'Chapter I • Opening Incipit',
      openingLine: `“Here begins the timeless account of ${book.title}, a celebrated work by ${author} touching upon ${subject.toLowerCase()}.”`,
      secondaryQuote: '“A room without books is like a body without a soul.”',
      leftPageQuote2: '“Once you learn to read, you will be forever free.”',
      quoteExcerpt: `“Reading furnishes the mind only with materials of knowledge; it is thinking that makes what we read ours.” Discover the complete unabridged edition by ${author}.`,
      rightPageQuote2: '“The reading of all good books is like conversation with the finest minds of past centuries.”',
      tertiaryQuote: '“There is no friend as loyal as a book.”',
      commentary: `Preserved within the Project Gutenberg archive as ID #${book.id}.`,
    },
    {
      chapterLabel: 'Act II • Literary Reflections',
      openingLine: `“Preserved across generations, ${book.title} stands as a testament to historical scholarship and human creativity in ${subject.toLowerCase()}.”`,
      secondaryQuote: '“Books are the quietest and most constant of friends; they are the most accessible and wisest of counselors.”',
      leftPageQuote2: '“To read without reflecting is like eating without digesting.”',
      quoteExcerpt: `“A classic is a book that has never finished saying what it has to say.” Explore the complete digital text crafted by ${author}.`,
      rightPageQuote2: '“To acquire the habit of reading is to construct for yourself a refuge from almost all the miseries of life.”',
      tertiaryQuote: '“I have always imagined that Paradise will be a kind of library.”',
      commentary: 'Transcribed from original physical editions into open UTF-8 format.',
    },
    {
      chapterLabel: 'Act III • Colophon & Preservation',
      openingLine: `“This open edition of ${book.title} by ${author} is preserved freely in the worldwide public domain for all readers.”`,
      secondaryQuote: '“Knowledge is the common property of all mankind.”',
      leftPageQuote2: '“Books are a uniquely portable magic.”',
      quoteExcerpt: '“A great book should leave you with many experiences, and slightly exhausted at the end. You live several lives while reading.”',
      rightPageQuote2: '“Dedicated to open access, preservation of human culture, and universal digital learning.”',
      tertiaryQuote: '“Accessible on all devices without paywalls or subscriptions.”',
      commentary: 'Zero DRM, zero authentication, preserved under CC0 public domain dedication.',
    },
  ];
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
            birth_year: book.authorBirthYear ?? null,
            death_year: book.authorDeathYear ?? null,
          },
        ],
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

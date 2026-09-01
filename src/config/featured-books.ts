/**
 * Featured Classic Books Fixtures for Bookarium
 * Centralized metadata for Hero spotlights and featured book cards.
 */

import { formatAuthorNames, formatPrimarySubject } from '@/lib/utils';

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

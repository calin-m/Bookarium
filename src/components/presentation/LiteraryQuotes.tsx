'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, Quote, Shuffle, Sparkles, BookOpen } from 'lucide-react';

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
      'The books that the world calls immoral are books that show the world its own shame.',
    citation: 'Chapter 19',
  },
  {
    id: 6,
    bookId: 1661,
    category: 'MYSTERY & DEDUCTION',
    year: '1892',
    bookTitle: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    quote:
      'When you have eliminated the impossible, whatever remains, however improbable, must be the truth.',
    citation: 'The Sign of the Four',
  },
  {
    id: 7,
    bookId: 11,
    category: 'LITERARY FANTASY',
    year: '1865',
    bookTitle: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    quote:
      'It’s no use going back to yesterday, because I was a different person then.',
    citation: 'Chapter 10: The Lobster Quadrille',
  },
  {
    id: 8,
    bookId: 345,
    category: 'GOTHIC NOVEL',
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
    category: 'VICTORIAN CLASSIC',
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
    category: 'MODERNIST PROSE',
    year: '1915',
    bookTitle: 'The Metamorphosis',
    author: 'Franz Kafka',
    quote:
      'One morning, when Gregor Samsa woke from troubled dreams, he found himself transformed in his bed into a horrible vermin.',
    citation: 'Chapter 1, Opening line',
  },
  {
    id: 11,
    bookId: 2554,
    category: 'PSYCHOLOGICAL MASTERPIECE',
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
    citation: 'Chapter 9, Closing line',
  },
];

function getRandomThreeQuotes(excludeIds: number[] = []): LiteraryQuote[] {
  const available = LITERARY_QUOTES.filter((q) => !excludeIds.includes(q.id));
  const pool = available.length >= 3 ? available : LITERARY_QUOTES;
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
}

export const LiteraryQuotes: React.FC = () => {
  // Initialize with random 3 quotes directly on initial mount
  const [displayedQuotes, setDisplayedQuotes] = useState<LiteraryQuote[]>(() => getRandomThreeQuotes());
  const [isShuffling, setIsShuffling] = useState(false);

  const handleShuffle = useCallback(() => {
    setIsShuffling(true);
    const currentIds = displayedQuotes.map((q) => q.id);
    const nextQuotes = getRandomThreeQuotes(currentIds);
    setDisplayedQuotes(nextQuotes);
    setTimeout(() => setIsShuffling(false), 300);
  }, [displayedQuotes]);

  return (
    <section className="bg-[#f5f3ec] dark:bg-[#0e1117] py-20 border-t border-stone-200/90 dark:border-stone-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Heading & Interactive Shuffle Trigger */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-2 border-b border-stone-200/60 dark:border-stone-800/80">
          <div className="text-center sm:text-left space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-widest uppercase text-primary-600 dark:text-primary-400 font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              TIMELESS VOICES & PASSAGES
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-stone-900 dark:text-stone-100 tracking-tight">
              Words That Shaped Humanity
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 font-serif italic">
              Iconic quotes and opening lines from public domain masterworks. Click any passage to read the unabridged volume.
            </p>
          </div>

          <button
            type="button"
            onClick={handleShuffle}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 hover:text-primary-600 dark:hover:text-primary-400 hover:border-primary-500 text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-xs active:scale-95 ${
              isShuffling ? 'opacity-60 scale-95' : ''
            }`}
            aria-label="Discover more literary quotes"
          >
            <Shuffle className={`w-3.5 h-3.5 ${isShuffling ? 'animate-spin' : ''}`} />
            <span>Discover More</span>
          </button>
        </div>

        {/* 3-Column Passages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {displayedQuotes.map((item) => (
            <Link
              key={item.id}
              href={`/read/${item.bookId}`}
              className="group relative flex flex-col justify-between p-7 sm:p-8 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-booksaw hover:shadow-booksaw-hover hover:-translate-y-1.5 transition-all duration-300 cursor-pointer"
              data-testid={`quote-card-${item.id}`}
              aria-label={`Read ${item.bookTitle} by ${item.author}`}
            >
              <div className="space-y-5">
                {/* Category & Era Kicker */}
                <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-stone-400 pb-3 border-b border-stone-100 dark:border-stone-800">
                  <span className="text-primary-600 dark:text-primary-400 font-bold flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    {item.category}
                  </span>
                  <span>{item.year}</span>
                </div>

                {/* Decorative Quote Icon & Passage */}
                <div className="relative">
                  <Quote className="w-8 h-8 text-primary-500/20 absolute -top-3 -left-2 -z-0" />
                  <p className="relative z-10 font-serif italic text-base sm:text-lg text-stone-800 dark:text-stone-200 leading-relaxed group-hover:text-stone-950 dark:group-hover:text-white transition-colors">
                    &ldquo;{item.quote}&rdquo;
                  </p>
                </div>

                {/* Citation & Author Attribution */}
                <div className="pt-2">
                  <div className="font-serif font-bold text-sm text-stone-900 dark:text-stone-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {item.author}
                  </div>
                  <div className="text-xs text-stone-500 dark:text-stone-400 font-serif italic">
                    {item.bookTitle}
                  </div>
                  <div className="text-[11px] font-mono text-stone-400 dark:text-stone-500 mt-1">
                    {item.citation}
                  </div>
                </div>
              </div>

              {/* Read Book Action Link */}
              <div className="pt-6 mt-6 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs font-mono uppercase tracking-wider font-bold text-primary-600 dark:text-primary-400 group-hover:translate-x-0.5 transition-transform">
                <span>Read Volume</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};


'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Quote, Shuffle, Sparkles, BookOpen } from 'lucide-react';
import { LITERARY_QUOTES, type LiteraryQuote } from '@/config/literary-quotes';
import { ROUTES } from '@/config/routes';

export { LITERARY_QUOTES, type LiteraryQuote };

function getRandomThreeQuotes(excludeIds: number[] = []): LiteraryQuote[] {
  const available = LITERARY_QUOTES.filter((q) => !excludeIds.includes(q.id));
  const pool = available.length >= 3 ? available : LITERARY_QUOTES;
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3);
}

export const LiteraryQuotes: React.FC = () => {
  // Initialize deterministically for SSR/Client hydration match
  const [displayedQuotes, setDisplayedQuotes] = useState<LiteraryQuote[]>(() => LITERARY_QUOTES.slice(0, 3));
  const [isShuffling, setIsShuffling] = useState(false);
  const shuffleTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (shuffleTimerRef.current) {
        clearTimeout(shuffleTimerRef.current);
      }
    };
  }, []);

  const handleShuffle = useCallback(() => {
    setIsShuffling(true);
    const currentIds = displayedQuotes.map((q) => q.id);
    const nextQuotes = getRandomThreeQuotes(currentIds);
    setDisplayedQuotes(nextQuotes);

    if (shuffleTimerRef.current) {
      clearTimeout(shuffleTimerRef.current);
    }
    shuffleTimerRef.current = setTimeout(() => setIsShuffling(false), 300);
  }, [displayedQuotes]);

  return (
    <section className="bg-muted py-20 border-t border-border transition-colors duration-theme">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Heading & Interactive Shuffle Trigger */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-2 border-b border-border">
          <div className="text-center sm:text-left space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-widest uppercase text-primary font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              TIMELESS VOICES & PASSAGES
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-foreground tracking-tight text-balance">
              Words That Shaped Humanity
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-serif italic text-pretty">
              Iconic quotes and opening lines from public domain masterworks. Click any passage to read the unabridged volume.
            </p>
          </div>

          <button
            type="button"
            onClick={handleShuffle}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-foreground hover:text-primary hover:border-primary text-xs font-mono font-bold tracking-wider uppercase transition-all shadow-xs active:scale-95 ${
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
              href={ROUTES.READ(item.bookId)}
              className="group relative flex flex-col justify-between p-7 sm:p-8 rounded-xl bg-card border border-border shadow-booksaw hover:shadow-booksaw-hover hover:-translate-y-1.5 transition-all duration-300 cursor-pointer h-full"
              data-testid={`quote-card-${item.id}`}
              aria-label={`Read ${item.bookTitle} by ${item.author}`}
            >
              {/* Top Section: Category Kicker & Quote Passage (Grows vertically to push bottom info down) */}
              <div className="flex-1 flex flex-col space-y-5 mb-6">
                {/* Category & Era Kicker */}
                <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-muted-foreground pb-3 border-b border-border">
                  <span className="text-primary font-bold flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    {item.category}
                  </span>
                  <span>{item.year}</span>
                </div>

                {/* Decorative Quote Icon & Passage */}
                <div className="relative flex-1">
                  <Quote className="w-8 h-8 text-primary/20 absolute -top-3 -left-2 -z-0" />
                  <p className="relative z-10 font-serif italic text-base sm:text-lg text-foreground leading-relaxed transition-colors indent-7 sm:indent-8 text-pretty">
                    &ldquo;{item.quote}&rdquo;
                  </p>
                </div>
              </div>

              {/* Bottom Section: Citation, Author Attribution & Read Prompt (Permanently aligned at the bottom across all cards) */}
              <div className="pt-4 border-t border-border space-y-4">
                <div>
                  <div className="font-serif font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                    {item.author}
                  </div>
                  <div className="text-xs text-muted-foreground font-serif italic">
                    {item.bookTitle}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                    {item.citation}
                  </div>
                </div>

                {/* Read Action Prompt */}
                <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs font-mono text-primary font-bold">
                  <span>Read Full Volume</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

'use client';

import React, { useMemo, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Quote, BookOpen, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  getDailyEditorialBook,
  getHourlyHeroBook,
  type FeaturedHeroBook,
} from '@/config/featured-books';
import { ROUTES } from '@/config/routes';
import { useReaderStore } from '@/stores/useReaderStore';
import { useJurisdiction } from '@/stores/useJurisdictionStore';
import type { GutendexBook } from '@/types/book.types';

const subscribeHourly = (callback: () => void) => {
  const interval = setInterval(callback, 60 * 1000);
  return () => clearInterval(interval);
};

const getCurrentHourlyTimestamp = () => {
  return Math.floor(Date.now() / (1000 * 60 * 60)) * (1000 * 60 * 60);
};

const getHourlyTimestampSnapshot = () => getCurrentHourlyTimestamp();
const getHourlyTimestampServerSnapshot = () => getCurrentHourlyTimestamp();

export interface EditorialQuoteSectionProps {
  heroBookId?: number;
  className?: string;
}

export const EditorialQuoteSection: React.FC<EditorialQuoteSectionProps> = ({
  heroBookId,
  className = '',
}) => {
  const router = useRouter();
  const { country } = useJurisdiction();

  const hourlyTimestamp = useSyncExternalStore(
    subscribeHourly,
    getHourlyTimestampSnapshot,
    getHourlyTimestampServerSnapshot
  );

  const book: FeaturedHeroBook = useMemo(() => {
    const activeHeroId = heroBookId ?? getHourlyHeroBook(hourlyTimestamp, country).id;
    return getDailyEditorialBook(activeHeroId, hourlyTimestamp, country);
  }, [heroBookId, country, hourlyTimestamp]);

  // Defensive sanitization: trim outer quotes or whitespace so quotes are never doubled
  const displayQuote = useMemo(() => {
    return book.quoteExcerpt.replace(/^[“"'\s]+|[”"'\s]+$/g, '');
  }, [book.quoteExcerpt]);

  const handleStartReading = () => {
    const bookPayload: GutendexBook = {
      id: book.id,
      title: book.title,
      authors: [
        {
          name: book.author,
          birth_year: book.authorBirthYear ?? null,
          death_year: book.authorDeathYear ?? null,
        },
      ],
      translators: [],
      subjects: [book.primarySubject || 'Classic Literature'],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 50000,
    };
    useReaderStore.getState().openReader(bookPayload);
    router.push(ROUTES.READ(book.id));
  };

  return (
    <section
      aria-label="Classic of the Day"
      className={`bg-muted border-t border-border py-16 transition-colors duration-theme ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-card rounded-2xl p-8 sm:p-12 border border-border shadow-booksaw">
          {/* Left Cover Spine Card */}
          <div className="md:col-span-4 flex justify-center">
            <div
              data-testid="editorial-classic-card"
              className="w-48 aspect-[2/3] rounded-lg bg-gradient-to-br from-stone-900 to-stone-800 text-white p-5 flex flex-col justify-between shadow-booksaw-hover border-r-2 border-stone-700"
            >
              <div className="text-[10px] font-mono uppercase tracking-widest text-primary-400 font-semibold">
                Classic of the Day
              </div>
              <div>
                <h4 className="font-serif font-bold text-lg leading-tight line-clamp-3">
                  {book.title}
                </h4>
                <p className="text-xs text-stone-300 font-mono mt-1">
                  {book.author}
                </p>
              </div>
              <div className="text-[10px] font-mono text-success">
                Public Domain • {book.year}
              </div>
            </div>
          </div>

          {/* Right Quote & Reader Handoff */}
          <div className="md:col-span-8 space-y-4 text-left">
            <Quote className="w-8 h-8 text-primary-500/40" aria-hidden="true" />
            <blockquote className="text-xl sm:text-2xl font-serif italic text-stone-900 dark:text-stone-100 leading-snug">
              &ldquo;{displayQuote}&rdquo;
            </blockquote>
            <p className="text-xs font-mono uppercase tracking-widest text-stone-500">
              {book.author} • Preserved for Public Humanity
            </p>
            <div className="pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleStartReading}
                className="font-mono text-xs uppercase tracking-wider gap-2 px-5 py-2.5 rounded bg-primary-600 hover:bg-primary-700 text-white font-bold"
                aria-label={`Start reading ${book.title} by ${book.author}`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Start Reading {book.title}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};


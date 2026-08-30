'use client';

import React from 'react';
import { Search, Sparkles, Globe, BookOpen, Download, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { MotionReveal } from '@/components/motion/MotionReveal';

export interface HeroSearchProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedTopic: string;
  onTopicChange: (topic: string) => void;
  selectedLanguage: string;
  onLanguageChange: (lang: string) => void;
}

export const TOPIC_FACETS = [
  { id: '', label: 'All Collections' },
  { id: 'philosophy', label: 'Philosophy' },
  { id: 'classic literature', label: 'Classics' },
  { id: 'poetry', label: 'Poetry' },
  { id: 'science fiction', label: 'Sci-Fi' },
  { id: 'history', label: 'History' },
  { id: 'drama', label: 'Drama' },
  { id: 'gothic fiction', label: 'Gothic' },
  { id: 'adventure', label: 'Adventure' },
];

export const LANGUAGES = [
  { code: '', name: 'All Languages' },
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French (Français)' },
  { code: 'de', name: 'German (Deutsch)' },
  { code: 'es', name: 'Spanish (Español)' },
  { code: 'it', name: 'Italian (Italiano)' },
];

export const HeroSearch: React.FC<HeroSearchProps> = ({
  search,
  onSearchChange,
  selectedTopic,
  onTopicChange,
  selectedLanguage,
  onLanguageChange,
}) => {
  return (
    <section className="relative overflow-hidden pt-10 pb-12 sm:pt-14 sm:pb-16 bg-paper-50 dark:bg-stone-950 border-b border-stone-200/80 dark:border-stone-800/80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
        <MotionReveal>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-paper-200 dark:bg-stone-800 border border-stone-300/60 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-mono mb-4 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-primary-600" />
            <span>The Zero-Copyright Digital Athenaeum • 70,000+ Titles</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-serif font-extrabold tracking-tight text-stone-900 dark:text-stone-100 mb-4 leading-[1.12]">
            Timeless Literature. <br />
            <span className="font-serif italic font-normal text-stone-600 dark:text-stone-300">
              Pure, Legal, and Unbound.
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-stone-600 dark:text-stone-400 mb-8 leading-relaxed font-sans">
            Instant full-text discovery, tactile focus reader, and direct EPUB downloads from Project Gutenberg. Zero paywalls, zero accounts, zero friction.
          </p>
        </MotionReveal>

        {/* Minimalist Search Bar & Language Selector */}
        <MotionReveal delay={0.1}>
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-2.5 mb-6">
            <div className="flex-1 w-full">
              <Input
                placeholder="Search by title, author, or keyword (e.g. Dostoevsky, Austen, Marcus Aurelius)..."
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                onClear={() => onSearchChange('')}
                icon={<Search className="w-4 h-4 text-stone-400" />}
                className="h-12 text-sm shadow-sm rounded-xl border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus-visible:ring-primary-500"
                data-testid="search-input"
              />
            </div>

            <div className="w-full sm:w-auto relative">
              <div className="flex items-center gap-2 h-12 px-3.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-sm">
                <Globe className="w-3.5 h-3.5 text-stone-400" />
                <select
                  value={selectedLanguage}
                  onChange={(e) => onLanguageChange(e.target.value)}
                  className="bg-transparent text-xs font-mono text-stone-700 dark:text-stone-300 outline-none cursor-pointer pr-1"
                  aria-label="Filter by language"
                  data-testid="language-select"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code} className="bg-white dark:bg-stone-900">
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </MotionReveal>

        {/* Curated Collection Chips */}
        <MotionReveal delay={0.15}>
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-4xl mx-auto">
            {TOPIC_FACETS.map((facet) => {
              const isSelected = selectedTopic === facet.id;
              return (
                <button
                  key={facet.id || 'all'}
                  type="button"
                  onClick={() => onTopicChange(facet.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium font-serif transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-primary-700 text-white shadow-sm scale-105'
                      : 'bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:border-stone-400 dark:hover:border-stone-600'
                  }`}
                  data-testid={`topic-chip-${facet.id || 'all'}`}
                >
                  {facet.label}
                </button>
              );
            })}
          </div>
        </MotionReveal>

        {/* Value Highlights */}
        <MotionReveal delay={0.2}>
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mt-10 pt-6 border-t border-stone-200/60 dark:border-stone-800/60 text-stone-600 dark:text-stone-400 text-xs font-mono">
            <div className="flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>100% Legal Public Domain</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-primary-600" />
              <span>In-Browser Focus Reader</span>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <Download className="w-3.5 h-3.5 text-amber-600" />
              <span>Direct EPUB / Kindle</span>
            </div>
          </div>
        </MotionReveal>
      </div>
    </section>
  );
};

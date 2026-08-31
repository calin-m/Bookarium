'use client';

import React, { useState } from 'react';
import {
  Search,
  X,
  Globe,
  ArrowRight,
  ShieldCheck,
  Zap,
  Download,
  Bookmark,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { HERO_POPULAR_TOPICS, HERO_LANGUAGES } from '@/config/catalog-filters';
import { FEATURED_HERO_BOOK } from '@/config/featured-books';

export interface HeroSearchProps {
  search?: string;
  onSearchChange?: (query: string) => void;
  onSearch?: (query: string) => void;
  selectedTopic?: string;
  onTopicChange?: (topic: string) => void;
  onTopicSelect?: (topic: string) => void;
  selectedLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  onReadFeaturedBook?: () => void;
}

const FEATURES = [
  {
    icon: ShieldCheck,
    title: '100% Public Domain',
    desc: 'Pure Zero-Copyright (CC0) works.',
  },
  {
    icon: Zap,
    title: 'Zero Setup or Keys',
    desc: 'No accounts, paywalls, or tokens.',
  },
  {
    icon: Download,
    title: 'Multi-Format Downloads',
    desc: 'Direct EPUB, Kindle MOBI, & Text.',
  },
  {
    icon: Bookmark,
    title: 'Offline Reading Shelf',
    desc: 'Local browser storage & progress.',
  },
];

export const HeroSearch: React.FC<HeroSearchProps> = ({
  search = '',
  onSearchChange,
  onSearch,
  selectedTopic = '',
  onTopicChange,
  onTopicSelect,
  selectedLanguage = '',
  onLanguageChange,
  onReadFeaturedBook,
}) => {
  const [query, setQuery] = useState(search);

  const handleInputChange = (val: string) => {
    setQuery(val);
    if (onSearchChange) onSearchChange(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) onSearch(query);
    if (onSearchChange) onSearchChange(query);
  };

  const handleClear = () => {
    setQuery('');
    if (onSearchChange) onSearchChange('');
    if (onSearch) onSearch('');
  };

  const handleTopicClick = (topicId: string) => {
    const nextTopic = selectedTopic.toLowerCase() === topicId ? '' : topicId;
    if (onTopicChange) onTopicChange(nextTopic);
    if (onTopicSelect) onTopicSelect(nextTopic);
  };

  return (
    <section className="relative overflow-hidden bg-muted pt-12 sm:pt-20 pb-16 border-b border-border transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-16">
        
        {/* Booksaw Asymmetric Hero Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          
          {/* Left Column (Editorial Typography + Search + Language) */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {/* Category Kicker */}
            <div className="text-[11px] font-mono tracking-widest uppercase text-muted-foreground font-semibold flex items-center gap-2.5">
              <span className="w-8 h-[1.5px] bg-primary" />
              <span>THE PUBLIC DOMAIN ATHENAEUM • 70,000+ VOLUMES</span>
            </div>

            {/* Classical Serif Headline */}
            <div className="space-y-1">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-foreground tracking-tight leading-[1.08]">
                Timeless Literature.
              </h1>
              <div className="text-4xl sm:text-5xl md:text-6xl font-serif italic text-primary tracking-normal leading-[1.08]">
                Free Forever.
              </div>
            </div>

            {/* Description */}
            <p className="text-muted-foreground text-sm sm:text-base max-w-lg font-sans leading-relaxed">
              Explore humanity&apos;s greatest public domain books. Zero subscriptions, zero DRM restrictions, readable directly in your browser or downloaded in full format.
            </p>

            {/* Booksaw Spotlight Search Input */}
            <form onSubmit={handleSubmit} className="relative max-w-xl pt-1">
              <div className="relative flex items-center shadow-booksaw rounded-lg overflow-hidden border border-border bg-card focus-within:ring-2 focus-within:ring-primary/40 transition-all">
                <Search className="w-4 h-4 text-muted-foreground ml-4 shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="Search 70,000+ classics by title or author (e.g. Austen, Plato)..."
                  className="w-full py-3.5 pl-3 pr-10 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden"
                  data-testid="search-input"
                />
                {query && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-1.5 mr-2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  className="mr-2 px-6 py-2.5 font-mono text-xs uppercase tracking-wider rounded bg-foreground hover:opacity-90 text-background font-bold"
                >
                  Search
                </Button>
              </div>
            </form>

            {/* Genre Quick Links & Language Selector */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-mono uppercase text-muted-foreground mr-1 select-none flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-primary" /> Curated:
                </span>
                {HERO_POPULAR_TOPICS.map((topic) => {
                  const isSelected = selectedTopic.toLowerCase() === topic.id;
                  return (
                    <button
                      key={topic.id || 'all'}
                      type="button"
                      onClick={() => handleTopicClick(topic.id)}
                      data-testid={`topic-chip-${topic.id || 'all'}`}
                      className={`px-3 py-1 text-xs font-mono rounded border transition-all ${
                        isSelected
                          ? 'bg-foreground text-background border-foreground font-bold shadow-xs'
                          : 'bg-card border-border text-foreground hover:border-primary'
                      }`}
                    >
                      {topic.label}
                    </button>
                  );
                })}
              </div>

              {/* Language Selector */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-mono text-[11px] uppercase text-muted-foreground">Language:</span>
                <select
                  value={selectedLanguage}
                  onChange={(e) => onLanguageChange?.(e.target.value)}
                  data-testid="language-select"
                  className="bg-card border border-border rounded px-2 py-0.5 text-xs text-foreground focus:outline-hidden focus:border-primary cursor-pointer"
                >
                  {HERO_LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value} className="bg-card text-foreground">
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Right Column: Booksaw Standing 3D Book Cover Spotlight */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <div className="relative group cursor-pointer" onClick={onReadFeaturedBook}>
              
              {/* 3D Physical Book Spine & Cover Wrapper */}
              <div className="relative w-64 sm:w-72 md:w-80 aspect-[2/3] rounded-r-lg rounded-l-sm bg-gradient-to-r from-stone-900 via-stone-800 to-stone-950 p-6 flex flex-col justify-between text-white shadow-[25px_25px_50px_rgba(0,0,0,0.18),0_10px_20px_rgba(0,0,0,0.08)] group-hover:-translate-y-2 group-hover:shadow-[30px_35px_60px_rgba(0,0,0,0.22)] transition-all duration-300 border-r-2 border-stone-700">
                
                {/* 3D Left Spine Edge Simulation */}
                <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-black/40 via-black/20 to-transparent rounded-l-sm pointer-events-none" />
                {/* 3D Right Page Edges Simulation */}
                <div className="absolute right-0 top-1 bottom-1 w-2 bg-gradient-to-l from-white/30 to-transparent pointer-events-none" />

                {/* Top Book Header */}
                <div className="relative z-10">
                  <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-primary-300 mb-4 pb-2 border-b border-white/10">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-primary-400" /> Featured Classic
                    </span>
                    <span>{FEATURED_HERO_BOOK.volumeNumber}</span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-serif font-bold text-white leading-tight mb-2">
                    {FEATURED_HERO_BOOK.title}
                  </h3>
                  <p className="text-xs font-mono uppercase tracking-wider text-stone-300">
                    {FEATURED_HERO_BOOK.author} • {FEATURED_HERO_BOOK.year}
                  </p>
                </div>

                {/* Center Book Quote Excerpt */}
                <div className="relative z-10 my-4 p-3 rounded bg-stone-900 border border-stone-800">
                  <p className="text-xs font-serif italic text-stone-200 leading-relaxed">
                    &ldquo;{FEATURED_HERO_BOOK.quoteExcerpt}&rdquo;
                  </p>
                </div>

                {/* Bottom Action Pill */}
                <div className="relative z-10 pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                    {FEATURED_HERO_BOOK.license}
                  </span>
                  {onReadFeaturedBook && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReadFeaturedBook();
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-white bg-primary-600 hover:bg-primary-700 px-3 py-1 rounded transition-colors"
                      aria-label="Read Volume"
                    >
                      <span>Read Volume</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

              </div>

              {/* Realistic Soft Ambient Floor Shadow */}
              <div className="absolute -bottom-4 left-6 right-6 h-6 bg-black/15 dark:bg-black/40 rounded-full blur-xl pointer-events-none" />
            </div>
          </div>

        </div>

        {/* Booksaw 4-Pillar Value Proposition Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-8 border-t border-border">
          {FEATURES.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="flex items-start gap-3.5 p-4 rounded-xl bg-card border border-border shadow-xs"
              >
                <div className="w-9 h-9 rounded-lg bg-muted text-primary flex items-center justify-center shrink-0 border border-border">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-serif font-bold text-foreground">
                    {feature.title}
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">
                    {feature.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};

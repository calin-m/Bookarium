'use client';

import React from 'react';
import { ArrowRight, BookOpen, Sparkles, Feather } from 'lucide-react';

export const ARTICLES = [
  {
    id: 1,
    category: 'PRESERVATION',
    date: 'MARCH 2026',
    title: 'The Living Legacy of Project Gutenberg',
    excerpt:
      'How Michael S. Hart’s 1971 vision created an immortal digital library of over 70,000 copyright-free books for humanity.',
    icon: BookOpen,
  },
  {
    id: 2,
    category: 'PHILOSOPHY',
    date: 'FEBRUARY 2026',
    title: 'Why Public Domain Literature Matters More Than Ever',
    excerpt:
      'In an era of DRM lock-ins and recurring digital subscriptions, CC0 public domain books represent true intellectual freedom.',
    icon: Sparkles,
  },
  {
    id: 3,
    category: 'READING CRAFT',
    date: 'JANUARY 2026',
    title: 'The Art of Deep, Distraction-Free Reading',
    excerpt:
      'Rediscovering the joy of long-form classic prose in a calm, digital environment free from algorithmic feeds.',
    icon: Feather,
  },
];

export const EditorialArticles: React.FC = () => {
  return (
    <section className="bg-[#f5f3ec] dark:bg-[#0e1117] py-20 border-t border-stone-200/90 dark:border-stone-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Centered Booksaw Section Heading */}
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="text-[11px] font-mono tracking-widest uppercase text-stone-400 dark:text-stone-500 font-semibold">
            READ OUR ESSAYS & ARCHIVES
          </div>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-stone-900 dark:text-stone-100 tracking-tight">
            Latest Literary Articles
          </h2>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 font-serif italic">
            Essays on open literature, typography, and timeless classic authors.
          </p>
        </div>

        {/* 3-Column Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {ARTICLES.map((article) => {
            const Icon = article.icon;
            return (
              <article
                key={article.id}
                className="group relative flex flex-col justify-between p-6 sm:p-7 rounded-xl bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 shadow-booksaw hover:shadow-booksaw-hover hover:-translate-y-1.5 transition-all duration-300"
                data-testid={`article-card-${article.id}`}
              >
                <div className="space-y-4">
                  {/* Category & Date Kicker */}
                  <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-stone-400 pb-3 border-b border-stone-100 dark:border-stone-800">
                    <span className="text-primary-600 dark:text-primary-400 font-bold flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" />
                      {article.category}
                    </span>
                    <span>{article.date}</span>
                  </div>

                  {/* Title */}
                  <h3 className="font-serif font-bold text-lg sm:text-xl text-stone-900 dark:text-stone-100 leading-snug group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {article.title}
                  </h3>

                  {/* Excerpt */}
                  <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 font-sans leading-relaxed">
                    {article.excerpt}
                  </p>
                </div>

                {/* Read More Link */}
                <div className="pt-6 mt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs font-mono uppercase tracking-wider font-bold text-stone-900 dark:text-stone-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  <span>Read Article</span>
                  <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};


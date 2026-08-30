'use client';

import React, { useState, useMemo } from 'react';
import { X, Search, BookOpen, Check } from 'lucide-react';
import type { ChapterSection } from '@/lib/gutenberg-parser';

export interface ReaderTocDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: ChapterSection[];
  activeChapterIndex: number;
  onSelectChapter: (index: number) => void;
  bookTitle?: string;
}

export const ReaderTocDrawer: React.FC<ReaderTocDrawerProps> = ({
  isOpen,
  onClose,
  chapters,
  activeChapterIndex,
  onSelectChapter,
  bookTitle,
}) => {
  const [tocSearch, setTocSearch] = useState('');

  const filteredChapters = useMemo(() => {
    if (!tocSearch.trim()) return chapters;
    const q = tocSearch.toLowerCase();
    return chapters.filter(
      (c) => c.title.toLowerCase().includes(q) || c.displayTitle.toLowerCase().includes(q)
    );
  }, [chapters, tocSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Table of Contents">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-stone-50 dark:bg-stone-900 h-full shadow-2xl flex flex-col border-r border-stone-200 dark:border-stone-800 z-10 transition-transform duration-300">
        
        {/* Header */}
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <div>
              <h2 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100">
                Table of Contents
              </h2>
              {bookTitle && (
                <p className="text-xs font-mono text-stone-500 dark:text-stone-400 truncate max-w-[240px]">
                  {bookTitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
            aria-label="Close Table of Contents"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Chapters Bar */}
        <div className="p-3 border-b border-stone-200 dark:border-stone-800 bg-stone-100/50 dark:bg-stone-900/50">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search chapters or sections..."
              value={tocSearch}
              onChange={(e) => setTocSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs font-mono rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Chapter List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-stone-100 dark:divide-stone-800/60">
          {filteredChapters.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-stone-400">
              No matching sections found for &quot;{tocSearch}&quot;
            </div>
          ) : (
            filteredChapters.map((ch, idx) => {
              const originalIndex = chapters.findIndex((c) => c.id === ch.id);
              const isActive = originalIndex === activeChapterIndex;

              return (
                <button
                  key={ch.id || idx}
                  type="button"
                  onClick={() => {
                    onSelectChapter(originalIndex >= 0 ? originalIndex : idx);
                    onClose();
                  }}
                  className={`w-full text-left p-3 rounded-lg flex items-center justify-between gap-3 text-xs transition-colors ${
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-900 dark:text-primary-100 font-semibold'
                      : 'hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-serif truncate">{ch.displayTitle || ch.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-stone-600 dark:text-stone-400">
                        p. {ch.startPageNumber}
                      </span>
                      <span className="text-[10px] font-mono text-stone-400">
                        {ch.pageCount} {ch.pageCount === 1 ? 'page' : 'pages'}
                      </span>
                    </div>
                  </div>

                  {isActive && <Check className="w-4 h-4 text-primary-600 shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-stone-200 dark:border-stone-800 bg-stone-100/80 dark:bg-stone-900/80 text-[11px] font-mono text-stone-500 text-center">
          {chapters.length} Document Sections Total
        </div>

      </div>
    </div>
  );
};


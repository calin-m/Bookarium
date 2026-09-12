'use client';

import React from 'react';
import { ShieldCheck, X, ExternalLink } from 'lucide-react';
import { SITE_CONFIG } from '@/config/site-config';
import { getReaderTheme } from '@/config/reader-themes';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { ContentAdvisoryBanner } from '@/components/presentation/ContentAdvisoryBanner';
import { evaluateContentAdvisory } from '@/lib/content-advisory';

export interface GutenbergInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId?: number | string;
  title: string;
  author: string;
  theme?: 'light' | 'dark' | 'sepia';
  subjects?: string[];
  bookshelves?: string[];
}

/**
 * Archival information modal presenting public domain status, Project Gutenberg
 * catalog identifier, and permanent upstream repository link.
 */
export const GutenbergInfoModal: React.FC<GutenbergInfoModalProps> = ({
  isOpen,
  onClose,
  bookId,
  title,
  author,
  theme = 'light',
  subjects = [],
  bookshelves = [],
}) => {
  const activeTheme = getReaderTheme(theme);
  const contentAdvisory = evaluateContentAdvisory(subjects, bookshelves);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      backdropTestId="gutenberg-info-modal-backdrop"
      maxWidth="md"
      className={cn('p-6 space-y-4 border', activeTheme.drawerBg, activeTheme.border)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
              theme === 'sepia'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/30 dark:border-primary-500/40'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Public Domain Masterwork</span>
          </div>
          <h3 className="text-lg font-serif font-bold text-inherit">
            {title}
          </h3>
          <p className={`text-sm font-mono ${activeTheme.textMuted}`}>
            by {author}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`p-1.5 rounded-lg ${activeTheme.textMuted} hover:text-inherit transition-colors cursor-pointer`}
          aria-label="Close Information Modal"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {contentAdvisory.isMature && (
        <ContentAdvisoryBanner
          matchedSubject={contentAdvisory.matchedSubject}
          compact={true}
          testId="reader-info-content-advisory"
        />
      )}

      <div
        className={`p-3.5 rounded-xl border text-xs font-mono space-y-2 ${activeTheme.pill} border ${activeTheme.border}`}
      >
        <div className={`flex justify-between items-center py-1 border-b ${activeTheme.border}`}>
          <span className={activeTheme.textMuted}>Gutenberg Volume ID:</span>
          <span className="font-bold text-inherit">#{bookId}</span>
        </div>
        <div className={`flex justify-between items-center py-1 border-b ${activeTheme.border}`}>
          <span className={activeTheme.textMuted}>License / Status:</span>
          <span
            className={`font-medium ${
              theme === 'sepia' ? 'text-amber-400' : 'text-emerald-400 dark:text-emerald-400'
            }`}
          >
            Public Domain (Zero Copyright)
          </span>
        </div>
        <div className="flex justify-between items-center py-1">
          <span className={activeTheme.textMuted}>Archive Host:</span>
          <span className="text-inherit">Project Gutenberg</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        {bookId && (
          <a
            href={SITE_CONFIG.GUTENBERG_EBOOK(bookId)}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 text-xs font-mono hover:underline ${
              theme === 'sepia' ? 'text-amber-500' : 'text-primary'
            }`}
          >
            <span>View on Gutenberg.org</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          className={`px-4 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer border ${activeTheme.button}`}
        >
          Close
        </button>
      </div>
    </Modal>
  );
};

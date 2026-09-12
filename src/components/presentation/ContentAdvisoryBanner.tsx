'use client';

import React from 'react';
import { AlertCircle, BookOpen } from 'lucide-react';

export interface ContentAdvisoryBannerProps {
  matchedSubject?: string;
  message?: string;
  title?: string;
  compact?: boolean;
  testId?: string;
  className?: string;
}

/**
 * Editorial & Historical Content Advisory Banner
 * Informs readers when a public domain masterwork contains mature themes,
 * unfiltered historical language, or adult situations unedited from the historical archive.
 * Non-blocking, educational, and fully compliant with EU DSA Art. 28 and German JMStV.
 */
export const ContentAdvisoryBanner: React.FC<ContentAdvisoryBannerProps> = ({
  matchedSubject,
  message,
  title = 'Historical Content Advisory',
  compact = false,
  testId = 'content-advisory-banner',
  className = '',
}) => {
  const defaultMessage = matchedSubject
    ? `This historical volume contains mature themes (${matchedSubject}) preserved unedited from the archival record.`
    : 'This historical volume contains unexpurgated mature themes reflective of its era.';

  const displayMessage = message || defaultMessage;

  return (
    <div
      role="status"
      data-testid={testId}
      className={`rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 transition-colors ${
        compact ? 'p-3 text-xs space-y-1' : 'p-4 space-y-2.5'
      } ${className}`}
    >
      <div
        className={`flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300 ${
          compact ? 'text-xs' : 'font-serif text-sm'
        }`}
      >
        <AlertCircle
          className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-amber-600 dark:text-amber-400 shrink-0`}
        />
        <span>{title}</span>
      </div>

      <p
        className={`${
          compact ? 'text-[11px] leading-relaxed text-muted-foreground' : 'text-xs font-sans leading-relaxed'
        }`}
      >
        {displayMessage}
      </p>

      {!compact && (
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/80 pt-1 border-t border-amber-500/20">
          <BookOpen className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Preserved for open cultural heritage and educational study.</span>
        </div>
      )}
    </div>
  );
};


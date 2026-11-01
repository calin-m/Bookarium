import React from 'react';
import { Quote, Loader2, Sparkles } from 'lucide-react';

export interface NotablePassagesSpreadProps {
  passage: {
    quoteExcerpt: string;
    rightPageQuote2?: string;
    tertiaryQuote?: string;
  };
  isRestricted?: boolean;
  isUnavailableOffline?: boolean;
  country?: string;
  isLoading?: boolean;
}

export const NotablePassagesSpread: React.FC<NotablePassagesSpreadProps> = ({
  passage,
  isRestricted = false,
  isUnavailableOffline = false,
  country,
  isLoading = false,
}) => {
  const rightQuotesCount = 1 + (passage.rightPageQuote2 ? 1 : 0) + (passage.tertiaryQuote ? 1 : 0);

  return (
    <div className="flex-1 min-h-0 flex flex-col justify-between overflow-y-auto no-scrollbar">
      <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-muted-foreground pb-1 border-b border-border shrink-0">
        <span>Notable Passages</span>
        {isRestricted ? (
          <span className="text-amber-600 dark:text-amber-400 font-bold uppercase" data-testid="notable-passages-restricted-badge">
            Protected ({country || 'Restricted'})
          </span>
        ) : isUnavailableOffline ? (
          <span className="text-amber-600 dark:text-amber-400 font-bold uppercase" data-testid="notable-passages-offline-unavailable-badge">
            Not Downloaded
          </span>
        ) : isLoading ? (
          <span className="flex items-center gap-1.5 text-primary font-bold uppercase" data-testid="notable-passages-extracting-badge">
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            <span>Extracting Passages…</span>
          </span>
        ) : (
          <span className="text-success font-bold uppercase">CC0 / Free</span>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-around gap-2.5 py-1">
        {isLoading ? (
          /* Active Chapter Extraction & Loading Presentation */
          <div
            data-testid="notable-passage-loading"
            className="rounded-lg bg-card/75 border border-primary/25 shadow-xs p-4 sm:p-5 flex flex-col justify-between flex-1 min-h-[160px]"
          >
            <div>
              <div className="flex items-center gap-2 mb-2 text-primary">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-primary" />
                <span className="text-[11px] font-mono font-bold tracking-wider uppercase">
                  Extracting Volume Passages…
                </span>
              </div>
              <p className="font-serif italic text-foreground leading-relaxed text-pretty text-xs sm:text-[13px] mb-3">
                {passage.quoteExcerpt}
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="space-y-1.5 opacity-70">
                <div className="h-1.5 w-full rounded-full bg-primary/20 animate-pulse" />
                <div className="h-1.5 w-4/5 rounded-full bg-primary/15 animate-pulse" />
                <div className="h-1.5 w-2/3 rounded-full bg-primary/10 animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground pt-0.5">
                <Sparkles className="w-3 h-3 text-amber-500 animate-pulse shrink-0" />
                <span>Scanning narrative chapters for authentic dialogue</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Primary Quote Box */}
            <div
              data-testid="notable-passage-primary"
              className={`rounded-lg bg-card/60 border border-border shadow-xs ${
                rightQuotesCount === 1 ? 'p-4 sm:p-4.5' : 'p-2.5 sm:p-3'
              }`}
            >
              <Quote className={`${rightQuotesCount === 1 ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-primary/60 mb-1.5 shrink-0`} />
              <p
                className={`font-serif italic text-foreground leading-relaxed text-pretty ${
                  rightQuotesCount === 1
                    ? 'text-xs sm:text-sm line-clamp-8 sm:line-clamp-9'
                    : rightQuotesCount === 2
                    ? 'text-xs sm:text-[13px] line-clamp-5'
                    : 'text-xs sm:text-[13px] line-clamp-4'
                }`}
              >
                {passage.quoteExcerpt}
              </p>
            </div>

            {/* Secondary Book Quote Box */}
            {passage.rightPageQuote2 && (
              <div
                data-testid="notable-passage-secondary"
                className={`rounded-lg bg-card/60 border border-border shadow-xs ${
                  rightQuotesCount === 2 ? 'p-3 sm:p-3.5' : 'p-2.5 sm:p-3'
                }`}
              >
                <Quote className="w-3.5 h-3.5 text-primary/60 mb-1.5 shrink-0" />
                <p
                  className={`font-serif italic text-foreground leading-relaxed text-pretty ${
                    rightQuotesCount === 2
                      ? 'text-xs sm:text-[13px] line-clamp-5'
                      : 'text-xs sm:text-[13px] line-clamp-3'
                  }`}
                >
                  {passage.rightPageQuote2}
                </p>
              </div>
            )}

            {/* Tertiary Book Quote Box */}
            {passage.tertiaryQuote && (
              <div
                data-testid="notable-passage-tertiary"
                className="p-2.5 sm:p-3 rounded-lg bg-card/60 border border-border shadow-xs"
              >
                <Quote className="w-3.5 h-3.5 text-amber-500/70 mb-1 shrink-0" />
                <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-2 text-pretty">
                  {passage.tertiaryQuote}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};


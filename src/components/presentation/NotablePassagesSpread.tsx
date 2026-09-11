import React from 'react';
import { Quote } from 'lucide-react';

export interface NotablePassagesSpreadProps {
  passage: {
    quoteExcerpt: string;
    rightPageQuote2?: string;
    tertiaryQuote?: string;
  };
  isRestricted?: boolean;
  country?: string;
}

export const NotablePassagesSpread: React.FC<NotablePassagesSpreadProps> = ({
  passage,
  isRestricted = false,
  country,
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
        ) : (
          <span className="text-success font-bold uppercase">CC0 / Free</span>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-around gap-2.5 py-1">
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
      </div>
    </div>
  );
};


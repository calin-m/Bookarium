'use client';

import React from 'react';
import { Sparkles, Quote, AlertTriangle, WifiOff } from 'lucide-react';
import { ContentAdvisoryBanner } from '@/components/presentation/ContentAdvisoryBanner';
import {
  CopyBookLinkIndicator,
  handleCopyBookLinkClick,
} from '@/components/ui/CursorTooltip';
import { resolveSpreadQuoteLayout } from '@/lib/gutenberg/passages';

export interface OpenBookLeftPageSpreadProps {
  bookId: number;
  title: string;
  authorDisplay: string;
  passage: {
    openingLine: string;
    secondaryQuote?: string;
    leftPageQuote2?: string;
    chapterLabel?: string;
    commentary?: string;
  };
  rightHeaderLabel: string;
  primarySubject: string;
  fullPrimarySubject?: string;
  subjectMaxWidthClass?: string;
  cardHeight?: number;
  hasCommentary?: boolean;
  isRestricted?: boolean;
  isUnavailableOffline?: boolean;
  country?: string;
  contentAdvisory?: {
    isMature: boolean;
    matchedSubject?: string;
  };
  restrictedBadgeTestId?: string;
  offlineBadgeTestId?: string;
  advisoryTestId?: string;
  enableCopyMeta?: boolean;
  copyMetaTestId?: string;
  copyTooltipAuthor?: string;
  bodyTestId?: string;
  quotesContainerTestId?: string;
  secondaryQuoteTestId?: string;
  tertiaryQuoteTestId?: string;
  quoteRevealClass?: string;
  scrollableBody?: boolean;
}

/**
 * Shared inside-left open-book spread component rendered on the back face of
 * the 3D cover and incoming turning leaf in both `BookPreviewModal` and `HeroFeaturedBook3D`.
 */
export const OpenBookLeftPageSpread: React.FC<
  OpenBookLeftPageSpreadProps
> = ({
  bookId,
  title,
  authorDisplay,
  passage,
  rightHeaderLabel,
  primarySubject,
  fullPrimarySubject,
  subjectMaxWidthClass = 'max-w-[160px]',
  cardHeight,
  hasCommentary = false,
  isRestricted = false,
  isUnavailableOffline = false,
  country = 'US',
  contentAdvisory,
  restrictedBadgeTestId,
  offlineBadgeTestId,
  advisoryTestId,
  enableCopyMeta = false,
  copyMetaTestId,
  copyTooltipAuthor,
  bodyTestId,
  quotesContainerTestId,
  secondaryQuoteTestId,
  tertiaryQuoteTestId,
  quoteRevealClass = '',
  scrollableBody = false,
}) => {
  const isVeryLongTitle = title.length > 55;
  const isLongTitle = title.length > 36;
  const { leftQuotes, leftLineClampClass } = resolveSpreadQuoteLayout(
    passage,
    {
      title,
      hasContentAdvisory: Boolean(contentAdvisory?.isMature),
      hasCommentary,
      cardHeight,
    }
  );
  const cleanOpening = leftQuotes[0] || '';
  const cleanSecondary = leftQuotes[1];
  const cleanTertiary = leftQuotes[2];
  const hasSecondary = Boolean(cleanSecondary);

  const titleClassName = `font-serif font-bold leading-snug mb-0.5 text-foreground ${
    enableCopyMeta ? 'group-hover/copy:text-primary transition-colors ' : ''
  }text-balance ${
    isVeryLongTitle
      ? 'text-sm sm:text-base'
      : isLongTitle
      ? 'text-base sm:text-lg'
      : 'text-lg sm:text-xl'
  }`;

  return (
    <>
      <div
        data-testid={bodyTestId}
        className={`flex-1 min-h-0 flex flex-col justify-between ${
          scrollableBody ? 'overflow-y-auto no-scrollbar' : 'overflow-hidden'
        }`}
      >
        <div className={scrollableBody ? 'space-y-1.5 shrink-0' : 'shrink-0'}>
          <div
            className={`flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-primary font-bold ${
              scrollableBody ? 'pb-1' : 'mb-1.5 pb-1'
            } border-b border-border`}
          >
            {isRestricted ? (
              <span
                className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold"
                data-testid={restrictedBadgeTestId}
              >
                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                <span>Protected ({country})</span>
              </span>
            ) : isUnavailableOffline ? (
              <span
                className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold"
                data-testid={offlineBadgeTestId}
              >
                <WifiOff className="w-3 h-3 text-amber-500 shrink-0" />
                <span>Not Downloaded</span>
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Public Domain
              </span>
            )}
            <span>{rightHeaderLabel}</span>
          </div>

          {enableCopyMeta ? (
            <div
              data-testid={copyMetaTestId}
              data-copy-book-id={bookId}
              data-tooltip={`${title} — by ${copyTooltipAuthor || authorDisplay}`}
              onClick={(e) => handleCopyBookLinkClick(e, bookId)}
              onKeyDown={(e) => handleCopyBookLinkClick(e, bookId)}
              role="button"
              tabIndex={0}
              aria-label={`Copy link to ${title} by ${copyTooltipAuthor || authorDisplay}`}
              className="group/copy cursor-pointer rounded-md px-1 py-0.5 mb-1.5 hover:bg-muted/40 transition-colors"
            >
              <h3 className={titleClassName}>{title}</h3>
              <p className="text-xs font-mono italic text-muted-foreground flex items-center min-w-0">
                <span className="truncate">{authorDisplay}</span>
                <CopyBookLinkIndicator bookId={bookId} />
              </p>
            </div>
          ) : (
            <div>
              <h3 className={titleClassName}>{title}</h3>
              <p className="text-xs font-mono italic text-muted-foreground">
                {authorDisplay}
              </p>
            </div>
          )}

          {contentAdvisory?.isMature && (
            <ContentAdvisoryBanner
              matchedSubject={contentAdvisory.matchedSubject}
              compact={true}
              testId={advisoryTestId}
              className="my-1"
            />
          )}
        </div>

        <div
          data-testid={quotesContainerTestId}
          className={`flex-1 min-h-0 flex flex-col justify-around gap-2 py-0.5 ${
            scrollableBody ? '' : 'overflow-hidden'
          } ${quoteRevealClass}`.trim()}
        >
          {/* Lead Opening Line */}
          <div className="relative pl-2.5 sm:pl-3 border-l-2 border-primary/40">
            <p
              className={`font-serif italic text-foreground/90 leading-relaxed text-pretty ${
                !hasSecondary && !isLongTitle
                  ? 'text-xs sm:text-sm'
                  : isVeryLongTitle
                  ? 'text-xs'
                  : 'text-xs sm:text-[13px]'
              } ${leftLineClampClass}`}
            >
              &ldquo;{cleanOpening}&rdquo;
            </p>
          </div>

          {/* Secondary Quote Box */}
          {cleanSecondary && (
            <div
              data-testid={secondaryQuoteTestId}
              className="p-2.5 sm:p-3 rounded-lg bg-card/60 border border-border shadow-xs"
            >
              <Quote className="w-3.5 h-3.5 text-primary/60 mb-1 shrink-0" />
              <p
                className={`font-serif italic text-foreground leading-relaxed text-pretty ${
                  isLongTitle ? 'text-xs' : 'text-xs sm:text-[13px]'
                } ${leftLineClampClass}`}
              >
                &ldquo;{cleanSecondary}&rdquo;
              </p>
            </div>
          )}

          {/* Tertiary Quote Box */}
          {cleanTertiary && (
            <div
              data-testid={tertiaryQuoteTestId}
              className="p-2.5 sm:p-3 rounded-lg bg-card/60 border border-border shadow-xs"
            >
              <Quote className="w-3.5 h-3.5 text-amber-500/70 mb-1 shrink-0" />
              <p
                className={`text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed text-pretty ${leftLineClampClass}`}
              >
                &ldquo;{cleanTertiary}&rdquo;
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-border mt-2 shrink-0">
        <span
          className={`truncate ${subjectMaxWidthClass}`}
          title={fullPrimarySubject || primarySubject}
        >
          {primarySubject}
        </span>
        <span className="opacity-60">p. 1</span>
      </div>
    </>
  );
};

import React from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw, ShieldAlert, ArrowLeft } from 'lucide-react';
import type { ReaderThemeConfig } from '@/config/reader-themes';
import { LegalRestrictionError } from '@/hooks/queries/useBookContent';
import { ROUTES } from '@/config/routes';

export interface ReaderErrorViewProps {
  activeTheme: ReaderThemeConfig;
  onRetry?: () => void;
  error?: unknown;
  bookTitle?: string;
  bookAuthor?: string;
}

export const ReaderErrorView: React.FC<ReaderErrorViewProps> = ({
  activeTheme,
  onRetry,
  error,
  bookTitle,
  bookAuthor,
}) => {
  const isLegalRestriction =
    error instanceof LegalRestrictionError ||
    (typeof error === 'object' &&
      error !== null &&
      'isLegalRestriction' in error &&
      Boolean((error as { isLegalRestriction: boolean }).isLegalRestriction));

  const details = isLegalRestriction ? (error as LegalRestrictionError).details : undefined;

  if (isLegalRestriction) {
    return (
      <main
        className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${activeTheme.surface}`}
        role="main"
        data-testid="reader-legal-restriction-view"
      >
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8 text-amber-500" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-mono text-[11px] uppercase tracking-wider font-semibold mb-4">
          <span>HTTP 451: Unavailable For Legal Reasons</span>
        </div>
        {(bookTitle || bookAuthor) && (
          <div className="mb-3 max-w-lg">
            {bookTitle && (
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {bookTitle}
              </h1>
            )}
            {bookAuthor && (
              <p className={`text-sm italic mt-1 ${activeTheme.textMuted}`}>
                by {bookAuthor}
              </p>
            )}
          </div>
        )}
        <h2 className="font-serif text-xl sm:text-2xl font-bold mb-3">
          Protected by Copyright in Your Jurisdiction
        </h2>
        <div className={`text-xs font-mono max-w-lg mb-6 space-y-2 ${activeTheme.textMuted}`}>
          <p>
            {details?.reason ||
              `This title remains protected under local copyright law in ${details?.country || 'your jurisdiction'}.`}
          </p>
          {details?.restrictingAuthor && (
            <p className="text-[11px] text-muted-foreground/80">
              Restricting Author: <span className="font-semibold text-foreground">{details.restrictingAuthor}</span>
              {details.restrictingDeathYear ? ` (d. ${details.restrictingDeathYear})` : ''}
              {details.publicDomainYear ? ` • Projected Public Domain: ${details.publicDomainYear}` : ''}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground/70 pt-2 border-t border-border/40">
            Bookarium enforces strict zero-copyright compliance under the Berne Convention and local statutes. Masterwork streaming is restricted in your region.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href={ROUTES.HOME}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-mono font-bold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Library</span>
          </Link>
          <Link
            href={ROUTES.COPYRIGHT}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-mono font-medium transition-colors cursor-pointer"
          >
            <span>Learn About Copyright Jurisdictions →</span>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${activeTheme.surface}`}
      role="main"
      data-testid="reader-error-view"
    >
      <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
      {(bookTitle || bookAuthor) && (
        <div className="mb-3 max-w-md">
          {bookTitle && (
            <h1 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {bookTitle}
            </h1>
          )}
          {bookAuthor && (
            <p className={`text-xs italic mt-1 ${activeTheme.textMuted}`}>
              by {bookAuthor}
            </p>
          )}
        </div>
      )}
      <h2 className="font-serif text-lg font-bold mb-2">
        Unable to Load Masterwork Text
      </h2>
      <p className={`text-xs font-mono max-w-md mb-6 ${activeTheme.textMuted}`}>
        The Project Gutenberg plain-text mirror could not be streamed. Please check your network connection or try again.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-mono font-bold transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </button>
      )}
    </main>
  );
};


